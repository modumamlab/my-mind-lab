(function(global){
'use strict';

const root=global.MMLClinicalModules=global.MMLClinicalModules||{};
const VERSION='1.0.0';
const SERVICE_EVENT='mml:unified-report-service-changed';

const clone=value=>{try{return JSON.parse(JSON.stringify(value??null));}catch(_){return value;}};
const text=value=>String(value??'').trim();
const now=()=>new Date().toISOString();

function store(){
  const value=global.MMLReportStore;
  if(!value)throw new Error('MMLReportStore가 연결되지 않았습니다. report-store.js를 먼저 불러오세요.');
  return value;
}

function engine(){return global.MMLClinicalEngine||{};}

function emit(action,report,extra={}){
  try{
    global.dispatchEvent(new CustomEvent(SERVICE_EVENT,{detail:{action,report:clone(report),...clone(extra),at:now()}}));
  }catch(_){ }
}

function reportTypeOf(input={}){
  const raw=text(input.reportType||input.type||input.kind);
  if(raw)return raw;
  if(input.individualAssessmentReport)return 'individualReport';
  if(input.integratedAssessmentReport)return 'counselorComprehensiveReport';
  if(input.parentReport)return 'parentReport';
  if(input.assessmentReport||input.comprehensiveReport)return 'comprehensiveReport';
  return 'comprehensiveReport';
}

function normalizePayload(input={},defaults={}){
  const type=reportTypeOf({...defaults,...input});
  const tests=Array.isArray(input.tests)?input.tests:Array.isArray(input.selectedTests)?input.selectedTests:[];
  const status=text(input.status)||'초안';
  return {
    ...defaults,
    ...input,
    reportType:type,
    tests:tests.filter(Boolean),
    selectedTests:(Array.isArray(input.selectedTests)?input.selectedTests:tests).filter(Boolean),
    title:text(input.title)||titleFor(type,input.testType),
    status,
    reviewStatus:text(input.reviewStatus)||'draft',
    reviewed:Boolean(input.reviewed),
    approved:Boolean(input.approved),
    approvedForClient:Boolean(input.approvedForClient),
    createdAt:input.createdAt||now(),
    updatedAt:now()
  };
}

function titleFor(type,testType=''){
  if(type==='individualReport')return `${text(testType)||'개별 심리검사'} 보고서`;
  if(type==='counselorComprehensiveReport')return '상담자용 종합 심리평가보고서';
  if(type==='parentReport')return '부모·보호자용 심리검사 보고서';
  return '심리검사 종합보고서';
}

function getReport(reportId){return store().getById(reportId)||null;}
function getReports(filter={}){
  let rows=store().loadAll();
  if(filter.reservationId!==undefined)rows=rows.filter(item=>String(item.reservationId)===String(filter.reservationId));
  if(filter.clientId!==undefined)rows=rows.filter(item=>String(item.clientId)===String(filter.clientId));
  if(filter.reportType)rows=rows.filter(item=>item.reportType===filter.reportType);
  if(filter.testType)rows=rows.filter(item=>text(item.testType)===text(filter.testType));
  if(filter.status)rows=rows.filter(item=>text(item.status)===text(filter.status));
  if(filter.approved!==undefined)rows=rows.filter(item=>Boolean(item.approved)===Boolean(filter.approved));
  if(filter.published!==undefined)rows=rows.filter(item=>Boolean(item.approvedForClient)===Boolean(filter.published));
  return clone(rows);
}

function persist(report,action='saved'){
  const savedRows=store().saveReport(normalizePayload(report));
  const saved=savedRows.find(item=>String(item.id)===String(report.id))||savedRows[0]||null;
  emit(action,saved);
  return clone(saved);
}

async function createWithGenerator(kind,source={},options={}){
  const api=engine();
  const payload={...clone(source),...clone(options),reportType:kind};
  let generated=null;

  if(kind==='individualReport'){
    if(typeof api.generateIndividualReport==='function')generated=await api.generateIndividualReport(payload);
    else if(typeof api.createIndividualReport==='function'&&api.createIndividualReport!==createIndividualReport)generated=await api.createIndividualReport(payload);
    else if(typeof api.generate==='function')generated=await api.generate('individual',payload);
  }else if(kind==='comprehensiveReport'){
    if(typeof api.generateComprehensiveReport==='function')generated=await api.generateComprehensiveReport(payload);
    else if(typeof api.createComprehensiveReport==='function'&&api.createComprehensiveReport!==createComprehensiveReport)generated=await api.createComprehensiveReport(payload);
    else if(typeof api.generate==='function')generated=await api.generate('comprehensive',payload);
  }else if(kind==='counselorComprehensiveReport'){
    if(typeof api.generateClinicianReport==='function')generated=await api.generateClinicianReport(payload);
    else if(typeof api.buildClinicianReport==='function')generated=await api.buildClinicianReport(payload);
  }else if(kind==='parentReport'){
    if(typeof api.generateParentReport==='function')generated=await api.generateParentReport(payload);
    else if(typeof api.buildParentReport==='function')generated=await api.buildParentReport(payload);
  }

  const report=generated?.report||generated?.data||generated||{};
  return normalizePayload({
    ...payload,
    ...report,
    reportType:kind,
    id:report.id||payload.id||`REPORT-${Date.now()}-${Math.random().toString(36).slice(2,8)}`,
    status:'초안',reviewStatus:'draft',approved:false,approvedForClient:false
  });
}

async function createIndividualReport(source={},options={}){
  const report=await createWithGenerator('individualReport',source,options);
  return persist(report,'individual-created');
}

async function createComprehensiveReport(source={},options={}){
  const report=await createWithGenerator('comprehensiveReport',source,options);
  return persist(report,'comprehensive-created');
}

async function createClinicianReport(source={},options={}){
  const report=await createWithGenerator('counselorComprehensiveReport',source,options);
  return persist(report,'clinician-created');
}

async function createParentReport(source={},options={}){
  const report=await createWithGenerator('parentReport',source,options);
  return persist(report,'parent-created');
}

function updateReport(reportId,patch={}){
  const rows=store().updateReport(reportId,current=>normalizePayload({...current,...clone(patch),id:current.id,updatedAt:now()}));
  const report=rows.find(item=>String(item.id)===String(reportId))||null;
  emit('updated',report);
  return clone(report);
}

function approveReport(reportId,review={}){
  const html=String(review.html||review.approvedReportHtml||'');
  const rows=store().approveReport(reportId,true,{approvedBy:review.approvedBy||review.reviewer||'관리자',html});
  const report=rows.find(item=>String(item.id)===String(reportId))||null;
  emit('approved',report,{review});
  return clone(report);
}

function revokeApproval(reportId,review={}){
  const rows=store().approveReport(reportId,false,{approvedBy:review.approvedBy||review.reviewer||''});
  const report=rows.find(item=>String(item.id)===String(reportId))||null;
  emit('approval-revoked',report,{review});
  return clone(report);
}

function publishReport(reportId,options={}){
  const current=getReport(reportId);
  if(!current)throw new Error('공개할 보고서를 찾지 못했습니다.');
  if(!current.approved&&!options.force)throw new Error('승인된 보고서만 공개할 수 있습니다.');
  const rows=store().saveAll(store().setPublication(store().loadAll(),reportId,true,String(options.html||current.approvedReportHtml||'')));
  const report=rows.find(item=>String(item.id)===String(reportId))||null;
  emit('published',report);
  return clone(report);
}

function unpublishReport(reportId){
  const rows=store().saveAll(store().setPublication(store().loadAll(),reportId,false,''));
  const report=rows.find(item=>String(item.id)===String(reportId))||null;
  emit('unpublished',report);
  return clone(report);
}

function archiveReport(reportId,meta={}){
  const report=updateReport(reportId,{archived:true,archivedAt:now(),archivedBy:meta.archivedBy||meta.actor||'',archiveReason:meta.reason||'',status:'보관'});
  emit('archived',report,{meta});
  return report;
}

function restoreReport(reportId){
  const report=updateReport(reportId,{archived:false,archivedAt:'',archivedBy:'',archiveReason:'',status:'초안'});
  emit('restored',report);
  return report;
}

function deleteReport(reportId){
  const current=getReport(reportId);
  store().deleteReport(reportId);
  emit('deleted',current);
  return true;
}

function getClientApprovedReports(filter={}){
  return getReports({...filter,published:true}).filter(item=>!item.archived);
}

function replaceReservationReports(reservationId,reports=[]){
  const normalized=(Array.isArray(reports)?reports:[]).map(item=>normalizePayload({...item,reservationId:item.reservationId||reservationId}));
  const rows=store().saveAll(store().replaceReservationReports(store().loadAll(),reservationId,normalized));
  emit('reservation-replaced',null,{reservationId,count:normalized.length});
  return clone(rows.filter(item=>String(item.reservationId)===String(reservationId)));
}

function inspectReportService(){
  const api=store();
  const required=['loadAll','saveReport','updateReport','deleteReport','approveReport','setPublication'];
  const missing=required.filter(name=>typeof api[name]!=='function');
  return {ready:missing.length===0,version:VERSION,missing,total:getReports().length,published:getReports({published:true}).length};
}

root.reportService=Object.freeze({
  version:VERSION,
  createIndividualReport,createComprehensiveReport,createClinicianReport,createParentReport,
  approveReport,revokeApproval,publishReport,unpublishReport,archiveReport,restoreReport,deleteReport,
  updateReport,getReport,getReports,getClientApprovedReports,replaceReservationReports,inspectReportService
});
})(window);
