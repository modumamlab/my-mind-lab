(function(global){
'use strict';

const modules=global.MMLClinicalModules=global.MMLClinicalModules||{};
const STORAGE_KEY='modumam_case_concept_drafts';
const APPROVED_STORAGE_KEY='modumam_case_concept_records';
const VERSION='1.1.0';

const clone=value=>JSON.parse(JSON.stringify(value??null));
const text=value=>String(value??'').trim();
const array=value=>Array.isArray(value)?value:[];

function readJson(key,fallback){
  try{
    const parsed=JSON.parse(global.localStorage?.getItem(key)||'null');
    return parsed??fallback;
  }catch(_){return fallback;}
}

function readDrafts(){
  const rows=readJson(STORAGE_KEY,[]);
  return Array.isArray(rows)?rows:[];
}

function writeDrafts(rows){
  global.localStorage?.setItem(STORAGE_KEY,JSON.stringify(rows));
  return rows;
}


function readApprovedRecords(){
  const rows=readJson(APPROVED_STORAGE_KEY,[]);
  return Array.isArray(rows)?rows:[];
}

function writeApprovedRecords(rows){
  global.localStorage?.setItem(APPROVED_STORAGE_KEY,JSON.stringify(rows));
  return rows;
}

function toChartRecord(draft={}){
  return {
    id:text(draft.chartRecordId)||`CASE-CONCEPT-RECORD-${text(draft.id)||Date.now()}`,
    type:'case-conceptualization',
    title:'AI 사례개념화',
    reservationId:text(draft.reservationId),
    caseId:text(draft.caseId),
    clientId:text(draft.clientId),
    clientName:text(draft.clientName),
    concept:text(draft.concept),
    hypothesis:text(draft.hypothesis),
    strengths:text(draft.strengths),
    risks:text(draft.risks),
    treatmentGoals:text(draft.treatmentGoals),
    intervention:text(draft.intervention),
    prognosis:text(draft.prognosis),
    status:'승인 완료',
    sourceDraftId:text(draft.id),
    approvedAt:draft.approvedAt||new Date().toISOString(),
    updatedAt:new Date().toISOString(),
    bridgeVersion:VERSION
  };
}

function saveApprovedRecord(record={}){
  const next=toChartRecord(record);
  const rows=readApprovedRecords();
  const index=rows.findIndex(item=>text(item.sourceDraftId)===text(next.sourceDraftId)||text(item.id)===text(next.id));
  if(index<0)rows.unshift(next);else rows[index]={...rows[index],...next};
  writeApprovedRecords(rows);
  return clone(next);
}

function connectToCaseRepository(record){
  const repository=global.MMLCaseRepository;
  if(!repository)return {connected:false,reason:'repository-unavailable'};
  try{
    if(typeof repository.addRecord==='function'){
      repository.addRecord(record.caseId||record.reservationId,record);
      return {connected:true,method:'addRecord'};
    }
    if(typeof repository.appendRecord==='function'){
      repository.appendRecord(record.caseId||record.reservationId,record);
      return {connected:true,method:'appendRecord'};
    }
    if(typeof repository.update==='function'&&record.caseId){
      const current=typeof repository.get==='function'?(repository.get(record.caseId)||{}):{};
      const concepts=array(current.caseConcepts);
      const index=concepts.findIndex(item=>text(item.sourceDraftId)===text(record.sourceDraftId));
      if(index<0)concepts.unshift(record);else concepts[index]=record;
      repository.update(record.caseId,{caseConcepts:concepts,latestCaseConcept:record});
      return {connected:true,method:'update'};
    }
  }catch(error){
    console.warn('[MML Case Concept Bridge] 전자차트 연결 실패',error);
    return {connected:false,reason:error?.message||'repository-error'};
  }
  return {connected:false,reason:'unsupported-repository-api'};
}

function refreshWorkflow(record){
  const workflow=global.MMLWorkflowEngine;
  if(!workflow)return {refreshed:false,reason:'workflow-unavailable'};
  try{
    if(typeof workflow.recalculateCase==='function'){
      workflow.recalculateCase(record.caseId||record.reservationId);
      return {refreshed:true,method:'recalculateCase'};
    }
    if(typeof workflow.refresh==='function'){
      workflow.refresh(record.caseId||record.reservationId);
      return {refreshed:true,method:'refresh'};
    }
  }catch(error){
    console.warn('[MML Case Concept Bridge] 워크플로우 갱신 실패',error);
    return {refreshed:false,reason:error?.message||'workflow-error'};
  }
  return {refreshed:false,reason:'unsupported-workflow-api'};
}

function publishApprovedDraft(draft={}){
  if(text(draft.status)!=='승인 완료')return {success:false,message:'승인 완료된 사례개념화만 전자차트에 등록할 수 있습니다.'};
  const record=saveApprovedRecord(draft);
  const repository=connectToCaseRepository(record);
  const workflow=refreshWorkflow(record);
  try{
    global.dispatchEvent(new CustomEvent('mml:case-concept-chart-saved',{detail:{record:clone(record),repository,workflow}}));
  }catch(_){ }
  return {success:true,record,repository,workflow};
}

function collectCounselingRecords(filters={}){
  const api=modules.counselingCaseBridge||{};
  const records=typeof api.readRecords==='function'
    ? api.readRecords()
    : readJson('modumam_ai_result_counseling_records',[]);
  return array(records).filter(item=>{
    if(filters.reservationId&&text(item.reservationId)!==text(filters.reservationId))return false;
    if(filters.clientId&&text(item.clientId)!==text(filters.clientId))return false;
    return true;
  });
}

function collectAssessments(filters={}){
  const sources=[
    global.MMLClinicalAssessmentStore?.list?.(),
    global.MMLAssessmentStore?.list?.(),
    readJson('modumam_clinical_assessments',[]),
    readJson('modumam_assessment_results',[])
  ];
  const rows=sources.find(Array.isArray)||[];
  return rows.filter(item=>{
    if(filters.reservationId&&text(item.reservationId||item.bookingId)!==text(filters.reservationId))return false;
    if(filters.clientId&&text(item.clientId)!==text(filters.clientId))return false;
    return true;
  });
}

function collectReports(filters={}){
  const sources=[
    global.MMLReportStore?.list?.(),
    readJson('modumam_reports',[]),
    readJson('modumam_assessment_reports',[])
  ];
  const rows=sources.find(Array.isArray)||[];
  return rows.filter(item=>{
    if(filters.reservationId&&text(item.reservationId||item.bookingId)!==text(filters.reservationId))return false;
    if(filters.clientId&&text(item.clientId)!==text(filters.clientId))return false;
    return true;
  });
}

function collectChart(filters={}){
  const repository=global.MMLCaseRepository;
  if(repository?.getByReservationId&&filters.reservationId){
    try{return repository.getByReservationId(filters.reservationId)||{};}catch(_){ }
  }
  if(repository?.get&&filters.caseId){
    try{return repository.get(filters.caseId)||{};}catch(_){ }
  }
  return {};
}

function buildCaseConceptSnapshot(source={}){
  const filters={
    reservationId:text(source.reservationId||source.bookingId),
    clientId:text(source.clientId),
    caseId:text(source.caseId)
  };
  const chart=source.chart||collectChart(filters);
  const assessments=array(source.assessments).length?source.assessments:collectAssessments(filters);
  const reports=array(source.reports).length?source.reports:collectReports(filters);
  const sessions=array(source.sessions).length?source.sessions:collectCounselingRecords(filters);

  const clinical=modules.reasoning||{};
  let evidence=source.evidence||null;
  let reasoning=source.reasoning||null;
  try{
    if(!evidence&&typeof modules.evidence?.buildEvidence==='function'){
      evidence=modules.evidence.buildEvidence(assessments);
    }
    if(!reasoning&&evidence&&typeof clinical.buildClinicalReasoning==='function'){
      reasoning=clinical.buildClinicalReasoning(evidence);
    }
  }catch(error){
    console.warn('[MML Case Concept Bridge] 임상 근거 조립 실패',error);
  }

  return {
    client:{
      id:filters.clientId||text(chart.clientId),
      name:text(source.clientName||chart.clientName||chart.name),
      gender:text(source.gender||chart.gender),
      age:source.age??chart.age??'',
      program:text(source.program||chart.program)
    },
    reservationId:filters.reservationId,
    caseId:filters.caseId||text(chart.id||chart.caseId),
    chart:clone(chart),
    sessions:clone(sessions),
    assessments:clone(assessments),
    reports:clone(reports),
    evidence:clone(evidence),
    reasoning:clone(reasoning),
    generatedAt:new Date().toISOString(),
    bridgeVersion:VERSION
  };
}

function validateSnapshot(snapshot={}){
  const errors=[];
  const warnings=[];
  if(!snapshot.client?.id&&!snapshot.reservationId)errors.push('내담자 또는 예약 식별정보가 없습니다.');
  if(!array(snapshot.assessments).length)warnings.push('연결된 심리검사 결과가 없습니다.');
  if(!array(snapshot.reports).length)warnings.push('연결된 심리검사 보고서가 없습니다.');
  if(!array(snapshot.sessions).length)warnings.push('연결된 상담기록이 없습니다.');
  return {valid:errors.length===0,errors,warnings};
}

function saveDraft(draft={}){
  const now=new Date().toISOString();
  const next={
    ...draft,
    id:text(draft.id)||`CASE-CONCEPT-${Date.now()}-${Math.random().toString(36).slice(2,8)}`,
    status:text(draft.status)||'상담자 검토 필요',
    counselorReviewRequired:draft.counselorReviewRequired!==false,
    createdAt:draft.createdAt||now,
    updatedAt:now,
    bridgeVersion:VERSION
  };
  const rows=readDrafts();
  const index=rows.findIndex(item=>text(item.id)===text(next.id)||(
    next.reservationId&&text(item.reservationId)===text(next.reservationId)&&item.status!=='승인 완료'
  ));
  if(index<0)rows.unshift(next);else rows[index]={...rows[index],...next};
  writeDrafts(rows);
  return clone(next);
}

async function createCaseConceptDraft(source={}){
  const snapshot=buildCaseConceptSnapshot(source);
  const validation=validateSnapshot(snapshot);
  if(!validation.valid)return {success:false,...validation,snapshot};

  const engine=global.MMLCaseConceptEngine||global.MMLCaseEngine||{};
  const create=engine.createCaseConcept||global.createCaseConcept;
  let result={};
  if(typeof create==='function'){
    try{
      result=await create(snapshot.client,snapshot.chart,snapshot.sessions,snapshot.assessments,snapshot.reports);
      if(result?.success===false)return {...result,validation,snapshot};
    }catch(error){
      return {success:false,message:error?.message||'사례개념화 생성 실패',error,validation,snapshot};
    }
  }else{
    result={
      success:true,
      concept:'',hypothesis:'',strengths:'',risks:'',treatmentGoals:'',intervention:'',prognosis:'',
      message:'사례개념화 AI 엔진이 연결되지 않아 입력자료 초안만 저장했습니다.'
    };
  }

  const draft=saveDraft({
    reservationId:snapshot.reservationId,
    caseId:snapshot.caseId,
    clientId:snapshot.client.id,
    clientName:snapshot.client.name,
    snapshot,
    concept:text(result.concept),
    hypothesis:text(result.hypothesis),
    strengths:text(result.strengths),
    risks:text(result.risks),
    treatmentGoals:text(result.treatmentGoals),
    intervention:text(result.intervention),
    prognosis:text(result.prognosis),
    status:'상담자 검토 필요'
  });

  try{global.dispatchEvent(new CustomEvent('mml:case-concept-draft-created',{detail:{draft:clone(draft),validation}}));}catch(_){ }
  return {success:true,draft,validation,message:result.message||''};
}

function updateDraft(id,patch={}){
  const rows=readDrafts();
  const index=rows.findIndex(item=>text(item.id)===text(id));
  if(index<0)return null;
  rows[index]={...rows[index],...clone(patch),id:rows[index].id,updatedAt:new Date().toISOString()};
  writeDrafts(rows);
  return clone(rows[index]);
}

function approveDraft(id,review={}){
  const approved=updateDraft(id,{
    ...review,
    status:'승인 완료',
    counselorReviewRequired:false,
    approvedAt:new Date().toISOString()
  });
  if(!approved)return null;
  const publication=publishApprovedDraft(approved);
  const finalDraft=updateDraft(id,{
    chartRecordId:publication.record?.id||'',
    chartLinked:Boolean(publication.repository?.connected),
    workflowRefreshed:Boolean(publication.workflow?.refreshed),
    publishedAt:new Date().toISOString()
  })||approved;
  try{global.dispatchEvent(new CustomEvent('mml:case-concept-approved',{detail:{draft:clone(finalDraft),publication}}));}catch(_){ }
  return finalDraft;
}

modules.caseConceptBridge=Object.freeze({
  VERSION,STORAGE_KEY,APPROVED_STORAGE_KEY,
  buildCaseConceptSnapshot,validateSnapshot,createCaseConceptDraft,
  saveDraft,readDrafts,updateDraft,approveDraft,
  readApprovedRecords,toChartRecord,saveApprovedRecord,publishApprovedDraft
});
})(window);
