(function(global){
'use strict';

const modules=global.MMLClinicalModules=global.MMLClinicalModules||{};

function buildComposerApi(){
  return Object.freeze({
    ...(modules.reportComposer||{}),
    ...(modules.clinicianReportComposer||{}),
    ...(modules.parentReportComposer||{}),
    ...(modules.counseling||{})
  });
}

function refreshComposer(){
  modules.composer=buildComposerApi();
  return modules.composer;
}

modules.refreshComposer=refreshComposer;
refreshComposer();
})(window);
