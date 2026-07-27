(function(global){
'use strict';
const NS=global.MMLWorkflowModules=global.MMLWorkflowModules||{};
function sync(reason){
 try{
  global.MMLCaseRepository?.events?.sync?.();
  const cases=NS.actions?.reconcileAll(reason)||[];
  return {count:cases.length,cases};
 }catch(error){console.warn('[MML Workflow] 동기화 실패',error);return{count:0,cases:[],error};}
}
function getCaseWorkflow(caseId){
 const repo=global.MMLCaseRepository;const c=repo?.getCase?.(caseId);if(!c)return null;
 return {case:c,state:NS.rules?.deriveState(c),facts:NS.rules?.facts(c),actions:NS.rules?.availableActions(c)};
}
NS.engine=Object.freeze({sync,getCaseWorkflow});
})(window);
