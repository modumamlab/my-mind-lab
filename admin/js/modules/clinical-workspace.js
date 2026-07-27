console.info('[MML] CLINICAL-WORKSPACE-MODULE-V25 loaded');

function clinicalTimelineKey(caseId){return `modumam_clinical_timeline_${caseId}`}
function clinicalTimelineForCase(caseId){return load(clinicalTimelineKey(caseId),{})}

function clinicalProgress(c){
  const sessions=load('modumam_case_sessions_'+c.caseId,[]);
  const reviewed=sessions.filter(s=>s.reviewStatus==='상담자 검토 완료');
  const formulation=load('modumam_case_formulation_'+c.caseId,{});
  const plan=typeof counselingPlanForCase==='function'?counselingPlanForCase(c.caseId):{};
  const supervision=typeof counselingSupervisionForCase==='function'?counselingSupervisionForCase(c.caseId):{};
  const quality=typeof counselingRecordQualityForCase==='function'?counselingRecordQualityForCase(c.caseId):{};
  const report=typeof clinicalCaseReportForCase==='function'?clinicalCaseReportForCase(c.caseId):{};
  const termination=getTerminationRecord(c.res.id);
  const has=obj=>Object.entries(obj||{}).some(([k,v])=>!['updatedAt','generatedAt','model','promptVersion','reviewed','reviewedAt'].includes(k)&&String(v??'').trim());

  return {
    sessions,reviewed,formulation,plan,supervision,quality,report,termination,
    formulationScore:has(formulation)?100:0,
    planScore:has(plan)?100:0,
    sessionScore:sessions.length?Math.round(reviewed.length/sessions.length*100):0,
    supervisionScore:supervision.generatedAt?(supervision.reviewed?100:80):0,
    qualityScore:quality.generatedAt?100:0,
    reportScore:report.generatedAt?(report.reviewed?100:80):0,
    terminationScore:(termination.reviewed||termination.aiGeneratedAt)?(termination.reviewed?100:70):0
  };
}

function clinicalAlerts(c){
  const p=clinicalProgress(c);
  const alerts=[];
  const status=normalizeStatus(c.res.status);
  if(!p.formulationScore)alerts.push(['높음','사례개념화 미작성']);
  if(p.formulationScore&&!p.planScore)alerts.push(['높음','상담계획 미작성']);
  const pending=p.sessions.filter(s=>s.reviewStatus!=='상담자 검토 완료').length;
  if(pending)alerts.push(['중간',`검토되지 않은 회기 ${pending}건`]);
  if(p.reviewed.length>=2&&!p.supervision.generatedAt)alerts.push(['중간','AI 슈퍼비전 미생성']);
  if(p.reviewed.length>=2&&!p.quality.generatedAt)alerts.push(['중간','상담기록 품질검사 필요']);
  if(p.reviewed.length>=3&&!p.report.generatedAt)alerts.push(['중간','종합사례보고서 작성 가능']);
  if(status==='상담완료'&&!p.termination.aiGeneratedAt&&!p.termination.reviewed)alerts.push(['높음','사례종결평가 필요']);
  const last=p.sessions.map(s=>s.date).filter(Boolean).sort().slice(-1)[0];
  if(last&&!['종결','예약취소'].includes(status)){
    const days=Math.floor((Date.now()-new Date(last).getTime())/86400000);
    if(days>=30)alerts.push(['높음',`마지막 상담 후 ${days}일 경과`]);
    else if(days>=14)alerts.push(['중간',`마지막 상담 후 ${days}일 경과`]);
  }
  return alerts;
}

