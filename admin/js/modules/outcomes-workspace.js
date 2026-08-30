console.info('[MML] OUTCOMES-MODULE-V26 loaded');

function getTerminationRecord(reservationId){
  return load(terminationKey(reservationId),{
    reason:'',
    caseOverview:'',
    counselingProcess:'',
    majorInterventions:'',
    goalAchievement:'',
    symptomFunctionChange:'',
    changeEvidence:'',
    initialCurrentComparison:'',
    remaining:'',
    relapseRisk:'',
    protectiveFactors:'',
    terminationSuitability:'',
    recommendation:'',
    followUp:'',
    restartCriteria:'',
    clientFeedback:'',
    finalOpinion:'',
    recoveryCompass:{
      todayUnderstanding:'',
      strength:'',
      recoveryResource:'',
      smallAction:'',
      returnSignal:''
    },
    reviewed:false,
    reviewedAt:'',
    completedAt:'',
    aiGeneratedAt:'',
    aiModel:'',
    promptVersion:''
  });
}

function saveTerminationRecord(reservationId){
  const r=state.reservations.find(x=>String(x.id)===String(reservationId));
  if(!r)return;

  const current=getTerminationRecord(reservationId);
  const value=id=>String(document.getElementById(id)?.value||'').trim();

  const record={
    ...current,
    reason:value(`term-reason-${reservationId}`),
    caseOverview:value(`term-overview-${reservationId}`),
    counselingProcess:value(`term-process-${reservationId}`),
    majorInterventions:value(`term-interventions-${reservationId}`),
    goalAchievement:value(`term-goal-${reservationId}`),
    symptomFunctionChange:value(`term-function-${reservationId}`),
    changeEvidence:value(`term-evidence-${reservationId}`),
    initialCurrentComparison:value(`term-comparison-${reservationId}`),
    remaining:value(`term-remaining-${reservationId}`),
    relapseRisk:value(`term-relapse-${reservationId}`),
    protectiveFactors:value(`term-protective-${reservationId}`),
    terminationSuitability:value(`term-suitability-${reservationId}`),
    recommendation:value(`term-recommendation-${reservationId}`),
    followUp:value(`term-followup-${reservationId}`),
    restartCriteria:value(`term-restart-${reservationId}`),
    clientFeedback:value(`term-feedback-${reservationId}`),
    finalOpinion:value(`term-opinion-${reservationId}`),
    recoveryCompass:{
      todayUnderstanding:value(`term-compass-understanding-${reservationId}`),
      strength:value(`term-compass-strength-${reservationId}`),
      recoveryResource:value(`term-compass-resource-${reservationId}`),
      smallAction:value(`term-compass-action-${reservationId}`),
      returnSignal:value(`term-compass-signal-${reservationId}`)
    },
    reviewed:true,
    reviewedAt:new Date().toISOString(),
    completedAt:new Date().toLocaleString('ko-KR')
  };

  save(terminationKey(reservationId),record);

  if(normalizeStatus(r.status)!=='종결'){
    updateReservation(reservationId,{
      status:'종결',
      closedAt:new Date().toLocaleString('ko-KR')
    });
  }

  alert('사례종결평가 검토본이 저장되었습니다.');
  render();
}

async function generateTerminationSummary(reservationId){
  const r=state.reservations.find(x=>String(x.id)===String(reservationId));
  if(!r)return;

  const caseId=caseIdFromReservation(r);
  const allSessions=load('modumam_case_sessions_'+caseId,[]);
  const reviewedSessions=allSessions.filter(x=>x.reviewStatus==='상담자 검토 완료');
  const formulation=load('modumam_case_formulation_'+caseId,{});
  const counselingPlan=typeof counselingPlanForCase==='function'?counselingPlanForCase(caseId):{};
  const clinicalCaseReport=typeof clinicalCaseReportForCase==='function'?clinicalCaseReportForCase(caseId):{};
  const reports=state.reports.filter(x=>
    String(x.reservationId||'')===String(r.id)||
    String(x.clientName||'').trim()===String(r.name||'').trim()
  );
  const intake=findIntake(r);

  if(!reviewedSessions.length&&!reports.length&&!intake){
    alert('사례종결평가에 사용할 검토 완료 회기기록·보고서·초기자료가 없습니다.');
    return;
  }

  state.terminationDraftLoading[reservationId]=true;
  render();

  try{
    const response=await fetch('/.netlify/functions/termination-summary',{
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({
        clientName:r.name,
        program:programBaseName(r.program),
        counselingMethod:r.type,
        currentStatus:normalizeStatus(r.status),
        tests:requestedTests(r),
        intakeSummary:intake?.summary||intake?.concern||'',
        intakeRaw:intake||{},
        formulation,
        counselingPlan,
        clinicalCaseReport,
        reportSummary:reports.map(x=>({
          title:x.title,
          summary:x.summary,
          coreSummary:x.coreSummary,
          mindProfile:x.mindProfile,
          emotionState:x.emotionState,
          thinkingRelationship:x.thinkingRelationship,
          stressDaily:x.stressDaily,
          strength:x.strength,
          caution:x.caution,
          plan:x.plan
        })),
        sessions:reviewedSessions.map(x=>({
          date:x.date,
          sessionNumber:x.sessionNumber,
          reason:x.reason,
          goal:x.goal,
          content:x.content,
          result:x.result||x.change,
          task:x.task,
          next:x.next,
          reviewStatus:x.reviewStatus
        })),
        existing:getTerminationRecord(reservationId)
      })
    });

    const data=await response.json().catch(()=>({}));
    if(!response.ok||!data.termination){
      throw new Error(data.error||'AI 사례종결평가 생성에 실패했습니다.');
    }

    save(terminationKey(reservationId),{
      ...getTerminationRecord(reservationId),
      ...data.termination,
      aiGeneratedAt:new Date().toISOString(),
      aiModel:data.model||'',
      promptVersion:data.promptVersion||'',
      reviewed:false
    });

    alert('AI 사례종결평가 초안이 생성되었습니다. 상담자가 사실관계와 임상 판단을 검토해 주세요.');
  }catch(error){
    console.error('[MML TERMINATION V21]',error);
    alert(error.message||'AI 사례종결평가 생성 중 오류가 발생했습니다.');
  }finally{
    state.terminationDraftLoading[reservationId]=false;
    render();
  }
}

function printTerminationRecord(reservationId){
  const r=state.reservations.find(x=>String(x.id)===String(reservationId));
  if(!r)return;

  const t=getTerminationRecord(reservationId);
  if(!t.aiGeneratedAt&&!t.reviewed){
    alert('저장된 사례종결평가가 없습니다.');
    return;
  }

  const safe=value=>String(value??'')
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;').replace(/'/g,'&#039;');
  const nl=value=>safe(value).replace(/\n/g,'<br>');
  const row=(title,value)=>value?`<section><h2>${safe(title)}</h2><div>${nl(value)}</div></section>`:'';
  const compass=t.recoveryCompass||{};

  const w=openPrintWindow('','_blank','width=960,height=900');
  if(!w){
    alert('팝업이 차단되어 있습니다. 브라우저에서 팝업을 허용해 주세요.');
    return;
  }

  w.document.write(`<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8">
<title>${safe(r.name)} 사례종결평가</title>
<style>
@page{size:A4;margin:16mm}
*{box-sizing:border-box}
body{margin:0;font-family:"Pretendard","Apple SD Gothic Neo",Arial,sans-serif;color:#0f172a}
.page{max-width:794px;margin:0 auto}
header{border-bottom:3px solid #047857;padding-bottom:18px;margin-bottom:20px}
.brand{font-size:11px;font-weight:900;letter-spacing:.08em;color:#047857}
h1{font-size:28px;margin:7px 0 4px}
.meta{font-size:12px;color:#64748b;line-height:1.7}
section{break-inside:avoid;border:1px solid #e2e8f0;border-radius:12px;padding:16px 18px;margin-bottom:12px}
section h2{font-size:14px;margin:0 0 9px;color:#047857}
section div{font-size:13px;line-height:1.8}
.compass{display:grid;grid-template-columns:1fr 1fr;gap:10px}
.compass article{break-inside:avoid;border:1px solid #a7f3d0;background:#ecfdf5;border-radius:12px;padding:14px}
.compass b{display:block;font-size:12px;color:#047857;margin-bottom:6px}
.compass p{font-size:12px;line-height:1.7;margin:0}
.notice{margin-top:18px;border-top:1px solid #cbd5e1;padding-top:12px;font-size:10px;color:#64748b}
.no-print{position:fixed;right:18px;top:18px}
.no-print button{border:0;border-radius:10px;background:#047857;color:white;padding:10px 16px;font-weight:800}
@media print{.no-print{display:none}.page{max-width:none}}
</style>
</head>
<body>
<div class="no-print"><button onclick="window.print()">PDF 저장 / 인쇄</button></div>
<div class="page">
<header>
<div class="brand">MODUMAM-LAB · CASE TERMINATION EVALUATION</div>
<h1>상담 사례종결평가 및 종결보고서</h1>
<div class="meta">
내담자: ${safe(r.name||'내담자')} · 사례번호: ${safe(caseIdFromReservation(r))}<br>
프로그램: ${safe(programBaseName(r.program))} · 상담방식: ${safe(r.type||'')}<br>
작성일시: ${safe(t.completedAt||new Date(t.aiGeneratedAt||Date.now()).toLocaleString('ko-KR'))} · 검토상태: ${t.reviewed?'상담자 검토 완료':'AI 초안'}
</div>
</header>
${row('1. 종결 사유',t.reason)}
${row('2. 사례개요',t.caseOverview)}
${row('3. 상담 진행과정',t.counselingProcess)}
${row('4. 주요 개입',t.majorInterventions)}
${row('5. 상담목표 달성 평가',t.goalAchievement)}
${row('6. 증상 및 기능 변화',t.symptomFunctionChange)}
${row('7. 변화의 근거',t.changeEvidence)}
${row('8. 초기 상태와 현재 상태 비교',t.initialCurrentComparison)}
${row('9. 남아 있는 어려움',t.remaining)}
${row('10. 재발 위험 및 주의 신호',t.relapseRisk)}
${row('11. 보호요인과 회복자원',t.protectiveFactors)}
${row('12. 종결 적절성 평가',t.terminationSuitability)}
${row('13. 향후 권고',t.recommendation)}
${row('14. 사후관리 계획',t.followUp)}
${row('15. 상담 재개 기준',t.restartCriteria)}
${row('16. 내담자 종결 피드백',t.clientFeedback)}
${row('17. 종결 소견',t.finalOpinion)}
<section>
<h2>회복 나침반</h2>
<div class="compass">
<article><b>상담을 통해 이해한 핵심</b><p>${nl(compass.todayUnderstanding||'')}</p></article>
<article><b>확인된 강점</b><p>${nl(compass.strength||'')}</p></article>
<article><b>회복자원</b><p>${nl(compass.recoveryResource||'')}</p></article>
<article><b>이어갈 작은 행동</b><p>${nl(compass.smallAction||'')}</p></article>
<article><b>다시 도움을 요청할 신호</b><p>${nl(compass.returnSignal||'')}</p></article>
</div>
</section>
<div class="notice">본 문서는 제공된 자료를 바탕으로 작성된 상담자 내부 임상 문서입니다. AI 초안은 상담자의 검토와 수정 후 사용해야 하며, 위험도와 종결 적절성은 상담자의 직접 평가를 우선합니다.</div>
</div>
</body>
</html>`);
  w.document.close();
  w.focus();
}


