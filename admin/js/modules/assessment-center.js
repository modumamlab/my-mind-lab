/* =========================================================
   모두의 마음연구소 상담운영센터 2.0
   심리평가센터 독립 모듈

   담당 기능
   - 검사결과 업로드 및 검사별 AI 분석
   - 상담자용 검사 간 교차분석
   - 모두의 마음연구소 심리보고서 생성·AI 수정·승인 저장

   이 파일은 admin.js보다 먼저 로드됩니다.
   공통 상태(state), 저장 함수(save/load), 레이아웃(layout) 등은
   admin.js의 공통 런타임을 사용합니다.
========================================================= */

function assessmentTestLabel(v){return String(v||'검사 미지정').replace('KCDI','K-CDI')}
function setAssessmentReservation(id){state.assessmentReservationId=String(id||'');const savedDraft=(state.assessmentReportDrafts||[]).find(x=>String(x.reservationId)===String(id));state.integratedReportDraft=savedDraft?{...savedDraft}:null;state.assessmentCrossDraft=null;const saved=state.assessmentCrossAnalyses.find(x=>String(x.reservationId)===String(id));if(saved)state.assessmentCrossDraft={...saved};render()}
function assessmentReservation(){return state.reservations.find(r=>String(r.id)===String(state.assessmentReservationId))||null}
function assessmentRequestedTests(r){
  if(!r)return[];
  const items=typeof requestedTests==='function'?requestedTests(r):[];
  return [...new Set(items.map(x=>assessmentTestLabel(x)).filter(Boolean))];
}
function analysesForReservation(id){return state.assessmentAnalyses.filter(x=>String(x.reservationId)===String(id))}
function analysisForTest(id,testType){return analysesForReservation(id).find(x=>String(x.testType)===String(testType))}
function inferAssessmentTestType(fileName,remaining=[]){
  const n=String(fileName||'').toUpperCase().replace(/[^A-Z0-9가-힣-]/g,'');
  const rules=[['MMPI-2',/MMPI/],['K-CDI',/K-?CDI|KCDI/],['GAD-7',/GAD/],['PHQ-9',/PHQ/],['TCI',/TCI/],['PAI',/PAI/],['STS',/STS/],['PAT',/PAT/],['SCT',/SCT|문장완성/],['HTP',/HTP|집나무사람/],['회복탄력성',/회복탄력/],['직무스트레스',/직무스트레스/],['직업흥미검사',/HOLLAND|직업흥미/]];
  const found=rules.find(([,re])=>re.test(n));
  if(found)return found[0];
  return remaining[0]||'기타';
}
async function analyzeAssessmentFiles(files){
  const r=assessmentReservation();if(!r){alert('먼저 회원·예약을 선택해 주세요.');return;}
  const list=Array.from(files||[]);if(!list.length)return;
  const requested=assessmentRequestedTests(r);const existing=analysesForReservation(r.id).map(x=>x.testType);
  const remaining=requested.filter(x=>!existing.includes(x));
  for(const file of list){
    const testType=inferAssessmentTestType(file.name,remaining);
    const idx=remaining.indexOf(testType);if(idx>=0)remaining.splice(idx,1);
    await analyzeAssessmentFile(r.id,testType,file,true);
  }
  alert(`${list.length}개 검사파일 분석 요청을 완료했습니다. 검사명과 신뢰도를 확인해 주세요.`);
}
async function analyzeAssessmentFile(reservationId,testType,file,silent=false){
  if(!file)return;
  const r=state.reservations.find(x=>String(x.id)===String(reservationId));
  if(!r){alert('대상 회원을 찾지 못했습니다.');return;}
  const allowed=['application/pdf','image/png','image/jpeg','image/webp'];
  if(!allowed.includes(file.type)){alert('PDF, PNG, JPG, WEBP 파일만 업로드할 수 있습니다.');return;}
  if(file.size>5*1024*1024){alert('파일은 5MB 이하로 올려 주세요. 큰 PDF는 결과표 페이지만 따로 저장해 주세요.');return;}
  const key=`${reservationId}_${testType}`;state.assessmentLoading[key]=true;render();
  try{
    const base64=await fileToBase64(file);
    const response=await fetch('/.netlify/functions/assessment-file-analysis',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({clientName:r.name,program:programBaseName(r.program),testType,fileName:file.name,mimeType:file.type,base64})});
    const data=await response.json().catch(()=>({}));
    if(!response.ok)throw new Error(data.error||'검사결과를 분석하지 못했습니다.');
    const confidenceScore=Number(data.analysis?.confidenceScore||0);const needsReview=Boolean(data.analysis?.needsReview)||confidenceScore<80;
    const item={id:Date.now()+Math.random(),reservationId:r.id,clientName:r.name,phone:r.phone||'',program:programBaseName(r.program),testType,fileName:file.name,mimeType:file.type,status:needsReview?'원자료 확인 필요':'AI 초안 · 상담자 검토 필요',reviewed:false,visibleToClient:false,createdAt:new Date().toLocaleString('ko-KR'),model:data.model||'',...data.analysis,confidenceScore,needsReview};
    state.assessmentAnalyses=[item,...state.assessmentAnalyses.filter(x=>!(String(x.reservationId)===String(r.id)&&String(x.testType)===String(testType)))];
    save('modumam_assessment_analyses',state.assessmentAnalyses);

    // [FIX-20260716-AI-UPLOAD-ACTIVATION] 검사결과 파일 업로드 즉시 AI 상담 활성화
    const uploadMeta={
      id:`ASSESSMENT-${r.id}-${String(testType).replace(/\s+/g,'-')}`,
      reservationId:r.id,clientName:r.name,phone:r.phone||'',program:programBaseName(r.program),
      testType,testName:testType,fileName:file.name,mimeType:file.type,
      summary:item.sourceSummary||item.coreFindings||'',visibleToClient:true,
      sourceType:'assessment-center-analysis',uploadedAt:new Date().toISOString(),createdAt:new Date().toLocaleString('ko-KR')
    };
    state.resultUploads=[uploadMeta,...state.resultUploads.filter(x=>String(x.id)!==String(uploadMeta.id))];
    save('modumam_test_result_uploads',state.resultUploads);
    updateReservation(r.id,{aiResultCounselingEnabled:true,aiResultCounselingActivatedAt:new Date().toLocaleString('ko-KR'),resultUploadedAt:new Date().toISOString()});
    if(!silent)alert(`${testType} 검사결과가 저장되었고 AI 결과 해석상담이 활성화되었습니다.`);
  }catch(error){alert(error.message||'검사결과 분석 중 오류가 발생했습니다.');}
  finally{delete state.assessmentLoading[key];render();}
}
function saveAssessmentAnalysis(id){
  const index=state.assessmentAnalyses.findIndex(x=>String(x.id)===String(id));if(index<0)return;
  const value=k=>document.getElementById(`assessment-${id}-${k}`)?.value?.trim()||'';
  state.assessmentAnalyses[index]={...state.assessmentAnalyses[index],sourceSummary:value('sourceSummary'),validity:value('validity'),coreFindings:value('coreFindings'),strengths:value('strengths'),vulnerabilities:value('vulnerabilities'),counselingQuestions:value('counselingQuestions'),crossChecks:value('crossChecks'),caseHypotheses:value('caseHypotheses'),cautions:value('cautions'),reviewed:true,needsReview:false,status:'상담자 검토 완료',reviewedAt:new Date().toLocaleString('ko-KR')};
  save('modumam_assessment_analyses',state.assessmentAnalyses);alert('상담자용 검사별 분석을 검토 완료로 저장했습니다.');render();
}
function deleteAssessmentAnalysis(id){if(!confirm('이 검사 분석을 삭제할까요?'))return;state.assessmentAnalyses=state.assessmentAnalyses.filter(x=>String(x.id)!==String(id));save('modumam_assessment_analyses',state.assessmentAnalyses);render()}

