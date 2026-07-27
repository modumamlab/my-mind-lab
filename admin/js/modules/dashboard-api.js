console.info('[MML] DASHBOARD-API-STEP23 loaded');

(function(global){
  'use strict';

  const VERSION='20260725-dashboard-api-step23';
  const text=v=>String(v??'').trim();
  const arr=v=>Array.isArray(v)?v:[];

  function caseSummary(item){
    return {
      reservationId:item.reservationId,
      clientName:text(item.client?.name),
      programName:text(item.reservation?.programName||item.reservation?.program),
      status:text(item.workflow?.status),
      nextAction:text(item.workflow?.nextAction),
      reportCount:arr(item.reports).length,
      approvedReportCount:arr(item.publications).length,
      counselingSessionCount:arr(item.counseling?.sessions).length,
      counselingRecordCount:arr(item.counseling?.records).length,
      recoveryMetricCount:arr(item.recovery?.metrics).length,
      riskCount:arr(item.caseConceptualization).flatMap(x=>arr(x.riskFactors||x.risks)).length,
      updatedAt:text(item.audit?.updatedAt)
    };
  }

  function overview(){
    const cases=global.MMLOS?.allCases?.()||[];
    const summaries=cases.map(caseSummary);
    return {
      version:VERSION,
      totalCases:summaries.length,
      activeCases:summaries.filter(x=>x.status!=='종결').length,
      closedCases:summaries.filter(x=>x.status==='종결').length,
      pendingReports:summaries.filter(x=>x.reportCount>x.approvedReportCount).length,
      aiCounselingEnabled:summaries.filter(x=>['AI 상담 가능','상담 진행중'].includes(x.status)).length,
      riskCases:summaries.filter(x=>x.riskCount>0).length,
      records:summaries.reduce((sum,x)=>sum+x.counselingRecordCount,0),
      sessions:summaries.reduce((sum,x)=>sum+x.counselingSessionCount,0),
      cases:summaries
    };
  }

  function today(){
    const all=overview();
    const date=new Date();
    const todayString=`${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
    return {
      ...all,
      todayCases:all.cases.filter(x=>text(x.updatedAt).slice(0,10)===todayString),
      approvals:all.cases.filter(x=>x.reportCount>x.approvedReportCount),
      attention:all.cases.filter(x=>x.riskCount>0)
    };
  }

  function caseById(id){
    const item=global.MMLOS?.getCase?.(id);
    return item?caseSummary(item):null;
  }

  global.MMLDashboardAPI=Object.freeze({
    version:VERSION,
    overview,
    today,
    caseById
  });
})(window);
