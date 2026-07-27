(function(global){
'use strict';

const root=global.MMLClinicalModules=global.MMLClinicalModules||{};
const VERSION='1.0.0';
const SYNC_KEY='modumam_clinical_app_bridge_sync_v1';

const clone=value=>{try{return JSON.parse(JSON.stringify(value??null));}catch(_){return value;}};
const text=value=>String(value??'').trim();
const now=()=>new Date().toISOString();

function engine(){return global.MMLClinicalEngine||{};}
function reportStore(){return global.MMLReportStore||null;}
function assessmentStore(){return global.MMLClinicalAssessmentStore||null;}

function readSyncMap(){
  try{return JSON.parse(global.localStorage?.getItem(SYNC_KEY)||'{}')||{};}catch(_){return {};}
}
function writeSyncMap(map){
  global.localStorage?.setItem(SYNC_KEY,JSON.stringify(map||{}));
  return map;
}
function markSynced(workflowId,meta={}){
  const map=readSyncMap();
  map[String(workflowId)]={...(map[String(workflowId)]||{}),...clone(meta),updatedAt:now()};
  writeSyncMap(map);
  return map[String(workflowId)];
}

function emit(name,detail){
  try{global.dispatchEvent(new CustomEvent(name,{detail:clone(detail)}));}catch(_){ }
}

function normalizeAssessment(record={}){
  const tests=Array.isArray(record.tests)?record.tests:[];
  return {
    reservationId:text(record.reservationId||record.reservation?.id),
    clientId:text(record.clientId||record.reservation?.clientId),
    clientName:text(record.clientName||record.reservation?.name),
    requestId:text(record.requestId),
    tests:tests.map((item,index)=>({
      ...clone(item),
      id:item.id||item.analysisId||`${text(item.testCode||item.testName)||'test'}_${index+1}`,
      testName:text(item.testName||item.testType||item.name),
      testCode:text(item.testCode||item.code||item.testType)
    }))
  };
}

function ensureWorkflowForAssessment(record,options={}){
  const api=engine();
  if(typeof api.startWorkflow!=='function')throw new Error('Clinical Workflow가 연결되지 않았습니다.');
  const source=normalizeAssessment(record);
  if(!source.reservationId)throw new Error('예약번호가 없어 임상 워크플로우를 연결할 수 없습니다.');
  let workflow=typeof api.findWorkflow==='function'?api.findWorkflow({reservationId:source.reservationId,clientId:source.clientId}):null;
  if(!workflow)workflow=api.startWorkflow(source);
  if(options.uploadTests!==false&&typeof api.uploadAssessment==='function'){
    const existingKeys=new Set((workflow.assessments||[]).map(item=>text(item.id||item.testCode||item.testName)));
    source.tests.forEach(test=>{
      const key=text(test.id||test.testCode||test.testName);
      if(!existingKeys.has(key)||options.force===true){
        workflow=api.uploadAssessment(workflow.id,test);
        existingKeys.add(key);
      }
    });
  }
  markSynced(workflow.id,{reservationId:source.reservationId,assessmentLinked:true});
  emit('mml:clinical-app-workflow-linked',{workflowId:workflow.id,reservationId:source.reservationId});
  return workflow;
}

function reportTypeOf(report={}){
  const type=text(report.reportType||report.type).toLowerCase();
  if(type.includes('individual')||report.individualAssessmentReport)return 'individualReport';
  if(type.includes('clinician')||type.includes('counselor')||report.integratedAssessmentReport)return 'counselorComprehensiveReport';
  return 'comprehensiveReport';
}

function workflowReportToStore(workflow,report,index){
  const approved=Boolean(report.approved||report.status==='approved'||workflow.approval?.approved);
  const published=Boolean(report.published||workflow.publication?.published);
  return {
    ...clone(report),
    id:report.id||`${workflow.id}_report_${index+1}`,
    workflowId:workflow.id,
    reservationId:workflow.reservationId,
    clientId:workflow.clientId,
    clientName:workflow.clientName,
    requestId:workflow.requestId,
    reportType:reportTypeOf(report),
    title:text(report.title)||'심리검사 보고서',
    tests:Array.isArray(report.tests)?report.tests:(Array.isArray(report.selectedTests)?report.selectedTests:[]),
    approved,
    reviewed:approved,
    approvedForClient:published,
    published,
    reviewStatus:approved?'approved':'draft',
    status:published?'승인완료 · 열람가능':approved?'상담자 승인 완료 · 공개 전':'저장완료 · 승인대기',
    source:'clinical-workflow',
    updatedAt:now()
  };
}

function syncWorkflowReports(workflowOrId,options={}){
  const api=engine();
  const store=reportStore();
  if(!store)throw new Error('MMLReportStore가 연결되지 않았습니다.');
  const workflow=typeof workflowOrId==='string'
    ? (typeof api.getWorkflow==='function'?api.getWorkflow(workflowOrId):null)
    : workflowOrId;
  if(!workflow)throw new Error('동기화할 임상 워크플로우를 찾을 수 없습니다.');
  const reports=(Array.isArray(workflow.reports)?workflow.reports:[]).map((report,index)=>workflowReportToStore(workflow,report,index));
  if(!reports.length)return {workflow:clone(workflow),reports:[],saved:store.loadAll?.()||[]};
  const current=store.loadAll();
  const saved=typeof store.replaceReservationReports==='function'
    ? store.saveAll(store.replaceReservationReports(current,workflow.reservationId,reports))
    : reports.reduce((rows,report)=>store.upsert(rows,report),current);
  if(typeof store.saveAll!=='function'&&typeof store.commit==='function')store.commit(saved);
  markSynced(workflow.id,{reportsLinked:true,reportCount:reports.length,published:Boolean(workflow.publication?.published)});
  emit('mml:clinical-app-reports-synced',{workflowId:workflow.id,reservationId:workflow.reservationId,reports});
  return {workflow:clone(workflow),reports:clone(reports),saved:clone(saved)};
}

function getClientApprovedReports(query={}){
  const store=reportStore();
  if(!store)return [];
  let rows=typeof store.getApprovedReports==='function'?store.getApprovedReports():store.loadAll().filter(item=>item.approvedForClient===true);
  if(query.clientId)rows=rows.filter(item=>text(item.clientId)===text(query.clientId));
  if(query.reservationId)rows=rows.filter(item=>text(item.reservationId)===text(query.reservationId));
  if(query.clientName)rows=rows.filter(item=>text(item.clientName)===text(query.clientName));
  return clone(rows);
}

async function runAssessmentToApproval(record,options={}){
  const api=engine();
  let workflow=ensureWorkflowForAssessment(record,{uploadTests:true,force:options.force});
  if(options.analyze!==false&&typeof api.analyzeWorkflow==='function')workflow=api.analyzeWorkflow(workflow.id);
  if(options.generate!==false&&typeof api.generateReports==='function')workflow=await api.generateReports(workflow.id,options.reportOptions||{});
  syncWorkflowReports(workflow.id);
  return api.getWorkflow?.(workflow.id)||workflow;
}

function approveAndPublish(workflowId,review={}){
  const api=engine();
  if(typeof api.approveReports!=='function'||typeof api.publishReports!=='function')throw new Error('보고서 승인·공개 API가 연결되지 않았습니다.');
  api.approveReports(workflowId,review);
  const workflow=api.publishReports(workflowId);
  syncWorkflowReports(workflow);
  emit('mml:clinical-app-published',{workflowId,reservationId:workflow.reservationId});
  return workflow;
}

function syncAssessmentStoreRecord(reservationId,options={}){
  const store=assessmentStore();
  if(!store||typeof store.getRecord!=='function')throw new Error('MMLClinicalAssessmentStore가 연결되지 않았습니다.');
  const record=store.getRecord(reservationId);
  if(!record)throw new Error('심리평가센터 저장자료를 찾을 수 없습니다.');
  return ensureWorkflowForAssessment(record,options);
}

function syncAllAssessmentRecords(options={}){
  const store=assessmentStore();
  if(!store||typeof store.read!=='function')return [];
  return store.read().map(record=>{
    try{return ensureWorkflowForAssessment(record,options);}catch(error){return {error:error.message,reservationId:record?.reservationId};}
  });
}

function handleAssessmentSaved(event){
  try{if(event?.detail)ensureWorkflowForAssessment(event.detail,{uploadTests:true});}
  catch(error){console.warn('[MML Clinical App Bridge] 평가자료 자동 연결 실패',error);}
}
function handleWorkflowUpdated(event){
  const workflow=event?.detail;
  if(!workflow||!Array.isArray(workflow.reports)||!workflow.reports.length)return;
  try{syncWorkflowReports(workflow);}catch(error){console.warn('[MML Clinical App Bridge] 보고서 자동 동기화 실패',error);}
}
function bind(){
  global.removeEventListener?.('mml:assessment-saved',handleAssessmentSaved);
  global.removeEventListener?.('mml:clinical-workflow-updated',handleWorkflowUpdated);
  global.addEventListener?.('mml:assessment-saved',handleAssessmentSaved);
  global.addEventListener?.('mml:clinical-workflow-updated',handleWorkflowUpdated);
  return true;
}

root.clinicalAppBridge=Object.freeze({
  version:VERSION,
  ensureWorkflowForAssessment,
  syncAssessmentStoreRecord,
  syncAllAssessmentRecords,
  syncWorkflowReports,
  getClientApprovedReports,
  runAssessmentToApproval,
  approveAndPublish,
  readSyncMap:()=>clone(readSyncMap()),
  bind
});

bind();
try{syncAllAssessmentRecords({uploadTests:true});}catch(_){ }
})(window);
