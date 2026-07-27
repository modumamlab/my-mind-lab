(function(global){
'use strict';
const NS=global.MMLWorkflowModules=global.MMLWorkflowModules||{};
function emit(type,detail){global.dispatchEvent(new CustomEvent(type,{detail}))}
function applyDerivedState(caseRecord,reason){
 const repo=global.MMLCaseRepository; const rules=NS.rules;
 if(!repo||!rules||!caseRecord?.id)return caseRecord;
 const derived=rules.deriveState(caseRecord);
 const current=repo.normalize?.(caseRecord.lifecycleState||caseRecord.status)||'REQUESTED';
 const currentRank=repo.rank?.(current)??0; const derivedRank=repo.rank?.(derived)??0;
 const target=derivedRank>=currentRank?derived:current;
 let saved=caseRecord;
 if(target!==current){
  try{saved=repo.forceStatus(caseRecord.id,target,reason||'workflow-reconcile')||caseRecord;}
  catch(error){console.warn('[MML Workflow] 상태 동기화 실패',error);}
 }
 const actions=rules.availableActions(saved);
 const facts=rules.facts(saved);
 saved=repo.upsert?.({...saved,workflow:{state:target,facts,actions,updatedAt:new Date().toISOString()}})||saved;
 emit('mml:workflow-updated',{case:saved,state:target,facts,actions});
 return saved;
}
function reconcileAll(reason){
 const repo=global.MMLCaseRepository;if(!repo)return[];
 return (repo.listCases?.()||[]).map(row=>applyDerivedState(row,reason||'workflow-reconcile-all'));
}
function getCaseActions(caseId){
 const repo=global.MMLCaseRepository;const c=repo?.getCase?.(caseId);return c?NS.rules.availableActions(c):null;
}
NS.actions=Object.freeze({applyDerivedState,reconcileAll,getCaseActions});
})(window);
