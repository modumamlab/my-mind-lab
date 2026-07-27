console.info('[MML] CHART-SYNC-MANAGER-STEP3 loaded');

(function(global){
  'use strict';

  const VERSION='20260725-chart-sync-manager-step3';

  const KEYS={
    reservations:'modumam_reservations',
    charts:'modumam_chart_records',
    legacyCharts:'modumam_electronic_charts',
    analyses:'modumam_assessment_analyses',
    clinical:'modumam_clinical_assessment_records',
    reports:'modumam_reports'
  };

  let syncing=false;
  let timer=null;
  let lastSignature='';
  let internalWrite=false;

  function clone(value){
    try{return structuredClone(value)}catch(_){}
    try{return JSON.parse(JSON.stringify(value))}catch(_){return value}
  }

  function parse(text,fallback=[]){
    try{return text?JSON.parse(text):clone(fallback)}
    catch(_){return clone(fallback)}
  }

  function text(value){return String(value??'').trim()}
  function array(value){return Array.isArray(value)?value:[]}
  function same(a,b){return text(a)!==''&&text(a)===text(b)}

  function readLocal(key,fallback=[]){
    return parse(localStorage.getItem(key),fallback);
  }

  function read(key,fallback=[]){
    try{
      if(global.MMLDataStore?.read){
        return global.MMLDataStore.read(key,fallback,{fresh:true});
      }
    }catch(error){
      console.warn('[MML] datastore read fallback',key,error);
    }
    return readLocal(key,fallback);
  }

  function estimateBytes(value){
    return new Blob([JSON.stringify(value)]).size;
  }

  function safeSetItem(key,value){
    const json=JSON.stringify(value);
    try{
      internalWrite=true;
      localStorage.setItem(key,json);
      return {ok:true,bytes:new Blob([json]).size};
    }finally{
      setTimeout(()=>{internalWrite=false},0);
    }
  }

  function writePrimary(charts,detail=''){
    try{
      if(global.MMLDataStore?.write){
        internalWrite=true;
        global.MMLDataStore.write(KEYS.charts,charts,{
          action:'전자차트 통합 동기화',
          detail,
          source:'chart-sync-manager',
          server:false
        });
        setTimeout(()=>{internalWrite=false},0);
        return {ok:true,bytes:estimateBytes(charts),via:'MMLDataStore'};
      }
    }catch(error){
      if(error?.name!=='QuotaExceededError'){
        console.warn('[MML] datastore write fallback',error);
      }
    }

    return safeSetItem(KEYS.charts,charts);
  }

  function writeLegacy(charts){
    const legacy=charts.map(item=>({
      id:item.id,
      reservationId:item.reservationId,
      clientId:item.clientId,
      clientName:item.clientName,
      program:item.program,
      date:item.date,
      time:item.time,
      counselingMethod:item.counselingMethod,
      reservationStatus:item.reservationStatus,
      assessmentStatus:item.assessment?.status||'검사결과 대기',
      uploadedTestCount:Number(item.assessment?.uploadedTestCount||0),
      approvedReportCount:Array.isArray(item.assessment?.approvedReportIds)
        ? item.assessment.approvedReportIds.length
        : 0,
      aiCounselingReady:Boolean(item.aiCounselingReady),
      reportPublicationStatus:item.reportPublicationStatus||'private',
      updatedAt:item.updatedAt||''
    }));

    return safeSetItem(KEYS.legacyCharts,legacy);
  }

  function reservationTests(reservation={}){
    const candidates=[
      reservation.tests,
      reservation.selectedTests,
      reservation.assessments,
      reservation.testNames,
      reservation.requestedTests
    ];

    for(const value of candidates){
      if(Array.isArray(value)){
        return [...new Set(value.map(text).filter(Boolean))];
      }
      if(typeof value==='string'&&value.trim()){
        return [...new Set(value.split(/[,\n·/]/).map(text).filter(Boolean))];
      }
    }

    if(reservation.testStatuses&&typeof reservation.testStatuses==='object'){
      return [...new Set(Object.keys(reservation.testStatuses).map(text).filter(Boolean))];
    }

    return [];
  }

  function normalizeReservation(reservation={}){
    return {
      id:text(reservation.id),
      reservationNumber:text(reservation.reservationNumber||reservation.reservationNo),
      caseNumber:text(reservation.caseNumber),
      clientId:text(reservation.clientId||reservation.memberId||reservation.userId),
      clientName:text(reservation.name||reservation.clientName),
      phone:text(reservation.phone||reservation.contact),
      program:text(reservation.program),
      date:text(reservation.date||reservation.counselingDate||reservation.reservationDate),
      time:text(reservation.time||reservation.counselingTime),
      counselingMethod:text(reservation.type||reservation.counselingMethod||reservation.method),
      status:text(reservation.status),
      tests:reservationTests(reservation)
    };
  }

  function reportKind(report={}){
    if(report.individualAssessmentReport||report.reportType==='individualReport')return 'individual';
    if(report.integratedAssessmentReport||report.reportType==='counselorComprehensiveReport')return 'integrated';
    if(report.assessmentReport||report.comprehensiveReport||report.reportType==='comprehensiveReport')return 'comprehensive';
    if(report.summaryReport||report.reportType==='summaryReport')return 'summary';
    return text(report.reportType)||'unknown';
  }

  function analysisRef(item={}){
    return {
      id:text(item.id),
      testType:text(item.testType||item.testName),
      fileName:text(item.fileName||item.sourceFileName),
      status:text(item.status)||(item.reviewed?'상담자 검토 완료':'AI 분석 초안'),
      reviewed:Boolean(item.reviewed),
      needsReview:Boolean(item.needsReview),
      uploadedAt:item.uploadedAt||item.createdAt||'',
      reviewedAt:item.reviewedAt||'',
      updatedAt:item.updatedAt||item.reviewedAt||item.uploadedAt||item.createdAt||''
    };
  }

  function reportRef(item={}){
    return {
      id:text(item.id),
      reportType:reportKind(item),
      testType:text(item.testType),
      title:text(item.title)||'심리검사 보고서',
      status:text(item.status)||'초안',
      approved:Boolean(item.approved),
      approvedForClient:Boolean(item.approvedForClient),
      reviewed:Boolean(item.reviewed),
      version:Number(item.version||1),
      createdAt:item.createdAt||'',
      updatedAt:item.updatedAt||'',
      approvedAt:item.approvedAt||item.publishedAt||''
    };
  }

  function getClinicalRecords(){
    try{
      if(global.MMLClinicalAssessmentStore&&typeof global.MMLClinicalAssessmentStore.read==='function'){
        return array(global.MMLClinicalAssessmentStore.read());
      }
    }catch(error){
      console.warn('[MML] optional clinical store fallback',error);
    }
    return array(read(KEYS.clinical,[]));
  }

  function getReportRows(reservationId){
    try{
      if(global.MMLReportStore&&typeof global.MMLReportStore.getByReservationId==='function'){
        return array(global.MMLReportStore.getByReservationId(reservationId));
      }
    }catch(error){
      console.warn('[MML] optional report store fallback',error);
    }
    return array(read(KEYS.reports,[])).filter(item=>same(item.reservationId,reservationId));
  }

  function buildAssessment(reservationId){
    const analyses=array(read(KEYS.analyses,[]))
      .filter(item=>same(item.reservationId,reservationId))
      .map(analysisRef);

    const reports=getReportRows(reservationId).map(reportRef);
    const clinical=getClinicalRecords().find(item=>same(item.reservationId,reservationId))||null;

    const tests=analyses.length?analyses:array(clinical?.tests).map(analysisRef);
    const issuedReports=reports.length?reports:array(clinical?.issuedReports).map(reportRef);
    const approvedReports=issuedReports.filter(item=>item.approvedForClient);

    return {
      assessmentIds:tests.map(item=>item.id).filter(Boolean),
      reportIds:issuedReports.map(item=>item.id).filter(Boolean),
      approvedReportIds:approvedReports.map(item=>item.id).filter(Boolean),
      tests,
      reports:issuedReports,
      uploadedTestCount:tests.length,
      reviewedTestCount:tests.filter(item=>item.reviewed).length,
      hasAssessmentFiles:tests.length>0,
      hasApprovedClientReport:approvedReports.length>0,
      aiCounselingReady:tests.length>0,
      status:tests.length===0
        ? '검사결과 대기'
        : tests.some(item=>!item.reviewed)
          ? '검사결과 검토 중'
          : issuedReports.length===0
            ? '보고서 생성 대기'
            : approvedReports.length===0
              ? '보고서 승인 대기'
              : '내담자 열람 가능'
    };
  }

  function oldChartMap(){
    const old=array(read(KEYS.charts,[]));
    const map=new Map();

    old.forEach(item=>{
      const id=text(item.reservationId||item.reservation?.id);
      if(id)map.set(id,item);
    });

    return map;
  }

  function buildChart(reservation,old=null){
    const r=normalizeReservation(reservation);
    const assessment=buildAssessment(r.id);
    const now=new Date().toISOString();

    return {
      id:text(old?.id)||`chart-${r.id}`,
      reservationId:r.id,
      reservationNumber:r.reservationNumber,
      caseNumber:r.caseNumber,
      clientId:r.clientId,
      clientName:r.clientName,
      phone:r.phone,
      program:r.program,
      date:r.date,
      time:r.time,
      counselingMethod:r.counselingMethod,
      reservationStatus:r.status,
      tests:r.tests,
      counselingRecordIds:Array.isArray(old?.counselingRecordIds)
        ? old.counselingRecordIds
        : array(old?.counselingRecords).map(item=>item?.id).filter(Boolean),
      aiCounselingRecordIds:Array.isArray(old?.aiCounselingRecordIds)
        ? old.aiCounselingRecordIds
        : array(old?.aiCounseling).map(item=>item?.id).filter(Boolean),
      assessment,
      aiCounselingReady:assessment.aiCounselingReady,
      reportPublicationStatus:assessment.hasApprovedClientReport?'published':'private',
      createdAt:old?.createdAt||now,
      updatedAt:now,
      syncVersion:VERSION
    };
  }

  function signature(charts){
    return JSON.stringify(charts.map(item=>({
      id:item.id,
      reservationId:item.reservationId,
      reservationNumber:item.reservationNumber,
      caseNumber:item.caseNumber,
      clientId:item.clientId,
      clientName:item.clientName,
      phone:item.phone,
      program:item.program,
      date:item.date,
      time:item.time,
      counselingMethod:item.counselingMethod,
      reservationStatus:item.reservationStatus,
      tests:item.tests,
      assessment:item.assessment,
      aiCounselingReady:item.aiCounselingReady,
      reportPublicationStatus:item.reportPublicationStatus,
      counselingRecordIds:item.counselingRecordIds,
      aiCounselingRecordIds:item.aiCounselingRecordIds
    })));
  }

  function sync(options={}){
    if(syncing)return {ok:false,reason:'already-syncing'};
    syncing=true;

    try{
      const reservations=array(read(KEYS.reservations,[]));
      const oldMap=oldChartMap();

      const next=reservations
        .filter(item=>text(item?.id))
        .map(item=>buildChart(item,oldMap.get(text(item.id))||null));

      const nextSignature=signature(next);
      const changed=nextSignature!==lastSignature;

      if(changed||options.force){
        writePrimary(next,`예약 ${reservations.length}건 통합`);
        writeLegacy(next);
        lastSignature=nextSignature;
      }

      const result={
        ok:true,
        version:VERSION,
        reservations:reservations.length,
        charts:next.length,
        changed,
        bytes:estimateBytes(next),
        slim:true,
        at:new Date().toISOString()
      };

      global.dispatchEvent(new CustomEvent('mml:chart-sync-complete',{detail:result}));
      return result;
    }finally{
      syncing=false;
    }
  }

  function schedule(reason='change'){
    clearTimeout(timer);
    timer=setTimeout(()=>sync({reason}),180);
  }

  function getCharts(){
    return array(read(KEYS.charts,[]));
  }

  function getByReservationId(reservationId){
    return getCharts().find(item=>same(item.reservationId,reservationId))||null;
  }

  function diagnostics(){
    const rows=getCharts();
    const heavyFields=[];

    rows.forEach(item=>{
      ['reservation','assessmentResults','reports','counselingRecords','aiCounseling'].forEach(field=>{
        if(field in item)heavyFields.push({reservationId:item.reservationId,field});
      });
    });

    return {
      ok:heavyFields.length===0,
      version:VERSION,
      charts:rows.length,
      bytes:estimateBytes(rows),
      heavyFields,
      duplicateWriterDisabled:
        !global.MMLReservationChartBridge &&
        !global.MMLChartAssessmentBridge
    };
  }

  function compactNow(){
    return sync({force:true,reason:'manual-compact'});
  }

  [
    'mml:assessment-saved',
    'mml:report-saved',
    'mml:reservations-module-ready'
  ].forEach(name=>global.addEventListener(name,()=>schedule(name)));

  global.addEventListener('storage',event=>{
    if(internalWrite)return;
    if([
      KEYS.reservations,
      KEYS.analyses,
      KEYS.clinical,
      KEYS.reports
    ].includes(event.key)){
      schedule(`storage:${event.key}`);
    }
  });

  global.addEventListener('focus',()=>schedule('focus'));

  try{
    delete global.MMLReservationChartBridge;
    delete global.MMLChartAssessmentBridge;
  }catch(_){}

  global.MMLChartSyncManager=Object.freeze({
    version:VERSION,
    sync,
    schedule,
    getCharts,
    getByReservationId,
    diagnostics,
    compactNow,
    buildAssessment
  });

  setTimeout(()=>sync({force:true,reason:'startup'}),500);
})(window);
