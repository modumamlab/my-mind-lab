console.info('[MML] WORKFLOW-DIAGNOSTICS-STEP9 loaded');

(function(global){
  'use strict';

  const VERSION='20260725-workflow-diagnostics-step9';
  const KEYS={
    reservations:'modumam_reservations',
    charts:'modumam_chart_records',
    analyses:'modumam_assessment_analyses',
    reports:'modumam_reports',
    publications:'modumam_client_report_publications'
  };

  function text(value){return String(value??'').trim();}
  function array(value){return Array.isArray(value)?value:[]}
  function parse(raw,fallback=[]){
    try{return raw?JSON.parse(raw):fallback}
    catch(_){return fallback}
  }
  function read(key){
    try{
      if(global.MMLDataStore?.read){
        return array(global.MMLDataStore.read(key,[],{fresh:true}));
      }
    }catch(error){
      console.warn('[MML] diagnostics datastore read fallback',key,error);
    }
    return array(parse(localStorage.getItem(key),[]));
  }
  function same(a,b){
    return text(a)!==''&&text(a)===text(b);
  }
  function unique(values){
    return [...new Set(array(values).map(text).filter(Boolean))];
  }
  function bytes(value){
    try{return new Blob([JSON.stringify(value)]).size}
    catch(_){return 0}
  }

  function loadSnapshot(){
    return {
      reservations:read(KEYS.reservations),
      charts:read(KEYS.charts),
      analyses:read(KEYS.analyses),
      reports:read(KEYS.reports),
      publications:read(KEYS.publications)
    };
  }

  function reservationIdOf(item={}){
    return text(item.reservationId||item.id||item.reservation?.id);
  }

  function approvedForClient(report={}){
    if(report.approvedForClient===true)return true;
    if(report.clientVisible===true)return true;
    if(report.published===true)return true;
    return ['approved','published','승인','승인완료','공개','내담자 열람 가능']
      .includes(text(report.status));
  }

  function inspectReservation(reservation,snapshot){
    const reservationId=text(reservation?.id);
    const chart=snapshot.charts.find(item=>same(
      item.reservationId||item.reservation?.id,
      reservationId
    ))||null;

    const analyses=snapshot.analyses.filter(item=>same(item.reservationId,reservationId));
    const reports=snapshot.reports.filter(item=>same(item.reservationId,reservationId));
    const approved=reports.filter(approvedForClient);
    const publications=snapshot.publications.filter(item=>same(item.reservationId,reservationId));

    const missing=[];
    const warnings=[];

    if(!chart)missing.push('electronic-chart');

    if(chart){
      const chartAssessmentIds=unique(
        chart.assessment?.assessmentIds||
        chart.assessmentIds||
        []
      );
      const analysisIds=unique(analyses.map(item=>item.id));
      const unlinkedAnalyses=analysisIds.filter(id=>!chartAssessmentIds.includes(id));

      if(analyses.length&&unlinkedAnalyses.length){
        warnings.push({
          code:'chart-analysis-link-mismatch',
          count:unlinkedAnalyses.length,
          ids:unlinkedAnalyses
        });
      }

      const chartReportIds=unique(
        chart.assessment?.reportIds||
        chart.reportIds||
        []
      );
      const reportIds=unique(reports.map(item=>item.id));
      const unlinkedReports=reportIds.filter(id=>!chartReportIds.includes(id));

      if(reports.length&&unlinkedReports.length){
        warnings.push({
          code:'chart-report-link-mismatch',
          count:unlinkedReports.length,
          ids:unlinkedReports
        });
      }
    }

    approved.forEach(report=>{
      if(!publications.some(item=>same(item.reportId,report.id))){
        warnings.push({
          code:'approved-report-not-published',
          reportId:report.id,
          title:text(report.title)
        });
      }
    });

    publications.forEach(publication=>{
      const source=snapshot.reports.find(report=>same(report.id,publication.reportId));
      if(!source){
        warnings.push({
          code:'publication-source-missing',
          reportId:publication.reportId
        });
      }else if(!approvedForClient(source)){
        warnings.push({
          code:'publication-source-not-approved',
          reportId:publication.reportId
        });
      }
    });

    return {
      reservationId,
      clientName:text(reservation.name||reservation.clientName),
      chart:Boolean(chart),
      analyses:analyses.length,
      reports:reports.length,
      approvedReports:approved.length,
      publications:publications.length,
      missing,
      warnings,
      healthy:missing.length===0&&warnings.length===0
    };
  }

  function diagnose(){
    const snapshot=loadSnapshot();
    const reservationRows=snapshot.reservations.map(item=>inspectReservation(item,snapshot));

    const orphanCharts=snapshot.charts
      .filter(chart=>!snapshot.reservations.some(res=>same(res.id,reservationIdOf(chart))))
      .map(chart=>reservationIdOf(chart));

    const orphanAnalyses=snapshot.analyses
      .filter(item=>!snapshot.reservations.some(res=>same(res.id,item.reservationId)))
      .map(item=>text(item.id));

    const orphanReports=snapshot.reports
      .filter(item=>!snapshot.reservations.some(res=>same(res.id,item.reservationId)))
      .map(item=>text(item.id));

    const orphanPublications=snapshot.publications
      .filter(item=>!snapshot.reports.some(report=>same(report.id,item.reportId)))
      .map(item=>text(item.reportId));

    const warnings=reservationRows.flatMap(row=>row.warnings.map(warning=>({
      reservationId:row.reservationId,
      clientName:row.clientName,
      ...warning
    })));

    const missing=reservationRows.flatMap(row=>row.missing.map(code=>({
      reservationId:row.reservationId,
      clientName:row.clientName,
      code
    })));

    const result={
      ok:
        warnings.length===0 &&
        missing.length===0 &&
        orphanCharts.length===0 &&
        orphanAnalyses.length===0 &&
        orphanReports.length===0 &&
        orphanPublications.length===0,
      version:VERSION,
      counts:{
        reservations:snapshot.reservations.length,
        charts:snapshot.charts.length,
        analyses:snapshot.analyses.length,
        reports:snapshot.reports.length,
        publications:snapshot.publications.length
      },
      storageBytes:{
        reservations:bytes(snapshot.reservations),
        charts:bytes(snapshot.charts),
        analyses:bytes(snapshot.analyses),
        reports:bytes(snapshot.reports),
        publications:bytes(snapshot.publications)
      },
      reservations:reservationRows,
      warnings,
      missing,
      orphans:{
        charts:orphanCharts,
        analyses:orphanAnalyses,
        reports:orphanReports,
        publications:orphanPublications
      },
      modules:{
        chartSync:Boolean(global.MMLChartSyncManager),
        reportViewer:Boolean(global.MMLReportViewer),
        reportPublication:Boolean(global.MMLClientReportPublication),
        aiReportEngine:Boolean(global.MMLUnifiedAIReportEngine)
      },
      at:new Date().toISOString()
    };

    return result;
  }

  function repair(options={}){
    const actions=[];
    const errors=[];

    try{
      if(global.MMLChartSyncManager?.sync){
        actions.push({
          action:'chart-sync',
          result:global.MMLChartSyncManager.sync({
            force:true,
            reason:'workflow-diagnostics-repair'
          })
        });
      }
    }catch(error){
      errors.push({action:'chart-sync',message:error.message});
    }

    try{
      if(global.MMLClientReportPublication?.sync){
        actions.push({
          action:'publication-sync',
          result:global.MMLClientReportPublication.sync({
            force:true,
            reason:'workflow-diagnostics-repair'
          })
        });
      }
    }catch(error){
      errors.push({action:'publication-sync',message:error.message});
    }

    if(options.removeOrphanPublications===true){
      try{
        const snapshot=loadSnapshot();
        const next=snapshot.publications.filter(item=>
          snapshot.reports.some(report=>same(report.id,item.reportId))
        );

        if(global.MMLDataStore?.write){
          global.MMLDataStore.write(KEYS.publications,next,{
            action:'고아 공개목록 정리',
            detail:`${snapshot.publications.length-next.length}건 제거`,
            source:'workflow-diagnostics',
            server:false
          });
        }else{
          localStorage.setItem(KEYS.publications,JSON.stringify(next));
        }

        actions.push({
          action:'remove-orphan-publications',
          removed:snapshot.publications.length-next.length
        });
      }catch(error){
        errors.push({
          action:'remove-orphan-publications',
          message:error.message
        });
      }
    }

    const after=diagnose();
    return {
      ok:errors.length===0&&after.ok,
      actions,
      errors,
      after
    };
  }

  function summary(){
    const result=diagnose();
    return {
      ok:result.ok,
      counts:result.counts,
      warningCount:result.warnings.length,
      missingCount:result.missing.length,
      orphanCount:Object.values(result.orphans)
        .reduce((sum,rows)=>sum+rows.length,0),
      modules:result.modules
    };
  }

  global.MMLWorkflowDiagnostics=Object.freeze({
    version:VERSION,
    diagnose,
    summary,
    repair,
    loadSnapshot
  });

  try{
    global.dispatchEvent(new CustomEvent('mml:workflow-diagnostics-ready',{
      detail:{version:VERSION}
    }));
  }catch(_){}
})(window);
