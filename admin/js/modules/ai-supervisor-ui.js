console.info('[MML] AI-SUPERVISOR-UI-STEP21 loaded');

(function(global){
  'use strict';
  const VERSION='20260725-ai-supervisor-ui-step21';
  const text=v=>String(v??'').trim();
  const arr=v=>Array.isArray(v)?v:[];
  const esc=v=>typeof global.esc==='function'?global.esc(String(v??'')):String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

  function close(){document.getElementById('mml-supervisor-modal')?.remove()}

  function modal(title,body){
    close();
    const node=document.createElement('div');
    node.id='mml-supervisor-modal';
    node.className='fixed inset-0 z-[120] overflow-y-auto bg-slate-950/60 p-4 backdrop-blur-sm';
    node.innerHTML=`<div class="mx-auto my-8 max-w-4xl rounded-[2rem] bg-white shadow-2xl">
      <div class="flex items-center justify-between border-b border-slate-100 px-6 py-5">
        <h3 class="text-xl font-extrabold">${esc(title)}</h3>
        <button onclick="mmlCloseSupervisor()" class="h-10 w-10 rounded-xl bg-slate-100 text-xl">×</button>
      </div>
      <div class="p-6">${body}</div>
    </div>`;
    document.body.appendChild(node);
  }

  function list(title,items,tone='slate'){
    return `<section class="rounded-2xl border border-${tone}-100 bg-${tone}-50/50 p-5">
      <p class="text-xs font-extrabold text-${tone}-700">${esc(title)}</p>
      <div class="mt-3 space-y-2">${arr(items).map(x=>`<p class="text-sm leading-relaxed text-slate-700">• ${esc(x)}</p>`).join('')||'<p class="text-sm text-slate-400">기록 없음</p>'}</div>
    </section>`;
  }

  function openPre(reservationId){
    try{
      const d=global.MMLAISupervisorEngine.preSessionBrief(reservationId);
      modal('상담 전 AI 슈퍼바이저 브리핑',`
        <div class="grid gap-4 md:grid-cols-2">
          <section class="rounded-2xl bg-slate-950 p-5 text-white md:col-span-2">
            <p class="text-xs font-extrabold text-emerald-300">이번 사례 핵심</p>
            <p class="mt-3 text-sm leading-relaxed">${esc(d.caseCore)}</p>
          </section>
          ${list('오늘 반드시 확인할 내용',d.mustCheck,'amber')}
          ${list('추천 질문',d.suggestedQuestions,'indigo')}
          ${list('위험요인',d.riskFactors,'rose')}
          ${list('보호요인',d.protectiveFactors,'emerald')}
          <div class="md:col-span-2">${list('추천 상담 접근',d.recommendedApproaches,'slate')}</div>
        </div>`);
    }catch(e){alert(e.message||e)}
  }

  function openCaseReview(reservationId){
    try{
      const d=global.MMLAISupervisorEngine.wholeCaseReview(reservationId);
      modal('사례 전체 AI 슈퍼비전',`
        <div class="space-y-4">
          <div class="grid grid-cols-2 gap-3 md:grid-cols-4">
            <div class="rounded-2xl bg-slate-50 p-4"><p class="text-xs text-slate-400">누적 회기</p><p class="mt-2 text-2xl font-extrabold">${d.sessionCount}</p></div>
            <div class="rounded-2xl bg-emerald-50 p-4"><p class="text-xs text-emerald-700">좋아진 부분</p><p class="mt-2 text-2xl font-extrabold">${d.improved.length}</p></div>
            <div class="rounded-2xl bg-amber-50 p-4"><p class="text-xs text-amber-700">반복 패턴</p><p class="mt-2 text-2xl font-extrabold">${d.repeatedPatterns.length}</p></div>
            <div class="rounded-2xl bg-rose-50 p-4"><p class="text-xs text-rose-700">위험 확인</p><p class="mt-2 text-2xl font-extrabold">${d.riskReview.length}</p></div>
          </div>
          ${list('좋아진 부분',d.improved,'emerald')}
          ${list('반복되는 패턴',d.repeatedPatterns,'amber')}
          ${list('아직 남아 있는 어려움',d.remainingDifficulties,'rose')}
          ${list('상담 전략 조정 제안',d.strategySuggestions,'indigo')}
          <section class="rounded-2xl border border-slate-100 p-5">
            <p class="text-xs font-extrabold text-slate-500">회기 흐름</p>
            <div class="mt-3 space-y-3">${d.trajectory.map(x=>`<div class="rounded-xl bg-slate-50 p-4"><p class="text-xs font-extrabold text-indigo-600">${esc(x.phase)}</p><p class="mt-2 text-sm leading-relaxed">${esc(x.summary||'요약 없음')}</p></div>`).join('')||'<p class="text-sm text-slate-400">상담기록 없음</p>'}</div>
          </section>
        </div>`);
    }catch(e){alert(e.message||e)}
  }

  function openCopilot(reservationId){
    modal('상담 중 AI 코파일럿',`
      <label class="block"><span class="text-xs font-extrabold text-slate-500">상담 중 메모</span>
        <textarea id="mml-copilot-note" rows="8" class="mt-2 w-full rounded-2xl border border-slate-200 p-4 text-sm" placeholder="상담사가 관찰한 핵심 내용이나 내담자의 표현을 입력하세요."></textarea>
      </label>
      <button onclick="mmlRunCopilot('${esc(reservationId)}')" class="mt-4 rounded-xl bg-slate-900 px-5 py-3 text-sm font-extrabold text-white">제안 확인</button>
      <div id="mml-copilot-result" class="mt-5"></div>`);
  }

  function runCopilot(reservationId){
    const note=document.getElementById('mml-copilot-note')?.value||'';
    const d=global.MMLAISupervisorEngine.liveCopilot(note,reservationId);
    document.getElementById('mml-copilot-result').innerHTML=list('AI 제안',d.suggestions,'indigo');
  }

  function openPost(sessionId){
    try{
      const d=global.MMLAISupervisorEngine.afterSessionFeedback(sessionId);
      modal('상담 후 AI 피드백',`
        <div class="space-y-4">
          ${list('잘된 점',d.strengths,'emerald')}
          ${list('더 탐색할 부분',d.exploreFurther,'amber')}
          ${list('다음 회기 추천',d.nextSessionRecommendations,'indigo')}
          ${list('놓친 위험신호 재확인',d.missedRiskSignals,'rose')}
          <section class="rounded-2xl border border-slate-100 p-5">
            <p class="text-xs font-extrabold text-slate-500">상담 품질 참고지표</p>
            <div class="mt-4 grid grid-cols-2 gap-3 md:grid-cols-5">
              ${[
                ['열린 질문',`${d.quality.openQuestionRatio}%`],
                ['공감 표현',d.quality.empathyCount],
                ['요약',d.quality.summaryCount],
                ['조언 표현',d.quality.adviceCount],
                ['내담자 발화',`${d.quality.clientSpeechRatio}%`]
              ].map(([a,b])=>`<div class="rounded-xl bg-slate-50 p-3 text-center"><p class="text-[10px] font-bold text-slate-400">${a}</p><p class="mt-2 text-xl font-extrabold">${b}</p></div>`).join('')}
            </div>
            <div class="mt-4 space-y-2">${d.quality.interpretation.map(x=>`<p class="text-sm text-slate-600">• ${esc(x)}</p>`).join('')}</div>
          </section>
        </div>`);
    }catch(e){alert(e.message||e)}
  }

  const previous=global.clinicalTimelineView;
  function enhanced(){
    const original=typeof previous==='function'?previous():'';
    const marker='AI 사례관리 실사용 대시보드';
    if(!original.includes(marker))return original;
    const insert=`<section class="rounded-[2rem] border border-indigo-100 bg-indigo-50/60 p-5">
      <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div><p class="text-xs font-extrabold text-indigo-700">AI SUPERVISOR · STEP21</p><h3 class="mt-1 text-lg font-extrabold">상담사 지원 도구</h3><p class="mt-1 text-xs text-slate-500">각 사례 카드의 예약 ID를 기준으로 상담 전 브리핑·코파일럿·사례 검토를 실행합니다.</p></div>
      </div>
    </section>`;
    return original.replace('<div class="space-y-6">','<div class="space-y-6">'+insert);
  }

  function attachButtons(){
    document.querySelectorAll('[id^="mml-case-"]').forEach(node=>{
      if(node.querySelector('.mml-supervisor-actions'))return;
      const id=node.id.replace('mml-case-','');
      const host=node.querySelector('section');
      if(!host)return;
      const sessions=global.MMLIntegratedWorkflowHub?.caseBundle?.(id)?.electronicChart?.counseling||[];
      const latest=arr(sessions).slice().sort((a,b)=>String(b.createdAt).localeCompare(String(a.createdAt)))[0];
      const bar=document.createElement('div');
      bar.className='mml-supervisor-actions mt-4 flex flex-wrap gap-2 border-t border-slate-100 pt-4';
      bar.innerHTML=`
        <button onclick="mmlOpenSupervisorPre('${esc(id)}')" class="rounded-xl bg-indigo-600 px-3 py-2.5 text-xs font-extrabold text-white">상담 전 브리핑</button>
        <button onclick="mmlOpenSupervisorCopilot('${esc(id)}')" class="rounded-xl bg-slate-900 px-3 py-2.5 text-xs font-extrabold text-white">상담 중 코파일럿</button>
        <button onclick="mmlOpenSupervisorCase('${esc(id)}')" class="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-xs font-extrabold text-slate-700">사례 전체 검토</button>
        ${latest?`<button onclick="mmlOpenSupervisorPost('${esc(latest.id)}')" class="rounded-xl bg-emerald-600 px-3 py-2.5 text-xs font-extrabold text-white">상담 후 피드백</button>`:''}`;
      host.appendChild(bar);
    });
  }

  const observer=new MutationObserver(()=>attachButtons());
  document.addEventListener('DOMContentLoaded',()=>{
    observer.observe(document.body,{childList:true,subtree:true});
    setTimeout(attachButtons,200);
  });

  global.clinicalTimelineView=enhanced;
  global.mmlCloseSupervisor=close;
  global.mmlOpenSupervisorPre=openPre;
  global.mmlOpenSupervisorCopilot=openCopilot;
  global.mmlRunCopilot=runCopilot;
  global.mmlOpenSupervisorPost=openPost;
  global.mmlOpenSupervisorCase=openCaseReview;

  global.MMLAISupervisorUI=Object.freeze({version:VERSION,openPre,openCopilot,openPost,openCaseReview});
})(window);
