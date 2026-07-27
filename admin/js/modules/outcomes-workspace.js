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

function counselingJournalView(){
  const tab=state.counselingJournalTab||'sessions';
  const cases=buildCases();
  if(tab==='termination'){
    const rows=state.reservations.filter(r=>['상담완료','종결'].includes(normalizeStatus(r.status)));
    return layout(`<div class="space-y-6"><section class="rounded-[2rem] bg-gradient-to-r from-slate-950 to-emerald-950 p-6 text-white shadow-xl sm:p-8"><p class="text-xs font-extrabold text-emerald-300">COUNSELING</p><h2 class="mt-2 text-2xl font-extrabold">상담기록</h2><p class="mt-2 text-sm text-slate-300">상담기록을 관리합니다.</p><div class="mt-5 flex gap-2"><button onclick="setCounselingJournalTab('sessions')" class="rounded-xl bg-white/10 px-4 py-2 text-xs font-extrabold">회기기록</button><button onclick="setCounselingJournalTab('termination')" class="rounded-xl bg-white px-4 py-2 text-xs font-extrabold text-slate-950">종결기록</button></div></section><section class="rounded-[2rem] border border-slate-100 bg-white p-6 shadow-sm"><div class="mb-5 flex items-center justify-between"><div><p class="text-xs font-extrabold text-rose-600">TERMINATION RECORD</p><h3 class="mt-1 text-xl font-extrabold">종결기록</h3></div><button onclick="setMenu('termination')" class="rounded-xl bg-slate-900 px-4 py-2 text-xs font-extrabold text-white">종결기록 작성·확인</button></div><div class="space-y-3">${rows.length?rows.map(r=>`<button onclick="setMenu('termination')" class="w-full rounded-2xl border border-slate-100 bg-slate-50 p-4 text-left"><b>${esc(r.name)}님</b> · ${esc(r.date||'')}</button>`).join(''):empty('종결기록 대상이 없습니다.')}</div></section></div>`);
  }
  return layout(`<div class="space-y-6"><section class="rounded-[2rem] bg-gradient-to-r from-slate-950 to-emerald-950 p-6 text-white shadow-xl sm:p-8"><p class="text-xs font-extrabold text-emerald-300">COUNSELING SESSION RECORD</p><h2 class="mt-2 text-2xl font-extrabold">상담기록</h2><p class="mt-2 text-sm text-slate-300">상담일지와 축어록 중 필요한 자료를 선택해 AI가 회기록을 정리합니다.</p><div class="mt-5 flex gap-2"><button onclick="setCounselingJournalTab('sessions')" class="rounded-xl bg-white px-4 py-2 text-xs font-extrabold text-slate-950">회기기록</button><button onclick="setCounselingJournalTab('termination')" class="rounded-xl bg-white/10 px-4 py-2 text-xs font-extrabold">종결기록</button></div></section>
  ${cases.map(c=>`<section class="rounded-[2rem] border border-slate-100 bg-white p-5 shadow-sm sm:p-6"><div class="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between"><div><h3 class="text-xl font-extrabold">${esc(c.res.name)}님</h3><p class="mt-1 text-sm text-slate-500">${esc(programBaseName(c.res.program))} · ${esc(c.res.type||'')} · ${esc(c.res.date||'')} ${esc(c.res.time||'')}</p></div><span class="rounded-full bg-emerald-50 px-3 py-1 text-xs font-extrabold text-emerald-700">저장 ${c.sessions.length}건</span></div>
    <div class="mt-5 rounded-[1.75rem] border border-purple-100 bg-purple-50 p-5"><div><p class="text-xs font-extrabold text-purple-700">회기기록 정리</p><h4 class="mt-1 text-lg font-extrabold">자료 선택 후 AI 회기 정리</h4></div><div class="mt-4 flex flex-wrap gap-3"><label class="flex cursor-pointer items-center gap-2 rounded-xl border border-purple-200 bg-white px-4 py-3 text-sm font-extrabold"><input id="session-source-journal-${c.caseId}" type="checkbox" checked class="h-4 w-4">상담일지</label><label class="flex cursor-pointer items-center gap-2 rounded-xl border border-purple-200 bg-white px-4 py-3 text-sm font-extrabold"><input id="session-source-transcript-${c.caseId}" type="checkbox" ${counselingTranscriptMetadata[String(c.caseId)]?'checked':''} class="h-4 w-4">축어록</label></div><div class="mt-4 grid grid-cols-1 gap-3 md:grid-cols-[100px_170px_1fr]"><label class="rounded-xl border border-purple-200 bg-white px-3 py-2"><span class="block text-[10px] font-extrabold text-purple-500">회기수</span><input id="counseling-session-number-${c.caseId}" type="number" min="1" value="${c.sessions.length+1}" class="mt-1 w-full border-0 p-0 text-sm font-extrabold outline-none"></label><label class="rounded-xl border border-purple-200 bg-white px-3 py-2"><span class="block text-[10px] font-extrabold text-purple-500">상담일</span><input id="counseling-session-date-${c.caseId}" type="date" value="${esc(c.res.date||new Date().toISOString().slice(0,10))}" class="mt-1 w-full border-0 p-0 text-sm font-extrabold outline-none"></label><label class="rounded-xl border border-purple-200 bg-white px-3 py-2"><span class="block text-[10px] font-extrabold text-purple-500">축어록 파일</span><input id="counseling-transcript-file-${c.caseId}" data-counseling-case-id="${esc(String(c.caseId))}" type="file" accept=".txt,.pdf,.png,.jpg,.jpeg,.webp,text/plain,application/pdf,image/png,image/jpeg,image/webp" onchange="handleCounselingTranscriptInput(this)" class="mt-1 block w-full cursor-pointer text-xs"><p id="counseling-transcript-name-${c.caseId}" class="mt-2 ${counselingTranscriptMetadata[String(c.caseId)]?'rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-extrabold text-emerald-700':'text-[10px] font-bold text-slate-400'}">${counselingTranscriptMetadata[String(c.caseId)]?`${esc(counselingTranscriptMetadata[String(c.caseId)].status)}: ${esc(counselingTranscriptMetadata[String(c.caseId)].name)} · ${Math.ceil(Number(counselingTranscriptMetadata[String(c.caseId)].size||0)/1024)}KB`:'선택된 파일 없음'}</p></label></div><button type="button" id="session-organize-button-${c.caseId}" data-mml-action="organize-counseling-session" data-case-id="${esc(String(c.caseId))}" data-reservation-id="${esc(String(c.res.id))}" class="mt-4 w-full rounded-xl bg-purple-600 px-4 py-3 text-sm font-extrabold text-white">AI 회기 정리</button><p class="mt-2 text-[10px] text-purple-500">상담일지만, 축어록만, 또는 두 자료를 함께 선택할 수 있습니다.</p></div>
    <div class="mt-6"><div class="mb-3 flex items-center justify-between"><h4 class="text-lg font-extrabold">저장된 회기록</h4><span class="text-xs font-bold text-slate-400">상담일자 · 회기수 · 상담방법</span></div><div class="space-y-4">${c.sessions.length?c.sessions.map((s,i)=>`<article class="rounded-2xl border border-slate-100 bg-slate-50 p-5"><div class="mb-3 flex flex-wrap justify-end gap-2">${s.reviewStatus==='상담자 검토 완료'?`<button type="button" onclick="setCounselingSessionReviewStatus('${c.caseId}','${esc(String(s.id||''))}',${i},'상담자 수정')" class="rounded-lg border border-amber-200 bg-white px-3 py-1.5 text-xs font-extrabold text-amber-700 hover:bg-amber-50">확정 취소</button>`:`<button type="button" onclick="setCounselingSessionReviewStatus('${c.caseId}','${esc(String(s.id||''))}',${i},'상담자 검토 완료')" class="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-extrabold text-white hover:bg-emerald-700">검토 완료</button>`}<button type="button" onclick="rewriteCounselingSessionWithAI('${c.caseId}',${JSON.stringify(String(c.res.id))},'${esc(String(s.id||''))}',${i})" class="rounded-lg border border-emerald-200 bg-white px-3 py-1.5 text-xs font-extrabold text-emerald-700 hover:bg-emerald-50">AI 다시 작성</button><button type="button" onclick="printCounselingSessionRecord('${c.caseId}','${esc(String(s.id||''))}',${i})" class="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-extrabold text-slate-700 hover:bg-slate-100">PDF / 인쇄</button><button type="button" onclick="openCounselingSessionEditor('${c.caseId}','${esc(String(s.id||''))}',${i})" class="rounded-lg border border-purple-200 bg-white px-3 py-1.5 text-xs font-extrabold text-purple-700 hover:bg-purple-50">기록 수정</button><button type="button" onclick="deleteCounselingSessionRecord('${c.caseId}','${esc(String(s.id||''))}',${i})" class="rounded-lg border border-rose-200 bg-white px-3 py-1.5 text-xs font-extrabold text-rose-600 hover:bg-rose-50">기록 삭제</button></div><div class="grid grid-cols-1 gap-3 sm:grid-cols-3"><div><p class="text-[10px] font-extrabold text-slate-400">상담일자</p><p class="mt-1 text-sm font-extrabold">${esc(s.date||c.res.date||'')}</p></div><div><p class="text-[10px] font-extrabold text-slate-400">회기수</p><p class="mt-1 text-sm font-extrabold">${esc(s.sessionNumber||c.sessions.length-i)}회기</p></div><div><p class="text-[10px] font-extrabold text-slate-400">상담방법</p><p class="mt-1 text-sm font-extrabold">${esc(s.counselingMethod||c.res.type||'미정')}</p></div></div><div class="mt-4 grid grid-cols-1 gap-4"><div><p class="text-xs font-extrabold text-emerald-700">의뢰사유</p><p class="mt-1 whitespace-pre-line text-sm leading-relaxed text-slate-700">${esc(s.reason||c.res.applicationForm?.concern||'미입력')}</p></div><div><p class="text-xs font-extrabold text-emerald-700">상담목표</p><p class="mt-1 whitespace-pre-line text-sm leading-relaxed text-slate-700">${esc(s.goal||'미입력')}</p></div><div><p class="text-xs font-extrabold text-emerald-700">상담내용</p><p class="mt-1 whitespace-pre-line text-sm leading-relaxed text-slate-700">${esc(s.content||'미입력')}</p></div><div><p class="text-xs font-extrabold text-emerald-700">상담결과</p><p class="mt-1 whitespace-pre-line text-sm leading-relaxed text-slate-700">${esc(s.result||s.change||'미입력')}</p></div><div><p class="text-xs font-extrabold text-emerald-700">다음회기</p><p class="mt-1 whitespace-pre-line text-sm leading-relaxed text-slate-700">${esc(s.next||'미입력')}</p></div></div>${s.sourceTypes?.length?`<p class="mt-4 text-[10px] font-bold text-purple-600">AI 생성근거: ${s.sourceTypes.map(esc).join(' + ')}</p>`:''}${s.transcriptFile?.name?`<div class="mt-2 rounded-xl border border-purple-100 bg-purple-50 px-3 py-2 text-[11px] font-bold text-purple-700">첨부 축어록: ${esc(s.transcriptFile.name)}${s.transcriptFile.size?` · ${Math.ceil(Number(s.transcriptFile.size)/1024)}KB`:''}</div>`:''}</article>`).join(''):empty('저장된 회기록이 없습니다.')}</div></div></section>`).join('')||empty('상담 사례가 없습니다.')}</div>`);
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
