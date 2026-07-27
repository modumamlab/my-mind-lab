(function(global){
'use strict';

function collectModules(){
  const modules=global.MMLClinicalModules||{};
  return {
    modules,
    evidence:modules.evidence||{},
    reasoning:modules.reasoning||{},
    caseObject:modules.caseObject||{},
    reportComposer:modules.reportComposer||{},
    clinicianReportComposer:modules.clinicianReportComposer||{},
    parentReportComposer:modules.parentReportComposer||{},
    counseling:modules.counseling||{},
    counselingSession:modules.counselingSession||{},
    counselingCaseBridge:modules.counselingCaseBridge||{},
    caseConceptBridge:modules.caseConceptBridge||{},
    clinicalWorkflow:modules.clinicalWorkflow||{},
    clinicalAppBridge:modules.clinicalAppBridge||{},
    reportService:modules.reportService||{},
    clinicalStore:modules.clinicalStore||{},
    clinicalBootstrap:modules.clinicalBootstrap||{},
    homepageBridge:modules.homepageBridge||{},
    adminBridge:modules.adminBridge||{},
    platformDiagnostics:modules.platformDiagnostics||{},
    clinicalRuntime:modules.clinicalRuntime||{},
    integrationValidator:modules.integrationValidator||{},
    composer:modules.composer||{},
    selfReview:modules.selfReview||{}
  };
}

function buildEngine(){
  const current=collectModules();
  return Object.freeze({
    version:'3.2.0-runtime-guard',
    ...current.evidence,...current.reasoning,...current.caseObject,...current.reportComposer,
    ...current.clinicianReportComposer,...current.parentReportComposer,...current.counseling,
    ...current.counselingSession,...current.counselingCaseBridge,...current.caseConceptBridge,
    ...current.clinicalWorkflow,...current.clinicalAppBridge,...current.reportService,...current.clinicalStore,
    ...current.integrationValidator,...current.clinicalBootstrap,...current.homepageBridge,...current.adminBridge,...current.platformDiagnostics,...current.clinicalRuntime,...current.composer,...current.selfReview,
    inspectClinicalModules(){
      const latest=collectModules();
      const keys=name=>Object.keys(latest[name]||{});
      return {
        ready:Boolean(keys('evidence').length&&keys('reasoning').length&&keys('clinicalWorkflow').length&&keys('reportService').length&&keys('clinicalStore').length),
        version:'3.2.0-runtime-guard',
        evidence:keys('evidence'),reasoning:keys('reasoning'),composer:keys('composer'),
        counseling:keys('counseling'),counselingSession:keys('counselingSession'),
        counselingCaseBridge:keys('counselingCaseBridge'),caseConceptBridge:keys('caseConceptBridge'),
        clinicalWorkflow:keys('clinicalWorkflow'),clinicalAppBridge:keys('clinicalAppBridge'),
        reportService:keys('reportService'),clinicalStore:keys('clinicalStore'),clinicalBootstrap:keys('clinicalBootstrap'),
        homepageBridge:keys('homepageBridge'),adminBridge:keys('adminBridge'),platformDiagnostics:keys('platformDiagnostics'),clinicalRuntime:keys('clinicalRuntime'),selfReview:keys('selfReview')
      };
    },
    refreshClinicalEngine(){global.MMLClinicalEngine=buildEngine();return global.MMLClinicalEngine;}
  });
}

global.MMLClinicalEngine=buildEngine();
try{global.MMLClinicalModules?.counselingCaseBridge?.syncCompletedSessions?.();}catch(error){console.warn('[MML Clinical Engine] AI 상담기록 초기 동기화 실패',error);}
})(window);
