(function(global){
'use strict';

const root=global.MMLClinicalModules=global.MMLClinicalModules||{};
const VERSION='1.0.0';
const EVENT_NAME='mml:clinical-admin-action';
const clone=value=>{try{return JSON.parse(JSON.stringify(value??null));}catch(_){return value;}};
const text=value=>String(value??'').trim();
const now=()=>new Date().toISOString();
function engine(){return global.MMLClinicalEngine||{};}
function emit(action,detail={}){try{global.dispatchEvent(new CustomEvent(EVENT_NAME,{detail:{action,...clone(detail),at:now()}}));}catch(_){ }}

function requireApi(name){const api=engine();if(typeof api[name]!=='function')throw new Error(`${name} API가 연결되지 않았습니다.`);return api[name].bind(api);}

function getAdminCase(source={}){
  const api=engine();
  const filter={reservationId:text(source.reservationId),clientId:text(source.clientId)};
  const snapshot=typeof api.buildCaseSnapshot==='function'?api.buildCaseSnapshot(filter):{};
  const workflow=(snapshot.workflows||[]).slice().sort((a,b)=>String(b.updatedAt||'').localeCompare(String(a.updatedAt||'')))[0]||null;
  return clone({filter,snapshot,workflow,reports:snapshot.reports||[],assessments:snapshot.assessments||[],counselingRecords:snapshot.counselingRecords||[],caseConceptRecords:snapshot.caseConceptRecords||[]});
}

async function createAssessmentReports(record,options={}){
  const api=engine();
  let workflow;
  if(typeof api.runAssessmentToApproval==='function')workflow=await api.runAssessmentToApproval(record,{...options,generate:true});
  else {
    workflow=requireApi('ensureWorkflowForAssessment')(record,{uploadTests:true,force:options.force});
    if(typeof api.analyzeWorkflow==='function')workflow=api.analyzeWorkflow(workflow.id);
    if(typeof api.generateReports==='function')workflow=await api.generateReports(workflow.id,options.reportOptions||{});
  }
  emit('reports-created',{workflowId:workflow?.id,reservationId:workflow?.reservationId});
  return clone(workflow);
}

function approveReport(reportId,review={}){
  const report=requireApi('approveReport')(reportId,review);
  emit('report-approved',{reportId,report});
  return clone(report);
}
function publishReport(reportId,options={}){
  const report=requireApi('publishReport')(reportId,options);
  emit('report-published',{reportId,report});
  return clone(report);
}
function approveAndPublishReport(reportId,review={}){
  approveReport(reportId,review);
  return publishReport(reportId,{html:review.html||review.approvedReportHtml||''});
}
function revokeReport(reportId,review={}){
  const api=engine();
  if(typeof api.unpublishReport==='function')api.unpublishReport(reportId);
  const report=requireApi('revokeApproval')(reportId,review);
  emit('report-revoked',{reportId,report});
  return clone(report);
}
function deleteReport(reportId){
  const result=requireApi('deleteReport')(reportId);
  emit('report-deleted',{reportId});
  return result;
}
function updateReport(reportId,patch={}){
  const report=requireApi('updateReport')(reportId,patch);
  emit('report-updated',{reportId,report});
  return clone(report);
}
function syncElectronicChart(source={}){
  const api=engine();
  const result={};
  if(source.workflowId&&typeof api.syncWorkflowReports==='function')result.reports=api.syncWorkflowReports(source.workflowId);
  if(typeof api.syncCompletedSessions==='function')result.counseling=api.syncCompletedSessions();
  if(source.caseConceptDraft&&typeof api.publishApprovedDraft==='function')result.caseConcept=api.publishApprovedDraft(source.caseConceptDraft);
  emit('chart-synced',{source,result});
  return clone(result);
}
function getReportQueue(filter={}){
  const api=engine();
  const rows=typeof api.getReports==='function'?api.getReports(filter):[];
  return clone(rows.map(report=>({
    id:report.id,reservationId:report.reservationId,clientId:report.clientId,clientName:report.clientName,
    title:report.title,reportType:report.reportType,testType:report.testType||'',
    status:report.approvedForClient?'공개완료':report.approved?'승인완료 · 공개 전':'승인대기',
    canApprove:!report.approved,canPublish:Boolean(report.approved&&!report.approvedForClient),
    canRevoke:Boolean(report.approved),canEdit:!report.approvedForClient,updatedAt:report.updatedAt||''
  })));
}
function inspectAdminBridge(){
  const api=engine();
  const required=['getReports','approveReport','publishReport','updateReport','deleteReport','buildCaseSnapshot'];
  const missing=required.filter(name=>typeof api[name]!=='function');
  return {ready:missing.length===0,version:VERSION,missing};
}

root.adminBridge=Object.freeze({
  version:VERSION,getAdminCase,createAssessmentReports,approveReport,publishReport,approveAndPublishReport,
  revokeReport,deleteReport,updateReport,syncElectronicChart,getReportQueue,inspectAdminBridge
});
})(window);