function clinicalEvents(c){
  const p=clinicalProgress(c);
  const events=[];
  if(c.intake)events.push({date:c.intake.createdAt||c.res.date,type:'접수',title:'초기 접수',detail:c.intake.summary||c.intake.concern||'초기자료 저장'});
  (c.tests||[]).forEach((t,i)=>events.push({date:t.uploadedAt||c.res.date,type:'심리검사',title:t.name||t.testType||`검사 ${i+1}`,detail:t.summary||t.status||'검사자료 연결'}));
  if(p.formulationScore)events.push({date:p.formulation.updatedAt||p.formulation.generatedAt,type:'사례개념화',title:'사례개념화 작성',detail:p.formulation.clinicalHypothesis||p.formulation.currentProblem||''});
  if(p.planScore)events.push({date:p.plan.updatedAt||p.plan.generatedAt,type:'상담계획',title:'상담계획 수립',detail:p.plan.shortTermGoals||p.plan.treatmentRationale||''});
  p.sessions.forEach((s,i)=>events.push({date:s.date,type:`${s.sessionNumber||i+1}회기`,title:s.goal||`상담 ${i+1}회기`,detail:s.result||s.change||s.content||''}));
  if(p.supervision.generatedAt)events.push({date:p.supervision.generatedAt,type:'슈퍼비전',title:'AI 슈퍼비전',detail:p.supervision.priorityActions||p.supervision.nextSessionSuggestions||''});
  if(p.quality.generatedAt)events.push({date:p.quality.generatedAt,type:'품질검사',title:`기록 품질 ${p.quality.totalScore||0}점`,detail:p.quality.priorityImprovements||p.quality.overallFeedback||''});
  if(p.report.generatedAt)events.push({date:p.report.generatedAt,type:'종합보고서',title:'AI 종합사례보고서',detail:p.report.currentClinicalView||p.report.changeAndOutcome||''});
  if(p.termination.reviewed||p.termination.aiGeneratedAt)events.push({date:p.termination.reviewedAt||p.termination.aiGeneratedAt,type:'종결평가',title:'사례종결평가',detail:p.termination.finalOpinion||p.termination.terminationSuitability||''});
  return events.sort((a,b)=>String(a.date||'').localeCompare(String(b.date||'')));
}

function timelineProgress(label,value){
  const v=Math.max(0,Math.min(100,Number(value)||0));
  return `<div><div class="flex justify-between text-xs"><span class="font-bold text-slate-600">${esc(label)}</span><span class="font-extrabold">${v}%</span></div><div class="mt-2 h-2 rounded-full bg-slate-100 overflow-hidden"><div class="h-full bg-emerald-500 rounded-full" style="width:${v}%"></div></div></div>`;
}

async function generateClinicalTimelineSummary(caseId){
  const c=buildCases().find(x=>x.caseId===caseId);
  if(!c||state.clinicalTimelineLoading[caseId])return;
  const p=clinicalProgress(c);
  if(!p.reviewed.length){alert('상담자 검토 완료 회기기록이 1건 이상 필요합니다.');return}
  state.clinicalTimelineLoading[caseId]=true;render();
  try{
    const response=await fetch('/.netlify/functions/clinical-timeline-summary',{
      method:'POST',headers:{'Content-Type':'application/json'},
      body:JSON.stringify({
        clientName:c.res.name||'내담자',
        program:programBaseName(c.res.program),
        currentStatus:normalizeStatus(c.res.status),
        intake:c.intake||{},
        formulation:p.formulation,
        counselingPlan:p.plan,
        clinicalCaseReport:p.report,
        termination:p.termination,
        sessions:p.reviewed
      })
    });
    const data=await response.json().catch(()=>({}));
    if(!response.ok||!data.timeline)throw new Error(data.error||'AI 변화요약 생성 실패');
    save(clinicalTimelineKey(caseId),{...data.timeline,generatedAt:new Date().toISOString(),model:data.model||'',promptVersion:data.promptVersion||''});
    alert('AI 변화요약이 생성되었습니다.');
  }catch(error){console.error('[MML TIMELINE]',error);alert(error.message||'AI 변화요약 오류')}
  finally{state.clinicalTimelineLoading[caseId]=false;render()}
}
window.generateClinicalTimelineSummary=generateClinicalTimelineSummary;

