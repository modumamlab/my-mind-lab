console.info('[MML] CLIENT-REPORT-PUBLICATION-STEP4 loaded');

(function(global){
  'use strict';

  const VERSION='20260725-client-report-publication-step4';
  const KEYS={
    reports:'modumam_reports',
    charts:'modumam_chart_records',
    publications:'modumam_client_report_publications',
    requests:'modumam_assessment_report_requests_v1'
  };

  let syncing=false;
  let timer=null;
  let lastSignature='';

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

  function read(key,fallback=[]){
    try{
      if(global.MMLDataStore?.read){
        return global.MMLDataStore.read(key,fallback,{fresh:true});
      }
    }catch(error){
      console.warn('[MML] publication datastore read fallback',key,error);
    }
    return parse(localStorage.getItem(key),fallback);
  }

  function write(key,value,detail=''){
    const safeValue=key===KEYS.publications?array(value).slice(0,200).map(item=>({
      id:item.id,reportId:item.reportId,reservationId:item.reservationId,clientId:item.clientId,
      clientName:item.clientName,clientPhone:item.clientPhone,reportType:item.reportType,testType:item.testType,
      title:item.title,status:item.status,visible:item.visible===true,approvedForClient:item.approvedForClient===true,
      approvedAt:item.apvedAt||item.approvedAt,updatedAt:item.updatedAt,version:item.version,
      sourceStore:item.sourceStore,sourceVersion:item.sourceVersion
    })):value;
    try{
      localStorage.setItem(key,JSON.stringify(safeValue));
      try{global.MMLDataStore?.invalidate?.(key)}catch(_){}
      return clone(safeValue);
    }catch(error){
      if(error?.name==='QuotaExceededError'){
        try{global.MMLStorageQuotaGuard?.cleanup?.()}catch(_){}
        localStorage.setItem(key,JSON.stringify(safeValue));
        return clone(safeValue);
      }
      throw error;
    }
  }

  function reportKind(report={}){
    if(report.individualAssessmentReport||report.reportType==='individualReport')return 'individual';
    if(report.integratedAssessmentReport||report.reportType==='counselorComprehensiveReport')return 'integrated';
    if(report.assessmentReport||report.comprehensiveReport||report.reportType==='comprehensiveReport')return 'comprehensive';
    if(report.summaryReport||report.reportType==='summaryReport')return 'summary';
    return text(report.reportType)||'unknown';
  }

  function displayTitle(report={}){
    const kind=reportKind(report);
    const testType=text(report.testType);

    if(kind==='individual'){
      return testType ? `${testType} 개별 심리검사 보고서` : '개별 심리검사 보고서';
    }
    if(kind==='comprehensive')return '심리검사 종합보고서';
    if(kind==='integrated')return '통합 심리평가보고서';
    if(kind==='summary')return '심리검사 요약보고서';

    return text(report.title)||'심리검사 보고서';
  }

  function isApprovedForClient(report={}){
    if(report.approvedForClient===true)return true;
    if(report.clientVisible===true)return true;
    if(report.published===true)return true;

    const status=text(report.status).toLowerCase();
    return [
      'approved',
      'published',
      '승인',
      '승인완료',
      '공개',
      '내담자 열람 가능'
    ].includes(status);
  }

  function chartForReservation(charts,reservationId){
    return charts.find(item=>same(item.reservationId,reservationId))||null;
  }

  function requestForReservation(requests,reservationId){
    return requests.find(item=>same(item.reservationId,reservationId))||null;
  }

  function publicationRef(report={},chart=null,request=null){
    const reportId=text(report.id);
    const reservationId=text(report.reservationId||chart?.reservationId||request?.reservationId);
    const now=new Date().toISOString();

    return {
      id:`publication-${reportId||reservationId}`,
      reportId,
      reservationId,
      clientId:text(report.clientId||report.memberId||report.userId||chart?.clientId),
      clientName:text(report.clientName||report.name||chart?.clientName||request?.clientName),
      clientPhone:text(report.clientPhone||report.phone||chart?.clientPhone||chart?.phone||request?.phone),
      reportType:reportKind(report),
      testType:text(report.testType),
      title:displayTitle(report),
      status:'published',
      visible:true,
      approvedForClient:true,
      approvedAt:report.approvedAt||report.publishedAt||report.updatedAt||now,
      updatedAt:report.updatedAt||now,
      version:Number(report.version||1),
      sourceStore:KEYS.reports,
      sourceVersion:VERSION
    };
  }

  function getReports(){
    try{
      if(global.MMLReportStore&&typeof global.MMLReportStore.list==='function'){
        return array(global.MMLReportStore.list());
      }
    }catch(error){
      console.warn('[MML] optional report store list fallback',error);
    }
    return array(read(KEYS.reports,[]));
  }

  function build(){
    const reports=getReports();
    const charts=array(read(KEYS.charts,[]));
    const requests=array(read(KEYS.requests,[]));

    return reports
      .filter(report=>isApprovedForClient(report))
      .map(report=>publicationRef(
        report,
        chartForReservation(charts,text(report.reservationId)),
        requestForReservation(requests,text(report.reservationId))
      ))
      .filter(item=>item.reportId&&item.reservationId)
      .sort((a,b)=>String(b.approvedAt).localeCompare(String(a.approvedAt)));
  }

  function signature(items){
    return JSON.stringify(items.map(item=>({
      reportId:item.reportId,
      reservationId:item.reservationId,
      clientId:item.clientId,
      reportType:item.reportType,
      testType:item.testType,
      title:item.title,
      approvedAt:item.approvedAt,
      version:item.version
    })));
  }

  function sync(options={}){
    if(syncing)return {ok:false,reason:'already-syncing'};
    syncing=true;

    try{
      const next=build();
      const nextSignature=signature(next);
      const current=array(read(KEYS.publications,[]));
      const currentSignature=signature(current);
      const changed=nextSignature!==currentSignature||nextSignature!==lastSignature;

      if(changed||options.force){
        write(
          KEYS.publications,
          next,
          `승인 보고서 ${next.length}건 공개`
        );
        lastSignature=nextSignature;
      }

      const result={
        ok:true,
        version:VERSION,
        publications:next.length,
        changed,
        bytes:new Blob([JSON.stringify(next)]).size,
        at:new Date().toISOString()
      };

      global.dispatchEvent(new CustomEvent('mml:client-report-publications-synced',{detail:result}));
      return result;
    }finally{
      syncing=false;
    }
  }

  function schedule(reason='change'){
    clearTimeout(timer);
    timer=setTimeout(()=>sync({reason}),160);
  }

  function list(){
    return array(read(KEYS.publications,[]));
  }

  function getByClientId(clientId){
    return list().filter(item=>same(item.clientId,clientId)&&item.visible===true);
  }

  function getByReservationId(reservationId){
    return list().filter(item=>same(item.reservationId,reservationId)&&item.visible===true);
  }

  function isPublished(reportId){
    return list().some(item=>same(item.reportId,reportId)&&item.visible===true);
  }

  function revoke(reportId){
    const reports=getReports();
    const report=reports.find(item=>same(item.id,reportId));

    if(!report){
      return {ok:false,reason:'report-not-found',reportId};
    }

    report.approvedForClient=false;
    report.clientVisible=false;
    report.published=false;
    if(['approved','published','승인','승인완료','공개','내담자 열람 가능'].includes(text(report.status))){
      report.status='draft';
    }
    report.updatedAt=new Date().toISOString();

    write(KEYS.reports,reports,`보고서 ${reportId} 승인 취소`);
    return sync({force:true,reason:'revoke'});
  }

  function diagnostics(){
    const reports=getReports();
    const approved=reports.filter(isApprovedForClient);
    const publications=list();
    const missing=approved
      .filter(report=>text(report.id)&&text(report.reservationId))
      .filter(report=>!publications.some(item=>same(item.reportId,report.id)))
      .map(report=>({
        reportId:report.id,
        reservationId:report.reservationId,
        title:displayTitle(report)
      }));

    const invalid=publications
      .filter(item=>!item.reportId||!item.reservationId||item.visible!==true)
      .map(item=>item.id);

    return {
      ok:missing.length===0&&invalid.length===0,
      version:VERSION,
      approvedReports:approved.length,
      publications:publications.length,
      missing,
      invalid
    };
  }

  [
    'mml:report-saved',
    'mml:chart-sync-complete',
    'mml:assessment-saved'
  ].forEach(name=>global.addEventListener(name,()=>schedule(name)));

  global.addEventListener('storage',event=>{
    if([KEYS.reports,KEYS.charts].includes(event.key)){
      schedule(`storage:${event.key}`);
    }
  });

  global.addEventListener('focus',()=>schedule('focus'));

  global.MMLClientReportPublication=Object.freeze({
    version:VERSION,
    sync,
    list,
    getByClientId,
    getByReservationId,
    isPublished,
    revoke,
    diagnostics
  });

  setTimeout(()=>sync({force:true,reason:'startup'}),750);
})(window);
