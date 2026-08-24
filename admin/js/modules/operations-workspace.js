console.info('[MML] OPERATIONS-WORKSPACE-MODULE-V30-SHARED-PROVIDER loaded');

// 오늘 상담은 dashboardView 안에 통합되었습니다.


// [MOD-20260715-CENTER2-SPRINT10] 운영비서 브리핑
// 예약·검사·보고서·상담 데이터를 바탕으로 오늘 우선순위를 자동 정리합니다.
function operatingSecretaryData(){
  const today=todayReservations().slice().sort((a,b)=>String(a.time||'').localeCompare(String(b.time||'')));
  const tasks=automatedTasks();
  const nowDate=new Date().toISOString().slice(0,10);
  const overdue=state.reservations.filter(r=>{
    const st=normalizeStatus(r.status);
    return r.date && r.date<nowDate && !['상담완료','종결','예약취소'].includes(st);
  });
  const taskGroups={};
  tasks.forEach(t=>{taskGroups[t.title]=(taskGroups[t.title]||0)+1});
  const topGroups=Object.entries(taskGroups).sort((a,b)=>b[1]-a[1]).slice(0,4);
  const next=today[0]||null;
  const urgent=tasks.filter(t=>t.priority<=5).slice(0,5);
  const lines=[];
  if(next) lines.push(`오늘 가장 가까운 상담은 ${next.time||'시간 미정'} ${next.name}님이며, ${programBaseName(next.program)} · ${next.type||'상담방식 미정'}입니다.`);
  else lines.push('오늘 예정된 상담은 없습니다.');
  if(tasks.length) lines.push(`현재 자동 생성된 업무는 ${tasks.length}건이며, 우선 처리 업무는 ${urgent.length}건입니다.`);
  else lines.push('현재 추가로 처리할 자동 업무는 없습니다.');
  if(overdue.length) lines.push(`예정일이 지났지만 완료되지 않은 예약이 ${overdue.length}건 있어 확인이 필요합니다.`);
  if(topGroups.length) lines.push(`가장 많은 업무는 ${topGroups.map(([name,count])=>`${name} ${count}건`).join(', ')}입니다.`);
  return {today,tasks,overdue,topGroups,next,urgent,lines};
}
function operatingSecretaryText(){
  const d=operatingSecretaryData();
  const taskLines=d.urgent.length?d.urgent.map((t,i)=>`${i+1}. ${t.reservation.name}님 - ${t.title}`).join('\n'):'우선 처리 업무 없음';
  return `[모두의 마음연구소 오늘 운영 브리핑]\n${d.lines.join('\n')}\n\n[우선 처리]\n${taskLines}`;
}
async function copyOperatingSecretaryBrief(){
  try{
    await navigator.clipboard.writeText(operatingSecretaryText());
    alert('오늘 운영 브리핑을 복사했습니다.');
  }catch(e){
    const ta=document.createElement('textarea');ta.value=operatingSecretaryText();document.body.appendChild(ta);ta.select();document.execCommand('copy');ta.remove();alert('오늘 운영 브리핑을 복사했습니다.');
  }
}
function operatingSecretaryView(){
  const d=operatingSecretaryData();
  return `<section class="mb-6 overflow-hidden rounded-[2rem] border border-indigo-100 bg-gradient-to-br from-indigo-50 via-white to-emerald-50 shadow-sm">
    <div class="grid grid-cols-1 gap-0 xl:grid-cols-3">
      <div class="p-6 sm:p-7 xl:col-span-2">
        <div class="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div><div class="flex items-center gap-2"><span class="rounded-full bg-indigo-600 px-3 py-1 text-[11px] font-extrabold text-white">AI 운영비서</span><span class="text-[11px] font-bold text-slate-400">운영 데이터 자동 요약</span></div><h2 class="mt-3 text-xl font-extrabold text-slate-900">오늘 먼저 확인할 업무입니다.</h2></div>
          <button onclick="copyOperatingSecretaryBrief()" class="shrink-0 rounded-xl border border-indigo-200 bg-white px-4 py-2 text-xs font-extrabold text-indigo-700">브리핑 복사</button>
        </div>
        <div class="mt-5 space-y-2">${d.lines.map((line,i)=>`<div class="flex items-start gap-3 rounded-2xl bg-white/80 px-4 py-3"><span class="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${i===0?'bg-emerald-100 text-emerald-700':i===1?'bg-indigo-100 text-indigo-700':'bg-amber-100 text-amber-700'} text-xs font-extrabold">${i+1}</span><p class="text-sm font-bold leading-relaxed text-slate-700">${esc(line)}</p></div>`).join('')}</div>
      </div>
      <div class="border-t border-indigo-100 bg-white/70 p-6 xl:border-l xl:border-t-0">
        <div class="flex items-center justify-between"><div><p class="text-xs font-extrabold text-rose-600">PRIORITY</p><h3 class="mt-1 text-base font-extrabold">우선 처리 ${d.urgent.length}건</h3></div><button onclick="setMenu('reservation')" class="rounded-xl bg-slate-900 px-3 py-2 text-[11px] font-extrabold text-white">전체 업무</button></div>
        <div class="mt-4 space-y-3">${d.urgent.length?d.urgent.map(t=>`<button onclick="${t.action}" class="w-full rounded-2xl border border-slate-100 bg-white p-3 text-left hover:border-indigo-200"><div class="flex items-center justify-between gap-2"><p class="text-xs font-extrabold text-slate-900">${esc(t.reservation.name)}님</p><span class="rounded-full bg-rose-50 px-2 py-1 text-[10px] font-bold text-rose-600">${esc(normalizeStatus(t.reservation.status))}</span></div><p class="mt-1 text-[11px] font-extrabold text-indigo-700">${esc(t.title)}</p><p class="mt-1 text-[10px] text-slate-400">${esc(t.reservation.date||'')} ${esc(t.reservation.time||'')}</p></button>`).join(''):'<div class="rounded-2xl bg-emerald-50 p-4 text-xs font-bold text-emerald-700">현재 긴급한 우선 업무가 없습니다.</div>'}</div>
      </div>
    </div>
  </section>`;
}

function dashboardView(){
  // ===== [MODUMAM 오늘업무 우선처리·빠른메뉴 삭제 시작] =====
  const today=todayReservations();
  const tasks=automatedTasks();
  const recent=state.reservations
    .slice()
    .sort((a,b)=>Number(b.id||0)-Number(a.id||0))
    .slice(0,5);

  return layout(`<div class="space-y-6">
    <section class="rounded-[2rem] bg-slate-950 p-6 text-white shadow-xl shadow-slate-900/10 sm:p-8">
      <div class="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
        <div>
          <p class="text-xs font-extrabold text-emerald-300">TODAY WORK CENTER</p>
          <h2 class="mt-2 text-2xl font-extrabold sm:text-3xl">오늘 해야 할 일을 확인하세요.</h2>
          <p class="mt-2 max-w-3xl text-sm leading-relaxed text-slate-300">처리가 필요한 내용을 확인한 뒤 해당 관리 페이지로 이동하여 진행합니다.</p>
        </div>
        <button onclick="refreshSharedOperatingData(true)" class="rounded-xl border border-white/20 bg-white/10 px-4 py-3 text-xs font-extrabold text-white hover:bg-white/15">예약 새로 불러오기</button>
      </div>
    </section>

    <section class="rounded-[2rem] border border-slate-100 bg-white p-6 shadow-sm">
      <div class="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p class="text-xs font-extrabold text-rose-600">TODAY TASKS</p>
          <h2 class="mt-1 text-xl font-extrabold">오늘 해야 할 일</h2>
          <p class="mt-1 text-sm text-slate-500">업무 내용을 확인하고 버튼을 눌러 관련 관리 페이지에서 처리하세요.</p>
        </div>
        <span class="w-fit rounded-full bg-slate-100 px-3 py-1 text-xs font-extrabold text-slate-600">${tasks.length}건</span>
      </div>
      <div class="space-y-3">
        ${tasks.length
          ? tasks.slice(0,12).map(automationTaskCard).join('')
          : '<div class="rounded-2xl border border-dashed border-emerald-200 bg-emerald-50 p-8 text-center text-sm font-bold text-emerald-700">현재 처리할 업무가 없습니다.</div>'}
      </div>
    </section>

    <div class="grid grid-cols-1 gap-6 xl:grid-cols-2">
      <section class="rounded-[2rem] border border-slate-100 bg-white p-6 shadow-sm">
        <div class="mb-5 flex items-center justify-between gap-3">
          <div>
            <p class="text-xs font-extrabold text-emerald-600">TODAY</p>
            <h2 class="mt-1 text-xl font-extrabold">오늘 예약</h2>
          </div>
          <span class="rounded-full bg-emerald-50 px-3 py-1 text-xs font-extrabold text-emerald-700">${today.length}건</span>
        </div>
        <div class="space-y-3">
          ${today.length
            ? today.map(r=>{
                const tests=requestedTests(r).map(shortTestName);
                return `<article class="rounded-2xl border border-slate-100 bg-slate-50 p-4">
                  <div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <div class="flex flex-wrap items-center gap-2">
                        <p class="text-sm font-extrabold text-slate-900">${esc(r.time||'--:--')} · ${esc(r.name)}님</p>
                        <span class="rounded-full px-3 py-1 text-[10px] font-extrabold ${statusClass(r.status)}">${esc(normalizeStatus(r.status))}</span>
                      </div>
                      <p class="mt-2 text-xs text-slate-500">${esc(programBaseName(r.program))} · ${esc(tests.join(', ')||'검사 없음')} · ${esc(r.type||'상담방식 미정')}</p>
                    </div>
                    <div class="flex flex-wrap gap-2">
                      <button onclick="startCounseling(${r.id})" class="rounded-xl bg-emerald-600 px-3 py-2 text-xs font-extrabold text-white">상담 시작</button>
                      <button onclick="openCounselingRecordByReservation(${r.id})" class="rounded-xl bg-blue-600 px-3 py-2 text-xs font-extrabold text-white">상담일지</button>
                      ${normalizeStatus(r.status)==='상담진행'?`<button onclick="completeCounselingAndOpenChart(${r.id})" class="rounded-xl bg-slate-900 px-3 py-2 text-xs font-extrabold text-white">상담 완료</button>`:''}
                      <button onclick="setMenu('reservation')" class="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-extrabold text-slate-700">예약관리</button>
                    </div>
                  </div>
                </article>`;
              }).join('')
            : empty('오늘 예약 일정이 없습니다.')}
        </div>
      </section>

      <section class="rounded-[2rem] border border-slate-100 bg-white p-6 shadow-sm">
        <div class="mb-5 flex items-center justify-between gap-3">
          <div>
            <p class="text-xs font-extrabold text-indigo-600">RECENT</p>
            <h2 class="mt-1 text-xl font-extrabold">최근 신청</h2>
          </div>
          <button onclick="setMenu('reservation')" class="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-extrabold">전체 보기</button>
        </div>
        <div class="space-y-3">
          ${recent.length
            ? recent.map(r=>`<button onclick='openMemberChartByReservation(${JSON.stringify(String(r.id))},"profile")' class="w-full rounded-2xl border border-slate-100 bg-slate-50 p-4 text-left hover:border-indigo-200">
                <div class="flex items-start justify-between gap-3">
                  <div>
                    <p class="text-sm font-extrabold text-slate-900">${esc(r.name)}님</p>
                    <p class="mt-1 text-[11px] text-slate-400">${esc(r.date||'')} ${esc(r.time||'')} · ${esc(programBaseName(r.program))}</p>
                  </div>
                  <span class="rounded-full px-2 py-1 text-[10px] font-extrabold ${statusClass(r.status)}">${esc(normalizeStatus(r.status))}</span>
                </div>
              </button>`).join('')
            : empty('최근 예약이 없습니다.')}
        </div>
      </section>
    </div>
  </div>`);
  // ===== [MODUMAM 오늘업무 우선처리·빠른메뉴 삭제 끝] =====
}

