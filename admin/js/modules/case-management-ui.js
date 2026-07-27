console.info('[MML] CASE-MANAGEMENT-UI-STEP20 loaded');

(function(global){
  'use strict';

  const VERSION='20260725-case-management-ui-step20';
  const originalStatisticsView=global.statisticsView;

  const text=value=>String(value??'').trim();
  const array=value=>Array.isArray(value)?value:[];
  const html=value=>{
    if(typeof global.esc==='function')return global.esc(String(value??''));
    return String(value??'').replace(/[&<>"']/g,ch=>({
      '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
    })[ch]);
  };
  const short=(value,length=100)=>{
    const source=text(value);
    return source.length>length?`${source.slice(0,length)}…`:source;
  };
  const pct=value=>Math.max(0,Math.min(100,Number(value)||0));

  function engine(){
    if(!global.MMLCaseManagementEngine){
      throw new Error('사례관리 엔진이 준비되지 않았습니다.');
    }
    return global.MMLCaseManagementEngine;
  }

  function hub(){
    if(!global.MMLIntegratedWorkflowHub){
      throw new Error('통합 워크플로 허브가 준비되지 않았습니다.');
    }
    return global.MMLIntegratedWorkflowHub;
  }

  function renderApp(){
    if(typeof global.render==='function')global.render();
  }

  function notify(message){
    alert(message);
  }

  function statusClass(status){
    const value=text(status);
    if(value==='종결')return 'bg-slate-200 text-slate-700';
    if(value.includes('진행'))return 'bg-emerald-100 text-emerald-700';
    if(value.includes('초기'))return 'bg-blue-100 text-blue-700';
    return 'bg-amber-100 text-amber-700';
  }

  function priorityClass(priority){
    if(priority==='높음')return 'border-rose-200 bg-rose-50 text-rose-700';
    if(priority==='주의')return 'border-amber-200 bg-amber-50 text-amber-700';
    return 'border-slate-200 bg-white text-slate-600';
  }

  function progressBar(label,value){
    const score=pct(value);
    return `<div>
      <div class="flex items-center justify-between gap-3 text-xs">
        <span class="font-bold text-slate-600">${html(label)}</span>
        <span class="font-extrabold text-slate-900">${score}%</span>
      </div>
      <div class="mt-2 h-2 overflow-hidden rounded-full bg-slate-100">
        <div class="h-full rounded-full bg-emerald-500" style="width:${score}%"></div>
      </div>
    </div>`;
  }

  function metricValue(value){
    return value==null?'-':`${Number(value)}%`;
  }

  function metricCard(label,value,reverse=false){
    const number=value==null?null:Number(value);
    const description=number==null
      ?'아직 기록 없음'
      :reverse
        ?(number<=30?'낮음':number<=60?'중간':'높음')
        :(number>=70?'좋음':number>=40?'변화 중':'초기');
    return `<div class="rounded-2xl border border-slate-100 bg-white p-4">
      <p class="text-[11px] font-extrabold text-slate-400">${html(label)}</p>
      <p class="mt-2 text-2xl font-extrabold text-slate-900">${metricValue(number)}</p>
      <p class="mt-1 text-[10px] font-bold text-slate-400">${html(description)}</p>
    </div>`;
  }

  function formatStructured(record){
    const labels={S:'S · 주관적 자료',O:'O · 객관적 자료',A:'A · 평가',P:'P · 계획',
      D:'D · 자료',B:'B · 행동',I:'I · 개입',R:'R · 반응'};
    return Object.entries(record?.structured||{}).map(([key,value])=>`
      <div class="rounded-xl bg-slate-50 p-3">
        <p class="text-[10px] font-extrabold text-indigo-600">${html(labels[key]||key)}</p>
        <p class="mt-2 whitespace-pre-wrap text-xs leading-relaxed text-slate-600">${html(short(value,280))}</p>
      </div>`).join('');
  }

  function timelineHtml(rows){
    return array(rows).map((item,index)=>`
      <div class="relative pl-8">
        ${index<rows.length-1?'<div class="absolute left-[9px] top-5 h-[calc(100%+12px)] w-px bg-slate-200"></div>':''}
        <div class="absolute left-0 top-1 h-5 w-5 rounded-full border-4 border-white bg-indigo-500 shadow"></div>
        <div class="rounded-2xl border border-slate-100 bg-slate-50 p-4">
          <div class="flex items-start justify-between gap-3">
            <div>
              <span class="rounded-full bg-white px-2 py-1 text-[10px] font-extrabold text-slate-500">${html(item.type)}</span>
              <h5 class="mt-2 text-sm font-extrabold text-slate-900">${html(item.label)}</h5>
            </div>
            <span class="text-[10px] text-slate-400">${html(text(item.date).slice(0,10))}</span>
          </div>
          <p class="mt-2 text-xs font-bold text-slate-500">${html(item.status)}</p>
        </div>
      </div>`).join('')||'<p class="text-sm text-slate-400">표시할 진행 기록이 없습니다.</p>';
  }

  function actionButton(label,onclick,kind='dark'){
    const classes={
      dark:'bg-slate-900 text-white',
      indigo:'bg-indigo-600 text-white',
      emerald:'bg-emerald-600 text-white',
      white:'border border-slate-200 bg-white text-slate-700',
      rose:'bg-rose-50 text-rose-700'
    };
    return `<button onclick="${onclick}" class="rounded-xl px-3 py-2.5 text-xs font-extrabold ${classes[kind]||classes.dark}">${html(label)}</button>`;
  }

  function cardView(summary){
    let dashboard,bundle,followup;
    try{
      dashboard=engine().buildDashboard(summary.reservationId);
      bundle=hub().caseBundle(summary.reservationId);
      followup=engine().buildFollowUp(summary.reservationId);
    }catch(error){
      return `<section class="rounded-[2rem] border border-rose-100 bg-rose-50 p-5">
        <p class="font-extrabold text-rose-700">${html(summary.reservationId)} 사례를 불러오지 못했습니다.</p>
        <p class="mt-2 text-xs text-rose-600">${html(error.message||error)}</p>
      </section>`;
    }

    const records=array(bundle.electronicChart.counselingRecords)
      .slice()
      .sort((a,b)=>String(b.sessionDate||b.createdAt).localeCompare(String(a.sessionDate||a.createdAt)));
    const sessions=array(bundle.electronicChart.counseling)
      .slice()
      .sort((a,b)=>String(b.createdAt).localeCompare(String(a.createdAt)));
    const latestRecord=records[0]||null;
    const latestMetric=dashboard.latestMetric;
    const canCreateRecord=sessions.length>0;

    return `<section class="rounded-[2rem] border border-slate-100 bg-white p-5 shadow-sm sm:p-6">
      <div class="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div>
          <div class="flex flex-wrap items-center gap-2">
            <h3 class="text-xl font-extrabold text-slate-950">${html(dashboard.clientName||'이름 미확인')}</h3>
            <span class="rounded-full px-3 py-1 text-xs font-extrabold ${statusClass(dashboard.status)}">${html(dashboard.status)}</span>
            <span class="rounded-full bg-slate-100 px-3 py-1 text-xs font-extrabold text-slate-600">진행률 ${dashboard.progress.percent}%</span>
          </div>
          <p class="mt-2 text-xs text-slate-400">예약 ID ${html(summary.reservationId)} · 마지막 활동 ${html(text(dashboard.lastActivity).slice(0,10)||'기록 없음')}</p>
          <p class="mt-3 text-sm font-extrabold text-indigo-700">다음 조치: ${html(dashboard.nextAction)}</p>
        </div>
        <div class="flex flex-wrap gap-2">
          ${actionButton('전자차트 동기화',`mmlSyncCase('${summary.reservationId}')`,'white')}
          ${actionButton(bundle.state.hasFormulation?'사례개념화 검토':'AI 사례개념화',`setMenu('cases')`,'dark')}
          ${actionButton('다음 회기 준비',`mmlOpenFollowUp('${summary.reservationId}')`,'indigo')}
          ${actionButton('회복지표 입력',`mmlOpenMetricForm('${summary.reservationId}')`,'emerald')}
          ${dashboard.status==='종결'
            ?actionButton('사례 재개',`mmlReopenCase('${summary.reservationId}')`,'white')
            :actionButton('종결평가',`mmlOpenTermination('${summary.reservationId}')`,'rose')}
        </div>
      </div>

      <div class="mt-5 grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-8">
        ${[
          ['전자차트',dashboard.progress.complete>=2],
          ['검사결과',bundle.state.hasAssessment],
          ['보고서',bundle.state.hasReport],
          ['승인',bundle.state.hasApprovedReport],
          ['사용자 공개',bundle.state.isPublished],
          ['사례개념화',bundle.state.hasFormulation],
          ['AI 상담',bundle.state.hasCounseling],
          ['상담기록',bundle.state.hasCounselingRecord]
        ].map(([label,complete])=>`<div class="rounded-2xl border ${complete?'border-emerald-100 bg-emerald-50':'border-slate-100 bg-slate-50'} p-3 text-center">
          <p class="text-lg">${complete?'✓':'·'}</p>
          <p class="mt-1 text-[10px] font-extrabold ${complete?'text-emerald-700':'text-slate-400'}">${html(label)}</p>
        </div>`).join('')}
      </div>

      <div class="mt-5 grid grid-cols-1 gap-5 xl:grid-cols-[1.1fr_.9fr]">
        <div class="rounded-[1.5rem] border border-slate-100 bg-white p-5">
          <div class="flex items-center justify-between">
            <h4 class="text-lg font-extrabold">회기·업무 타임라인</h4>
            <span class="text-xs font-bold text-slate-400">${dashboard.timeline.length}건</span>
          </div>
          <div class="mt-5 space-y-4">${timelineHtml(dashboard.timeline)}</div>
        </div>

        <div class="space-y-5">
          <div class="rounded-[1.5rem] border border-slate-100 bg-slate-50 p-5">
            <div class="flex items-center justify-between gap-3">
              <div><p class="text-xs font-extrabold text-slate-500">상담기록</p><p class="mt-1 text-2xl font-extrabold">${records.length}회기</p></div>
              ${canCreateRecord
                ?actionButton('AI 기록 작성',`mmlOpenRecordForm('${summary.reservationId}','${html(sessions[0].id)}')`,'dark')
                :'<span class="text-[10px] font-bold text-slate-400">AI 상담 세션 없음</span>'}
            </div>
            ${latestRecord?`<div class="mt-4 rounded-2xl border border-slate-100 bg-white p-4">
              <div class="flex items-center justify-between gap-2">
                <p class="text-sm font-extrabold">${Number(latestRecord.sessionNumber||1)}회기 · ${html(latestRecord.format)}</p>
                <span class="rounded-full px-2 py-1 text-[10px] font-extrabold ${latestRecord.approved?'bg-emerald-100 text-emerald-700':'bg-amber-100 text-amber-700'}">${html(latestRecord.status)}</span>
              </div>
              <p class="mt-2 text-xs leading-relaxed text-slate-500">${html(short(latestRecord.summary,180))}</p>
              <div class="mt-3 grid grid-cols-1 gap-2">${formatStructured(latestRecord)}</div>
              <div class="mt-3 flex gap-2">
                ${latestRecord.approved
                  ?actionButton('검토 취소',`mmlRevokeRecord('${html(latestRecord.id)}')`,'white')
                  :actionButton('검토 완료',`mmlApproveRecord('${html(latestRecord.id)}')`,'emerald')}
              </div>
            </div>`:'<p class="mt-4 text-xs text-slate-400">아직 생성된 상담기록이 없습니다.</p>'}
          </div>

          <div class="rounded-[1.5rem] border border-slate-100 bg-white p-5">
            <div class="flex items-center justify-between">
              <h4 class="text-sm font-extrabold">최근 회복지표</h4>
              <span class="text-[10px] text-slate-400">${html(latestMetric?.date||'')}</span>
            </div>
            <div class="mt-4 grid grid-cols-2 gap-3 md:grid-cols-5 xl:grid-cols-2">
              ${[
                metricCard('불안',latestMetric?.anxiety,true),
                metricCard('우울',latestMetric?.depression,true),
                metricCard('스트레스',latestMetric?.stress,true),
                metricCard('회복감',latestMetric?.recovery,false),
                metricCard('목표달성',latestMetric?.goalAchievement,false)
              ].join('')}
            </div>
          </div>
        </div>
      </div>

      <div class="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div class="rounded-[1.5rem] border border-indigo-100 bg-indigo-50/40 p-5">
          <p class="text-xs font-extrabold text-indigo-700">다음 회기 초점</p>
          <p class="mt-3 text-sm leading-relaxed text-slate-700">${html(followup.nextAction)}</p>
          <p class="mt-3 text-xs leading-relaxed text-slate-500">${html(followup.changesToCheck.slice(0,2).join(' · '))}</p>
        </div>
        <div class="rounded-[1.5rem] border border-amber-100 bg-amber-50/40 p-5">
          <p class="text-xs font-extrabold text-amber-700">미확인 과제</p>
          <p class="mt-3 text-2xl font-extrabold">${dashboard.pendingHomework.length}건</p>
          <p class="mt-2 text-xs text-slate-500">${html(dashboard.pendingHomework.slice(0,2).map(x=>x.task||x).join(' · ')||'미확인 과제가 없습니다.')}</p>
        </div>
        <div class="rounded-[1.5rem] border border-rose-100 bg-rose-50/40 p-5">
          <p class="text-xs font-extrabold text-rose-700">직접 확인할 위험 신호</p>
          <p class="mt-3 text-2xl font-extrabold">${dashboard.riskFlags.length}건</p>
          <p class="mt-2 text-xs text-slate-500">${html(dashboard.riskFlags.map(x=>x.type).join(', ')||'현재 기록된 신호 없음')}</p>
        </div>
      </div>
    </section>`;
  }

  function caseManagementView(){
    let summaries=[],stats={alerts:[]};
    try{
      summaries=hub().allCases();
      stats=engine().operationalStatistics();
    }catch(error){
      return global.layout(`<div class="rounded-[2rem] border border-rose-100 bg-rose-50 p-6">
        <h2 class="text-xl font-extrabold text-rose-700">사례관리 화면을 불러오지 못했습니다.</h2>
        <p class="mt-2 text-sm text-rose-600">${html(error.message||error)}</p>
      </div>`);
    }

    return global.layout(`<div class="space-y-6">
      <section class="rounded-[2rem] bg-gradient-to-r from-slate-950 via-indigo-950 to-emerald-950 p-6 text-white shadow-xl sm:p-8">
        <p class="text-xs font-extrabold text-emerald-300">CASE MANAGEMENT · STEP20</p>
        <h2 class="mt-2 text-2xl font-extrabold">사례관리</h2>
        <p class="mt-2 text-sm text-slate-300">사례개념화·개입계획·상담기록·회복지표·종결평가를 사례별로 통합 관리합니다.</p>
      </section>

      <section class="grid grid-cols-2 gap-3 lg:grid-cols-6">
        ${[
          ['전체 사례',stats.totalCases,'건'],
          ['진행 중',stats.activeCases,'건'],
          ['종결',stats.closedCases,'건'],
          ['상담기록',stats.counselingRecordCount,'건'],
          ['승인 대기',stats.pendingApproval,'건'],
          ['AI 상담 이용률',stats.aiCounselingRate,'%']
        ].map(([label,value,suffix])=>`<div class="rounded-[1.5rem] border border-slate-100 bg-white p-4 shadow-sm">
          <p class="text-[11px] font-extrabold text-slate-400">${html(label)}</p>
          <p class="mt-2 text-2xl font-extrabold text-slate-950">${html(value)}<span class="ml-1 text-xs text-slate-400">${html(suffix)}</span></p>
        </div>`).join('')}
      </section>

      <section class="rounded-[2rem] border border-amber-100 bg-amber-50 p-5">
        <div class="flex items-center justify-between">
          <h3 class="text-lg font-extrabold">상담사 확인 알림</h3>
          <span class="rounded-full bg-amber-100 px-3 py-1 text-xs font-extrabold text-amber-700">${array(stats.alerts).length}건</span>
        </div>
        <div class="mt-4 grid grid-cols-1 gap-3 lg:grid-cols-2">
          ${array(stats.alerts).slice(0,12).map(item=>`<button onclick="mmlScrollCase('${html(item.reservationId)}')" class="rounded-2xl border p-4 text-left ${priorityClass(item.priority)}">
            <p class="text-sm font-extrabold">${html(item.message)}</p>
            <p class="mt-1 text-[10px] font-bold opacity-70">예약 ID ${html(item.reservationId)} · ${html(item.priority)}</p>
          </button>`).join('')||'<p class="text-sm text-slate-500">현재 확인할 사례관리 알림이 없습니다.</p>'}
        </div>
      </section>

      <div class="space-y-6">
        ${summaries.map(item=>`<div id="mml-case-${html(item.reservationId)}">${cardView(item)}</div>`).join('')||global.empty('관리할 사례가 없습니다.')}
      </div>
    </div>`);
  }

  function openModal(title,body,footer=''){
    closeModal();
    const overlay=document.createElement('div');
    overlay.id='mml-case-modal';
    overlay.className='fixed inset-0 z-[100] overflow-y-auto bg-slate-950/60 p-4 backdrop-blur-sm';
    overlay.innerHTML=`<div class="mx-auto my-8 max-w-3xl rounded-[2rem] bg-white shadow-2xl">
      <div class="flex items-center justify-between border-b border-slate-100 px-5 py-4 sm:px-7">
        <h3 class="text-lg font-extrabold text-slate-950">${html(title)}</h3>
        <button onclick="mmlCloseCaseModal()" class="h-9 w-9 rounded-xl bg-slate-100 text-lg font-extrabold">×</button>
      </div>
      <div class="p-5 sm:p-7">${body}</div>
      ${footer?`<div class="flex flex-wrap justify-end gap-2 border-t border-slate-100 px-5 py-4 sm:px-7">${footer}</div>`:''}
    </div>`;
    document.body.appendChild(overlay);
  }

  function closeModal(){
    document.getElementById('mml-case-modal')?.remove();
  }

  function openFollowUp(reservationId){
    const data=engine().buildFollowUp(reservationId);
    openModal('다음 회기 준비',`
      <div class="space-y-5">
        <section class="rounded-2xl bg-indigo-50 p-5">
          <p class="text-xs font-extrabold text-indigo-700">지난 회기 핵심</p>
          <p class="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-slate-700">${html(data.lastSessionSummary||'이전 상담기록이 없습니다.')}</p>
        </section>
        <section><h4 class="text-sm font-extrabold">이번 회기에서 확인할 변화</h4><div class="mt-3 space-y-2">${array(data.changesToCheck).map(x=>`<p class="rounded-xl bg-slate-50 p-3 text-sm">• ${html(x)}</p>`).join('')}</div></section>
        <section><h4 class="text-sm font-extrabold">추천 질문</h4><div class="mt-3 space-y-2">${array(data.suggestedQuestions).map(x=>`<p class="rounded-xl border border-slate-100 p-3 text-sm">${html(x)}</p>`).join('')}</div></section>
        <section class="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div class="rounded-2xl border border-amber-100 bg-amber-50 p-4"><p class="text-xs font-extrabold text-amber-700">미완료 과제</p><p class="mt-2 text-sm">${html(array(data.unfinishedHomework).map(x=>x.task||x).join('\n')||'없음')}</p></div>
          <div class="rounded-2xl border border-rose-100 bg-rose-50 p-4"><p class="text-xs font-extrabold text-rose-700">위험 신호 재확인</p><p class="mt-2 text-sm">${html(array(data.riskReview).join(', ')||'현재 기록 없음')}</p></div>
        </section>
      </div>`);
  }

  function openMetricForm(reservationId){
    const previous=engine().getMetrics(reservationId)[0]||{};
    const input=(id,label,value)=>`<label class="block"><span class="text-xs font-extrabold text-slate-500">${html(label)} (0~100)</span><input id="${id}" type="number" min="0" max="100" value="${html(value??'')}" class="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm"></label>`;
    openModal('회복지표 입력',`
      <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
        ${input('mml-metric-session','회기',Number(previous.sessionNumber||0)+1)}
        ${input('mml-metric-anxiety','불안',previous.anxiety)}
        ${input('mml-metric-depression','우울',previous.depression)}
        ${input('mml-metric-stress','스트레스',previous.stress)}
        ${input('mml-metric-recovery','회복감',previous.recovery)}
        ${input('mml-metric-goal','목표 달성도',previous.goalAchievement)}
      </div>
      <label class="mt-4 block"><span class="text-xs font-extrabold text-slate-500">상담사 메모</span><textarea id="mml-metric-note" rows="4" class="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm">${html(previous.note||'')}</textarea></label>`,
      `${actionButton('취소','mmlCloseCaseModal()','white')}${actionButton('저장',`mmlSaveMetric('${reservationId}')`,'emerald')}`);
  }

  function saveMetric(reservationId){
    const value=id=>document.getElementById(id)?.value;
    engine().addRecoveryMetric(reservationId,{
      sessionNumber:value('mml-metric-session'),
      anxiety:value('mml-metric-anxiety'),
      depression:value('mml-metric-depression'),
      stress:value('mml-metric-stress'),
      recovery:value('mml-metric-recovery'),
      goalAchievement:value('mml-metric-goal'),
      note:value('mml-metric-note')
    });
    closeModal();
    notify('회복지표가 저장되었습니다.');
    renderApp();
  }

  function openRecordForm(reservationId,sessionId){
    const count=engine().buildDashboard(reservationId).sessionCount;
    openModal('AI 상담기록 작성',`
      <div class="space-y-4">
        <label class="block"><span class="text-xs font-extrabold text-slate-500">기록 형식</span>
          <select id="mml-record-format" class="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm">
            <option value="SOAP">SOAP</option><option value="DAP">DAP</option><option value="BIRP">BIRP</option>
          </select>
        </label>
        <label class="block"><span class="text-xs font-extrabold text-slate-500">회기</span><input id="mml-record-session-number" type="number" min="1" value="${count+1}" class="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm"></label>
        <label class="block"><span class="text-xs font-extrabold text-slate-500">상담방법</span><input id="mml-record-method" value="AI 상담(비대면)" class="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm"></label>
        <div class="rounded-2xl border border-amber-100 bg-amber-50 p-4 text-xs leading-relaxed text-amber-800">AI가 상담 대화를 기반으로 초안을 작성합니다. 저장 후 상담자가 내용을 확인하고 수정·검토 완료해야 합니다.</div>
      </div>`,
      `${actionButton('취소','mmlCloseCaseModal()','white')}${actionButton('초안 생성',`mmlCreateRecord('${sessionId}')`,'dark')}`);
  }

  function createRecord(sessionId){
    const format=document.getElementById('mml-record-format')?.value||'SOAP';
    const sessionNumber=Number(document.getElementById('mml-record-session-number')?.value||1);
    const counselingMethod=document.getElementById('mml-record-method')?.value||'AI 상담(비대면)';
    try{
      global.MMLCounselingRecordEngine.createFromSessionId(sessionId,{format,context:{sessionNumber,counselingMethod}});
      closeModal();
      notify('AI 상담기록 초안이 생성되었습니다.');
      renderApp();
    }catch(error){
      notify(error.message||'상담기록 생성에 실패했습니다.');
    }
  }

  function approveRecord(id){
    const reviewer=prompt('검토자 이름을 입력해 주세요.','백인영');
    if(reviewer===null)return;
    global.MMLCounselingRecordEngine.approve(id,{reviewer});
    notify('상담기록을 검토 완료했습니다.');
    renderApp();
  }

  function revokeRecord(id){
    if(!confirm('상담기록을 다시 검토 필요 상태로 변경할까요?'))return;
    global.MMLCounselingRecordEngine.revoke(id);
    renderApp();
  }

  function openTermination(reservationId){
    const draft=engine().buildTerminationEvaluation(reservationId);
    openModal('사례 종결평가',`
      <div class="space-y-5">
        <label class="block"><span class="text-xs font-extrabold text-slate-500">종결 사유</span><textarea id="mml-termination-reason" rows="3" class="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm">${html(draft.reason)}</textarea></label>
        <section class="rounded-2xl bg-slate-50 p-4"><p class="text-xs font-extrabold text-slate-500">초기 어려움</p><p class="mt-2 text-sm">${html(draft.initialDifficulties.join(', ')||'기록 없음')}</p></section>
        <section class="rounded-2xl bg-emerald-50 p-4"><p class="text-xs font-extrabold text-emerald-700">성과</p><div class="mt-2 space-y-1">${draft.achievements.map(x=>`<p class="text-sm">• ${html(x)}</p>`).join('')||'<p class="text-sm">기록 없음</p>'}</div></section>
        <section class="rounded-2xl bg-indigo-50 p-4"><p class="text-xs font-extrabold text-indigo-700">추후 권장사항</p><div class="mt-2 space-y-1">${draft.recommendations.map(x=>`<p class="text-sm">• ${html(x)}</p>`).join('')}</div></section>
        <label class="block"><span class="text-xs font-extrabold text-slate-500">상담사 최종 메모</span><textarea id="mml-termination-note" rows="4" class="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm"></textarea></label>
      </div>`,
      `${actionButton('취소','mmlCloseCaseModal()','white')}${actionButton('사례 종결',`mmlCloseCase('${reservationId}')`,'rose')}`);
  }

  function closeCase(reservationId){
    if(!confirm('이 사례를 종결 처리할까요?'))return;
    engine().closeCase(reservationId,{
      reason:document.getElementById('mml-termination-reason')?.value||'',
      counselorNote:document.getElementById('mml-termination-note')?.value||''
    });
    closeModal();
    notify('사례가 종결 처리되었습니다.');
    renderApp();
  }

  function reopenCase(reservationId){
    if(!confirm('종결된 사례를 다시 진행 중으로 변경할까요?'))return;
    engine().reopenCase(reservationId);
    renderApp();
  }

  async function syncCase(reservationId){
    try{
      const result=await hub().syncReservation(reservationId);
      notify(result.ok?'전자차트와 사용자 공개 상태를 동기화했습니다.':result.errors.join('\n'));
      renderApp();
    }catch(error){
      notify(error.message||'동기화에 실패했습니다.');
    }
  }

  function scrollCase(reservationId){
    document.getElementById(`mml-case-${reservationId}`)?.scrollIntoView({behavior:'smooth',block:'start'});
  }

  function statisticsView(){
    let stats;
    try{stats=engine().operationalStatistics()}catch(_){
      return typeof originalStatisticsView==='function'?originalStatisticsView():global.layout(global.empty('운영 통계를 불러올 수 없습니다.'));
    }

    return global.layout(`<div class="space-y-6">
      <section class="rounded-[2rem] bg-gradient-to-r from-slate-950 to-indigo-950 p-6 text-white sm:p-8">
        <p class="text-xs font-extrabold text-indigo-300">OPERATIONS STATISTICS · STEP20</p>
        <h2 class="mt-2 text-2xl font-extrabold">상담 운영 통계</h2>
        <p class="mt-2 text-sm text-slate-300">사례·상담기록·보고서·AI 상담 이용 현황을 통합 집계합니다.</p>
      </section>
      <section class="grid grid-cols-2 gap-4 lg:grid-cols-4">
        ${[
          ['전체 사례',stats.totalCases],
          ['진행 중',stats.activeCases],
          ['종결 사례',stats.closedCases],
          ['상담기록',stats.counselingRecordCount],
          ['평균 회기',stats.averageSessions],
          ['전체 보고서',stats.totalReports],
          ['승인 대기',stats.pendingApproval],
          ['AI 상담 이용률',`${stats.aiCounselingRate}%`]
        ].map(([label,value])=>`<div class="rounded-[1.5rem] border border-slate-100 bg-white p-5 shadow-sm"><p class="text-xs font-extrabold text-slate-400">${html(label)}</p><p class="mt-3 text-3xl font-extrabold">${html(value)}</p></div>`).join('')}
      </section>
      <section class="rounded-[2rem] border border-slate-100 bg-white p-6">
        <div class="flex items-center justify-between"><h3 class="text-lg font-extrabold">운영 확인 항목</h3><button onclick="setMenu('clinicalTimeline')" class="rounded-xl bg-slate-900 px-4 py-2 text-xs font-extrabold text-white">사례관리 열기</button></div>
        <div class="mt-4 space-y-3">${array(stats.alerts).map(item=>`<div class="rounded-2xl border p-4 ${priorityClass(item.priority)}"><p class="text-sm font-extrabold">${html(item.message)}</p><p class="mt-1 text-[10px]">예약 ID ${html(item.reservationId)}</p></div>`).join('')||'<p class="text-sm text-slate-400">확인할 운영 알림이 없습니다.</p>'}</div>
      </section>
    </div>`);
  }

  global.mmlCloseCaseModal=closeModal;
  global.mmlOpenFollowUp=openFollowUp;
  global.mmlOpenMetricForm=openMetricForm;
  global.mmlSaveMetric=saveMetric;
  global.mmlOpenRecordForm=openRecordForm;
  global.mmlCreateRecord=createRecord;
  global.mmlApproveRecord=approveRecord;
  global.mmlRevokeRecord=revokeRecord;
  global.mmlOpenTermination=openTermination;
  global.mmlCloseCase=closeCase;
  global.mmlReopenCase=reopenCase;
  global.mmlSyncCase=syncCase;
  global.mmlScrollCase=scrollCase;

  global.clinicalTimelineView=caseManagementView;
  global.statisticsView=statisticsView;

  global.MMLCaseManagementUI=Object.freeze({
    version:VERSION,
    caseManagementView,
    statisticsView,
    openFollowUp,
    openMetricForm,
    openRecordForm,
    openTermination
  });

  try{
    global.dispatchEvent(new CustomEvent('mml:case-management-ui-ready',{detail:{version:VERSION}}));
  }catch(_){}
})(window);
