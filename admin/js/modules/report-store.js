/* =========================================================
   모두의 마음연구소 공통 보고서 저장소 v4
   - 보고서 전체 본문: IndexedDB 저장
   - localStorage: 가벼운 목록/상태만 저장
   - 기존 modumam_reports 자동 마이그레이션
   - QuotaExceededError 방지
========================================================= */
(function(global){
  'use strict';

  const STORAGE_KEY='modumam_reports';
  const BACKUP_KEY='modumam_reports_backup';
  const DB_NAME='modumam_report_database';
  const DB_VERSION=1;
  const STORE_NAME='reports';
  const VERSION=5;
  let memory=[];
  let hydrated=false;

  const nowKo=()=>new Date().toLocaleString('ko-KR');
  const text=v=>String(v??'').trim();
  const clone=value=>{try{return structuredClone(value)}catch(_){} try{return JSON.parse(JSON.stringify(value))}catch(_){return value}};

  function reportKind(report){
    if(report?.individualAssessmentReport||report?.reportType==='individualReport')return 'individualReport';
    if(report?.integratedAssessmentReport||report?.reportType==='counselorComprehensiveReport')return 'counselorComprehensiveReport';
    if(report?.assessmentReport||report?.comprehensiveReport||report?.reportType==='comprehensiveReport')return 'comprehensiveReport';
    if(report?.summaryReport||['summaryReport','관리자용','general'].includes(text(report?.reportType)))return 'summaryReport';
    return text(report?.reportType)||'unknown';
  }

  function normalize(report){
    const source=report&&typeof report==='object'?report:{};
    const kind=reportKind(source);
    const createdAt=source.createdAt||nowKo();
    const approvedForClient=Boolean(source.approvedForClient);
    const approved=source.approved===undefined?Boolean(source.reviewed):Boolean(source.approved);
    const tests=Array.isArray(source.tests)?source.tests.filter(Boolean):Array.isArray(source.selectedTests)?source.selectedTests.filter(Boolean):[];
    return {
      ...source,
      id:source.id||`REPORT-${Date.now()}-${Math.random().toString(36).slice(2,8)}`,
      reservationId:source.reservationId??source.bookingId??source.sourceReservationId??'',
      clientId:source.clientId??'',
      reportType:kind,
      summaryReport:kind==='summaryReport',
      individualAssessmentReport:kind==='individualReport'||Boolean(source.individualAssessmentReport),
      comprehensiveReport:kind==='comprehensiveReport',
      assessmentReport:kind==='comprehensiveReport'||Boolean(source.assessmentReport),
      integratedAssessmentReport:kind==='counselorComprehensiveReport'||Boolean(source.integratedAssessmentReport),
      title:text(source.title)||'심리검사 보고서',
      tests,
      selectedTests:Array.isArray(source.selectedTests)?source.selectedTests.filter(Boolean):tests,
      sections:source.sections&&typeof source.sections==='object'?source.sections:{},
      status:source.status||(approvedForClient?'승인완료 · 열람가능':approved?'상담자 승인 완료 · 공개 전':'초안'),
      reviewStatus:source.reviewStatus||(approved?'approved':'draft'),
      reviewed:Boolean(source.reviewed), approved, approvedForClient,
      version:Math.max(1,Number(source.version||1)), storeVersion:VERSION,
      createdAt, updatedAt:source.updatedAt||createdAt
    };
  }

  function normalizeAll(rows){
    const seen=new Set();
    return (Array.isArray(rows)?rows:[]).map(normalize).filter(r=>{const id=String(r.id);if(seen.has(id))return false;seen.add(id);return true;});
  }

  function compact(report){
    const r=normalize(report);
    return {
      id:r.id,reservationId:r.reservationId,clientId:r.clientId,reportType:r.reportType,
      summaryReport:r.summaryReport,individualAssessmentReport:r.individualAssessmentReport,
      comprehensiveReport:r.comprehensiveReport,assessmentReport:r.assessmentReport,
      integratedAssessmentReport:r.integratedAssessmentReport,title:r.title,testType:r.testType||'',
      tests:r.tests,selectedTests:r.selectedTests,status:r.status,reviewStatus:r.reviewStatus,
      reviewed:r.reviewed,approved:r.approved,approvedForClient:r.approvedForClient,
      version:r.version,storeVersion:VERSION,createdAt:r.createdAt,updatedAt:r.updatedAt,
      publishedAt:r.publishedAt||'',approvedAt:r.approvedAt||'',approvedBy:r.approvedBy||'',
      __indexedDb:true
    };
  }

  function readLocal(){
    try{const raw=localStorage.getItem(STORAGE_KEY);return raw?JSON.parse(raw):[];}catch(_){return []}
  }

  function writeCompact(rows){
    const payload=JSON.stringify(normalizeAll(rows).map(compact));
    try{
      localStorage.removeItem(BACKUP_KEY);
      localStorage.setItem(STORAGE_KEY,payload);
    }catch(error){
      try{
        localStorage.removeItem(BACKUP_KEY);
        ['modumam_server_sync_queue_v37','modumam_server_sync_queue_v36','modumam_server_sync_queue'].forEach(k=>localStorage.removeItem(k));
        localStorage.setItem(STORAGE_KEY,payload);
      }catch(second){
        console.warn('[MMLReportStore] 보고서 목록 저장 공간 정리 후에도 실패',second);
      }
    }
  }

  function openDb(){
    return new Promise((resolve,reject)=>{
      if(!global.indexedDB){reject(new Error('IndexedDB를 지원하지 않는 브라우저입니다.'));return;}
      const req=indexedDB.open(DB_NAME,DB_VERSION);
      req.onupgradeneeded=()=>{const db=req.result;if(!db.objectStoreNames.contains(STORE_NAME))db.createObjectStore(STORE_NAME,{keyPath:'id'});};
      req.onsuccess=()=>resolve(req.result);
      req.onerror=()=>reject(req.error||new Error('보고서 저장소를 열지 못했습니다.'));
    });
  }

  async function idbPutAll(rows){
    const db=await openDb();
    await new Promise((resolve,reject)=>{
      const tx=db.transaction(STORE_NAME,'readwrite'); const store=tx.objectStore(STORE_NAME);
      store.clear(); normalizeAll(rows).forEach(r=>store.put(clone(r)));
      tx.oncomplete=resolve; tx.onerror=()=>reject(tx.error); tx.onabort=()=>reject(tx.error);
    });
    db.close();
  }

  async function idbReadAll(){
    const db=await openDb();
    const rows=await new Promise((resolve,reject)=>{
      const tx=db.transaction(STORE_NAME,'readonly'); const req=tx.objectStore(STORE_NAME).getAll();
      req.onsuccess=()=>resolve(req.result||[]); req.onerror=()=>reject(req.error);
    });
    db.close(); return normalizeAll(rows);
  }

  function notify(type,rows){
    try{global.dispatchEvent(new CustomEvent(type,{detail:{reports:rows,version:VERSION}}));}catch(_){}
  }

  async function hydrate(){
    try{
      const stored=await idbReadAll();
      if(stored.length){memory=stored;writeCompact(memory);}
      hydrated=true;notify('mml:report-store-hydrated',memory);
      return memory;
    }catch(error){hydrated=true;console.warn('[MMLReportStore] IndexedDB 불러오기 실패',error);return memory;}
  }

  function saveAll(rows){
    memory=normalizeAll(rows);
    writeCompact(memory);
    idbPutAll(memory).then(()=>notify('mml:report-saved',memory)).catch(error=>console.error('[MMLReportStore] IndexedDB 저장 실패',error));
    notify('mml:report-saved',memory);
    return memory;
  }

  function loadAll(){return normalizeAll(memory.length?memory:readLocal());}
  function upsert(rows,report){const next=normalize(report),current=normalizeAll(rows);const i=current.findIndex(x=>String(x.id)===String(next.id));if(i<0)return[next,...current];const copy=[...current];copy[i]=normalize({...current[i],...next,updatedAt:nowKo()});return copy;}
  function remove(rows,id){return normalizeAll(rows).filter(r=>String(r.id)!==String(id));}
  function getById(id,rows=loadAll()){return normalizeAll(rows).find(r=>String(r.id)===String(id))||null;}
  function getByReservationId(id,rows=loadAll()){return normalizeAll(rows).filter(r=>String(r.reservationId)===String(id??''));}
  function getByClientId(id,rows=loadAll()){return normalizeAll(rows).filter(r=>String(r.clientId)===String(id??''));}
  function getApprovedReports(rows=loadAll()){return normalizeAll(rows).filter(r=>r.approvedForClient===true);}
  function saveReport(report,rows=loadAll()){return saveAll(upsert(rows,report));}
  function updateReport(id,patch,rows=loadAll()){const current=getById(id,rows);if(!current)throw new Error('수정할 보고서를 찾지 못했습니다.');const value=typeof patch==='function'?patch(clone(current)):(patch||{});return saveAll(upsert(rows,{...current,...value,id:current.id,updatedAt:nowKo()}));}
  function deleteReport(id,rows=loadAll()){return saveAll(remove(rows,id));}
  function deleteReservationReports(id,rows=loadAll()){return saveAll(normalizeAll(rows).filter(r=>String(r.reservationId)!==String(id??'')));}
  function setApproval(rows,id,approved,options={}){const next=Boolean(approved),now=nowKo();return normalizeAll(rows).map(r=>String(r.id)===String(id)?normalize({...r,approved:next,reviewed:next?true:Boolean(r.reviewed),approvedForClient:next,approvedReportHtml:next?String(options.html||r.approvedReportHtml||''):'',approvedAt:next?now:'',approvedBy:next?(text(options.approvedBy)||'관리자'):'',publishedAt:next?now:'',approvalUpdatedAt:now,reviewStatus:next?'approved':'saved',status:next?'승인완료 · 열람가능':'저장완료 · 승인대기',updatedAt:now}):r);}
  function approveReport(id,approved,options={},rows=loadAll()){return saveAll(setApproval(rows,id,approved,options));}
  function replaceReservationReports(rows,reservationId,replacements){const id=String(reservationId??''),rep=normalizeAll(replacements),keys=new Set(rep.map(r=>`${reportKind(r)}:${text(r.testType)}`));return[...rep,...normalizeAll(rows).filter(r=>String(r.reservationId)!==id||!keys.has(`${reportKind(r)}:${text(r.testType)}`))];}
  function setPublication(rows,id,published,html=''){return normalizeAll(rows).map(r=>String(r.id)===String(id)?normalize({...r,approvedForClient:Boolean(published),approvedReportHtml:published?String(html||r.approvedReportHtml||''):'',publishedAt:published?nowKo():'',status:published?'승인완료 · 열람가능':'승인 대기',updatedAt:nowKo()}):r);}

  const legacy=readLocal();
  memory=normalizeAll(legacy);
  // localStorage의 __indexedDb 목록은 본문이 없는 인덱스입니다.
  // 이를 IndexedDB에 다시 쓰면 저장된 보고서 본문이 매번 사라지므로 절대 덮어쓰지 않습니다.
  const hasFullLegacy=memory.some(row=>row && row.__indexedDb!==true && (
    Object.keys(row.sections||{}).length || row.html || row.content || row.approvedReportHtml || row.clientReport || row.counselorReport
  ));
  if(hasFullLegacy){
    writeCompact(memory);
    idbPutAll(memory).catch(error=>console.warn('[MMLReportStore] 구형 전체 보고서 이전 실패',error));
  }

  const api={
    STORAGE_KEY,BACKUP_KEY,VERSION,DB_NAME,STORE_NAME,
    normalize,normalizeAll,loadAll,saveAll,commit:saveAll,read:loadAll,write:saveAll,list:loadAll,
    upsert,remove,getById,getByReservationId,getByClientId,getApprovedReports,
    saveReport,updateReport,deleteReport,deleteReservationReports,approveReport,
    replaceReservationReports,setPublication,setApproval,hydrate,
    get ready(){return hydrated;}
  };
  global.MMLReportStore=api;
  global.MMLCanonicalReportStore=api;
  setTimeout(hydrate,0);
  notify('mml:report-store-ready',memory);
})(window);