function reservationSyncStatus(){
  const primary=load('modumam_reservations',[]).length;
  const inbox=load('modumam_reservation_inbox',[]).length;
  return `<div class="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-sky-100 bg-sky-50 px-4 py-3"><div><p class="text-xs font-extrabold text-sky-900">예약 저장소 확인</p><p class="mt-1 text-[11px] text-sky-700">홈페이지 서버 ${state.legacyReservationServerCount||0}건 · 앱 검사신청 ${state.appReservationServerCount||0}건 · IndexedDB ${state.reservationDbCount||0}건 · 기본 저장소 ${primary}건 · 예약 수신함 ${inbox}건 · 현재 표시 ${state.reservations.length}건</p>${state.reservationSyncError?`<p class="mt-1 text-[11px] font-bold text-rose-600">저장소 오류: ${esc(state.reservationSyncError)}</p>`:''}</div><button onclick="refreshSharedOperatingData(true)" class="rounded-xl bg-sky-700 px-4 py-2 text-xs font-extrabold text-white">예약 새로 불러오기</button></div>`;
}
function adminReservationCreatePanel(){
  const today=new Date().toISOString().slice(0,10);
  const defaultMethod=COUNSELING_METHODS[0]||'장소 조율(대면)';
  const defaultTimes=counselingTimesForMethod(defaultMethod);
  const defaultTests=(OPERATING_SETTINGS.programDefaultTests?.['개인 마음이음']||['TCI 기질 및 성격검사']).join(', ');
  return `<section class="rounded-[2rem] border border-indigo-100 bg-white p-5 shadow-sm sm:p-6">
    <div class="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
      <div>
        <p class="text-xs font-extrabold text-indigo-600">ADMIN DIRECT RESERVATION</p>
        <h3 class="mt-1 text-xl font-extrabold text-slate-950">관리자 직접 예약등록</h3>
        <p class="mt-1 text-xs leading-relaxed text-slate-500">전화·현장·테스트 예약을 관리자가 직접 등록합니다. 저장 즉시 예약관리와 심리평가센터에서 같은 예약을 사용합니다.</p>
      </div>
      <span class="w-fit rounded-full bg-indigo-50 px-3 py-1.5 text-[11px] font-extrabold text-indigo-700">기존 저장 로직 복구</span>
    </div>
    <div class="mt-5 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
      <label class="text-xs font-extrabold text-slate-500">내담자 이름
        <input id="admin-reservation-name" type="text" placeholder="홍길동" class="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm font-bold text-slate-900">
      </label>
      <label class="text-xs font-extrabold text-slate-500">연락처
        <input id="admin-reservation-phone" type="tel" placeholder="010-0000-0000" class="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm font-bold text-slate-900">
      </label>
      <label class="text-xs font-extrabold text-slate-500">예약일
        <input id="admin-reservation-date" type="date" value="${today}" class="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm font-bold text-slate-900">
      </label>
      <label class="text-xs font-extrabold text-slate-500">예약시간
        <select id="admin-reservation-time" class="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm font-bold text-slate-900">${defaultTimes.map(t=>`<option value="${t}">${t}</option>`).join('')}</select>
      </label>
      <label class="text-xs font-extrabold text-slate-500">상담방식
        <select id="admin-reservation-method" onchange="updateAdminReservationTimeOptions()" class="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm font-bold text-slate-900">${COUNSELING_METHODS.map(method=>`<option value="${esc(method)}">${esc(counselingMethodLabel(method))}</option>`).join('')}</select>
      </label>
      <label class="text-xs font-extrabold text-slate-500">서비스 / 프로그램
        <select id="admin-reservation-program" class="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm font-bold text-slate-900">
          <option value="개별 심리검사">개별 심리검사</option>
          <option value="개인 마음이음">개인 마음이음</option>
          <option value="부부 마음이음">부부 마음이음</option>
          <option value="부모-자녀 마음이음">부모-자녀 마음이음</option>
        </select>
      </label>
      <label class="text-xs font-extrabold text-slate-500 md:col-span-2">신청 검사 <span class="font-medium text-slate-400">(쉼표로 구분)</span>
        <input id="admin-reservation-tests" type="text" value="${esc(defaultTests)}" placeholder="TCI, MMPI-2" class="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm font-bold text-slate-900">
      </label>
    </div>
    <div class="mt-4 flex flex-col gap-2 sm:flex-row sm:justify-end">
      <button type="button" onclick="createAdminReservation()" class="rounded-xl bg-indigo-600 px-5 py-3 text-sm font-extrabold text-white shadow-sm hover:bg-indigo-700">예약 등록</button>
    </div>
  </section>`;
}
function reservationView(){
  return layout(`${reservationSyncStatus()}<div class="space-y-5">
    <div class="rounded-[2rem] bg-slate-950 p-6 text-white">
      <p class="text-xs font-extrabold text-emerald-300">RESERVATION WORKFLOW</p>
      <h2 class="mt-2 text-2xl font-extrabold">예약·검사 운영</h2>
      <p class="mt-2 text-sm text-slate-300">예약 진행상태와 AI 결과상담 활성화를 한 화면에서 관리합니다. 검사결과 분석과 보고서 작성은 심리평가센터에서 진행합니다.</p>
    </div>

    <section class="rounded-[1.5rem] border border-slate-200 bg-white p-4 shadow-sm">
      <div class="mb-3">
        <p class="text-base font-extrabold text-slate-900">검사기관 바로가기 · 공통 링크</p>
        <p class="mt-1 text-[11px] text-slate-500">검사기관 주소를 한 번 저장하면 모든 예약에서 공통으로 사용합니다.</p>
      </div>
      <div class="grid grid-cols-1 gap-3 lg:grid-cols-2">
        <div class="rounded-2xl border border-rose-100 bg-rose-50/50 p-3">
          <p class="text-[10px] font-extrabold text-rose-500">MAUMSARANG</p>
          <p class="mt-1 text-sm font-extrabold text-slate-900">마음사랑검사</p>
          <div class="mt-2 flex flex-wrap gap-2">
            <input id="shared-provider-maumsarang" type="url"
              value="${esc(load('test_provider_url_maumsarang','https://mscore.kr/'))}"
              class="min-w-[220px] flex-1 rounded-xl border border-rose-200 bg-white px-3 py-2 text-xs">
            <button type="button" onclick="saveTestProviderUrl('maumsarang','shared-provider-maumsarang')"
              class="rounded-xl bg-rose-500 px-3 py-2 text-[11px] font-extrabold text-white">링크 저장</button>
            <button type="button" onclick="openTestProviderUrl('maumsarang')"
              class="rounded-xl border border-rose-200 bg-white px-3 py-2 text-[11px] font-extrabold text-rose-600">사이트 열기</button>
          </div>
        </div>
        <div class="rounded-2xl border border-indigo-100 bg-indigo-50/50 p-3">
          <p class="text-[10px] font-extrabold text-indigo-500">INPSYT</p>
          <p class="mt-1 text-sm font-extrabold text-slate-900">인싸이트검사</p>
          <div class="mt-2 flex flex-wrap gap-2">
            <input id="shared-provider-insight" type="url"
              value="${esc(load('test_provider_url_insight','https://inpsyt.co.kr/mypage/dashboard/list'))}"
              class="min-w-[220px] flex-1 rounded-xl border border-indigo-200 bg-white px-3 py-2 text-xs">
            <button type="button" onclick="saveTestProviderUrl('insight','shared-provider-insight')"
              class="rounded-xl bg-indigo-600 px-3 py-2 text-[11px] font-extrabold text-white">링크 저장</button>
            <button type="button" onclick="openTestProviderUrl('insight')"
              class="rounded-xl border border-indigo-200 bg-white px-3 py-2 text-[11px] font-extrabold text-indigo-600">사이트 열기</button>
          </div>
        </div>
      </div>
    </section>

    ${adminReservationCreatePanel()}
    ${state.reservations.map(r=>{
      const p=progress(r),tests=requestedTests(r),st=normalizeStatus(r.status),terminal=['종결','예약취소'].includes(st);
      const reservationId=JSON.stringify(String(r.id));
      const isAppApplication=String(r.applicationSource||'')==='modumam-app-v1'||String(r.appApplicationId||'').startsWith('APP-');

      // 앱의 '검사 신청'은 상담예약이 아닙니다.
      // 관리자가 실제 일정을 지정하기 전까지 날짜/시간/상담방식을 모두 미정으로 표시합니다.
      const hasAdminSchedule=Boolean(
        r.reservationScheduledAt ||
        r.scheduleConfirmedAt ||
        r.adminScheduledAt ||
        (String(r.time||'').trim() && !['온라인 심리검사'].includes(String(r.type||'').trim()))
      );
      const isUnscheduledApp=isAppApplication&&!hasAdminSchedule;
      const scheduleDate=isUnscheduledApp?'':String(r.date||'');
      const scheduleTime=isUnscheduledApp?'':String(r.time||'');
      const scheduleMethod=isUnscheduledApp?'':String(r.type||'');

      const methodOptions=[
        ...(isUnscheduledApp?['<option value="" selected>상담방식 미정</option>']:[]),
        ...COUNSELING_METHODS.map(method=>`<option value="${method}" ${scheduleMethod===method?'selected':''}>${counselingMethodLabel(method)}</option>`)
      ].join('');
      const timeOptions=[
        ...(!scheduleTime?['<option value="" selected>시간 미정</option>']:[]),
        ...counselingTimesForMethod(scheduleMethod).map(time=>`<option value="${time}" ${scheduleTime===time?'selected':''}>${time}</option>`)
      ].join('');

      const scheduleLabel=isUnscheduledApp
        ? '일정 미정'
        : [scheduleDate,scheduleTime].filter(Boolean).join(' ')||'일정 미정';
      const methodLabel=isUnscheduledApp?'상담방식 미정':counselingMethodLabel(r.type||'');

      return `<section class="rounded-[1.6rem] border border-slate-100 bg-white p-4 shadow-sm sm:p-5">
        <div class="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div class="min-w-0">
            <div class="flex flex-wrap items-center gap-2">
              <h3 class="text-lg font-extrabold">${esc(r.name)}님</h3>
              <span class="rounded-full px-2.5 py-1 text-[11px] font-bold ${statusClass(st)}">${esc(st)}</span>
              ${isAppApplication?'<span class="rounded-full bg-teal-100 px-2.5 py-1 text-[11px] font-bold text-teal-700">앱 검사신청</span>':''}
            </div>
            <p class="mt-1 text-[11px] text-slate-400">${esc(r.phone||'연락처 없음')}</p>
          </div>
          <div class="flex flex-wrap gap-2">
            <button onclick='openMemberChartByReservation(${reservationId},"profile")' class="rounded-xl border border-slate-200 bg-white px-3 py-2 text-[11px] font-extrabold">전자차트</button>
            ${normalizeStatus(r.status)!=='예약취소' && window.isAiCounselingReservation?.(r)
              ? window.renderAiCounselingActivationControl?.(r) || ''
              : ''}
            ${normalizeStatus(r.status)==='취소요청'
              ? `<button type="button" data-mml-action="reservation-cancel-approve" data-reservation-id="${esc(String(r.id||''))}" class="rounded-xl bg-rose-600 px-3 py-2 text-[11px] font-extrabold text-white">취소 승인</button>
                 <button type="button" data-mml-action="reservation-cancel-reject" data-reservation-id="${esc(String(r.id||''))}" class="rounded-xl border border-slate-200 bg-white px-3 py-2 text-[11px] font-extrabold text-slate-700">취소 거부</button>`
              : (!terminal?`<button type="button" data-mml-action="reservation-next" data-reservation-id=${reservationId} class="rounded-xl bg-slate-950 px-3 py-2 text-[11px] font-extrabold text-white">${esc(nextActionLabel(r))}</button>`:'')}
          </div>
        </div>

        <div class="mt-3 grid grid-cols-2 gap-2 lg:grid-cols-4">
          <div class="rounded-xl bg-slate-50 px-3 py-2.5">
            <p class="text-[10px] font-bold text-slate-400">일정</p>
            <p class="mt-1 truncate text-xs font-extrabold ${isUnscheduledApp?'text-amber-700':'text-slate-800'}">${esc(scheduleLabel)}</p>
          </div>
          <div class="rounded-xl bg-slate-50 px-3 py-2.5">
            <p class="text-[10px] font-bold text-slate-400">프로그램</p>
            <p class="mt-1 truncate text-xs font-extrabold">${esc(programBaseName(r.program))}</p>
          </div>
          <div class="rounded-xl bg-slate-50 px-3 py-2.5">
            <p class="text-[10px] font-bold text-slate-400">검사</p>
            <p class="mt-1 truncate text-xs font-extrabold">${esc(tests.map(shortTestName).join(' · ')||'없음')}</p>
          </div>
          <div class="rounded-xl bg-slate-50 px-3 py-2.5">
            <p class="text-[10px] font-bold text-slate-400">상담방식</p>
            <p class="mt-1 truncate text-xs font-extrabold">${esc(methodLabel)}</p>
          </div>
        </div>

        <div class="mt-3 rounded-xl border border-slate-100 bg-slate-50 p-3">
          <div class="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
            <div class="min-w-0">
              <p class="text-xs font-extrabold">${esc(autoStatusDescription(r))}</p>
              <div class="mt-2">${operationPipeline(r)}</div>
            </div>
            ${r.aiResultCounselingCompletedAt
              ? `<span class="shrink-0 rounded-full bg-emerald-100 px-3 py-1.5 text-[11px] font-bold text-emerald-700">AI 상담 완료</span>`
              : ''
            }
          </div>
        </div>

        <details class="mt-3 rounded-xl border border-slate-100 bg-white">
          <summary class="cursor-pointer list-none px-4 py-3 text-xs font-extrabold text-slate-700">
            예약·검사 상세관리
            <span class="ml-2 text-[10px] font-medium text-slate-400">일정 변경 · 검사 발송 · 검사기관</span>
          </summary>
          <div class="border-t border-slate-100 p-4">
            <div class="grid grid-cols-1 gap-3 lg:grid-cols-3">
              <label class="text-[11px] font-bold text-slate-500">예약일
                <input id="reservation-date-${esc(String(r.id))}" type="date" value="${esc(scheduleDate)}" class="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm font-bold">
              </label>
              <label class="text-[11px] font-bold text-slate-500">예약시간
                <select id="reservation-time-${esc(String(r.id))}" class="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm font-bold">${timeOptions}</select>
              </label>
              <label class="text-[11px] font-bold text-slate-500">상담방식
                <select id="reservation-method-${esc(String(r.id))}" onchange="updateReservationTimeOptions('${esc(String(r.id))}')" class="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm font-bold">${methodOptions}</select>
              </label>
            </div>

            <div class="mt-3 flex flex-wrap gap-2">
              <button type="button" onclick='saveCurrentReservationChanges(${reservationId})' class="rounded-xl bg-emerald-600 px-3 py-2 text-[11px] font-extrabold text-white">예약 변경 저장</button>
              <button onclick='markAllTestsSent(${reservationId})' class="rounded-xl border border-indigo-100 bg-indigo-50 px-3 py-2 text-[11px] font-bold text-indigo-700">검사 전체 발송완료</button>
            </div>

            <div class="mt-3">${focusedNextTaskBlock(r)}</div>
          </div>
        </details>
      </section>`}).join('')||empty('예약이 없습니다.')}
  </div>`)
}
function aiMonitoringRecords(){
  const stored=load('modumam_ai_result_counseling_records',[]);
  const rows=Array.isArray(stored)?stored:[];
  const aiReservations=state.reservations.filter(isAiResultCounselingReservation);
  const map=new Map();

  rows.forEach(record=>{
    const key=String(record.sessionId||record.id||record.reservationId||Math.random());
    map.set(key,{...record});
  });

  aiReservations.forEach(r=>{
    const exists=[...map.values()].some(x=>String(x.reservationId)===String(r.id));
    if(!exists && ['상담준비','상담진행','상담완료'].includes(normalizeStatus(r.status))){
      const key='reservation-'+String(r.id);
      map.set(key,{
        id:key,
        sessionId:key,
        reservationId:r.id,
        clientName:r.name||'',
        phone:r.phone||'',
        counselingType:'AI 결과상담',
        reportTitle:'검사결과 해석상담',
        reservationDate:r.date||'',
        reservationTime:r.time||'',
        startedAt:r.counselingStartedAt||'',
        updatedAt:r.updatedAt||r.statusUpdatedAt||'',
        completedAt:r.aiResultCounselingCompletedAt||'',
        status:r.aiResultCounselingCompletedAt||normalizeStatus(r.status)==='상담완료'?'완료':'대기',
        summary:r.aiResultCounselingSummary||'',
        messages:[],
        messageCount:0,
        riskDetected:false,
        placeholder:true
      });
    }
  });

  return [...map.values()].sort((a,b)=>String(b.updatedAt||b.startedAt||'').localeCompare(String(a.updatedAt||a.startedAt||'')));
}

