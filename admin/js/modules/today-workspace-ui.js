console.info('[MML] TODAY-WORKSPACE-UI-STEP22 loaded');

(function(global){
  'use strict';
  const VERSION='20260725-today-workspace-step22';
  const text=v=>String(v??'').trim();
  const arr=v=>Array.isArray(v)?v:[];
  const esc=v=>typeof global.esc==='function'?global.esc(String(v??'')):String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

  function dateOnly(value){
    const source=text(value);
    if(!source)return '';
    const d=new Date(source);
    if(Number.isNaN(d.getTime()))return source.slice(0,10);
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  }

  function today(){
    return dateOnly(new Date());
  }

  function reservationDate(row){
    return dateOnly(row?.scheduledAt||row?.reservationDateTime||row?.reservationDate||row?.date);
  }

  function view(){
    let cases=[],alerts=[],stats={};
    try{
      cases=global.MMLIntegratedWorkflowHub?.allCases?.()||[];
      alerts=global.MMLCaseManagementEngine?.buildAlerts?.()||[];
      stats=global.MMLCaseManagementEngine?.operationalStatistics?.()||{};
    }catch(error){
      return global.layout(`<div class="rounded-2xl bg-rose-50 p-5 text-rose-700">${esc(error.message||error)}</div>`);
    }

    const bundles=cases.map(item=>{
      try{return global.MMLIntegratedWorkflowHub.caseBundle(item.reservationId)}catch(_){return null}
    }).filter(Boolean);
    const todayCases=bundles.filter(b=>reservationDate(b.reservation)===today());
    const pendingReports=bundles.flatMap(b=>arr(b.assessmentCenter.reports)
      .filter(r=>!(r.approved===true||/승인|공개|approved|published/i.test(text(r.status))))
      .map(r=>({reservationId:b.reservationId,report:r,client:b.reservation?.clientName||b.reservation?.name})));
    const recent=bundles.slice().sort((a,b)=>String(b.reservation?.createdAt||b.reservation?.submittedAt).localeCompare(String(a.reservation?.createdAt||a.reservation?.submittedAt))).slice(0,8);

    return global.layout(`<div class="space-y-6">
      <section class="rounded-[2rem] bg-gradient-to-r from-slate-950 via-indigo-950 to-emerald-950 p-6 text-white sm:p-8">
        <p class="text-xs font-extrabold text-emerald-300">TODAY · STEP22</p>
        <h2 class="mt-2 text-2xl font-extrabold">오늘 업무 통합 화면</h2>
        <p class="mt-2 text-sm text-slate-300">상담·승인·주의 사례·최근 예약을 한 화면에서 확인합니다.</p>
        <button onclick="mmlSyncAllClientStates()" class="mt-5 rounded-xl bg-white px-4 py-3 text-xs font-extrabold text-slate-900">홈페이지 상태 전체 동기화</button>
      </section>

      <section class="grid grid-cols-2 gap-3 lg:grid-cols-5">
        ${[
          ['오늘 상담',todayCases.length],
          ['승인 대기',pendingReports.length],
          ['주의 사례',alerts.filter(x=>x.priority==='높음'||x.priority==='주의').length],
          ['진행 사례',stats.activeCases||0],
          ['최근 예약',recent.length]
        ].map(([label,value])=>`<div class="rounded-[1.5rem] border border-slate-100 bg-white p-5 shadow-sm"><p class="text-xs font-extrabold text-slate-400">${esc(label)}</p><p class="mt-3 text-3xl font-extrabold">${value}</p></div>`).join('')}
      </section>

      <section class="grid gap-5 xl:grid-cols-2">
        <div class="rounded-[2rem] border border-slate-100 bg-white p-6">
          <h3 class="text-lg font-extrabold">오늘 상담</h3>
          <div class="mt-4 space-y-3">${todayCases.map(b=>`
            <div class="rounded-2xl border border-slate-100 bg-slate-50 p-4">
              <div class="flex items-center justify-between gap-3"><p class="font-extrabold">${esc(b.reservation?.clientName||b.reservation?.name||'이름 미확인')}</p><span class="text-xs text-slate-400">${esc(b.reservation?.reservationTime||'시간 미확인')}</span></div>
              <p class="mt-2 text-xs text-slate-500">${esc(b.reservation?.programName||b.reservation?.program||'프로그램 미확인')}</p>
              <div class="mt-3 flex gap-2"><button onclick="setMenu('clinicalTimeline')" class="rounded-xl bg-slate-900 px-3 py-2 text-xs font-extrabold text-white">사례관리</button><button onclick="mmlSyncClientState('${esc(b.reservationId)}')" class="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-extrabold">상태 동기화</button></div>
            </div>`).join('')||'<p class="text-sm text-slate-400">오늘 예정된 상담이 없습니다.</p>'}</div>
        </div>

        <div class="rounded-[2rem] border border-amber-100 bg-amber-50 p-6">
          <h3 class="text-lg font-extrabold">승인 대기</h3>
          <div class="mt-4 space-y-3">${pendingReports.slice(0,10).map(item=>`
            <div class="rounded-2xl border border-amber-100 bg-white p-4">
              <p class="font-extrabold">${esc(item.client||'이름 미확인')}</p>
              <p class="mt-1 text-xs text-slate-500">${esc(item.report.title||item.report.reportType||'심리검사 보고서')}</p>
              <button onclick="setMenu('assessmentCenter')" class="mt-3 rounded-xl bg-amber-600 px-3 py-2 text-xs font-extrabold text-white">심리평가센터 열기</button>
            </div>`).join('')||'<p class="text-sm text-amber-700">승인 대기 보고서가 없습니다.</p>'}</div>
        </div>
      </section>

      <section class="grid gap-5 xl:grid-cols-2">
        <div class="rounded-[2rem] border border-rose-100 bg-rose-50 p-6">
          <h3 class="text-lg font-extrabold">주의 사례와 오늘 할 일</h3>
          <div class="mt-4 space-y-3">${alerts.slice(0,12).map(item=>`
            <button onclick="setMenu('clinicalTimeline')" class="block w-full rounded-2xl border border-rose-100 bg-white p-4 text-left">
              <p class="text-sm font-extrabold text-rose-700">${esc(item.message)}</p>
              <p class="mt-1 text-[10px] text-slate-400">${esc(item.reservationId)} · ${esc(item.priority)}</p>
            </button>`).join('')||'<p class="text-sm text-slate-400">확인할 주의 알림이 없습니다.</p>'}</div>
        </div>

        <div class="rounded-[2rem] border border-slate-100 bg-white p-6">
          <h3 class="text-lg font-extrabold">최근 예약</h3>
          <div class="mt-4 space-y-3">${recent.map(b=>`
            <div class="flex items-center justify-between rounded-2xl bg-slate-50 p-4">
              <div><p class="font-extrabold">${esc(b.reservation?.clientName||b.reservation?.name||'이름 미확인')}</p><p class="mt-1 text-xs text-slate-400">${esc(b.reservation?.programName||b.reservation?.program||'프로그램 미확인')}</p></div>
              <button onclick="mmlSyncClientState('${esc(b.reservationId)}')" class="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-extrabold">동기화</button>
            </div>`).join('')||'<p class="text-sm text-slate-400">예약이 없습니다.</p>'}</div>
        </div>
      </section>
    </div>`);
  }

  function syncOne(id){
    try{
      global.MMLServiceStateEngine.syncReservation(id);
      alert('홈페이지 마음기록 상태를 동기화했습니다.');
      if(typeof global.render==='function')global.render();
    }catch(error){alert(error.message||error)}
  }

  function syncAll(){
    try{
      const rows=global.MMLServiceStateEngine.syncAll();
      alert(`${rows.length}건의 홈페이지 상태를 동기화했습니다.`);
      if(typeof global.render==='function')global.render();
    }catch(error){alert(error.message||error)}
  }

  global.mmlSyncClientState=syncOne;
  global.mmlSyncAllClientStates=syncAll;
  global.todayWorkspaceView=view;
  global.MMLTodayWorkspaceUI=Object.freeze({version:VERSION,view,syncOne,syncAll});
})(window);
