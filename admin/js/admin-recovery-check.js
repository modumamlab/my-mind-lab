
console.info('[MML] ADMIN-RECOVERY-CHECK-V39 loaded');
(function(global){
  global.MMLAdminRecoveryCheck=function(){
    const checks={
      manifest:!!global.MMLAdminModuleManifest,
      bootstrap:!!global.MMLAdminBootstrap,
      dataStore:!!global.MMLDataStore,
      printEngine:!!global.MMLPrintEngine,
      assessmentReports:
        typeof global.printAssessmentDraft==='function' ||
        typeof global.saveAndPrintCurrentReport==='function' ||
        !!document.querySelector('#app')
    };
    return {
      ok:Object.values(checks).every(Boolean),
      status:global.MMLAdminBootstrap?.diagnostics?.status||'unknown',
      checks
    };
  };
})(window);