function aiMonitoringMessageBubble(message){
  const isUser=message?.role==='user';
  return `<div class="flex ${isUser?'justify-end':'justify-start'}"><div class="max-w-[88%] rounded-2xl px-4 py-3 ${isUser?'bg-slate-900 text-white':'border border-slate-200 bg-white text-slate-700'}"><p class="mb-1 text-[10px] font-extrabold ${isUser?'text-slate-300':'text-emerald-700'}">${isUser?'내담자':'AI 결과상담'}</p><p class="whitespace-pre-wrap text-sm leading-relaxed">${esc(message?.text||'')}</p><p class="mt-2 text-right text-[9px] text-slate-400">${esc(message?.time||'')}</p></div></div>`;
}
function intakeView(){
  const records=aiMonitoringRecords(),active=records.filter(r=>r.status==='진행중'),completed=records.filter(r=>r.status==='완료'),risk=records.filter(r=>r.riskDetected);
  return layout(`<div class="space-y-6"><div class="rounded-[2rem] bg-gradient-to-r from-slate-950 via-indigo-950 to-emerald-950 p-7 text-white shadow-xl"><p class="text-xs font-extrabold text-emerald-300">AI RESULT COUNSELING MONITORING</p><h2 class="mt-2 text-2xl font-extrabold">AI 모니터링</h2><p class="mt-2 max-w-4xl text-sm leading-relaxed text-slate-300">예약된 AI(비대면) 검사결과 해석상담의 진행 상태와 내담자·AI 대화를 읽기 전용으로 확인합니다.</p><div class="mt-5"><button onclick="refreshSharedOperatingData(true)" class="rounded-xl bg-white px-4 py-2 text-xs font-extrabold text-slate-900">새로고침</button></div></div><div class="grid grid-cols-1 gap-4 sm:grid-cols-4">${card('전체 AI 상담',records.length+'건','결과해석 AI 상담','🤖','purple')}${card('진행 중',active.length+'건','현재 상담 진행','●','emerald')}${card('완료',completed.length+'건','상담 종료 기록','✓','blue')}${card('위험표현',risk.length+'건','상담자 확인 필요','!','orange')}</div><div class="space-y-5">${records.length?records.map(record=>{const reservation=state.reservations.find(r=>String(r.id)===String(record.reservationId));const messages=Array.isArray(record.messages)?record.messages:[];const isActive=record.status==='진행중';return `<details class="overflow-hidden rounded-[2rem] border ${record.riskDetected?'border-rose-300':'border-slate-100'} bg-white shadow-sm" ${isActive||record.riskDetected||String(record.reservationId)===String(state.aiMonitoringSelectedId||'')?'open':''}><summary class="cursor-pointer list-none p-5 sm:p-6"><div class="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between"><div><div class="flex flex-wrap items-center gap-2"><p class="text-lg font-extrabold text-slate-950">${esc(record.clientName||reservation?.name||'이름 미입력')}님</p><span class="rounded-full px-3 py-1 text-[11px] font-extrabold ${isActive?'bg-emerald-100 text-emerald-700':'bg-slate-100 text-slate-600'}">${isActive?'● 진행 중':'상담 완료'}</span>${record.riskDetected?'<span class="rounded-full bg-rose-100 px-3 py-1 text-[11px] font-extrabold text-rose-700">위험표현 확인</span>':''}</div><p class="mt-2 text-xs text-slate-500">${esc(record.phone||reservation?.phone||'')} · ${esc(record.reservationDate||reservation?.date||'')} ${esc(record.reservationTime||reservation?.time||'')} · ${esc(record.reportTitle||'결과보고서')}</p></div><div class="rounded-xl bg-slate-50 px-4 py-3 text-center"><p class="text-[9px] font-bold text-slate-400">대화</p><p class="text-sm font-extrabold">${messages.length}개</p></div></div></summary><div class="border-t border-slate-100 bg-slate-50 p-5 sm:p-6"><div class="max-h-[620px] space-y-3 overflow-y-auto rounded-2xl border border-slate-100 bg-slate-100/70 p-4">${messages.length?messages.map(aiMonitoringMessageBubble).join(''):empty(record.placeholder?'내담자가 AI 결과상담을 시작하면 대화가 실시간으로 표시됩니다.':'아직 저장된 대화가 없습니다.')}</div>${record.summary?`<div class="mt-4 rounded-2xl border border-indigo-100 bg-indigo-50 p-4"><p class="text-xs font-extrabold text-indigo-700">AI 상담 마무리 요약</p><p class="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-slate-700">${esc(record.summary)}</p></div>`:''}<p class="mt-4 text-[10px] text-slate-400">시작 ${esc(record.startedAt||'')} · 최근 업데이트 ${esc(record.updatedAt||'')} · 읽기 전용</p></div></details>`;}).join(''):empty('내담자가 예약된 AI 결과상담을 시작하면 이곳에 표시됩니다.')}</div></div>`);
}
/* V28: 보고서 템플릿·편집·출력 화면 코드는 js/modules/assessment-reports.js로 분리되었습니다. */

function clientBriefing(c){
  const tests=[...new Set(c.reservations.flatMap(r=>requestedTests(r)))];
  const latestReservation=c.reservations[0]||{};
  const latestIntake=c.intakes[0]||null;
  const latestReport=c.reports[0]||null;
  const latestNote=c.notes[0]||null;
  const issues=[];
  if(latestIntake && (latestIntake.summary||latestIntake.concern)) issues.push('AI 마음 체크인 내용을 먼저 확인합니다.');
  if(tests.length) issues.push('신청/진행 검사: '+tests.slice(0,4).join(', '));
  if(latestReport) issues.push('최근 결과보고서: '+(latestReport.testType||latestReport.title||'보고서 확인'));
  if(latestNote) issues.push('최근 상담메모가 있습니다. 지난 회기 변화와 과제를 확인합니다.');
  if(!issues.length) issues.push('예약 기본정보와 주호소를 먼저 확인합니다.');
  const questions=[];
  questions.push('현재 가장 힘든 순간이 언제인지 확인하기');
  questions.push('최근 수면, 식욕, 신체 긴장 등 생활 변화를 확인하기');
  if(tests.some(t=>String(t).includes('TCI'))) questions.push('기질 특성과 현재 스트레스 반응의 연결 살펴보기');
  if(tests.some(t=>String(t).includes('MMPI'))) questions.push('정서 및 성격 특성과 주호소의 관련성 살펴보기');
  if(String(latestReservation.program||'').includes('부모')) questions.push('양육환경과 아동 발달 특성의 상호작용 확인하기');
  if(String(latestReservation.program||'').includes('부부')) questions.push('각자의 기질 차이와 의사소통 패턴 확인하기');
  return {issues,questions,goal:'현재 어려움을 검사 결과와 연결하여 이해하고, 첫 실천 목표를 함께 정리합니다.'};
}

