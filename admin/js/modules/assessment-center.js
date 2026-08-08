console.info('[MML] assessment-center phase7 loaded');
/* =========================================================
   모두의 마음연구소 상담운영센터 2.0
   심리평가센터 독립 모듈

   담당 기능
   - 검사결과 업로드 및 검사별 AI 분석
   - 상담자용 검사 간 교차분석
   - 심리검사 종합해석보고서 생성·AI 수정·승인 저장

   이 파일은 admin.js보다 먼저 로드됩니다.
   공통 상태(state), 저장 함수(save/load), 레이아웃(layout) 등은
   admin.js의 공통 런타임을 사용합니다.
========================================================= */



function commitAssessmentReports(rows){
  const next=Array.isArray(rows)?rows:[];
  const store=window.MMLCanonicalReportStore||window.MMLReportStore;
  const write=store?.write||store?.saveAll||store?.commit;
  if(typeof write!=='function'){
    throw new Error('보고서 저장 모듈을 불러오지 못했습니다. 관리자 페이지를 강력 새로고침해 주세요.');
  }
  state.reports=write.call(store,next,{action:'심리평가센터 보고서 저장'});
  return state.reports;
}

function saveAssessmentResultFile(storageKey,mimeType,base64){
  return new Promise((resolve,reject)=>{
    if(!window.indexedDB){reject(new Error('이 브라우저에서는 검사결과 파일 저장을 지원하지 않습니다.'));return;}
    const request=indexedDB.open('modumam_assessment_files',1);
    request.onupgradeneeded=()=>{const db=request.result;if(!db.objectStoreNames.contains('files'))db.createObjectStore('files',{keyPath:'key'});};
    request.onerror=()=>reject(request.error||new Error('검사결과 파일 저장소를 열지 못했습니다.'));
    request.onsuccess=()=>{
      const db=request.result;
      const tx=db.transaction('files','readwrite');
      tx.objectStore('files').put({key:storageKey,mimeType:mimeType||'application/octet-stream',base64,updatedAt:new Date().toISOString()});
      tx.oncomplete=()=>{db.close();resolve(true);};
      tx.onerror=()=>{const err=tx.error||new Error('검사결과 파일을 저장하지 못했습니다.');db.close();reject(err);};
    };
  });
}

function syncClinicalAssessmentRecord(reservationId){
  if(!window.MMLClinicalAssessmentStore)return null;
  return window.MMLClinicalAssessmentStore.syncFromRuntime({
    reservationId,
    reservations:state.reservations||[],
    analyses:state.assessmentAnalyses||[],
    crossAnalyses:state.assessmentCrossAnalyses||[],
    reportDrafts:state.assessmentReportDrafts||[],
    reports:state.reports||[]
  });
}
function assessmentTestLabel(v){return String(v||'검사 미지정').replace('KCDI','K-CDI')}
function setAssessmentReservation(id){state.assessmentReservationId=String(id||'');const savedDraft=window.MMLReportStore?.getDraftByReservationId?.(id)|| (state.assessmentReportDrafts||[]).find(x=>String(x.reservationId)===String(id));state.integratedReportDraft=savedDraft?{...savedDraft}:null;state.assessmentCrossDraft=null;const saved=state.assessmentCrossAnalyses.find(x=>String(x.reservationId)===String(id));if(saved)state.assessmentCrossDraft={...saved};render()}
function assessmentReservation(){return state.reservations.find(r=>String(r.id)===String(state.assessmentReservationId))||null}
function assessmentRequestedTests(r){
  if(!r)return[];
  const items=typeof requestedTests==='function'?requestedTests(r):[];
  return [...new Set(items.map(x=>assessmentTestLabel(x)).filter(Boolean))];
}
function analysesForReservation(id){return state.assessmentAnalyses.filter(x=>String(x.reservationId)===String(id))}
function assessmentTestKey(v){return String(v||'').toUpperCase().replace(/[^A-Z0-9가-힣]/g,'')}
function assessmentTestMatches(actual,expected){
  const a=assessmentTestKey(actual),e=assessmentTestKey(expected);
  if(!a||!e)return false;
  if(e.includes('신청자TCI'))return a.includes('신청자TCI');
  if(e.includes('배우자TCI'))return a.includes('배우자TCI');
  return a.includes(e)||e.includes(a)||(
    e.includes('KCDI')&&a.includes('KCDI')
  );
}
function validateIntegratedReportMaterials(r,groups,analyses){
  const reviewed=(analyses||[]).filter(x=>x.reviewed);
  const requested=[...(groups.basicTests||[]),...(groups.additionalTests||[])];
  const missingUpload=requested.filter(expected=>!(analyses||[]).some(x=>assessmentTestMatches(x.testType,expected)));
  const missingReview=requested.filter(expected=>!(reviewed||[]).some(x=>assessmentTestMatches(x.testType,expected)));
  return {requested,missingUpload,missingReview,ready:requested.length>0&&!missingUpload.length&&!missingReview.length};
}

