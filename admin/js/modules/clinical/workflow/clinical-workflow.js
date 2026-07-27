(function(global){
'use strict';

const root=global.MMLClinicalModules=global.MMLClinicalModules||{};
const STORAGE_KEY='modumam_clinical_workflows_v1';
const VERSION='1.0.0';

const STATES=Object.freeze({
  RESERVED:'reserved',
  ASSESSMENT_UPLOADED:'assessment_uploaded',
  ANALYZED:'analyzed',
  REPORTS_DRAFTED:'reports_drafted',
  APPROVAL_PENDING:'approval_pending',
  APPROVED:'approved',
  PUBLISHED:'published',
  COUNSELING_ACTIVE:'counseling_active',
  COUNSELING_COMPLETED:'counseling_completed',
  CASE_CONCEPT_DRAFTED:'case_concept_drafted',
  CASE_CONCEPT_APPROVED:'case_concept_approved',
  CLOSED:'closed'
});

const ORDER=Object.freeze([
  STATES.RESERVED,
  STATES.ASSESSMENT_UPLOADED,
  STATES.ANALYZED,
  STATES.REPORTS_DRAFTED,
  STATES.APPROVAL_PENDING,
  STATES.APPROVED,
  STATES.PUBLISHED,
  STATES.COUNSELING_ACTIVE,
  STATES.COUNSELING_COMPLETED,
  STATES.CASE_CONCEPT_DRAFTED,
  STATES.CASE_CONCEPT_APPROVED,
  STATES.CLOSED
]);

const now=()=>new Date().toISOString();
const copy=value=>JSON.parse(JSON.stringify(value??null));
const id=prefix=>`${prefix}_${Date.now()}_${Math.random().toString(36).slice(2,8)}`;

function readAll(){
  try{
    const parsed=JSON.parse(global.localStorage?.getItem(STORAGE_KEY)||'[]');
    return Array.isArray(parsed)?parsed:[];
  }catch(_){return [];}
}

function writeAll(items){
  global.localStorage?.setItem(STORAGE_KEY,JSON.stringify(items));
  return items;
}

function emit(name,detail){
  try{global.dispatchEvent(new CustomEvent(name,{detail:copy(detail)}));}catch(_){ }
}

function getWorkflow(workflowId){
  return readAll().find(item=>item.id===workflowId)||null;
}

function findWorkflow(query={}){
  return readAll().find(item=>(!query.reservationId||item.reservationId===query.reservationId)&&(!query.clientId||item.clientId===query.clientId))||null;
}

function saveWorkflow(workflow){
  const items=readAll();
  const index=items.findIndex(item=>item.id===workflow.id);
  const next={...workflow,updatedAt:now()};
  if(index>=0)items[index]=next;else items.unshift(next);
  writeAll(items);
  emit('mml:clinical-workflow-updated',next);
  return copy(next);
}

function appendHistory(workflow,action,meta={}){
  workflow.history=Array.isArray(workflow.history)?workflow.history:[];
  workflow.history.push({id:id('history'),action,state:workflow.state,at:now(),meta:copy(meta)});
  return workflow;
}

function transition(workflow,nextState,action,meta={}){
  if(!ORDER.includes(nextState))throw new Error(`알 수 없는 임상 워크플로우 상태입니다: ${nextState}`);
  workflow.state=nextState;
  workflow.progress=Math.round((ORDER.indexOf(nextState)/(ORDER.length-1))*100);
  appendHistory(workflow,action,meta);
  return saveWorkflow(workflow);
}

function requireWorkflow(workflowId){
  const workflow=getWorkflow(workflowId);
  if(!workflow)throw new Error('임상 워크플로우를 찾을 수 없습니다.');
  return workflow;
}

function engine(){return global.MMLClinicalEngine||{};}

function startWorkflow(source={}){
  const existing=findWorkflow({reservationId:source.reservationId,clientId:source.clientId});
  if(existing&&existing.state!==STATES.CLOSED)return copy(existing);
  const workflow={
    id:source.id||id('clinical'),
    version:VERSION,
    reservationId:String(source.reservationId||''),
    clientId:String(source.clientId||''),
    clientName:String(source.clientName||''),
    requestId:String(source.requestId||''),
    state:STATES.RESERVED,
    progress:0,
    assessments:[],
    evidence:null,
    reasoning:null,
    reports:[],
    counselingSessionId:'',
    caseConceptDraftId:'',
    publication:{published:false,publishedAt:''},
    approval:{approved:false,approvedAt:'',approvedBy:''},
    createdAt:now(),updatedAt:now(),history:[]
  };
  appendHistory(workflow,'workflow_started',{source});
  return saveWorkflow(workflow);
}

function uploadAssessment(workflowId,assessment){
  const workflow=requireWorkflow(workflowId);
  const key=String(assessment?.id||assessment?.testCode||assessment?.testName||id('assessment'));
  const list=Array.isArray(workflow.assessments)?workflow.assessments:[];
  const index=list.findIndex(item=>String(item.id||item.testCode||item.testName)===key);
  const value={...copy(assessment),id:assessment?.id||key,uploadedAt:assessment?.uploadedAt||now()};
  if(index>=0)list[index]=value;else list.push(value);
  workflow.assessments=list;
  return transition(workflow,STATES.ASSESSMENT_UPLOADED,'assessment_uploaded',{assessmentId:value.id,testName:value.testName});
}

function analyzeWorkflow(workflowId){
  const workflow=requireWorkflow(workflowId);
  if(!workflow.assessments?.length)throw new Error('분석할 검사결과가 없습니다.');
  const api=engine();
  const source={reservationId:workflow.reservationId,clientId:workflow.clientId,clientName:workflow.clientName,assessmentResults:copy(workflow.assessments),assessments:copy(workflow.assessments)};
  workflow.evidence=typeof api.buildEvidence==='function'?api.buildEvidence(source):typeof api.buildEvidenceBundle==='function'?api.buildEvidenceBundle(source):null;
  workflow.reasoning=typeof api.buildReasoning==='function'?api.buildReasoning({...source,evidence:workflow.evidence}):typeof api.reasonClinicalCase==='function'?api.reasonClinicalCase({...source,evidence:workflow.evidence}):null;
  return transition(workflow,STATES.ANALYZED,'clinical_analysis_completed',{evidenceReady:Boolean(workflow.evidence),reasoningReady:Boolean(workflow.reasoning)});
}

async function generateReports(workflowId,options={}){
  let workflow=requireWorkflow(workflowId);
  if(!workflow.evidence&&!workflow.reasoning)workflow=analyzeWorkflow(workflowId);
  const api=engine();
  const payload={reservationId:workflow.reservationId,clientId:workflow.clientId,clientName:workflow.clientName,requestId:workflow.requestId,assessmentResults:copy(workflow.assessments),evidence:copy(workflow.evidence),reasoning:copy(workflow.reasoning),individualTests:options.individualTests||workflow.assessments.map(item=>item.testName).filter(Boolean),comprehensiveRequested:options.comprehensiveRequested!==false};
  let generated=null;
  if(typeof api.generateRequestedReports==='function')generated=await api.generateRequestedReports(payload);
  else if(typeof api.createRequested==='function')generated=await api.createRequested(payload);
  else if(typeof api.generate==='function')generated=await api.generate('requested',payload);
  else generated={success:false,reports:[],errors:['보고서 생성 API가 연결되지 않았습니다.']};
  workflow=requireWorkflow(workflowId);
  workflow.reports=copy(generated?.reports||generated?.report?[generated.report]:[]);
  workflow.reportErrors=copy(generated?.errors||[]);
  transition(workflow,STATES.REPORTS_DRAFTED,'reports_generated',{count:workflow.reports.length,errors:workflow.reportErrors});
  return transition(requireWorkflow(workflowId),STATES.APPROVAL_PENDING,'report_approval_requested',{count:workflow.reports.length});
}

function approveReports(workflowId,review={}){
  const workflow=requireWorkflow(workflowId);
  if(!workflow.reports?.length)throw new Error('승인할 보고서가 없습니다.');
  workflow.reports=workflow.reports.map(report=>({...report,status:'approved',approvedAt:now(),approvedBy:review.approvedBy||review.reviewer||''}));
  workflow.approval={approved:true,approvedAt:now(),approvedBy:review.approvedBy||review.reviewer||'',comment:review.comment||''};
  return transition(workflow,STATES.APPROVED,'reports_approved',workflow.approval);
}

function publishReports(workflowId){
  const workflow=requireWorkflow(workflowId);
  if(!workflow.approval?.approved)throw new Error('승인된 보고서만 공개할 수 있습니다.');
  workflow.reports=workflow.reports.map(report=>({...report,published:true,publishedAt:now(),visibility:'client'}));
  workflow.publication={published:true,publishedAt:now()};
  emit('mml:clinical-reports-published',{workflowId:workflow.id,reservationId:workflow.reservationId,reports:workflow.reports});
  return transition(workflow,STATES.PUBLISHED,'reports_published',{count:workflow.reports.length});
}

function startCounseling(workflowId,options={}){
  const workflow=requireWorkflow(workflowId);
  const api=engine();
  const session=typeof api.createSession==='function'?api.createSession({reservationId:workflow.reservationId,clientId:workflow.clientId,clientName:workflow.clientName,workflowId:workflow.id,evidence:workflow.evidence,reasoning:workflow.reasoning,...options}):null;
  workflow.counselingSessionId=String(session?.id||session?.sessionId||'');
  if(workflow.counselingSessionId&&typeof api.startSession==='function')api.startSession(workflow.counselingSessionId);
  return transition(workflow,STATES.COUNSELING_ACTIVE,'counseling_started',{sessionId:workflow.counselingSessionId});
}

function finishCounseling(workflowId,options={}){
  const workflow=requireWorkflow(workflowId);
  const api=engine();
  let completed=null;
  if(workflow.counselingSessionId&&typeof api.completeSession==='function')completed=api.completeSession(workflow.counselingSessionId,options);
  workflow.counselingRecord=copy(completed?.chartRecord||completed||null);
  return transition(workflow,STATES.COUNSELING_COMPLETED,'counseling_completed',{sessionId:workflow.counselingSessionId});
}

async function buildCaseConcept(workflowId,options={}){
  const workflow=requireWorkflow(workflowId);
  const api=engine();
  const source={workflowId:workflow.id,reservationId:workflow.reservationId,clientId:workflow.clientId,clientName:workflow.clientName,assessmentResults:workflow.assessments,reports:workflow.reports,counselingRecord:workflow.counselingRecord,evidence:workflow.evidence,reasoning:workflow.reasoning,...options};
  const draft=typeof api.createCaseConceptDraft==='function'?await api.createCaseConceptDraft(source):null;
  workflow.caseConceptDraftId=String(draft?.id||draft?.draftId||'');
  workflow.caseConceptDraft=copy(draft);
  return transition(workflow,STATES.CASE_CONCEPT_DRAFTED,'case_concept_drafted',{draftId:workflow.caseConceptDraftId});
}

async function approveCaseConcept(workflowId,review={}){
  const workflow=requireWorkflow(workflowId);
  const api=engine();
  let approved=null;
  if(workflow.caseConceptDraftId&&typeof api.approveDraft==='function')approved=await api.approveDraft(workflow.caseConceptDraftId,review);
  workflow.caseConceptApproved=copy(approved||{approved:true,approvedAt:now(),review});
  return transition(workflow,STATES.CASE_CONCEPT_APPROVED,'case_concept_approved',{draftId:workflow.caseConceptDraftId});
}

function closeCase(workflowId,meta={}){
  const workflow=requireWorkflow(workflowId);
  workflow.closedAt=now();
  workflow.closeReason=meta.reason||'';
  return transition(workflow,STATES.CLOSED,'case_closed',meta);
}

function inspectWorkflow(workflowId){
  const workflow=requireWorkflow(workflowId);
  return {workflow:copy(workflow),nextState:ORDER[Math.min(ORDER.indexOf(workflow.state)+1,ORDER.length-1)],availableActions:{uploadAssessment:workflow.state!==STATES.CLOSED,analyze:workflow.assessments.length>0,generateReports:Boolean(workflow.assessments.length),approveReports:Boolean(workflow.reports.length),publishReports:Boolean(workflow.approval?.approved),startCounseling:workflow.state===STATES.PUBLISHED||workflow.state===STATES.APPROVED,finishCounseling:workflow.state===STATES.COUNSELING_ACTIVE,buildCaseConcept:workflow.state===STATES.COUNSELING_COMPLETED,closeCase:workflow.state!==STATES.CLOSED}};
}

root.clinicalWorkflow=Object.freeze({
  version:VERSION,STATES,ORDER,
  startWorkflow,uploadAssessment,analyzeWorkflow,generateReports,approveReports,publishReports,startCounseling,finishCounseling,buildCaseConcept,approveCaseConcept,closeCase,
  getWorkflow,findWorkflow,listWorkflows:()=>copy(readAll()),inspectWorkflow,
  resetClinicalWorkflows(){writeAll([]);emit('mml:clinical-workflows-reset',{});return true;}
});
})(window);