function intakeSummaryBlock(c){
  if(!c.intakes.length) return '<p class="text-sm text-slate-400">연결된 AI 마음 체크인 기록이 없습니다.</p>';
  return c.intakes.map(i=>`<div class="bg-emerald-50 border border-emerald-100 rounded-2xl p-4 mb-3"><p class="text-xs font-extrabold text-emerald-700 mb-2">AI 마음 체크인</p><p class="text-xs text-slate-700 whitespace-pre-line">${esc(i.summary||i.concern||i.content||'요약 없음')}</p></div>`).join('');
}

function counselorBriefingBlock(c){
  const b=clientBriefing(c);
  return `<div class="bg-slate-900 text-white rounded-2xl p-5 mb-5">
    <div class="flex items-center justify-between gap-3 mb-3">
      <h3 class="text-sm font-extrabold">AI 상담 준비 브리핑</h3>
      <span class="text-[11px] font-bold bg-white/10 rounded-full px-3 py-1">상담 전 30초 확인</span>
    </div>
    <p class="text-xs text-slate-300 mb-4">AI는 상담을 대신하지 않고, 임상심리 전문가가 상담을 준비하는 참고자료를 정리합니다.</p>
    <div class="grid grid-cols-1 lg:grid-cols-3 gap-3">
      <div class="bg-white/10 rounded-2xl p-4"><p class="text-xs font-extrabold text-emerald-300 mb-2">오늘 확인할 내용</p>${b.issues.map(x=>`<p class="text-xs text-slate-100 mb-1">• ${esc(x)}</p>`).join('')}</div>
      <div class="bg-white/10 rounded-2xl p-4"><p class="text-xs font-extrabold text-emerald-300 mb-2">상담 질문 초안</p>${b.questions.slice(0,4).map(x=>`<p class="text-xs text-slate-100 mb-1">• ${esc(x)}</p>`).join('')}</div>
      <div class="bg-white/10 rounded-2xl p-4"><p class="text-xs font-extrabold text-emerald-300 mb-2">오늘의 상담목표</p><p class="text-xs text-slate-100 whitespace-pre-line">${esc(b.goal)}</p></div>
    </div>
  </div>`;
}

function parseStructuredSessionMemo(memo=''){
  const text=String(memo||'');
  const pick=(label)=>{
    const m=text.match(new RegExp(label+':\\s*([\\s\\S]*?)(?=\\n(?:주제|정서/반응|개입/상담내용|변화/관찰|다음 회기/과제):|$)'));
    return m?m[1].trim():'';
  };
  return {
    theme:pick('주제'), emotion:pick('정서/반응'), intervention:pick('개입/상담내용'),
    change:pick('변화/관찰'), next:pick('다음 회기/과제')
  };
}

function generateSessionAiSummary(k,noteId){
  const sk='modumam_counseling_notes_'+k;
  const notes=load(sk,[]);
  const idx=notes.findIndex(n=>String(n.id)===String(noteId));
  if(idx<0) return;
  const n=notes[idx];
  const d=parseStructuredSessionMemo(n.memo||'');
  const core=[d.theme,d.emotion,d.change].filter(Boolean).join(' / ') || '회기 핵심 내용이 입력되었습니다.';
  const summary=[
    d.theme?`이번 회기에서는 ${d.theme}을 중심으로 이야기를 나누었습니다.`:'',
    d.emotion?`내담자는 ${d.emotion}의 정서와 반응을 보였습니다.`:'',
    d.intervention?`상담에서는 ${d.intervention}을 확인하고 다루었습니다.`:'',
    d.change?`회기 중 확인된 변화와 관찰점은 ${d.change}입니다.`:''
  ].filter(Boolean).join(' ');
  const nextQuestions=[];
  if(d.change) nextQuestions.push('지난 회기 이후 확인된 변화가 일상에서 어떻게 이어졌는지 살펴봅니다.');
  if(d.next) nextQuestions.push(d.next);
  nextQuestions.push('최근 가장 힘들었던 순간과 조금 덜 힘들었던 순간의 차이를 확인합니다.');
  nextQuestions.push('현재 사용하고 있는 대처방법 중 도움이 된 것과 부담이 된 것을 구분합니다.');
  n.aiSummary=summary||core;
  n.aiNextQuestions=nextQuestions.slice(0,3).join('\n');
  n.aiCounselorFocus=[
    '내담자의 표현을 사실과 해석으로 구분해 확인합니다.',
    d.emotion?'주요 정서의 강도와 지속시간, 일상 기능 영향을 구체적으로 확인합니다.':'정서 상태와 생활 변화를 구체적으로 확인합니다.',
    '위험 신호가 의심되면 자해·자살사고 및 안전 여부를 직접 확인합니다.'
  ].join('\n');
  n.aiGeneratedAt=new Date().toLocaleString();
  notes[idx]=n;
  save(sk,notes);
  alert('AI 회기요약과 다음 회기 제안이 생성되었습니다. 상담자가 사실관계를 확인해 주세요.');
  render();
}

function copySessionAiSummary(k,noteId){
  const n=load('modumam_counseling_notes_'+k,[]).find(x=>String(x.id)===String(noteId));
  if(!n||!n.aiSummary){alert('먼저 AI 회기요약을 생성해 주세요.');return;}
  copyText(`[AI 회기요약]\n${n.aiSummary}\n\n[다음 회기 확인 질문]\n${n.aiNextQuestions||''}\n\n[상담자 확인 포인트]\n${n.aiCounselorFocus||''}`);
}

function saveStructuredSession(k){
  const date=document.getElementById('session-date-'+k)?.value||new Date().toISOString().slice(0,10);
  const theme=document.getElementById('session-theme-'+k)?.value||'';
  const emotion=document.getElementById('session-emotion-'+k)?.value||'';
  const intervention=document.getElementById('session-intervention-'+k)?.value||'';
  const change=document.getElementById('session-change-'+k)?.value||'';
  const next=document.getElementById('session-next-'+k)?.value||'';
  if(!theme.trim()&&!emotion.trim()&&!intervention.trim()&&!change.trim()){alert('회기 핵심 내용을 한 가지 이상 입력해 주세요.');return;}
  const memo=`[회기기록]\n주제: ${theme}\n정서/반응: ${emotion}\n개입/상담내용: ${intervention}\n변화/관찰: ${change}\n다음 회기/과제: ${next}`;
  const sk='modumam_counseling_notes_'+k;
  const notes=load(sk,[]);
  notes.unshift({id:Date.now(),date,memo,createdAt:new Date().toLocaleString(),type:'structured-session'});
  save(sk,notes);
  alert('회기기록이 전자차트에 저장되었습니다.');
  render();
}

function saveClientProfileMemo(k){
  const memo=document.getElementById('client-profile-memo-'+k)?.value||'';
  save('modumam_client_profile_'+k,{memo,updatedAt:new Date().toLocaleString()});
  alert('회원 프로필 메모를 저장했습니다.');
  render();
}
function setMemberSearch(v){state.memberSearch=v;render()}
function setMemberStatus(v){state.memberStatus=v;render()}
function findMemberChart(){
  const input=document.getElementById('member-chart-search');
  const value=String(input?.value||'').trim();
  if(!value){alert('내담자 이름·연락처·사례번호를 입력해 주세요.');input?.focus();return;}
  state.memberSearch=value;
  state.selectedClientKey='';
  render();
}
function clearMemberChartSearch(){state.memberSearch='';state.selectedClientKey='';render();}
window.findMemberChart=findMemberChart;
window.clearMemberChartSearch=clearMemberChartSearch;

function openClientChart(key,tab='profile'){
  state.selectedClientKey=String(key||'');
  state.memberTab=tab;
  render();
  setTimeout(()=>document.getElementById(`${tab}-${key}`)?.scrollIntoView({behavior:'smooth',block:'start'}),30);
}
function closeClientChart(){state.selectedClientKey='';state.memberTab='profile';render()}
function setMemberTab(tab,key){state.memberTab=tab;render();setTimeout(()=>document.getElementById(`${tab}-${key}`)?.scrollIntoView({behavior:'smooth',block:'start'}),30)}
function clientLatestStatus(c){return c.reservations[0]?.status||'기록없음'}

