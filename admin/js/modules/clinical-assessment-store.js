/* =========================================================
   MML Clinical Assessment Store
   심리평가센터의 확정 데이터 원본 저장소
   - 심리평가센터: 원자료/해석/검토 기록 저장
   - 전자차트: 이 저장소를 읽어 보고서 표시/발행
========================================================= */
(function(){
  const STORAGE_KEY='modumam_clinical_assessment_records';
  const VERSION='MML-CLINICAL-RECORD-1.0';

  function read(){
    try{const value=JSON.parse(localStorage.getItem(STORAGE_KEY)||'[]');return Array.isArray(value)?value:[];}
    catch(e){console.warn('[MML Clinical Store] read failed',e);return[];}
  }
  function write(records){
    localStorage.setItem(STORAGE_KEY,JSON.stringify(Array.isArray(records)?records:[]));
    return records;
  }
  function sameId(a,b){return String(a||'')===String(b||'');}
  function getRecord(reservationId){return read().find(x=>sameId(x.reservationId,reservationId))||null;}
  function upsert(record){
    if(!record||record.reservationId===undefined||record.reservationId===null)return null;
    const records=read();
    const old=records.find(x=>sameId(x.reservationId,record.reservationId))||{};
    const next={...old,...record,schemaVersion:VERSION,updatedAt:new Date().toISOString()};
    write([next,...records.filter(x=>!sameId(x.reservationId,record.reservationId))]);
    try{window.dispatchEvent(new CustomEvent('mml:assessment-saved',{detail:next}));}catch(_){ }
    return next;
  }
  function remove(reservationId){write(read().filter(x=>!sameId(x.reservationId,reservationId)));}
  function syncFromRuntime(payload){
    const reservationId=payload?.reservationId;
    if(reservationId===undefined||reservationId===null)return null;
    const reservation=(payload.reservations||[]).find(x=>sameId(x.id,reservationId))||{};
    const tests=(payload.analyses||[]).filter(x=>sameId(x.reservationId,reservationId)).map(x=>({...x}));
    const cross=(payload.crossAnalyses||[]).find(x=>sameId(x.reservationId,reservationId))||null;
    const draft=(payload.reportDrafts||[]).find(x=>sameId(x.reservationId,reservationId))||null;
    const reports=(payload.reports||[]).filter(x=>sameId(x.reservationId,reservationId)).map(x=>({...x}));
    const integratedReport=reports.find(x=>x.integratedAssessmentReport)||null;
    return upsert({
      reservationId,
      clientName:reservation.name||tests[0]?.clientName||'',
      phone:reservation.phone||tests[0]?.phone||'',
      program:reservation.program||tests[0]?.program||'',
      reservation:{id:reservation.id,name:reservation.name||'',phone:reservation.phone||'',program:reservation.program||'',date:reservation.date||'',time:reservation.time||''},
      tests,
      crossAnalysis:cross?{...cross}:null,
      integratedDraft:draft?{...draft}:null,
      integratedReport:integratedReport?{...integratedReport}:null,
      masterReport:integratedReport?.masterReport||draft?.masterReport||null,
      clinicalProfile:integratedReport?.clinicalProfile||draft?.clinicalProfile||integratedReport?.masterReport?.clinicalProfile||null,
      issuedReports:reports,
      source:'assessment-center'
    });
  }
  function recordsForClient(name,phone){
    const normalizedName=String(name||'').trim();
    const digits=String(phone||'').replace(/\D/g,'');
    return read().filter(r=>String(r.clientName||'').trim()===normalizedName || (digits&&String(r.phone||'').replace(/\D/g,'')===digits));
  }

  window.MMLClinicalAssessmentStore={STORAGE_KEY,VERSION,read,write,getRecord,upsert,remove,syncFromRuntime,recordsForClient};
  console.info('[MML] clinical-assessment-store loaded',VERSION);
})();