function clinicalTimelineView(){
  const cases=buildCases().filter(c=>normalizeStatus(c.res.status)!=='예약취소').sort((a,b)=>String(b.res.date||'').localeCompare(String(a.res.date||'')));
  const allAlerts=cases.flatMap(c=>clinicalAlerts(c).map(a=>({c,level:a[0],text:a[1]})));
  return layout(`<div class="space-y-6">
    <div class="rounded-[2rem] bg-gradient-to-r from-slate-950 via-indigo-950 to-emerald-950 p-6 text-white shadow-xl sm:p-8">
      <p class="text-xs font-extrabold text-emerald-300">AI CLINICAL TIMELINE</p>
      <h2 class="mt-2 text-2xl font-extrabold">AI 사례관리 대시보드</h2>
      <p class="mt-2 text-sm text-slate-300">접수부터 종결까지 사례의 진행상태와 임상적 변화 흐름을 한 화면에서 확인합니다.</p>
    </div>

    <section class="rounded-[2rem] border border-amber-100 bg-amber-50 p-5">
      <div class="flex justify-between"><h3 class="text-lg font-extrabold">사례관리 알림</h3><span class="rounded-full bg-amber-100 px-3 py-1 text-xs font-extrabold text-amber-700">${allAlerts.length}건</span></div>
      <div class="mt-4 grid grid-cols-1 gap-3 lg:grid-cols-2">
        ${allAlerts.map(x=>`<div class="rounded-2xl border ${x.level==='높음'?'border-rose-100 bg-rose-50':'border-amber-100 bg-white'} p-4"><p class="text-sm font-extrabold">${esc(x.c.res.name)}님 · ${esc(x.text)}</p><p class="mt-1 text-xs text-slate-500">${esc(programBaseName(x.c.res.program))} · ${esc(normalizeStatus(x.c.res.status))}</p></div>`).join('')||'<p class="text-sm text-slate-500">확인할 알림이 없습니다.</p>'}
      </div>
    </section>

    ${cases.map(c=>{
      const p=clinicalProgress(c), timeline=clinicalTimelineForCase(c.caseId), events=clinicalEvents(c), alerts=clinicalAlerts(c);
      const overall=Math.round((p.formulationScore+p.planScore+p.sessionScore+p.supervisionScore+p.qualityScore+p.reportScore+p.terminationScore)/7);
      return `<section class="rounded-[2rem] border border-slate-100 bg-white p-5 shadow-sm sm:p-6">
        <div class="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div><div class="flex flex-wrap items-center gap-2"><h3 class="text-xl font-extrabold">${esc(c.res.name)}님</h3><span class="rounded-full px-3 py-1 text-xs font-bold ${statusClass(c.res.status)}">${esc(normalizeStatus(c.res.status))}</span><span class="rounded-full bg-slate-100 px-3 py-1 text-xs font-extrabold">전체 진행률 ${overall}%</span></div><p class="mt-2 text-sm text-slate-500">${esc(programBaseName(c.res.program))} · ${esc(c.res.type||'')} · 사례번호 ${esc(c.res.caseNumber||c.caseId)}</p></div>
          <button onclick="generateClinicalTimelineSummary('${c.caseId}')" ${state.clinicalTimelineLoading[c.caseId]?'disabled':''} class="rounded-xl bg-indigo-600 px-4 py-3 text-xs font-extrabold text-white disabled:opacity-50">${state.clinicalTimelineLoading[c.caseId]?'분석 중...':timeline.generatedAt?'AI 변화요약 다시 생성':'AI 변화요약 생성'}</button>
        </div>

        ${alerts.length?`<div class="mt-4 flex flex-wrap gap-2">${alerts.map(a=>`<span class="rounded-full px-3 py-1 text-[11px] font-extrabold ${a[0]==='높음'?'bg-rose-100 text-rose-700':'bg-amber-100 text-amber-700'}">${esc(a[1])}</span>`).join('')}</div>`:''}

        <div class="mt-5 grid grid-cols-1 gap-5 xl:grid-cols-[300px_1fr]">
          <div class="rounded-[1.5rem] border border-slate-100 bg-slate-50 p-5"><p class="text-xs font-extrabold text-slate-500">진행률</p><div class="mt-4 space-y-4">
            ${timelineProgress('사례개념화',p.formulationScore)}
            ${timelineProgress('상담계획',p.planScore)}
            ${timelineProgress('회기기록 검토',p.sessionScore)}
            ${timelineProgress('AI 슈퍼비전',p.supervisionScore)}
            ${timelineProgress('기록 품질검사',p.qualityScore)}
            ${timelineProgress('종합사례보고서',p.reportScore)}
            ${timelineProgress('사례종결평가',p.terminationScore)}
          </div></div>
          <div class="rounded-[1.5rem] border border-slate-100 bg-white p-5">
            <h4 class="text-lg font-extrabold">Clinical Timeline</h4>
            <div class="mt-5 space-y-4">${events.map((e,i)=>`<div class="relative pl-8">${i<events.length-1?'<div class="absolute left-[9px] top-5 h-[calc(100%+12px)] w-px bg-slate-200"></div>':''}<div class="absolute left-0 top-1 h-5 w-5 rounded-full border-4 border-white bg-indigo-500 shadow"></div><div class="rounded-2xl border border-slate-100 bg-slate-50 p-4"><div class="flex justify-between gap-2"><div><span class="rounded-full bg-white px-2 py-1 text-[10px] font-extrabold">${esc(e.type)}</span><h5 class="mt-2 text-sm font-extrabold">${esc(e.title)}</h5></div><span class="text-[10px] text-slate-400">${e.date?esc(new Date(e.date).toLocaleDateString('ko-KR')):''}</span></div><p class="mt-2 text-xs leading-relaxed text-slate-600">${esc(String(e.detail||'').slice(0,500))}</p></div></div>`).join('')||'<p class="text-sm text-slate-400">표시할 기록이 없습니다.</p>'}</div>
          </div>
        </div>

        <div class="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-2">
          <div class="rounded-[1.5rem] border border-indigo-100 bg-indigo-50/40 p-5"><p class="text-xs font-extrabold text-indigo-700">AI 변화 요약</p><p class="mt-3 whitespace-pre-wrap text-sm leading-relaxed">${esc(timeline.changeSummary||'AI 변화요약을 생성하면 초기부터 현재까지의 흐름이 표시됩니다.')}</p></div>
          <div class="rounded-[1.5rem] border border-emerald-100 bg-emerald-50/40 p-5"><p class="text-xs font-extrabold text-emerald-700">현재 회복 흐름</p><p class="mt-3 whitespace-pre-wrap text-sm leading-relaxed">${esc(timeline.currentRecoveryFlow||'')}</p></div>
          <div class="rounded-[1.5rem] border border-amber-100 bg-amber-50/40 p-5"><p class="text-xs font-extrabold text-amber-700">유지되는 어려움</p><p class="mt-3 whitespace-pre-wrap text-sm leading-relaxed">${esc(timeline.remainingDifficulties||'')}</p></div>
          <div class="rounded-[1.5rem] border border-rose-100 bg-rose-50/40 p-5"><p class="text-xs font-extrabold text-rose-700">다음 임상 확인사항</p><p class="mt-3 whitespace-pre-wrap text-sm leading-relaxed">${esc(timeline.nextClinicalChecks||'')}</p></div>
        </div>
      </section>`;
    }).join('')||empty('진행 중인 사례가 없습니다.')}
  </div>`);
}


