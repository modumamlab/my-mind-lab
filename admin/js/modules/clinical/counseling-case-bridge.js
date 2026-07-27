(function(global){
'use strict';

const modules=global.MMLClinicalModules=global.MMLClinicalModules||{};
const STORAGE_KEY='modumam_ai_result_counseling_records';
const VERSION='1.0.0';
let bound=false;

const clone=value=>JSON.parse(JSON.stringify(value??null));
const text=value=>String(value??'').trim();

function readRecords(){
  try{
    const parsed=JSON.parse(global.localStorage?.getItem(STORAGE_KEY)||'[]');
    return Array.isArray(parsed)?parsed:[];
  }catch(error){
    console.warn('[MML Counseling Bridge] 상담기록 읽기 실패',error);
    return [];
  }
}

function normalizeRecord(record={}){
  return {
    ...record,
    id:text(record.id)||`AI-COUNSELING-RECORD-${Date.now()}-${Math.random().toString(36).slice(2,8)}`,
    reservationId:text(record.reservationId||record.bookingId),
    clientId:text(record.clientId),
    clientName:text(record.clientName||record.name),
    type:text(record.type)||'ai-result-counseling',
    method:text(record.method)||'AI 상담(비대면)',
    status:text(record.status)||'상담자 검토 필요',
    summary:text(record.summary),
    messages:Array.isArray(record.messages)?clone(record.messages):[],
    sessionId:text(record.sessionId),
    counselorReviewRequired:record.counselorReviewRequired!==false,
    createdAt:record.createdAt||new Date().toISOString(),
    updatedAt:new Date().toISOString(),
    bridgeVersion:VERSION
  };
}

function saveRecord(record){
  const next=normalizeRecord(record);
  const rows=readRecords();
  const index=rows.findIndex(item=>String(item.id)===String(next.id)||(
    next.sessionId&&String(item.sessionId)===String(next.sessionId)
  ));
  if(index<0)rows.unshift(next); else rows[index]={...rows[index],...next};
  global.localStorage?.setItem(STORAGE_KEY,JSON.stringify(rows));
  return clone(next);
}

function connectCase(record){
  const repository=global.MMLCaseRepository;
  if(!repository?.upsertFrom)return null;
  try{
    return repository.upsertFrom({
      ...record,
      id:record.id,
      recordId:record.id,
      counselingMethod:record.method,
      content:record.summary,
      sessionDate:record.endedAt||record.updatedAt||record.createdAt,
      caseId:record.caseId||''
    },'counseling');
  }catch(error){
    console.warn('[MML Counseling Bridge] 사례 연결 실패',error);
    return null;
  }
}

function reconcileWorkflow(caseRecord){
  if(!caseRecord?.id)return null;
  try{
    return global.MMLWorkflowEngine?.applyDerivedState?.(caseRecord,'ai-counseling-completed')||caseRecord;
  }catch(error){
    console.warn('[MML Counseling Bridge] 워크플로우 갱신 실패',error);
    return caseRecord;
  }
}

function commitChartRecord(chartRecord){
  const saved=saveRecord(chartRecord);
  const caseRecord=connectCase(saved);
  const reconciled=reconcileWorkflow(caseRecord);
  try{
    global.dispatchEvent(new CustomEvent('mml:ai-counseling-chart-saved',{
      detail:{record:clone(saved),case:clone(reconciled||caseRecord)}
    }));
  }catch(_){ }
  return {record:saved,case:reconciled||caseRecord};
}

function syncCompletedSessions(){
  const sessionApi=modules.counselingSession||{};
  const sessions=typeof sessionApi.listSessions==='function'
    ? sessionApi.listSessions({status:'completed'})
    : [];
  const results=[];
  sessions.forEach(session=>{
    try{
      const record=typeof sessionApi.buildChartRecord==='function'
        ? sessionApi.buildChartRecord(session)
        : session.chartRecord;
      if(record)results.push(commitChartRecord(record));
    }catch(error){
      console.warn('[MML Counseling Bridge] 완료 세션 동기화 실패',session?.id,error);
    }
  });
  return {count:results.length,results};
}

function onCompleted(event){
  const record=event?.detail?.chartRecord;
  if(record)commitChartRecord(record);
}

function bind(){
  if(bound)return true;
  global.addEventListener?.('mml:ai-counseling-completed',onCompleted);
  bound=true;
  return true;
}

function unbind(){
  if(!bound)return true;
  global.removeEventListener?.('mml:ai-counseling-completed',onCompleted);
  bound=false;
  return true;
}

modules.counselingCaseBridge=Object.freeze({
  VERSION,STORAGE_KEY,
  bind,unbind,saveRecord,commitChartRecord,syncCompletedSessions,readRecords
});

bind();
})(window);
