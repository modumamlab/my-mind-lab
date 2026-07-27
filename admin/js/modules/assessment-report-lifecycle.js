console.info('[MML] ASSESSMENT-REPORT-LIFECYCLE-STEP10 loaded');

(function(global){
  'use strict';

  const VERSION='20260725-assessment-report-lifecycle-step10';
  const REPORT_KEY='modumam_reports';
  let installed=false;

  const text=value=>String(value??'').trim();
  const array=value=>Array.isArray(value)?value:[];

  function readReports(){
    try{
      if(global.MMLReportStore?.loadAll)return array(global.MMLReportStore.loadAll());
    }catch(error){
      console.warn('[MML] lifecycle report-store read fallback',error);
    }
    try{return array(JSON.parse(localStorage.getItem(REPORT_KEY)||'[]'))}
    catch(_){return []}
  }

  function saveReports(rows){
    try{
      if(global.MMLReportStore?.saveAll)return global.MMLReportStore.saveAll(rows);
    }catch(error){
      console.warn('[MML] lifecycle report-store write fallback',error);
    }
    localStorage.setItem(REPORT_KEY,JSON.stringify(array(rows)));
    return array(rows);
  }

  function upsert(report){
    if(!report)return null;
    const rows=readReports();
    const index=rows.findIndex(item=>text(item.id)===text(report.id));
    const now=new Date().toISOString();
    const next={
      ...(index>=0?rows[index]:{}),
      ...report,
      updatedAt:report.updatedAt||now
    };
    if(index>=0)rows[index]=next;
    else rows.unshift(next);
    saveReports(rows);
    return next;
  }

  function getById(id){
    return readReports().find(item=>text(item.id)===text(id))||null;
  }

  function ensureCanonicalReport(id){
    const report=getById(id);
    if(!report)return null;
    const normalized={
      ...report,
      version:Number(report.version||1),
      status:text(report.status)||(
        report.approvedForClient?'승인완료 · 열람가능':'승인 대기'
      ),
      approvedForClient:report.approvedForClient===true,
      updatedAt:report.updatedAt||report.createdAt||new Date().toISOString()
    };
    return upsert(normalized);
  }

  function syncAfterAction(reason='report-action'){
    try{
      global.MMLChartSyncManager?.sync?.({force:true,reason});
    }catch(error){
      console.warn('[MML] lifecycle chart sync fallback',error);
    }

    try{
      global.MMLClientReportPublication?.sync?.({force:true,reason});
    }catch(error){
      console.warn('[MML] lifecycle publication sync fallback',error);
    }

    try{
      global.dispatchEvent(new CustomEvent('mml:report-lifecycle-synced',{
        detail:{reason,version:VERSION,at:new Date().toISOString()}
      }));
    }catch(_){}
  }

  function wrap(name,after){
    const original=global[name];
    if(typeof original!=='function'||original.__mmlLifecycleWrapped)return false;

    const wrapped=async function(...args){
      const result=await original.apply(this,args);
      try{await after(args,result)}catch(error){
        console.warn(`[MML] ${name} 후처리 실패`,error);
      }
      return result;
    };
    wrapped.__mmlLifecycleWrapped=true;
    wrapped.__mmlOriginal=original;
    global[name]=wrapped;
    return true;
  }

  function install(){
    if(installed)return diagnostics();

    const wrapped={
      saveIndividual:wrap('saveGeneratedAssessmentReport',async()=>{
        syncAfterAction('individual-report-saved');
      }),
      publishComprehensive:wrap('publishDerivedAssessmentReport',async(args)=>{
        const derivedId=args[0];
        const rows=readReports();
        rows
          .filter(item=>text(item.derivedReportId)===text(derivedId))
          .forEach(item=>ensureCanonicalReport(item.id));
        syncAfterAction('comprehensive-report-approved');
      }),
      revokeComprehensive:wrap('revokeDerivedAssessmentReport',async()=>{
        syncAfterAction('comprehensive-report-revoked');
      }),
      printReport:wrap('printReport',async(args,result)=>{
        const id=args[0];
        ensureCanonicalReport(id);
        return result;
      })
    };

    installed=Object.values(wrapped).some(Boolean);
    return {ok:installed,wrapped,version:VERSION};
  }

  function openCanonical(id,printImmediately=false){
    const report=ensureCanonicalReport(id);
    if(!report)throw new Error('보고서 원본을 찾지 못했습니다.');

    if(global.MMLReportViewer?.open){
      return global.MMLReportViewer.open(id,{
        printImmediately,
        toolbar:true
      });
    }

    if(typeof global.printReport==='function'){
      return global.printReport(id,printImmediately);
    }

    throw new Error('보고서 열람 기능을 찾지 못했습니다.');
  }

  function approvalState(id){
    const report=getById(id);
    if(!report)return {exists:false,approved:false,status:'보고서 없음'};
    return {
      exists:true,
      approved:report.approvedForClient===true,
      status:text(report.status),
      version:Number(report.version||1),
      updatedAt:report.updatedAt||''
    };
  }

  function diagnostics(){
    return {
      ok:installed,
      version:VERSION,
      installed,
      actions:{
        saveGeneratedAssessmentReport:
          Boolean(global.saveGeneratedAssessmentReport?.__mmlLifecycleWrapped),
        publishDerivedAssessmentReport:
          Boolean(global.publishDerivedAssessmentReport?.__mmlLifecycleWrapped),
        revokeDerivedAssessmentReport:
          Boolean(global.revokeDerivedAssessmentReport?.__mmlLifecycleWrapped),
        printReport:
          Boolean(global.printReport?.__mmlLifecycleWrapped)
      },
      modules:{
        reportViewer:Boolean(global.MMLReportViewer),
        publication:Boolean(global.MMLClientReportPublication),
        chartSync:Boolean(global.MMLChartSyncManager)
      },
      reportCount:readReports().length,
      singleSource:REPORT_KEY
    };
  }

  global.MMLAssessmentReportLifecycle=Object.freeze({
    version:VERSION,
    install,
    diagnostics,
    readReports,
    getById,
    upsert,
    ensureCanonicalReport,
    openCanonical,
    approvalState,
    syncAfterAction
  });

  setTimeout(install,900);
  global.addEventListener('mml:admin-modules-ready',install);
  global.addEventListener('focus',()=>{
    if(!installed)install();
  });
})(window);