/* =========================================================
   AI 임상 의사결정 지원 · CLINICAL DSS V24
========================================================= */
function clinicalDssKey(caseId){return `modumam_clinical_dss_${caseId}`}
function clinicalDssForCase(caseId){return load(clinicalDssKey(caseId),{})}

function dssLevelClass(level){
  const v=String(level||'');
  if(v.includes('긴급')||v.includes('높음'))return 'bg-rose-100 text-rose-700 border-rose-200';
  if(v.includes('주의')||v.includes('중간'))return 'bg-amber-100 text-amber-700 border-amber-200';
  if(v.includes('낮음'))return 'bg-emerald-100 text-emerald-700 border-emerald-200';
  return 'bg-slate-100 text-slate-600 border-slate-200';
}

function dssArray(value){return Array.isArray(value)?value:[]}
function dssEvidenceText(item){
  if(typeof item==='string')return item;
  return [item?.source,item?.location,item?.evidence,item?.note].filter(Boolean).join(' · ');
}

async function generateClinicalDss(caseId){
  const c=buildCases().find(x=>x.caseId===caseId);
  if(!c||state.clinicalDssLoading[caseId])return;
  const p=clinicalProgress(c);
  if(!p.reviewed.length&&!c.tests?.length){
    alert('임상 의사결정 지원을 실행하려면 상담자 검토 완료 회기기록 또는 심리검사 자료가 필요합니다.');
    return;
  }

  state.clinicalDssLoading[caseId]=true;render();
  try{
    const response=await fetch('/.netlify/functions/clinical-decision-support',{
      method:'POST',headers:{'Content-Type':'application/json'},
      body:JSON.stringify({
        caseId:c.caseId,
        clientName:c.res.name||'내담자',
        program:programBaseName(c.res.program),
        currentStatus:normalizeStatus(c.res.status),
        intake:c.intake||{},
        tests:c.tests||[],
        formulation:p.formulation||{},
        counselingPlan:p.plan||{},
        sessions:p.reviewed||[],
        supervision:p.supervision||{},
        recordQuality:p.quality||{},
        clinicalCaseReport:p.report||{},
        termination:p.termination||{}
      })
    });
    const data=await response.json().catch(()=>({}));
    if(!response.ok||!data.result)throw new Error(data.error||'임상 의사결정 지원 생성에 실패했습니다.');
    save(clinicalDssKey(caseId),{
      ...data.result,
      generatedAt:new Date().toISOString(),
      model:data.model||'',promptVersion:data.promptVersion||''
    });
    alert('AI 임상 의사결정 지원 결과가 생성되었습니다. 상담자 검토 후 사용하세요.');
  }catch(error){
    console.error('[MML CLINICAL DSS]',error);
    alert(error?.message||'AI 임상 의사결정 지원 생성 중 오류가 발생했습니다.');
  }finally{
    state.clinicalDssLoading[caseId]=false;render();
  }
}
window.generateClinicalDss=generateClinicalDss;