async function generateAssessmentCrossAnalysis(){
  const r=assessmentReservation();if(!r){alert('대상 회원을 선택해 주세요.');return;}
  const analyses=analysesForReservation(r.id);
  if(analyses.length<2){alert('검사 간 교차분석은 두 개 이상의 검사별 분석이 필요합니다.');return;}
  const unreviewed=analyses.filter(x=>!x.reviewed);
  if(unreviewed.length&&!confirm(`상담자 검토가 완료되지 않은 분석이 ${unreviewed.length}건 있습니다. 교차분석 초안을 생성할까요?`))return;
  state.assessmentCrossLoading=true;render();
  try{
    const response=await fetch('/.netlify/functions/assessment-cross-analysis',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({clientName:r.name,program:programBaseName(r.program),tests:analyses.map(x=>({testType:x.testType,sourceSummary:x.sourceSummary,validity:x.validity,coreFindings:x.coreFindings,strengths:x.strengths,vulnerabilities:x.vulnerabilities,counselingQuestions:x.counselingQuestions,crossChecks:x.crossChecks,caseHypotheses:x.caseHypotheses,cautions:x.cautions,reviewed:x.reviewed,confidenceScore:x.confidenceScore,confidenceReason:x.confidenceReason,needsReview:x.needsReview})),crossAnalysis:state.assessmentCrossDraft||state.assessmentCrossAnalyses.find(x=>String(x.reservationId)===String(r.id))||null})});
    const data=await response.json().catch(()=>({}));if(!response.ok)throw new Error(data.error||'검사 간 교차분석을 생성하지 못했습니다.');
    state.assessmentCrossDraft={...data.analysis,model:data.model||'',generatedAt:new Date().toLocaleString('ko-KR'),reservationId:r.id,clientName:r.name,tests:analyses.map(x=>x.testType)};
  }catch(error){alert(error.message||'검사 간 교차분석 중 오류가 발생했습니다.');}
  finally{state.assessmentCrossLoading=false;render();}
}
function saveAssessmentCrossAnalysis(){
  const r=assessmentReservation();const d=state.assessmentCrossDraft;if(!r||!d){alert('먼저 교차분석 초안을 생성해 주세요.');return;}
  const value=k=>document.getElementById(`cross-${k}`)?.value?.trim()||'';
  const item={id:d.id||Date.now(),reservationId:r.id,clientName:r.name,phone:r.phone||'',program:programBaseName(r.program),tests:analysesForReservation(r.id).filter(x=>x.reviewed).map(x=>x.testType),commonPatterns:value('commonPatterns'),differences:value('differences'),stateTrait:value('stateTrait'),responseContext:value('responseContext'),riskProtection:value('riskProtection'),followUpQuestions:value('followUpQuestions'),counselingImplications:value('counselingImplications'),caseIntegration:value('caseIntegration'),limitations:value('limitations'),reviewed:true,status:'상담자 검토 완료',model:d.model||'',createdAt:d.createdAt||new Date().toLocaleString('ko-KR'),updatedAt:new Date().toLocaleString('ko-KR')};
  state.assessmentCrossAnalyses=[item,...state.assessmentCrossAnalyses.filter(x=>String(x.reservationId)!==String(r.id))];
  state.assessmentCrossDraft={...item};save('modumam_assessment_cross_analyses',state.assessmentCrossAnalyses);alert('상담자용 검사 간 교차분석을 저장했습니다.');render();
}
function deleteAssessmentCrossAnalysis(){
  const r=assessmentReservation();if(!r)return;if(!confirm('이 회원의 검사 간 교차분석을 삭제할까요?'))return;
  state.assessmentCrossAnalyses=state.assessmentCrossAnalyses.filter(x=>String(x.reservationId)!==String(r.id));state.assessmentCrossDraft=null;save('modumam_assessment_cross_analyses',state.assessmentCrossAnalyses);render();
}
function buildModumamClientReportFromIntegrated(d){
  const source=d||{};
  return {
    title:'모두의 마음연구소 심리보고서',
    subtitle:source.subtitle||'심리검사 결과를 바탕으로 지금의 마음을 이해하는 보고서',
    evaluationOverview:source.evaluationOverview||'',
    testGuide:source.testGuide||'',
    keyMessage:source.keyMessage||source.professionalSummary||'',
    emotionalProfile:source.emotionalProfile||'',
    thinkingStyle:source.thinkingStyle||'',
    relationshipStyle:source.relationshipStyle||'',
    stressRecovery:source.stressRecovery||'',
    strengthsResources:source.strengthsResources||'',
    integratedUnderstanding:source.integratedUnderstanding||'',
    currentSignals:source.currentSignals||'',
    psychologicalSuggestions:source.psychologicalSuggestions||'',
    professionalSummary:source.professionalSummary||'',
    disclaimer:source.disclaimer||''
  };
}
function persistIntegratedReportDraft(draft){
  if(!draft||draft.reservationId===undefined||draft.reservationId===null)return;
  state.assessmentReportDrafts=[draft,...(state.assessmentReportDrafts||[]).filter(x=>String(x.reservationId)!==String(draft.reservationId))];
  save('modumam_assessment_report_drafts',state.assessmentReportDrafts);
}