function counselingJournalClientInfo(reservation){
  const r=reservation||{};
  const a=r.applicationForm||{};
  return [
    `성명: ${r.name||''}`,
    `생년월일: ${a.birth||''}`,
    `연락처: ${r.phone||''}`,
    `이메일: ${a.email||''}`,
    `소속/직업군: ${a.clientType||''}`,
    `상담 프로그램: ${programBaseName(r.program||'')}`,
    `상담 방식: ${r.type||r.method||r.counselingMethod||''}`,
    `이전 상담/치료/검사 경험: ${a.counselingHistory||''}`,
    `복용 중인 약: ${a.medication||''}`,
    `진단/치료 중인 질환: ${a.diagnosis||''}`
  ].filter(x=>!/:\s*$/.test(x)).join('\n');
}
function counselingJournalAssessmentAnalyses(reservation){
  const r=reservation||{};
  const norm=v=>String(v||'').trim().replace(/\s+/g,' ');
  const digits=v=>String(v||'').replace(/\D/g,'');
  const name=norm(r.name||r.clientName||r.applicationForm?.name||'');
  const phone=digits(r.phone||r.applicationForm?.phone||'');
  const email=norm(r.email||r.userEmail||r.applicationForm?.email||'').toLowerCase();
  const ids=[r.clientId,r.memberId,r.userId,r.applicationForm?.clientId,r.applicationForm?.memberId,r.applicationForm?.userId].map(norm).filter(Boolean);
  const sameClient=row=>{
    if(!row)return false;
    const rr=row.reservation||{};
    const rowName=norm(row.clientName||row.name||rr.name||row.applicationForm?.name||'');
    const rowPhone=digits(row.phone||rr.phone||row.applicationForm?.phone||'');
    const rowEmail=norm(row.email||row.userEmail||rr.email||row.applicationForm?.email||'').toLowerCase();
    const rowIds=[row.clientId,row.memberId,row.userId,rr.clientId,rr.memberId,rr.userId].map(norm).filter(Boolean);
    return Boolean(
      (name&&rowName&&name===rowName) ||
      (phone&&rowPhone&&phone===rowPhone) ||
      (email&&rowEmail&&email===rowEmail) ||
      (ids.length&&rowIds.some(id=>ids.includes(id)))
    );
  };

  const linkedReservationIds=new Set([String(r.id||'')].filter(Boolean));
  (state.reservations||[]).forEach(row=>{if(sameClient(row)&&row.id!=null)linkedReservationIds.add(String(row.id));});

  const results=[];
  const pushResult=(row,source,record)=>{
    if(!row)return;
    const reservationId=row.reservationId||record?.reservationId||'';
    if(reservationId)linkedReservationIds.add(String(reservationId));
    results.push({...row,
      reservationId,
      clientName:row.clientName||record?.clientName||name,
      phone:row.phone||record?.phone||phone,
      _journalSource:source
    });
  };

  // 1. 심리평가센터 임상 저장소: 검사분석과 발행/저장 보고서를 모두 읽습니다.
  try{
    const store=window.MMLClinicalAssessmentStore;
    if(store){
      let records=[];
      if(typeof store.recordsForClient==='function'&&(name||phone))records.push(...(store.recordsForClient(name,phone)||[]));
      if(typeof store.getRecord==='function')linkedReservationIds.forEach(id=>{const rec=store.getRecord(id);if(rec)records.push(rec);});
      if(typeof store.read==='function')records.push(...(store.read()||[]).filter(rec=>linkedReservationIds.has(String(rec.reservationId||''))||sameClient(rec)));
      const seenRec=new Set();
      records.filter(rec=>{const k=String(rec?.reservationId||''); if(!k||seenRec.has(k))return false; seenRec.add(k); return true;}).forEach(rec=>{
        (rec.tests||[]).forEach(test=>pushResult(test,'clinical-assessment-test',rec));
        (rec.issuedReports||[]).forEach(report=>pushResult(report,'clinical-assessment-report',rec));
        if(rec.integratedReport)pushResult(rec.integratedReport,'clinical-integrated-report',rec);
        if(rec.masterReport)pushResult({...rec.masterReport,testType:rec.masterReport.testType||'종합 심리평가'},'clinical-master-report',rec);
      });
    }
  }catch(e){console.warn('[MML] 상담일지 임상 검사 저장소 조회 실패',e);}

  // 2. 현재 런타임/localStorage 검사분석
  let localAnalyses=[];
  try{localAnalyses=JSON.parse(localStorage.getItem('modumam_assessment_analyses')||'[]')||[];}catch(_){localAnalyses=[];}
  [...(state.assessmentAnalyses||[]),...(Array.isArray(localAnalyses)?localAnalyses:[])].forEach(a=>{
    if(linkedReservationIds.has(String(a.reservationId||''))||sameClient(a))pushResult(a,'assessment-analysis');
  });

  // 3. 심리평가센터에서 저장한 개별/종합 보고서도 직접 조회합니다.
  let localReports=[];
  try{localReports=JSON.parse(localStorage.getItem('modumam_reports')||'[]')||[];}catch(_){localReports=[];}
  [...(state.reports||[]),...(Array.isArray(localReports)?localReports:[])].forEach(report=>{
    if(linkedReservationIds.has(String(report.reservationId||''))||sameClient(report))pushResult(report,'assessment-report');
  });

  // 4. 검사결과 업로드 메타데이터. 분석/보고서가 아직 없어도 파일 등록 사실과 요약을 표시합니다.
  let localUploads=[];
  try{localUploads=JSON.parse(localStorage.getItem('modumam_test_result_uploads')||'[]')||[];}catch(_){localUploads=[];}
  [...(state.resultUploads||[]),...(Array.isArray(localUploads)?localUploads:[])].forEach(u=>{
    if(linkedReservationIds.has(String(u.reservationId||''))||sameClient(u))pushResult({
      ...u,
      testType:u.testType||u.testName||'심리검사',
      sourceSummary:u.summary||u.sourceSummary||'심리평가센터에 검사결과 파일이 등록되어 있습니다.',
      status:u.status||'검사결과 파일 등록'
    },'result-upload');
  });

  // 소스별 중복 제거: 같은 분석/보고서 id 또는 같은 예약+검사+핵심내용은 하나만 유지
  const seen=new Set();
  return results.filter(a=>{
    const key=String(a.id||`${a._journalSource}|${a.reservationId||''}|${a.testType||a.testName||a.title||''}|${a.fileName||''}|${a.coreFindings||a.summary||a.sourceSummary||''}`);
    if(seen.has(key))return false;
    seen.add(key);return true;
  });
}
function counselingJournalAssessmentText(value){
  if(value==null)return '';
  if(Array.isArray(value))return value.map(counselingJournalAssessmentText).filter(Boolean).join('\n');
  if(typeof value==='object'){
    const preferred=['text','value','summary','overview','interpretation','finding','findings','content','description','message','result','analysis'];
    for(const key of preferred){
      const text=counselingJournalAssessmentText(value[key]);
      if(text)return text;
    }
    return Object.entries(value)
      .filter(([key])=>!['id','reservationId','clientId','memberId','userId','createdAt','updatedAt','version'].includes(key))
      .map(([,val])=>counselingJournalAssessmentText(val)).filter(Boolean).join('\n');
  }
  const text=String(value||'')
    .replace(/<br\s*\/?>/gi,'\n')
    .replace(/<\/p>|<\/div>|<\/li>|<\/h[1-6]>/gi,'\n')
    .replace(/<[^>]+>/g,' ')
    .replace(/&nbsp;/gi,' ')
    .replace(/&amp;/gi,'&')
    .replace(/&lt;/gi,'<')
    .replace(/&gt;/gi,'>')
    .replace(/\r/g,'')
    .replace(/[ \t]+\n/g,'\n')
    .replace(/\n{3,}/g,'\n\n')
    .replace(/[ \t]{2,}/g,' ')
    .trim();
  return text;
}
function counselingJournalFirstAssessmentText(...values){
  for(const value of values){
    const text=counselingJournalAssessmentText(value);
    if(text)return text;
  }
  return '';
}
function counselingJournalAssessmentRawFactsText(a){
  const row=a||{};
  const raw=row.rawFacts||row.extractedFacts||row.content?.assessmentResult?.rawFacts||row.analysisSnapshot?.rawFacts||{};
  const labels={
    validityFacts:'타당도/응답 품질',scoreFacts:'주요 점수',profileFacts:'프로파일',visibleTextFacts:'결과지 확인내용',missingOrUnclear:'확인 필요 항목',sourceLines:'결과지 근거'
  };
  const parts=[];
  Object.entries(labels).forEach(([key,label])=>{
    const text=counselingJournalAssessmentText(raw?.[key]);
    if(text)parts.push(`${label}: ${text}`);
  });
  return parts.join('\n');
}
function counselingJournalAssessmentGenericText(a){
  const row=a||{};
  const skip=new Set(['id','reservationId','clientId','memberId','userId','phone','email','fileName','mimeType','storageKey','createdAt','updatedAt','uploadedAt','model','version','schemaVersion','_journalSource','visibleToClient','reviewed','needsReview','approved','approvedForClient','clientVisible','published']);
  const preferredKeys=['sourceSummary','validity','coreFindings','strengths','vulnerabilities','helpfulDirections','counselingQuestions','caseHypotheses','cautions','emotionalPattern','thinkingPattern','relationshipPattern','stressPattern','dailyMeaning','summary','interpretation','professionalSummary','reportText','body'];
  const parts=[];
  const seen=new Set();
  const add=(label,value)=>{
    const text=counselingJournalAssessmentText(value);
    if(!text||seen.has(text))return;
    seen.add(text);parts.push(label?`${label}: ${text}`:text);
  };
  preferredKeys.forEach(key=>add('',row[key]));
  add('',counselingJournalAssessmentRawFactsText(row));
  if(!parts.length){
    Object.entries(row).forEach(([key,value])=>{
      if(skip.has(key)||key.startsWith('_'))return;
      if(typeof value==='function')return;
      const text=counselingJournalAssessmentText(value);
      if(text&&text.length>=4)add(key,text);
    });
  }
  return parts.join('\n\n');
}
function counselingJournalAssessmentDetail(a){
  const row=a||{};
  const snap=row.analysisSnapshot||{};
  const result=row.assessmentResult||row.result||row.content?.assessmentResult||row.content?.result||{};
  const client=row.clientReport||snap.clientReport||result.clientReport||{};
  const counselor=row.counselorReport||snap.counselorReport||result.counselorReport||{};
  const sections=row.sections||row.reportSections||result.sections||{};
  const master=row.masterReport||result.masterReport||{};
  const generated=master.reportGenerationData||{};
  const shared=generated.shared||{};
  const generatedClient=generated.client||{};
  const generatedCounselor=generated.counselor||{};

  const core=counselingJournalFirstAssessmentText(
    row.coreFindings,row.summary,row.sourceSummary,row.resultSummary,row.interpretation,row.findings,
    snap.coreFindings,snap.summary,snap.sourceSummary,
    result.coreFindings,result.summary,result.sourceSummary,result.interpretation,
    client.overview,client.currentMind,client.coreMind,client.selfUnderstanding,client.summary,
    counselor.coreUnderstanding,counselor.professionalSummary,
    sections.keyMessage,sections.integratedUnderstanding,sections.professionalSummary,sections.evaluationOverview,
    shared.clinicalCurrentState,shared.clinicalConvergence,generatedClient.currentMind,generatedCounselor.professionalSummary,
    master.integratedSummary,master.summary
  );
  const strengths=counselingJournalFirstAssessmentText(
    row.strengths,row.strength,snap.strengths,result.strengths,result.strength,
    client.strengths,client.strengthGuide,client.strengthsResources,
    counselor.protectiveFactors,counselor.strengths,
    sections.strengthsResources,shared.clinicalProtectiveFactors,generatedClient.strengthGuide
  );
  const caution=counselingJournalFirstAssessmentText(
    row.vulnerabilities,row.cautions,row.caution,snap.vulnerabilities,snap.cautions,
    result.vulnerabilities,result.cautions,result.caution,
    client.cautionGuide,client.currentSignals,counselor.riskProtection,counselor.monitoringPoints,
    sections.currentSignals,shared.clinicalVulnerabilities
  );
  const direction=counselingJournalFirstAssessmentText(
    row.helpfulDirections,row.plan,row.recommendations,snap.helpfulDirections,result.helpfulDirections,result.plan,
    client.recoveryGuide,client.recommendations,client.professionalSummary,
    counselor.counselingFocus,counselor.interventionGuide,
    sections.psychologicalSuggestions,sections.professionalSummary,generatedClient.recoveryGuide,generatedCounselor.counselingFocus
  );
  const fallback=counselingJournalFirstAssessmentText(
    row.reportText,row.body,row.content?.text,row.content?.summary,row.approvedReportText,row.approvedReportHtml,
    counselingJournalAssessmentRawFactsText(row),counselingJournalAssessmentGenericText(row)
  );
  return {core:core||fallback,strengths,caution,direction};
}

