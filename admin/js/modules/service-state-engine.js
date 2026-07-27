console.info('[MML] SERVICE-STATE-ENGINE-STEP22 loaded');

(function(global){
  'use strict';

  const VERSION='20260725-service-state-step22';
  const SNAPSHOT_KEY='modumam_client_portal_state';
  const NOTICE_KEY='modumam_client_notifications';
  const STATUS_KEY='modumam_service_status';
  const text=v=>String(v??'').trim();
  const arr=v=>Array.isArray(v)?v:[];
  const now=()=>new Date().toISOString();

  function read(key,fallback=[]){
    try{
      if(global.MMLDataStore?.read)return global.MMLDataStore.read(key,fallback,{fresh:true});
    }catch(_){}
    try{return JSON.parse(localStorage.getItem(key)||JSON.stringify(fallback))}
    catch(_){return fallback}
  }

  function write(key,value,detail){
    try{
      if(global.MMLDataStore?.write){
        return global.MMLDataStore.write(key,value,{
          action:'홈페이지 관리자 통합',
          detail:detail||key,
          source:'service-state-engine',
          server:false
        });
      }
    }catch(_){}
    localStorage.setItem(key,JSON.stringify(value));
    return value;
  }

  function reservationId(item){
    return text(item?.reservationId||item?.reservation_id||item?.bookingId||item?.id);
  }

  function userKey(item){
    return text(
      item?.clientId||item?.memberId||item?.userId||
      item?.email||item?.phone||
      item?.clientName||item?.name||item?.userName
    );
  }

  function normalizeDate(value){
    const source=text(value);
    if(!source)return '';
    const d=new Date(source);
    return Number.isNaN(d.getTime())?source:d.toISOString();
  }

  function approved(report){
    return report?.approved===true||
      report?.approvedForClient===true||
      report?.clientVisible===true||
      report?.published===true||
      /승인|공개|published|approved/i.test(text(report?.status));
  }

  function deriveStatus(bundle,caseState){
    if(caseState?.status==='종결')return '종결';
    if(bundle.state.hasCounselingRecord)return '상담 진행중';
    if(bundle.state.hasCounseling)return 'AI 상담 가능';
    if(bundle.state.isPublished||bundle.state.hasApprovedReport)return '승인 완료';
    if(bundle.state.hasReport)return '보고서 작성중';
    if(bundle.state.hasAssessment)return '검사 완료';

    const r=bundle.reservation||{};
    const raw=text(r.status||r.progressStatus||r.stage);
    if(/검사.*진행|링크.*발송|결제.*완료/.test(raw))return '검사 진행중';
    return '예약 완료';
  }

  function nextAction(status){
    return {
      '예약 완료':'결제 및 검사 안내를 확인해 주세요.',
      '검사 진행중':'안내받은 심리검사를 완료해 주세요.',
      '검사 완료':'전문가가 결과와 보고서를 준비하고 있습니다.',
      '보고서 작성중':'보고서 검토와 승인까지 기다려 주세요.',
      '승인 완료':'마음기록에서 승인된 보고서를 확인할 수 있습니다.',
      'AI 상담 가능':'예약시간에 AI 상담방으로 입장할 수 있습니다.',
      '상담 진행중':'상담기록과 다음 일정을 확인해 주세요.',
      '종결':'상담 과정이 종결되었습니다.'
    }[status]||'진행 상태를 확인해 주세요.';
  }

  function reportCard(publication,report){
    return {
      id:text(publication?.id||report?.id),
      reportId:text(publication?.reportId||report?.id),
      reservationId:text(publication?.reservationId||report?.reservationId),
      title:text(publication?.title||report?.title)||'심리검사 보고서',
      reportType:text(publication?.reportType||report?.reportType),
      testType:text(publication?.testType||report?.testType),
      approvedAt:normalizeDate(publication?.approvedAt||report?.approvedAt||report?.updatedAt),
      visible:true,
      onlineView:true,
      pdfAvailable:Boolean(report?.pdfUrl||report?.pdfData||report?.html||report?.content),
      pdfUrl:text(report?.pdfUrl),
      sourceReportId:text(report?.id)
    };
  }

  function counselingAccess(bundle,status){
    const reservation=bundle.reservation||{};
    const sessions=arr(bundle.electronicChart.counseling);
    const active=sessions.find(s=>!['completed','ended','종료'].includes(text(s.status).toLowerCase()))||sessions[0]||null;
    const scheduledAt=normalizeDate(
      active?.scheduledAt||active?.reservationAt||
      reservation.scheduledAt||reservation.reservationDateTime||
      [reservation.reservationDate,reservation.reservationTime].filter(Boolean).join(' ')
    );

    return {
      enabled:['AI 상담 가능','상담 진행중'].includes(status),
      scheduledAt,
      sessionId:text(active?.id),
      status:text(active?.status)||status,
      entryWindowMinutes:15,
      method:text(reservation.counselingMethod||reservation.method)||'AI 상담(비대면)'
    };
  }

  function buildSnapshot(reservationIdValue){
    const id=text(reservationIdValue);
    const bundle=global.MMLIntegratedWorkflowHub.caseBundle(id);
    const caseState=global.MMLCaseManagementEngine?.getCase?.(id)||null;
    const status=deriveStatus(bundle,caseState);
    const reports=arr(bundle.assessmentCenter.reports);
    const publications=arr(bundle.clientPortal.published);
    const cards=publications.map(pub=>{
      const report=reports.find(r=>text(r.id)===text(pub.reportId))||null;
      return reportCard(pub,report);
    });

    const metrics=global.MMLCaseManagementEngine?.getMetrics?.(id)||[];
    const records=arr(bundle.electronicChart.counselingRecords)
      .filter(row=>row.approved===true||/검토 완료|approved/i.test(text(row.status)))
      .map(row=>({
        id:text(row.id),
        sessionNumber:Number(row.sessionNumber||1),
        sessionDate:normalizeDate(row.sessionDate||row.createdAt),
        summary:text(row.clientSummary||row.summary),
        status:text(row.status)
      }));

    const reservation=bundle.reservation||{};
    return {
      version:VERSION,
      reservationId:id,
      userKey:userKey(reservation),
      clientId:text(reservation.clientId||reservation.memberId||reservation.userId),
      clientName:text(reservation.clientName||reservation.name||reservation.userName),
      programName:text(reservation.programName||reservation.program||reservation.serviceName),
      tests:arr(reservation.tests||reservation.assessments).map(text).filter(Boolean),
      status,
      nextAction:nextAction(status),
      updatedAt:now(),
      timeline:global.MMLCaseManagementEngine?.buildTimeline?.(id)||[],
      reports:cards,
      counseling:counselingAccess(bundle,status),
      counselingRecords:records,
      recoveryMetrics:metrics,
      notifications:[]
    };
  }

  function noticeType(previous,current){
    if(!previous)return 'reservation_created';
    if(previous.status!==current.status){
      return {
        '검사 진행중':'assessment_ready',
        '검사 완료':'assessment_completed',
        '보고서 작성중':'report_writing',
        '승인 완료':'report_approved',
        'AI 상담 가능':'ai_counseling_ready',
        '상담 진행중':'counseling_recorded',
        '종결':'case_closed'
      }[current.status]||'status_changed';
    }
    if((previous.reports||[]).length<(current.reports||[]).length)return 'report_approved';
    if((previous.counselingRecords||[]).length<(current.counselingRecords||[]).length)return 'counseling_recorded';
    return '';
  }

  function noticeMessage(type,current){
    return {
      reservation_created:'예약 신청이 접수되었습니다.',
      assessment_ready:'심리검사 안내가 준비되었습니다.',
      assessment_completed:'심리검사가 완료되었습니다.',
      report_writing:'전문가가 보고서를 작성하고 있습니다.',
      report_approved:'보고서가 승인되었습니다. 마음기록에서 확인해 주세요.',
      ai_counseling_ready:'AI 상담을 이용할 수 있습니다.',
      counseling_recorded:'상담기록이 저장되었습니다.',
      case_closed:'상담 과정이 종결되었습니다.',
      status_changed:`진행 상태가 ${current.status}(으)로 변경되었습니다.`
    }[type]||'마음기록이 업데이트되었습니다.';
  }

  function addNotification(snapshot,type){
    if(!type)return null;
    const rows=arr(read(NOTICE_KEY,[]));
    const item={
      id:`notice:${snapshot.reservationId}:${type}:${Date.now()}`,
      reservationId:snapshot.reservationId,
      userKey:snapshot.userKey,
      type,
      message:noticeMessage(type,snapshot),
      read:false,
      createdAt:now()
    };
    rows.unshift(item);
    write(NOTICE_KEY,rows.slice(0,500),'사용자 알림 생성');
    return item;
  }

  function syncReservation(reservationIdValue){
    const id=text(reservationIdValue);
    const rows=arr(read(SNAPSHOT_KEY,[]));
    const previous=rows.find(row=>text(row.reservationId)===id)||null;
    const snapshot=buildSnapshot(id);
    const type=noticeType(previous,snapshot);
    const notice=addNotification(snapshot,type);
    if(notice)snapshot.notifications=[notice];

    const next=rows.filter(row=>text(row.reservationId)!==id);
    next.unshift(snapshot);
    write(SNAPSHOT_KEY,next,'사용자 마음기록 상태 동기화');

    const statuses=arr(read(STATUS_KEY,[])).filter(row=>text(row.reservationId)!==id);
    statuses.unshift({
      reservationId:id,
      status:snapshot.status,
      nextAction:snapshot.nextAction,
      updatedAt:snapshot.updatedAt
    });
    write(STATUS_KEY,statuses,'서비스 상태 동기화');

    try{
      global.dispatchEvent(new CustomEvent('mml:client-portal-updated',{detail:snapshot}));
    }catch(_){}
    return snapshot;
  }

  function syncAll(){
    const cases=global.MMLIntegratedWorkflowHub?.allCases?.()||[];
    return cases.map(item=>syncReservation(item.reservationId));
  }

  function forUser(key){
    const id=text(key);
    return arr(read(SNAPSHOT_KEY,[])).filter(row=>
      [row.userKey,row.clientId,row.clientName].map(text).includes(id)
    );
  }

  function notificationsForUser(key){
    const id=text(key);
    return arr(read(NOTICE_KEY,[])).filter(row=>text(row.userKey)===id);
  }

  function markNotificationRead(id){
    const rows=arr(read(NOTICE_KEY,[]));
    const item=rows.find(row=>text(row.id)===text(id));
    if(item)item.read=true;
    write(NOTICE_KEY,rows,'사용자 알림 읽음');
    return item||null;
  }

  let timer=null;
  function startAutoSync(interval=15000){
    stopAutoSync();
    syncAll();
    timer=setInterval(()=>{
      try{syncAll()}catch(error){console.warn('[MML] service auto sync',error)}
    },Math.max(5000,Number(interval)||15000));
    return timer;
  }

  function stopAutoSync(){
    if(timer){clearInterval(timer);timer=null}
  }

  global.MMLServiceStateEngine=Object.freeze({
    version:VERSION,
    keys:{snapshots:SNAPSHOT_KEY,notifications:NOTICE_KEY,statuses:STATUS_KEY},
    buildSnapshot,
    syncReservation,
    syncAll,
    forUser,
    notificationsForUser,
    markNotificationRead,
    startAutoSync,
    stopAutoSync
  });

  setTimeout(()=>{try{startAutoSync()}catch(error){console.warn('[MML] initial service sync',error)}},1200);
})(window);