async function generateIntegratedAssessmentReport(){
  const r=assessmentReservation();if(!r){alert('대상 회원을 선택해 주세요.');return;}
  const analyses=analysesForReservation(r.id);
  if(!analyses.length){alert('먼저 한 개 이상의 검사결과를 업로드하고 검사별 분석을 생성해 주세요.');return;}
  const reviewedAnalyses=analyses.filter(x=>x.reviewed);
  if(!reviewedAnalyses.length){alert('업로드된 검사결과 중 상담자 검토가 완료된 검사별 분석이 한 건 이상 필요합니다.');return;}
  const testGroups=reportTestGroups(r);
  const cross=state.assessmentCrossAnalyses.find(x=>String(x.reservationId)===String(r.id)&&x.reviewed)
    ||(state.assessmentCrossDraft?.reviewed?state.assessmentCrossDraft:null);
  state.integratedReportLoading=true;render();
  try{
    const response=await fetch('/.netlify/functions/integrated-assessment-report',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({clientName:r.name,program:testGroups.program,basicTests:testGroups.basicTests,additionalTests:testGroups.additionalTests,tests:reviewedAnalyses.map(x=>({testType:x.testType,sourceSummary:x.sourceSummary,validity:x.validity,coreFindings:x.coreFindings,strengths:x.strengths,vulnerabilities:x.vulnerabilities,crossChecks:x.crossChecks,cautions:x.cautions,reviewed:x.reviewed,confidenceScore:x.confidenceScore,confidenceReason:x.confidenceReason,needsReview:x.needsReview})),crossAnalysis:cross||null})});
    const data=await response.json().catch(()=>({}));if(!response.ok)throw new Error(data.error||'모두의 마음연구소 심리보고서를 생성하지 못했습니다.');
    state.integratedReportDraft={...data.report,clientReport:buildModumamClientReportFromIntegrated(data.report),model:data.model||'',qualityChecked:Boolean(data.qualityChecked),generatedAt:new Date().toLocaleString('ko-KR'),updatedAt:new Date().toLocaleString('ko-KR'),reservationId:r.id,tests:reviewedAnalyses.map(x=>x.testType)};persistIntegratedReportDraft(state.integratedReportDraft);
  }catch(error){alert(error.message||'심리보고서 생성 중 오류가 발생했습니다.');}
  finally{state.integratedReportLoading=false;render();}
}

