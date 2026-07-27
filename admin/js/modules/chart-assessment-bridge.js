console.info('[MML] CHART-ASSESSMENT-BRIDGE-STEP2.2-SLIM loaded');

(function(global){
  'use strict';

  const VERSION='20260725-chart-assessment-step2-2-slim';
  const CHART_KEY='modumam_chart_records';
  const LEGACY_CHART_KEY='modumam_electronic_charts';
  const ANALYSIS_KEY='modumam_assessment_analyses';
  const CLINICAL_KEY='modumam_clinical_assessment_records';
  const REPORT_KEY='modumam_reports';

  let syncing=false;
  let timer=null;

  function clone(value){
    try{return structuredClone(value)}catch(_){}
    try{return JSON.parse(JSON.stringify(value))}catch(_){return value}
  }

  function parse(text,fallback=[]){
    try{return text?JSON.parse(text):clone(fallback)}
    catch(_){return clone(fallback)}
  }

  function read(key,fallback=[]){
    try{
      if(global.MMLDataStore?.read){
        return global.MMLDataStore.read(key,fallback,{fresh:true});
      }
    }catch(error){
      console.warn('[MML] datastore read fallback',key,error);
    }
    return parse(localStorage.getItem(key),fallback);
  }

  function safeSetItem(key,value){
    const json=JSON.stringify(value);
    try{
      localStorage.setItem(key,json);
      return {ok:true,bytes:new Blob([json]).size};
    }catch(error){
      if(error?.name!=='QuotaExceededError')throw error;

      const slim=value.map(item=>({
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
        tests:Array.isArray(item.tests)?item.tests:[],
        assessment:item.assessment||null,
        aiCounselingReady:Boolean(item.aiCounselingReady),
        reportPublicationStatus:item.reportPublicationStatus||'private',
        createdAt:item.createdAt||'',
        updatedAt:item.updatedAt||'',
        syncVersion:item.syncVersion||'',
        assessmentSyncVersion:item.assessmentSyncVersion||VERSION
      }));

      const slimJson=JSON.stringify(slim);
      localStorage.setItem(key,slimJson);
      console.warn('[MML] chart storage compacted after quota warning',key);
      return {ok:true,bytes:new Blob([slimJson]).size,compacted:true};
    }
  }

  function writeCharts(value,detail=''){
    try{
      if(global.MMLDataStore?.write){
        try{
          global.MMLDataStore.write(CHART_KEY,value,{
            action:'전자차트 Slim 동기화',
            detail,
            source:'chart-assessment-bridge',
            server:false
          });
        }catch(error){
          if(error?.name!=='QuotaExceededError')throw error;
          console.warn('[MML] datastore chart write quota fallback',error);
          safeSetItem(CHART_KEY,value);
        }
      }else{
        safeSetItem(CHART_KEY,value);
      }
    }catch(error){
      console.error('[MML] chart slim write failed',error);
      throw error;
    }

    // legacy 키는 동일 전체 객체를 이중 저장하지 않고 최소 호환 데이터만 저장합니다.
    const legacy=value.map(item=>({
      id:item.id,
      reservationId:item.reservationId,
      clientId:item.clientId,
      clientName:item.clientName,
      program:item.program,
      date:item.date,
      time:item.time,
      counselingMethod:item.counselingMethod,
      reservationStatus:item.reservationStatus,
      assessment:item.assessment||null,
      aiCounselingReady:Boolean(item.aiCounselingReady),
      reportPublicationStatus:item.reportPublicationStatus||'private',
      updatedAt:item.updatedAt||''
    }));

    safeSetItem(LEGACY_CHART_KEY,legacy);
  }

  function text(value){return String(value??'').trim()}
  function same(a,b){return text(a)!==''&&text(a)===text(b)}
  function array(value){return Array.isArray(value)?value:[]}

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
      confidenceScore:Number(item.confidenceScore||0),
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

  function getCharts(){
    const primary=read(CHART_KEY,[]);
    if(array(primary).length)return primary;
    return array(read(LEGACY_CHART_KEY,[]));
  }

  function getClinicalRecords(){
    try{
      if(global.MMLClinicalAssessmentStore && typeof global.MMLClinicalAssessmentStore.read==='function'){
        return array(global.MMLClinicalAssessmentStore.read());
      }
    }catch(error){
      console.warn('[MML] clinical store optional fallback',error);
    }
    return array(read(CLINICAL_KEY,[]));
  }

  function getReportRows(reservationId){
    try{
      if(global.MMLReportStore && typeof global.MMLReportStore.getByReservationId==='function'){
        return array(global.MMLReportStore.getByReservationId(reservationId));
      }
    }catch(error){
      console.warn('[MML] report store optional fallback',error);
    }
    return array(read(REPORT_KEY,[])).filter(item=>same(item.reservationId,reservationId));
  }

  function buildAssessment(reservationId){
    const analyses=array(read(ANALYSIS_KEY,[]))
      .filter(item=>same(item.reservationId,reservationId))
      .map(analysisRef);

    const reports=getReportRows(reservationId).map(reportRef);
    const clinical=getClinicalRecords().find(item=>same(item.reservationId,reservationId))||null;

    const clinicalTests=array(clinical?.tests).map(analysisRef);
    const clinicalReports=array(clinical?.issuedReports).map(reportRef);

    const tests=analyses.length?analyses:clinicalTests;
    const issuedReports=reports.length?reports:clinicalReports;
    const approvedReports=issuedReports.filter(report=>report.approvedForClient);

    return {
      reservationId:text(reservationId),
      assessmentIds:tests.map(item=>item.id).filter(Boolean),
      reportIds:issuedReports.map(item=>item.id).filter(Boolean),
      approvedReportIds:approvedReports.map(item=>item.id).filter(Boolean),
      tests,
      reports:issuedReports,
      uploadedTestCount:tests.length,
      reviewedTestCount:tests.filter(test=>test.reviewed).length,
      hasAssessmentFiles:tests.length>0,
      hasApprovedClientReport:approvedReports.length>0,
      aiCounselingReady:tests.length>0,
      status:tests.length===0
        ? '검사결과 대기'
        : tests.some(test=>!test.reviewed)
          ? '검사결과 검토 중'
          : issuedReports.length===0
            ? '보고서 생성 대기'
            : approvedReports.length===0
              ? '보고서 승인 대기'
              : '내담자 열람 가능',
      updatedAt:new Date().toISOString()
    };
  }

  function compactChart(chart={}){
    return {
      id:chart.id,
      reservationId:chart.reservationId||chart.reservation?.id||'',
      reservationNumber:chart.reservationNumber||'',
      caseNumber:chart.caseNumber||'',
      clientId:chart.clientId||'',
      clientName:chart.clientName||'',
      phone:chart.phone||'',
      program:chart.program||'',
      date:chart.date||'',
      time:chart.time||'',
      counselingMethod:chart.counselingMethod||'',
      reservationStatus:chart.reservationStatus||'',
      tests:Array.isArray(chart.tests)?chart.tests:[],
      counselingRecordIds:Array.isArray(chart.counselingRecordIds)
        ? chart.counselingRecordIds
        : array(chart.counselingRecords).map(item=>item?.id).filter(Boolean),
      aiCounselingRecordIds:Array.isArray(chart.aiCounselingRecordIds)
        ? chart.aiCounselingRecordIds
        : array(chart.aiCounseling).map(item=>item?.id).filter(Boolean),
      assessment:chart.assessment||null,
      aiCounselingReady:Boolean(chart.aiCounselingReady),
      reportPublicationStatus:chart.reportPublicationStatus||'private',
      createdAt:chart.createdAt||'',
      updatedAt:chart.updatedAt||'',
      syncVersion:chart.syncVersion||'',
      assessmentSyncVersion:VERSION
    };
  }

  function sync(options={}){
    if(syncing)return {ok:false,reason:'already-syncing'};
    syncing=true;

    try{
      if(global.MMLReservationChartBridge?.sync){
        global.MMLReservationChartBridge.sync();
      }

      const sourceCharts=getCharts();
      let changed=0;

      const next=sourceCharts.map(source=>{
        const chart=compactChart(source);
        const reservationId=text(chart.reservationId);
        if(!reservationId)return chart;

        const assessment=buildAssessment(reservationId);

        const before=JSON.stringify({
          assessment:chart.assessment||null,
          aiCounselingReady:Boolean(chart.aiCounselingReady),
          reportPublicationStatus:chart.reportPublicationStatus||'private'
        });

        const after=JSON.stringify({
          assessment,
          aiCounselingReady:assessment.aiCounselingReady,
          reportPublicationStatus:assessment.hasApprovedClientReport?'published':'private'
        });

        if(before!==after||options.force)changed+=1;

        return {
          ...chart,
          assessment,
          aiCounselingReady:assessment.aiCounselingReady,
          reportPublicationStatus:assessment.hasApprovedClientReport?'published':'private',
          updatedAt:new Date().toISOString(),
          assessmentSyncVersion:VERSION
        };
      });

      writeCharts(next,`Slim 전자차트 ${changed}건 갱신`);

      const result={
        ok:true,
        charts:next.length,
        changed,
        slim:true,
        estimatedBytes:new Blob([JSON.stringify(next)]).size,
        at:new Date().toISOString()
      };

      global.dispatchEvent(new CustomEvent('mml:chart-assessment-synced',{detail:result}));
      return result;
    }finally{
      syncing=false;
    }
  }

  function migrate(){
    const before=getCharts();
    const beforeBytes=new Blob([JSON.stringify(before)]).size;
    const compacted=before.map(compactChart);
    writeCharts(compacted,'기존 전자차트 Slim 마이그레이션');
    const afterBytes=new Blob([JSON.stringify(compacted)]).size;

    return {
      ok:true,
      charts:compacted.length,
      beforeBytes,
      afterBytes,
      reducedBytes:Math.max(0,beforeBytes-afterBytes),
      reducedPercent:beforeBytes?Math.round((beforeBytes-afterBytes)/beforeBytes*100):0
    };
  }

  function storageStatus(){
    const rows=getCharts();
    return {
      version:VERSION,
      charts:rows.length,
      bytes:new Blob([JSON.stringify(rows)]).size,
      slim:rows.every(item=>
        !('assessmentResults' in item) &&
        !('reports' in item) &&
        !('counselingRecords' in item) &&
        !('aiCounseling' in item)
      )
    };
  }

  function schedule(reason='change'){
    clearTimeout(timer);
    timer=setTimeout(()=>sync({reason}),180);
  }

  function getByReservationId(reservationId){
    const chart=getCharts().find(item=>same(item.reservationId,reservationId));
    return chart?.assessment||buildAssessment(reservationId);
  }

  function diagnostics(){
    const status=storageStatus();
    return {
      ok:status.slim,
      version:VERSION,
      charts:status.charts,
      bytes:status.bytes,
      slim:status.slim,
      issue:status.slim?'': '전자차트에 대용량 본문 필드가 남아 있습니다.'
    };
  }

  ['mml:assessment-saved','mml:report-saved','mml:reservation-chart-synced'].forEach(name=>{
    global.addEventListener(name,()=>schedule(name));
  });

  global.addEventListener('storage',event=>{
    if([ANALYSIS_KEY,CLINICAL_KEY,REPORT_KEY,CHART_KEY].includes(event.key)){
      schedule(`storage:${event.key}`);
    }
  });

  global.addEventListener('focus',()=>schedule('focus'));

  global.MMLChartAssessmentBridge=Object.freeze({
    version:VERSION,
    sync,
    migrate,
    storageStatus,
    getByReservationId,
    diagnostics,
    buildAssessment
  });

  setTimeout(()=>{
    try{
      migrate();
      sync({force:true,reason:'startup'});
    }catch(error){
      console.error('[MML] STEP2.2 startup migration failed',error);
    }
  },650);
})(window);
