console.info('[MML] INTEGRATED-WORKFLOW-HUB-STEP17 loaded');

(function(global){
  'use strict';

  const VERSION='20260725-integrated-workflow-step17';

  const text=value=>String(value??'').trim();
  const array=value=>Array.isArray(value)?value:[];
  const uniq=values=>[...new Set(array(values).map(text).filter(Boolean))];

  const KEYS=Object.freeze({
    reservations:[
      'reservations',
      'modumam_reservations',
      'mml_reservations'
    ],
    charts:[
      'electronicCharts',
      'modumam_electronic_charts',
      'mml_electronic_charts'
    ],
    analyses:[
      'assessmentAnalyses',
      'assessment_results',
      'modumam_assessment_results'
    ],
    reports:[
      'assessmentReports',
      'generatedAssessmentReports',
      'modumam_assessment_reports'
    ],
    publications:[
      'clientReportPublications',
      'modumam_client_report_publications'
    ],
    formulations:[
      'modumam_clinical_formulations'
    ],
    counseling:[
      'modumam_ai_counseling_sessions'
    ],
    counselingRecords:[
      'modumam_counseling_records'
    ]
  });

  function safeParse(raw,fallback=[]){
    try{return raw?JSON.parse(raw):fallback}catch(_){return fallback}
  }

  function readKey(key){
    try{
      if(global.MMLDataStore?.read){
        const value=global.MMLDataStore.read(key,[],{fresh:true});
        if(Array.isArray(value)&&value.length)return value;
      }
    }catch(_){}
    try{
      const value=safeParse(localStorage.getItem(key),[]);
      return Array.isArray(value)?value:[];
    }catch(_){
      return [];
    }
  }

  function readAny(keys){
    for(const key of array(keys)){
      const rows=readKey(key);
      if(rows.length)return {key,rows};
    }
    return {key:array(keys)[0]||'',rows:[]};
  }

  function reservationIdOf(item){
    return text(
      item?.reservationId||
      item?.reservation_id||
      item?.bookingId||
      item?.booking_id||
      item?.id
    );
  }

  function chartReservationId(item){
    return text(
      item?.reservationId||
      item?.reservation_id||
      item?.bookingId||
      item?.sourceReservationId
    );
  }

  function reportReservationId(item){
    return text(
      item?.reservationId||
      item?.reservation_id||
      item?.bookingId||
      item?.sourceReservationId||
      item?.meta?.reservationId
    );
  }

  function collect(){
    const reservations=readAny(KEYS.reservations);
    const charts=readAny(KEYS.charts);
    const analyses=readAny(KEYS.analyses);
    const reports=readAny(KEYS.reports);
    const publications=readAny(KEYS.publications);
    const formulations=readAny(KEYS.formulations);
    const counseling=readAny(KEYS.counseling);
    const counselingRecords=readAny(KEYS.counselingRecords);

    return {
      sources:{
        reservations:reservations.key,
        charts:charts.key,
        analyses:analyses.key,
        reports:reports.key,
        publications:publications.key,
        formulations:formulations.key,
        counseling:counseling.key,
        counselingRecords:counselingRecords.key
      },
      reservations:reservations.rows,
      charts:charts.rows,
      analyses:analyses.rows,
      reports:reports.rows,
      publications:publications.rows,
      formulations:formulations.rows,
      counseling:counseling.rows,
      counselingRecords:counselingRecords.rows
    };
  }

  function caseBundle(reservationId){
    const id=text(reservationId);
    if(!id)throw new Error('예약 ID가 필요합니다.');

    const data=collect();
    const reservation=data.reservations.find(item=>reservationIdOf(item)===id)||null;
    const charts=data.charts.filter(item=>chartReservationId(item)===id);
    const analyses=data.analyses.filter(item=>reportReservationId(item)===id);
    const reports=data.reports.filter(item=>reportReservationId(item)===id);
    const publications=data.publications.filter(item=>reportReservationId(item)===id);
    const formulations=data.formulations.filter(item=>reportReservationId(item)===id);
    const counseling=data.counseling.filter(item=>reportReservationId(item)===id);
    const counselingRecords=data.counselingRecords.filter(item=>reportReservationId(item)===id);

    const approvedReports=reports.filter(item=>
      item?.approved===true||
      text(item?.status).includes('승인')||
      text(item?.publicationStatus).includes('공개')
    );

    const published=publications.filter(item=>
      item?.published===true||
      item?.approved===true||
      text(item?.status).includes('공개')||
      text(item?.status).includes('승인')
    );

    return {
      version:VERSION,
      reservationId:id,
      reservation,
      assessmentCenter:{
        analyses,
        reports,
        approvedReports
      },
      electronicChart:{
        charts,
        formulations,
        counseling,
        counselingRecords
      },
      clientPortal:{
        publications,
        published
      },
      ai:{
        reportEngineReady:Boolean(global.MMLUnifiedAIReportEngine),
        clinicalReasoningReady:Boolean(global.MMLClinicalReasoningEngine),
        counselingReady:Boolean(global.MMLAICounselingEngine)
      },
      state:{
        hasReservation:Boolean(reservation),
        hasChart:charts.length>0,
        hasAssessment:analyses.length>0,
        hasReport:reports.length>0,
        hasApprovedReport:approvedReports.length>0,
        isPublished:published.length>0,
        hasFormulation:formulations.length>0,
        hasCounseling:counseling.length>0,
        hasCounselingRecord:counselingRecords.length>0
      }
    };
  }

  function summarize(reservationId){
    const bundle=caseBundle(reservationId);
    return {
      reservationId:bundle.reservationId,
      clientName:text(
        bundle.reservation?.clientName||
        bundle.reservation?.name||
        bundle.reservation?.userName
      ),
      flow:[
        {step:'예약',complete:bundle.state.hasReservation},
        {step:'전자차트',complete:bundle.state.hasChart},
        {step:'검사결과',complete:bundle.state.hasAssessment},
        {step:'보고서 생성',complete:bundle.state.hasReport},
        {step:'보고서 승인',complete:bundle.state.hasApprovedReport},
        {step:'사용자 공개',complete:bundle.state.isPublished},
        {step:'사례개념화',complete:bundle.state.hasFormulation},
        {step:'AI 상담',complete:bundle.state.hasCounseling},
        {step:'상담기록',complete:bundle.state.hasCounselingRecord}
      ],
      counts:{
        charts:bundle.electronicChart.charts.length,
        analyses:bundle.assessmentCenter.analyses.length,
        reports:bundle.assessmentCenter.reports.length,
        approvedReports:bundle.assessmentCenter.approvedReports.length,
        publications:bundle.clientPortal.publications.length,
        formulations:bundle.electronicChart.formulations.length,
        counselingSessions:bundle.electronicChart.counseling.length,
        counselingRecords:bundle.electronicChart.counselingRecords.length
      }
    };
  }

  function allCases(){
    const data=collect();
    const ids=uniq([
      ...data.reservations.map(reservationIdOf),
      ...data.charts.map(chartReservationId),
      ...data.analyses.map(reportReservationId),
      ...data.reports.map(reportReservationId),
      ...data.publications.map(reportReservationId),
      ...data.formulations.map(reportReservationId),
      ...data.counseling.map(reportReservationId),
      ...data.counselingRecords.map(reportReservationId)
    ]);

    return ids.map(id=>{
      try{return summarize(id)}catch(_){return null}
    }).filter(Boolean);
  }

  async function syncReservation(reservationId,{repair=true}={}){
    const id=text(reservationId);
    if(!id)throw new Error('예약 ID가 필요합니다.');

    const actions=[];
    const errors=[];

    if(repair&&global.MMLChartSyncManager?.syncReservation){
      try{
        await global.MMLChartSyncManager.syncReservation(id);
        actions.push('전자차트 동기화');
      }catch(error){
        errors.push(`전자차트 동기화 실패: ${error.message||error}`);
      }
    }else if(repair&&global.MMLChartSyncManager?.syncAll){
      try{
        await global.MMLChartSyncManager.syncAll();
        actions.push('전자차트 전체 동기화');
      }catch(error){
        errors.push(`전자차트 전체 동기화 실패: ${error.message||error}`);
      }
    }

    if(repair&&global.MMLClientReportPublication?.sync){
      try{
        await global.MMLClientReportPublication.sync();
        actions.push('사용자 보고서 공개 동기화');
      }catch(error){
        errors.push(`보고서 공개 동기화 실패: ${error.message||error}`);
      }
    }else if(repair&&global.MMLClientReportPublication?.syncAll){
      try{
        await global.MMLClientReportPublication.syncAll();
        actions.push('사용자 보고서 전체 공개 동기화');
      }catch(error){
        errors.push(`보고서 공개 전체 동기화 실패: ${error.message||error}`);
      }
    }

    return {
      ok:errors.length===0,
      reservationId:id,
      actions,
      errors,
      bundle:caseBundle(id)
    };
  }

  function createClinicalFormulation(reservationId,context={}){
    const bundle=caseBundle(reservationId);
    if(!bundle.reservation){
      throw new Error('예약 정보를 찾지 못했습니다.');
    }
    if(!global.MMLClinicalReasoningEngine?.create){
      throw new Error('임상추론 엔진이 준비되지 않았습니다.');
    }

    return global.MMLClinicalReasoningEngine.create({
      reservation:bundle.reservation,
      results:bundle.assessmentCenter.analyses,
      context
    });
  }

  function createCounselingSession(reservationId,options={}){
    const bundle=caseBundle(reservationId);
    if(!bundle.reservation){
      throw new Error('예약 정보를 찾지 못했습니다.');
    }
    if(!global.MMLAICounselingEngine?.createSession){
      throw new Error('AI 상담 엔진이 준비되지 않았습니다.');
    }

    return global.MMLAICounselingEngine.createSession({
      reservationId,
      clientId:text(
        bundle.reservation.clientId||
        bundle.reservation.userId||
        options.clientId
      ),
      title:text(options.title)||'AI 심층상담'
    });
  }

  function diagnose(){
    const cases=allCases();
    const issues=[];

    cases.forEach(item=>{
      const flow=Object.fromEntries(item.flow.map(step=>[step.step,step.complete]));
      if(flow['예약']&&!flow['전자차트']){
        issues.push({reservationId:item.reservationId,type:'chart_missing',message:'예약은 있으나 전자차트가 없습니다.'});
      }
      if(flow['보고서 승인']&&!flow['사용자 공개']){
        issues.push({reservationId:item.reservationId,type:'publication_missing',message:'승인된 보고서가 사용자에게 공개되지 않았습니다.'});
      }
      if(flow['검사결과']&&!flow['보고서 생성']){
        issues.push({reservationId:item.reservationId,type:'report_missing',message:'검사결과는 있으나 보고서가 없습니다.'});
      }
    });

    return {
      ok:issues.length===0,
      version:VERSION,
      caseCount:cases.length,
      issueCount:issues.length,
      issues,
      engines:{
        assessment:Boolean(global.MMLUnifiedAIReportEngine),
        chart:Boolean(global.MMLChartSyncManager),
        publication:Boolean(global.MMLClientReportPublication),
        clinical:Boolean(global.MMLClinicalReasoningEngine),
        counseling:Boolean(global.MMLAICounselingEngine)
      }
    };
  }

  global.MMLIntegratedWorkflowHub=Object.freeze({
    version:VERSION,
    keys:KEYS,
    collect,
    caseBundle,
    summarize,
    allCases,
    syncReservation,
    createClinicalFormulation,
    createCounselingSession,
    createCounselingRecord(sessionId,options={}){
      if(!global.MMLCounselingRecordEngine?.createFromSessionId){
        throw new Error('상담기록 엔진이 준비되지 않았습니다.');
      }
      return global.MMLCounselingRecordEngine.createFromSessionId(sessionId,options);
    },
    caseDashboard(reservationId){
      if(!global.MMLCaseManagementEngine?.buildDashboard){
        throw new Error('사례관리 엔진이 준비되지 않았습니다.');
      }
      return global.MMLCaseManagementEngine.buildDashboard(reservationId);
    },
    caseFollowUp(reservationId){
      if(!global.MMLCaseManagementEngine?.buildFollowUp){
        throw new Error('사례관리 엔진이 준비되지 않았습니다.');
      }
      return global.MMLCaseManagementEngine.buildFollowUp(reservationId);
    },
    diagnose
  });

  try{
    global.dispatchEvent(new CustomEvent('mml:integrated-workflow-ready',{
      detail:{version:VERSION}
    }));
  }catch(_){}
})(window);