async function reviseIntegratedAssessmentReport(){
  const r=assessmentReservation();const current=state.integratedReportDraft;
  if(!r||!current){alert('먼저 모두의 마음연구소 심리보고서를 생성해 주세요.');return;}
  const comment=document.getElementById('integrated-report-revision-comment')?.value?.trim()||'';
  if(!comment){alert('AI가 반영할 상담자 정보나 수정 코멘트를 입력해 주세요.');return;}
  const analyses=analysesForReservation(r.id);
  const reviewedAnalyses=analyses.filter(x=>x.reviewed);
  if(!reviewedAnalyses.length){alert('상담자 검토가 완료된 검사별 분석이 없습니다.');return;}
  const testGroups=reportTestGroups(r);
  const cross=state.assessmentCrossAnalyses.find(x=>String(x.reservationId)===String(r.id)&&x.reviewed)
    ||(state.assessmentCrossDraft?.reviewed?state.assessmentCrossDraft:null);
  state.integratedReportLoading=true;render();
  try{
    const response=await fetch('/.netlify/functions/integrated-assessment-report',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({clientName:r.name,program:testGroups.program,basicTests:testGroups.basicTests,additionalTests:testGroups.additionalTests,tests:reviewedAnalyses.map(x=>({testType:x.testType,sourceSummary:x.sourceSummary,validity:x.validity,coreFindings:x.coreFindings,strengths:x.strengths,vulnerabilities:x.vulnerabilities,crossChecks:x.crossChecks,cautions:x.cautions,reviewed:x.reviewed,confidenceScore:x.confidenceScore,confidenceReason:x.confidenceReason,needsReview:x.needsReview})),crossAnalysis:cross||null,currentReport:Object.fromEntries(['title','subtitle','evaluationOverview','testGuide','keyMessage','emotionalProfile','thinkingStyle','relationshipStyle','stressRecovery','strengthsResources','integratedUnderstanding','currentSignals','psychologicalSuggestions','professionalSummary','disclaimer'].map(k=>[k,current[k]||''])),counselorComment:comment,mode:'revise'})});
    const data=await response.json().catch(()=>({}));if(!response.ok)throw new Error(data.error||'상담자 코멘트를 반영한 심리보고서 수정에 실패했습니다.');
    state.integratedReportDraft={...data.report,clientReport:buildModumamClientReportFromIntegrated(data.report),model:data.model||current.model||'',qualityChecked:Boolean(data.qualityChecked),generatedAt:current.generatedAt||new Date().toLocaleString('ko-KR'),updatedAt:new Date().toLocaleString('ko-KR'),reservationId:r.id,tests:reviewedAnalyses.map(x=>x.testType),revisionCount:Number(current.revisionCount||0)+1,lastRevisionComment:comment,lastRevisedAt:new Date().toLocaleString('ko-KR')};persistIntegratedReportDraft(state.integratedReportDraft);
    alert('상담자 코멘트를 반영해 AI가 보고서 전체를 다시 점검하고 수정했습니다.');
  }catch(error){alert(error.message||'심리보고서 수정 중 오류가 발생했습니다.');}
  finally{state.integratedReportLoading=false;render();}
}
function saveIntegratedAssessmentReport(publishToClient=false){
  const r=assessmentReservation();const d=state.integratedReportDraft;
  if(!r||!d){alert('먼저 통합 심리평가보고서를 생성해 주세요.');return;}
  if(!confirm('통합 심리평가보고서와 모두의 마음연구소 심리보고서를 함께 승인 저장할까요?\n내담자 공개는 별도로 진행합니다.'))return;
  const now=new Date().toLocaleString('ko-KR');
  const tests=analysesForReservation(r.id).filter(x=>x.reviewed).map(x=>x.testType);
  const groups=reportTestGroups(r);
  const integratedSections={subtitle:d.subtitle||'',evaluationOverview:d.evaluationOverview||'',testGuide:d.testGuide||'',keyMessage:d.keyMessage||'',emotionalProfile:d.emotionalProfile||'',thinkingStyle:d.thinkingStyle||'',relationshipStyle:d.relationshipStyle||'',stressRecovery:d.stressRecovery||'',strengthsResources:d.strengthsResources||'',integratedUnderstanding:d.integratedUnderstanding||'',currentSignals:d.currentSignals||'',psychologicalSuggestions:d.psychologicalSuggestions||'',professionalSummary:d.professionalSummary||'',disclaimer:d.disclaimer||''};
  const client=buildModumamClientReportFromIntegrated(d);
  const clientSections={subtitle:client.subtitle,evaluationOverview:client.evaluationOverview,testGuide:client.testGuide,keyMessage:client.keyMessage,emotionalProfile:client.emotionalProfile,thinkingStyle:client.thinkingStyle,relationshipStyle:client.relationshipStyle,stressRecovery:client.stressRecovery,strengthsResources:client.strengthsResources,integratedUnderstanding:client.integratedUnderstanding,currentSignals:client.currentSignals,psychologicalSuggestions:client.psychologicalSuggestions,professionalSummary:client.professionalSummary,disclaimer:client.disclaimer};
  const oldIntegrated=state.reports.find(x=>String(x.reservationId)===String(r.id)&&x.integratedAssessmentReport);
  const oldClient=state.reports.find(x=>String(x.reservationId)===String(r.id)&&x.assessmentReport&&!x.integratedAssessmentReport);
  const common={reservationId:r.id,clientName:r.name,phone:r.phone||'',program:programBaseName(r.program),tests,basicTests:groups.basicTests,additionalTests:groups.additionalTests,model:d.model||'',qualityChecked:Boolean(d.qualityChecked),generatedAt:d.generatedAt||now,reviewed:true,approved:true,status:'상담자 승인 완료',reviewStatus:'approved',reviewedAt:now,approvedAt:now,reviewedBy:'상담자',createdAt:now,updatedAt:now};
  const integrated={...(oldIntegrated||{}),...common,id:oldIntegrated?.id||Date.now(),testType:'통합 심리평가보고서',title:'통합 심리평가보고서',sections:integratedSections,summary:[integratedSections.keyMessage,integratedSections.integratedUnderstanding,integratedSections.professionalSummary].filter(Boolean).join('\n\n'),strength:integratedSections.strengthsResources,caution:integratedSections.currentSignals,plan:integratedSections.psychologicalSuggestions,integratedAssessmentReport:true,assessmentReport:false,approvedForClient:false,version:Number(oldIntegrated?.version||0)+1,createdAt:oldIntegrated?.createdAt||now};
  const clientReport={...(oldClient||{}),...common,id:oldClient?.id||(Date.now()+1),testType:'모두의 마음연구소 심리보고서',title:client.title,sections:clientSections,summary:[clientSections.keyMessage,clientSections.integratedUnderstanding].filter(Boolean).join('\n\n'),strength:clientSections.strengthsResources,caution:clientSections.currentSignals,plan:[clientSections.psychologicalSuggestions,clientSections.disclaimer].filter(Boolean).join('\n\n'),assessmentReport:true,integratedAssessmentReport:false,reportBrand:'모두의 마음연구소',approvedForClient:Boolean(publishToClient),version:Number(oldClient?.version||0)+1,createdAt:oldClient?.createdAt||now};
  state.reports=[integrated,clientReport,...state.reports.filter(x=>!(String(x.reservationId)===String(r.id)&&(x.integratedAssessmentReport||x.assessmentReport)))];
  save('modumam_reports',state.reports);
  updateReservation(r.id,{integratedAssessmentReportStatus:'상담자 승인 완료',integratedAssessmentReportId:integrated.id,assessmentReportStatus:'상담자 승인 완료',assessmentReportId:clientReport.id,assessmentReportApprovedAt:now});
  state.integratedReportDraft=null;
  alert('통합 심리평가보고서와 모두의 마음연구소 심리보고서를 함께 저장했습니다.');render();
}
function assessmentAnalysisCard(a){
  const fields=[['sourceSummary','원자료 확인 요약',4],['validity','해석 가능성·타당도 확인',4],['coreFindings','핵심 결과',7],['strengths','강점·자원',5],['vulnerabilities','취약요인·주의점',5],['counselingQuestions','상담에서 확인할 질문',5],['crossChecks','다른 검사와 교차 확인할 부분',5],['caseHypotheses','사례개념화 반영 가설',5],['cautions','해석상 주의사항',4]];
  return `<details class="rounded-[2rem] border ${a.reviewed?'border-emerald-200':'border-amber-200'} bg-white shadow-sm" ${a.reviewed?'':'open'}><summary class="cursor-pointer list-none p-5"><div class="flex flex-wrap items-center justify-between gap-3"><div><p class="text-lg font-extrabold">${esc(assessmentTestLabel(a.testType))}</p><p class="mt-1 text-xs text-slate-400">${esc(a.fileName||'')} · ${esc(a.createdAt||'')}</p></div><div class="flex flex-wrap items-center gap-2"><span class="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold ${Number(a.confidenceScore||0)>=90?'text-emerald-700':Number(a.confidenceScore||0)>=80?'text-amber-700':'text-rose-700'}">신뢰도 ${Number(a.confidenceScore||0)}%</span><span class="rounded-full px-3 py-1 text-xs font-bold ${a.reviewed?'bg-emerald-50 text-emerald-700':'bg-amber-50 text-amber-700'}">${esc(a.status)}</span></div></div></summary><div class="border-t border-slate-100 p-5">${a.confidenceReason?`<div class="mb-4 rounded-2xl ${Number(a.confidenceScore||0)>=80?'bg-slate-50 text-slate-600':'bg-rose-50 text-rose-700'} p-4 text-xs leading-relaxed"><b>AI 판독 신뢰도 근거:</b> ${esc(a.confidenceReason)}</div>`:''}<div class="grid grid-cols-1 gap-4 lg:grid-cols-2">${fields.map(([key,label,rows])=>`<label class="block text-xs font-extrabold text-slate-500 ${key==='coreFindings'?'lg:col-span-2':''}">${label}<textarea id="assessment-${a.id}-${key}" rows="${rows}" class="mt-2 w-full rounded-2xl border border-slate-200 p-4 text-sm leading-relaxed">${esc(a[key]||'')}</textarea></label>`).join('')}</div><div class="mt-4 flex flex-wrap gap-2"><button onclick="saveAssessmentAnalysis('${a.id}')" class="rounded-xl bg-slate-900 px-4 py-3 text-xs font-extrabold text-white">상담자 검토 완료 저장</button><button onclick="deleteAssessmentAnalysis('${a.id}')" class="rounded-xl border border-rose-200 bg-white px-4 py-3 text-xs font-bold text-rose-600">삭제</button></div></div></details>`;
}
function testInterpretationView(){
  const r=assessmentReservation();const requested=assessmentRequestedTests(r);const analyses=r?analysesForReservation(r.id):[];
  const available=[...new Set([...requested,...analyses.map(x=>x.testType)])];
  const reportDraft=state.integratedReportDraft;
  return layout(`<div class="space-y-6"><div class="rounded-[2rem] bg-gradient-to-r from-slate-950 via-indigo-950 to-emerald-950 p-7 text-white shadow-xl"><p class="text-xs font-extrabold text-emerald-300">AI PSYCHOLOGICAL ASSESSMENT ENGINE 1.2</p><h2 class="mt-2 text-2xl font-extrabold">심리평가센터</h2><p class="mt-2 max-w-4xl text-sm leading-relaxed text-slate-300">여러 검사결과를 일괄 업로드하고, 검사별 분석을 확인한 뒤 통합 심리평가보고서와 모두의 마음연구소 심리보고서를 생성합니다. AI 결과는 반드시 원자료와 대조해 검토합니다.</p></div>
  <div class="rounded-[2rem] border border-slate-100 bg-white p-6 shadow-sm"><div class="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_auto]"><select onchange="setAssessmentReservation(this.value)" class="rounded-2xl border border-slate-200 px-4 py-3 text-sm font-bold"><option value="">회원·예약 선택</option>${state.reservations.map(x=>`<option value="${x.id}" ${String(state.assessmentReservationId)===String(x.id)?'selected':''}>${esc(x.name)} · ${esc(programBaseName(x.program))} · ${esc(x.date)} ${esc(x.time)}</option>`).join('')}</select>${r?`<button onclick="generateIntegratedAssessmentReport()" ${state.integratedReportLoading?'disabled':''} class="rounded-2xl bg-emerald-600 px-6 py-3 text-sm font-extrabold text-white disabled:opacity-50">${state.integratedReportLoading?'심리보고서 생성 중...':'통합보고서 + 심리보고서 생성'}</button>`:''}</div>${r?`<div class="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-4"><div class="rounded-2xl bg-slate-50 p-4"><p class="text-xs font-bold text-slate-400">회원</p><p class="mt-1 font-extrabold">${esc(r.name)}님</p></div><div class="rounded-2xl bg-slate-50 p-4"><p class="text-xs font-bold text-slate-400">프로그램</p><p class="mt-1 font-extrabold">${esc(programBaseName(r.program))}</p></div><div class="rounded-2xl bg-slate-50 p-4"><p class="text-xs font-bold text-slate-400">신청 검사</p><p class="mt-1 font-extrabold">${requested.length?requested.map(esc).join(', '):'검사 미등록'}</p></div><div class="rounded-2xl bg-slate-50 p-4"><p class="text-xs font-bold text-slate-400">분석 현황</p><p class="mt-1 font-extrabold">${analyses.filter(x=>x.reviewed).length}/${Math.max(requested.length,analyses.length)} 검토 완료</p></div></div>`:''}</div>
  ${r?`<div class="rounded-[2rem] border border-slate-100 bg-white p-6 shadow-sm"><div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><h3 class="text-xl font-extrabold">1. 검사결과 일괄 업로드 및 검사별 분석</h3><p class="mt-1 text-xs text-slate-400">파일명에서 검사명을 자동 판별합니다. 판별이 어려우면 아직 분석하지 않은 신청 검사 순서로 연결되므로 분석 후 검사명을 확인해 주세요.</p></div><label class="cursor-pointer rounded-2xl bg-indigo-600 px-5 py-3 text-sm font-extrabold text-white">여러 검사파일 한 번에 선택<input type="file" multiple accept="application/pdf,image/png,image/jpeg,image/webp" class="hidden" onchange="analyzeAssessmentFiles(this.files)"/></label></div><div class="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">${available.length?available.map(test=>{const a=analysisForTest(r.id,test);const loading=state.assessmentLoading[`${r.id}_${test}`];return`<div class="rounded-2xl border ${a?'border-emerald-200 bg-emerald-50':'border-slate-200 bg-slate-50'} p-5"><div class="flex items-center justify-between"><p class="font-extrabold">${esc(assessmentTestLabel(test))}</p><span class="rounded-full bg-white px-2 py-1 text-[10px] font-bold ${a?.reviewed?'text-emerald-700':a?'text-amber-700':'text-slate-400'}">${a?.reviewed?'검토완료':a?.needsReview?'확인필요':a?`AI초안 ${Number(a.confidenceScore||0)}%`:'업로드 대기'}</span></div><label class="mt-4 block cursor-pointer rounded-xl border-2 border-dashed border-slate-200 bg-white px-3 py-4 text-center text-xs font-extrabold text-indigo-700">${loading?'분석 중...':a?'파일 다시 업로드·재분석':'결과 파일 업로드·분석'}<input type="file" accept="application/pdf,image/png,image/jpeg,image/webp" class="hidden" onchange="analyzeAssessmentFile('${r.id}','${esc(test)}',this.files[0])"/></label></div>`}).join(''):'<p class="text-sm text-slate-400">신청 검사 정보가 없습니다.</p>'}</div><div class="mt-5 flex flex-wrap gap-2">${ASSESSMENT_TEST_OPTIONS.filter(x=>!available.includes(x)).map(test=>`<label class="cursor-pointer rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-600">+ ${esc(test)}<input type="file" accept="application/pdf,image/png,image/jpeg,image/webp" class="hidden" onchange="analyzeAssessmentFile('${r.id}','${esc(test)}',this.files[0])"/></label>`).join('')}</div></div>
  <div class="space-y-4"><div class="flex items-end justify-between"><div><h3 class="text-xl font-extrabold">2. 상담자용 검사별 분석</h3><p class="mt-1 text-xs text-slate-400">검사별 결과와 상담 질문, 교차 확인점, 사례개념화 가설을 검토합니다. 회원에게 공개되지 않습니다.</p></div><span class="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold">${analyses.length}건</span></div>${analyses.length?analyses.map(assessmentAnalysisCard).join(''):'<div class="rounded-[2rem] border border-dashed border-slate-200 bg-white p-10 text-center text-sm text-slate-400">검사결과 파일을 업로드하면 상담자용 분석 초안이 여기에 표시됩니다.</div>'}</div>
  ${reportDraft?`<div class="rounded-[2rem] border border-emerald-200 bg-white p-6 shadow-sm"><div class="flex flex-wrap items-center justify-between gap-3"><div><p class="text-xs font-extrabold text-emerald-600">MODUMAM PSYCHOLOGICAL REPORT</p><h3 class="mt-1 text-xl font-extrabold">3. 통합 심리평가보고서 + 모두의 마음연구소 심리보고서</h3><p class="mt-2 text-sm text-slate-500">AI는 심층 분석을 한 번만 수행합니다. 통합보고서를 기준 문서로 저장하고, 같은 내용을 내담자용 심리보고서로 함께 구성합니다.</p></div><span class="rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700">AI 품질검사 완료 · 승인 대기</span></div><div class="mt-6 space-y-5">${[['title','보고서 제목'],['subtitle','보고서 부제'],['evaluationOverview','심리평가 개요'],['testGuide','이번 심리평가에 사용된 검사'],['keyMessage','한눈에 보는 핵심 심리요약'],['emotionalProfile','정서적 특성'],['thinkingStyle','사고와 의사결정 특성'],['relationshipStyle','대인관계와 의사소통 특성'],['stressRecovery','스트레스 반응과 회복'],['strengthsResources','강점과 심리적 자원'],['integratedUnderstanding','검사 간 통합적 이해'],['currentSignals','현재 주의 깊게 살펴볼 신호'],['psychologicalSuggestions','심리검사 기반 제안'],['professionalSummary','전문가 종합 소견'],['disclaimer','검사 해석의 범위와 한계']].map(([k,l])=>`<section class="rounded-2xl border border-slate-100 bg-slate-50/70 p-5"><p class="text-xs font-extrabold text-emerald-700">${l}</p><div class="mt-3 whitespace-pre-wrap text-sm leading-7 text-slate-700">${esc(reportDraft[k]||'')}</div></section>`).join('')}</div><div class="mt-6 rounded-2xl border border-indigo-100 bg-indigo-50/60 p-5"><div class="flex flex-wrap items-center justify-between gap-2"><div><p class="text-sm font-extrabold text-indigo-900">상담자 정보·수정 코멘트 반영</p><p class="mt-1 text-xs leading-relaxed text-indigo-600">검사자료에 근거해 강조하거나 바로잡을 내용을 입력하면 AI가 기존 보고서를 그대로 덧붙이지 않고 전체 문맥을 다시 점검하여 완성본으로 수정합니다.</p></div>${reportDraft.revisionCount?`<span class="rounded-full bg-white px-3 py-1 text-[11px] font-bold text-indigo-700">AI 수정 ${Number(reportDraft.revisionCount)}회</span>`:''}</div><textarea id="integrated-report-revision-comment" rows="5" class="mt-4 w-full rounded-2xl border border-indigo-200 bg-white p-4 text-sm leading-relaxed outline-none focus:border-indigo-500" placeholder="예: 책임감은 강점으로 유지하되 자기비판 부분은 과도하게 단정하지 말 것. 회복탄력성 검사에서 확인된 도움 요청 능력을 강점에 반영할 것."></textarea><button onclick="reviseIntegratedAssessmentReport()" ${state.integratedReportLoading?'disabled':''} class="mt-3 w-full rounded-2xl bg-indigo-600 py-3.5 text-sm font-extrabold text-white disabled:opacity-50">${state.integratedReportLoading?'AI 수정 중...':'상담자 코멘트 반영하여 AI 수정'}</button>${reportDraft.lastRevisionComment?`<p class="mt-3 text-[11px] leading-relaxed text-slate-500">최근 반영 코멘트: ${esc(reportDraft.lastRevisionComment)}</p>`:''}</div><div class="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-center text-sm font-extrabold text-amber-800">생성된 보고서는 전자차트 → 심리평가에서 검토·수정·최종 승인합니다.</div></div>`:''}`:`<div class="rounded-[2rem] border border-dashed border-slate-200 bg-white p-12 text-center text-sm text-slate-400">먼저 회원과 예약을 선택해 주세요.</div>`}</div>`)
}