/* =========================================================
   V28 회원 상담 타임라인
   - 예약, 상태변경, 일정변경, 검사링크, AI 체크인,
     검사결과, 보고서, 회기기록을 시간순으로 통합 표시
========================================================= */
function timelineDateValue(value){
  if(!value) return 0;
  const raw=String(value).trim();
  const normalized=raw.replace(/\./g,'-').replace(/년|월/g,'-').replace(/일/g,'').replace(/오전|오후/g,'').trim();
  const t=Date.parse(normalized);
  return Number.isFinite(t)?t:0;
}
function timelineDisplayDate(value){
  if(!value) return '날짜 미상';
  const t=timelineDateValue(value);
  if(!t) return esc(String(value));
  return new Date(t).toLocaleString('ko-KR',{year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'});
}
function buildClientTimeline(c){
  const items=[];
  const push=(date,type,title,detail='',tone='slate',meta={})=>items.push({date,dateValue:timelineDateValue(date),type,title,detail,tone,...meta});
  (c.reservations||[]).forEach(r=>{
    push(r.createdAt||r.date,'예약',`${r.program||'상담'} 예약 신청`,`${r.date||''} ${r.time||''} · ${r.type||''}`,'blue');
    const statusHistory=Array.isArray(r.statusHistory)?r.statusHistory:[];
    statusHistory.forEach(h=>push(h.changedAt||h.createdAt,'진행상태',`예약 상태: ${h.after||h.to||h.status||r.status||''}`,h.before||h.from?`${h.before||h.from} → ${h.after||h.to||h.status||''}`:'','emerald'));
    if(!statusHistory.length && r.status) push(r.updatedAt||r.createdAt||r.date,'진행상태',`현재 상태: ${r.status}`,'','emerald');
    const scheduleHistory=Array.isArray(r.scheduleHistory)?r.scheduleHistory:(Array.isArray(r.scheduleChangeHistory)?r.scheduleChangeHistory:[]);
    scheduleHistory.forEach(h=>{
      const beforeObj=h.before||{};
      const afterObj=h.after||{};
      const before=[beforeObj.date||h.beforeDate,beforeObj.time||h.beforeTime,beforeObj.type||h.beforeType].filter(Boolean).join(' ');
      const after=[afterObj.date||h.afterDate,afterObj.time||h.afterTime,afterObj.type||h.afterType].filter(Boolean).join(' ');
      push(h.changedAt||h.createdAt,'일정변경','상담 일정·방식 변경',`${before||'이전 정보 없음'} → ${after||'변경 정보 없음'}`,'orange');
    });
    Object.entries(r.testLinks||{}).forEach(([testName,url])=>{
      if(!String(url||'').trim()) return;
      push(r.testLinksUpdatedAt||r.updatedAt||r.createdAt,'검사링크',`${testName||'심리검사'} 링크 등록`,String(url),'purple');
    });
    if(r.aiResultCounselingEnabled) push(r.aiResultCounselingEnabledAt||r.updatedAt||r.createdAt,'AI상담','AI 결과상담 활성화',r.aiResultCounselingCompletedAt?`완료: ${r.aiResultCounselingCompletedAt}`:'이용 가능','purple');
  });
  (c.intakes||[]).forEach(i=>push(i.createdAt||i.date,'AI체크인','AI 마음 체크인 기록',i.summary||i.concern||i.content||'요약 없음','emerald'));
  (c.uploads||[]).forEach(u=>push(u.createdAt||u.updatedAt,'검사결과',`${u.testType||'심리검사'} 결과 업로드`,`${u.fileName||''}${u.visibleToClient?' · 회원 공개':' · 관리자 전용'}`,'indigo'));
  (c.reports||[]).forEach(r=>push(r.updatedAt||r.createdAt,'보고서',`${r.testType||''} 결과보고서 ${r.approvedForClient?'공개':'저장'}`,`${r.title||''} · v${Number(r.version||1)}`,'orange'));
  (c.notes||[]).forEach(n=>push(n.createdAt||n.date,'회기기록',n.goal||n.theme||'상담 회기기록',n.memo||n.content||'','slate'));
  (c.aiResultRecords||[]).forEach(record=>push(record.completedAt||record.date,'AI 결과상담',`${record.reportTitle||'종합보고서'} 결과상담 완료`,record.summary||`대화 ${Number(record.messageCount||0)}개`,'purple'));
  if(c.profileMemo?.updatedAt) push(c.profileMemo.updatedAt,'관리메모','회원 프로필 메모 수정',c.profileMemo.memo||'','amber');
  return items.sort((a,b)=>b.dateValue-a.dateValue);
}
function clientTimelineBlock(c){
  const items=buildClientTimeline(c);
  const tone={
    blue:'bg-blue-100 text-blue-700 border-blue-200',emerald:'bg-emerald-100 text-emerald-700 border-emerald-200',orange:'bg-orange-100 text-orange-700 border-orange-200',purple:'bg-purple-100 text-purple-700 border-purple-200',indigo:'bg-indigo-100 text-indigo-700 border-indigo-200',amber:'bg-amber-100 text-amber-700 border-amber-200',slate:'bg-slate-100 text-slate-700 border-slate-200'
  };
  return `<div class="bg-white rounded-2xl border border-slate-100 p-5 mb-5">
    <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
      <div><h3 class="text-sm font-extrabold">상담 타임라인</h3><p class="text-xs text-slate-500 mt-1">예약부터 검사·보고서·상담기록까지 시간순으로 확인합니다.</p></div>
      <span class="text-[11px] font-extrabold bg-slate-100 text-slate-600 rounded-full px-3 py-1">총 ${items.length}건</span>
    </div>
    <div class="relative max-h-[420px] overflow-auto pr-1">
      ${items.length?`<div class="absolute left-[11px] top-2 bottom-2 w-px bg-slate-200"></div><div class="space-y-3">${items.map((it,idx)=>`<div class="relative pl-8"><span class="absolute left-0 top-1.5 w-6 h-6 rounded-full border flex items-center justify-center text-[10px] font-extrabold ${tone[it.tone]||tone.slate}">${items.length-idx}</span><div class="bg-slate-50 border border-slate-100 rounded-2xl p-4"><div class="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2"><div><p class="text-[11px] font-extrabold text-slate-400">${esc(it.type)}</p><p class="text-sm font-extrabold text-slate-800 mt-1">${esc(it.title)}</p></div><p class="text-[11px] text-slate-400 shrink-0">${timelineDisplayDate(it.date)}</p></div>${it.detail?`<p class="text-xs text-slate-600 whitespace-pre-line mt-2 line-clamp-4">${esc(it.detail)}</p>`:''}</div></div>`).join('')}</div>`:`<p class="text-sm text-slate-400">아직 타임라인에 표시할 기록이 없습니다.</p>`}
    </div>
  </div>`;
}

function memberChartSessionRows(c){
  const rows=[];
  const seen=new Set();
  const push=(item,source='상담일지')=>{
    const content=String(item.memo||item.content||item.intervention||'').trim();
    const key=String(item.id||`${item.date||''}-${content.slice(0,80)}`);
    if(seen.has(key))return;
    seen.add(key);
    const parsed=parseStructuredSessionMemo(content);
    rows.push({
      id:key,
      date:item.date||item.sessionDate||item.createdAt||'',
      sessionNumber:Number(item.sessionNumber||item.round||0),
      method:item.method||item.counselingMethod||'',
      referral:item.referralReason||item.complaint||item.theme||parsed.theme||'',
      goal:item.goal||item.sessionGoal||parsed.theme||'',
      content:item.sessionContent||content||parsed.intervention||'',
      result:item.result||item.change||parsed.change||item.aiSummary||'',
      next:item.next||item.nextSession||parsed.next||'',
      source
    });
  };
  (c.notes||[]).forEach(x=>push(x,'상담일지'));
  (c.reservations||[]).forEach(r=>{
    const caseId=caseIdFromReservation(r);
    load('modumam_case_sessions_'+caseId,[]).forEach(x=>push({...x,method:x.method||r.type},x.sourceLabel||'회기기록'));
  });
  return rows.sort((a,b)=>timelineDateValue(b.date)-timelineDateValue(a.date));
}

function memberReservationSection(c){
  const rows=(c.reservations||[]).slice().sort((a,b)=>`${b.date||''} ${b.time||''}`.localeCompare(`${a.date||''} ${a.time||''}`));
  return `<section class="rounded-[2rem] border border-slate-100 bg-white p-5 shadow-sm sm:p-6">
    <div class="mb-5 flex items-center justify-between gap-3"><div><p class="text-xs font-extrabold text-emerald-700">RESERVATION WORKFLOW</p><h3 class="mt-1 text-lg font-extrabold">예약 진행상태 정리</h3></div><span class="rounded-full bg-emerald-50 px-3 py-1 text-xs font-extrabold text-emerald-700">${rows.length}건</span></div>
    <div class="space-y-4">${rows.length?rows.map(r=>`<article class="rounded-2xl border border-slate-100 bg-slate-50 p-4"><div class="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between"><div class="min-w-0 flex-1"><div class="flex flex-wrap items-center gap-2"><span class="rounded-full px-3 py-1 text-[11px] font-extrabold ${statusClass(r.status)}">${esc(normalizeStatus(r.status))}</span><p class="text-sm font-extrabold">${esc(programBaseName(r.program))}</p></div><div class="mt-3 grid grid-cols-2 gap-3 lg:grid-cols-4"><div><p class="text-[10px] font-bold text-slate-400">예약일정</p><p class="mt-1 text-xs font-extrabold">${esc(r.date||'미정')} ${esc(r.time||'')}</p></div><div><p class="text-[10px] font-bold text-slate-400">검사명</p><p class="mt-1 text-xs font-extrabold">${esc(requestedTests(r).map(shortTestName).join(', ')||'없음')}</p></div><div><p class="text-[10px] font-bold text-slate-400">상담방법</p><p class="mt-1 text-xs font-extrabold">${esc(r.type||'미정')}</p></div><div><p class="text-[10px] font-bold text-slate-400">최근 변경</p><p class="mt-1 text-xs font-extrabold">${esc(r.statusUpdatedAt||r.scheduleUpdatedAt||r.updatedAt||'기록 없음')}</p></div></div></div><button onclick="setMenu('reservation')" class="shrink-0 rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-extrabold">예약관리</button></div><div class="mt-4">${operationPipeline(r)}</div></article>`).join(''):'<p class="text-sm text-slate-400">예약 기록이 없습니다.</p>'}</div>
  </section>`;
}

/* V28: 심리평가센터·내담자용 보고서 생성/승인/열람 코드는 js/modules/assessment-reports.js로 분리되었습니다. */

function memberAiCounselingSection(c){
  const rows=c.aiResultRecords||[];
  return `<section class="rounded-[2rem] border border-purple-100 bg-white p-5 shadow-sm sm:p-6"><div class="mb-5 flex items-center justify-between gap-3"><div><p class="text-xs font-extrabold text-purple-600">AI RESULT COUNSELING</p><h3 class="mt-1 text-lg font-extrabold">AI 결과상담기록</h3></div><span class="rounded-full bg-purple-50 px-3 py-1 text-xs font-extrabold text-purple-700">${rows.length}건</span></div><div class="space-y-3">${rows.length?rows.map(record=>`<details class="rounded-2xl border border-purple-100 bg-purple-50 p-4"><summary class="cursor-pointer list-none"><div class="flex flex-wrap items-center justify-between gap-3"><div><p class="text-sm font-extrabold text-purple-950">${esc(record.reportTitle||'AI 결과상담')}</p><p class="mt-1 text-[11px] text-purple-500">${esc(record.completedAt||record.date||'날짜 기록 없음')} · 대화 ${Number(record.messageCount||0)}개</p></div><span class="rounded-full bg-white px-3 py-1 text-[10px] font-bold text-amber-700">상담자 검토 필요</span></div></summary><p class="mt-4 whitespace-pre-line border-t border-purple-100 pt-4 text-xs leading-relaxed text-slate-700">${esc(record.summary||'저장된 상담정리가 없습니다.')}</p></details>`).join(''):'<p class="text-sm text-slate-400">AI 결과상담 기록이 없습니다.</p>'}</div></section>`;
}

function memberJournalSection(c){
  const rows=memberChartSessionRows(c);
  return `<section class="rounded-[2rem] border border-slate-100 bg-white p-5 shadow-sm sm:p-6"><div class="mb-5 flex items-center justify-between gap-3"><div><p class="text-xs font-extrabold text-blue-600">COUNSELING JOURNAL</p><h3 class="mt-1 text-lg font-extrabold">상담기록</h3></div><span class="rounded-full bg-blue-50 px-3 py-1 text-xs font-extrabold text-blue-700">${rows.length}건</span></div><div class="space-y-3">${rows.length?rows.map((x,index)=>`<details class="rounded-2xl border border-slate-100 bg-slate-50 p-4" ${index===0?'open':''}><summary class="cursor-pointer list-none"><div class="flex flex-wrap items-center justify-between gap-3"><div><p class="text-sm font-extrabold">${x.sessionNumber?`${x.sessionNumber}회기`:`${rows.length-index}회기`} · ${esc(String(x.date||'날짜 미상').slice(0,10))}</p><p class="mt-1 text-[11px] text-slate-400">${esc(x.method||'상담방법 미기록')} · ${esc(x.source)}</p></div><span class="rounded-full bg-white px-3 py-1 text-[10px] font-bold text-slate-500">펼쳐보기</span></div></summary><div class="mt-4 grid grid-cols-1 gap-3 border-t border-slate-200 pt-4 lg:grid-cols-2"><div class="rounded-xl bg-white p-3"><p class="text-[10px] font-extrabold text-slate-400">의뢰사유</p><p class="mt-2 whitespace-pre-line text-xs leading-relaxed text-slate-700">${esc(x.referral||'기록 없음')}</p></div><div class="rounded-xl bg-white p-3"><p class="text-[10px] font-extrabold text-slate-400">상담목표</p><p class="mt-2 whitespace-pre-line text-xs leading-relaxed text-slate-700">${esc(x.goal||'기록 없음')}</p></div><div class="rounded-xl bg-white p-3 lg:col-span-2"><p class="text-[10px] font-extrabold text-slate-400">상담내용</p><p class="mt-2 whitespace-pre-line text-xs leading-relaxed text-slate-700">${esc(x.content||'기록 없음')}</p></div><div class="rounded-xl bg-white p-3"><p class="text-[10px] font-extrabold text-slate-400">상담결과</p><p class="mt-2 whitespace-pre-line text-xs leading-relaxed text-slate-700">${esc(x.result||'기록 없음')}</p></div><div class="rounded-xl bg-white p-3"><p class="text-[10px] font-extrabold text-slate-400">다음회기</p><p class="mt-2 whitespace-pre-line text-xs leading-relaxed text-slate-700">${esc(x.next||'기록 없음')}</p></div></div></details>`).join(''):'<p class="text-sm text-slate-400">저장된 상담기록이 없습니다.</p>'}</div><button onclick="setMenu('counseling')" class="mt-4 w-full rounded-xl border border-slate-200 bg-white py-3 text-xs font-extrabold">상담기록에서 관리</button></section>`;
}

function memberFullChart(c){
  const latest=c.reservations[0]||{};
  const tests=[...new Set((c.reservations||[]).flatMap(r=>requestedTests(r)).map(shortTestName))];
  return `<article class="space-y-5 rounded-[2rem] border border-emerald-100 bg-slate-50 p-4 shadow-sm sm:p-6"><div class="rounded-[1.75rem] bg-gradient-to-r from-slate-950 to-emerald-950 p-5 text-white sm:p-6"><div class="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between"><div><div class="flex flex-wrap items-center gap-2"><h2 class="text-2xl font-extrabold">${esc(c.name)}님 전자차트</h2><span class="rounded-full bg-white/15 px-3 py-1 text-xs font-extrabold">${esc(normalizeStatus(latest.status||'예약신청'))}</span></div><p class="mt-2 text-sm text-slate-300">${esc(c.caseNumber||'사례번호 생성 전')} · ${esc(c.phone||'연락처 없음')} · ${esc(programBaseName(latest.program)||'프로그램 없음')}</p></div><button onclick="clearMemberChartSearch()" class="rounded-xl border border-white/20 bg-white/10 px-4 py-2 text-xs font-extrabold">다른 내담자 찾기</button></div><div class="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4"><div class="rounded-2xl bg-white/10 p-3"><p class="text-[10px] font-bold text-slate-300">사례번호 · 상태</p><p class="mt-1 text-xs font-extrabold">${esc(c.caseNumber||'생성 전')} · ${esc(caseStatusLabel(latest))}</p><p class="mt-1 text-[10px] text-slate-300">예약번호 ${esc(latest.reservationNumber||'-')}</p></div><div class="rounded-2xl bg-white/10 p-3"><p class="text-[10px] font-bold text-slate-300">신청 검사</p><p class="mt-1 text-xs font-extrabold">${esc(tests.join(', ')||'없음')}</p></div><div class="rounded-2xl bg-white/10 p-3"><p class="text-[10px] font-bold text-slate-300">상담방법</p><p class="mt-1 text-xs font-extrabold">${esc(latest.type||'미정')}</p></div><div class="rounded-2xl bg-white/10 p-3"><p class="text-[10px] font-bold text-slate-300">상담기록</p><p class="mt-1 text-xs font-extrabold">${memberChartSessionRows(c).length}건</p></div></div></div>${memberReservationSection(c)}${memberAssessmentSection(c)}${memberJournalSection(c)}</article>`;
}

function membersView(){
  const allClients=buildClients();
  const q=String(state.memberSearch||'').trim().toLowerCase();
  const normalizedQuery=q.replace(/[^0-9a-z가-힣]/gi,'');
  const clients=q?allClients.filter(c=>{
    const phone=String(c.phone||'').replace(/\D/g,'');
    const name=String(c.name||'').toLowerCase();
    const caseNumber=String(c.caseNumber||'').toLowerCase().replace(/[^0-9a-z]/g,'');return name.includes(q)||phone.includes(normalizedQuery)||caseNumber.includes(normalizedQuery);
  }):[];
  return layout(`<div class="space-y-6"><section class="rounded-[2rem] border border-slate-100 bg-white p-6 shadow-sm"><div class="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between"><div><p class="text-xs font-extrabold text-emerald-700">CLIENT CENTER 2.0</p><h2 class="mt-1 text-2xl font-extrabold">전자차트</h2><p class="mt-2 text-sm text-slate-500">이름·연락처·사례번호로 내담자를 찾으면 예약 진행상태, 심리검사 보고서와 그날 상담의 종합 정리본을 한 화면에서 확인합니다.</p></div><div class="flex w-full flex-col gap-2 sm:flex-row xl:w-auto"><input id="member-chart-search" value="${esc(state.memberSearch)}" onkeydown="if(event.key==='Enter')findMemberChart()" placeholder="이름·연락처·사례번호 입력" class="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm sm:w-80"/><button onclick="findMemberChart()" class="rounded-2xl bg-slate-900 px-6 py-3 text-sm font-extrabold text-white">내담자 찾기</button>${q?`<button onclick="clearMemberChartSearch()" class="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-extrabold text-slate-600">초기화</button>`:''}</div></div><div class="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4"><div class="rounded-2xl bg-slate-50 p-4"><p class="text-xs font-bold text-slate-400">전체 내담자</p><p class="text-2xl font-extrabold">${allClients.length}</p></div><div class="rounded-2xl bg-slate-50 p-4"><p class="text-xs font-bold text-slate-400">검색 결과</p><p class="text-2xl font-extrabold">${q?clients.length:'-'}</p></div><div class="rounded-2xl bg-slate-50 p-4"><p class="text-xs font-bold text-slate-400">심리평가 보고서</p><p class="text-2xl font-extrabold">${(state.assessmentAnalyses||[]).filter(a=>a.reviewed||a.status==='상담자 검토 완료'||a.status==='상담자 승인 완료').length+(state.reports||[]).length}</p></div><div class="rounded-2xl bg-slate-50 p-4"><p class="text-xs font-bold text-slate-400">상담기록</p><p class="text-2xl font-extrabold">${(state.sessionNotes||[]).length}</p></div></div></section>${!q?`<section class="rounded-[2rem] border border-dashed border-emerald-200 bg-emerald-50 p-12 text-center"><p class="text-4xl">🔎</p><h3 class="mt-4 text-lg font-extrabold text-emerald-950">내담자 이름 또는 연락처를 입력해 주세요.</h3><p class="mt-2 text-sm text-emerald-700">검색하면 해당 내담자의 전체 전자차트가 바로 펼쳐집니다.</p></section>`:clients.length?`<div class="space-y-6">${clients.map(memberFullChart).join('')}</div>`:`<section class="rounded-[2rem] border border-dashed border-rose-200 bg-rose-50 p-12 text-center"><p class="text-lg font-extrabold text-rose-800">일치하는 내담자를 찾지 못했습니다.</p><p class="mt-2 text-sm text-rose-600">이름·연락처·사례번호를 다시 확인해 주세요.</p></section>`}</div>`);
}


/* =========================================================
   [MOD-20260715-COUNSELING-JOURNAL-MENU]
   상담일지: 기존 상담 시작 화면으로 들어가는 독립 카테고리
========================================================= */
function counselingJournalEntryView(){
  const rows=state.reservations
    .filter(r=>!['예약취소','종결'].includes(normalizeStatus(r.status)) && !isAiResultCounselingReservation(r))
    .sort((a,b)=>`${a.date||''} ${a.time||''}`.localeCompare(`${b.date||''} ${b.time||''}`));
  return layout(`<div class="space-y-6">
    <section class="rounded-[2rem] bg-gradient-to-br from-emerald-700 to-slate-900 p-6 text-white shadow-lg sm:p-8">
      <p class="text-xs font-extrabold text-emerald-200">COUNSELING JOURNAL</p>
      <h2 class="mt-2 text-2xl font-extrabold">상담일지</h2>
      <p class="mt-2 text-sm leading-relaxed text-slate-200">대면·찾아가는·화상 상담을 진행하며 회기 내용을 작성하는 화면입니다.</p>
    </section>
    <section class="rounded-[2rem] border border-slate-100 bg-white p-5 shadow-sm sm:p-6">
      <div class="mb-5 flex items-center justify-between gap-3"><div><h3 class="text-lg font-extrabold">상담일지 대상 목록</h3><p class="mt-1 text-xs text-slate-400">대면·찾아가는·화상 상담을 선택하면 상담진행 화면이 바로 열립니다.</p></div><span class="rounded-full bg-emerald-50 px-3 py-1 text-xs font-extrabold text-emerald-700">${rows.length}건</span></div>
      <div class="space-y-3">${rows.length?rows.map(r=>`<article class="rounded-2xl border border-slate-100 bg-slate-50 p-4"><div class="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between"><div><div class="flex flex-wrap items-center gap-2"><h4 class="font-extrabold text-slate-900">${esc(r.name)}님</h4><span class="rounded-full px-3 py-1 text-[11px] font-extrabold ${statusClass(r.status)}">${esc(normalizeStatus(r.status))}</span></div><p class="mt-2 text-xs text-slate-500">${esc(r.date||'')} ${esc(r.time||'')} · ${esc(programBaseName(r.program))} · ${esc(r.type||'미정')}</p><p class="mt-1 text-xs text-slate-400">검사: ${esc(requestedTests(r).map(shortTestName).join(', ')||'없음')}</p></div><button onclick="startCounseling(${r.id})" class="rounded-xl bg-emerald-600 px-5 py-3 text-xs font-extrabold text-white hover:bg-emerald-700">상담일지 열기</button></div></article>`).join(''):empty('상담일지를 작성할 대면·화상 예약이 없습니다.')}</div>
    </section>
  </div>`)
}

/* =========================================================
   상담운영센터 2.0 · Sprint 4 상담모드
   회원 요약, 회기기록, AI 상담보조를 한 화면에서 사용합니다.
========================================================= */
function counselingModeReservation(){return state.reservations.find(r=>String(r.id)===String(state.counselingModeId))||null}
function counselingModeClient(r){return buildClients().find(c=>c.key===clientKey(r.name,r.phone))||null}
function counselingModeCase(r){return buildCases().find(c=>String(c.res.id)===String(r.id))||null}
function counselingModeDraftKey(id){return 'modumam_counseling_mode_draft_'+id}
function saveCounselingModeDraft(id){
  const data={
    date:document.getElementById('cm-date')?.value||new Date().toISOString().slice(0,10),
    theme:document.getElementById('cm-theme')?.value||'',
    emotion:document.getElementById('cm-emotion')?.value||'',
    content:document.getElementById('cm-content')?.value||'',
    change:document.getElementById('cm-change')?.value||'',
    next:document.getElementById('cm-next')?.value||'',
    updatedAt:new Date().toLocaleString('ko-KR')
  };
  save(counselingModeDraftKey(id),data);
  alert('상담 중 메모가 임시 저장되었습니다.');
}
function clearCounselingModeDraft(id){localStorage.removeItem(counselingModeDraftKey(id))}
function saveCounselingModeSession(id,finish=false){
  const r=state.reservations.find(x=>String(x.id)===String(id));
  if(!r)return;
  const date=document.getElementById('cm-date')?.value||new Date().toISOString().slice(0,10);
  const theme=(document.getElementById('cm-theme')?.value||'').trim();
  const emotion=(document.getElementById('cm-emotion')?.value||'').trim();
  const content=(document.getElementById('cm-content')?.value||'').trim();
  const change=(document.getElementById('cm-change')?.value||'').trim();
  const next=(document.getElementById('cm-next')?.value||'').trim();
  if(!content){alert('상담 내용 또는 주요 개입을 입력해 주세요.');return;}
  const now=new Date();
  const memo=[theme&&`[핵심 주제]\n${theme}`,emotion&&`[주요 정서와 반응]\n${emotion}`,`[상담 내용과 개입]\n${content}`,change&&`[변화·관찰]\n${change}`,next&&`[다음 회기 계획]\n${next}`].filter(Boolean).join('\n\n');
  const ckey=clientKey(r.name,r.phone);
  const notesKey='modumam_counseling_notes_'+ckey;
  const notes=load(notesKey,[]);
  const noteId=Date.now();
  notes.unshift({id:noteId,date,theme,emotion,intervention:content,change,next,memo,createdAt:now.toLocaleString('ko-KR'),type:'structured-session',reservationId:r.id});
  save(notesKey,notes);
  const caseId=caseIdFromReservation(r);
  const caseKey='modumam_case_sessions_'+caseId;
  const sessions=load(caseKey,[]);
  sessions.unshift({id:noteId,date,goal:theme,content,change,task:'',next,emotion,createdAt:now.toLocaleString('ko-KR'),reservationId:r.id});
  save(caseKey,sessions);
  clearCounselingModeDraft(id);
  if(finish){
    const target=state.reservations.find(x=>String(x.id)===String(id));
    if(target){target.status='상담완료';target.counselingCompletedAt=now.toISOString();target.updatedAt=now.toLocaleString('ko-KR');}
    save('modumam_reservations',state.reservations);
    state.counselingModeId='';state.menu='today';
    alert('회기기록을 저장하고 상담을 완료 처리했습니다.');
  }else alert('회기기록이 저장되었습니다.');
  render();
}
function counselingModeView(){
  const r=counselingModeReservation();
  if(!r){state.counselingModeId='';return todayCounselingView();}
  const client=counselingModeClient(r)||{name:r.name,phone:r.phone,reservations:[r],intakes:[],reports:[],uploads:[],notes:[]};
  const caseData=counselingModeCase(r)||{caseId:caseIdFromReservation(r),tests:requestedTests(r),intake:null,formulation:{},sessions:[]};
  const draft=load(counselingModeDraftKey(r.id),{});
  const aid=load('modumam_counseling_aid_'+caseData.caseId,null);
  const tests=requestedTests(r).map(shortTestName);
  const started=r.counselingStartedAt?new Date(r.counselingStartedAt).toLocaleString('ko-KR'):new Date().toLocaleString('ko-KR');
  const sessionNumber=(caseData.sessions?.length||0)+1; // [FIX-20260715-JOURNAL-UI]
  return `<main class="min-h-screen bg-slate-100">
    <header class="sticky top-0 z-50 border-b border-slate-200 bg-white/95 backdrop-blur"><div class="flex flex-col gap-3 px-4 py-4 sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:px-8"><div class="flex items-center gap-3"><button onclick="closeCounselingMode()" class="rounded-xl border border-slate-200 px-3 py-2 text-xs font-extrabold">← 상담일지</button><div><p class="text-[11px] font-extrabold text-emerald-700">${esc(r.caseNumber||'사례번호 생성 전')} · 상담일지 · ${sessionNumber}회기</p><h1 class="text-xl font-extrabold">${esc(r.name)}님 · ${esc(programBaseName(r.program))}</h1><p class="mt-1 text-xs text-slate-400">${esc(tests.join(' · ')||'검사 없음')} · 예약 ${esc(r.date)} ${esc(r.time)} · 시작 ${esc(started)}</p></div></div><div class="flex flex-wrap gap-2"><button onclick="saveCounselingModeDraft(${r.id})" class="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-extrabold">임시 저장</button><button onclick="saveCounselingModeSession(${r.id},false)" class="rounded-xl bg-blue-600 px-4 py-2 text-xs font-extrabold text-white">회기 저장</button><button onclick="saveCounselingModeSession(${r.id},true)" class="rounded-xl bg-slate-900 px-4 py-2 text-xs font-extrabold text-white">상담 종료</button></div></div></header>
    <div class="grid grid-cols-1 gap-5 p-4 sm:p-6 lg:grid-cols-[260px_minmax(0,1fr)_320px] lg:p-8">
      <aside class="space-y-4">
        <section class="rounded-[2rem] border border-slate-100 bg-white p-5 shadow-sm"><div class="flex items-center gap-3"><div class="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-100 text-xl">👤</div><div><h2 class="text-lg font-extrabold">${esc(r.name)}님</h2><p class="text-xs text-slate-400">${esc(r.phone||'연락처 없음')}</p></div></div><div class="mt-5 space-y-3 text-xs"><div class="rounded-2xl bg-slate-50 p-3"><p class="font-bold text-slate-400">프로그램</p><p class="mt-1 font-extrabold">${esc(programBaseName(r.program))}</p></div><div class="rounded-2xl bg-slate-50 p-3"><p class="font-bold text-slate-400">검사명</p><p class="mt-1 font-extrabold">${esc(tests.join(', ')||'없음')}</p></div><div class="rounded-2xl bg-slate-50 p-3"><p class="font-bold text-slate-400">상담방식</p><p class="mt-1 font-extrabold">${esc(r.type||'미정')}</p></div><div class="rounded-2xl bg-slate-50 p-3"><p class="font-bold text-slate-400">예약시간</p><p class="mt-1 font-extrabold">${esc(r.date)} ${esc(r.time)}</p></div><div class="rounded-2xl bg-slate-50 p-3"><p class="font-bold text-slate-400">진행상태</p><p class="mt-1 font-extrabold">${esc(normalizeStatus(r.status))}</p></div></div></section>
        <section class="rounded-[2rem] border border-slate-100 bg-white p-5 shadow-sm"><h3 class="text-sm font-extrabold">심리검사</h3><div class="mt-3 flex flex-wrap gap-2">${tests.length?tests.map(t=>`<span class="rounded-full bg-indigo-50 px-3 py-1.5 text-xs font-extrabold text-indigo-700">${esc(t)}</span>`).join(''):'<span class="text-xs text-slate-400">신청 검사 없음</span>'}</div></section>
        <details class="rounded-[2rem] border border-slate-100 bg-white p-5 shadow-sm"><summary class="cursor-pointer text-sm font-extrabold">최근 참고정보 펼치기</summary><div class="mt-4 space-y-3 text-xs"><div><p class="font-bold text-slate-400">AI 마음체크</p><p class="mt-1 whitespace-pre-line text-slate-600">${esc(caseData.intake?.summary||caseData.intake?.concern||'기록 없음')}</p></div><div><p class="font-bold text-slate-400">이전 회기</p><p class="mt-1 text-slate-600">${caseData.sessions.length}건</p></div><div><p class="font-bold text-slate-400">결과보고서</p><p class="mt-1 text-slate-600">${client.reports?.length||0}건</p></div></div></details>
      </aside>
      <section class="rounded-[2rem] border border-slate-100 bg-white p-5 shadow-sm sm:p-6"><div class="mb-5"><p class="text-xs font-extrabold text-blue-700">SESSION NOTE</p><h2 class="mt-1 text-xl font-extrabold">${sessionNumber}회기 상담일지</h2><p class="mt-1 text-xs text-slate-400">상담 중 필요한 내용을 실무 흐름에 따라 기록합니다.</p></div><div class="grid grid-cols-1 gap-3 sm:grid-cols-2"><div><label class="mb-1 block text-xs font-bold text-slate-500">상담일</label><input id="cm-date" type="date" value="${esc(draft.date||new Date().toISOString().slice(0,10))}" class="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm"/></div><div><label class="mb-1 block text-xs font-bold text-slate-500">오늘의 핵심주제</label><input id="cm-theme" value="${esc(draft.theme||'')}" placeholder="오늘 가장 중요한 상담 주제" class="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm"/></div></div><label class="mb-1 mt-4 block text-xs font-bold text-slate-500">내담자의 이야기와 주요 정서</label><textarea id="cm-emotion" rows="3" placeholder="표현된 감정, 신체반응, 말투와 태도" class="w-full resize-none rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm">${esc(draft.emotion||'')}</textarea><label class="mb-1 mt-4 block text-xs font-bold text-slate-500">상담자의 개입 및 상담 내용</label><textarea id="cm-content" rows="10" placeholder="내담자의 핵심 이야기, 상담자의 질문과 개입, 확인한 의미를 기록하세요." class="w-full resize-y rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm leading-relaxed">${esc(draft.content||'')}</textarea><label class="mb-1 mt-4 block text-xs font-bold text-slate-500">내담자의 변화·위험·보호요인</label><textarea id="cm-change" rows="4" placeholder="회기 중 변화, 강점, 위험 신호와 보호요인" class="w-full resize-none rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm">${esc(draft.change||'')}</textarea><label class="mb-1 mt-4 block text-xs font-bold text-slate-500">다음 회기 계획·과제</label><textarea id="cm-next" rows="4" placeholder="다음에 이어갈 주제와 실천과제" class="w-full resize-none rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm">${esc(draft.next||'')}</textarea></section>
      <aside class="space-y-4"><section class="rounded-[2rem] border border-purple-100 bg-white p-5 shadow-sm"><div class="flex items-center justify-between gap-2"><div><p class="text-xs font-extrabold text-purple-700">AI COUNSELING AID 2.0</p><h2 class="mt-1 text-lg font-extrabold">AI 상담도우미</h2></div><button onclick="generateCounselingAid('${caseData.caseId}')" ${state.counselingAidLoading[caseData.caseId]?'disabled':''} class="rounded-xl bg-purple-600 px-3 py-2 text-xs font-extrabold text-white disabled:opacity-50">${state.counselingAidLoading[caseData.caseId]?'분석 중...':(aid?'메모 반영해 갱신':'초안 생성')}</button></div><p class="mt-2 text-[11px] leading-relaxed text-slate-400">현재 작성 중인 회기 메모와 기존 검사·상담 자료를 함께 반영합니다.</p>${aid?`<div class="mt-4 space-y-3"><div><label class="text-xs font-extrabold text-purple-700">현재 핵심 정서</label><textarea id="aid-emotion-${caseData.caseId}" rows="3" class="mt-1 w-full resize-none rounded-xl border border-purple-100 bg-purple-50 p-3 text-xs leading-relaxed">${esc(aid.emotion||'')}</textarea></div><div><label class="text-xs font-extrabold text-purple-700">상담목표</label><textarea id="aid-focus-${caseData.caseId}" rows="4" class="mt-1 w-full resize-none rounded-xl border border-slate-200 p-3 text-xs leading-relaxed">${esc(aid.focus||'')}</textarea></div><div><label class="text-xs font-extrabold text-purple-700">추천 질문</label><textarea id="aid-questions-${caseData.caseId}" rows="7" class="mt-1 w-full resize-y rounded-xl border border-slate-200 p-3 text-xs leading-relaxed">${esc(aid.questions||'')}</textarea></div><div><label class="text-xs font-extrabold text-purple-700">권장 개입</label><textarea id="aid-intervention-${caseData.caseId}" rows="5" class="mt-1 w-full resize-y rounded-xl border border-slate-200 p-3 text-xs leading-relaxed">${esc(aid.intervention||'')}</textarea></div><div><label class="text-xs font-extrabold text-emerald-700">강점·보호요인</label><textarea id="aid-strengths-${caseData.caseId}" rows="4" class="mt-1 w-full resize-none rounded-xl border border-emerald-100 bg-emerald-50 p-3 text-xs leading-relaxed">${esc(aid.strengths||'')}</textarea></div><div><label class="text-xs font-extrabold text-rose-700">주의할 점</label><textarea id="aid-caution-${caseData.caseId}" rows="4" class="mt-1 w-full resize-none rounded-xl border border-rose-100 bg-rose-50 p-3 text-xs leading-relaxed">${esc(aid.caution||'')}</textarea></div><div><label class="text-xs font-extrabold text-blue-700">다음 회기 연결</label><textarea id="aid-next-${caseData.caseId}" rows="4" class="mt-1 w-full resize-none rounded-xl border border-blue-100 bg-blue-50 p-3 text-xs leading-relaxed">${esc(aid.nextPlan||'')}</textarea></div><textarea id="aid-source-${caseData.caseId}" class="hidden">${esc(aid.source||'')}</textarea><div class="grid grid-cols-2 gap-2"><button onclick="saveCounselingAid('${caseData.caseId}')" class="rounded-xl bg-slate-900 py-2 text-xs font-extrabold text-white">수정 저장</button><button onclick="copyCounselingAid('${caseData.caseId}')" class="rounded-xl border border-purple-200 py-2 text-xs font-extrabold text-purple-700">내용 복사</button></div><p class="text-[10px] text-slate-400">생성 ${esc(aid.updatedAt||'')} ${aid.model?`· ${esc(aid.model)}`:''}</p></div>`:`<div class="mt-5 rounded-2xl border border-dashed border-purple-200 bg-purple-50 p-4 text-xs leading-relaxed text-purple-700">회기 메모를 일부 입력한 뒤 초안을 생성하면 현재 정서와 상담 흐름에 더 맞는 제안을 받을 수 있습니다.</div>`}</section><section class="rounded-[2rem] border border-slate-100 bg-white p-5 shadow-sm"><h3 class="text-sm font-extrabold">상담 후 처리</h3><div class="mt-3 space-y-2"><button onclick="saveCounselingModeSession(${r.id},false)" class="w-full rounded-xl bg-blue-50 px-3 py-3 text-xs font-extrabold text-blue-700">회기기록 저장</button><button onclick="saveCounselingModeSession(${r.id},true)" class="w-full rounded-xl bg-slate-900 px-3 py-3 text-xs font-extrabold text-white">저장 후 상담 완료</button><button onclick="scheduleNextCounseling(${r.id})" class="w-full rounded-xl bg-purple-50 px-3 py-3 text-xs font-extrabold text-purple-700">다음 상담 예약</button></div></section><p class="px-2 text-[10px] leading-relaxed text-slate-400">AI 제안은 상담자의 판단을 돕는 참고자료이며 진단이나 최종 임상 판단을 대신하지 않습니다.</p></aside>
    </div>
  </main>`;
}



/* =========================================================
   상담운영센터 · AI 사례종결평가 V21
   초기자료·심리평가·사례개념화·상담계획·검토 완료 회기기록 비교
========================================================= */

/* [MODUMAM-CLIENT-MANAGEMENT-20260727] 홈페이지 예약과 무관한 내담자 직접등록 */
function normalizeClientPhone(value){return String(value||'').replace(/[^0-9]/g,'')}
function clientManagementRows(){
  const manual=Array.isArray(state.clients)?state.clients:[];
  const merged=new Map();
  buildClients().forEach(c=>merged.set(c.key,c));
  manual.forEach(c=>{const key=c.key||clientKey(c.name,c.phone);merged.set(key,{...(merged.get(key)||{}),...c,key})});
  return [...merged.values()].sort((a,b)=>String(a.name||'').localeCompare(String(b.name||''),'ko'));
}
function readClientForm(){
  return {
    name:document.getElementById('client-name')?.value.trim()||'',
    phone:document.getElementById('client-phone')?.value.trim()||'',
    birth:document.getElementById('client-birth')?.value||'',
    guardian:document.getElementById('client-guardian')?.value.trim()||'',
    school:document.getElementById('client-school')?.value.trim()||'',
    grade:document.getElementById('client-grade')?.value.trim()||'',
    referral:document.getElementById('client-referral')?.value.trim()||'',
    memo:document.getElementById('client-memo')?.value.trim()||''
  };
}
function saveManualClient(){
  const form=readClientForm();
  if(!form.name){alert('내담자 이름을 입력해 주세요.');return}
  if(!form.phone){alert('연락처를 입력해 주세요.');return}
  const phoneKey=normalizeClientPhone(form.phone);
  const rows=Array.isArray(state.clients)?[...state.clients]:[];
  const duplicate=rows.find(c=>normalizeClientPhone(c.phone)===phoneKey&&String(c.name||'').trim()===form.name);
  const now=new Date().toLocaleString('ko-KR');
  if(duplicate){Object.assign(duplicate,form,{key:duplicate.key||clientKey(form.name,form.phone),updatedAt:now});}
  else rows.unshift({id:'client-'+Date.now(),key:clientKey(form.name,form.phone),...form,source:'관리자 직접등록',createdAt:now,updatedAt:now});
  state.clients=rows;save('modumam_clients',rows);alert(duplicate?'내담자 정보를 수정했습니다.':'내담자를 등록했습니다.');render();
}
function editManualClient(key){
  const c=clientManagementRows().find(x=>x.key===key);if(!c)return;
  state.clientEditingKey=key;state.clientFormDraft={...c};render();
}
function cancelManualClientEdit(){state.clientEditingKey='';state.clientFormDraft=null;render()}
function updateManualClient(key){
  const form=readClientForm();if(!form.name||!form.phone){alert('이름과 연락처를 입력해 주세요.');return}
  const rows=Array.isArray(state.clients)?[...state.clients]:[];
  let row=rows.find(c=>(c.key||clientKey(c.name,c.phone))===key);
  if(!row){row={id:'client-'+Date.now(),source:'관리자 직접등록',createdAt:new Date().toLocaleString('ko-KR')};rows.unshift(row)}
  Object.assign(row,form,{key:clientKey(form.name,form.phone),updatedAt:new Date().toLocaleString('ko-KR')});
  state.clients=rows;save('modumam_clients',rows);state.clientEditingKey='';state.clientFormDraft=null;alert('내담자 정보를 저장했습니다.');render();
}
function deleteManualClient(key){
  const rows=Array.isArray(state.clients)?state.clients:[];
  const c=rows.find(x=>(x.key||clientKey(x.name,x.phone))===key);
  if(!c){alert('홈페이지 예약에서 생성된 내담자는 전자차트에서 연결 기록을 관리해 주세요.');return}
  if(!confirm(`${c.name}님의 직접등록 정보만 삭제할까요? 예약·검사·상담 기록은 삭제되지 않습니다.`))return;
  state.clients=rows.filter(x=>(x.key||clientKey(x.name,x.phone))!==key);save('modumam_clients',state.clients);render();
}

function clientManagementView(){
  const q=String(state.clientSearch||'').trim().toLowerCase();
  const rows=clientManagementRows().filter(c=>!q||`${c.name||''} ${c.phone||''} ${c.guardian||''} ${c.school||''}`.toLowerCase().includes(q));
  const d=state.clientFormDraft||{};
  const editing=Boolean(state.clientEditingKey);
  return layout(`<div class="space-y-6">
    <section class="rounded-[2rem] bg-slate-950 p-6 text-white sm:p-8"><p class="text-xs font-extrabold text-emerald-300">CLIENT MANAGEMENT</p><h2 class="mt-2 text-2xl font-extrabold">내담자관리</h2><p class="mt-2 text-sm text-slate-300">홈페이지 예약 여부와 관계없이 전화·방문·검사 의뢰 내담자를 직접 등록하고 전자차트에 연결합니다.</p></section>
    <section class="rounded-[2rem] border border-slate-100 bg-white p-6 shadow-sm"><div class="mb-5"><p class="text-xs font-extrabold text-emerald-700">${editing?'EDIT CLIENT':'NEW CLIENT'}</p><h3 class="mt-1 text-lg font-extrabold">${editing?'내담자 정보 수정':'내담자 신규등록'}</h3></div><div class="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4"><input id="client-name" value="${esc(d.name||'')}" placeholder="이름 *" class="rounded-xl border border-slate-200 px-4 py-3 text-sm"><input id="client-phone" value="${esc(d.phone||'')}" placeholder="연락처 *" class="rounded-xl border border-slate-200 px-4 py-3 text-sm"><input id="client-birth" type="date" value="${esc(d.birth||'')}" class="rounded-xl border border-slate-200 px-4 py-3 text-sm"><input id="client-guardian" value="${esc(d.guardian||'')}" placeholder="보호자" class="rounded-xl border border-slate-200 px-4 py-3 text-sm"><input id="client-school" value="${esc(d.school||'')}" placeholder="학교" class="rounded-xl border border-slate-200 px-4 py-3 text-sm"><input id="client-grade" value="${esc(d.grade||'')}" placeholder="학년" class="rounded-xl border border-slate-200 px-4 py-3 text-sm"><input id="client-referral" value="${esc(d.referral||'')}" placeholder="의뢰기관" class="rounded-xl border border-slate-200 px-4 py-3 text-sm"><input id="client-memo" value="${esc(d.memo||'')}" placeholder="메모" class="rounded-xl border border-slate-200 px-4 py-3 text-sm"></div><div class="mt-4 flex gap-2"><button onclick="${editing?`updateManualClient('${esc(state.clientEditingKey)}')`:'saveManualClient()'}" class="rounded-xl bg-emerald-600 px-5 py-3 text-xs font-extrabold text-white">${editing?'수정 저장':'내담자 등록'}</button>${editing?'<button onclick="cancelManualClientEdit()" class="rounded-xl border border-slate-200 px-5 py-3 text-xs font-extrabold">취소</button>':''}</div></section>
    <section class="rounded-[2rem] border border-slate-100 bg-white p-6 shadow-sm"><div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><h3 class="text-lg font-extrabold">전체 내담자</h3><p class="mt-1 text-xs text-slate-400">직접등록 내담자와 홈페이지 예약 내담자를 함께 표시합니다.</p></div><input value="${esc(state.clientSearch||'')}" oninput="state.clientSearch=this.value;render()" placeholder="이름·연락처·학교 검색" class="rounded-xl border border-slate-200 px-4 py-3 text-sm"></div><div class="mt-5 space-y-3">${rows.length?rows.map(c=>`<article class="rounded-2xl border border-slate-100 bg-slate-50 p-4"><div class="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between"><div><div class="flex flex-wrap items-center gap-2"><h4 class="font-extrabold text-slate-900">${esc(c.name)}님</h4><span class="rounded-full bg-white px-2.5 py-1 text-[10px] font-bold text-slate-500">${esc(c.source||((c.reservations||[]).length?'홈페이지/예약 연결':'기록 연결'))}</span></div><p class="mt-1 text-xs text-slate-500">${esc(c.phone||'연락처 없음')}${c.birth?` · ${esc(c.birth)}`:''}${c.school?` · ${esc(c.school)} ${esc(c.grade||'')}`:''}</p><p class="mt-1 text-[11px] text-slate-400">예약 ${(c.reservations||[]).length}건 · 검사 ${(c.uploads||[]).length}건 · 보고서 ${(c.reports||[]).length}건</p></div><div class="flex flex-wrap gap-2"><button onclick="openClientChart('${esc(c.key)}')" class="rounded-xl bg-slate-900 px-3 py-2 text-xs font-extrabold text-white">전자차트</button><button onclick="editManualClient('${esc(c.key)}')" class="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-extrabold">수정</button><button onclick="deleteManualClient('${esc(c.key)}')" class="rounded-xl border border-rose-200 bg-white px-3 py-2 text-xs font-extrabold text-rose-600">직접등록 삭제</button></div></div></article>`).join(''):empty('등록된 내담자가 없습니다.')}</div></section>
  </div>`);
}


// [MOD-20260824-CANCELLATION-ACTION-DELEGATION-V2]
if (!window.__mmlCancellationActionDelegationInstalled) {
  window.__mmlCancellationActionDelegationInstalled = true;
  document.addEventListener('click', async (event) => {
    const button = event.target?.closest?.('[data-mml-action="reservation-cancel-approve"],[data-mml-action="reservation-cancel-reject"]');
    if (!button) return;
    event.preventDefault();
    event.stopPropagation();
    const id = button.getAttribute('data-reservation-id') || '';
    const action = button.getAttribute('data-mml-action');
    if (!id) return alert('예약 정보를 찾지 못했습니다.');
    button.disabled = true;
    try {
      const fn = action === 'reservation-cancel-approve'
        ? window.approveReservationCancellation
        : window.rejectReservationCancellation;
      if (typeof fn !== 'function') throw new Error('취소 처리 기능을 불러오지 못했습니다.');
      await fn(id);
    } catch (error) {
      console.error('[예약 취소 처리]', error);
      alert('예약 취소 처리 중 오류가 발생했습니다.\\n' + String(error?.message || error));
    } finally {
      if (button.isConnected) button.disabled = false;
    }
  });
}


// [MOD-20260825-AI-COUNSELING-BUTTON-RESTORE]
if (!window.__mmlAiCounselingButtonInstalled) {
  window.__mmlAiCounselingButtonInstalled = true;
  document.addEventListener('click', async (event) => {
    const button = event.target?.closest?.('[data-mml-action="ai-counseling-toggle"]');
    if (!button) return;

    event.preventDefault();
    event.stopPropagation();

    const id = button.getAttribute('data-reservation-id') || '';
    const nextEnabled = button.getAttribute('data-next-enabled') === 'true';

    if (!id) {
      alert('예약 정보를 찾지 못했습니다.');
      return;
    }

    if (button.dataset.processing === 'true') return;
    button.dataset.processing = 'true';
    button.disabled = true;

    try {
      if (typeof window.toggleAiCounselingActivation !== 'function') {
        throw new Error('AI 상담 활성화 기능을 불러오지 못했습니다.');
      }
      await window.toggleAiCounselingActivation(id, nextEnabled);
    } catch (error) {
      console.error('[AI 상담 활성화]', error);
      alert('AI 상담 상태 변경 중 오류가 발생했습니다.\n' + String(error?.message || error));
      button.disabled = false;
      button.dataset.processing = 'false';
    }
  }, true);
}