function counselingJournalAssessmentRichness(row){
  const a=row||{};
  const d=counselingJournalAssessmentDetail(a);
  const text=[d.core,d.strengths,d.caution,d.direction,a.sourceSummary,a.coreFindings,a.summary,a.interpretation].filter(Boolean).join('\n');
  let score=text.length;
  if(a._journalSource==='assessment-analysis')score+=5000;
  if(a._journalSource==='clinical-assessment-test')score+=4000;
  if(a.analysisSnapshot)score+=2500;
  if(a.clientReport||a.counselorReport)score+=2000;
  if(a._journalSource==='result-upload')score-=3000;
  return score;
}
function counselingJournalBestAssessmentRows(reservation){
  const rows=counselingJournalAssessmentAnalyses(reservation);
  const groups=new Map();
  rows.forEach((row,index)=>{
    const label=counselingJournalFirstAssessmentText(row.testType,row.testName,row.assessmentName,row.title,row.name)||`심리검사 ${index+1}`;
    const key=String(label).trim().toLowerCase();
    const prev=groups.get(key);
    if(!prev||counselingJournalAssessmentRichness(row)>counselingJournalAssessmentRichness(prev))groups.set(key,row);
  });
  return [...groups.values()].filter(row=>{
    const d=counselingJournalAssessmentDetail(row);
    return Boolean(d.core||d.strengths||d.caution||d.direction);
  });
}
function counselingJournalCleanSummaryText(value,maxLength=520){
  let text=counselingJournalAssessmentText(value);
  if(!text)return '';
  text=text
    .replace(/<style[\s\S]*?<\/style>/gi,' ')
    .replace(/<script[\s\S]*?<\/script>/gi,' ')
    .split('\n')
    .map(line=>line.trim())
    .filter(line=>{
      if(!line)return false;
      if(/^[@.#][\w-]+\s*\{?/i.test(line))return false;
      if(/^[.#][^ ]+[,{]/.test(line))return false;
      if(/(?:padding|margin|border|background|font-size|font-weight|line-height|display|grid-template|box-shadow|color|height|width|position|overflow|rgba?\(|#[0-9a-f]{3,8})\s*:/i.test(line))return false;
      if((line.match(/[{};]/g)||[]).length>=3 && /[:;]/.test(line))return false;
      return true;
    })
    .join(' ')
    .replace(/\s+/g,' ')
    .trim();
  if(!text)return '';
  // 상담일지에는 전체 보고서가 아니라 핵심 임상정보만 담도록 길이를 제한한다.
  if(text.length>maxLength){
    const cut=text.slice(0,maxLength);
    const last=Math.max(cut.lastIndexOf('. '),cut.lastIndexOf('다. '),cut.lastIndexOf('음. '));
    text=(last>maxLength*0.55?cut.slice(0,last+1):cut).trim()+'…';
  }
  return text;
}
function counselingJournalAssessmentSummaryFromRows(rows){
  const summaries=(rows||[]).map((a,index)=>{
    try{
      const reviewed=Boolean(a.reviewed||a.approved||a.approvedForClient||a.status==='상담자 검토 완료'||a.status==='상담자 승인 완료'||String(a.status||'').includes('승인'));
      const testLabel=counselingJournalCleanSummaryText(counselingJournalFirstAssessmentText(a.testType,a.testName,a.assessmentName,a.title,a.name),80)||`심리검사 ${index+1}`;
      const detail=counselingJournalAssessmentDetail(a);
      const core=counselingJournalCleanSummaryText(detail.core,420);
      const strengths=counselingJournalCleanSummaryText(detail.strengths,240);
      const caution=counselingJournalCleanSummaryText(detail.caution,240);
      const direction=counselingJournalCleanSummaryText(detail.direction,260);
      if(!core&&!strengths&&!caution&&!direction)return '';
      return [
        `【${testLabel}${reviewed?' · 검토완료':''}】`,
        core?`핵심: ${core}`:'',
        strengths?`강점: ${strengths}`:'',
        caution?`유의: ${caution}`:'',
        direction?`상담참고: ${direction}`:''
      ].filter(Boolean).join('\n');
    }catch(error){console.warn('[MML] 상담일지 검사결과 요약 실패',error,a);return '';}
  }).filter(Boolean);
  return summaries.join('\n\n');
}

function counselingJournalAssessmentHighlightHtml(summary){
  const blocks=String(summary||'').split(/\n\s*\n/).map(v=>v.trim()).filter(Boolean);
  if(!blocks.length)return '<p class="text-sm text-slate-400">불러온 검사결과가 없습니다.</p>';
  return blocks.map(block=>{
    const lines=block.split('\n').map(v=>v.trim()).filter(Boolean);
    const title=(lines.shift()||'').replace(/^【|】$/g,'');
    const items=lines.map(line=>{
      const m=line.match(/^(핵심|강점|유의|상담참고):\s*(.*)$/);
      if(!m)return `<p class="mt-2 rounded-lg bg-slate-50 px-3 py-2 text-xs leading-relaxed text-slate-700">${esc(line)}</p>`;
      const kind=m[1], text=m[2];
      const styles={
        '핵심':['bg-amber-50 border-amber-200 text-amber-900','bg-amber-200 text-amber-950','핵심'],
        '강점':['bg-emerald-50 border-emerald-200 text-emerald-900','bg-emerald-200 text-emerald-950','강점·보호요인'],
        '유의':['bg-rose-50 border-rose-200 text-rose-900','bg-rose-200 text-rose-950','유의·위험'],
        '상담참고':['bg-sky-50 border-sky-200 text-sky-900','bg-sky-200 text-sky-950','상담참고']
      }[kind];
      return `<div class="mt-2 rounded-xl border ${styles[0]} px-3 py-2.5"><span class="mr-2 inline-flex rounded-md px-2 py-0.5 text-[10px] font-extrabold ${styles[1]}">${styles[2]}</span><span class="text-xs font-semibold leading-relaxed">${esc(text)}</span></div>`;
    }).join('');
    return `<section class="rounded-xl border border-indigo-100 bg-white p-3"><div class="flex items-center gap-2"><span class="h-2 w-2 rounded-full bg-indigo-500"></span><p class="text-xs font-extrabold text-slate-900">${esc(title)}</p></div>${items}</section>`;
  }).join('<div class="h-3"></div>');
}

function counselingJournalAssessmentSummary(reservation){
  return counselingJournalAssessmentSummaryFromRows(counselingJournalBestAssessmentRows(reservation));
}
function loadCounselingJournalAssessmentResults(caseId,reservationId){
  try{state.assessmentAnalyses=JSON.parse(localStorage.getItem('modumam_assessment_analyses')||'[]')||state.assessmentAnalyses||[];}catch(_){ }
  try{state.resultUploads=JSON.parse(localStorage.getItem('modumam_test_result_uploads')||'[]')||state.resultUploads||[];}catch(_){ }
  try{state.reports=window.MMLReportStore?.loadAll?.()||JSON.parse(localStorage.getItem('modumam_reports')||'[]')||state.reports||[];}catch(_){ }
  const reservation=state.reservations.find(r=>String(r.id)===String(reservationId));
  if(!reservation){alert('예약 정보를 찾지 못했습니다.');return;}
  try{
    window.MMLClinicalAssessmentStore?.syncFromRuntime?.({
      reservationId, reservations:state.reservations||[], analyses:state.assessmentAnalyses||[], reports:state.reports||[],
      reportDrafts:state.assessmentReportDrafts||[], crossAnalyses:state.assessmentCrossAnalyses||[]
    });
  }catch(_){ }
  const rows=counselingJournalBestAssessmentRows(reservation);
  const summary=counselingJournalAssessmentSummaryFromRows(rows);
  const el=document.getElementById(`journal-session-assessment-${caseId}`);
  const preview=document.getElementById(`journal-session-assessment-preview-${caseId}`);
  if(!el){alert('검사결과 입력 영역을 찾지 못했습니다.');return;}
  if(!summary){
    if(preview){preview.classList.remove('hidden');preview.innerHTML='<p class="text-sm font-bold text-rose-700">연결된 검사자료는 있지만 상담일지로 불러올 해석 결과가 없습니다.</p>';}
    alert('검사자료는 확인했지만 저장된 해석 결과 본문을 찾지 못했습니다.');
    return;
  }
  el.value=summary;
  el.dispatchEvent(new Event('input',{bubbles:true}));
  el.dispatchEvent(new Event('change',{bubbles:true}));
  if(preview){
    preview.classList.remove('hidden');
    preview.innerHTML=`<div class="flex items-center justify-between gap-3"><div><p class="text-xs font-extrabold text-indigo-700">중요 검사결과 하이라이트</p><p class="mt-1 text-[10px] text-slate-400">핵심은 노랑, 강점은 초록, 유의사항은 빨강, 상담참고는 파랑으로 표시합니다.</p></div><span class="rounded-full bg-indigo-100 px-2.5 py-1 text-[10px] font-extrabold text-indigo-700">${rows.length}개 검사</span></div><div class="mt-3">${counselingJournalAssessmentHighlightHtml(summary)}</div>`;
  }
}
window.loadCounselingJournalAssessmentResults=loadCounselingJournalAssessmentResults;
function toggleCounselingJournalAssessmentFull(caseId){
  const box=document.getElementById(`journal-session-assessment-full-${caseId}`);
  const btn=document.getElementById(`journal-session-assessment-toggle-${caseId}`);
  if(!box)return;
  const opening=box.classList.contains('hidden');
  box.classList.toggle('hidden',!opening);
  if(btn)btn.textContent=opening?'전체 검사결과 닫기':'전체 검사결과 보기';
}
window.toggleCounselingJournalAssessmentFull=toggleCounselingJournalAssessmentFull;

function counselingJournalRiskLevelMeta(level){
  const value=String(level||'미확인');
  return ({
    '낮음':{label:'🟢 현재 위험단계 · 낮음',className:'border-emerald-200 bg-emerald-50 text-emerald-700'},
    '중간':{label:'🟡 현재 위험단계 · 중간',className:'border-amber-200 bg-amber-50 text-amber-800'},
    '높음':{label:'🟠 현재 위험단계 · 높음',className:'border-orange-200 bg-orange-50 text-orange-800'},
    '긴급':{label:'🔴 현재 위험단계 · 긴급',className:'border-rose-300 bg-rose-100 text-rose-800'},
    '미확인':{label:'⚪ 현재 위험단계 · 미확인',className:'border-slate-200 bg-slate-50 text-slate-600'}
  })[value]||{label:`현재 위험단계 · ${value}`,className:'border-slate-200 bg-slate-50 text-slate-600'};
}
function updateCounselingJournalRiskLevel(caseId){
  const level=document.getElementById(`journal-session-risk-level-${caseId}`)?.value||'미확인';
  const badge=document.getElementById(`journal-session-risk-badge-${caseId}`);
  const statusBox=document.getElementById(`journal-session-risk-status-${caseId}`);
  const detailBox=document.getElementById(`journal-session-risk-detail-${caseId}`);
  if(badge){
    const meta=counselingJournalRiskLevelMeta(level);
    badge.className=`rounded-xl border px-4 py-2.5 text-xs font-extrabold ${meta.className}`;
    badge.textContent=meta.label;
  }
  if(statusBox) statusBox.classList.toggle('hidden',level==='미확인');
  if(detailBox) detailBox.classList.toggle('hidden',level==='미확인');
}
window.updateCounselingJournalRiskLevel=updateCounselingJournalRiskLevel;

function counselingJournalDraftKey(caseId){return 'modumam_journal_session_draft_'+String(caseId||'');}
function captureCounselingJournalDraft(caseId){
  const id=String(caseId||'');
  if(!id)return null;
  const val=suffix=>document.getElementById(`journal-session-${suffix}-${id}`)?.value??'';
  const checked=rid=>Boolean(document.getElementById(rid)?.checked);
  const draft={
    sessionNumber:val('number'), date:val('date'), clientInfo:val('client'), complaint:val('complaint'), motivation:val('motivation'),
    risk:val('risk'), riskLevel:val('risk-level')||'미확인', assessmentResults:val('assessment'), goal:val('goal'), content:val('content'),
    intervention:val('intervention'), result:val('result'), change:val('change'), next:val('next'),
    riskChecks:{suicide:checked(`journal-risk-suicide-${id}`),selfharm:checked(`journal-risk-selfharm-${id}`),harm:checked(`journal-risk-harm-${id}`),abuse:checked(`journal-risk-abuse-${id}`),acute:checked(`journal-risk-acute-${id}`),safety:checked(`journal-risk-safety-${id}`)},
    updatedAt:new Date().toISOString()
  };
  try{localStorage.setItem(counselingJournalDraftKey(id),JSON.stringify(draft));}catch(_){ }
  return draft;
}
function loadCounselingJournalDraft(caseId){try{return JSON.parse(localStorage.getItem(counselingJournalDraftKey(caseId))||'null');}catch(_){return null;}}
function clearCounselingJournalDraft(caseId){try{localStorage.removeItem(counselingJournalDraftKey(caseId));}catch(_){ }}
function restoreCounselingJournalDraft(caseId){
  const id=String(caseId||''); const d=loadCounselingJournalDraft(id); if(!d)return;
  const set=(suffix,value)=>{const el=document.getElementById(`journal-session-${suffix}-${id}`);if(el&&value!==undefined&&value!==null)el.value=String(value);};
  set('number',d.sessionNumber);set('date',d.date);set('client',d.clientInfo);set('complaint',d.complaint);set('motivation',d.motivation);set('risk',d.risk);set('risk-level',d.riskLevel||'미확인');set('assessment',d.assessmentResults);set('goal',d.goal);set('content',d.content);set('intervention',d.intervention);set('result',d.result);set('change',d.change);set('next',d.next);
  const checks=d.riskChecks||{}; const pairs={suicide:'suicide',selfharm:'selfharm',harm:'harm',abuse:'abuse',acute:'acute',safety:'safety'};
  Object.entries(pairs).forEach(([k,suffix])=>{const el=document.getElementById(`journal-risk-${suffix}-${id}`);if(el)el.checked=Boolean(checks[k]);});
  updateCounselingJournalRiskLevel(id);
  const preview=document.getElementById(`journal-session-assessment-preview-${id}`);
  if(preview&&d.assessmentResults){preview.classList.remove('hidden');preview.innerHTML=`<div class="flex items-center justify-between gap-3"><div><p class="text-xs font-extrabold text-indigo-700">중요 검사결과 하이라이트</p><p class="mt-1 text-[10px] text-slate-400">저장 중인 상담일지 초안의 검사결과입니다.</p></div></div><div class="mt-3">${counselingJournalAssessmentHighlightHtml(d.assessmentResults)}</div>`;}
}
function enableCounselingJournalDraftAutosave(caseId){
  const form=document.getElementById(`journal-session-form-${caseId}`); if(!form||form.dataset.draftBound==='1')return;
  form.dataset.draftBound='1';
  let timer=0; const queue=()=>{clearTimeout(timer);timer=setTimeout(()=>captureCounselingJournalDraft(caseId),180);};
  form.addEventListener('input',queue); form.addEventListener('change',queue);
}
function hydrateCounselingJournalDraft(caseId){setTimeout(()=>{restoreCounselingJournalDraft(caseId);enableCounselingJournalDraftAutosave(caseId);},0);}
window.captureCounselingJournalDraft=captureCounselingJournalDraft;
window.restoreCounselingJournalDraft=restoreCounselingJournalDraft;

function startCounselingJournalSession(caseId,reservationId){
  state.selectedJournalCaseId=String(caseId||'');
  state.activeJournalSessionCaseId=String(caseId||'');
  state.activeJournalReservationId=String(reservationId||'');
  const reservation=state.reservations.find(r=>String(r.id)===String(reservationId));
  if(reservation && normalizeStatus(reservation.status)==='상담준비'){
    reservation.status='상담진행';
    reservation.updatedAt=new Date().toLocaleString('ko-KR');
    save('modumam_reservations',state.reservations);
  }
  render();
  hydrateCounselingJournalDraft(caseId);
  setTimeout(()=>document.getElementById(`journal-session-form-${caseId}`)?.scrollIntoView({behavior:'smooth',block:'start'}),50);
}
function cancelCounselingJournalSession(){
  state.activeJournalSessionCaseId='';
  state.activeJournalReservationId='';
  render();
}
function saveCounselingJournalSession(caseId,reservationId){
  const reservation=state.reservations.find(r=>String(r.id)===String(reservationId));
  if(!reservation){alert('예약 정보를 찾지 못했습니다.');return;}
  const sessionNumber=Math.max(1,Number(document.getElementById(`journal-session-number-${caseId}`)?.value)||1);
  const date=String(document.getElementById(`journal-session-date-${caseId}`)?.value||reservation.date||new Date().toISOString().slice(0,10));
  const clientInfo=String(document.getElementById(`journal-session-client-${caseId}`)?.value||'').trim();
  const complaint=String(document.getElementById(`journal-session-complaint-${caseId}`)?.value||'').trim();
  const motivation=String(document.getElementById(`journal-session-motivation-${caseId}`)?.value||'').trim();
  let risk=String(document.getElementById(`journal-session-risk-${caseId}`)?.value||'').trim();
  const riskLevel=String(document.getElementById(`journal-session-risk-level-${caseId}`)?.value||'미확인');
  if(riskLevel==='미확인') risk='';
  let riskChecks=[
    ['자살사고',`journal-risk-suicide-${caseId}`],['자해위험',`journal-risk-selfharm-${caseId}`],['타해위험',`journal-risk-harm-${caseId}`],
    ['학대·폭력',`journal-risk-abuse-${caseId}`],['급성위기',`journal-risk-acute-${caseId}`],['안전계획 필요',`journal-risk-safety-${caseId}`]
  ].filter(([,id])=>document.getElementById(id)?.checked).map(([label])=>label);
  if(riskLevel==='미확인') riskChecks=[];
  const assessmentResults=String(document.getElementById(`journal-session-assessment-${caseId}`)?.value||'').trim();
  const goal=String(document.getElementById(`journal-session-goal-${caseId}`)?.value||'').trim();
  const content=String(document.getElementById(`journal-session-content-${caseId}`)?.value||'').trim();
  const emotion=''; // 주요 이야기·정서는 상담내용으로 통합
  const intervention=String(document.getElementById(`journal-session-intervention-${caseId}`)?.value||'').trim();
  const result=String(document.getElementById(`journal-session-result-${caseId}`)?.value||'').trim();
  const change=String(document.getElementById(`journal-session-change-${caseId}`)?.value||'').trim();
  const next=String(document.getElementById(`journal-session-next-${caseId}`)?.value||'').trim();
  if(!content){alert('상담내용을 입력해 주세요.');document.getElementById(`journal-session-content-${caseId}`)?.focus();return;}
  const key='modumam_case_sessions_'+caseId;
  const sessions=load(key,[]);
  sessions.unshift({
    id:Date.now(), reservationId:String(reservationId), sessionNumber, date,
    counselingMethod:reservation.type||reservation.method||reservation.counselingMethod||'',
    clientInfo,
    complaint:complaint||reservation.applicationForm?.concern||reservation.concern||'',
    reason:complaint||reservation.applicationForm?.concern||reservation.concern||'',
    counselingMotivation:motivation, motivation,
    risk, riskItems:risk, riskLevel, riskChecks, assessmentResults,
    goal, content, emotion, intervention, result, change, next,
    reviewStatus:'상담자 수정', sourceTypes:['상담일지 직접작성',...(assessmentResults?['심리평가센터 검사결과']:[])], aiGenerated:false,
    createdAt:new Date().toLocaleString('ko-KR'), updatedAt:new Date().toISOString()
  });
  save(key,sessions);
  if(normalizeStatus(reservation.status)==='상담준비') reservation.status='상담진행';
  reservation.updatedAt=new Date().toLocaleString('ko-KR');
  save('modumam_reservations',state.reservations);
  clearCounselingJournalDraft(caseId);
  state.activeJournalSessionCaseId='';
  state.activeJournalReservationId='';
  alert(`${sessionNumber}회기 상담내용을 저장했습니다.`);
  render();
}
window.startCounselingJournalSession=startCounselingJournalSession;
window.cancelCounselingJournalSession=cancelCounselingJournalSession;
window.saveCounselingJournalSession=saveCounselingJournalSession;

function applyCounselingAidToJournal(caseId){
  const aid=load('modumam_counseling_aid_'+caseId,null);
  if(!aid){alert('먼저 AI 상담지원을 생성해 주세요.');return;}
  // AI 반영 전에 사용자가 직접 입력한 주호소·상담내용 등 전체 폼을 먼저 보존합니다.
  if(typeof captureCounselingJournalDraft==='function') captureCounselingJournalDraft(caseId);
  const setValue=(id,value,append=false)=>{const el=document.getElementById(id);if(!el||!value)return;el.value=append&&el.value.trim()?el.value.trim()+'\n\n'+value:value;el.dispatchEvent(new Event('input',{bubbles:true}));};
  setValue('journal-session-intervention-'+caseId,aid.intervention||'',false);
  setValue('journal-session-result-'+caseId,aid.sessionResult||'',false);
  setValue('journal-session-change-'+caseId,aid.clientChange||'',false);
  setValue('journal-session-next-'+caseId,aid.nextPlan||'',false);
  if(aid.caution && (document.getElementById('journal-session-risk-level-'+caseId)?.value||'미확인')!=='미확인') setValue('journal-session-risk-'+caseId,aid.caution,true);
  // 반영 직후 동기식으로 전체 폼을 다시 저장해 이후 render에서도 입력값이 유지되게 합니다.
  if(typeof captureCounselingJournalDraft==='function') captureCounselingJournalDraft(caseId);
  alert('AI가 상담내용을 바탕으로 상담자의 개입·상담결과·내담자의 변화·다음 회기 계획을 상담일지에 반영했습니다. 입력한 내담자 정보·주호소·상담동기·상담내용은 그대로 유지됩니다.');
}
window.applyCounselingAidToJournal=applyCounselingAidToJournal;

function selectCounselingJournalCase(caseId){
  state.selectedJournalCaseId=String(caseId||'');
  state.counselingJournalTab='sessions';
  render();
}
function closeCounselingJournalCase(){
  state.selectedJournalCaseId='';
  render();
}
function counselingJournalView(){
  const tab=state.counselingJournalTab||'sessions';
  if(state.activeJournalSessionCaseId) setTimeout(()=>hydrateCounselingJournalDraft(String(state.activeJournalSessionCaseId)),0);
  const allCases=buildCases();
  const cases=allCases.filter(c=>{
    const r=c.res||{};
    const status=normalizeStatus(r.status);
    if(['예약취소','취소요청'].includes(status))return false;
    const method=String(r.type||r.method||r.counselingMethod||'');
    const program=String(r.program||'');
    return /상담|대면|비대면|화상|Zoom|AI/i.test(method)||/상담|마음이음|해석/i.test(program);
  });
  const selectedCaseId=String(state.selectedJournalCaseId||'');
  const activeCases=selectedCaseId?cases.filter(c=>String(c.caseId)===selectedCaseId):[];
  if(tab==='termination'){
    const rows=state.reservations.filter(r=>['상담완료','종결'].includes(normalizeStatus(r.status)));
    return layout(`<div class="space-y-6"><section class="rounded-[2rem] bg-gradient-to-r from-slate-950 to-emerald-950 p-6 text-white shadow-xl sm:p-8"><p class="text-xs font-extrabold text-emerald-300">COUNSELING</p><h2 class="mt-2 text-2xl font-extrabold">상담기록</h2><p class="mt-2 text-sm text-slate-300">상담기록을 관리합니다.</p><div class="mt-5 flex gap-2"><button onclick="setCounselingJournalTab('sessions')" class="rounded-xl bg-white/10 px-4 py-2 text-xs font-extrabold">회기기록</button><button onclick="setCounselingJournalTab('termination')" class="rounded-xl bg-white px-4 py-2 text-xs font-extrabold text-slate-950">종결기록</button></div></section><section class="rounded-[2rem] border border-slate-100 bg-white p-6 shadow-sm"><div class="mb-5 flex items-center justify-between"><div><p class="text-xs font-extrabold text-rose-600">TERMINATION RECORD</p><h3 class="mt-1 text-xl font-extrabold">종결기록</h3></div><button onclick="setMenu('termination')" class="rounded-xl bg-slate-900 px-4 py-2 text-xs font-extrabold text-white">종결기록 작성·확인</button></div><div class="space-y-3">${rows.length?rows.map(r=>`<button onclick="setMenu('termination')" class="w-full rounded-2xl border border-slate-100 bg-slate-50 p-4 text-left"><b>${esc(r.name)}님</b> · ${esc(r.date||'')}</button>`).join(''):empty('종결기록 대상이 없습니다.')}</div></section></div>`);
  }
  return layout(`<div class="space-y-6"><section class="rounded-[2rem] bg-gradient-to-r from-slate-950 to-emerald-950 p-6 text-white shadow-xl sm:p-8"><p class="text-xs font-extrabold text-emerald-300">COUNSELING JOURNAL</p><h2 class="mt-2 text-2xl font-extrabold">상담일지</h2><p class="mt-2 text-sm text-slate-300">예약된 상담 내담자를 불러와 상담을 시작하고, 기존 회기기록·축어록·AI 회기정리·검토·PDF 기능을 한 곳에서 관리합니다.</p><div class="mt-5 flex gap-2"><button onclick="setCounselingJournalTab('sessions')" class="rounded-xl bg-white px-4 py-2 text-xs font-extrabold text-slate-950">회기기록</button><button onclick="setCounselingJournalTab('termination')" class="rounded-xl bg-white/10 px-4 py-2 text-xs font-extrabold">종결기록</button></div></section>
  <section class="rounded-[2rem] border border-slate-100 bg-white p-5 shadow-sm sm:p-6"><div class="flex items-center justify-between gap-3"><div><p class="text-xs font-extrabold text-emerald-600">예약 내담자</p><h3 class="mt-1 text-xl font-extrabold">상담할 내담자 선택</h3><p class="mt-1 text-xs text-slate-500">예약관리의 상담예약을 불러옵니다. 내담자를 선택하면 아래에 기존 상담기록 작업공간이 열립니다.</p></div><span class="rounded-full bg-emerald-50 px-3 py-1 text-xs font-extrabold text-emerald-700">${cases.length}명</span></div><div class="mt-4 grid grid-cols-1 gap-3 lg:grid-cols-2">${cases.length?cases.map(c=>`<div class="rounded-2xl border ${String(c.caseId)===selectedCaseId?'border-emerald-400 bg-emerald-50':'border-slate-200 bg-slate-50'} p-4 hover:border-emerald-300"><div class="flex items-start justify-between gap-3"><button type="button" onclick="selectCounselingJournalCase('${c.caseId}')" class="min-w-0 flex-1 text-left"><p class="text-base font-extrabold text-slate-900">${esc(c.res.name)}님</p><p class="mt-1 text-xs text-slate-500">${esc(c.res.date||'일정 미정')} ${esc(c.res.time||'')} · ${esc(c.res.type||'상담방법 미정')}</p><p class="mt-1 text-xs text-slate-400">${esc(programBaseName(c.res.program)||'프로그램 미정')} · 저장된 회기 ${c.sessions.length}건</p></button><button type="button" onclick="startCounselingJournalSession('${c.caseId}','${esc(String(c.res.id))}')" class="shrink-0 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-extrabold text-white hover:bg-emerald-700">상담 시작</button></div></div>`).join(''):empty('예약된 상담 내담자가 없습니다.')}</div></section>
  ${selectedCaseId?`<div class="flex items-center justify-between gap-3"><p class="text-sm font-extrabold text-slate-700">선택한 내담자의 상담기록</p><button type="button" onclick="closeCounselingJournalCase()" class="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-extrabold">선택 닫기</button></div>`:''}
  ${activeCases.map(c=>`<section class="rounded-[2rem] border border-slate-100 bg-white p-5 shadow-sm sm:p-6"><div class="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between"><div><h3 class="text-xl font-extrabold">${esc(c.res.name)}님</h3><p class="mt-1 text-sm text-slate-500">${esc(programBaseName(c.res.program))} · ${esc(c.res.type||'')} · ${esc(c.res.date||'')} ${esc(c.res.time||'')}</p></div><span class="rounded-full bg-emerald-50 px-3 py-1 text-xs font-extrabold text-emerald-700">저장 ${c.sessions.length}건</span></div>
    ${String(state.activeJournalSessionCaseId||'')===String(c.caseId)?`<div id="journal-session-form-${c.caseId}" class="mt-5 rounded-[1.75rem] border-2 border-emerald-200 bg-emerald-50/40 p-5 sm:p-6"><div class="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between"><div><p class="text-xs font-extrabold text-emerald-700">COUNSELING SESSION</p><h4 class="mt-1 text-xl font-extrabold text-slate-950">상담내용 입력</h4><p class="mt-1 text-xs text-slate-500">상담 중 내용을 직접 기록한 뒤 회기기록으로 저장합니다.</p></div><button type="button" onclick="cancelCounselingJournalSession()" class="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-extrabold">작성 닫기</button></div><div class="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-[120px_180px_1fr] sm:items-end"><label class="text-xs font-extrabold text-slate-600">회기수<input id="journal-session-number-${c.caseId}" type="number" min="1" value="${c.sessions.length+1}" class="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm"></label><label class="text-xs font-extrabold text-slate-600">상담일<input id="journal-session-date-${c.caseId}" type="date" value="${esc(c.res.date||new Date().toISOString().slice(0,10))}" class="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm"></label><button type="button" onclick="generateCounselingAid('${c.caseId}','support')" ${state.counselingAidLoading?.[c.caseId]?'disabled':''} class="h-[46px] rounded-xl bg-purple-600 px-5 text-xs font-extrabold text-white disabled:opacity-50">${state.counselingAidLoading?.[c.caseId]?'AI 분석 중...':'AI 상담보조 생성'}</button></div><div class="mt-5 grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1.35fr)_minmax(360px,.65fr)] xl:items-start"><div class="min-w-0"><div class="mt-5 rounded-2xl border border-slate-200 bg-white p-4"><div class="flex items-center justify-between gap-3"><div><p class="text-xs font-extrabold text-slate-700">내담자 정보</p><p class="mt-1 text-[11px] text-slate-400">예약·상담신청서 정보를 자동으로 불러왔습니다. 필요하면 수정할 수 있습니다.</p></div></div><textarea id="journal-session-client-${c.caseId}" rows="6" class="mt-3 w-full resize-y rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm leading-relaxed">${esc(counselingJournalClientInfo(c.res))}</textarea></div><label class="mt-4 block text-xs font-extrabold text-slate-600">주호소문제<textarea id="journal-session-complaint-${c.caseId}" rows="4" placeholder="현재 가장 힘든 점과 상담에서 다루고 싶은 핵심 문제" class="mt-2 w-full resize-y rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm leading-relaxed">${esc(c.res.applicationForm?.concern||c.res.concern||'')}</textarea></label><label class="mt-4 block text-xs font-extrabold text-slate-600">상담동기<textarea id="journal-session-motivation-${c.caseId}" rows="4" placeholder="상담을 신청하게 된 계기, 기대, 변화 의지, 주변 권유 여부 등을 기록하세요." class="mt-2 w-full resize-y rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm leading-relaxed">${esc(c.res.applicationForm?.motivation||c.res.motivation||'')}</textarea></label><div class="mt-4 rounded-2xl border border-rose-200 bg-rose-50/40 p-4"><div class="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between"><label class="text-xs font-extrabold text-rose-700">현재 위험단계<select id="journal-session-risk-level-${c.caseId}" onchange="updateCounselingJournalRiskLevel('${c.caseId}')" class="mt-2 w-full min-w-[180px] rounded-xl border border-rose-200 bg-white px-4 py-3 text-sm font-extrabold text-slate-800"><option value="미확인" ${(c.sessions?.[0]?.riskLevel||'미확인')==='미확인'?'selected':''}>⚪ 미확인</option><option value="낮음" ${c.sessions?.[0]?.riskLevel==='낮음'?'selected':''}>🟢 낮음</option><option value="중간" ${c.sessions?.[0]?.riskLevel==='중간'?'selected':''}>🟡 중간</option><option value="높음" ${c.sessions?.[0]?.riskLevel==='높음'?'selected':''}>🟠 높음</option><option value="긴급" ${c.sessions?.[0]?.riskLevel==='긴급'?'selected':''}>🔴 긴급</option></select></label><div id="journal-session-risk-badge-${c.caseId}" class="rounded-xl border px-4 py-2.5 text-xs font-extrabold ${counselingJournalRiskLevelMeta(c.sessions?.[0]?.riskLevel||'미확인').className}">${counselingJournalRiskLevelMeta(c.sessions?.[0]?.riskLevel||'미확인').label}</div></div><div id="journal-session-risk-status-${c.caseId}" class="mt-4 ${(c.sessions?.[0]?.riskLevel||'미확인')==='미확인'?'hidden':''}"><p class="text-xs font-extrabold text-rose-700">현재 상태 체크</p><div class="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3"><label class="flex items-center gap-2 rounded-xl border border-rose-100 bg-white px-3 py-2 text-xs font-bold"><input id="journal-risk-suicide-${c.caseId}" type="checkbox">자살사고</label><label class="flex items-center gap-2 rounded-xl border border-rose-100 bg-white px-3 py-2 text-xs font-bold"><input id="journal-risk-selfharm-${c.caseId}" type="checkbox">자해위험</label><label class="flex items-center gap-2 rounded-xl border border-rose-100 bg-white px-3 py-2 text-xs font-bold"><input id="journal-risk-harm-${c.caseId}" type="checkbox">타해위험</label><label class="flex items-center gap-2 rounded-xl border border-rose-100 bg-white px-3 py-2 text-xs font-bold"><input id="journal-risk-abuse-${c.caseId}" type="checkbox">학대·폭력</label><label class="flex items-center gap-2 rounded-xl border border-rose-100 bg-white px-3 py-2 text-xs font-bold"><input id="journal-risk-acute-${c.caseId}" type="checkbox">급성위기</label><label class="flex items-center gap-2 rounded-xl border border-rose-100 bg-white px-3 py-2 text-xs font-bold"><input id="journal-risk-safety-${c.caseId}" type="checkbox">안전계획 필요</label></div></div><div id="journal-session-risk-detail-${c.caseId}" class="${(c.sessions?.[0]?.riskLevel||'미확인')==='미확인'?'hidden':''}"><label class="mt-4 block text-xs font-extrabold text-rose-700">위기항목 상세<textarea id="journal-session-risk-${c.caseId}" rows="4" placeholder="위험의 내용, 빈도, 강도, 계획·수단·의도, 보호요인, 안전조치 등을 기록하세요." class="mt-2 w-full resize-y rounded-xl border border-rose-200 bg-white px-4 py-3 text-sm leading-relaxed">${esc(c.res.applicationForm?.risk||c.res.risk||'')}</textarea></label></div><p class="mt-2 text-[10px] leading-relaxed text-rose-500">위험단계는 상담자가 현재 상태를 직접 확인한 뒤 선택합니다. 긴급 위험 시에는 안전 확보와 즉각적인 전문·응급 지원 연결을 우선합니다.</p></div><div class="mt-4 rounded-2xl border border-indigo-200 bg-indigo-50/40 p-4"><div class="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between"><div><p class="text-xs font-extrabold text-indigo-700">심리평가센터 검사결과</p><p class="mt-1 text-[11px] text-slate-500">같은 예약 내담자의 심리평가센터 검사분석을 회기기록으로 불러옵니다.</p></div><button type="button" onclick="loadCounselingJournalAssessmentResults('${c.caseId}','${esc(String(c.res.id))}')" class="rounded-xl bg-indigo-600 px-4 py-2 text-xs font-extrabold text-white">검사결과 새로고침 (${counselingJournalBestAssessmentRows(c.res).length}개 검사)</button></div><div class="mt-3 flex justify-end"><button type="button" onclick="toggleCounselingJournalAssessmentFull('${c.caseId}')" id="journal-session-assessment-toggle-${c.caseId}" class="rounded-lg border border-indigo-200 bg-white px-3 py-1.5 text-[11px] font-extrabold text-indigo-700">전체 검사결과 보기</button></div><div id="journal-session-assessment-full-${c.caseId}" class="hidden"><textarea id="journal-session-assessment-${c.caseId}" rows="6" placeholder="검사별 핵심결과·강점·유의사항·상담 참고방향이 표시됩니다." class="mt-3 w-full resize-y rounded-xl border border-indigo-200 bg-white px-4 py-3 text-sm leading-relaxed">${esc(counselingJournalAssessmentSummary(c.res))}</textarea></div><div id="journal-session-assessment-preview-${c.caseId}" class="mt-3 rounded-xl border border-indigo-100 bg-indigo-50/30 p-4"><div class="flex items-center justify-between gap-3"><div><p class="text-xs font-extrabold text-indigo-700">중요 검사결과 하이라이트</p><p class="mt-1 text-[10px] text-slate-400">핵심은 노랑, 강점은 초록, 유의사항은 빨강, 상담참고는 파랑으로 표시합니다.</p></div><span class="rounded-full bg-indigo-100 px-2.5 py-1 text-[10px] font-extrabold text-indigo-700">${counselingJournalBestAssessmentRows(c.res).length}개 검사</span></div><div class="mt-3">${counselingJournalAssessmentHighlightHtml(counselingJournalAssessmentSummary(c.res))}</div></div></div><label class="mt-4 block text-xs font-extrabold text-slate-600">상담목표<input id="journal-session-goal-${c.caseId}" placeholder="이번 회기의 상담목표" class="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm"></label><div class="mt-4"><div class="flex flex-wrap items-center justify-between gap-2"><label for="journal-session-content-${c.caseId}" class="text-xs font-extrabold text-slate-600">상담내용 <span class="text-rose-500">*</span></label><button type="button" onclick="generateCounselingSessionSummary('${c.caseId}')" ${state.counselingAidLoading?.[c.caseId]?'disabled':''} class="rounded-xl bg-emerald-600 px-4 py-2 text-xs font-extrabold text-white disabled:opacity-50">${state.counselingAidLoading?.[c.caseId]?'AI 정리 중...':'AI 회기정리 → 자동입력'}</button></div><textarea id="journal-session-content-${c.caseId}" rows="12" placeholder="내담자가 표현한 주요 이야기와 정서, 상담에서 다룬 내용, 주요 질문과 반응, 상담의 핵심 흐름을 기록하세요." class="mt-2 w-full resize-y rounded-xl border border-emerald-300 bg-white px-4 py-3 text-sm leading-relaxed"></textarea><p class="mt-1 text-[10px] text-slate-400">상담내용을 입력한 뒤 AI 회기정리를 누르면 상담자의 개입·상담결과·내담자의 변화·다음 회기 계획이 자동으로 채워집니다.</p></div><label class="mt-4 block text-xs font-extrabold text-slate-600">상담자의 개입<textarea id="journal-session-intervention-${c.caseId}" rows="5" placeholder="상담자가 사용한 질문, 반영, 해석, 개입 등을 기록하세요." class="mt-2 w-full resize-y rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm leading-relaxed"></textarea></label><label class="mt-4 block text-xs font-extrabold text-slate-600">상담결과<textarea id="journal-session-result-${c.caseId}" rows="4" placeholder="이번 회기에서 확인된 결과, 합의된 내용, 새롭게 명료해진 점을 기록하세요." class="mt-2 w-full resize-y rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm leading-relaxed"></textarea></label><label class="mt-4 block text-xs font-extrabold text-slate-600">내담자의 변화<textarea id="journal-session-change-${c.caseId}" rows="4" placeholder="회기 중 관찰되거나 내담자가 표현한 정서·인지·행동·관계의 변화를 기록하세요." class="mt-2 w-full resize-y rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm leading-relaxed"></textarea></label><label class="mt-4 block text-xs font-extrabold text-slate-600">다음 회기 계획<textarea id="journal-session-next-${c.caseId}" rows="4" placeholder="다음 회기에 이어갈 내용이나 과제" class="mt-2 w-full resize-y rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm leading-relaxed"></textarea></label></div>${(()=>{const aid=load('modumam_counseling_aid_'+c.caseId,null);return `<aside class="rounded-2xl border border-purple-200 bg-purple-50/50 p-4 sm:p-5 xl:sticky xl:top-4 xl:self-start"><div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><p class="text-xs font-extrabold text-purple-700">AI COUNSELING SUPPORT</p><h5 class="mt-1 text-lg font-extrabold text-slate-950">AI 상담지원</h5><p class="mt-1 text-[11px] leading-relaxed text-slate-500">내담자 정보·주호소문제·상담동기를 중심으로 현재 상담의 초점, 추천 질문, 개입 방향과 주의사항을 제안합니다. 상담내용을 입력한 뒤에는 AI 회기정리로 기록을 완성할 수 있습니다.</p></div></div>${aid?`<div class="mt-4 grid grid-cols-1 gap-3 lg:grid-cols-2"><label class="text-xs font-extrabold text-purple-700">현재 핵심 정서<textarea id="aid-emotion-${c.caseId}" rows="3" class="mt-1 w-full resize-y rounded-xl border border-purple-100 bg-white p-3 text-xs leading-relaxed">${esc(aid.emotion||'')}</textarea></label><label class="text-xs font-extrabold text-purple-700">이번 회기 상담초점<textarea id="aid-focus-${c.caseId}" rows="3" class="mt-1 w-full resize-y rounded-xl border border-purple-100 bg-white p-3 text-xs leading-relaxed">${esc(aid.focus||'')}</textarea></label><label class="text-xs font-extrabold text-purple-700">추천 질문<textarea id="aid-questions-${c.caseId}" rows="6" class="mt-1 w-full resize-y rounded-xl border border-purple-100 bg-white p-3 text-xs leading-relaxed">${esc(aid.questions||'')}</textarea></label><label class="text-xs font-extrabold text-purple-700">권장 개입<textarea id="aid-intervention-${c.caseId}" rows="6" class="mt-1 w-full resize-y rounded-xl border border-purple-100 bg-white p-3 text-xs leading-relaxed">${esc(aid.intervention||'')}</textarea></label><label class="text-xs font-extrabold text-cyan-700">상담결과 정리<textarea id="aid-result-${c.caseId}" rows="4" class="mt-1 w-full resize-y rounded-xl border border-cyan-100 bg-white p-3 text-xs leading-relaxed">${esc(aid.sessionResult||'')}</textarea></label><label class="text-xs font-extrabold text-teal-700">내담자의 변화 정리<textarea id="aid-change-${c.caseId}" rows="4" class="mt-1 w-full resize-y rounded-xl border border-teal-100 bg-white p-3 text-xs leading-relaxed">${esc(aid.clientChange||'')}</textarea></label><label class="text-xs font-extrabold text-emerald-700">강점·보호요인<textarea id="aid-strengths-${c.caseId}" rows="4" class="mt-1 w-full resize-y rounded-xl border border-emerald-100 bg-white p-3 text-xs leading-relaxed">${esc(aid.strengths||'')}</textarea></label><label class="text-xs font-extrabold text-rose-700">주의·안전 확인<textarea id="aid-caution-${c.caseId}" rows="4" class="mt-1 w-full resize-y rounded-xl border border-rose-100 bg-white p-3 text-xs leading-relaxed">${esc(aid.caution||'')}</textarea></label><label class="text-xs font-extrabold text-blue-700 lg:col-span-2">다음 회기 연결<textarea id="aid-next-${c.caseId}" rows="4" class="mt-1 w-full resize-y rounded-xl border border-blue-100 bg-white p-3 text-xs leading-relaxed">${esc(aid.nextPlan||'')}</textarea></label><textarea id="aid-source-${c.caseId}" class="hidden">${esc(aid.source||'')}</textarea></div><div class="mt-3 flex flex-wrap gap-2"><button type="button" onclick="saveCounselingAid('${c.caseId}')" class="rounded-xl bg-slate-900 px-4 py-2 text-xs font-extrabold text-white">AI 지원내용 저장</button><button type="button" onclick="copyCounselingAid('${c.caseId}')" class="rounded-xl border border-purple-200 bg-white px-4 py-2 text-xs font-extrabold text-purple-700">내용 복사</button><button type="button" onclick="applyCounselingAidToJournal('${c.caseId}')" class="rounded-xl border border-emerald-200 bg-white px-4 py-2 text-xs font-extrabold text-emerald-700">개입·결과·변화·다음회기에 다시 반영</button></div><p class="mt-2 text-[10px] text-slate-400">AI 제안은 상담자의 임상적 판단을 돕는 참고자료이며 진단이나 최종 판단을 대신하지 않습니다. ${esc(aid.updatedAt||'')}</p>`:`<div class="mt-4 rounded-xl border border-dashed border-purple-200 bg-white p-4 text-xs leading-relaxed text-purple-700">내담자 정보·주호소문제·상담동기를 입력한 뒤 AI 상담보조를 생성하면 상담초점·추천질문·개입 방향·강점·주의사항을 제안합니다.</div>`}</aside>`})()}</div><div class="mt-5 flex justify-end gap-2"><button type="button" onclick="cancelCounselingJournalSession()" class="rounded-xl border border-slate-200 bg-white px-5 py-3 text-sm font-extrabold">취소</button><button type="button" onclick="saveCounselingJournalSession('${c.caseId}','${esc(String(c.res.id))}')" class="rounded-xl bg-slate-950 px-6 py-3 text-sm font-extrabold text-white">회기기록 저장</button></div></div>`:''}
    <div class="mt-5 rounded-[1.75rem] border border-purple-100 bg-purple-50 p-5"><div><p class="text-xs font-extrabold text-purple-700">회기기록 정리</p><h4 class="mt-1 text-lg font-extrabold">자료 선택 후 AI 회기 정리</h4></div><div class="mt-4 flex flex-wrap gap-3"><label class="flex cursor-pointer items-center gap-2 rounded-xl border border-purple-200 bg-white px-4 py-3 text-sm font-extrabold"><input id="session-source-journal-${c.caseId}" type="checkbox" checked class="h-4 w-4">상담일지</label><label class="flex cursor-pointer items-center gap-2 rounded-xl border border-purple-200 bg-white px-4 py-3 text-sm font-extrabold"><input id="session-source-transcript-${c.caseId}" type="checkbox" ${counselingTranscriptMetadata[String(c.caseId)]?'checked':''} class="h-4 w-4">축어록</label></div><div class="mt-4 grid grid-cols-1 gap-3 md:grid-cols-[100px_170px_1fr]"><label class="rounded-xl border border-purple-200 bg-white px-3 py-2"><span class="block text-[10px] font-extrabold text-purple-500">회기수</span><input id="counseling-session-number-${c.caseId}" type="number" min="1" value="${c.sessions.length+1}" class="mt-1 w-full border-0 p-0 text-sm font-extrabold outline-none"></label><label class="rounded-xl border border-purple-200 bg-white px-3 py-2"><span class="block text-[10px] font-extrabold text-purple-500">상담일</span><input id="counseling-session-date-${c.caseId}" type="date" value="${esc(c.res.date||new Date().toISOString().slice(0,10))}" class="mt-1 w-full border-0 p-0 text-sm font-extrabold outline-none"></label><label class="rounded-xl border border-purple-200 bg-white px-3 py-2"><span class="block text-[10px] font-extrabold text-purple-500">축어록 파일</span><input id="counseling-transcript-file-${c.caseId}" data-counseling-case-id="${esc(String(c.caseId))}" type="file" accept=".txt,.pdf,.png,.jpg,.jpeg,.webp,text/plain,application/pdf,image/png,image/jpeg,image/webp" onchange="handleCounselingTranscriptInput(this)" class="mt-1 block w-full cursor-pointer text-xs"><p id="counseling-transcript-name-${c.caseId}" class="mt-2 ${counselingTranscriptMetadata[String(c.caseId)]?'rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-extrabold text-emerald-700':'text-[10px] font-bold text-slate-400'}">${counselingTranscriptMetadata[String(c.caseId)]?`${esc(counselingTranscriptMetadata[String(c.caseId)].status)}: ${esc(counselingTranscriptMetadata[String(c.caseId)].name)} · ${Math.ceil(Number(counselingTranscriptMetadata[String(c.caseId)].size||0)/1024)}KB`:'선택된 파일 없음'}</p></label></div><button type="button" id="session-organize-button-${c.caseId}" data-mml-action="organize-counseling-session" data-case-id="${esc(String(c.caseId))}" data-reservation-id="${esc(String(c.res.id))}" class="mt-4 w-full rounded-xl bg-purple-600 px-4 py-3 text-sm font-extrabold text-white">AI 회기 정리</button><p class="mt-2 text-[10px] text-purple-500">상담일지만, 축어록만, 또는 두 자료를 함께 선택할 수 있습니다.</p></div>
    <div class="mt-6"><div class="mb-3 flex items-center justify-between"><h4 class="text-lg font-extrabold">저장된 회기록</h4><span class="text-xs font-bold text-slate-400">상담일자 · 회기수 · 상담방법</span></div><div class="space-y-4">${c.sessions.length?c.sessions.map((s,i)=>`<article class="rounded-2xl border border-slate-100 bg-slate-50 p-5"><div class="mb-3 flex flex-wrap justify-end gap-2">${s.reviewStatus==='상담자 검토 완료'?`<button type="button" onclick="setCounselingSessionReviewStatus('${c.caseId}','${esc(String(s.id||''))}',${i},'상담자 수정')" class="rounded-lg border border-amber-200 bg-white px-3 py-1.5 text-xs font-extrabold text-amber-700 hover:bg-amber-50">확정 취소</button>`:`<button type="button" onclick="setCounselingSessionReviewStatus('${c.caseId}','${esc(String(s.id||''))}',${i},'상담자 검토 완료')" class="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-extrabold text-white hover:bg-emerald-700">검토 완료</button>`}<button type="button" onclick="rewriteCounselingSessionWithAI('${c.caseId}',${JSON.stringify(String(c.res.id))},'${esc(String(s.id||''))}',${i})" class="rounded-lg border border-emerald-200 bg-white px-3 py-1.5 text-xs font-extrabold text-emerald-700 hover:bg-emerald-50">AI 다시 작성</button><button type="button" onclick="printCounselingSessionRecord('${c.caseId}','${esc(String(s.id||''))}',${i})" class="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-extrabold text-slate-700 hover:bg-slate-100">PDF / 인쇄</button><button type="button" onclick="openCounselingSessionEditor('${c.caseId}','${esc(String(s.id||''))}',${i})" class="rounded-lg border border-purple-200 bg-white px-3 py-1.5 text-xs font-extrabold text-purple-700 hover:bg-purple-50">기록 수정</button><button type="button" onclick="deleteCounselingSessionRecord('${c.caseId}','${esc(String(s.id||''))}',${i})" class="rounded-lg border border-rose-200 bg-white px-3 py-1.5 text-xs font-extrabold text-rose-600 hover:bg-rose-50">기록 삭제</button></div><div class="grid grid-cols-1 gap-3 sm:grid-cols-3"><div><p class="text-[10px] font-extrabold text-slate-400">상담일자</p><p class="mt-1 text-sm font-extrabold">${esc(s.date||c.res.date||'')}</p></div><div><p class="text-[10px] font-extrabold text-slate-400">회기수</p><p class="mt-1 text-sm font-extrabold">${esc(s.sessionNumber||c.sessions.length-i)}회기</p></div><div><p class="text-[10px] font-extrabold text-slate-400">상담방법</p><p class="mt-1 text-sm font-extrabold">${esc(s.counselingMethod||c.res.type||'미정')}</p></div></div><div class="mt-4 grid grid-cols-1 gap-4"><div><p class="text-xs font-extrabold text-emerald-700">내담자 정보</p><p class="mt-1 whitespace-pre-line text-sm leading-relaxed text-slate-700">${esc(s.clientInfo||'미입력')}</p></div><div><p class="text-xs font-extrabold text-emerald-700">주호소문제</p><p class="mt-1 whitespace-pre-line text-sm leading-relaxed text-slate-700">${esc(s.complaint||s.reason||c.res.applicationForm?.concern||'미입력')}</p></div><div><p class="text-xs font-extrabold text-emerald-700">상담동기</p><p class="mt-1 whitespace-pre-line text-sm leading-relaxed text-slate-700">${esc(s.counselingMotivation||s.motivation||'미입력')}</p></div><div class="rounded-xl border border-rose-100 bg-rose-50/40 p-3"><div class="flex flex-wrap items-center justify-between gap-2"><p class="text-xs font-extrabold text-rose-700">위기항목</p><span class="rounded-full border px-2.5 py-1 text-[10px] font-extrabold ${counselingJournalRiskLevelMeta(s.riskLevel||'미확인').className}">${counselingJournalRiskLevelMeta(s.riskLevel||'미확인').label}</span></div>${s.riskChecks?.length?`<div class="mt-2 flex flex-wrap gap-1.5">${s.riskChecks.map(x=>`<span class="rounded-full bg-white px-2.5 py-1 text-[10px] font-extrabold text-rose-700">${esc(x)}</span>`).join('')}</div>`:''}<p class="mt-2 whitespace-pre-line text-sm leading-relaxed text-slate-700">${esc(s.risk||s.riskItems||'미입력')}</p></div>${s.assessmentResults?`<div class="rounded-xl border border-indigo-100 bg-indigo-50/50 p-3"><p class="text-xs font-extrabold text-indigo-700">불러온 검사결과</p><p class="mt-1 whitespace-pre-line text-sm leading-relaxed text-slate-700">${esc(s.assessmentResults)}</p></div>`:''}<div><p class="text-xs font-extrabold text-emerald-700">상담목표</p><p class="mt-1 whitespace-pre-line text-sm leading-relaxed text-slate-700">${esc(s.goal||'미입력')}</p></div><div><p class="text-xs font-extrabold text-emerald-700">상담내용</p><p class="mt-1 whitespace-pre-line text-sm leading-relaxed text-slate-700">${esc(s.content||'미입력')}</p></div><div><p class="text-xs font-extrabold text-emerald-700">상담결과</p><p class="mt-1 whitespace-pre-line text-sm leading-relaxed text-slate-700">${esc(s.result||s.change||'미입력')}</p></div><div><p class="text-xs font-extrabold text-emerald-700">다음회기</p><p class="mt-1 whitespace-pre-line text-sm leading-relaxed text-slate-700">${esc(s.next||'미입력')}</p></div></div>${s.sourceTypes?.length?`<p class="mt-4 text-[10px] font-bold text-purple-600">AI 생성근거: ${s.sourceTypes.map(esc).join(' + ')}</p>`:''}${s.transcriptFile?.name?`<div class="mt-2 rounded-xl border border-purple-100 bg-purple-50 px-3 py-2 text-[11px] font-bold text-purple-700">첨부 축어록: ${esc(s.transcriptFile.name)}${s.transcriptFile.size?` · ${Math.ceil(Number(s.transcriptFile.size)/1024)}KB`:''}</div>`:''}</article>`).join(''):empty('저장된 회기록이 없습니다.')}</div></div></section>`).join('')}${selectedCaseId&&!activeCases.length?empty('선택한 상담 사례를 찾을 수 없습니다.'):''}</div>`);
}

function terminationView(){
  const rows=state.reservations
    .filter(r=>['상담완료','종결'].includes(normalizeStatus(r.status)))
    .sort((a,b)=>String(b.date||'').localeCompare(String(a.date||'')));

  return layout(`<div class="space-y-6">
    <div class="rounded-[2rem] bg-gradient-to-r from-slate-950 to-emerald-950 p-6 text-white shadow-xl sm:p-8">
      <p class="text-xs font-extrabold text-emerald-300">CASE TERMINATION EVALUATION</p>
      <h2 class="mt-2 text-2xl font-extrabold">AI 사례종결평가</h2>
      <p class="mt-2 text-sm leading-relaxed text-slate-300">초기 상태와 상담과정, 현재 상태를 비교하여 목표 달성도·변화 근거·남은 어려움·재발 위험·사후관리 계획을 정리합니다.</p>
    </div>

    ${rows.map(r=>{
      const t=getTerminationRecord(r.id);
      const caseId=caseIdFromReservation(r);
      const sessions=load('modumam_case_sessions_'+caseId,[]);
      const reviewedCount=sessions.filter(s=>s.reviewStatus==='상담자 검토 완료').length;
      const compass=t.recoveryCompass||{};

      return `<section class="rounded-[2rem] border border-slate-100 bg-white p-5 shadow-sm sm:p-6">
        <div class="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div>
            <div class="flex flex-wrap items-center gap-2">
              <h3 class="text-xl font-extrabold">${esc(r.name)}님</h3>
              <span class="rounded-full px-3 py-1 text-xs font-bold ${statusClass(r.status)}">${esc(normalizeStatus(r.status))}</span>
              ${t.reviewed?'<span class="rounded-full bg-emerald-100 px-3 py-1 text-xs font-extrabold text-emerald-700">상담자 검토 완료</span>':t.aiGeneratedAt?'<span class="rounded-full bg-amber-100 px-3 py-1 text-xs font-extrabold text-amber-700">검토 필요</span>':''}
            </div>
            <p class="mt-2 text-sm text-slate-500">${esc(programBaseName(r.program))} · ${esc(r.type||'')} · 전체 회기 ${sessions.length}건 · 검토 완료 ${reviewedCount}건</p>
            <p class="mt-1 text-xs text-slate-400">신청검사: ${requestedTests(r).map(shortTestName).join(', ')||'없음'}</p>
            ${t.aiGeneratedAt?`<p class="mt-2 text-[11px] font-bold text-purple-600">AI 초안 ${new Date(t.aiGeneratedAt).toLocaleString('ko-KR')} ${t.aiModel?`· ${esc(t.aiModel)}`:''}</p>`:''}
          </div>
          <div class="flex flex-wrap gap-2">
            <button onclick="generateTerminationSummary(${r.id})" ${state.terminationDraftLoading[r.id]?'disabled':''} class="rounded-xl bg-purple-600 px-4 py-2 text-xs font-extrabold text-white disabled:opacity-50">${state.terminationDraftLoading[r.id]?'비교·분석 중...':t.aiGeneratedAt?'AI 다시 생성':'AI 종결평가 생성'}</button>
            <button onclick="printTerminationRecord(${r.id})" class="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-extrabold">PDF·인쇄</button>
          </div>
        </div>

        <div class="mt-5 grid grid-cols-1 gap-3 xl:grid-cols-2">
          <textarea id="term-reason-${r.id}" rows="3" placeholder="1. 종결 사유" class="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm">${esc(t.reason||'')}</textarea>
          <textarea id="term-overview-${r.id}" rows="5" placeholder="2. 사례개요" class="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm">${esc(t.caseOverview||'')}</textarea>
          <textarea id="term-process-${r.id}" rows="6" placeholder="3. 상담 진행과정" class="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm">${esc(t.counselingProcess||'')}</textarea>
          <textarea id="term-interventions-${r.id}" rows="6" placeholder="4. 주요 개입" class="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm">${esc(t.majorInterventions||'')}</textarea>
          <textarea id="term-goal-${r.id}" rows="6" placeholder="5. 상담목표 달성 평가" class="rounded-2xl border border-indigo-100 bg-indigo-50/40 px-4 py-3 text-sm">${esc(t.goalAchievement||'')}</textarea>
          <textarea id="term-function-${r.id}" rows="6" placeholder="6. 증상 및 기능 변화" class="rounded-2xl border border-emerald-100 bg-emerald-50/40 px-4 py-3 text-sm">${esc(t.symptomFunctionChange||'')}</textarea>
          <textarea id="term-evidence-${r.id}" rows="6" placeholder="7. 변화의 근거 · 내담자 진술, 행동, 기능, 회기기록 근거 구분" class="rounded-2xl border border-cyan-100 bg-cyan-50/40 px-4 py-3 text-sm">${esc(t.changeEvidence||'')}</textarea>
          <textarea id="term-comparison-${r.id}" rows="6" placeholder="8. 초기 상태와 현재 상태 비교 · 좋아진 점, 유지된 점, 새롭게 확인된 점" class="rounded-2xl border border-blue-100 bg-blue-50/40 px-4 py-3 text-sm">${esc(t.initialCurrentComparison||'')}</textarea>
          <textarea id="term-remaining-${r.id}" rows="5" placeholder="9. 남아 있는 어려움" class="rounded-2xl border border-amber-100 bg-amber-50/40 px-4 py-3 text-sm">${esc(t.remaining||'')}</textarea>
          <textarea id="term-relapse-${r.id}" rows="5" placeholder="10. 재발 위험 및 주의 신호" class="rounded-2xl border border-rose-100 bg-rose-50/40 px-4 py-3 text-sm">${esc(t.relapseRisk||'')}</textarea>
          <textarea id="term-protective-${r.id}" rows="5" placeholder="11. 보호요인과 회복자원" class="rounded-2xl border border-emerald-100 bg-emerald-50/40 px-4 py-3 text-sm">${esc(t.protectiveFactors||'')}</textarea>
          <textarea id="term-suitability-${r.id}" rows="5" placeholder="12. 종결 적절성 평가 · 적절, 조건부 적절, 추가 상담 권고 및 근거" class="rounded-2xl border border-violet-100 bg-violet-50/40 px-4 py-3 text-sm">${esc(t.terminationSuitability||'')}</textarea>
          <textarea id="term-recommendation-${r.id}" rows="5" placeholder="13. 향후 권고" class="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm">${esc(t.recommendation||'')}</textarea>
          <textarea id="term-followup-${r.id}" rows="5" placeholder="14. 사후관리 계획" class="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm">${esc(t.followUp||'')}</textarea>
          <textarea id="term-restart-${r.id}" rows="5" placeholder="15. 상담 재개 기준" class="rounded-2xl border border-rose-100 bg-rose-50/40 px-4 py-3 text-sm">${esc(t.restartCriteria||'')}</textarea>
          <textarea id="term-feedback-${r.id}" rows="5" placeholder="16. 내담자 종결 피드백 및 확인 질문" class="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm">${esc(t.clientFeedback||'')}</textarea>
          <textarea id="term-opinion-${r.id}" rows="6" placeholder="17. 종결 소견" class="rounded-2xl border border-slate-300 bg-slate-50 px-4 py-3 text-sm xl:col-span-2">${esc(t.finalOpinion||'')}</textarea>
        </div>

        <div class="mt-5 rounded-[1.5rem] border border-emerald-100 bg-emerald-50/40 p-4">
          <p class="text-xs font-extrabold text-emerald-700">회복 나침반</p>
          <div class="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
            <textarea id="term-compass-understanding-${r.id}" rows="3" placeholder="상담을 통해 이해한 핵심" class="rounded-xl border border-emerald-100 bg-white px-3 py-3 text-sm">${esc(compass.todayUnderstanding||'')}</textarea>
            <textarea id="term-compass-strength-${r.id}" rows="3" placeholder="확인된 강점" class="rounded-xl border border-emerald-100 bg-white px-3 py-3 text-sm">${esc(compass.strength||'')}</textarea>
            <textarea id="term-compass-resource-${r.id}" rows="3" placeholder="회복자원" class="rounded-xl border border-emerald-100 bg-white px-3 py-3 text-sm">${esc(compass.recoveryResource||'')}</textarea>
            <textarea id="term-compass-action-${r.id}" rows="3" placeholder="이어갈 작은 행동" class="rounded-xl border border-emerald-100 bg-white px-3 py-3 text-sm">${esc(compass.smallAction||'')}</textarea>
            <textarea id="term-compass-signal-${r.id}" rows="3" placeholder="다시 도움을 요청할 신호" class="rounded-xl border border-emerald-100 bg-white px-3 py-3 text-sm md:col-span-2">${esc(compass.returnSignal||'')}</textarea>
          </div>
        </div>

        <button onclick="saveTerminationRecord(${r.id})" class="mt-4 w-full rounded-2xl bg-slate-900 py-3 text-sm font-extrabold text-white">사례종결평가 검토본 저장 및 종결 처리</button>
        <p class="mt-3 text-[10px] leading-relaxed text-slate-400">AI 초안은 상담자의 직접 평가를 대신하지 않습니다. 특히 위험도, 종결 적절성, 재상담 기준은 상담자가 확인한 뒤 저장하세요.</p>
      </section>`;
    }).join('')||empty('상담완료 또는 종결 상태의 사례가 없습니다.')}
  </div>`);
}

function monthKey(date){return String(date||'').slice(0,7)||'미정'}
function countBy(items,getKey){return items.reduce((acc,item)=>{const key=getKey(item)||'기타';acc[key]=(acc[key]||0)+1;return acc},{})}
function statBars(obj,maxItems=8){const rows=Object.entries(obj).sort((a,b)=>b[1]-a[1]).slice(0,maxItems),max=Math.max(1,...rows.map(x=>x[1]));return rows.length?`<div class="space-y-3">${rows.map(([k,v])=>`<div><div class="flex justify-between text-xs"><span class="font-bold text-slate-600">${esc(k)}</span><span class="font-extrabold">${v}건</span></div><div class="mt-1 h-2 overflow-hidden rounded-full bg-slate-100"><div class="h-full rounded-full bg-slate-900" style="width:${Math.max(5,Math.round(v/max*100))}%"></div></div></div>`).join('')}</div>`:'<p class="text-sm text-slate-400">집계할 데이터가 없습니다.</p>'}


/* V25: AI 사례관리 및 AI 임상지원 코드는 js/modules/clinical-workspace.js로 분리되었습니다. */

function allTerminationRecords(){
  return state.reservations.map(r=>({
    reservation:r,
    termination:getTerminationRecord(r.id)
  })).filter(item=>item.termination&&(item.termination.reviewed||item.termination.aiGeneratedAt));
}

function terminationSuitabilityGroup(value){
  const text=String(value||'');
  if(text.includes('조건부'))return '조건부 적절';
  if(text.includes('추가 상담')||text.includes('추가상담'))return '추가 상담 권고';
  if(text.includes('적절'))return '종결 적절';
  return '미분류';
}

function goalAchievementGroup(value){
  const text=String(value||'');
  if(text.includes('미달성'))return '미달성 포함';
  if(text.includes('부분 달성')||text.includes('부분달성'))return '부분 달성';
  if(text.includes('달성'))return '달성';
  if(text.includes('평가 불가')||text.includes('평가불가'))return '평가 불가';
  return '미분류';
}

function escapeCsv(value){
  const text=String(value??'').replace(/\r?\n/g,' ');
  return `"${text.replace(/"/g,'""')}"`;
}

function downloadOutcomeCsv(){
  const rows=allTerminationRecords();
  if(!rows.length){
    alert('내보낼 종결평가 데이터가 없습니다.');
    return;
  }

  const header=[
    '사례번호','프로그램','상담방식','예약일','상태',
    '종결적절성','목표달성분류','종결사유',
    '목표달성평가','증상및기능변화','남은어려움',
    '재발위험및주의신호','보호요인','사후관리','상담재개기준',
    '상담자검토여부','검토일시'
  ];

  const lines=[header.map(escapeCsv).join(',')];

  rows.forEach(({reservation:r,termination:t})=>{
    lines.push([
      caseIdFromReservation(r),
      programBaseName(r.program),
      counselingMethodKey(r.type),
      r.date||'',
      normalizeStatus(r.status),
      terminationSuitabilityGroup(t.terminationSuitability),
      goalAchievementGroup(t.goalAchievement),
      t.reason||'',
      t.goalAchievement||'',
      t.symptomFunctionChange||'',
      t.remaining||'',
      t.relapseRisk||'',
      t.protectiveFactors||'',
      t.followUp||'',
      t.restartCriteria||'',
      t.reviewed?'상담자 검토 완료':'AI 초안',
      t.reviewedAt||t.aiGeneratedAt||''
    ].map(escapeCsv).join(','));
  });

  const bom='\uFEFF';
  const blob=new Blob([bom+lines.join('\n')],{type:'text/csv;charset=utf-8'});
  const url=URL.createObjectURL(blob);
  const a=document.createElement('a');
  a.href=url;
  a.download=`modumam-counseling-outcomes-${new Date().toISOString().slice(0,10)}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);

  if(typeof appendAuditLog==='function'){
    appendAuditLog('통계 내보내기','상담성과 CSV',`${rows.length}건`);
  }
}
window.downloadOutcomeCsv=downloadOutcomeCsv;

function outcomeKeywordCounts(rows,field,keywords){
  const result={};
  keywords.forEach(keyword=>{result[keyword]=0});
  rows.forEach(({termination})=>{
    const text=String(termination?.[field]||'');
    keywords.forEach(keyword=>{
      if(text.includes(keyword))result[keyword]+=1;
    });
  });
  return result;
}

function reviewedTerminationRate(rows){
  if(!rows.length)return 0;
  return Math.round(rows.filter(({termination})=>termination.reviewed).length/rows.length*100);
}

function statisticsView(){
  const active=state.reservations.filter(r=>normalizeStatus(r.status)!=='예약취소');
  const total=active.length;
  const completed=active.filter(r=>['상담완료','종결'].includes(normalizeStatus(r.status))).length;
  const terminated=active.filter(r=>normalizeStatus(r.status)==='종결').length;
  const monthCounts=countBy(active,r=>monthKey(r.date));
  const programCounts=countBy(active,r=>programBaseName(r.program));
  const methodCounts=countBy(active,r=>counselingMethodKey(r.type));
  const testCounts={};
  active.forEach(r=>requestedTests(r).forEach(t=>{
    const key=shortTestName(t);
    testCounts[key]=(testCounts[key]||0)+1;
  }));

  const recentMonths=Object.entries(monthCounts)
    .sort((a,b)=>String(b[0]).localeCompare(String(a[0])))
    .slice(0,6)
    .reverse();

  const outcomeRows=allTerminationRecords();
  const reviewedCount=outcomeRows.filter(({termination})=>termination.reviewed).length;
  const reviewRate=reviewedTerminationRate(outcomeRows);
  const suitabilityCounts=countBy(outcomeRows,({termination})=>terminationSuitabilityGroup(termination.terminationSuitability));
  const goalCounts=countBy(outcomeRows,({termination})=>goalAchievementGroup(termination.goalAchievement));
  const outcomeProgramCounts=countBy(outcomeRows,({reservation})=>programBaseName(reservation.program));
  const outcomeMethodCounts=countBy(outcomeRows,({reservation})=>counselingMethodKey(reservation.type));

  const riskKeywords=outcomeKeywordCounts(
    outcomeRows,
    'relapseRisk',
    ['불안','우울','수면','관계','회피','스트레스','자해','자살','분노','과부하']
  );
  const resourceKeywords=outcomeKeywordCounts(
    outcomeRows,
    'protectiveFactors',
    ['가족','친구','배우자','부모','자녀','상담','운동','휴식','직장','지역사회']
  );

  const followUpCount=outcomeRows.filter(({termination})=>String(termination.followUp||'').trim()).length;
  const restartCriteriaCount=outcomeRows.filter(({termination})=>String(termination.restartCriteria||'').trim()).length;

  return layout(`<div class="space-y-8">
    <div class="flex flex-col gap-4 rounded-[2rem] bg-gradient-to-r from-slate-950 via-slate-900 to-emerald-950 p-6 text-white shadow-xl sm:p-8 xl:flex-row xl:items-center xl:justify-between">
      <div>
        <p class="text-xs font-extrabold text-emerald-300">COUNSELING OUTCOMES DASHBOARD</p>
        <h2 class="mt-2 text-2xl font-extrabold">상담성과 통계</h2>
        <p class="mt-2 max-w-3xl text-sm leading-relaxed text-slate-300">예약·상담·심리검사 운영 현황과 상담자 검토가 완료된 종결평가를 함께 집계합니다. 성과자료는 사례 식별정보를 최소화하여 CSV로 내보낼 수 있습니다.</p>
      </div>
      <button onclick="downloadOutcomeCsv()" class="rounded-2xl bg-white px-5 py-3 text-sm font-extrabold text-slate-900">상담성과 CSV 내보내기</button>
    </div>

    <div class="grid grid-cols-2 gap-4 xl:grid-cols-6">
      ${card('전체 예약',total+'건','취소 제외','📅','blue')}
      ${card('상담 완료',completed+'건',total?Math.round(completed/total*100)+'%':'0%','✅','emerald')}
      ${card('종결 사례',terminated+'건','예약 상태 기준','🏁','orange')}
      ${card('종결평가',outcomeRows.length+'건','AI 초안 포함','🧭','purple')}
      ${card('검토 완료',reviewedCount+'건',reviewRate+'%','🔎','emerald')}
      ${card('사후관리 기록',followUpCount+'건',restartCriteriaCount+'건 재개기준','🌱','blue')}
    </div>

    <div class="grid grid-cols-1 gap-5 xl:grid-cols-2">
      <section class="rounded-[2rem] border border-slate-100 bg-white p-6 shadow-sm">
        <h2 class="text-lg font-extrabold">최근 6개월 예약</h2>
        <p class="mt-1 text-xs text-slate-400">예약일 기준 월별 건수</p>
        <div class="mt-5 grid h-52 grid-cols-6 items-end gap-3">
          ${recentMonths.length?recentMonths.map(([month,value])=>{
            const max=Math.max(...recentMonths.map(item=>item[1]),1);
            return `<div class="flex h-full flex-col justify-end text-center">
              <p class="mb-2 text-xs font-extrabold">${value}</p>
              <div class="mx-auto w-full max-w-10 rounded-t-xl bg-emerald-500" style="height:${Math.max(12,Math.round(value/max*150))}px"></div>
              <p class="mt-2 text-[10px] text-slate-400">${esc(month)}</p>
            </div>`;
          }).join(''):'<p class="col-span-6 text-sm text-slate-400">예약 데이터가 없습니다.</p>'}
        </div>
      </section>

      <section class="rounded-[2rem] border border-emerald-100 bg-emerald-50/30 p-6 shadow-sm">
        <h2 class="text-lg font-extrabold">종결 적절성 분포</h2>
        <p class="mt-1 text-xs text-slate-400">상담자 검토 전 AI 초안도 포함되므로 최종 판단 자료로 단독 사용하지 않습니다.</p>
        <div class="mt-5">${statBars(suitabilityCounts)}</div>
      </section>

      <section class="rounded-[2rem] border border-indigo-100 bg-indigo-50/30 p-6 shadow-sm">
        <h2 class="text-lg font-extrabold">상담목표 달성 분포</h2>
        <p class="mt-1 text-xs text-slate-400">종결평가 문구에서 달성·부분 달성·미달성·평가 불가를 분류합니다.</p>
        <div class="mt-5">${statBars(goalCounts)}</div>
      </section>

      <section class="rounded-[2rem] border border-slate-100 bg-white p-6 shadow-sm">
        <h2 class="text-lg font-extrabold">종결사례 프로그램별 분포</h2>
        <p class="mt-1 text-xs text-slate-400">종결평가가 생성된 사례 기준</p>
        <div class="mt-5">${statBars(outcomeProgramCounts)}</div>
      </section>

      <section class="rounded-[2rem] border border-slate-100 bg-white p-6 shadow-sm">
        <h2 class="text-lg font-extrabold">종결사례 상담방식</h2>
        <p class="mt-1 text-xs text-slate-400">종결평가가 생성된 사례 기준</p>
        <div class="mt-5">${statBars(outcomeMethodCounts)}</div>
      </section>

      <section class="rounded-[2rem] border border-rose-100 bg-rose-50/30 p-6 shadow-sm">
        <h2 class="text-lg font-extrabold">재발 위험·주의 신호 키워드</h2>
        <p class="mt-1 text-xs text-slate-400">종결평가의 재발 위험 및 주의 신호 문장에서 단순 출현 건수를 집계합니다.</p>
        <div class="mt-5">${statBars(riskKeywords,10)}</div>
      </section>

      <section class="rounded-[2rem] border border-cyan-100 bg-cyan-50/30 p-6 shadow-sm">
        <h2 class="text-lg font-extrabold">보호요인·회복자원 키워드</h2>
        <p class="mt-1 text-xs text-slate-400">종결평가의 보호요인 문장에서 단순 출현 건수를 집계합니다.</p>
        <div class="mt-5">${statBars(resourceKeywords,10)}</div>
      </section>

      <section class="rounded-[2rem] border border-slate-100 bg-white p-6 shadow-sm">
        <h2 class="text-lg font-extrabold">프로그램별 전체 이용</h2>
        <p class="mt-1 text-xs text-slate-400">취소 제외 전체 예약 기준</p>
        <div class="mt-5">${statBars(programCounts)}</div>
      </section>

      <section class="rounded-[2rem] border border-slate-100 bg-white p-6 shadow-sm">
        <h2 class="text-lg font-extrabold">심리검사별 신청</h2>
        <p class="mt-1 text-xs text-slate-400">기본검사와 추가검사 포함</p>
        <div class="mt-5">${statBars(testCounts)}</div>
      </section>

      <section class="rounded-[2rem] border border-slate-100 bg-white p-6 shadow-sm">
        <h2 class="text-lg font-extrabold">상담방식별 전체 이용</h2>
        <p class="mt-1 text-xs text-slate-400">장소 조율·찾아가는·화상·AI</p>
        <div class="mt-5">${statBars(methodCounts)}</div>
      </section>
    </div>

    <div class="rounded-[1.75rem] border border-amber-100 bg-amber-50 p-5 text-xs leading-relaxed text-amber-900">
      <strong>통계 해석 주의:</strong> 본 화면은 저장된 기록을 자동 집계한 운영 보조자료입니다. 키워드 출현과 AI 문구 분류는 임상적 효과크기나 치료 효과를 의미하지 않으며, 상담자 검토 완료 자료를 우선하여 해석해야 합니다.
    </div>
  </div>`);
}
function toggleOperatingMethod(method,checked){
  const settings=getOperatingSettings();
  const set=new Set(settings.enabledMethods||[]);
  checked?set.add(method):set.delete(method);
  settings.enabledMethods=[...set];
  save('modumam_operating_settings',settings);refreshOperatingSettings();render();
}
function collectProgramTests(id){return String(document.getElementById(id)?.value||'').split(',').map(v=>v.trim()).filter(Boolean)}
function saveOperatingSettings(){
  const settings={
    ...getOperatingSettings(),
    centerName:document.getElementById('setting-center-name').value.trim()||DEFAULT_OPERATING_SETTINGS.centerName,
    counselorName:document.getElementById('setting-counselor-name').value.trim(),
    contactMessage:document.getElementById('setting-contact-message').value.trim(),
    openTime:document.getElementById('setting-open-time').value||'09:00',
    closeTime:document.getElementById('setting-close-time').value||'18:00',
    intervalMinutes:Number(document.getElementById('setting-interval').value)||30,
    autoRules:document.getElementById('setting-auto-rules').checked,
    aiApprovalRequiresReport:document.getElementById('setting-ai-report').checked,
    programDefaultTests:{
      '개인 마음이음':collectProgramTests('setting-tests-personal'),
      '부부 마음이음':collectProgramTests('setting-tests-couple'),
      '부모-자녀 마음이음':collectProgramTests('setting-tests-parent')
    }
  };
  const start=Number(settings.openTime.replace(':','')),end=Number(settings.closeTime.replace(':',''));
  if(start>end){alert('운영 종료시간은 시작시간보다 늦어야 합니다.');return}
  if(!settings.enabledMethods.length){alert('상담방식을 한 가지 이상 활성화해 주세요.');return}
  save('modumam_operating_settings',settings);refreshOperatingSettings();alert('운영 설정을 저장했습니다. 회원 예약 화면에는 새로고침 후 반영됩니다.');render();
}

function collectBackupItems(){
  const items={};
  for(let i=0;i<localStorage.length;i++){
    const key=localStorage.key(i);
    if(key&&key.startsWith('modumam_')) items[key]=localStorage.getItem(key);
  }
  return items;
}
function backupSummary(items=collectBackupItems()){
  const keys=Object.keys(items);
  const bytes=keys.reduce((sum,key)=>sum+key.length+String(items[key]||'').length,0);
  return {count:keys.length,bytes,labels:{
    reservations:keys.filter(k=>k==='modumam_reservations').length,
    reports:keys.filter(k=>k==='modumam_reports').length,
    uploads:keys.filter(k=>k==='modumam_test_result_uploads').length,
    caseFiles:keys.filter(k=>k.startsWith('modumam_case_')).length,
    notes:keys.filter(k=>k.startsWith('modumam_counseling_notes_')).length
  }};
}
function downloadOperatingBackup(){
  const items=collectBackupItems();
  const payload={
    schema:'modumam-counseling-center-backup',
    version:1,
    exportedAt:new Date().toISOString(),
    origin:location.origin,
    summary:backupSummary(items),
    items
  };
  const stamp=new Date().toISOString().replace(/[:.]/g,'-');
  const blob=new Blob([JSON.stringify(payload,null,2)],{type:'application/json;charset=utf-8'});
  const url=URL.createObjectURL(blob),a=document.createElement('a');
  a.href=url;a.download=`modumam-backup-${stamp}.json`;document.body.appendChild(a);a.click();a.remove();URL.revokeObjectURL(url);
  localStorage.setItem('modumam_last_backup_at',new Date().toISOString());
  appendAuditLog('백업','전체 데이터',`${payload.summary.count}개 저장항목`);
  alert(`백업 파일을 만들었습니다.\n저장항목 ${payload.summary.count}개`);
  render();
}
function openBackupRestore(){const el=document.getElementById('backup-restore-file');if(el)el.click()}
async function restoreOperatingBackup(input){
  const file=input&&input.files&&input.files[0];if(!file)return;
  if(file.size>25*1024*1024){alert('백업 파일은 25MB 이하만 복원할 수 있습니다.');input.value='';return}
  try{
    const payload=JSON.parse(await file.text());
    if(!payload||payload.schema!=='modumam-counseling-center-backup'||!payload.items||typeof payload.items!=='object') throw new Error('지원하지 않는 백업 형식입니다.');
    const entries=Object.entries(payload.items).filter(([key,value])=>key.startsWith('modumam_')&&typeof value==='string');
    if(!entries.length) throw new Error('복원할 상담운영 데이터가 없습니다.');
    const mode=(document.getElementById('backup-restore-mode')||{}).value||'merge';
    const message=mode==='replace'
      ? `현재 상담운영 데이터를 지우고 백업 ${entries.length}개 항목으로 교체합니다. 계속할까요?`
      : `백업 ${entries.length}개 항목을 현재 데이터에 병합합니다. 같은 항목은 백업 내용으로 바뀝니다. 계속할까요?`;
    if(!confirm(message)){input.value='';return}
    if(mode==='replace'){
      const remove=[];for(let i=0;i<localStorage.length;i++){const key=localStorage.key(i);if(key&&key.startsWith('modumam_'))remove.push(key)}
      remove.forEach(key=>localStorage.removeItem(key));
    }
    entries.forEach(([key,value])=>localStorage.setItem(key,value));
    appendAuditLog('복원','전체 데이터',`${mode==='replace'?'교체':'병합'} · ${entries.length}개 항목 · ${file.name}`);
    alert('백업 복원이 완료되었습니다. 화면을 다시 불러옵니다.');
    location.reload();
  }catch(error){alert(`백업 복원에 실패했습니다.\n${error.message||'파일을 확인해 주세요.'}`)}finally{input.value=''}
}
function clearAuditLog(){if(!confirm('관리자 변경기록을 모두 삭제할까요? 상담·예약 데이터는 삭제되지 않습니다.'))return;localStorage.removeItem('modumam_admin_audit_log');appendAuditLog('초기화','관리자 변경기록');render()}
function auditLogView(limit=30){
  const logs=load('modumam_admin_audit_log',[]).slice(0,limit);
  if(!logs.length)return '<p class="text-sm text-slate-400">아직 저장된 관리자 변경기록이 없습니다.</p>';
  return `<div class="max-h-96 space-y-2 overflow-y-auto pr-1">${logs.map(log=>`<div class="rounded-2xl border border-slate-100 bg-slate-50 p-3"><div class="flex flex-wrap items-center justify-between gap-2"><p class="text-xs font-extrabold text-slate-700">${esc(log.action)} · ${esc(log.key)}</p><p class="text-[10px] text-slate-400">${esc(new Date(log.at).toLocaleString('ko-KR'))}</p></div>${log.detail?`<p class="mt-1 text-[11px] text-slate-500">${esc(log.detail)}</p>`:''}</div>`).join('')}</div>`;
}

function resetOperatingSettings(){if(!confirm('운영 설정을 기본값으로 되돌릴까요?'))return;save('modumam_operating_settings',DEFAULT_OPERATING_SETTINGS);refreshOperatingSettings();render()}