function clinicalDssView(){
  const cases=buildCases().filter(c=>normalizeStatus(c.res.status)!=='예약취소').sort((a,b)=>String(b.res.date||'').localeCompare(String(a.res.date||'')));
  const completed=cases.filter(c=>clinicalDssForCase(c.caseId).generatedAt).length;
  const urgent=cases.filter(c=>String(clinicalDssForCase(c.caseId).overallRiskLevel||'').includes('긴급')||String(clinicalDssForCase(c.caseId).overallRiskLevel||'').includes('높음')).length;
  const insufficient=cases.filter(c=>String(clinicalDssForCase(c.caseId).dataSufficiencyLevel||'').includes('부족')).length;

  return layout(`<div class="space-y-6">
    <div class="rounded-[2rem] bg-gradient-to-r from-slate-950 via-rose-950 to-indigo-950 p-6 text-white shadow-xl sm:p-8">
      <div class="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <p class="text-xs font-extrabold text-rose-300">CLINICAL DECISION SUPPORT</p>
          <h2 class="mt-2 text-2xl font-extrabold">AI 임상 의사결정 지원</h2>
          <p class="mt-2 max-w-3xl text-sm leading-relaxed text-slate-300">상담자의 판단을 대신하지 않고, 위험 신호·자료 누락·기록 간 불일치·근거 위치를 점검합니다. 긴급 위험은 AI 결과만으로 판단하지 말고 즉시 직접 평가해야 합니다.</p>
        </div>
        <div class="grid grid-cols-3 gap-3">
          <div class="rounded-2xl bg-white/10 px-4 py-3 text-center"><p class="text-[10px] text-slate-300">분석 완료</p><p class="mt-1 text-xl font-black">${completed}</p></div>
          <div class="rounded-2xl bg-rose-500/20 px-4 py-3 text-center"><p class="text-[10px] text-rose-100">우선 확인</p><p class="mt-1 text-xl font-black">${urgent}</p></div>
          <div class="rounded-2xl bg-amber-500/20 px-4 py-3 text-center"><p class="text-[10px] text-amber-100">자료 부족</p><p class="mt-1 text-xl font-black">${insufficient}</p></div>
        </div>
      </div>
    </div>

    <div class="rounded-[1.75rem] border border-rose-100 bg-rose-50 p-5 text-xs leading-relaxed text-rose-900">
      <strong>안전 원칙:</strong> 자살·자해·타해·학대·응급 신호가 의심되는 경우 이 화면의 등급과 무관하게 직접 위험평가, 보호자·기관 보고, 응급기관 연계 등 현장 절차를 우선합니다. 자료가 없으면 “위험 없음”이 아니라 “평가자료 부족”으로 봅니다.
    </div>

    ${cases.map(c=>{
      const p=clinicalProgress(c),d=clinicalDssForCase(c.caseId);
      const risks=dssArray(d.riskReview), checks=dssArray(d.consistencyChecks), traces=dssArray(d.evidenceTrace), missing=dssArray(d.missingEvidence), actions=dssArray(d.priorityActions);
      return `<section class="rounded-[2rem] border border-slate-100 bg-white p-5 shadow-sm sm:p-6">
        <div class="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div>
            <div class="flex flex-wrap items-center gap-2"><h3 class="text-xl font-extrabold">${esc(c.res.name)}님</h3><span class="rounded-full px-3 py-1 text-xs font-bold ${statusClass(c.res.status)}">${esc(normalizeStatus(c.res.status))}</span>${d.overallRiskLevel?`<span class="rounded-full border px-3 py-1 text-xs font-extrabold ${dssLevelClass(d.overallRiskLevel)}">종합 위험 ${esc(d.overallRiskLevel)}</span>`:''}${d.caseQualityScore!==undefined?`<span class="rounded-full bg-indigo-100 px-3 py-1 text-xs font-extrabold text-indigo-700">사례 품질 ${esc(d.caseQualityScore)}점</span>`:''}</div>
            <p class="mt-2 text-sm text-slate-500">${esc(programBaseName(c.res.program))} · 검토 회기 ${p.reviewed.length}건 · 검사자료 ${(c.tests||[]).length}건</p>
          </div>
          <button onclick="generateClinicalDss('${c.caseId}')" ${state.clinicalDssLoading[c.caseId]?'disabled':''} class="rounded-xl bg-rose-700 px-4 py-3 text-xs font-extrabold text-white disabled:opacity-50">${state.clinicalDssLoading[c.caseId]?'점검 중...':d.generatedAt?'임상 점검 다시 실행':'AI 임상 점검 실행'}</button>
        </div>

        ${d.generatedAt?`<div class="mt-5 grid grid-cols-1 gap-4 xl:grid-cols-4">
          <div class="rounded-[1.5rem] border border-slate-100 bg-slate-50 p-5"><p class="text-xs font-extrabold text-slate-500">자료 충분성</p><p class="mt-2 text-lg font-black">${esc(d.dataSufficiencyLevel||'미분류')}</p><p class="mt-2 text-xs leading-relaxed text-slate-600">${esc(d.dataSufficiencyReason||'')}</p></div>
          <div class="rounded-[1.5rem] border border-indigo-100 bg-indigo-50/40 p-5"><p class="text-xs font-extrabold text-indigo-700">평가 일관성</p><p class="mt-2 text-lg font-black">${esc(d.consistencyScore??'-')}점</p><p class="mt-2 text-xs leading-relaxed text-slate-600">${esc(d.consistencySummary||'')}</p></div>
          <div class="rounded-[1.5rem] border border-emerald-100 bg-emerald-50/40 p-5"><p class="text-xs font-extrabold text-emerald-700">목표 연결성</p><p class="mt-2 text-lg font-black">${esc(d.goalAlignmentScore??'-')}점</p><p class="mt-2 text-xs leading-relaxed text-slate-600">${esc(d.goalAlignmentSummary||'')}</p></div>
          <div class="rounded-[1.5rem] border border-amber-100 bg-amber-50/40 p-5"><p class="text-xs font-extrabold text-amber-700">종결 적절성</p><p class="mt-2 text-lg font-black">${esc(d.terminationReadiness||'미평가')}</p><p class="mt-2 text-xs leading-relaxed text-slate-600">${esc(d.terminationReadinessReason||'')}</p></div>
        </div>

        <div class="mt-5 grid grid-cols-1 gap-5 xl:grid-cols-2">
          <div class="rounded-[1.5rem] border border-rose-100 bg-rose-50/30 p-5"><h4 class="text-sm font-extrabold text-rose-800">위험 신호 점검</h4><div class="mt-4 space-y-3">${risks.map(r=>`<div class="rounded-2xl border border-white bg-white p-4"><div class="flex items-center justify-between gap-2"><p class="text-sm font-extrabold">${esc(r.category||'위험 항목')}</p><span class="rounded-full border px-2 py-1 text-[10px] font-extrabold ${dssLevelClass(r.level)}">${esc(r.level||'자료 부족')}</span></div><p class="mt-2 text-xs leading-relaxed text-slate-600">${esc(r.evidence||r.reason||'직접 근거가 확인되지 않았거나 평가자료가 부족합니다.')}</p><p class="mt-2 text-[10px] text-slate-400">권고: ${esc(r.recommendedAction||'직접 확인')}</p></div>`).join('')||'<p class="text-sm text-slate-400">위험 점검 결과가 없습니다.</p>'}</div></div>
          <div class="rounded-[1.5rem] border border-indigo-100 bg-indigo-50/30 p-5"><h4 class="text-sm font-extrabold text-indigo-800">기록 간 일관성 점검</h4><div class="mt-4 space-y-3">${checks.map(x=>`<div class="rounded-2xl bg-white p-4"><div class="flex items-center justify-between"><p class="text-sm font-extrabold">${esc(x.item||'점검 항목')}</p><span class="text-[10px] font-extrabold ${String(x.status).includes('불일치')?'text-rose-600':String(x.status).includes('부족')?'text-amber-600':'text-emerald-600'}">${esc(x.status||'확인 필요')}</span></div><p class="mt-2 text-xs leading-relaxed text-slate-600">${esc(x.explanation||'')}</p></div>`).join('')||'<p class="text-sm text-slate-400">일관성 점검 결과가 없습니다.</p>'}</div></div>
          <div class="rounded-[1.5rem] border border-cyan-100 bg-cyan-50/30 p-5"><h4 class="text-sm font-extrabold text-cyan-800">근거 추적</h4><div class="mt-4 space-y-2">${traces.map(x=>`<div class="rounded-xl bg-white p-3"><p class="text-xs font-extrabold">${esc(x.claim||x.item||'AI 판단 근거')}</p><p class="mt-1 text-xs text-slate-600">${esc(dssEvidenceText(x))}</p></div>`).join('')||'<p class="text-sm text-slate-400">추적 가능한 근거가 없습니다.</p>'}</div></div>
          <div class="rounded-[1.5rem] border border-amber-100 bg-amber-50/30 p-5"><h4 class="text-sm font-extrabold text-amber-800">누락·추가 확인 자료</h4><div class="mt-4 space-y-2">${missing.map(x=>`<div class="rounded-xl bg-white p-3 text-xs leading-relaxed text-slate-700">${esc(typeof x==='string'?x:(x.item||x.reason||''))}</div>`).join('')||'<p class="text-sm text-slate-400">현재 식별된 누락자료가 없습니다.</p>'}</div></div>
        </div>

        <div class="mt-5 rounded-[1.5rem] border border-slate-200 bg-slate-950 p-5 text-white"><p class="text-xs font-extrabold text-emerald-300">상담자 우선 확인</p><div class="mt-3 grid grid-cols-1 gap-2 lg:grid-cols-2">${actions.map((x,i)=>`<div class="rounded-xl bg-white/10 p-3 text-sm"><strong>${i+1}.</strong> ${esc(typeof x==='string'?x:(x.action||x.item||''))}</div>`).join('')||'<p class="text-sm text-slate-300">우선 확인사항이 없습니다.</p>'}</div></div>
        `:`<div class="mt-5 rounded-[1.5rem] border border-dashed border-slate-200 bg-slate-50 p-8 text-center"><p class="text-sm font-bold text-slate-600">AI 임상 점검을 실행하면 위험 신호, 기록 일관성, 근거 추적과 사례 품질 점수가 표시됩니다.</p></div>`}
      </section>`;
    }).join('')||empty('분석할 사례가 없습니다.')}
  </div>`);
}
