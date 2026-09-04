(function(global){
'use strict';

const root=global.MMLClinicalModules=global.MMLClinicalModules||{};
const VERSION='1.0.0';
const EVENT_NAME='mml:clinical-homepage-view-changed';
const clone=value=>{try{return JSON.parse(JSON.stringify(value??null));}catch(_){return value;}};
const text=value=>String(value??'').trim();
const now=()=>new Date().toISOString();

function engine(){return global.MMLClinicalEngine||{};}
function reportService(){return root.reportService||engine();}
function clinicalStore(){return root.clinicalStore||engine();}
function emit(action,detail={}){try{global.dispatchEvent(new CustomEvent(EVENT_NAME,{detail:{action,...clone(detail),at:now()}}));}catch(_){ }}

function normalizeIdentity(source={}){
  return {
    clientId:text(source.clientId||source.userId||source.memberId),
    reservationId:text(source.reservationId||source.bookingId||source.requestId),
    clientName:text(source.clientName||source.name)
  };
}

function approvedReports(source={}){
  const query=normalizeIdentity(source);
  const api=reportService();
  let rows=[];
  if(typeof api.getClientApprovedReports==='function')rows=api.getClientApprovedReports(query);
  else if(typeof api.getReports==='function')rows=api.getReports({...query,published:true});
  return clone((rows||[]).filter(item=>item&&!item.archived&&Boolean(item.approvedForClient||item.published)));
}

function reportLabel(report={}){
  const type=text(report.reportType||report.type);
  if(type==='individualReport')return `${text(report.testType||report.testName)||'개별 심리검사'} 보고서`;
  if(type==='parentReport')return '부모·보호자용 심리검사 보고서';
  if(type==='counselorComprehensiveReport')return '상담자용 종합 심리평가보고서';
  return '심리검사 결과보고서';
}

function toReportCard(report={}){
  return {
    id:report.id,
    reservationId:report.reservationId,
    reportType:report.reportType,
    testType:report.testType||'',
    title:text(report.title)||reportLabel(report),
    label:reportLabel(report),
    status:'열람 가능',
    approved:true,
    published:true,
    updatedAt:report.updatedAt||report.approvedAt||report.createdAt||'',
    action:{type:'open-report',reportId:report.id,label:'보고서 보기'},
    report:clone(report)
  };
}

function getMindRecordCards(source={}){
  return approvedReports(source).map(toReportCard);
}

function getReportRequestStatus(source={}){
  const identity=normalizeIdentity(source);
  const store=clinicalStore();
  const snapshot=typeof store.buildCaseSnapshot==='function'?store.buildCaseSnapshot(identity):null;
  const workflows=snapshot?.workflows||[];
  const reports=snapshot?.reports||[];
  const latest=workflows.slice().sort((a,b)=>String(b.updatedAt||'').localeCompare(String(a.updatedAt||'')))[0]||null;
  const published=approvedReports(identity);
  return {
    identity,
    requested:Boolean(latest||reports.length),
    workflowId:latest?.id||'',
    stage:latest?.stage||latest?.status||'',
    generated:reports.length>0,
    approved:reports.some(item=>Boolean(item.approved)),
    published:published.length>0,
    visibleReportCount:published.length,
    message:published.length?'승인된 보고서를 열람할 수 있습니다.':reports.length?'보고서 검토가 진행 중입니다.':latest?'검사자료를 확인하고 있습니다.':'신청된 보고서가 없습니다.'
  };
}

function getCounselingEntryState(source={}){
  const identity=normalizeIdentity(source);
  const store=clinicalStore();
  const snapshot=typeof store.buildCaseSnapshot==='function'?store.buildCaseSnapshot(identity):{};
  const sessions=snapshot.counselingSessions||[];
  const completed=sessions.find(item=>item.status==='completed'||item.completedAt);
  const active=sessions.find(item=>item.status==='active'||item.status==='started');
  const reports=approvedReports(identity);
  const reservation=snapshot.reservation||source.reservation||{};
  const method=text(reservation.counselingMethod||source.counselingMethod).toLowerCase();
  const aiSelected=!method||method.includes('ai');
  const enabled=aiSelected&&reports.length>0&&!completed;
  return {
    enabled,
    reason:completed?'AI 상담이 완료되었습니다.':!aiSelected?'AI 상담 예약이 아닙니다.':!reports.length?'승인된 검사보고서가 있어야 입장할 수 있습니다.':'입장할 수 있습니다.',
    activeSessionId:active?.id||active?.sessionId||'',
    completed:Boolean(completed),
    approvedReportCount:reports.length
  };
}

function buildHomepageView(source={}){
  const identity=normalizeIdentity(source);
  const view={
    identity,
    reportRequest:getReportRequestStatus(identity),
    reportCards:getMindRecordCards(identity),
    counseling:getCounselingEntryState({...source,...identity}),
    generatedAt:now()
  };
  emit('view-built',{identity,view});
  return view;
}

function openReport(reportId){
  const api=reportService();
  const report=typeof api.getReport==='function'?api.getReport(reportId):null;
  if(!report)throw new Error('보고서를 찾을 수 없습니다.');
  if(!report.approvedForClient&&!report.published)throw new Error('승인·공개된 보고서만 열람할 수 있습니다.');
  emit('report-opened',{reportId});
  return clone(report);
}

function bind(){
  const refresh=event=>emit('data-updated',{sourceEvent:event?.type});
  ['mml:unified-report-service-changed','mml:clinical-store-changed','mml:clinical-app-published'].forEach(name=>{
    global.removeEventListener?.(name,refresh);
    global.addEventListener?.(name,refresh);
  });
  return true;
}

root.homepageBridge=Object.freeze({
  version:VERSION,normalizeIdentity,approvedReports,getMindRecordCards,getReportRequestStatus,
  getCounselingEntryState,buildHomepageView,openReport,bind
});
bind();
})(window);
