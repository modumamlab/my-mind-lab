console.info('[MML] CLIENT-PORTAL-BRIDGE-STEP22 loaded');

(function(global){
  'use strict';

  const VERSION='20260725-client-portal-bridge-step22';
  const KEYS={
    snapshots:'modumam_client_portal_state',
    notifications:'modumam_client_notifications'
  };
  const text=v=>String(v??'').trim();
  const arr=v=>Array.isArray(v)?v:[];
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

  function read(key,fallback=[]){
    try{return JSON.parse(localStorage.getItem(key)||JSON.stringify(fallback))}
    catch(_){return fallback}
  }

  function resolveUserKey(user){
    return text(user?.id||user?.clientId||user?.memberId||user?.email||user?.phone||user?.name||user);
  }

  function recordsFor(user){
    const key=resolveUserKey(user);
    return arr(read(KEYS.snapshots,[])).filter(row=>
      [row.userKey,row.clientId,row.clientName].map(text).includes(key)
    );
  }

  function notificationsFor(user){
    const key=resolveUserKey(user);
    return arr(read(KEYS.notifications,[])).filter(row=>text(row.userKey)===key);
  }

  function canEnterCounseling(item,at=new Date()){
    if(!item?.counseling?.enabled)return false;
    const scheduled=item.counseling.scheduledAt?new Date(item.counseling.scheduledAt):null;
    if(!scheduled||Number.isNaN(scheduled.getTime()))return true;
    const minutes=Math.abs(at.getTime()-scheduled.getTime())/60000;
    return minutes<=Number(item.counseling.entryWindowMinutes||15);
  }

  function statusSteps(current){
    const steps=['예약 완료','검사 진행중','검사 완료','보고서 작성중','승인 완료','AI 상담 가능','상담 진행중','종결'];
    const index=Math.max(0,steps.indexOf(current));
    return steps.map((label,i)=>({label,complete:i<=index,current:i===index}));
  }

  function renderMindRecords(container,user){
    const host=typeof container==='string'?document.querySelector(container):container;
    if(!host)return false;
    const rows=recordsFor(user);
    host.innerHTML=`<div class="mml-mind-records">
      ${rows.map(item=>`<section class="mml-record-card" data-reservation-id="${esc(item.reservationId)}">
        <header><h3>${esc(item.programName||'마음기록')}</h3><span>${esc(item.status)}</span></header>
        <p>${esc(item.nextAction)}</p>
        <div class="mml-status-steps">${statusSteps(item.status).map(step=>`<span class="${step.complete?'complete':''} ${step.current?'current':''}">${esc(step.label)}</span>`).join('')}</div>
        <div class="mml-report-list">${arr(item.reports).map(report=>`<article><strong>${esc(report.title)}</strong><button data-mml-report-id="${esc(report.reportId)}">온라인 보기</button>${report.pdfAvailable?`<button data-mml-pdf-id="${esc(report.reportId)}">PDF 보기</button>`:''}</article>`).join('')}</div>
        ${item.counseling?.enabled?`<button data-mml-counseling-id="${esc(item.counseling.sessionId)}" ${canEnterCounseling(item)?'':'disabled'}>AI 상담(비대면) 들어가기</button>`:''}
        <div class="mml-counseling-records">${arr(item.counselingRecords).map(record=>`<article><strong>${record.sessionNumber}회기 상담기록</strong><p>${esc(record.summary)}</p></article>`).join('')}</div>
      </section>`).join('')||'<p>표시할 마음기록이 없습니다.</p>'}
    </div>`;
    return true;
  }

  function onUpdate(callback){
    global.addEventListener('storage',event=>{
      if(Object.values(KEYS).includes(event.key))callback?.();
    });
    global.addEventListener('mml:client-portal-updated',()=>callback?.());
  }

  global.MMLClientPortalBridge=Object.freeze({
    version:VERSION,
    keys:KEYS,
    recordsFor,
    notificationsFor,
    canEnterCounseling,
    statusSteps,
    renderMindRecords,
    onUpdate
  });
})(window);
