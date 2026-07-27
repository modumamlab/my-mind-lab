
console.info('[MML] REPORT-ENGINE-PREFLIGHT-V38.1 loaded');
(function(global){
  global.MMLReportEnginePreflight = function(){
    const checks = {
      manifest: !!global.MMLAdminModuleManifest,
      bootstrap: !!global.MMLAdminBootstrap,
      printEngine: !!global.MMLPrintEngine,
      reportEngine: !!global.MMLReportEngine,
      assessmentReports: typeof global.previewUnifiedAssessmentReport === 'function'
    };
    return {
      ok: Object.values(checks).every(Boolean),
      checks
    };
  };
})(window);