function analysisForTest(id,testType){return analysesForReservation(id).find(x=>String(x.testType)===String(testType))}
function inferAssessmentTestType(fileName,remaining=[]){
  const n=String(fileName||'').toUpperCase().replace(/[^A-Z0-9가-힣-]/g,'');
  const rules=[['MMPI-2',/MMPI/],['K-CDI',/K-?CDI|KCDI/],['GAD-7',/GAD/],['PHQ-9',/PHQ/],['TCI',/TCI/],['PAI',/PAI/],['STS',/STS/],['PAT',/PAT/],['SCT',/SCT|문장완성/],['HTP',/HTP|집나무사람/],['회복탄력성',/회복탄력/],['직무스트레스',/직무스트레스/],['직업흥미검사',/HOLLAND|직업흥미/]];
  const found=rules.find(([,re])=>re.test(n));
  if(found){
    // 부부 마음이음의 TCI 2건은 파일명에 신청자/배우자가 없더라도 남은 대상 순서로 구분합니다.
    if(found[0]==='TCI'){
      const roleTarget=(remaining||[]).find(x=>String(x).includes('신청자 TCI')||String(x).includes('배우자 TCI'));
      if(roleTarget)return roleTarget;
    }
    return found[0];
  }
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
async function requestCanonicalAssessmentInterpretation(payload){
  const response=await fetch('/.netlify/functions/mml-assessment-file-analysis',{
    method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)
  });
  const data=await response.json().catch(async()=>({error:(await response.text().catch(()=>''))||''}));
  if(!response.ok)throw new Error(data.error||`심리검사 AI 결과 해석 실패 (${response.status})`);
  if(!data.analysis)throw new Error('AI 결과 해석 본문을 생성하지 못했습니다.');
  return data;
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
    const commonBody={clientName:r.name,program:programBaseName(r.program),testType,fileName:file.name,mimeType:file.type};

    // 1단계: PDF/이미지에서 점수·척도·타당도 등 확인 가능한 사실만 추출합니다.
    const extractResponse=await fetch('/.netlify/functions/mml-assessment-file-extract',{
      method:'POST',headers:{'Content-Type':'application/json'},
      body:JSON.stringify({...commonBody,base64})
    });
    const extractData=await extractResponse.json().catch(async()=>({error:(await extractResponse.text().catch(()=>''))||''}));
    if(!extractResponse.ok){
      throw new Error(extractData.error||`검사결과 파일 읽기 실패 (${extractResponse.status})`);
    }
    const extractedFacts=extractData.extracted;
    if(!extractedFacts||typeof extractedFacts!=='object'){
      throw new Error('검사결과에서 분석 가능한 사실을 추출하지 못했습니다. 결과표와 프로파일이 보이는 파일인지 확인해 주세요.');
    }

    // 2단계: 단일 AI 해석 엔진에서 임상 해석 + 내담자용 개별보고서 + 상담자용 검토자료를 함께 생성합니다.
    // 원본 파일은 다시 보내지 않고 1단계에서 추출된 사실만 전달합니다.
    const data=await requestCanonicalAssessmentInterpretation({...commonBody,extractedFacts,mode:'interpret-and-report'});
    const confidenceScore=Number(data.analysis?.confidenceScore||0);const needsReview=Boolean(data.analysis?.needsReview)||confidenceScore<80;
    const enrichedAnalysis={...data.analysis,reportEngineVersion:data.engineVersion||data.analysis?.engineVersion||'MML-CLINICAL-INTERPRETATION-1.0-CANONICAL',reportGenerationRequired:false};

    const item={id:Date.now()+Math.random(),reservationId:r.id,clientName:r.name,phone:r.phone||'',program:programBaseName(r.program),testType,fileName:file.name,mimeType:file.type,status:'AI 결과 해석 완료 · 상담자 검토 필요',reviewed:false,visibleToClient:false,createdAt:new Date().toLocaleString('ko-KR'),model:data.model||'',...enrichedAnalysis,confidenceScore,needsReview};
    state.assessmentAnalyses=[item,...state.assessmentAnalyses.filter(x=>!(String(x.reservationId)===String(r.id)&&String(x.testType)===String(testType)))];
    save('modumam_assessment_analyses',state.assessmentAnalyses);
    syncClinicalAssessmentRecord(r.id);

    // [FIX-20260716-AI-UPLOAD-ACTIVATION] 검사결과 파일 업로드 즉시 AI 상담 활성화
    const storageKey=`ASSESSMENT-FILE-${r.id}-${String(testType).replace(/\s+/g,'-')}`;
    await saveAssessmentResultFile(storageKey,file.type,base64);
    const uploadMeta={
      id:`ASSESSMENT-${r.id}-${String(testType).replace(/\s+/g,'-')}`,
      reservationId:r.id,clientName:r.name,phone:r.phone||'',program:programBaseName(r.program),
      testType,testName:testType,fileName:file.name,mimeType:file.type,storageKey,
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

function deleteAssessmentTestResult(reservationId,testType){
  const r=state.reservations.find(x=>String(x.id)===String(reservationId));
  const label=assessmentTestLabel(testType);
  if(!confirm(`${label} 검사결과와 검사별 분석을 삭제할까요?\n\n예약정보와 다른 검사결과는 유지됩니다.`))return;
  state.assessmentAnalyses=(state.assessmentAnalyses||[]).filter(x=>!(String(x.reservationId)===String(reservationId)&&String(x.testType)===String(testType)));
  save('modumam_assessment_analyses',state.assessmentAnalyses);
  state.resultUploads=(state.resultUploads||[]).filter(x=>!(String(x.reservationId)===String(reservationId)&&String(x.testType||x.testName)===String(testType)));
  save('modumam_test_result_uploads',state.resultUploads);
  try{
    const request=indexedDB.open('modumam_assessment_files',1);
    request.onsuccess=()=>{const db=request.result;const tx=db.transaction('files','readwrite');tx.objectStore('files').delete(`ASSESSMENT-FILE-${reservationId}-${String(testType).replace(/\s+/g,'-')}`);tx.oncomplete=()=>db.close();};
  }catch(e){}
  if(r){
    const remaining=(state.resultUploads||[]).filter(x=>String(x.reservationId)===String(reservationId));
    if(!remaining.length)updateReservation(r.id,{resultUploadedAt:'',aiResultCounselingEnabled:false,aiResultCounselingActivatedAt:''});
  }
  syncClinicalAssessmentRecord(reservationId);
  alert(`${label} 검사결과와 분석을 삭제했습니다.`);
  render();
}

function assessmentAnalysisEditorValue(id,key,fallback=''){
  const el=document.getElementById(`assessment-${id}-${key}`);
  return el?String(('value' in el?el.value:el.innerText)||'').trim():String(fallback||'');
}
function assessmentAnalysisWithEditorValues(a){
  if(!a)return a;
  const keys=['sourceSummary','validity','coreFindings','strengths','vulnerabilities','helpfulDirections','counselingQuestions','crossChecks','caseHypotheses','cautions','emotionalPattern','thinkingPattern','relationshipPattern','stressPattern','dailyMeaning'];
  const next={...a};
  keys.forEach(key=>{next[key]=assessmentAnalysisEditorValue(a.id,key,a[key]);});
  return next;
}

function professionalFallbackText(value,fallback){
  const text=String(value||'').trim();
  return text.length>=40?text:String(fallback||'').trim();
}
function professionalIndividualReportSource(analysis){
  const a=analysis||{};
  const originalClient=a.clientReport||{};
  const originalProfile=a.professionalProfile||originalClient.professionalProfile||{};
  const evidence=String(a.coreFindings||a.sourceSummary||a.rawFacts?.summary||a.confidenceReason||'').trim();
  const base=evidence||'업로드된 검사결과에서 확인된 반응 특성과 현재의 적응 양상을 중심으로 해석하였습니다.';
  const currentMind=professionalFallbackText(originalClient.currentMind||originalClient.overview,
    `${base} 이 결과는 한 가지 특성만으로 사람을 규정하기보다, 정서 반응과 사고 방식, 관계 경험, 스트레스 대처가 서로 어떻게 연결되는지를 이해하는 자료로 활용하는 것이 적절합니다.`);
  const strengths=professionalFallbackText(originalClient.strengths||a.strengths,
    `${String(a.strengths||base).trim()} 현재 확인된 강점은 상황을 이해하고 조절하려는 노력, 필요한 자원을 활용할 수 있는 가능성에 있습니다. 이러한 자원은 부담이 높아질 때 회복의 출발점으로 활용할 수 있습니다.`);
  const focus=professionalFallbackText(originalClient.focus||a.vulnerabilities,
    `${String(a.vulnerabilities||base).trim()} 부담이 누적되면 익숙한 반응이 더 강해질 수 있으므로, 변화가 두드러지는 상황과 일상 기능의 영향을 함께 살펴보는 것이 필요합니다.`);
  const interpretationBasis=professionalFallbackText(originalClient.interpretationBasis||a.validity,
    `${String(a.validity||'검사결과의 해석 가능 범위를 확인하였습니다.').trim()} 본 해석은 업로드된 결과지에 포함된 정보와 확인 가능한 지표를 근거로 하며, 면담과 생활 맥락을 함께 검토할 때 의미가 더 분명해집니다.`);
  const emotionalUnderstanding=professionalFallbackText(originalClient.emotionalUnderstanding||a.emotionalPattern,
    `${String(a.emotionalPattern||base).trim()} 감정은 상황에 따라 강도와 표현 방식이 달라질 수 있으며, 부담이 커질 때 나타나는 신체 반응과 회복에 도움이 되는 조건을 함께 확인하는 것이 중요합니다.`);
  const thinkingUnderstanding=professionalFallbackText(originalClient.thinkingUnderstanding||a.thinkingPattern,
    `${String(a.thinkingPattern||base).trim()} 판단과 자기평가의 방식은 정서 상태와 상호작용하므로, 걱정이 커지는 조건과 문제를 정리할 때 도움이 되는 사고 전략을 구분해 살펴볼 필요가 있습니다.`);
  const relationshipUnderstanding=professionalFallbackText(originalClient.relationshipUnderstanding||a.relationshipPattern,
    `${String(a.relationshipPattern||base).trim()} 관계에서는 친밀감과 거리 조절, 도움 요청, 갈등 상황에서의 반응이 서로 연결될 수 있으므로 실제 생활 장면과 함께 이해하는 것이 적절합니다.`);
  const stressUnderstanding=professionalFallbackText(originalClient.stressUnderstanding||a.stressPattern,
    `${String(a.stressPattern||base).trim()} 스트레스가 높아질수록 평소의 반응 경향이 강화될 수 있습니다. 부담 신호를 일찍 알아차리고 휴식, 예측 가능한 일정, 지지 관계를 활용하는 것이 회복에 도움이 됩니다.`);
  const dailyMeaning=professionalFallbackText(originalClient.dailyMeaning||a.dailyMeaning,
    `${String(a.dailyMeaning||base).trim()} 이러한 특징은 일상에서 선택과 집중, 감정 표현, 관계 조율, 과제 수행 방식에 영향을 줄 수 있으므로 구체적인 생활 장면을 기준으로 확인하는 것이 좋습니다.`);
  const recommendations=professionalFallbackText(originalClient.recommendations||a.helpfulDirections,
    `${String(a.helpfulDirections||'1. 부담이 커지는 상황과 초기 신호를 기록합니다.').trim()}\n2. 감정과 생각을 구분해 짧게 정리합니다.\n3. 혼자 감당하기 어려운 부분은 신뢰할 수 있는 사람이나 전문가와 구체적으로 상의합니다.\n4. 수면, 식사, 활동 리듬을 일정하게 유지하며 회복 변화를 확인합니다.`);
  const readerNote=professionalFallbackText(originalClient.readerNote||a.cautions,
    `${String(a.cautions||'심리검사 결과는 현재의 마음과 적응 방식을 이해하기 위한 자료입니다.').trim()} 단일 검사만으로 진단이나 개인의 성격을 확정하지 않으며, 최근의 환경과 관계, 면담 정보를 함께 고려해야 합니다.`);
  const profile={
    emotion:professionalFallbackText(originalProfile.emotion,emotionalUnderstanding),
    thinking:professionalFallbackText(originalProfile.thinking,thinkingUnderstanding),
    relationship:professionalFallbackText(originalProfile.relationship,relationshipUnderstanding),
    stress:professionalFallbackText(originalProfile.stress,stressUnderstanding),
    selfRegulation:professionalFallbackText(originalProfile.selfRegulation,`${base} 자기조절은 감정과 행동을 억누르는 능력만이 아니라, 현재 상태를 알아차리고 상황에 맞게 반응을 조정하는 과정으로 이해할 수 있습니다.`),
    recovery:professionalFallbackText(originalProfile.recovery,`${strengths} 회복은 강점을 실제 생활에서 반복적으로 사용하고, 부담이 커지기 전에 도움과 휴식을 연결할 때 더 안정적으로 이루어질 수 있습니다.`)
  };
  const clientReport={...originalClient,currentMind,overview:currentMind,interpretationBasis,strengths,focus,
    emotionalUnderstanding,thinkingUnderstanding,relationshipUnderstanding,stressUnderstanding,dailyMeaning,recommendations,readerNote,professionalProfile:profile};
  return {
    ...a,
    professionalReportReady:true,
    reportEngineVersion:String(a.reportEngineVersion||'MML-PRO-REPORT-V4.1-EVIDENCE-FALLBACK'),
    sourceSummary:currentMind,validity:interpretationBasis,coreFindings:currentMind,strengths,vulnerabilities:focus,
    emotionalPattern:emotionalUnderstanding,thinkingPattern:thinkingUnderstanding,relationshipPattern:relationshipUnderstanding,
    stressPattern:stressUnderstanding,dailyMeaning,helpfulDirections:recommendations,cautions:readerNote,
    professionalProfile:profile,clientReport
  };
}

function individualReportDisplayDate(value){
  const raw=String(value||'').trim();
  const match=raw.match(/(20\d{2})[^0-9]?(0?[1-9]|1[0-2])[^0-9]?(0?[1-9]|[12]\d|3[01])/);
  if(match)return `${match[1]}.${String(match[2]).padStart(2,'0')}.${String(match[3]).padStart(2,'0')}`;
  const date=raw?new Date(raw):new Date();
  if(!Number.isNaN(date.getTime()))return `${date.getFullYear()}.${String(date.getMonth()+1).padStart(2,'0')}.${String(date.getDate()).padStart(2,'0')}`;
  const now=new Date();return `${now.getFullYear()}.${String(now.getMonth()+1).padStart(2,'0')}.${String(now.getDate()).padStart(2,'0')}`;
}
function syncIndividualClientReport(analysis){
  const a=analysis||{};
  return {...a,clientReport:{
    ...(a.clientReport||{}),
    resultSummary:a.sourceSummary||'',
    interpretationBasis:a.validity||'',
    overview:a.coreFindings||'',
    strengths:a.strengths||'',
    focus:a.vulnerabilities||'',
    emotionalUnderstanding:a.emotionalPattern||'',
    thinkingUnderstanding:a.thinkingPattern||'',
    relationshipUnderstanding:a.relationshipPattern||'',
    stressUnderstanding:a.stressPattern||'',
    dailyMeaning:a.dailyMeaning||'',
    recommendations:a.helpfulDirections||'',
    readerNote:a.cautions||''
  }};
}

function saveAssessmentAnalysis(id){
  const index=state.assessmentAnalyses.findIndex(x=>String(x.id)===String(id));if(index<0)return;
  state.assessmentAnalyses[index]=syncIndividualClientReport({...assessmentAnalysisWithEditorValues(state.assessmentAnalyses[index]),reviewed:true,needsReview:false,status:'상담자 검토 완료',reviewedAt:new Date().toLocaleString('ko-KR')});
  save('modumam_assessment_analyses',state.assessmentAnalyses);syncClinicalAssessmentRecord(state.assessmentAnalyses[index].reservationId);alert('개별 심리검사 전문 해석 보고서를 저장했습니다.');render();
}
function assessmentCenterIndividualReportForAnalysis(analysisId){
  return (state.reports||[]).find(r=>r.individualAssessmentReport===true&&String(r.analysisId)===String(analysisId))||null;
}
function assessmentCenterIntegratedReportForReservation(reservationId){
  // 심리평가센터의 원본은 AI 종합해석보고서(integratedAssessmentReport)입니다.
  // 이전 버전에서 저장된 assessmentReport는 호환용으로만 뒤에서 찾습니다.
  return (state.reports||[]).find(r=>
    String(r.reservationId)===String(reservationId)&&r.integratedAssessmentReport===true&&!r.hiddenFromAssessmentWorkflow
  )||(state.reports||[]).find(r=>
    String(r.reservationId)===String(reservationId)&&
    r.assessmentReport===true&&r.integratedAssessmentReport!==true&&r.individualAssessmentReport!==true
  )||null;
}

function assessmentRequestDateLabel(request){
  const app=request?.assessmentReportApplication||{};
  return request?.assessmentReportRequestedAt||app.requestedAt||request?.updatedAt||request?.createdAt||'';
}
function scrollToAssessmentReportCard(testType){
  const target=document.getElementById(`assessment-report-card-${assessmentTestKey(testType)}`)||document.getElementById('assessment-individual-reports');
  if(target)target.scrollIntoView({behavior:'smooth',block:'start'});
}
function scrollToAssessmentComprehensiveReport(){
  const target=document.getElementById('assessment-ai-master-report');
  if(target)target.scrollIntoView({behavior:'smooth',block:'start'});
}
function assessmentTopReportStatus(reservation,analyses=[]){
  if(!reservation)return {label:'보고서 상태',text:'회원·예약 선택 필요',tone:'slate'};
  const request=typeof assessmentReportRequestForReservation==='function'
    ?assessmentReportRequestForReservation(reservation.id,reservation.name,reservation.phone)
    :null;
  if(!request)return {label:'보고서 상태',text:'신청 없음',tone:'slate'};
  const reports=(state.reports||[]).filter(row=>String(row?.reservationId||'')===String(reservation.id));
  const requestedReports=reports.filter(row=>row?.individualAssessmentReport===true||row?.integratedAssessmentReport===true||row?.assessmentReport===true);
  const approved=requestedReports.filter(row=>Boolean(row?.approvedForClient));
  if(requestedReports.length&&approved.length===requestedReports.length){
    return {label:'보고서 상태',text:'승인완료 · 사용자 열람 가능',tone:'emerald'};
  }
  if(requestedReports.length){
    return {label:'보고서 상태',text:'작성완료 · 승인대기',tone:'amber'};
  }
  if((analyses||[]).length){
    return {label:'보고서 상태',text:'작성 필요',tone:'indigo'};
  }
  return {label:'보고서 상태',text:'검사결과 업로드 필요',tone:'slate'};
}
function assessmentReportRequestStatusCard(reservation,analyses=[]){
  if(!reservation)return '';
  const request=typeof assessmentReportRequestForReservation==='function'
    ?assessmentReportRequestForReservation(reservation.id,reservation.name,reservation.phone)
    :null;
  const app=request?.assessmentReportApplication||{};
  const types=Array.isArray(request?.assessmentReportTypes)?request.assessmentReportTypes:(Array.isArray(app.reportTypes)?app.reportTypes:[]);
  const requestedTests=(Array.isArray(request?.assessmentIndividualTests)?request.assessmentIndividualTests:(Array.isArray(app.individualTests)?app.individualTests:[]))
    .map(test=>typeof normalizeReportRequestTestName==='function'?normalizeReportRequestTestName(test):assessmentTestLabel(test))
    .filter(Boolean);
  const uniqueRequestedTests=[...new Set(requestedTests)];
  // [MOD-20260726-REPORT-POLICY-V2]
  // 마음이음 프로그램은 기본검사+추가검사 통합 종합보고서,
  // 개별 심리검사 예약은 1개=개별, 2개 이상=종합입니다.
  const requestProgram=String(request?.bookingProgram||request?.program||reservation?.bookingProgram||reservation?.program||'');
  const compactRequestProgram=requestProgram.replace(/[\s·_-]+/g,'');
  const isIndividualBooking=request?.bookingCategory==='individual-test'||reservation?.bookingCategory==='individual-test'||requestProgram.includes('개별 심리검사')||compactRequestProgram.includes('개별심리검사');
  const isMindLinkProgram=compactRequestProgram.includes('개인마음이음')||compactRequestProgram.includes('부부마음이음')||compactRequestProgram.includes('부모자녀마음이음');
  const individualRequested=Boolean(request&&isIndividualBooking&&uniqueRequestedTests.length===1);
  let storedDerived=[];
  try{
    storedDerived=window.MMLCanonicalReportStore?.read?.()||
      (typeof derivedAssessmentReports==='function'?derivedAssessmentReports():[]);
  }catch(e){storedDerived=[]}
  const normalizeClientName=value=>String(value||'').replace(/\s+/g,'').toLowerCase();
  const normalizeClientPhone=value=>String(value||'').replace(/[^0-9]/g,'');
  const sameClient=row=>{
    if(String(row?.reservationId||'')===String(reservation.id))return true;
    const rowName=normalizeClientName(row?.clientName||row?.name);
    const targetName=normalizeClientName(reservation.name);
    const rowPhone=normalizeClientPhone(row?.phone);
    const targetPhone=normalizeClientPhone(reservation.phone);
    const phoneMatch=targetPhone&&rowPhone&&(rowPhone.endsWith(targetPhone)||targetPhone.endsWith(rowPhone));
    return Boolean(phoneMatch||(targetName&&rowName===targetName&&(!targetPhone||!rowPhone)));
  };
  const isComprehensiveRecord=row=>row&&row.individualAssessmentReport!==true&&(
    row.assessmentReport===true||row.integratedAssessmentReport===true||row.audience==='client'||row.derivedReportType==='client'||
    /종합\s*심리평가|종합\s*결과|종합보고서|심리검사\s*종합/.test(String(row.testType||row.title||''))
  );
  const hasComprehensiveReportRecord=(state.reports||[]).some(row=>sameClient(row)&&isComprehensiveRecord(row))||
    storedDerived.some(row=>sameClient(row)&&isComprehensiveRecord(row));
  const comprehensiveRequested=Boolean(request&&(isMindLinkProgram||(isIndividualBooking&&uniqueRequestedTests.length>=2)||(!isIndividualBooking&&uniqueRequestedTests.length>=2)))||hasComprehensiveReportRecord;
  const individualTests=individualRequested?uniqueRequestedTests:[];
  const requestCount=(individualRequested?individualTests.length:0)+(comprehensiveRequested?1:0);
  const requestDate=assessmentRequestDateLabel(request);
  const itemRows=[];

  if(individualRequested){
    individualTests.forEach(test=>{
      const analysis=(analyses||[]).find(a=>assessmentTestMatches(a.testType,test));
      const report=analysis?assessmentCenterIndividualReportForAnalysis(analysis.id):(state.reports||[]).find(row=>row.individualAssessmentReport===true&&String(row.reservationId)===String(reservation.id)&&assessmentTestMatches(row.testType,test));
      const approved=Boolean(report?.approvedForClient);
      const status=approved?'사용자 열람 가능':report?'보고서 저장완료 · 승인대기':analysis?'AI 분석완료 · 보고서 작성대기':'검사결과 업로드 필요';
      const badge=approved?'bg-emerald-100 text-emerald-700':report?'bg-amber-100 text-amber-700':analysis?'bg-indigo-100 text-indigo-700':'bg-slate-100 text-slate-500';
      const stage=approved?'승인완료':report?'저장완료':analysis?'분석완료':'대기';
      itemRows.push(`<div class="rounded-2xl border border-slate-100 bg-slate-50/70 p-4"><div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><div class="flex flex-wrap items-center gap-2"><p class="font-extrabold text-slate-900">${esc(assessmentTestLabel(test))} 개별 심리검사 보고서</p><span class="rounded-full px-2.5 py-1 text-[10px] font-extrabold ${badge}">${status}</span></div><p class="mt-1 text-xs text-slate-400">실제 보고서 작업은 아래 ‘개별 심리검사 보고서’ 영역에서 진행합니다.</p></div><div class="flex items-center gap-2"><span class="text-[10px] font-extrabold tracking-[.12em] text-slate-400">CURRENT STAGE</span><span class="rounded-xl ${badge} px-3 py-2 text-xs font-extrabold">${stage}</span></div></div></div>`);
    });
  }

  if(comprehensiveRequested){
    const master=assessmentCenterIntegratedReportForReservation(reservation.id);
    const derived=master&&typeof derivedReportForSource==='function'?derivedReportForSource(master.id,'client'):null;
    const approved=Boolean(derived?.approvedForClient||derived?.status==='approved');
    const status=approved?'사용자 열람 가능':derived?'종합보고서 저장완료 · 승인대기':master?'AI 통합분석 완료 · 종합보고서 생성대기':'심리검사 종합보고서 생성(AI) 필요';
    const badge=approved?'bg-emerald-100 text-emerald-700':derived?'bg-amber-100 text-amber-700':master?'bg-indigo-100 text-indigo-700':'bg-slate-100 text-slate-500';
    const stage=approved?'승인완료':derived?'저장완료':master?'AI 통합분석완료':'대기';
    itemRows.push(`<div class="rounded-2xl border border-slate-100 bg-slate-50/70 p-4"><div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><div class="flex flex-wrap items-center gap-2"><p class="font-extrabold text-slate-900">심리검사 종합보고서</p><span class="rounded-full px-2.5 py-1 text-[10px] font-extrabold ${badge}">${status}</span></div><p class="mt-1 text-xs text-slate-400">실제 보고서 작업은 아래 ‘AI 종합해석보고서/심리검사 종합보고서’ 영역에서 진행합니다.</p></div><div class="flex items-center gap-2"><span class="text-[10px] font-extrabold tracking-[.12em] text-slate-400">CURRENT STAGE</span><span class="rounded-xl ${badge} px-3 py-2 text-xs font-extrabold">${stage}</span></div></div></div>`);
  }

  return `<section id="assessment-report-request-status" class="rounded-[2rem] border ${requestCount?'border-indigo-200':'border-slate-100'} bg-white p-6 shadow-sm"><div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><p class="text-xs font-extrabold tracking-[.14em] text-indigo-600">CLIENT REPORT MANAGEMENT</p><h3 class="mt-1 text-xl font-extrabold">보고서 관리현황</h3><p class="mt-1 text-xs text-slate-400">신청된 보고서의 현재 진행단계를 확인합니다.${requestDate?` · 신청일 ${esc(requestDate)}`:''}</p></div><span class="rounded-full ${requestCount?'bg-indigo-100 text-indigo-700':'bg-slate-100 text-slate-500'} px-3 py-1.5 text-xs font-extrabold">${requestCount?`${requestCount}건 신청`:'신청 없음'}</span></div><div class="mt-5 space-y-3">${itemRows.length?itemRows.join(''):'<div class="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-8 text-center"><p class="text-sm font-extrabold text-slate-600">사용자가 신청한 보고서가 없습니다.</p><p class="mt-1 text-xs text-slate-400">사용자 마음기록에서 신청하면 이 영역에 현재 진행단계가 표시됩니다.</p></div>'}</div></section>`;
}
function assessmentCenterReportSections(a){
  return {
    sourceSummary:a.sourceSummary||'',summary:a.coreFindings||a.sourceSummary||'',validity:a.validity||'',coreFindings:a.coreFindings||'',
    strengths:a.strengths||'',vulnerabilities:a.vulnerabilities||'',helpfulDirections:a.helpfulDirections||'',
    emotionalPattern:a.emotionalPattern||'',thinkingPattern:a.thinkingPattern||'',relationshipPattern:a.relationshipPattern||'',
    stressPattern:a.stressPattern||'',dailyMeaning:a.dailyMeaning||'',cautions:a.cautions||''
  };
}

function persistCanonicalAssessmentReport(report){
  if(!report)return report;
  try{
    if(window.MMLUnifiedAIReportEngine?.save){
      return window.MMLUnifiedAIReportEngine.save(report);
    }
  }catch(error){
    console.warn('[MML] 통합 보고서 엔진 저장 fallback',error);
  }

  try{
    if(window.MMLReportStore?.saveReport){
      const rows=window.MMLReportStore.saveReport(report);
      return (rows||[]).find(item=>String(item.id)===String(report.id))||report;
    }
  }catch(error){
    console.warn('[MML] 공통 보고서 저장소 fallback',error);
  }

  return report;
}

function saveGeneratedAssessmentReport(id){
  const index=state.assessmentAnalyses.findIndex(x=>String(x.id)===String(id));
  if(index<0){alert('저장할 결과보고서를 찾지 못했습니다.');return;}
  const professionalCheck=professionalIndividualReportSource(state.assessmentAnalyses[index]);
  state.assessmentAnalyses[index]={...state.assessmentAnalyses[index],...professionalCheck};
  const now=new Date().toLocaleString('ko-KR');
  const analysis=syncIndividualClientReport({...professionalCheck,reviewed:true,needsReview:false,status:'결과보고서 저장 완료',reviewedAt:now,updatedAt:now});
  state.assessmentAnalyses[index]=analysis;
  const reservation=state.reservations.find(r=>String(r.id)===String(analysis.reservationId))||{};
  const existing=assessmentCenterIndividualReportForAnalysis(analysis.id);
  const reportId=existing?.id||Date.now();
  const nextReport={
    ...(existing||{}),id:reportId,reservationId:analysis.reservationId,analysisId:analysis.id,
    clientName:analysis.clientName||reservation.name||'',phone:analysis.phone||reservation.phone||'',
    clientId:analysis.clientId||reservation.clientId||reservation.memberId||reservation.userId||'',
    memberId:analysis.memberId||reservation.memberId||reservation.clientId||reservation.userId||'',
    userId:analysis.userId||reservation.userId||reservation.memberId||reservation.clientId||'',
    email:analysis.email||reservation.email||reservation.userEmail||'',
    program:analysis.program||programBaseName(reservation.program)||'',testType:analysis.testType||'',
    title:individualReportTitle(analysis.testType),summary:analysis.coreFindings||analysis.sourceSummary||'',
    strength:analysis.strengths||'',caution:analysis.vulnerabilities||'',plan:analysis.helpfulDirections||'',
    sections:assessmentCenterReportSections(analysis),analysisSnapshot:{...analysis},
    individualAssessmentReport:true,assessmentCenterDirect:true,reportType:'내담자용 개별보고서',
    // [MML-20260808-INDIVIDUAL-APPROVAL-LIFECYCLE-S13]
    // 생성 결과를 다시 저장하면 보고서 버전이 바뀐 것이므로 이전 승인 스냅샷을 재사용하지 않습니다.
    approved:false,approvedForClient:false,clientVisible:false,published:false,
    approvedReportHtml:'',approvedReportHtmlVersion:0,approvedAt:'',approvedBy:'',publishedAt:'',
    reviewStatus:'saved',status:'저장완료 · 승인대기',approvalUpdatedAt:now,
    version:existing?Number(existing.version||1)+1:1,createdAt:existing?.createdAt||now,updatedAt:now
  };
  const canonicalReport=persistCanonicalAssessmentReport(nextReport);
  state.reports=[canonicalReport,...(state.reports||[]).filter(r=>String(r.id)!==String(reportId))];
  save('modumam_assessment_analyses',state.assessmentAnalyses);
  commitAssessmentReports(state.reports);
  // 이전 버전이 승인되어 있었더라도 새 저장본은 다시 전문가 승인을 받아야 사용자에게 공개됩니다.
  try{window.MMLClientReportPublication?.sync?.({force:true,reason:'individual-report-resaved'});}catch(error){console.warn('[MML] 개별보고서 재저장 공개상태 갱신 실패',error);}
  syncClinicalAssessmentRecord(analysis.reservationId);
  alert('생성된 결과보고서를 저장했습니다. 내용이 변경된 보고서는 다시 승인해야 사용자에게 공개됩니다.');
  render();
}
window.saveGeneratedAssessmentReport=saveGeneratedAssessmentReport;

// [MML-CANONICAL-INTERPRETATION] 기존 원자료 분석을 유지한 채 같은 AI 해석 엔진으로 전문보고서를 다시 생성합니다.
// 이미 업로드한 검사파일을 다시 올릴 필요가 없습니다.
async function regenerateProfessionalIndividualReport(analysisId,button){
  const index=(state.assessmentAnalyses||[]).findIndex(x=>String(x.id)===String(analysisId));
  if(index<0){alert('전문보고서를 생성할 검사 분석을 찾지 못했습니다.');return;}
  const original=assessmentAnalysisWithEditorValues(state.assessmentAnalyses[index]);
  const reservation=(state.reservations||[]).find(r=>String(r.id)===String(original.reservationId))||{};
  if(button){button.disabled=true;button.textContent='전문보고서 작성 중...';}
  try{
    const data=await requestCanonicalAssessmentInterpretation({
      clientName:original.clientName||reservation.name||'',
      program:original.program||programBaseName(reservation.program||''),
      testType:original.testType,mode:'report-refresh',
      extractedFacts:original.rawFacts||{},analysisSnapshot:original
    });
    if(!data.analysis)throw new Error('전문보고서를 생성하지 못했습니다.');
    const now=new Date().toLocaleString('ko-KR');
    state.assessmentAnalyses[index]={...original,...data.analysis,status:'보고서 생성완료 · 상담자 검토 필요',
      reportEngineVersion:data.engineVersion||data.analysis?.engineVersion||'MML-CLINICAL-INTERPRETATION-1.0-CANONICAL',
      reportGeneratedAt:now,reviewed:false,needsReview:true,updatedAt:now};
    save('modumam_assessment_analyses',state.assessmentAnalyses);
    syncClinicalAssessmentRecord(original.reservationId);
    alert('전문보고서 초안을 새로 생성했습니다.');render();
  }catch(error){
    const now=new Date().toLocaleString('ko-KR');
    const fallback=professionalIndividualReportSource(original);
    state.assessmentAnalyses[index]={...original,...fallback,status:'보고서 생성완료 · 상담자 검토 필요',reportGeneratedAt:now,reviewed:false,needsReview:true,updatedAt:now};
    save('modumam_assessment_analyses',state.assessmentAnalyses);
    syncClinicalAssessmentRecord(original.reservationId);
    alert('AI 연결 오류가 있어 원자료 기반 전문보고서 초안을 생성했습니다. 내용을 검토한 뒤 저장해 주세요.');
    render();
  }
  finally{if(button){button.disabled=false;button.textContent='보고서 생성';}}
}
window.regenerateProfessionalIndividualReport=regenerateProfessionalIndividualReport;

function deleteAssessmentAnalysis(id){if(!confirm('이 검사 분석을 삭제할까요?'))return;const target=state.assessmentAnalyses.find(x=>String(x.id)===String(id));state.assessmentAnalyses=state.assessmentAnalyses.filter(x=>String(x.id)!==String(id));save('modumam_assessment_analyses',state.assessmentAnalyses);if(target)syncClinicalAssessmentRecord(target.reservationId);render()}

async function generateAssessmentCrossAnalysis(){
  const r=assessmentReservation();if(!r){alert('대상 회원을 선택해 주세요.');return;}
  const analyses=analysesForReservation(r.id);
  if(analyses.length<2){alert('검사 간 교차분석은 두 개 이상의 검사별 분석이 필요합니다.');return;}
  const unreviewed=analyses.filter(x=>!x.reviewed);
  if(unreviewed.length&&!confirm(`상담자 검토가 완료되지 않은 분석이 ${unreviewed.length}건 있습니다. 교차분석 초안을 생성할까요?`))return;
  state.assessmentCrossLoading=true;render();
  try{
    const response=await fetch('/.netlify/functions/assessment-cross-analysis',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({clientName:r.name,program:programBaseName(r.program),tests:analyses.map(x=>({testType:x.testType,subjectRole:(String(x.testType).includes('신청자')?'신청자':String(x.testType).includes('배우자')?'배우자':String(x.testType).includes('K-CDI')?'자녀':String(x.testType).includes('PAT')?'양육자':''),sourceSummary:x.sourceSummary,validity:x.validity,coreFindings:x.coreFindings,strengths:x.strengths,vulnerabilities:x.vulnerabilities,counselingQuestions:x.counselingQuestions,crossChecks:x.crossChecks,caseHypotheses:x.caseHypotheses,cautions:x.cautions,reviewed:x.reviewed,confidenceScore:x.confidenceScore,confidenceReason:x.confidenceReason,needsReview:x.needsReview})),crossAnalysis:state.assessmentCrossDraft||state.assessmentCrossAnalyses.find(x=>String(x.reservationId)===String(r.id))||null})});
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
  state.assessmentCrossDraft={...item};save('modumam_assessment_cross_analyses',state.assessmentCrossAnalyses);syncClinicalAssessmentRecord(r.id);alert('상담자용 검사 간 교차분석을 저장했습니다.');render();
}
function deleteAssessmentCrossAnalysis(){
  const r=assessmentReservation();if(!r)return;if(!confirm('이 회원의 검사 간 교차분석을 삭제할까요?'))return;
  state.assessmentCrossAnalyses=state.assessmentCrossAnalyses.filter(x=>String(x.reservationId)!==String(r.id));state.assessmentCrossDraft=null;save('modumam_assessment_cross_analyses',state.assessmentCrossAnalyses);render();
}

function clientReportPersonText(value){
  const personal=/^(?:이름|성명|성별|나이|연령|생년월일|검사일|검사일자|규준집단|학교|학년|기관|연락처)\s*[:：]/i;
  return String(value||'').split(/\n+/).map(x=>x.trim()).filter(x=>x&&!personal.test(x)).join('\n');
}
function clientCurrentMindText(source){
  const raw=clientReportPersonText(source.clientCurrentMind||source.clinicalCurrentState||source.clientKeyMessage||source.keyMessage||source.professionalSummary||'');
  const technical=/(?:T점수|원점수|백분위|척도에서|위험회피|자극추구|사회적\s*민감성|인내력|자기주도성|연대감|자기초월|MMPI|PAI|TCI)/i;
  const kept=raw.split(/(?<=[.!?]|다\.)\s+|\n+/).map(x=>x.trim()).filter(x=>x&&!technical.test(x));
  if(kept.join(' ').length>=120)return kept.slice(0,6).join(' ');
  const alternatives=[source.clientEmotionalProfile,source.emotionalProfile,source.clientThinkingStyle,source.thinkingStyle,source.clientRelationshipStyle,source.relationshipStyle,source.clientStressRecovery,source.stressRecovery].flatMap(v=>clientReportPersonText(v).split(/(?<=[.!?]|다\.)\s+|\n+/)).map(x=>x.trim()).filter(x=>x&&!technical.test(x));
  return alternatives.slice(0,6).join(' ')||'현재는 자신의 역할과 일상을 안정적으로 유지하려는 힘이 두드러지며, 상황을 충분히 살핀 뒤 신중하게 움직이려는 모습이 함께 나타납니다. 이러한 태도는 책임감과 꾸준함이라는 강점으로 이어질 수 있지만, 부담이 커질 때는 걱정이나 긴장이 오래 이어질 수 있어 회복에 도움이 되는 조건을 함께 살펴볼 필요가 있습니다.';
}

function buildModumamClientReportFromIntegrated(d){
  const source=d||{};
  // Signature Report의 내담자 전용 필드를 그대로 보존합니다.
  // 기존 필드도 함께 유지해 과거 저장본·전자차트·PDF가 모두 같은 내용을 사용합니다.
  return {
    title:'심리검사 종합해석보고서',
    subtitle:source.subtitle||'심리검사 결과를 종합하여 현재의 심리적 특성과 생활 속 의미를 이해하기 위한 보고서',
    evaluationOverview:source.evaluationOverview||'',
    testGuide:source.testGuide||'',
    keyMessage:clientCurrentMindText(source),
    emotionalProfile:source.clientEmotionalProfile||source.emotionalProfile||'',
    thinkingStyle:source.clientThinkingStyle||source.thinkingStyle||'',
    relationshipStyle:source.clientRelationshipStyle||source.relationshipStyle||'',
    stressRecovery:source.clientStressRecovery||source.stressRecovery||'',
    strengthsResources:source.clientStrengthsResources||source.strengthsResources||'',
    integratedUnderstanding:source.clientIntegratedUnderstanding||source.integratedUnderstanding||'',
    currentSignals:source.clientCurrentSignals||source.currentSignals||'',
    psychologicalSuggestions:source.clientPsychologicalSuggestions||source.psychologicalSuggestions||'',
    professionalSummary:source.clientProfessionalSummary||source.professionalSummary||'',
    disclaimer:source.clientDisclaimer||source.disclaimer||'',
    clientClinicalSummary:source.clientClinicalSummary||'',
    clientExecutiveSummary:source.clientExecutiveSummary||'',
    clientAssessmentPurpose:source.clientAssessmentPurpose||'',
    clientTestFindings:source.clientTestFindings||'',
    clientSelfUnderstanding:source.clientSelfUnderstanding||source.clientClinicalSummary||source.clientExecutiveSummary||source.clientKeyMessage||source.keyMessage||'',
    clientTemperamentCharacter:source.clientTemperamentCharacter||source.clinicalTrait||'',
    clientCurrentMind:clientCurrentMindText(source),
    clientInnerStory:source.clientInnerStory||source.clientTestFindings||'',
    clientStrengthGuide:source.clientStrengthGuide||source.clientStrengthsResources||source.strengthsResources||'',
    clientRecoveryGuide:source.clientRecoveryGuide||source.clientPsychologicalSuggestions||source.psychologicalSuggestions||'',
    clientSupportGuide:source.clientSupportGuide||source.clientRecoveryPotential||source.clientStressRecovery||source.stressRecovery||'',
    clientCounselingTopics:source.clientCounselingTopics||source.clientCurrentSignals||source.currentSignals||'',
    clientFunctionalFormulation:source.clientFunctionalFormulation||source.clientIntegratedUnderstanding||source.integratedUnderstanding||''
  };
}
function buildClinicianIntegratedSections(report={},masterReport=null,crossAnalysis=null){
  const counselor=masterReport?.reportGenerationData?.counselor||{};
  const shared=masterReport?.reportGenerationData?.shared||{};
  const cross=crossAnalysis||masterReport?.crossAnalysis||{};
  const join=(...values)=>values.map(v=>String(v||'').trim()).filter(Boolean).join('\n\n');
  return {
    title:'AI 종합해석보고서',
    subtitle:'심리검사 자료를 통합한 상담자용 전문 검토 보고서',
    clinicalJudgment:join(counselor.coreUnderstanding,report.counselorCoreUnderstanding,report.integratedUnderstanding,report.keyMessage),
    convergentEvidence:join(cross.commonPatterns,shared.clinicalConvergence,report.clinicalConvergence,counselor.evidenceSummary,report.evidenceSummary),
    discrepancies:join(cross.differences,cross.stateTrait,cross.responseContext,shared.clinicalDivergence,report.clinicalDivergence),
    caseFormulation:join(counselor.caseFormulation5P,report.counselorCaseFormulation5P,shared.clinicalFormulation,report.clinicalFormulation),
    coreProblems:join(report.currentSignals,report.clinicalCurrentState,counselor.counselingFocus),
    strengthsProtection:join(report.strengthsResources,shared.clinicalProtectiveFactors,report.clinicalProtectiveFactors,cross.riskProtection,counselor.riskProtection),
    riskFactors:join(report.currentSignals,cross.riskProtection,counselor.riskProtection),
    counselingPriorities:join(counselor.counselingFocus,report.counselorCounselingFocus),
    counselingStrategies:join(counselor.interventionGuide,report.counselorInterventionGuide),
    followUpQuestions:join(cross.followUpQuestions,counselor.initialQuestions,report.counselorInitialQuestions),
    monitoringPoints:join(counselor.monitoringPoints,report.counselorMonitoringPoints),
    professionalSummary:join(counselor.professionalSummary,report.professionalSummary),
    supervisorNote:join(counselor.supervisorNote,report.supervisorNote),
    limitations:join(cross.limitations,report.clinicalValidity,report.disclaimer)
  };
}
function clinicianIntegratedSource(source={},masterReport=null){
  const normalized=buildClinicianIntegratedSections(source,masterReport,masterReport?.crossAnalysis||null);
  const keys=['clinicalJudgment','convergentEvidence','discrepancies','caseFormulation','coreProblems','strengthsProtection','riskFactors','counselingPriorities','counselingStrategies','followUpQuestions','monitoringPoints','professionalSummary','supervisorNote','limitations'];
  keys.forEach(k=>{if(String(source?.[k]||'').trim())normalized[k]=source[k];});
  normalized.title=source?.title||normalized.title;
  normalized.subtitle=source?.subtitle||normalized.subtitle;
  return normalized;
}
function persistIntegratedReportDraft(draft){
  if(!draft||draft.reservationId===undefined||draft.reservationId===null)return;
  const canonical={...draft,draftType:'integratedAssessmentDraft',status:draft.status||'작성중',updatedAt:draft.updatedAt||new Date().toLocaleString('ko-KR')};
  try{
    state.assessmentReportDrafts=window.MMLReportStore?.saveDraft?.(canonical,state.assessmentReportDrafts)||[canonical,...(state.assessmentReportDrafts||[]).filter(x=>String(x.reservationId)!==String(canonical.reservationId))];
  }catch(error){
    console.error('[MML] 보고서 초안 저장 실패',error);
    state.assessmentReportDrafts=[canonical,...(state.assessmentReportDrafts||[]).filter(x=>String(x.reservationId)!==String(canonical.reservationId))];
    save('modumam_assessment_report_drafts',state.assessmentReportDrafts);
    throw error;
  }
  syncClinicalAssessmentRecord(canonical.reservationId);
}


function persistDirectComprehensiveSource(reservation,draft){
  const r=reservation;
  const d=draft||{};
  const now=new Date().toLocaleString('ko-KR');
  const reviewedAnalyses=analysesForReservation(r.id).filter(x=>x.reviewed);
  const tests=reviewedAnalyses.map(x=>x.testType);
  const groups=reportTestGroups(r);
  const sections=clinicianIntegratedSource(d,d.masterReport||null);
  sections.sourceReport={...d};
  ['clientReport','reservationId','tests','model','promptVersion','qualityChecked','qualityIssues','fallback','repaired','diagnostics','generatedAt','updatedAt','masterReport','clinicalProfile'].forEach(k=>delete sections.sourceReport[k]);

  const reports=Array.isArray(state.reports)?state.reports:[];
  const oldSource=reports.find(x=>String(x.reservationId)===String(r.id)&&x.integratedAssessmentReport&&x.internalComprehensiveSource);
  const sourceReport={
    ...(oldSource||{}),
    id:oldSource?.id||Date.now(),
    reservationId:r.id,clientName:r.name,phone:r.phone||'',program:programBaseName(r.program),
    tests,basicTests:groups.basicTests,additionalTests:groups.additionalTests,
    testType:'심리검사 종합보고서 AI 통합근거',title:'심리검사 종합보고서 AI 통합근거',
    sections,summary:[sections.clinicalJudgment,sections.caseFormulation,sections.professionalSummary].filter(Boolean).join('\n\n'),
    strength:sections.strengthsProtection,caution:sections.riskFactors,plan:sections.counselingPriorities,
    masterReport:d.masterReport||null,clinicalProfile:d.clinicalProfile||d.masterReport?.clinicalProfile||null,
    integratedAssessmentReport:true,internalComprehensiveSource:true,hiddenFromAssessmentWorkflow:true,
    assessmentReport:false,summaryReport:false,individualAssessmentReport:false,
    reviewed:true,approved:false,approvedForClient:false,status:'내부 AI 통합근거 생성완료',
    reviewStatus:'internal-source',model:d.model||'',promptVersion:d.promptVersion||'',
    qualityChecked:Boolean(d.qualityChecked),qualityIssues:d.qualityIssues||[],
    fallback:Boolean(d.fallback),repaired:Boolean(d.repaired),diagnostics:d.diagnostics||null,
    generatedAt:d.generatedAt||now,version:Number(oldSource?.version||0)+1,
    createdAt:oldSource?.createdAt||now,updatedAt:now
  };
  const canonical=persistCanonicalAssessmentReport(sourceReport);
  state.reports=[canonical,...reports.filter(x=>String(x.id)!==String(canonical.id))];
  commitAssessmentReports(state.reports);
  return canonical;
}

async function generateIntegratedAssessmentReport(options={}){
  const r=assessmentReservation();if(!r){alert('대상 회원을 선택해 주세요.');return;}
  const analyses=analysesForReservation(r.id);
  if(!analyses.length){alert('먼저 한 개 이상의 검사결과를 업로드하고 검사별 분석을 생성해 주세요.');return;}
  const reviewedAnalyses=analyses.filter(x=>x.reviewed);
  if(!reviewedAnalyses.length){alert('업로드된 검사결과 중 상담자 검토가 완료된 검사별 분석이 한 건 이상 필요합니다.');return;}
  const testGroups=reportTestGroups(r);
  const materialCheck=validateIntegratedReportMaterials(r,testGroups,analyses);
  if(materialCheck.missingUpload.length){alert(`AI 종합해석보고서는 기본검사와 신청한 추가검사가 모두 업로드된 뒤 생성할 수 있습니다.\n\n미업로드 검사: ${materialCheck.missingUpload.join(', ')}`);return;}
  if(materialCheck.missingReview.length){alert(`모든 검사별 분석에 대한 상담자 검토를 완료해 주세요.\n\n검토 미완료: ${materialCheck.missingReview.join(', ')}`);return;}
  const cross=state.assessmentCrossAnalyses.find(x=>String(x.reservationId)===String(r.id)&&x.reviewed)
    ||(state.assessmentCrossDraft?.reviewed?state.assessmentCrossDraft:null);
  state.integratedReportLoading=true;render();
  try{
    const response=await fetch('/.netlify/functions/mml-clinician-integrated-report',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({mode:options?.directToComprehensive?'direct-comprehensive':'integrated-review',clientName:r.name,program:testGroups.program,basicTests:testGroups.basicTests,additionalTests:testGroups.additionalTests,tests:reviewedAnalyses.map(x=>({testType:x.testType,subjectRole:(String(x.testType).includes('신청자')?'신청자':String(x.testType).includes('배우자')?'배우자':String(x.testType).includes('K-CDI')?'자녀':String(x.testType).includes('PAT')?'양육자':''),sourceSummary:x.sourceSummary,validity:x.validity,coreFindings:x.coreFindings,strengths:x.strengths,vulnerabilities:x.vulnerabilities,counselingQuestions:x.counselingQuestions,crossChecks:x.crossChecks,caseHypotheses:x.caseHypotheses,cautions:x.cautions,rawFacts:x.rawFacts||null,counselorReport:x.counselorReport||null,clientReport:x.clientReport||null,reviewed:x.reviewed,confidenceScore:x.confidenceScore,confidenceReason:x.confidenceReason,needsReview:x.needsReview})),crossAnalysis:cross||null})});
    const data=await response.json().catch(()=>({}));if(!response.ok)throw new Error(data.error||'심리검사 종합해석보고서를 생성하지 못했습니다.');
    const generatedCross=(data.crossAnalysis&&typeof data.crossAnalysis==='object')?data.crossAnalysis:null;
    if(generatedCross){
      const now=new Date().toLocaleString('ko-KR');
      const crossItem={
        id:cross?.id||Date.now(),reservationId:r.id,clientName:r.name,phone:r.phone||'',program:programBaseName(r.program),
        tests:reviewedAnalyses.map(x=>x.testType),
        commonPatterns:String(generatedCross.commonPatterns||'').trim(),differences:String(generatedCross.differences||'').trim(),
        stateTrait:String(generatedCross.stateTrait||'').trim(),responseContext:String(generatedCross.responseContext||'').trim(),
        riskProtection:String(generatedCross.riskProtection||'').trim(),followUpQuestions:String(generatedCross.followUpQuestions||'').trim(),
        counselingImplications:String(generatedCross.counselingImplications||'').trim(),caseIntegration:String(generatedCross.caseIntegration||'').trim(),
        limitations:String(generatedCross.limitations||'').trim(),reviewed:false,status:'AI 자동 교차분석 · 상담자 검토 필요',
        model:data.model||'',promptVersion:data.promptVersion||'',createdAt:cross?.createdAt||now,updatedAt:now
      };
      state.assessmentCrossAnalyses=[crossItem,...state.assessmentCrossAnalyses.filter(x=>String(x.reservationId)!==String(r.id))];
      state.assessmentCrossDraft={...crossItem};
      save('modumam_assessment_cross_analyses',state.assessmentCrossAnalyses);
    }
    const clinicianSections=clinicianIntegratedSource(data.report||{},data.masterReport||null,generatedCross||cross||null);
    const hasBody=['clinicalJudgment','convergentEvidence','caseFormulation','professionalSummary'].some(k=>String(clinicianSections[k]||'').trim());
    if(!hasBody)throw new Error('AI가 보고서 본문을 반환하지 않았습니다. 다시 생성해 주세요.');
    state.integratedReportDraft={...clinicianSections,crossAnalysis:generatedCross||cross||null,masterReport:data.masterReport||null,clinicalProfile:data.clinicalProfile||null,clientReport:null,model:data.model||'',promptVersion:data.promptVersion||'',qualityChecked:Boolean(data.qualityChecked),qualityIssues:Array.isArray(data.qualityIssues)?data.qualityIssues:[],fallback:Boolean(data.fallback),repaired:Boolean(data.repaired),diagnostics:(data.diagnostics&&typeof data.diagnostics==='object')?data.diagnostics:null,generatedAt:new Date().toLocaleString('ko-KR'),updatedAt:new Date().toLocaleString('ko-KR'),reservationId:r.id,tests:reviewedAnalyses.map(x=>x.testType)};
    if(options?.directToComprehensive){
      if(data.fallback){
        throw new Error(`Gemini 종합해석이 완료되지 않아 종합보고서 생성을 중단했습니다.${data?.diagnostics?.reason?`\n\n사유: ${data.diagnostics.reason}`:''}`);
      }
      const sourceReport=persistDirectComprehensiveSource(r,state.integratedReportDraft);
      state.integratedReportDraft=null;
      syncClinicalAssessmentRecord(r.id);
      if(typeof generateDerivedAssessmentReport!=='function')throw new Error('심리검사 종합보고서 생성 모듈을 불러오지 못했습니다.');
      await generateDerivedAssessmentReport(sourceReport.id,'client',options?.buttonEl||null);
      return;
    }
    persistIntegratedReportDraft(state.integratedReportDraft);
    syncClinicalAssessmentRecord(r.id);
  }catch(error){alert(error.message||'심리보고서 생성 중 오류가 발생했습니다.');}
  finally{state.integratedReportLoading=false;render();}
}



function persistReviewedAnalysesAsComprehensiveSource(reservation){
  const r=reservation;
  const analyses=analysesForReservation(r.id);
  const reviewed=analyses.filter(x=>x.reviewed);
  if(!reviewed.length)throw new Error('상담자 검토가 완료된 검사별 분석이 필요합니다.');

  const groups=reportTestGroups(r);
  const materialCheck=validateIntegratedReportMaterials(r,groups,analyses);
  if(materialCheck.missingUpload.length)throw new Error(`신청한 검사를 모두 업로드해 주세요.\n\n미업로드 검사: ${materialCheck.missingUpload.join(', ')}`);
  if(materialCheck.missingReview.length)throw new Error(`모든 검사별 분석의 상담자 검토를 완료해 주세요.\n\n검토 미완료: ${materialCheck.missingReview.join(', ')}`);

  const cross=state.assessmentCrossAnalyses.find(x=>String(x.reservationId)===String(r.id)&&x.reviewed)
    ||(state.assessmentCrossDraft?.reviewed?state.assessmentCrossDraft:null)
    ||state.assessmentCrossAnalyses.find(x=>String(x.reservationId)===String(r.id))
    ||null;

  const sourceInventory=reviewed.map(x=>({
    testType:x.testType,
    subjectRole:(String(x.testType).includes('신청자')?'신청자':String(x.testType).includes('배우자')?'배우자':String(x.testType).includes('K-CDI')?'자녀':String(x.testType).includes('PAT')?'양육자':''),
    reviewed:true,
    confidenceScore:x.confidenceScore||'',
    sourceSummary:x.sourceSummary||'',
    validity:x.validity||'',
    coreFindings:x.coreFindings||'',
    strengths:x.strengths||'',
    vulnerabilities:x.vulnerabilities||'',
    cautions:x.cautions||'',
    crossChecks:x.crossChecks||'',
    rawFacts:x.rawFacts||null
  }));

  const isStateTest=name=>/MMPI|PAI|PHQ|GAD|우울|불안/i.test(String(name||''));
  const isTraitTest=name=>/TCI|JTCI|기질|성격/i.test(String(name||''));
  const joinUnique=(values,max=7000)=>{
    const seen=new Set();
    return values.map(v=>String(v||'').trim()).filter(Boolean).filter(v=>{
      const key=v.replace(/\s+/g,' ').slice(0,180).toLowerCase();
      if(seen.has(key))return false;seen.add(key);return true;
    }).join('\n\n').slice(0,max);
  };

  const currentState=joinUnique(reviewed.filter(x=>isStateTest(x.testType)).map(x=>x.coreFindings||x.sourceSummary),5200)
    ||joinUnique(reviewed.map(x=>x.coreFindings||x.sourceSummary),5200);
  const stableTraits=joinUnique(reviewed.filter(x=>isTraitTest(x.testType)).map(x=>x.coreFindings||x.sourceSummary),4600);
  const strengths=joinUnique(reviewed.map(x=>x.strengths),4200);
  const vulnerabilities=joinUnique(reviewed.map(x=>x.vulnerabilities||x.cautions),4200);
  const evidenceSummary=reviewed.map((x,index)=>`[${index+1}. ${x.testType}]\n${String(x.coreFindings||x.sourceSummary||'').trim()}\n강점·자원: ${String(x.strengths||'').trim()}\n주의·취약: ${String(x.vulnerabilities||x.cautions||'').trim()}`).join('\n\n');

  const clinicalProfile={
    validity:joinUnique(reviewed.map(x=>x.validity),3200),
    currentState,
    stableTraits,
    convergentThemes:cross?.commonPatterns?[{theme:'여러 검사에서 함께 확인된 특징',evidence:String(cross.commonPatterns),clinicalMeaning:String(cross.caseIntegration||'')}]:[],
    divergences:String(cross?.differences||''),
    formulation:{
      predisposing:stableTraits,
      precipitating:'',
      perpetuating:vulnerabilities,
      protective:strengths,
      presentFunctioning:String(cross?.caseIntegration||currentState)
    },
    strengths,
    vulnerabilities,
    riskAndLimits:String(cross?.riskProtection||joinUnique(reviewed.map(x=>x.cautions),2600)),
    counselingPriorities:String(cross?.counselingImplications||'')
  };

  const masterReport={
    schemaVersion:'MML-DIRECT-COMPREHENSIVE-SOURCE-1.0',
    purpose:'검토 완료된 검사별 분석자료를 최종 심리검사 종합보고서 작성 엔진에 직접 전달하는 내부 근거 데이터',
    subject:{clientName:r.name,program:programBaseName(r.program),evaluationPurpose:'실시한 심리검사 결과를 통합하여 현재 심리상태와 비교적 안정적인 특성, 관계·스트레스 반응 및 회복자원을 이해'},
    sourceInventory,
    crossAnalysis:cross||null,
    clinicalProfile,
    reportGenerationData:{
      counselor:{evidenceSummary,caseFormulation5P:String(cross?.caseIntegration||''),professionalSummary:''},
      client:{},
      shared:{
        title:'심리검사 종합보고서',
        evaluationOverview:`${reviewed.map(x=>x.testType).join(', ')} 검사결과를 상담자 검토 완료 자료에 근거해 통합합니다.`,
        testGuide:reviewed.map(x=>`${x.testType}: ${String(x.coreFindings||x.sourceSummary||'').trim()}`).join('\n\n'),
        clinicalCurrentState:currentState,
        clinicalTrait:stableTraits,
        clinicalConvergence:String(cross?.commonPatterns||''),
        clinicalDivergence:String(cross?.differences||''),
        clinicalFormulation:String(cross?.caseIntegration||''),
        clinicalProtectiveFactors:strengths
      }
    },
    quality:{needsCounselorReview:true}
  };

  const now=new Date().toLocaleString('ko-KR');
  const reports=Array.isArray(state.reports)?state.reports:[];
  const old=reports.find(x=>String(x.reservationId)===String(r.id)&&x.internalComprehensiveSource===true);
  const sourceReport={
    ...(old||{}),
    id:old?.id||Date.now(),
    reservationId:r.id,clientName:r.name,phone:r.phone||'',program:programBaseName(r.program),
    tests:reviewed.map(x=>x.testType),basicTests:groups.basicTests,additionalTests:groups.additionalTests,
    testType:'심리검사 종합보고서 직접생성 근거',title:'심리검사 종합보고서 직접생성 근거',
    sections:{
      evaluationOverview:masterReport.reportGenerationData.shared.evaluationOverview,
      testGuide:masterReport.reportGenerationData.shared.testGuide,
      emotionalProfile:currentState,
      thinkingStyle:stableTraits,
      relationshipStyle:String(cross?.commonPatterns||''),
      stressRecovery:String(cross?.caseIntegration||vulnerabilities),
      strengthsResources:strengths,
      currentSignals:vulnerabilities
    },
    summary:String(cross?.caseIntegration||currentState),
    strength:strengths,caution:vulnerabilities,plan:'',
    masterReport,clinicalProfile,
    crossAnalysis:cross||null,
    integratedAssessmentReport:true,internalComprehensiveSource:true,hiddenFromAssessmentWorkflow:true,
    assessmentReport:false,summaryReport:false,individualAssessmentReport:false,
    reviewed:true,approved:false,approvedForClient:false,status:'검토완료 검사자료 직접연결',
    reviewStatus:'internal-source',model:'reviewed-analysis-source',promptVersion:'direct-source-s27',
    qualityChecked:true,qualityIssues:[],fallback:false,repaired:false,
    generatedAt:now,version:Number(old?.version||0)+1,createdAt:old?.createdAt||now,updatedAt:now
  };

  const canonical=persistCanonicalAssessmentReport(sourceReport);
  state.reports=[canonical,...reports.filter(x=>String(x.id)!==String(canonical.id))];
  commitAssessmentReports(state.reports);
  syncClinicalAssessmentRecord(r.id);
  return canonical;
}

async function generateComprehensiveAssessmentReportDirect(buttonEl){
  const original=buttonEl?.textContent||'심리검사 종합보고서 생성(AI)';
  if(buttonEl){buttonEl.disabled=true;buttonEl.textContent='종합보고서 생성 중...';}
  try{
    const r=assessmentReservation();
    if(!r)throw new Error('대상 회원을 선택해 주세요.');
    const sourceReport=persistReviewedAnalysesAsComprehensiveSource(r);
    if(typeof generateDerivedAssessmentReport!=='function')throw new Error('심리검사 종합보고서 생성 모듈을 불러오지 못했습니다.');
    await generateDerivedAssessmentReport(sourceReport.id,'client',buttonEl||null);
  }catch(error){
    alert(error?.message||'심리검사 종합보고서를 생성하지 못했습니다.');
  }finally{
    if(buttonEl&&document.body.contains(buttonEl)){buttonEl.disabled=false;buttonEl.textContent=original;}
  }
}
window.generateComprehensiveAssessmentReportDirect=generateComprehensiveAssessmentReportDirect;

function buildIndividualAssessmentReportRecord(analysis,reservation,publishToClient,now,oldReport){
  // 승인 대기 및 내담자 공개용 개별보고서는 V4 전문보고서만 사용합니다.
  analysis=professionalIndividualReportSource(analysis);
  if(!analysis.professionalReportReady){
    throw new Error('V4 전문보고서가 완성되지 않아 저장·승인할 수 없습니다.');
  }
  const profile=individualReportProfile(analysis.testType);
  const sections={
    purpose:profile.purpose||'',
    validity:individualReportText(analysis.validity,'검사결과의 해석 가능성과 응답 신뢰도를 원자료와 함께 확인했습니다.'),
    coreFindings:clientReportPersonText(individualReportText(analysis.coreFindings||analysis.sourceSummary)),
    strengths:individualReportText(analysis.strengths,'검사결과에서 확인되는 적응 자원과 강점을 상담사가 검토하여 정리했습니다.'),
    vulnerabilities:individualReportText(analysis.vulnerabilities||analysis.cautions,'현재 주의 깊게 살펴볼 부분을 검사결과 범위 안에서 정리했습니다.'),
    emotionalPattern:individualReportText(analysis.emotionalPattern),
    thinkingPattern:individualReportText(analysis.thinkingPattern),
    relationshipPattern:individualReportText(analysis.relationshipPattern),
    stressPattern:individualReportText(analysis.stressPattern),
    dailyMeaning:individualReportText(analysis.dailyMeaning),
    helpfulDirections:individualReportText(analysis.helpfulDirections),
    summary:clientReportPersonText(individualReportText(analysis.coreFindings||analysis.sourceSummary)),
    disclaimer:'이 보고서는 해당 심리검사 결과를 바탕으로 작성된 참고자료이며, 단독으로 진단을 확정하지 않습니다. 상담자의 종합적 판단과 함께 활용합니다.'
  };
  return {
    ...(oldReport||{}),
    id:oldReport?.id||(Date.now()+Math.floor(Math.random()*100000)),
    reservationId:reservation.id,
    analysisId:analysis.id,
    analysisSnapshot:{...analysis},
    clientName:reservation.name,
    phone:reservation.phone||'',
    program:programBaseName(reservation.program),
    testType:analysis.testType,
    title:individualReportTitle(analysis.testType),
    tests:[analysis.testType],
    sections,
    summary:sections.summary,
    strength:sections.strengths,
    caution:sections.vulnerabilities,
    plan:sections.disclaimer,
    individualAssessmentReport:true,
    assessmentReport:false,
    integratedAssessmentReport:false,
    reviewed:true,
    approved:true,
    approvedForClient:Boolean(publishToClient),
    status:publishToClient?'내담자 공개':'상담자 승인 완료 · 공개 전',
    reviewStatus:'approved',
    reviewedAt:analysis.reviewedAt||now,
    approvedAt:now,
    publishedAt:publishToClient?now:'',
    reviewedBy:'상담자',
    reportBrand:'모두의 마음연구소',
    reportFormatVersion:'MML-INDIVIDUAL-2.0',
    bodyPageLimit:2,
    version:Number(oldReport?.version||0)+1,
    createdAt:oldReport?.createdAt||now,
    updatedAt:now
  };
}

function generateSummaryReportFromIntegrated(sourceId){
  const source=(state.reports||[]).find(x=>String(x.id)===String(sourceId)&&x.integratedAssessmentReport);
  if(!source){alert('저장된 AI 종합해석보고서를 찾지 못했습니다. 먼저 AI 해석보고서를 저장해 주세요.');return;}
  const reservation=(state.reservations||[]).find(r=>String(r.id)===String(source.reservationId));
  const sec=source.sections||{};
  const tests=Array.isArray(source.tests)?source.tests:[];
  const testSummary=tests.map(test=>{
    const analysis=(state.assessmentAnalyses||[]).find(a=>String(a.reservationId)===String(source.reservationId)&&assessmentTestMatches(a.testType,test));
    const text=analysis?.clientReport?.overview||analysis?.coreFindings||analysis?.sourceSummary||'';
    return `■ ${assessmentTestLabel(test)}\n${text}`.trim();
  }).filter(Boolean).join('\n\n');
  const now=new Date().toLocaleString('ko-KR');
  const id=Date.now();
  const draft={
    ...emptyReportForm(),
    id,
    code:'SR-'+String(id).slice(-6),
    reservationId:source.reservationId,
    clientName:source.clientName||reservation?.name||'',
    phone:source.phone||reservation?.phone||'',
    program:source.program||programBaseName(reservation?.program||'개별 심리검사'),
    selectedTests:tests,
    testType:tests.join(', '),
    title:`${source.clientName||reservation?.name||'내담자'}님 심리검사 요약보고서`,
    summary:sec.keyMessage||sec.integratedUnderstanding||'',
    mindProfile:[sec.strengthsResources,sec.emotionalProfile].filter(Boolean).join('\n\n'),
    individualTests:testSummary||sec.testGuide||'',
    emotionState:sec.emotionalProfile||'',
    thinkingRelationship:[sec.thinkingStyle,sec.relationshipStyle].filter(Boolean).join('\n\n'),
    stressDaily:sec.stressRecovery||'',
    plan:[sec.psychologicalSuggestions,sec.professionalSummary].filter(Boolean).join('\n\n'),
    strength:sec.strengthsResources||'',
    caution:sec.currentSignals||'',
    reportType:'summaryReport',summaryReport:true,status:'작성중',approvedForClient:false,
    sourceIntegratedReportId:source.id,
    createdAt:now,updatedAt:now,version:1,versionHistory:[]
  };
  state.reports=[draft,...(state.reports||[])];
  commitAssessmentReports(state.reports);
  state.reportForm={...draft};
  state.reportEditingId=id;
  state.menu='report';
  render();
  setTimeout(()=>window.scrollTo({top:0,behavior:'smooth'}),0);
}


function previewIntegratedAssessmentReport(){
  const r=assessmentReservation();
  const savedReport=r?assessmentCenterIntegratedReportForReservation(r.id):null;
  const rawSource=state.integratedReportDraft||(savedReport?.sections||null);
  if(!rawSource){alert('먼저 AI 종합해석보고서를 작성해 주세요.');return;}
  const source=clinicianIntegratedSource(rawSource,state.integratedReportDraft?.masterReport||savedReport?.masterReport||null);
  const fields=[
    ['clinicalJudgment','1. 종합 임상판단'],['convergentEvidence','2. 검사 간 일치점과 근거'],
    ['discrepancies','3. 검사 간 차이와 해석'],['caseFormulation','4. 사례개념화'],
    ['coreProblems','5. 핵심 문제와 현재 기능'],['strengthsProtection','6. 강점과 보호요인'],
    ['riskFactors','7. 위험요인과 확인 필요사항'],['counselingPriorities','8. 상담 우선순위'],
    ['counselingStrategies','9. 상담전략 제안'],['followUpQuestions','10. 추가 확인 질문'],
    ['monitoringPoints','11. 모니터링 항목'],['professionalSummary','12. 전문가 종합소견'],
    ['supervisorNote','13. 상담자 검토 메모'],['limitations','14. 해석의 한계']
  ];
  const sections=fields.filter(([k])=>String(source[k]||'').trim()).map(([k,label])=>`<section><h2>${label}</h2><div>${esc(source[k]||'')}</div></section>`).join('');
  const title=esc(source.title||'AI 종합해석보고서');
  const subtitle=esc(source.subtitle||'검사별 결과를 통합한 전문가 검토용 심리평가 보고서');
  const tests=assessmentRequestedTests(r).map(esc).join(', ')||'검사 정보 없음';
  const issued=new Date().toLocaleDateString('ko-KR');
  const popup=window.open('','mmlIntegratedAssessmentPreview','width=1050,height=900,scrollbars=yes,resizable=yes');
  if(!popup){alert('미리보기 창이 차단되었습니다. 브라우저의 팝업 허용 후 다시 눌러 주세요.');return;}
  popup.document.open();
  popup.document.write(`<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title} 미리보기</title><style>
  *{box-sizing:border-box}body{margin:0;background:#e8eeeb;color:#20322d;font-family:Pretendard,'Noto Sans KR',Arial,sans-serif}.toolbar{position:sticky;top:0;z-index:10;display:flex;justify-content:space-between;align-items:center;padding:12px 22px;background:#123f33;color:#fff;box-shadow:0 4px 15px rgba(0,0,0,.18)}.toolbar strong{font-size:14px}.toolbar button{border:1px solid rgba(255,255,255,.45);border-radius:10px;background:#fff;color:#123f33;padding:9px 15px;font-weight:800;cursor:pointer}.paper{width:210mm;min-height:297mm;margin:22px auto;background:#fff;padding:18mm 17mm 20mm;box-shadow:0 18px 55px rgba(24,61,49,.14);position:relative}.paper:before{content:'';position:absolute;left:0;top:0;width:100%;height:7mm;background:linear-gradient(90deg,#123f33 0 60%,#d9a56a 60% 72%,#edf2ef 72%)}header{display:flex;justify-content:space-between;gap:25px;padding-top:6mm;padding-bottom:15px;border-bottom:1px solid #cad8d2}.kicker{margin:0 0 8px;font-size:9px;font-weight:900;letter-spacing:.17em;color:#b4783d}h1{margin:0;color:#123f33;font-size:28px;line-height:1.3;letter-spacing:-.04em}.subtitle{margin:8px 0 0;font-size:11px;line-height:1.7;color:#71817a}.logo{width:54px;height:54px;border:1px solid #123f33;border-radius:50%;display:grid;place-items:center;font-size:12px;font-weight:900;color:#123f33}.meta{display:grid;grid-template-columns:repeat(3,1fr);margin-top:14px;border:1px solid #d9e2de;border-radius:11px;overflow:hidden}.meta div{padding:10px 12px;background:#f8faf9;border-right:1px solid #d9e2de}.meta div:last-child{border-right:0}.meta span{display:block;font-size:8px;color:#87948e}.meta b{display:block;margin-top:4px;font-size:10px}.summary{margin-top:18px;padding:17px 19px;border-radius:14px;background:#123f33;color:#fff}.summary span{font-size:9px;color:#d6a369;font-weight:900}.summary p{margin:7px 0 0;font-size:11.5px;line-height:1.85;white-space:pre-wrap}section{margin-top:17px;padding:0 1px 15px;border-bottom:1px solid #e0e8e4;break-inside:avoid}section h2{margin:0 0 9px;color:#123f33;font-size:14px}section div{font-size:10.8px;line-height:1.82;color:#43574f;white-space:pre-wrap;word-break:keep-all;overflow-wrap:anywhere}.footer{display:flex;justify-content:space-between;margin-top:18px;padding-top:8px;border-top:1px solid #d9e2de;font-size:8px;color:#819089}.notice{margin-top:14px;padding:11px 13px;border-radius:10px;background:#fbf3e9;color:#75532f;font-size:9px;line-height:1.65}@media(max-width:900px){.paper{width:calc(100% - 24px);padding:14mm 10mm}.meta{grid-template-columns:1fr}.meta div{border-right:0;border-bottom:1px solid #d9e2de}}@media print{body{background:#fff}.toolbar{display:none}.paper{width:auto;min-height:auto;margin:0;box-shadow:none;padding:15mm}.paper:before{position:fixed}@page{size:A4;margin:0}}
  </style></head><body><div class="toolbar"><strong>AI 종합해석보고서 미리보기</strong><button onclick="window.print()">PDF·인쇄</button></div><main class="paper"><header><div><p class="kicker">MODUMAM PSYCHOLOGICAL REPORT</p><h1>${title}</h1><p class="subtitle">${subtitle}</p></div><div class="logo">ㅁㄷㅁ</div></header><div class="meta"><div><span>검사 구성</span><b>${tests}</b></div><div><span>발행일</span><b>${issued}</b></div><div><span>작성자</span><b>임상심리사 백인영</b></div></div>${String(source.clinicalJudgment||'').trim()?`<div class="summary"><span>CLINICAL JUDGMENT</span><p>${esc(source.clinicalJudgment)}</p></div>`:''}${sections}<div class="notice">본 보고서는 업로드된 심리검사 결과와 상담자 검토 자료를 바탕으로 작성된 전문가 검토용 보고서입니다. 최종 저장 전 내용을 확인하고 필요한 부분을 수정해 주세요.</div><div class="footer"><b>MODUMAM-LAB</b><span>AI 종합해석보고서 · 미리보기</span></div></main></body></html>`);
  popup.document.close();
  popup.focus();
}

function saveIntegratedAssessmentReport(publishToClient=false){
  const r=assessmentReservation();const d=state.integratedReportDraft;
  if(!r||!d){alert('먼저 AI 종합해석보고서를 생성해 주세요.');return;}
  if(!confirm('생성된 AI 종합해석보고서를 원본 보고서로 저장할까요?'))return;

  const now=new Date().toLocaleString('ko-KR');
  const reviewedAnalyses=analysesForReservation(r.id).filter(x=>x.reviewed);
  const tests=reviewedAnalyses.map(x=>x.testType);
  const groups=reportTestGroups(r);
  const sections=clinicianIntegratedSource(d,d.masterReport||null);
  sections.sourceReport={...d};
  ['clientReport','reservationId','tests','model','promptVersion','qualityChecked','qualityIssues','generatedAt','updatedAt','masterReport','clinicalProfile'].forEach(k=>delete sections.sourceReport[k]);
  const oldReports=Array.isArray(state.reports)?state.reports:[];
  const oldSource=oldReports.find(x=>String(x.reservationId)===String(r.id)&&x.integratedAssessmentReport);
  const sourceReport={
    ...(oldSource||{}),
    id:oldSource?.id||Date.now(),
    reservationId:r.id,clientName:r.name,phone:r.phone||'',program:programBaseName(r.program),
    tests,basicTests:groups.basicTests,additionalTests:groups.additionalTests,
    testType:'AI 종합해석보고서',title:'AI 종합해석보고서',sections,
    summary:[sections.clinicalJudgment,sections.caseFormulation,sections.professionalSummary].filter(Boolean).join('\n\n'),
    strength:sections.strengthsProtection,caution:sections.riskFactors,plan:sections.counselingPriorities,
    masterReport:d.masterReport||null,clinicalProfile:d.clinicalProfile||d.masterReport?.clinicalProfile||null,
    integratedAssessmentReport:true,assessmentReport:false,summaryReport:false,individualAssessmentReport:false,
    reviewed:true,approved:true,approvedForClient:false,status:'AI 해석 원본 저장 완료',reviewStatus:'source-approved',
    reviewedAt:now,approvedAt:now,reviewedBy:'상담자',model:d.model||'',promptVersion:d.promptVersion||'',
    qualityChecked:Boolean(d.qualityChecked),qualityIssues:d.qualityIssues||[],fallback:Boolean(d.fallback),repaired:Boolean(d.repaired),diagnostics:d.diagnostics||null,generatedAt:d.generatedAt||now,
    version:Number(oldSource?.version||0)+1,createdAt:oldSource?.createdAt||now,updatedAt:now
  };
  const nextReports=[sourceReport,...oldReports.filter(x=>String(x.id)!==String(sourceReport.id))];
  try{
    const savedReports=commitAssessmentReports(nextReports);
    if(!Array.isArray(savedReports)||!savedReports.some(x=>String(x.id)===String(sourceReport.id))){
      throw new Error('저장 후 AI 종합해석보고서를 확인하지 못했습니다.');
    }
    state.reports=savedReports;
    const canonicalSource=persistCanonicalAssessmentReport(sourceReport);
    state.reports=[canonicalSource,...state.reports.filter(item=>String(item.id)!==String(canonicalSource.id))];
    commitAssessmentReports(state.reports);
  }catch(error){
    console.error('[MML] AI 종합해석보고서 저장 실패',error);
    alert('AI 종합해석보고서를 저장하지 못했습니다. 생성된 초안은 유지합니다.\n\n'+(error?.message||''));
    return;
  }
  updateReservation(r.id,{integratedAssessmentReportStatus:'AI 해석 원본 저장 완료',integratedAssessmentReportId:sourceReport.id});
  try{syncClinicalAssessmentRecord(r.id);}catch(error){console.warn('[MML] 전자차트 동기화 재시도 필요',error);}
  try{
    state.assessmentReportDrafts=window.MMLReportStore?.deleteDraftByReservationId?.(r.id,'integratedAssessmentDraft',state.assessmentReportDrafts)||(state.assessmentReportDrafts||[]).filter(x=>String(x.reservationId)!==String(r.id));
  }catch(error){
    console.warn('[MML] 저장 완료 후 초안 정리 실패',error);
    state.assessmentReportDrafts=(state.assessmentReportDrafts||[]).filter(x=>String(x.reservationId)!==String(r.id));
    save('modumam_assessment_report_drafts',state.assessmentReportDrafts);
  }
  state.integratedReportDraft=null;
  alert('AI 종합해석보고서를 저장했습니다. 아래에서 심리검사 종합보고서 또는 요약보고서를 생성해 주세요.');
  render();
}
function individualReportText(value,fallback=''){
  const sanitize=(input)=>String(input||'')
    .replace(/(?:^|\n)\s*(?:이름|성명|성별|연령|나이|생년월일|생년|학교|학년|기관|검사일|검사일자|규준집단|연락처)\s*[:：]\s*[^\n]*/gi,'')
    .replace(/\b(?:이름|성명|성별|연령|나이|생년월일|생년|학교|학년|기관|검사일|검사일자|규준집단|연락처)\s*[:：]\s*[^,，。.!?\n]+/gi,'')
    .replace(/(?:^|[\n.!?。]\s*)이름은\s*[^.!?。\n]{1,50}(?:입니다|이다)[.!?。]?/gi,' ')
    .replace(/(?:^|[\n.!?。]\s*)성명은\s*[^.!?。\n]{1,50}(?:입니다|이다)[.!?。]?/gi,' ')
    .replace(/(?:^|[\n.!?。]\s*)성별은\s*[^.!?。\n]{1,120}[.!?。]?/gi,' ')
    .replace(/(?:^|[\n.!?。]\s*)(?:연령|나이)는\s*[^.!?。\n]{1,80}[.!?。]?/gi,' ')
    .replace(/(?:^|[\n.!?。]\s*)(?:검사일|검사일자)은\s*[^.!?。\n]{1,160}[.!?。]?/gi,' ')
    .replace(/(?:^|[\n.!?。]\s*)규준집단은\s*[^.!?。\n]{1,100}[.!?。]?/gi,' ')
    .replace(/(?:^|[\n.!?。]\s*)(?:학교|기관)은\s*[^.!?。\n]{1,100}[.!?。]?/gi,' ')
    .replace(/(?:^|[\n.!?。]\s*)[가-힣]{2,4}\s*(?:학생|내담자|검사대상자)은\s*/g,'')
    .replace(/\n{3,}/g,'\n\n')
    .replace(/[ \t]{2,}/g,' ')
    .replace(/^\s*[.!?。]+\s*/g,'')
    .trim();
  const text=sanitize(value);
  return text||sanitize(fallback);
}
function individualReportTitle(testType){
  const label=assessmentTestLabel(testType);
  return `${label} 심리검사 결과보고서`;
}
function individualReportProfile(testType){
  const test=assessmentTestLabel(testType);
  const profiles={
    'TCI':{purpose:'기질과 성격의 상호작용을 살펴보고, 정서 반응·관계 방식·자기조절 특성을 이해하기 위한 검사입니다.',domains:['정서 반응','행동 경향','대인 민감성','자기조절','관계 자원','성장 가능성']},
    'MMPI-2':{purpose:'현재의 임상적 성격 특성과 심리적 증상, 스트레스 반응 및 전반적인 적응 수준을 폭넓게 살펴보기 위한 검사입니다.',domains:['검사 신뢰도','임상적 정서 특징','사고 및 현실검증','행동 조절','대인관계','적응 자원']},
    'PAI':{purpose:'현재 경험하는 심리상태와 임상 증상, 대인관계 및 생활 적응 양상을 구체적으로 살펴보기 위한 검사입니다.',domains:['현재 정서 상태','불안과 긴장','스트레스 부담','자기인식','대인관계','보호 자원']},
    'SCT':{purpose:'완성한 문장에 드러난 주요 관심, 정서, 관계 경험과 자기인식을 질적으로 이해하기 위한 검사입니다.',domains:['자기인식','가족 경험','대인관계','정서 주제','미래 기대','회복 자원']},
    'HTP':{purpose:'그림에 표현된 자기상, 관계 경험, 정서적 긴장과 심리적 자원을 탐색적으로 이해하기 위한 검사입니다.',domains:['자기상','안정감','관계 경험','정서 표현','긴장 반응','심리 자원']},
    'PAT':{purpose:'부모의 양육 태도와 자녀를 대하는 상호작용 특성을 이해하기 위한 검사입니다.',domains:['애정 표현','규칙과 한계','자율성 지원','기대 수준','의사소통','양육 자원']},
    'K-CDI':{purpose:'아동·청소년이 최근 경험하는 우울 관련 정서와 생각, 생활 기능의 변화를 살펴보기 위한 검사입니다.',domains:['기분 상태','자기평가','생활 활력','관계 경험','학교·일상','보호 자원']},
    'PHQ-9':{purpose:'최근 경험한 우울 관련 증상의 빈도와 일상 기능에 미치는 영향을 확인하기 위한 선별검사입니다.',domains:['기분','흥미와 의욕','수면','에너지','집중','일상 기능']},
    'GAD-7':{purpose:'최근 경험한 불안과 걱정의 정도, 긴장 및 일상 기능에 미치는 영향을 확인하기 위한 선별검사입니다.',domains:['걱정','긴장','조절감','신체 반응','집중','일상 기능']},
    'STS':{purpose:'현재 경험하는 스트레스의 수준과 주요 부담 영역, 대처 가능성을 살펴보기 위한 검사입니다.',domains:['스트레스 수준','정서 반응','신체 반응','생활 부담','대처 방식','회복 자원']},
    '회복탄력성':{purpose:'어려움 이후 다시 균형을 회복하고 적응해 가는 심리적 자원을 살펴보기 위한 검사입니다.',domains:['정서 조절','충동 통제','낙관성','원인 분석','공감','관계 자원']}
  };
  return profiles[test]||{purpose:`${test} 결과를 통해 현재의 심리적 특성과 반응 경향, 적응 자원을 이해하기 위한 검사입니다.`,domains:['정서','사고','관계','스트레스','자기조절','회복 자원']};
}
function individualReportEditableText(a,key,text,editable,tag='p'){
  const safe=esc(text||'');
  if(!editable)return `<${tag}>${safe}</${tag}>`;
  return `<${tag} id="assessment-${esc(a.id)}-${key}" data-report-key="${key}" contenteditable="true" spellcheck="false" class="mml-live-edit">${safe}</${tag}>`;
}

function professionalProfileRows(a,profile){
  const source=a?.professionalProfile||a?.clientReport?.professionalProfile||{};
  const labels=[
    ['emotion','정서'],
    ['thinking','사고'],
    ['relationship','관계'],
    ['stress','스트레스'],
    ['selfRegulation','자기조절'],
    ['recovery','회복 자원']
  ];
  const legacy=profile?.domains||[];
  const insufficient=/독립적으로 구체화할 근거가 충분하지|구체적으로 단정하기 어렵/i;
  return labels.map(([key,label],index)=>({
    label:legacy[index]||label,
    text:String(source?.[key]||'').trim()
  })).filter(row=>row.text&&!insufficient.test(row.text));
}
function individualReportSectionLabels(testType){
  const test=assessmentTestLabel(testType);
  const map={
    'TCI':{detailTitle:'기질과 성격의 상호작용',detailSub:'자동적 반응 경향과 발달된 자기조절 방식',emotion:'정서 반응과 기질적 민감성',thinking:'판단과 자기이해',relationship:'관계 민감성과 협력 방식',stress:'부담 상황의 반응',daily:'자기조절과 생활 적응'},
    'MMPI-2':{detailTitle:'현재 심리상태의 통합 이해',detailSub:'타당도와 전체 프로파일을 바탕으로 한 해석',emotion:'정서 및 임상적 특징',thinking:'사고·집중·현실검증',relationship:'대인관계와 행동 특성',stress:'스트레스와 증상 변화',daily:'현재 기능과 적응 수준'},
    'PAI':{detailTitle:'현재 증상과 적응의 통합 이해',detailSub:'임상·대인관계·치료고려 지표의 연결',emotion:'현재 정서와 증상 경험',thinking:'자기개념과 문제해결',relationship:'대인관계 양식',stress:'부담과 위험·보호요인',daily:'기능 영향과 치료 고려사항'},
    'SCT':{detailTitle:'반복 주제와 심리적 의미',detailSub:'자기인식·관계·갈등·미래 기대의 탐색적 이해',emotion:'정서적 주제',thinking:'자기인식과 내적 갈등',relationship:'가족 및 대인관계 경험',stress:'부담과 욕구',daily:'현재 삶에서의 의미'},
    'HTP':{detailTitle:'그림에 표현된 심리적 주제',detailSub:'자기상·안정감·관계 표상의 탐색적 이해',emotion:'정서 표현과 긴장',thinking:'자기상과 현실 인식',relationship:'관계 표상과 거리',stress:'불안정감과 부담 반응',daily:'심리적 자원과 적응 의미'}
  };
  return map[test]||{detailTitle:'검사 결과의 세부 이해',detailSub:'원자료에서 확인된 심리적 특성과 생활 의미',emotion:'정서와 심리상태',thinking:'사고 및 자기이해',relationship:'대인관계 특징',stress:'스트레스 반응',daily:'일상생활에서의 의미'};
}
function individualReportHasContent(value){
  const text=String(value||'').trim();
  return !!text&&!/전문보고서를 다시 작성|독립적으로 구체화할 근거가 충분하지|구체적으로 단정하기 어렵/i.test(text);
}

function buildIndividualAssessmentReportHtml(a,printMode=false,editable=false){
  // 수정 화면·미리보기·PDF가 동일한 내담자용 원문과 동일한 HTML 템플릿을 사용합니다.
  a=professionalIndividualReportSource(a);
  const r=state.reservations.find(x=>String(x.id)===String(a.reservationId))||{};
  const test=assessmentTestLabel(a.testType);
  const profile=individualReportProfile(test);
  const overview=individualReportText(a.clientReport?.currentMind||a.clientReport?.overview);
  const strengths=individualReportText(a.clientReport?.strengths);
  const caution=individualReportText(a.clientReport?.focus);
  const validity=individualReportText(a.clientReport?.interpretationBasis);
  const suggestions=individualReportText(a.clientReport?.recommendations);
  const cautions=individualReportText(a.clientReport?.readerNote);
  const emotional=individualReportText(a.clientReport?.emotionalUnderstanding||a.emotionalPattern,overview);
  const thinking=individualReportText(a.clientReport?.thinkingUnderstanding||a.thinkingPattern,'전문보고서를 다시 작성해 주세요.');
  const relationship=individualReportText(a.clientReport?.relationshipUnderstanding||a.relationshipPattern,'전문보고서를 다시 작성해 주세요.');
  const stress=individualReportText(a.clientReport?.stressUnderstanding||a.stressPattern,'전문보고서를 다시 작성해 주세요.');
  const daily=individualReportText(a.clientReport?.dailyMeaning||a.dailyMeaning,'전문보고서를 다시 작성해 주세요.');
  const date=individualReportDisplayDate(a.publishedAt||a.approvedAt||a.updatedAt||a.generatedAt||a.createdAt);
  const sectionLabels=individualReportSectionLabels(test);
  if(!a.professionalReportReady){
    const blocked=`<main class="mml-signature-report"><article class="mml-page"><header class="mml-cover-head"><div><p class="mml-kicker">MODUMAM PROFESSIONAL REPORT</p><h1>${esc(individualReportTitle(test))}</h1><p class="mml-subtitle">기존 저품질 보고서 생성 경로가 삭제되었습니다.</p></div><div class="mml-logo"><strong>ㅁㄷㅁ</strong><span>모두의 마음연구소</span></div></header><section class="mml-opening"><p class="mml-section-no">!</p><div><h2>전문보고서 작성 필요</h2><p>이 검사에는 아직 전문보고서 결과가 생성되지 않았습니다. 검사결과를 다시 업로드하거나 분석을 다시 실행한 후 확인해 주세요.</p></div></section></article></main>`;
    if(!printMode)return blocked;
    return `<!doctype html><html lang="ko"><head><meta charset="utf-8"><title>${esc(individualReportTitle(test))}</title><style>${individualAssessmentReportCss()}</style></head><body>${blocked}</body></html>`;
  }
  const profileRows=professionalProfileRows(a,profile);
  const domains=profileRows.map((row,i)=>`<div class="mml-domain"><span>${String(i+1).padStart(2,'0')}</span><div><b>${esc(row.label)}</b><p>${esc(row.text)}</p></div></div>`).join('');
  const emotionSection=individualReportHasContent(emotional)?`<section class="mml-detail"><div class="mml-section-title"><p>03</p><div><h2>${esc(sectionLabels.detailTitle)}</h2><span>${esc(sectionLabels.detailSub)}</span></div></div><div class="mml-text-panel"><h3>${esc(sectionLabels.emotion)}</h3>${individualReportEditableText(a,'emotionalPattern',emotional,editable)}</div></section>`:'';
  const thinkingBlock=individualReportHasContent(thinking)?`<div><span>${esc(sectionLabels.thinking)}</span>${individualReportEditableText(a,'thinkingPattern',thinking,editable)}</div>`:'';
  const relationshipBlock=individualReportHasContent(relationship)?`<div><span>${esc(sectionLabels.relationship)}</span>${individualReportEditableText(a,'relationshipPattern',relationship,editable)}</div>`:'';
  const thoughtRelationSection=(thinkingBlock||relationshipBlock)?`<section class="mml-integration"><div class="mml-section-title"><p>04</p><div><h2>사고와 관계 방식</h2><span>검사에서 확인된 자기이해와 관계 특성</span></div></div><div class="mml-flow ${thinkingBlock&&relationshipBlock?'mml-flow-two':'mml-flow-one'}">${thinkingBlock}${thinkingBlock&&relationshipBlock?'<i>↔</i>':''}${relationshipBlock}</div></section>`:'';
  const stressBlock=individualReportHasContent(stress)?`<div><span>${esc(sectionLabels.stress)}</span>${individualReportEditableText(a,'stressPattern',stress,editable)}</div>`:'';
  const dailyBlock=individualReportHasContent(daily)?`<div><span>${esc(sectionLabels.daily)}</span>${individualReportEditableText(a,'dailyMeaning',daily,editable)}</div>`:'';
  const stressDailySection=(stressBlock||dailyBlock)?`<section class="mml-integration"><div class="mml-section-title"><p>05</p><div><h2>스트레스와 일상생활</h2><span>부담 상황의 변화와 실제 기능의 의미</span></div></div><div class="mml-flow ${stressBlock&&dailyBlock?'mml-flow-two':'mml-flow-one'}">${stressBlock}${stressBlock&&dailyBlock?'<i>↔</i>':''}${dailyBlock}</div></section>`:'';
  const paper=`
  <main class="mml-signature-report ${editable?'mml-report-edit-mode':''}">
    <article class="mml-page mml-page-one">
      <header class="mml-cover-head"><div><p class="mml-kicker">MODUMAM SIGNATURE REPORT</p><h1>${esc(individualReportTitle(test))}</h1><p class="mml-subtitle">검사 결과를 한 사람의 삶과 마음의 맥락에서 이해하도록 돕는 심리평가 보고서</p></div><div class="mml-logo"><strong>ㅁㄷㅁ</strong><span>모두의 마음연구소</span></div></header>
      <section class="mml-meta"><div><span>성명</span><b>${esc(a.clientName||r.name||'')}</b></div><div><span>검사명</span><b>${esc(test)}</b></div><div><span>발행일</span><b>${esc(date)}</b></div><div><span>작성자</span><b>임상심리사 백인영</b></div></section>
      <section class="mml-opening"><p class="mml-section-no">01</p><div><h2>현재 마음의 핵심 모습</h2>${individualReportEditableText(a,'coreFindings',overview,editable)}</div></section>
      <section class="mml-purpose"><div><span>검사 목적</span><p>${esc(profile.purpose)}</p></div><div><span>결과 해석 기준</span>${individualReportEditableText(a,'validity',validity,editable)}</div></section>
      <section class="mml-key-grid"><div class="mml-key-card resource"><h3>강점과 심리적 자원</h3>${individualReportEditableText(a,'strengths',strengths,editable)}</div><div class="mml-key-card focus"><h3>살펴볼 부분</h3>${individualReportEditableText(a,'vulnerabilities',caution,editable)}</div></section>
      ${domains?`<section class="mml-domain-section"><div class="mml-section-title"><p>02</p><div><h2>마음 프로파일</h2><span>검사 결과에서 근거가 충분한 핵심 영역</span></div></div><div class="mml-domain-grid">${domains}</div></section>`:''}
      <footer class="mml-page-footer"><span>MODUMAMLAB</span><b>1 / 2+</b></footer>
    </article>
    <article class="mml-page mml-page-two">
      <header class="mml-inner-head"><div><p>MODUMAM SIGNATURE REPORT</p><h2>${esc(test)} 세부 이해</h2></div><span>${esc(a.clientName||r.name||'')}</span></header>
      ${emotionSection}
      ${thoughtRelationSection}
      ${stressDailySection}
      <section class="mml-direction"><div class="mml-section-title"><p>06</p><div><h2>전문가 제언 및 회복 방향</h2><span>검사 결과와 연결된 현실적인 도움 방향</span></div></div><div class="mml-direction-box">${individualReportEditableText(a,'helpfulDirections',suggestions,editable)}</div></section>
      <section class="mml-note"><h3>보고서를 읽을 때 기억할 점</h3>${individualReportEditableText(a,'cautions',cautions,editable)}<p>심리검사 결과는 개인을 규정하는 결론이 아니라, 현재의 마음과 적응 방식을 이해하기 위한 하나의 자료입니다. 결과는 최근의 경험, 환경, 관계 맥락과 함께 살펴볼 때 가장 의미가 있습니다.</p></section>
      <section class="mml-closing"><span>마음을 알아차리고, 이해하고, 연결합니다.</span><p>이번 검사에서 확인된 특성은 어려움만을 의미하지 않습니다. 자신을 이해하는 언어가 생길 때, 강점은 더 잘 활용되고 부담은 보다 현실적으로 다룰 수 있습니다.</p></section>
      <footer class="mml-page-footer"><span>본 보고서는 AI 분석을 바탕으로 임상심리사 백인영이 원자료를 확인하고 수정하여 작성한 심리평가 결과보고서입니다.</span><b>2 / 2+</b></footer>
    </article>
  </main>`;
  if(!printMode)return paper;
  return `<!doctype html><html lang="ko"><head><meta charset="utf-8"><title>${esc(individualReportTitle(test))}</title><style>${individualAssessmentReportCss()}</style></head><body>${paper}<script>window.onload=()=>setTimeout(()=>window.print(),250)<\/script></body></html>`;
}
function individualAssessmentReportCss(){return `
*{box-sizing:border-box}html,body{margin:0;padding:0}body{background:#e8eeeb;color:#20322d;font-family:Pretendard,'Noto Sans KR',Arial,sans-serif;-webkit-print-color-adjust:exact;print-color-adjust:exact}.mml-signature-report{padding:18px 0}.mml-page{position:relative;width:210mm;min-height:297mm;height:auto;margin:0 auto 18px;background:#fff;padding:16mm 15mm 16mm;box-shadow:0 18px 55px rgba(24,61,49,.14);overflow:visible}.mml-page:before{content:'';position:absolute;left:0;top:0;width:100%;height:7mm;background:linear-gradient(90deg,#123f33 0 60%,#d9a56a 60% 72%,#edf2ef 72%)}.mml-cover-head{display:flex;justify-content:space-between;gap:28px;padding-top:7mm;padding-bottom:11px;border-bottom:1px solid #cad8d2}.mml-kicker,.mml-inner-head p{margin:0 0 7px;font-size:9px;font-weight:800;letter-spacing:.18em;color:#b4783d}.mml-cover-head h1{margin:0;color:#123f33;font-size:27px;line-height:1.25;letter-spacing:-.04em}.mml-subtitle{margin:8px 0 0;font-size:10.5px;line-height:1.7;color:#71817a}.mml-logo{text-align:center;color:#123f33}.mml-logo strong{display:block;border:1px solid #123f33;border-radius:50%;width:48px;height:48px;line-height:46px;font-size:14px;letter-spacing:-.15em}.mml-logo span{display:block;margin-top:6px;font-size:9px;font-weight:700}.mml-meta{display:grid;grid-template-columns:repeat(4,1fr);border:1px solid #d9e2de;border-radius:10px;margin-top:13px;overflow:hidden}.mml-meta div{padding:9px 11px;border-right:1px solid #d9e2de;background:#f8faf9}.mml-meta div:last-child{border-right:0}.mml-meta span{display:block;font-size:8px;color:#88968f}.mml-meta b{display:block;margin-top:4px;font-size:10.5px}.mml-opening{display:grid;grid-template-columns:46px 1fr;gap:15px;margin-top:19px;padding:17px 18px;background:#123f33;color:#fff;border-radius:14px}.mml-section-no{margin:0;color:#d6a369;font-size:22px;font-family:Georgia,serif}.mml-opening h2{margin:0 0 8px;font-size:16px}.mml-opening p{margin:0;font-size:11.5px;line-height:1.8;white-space:pre-line}.mml-purpose{display:grid;grid-template-columns:1fr 1fr;gap:11px;margin-top:12px}.mml-purpose div{border:1px solid #dde6e2;border-radius:12px;padding:12px 13px}.mml-purpose span{font-size:9px;font-weight:800;color:#b4783d}.mml-purpose p{margin:7px 0 0;font-size:9.8px;line-height:1.7;color:#596a63}.mml-key-grid{display:grid;grid-template-columns:1fr 1fr;gap:11px;margin-top:12px}.mml-key-card{border-radius:13px;padding:14px 15px;min-height:116px}.mml-key-card.resource{background:#eef6f2;border:1px solid #cfe3d9}.mml-key-card.focus{background:#fbf3e9;border:1px solid #ead5b8}.mml-key-card>span{font-size:8px;letter-spacing:.15em;font-weight:800;color:#b4783d}.mml-key-card h3{margin:5px 0 7px;font-size:12px;color:#123f33}.mml-key-card p{margin:0;font-size:9.8px;line-height:1.72;white-space:pre-line}.mml-domain-section{margin-top:15px}.mml-section-title{display:flex;align-items:flex-start;gap:12px;margin-bottom:10px}.mml-section-title>p{margin:0;font-family:Georgia,serif;font-size:19px;color:#b4783d}.mml-section-title h2{margin:0;font-size:15px;color:#123f33}.mml-section-title span{display:block;margin-top:3px;font-size:8.5px;color:#87948e}.mml-domain-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px}.mml-domain{display:grid;grid-template-columns:25px 1fr;gap:8px;padding:9px 10px;border-bottom:1px solid #dfe7e3}.mml-domain>span{font-family:Georgia,serif;color:#b4783d;font-size:11px}.mml-domain b{font-size:10.5px}.mml-domain p{margin:4px 0 0;font-size:8.8px;line-height:1.55;color:#66766f}.mml-inner-head{display:flex;justify-content:space-between;align-items:flex-end;padding-top:7mm;padding-bottom:10px;border-bottom:1px solid #cad8d2}.mml-inner-head h2{margin:0;font-size:20px;color:#123f33}.mml-inner-head>span{font-size:10px;font-weight:700;color:#71817a}.mml-detail,.mml-integration,.mml-direction{margin-top:17px}.mml-text-panel{padding:13px 15px;border-left:3px solid #b4783d;background:#f7f9f8;margin-top:9px}.mml-text-panel h3{margin:0 0 6px;font-size:11px;color:#123f33}.mml-text-panel p,.mml-direction-box p,.mml-note p,.mml-closing p{margin:0;font-size:10.2px;line-height:1.78;white-space:pre-line}.mml-flow{display:grid;grid-template-columns:1fr 18px 1fr 18px 1fr;gap:5px;align-items:stretch}.mml-flow.mml-flow-two{grid-template-columns:1fr 22px 1fr}.mml-flow.mml-flow-one{grid-template-columns:1fr}.mml-flow>div{border:1px solid #dbe5e0;border-radius:11px;padding:11px;background:#fff}.mml-flow span{font-size:8px;font-weight:800;color:#b4783d}.mml-flow p{margin:6px 0 0;font-size:9px;line-height:1.6}.mml-flow i{align-self:center;text-align:center;color:#b4783d;font-style:normal}.mml-direction-box{border-radius:12px;background:#eef6f2;padding:14px 16px;border:1px solid #cfe3d9}.mml-note{margin-top:13px;padding:12px 14px;border:1px solid #e2e8e5;border-radius:11px}.mml-note h3{margin:0 0 7px;font-size:10.5px;color:#123f33}.mml-note p+p{margin-top:7px}.mml-closing{margin-top:13px;padding:14px 16px;background:#123f33;color:#fff;border-radius:12px}.mml-closing span{display:block;margin-bottom:7px;font-size:9px;color:#d6a369;font-weight:800;letter-spacing:.06em}.mml-page-footer{position:relative;left:auto;right:auto;bottom:auto;margin-top:12mm;display:flex;justify-content:space-between;align-items:center;border-top:1px solid #d9e2de;padding-top:7px;font-size:7.8px;color:#819089}.mml-page-footer b{color:#123f33}
.mml-report-editor-shell{background:#e8eeeb;border-radius:18px;padding:16px;overflow:auto}.mml-editor-page{position:relative;width:min(100%,210mm);min-height:297mm;margin:0 auto 16px;background:#fff;padding:16mm 15mm;border-radius:4px;box-shadow:0 12px 35px rgba(24,61,49,.12)}.mml-editor-page:before{content:'';position:absolute;left:0;top:0;width:100%;height:7mm;background:linear-gradient(90deg,#123f33 0 60%,#d9a56a 60% 72%,#edf2ef 72%)}.mml-editor-head,.mml-editor-inner{display:flex;justify-content:space-between;gap:24px;padding-top:7mm;padding-bottom:11px;border-bottom:1px solid #cad8d2}.mml-editor-head p,.mml-editor-inner p{margin:0 0 6px;font-size:9px;font-weight:800;letter-spacing:.17em;color:#b4783d}.mml-editor-head h2,.mml-editor-inner h2{margin:0;color:#123f33;font-size:24px}.mml-editor-head small{display:block;margin-top:7px;color:#71817a}.mml-editor-logo{display:grid;place-items:center;width:48px;height:48px;border:1px solid #123f33;border-radius:50%;font-weight:900;color:#123f33}.mml-editor-meta{display:grid;grid-template-columns:repeat(4,1fr);margin-top:13px;border:1px solid #d9e2de;border-radius:10px;overflow:hidden}.mml-editor-meta div{padding:9px 11px;background:#f8faf9;border-right:1px solid #d9e2de}.mml-editor-meta div:last-child{border-right:0}.mml-editor-meta span{display:block;font-size:8px;color:#88968f}.mml-editor-meta b{font-size:10px}.mml-editor-hero{display:grid;grid-template-columns:40px 1fr;gap:12px;margin-top:18px;padding:16px 18px;background:#123f33;color:#fff;border-radius:14px}.mml-editor-hero>span{font:22px Georgia;color:#d6a369}.mml-editor-hero h3{margin:0 0 8px}.mml-editor-grid2{display:grid;grid-template-columns:1fr 1fr;gap:11px;margin-top:12px}.mml-editor-box{border:1px solid #dde6e2;border-radius:12px;padding:12px 13px}.mml-editor-box.resource{background:#eef6f2;border-color:#cfe3d9}.mml-editor-box.focus{background:#fbf3e9;border-color:#ead5b8}.mml-editor-box>b{font-size:9px;color:#b4783d}.mml-editor-box>p{font-size:10px;line-height:1.65;color:#596a63}.mml-editor-section{margin-top:16px}.mml-editor-section>h3{margin:0 0 10px;color:#123f33;font-size:15px}.mml-editor-field{display:block;margin-top:10px}.mml-editor-field>span{display:block;margin-bottom:5px;font-size:9px;font-weight:800;color:#b4783d}.mml-editor-field textarea{width:100%;min-height:86px;resize:vertical;border:1px solid #dbe5e0;border-radius:10px;padding:11px 12px;background:rgba(255,255,255,.92);font-size:11px;line-height:1.72;color:#20322d;outline:none}.mml-editor-hero textarea{background:rgba(255,255,255,.08);border-color:rgba(255,255,255,.28);color:#fff}.mml-editor-field textarea:focus{border-color:#b4783d;box-shadow:0 0 0 3px rgba(180,120,61,.12)}@media(max-width:900px){.mml-editor-page{width:760px}.mml-editor-grid2{grid-template-columns:1fr}}
.mml-v3-field{margin-top:8px}.mml-v3-label{margin-bottom:6px;font-size:9px;font-weight:800;letter-spacing:.02em;color:#b4783d}.mml-v3-editable{width:100%;min-height:64px;padding:10px 0;border:0;border-bottom:1px dashed transparent;background:transparent;color:#20322d;font-size:11.3px;line-height:1.82;white-space:pre-wrap;word-break:keep-all;overflow-wrap:anywhere;outline:none}.mml-v3-editable:hover{border-bottom-color:#c8d7d1}.mml-v3-editable:focus{border-radius:8px;border:1px solid #b4783d;background:#fff;padding:10px 12px;box-shadow:0 0 0 3px rgba(180,120,61,.12)}.mml-v3-editable:empty:before{content:attr(data-placeholder);color:#9aa8a2}.mml-editor-hero .mml-v3-label{color:#d6a369}.mml-editor-hero .mml-v3-editable{color:#fff}.mml-editor-hero .mml-v3-editable:focus{color:#20322d}.mml-editor-box .mml-v3-editable{min-height:84px}.mml-editor-section .mml-v3-field{padding:13px 0;border-bottom:1px solid #e3ebe7}.mml-editor-section .mml-v3-field:last-child{border-bottom:0}
.mml-report-edit-mode [contenteditable="true"]{outline:none;border:1px dashed transparent;border-radius:7px;transition:.15s}.mml-report-edit-mode [contenteditable="true"]:hover{border-color:#b9cbc3;background:rgba(255,255,255,.12)}.mml-report-edit-mode [contenteditable="true"]:focus{border-color:#b4783d;background:#fff;color:#20322d!important;box-shadow:0 0 0 3px rgba(180,120,61,.13);padding:6px}.mml-report-edit-mode .mml-page{overflow:visible}@media(max-width:900px){.mml-signature-report{padding:0;overflow:auto}.mml-page{margin:0 auto 12px;transform-origin:top left}}@media print{html,body{width:210mm;height:auto;background:#fff}.mml-signature-report{padding:0}.mml-page{width:210mm;min-height:0;height:auto;max-height:none;margin:0;box-shadow:none;overflow:visible;break-after:page;page-break-after:always;padding-top:14mm;padding-bottom:12mm}.mml-page:last-child{break-after:auto;page-break-after:auto}.mml-page-footer{margin-top:6mm;break-inside:avoid;page-break-inside:avoid}.mml-cover-head,.mml-inner-head,.mml-section-title,.mml-opening,.mml-purpose,.mml-key-card,.mml-text-panel,.mml-direction-box,.mml-note,.mml-closing{break-inside:avoid;page-break-inside:avoid}h1,h2,h3{break-after:avoid;page-break-after:avoid}p{orphans:3;widows:3}@page{size:A4;margin:0}}
`;}
function closeIndividualAssessmentPreview(){
  const modal=document.getElementById('mml-individual-report-preview');
  if(modal)modal.remove();
  document.body.style.overflow='';
}
function previewIndividualAssessmentReport(id){
  const original=state.assessmentAnalyses.find(x=>String(x.id)===String(id));
  if(!original){alert('미리보기할 검사보고서를 찾지 못했습니다.');return;}
  const linkedReport=typeof assessmentCenterIndividualReportForAnalysis==='function'?assessmentCenterIndividualReportForAnalysis(id):null;
  const approvedHtml=String(linkedReport?.approvedReportHtml||'').trim();
  if(linkedReport?.approvedForClient&&approvedHtml&&window.MMLReportViewer?.open){
    try{
      return window.MMLReportViewer.open({
        id:linkedReport.id,
        title:linkedReport.title||individualReportTitle(original.testType),
        html:approvedHtml
      },{printImmediately:false,toolbar:true});
    }catch(error){
      console.warn('[MML] 승인 개별보고서 원본 미리보기 fallback',error);
    }
  }
  const a=assessmentAnalysisWithEditorValues(original);
  closeIndividualAssessmentPreview();
  const modal=document.createElement('div');
  modal.id='mml-individual-report-preview';
  modal.style.cssText='position:fixed;inset:0;z-index:99999;background:rgba(15,23,42,.72);display:flex;flex-direction:column;padding:14px;';
  const toolbar=document.createElement('div');
  toolbar.style.cssText='display:flex;align-items:center;justify-content:space-between;gap:12px;background:#fff;border-radius:16px 16px 0 0;padding:12px 16px;box-shadow:0 10px 30px rgba(0,0,0,.18);';
  toolbar.innerHTML=`<div><b style="font-size:14px;color:#123f33">${esc(individualReportTitle(a.testType))}</b><span style="margin-left:8px;font-size:12px;color:#64748b">기본 2페이지 · 내용에 따라 자동 확장</span></div><div style="display:flex;gap:8px"><button type="button" id="mml-preview-print" style="border:1px solid #fed7aa;border-radius:10px;background:#fff;color:#c2410c;padding:9px 13px;font-weight:800;cursor:pointer">PDF·인쇄</button><button type="button" id="mml-preview-close" style="border:1px solid #cbd5e1;border-radius:10px;background:#fff;color:#334155;padding:9px 13px;font-weight:800;cursor:pointer">닫기</button></div>`;
  const frame=document.createElement('iframe');
  frame.title='개별 심리검사 보고서 미리보기';
  frame.style.cssText='width:100%;flex:1;border:0;background:#e8eeeb;border-radius:0 0 16px 16px;';
  frame.srcdoc=`<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(individualReportTitle(a.testType))}</title><style>${individualAssessmentReportCss()}</style></head><body>${buildIndividualAssessmentReportHtml(a,false)}</body></html>`;
  modal.append(toolbar,frame);
  document.body.appendChild(modal);
  document.body.style.overflow='hidden';
  document.getElementById('mml-preview-close').onclick=closeIndividualAssessmentPreview;
  document.getElementById('mml-preview-print').onclick=()=>printIndividualAssessmentReport(id);
  modal.addEventListener('click',e=>{if(e.target===modal)closeIndividualAssessmentPreview();});
}
function printIndividualAssessmentReport(id){
  const original=state.assessmentAnalyses.find(x=>String(x.id)===String(id));if(!original)return;
  const a=assessmentAnalysisWithEditorValues(original);
  const w=window.open('','_blank','width=980,height=900');if(!w){alert('팝업 차단을 해제해 주세요.');return;}w.document.write(buildIndividualAssessmentReportHtml(a,true));w.document.close();
}
function individualAssessmentPreviewDocument(a){
  const test=assessmentTestLabel(a.testType);
  const paper=buildIndividualAssessmentReportHtml(a,false);
  return `<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(individualReportTitle(test))}</title><style>${individualAssessmentReportCss()}body{overflow-x:auto}.mml-signature-report{padding:12px 0}.mml-page{box-shadow:0 8px 28px rgba(24,61,49,.12)}</style></head><body>${paper}</body></html>`;
}
function individualAssessmentPreviewUrl(a){
  return 'data:text/html;charset=utf-8,'+encodeURIComponent(individualAssessmentPreviewDocument(a));
}
function assessmentAnalysisCard(a){
  const r=state.reservations.find(x=>String(x.id)===String(a.reservationId))||{};
  const test=assessmentTestLabel(a.testType);
  const profile=individualReportProfile(test);
  const date=individualReportDisplayDate(a.publishedAt||a.approvedAt||a.updatedAt||a.generatedAt||a.createdAt);
  const sectionLabels=individualReportSectionLabels(test);
  const field=(key,label,rows=5,extra='')=>`<section class="mml-v3-field ${extra}"><div class="mml-v3-label">${label}</div><div id="assessment-${a.id}-${key}" class="mml-v3-editable" contenteditable="true" spellcheck="true" data-placeholder="${label} 내용을 입력하세요.">${esc(a[key]||'')}</div></section>`;
  const previewUrl=individualAssessmentPreviewUrl(a).replace(/&/g,'&amp;').replace(/"/g,'&quot;');
  return `<section id="assessment-report-card-${assessmentTestKey(test)}" class="rounded-[2rem] border ${a.reviewed?'border-emerald-200':'border-amber-200'} bg-white shadow-sm overflow-hidden">
    <div class="p-5"><div><p class="text-lg font-extrabold">${esc(individualReportTitle(a.testType))}</p><p class="mt-1 text-xs text-slate-400">${esc(a.fileName||'')} · ${esc(a.createdAt||'')}</p></div></div>
    <div class="border-t border-slate-100 bg-slate-100/70 p-3 sm:p-5">
      <iframe title="${esc(individualReportTitle(test))}" src="${previewUrl}" style="display:block;width:100%;height:1180px;border:0;border-radius:16px;background:#e8eeeb" loading="lazy"></iframe>
    </div>
    <div class="border-t border-slate-100 p-5">
      ${(()=>{const report=assessmentCenterIndividualReportForAnalysis(a.id);const requested=Boolean(report&&typeof reportHasMatchingClientRequest==='function'&&reportHasMatchingClientRequest(report));return `<div class="grid grid-cols-2 gap-2 sm:grid-cols-6"><button onclick="saveGeneratedAssessmentReport('${a.id}')" class="rounded-2xl bg-emerald-600 px-4 py-3 text-xs font-extrabold text-white shadow-sm hover:bg-emerald-700">생성된 결과보고서 저장</button>${report?`<button onclick="editIndividualAssessmentReport('${report.id}')" class="rounded-2xl border border-emerald-200 bg-white px-4 py-3 text-xs font-extrabold text-emerald-800">수정</button>${report.approvedForClient?`<span class="flex items-center justify-center rounded-2xl bg-emerald-50 px-4 py-3 text-xs font-extrabold text-emerald-700">승인완료</span><button onclick="toggleReportApproval('${report.id}')" class="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-xs font-extrabold text-slate-600">승인취소</button>`:requested?`<button onclick="toggleReportApproval('${report.id}')" class="rounded-2xl bg-emerald-700 px-4 py-3 text-xs font-extrabold text-white">승인</button>`:`<span class="flex items-center justify-center rounded-2xl bg-amber-50 px-4 py-3 text-xs font-extrabold text-amber-700">사용자 신청 대기</span>`}<button onclick="printReport('${report.id}',true)" class="rounded-2xl border border-orange-200 bg-white px-4 py-3 text-xs font-extrabold text-orange-700">PDF</button>`:''}</div>`})()}
    </div>
  </section>`;
}


function assessmentComprehensiveReportsForReservation(reservationId){
  let rows=[];
  try{
    if(typeof derivedAssessmentReports==='function')rows=derivedAssessmentReports();
    else if(window.MMLCanonicalReportStore?.read)rows=window.MMLCanonicalReportStore.read();
  }catch(_){rows=[]}
  const filtered=(Array.isArray(rows)?rows:[])
    .filter(report=>String(report?.reservationId||'')===String(reservationId)
      && report?.audience!=='counselor'
      && (report?.comprehensiveReport===true||report?.reportType==='comprehensiveReport'||report?.derivedReportType==='clientComprehensiveReport'))
    .sort((a,b)=>String(b.updatedAt||b.createdAt||'').localeCompare(String(a.updatedAt||a.createdAt||'')));
  return filtered.length?[filtered[0]]:[];
}
function openAssessmentComprehensiveReport(id){
  if(typeof openDerivedAssessmentReportForm==='function')return openDerivedAssessmentReportForm(id);
}
function editAssessmentComprehensiveReport(id){
  if(typeof openDerivedAssessmentReportForm!=='function')return;
  openDerivedAssessmentReportForm(id);
  setTimeout(()=>{try{toggleDerivedAssessmentReportEdit(true)}catch(_){}},80);
}
function printAssessmentComprehensiveReport(id){
  if(typeof openDerivedAssessmentReportForm!=='function'||typeof printDerivedAssessmentReportForm!=='function')return;
  const editor=document.getElementById('mml-derived-report-editor');
  if(editor&&String(editor.dataset.reportId)===String(id))return printDerivedAssessmentReportForm();
  openDerivedAssessmentReportForm(id);
  setTimeout(()=>{try{printDerivedAssessmentReportForm()}catch(_){}},180);
}
window.openAssessmentComprehensiveReport=openAssessmentComprehensiveReport;
window.editAssessmentComprehensiveReport=editAssessmentComprehensiveReport;
window.printAssessmentComprehensiveReport=printAssessmentComprehensiveReport;

function assessmentComprehensiveReportSection(reservation){
  const reports=assessmentComprehensiveReportsForReservation(reservation?.id);
  const cards=reports.length?reports.map(report=>{
    const approved=Boolean(report.approvedForClient);
    const saved=report.status==='saved'||report.reviewStatus==='saved'||approved;
    const statusText=approved?'승인완료 · 사용자 열람 가능':saved?'저장완료 · 승인대기':'작성 중';
    const statusTone=approved?'bg-emerald-100 text-emerald-700':saved?'bg-amber-100 text-amber-700':'bg-slate-100 text-slate-600';
    const tests=Array.isArray(report.tests)?report.tests.join(' · '):String(report.tests||'');
    return `<article class="rounded-[2rem] border border-emerald-200 bg-white p-5 shadow-sm">
      <div class="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div class="min-w-0">
          <div class="flex flex-wrap items-center gap-2"><h4 class="text-base font-extrabold text-slate-900">심리검사 종합보고서</h4><span class="rounded-full px-2.5 py-1 text-[10px] font-extrabold ${statusTone}">${statusText}</span></div>
          <p class="mt-2 text-xs text-slate-500">${esc(tests||'통합 심리검사')} · ${esc(String(report.updatedAt||report.createdAt||'').replace('T',' ').slice(0,16))} · v${Number(report.version||1)}</p>
          <p class="mt-1 text-[11px] text-slate-400">저장된 종합보고서를 다시 열어 수정·승인·승인취소·PDF 출력할 수 있습니다.</p>
        </div>
        <div class="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
          <button type="button" onclick="openAssessmentComprehensiveReport('${report.id}')" class="rounded-xl border border-emerald-200 bg-white px-4 py-2.5 text-xs font-extrabold text-emerald-800">열기</button>
          <button type="button" onclick="editAssessmentComprehensiveReport('${report.id}')" class="rounded-xl border border-indigo-200 bg-white px-4 py-2.5 text-xs font-extrabold text-indigo-700">수정</button>
          <button type="button" onclick="toggleDerivedAssessmentReportApproval('${report.id}')" class="rounded-xl ${approved?'border border-amber-200 bg-white text-amber-700':'bg-emerald-700 text-white'} px-4 py-2.5 text-xs font-extrabold">${approved?'승인취소':'승인'}</button>
          <button type="button" onclick="printAssessmentComprehensiveReport('${report.id}')" class="rounded-xl border border-orange-200 bg-white px-4 py-2.5 text-xs font-extrabold text-orange-700">PDF</button>
        </div>
      </div>
    </article>`;
  }).join(''):`<div class="rounded-[2rem] border border-dashed border-slate-200 bg-white p-10 text-center text-sm text-slate-400">아직 저장된 심리검사 종합보고서가 없습니다. 상단의 <b>심리검사 종합보고서 생성(AI)</b>으로 작성한 뒤 저장하면 이곳에 계속 표시됩니다.</div>`;
  return `<section id="assessment-comprehensive-reports" class="space-y-4">
    <div class="flex items-end justify-between"><div><h3 class="text-xl font-extrabold">3. 심리검사 종합보고서</h3><p class="mt-1 text-xs text-slate-400">개별 심리검사 보고서와 동일하게 저장본을 이 화면에서 계속 관리합니다.</p></div><span class="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold">${reports.length}건</span></div>
    ${cards}
  </section>`;
}

function testInterpretationView(){
  const r=assessmentReservation();const requested=assessmentRequestedTests(r);const analyses=r?analysesForReservation(r.id):[];
  const available=[...new Set([...requested,...analyses.map(x=>x.testType)])];
  const reportDraft=state.integratedReportDraft;
  return layout(`<div class="space-y-6"><div class="rounded-[2rem] bg-gradient-to-r from-slate-950 via-indigo-950 to-emerald-950 p-7 text-white shadow-xl"><p class="text-xs font-extrabold text-emerald-300">AI MASTER PSYCHOLOGICAL ASSESSMENT ENGINE 1.0</p><h2 class="mt-2 text-2xl font-extrabold">심리평가센터</h2><p class="mt-2 max-w-4xl text-sm leading-relaxed text-slate-300">모든 심리검사 결과와 상담자 검토 내용을 하나의 통합 마스터 보고서로 취합합니다. 심리평가센터에서 검사결과 분석부터 보고서 저장·승인·내담자 공개까지 한 번에 진행합니다.</p></div>
  <div class="rounded-[2rem] border border-slate-100 bg-white p-6 shadow-sm"><div class="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_auto]"><select onchange="setAssessmentReservation(this.value)" class="rounded-2xl border border-slate-200 px-4 py-3 text-sm font-bold"><option value="">회원·예약 선택</option>${state.reservations.map(x=>`<option value="${x.id}" ${String(state.assessmentReservationId)===String(x.id)?'selected':''}>${esc(x.name)} · ${esc(programBaseName(x.program))} · ${esc(x.date)} ${esc(x.time)}</option>`).join('')}</select>${r?`<button onclick="generateComprehensiveAssessmentReportDirect(this)" ${state.integratedReportLoading?'disabled':''} class="rounded-2xl bg-emerald-600 px-6 py-3 text-sm font-extrabold text-white disabled:cursor-not-allowed disabled:opacity-40">${state.integratedReportLoading?'종합보고서 생성 중...':'심리검사 종합보고서 생성(AI)'}</button>`:''}</div>${r?`<div class="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-5"><div class="rounded-2xl bg-slate-50 p-4"><p class="text-xs font-bold text-slate-400">회원</p><p class="mt-1 font-extrabold">${esc(r.name)}님</p></div><div class="rounded-2xl bg-slate-50 p-4"><p class="text-xs font-bold text-slate-400">프로그램</p><p class="mt-1 font-extrabold">${esc(programBaseName(r.program))}</p></div><div class="rounded-2xl bg-slate-50 p-4"><p class="text-xs font-bold text-slate-400">신청 검사</p><p class="mt-1 font-extrabold">${requested.length?requested.map(esc).join(', '):'검사 미등록'}</p></div><div class="rounded-2xl bg-slate-50 p-4"><p class="text-xs font-bold text-slate-400">분석 현황</p><p class="mt-1 font-extrabold">${analyses.filter(x=>x.reviewed).length}/${Math.max(requested.length,analyses.length)} 검토 완료</p></div>${(()=>{const reportStatus=assessmentTopReportStatus(r,analyses);const tone=reportStatus.tone==='emerald'?'bg-emerald-50 text-emerald-700':reportStatus.tone==='amber'?'bg-amber-50 text-amber-700':reportStatus.tone==='indigo'?'bg-indigo-50 text-indigo-700':'bg-slate-50 text-slate-600';return `<div class="rounded-2xl p-4 ${tone}"><p class="text-xs font-bold opacity-60">${esc(reportStatus.label)}</p><p class="mt-1 font-extrabold">${esc(reportStatus.text)}</p></div>`})()}</div>`:''}</div>
  ${r?assessmentReportRequestStatusCard(r,analyses):''}
  ${r?`<div class="rounded-[2rem] border border-slate-100 bg-white p-6 shadow-sm"><div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><h3 class="text-xl font-extrabold">1. 심리검사 결과 관리</h3><p class="mt-1 text-xs text-slate-400">검사결과를 추가하거나 검사별 파일을 변경·재분석·삭제할 수 있습니다.</p></div><label class="cursor-pointer rounded-2xl bg-indigo-600 px-5 py-3 text-sm font-extrabold text-white">검사결과 추가<input type="file" multiple accept="application/pdf,image/png,image/jpeg,image/webp" class="hidden" onchange="analyzeAssessmentFiles(this.files)"/></label></div><div class="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">${available.length?available.map(test=>{const a=analysisForTest(r.id,test);const loading=state.assessmentLoading[`${r.id}_${test}`];return`<div class="rounded-2xl border ${a?'border-emerald-200 bg-emerald-50':'border-slate-200 bg-slate-50'} p-5"><div class="flex items-center justify-between"><p class="font-extrabold">${esc(assessmentTestLabel(test))}</p><span class="rounded-full bg-white px-2 py-1 text-[10px] font-bold ${a?.reviewed?'text-emerald-700':a?'text-amber-700':'text-slate-400'}">${a?.reviewed?'검토완료':a?'분석완료':'업로드 대기'}</span></div>${a?`<div class="mt-4 grid grid-cols-3 gap-2"><label class="cursor-pointer rounded-xl border border-slate-200 bg-white px-2 py-3 text-center text-[11px] font-extrabold text-indigo-700">파일 변경<input type="file" accept="application/pdf,image/png,image/jpeg,image/webp" class="hidden" onchange="analyzeAssessmentFile('${r.id}','${esc(test)}',this.files[0])"/></label><label class="cursor-pointer rounded-xl border border-slate-200 bg-white px-2 py-3 text-center text-[11px] font-extrabold text-slate-700">${loading?'분석 중...':'재분석'}<input type="file" accept="application/pdf,image/png,image/jpeg,image/webp" class="hidden" onchange="analyzeAssessmentFile('${r.id}','${esc(test)}',this.files[0])"/></label><button onclick="deleteAssessmentTestResult('${r.id}','${esc(test)}')" class="rounded-xl border border-rose-200 bg-white px-2 py-3 text-[11px] font-extrabold text-rose-600">삭제</button></div>`:`<label class="mt-4 block cursor-pointer rounded-xl border-2 border-dashed border-slate-200 bg-white px-3 py-4 text-center text-xs font-extrabold text-indigo-700">${loading?'분석 중...':'결과 파일 업로드·분석'}<input type="file" accept="application/pdf,image/png,image/jpeg,image/webp" class="hidden" onchange="analyzeAssessmentFile('${r.id}','${esc(test)}',this.files[0])"/></label>`}</div>`}).join(''):'<p class="text-sm text-slate-400">신청 검사 정보가 없습니다.</p>'}</div><div class="mt-5 flex flex-wrap gap-2">${ASSESSMENT_TEST_OPTIONS.filter(x=>!available.includes(x)).map(test=>`<label class="cursor-pointer rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-600">+ ${esc(test)}<input type="file" accept="application/pdf,image/png,image/jpeg,image/webp" class="hidden" onchange="analyzeAssessmentFile('${r.id}','${esc(test)}',this.files[0])"/></label>`).join('')}</div></div>
  <div id="assessment-individual-reports" class="space-y-4"><div class="flex items-end justify-between"><div><h3 class="text-xl font-extrabold">2. 개별 심리검사 보고서</h3><p class="mt-1 text-xs text-slate-400">검사별로 생성된 결과보고서를 저장한 뒤 이 화면에서 수정·승인·승인취소·PDF 출력을 진행합니다. 승인된 보고서는 내담자 마음기록에 바로 연결됩니다.</p></div><span class="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold">${analyses.length}건</span></div>${analyses.length?analyses.map(assessmentAnalysisCard).join(''):'<div class="rounded-[2rem] border border-dashed border-slate-200 bg-white p-10 text-center text-sm text-slate-400">검사결과 파일을 업로드하면 개별 심리검사 보고서 초안이 여기에 표시됩니다.</div>'}</div>
  ${assessmentComprehensiveReportSection(r)}</div>`:`<div class="rounded-[2rem] border border-dashed border-slate-200 bg-white p-12 text-center text-sm text-slate-400">먼저 회원과 예약을 선택해 주세요.</div>`}</div>`)
}

// MOD-20260720-PDF-A4-FLOW-V8: 인쇄 시 297mm 최소높이로 인한 빈 페이지를 제거하고 제목/카드/푸터 분할을 방지합니다.
