(function(global){
'use strict';

const modules=global.MMLClinicalModules=global.MMLClinicalModules||{};
const STORAGE_KEY='modumam_ai_counseling_sessions';
const VERSION='1.0.0';

const nowIso=()=>new Date().toISOString();
const text=value=>String(value??'').replace(/\r\n/g,'\n').trim();
const clone=value=>JSON.parse(JSON.stringify(value??null));

function readAll(){
  try{
    const parsed=JSON.parse(global.localStorage?.getItem(STORAGE_KEY)||'[]');
    return Array.isArray(parsed)?parsed:[];
  }catch(error){
    console.warn('[MML Counseling Session] 저장 데이터 읽기 실패',error);
    return [];
  }
}

function saveAll(rows){
  const next=Array.isArray(rows)?rows:[];
  global.localStorage?.setItem(STORAGE_KEY,JSON.stringify(next));
  return clone(next);
}

function normalizeMessage(message={}){
  const role=['user','assistant','system'].includes(message.role)?message.role:'user';
  return {
    id:text(message.id)||`MSG-${Date.now()}-${Math.random().toString(36).slice(2,8)}`,
    role,
    content:text(message.content||message.text),
    createdAt:message.createdAt||nowIso(),
    safety:message.safety&&typeof message.safety==='object'?clone(message.safety):null
  };
}

function normalizeSession(session={}){
  const messages=(Array.isArray(session.messages)?session.messages:[])
    .map(normalizeMessage)
    .filter(item=>item.content);
  return {
    ...session,
    id:text(session.id)||`AI-COUNSEL-${Date.now()}-${Math.random().toString(36).slice(2,8)}`,
    reservationId:text(session.reservationId),
    clientId:text(session.clientId),
    clientName:text(session.clientName),
    status:['ready','active','paused','completed','stopped'].includes(session.status)?session.status:'ready',
    version:VERSION,
    context:session.context&&typeof session.context==='object'?clone(session.context):{},
    messages,
    startedAt:session.startedAt||'',
    endedAt:session.endedAt||'',
    durationSeconds:Math.max(0,Number(session.durationSeconds||0)),
    summary:text(session.summary),
    counselorReviewRequired:session.counselorReviewRequired!==false,
    createdAt:session.createdAt||nowIso(),
    updatedAt:session.updatedAt||nowIso()
  };
}

function upsert(session){
  const next=normalizeSession(session);
  const rows=readAll().map(normalizeSession);
  const index=rows.findIndex(item=>String(item.id)===String(next.id));
  if(index<0)rows.unshift(next); else rows[index]=next;
  saveAll(rows);
  try{global.dispatchEvent(new CustomEvent('mml:ai-counseling-session-saved',{detail:{session:clone(next)}}));}catch(_){ }
  return clone(next);
}

function getSession(sessionId){
  return readAll().map(normalizeSession).find(item=>String(item.id)===String(sessionId))||null;
}

function listSessions(filter={}){
  return readAll().map(normalizeSession).filter(item=>{
    if(filter.reservationId&&String(item.reservationId)!==String(filter.reservationId))return false;
    if(filter.clientId&&String(item.clientId)!==String(filter.clientId))return false;
    if(filter.status&&String(item.status)!==String(filter.status))return false;
    return true;
  });
}

function createSession(source={}){
  const buildContext=modules.counseling?.buildCounselingContext;
  const context=typeof buildContext==='function'?buildContext(source):{};
  return upsert({
    reservationId:source.reservationId||source.bookingId||'',
    clientId:source.clientId||'',
    clientName:source.clientName||source.name||'',
    status:'ready',
    context,
    messages:[]
  });
}

function startSession(sessionId){
  const current=getSession(sessionId);
  if(!current)throw new Error('AI 상담 세션을 찾지 못했습니다.');
  if(current.status==='completed'||current.status==='stopped')throw new Error('종료된 AI 상담 세션입니다.');
  return upsert({...current,status:'active',startedAt:current.startedAt||nowIso(),updatedAt:nowIso()});
}

function appendMessage(sessionId,message){
  const current=getSession(sessionId);
  if(!current)throw new Error('AI 상담 세션을 찾지 못했습니다.');
  if(current.status!=='active')throw new Error('진행 중인 AI 상담 세션에서만 대화를 저장할 수 있습니다.');
  const normalized=normalizeMessage(message);
  if(!normalized.content)throw new Error('저장할 대화 내용이 없습니다.');
  return upsert({...current,messages:[...current.messages,normalized],updatedAt:nowIso()});
}

function buildSummary(messages=[]){
  const userMessages=messages.filter(item=>item.role==='user').map(item=>item.content);
  const assistantMessages=messages.filter(item=>item.role==='assistant').map(item=>item.content);
  const concerns=userMessages.slice(0,3).join(' / ');
  const responses=assistantMessages.slice(-3).join(' / ');
  return [concerns&&`내담자 표현: ${concerns}`,responses&&`상담 반응: ${responses}`].filter(Boolean).join('\n');
}

function buildChartRecord(session){
  const current=normalizeSession(session);
  return {
    id:`AI-COUNSELING-RECORD-${current.id}`,
    reservationId:current.reservationId,
    clientId:current.clientId,
    clientName:current.clientName,
    type:'ai-result-counseling',
    sessionId:current.id,
    title:'AI 검사결과 해석상담 기록',
    status:'상담자 검토 필요',
    summary:current.summary||buildSummary(current.messages),
    messages:clone(current.messages),
    startedAt:current.startedAt,
    endedAt:current.endedAt,
    durationSeconds:current.durationSeconds,
    counselorReviewRequired:true,
    createdAt:nowIso()
  };
}

function completeSession(sessionId,options={}){
  const current=getSession(sessionId);
  if(!current)throw new Error('AI 상담 세션을 찾지 못했습니다.');
  const endedAt=nowIso();
  const startedMs=current.startedAt?Date.parse(current.startedAt):NaN;
  const durationSeconds=Number.isFinite(startedMs)?Math.max(0,Math.round((Date.parse(endedAt)-startedMs)/1000)):0;
  const completed=upsert({
    ...current,
    status:'completed',
    endedAt,
    durationSeconds,
    summary:text(options.summary)||buildSummary(current.messages),
    updatedAt:endedAt
  });
  const chartRecord=buildChartRecord(completed);
  try{global.dispatchEvent(new CustomEvent('mml:ai-counseling-completed',{detail:{session:clone(completed),chartRecord:clone(chartRecord)}}));}catch(_){ }
  return {session:completed,chartRecord};
}

function stopSession(sessionId,reason=''){
  const current=getSession(sessionId);
  if(!current)throw new Error('AI 상담 세션을 찾지 못했습니다.');
  return upsert({...current,status:'stopped',endedAt:nowIso(),summary:text(reason)||current.summary,updatedAt:nowIso()});
}

function removeSession(sessionId){
  const next=readAll().map(normalizeSession).filter(item=>String(item.id)!==String(sessionId));
  saveAll(next);
  return true;
}

modules.counselingSession=Object.freeze({
  STORAGE_KEY,VERSION,
  createSession,startSession,appendMessage,completeSession,stopSession,
  getSession,listSessions,removeSession,buildChartRecord
});
})(window);
