console.info('[MML] SYNC-ENGINE-MODULE-V34-NO-TOAST loaded');

(function(global){
  'use strict';

  const CHANNEL_NAME = 'modumam-lab-data-sync-v34';
  const EVENT_KEY = 'modumam_sync_event';
  const STATE_KEY = 'modumam_sync_state';
  const CLIENT_REPORT_KEY = 'modumam_client_visible_reports';
  const CLIENT_RESERVATION_KEY = 'modumam_client_visible_reservations';
  const CLIENT_ASSESSMENT_KEY = 'modumam_client_visible_assessments';

  const subscribers = new Set();
  const lastApplied = new Map();
  const channel = typeof BroadcastChannel !== 'undefined'
    ? new BroadcastChannel(CHANNEL_NAME)
    : null;

  function clone(value){
    if(value === undefined) return undefined;
    try{return structuredClone(value)}catch(e){}
    try{return JSON.parse(JSON.stringify(value))}catch(e){return value}
  }

  function safeParse(text, fallback){
    try{return text ? JSON.parse(text) : clone(fallback)}
    catch(error){return clone(fallback)}
  }

  function now(){return new Date().toISOString()}

  function eventId(){
    return `${Date.now()}-${Math.random().toString(36).slice(2,10)}`;
  }

  function state(){
    return safeParse(localStorage.getItem(STATE_KEY), {
      version:'v34',
      updatedAt:'',
      sequence:0,
      lastEventId:''
    });
  }

  function saveState(event){
    const current = state();
    const next = {
      version:'v34',
      updatedAt:event.at || now(),
      sequence:Number(current.sequence || 0)+1,
      lastEventId:event.id || ''
    };
    localStorage.setItem(STATE_KEY, JSON.stringify(next));
    return next;
  }

  function publish(type, payload={}, options={}){
    const event = {
      id:eventId(),
      type:String(type || 'data:changed'),
      at:now(),
      source:String(options.source || 'admin'),
      scope:String(options.scope || 'shared'),
      key:String(options.key || ''),
      entityId:String(options.entityId || ''),
      payload:clone(payload)
    };

    saveState(event);
    localStorage.setItem(EVENT_KEY, JSON.stringify(event));

    try{channel?.postMessage(event)}catch(error){}
    notify(event);
    return event;
  }

  function notify(event){
    if(!event?.id) return;
    if(lastApplied.get(event.id)) return;
    lastApplied.set(event.id, Date.now());

    if(lastApplied.size > 200){
      const entries = [...lastApplied.entries()].sort((a,b)=>b[1]-a[1]).slice(0,100);
      lastApplied.clear();
      entries.forEach(([id,ts])=>lastApplied.set(id,ts));
    }

    subscribers.forEach(callback=>{
      try{callback(clone(event))}catch(error){
        console.warn('[MML Sync] 구독 처리 실패', error);
      }
    });

    try{
      global.dispatchEvent(new CustomEvent('mml:data-sync',{
        detail:clone(event)
      }));
    }catch(error){}
  }

  function subscribe(callback){
    if(typeof callback !== 'function') return ()=>{};
    subscribers.add(callback);
    return ()=>subscribers.delete(callback);
  }

  function refreshAdminState(event){
    if(!global.state || !global.MMLDataStore) return;

    const key = event?.key;
    try{
      if(key === 'modumam_reservations'){
        global.state.reservations = global.MMLDataStore.read(key,[],{fresh:true});
      }else if(key === 'modumam_reports'){
        global.state.reports = global.MMLDataStore.read(key,[],{fresh:true});
      }else if(key === 'modumam_test_result_uploads'){
        global.state.resultUploads = global.MMLDataStore.read(key,[],{fresh:true});
      }else if(key === 'modumam_assessment_analyses'){
        global.state.assessmentAnalyses = global.MMLDataStore.read(key,[],{fresh:true});
      }
    }catch(error){
      console.warn('[MML Sync] 관리자 상태 갱신 실패', error);
    }
  }

  function normalizeStatus(value){
    return String(value || '').trim().toLowerCase();
  }

  function isApprovedReport(report){
    if(!report || typeof report !== 'object') return false;
    return report.approvedForClient === true
      || report.approved === true
      || normalizeStatus(report.status) === 'approved'
      || normalizeStatus(report.approvalStatus) === 'approved'
      || String(report.status || '').includes('승인');
  }

  function visibleReports(){
    const reports = global.MMLDataStore?.read?.('modumam_reports',[],{fresh:true})
      || safeParse(localStorage.getItem('modumam_reports'),[]);
    return (Array.isArray(reports) ? reports : [])
      .filter(isApprovedReport)
      .map(report=>({
        id:report.id || '',
        reservationId:report.reservationId || report.sourceReservationId || '',
        clientId:report.clientId || report.memberId || report.userId || '',
        memberId:report.memberId || report.clientId || report.userId || '',
        userId:report.userId || report.memberId || report.clientId || '',
        email:report.email || report.userEmail || '',
        phone:report.phone || '',
        clientName:report.clientName || report.name || '',
        type:report.type || report.reportType || '',
        testName:report.testName || report.assessmentName || '',
        title:report.title || report.reportTitle || '',
        status:'approved',
        approvedAt:report.approvedAt || report.updatedAt || report.createdAt || '',
        updatedAt:report.updatedAt || report.createdAt || '',
        report:clone(report)
      }));
  }

  function visibleReservations(){
    const rows = global.MMLDataStore?.read?.('modumam_reservations',[],{fresh:true})
      || safeParse(localStorage.getItem('modumam_reservations'),[]);
    return (Array.isArray(rows) ? rows : []).map(row=>({
      id:row.id || '',
      reservationNumber:row.reservationNumber || row.reservationNo || '',
      clientId:row.clientId || row.memberId || '',
      name:row.name || row.clientName || '',
      date:row.date || row.counselingDate || row.reservationDate || '',
      time:row.time || row.counselingTime || '',
      program:row.program || '',
      counselingMethod:row.counselingMethod || row.method || '',
      status:row.status || '',
      updatedAt:row.updatedAt || row.createdAt || ''
    }));
  }

  function visibleAssessments(){
    const uploads = global.MMLDataStore?.read?.('modumam_test_result_uploads',[],{fresh:true})
      || safeParse(localStorage.getItem('modumam_test_result_uploads'),[]);
    return (Array.isArray(uploads) ? uploads : []).map(row=>({
      id:row.id || '',
      reservationId:row.reservationId || '',
      clientId:row.clientId || row.memberId || '',
      testName:row.testName || row.assessmentName || row.name || '',
      fileName:row.fileName || row.originalName || '',
      uploadedAt:row.uploadedAt || row.createdAt || '',
      status:row.status || 'uploaded'
    }));
  }

  function exportClientSnapshot(options={}){
    const snapshot = {
      version:'v34',
      exportedAt:now(),
      reports:visibleReports(),
      reservations:visibleReservations(),
      assessments:visibleAssessments()
    };

    localStorage.setItem(CLIENT_REPORT_KEY, JSON.stringify(snapshot.reports));
    localStorage.setItem(CLIENT_RESERVATION_KEY, JSON.stringify(snapshot.reservations));
    localStorage.setItem(CLIENT_ASSESSMENT_KEY, JSON.stringify(snapshot.assessments));
    // 사용자 앱의 구버전/신버전 키를 모두 동기화합니다.
    localStorage.setItem('modumam_client_reports', JSON.stringify(snapshot.reports));
    localStorage.setItem('modumam_approved_reports', JSON.stringify(snapshot.reports));
    localStorage.setItem('modumam_published_reports', JSON.stringify(snapshot.reports));

    if(options.publish !== false){
      publish('client:snapshot',{
        reportCount:snapshot.reports.length,
        reservationCount:snapshot.reservations.length,
        assessmentCount:snapshot.assessments.length
      },{source:'admin',scope:'client'});
    }
    return clone(snapshot);
  }

  function clientSnapshot(){
    return {
      version:'v34',
      reports:safeParse(localStorage.getItem(CLIENT_REPORT_KEY),[]),
      reservations:safeParse(localStorage.getItem(CLIENT_RESERVATION_KEY),[]),
      assessments:safeParse(localStorage.getItem(CLIENT_ASSESSMENT_KEY),[])
    };
  }

  function handleEvent(event){
    if(!event?.id) return;
    refreshAdminState(event);

    if([
      'modumam_reports',
      'modumam_reservations',
      'modumam_test_result_uploads'
    ].includes(event.key)){
      exportClientSnapshot({publish:false});
    }

    notify(event);

    if(event.source !== 'admin' && typeof global.render === 'function'){
      try{global.render()}catch(error){}
    }
  }

  if(channel){
    channel.addEventListener('message',message=>handleEvent(message.data));
  }

  global.addEventListener('storage',event=>{
    if(event.key === EVENT_KEY && event.newValue){
      handleEvent(safeParse(event.newValue,null));
    }
  });

  global.addEventListener('focus',()=>{
    const latest = safeParse(localStorage.getItem(EVENT_KEY),null);
    if(latest) handleEvent(latest);
  });

  // 다른 화면의 변경사항은 조용히 반영합니다.
  // 자동 동기화는 유지하되 사용자 알림 토스트는 표시하지 않습니다.

  const api = Object.freeze({
    version:'v34',
    publish,
    subscribe,
    state,
    refreshAdminState,
    exportClientSnapshot,
    clientSnapshot,
    visibleReports,
    visibleReservations,
    visibleAssessments,
    keys:Object.freeze({
      event:EVENT_KEY,
      state:STATE_KEY,
      clientReports:CLIENT_REPORT_KEY,
      clientReservations:CLIENT_RESERVATION_KEY,
      clientAssessments:CLIENT_ASSESSMENT_KEY
    })
  });

  global.MMLSync = api;

  setTimeout(()=>{
    try{exportClientSnapshot({publish:false})}catch(error){}
  },300);
})(window);
