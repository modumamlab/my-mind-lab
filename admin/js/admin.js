console.info('[MML] ADMIN-260725-REFACTOR-FOUNDATION-STEP25 loaded');
/* [FIX-20260715-SESSION-ORGANIZER-15] 회기기록 정리 UI 및 저장 목록 개편 */
/* [FIX-20260715-ELECTRONIC-CHART-20] 이름·연락처 검색형 통합 전자차트 */
/* [FIX-20260715-CASE-AID-REMOVE-11] AI 사례개념화 화면의 AI 상담보조 영역 삭제 */
/* [FIX-20260715-JOURNAL-UI-ACTIVE] 상담일지 화면 개선 실제 적용본 */
/* =========================================================
   모두의 마음연구소 상담운영센터 2.0 · 상담운영센터 2.0 · Sprint 18 AI 결과상담 연결
   파일 역할: 예약관리, 검사 진행관리, AI 접수기록, 보고서, 회원관리

   관리자 수정 위치
   1) 관리자 비밀번호: ADMIN_PASSWORD 검색
   2) 예약 상태값: STATUS 검색
   3) 결제 금액 계산: getPaymentInfo 검색
   4) 검사명 정리: normTest / requestedTests 검색
   5) 결과보고서 템플릿: modumamReportTemplate 검색
   6) 상담신청서·동의서 관리: documentsView 검색
   7) 내담자 전자차트: membersView 검색
   8) AI 상담보조: generateCounselingAid 검색
   9) 운영관리 버튼: approveReservation / markPaymentComplete / sendTestLinks 검색
========================================================= */

const ADMIN_PASSWORD="modumam2026";
const MAX_LOGIN_FAILS=5;
const LOCK_SECONDS=30;
const STATUS=["예약신청","예약승인","결제완료","검사발송","검사완료","결과업로드","상담준비","상담진행","상담완료","종결","취소요청","예약취소"];
const STATUS_ALIASES={'승인대기':'예약신청','예약확정':'예약승인','결제대기':'예약승인','검사링크발송':'검사발송','검사진행':'검사발송','결과작성':'결과업로드','상담예정':'상담준비'};
function normalizeStatus(status){const raw=String(status||'예약신청');return STATUS_ALIASES[raw]||raw;}
function statusIndex(status){const idx=STATUS.indexOf(normalizeStatus(status));return idx<0?0:idx;}
function statusReached(current,target){return normalizeStatus(current)!=='예약취소'&&statusIndex(current)>=statusIndex(target);}
// [MOD-20260714-OPERATING-SETTINGS] 상담운영센터 2.0 운영 규칙
const DEFAULT_OPERATING_SETTINGS={
  centerName:'모두의 마음연구소 상담운영센터',
  counselorName:'',
  contactMessage:'예약 및 검사 진행 관련 안내는 카카오채널 또는 등록된 연락처로 드립니다.',
  openTime:'09:00',
  closeTime:'17:00',
  intervalMinutes:30,
  enabledMethods:['장소 조율(대면)','찾아가는(대면)','Zoom(비대면)','24시 AI상담(비대면)'],
  programDefaultTests:{
    '개인 마음이음':['TCI 기질 및 성격검사'],
    '부부 마음이음':['신청자 TCI 기질 및 성격검사','배우자 TCI 기질 및 성격검사'],
    '부모-자녀 마음이음':['K-CDI 아동발달검사','PAT 부모양육태도검사']
  },
  autoRules:true,
  aiApprovalRequiresReport:true
};
function getOperatingSettings(){
  const saved=load('modumam_operating_settings',{});
  return {...DEFAULT_OPERATING_SETTINGS,...saved,programDefaultTests:{...DEFAULT_OPERATING_SETTINGS.programDefaultTests,...(saved.programDefaultTests||{})}};
}
function buildCounselingTimes(settings=getOperatingSettings()){
  const toMin=v=>{const [h,m]=String(v||'00:00').split(':').map(Number);return h*60+m};
  const start=toMin(settings.openTime),end=toMin(settings.closeTime),step=Math.max(15,Number(settings.intervalMinutes)||30),out=[];
  for(let value=start;value<=end;value+=step){out.push(`${String(Math.floor(value/60)).padStart(2,'0')}:${String(value%60).padStart(2,'0')}`)}
  return out;
}
function isAiCounselingMethod(value){
  return /AI.*(?:비대면|상담)|24시.*AI/i.test(String(value||''));
}
function buildAiCounselingTimes(intervalMinutes=30){
  const step=Math.max(15,Number(intervalMinutes)||30),out=[];
  for(let value=0;value<24*60;value+=step){out.push(`${String(Math.floor(value/60)).padStart(2,'0')}:${String(value%60).padStart(2,'0')}`)}
  return out;
}
function counselingTimesForMethod(method,settings=getOperatingSettings()){
  return isAiCounselingMethod(method)?buildAiCounselingTimes(settings.intervalMinutes):buildCounselingTimes(settings);
}
function counselingMethodLabel(method){
  return isAiCounselingMethod(method)?'24시 AI상담(비대면)':(method==='Zoom(비대면)'?'화상(비대면)':String(method||''));
}
let OPERATING_SETTINGS=getOperatingSettings();
let COUNSELING_METHODS=[...OPERATING_SETTINGS.enabledMethods];
let COUNSELING_TIMES=buildCounselingTimes(OPERATING_SETTINGS);
function refreshOperatingSettings(){OPERATING_SETTINGS=getOperatingSettings();COUNSELING_METHODS=[...OPERATING_SETTINGS.enabledMethods];COUNSELING_TIMES=buildCounselingTimes(OPERATING_SETTINGS)}
const FORM_LINKS={
  application:'https://modumam-lab.netlify.app/public/forms/application.pdf',
  consent:'https://modumam-lab.netlify.app/public/forms/consent.pdf',
  forms:'https://modumam-lab.netlify.app/public/forms/'
};
// [MOD-20260714-RESERVATION-IDB-BRIDGE]
const MODUMAM_DB_NAME='modumam_operating_db';
const MODUMAM_DB_VERSION=1;
const MODUMAM_RESERVATION_STORE='reservations';
function openModumamDatabase(){
  return new Promise((resolve,reject)=>{
    if(!window.indexedDB){reject(new Error('IndexedDB 미지원'));return}
    const request=indexedDB.open(MODUMAM_DB_NAME,MODUMAM_DB_VERSION);
    request.onupgradeneeded=()=>{const db=request.result;if(!db.objectStoreNames.contains(MODUMAM_RESERVATION_STORE))db.createObjectStore(MODUMAM_RESERVATION_STORE,{keyPath:'id'})};
    request.onsuccess=()=>resolve(request.result);
    request.onerror=()=>reject(request.error||new Error('예약 저장소 열기 실패'));
  });
}
async function getIndexedReservations(){
  const db=await openModumamDatabase();
  const rows=await new Promise((resolve,reject)=>{const tx=db.transaction(MODUMAM_RESERVATION_STORE,'readonly');const req=tx.objectStore(MODUMAM_RESERVATION_STORE).getAll();req.onsuccess=()=>resolve(Array.isArray(req.result)?req.result:[]);req.onerror=()=>reject(req.error||new Error('예약 읽기 실패'))});
  db.close();
  return rows;
}
async function putIndexedReservation(row){
  if(!row||!row.id)return;
  const db=await openModumamDatabase();
  await new Promise((resolve,reject)=>{const tx=db.transaction(MODUMAM_RESERVATION_STORE,'readwrite');tx.objectStore(MODUMAM_RESERVATION_STORE).put(row);tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error||new Error('예약 직접 저장 실패'));tx.onabort=()=>reject(tx.error||new Error('예약 직접 저장 중단'))});
  db.close();
}
async function replaceIndexedReservations(rows){
  const db=await openModumamDatabase();
  await new Promise((resolve,reject)=>{const tx=db.transaction(MODUMAM_RESERVATION_STORE,'readwrite');const store=tx.objectStore(MODUMAM_RESERVATION_STORE);store.clear();(Array.isArray(rows)?rows:[]).forEach(row=>store.put(row));tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error||new Error('예약 저장 실패'));tx.onabort=()=>reject(tx.error||new Error('예약 저장 중단'))});
  db.close();
}

let state={counselingJournalTab:'sessions',authed:sessionStorage.getItem('modumam_admin_auth')==='true',menu:'dashboard',memberSearch:'',memberStatus:'전체',selectedClientKey:'',memberTab:'profile',counselingModeId:'',password:'',loginError:'',loginLockedUntil:Number(sessionStorage.getItem('modumam_admin_locked_until')||0),loginFailCount:Number(sessionStorage.getItem('modumam_admin_fail_count')||0),reservations:load('modumam_reservations',[]),clients:load('modumam_clients',[]),intakes:load('modumam_intake_summaries',[]),reports:(window.MMLReportStore?.loadAll?.()||load('modumam_reports',[])),resultUploads:load('modumam_test_result_uploads',[]),reportForm:emptyReportForm(),reportEditingId:null,reportDraftLoading:false,caseDraftLoading:{},counselingPlanLoading:{},supervisionLoading:{},recordQualityLoading:{},clinicalCaseReportLoading:{},clinicalTimelineLoading:{},clinicalDssLoading:{},terminationDraftLoading:{},counselingAidLoading:{},testInterpretationLoading:false,testExtractionLoading:false,interpretationSource:null,testInterpretations:load('modumam_test_interpretations',[]),interpretationForm:{reservationId:'',testType:'STS',scales:{}},interpretationDraft:null,assessmentAnalyses:load('modumam_assessment_analyses',[]),assessmentReservationId:'',assessmentLoading:{},integratedReportLoading:false,integratedReportDraft:null,assessmentReportDrafts:(window.MMLReportStore?.loadDrafts?.()||load('modumam_assessment_report_drafts',[])),assessmentCrossLoading:false,assessmentCrossDraft:null,assessmentCrossAnalyses:load('modumam_assessment_cross_analyses',[]),aiResultCounselingRecords:load('modumam_ai_result_counseling_records',[]),reservationDbCount:0,reservationSyncError:''};
const REPORT_TEST_OPTIONS=['TCI','MMPI-2','PAI','SCT','HTP','STS','PAT','K-CDI','PHQ-9','GAD-7'];
function sanitizeReportTests(value){const raw=Array.isArray(value)?value:String(value||'').split(/[,·]/);return [...new Set(raw.map(x=>String(x||'').trim()).filter(x=>REPORT_TEST_OPTIONS.includes(x)))]}
function emptyReportForm(){return{reservationId:'',clientName:'',phone:'',program:'개별 심리검사',testType:'TCI',selectedTests:['TCI'],title:'',summary:'',mindProfile:'',individualTests:'',emotionState:'',thinkingRelationship:'',stressDaily:'',plan:'',strength:'',caution:'',reportType:'summaryReport',summaryReport:true,status:'작성중',approvedForClient:false}}
function load(k,f){
  if(window.MMLDataStore) return window.MMLDataStore.read(k,f);
  try{const s=localStorage.getItem(k);return s?JSON.parse(s):f}catch(e){return f}
}
const DELETED_RESERVATION_IDS_KEY='modumam_deleted_reservation_ids_v1';
function deletedReservationIds(){return new Set((load(DELETED_RESERVATION_IDS_KEY,[])||[]).map(String));}
function markReservationDeleted(id){const ids=deletedReservationIds();ids.add(String(id));try{localStorage.setItem(DELETED_RESERVATION_IDS_KEY,JSON.stringify([...ids].slice(-1000)));}catch(_){}}
function unmarkReservationDeleted(id){const ids=deletedReservationIds();ids.delete(String(id));try{localStorage.setItem(DELETED_RESERVATION_IDS_KEY,JSON.stringify([...ids]));}catch(_){}}
function excludeDeletedReservations(rows){const deleted=deletedReservationIds();return (Array.isArray(rows)?rows:[]).filter(item=>!deleted.has(String(item?.id||'')));}

function appendAuditLog(action,key,detail=''){
  if(window.MMLDataStore){
    window.MMLDataStore.audit(action,key,detail,{module:'admin'});
    return;
  }
  try{
    const auditKey='modumam_admin_audit_log';
    const current=JSON.parse(localStorage.getItem(auditKey)||'[]');
    current.unshift({id:Date.now()+Math.random(),action:String(action||'변경'),key:String(key||''),detail:String(detail||''),at:new Date().toISOString()});
    localStorage.setItem(auditKey,JSON.stringify(current.slice(0,300)));
  }catch(e){}
}
function save(k,v){
  try{
    if(k==='modumam_reports'&&window.MMLReportStore?.saveAll){
      // 보고서 본문은 MMLReportStore(IndexedDB)의 단일 경로로만 저장합니다.
      // MMLDataStore/localStorage에 전체 본문을 다시 쓰면 compact index가 덮여
      // QuotaExceeded 및 저장 후 본문 소실의 원인이 됩니다.
      const savedReports=window.MMLReportStore.saveAll(v);
      appendAuditLog('보고서 저장',k,`${Array.isArray(savedReports)?savedReports.length:0}건 · canonical store`);
      if(state&&Array.isArray(savedReports))state.reports=savedReports;
    }else if(window.MMLDataStore){
      window.MMLDataStore.write(k,v,{action:'저장',detail:Array.isArray(v)?`${v.length}건`:''});
    }else{
      localStorage.setItem(k,JSON.stringify(v));
      if(String(k||'').startsWith('modumam_')&&!['modumam_admin_audit_log','modumam_counseling_mode_draft'].some(x=>String(k).startsWith(x))){
        appendAuditLog('저장',k);
      }
    }
  }catch(error){
    console.warn('데이터 저장 실패',k,error);
    alert(`저장하지 못했습니다.\n${String(error?.message||error)}`);
    return false;
  }
  if(k==='modumam_reservations'&&Array.isArray(v)) replaceIndexedReservations(v).catch(error=>{state.reservationSyncError=String(error?.message||error)});
  return true;
}

function persistReports(rows){
  const next=Array.isArray(rows)?rows:[];
  if(window.MMLReportStore?.commit){
    state.reports=window.MMLReportStore.commit(next);
  }else if(window.MMLReportStore?.saveAll){
    state.reports=window.MMLReportStore.saveAll(next);
  }else{
    state.reports=next;
  }
  // MMLReportStore.saveAll/commit이 IndexedDB 전체 본문 + localStorage compact index를
  // 이미 함께 갱신합니다. 여기서 다른 저장소에 전체 보고서를 재저장하지 않습니다.
  appendAuditLog('보고서 저장','modumam_reports',`${state.reports.length}건 · canonical store`);
  return state.reports;
}

// [MOD-20260714-RESERVATION-LIVE-SYNC]
// 사용자 페이지에서 새 예약이 저장되면 관리자 화면이 최신 localStorage를 다시 읽습니다.
function mergeReservationsById(...lists){
  const map=new Map();
  const deleted=deletedReservationIds();
  lists.flat().filter(Boolean).forEach(item=>{
    if(deleted.has(String(item?.id||'')))return;
    const key=String(item.id || `${item.name||''}-${item.phone||''}-${item.date||''}-${item.time||''}`);
    const previous=map.get(key)||{};
    map.set(key,{...previous,...item});
  });
  return [...map.values()].sort((a,b)=>Number(b.id||0)-Number(a.id||0));
}
function syncSharedOperatingData(){
  // [FIX-20260715-RESERVATION-MASTER]
  // 관리자에서 저장한 modumam_reservations를 유일한 기준값으로 사용합니다.
  // inbox/lastReservation의 오래된 복사본은 기존 예약을 덮어쓰지 않고,
  // 기준 저장소에 없는 신규 예약만 보충합니다.
  const primaryReservations=excludeDeletedReservations(load('modumam_reservations',[]));
  const inboxReservations=excludeDeletedReservations(load('modumam_reservation_inbox',[]));
  const rawLastReservation=load('modumam_last_reservation',null);
  const lastReservation=rawLastReservation&&deletedReservationIds().has(String(rawLastReservation.id||''))?null:rawLastReservation;
  const primaryIds=new Set(primaryReservations.map(item=>String(item?.id||'')));
  const missing=[...inboxReservations,lastReservation].filter(item=>item&& !primaryIds.has(String(item.id||'')));
  const nextReservations=mergeReservationsById(missing,primaryReservations);
  if(nextReservations.length) localStorage.setItem('modumam_reservations',JSON.stringify(nextReservations));
  const nextIntakes=load('modumam_intake_summaries',[]);
  const nextReports=window.MMLReportStore?.loadAll?.()||load('modumam_reports',[]);
  const nextUploads=load('modumam_test_result_uploads',[]);
  const nextAiResultRecords=load('modumam_ai_result_counseling_records',[]);
  let changed=false;
  const apply=(key,next)=>{
    if(JSON.stringify(state[key]||[])!==JSON.stringify(next||[])){
      state[key]=Array.isArray(next)?next:[];
      changed=true;
    }
  };
  apply('reservations',nextReservations);
  apply('intakes',nextIntakes);
  apply('reports',nextReports);
  apply('resultUploads',nextUploads);
  apply('aiResultCounselingRecords',nextAiResultRecords);
  return changed;
}
async function syncIndexedReservationData(){
  try{
    const indexedRows=await getIndexedReservations();
    state.reservationDbCount=indexedRows.length;
    state.reservationSyncError='';
    const merged=mergeReservationsById(state.reservations,indexedRows);
    const changed=JSON.stringify(state.reservations)!==JSON.stringify(merged);
    if(changed){state.reservations=merged;try{localStorage.setItem('modumam_reservations',JSON.stringify(merged))}catch(e){}}
    return changed;
  }catch(error){
    state.reservationSyncError=String(error?.message||error);
    return false;
  }
}
function requestReservationsFromUserPages(){
  try{
    const channel=new BroadcastChannel('modumam_operating_sync');
    channel.postMessage({type:'request-reservations',at:Date.now()});
    setTimeout(()=>channel.close(),600);
  }catch(e){}
}
function receiveReservationRows(rows,source='사용자 페이지'){
  const deleted=deletedReservationIds();
  const incoming=Array.isArray(rows)?rows.filter(item=>item&&!deleted.has(String(item.id||''))):[];
  if(!incoming.length)return false;
  const merged=mergeReservationsById(state.reservations,incoming);
  const changed=JSON.stringify(merged)!==JSON.stringify(state.reservations);
  state.reservations=merged;
  try{
    localStorage.setItem('modumam_reservations',JSON.stringify(merged));
    localStorage.setItem('modumam_reservation_inbox',JSON.stringify(mergeReservationsById(load('modumam_reservation_inbox',[]),incoming).slice(0,500)));
  }catch(e){}
  incoming.forEach(row=>putIndexedReservation(row).catch(error=>{state.reservationSyncError=String(error?.message||error)}));
  if(changed)appendAuditLog('예약 직접 수신','modumam_reservations',`${source} ${incoming.length}건`);
  return changed;
}
async function refreshSharedOperatingData(showMessage=false){
  requestReservationsFromUserPages();
  const localChanged=syncSharedOperatingData();
  const indexedChanged=await syncIndexedReservationData();
  if(showMessage) alert(localChanged||indexedChanged?'새 예약과 운영 데이터를 불러왔습니다. 사용자 페이지에도 예약목록을 요청했습니다.':'저장소를 확인했고 사용자 페이지에 예약목록을 요청했습니다.');
  render();
}
function esc(v){return String(v||'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;')}
function statusClass(s){const n=normalizeStatus(s);if(['상담완료','종결'].includes(n))return'bg-emerald-100 text-emerald-700';if(['상담준비','상담진행'].includes(n))return'bg-teal-100 text-teal-700';if(n==='결과업로드')return'bg-purple-100 text-purple-700';if(n==='검사완료')return'bg-violet-100 text-violet-700';if(n==='검사발송')return'bg-indigo-100 text-indigo-700';if(n==='결제완료')return'bg-emerald-100 text-emerald-700';if(n==='예약승인')return'bg-blue-100 text-blue-700';if(n==='취소요청')return'bg-orange-100 text-orange-700';if(n==='예약취소')return'bg-rose-100 text-rose-700';return'bg-amber-100 text-amber-700'}
function getPaymentInfo(r){
  const type=String(r.type||'').trim();
  const program=programBaseName(r.program||'');

  // 'AI(비대면)'에도 '대면' 글자가 포함되므로 includes('대면')만으로 판단하면 안 됩니다.
  const isNonFace=/AI|Zoom|화상|전화|비대면/i.test(type);
  const counselingFee=isNonFace?20000:50000;
  const counselingLabel=isNonFace?'비대면상담비 20,000원':'대면상담비 50,000원';

  const basicTestCount=(program.includes('부부')||program.includes('부모-자녀'))?2:1;
  const basicTestFee=basicTestCount*30000;

  const extras=r.reportTests||r.includedTests||r.extraTests||r.selectedTests||r.additionalTests||[];
  const freeKeywords=['무료','기본','문장완성검사','집-나무-사람','그림검사','우울검사','불안검사','스트레스검사'];
  const paidExtraCount=Array.isArray(extras)
    ? extras.filter(test=>!freeKeywords.some(keyword=>String(test).includes(keyword))).length
    : 0;
  const extraTestFee=paidExtraCount*30000;

  const parts=[
    counselingLabel,
    `기본검사 ${basicTestCount}건 ${basicTestFee.toLocaleString()}원`
  ];
  if(paidExtraCount){
    parts.push(`추가검사 ${paidExtraCount}건 ${extraTestFee.toLocaleString()}원`);
  }

  return{
    total:(counselingFee+basicTestFee+extraTestFee).toLocaleString()+'원',
    detail:parts.join(' + ')
  };
}
function normTest(value){
  const raw=String(value||'').trim();
  if(!raw) return '';
  const clean=raw.replace(/\s*\(무료\)\s*/g,'').trim();
  const aliases=[
    [/신청자.*TCI|TCI.*신청자/i,'신청자 TCI 기질 및 성격검사'],
    [/배우자.*TCI|TCI.*배우자/i,'배우자 TCI 기질 및 성격검사'],
    [/TCI|기질.*성격/i,'TCI 기질 및 성격검사'],
    [/MMPI[- ]?2/i,'MMPI-2 다면적 인성검사'],
    [/PAI/i,'PAI 성격평가질문지'],
    [/PAT|부모양육태도/i,'PAT 부모양육태도검사'],
    [/K[- ]?CDI|KCDI|아동발달/i,'K-CDI 아동발달검사'],
    [/STS|아동기질/i,'STS 아동기질검사'],
    [/SCT|문장완성/i,'SCT 문장완성검사'],
    [/HTP|집[-· ]?나무[-· ]?사람|그림검사/i,'HTP 그림검사'],
    [/PHQ[- ]?9|우울검사/i,'PHQ-9 우울검사'],
    [/GAD[- ]?7|불안검사/i,'GAD-7 불안검사'],
    [/회복탄력성/i,'회복탄력성검사'],
    [/직무스트레스/i,'직무스트레스검사'],
    [/직업흥미|흥미검사/i,'직업흥미검사']
  ];
  const found=aliases.find(([pattern])=>pattern.test(clean));
  return found?found[1]:clean;
}

function reportTestGroups(r){
  const program=programBaseName(r?.program||'');
  // [MML-REPORT-35] 프로그램별 기본검사는 보고서 생성의 필수 기준입니다.
  // 저장된 이전 환경설정이 남아 있어도 현재 운영 기준을 우선 적용합니다.
  const canonicalDefaults={
    '개인 마음이음':['TCI 기질 및 성격검사'],
    '부부 마음이음':['신청자 TCI 기질 및 성격검사','배우자 TCI 기질 및 성격검사'],
    '부모-자녀 마음이음':['K-CDI 아동발달검사','PAT 부모양육태도검사']
  };
  const savedDefaults=getOperatingSettings().programDefaultTests||{};
  const basicRaw=Array.isArray(canonicalDefaults[program])?canonicalDefaults[program]:(Array.isArray(savedDefaults[program])?savedDefaults[program]:[]);
  const extraRaw=r?.reportTests||r?.includedTests||r?.extraTests||r?.selectedTests||r?.additionalTests||[];
  const normalizeList=(list,markFree=false)=>{
    const seen=new Set();
    return (Array.isArray(list)?list:[]).map(t=>{
      const n=normTest(t);if(!n)return '';
      return markFree&&String(t).includes('무료')?n+' (무료)':n;
    }).filter(Boolean).filter(t=>{const k=shortTestName(t);if(seen.has(k))return false;seen.add(k);return true;});
  };
  const basicTests=normalizeList(basicRaw);
  const basicKeys=new Set(basicTests.map(shortTestName));
  const additionalTests=normalizeList(extraRaw,true).filter(t=>!basicKeys.has(shortTestName(t)));
  return{program,basicTests,additionalTests,allTests:[...basicTests,...additionalTests]};
}

function requestedTests(r){
  // [MOD-20260726-REPORT-POLICY-V4]
  // 프로그램 기본검사는 환경설정/과거 저장값과 무관하게 항상 포함합니다.
  // 예약에는 추가검사만 저장되는 경우가 있으므로 기본검사와 추가검사를 여기서 합칩니다.
  const program=programBaseName(r?.bookingProgram||r?.program||'');
  const canonicalDefaults={
    '개인 마음이음':['TCI 기질 및 성격검사'],
    '부부 마음이음':['신청자 TCI 기질 및 성격검사','배우자 TCI 기질 및 성격검사'],
    '부모-자녀 마음이음':['PAT 부모양육태도검사','K-CDI 아동발달검사']
  };
  let tests=Array.isArray(canonicalDefaults[program])?[...canonicalDefaults[program]]:[];
  const extras=[
    ...(Array.isArray(r?.extraTests)?r.extraTests:[]),
    ...(Array.isArray(r?.reportTests)?r.reportTests:[]),
    ...(Array.isArray(r?.includedTests)?r.includedTests:[]),
    ...(Array.isArray(r?.selectedTests)?r.selectedTests:[]),
    ...(Array.isArray(r?.additionalTests)?r.additionalTests:[]),
    ...(Array.isArray(r?.tests)?r.tests:[])
  ];
  extras.forEach(t=>{
    if(String(t||'').trim()==='행동관찰')return;
    const n=normTest(t);
    if(n)tests.push(String(t).includes('무료')?n+' (무료)':n);
  });
  const seen=new Set();
  return tests.filter(Boolean).filter(t=>{
    const key=shortTestName(t);
    if(seen.has(key))return false;
    seen.add(key);
    return true;
  });
}

function programBaseName(program){
  const raw=String(program||'').trim();

  // [MOD-20260714-ADMIN-PROGRAM-NAME]
  // 관리자 화면의 프로그램명은 아래 3개만 사용합니다.
  // 검사명·패키지명·과거 표기는 신청검사 영역에서 별도로 표시합니다.
  if(/개별\s*심리검사|개별검사/i.test(raw)) return '개별 심리검사';
  if(/부모\s*[-·]?\s*자녀|부모자녀|양육|영유아/i.test(raw)) return '부모-자녀 마음이음';
  if(/부부|커플|배우자/i.test(raw)) return '부부 마음이음';
  return '개인 마음이음';
}
function shortTestName(test){
  const t=String(test||'').toUpperCase();
  if(t.includes('MMPI'))return 'MMPI-2';
  if(t.includes('TCI'))return t.includes('× 2')||t.includes('X 2')?'TCI × 2':'TCI';
  if(t.includes('PAI'))return 'PAI';
  if(t.includes('PAT'))return 'PAT';
  if(t.includes('STS'))return 'STS';
  if(t.includes('KCDI')||t.includes('K-CDI'))return 'K-CDI';
  if(t.includes('SCT'))return 'SCT';
  if(t.includes('HTP'))return 'HTP';
  if(t.includes('PHQ'))return 'PHQ-9';
  if(t.includes('GAD'))return 'GAD-7';
  if(t.includes('회복탄력'))return '회복탄력성';
  return String(test||'').replace(/\s*검사.*$/,'').trim();
}
function counselingMethodKey(type){
  const t=String(type||'');
  if(t.includes('찾아가는'))return '찾아가는';
  if(t.includes('장소'))return '장소 조율';
  if(t.includes('Zoom')||t.includes('화상'))return '화상';
  if(t.includes('AI'))return 'AI';
  return t||'미정';
}
function counselingMethodChips(type){
  const selected=counselingMethodKey(type);
  const methods=['장소 조율','찾아가는','화상','AI'];
  return `<div class="flex flex-wrap gap-2 mt-2">${methods.map(m=>`<span class="rounded-full px-3 py-1.5 text-xs border ${selected===m?'bg-slate-900 text-white border-slate-900 font-extrabold shadow-sm':'bg-white text-slate-400 border-slate-200 font-semibold'}">${m}${selected===m?' · 선택':''}</span>`).join('')}</div>`;
}
function electronicChartTestChips(client, latest, tests){
  const statuses=latest?.testStatuses||{};
  return `<div class="flex flex-wrap gap-2 mt-2">${tests.length?tests.map(test=>{
    const short=shortTestName(test);
    const uploaded=(client.uploads||[]).some(u=>shortTestName(u.testType)===short);
    const rawStatus=statuses[test]||statuses[normTest(test)]||'';
    const completed=uploaded||['검사완료','결과확인','완료'].includes(rawStatus);
    const sent=!completed&&(['발송완료','검사진행'].includes(rawStatus)||['검사링크발송','검사진행'].includes(latest.status));
    const label=completed?'완료':sent?'진행중':'신청';
    const cls=completed?'bg-emerald-50 text-emerald-700 border-emerald-200':sent?'bg-amber-50 text-amber-700 border-amber-200':'bg-purple-50 text-purple-700 border-purple-200';
    return `<span class="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-extrabold border ${cls}"><span>${esc(short)}</span><span class="text-[10px] opacity-75">${label}</span></span>`;
  }).join(''):'<span class="text-xs text-slate-400">신청 검사 없음</span>'}</div>`;
}

function clientKey(n,p){const phone=String(p||'').replace(/[^0-9]/g,'');return phone||String(n||'').trim()||'unknown'}

/* [BUILD-20260715-CASE-NUMBER-22] 예약번호·사례번호 */
function caseProgramCode(program){
  const name=programBaseName(program);
  if(name.includes('부부'))return 'C';
  if(name.includes('부모-자녀'))return 'F';
  return 'P';
}
function reservationDateKey(r){
  const raw=String(r.createdAt||r.date||'').replace(/[^0-9]/g,'');
  if(raw.length>=8)return raw.slice(2,8);
  const d=new Date(Number(r.id)||Date.now());
  return `${String(d.getFullYear()).slice(-2)}${String(d.getMonth()+1).padStart(2,'0')}${String(d.getDate()).padStart(2,'0')}`;
}
function nextReservationNumber(r,rows){
  const dateKey=reservationDateKey(r);
  const used=(rows||[]).map(x=>String(x.reservationNumber||'')).filter(x=>x.startsWith(`R${dateKey}-`)).map(x=>Number(x.split('-').pop())||0);
  return `R${dateKey}-${String(Math.max(0,...used)+1).padStart(3,'0')}`;
}
function nextCaseNumber(r,rows){
  const year=String(new Date().getFullYear()).slice(-2);
  const code=caseProgramCode(r.program);
  const prefix=`ML-${code}-${year}`;
  const used=(rows||[]).map(x=>String(x.caseNumber||'')).filter(x=>x.startsWith(prefix)).map(x=>Number(x.slice(prefix.length))||0);
  return `${prefix}${String(Math.max(0,...used)+1).padStart(4,'0')}`;
}
function findExistingCaseNumber(r,rows){
  const key=clientKey(r.name,r.phone);
  const same=(rows||[]).find(x=>String(x.caseNumber||'')&&clientKey(x.name,x.phone)===key);
  return same?.caseNumber||'';
}
function ensureReservationIdentifiers(){
  let changed=false;
  const rows=state.reservations||[];
  rows.forEach(r=>{
    if(!r.reservationNumber){r.reservationNumber=nextReservationNumber(r,rows);changed=true;}
    const eligible=statusReached(r.status,'예약승인')&&normalizeStatus(r.status)!=='예약취소';
    if(eligible&&!r.caseNumber){r.caseNumber=findExistingCaseNumber(r,rows)||nextCaseNumber(r,rows);changed=true;}
  });
  if(changed){
    try{localStorage.setItem('modumam_reservations',JSON.stringify(rows));}catch(e){}
    replaceIndexedReservations(rows).catch(()=>{});
  }
  return changed;
}
function caseStatusLabel(r){
  const st=normalizeStatus(r?.status);
  if(st==='종결')return '종결';
  if(['상담준비','상담진행','상담완료'].includes(st))return '상담중';
  return '예약';
}
function caseStatusClass(r){
  const label=caseStatusLabel(r);
  return label==='종결'?'bg-emerald-100 text-emerald-700':label==='상담중'?'bg-blue-100 text-blue-700':'bg-amber-100 text-amber-700';
}

function buildClients(){const m={};(state.clients||[]).forEach(c=>{const k=c.key||clientKey(c.name,c.phone);m[k]={...c,key:k,name:c.name||'이름 미입력',phone:c.phone||'',reservations:[],intakes:[],reports:[],uploads:[],aiResultRecords:[],notes:load('modumam_counseling_notes_'+k,[])}});state.reservations.forEach(r=>{const k=clientKey(r.name,r.phone);if(!m[k])m[k]={key:k,name:r.name||'이름 미입력',phone:r.phone||'',reservations:[],intakes:[],reports:[],uploads:[],aiResultRecords:[],notes:load('modumam_counseling_notes_'+k,[])};m[k].reservations.push(r)});state.intakes.forEach(i=>{const k=clientKey(i.name,i.phone);if(!m[k])m[k]={key:k,name:i.name||'이름 미입력',phone:i.phone||'',reservations:[],intakes:[],reports:[],uploads:[],aiResultRecords:[],notes:load('modumam_counseling_notes_'+k,[])};m[k].intakes.push(i)});state.reports.forEach(r=>{const same=Object.keys(m).find(k=>String(m[k].name).trim()===String(r.clientName).trim());const k=same||clientKey(r.clientName,r.phone);if(!m[k])m[k]={key:k,name:r.clientName||'이름 미입력',phone:r.phone||'',reservations:[],intakes:[],reports:[],uploads:[],aiResultRecords:[],notes:load('modumam_counseling_notes_'+k,[])};m[k].reports.push(r)});state.resultUploads.forEach(u=>{const same=Object.keys(m).find(k=>(u.phone&&clientKey('',u.phone)===k)||String(m[k].name).trim()===String(u.clientName||'').trim());const k=same||clientKey(u.clientName,u.phone);if(!m[k])m[k]={key:k,name:u.clientName||'이름 미입력',phone:u.phone||'',reservations:[],intakes:[],reports:[],uploads:[],aiResultRecords:[],notes:load('modumam_counseling_notes_'+k,[])};m[k].uploads.push(u)});(state.aiResultCounselingRecords||[]).forEach(record=>{const same=Object.keys(m).find(k=>String(m[k].name).trim()===String(record.clientName||'').trim()||(record.phone&&clientKey('',record.phone)===k));const reservation=state.reservations.find(r=>String(r.id)===String(record.reservationId));const k=same||clientKey(record.clientName||reservation?.name,record.phone||reservation?.phone);if(!m[k])m[k]={key:k,name:record.clientName||reservation?.name||'이름 미입력',phone:record.phone||reservation?.phone||'',reservations:[],intakes:[],reports:[],uploads:[],aiResultRecords:[],notes:load('modumam_counseling_notes_'+k,[])};m[k].aiResultRecords.push(record)});return Object.values(m).map(c=>{const latest=[...(c.reservations||[])].sort((a,b)=>String(b.date||'').localeCompare(String(a.date||'')))[0]||{};return {...c,caseNumber:(c.reservations||[]).find(r=>r.caseNumber)?.caseNumber||'',reservationNumber:latest.reservationNumber||'',profileMemo:load('modumam_client_profile_'+c.key,{memo:'',updatedAt:''})}})}
function findIntake(r){const p=String(r.phone||'').replace(/[^0-9]/g,'');const n=String(r.name||'').trim();return state.intakes.find(i=>{const ip=String(i.phone||'').replace(/[^0-9]/g,'');const iname=String(i.name||'').trim();return(p&&ip&&p===ip)||(n&&iname&&n===iname)})}
function hasReport(r){return state.reports.some(x=>String(x.clientName||'').trim()===String(r.name||'').trim())}
function progress(r){const current=normalizeStatus(r.status);const steps=STATUS.filter(x=>x!=='예약취소').map(step=>[step,statusReached(current,step)]);return{steps,pct:Math.round(steps.filter(x=>x[1]).length/steps.length*100),ai:!!findIntake(r)}}
function setMenu(m){syncSharedOperatingData();const legacy=['results','resultUploads','test-management','assessment-management','psychological-tests'];const requested=legacy.includes(m)?'reservation':m;state.menu=requested==='today'?'dashboard':requested;render()}
// 오늘 해야 할 일의 버튼은 업무를 즉시 처리하지 않고 관련 페이지로 이동합니다.
function openTodayTaskPage(menu,reservationId=''){
  syncSharedOperatingData();
  state.menu=menu;
  render();
  if(reservationId){
    setTimeout(()=>{
      const target=document.getElementById(`reservation-task-${reservationId}`);
      if(target) target.scrollIntoView({behavior:'smooth',block:'start'});
    },80);
  }
}
window.openTodayTaskPage=openTodayTaskPage;

/* =========================================================
   관리자 로그인 보안
   - 비밀번호: ADMIN_PASSWORD 값 수정
   - 5회 실패 시 30초 잠금
   - 브라우저 세션 동안 로그인 유지
========================================================= */
function login(e){
  e.preventDefault();
  const now=Date.now();
  const inputPassword = String(state.password || '').trim();

  /* =====================================================
     관리자 비밀번호 확인
     - 앞뒤 공백은 자동 제거합니다.
     - 잠금 상태여도 올바른 비밀번호를 입력하면 즉시 로그인됩니다.
     - 비밀번호 변경 위치: ADMIN_PASSWORD
  ===================================================== */
  if(inputPassword===ADMIN_PASSWORD){
    state.authed=true;
    state.password='';
    state.loginError='';
    state.loginFailCount=0;
    state.loginLockedUntil=0;
    sessionStorage.setItem('modumam_admin_auth','true');
    sessionStorage.removeItem('modumam_admin_fail_count');
    sessionStorage.removeItem('modumam_admin_locked_until');
    render();
    return;
  }

  if(state.loginLockedUntil && now<state.loginLockedUntil){
    const remain=Math.ceil((state.loginLockedUntil-now)/1000);
    state.loginError=`비밀번호를 여러 번 틀렸습니다. ${remain}초 후 다시 시도해 주세요.`;
    render();
    return;
  }

  state.loginFailCount+=1;
  sessionStorage.setItem('modumam_admin_fail_count',String(state.loginFailCount));
  if(state.loginFailCount>=MAX_LOGIN_FAILS){
    state.loginLockedUntil=Date.now()+LOCK_SECONDS*1000;
    sessionStorage.setItem('modumam_admin_locked_until',String(state.loginLockedUntil));
    state.loginError=`비밀번호를 ${MAX_LOGIN_FAILS}회 틀렸습니다. ${LOCK_SECONDS}초 후 다시 시도해 주세요.`;
  }else{
    state.loginError=`비밀번호가 올바르지 않습니다. (${state.loginFailCount}/${MAX_LOGIN_FAILS})`;
  }
  render();
}
function logout(){sessionStorage.removeItem('modumam_admin_auth');state.authed=false;state.password='';state.loginError='';render()}
// [MOD-20260713-ADMIN-STATUS-HISTORY]
// 예약 진행상태가 바뀌면 회원 화면에서 확인할 수 있도록 변경 이력과 읽지 않은 알림을 저장합니다.
function updateReservation(id,patch){
  const changedAt=new Date().toLocaleString('ko-KR');
  state.reservations=state.reservations.map(r=>{
    if(String(r.id)!==String(id))return r;
    const next={...r,...patch};
    if(Object.prototype.hasOwnProperty.call(patch,'status') && String(patch.status||'')!==String(r.status||'')){
      const history=[...(Array.isArray(r.statusHistory)?r.statusHistory:[])];
      history.unshift({id:Date.now(),before:normalizeStatus(r.status),after:patch.status||'',changedAt});
      next.statusHistory=history.slice(0,30);
      next.statusUpdatedAt=changedAt;
      next.statusUpdateUnread=true;
    }
    return next;
  });
  save('modumam_reservations',state.reservations);

  try{
    const updated=state.reservations.find(
      r=>String(r.id)===String(id)
    );
    if(updated){
      const inbox=load('modumam_reservation_inbox',[]);
      const nextInbox=[
        updated,
        ...inbox.filter(item=>String(item.id)!==String(id))
      ];
      save('modumam_reservation_inbox',nextInbox);
      save('modumam_last_reservation',updated);
      putIndexedReservation(updated).catch(error=>{
        console.error('[예약 진행상태 IndexedDB 저장]',error);
      });
    }
  }catch(error){
    console.error('[예약 진행상태 동기화]',error);
  }

  render();
}

// [MOD-20260713-ADMIN-SCHEDULE-HISTORY]
// 상담일정·방식 변경 시 회원 화면에 안내할 수 있도록 변경 이력을 저장합니다.

// [MOD-20260726-ADMIN-CANCELLATION]
// 사용자의 예약취소 요청을 관리자가 승인하거나 거부합니다.
function approveReservationCancellation(id){
  const r=state.reservations.find(x=>String(x.id)===String(id));
  if(!r)return;
  if(normalizeStatus(r.status)!=='취소요청'){
    alert('취소요청 상태의 예약만 승인할 수 있습니다.');
    return;
  }
  if(!confirm(`${r.name||'내담자'}님의 예약취소 요청을 승인하시겠습니까?\n\n예약 기록은 삭제하지 않고 예약취소 상태로 보관됩니다.`))return;
  const now=new Date().toLocaleString('ko-KR');
  const history=[...(Array.isArray(r.cancellationHistory)?r.cancellationHistory:[])];
  history.unshift({id:Date.now(),action:'승인',beforeStatus:r.cancelPreviousStatus||r.previousStatus||'예약신청',afterStatus:'예약취소',processedAt:now});
  updateReservation(id,{
    status:'예약취소',
    cancellationStatus:'approved',
    cancellationApprovedAt:now,
    cancellationProcessedAt:now,
    cancellationUnread:true,
    aiResultCounselingEnabled:false,
    aiCounselingEnabled:false,
    cancellationHistory:history.slice(0,30)
  });
  appendAuditLog?.('예약취소 승인','modumam_reservations',`${r.name||''} · ${r.date||''} ${r.time||''}`);
}

function rejectReservationCancellation(id){
  const r=state.reservations.find(x=>String(x.id)===String(id));
  if(!r)return;
  if(normalizeStatus(r.status)!=='취소요청'){
    alert('취소요청 상태의 예약만 거부할 수 있습니다.');
    return;
  }
  const reason=prompt('취소 거부 사유를 입력해 주세요.\n예: 검사 진행 후에는 취소할 수 없습니다.','');
  if(reason===null)return;
  if(!String(reason).trim()){
    alert('취소 거부 사유를 입력해 주세요.');
    return;
  }
  const restoreStatus=normalizeStatus(r.cancelPreviousStatus||r.previousStatus||r.statusBeforeCancellation||'예약신청');
  const safeRestore=['취소요청','예약취소'].includes(restoreStatus)?'예약신청':restoreStatus;
  const now=new Date().toLocaleString('ko-KR');
  const history=[...(Array.isArray(r.cancellationHistory)?r.cancellationHistory:[])];
  history.unshift({id:Date.now(),action:'거부',reason:String(reason).trim(),beforeStatus:'취소요청',afterStatus:safeRestore,processedAt:now});
  updateReservation(id,{
    status:safeRestore,
    cancellationStatus:'rejected',
    cancellationRejectedAt:now,
    cancellationProcessedAt:now,
    cancellationRejectReason:String(reason).trim(),
    cancellationUnread:true,
    cancellationHistory:history.slice(0,30)
  });
  appendAuditLog?.('예약취소 거부','modumam_reservations',`${r.name||''} · ${String(reason).trim()}`);
}

function updateScheduleWithHistory(id,patch,changeType){
  const changedAt=new Date().toLocaleString('ko-KR');
  let updatedReservation=null;

  state.reservations=state.reservations.map(r=>{
    // [FIX-20260715-SCHEDULE-SAVE]
    // 예약 ID가 숫자/문자열로 섞여 있어도 일정 수정이 사라지지 않도록 문자열로 비교합니다.
    if(String(r.id)!==String(id))return r;

    const before={date:r.date||'',time:r.time||'',type:r.type||''};
    const after={...before,...patch};
    const history=[...(Array.isArray(r.scheduleHistory)?r.scheduleHistory:[])];
    history.unshift({id:Date.now(),changeType,before,after,changedAt});

    updatedReservation={
      ...r,
      ...patch,
      scheduleHistory:history.slice(0,20),
      scheduleUpdatedAt:changedAt,
      scheduleUpdateUnread:true
    };
    return updatedReservation;
  });

  if(!updatedReservation){
    alert('수정할 예약을 찾지 못했습니다. 예약 새로 불러오기를 누른 뒤 다시 시도해 주세요.');
    render();
    return;
  }

  // localStorage, 예약 inbox, IndexedDB에 모두 저장하여 새로고침 후에도 일정이 유지되도록 합니다.
  save('modumam_reservations',state.reservations);
  try{
    const inbox=load('modumam_reservation_inbox',[]);
    const nextInbox=[
      updatedReservation,
      ...inbox.filter(item=>String(item.id)!==String(id))
    ];
    save('modumam_reservation_inbox',nextInbox);
    save('modumam_last_reservation',updatedReservation);
    putIndexedReservation(updatedReservation).catch(error=>{
      console.error('[예약 일정 IndexedDB 저장]',error);
    });
  }catch(error){
    console.error('[예약 일정 동기화]',error);
  }

  render();
}
function updateCounselingMethod(id,value){
  const isAi=isAiCounselingMethod(value);
  updateScheduleWithHistory(id,{type:value,aiCounseling:isAi,counselingDurationMinutes:isAi?50:null,reportRequired:isAi},'상담방식 변경');
}
function updateCounselingTime(id,value){
  const reservation=state.reservations.find(r=>String(r.id)===String(id));
  const allowed=counselingTimesForMethod(reservation?.type);
  if(!allowed.includes(value)){alert(isAiCounselingMethod(reservation?.type)?'24시 AI상담은 00:00~23:30 사이에서 선택해 주세요.':`대면·화상 상담시간은 ${OPERATING_SETTINGS.openTime}부터 ${OPERATING_SETTINGS.closeTime}까지 ${OPERATING_SETTINGS.intervalMinutes}분 단위로 선택해 주세요.`);render();return;}
  updateScheduleWithHistory(id,{time:value},'상담시간 변경');
}
function updateCounselingDate(id,value){
  const date=String(value||'').trim();
  if(!/^\d{4}-\d{2}-\d{2}$/.test(date)){
    alert('상담일자를 올바르게 선택해 주세요.');
    render();
    return;
  }
  updateScheduleWithHistory(id,{date},'상담일자 변경');
}

/* =========================================================
   V32 일정수정 빠른 처리 버튼
   - 예약 승인 → 결제대기
   - 결제 완료 → 결제완료
   - 검사 링크 발송 → 검사링크발송 / 검사 상태 발송완료
   - 상담 예정 → 상담예정
========================================================= */

// [MOD-20260715-CURRENT-STAGE-SAVE]
// 예약 단계 선택창은 제거하고, 현재 단계 안내에서 예약일정·상담방식 변경사항만 저장합니다.
function saveCurrentReservationChanges(id){
  const reservation=state.reservations.find(r=>String(r.id)===String(id));
  if(!reservation){alert('예약 정보를 찾지 못했습니다.');return;}

  const date=document.getElementById(`reservation-date-${id}`)?.value?.trim()||'';
  const time=document.getElementById(`reservation-time-${id}`)?.value?.trim()||'';
  const type=document.getElementById(`reservation-method-${id}`)?.value?.trim()||'';

  if(!/^\d{4}-\d{2}-\d{2}$/.test(date)){alert('상담일자를 올바르게 선택해 주세요.');return;}
  const allowedTimes=counselingTimesForMethod(type);
  if(!allowedTimes.includes(time)){alert(isAiCounselingMethod(type)?'24시 AI상담 시간은 00:00~23:30 사이에서 선택해 주세요.':'대면·화상 상담은 09:00~17:00 사이에서 선택해 주세요.');return;}
  if(!type){alert('상담방식을 선택해 주세요.');return;}

  const changed=date!==String(reservation.date||'') || time!==String(reservation.time||'') || type!==String(reservation.type||'');
  if(!changed){alert('변경된 사항이 없습니다.');return;}

  const isAi=isAiCounselingMethod(type);
  updateScheduleWithHistory(id,{
    date,time,type,
    aiCounseling:isAi,
    counselingDurationMinutes:isAi?50:null,
    reportRequired:isAi,
    reservationUpdatedAt:new Date().toISOString()
  },'예약정보 변경');
  alert('예약정보가 저장되었습니다.\n\n오늘 업무·전자차트·사용자 예약정보에 동일하게 반영됩니다.');
}
window.saveCurrentReservationChanges=saveCurrentReservationChanges;

function createAdminReservation(){
  const name=document.getElementById('admin-reservation-name')?.value?.trim()||'';
  const phone=document.getElementById('admin-reservation-phone')?.value?.trim()||'';
  const date=document.getElementById('admin-reservation-date')?.value?.trim()||'';
  const time=document.getElementById('admin-reservation-time')?.value?.trim()||'';
  const type=document.getElementById('admin-reservation-method')?.value?.trim()||'';
  const program=document.getElementById('admin-reservation-program')?.value?.trim()||'개별 심리검사';
  const testsRaw=document.getElementById('admin-reservation-tests')?.value?.trim()||'';
  if(!name){alert('내담자 이름을 입력해 주세요.');return;}
  if(!phone){alert('연락처를 입력해 주세요.');return;}
  if(!/^\d{4}-\d{2}-\d{2}$/.test(date)){alert('예약일자를 선택해 주세요.');return;}
  if(!type){alert('상담방식을 선택해 주세요.');return;}
  const allowed=counselingTimesForMethod(type);
  if(!allowed.includes(time)){alert(isAiCounselingMethod(type)?'24시 AI상담 시간은 00:00~23:30 사이에서 선택해 주세요.':'대면·화상 상담은 09:00~17:00 사이에서 선택해 주세요.');return;}
  const now=new Date();
  const id=Number(`${Date.now()}${Math.floor(Math.random()*1000).toString().padStart(3,'0')}`);
  const selectedTests=testsRaw.split(',').map(v=>v.trim()).filter(Boolean);
  const reservation={
    id,name,phone,date,time,type,program,selectedTests,requestedTests:selectedTests,
    status:'예약신청',source:'관리자 직접등록',adminCreated:true,
    aiCounseling:isAiCounselingMethod(type),
    counselingDurationMinutes:isAiCounselingMethod(type)?50:null,
    reportRequired:isAiCounselingMethod(type),
    createdAt:now.toISOString(),updatedAt:now.toISOString(),
    reservationNumber:`ADM-${String(now.getFullYear()).slice(-2)}${String(now.getMonth()+1).padStart(2,'0')}${String(now.getDate()).padStart(2,'0')}-${String(id).slice(-4)}`
  };
  state.reservations=mergeReservationsById([reservation],state.reservations);
  save('modumam_reservations',state.reservations);
  const inbox=mergeReservationsById([reservation],load('modumam_reservation_inbox',[]));
  save('modumam_reservation_inbox',inbox);
  save('modumam_last_reservation',reservation);
  putIndexedReservation(reservation).catch(error=>console.error('[관리자 예약 IndexedDB 저장]',error));
  appendAuditLog('관리자 예약 등록','modumam_reservations',`${name} · ${date} ${time}`);
  alert('관리자 예약을 등록했습니다.');
  render();
}
window.createAdminReservation=createAdminReservation;

function updateAdminReservationTimeOptions(){
  const method=document.getElementById('admin-reservation-method')?.value||'';
  const select=document.getElementById('admin-reservation-time');
  if(!select)return;
  const previous=select.value;
  const times=counselingTimesForMethod(method);
  select.innerHTML=times.map(t=>`<option value="${t}">${t}</option>`).join('');
  if(times.includes(previous))select.value=previous;
}
window.updateAdminReservationTimeOptions=updateAdminReservationTimeOptions;


function updateReservationTimeOptions(id){
  const method=document.getElementById(`reservation-method-${id}`)?.value||'';
  const select=document.getElementById(`reservation-time-${id}`);
  if(!select)return;
  const previous=select.value;
  const times=counselingTimesForMethod(method);
  select.innerHTML=times.map(t=>`<option value="${t}">${t}</option>`).join('');
  if(times.includes(previous)) select.value=previous;
  else if(times.length) select.value=times[0];
}
window.updateReservationTimeOptions=updateReservationTimeOptions;

function approveReservation(id){const r=state.reservations.find(x=>String(x.id)===String(id));const caseNumber=r?.caseNumber||findExistingCaseNumber(r||{},state.reservations)||nextCaseNumber(r||{},state.reservations);updateReservation(id,{status:'예약승인',caseNumber,approvedAt:new Date().toLocaleString()});}
function markPaymentComplete(id){updateReservation(id,{status:'결제완료',paidAt:new Date().toLocaleString()});}
function sendTestLinks(id){const r=state.reservations.find(x=>String(x.id)===String(id));if(!r)return;const ts={...(r.testStatuses||{})};requestedTests(r).forEach(t=>ts[t]=ts[t]&&ts[t]!=='미발송'?ts[t]:'발송완료');updateReservation(id,{status:'검사발송',testStatuses:ts,testLinksSentAt:new Date().toLocaleString()});}
function markTestComplete(id){const r=state.reservations.find(x=>String(x.id)===String(id));if(!r)return;const ts={...(r.testStatuses||{})};requestedTests(r).forEach(t=>ts[t]='검사완료');updateReservation(id,{status:'검사완료',testStatuses:ts,testCompletedAt:new Date().toLocaleString()});}
function markCounselingReady(id){updateReservation(id,{status:'상담준비',counselingReadyAt:new Date().toLocaleString()});}
function nextActionLabel(r){const st=normalizeStatus(r.status);if(st==='예약신청')return '예약 승인';if(st==='예약승인')return '결제 확인';if(st==='결제완료')return '검사 링크 발송';if(st==='검사발송')return '검사 완료 확인';if(st==='검사완료')return '결과 업로드';if(st==='결과업로드')return '상담 준비';if(st==='상담준비')return '상담 시작';if(st==='상담진행')return '상담 완료';if(st==='상담완료')return '종결';return '완료';}
function runNextAction(id){
  const r=state.reservations.find(
    x=>String(x.id)===String(id)
  );

  if(!r){
    alert('예약 정보를 찾지 못했습니다. 예약 새로 불러오기를 눌러 다시 확인해 주세요.');
    return;
  }

  const reservationId=r.id;
  const st=normalizeStatus(r.status);

  if(st==='예약신청')return approveReservation(reservationId);
  if(st==='예약승인')return markPaymentComplete(reservationId);
  if(st==='결제완료')return sendTestLinks(reservationId);
  if(st==='검사발송')return markTestComplete(reservationId);
  if(st==='검사완료')return updateReservation(reservationId,{status:'결과업로드'});
  if(st==='결과업로드')return markCounselingReady(reservationId);
  if(st==='상담준비')return updateReservation(reservationId,{status:'상담진행'});
  if(st==='상담진행')return updateReservation(reservationId,{
    status:'상담완료',
    completedAt:new Date().toLocaleString('ko-KR')
  });
  if(st==='상담완료')return updateReservation(reservationId,{
    status:'종결',
    closedAt:new Date().toLocaleString('ko-KR')
  });

  alert(st==='종결'?'이미 종결된 예약입니다.':'현재 단계에서는 다음 단계로 이동할 수 없습니다.');
}
window.runNextAction=runNextAction;

// [MOD-20260713-STATUS-ROLLBACK]
// 통합 진행상태를 한 단계 이전으로 되돌리고 변경 이력을 예약별로 확인합니다.
function previousWorkflowStatus(status){
  const steps=STATUS.filter(x=>x!=='예약취소');
  const idx=steps.indexOf(normalizeStatus(status));
  return idx>0?steps[idx-1]:'';
}

function moveReservationToPreviousStage(id){
  const r=state.reservations.find(x=>String(x.id)===String(id));
  if(!r){
    alert('예약 정보를 찾지 못했습니다.');
    return;
  }

  const current=normalizeStatus(r.status);
  const previousMap={
    '예약승인':'예약신청',
    '결제완료':'예약승인',
    '검사발송':'결제완료',
    '검사완료':'검사발송',
    '결과업로드':'검사완료',
    '상담준비':'결과업로드',
    '상담진행':'상담준비',
    '상담완료':'상담진행',
    '종결':'상담완료'
  };

  const previous=previousMap[current];

  if(!previous){
    alert('예약신청 단계에서는 더 이전으로 이동할 수 없습니다.');
    return;
  }

  if(!confirm(`${current}에서 ${previous}(으)로 되돌리시겠습니까?\n예약일정과 상담방식은 위에서 수정할 수 있습니다.`)){
    return;
  }

  updateReservation(r.id,{
    status:previous,
    workflowUpdatedAt:new Date().toLocaleString('ko-KR')
  });

  alert(`${previous} 단계로 이동했습니다.`);
}

window.moveReservationToPreviousStage=moveReservationToPreviousStage;

function rollbackReservationStatus(id){
  const r=state.reservations.find(x=>String(x.id)===String(id));
  if(!r)return;
  const prev=previousWorkflowStatus(r.status);
  if(!prev){alert('예약신청 이전 단계로는 되돌릴 수 없습니다.');return;}
  if(!confirm(`진행상태를 ${normalizeStatus(r.status)}에서 ${prev}(으)로 되돌릴까요?`))return;
  updateReservation(id,{status:prev,statusRollbackAt:new Date().toLocaleString('ko-KR')});
}
function statusHistoryPanel(r,limit=8){
  const history=Array.isArray(r.statusHistory)?r.statusHistory:[];
  if(!history.length)return '<p class="text-[11px] text-slate-400">아직 진행상태 변경 이력이 없습니다.</p>';
  return `<div class="space-y-2">${history.slice(0,limit).map(h=>`<div class="rounded-xl border border-slate-100 bg-white px-3 py-2"><div class="flex items-center justify-between gap-2"><p class="text-[11px] font-extrabold text-slate-700">${esc(h.before||'미정')} → ${esc(h.after||'미정')}</p><p class="text-[10px] text-slate-400">${esc(h.changedAt||'')}</p></div></div>`).join('')}</div>`;
}
function workflowRank(status){const i=STATUS.indexOf(normalizeStatus(status));return i<0?0:i}
function autoStatusDescription(r){const st=normalizeStatus(r.status);const map={예약신청:'예약 내용을 확인하고 승인하면 다음 단계로 이동합니다.',예약승인:'결제 확인 시 결제완료로 자동 이동합니다.',결제완료:'검사 링크 저장·발송 시 검사발송으로 자동 이동합니다.',검사발송:'신청 검사가 모두 완료되면 검사완료로 자동 이동합니다.',검사완료:'검사결과 파일을 업로드하면 결과업로드로 자동 이동합니다.',결과업로드:'결과보고서를 검토·공개하면 상담준비로 자동 이동합니다.',상담준비:'상담 시작 버튼을 누르면 상담진행으로 자동 이동합니다.',상담진행:'회기 저장 후 상담 완료 처리 시 상담완료로 이동합니다.',상담완료:'종결기록을 저장하면 종결로 이동합니다.',종결:'모든 운영 단계가 완료되었습니다.',예약취소:'취소된 예약입니다.'};return map[st]||''}
function updateTestStatus(id,t,s){
  const r=state.reservations.find(x=>String(x.id)===String(id));if(!r)return;
  const statuses={...(r.testStatuses||{}),[t]:s};
  const tests=requestedTests(r);
  const allComplete=tests.length>0&&tests.every(name=>['검사완료','결과확인'].includes(statuses[name]));
  const anySent=tests.some(name=>['발송완료','검사완료','결과확인'].includes(statuses[name]));
  let nextStatus=r.status;
  if(allComplete&&workflowRank(r.status)<workflowRank('검사완료')) nextStatus='검사완료';
  else if(anySent&&workflowRank(r.status)<workflowRank('검사발송')) nextStatus='검사발송';
  updateReservation(id,{testStatuses:statuses,status:nextStatus,testStatusUpdatedAt:new Date().toLocaleString('ko-KR')});
}
// [MOD-20260713-TEST-LINKS]
// 검사별 온라인 실시 링크를 예약정보에 저장하고 회원 마이페이지에 연결합니다.
function saveTestLink(id,testName,url){
  const clean=String(url||'').trim();
  if(clean && !/^https?:\/\//i.test(clean)){alert('검사 링크는 http:// 또는 https://로 시작해야 합니다.');render();return;}
  const r=state.reservations.find(x=>String(x.id)===String(id));if(!r)return;
  const links={...(r.testLinks||{}),[testName]:clean};
  const statuses={...(r.testStatuses||{})};
  if(clean && (!statuses[testName]||statuses[testName]==='미발송')) statuses[testName]='발송완료';
  updateReservation(id,{testLinks:links,testStatuses:statuses,status:clean?'검사발송':r.status,testLinksUpdatedAt:new Date().toLocaleString('ko-KR')});
}
function openTestLink(id,testName){const r=state.reservations.find(x=>String(x.id)===String(id));const url=r?.testLinks?.[testName];if(!url)return alert('저장된 검사 링크가 없습니다.');window.open(url,'_blank','noopener,noreferrer')}
function copyMemberTestLinks(id){
  const r=state.reservations.find(x=>String(x.id)===String(id));if(!r)return;
  const links=Object.entries(r.testLinks||{}).filter(([,url])=>String(url||'').trim());
  if(!links.length)return alert('저장된 검사 링크가 없습니다.');
  const lines=links.map(([name,url])=>`■ ${name}\n${url}`).join('\n\n');
  copyText(`${r.name}님, 안녕하세요.\n모두의 마음연구소입니다.\n\n신청하신 심리검사 링크를 안내드립니다.\n\n${lines}\n\n검사를 완료하신 뒤 회신해 주세요.\n감사합니다.`);
}
function markAllTestsSent(id){const r=state.reservations.find(x=>String(x.id)===String(id));if(!r)return;const ts={};requestedTests(r).forEach(t=>ts[t]='발송완료');updateReservation(id,{testStatuses:ts,status:'검사발송',testLinksSentAt:new Date().toLocaleString()})}
function saveMemo(id){const el=document.getElementById('memo-'+id);if(!el)return;updateReservation(id,{adminMemo:el.value});alert('관리자 메모가 저장되었습니다.')}
async function deleteIndexedReservation(id){
  try{
    const db=await openModumamDatabase();
    await new Promise((resolve,reject)=>{
      const tx=db.transaction(MODUMAM_RESERVATION_STORE,'readwrite');
      tx.objectStore(MODUMAM_RESERVATION_STORE).delete(id);
      tx.oncomplete=resolve;
      tx.onerror=()=>reject(tx.error||new Error('예약 삭제 실패'));
      tx.onabort=()=>reject(tx.error||new Error('예약 삭제 중단'));
    });
    db.close();
  }catch(error){
    console.error('[예약 IndexedDB 삭제]',error);
  }
}

// 해당 예약 1건만 삭제합니다. 내담자의 다른 예약·상담·검사·보고서 기록은 유지합니다.
async function deleteReservation(id){
  const target=state.reservations.find(r=>String(r.id)===String(id));
  if(!target){alert('삭제할 예약을 찾지 못했습니다.');return;}
  if(!confirm(`${target.name||'내담자'}님의 이 예약만 삭제하시겠습니까?\n\n다른 예약과 상담·검사·보고서 기록은 유지됩니다.`))return;

  state.reservations=state.reservations.filter(r=>String(r.id)!==String(id));
  localStorage.setItem('modumam_reservations',JSON.stringify(state.reservations));

  const inbox=load('modumam_reservation_inbox',[]).filter(r=>String(r.id)!==String(id));
  localStorage.setItem('modumam_reservation_inbox',JSON.stringify(inbox));

  const last=load('modumam_last_reservation',null);
  if(last&&String(last.id)===String(id)) localStorage.removeItem('modumam_last_reservation');

  await deleteIndexedReservation(target.id);
  appendAuditLog('예약만 삭제',String(id),`${target.name||''} ${target.date||''} ${target.time||''}`);
  alert('해당 예약만 삭제되었습니다.');
  render();
}

// 동일 내담자의 예약과 연결된 상담·검사·보고서·사례자료를 모두 삭제합니다.
async function deleteClientCompletelyByReservation(id){
  const target=state.reservations.find(r=>String(r.id)===String(id));
  if(!target){alert('삭제할 내담자를 찾지 못했습니다.');return;}
  const key=clientKey(target.name,target.phone);
  const clientReservations=state.reservations.filter(r=>clientKey(r.name,r.phone)===key);
  const reservationIds=new Set(clientReservations.map(r=>String(r.id)));
  const caseIds=new Set(clientReservations.map(caseIdFromReservation));

  const first=confirm(`${target.name||'내담자'}님의 전체 자료를 삭제하시겠습니까?\n\n삭제 대상:\n- 모든 예약\n- 상담일지·회기기록\n- 검사결과·보고서\n- AI 결과상담·사례개념화·상담계획\n\n이 작업은 되돌릴 수 없습니다.`);
  if(!first)return;
  const typed=prompt('실수 방지를 위해 "전체삭제"를 입력해 주세요.','');
  if(typed!=='전체삭제'){alert('전체삭제가 취소되었습니다.');return;}

  state.reservations=state.reservations.filter(r=>clientKey(r.name,r.phone)!==key);
  state.intakes=state.intakes.filter(x=>clientKey(x.name,x.phone)!==key);
  state.reports=state.reports.filter(x=>!reservationIds.has(String(x.reservationId))&&clientKey(x.clientName,x.phone)!==key);
  state.resultUploads=state.resultUploads.filter(x=>!reservationIds.has(String(x.reservationId))&&clientKey(x.clientName,x.phone)!==key);
  state.aiResultCounselingRecords=(state.aiResultCounselingRecords||[]).filter(x=>!reservationIds.has(String(x.reservationId))&&clientKey(x.clientName,x.phone)!==key);
  state.assessmentAnalyses=(state.assessmentAnalyses||[]).filter(x=>!reservationIds.has(String(x.reservationId))&&clientKey(x.clientName,x.phone)!==key);
  state.assessmentCrossAnalyses=(state.assessmentCrossAnalyses||[]).filter(x=>!reservationIds.has(String(x.reservationId))&&clientKey(x.clientName,x.phone)!==key);
  state.testInterpretations=(state.testInterpretations||[]).filter(x=>!reservationIds.has(String(x.reservationId))&&clientKey(x.clientName,x.phone)!==key);

  localStorage.setItem('modumam_reservations',JSON.stringify(state.reservations));
  localStorage.setItem('modumam_intake_summaries',JSON.stringify(state.intakes));
  persistReports(state.reports);
  localStorage.setItem('modumam_test_result_uploads',JSON.stringify(state.resultUploads));
  localStorage.setItem('modumam_ai_result_counseling_records',JSON.stringify(state.aiResultCounselingRecords));
  localStorage.setItem('modumam_assessment_analyses',JSON.stringify(state.assessmentAnalyses));
  localStorage.setItem('modumam_assessment_cross_analyses',JSON.stringify(state.assessmentCrossAnalyses));
  localStorage.setItem('modumam_test_interpretations',JSON.stringify(state.testInterpretations));

  const inbox=load('modumam_reservation_inbox',[]).filter(r=>clientKey(r.name,r.phone)!==key);
  localStorage.setItem('modumam_reservation_inbox',JSON.stringify(inbox));
  const last=load('modumam_last_reservation',null);
  if(last&&clientKey(last.name,last.phone)===key) localStorage.removeItem('modumam_last_reservation');

  localStorage.removeItem('modumam_counseling_notes_'+key);
  localStorage.removeItem('modumam_client_profile_'+key);
  for(const caseId of caseIds){
    localStorage.removeItem('modumam_case_formulation_'+caseId);
    localStorage.removeItem('modumam_case_sessions_'+caseId);
    localStorage.removeItem('modumam_counseling_plan_'+caseId);
    localStorage.removeItem('modumam_counseling_aid_'+caseId);
  }
  for(const reservation of clientReservations) await deleteIndexedReservation(reservation.id);

  appendAuditLog('내담자 전체 삭제',key,`${target.name||''} 예약 ${clientReservations.length}건 및 연결자료`);
  alert('내담자의 예약과 연결된 전체 자료가 삭제되었습니다.');
  render();
}
window.deleteReservation=deleteReservation;
window.deleteClientCompletelyByReservation=deleteClientCompletelyByReservation;

function reportRequestReservationId(item){
  return String(item?.reservationId??item?.bookingId??item?.sourceReservationId??'');
}
function cleanCancelledReservationRelations(reservationId){
  const id=String(reservationId||'');
  const requestKeys=['modumam_assessment_report_requests_v1','modumam_assessment_report_requests','modumam_report_requests'];
  requestKeys.forEach(key=>{
    const rows=load(key,[]);
    if(!Array.isArray(rows))return;
    const next=rows.filter(item=>reportRequestReservationId(item)!==id);
    try{localStorage.setItem(key,JSON.stringify(next));}catch(error){console.warn('[취소예약 보고서신청 정리]',key,error);}
  });

  // 승인된 보고서는 보존하고, 해당 예약의 미승인 초안만 정리합니다.
  const reports=(window.MMLReportStore?.loadAll?.()||state.reports||[]);
  const nextReports=reports.filter(report=>{
    if(String(report.reservationId||'')!==id)return true;
    return Boolean(report.approvedForClient||report.approved||report.status==='approved'||report.reviewStatus==='approved');
  });
  if(nextReports.length!==reports.length){
    try{persistReports(nextReports);}catch(error){console.warn('[취소예약 미승인보고서 정리]',error);}
  }

  const draftKeys=['modumam_assessment_report_drafts','modumam_integrated_report_drafts'];
  draftKeys.forEach(key=>{
    const rows=load(key,[]);
    if(!Array.isArray(rows))return;
    try{localStorage.setItem(key,JSON.stringify(rows.filter(item=>String(item?.reservationId||'')!==id)));}catch(_){ }
  });
}

async function deleteCancelledReservation(id){
  const target=state.reservations.find(r=>String(r.id)===String(id));
  if(!target){alert('삭제할 예약을 찾지 못했습니다.');return;}
  if(normalizeStatus(target.status)!=='예약취소'){
    alert('예약취소 상태의 예약만 삭제할 수 있습니다. 먼저 예약을 취소해 주세요.');
    return;
  }
  const approved=(window.MMLReportStore?.loadAll?.()||state.reports||[]).filter(report=>
    String(report.reservationId||'')===String(id)&&Boolean(report.approvedForClient||report.approved||report.status==='approved'||report.reviewStatus==='approved')
  ).length;
  const message=`${target.name||'내담자'}님의 취소된 예약을 삭제하시겠습니까?\n\n삭제: 예약정보, 보고서 신청, 미승인 보고서 초안\n보존: 승인 보고서 ${approved}건, 상담일지, 사례관리 기록\n\n이 작업은 되돌릴 수 없습니다.`;
  if(!confirm(message))return;

  markReservationDeleted(id);
  state.reservations=state.reservations.filter(r=>String(r.id)!==String(id));
  const nextReservations=excludeDeletedReservations(state.reservations);
  try{
    localStorage.setItem('modumam_reservations',JSON.stringify(nextReservations));
    state.reservations=nextReservations;
  }catch(error){
    unmarkReservationDeleted(id);
    alert('예약 저장공간이 부족합니다. 브라우저 저장소를 정리한 뒤 다시 시도해 주세요.');
    return;
  }
  const inbox=excludeDeletedReservations(load('modumam_reservation_inbox',[]).filter(r=>String(r.id)!==String(id)));
  try{localStorage.setItem('modumam_reservation_inbox',JSON.stringify(inbox));}catch(_){ }
  const last=load('modumam_last_reservation',null);
  if(last&&String(last.id)===String(id))localStorage.removeItem('modumam_last_reservation');
  cleanCancelledReservationRelations(id);
  await deleteIndexedReservation(target.id);
  let serverDeleted=false;
  try{
    if(window.MMLServerStore?.removeEntity){
      await window.MMLServerStore.removeEntity('modumam_reservations',String(id),{
        action:'reservation.delete',
        reservationId:String(id),
        actor:'관리자',
        source:'admin'
      });
      serverDeleted=true;
    }
  }catch(error){
    console.warn('[취소예약 서버 개별삭제 실패]',error);
  }
  try{
    const queueKey='modumam_server_sync_queue_v37';
    const rows=JSON.parse(localStorage.getItem(queueKey)||'[]');
    const filtered=(Array.isArray(rows)?rows:[]).filter(item=>{
      if(item?.key!=='modumam_reservations')return true;
      const rid=String(item?.meta?.reservationId||item?.entityId||'');
      return rid!==String(id);
    });
    localStorage.setItem(queueKey,JSON.stringify(filtered));
  }catch(_){ }
  try{window.MMLDataStore?.invalidate?.('modumam_reservations');}catch(_){ }
  try{window.dispatchEvent(new CustomEvent('mml:reservation-deleted',{detail:{id:String(id),serverDeleted}}));}catch(_){ }
  state.reservations=excludeDeletedReservations(state.reservations);
  render();
  alert(serverDeleted
    ? '취소된 예약을 완전히 삭제했습니다. 승인 보고서와 상담·사례 기록은 유지됩니다.'
    : '예약은 현재 화면과 로컬 저장소에서 삭제했습니다. 서버 연결이 복구되면 차단목록 기준으로 계속 숨김 처리됩니다.');
}

function restoreCancelledReservation(id){
  const target=state.reservations.find(r=>String(r.id)===String(id));
  if(!target){alert('복원할 예약을 찾지 못했습니다.');return;}
  if(normalizeStatus(target.status)!=='예약취소')return;
  const previous=String(target.cancelPreviousStatus||target.previousStatus||'예약신청');
  const restoreStatus=['예약취소','취소요청'].includes(normalizeStatus(previous))?'예약신청':normalizeStatus(previous);
  if(!confirm(`${target.name||'내담자'}님의 예약을 ${restoreStatus} 단계로 복원할까요?`))return;
  unmarkReservationDeleted(id);
  updateReservation(id,{status:restoreStatus,cancelledAt:'',cancelApprovedAt:'',cancelReason:'',restoredAt:new Date().toLocaleString('ko-KR')});
  alert('예약을 복원했습니다.');
}

window.deleteCancelledReservation=deleteCancelledReservation;
window.restoreCancelledReservation=restoreCancelledReservation;

function copyText(t){navigator.clipboard.writeText(t).then(()=>alert('복사되었습니다.'))}
function copyPaymentMessage(id){const r=state.reservations.find(x=>String(x.id)===String(id));if(!r)return;const p=getPaymentInfo(r);copyText(`${r.name}님, 안녕하세요.\n모두의 마음연구소입니다.\n\n예약 신청이 확인되었습니다.\n\n■ 신청 프로그램\n${programBaseName(r.program)}\n\n■ 상담 방식\n${r.type}\n\n■ 희망 일정\n${r.date} ${r.time}\n\n■ 결제 금액\n${p.total}\n${p.detail}\n\n■ 입금 계좌\n카카오뱅크 3333-21-2787124\n예금주 : 백인영\n\n입금 확인 후 검사 링크를 발송해 드리겠습니다.\n\n감사합니다.\n모두의 마음연구소`)}
window.copyPaymentMessage=copyPaymentMessage;
const TEST_PROVIDER_PORTALS={
  insight:{name:'인싸이트검사',defaultUrl:'https://inpsyt.co.kr/mypage/dashboard/list'},
  maumsarang:{name:'마음사랑검사',defaultUrl:'https://mscore.kr/'}
};
function getTestProviderUrl(provider){
  const info=TEST_PROVIDER_PORTALS[provider];
  if(!info)return'';
  return localStorage.getItem(`modumam_test_provider_${provider}_url`)||info.defaultUrl;
}
function saveTestProviderUrl(provider){
  const info=TEST_PROVIDER_PORTALS[provider];
  const input=document.getElementById(`test-provider-url-${provider}`);
  const url=String(input?.value||'').trim();
  if(!info||!url){alert('검사기관 링크를 입력해 주세요.');return;}
  try{new URL(url);}catch{alert('올바른 링크를 입력해 주세요.');return;}
  localStorage.setItem(`modumam_test_provider_${provider}_url`,url);
  alert(`${info.name} 링크가 저장되었습니다.`);
}
function openTestProviderUrl(provider){
  const url=getTestProviderUrl(provider);
  if(!url){alert('저장된 링크가 없습니다.');return;}
  window.open(url,'_blank','noopener,noreferrer');
}
window.saveTestProviderUrl=saveTestProviderUrl;
window.openTestProviderUrl=openTestProviderUrl;

function copyTestGuide(id){
  const r=state.reservations.find(x=>String(x.id)===String(id));
  if(!r)return;
  copyText(`${r.name}님, 안녕하세요.
모두의 마음연구소입니다.

입금이 정상적으로 확인되었습니다. 감사합니다.

이제 신청하신 심리검사를 진행하실 수 있도록 안내드립니다.

■ 신청 프로그램
${programBaseName(r.program)}

■ 진행 검사
${requestedTests(r).map(t=>'- '+t).join('\n')}

검사 링크를 순차적으로 발송해 드리겠습니다.
안내에 따라 검사를 진행해 주세요.

검사를 모두 완료하시면 결과를 분석한 후, 예약된 상담 일정에 맞춰 해석상담을 진행해 드리겠습니다.

검사 진행 중 궁금한 사항이 있으시면 편하게 문의해 주세요.

감사합니다.
모두의 마음연구소`)
}
window.copyTestGuide=copyTestGuide;

function copyDocumentReminder(id){
  const r=state.reservations.find(x=>String(x.id)===String(id));if(!r)return;
  const target=['장소 조율(대면)','찾아가는(대면)','대면','찾아오는 대면','비대면 화상'].some(t=>String(r.type||'').includes(t));
  copyText(`${r.name}님, 안녕하세요.
모두의 마음연구소입니다.

${r.date||''} ${r.time||''} 예약 상담 준비를 위해 상담신청서와 심리상담 동의서를 안내드립니다.

■ 상담 방식
${r.type||''}

■ 상담 준비 서류
상담신청서: ${FORM_LINKS.application}
심리상담 동의서: ${FORM_LINKS.consent}

작성은 약 5분 정도 소요됩니다. 홈페이지 예약 과정에서 이미 전자 신청서와 동의서를 제출하신 경우에는 별도 제출이 필요하지 않을 수 있습니다.

${target?'예약일 3일 전 안내입니다. 상담 준비를 위해 상담 전까지 확인 부탁드립니다.':'전화/문자 상담의 경우 필요한 경우에만 서류 확인을 요청드립니다.'}

감사합니다.
모두의 마음연구소`)
}
function openIntake(id){const r=state.reservations.find(x=>String(x.id)===String(id));const i=r?findIntake(r):null;alert(i?(i.summary||'요약 없음'):'연결된 AI 마음 체크인 요약이 없습니다.')}
function reportCode(r){return r.code||('MR-'+String(r.id).slice(-6))}
function setReportFromReservation(id){const r=state.reservations.find(x=>String(x.id)===String(id));if(!r)return;const base=programBaseName(r.program);const program=['개별 심리검사','개인 마음이음','부부 마음이음','부모-자녀 마음이음'].find(x=>String(base).includes(x))||'개별 심리검사';const defaults=program==='부모-자녀 마음이음'?['PAT','K-CDI']:['TCI'];state.reportForm={...emptyReportForm(),reservationId:id,clientName:r.name||'',phone:r.phone||'',program,selectedTests:defaults,testType:defaults.join(', '),title:`${r.name||'내담자'}님 심리검사 요약보고서`};state.menu='report';render()}
window.setReportFromReservation=setReportFromReservation;
function templateReport(){applyDetailedTemplate()}
function createReport(e){
  e.preventDefault();
  const now=new Date().toLocaleString();
  let rep;
  if(state.reportEditingId){
    const old=state.reports.find(r=>r.id===state.reportEditingId);
    if(!old)return;
    const history=Array.isArray(old.versionHistory)?old.versionHistory:[];
    const snapshot={version:Number(old.version||1),savedAt:old.updatedAt||old.createdAt||now,summary:old.summary||'',strength:old.strength||'',caution:old.caution||'',plan:old.plan||'',title:old.title||''};
    rep={...old,...state.reportForm,version:Number(old.version||1)+1,updatedAt:now,versionHistory:[snapshot,...history].slice(0,10),approvedForClient:false};
    state.reports=state.reports.map(r=>r.id===old.id?rep:r);
  }else{
    const id=Date.now();
    rep={...state.reportForm,id,code:'MR-'+String(id).slice(-6),reportType:'summaryReport',summaryReport:true,approvedForClient:false,createdAt:now,updatedAt:now,version:1,versionHistory:[]};
    state.reports=[rep,...state.reports];
  }
  persistReports(state.reports);
  if(rep.reservationId){state.reservations=state.reservations.map(r=>r.id===rep.reservationId?{...r,status:'결과업로드'}:r);save('modumam_reservations',state.reservations)}
  state.reportForm=emptyReportForm();state.reportEditingId=null;
  alert('심리검사 요약보고서가 저장되었습니다. 이 보고서는 내부 검토용이며 승인·홈페이지 공개 대상이 아닙니다.');render();
}
function editReport(id){const r=state.reports.find(x=>String(x.id)===String(id));if(!r)return;state.reportEditingId=id;const selected=sanitizeReportTests(Array.isArray(r.selectedTests)&&r.selectedTests.length?r.selectedTests:(r.testType||'TCI'));state.reportForm={...emptyReportForm(),reportType:'summaryReport',summaryReport:true,reservationId:r.reservationId||'',clientName:r.clientName||'',phone:r.phone||'',program:programBaseName(r.program)||'개별 심리검사',testType:r.testType||selected.join(', '),selectedTests:selected,title:r.title||'',summary:r.summary||r.coreMind||'',mindProfile:r.mindProfile||r.strength||'',individualTests:r.individualTests||'',emotionState:r.emotionState||r.caution||'',thinkingRelationship:r.thinkingRelationship||'',stressDaily:r.stressDaily||'',plan:r.plan||r.expertRecovery||'',strength:r.strength||'',caution:r.caution||''};state.menu='report';render();window.scrollTo({top:0,behavior:'smooth'})}
function cancelReportEdit(){state.reportEditingId=null;state.reportForm=emptyReportForm();render()}
function resolveIndividualReportAnalysis(report){
  if(!report)return null;
  const analyses=Array.isArray(state.assessmentAnalyses)?state.assessmentAnalyses:[];
  let analysis=analyses.find(x=>String(x.id)===String(report.analysisId));
  if(!analysis&&report.reservationId){
    analysis=analyses.find(x=>String(x.reservationId)===String(report.reservationId)&&String(x.testType||'').trim()===String(report.testType||'').trim());
  }
  if(!analysis&&window.MMLClinicalAssessmentStore&&report.reservationId){
    const record=window.MMLClinicalAssessmentStore.getRecord(report.reservationId);
    analysis=(record?.tests||[]).find(x=>String(x.id)===String(report.analysisId))
      ||(record?.tests||[]).find(x=>String(x.testType||'').trim()===String(report.testType||'').trim());
  }
  if(!analysis&&report.analysisSnapshot&&typeof report.analysisSnapshot==='object')analysis={...report.analysisSnapshot};
  if(!analysis&&report.sections){
    analysis={
      id:report.analysisId||`report-${report.id}`,
      reservationId:report.reservationId,
      clientName:report.clientName||'',phone:report.phone||'',program:report.program||'',testType:report.testType||'',
      validity:report.sections.validity||'',sourceSummary:report.sections.summary||report.summary||'',coreFindings:report.sections.coreFindings||report.summary||'',
      strengths:report.sections.strengths||report.strength||'',vulnerabilities:report.sections.vulnerabilities||report.caution||'',
      emotionalPattern:report.sections.emotionalPattern||'',thinkingPattern:report.sections.thinkingPattern||'',relationshipPattern:report.sections.relationshipPattern||'',
      stressPattern:report.sections.stressPattern||'',dailyMeaning:report.sections.dailyMeaning||'',helpfulDirections:report.sections.helpfulDirections||'',
      cautions:report.sections.vulnerabilities||report.caution||'',reviewed:true,status:report.status||'상담자 승인 완료'
    };
  }
  if(analysis&&!analyses.some(x=>String(x.id)===String(analysis.id))){
    state.assessmentAnalyses=[analysis,...analyses];
  }
  return analysis||null;
}
function resolveAdminReportActionTarget(id){
  const key=String(id||'');
  let report=(state.reports||[]).find(x=>String(x?.id)===key)||null;
  if(report)return report;
  const pools=[];
  try{const rows=window.MMLReportStore?.read?.();if(Array.isArray(rows))pools.push(...rows)}catch(_){ }
  try{const rows=window.MMLCanonicalReportStore?.read?.();if(Array.isArray(rows))pools.push(...rows)}catch(_){ }
  report=pools.find(x=>String(x?.id)===key)||null;
  if(report){
    state.reports=[report,...(state.reports||[]).filter(x=>String(x?.id)!==key)];
    try{persistReports(state.reports)}catch(_){ }
  }
  return report;
}
function editIndividualAssessmentReport(id){
  const report=resolveAdminReportActionTarget(id);
  if(!report||!report.individualAssessmentReport){alert('개별 심리검사 보고서 원본을 찾지 못했습니다. 보고서 저장 후 다시 시도해 주세요.');return;}
  const analysis=resolveIndividualReportAnalysis(report);
  if(!analysis){alert('개별검사 보고서 자료를 복원하지 못했습니다. 심리평가센터에서 해당 검사를 다시 확인해 주세요.');return;}
  if(typeof buildIndividualAssessmentReportHtml!=='function'||typeof individualAssessmentReportCss!=='function'){
    alert('공통 보고서 렌더러를 불러오지 못했습니다. 관리자 페이지를 새로고침해 주세요.');return;
  }
  document.getElementById('mml-individual-report-editor')?.remove();
  const modal=document.createElement('div');
  modal.id='mml-individual-report-editor';
  modal.style.cssText='position:fixed;inset:0;z-index:10020;background:rgba(15,23,42,.72);overflow:auto;padding:14px;font-family:Pretendard,Arial,sans-serif';
  modal.innerHTML=`<style>
    #mml-individual-report-editor *{box-sizing:border-box}
    #mml-individual-report-editor .mml-shared-editor-shell{width:min(1120px,100%);margin:0 auto;background:#e8eeeb;border-radius:18px;overflow:hidden;box-shadow:0 30px 80px rgba(15,23,42,.35)}
    #mml-individual-report-editor .mml-shared-toolbar{position:sticky;top:0;z-index:20;display:flex;align-items:center;justify-content:space-between;gap:12px;padding:13px 16px;background:rgba(255,255,255,.98);border-bottom:1px solid #d7e0dc}
    #mml-individual-report-editor .mml-shared-toolbar h2{margin:0;font-size:17px;color:#123f33}#mml-individual-report-editor .mml-shared-toolbar p{margin:4px 0 0;font-size:11px;color:#64748b}
    #mml-individual-report-editor .mml-shared-actions{position:sticky;bottom:0;z-index:20;display:flex;justify-content:flex-end;flex-wrap:wrap;gap:8px;padding:12px 16px;background:rgba(255,255,255,.98);border-top:1px solid #d7e0dc}
    #mml-individual-report-editor .mml-shared-btn{border:0;border-radius:10px;padding:10px 14px;font-weight:800;cursor:pointer}.mml-shared-btn.preview{background:#059669;color:#fff}.mml-shared-btn.print{background:#ea580c;color:#fff}.mml-shared-btn.save{background:#0f172a;color:#fff}.mml-shared-btn.close{background:#fff;color:#334155;border:1px solid #cbd5e1}
    ${individualAssessmentReportCss()}
    #mml-individual-report-editor .mml-signature-report{padding:18px 0}
  </style>
  <div class="mml-shared-editor-shell">
    <div class="mml-shared-toolbar"><div><h2>${esc(individualReportTitle(analysis.testType))}</h2><p>생성된 결과보고서를 확인한 뒤 저장합니다.</p></div><button class="mml-shared-btn close" type="button" onclick="closeIndividualAssessmentReportEditor()">닫기</button></div>
    <div class="mml-shared-report-body">${buildIndividualAssessmentReportHtml(analysis,false,true)}</div>
    <div class="mml-shared-actions"><button class="mml-shared-btn save" type="button" onclick="saveIndividualAssessmentReportFromChart('${report.id}','${analysis.id}')">생성된 결과보고서 저장</button></div>
  </div>`;
  modal.addEventListener('click',e=>{if(e.target===modal)closeIndividualAssessmentReportEditor();});
  document.body.appendChild(modal);
}
function readIndividualEditorDraft(analysisId){
  const old=(state.assessmentAnalyses||[]).find(x=>String(x.id)===String(analysisId));
  if(!old)return null;
  const keys=['sourceSummary','validity','coreFindings','strengths','vulnerabilities','helpfulDirections','crossChecks','caseHypotheses','cautions','emotionalPattern','thinkingPattern','relationshipPattern','stressPattern','dailyMeaning'];
  const values={};
  keys.forEach(k=>{const el=document.getElementById(`assessment-${analysisId}-${k}`);values[k]=el?String(el.innerText||'').trim():(old[k]||'');});
  return {...old,...values};
}
function previewIndividualAssessmentReportFromEditor(analysisId){
  const index=(state.assessmentAnalyses||[]).findIndex(x=>String(x.id)===String(analysisId));
  const draft=readIndividualEditorDraft(analysisId);if(index<0||!draft)return;
  const original=state.assessmentAnalyses[index];state.assessmentAnalyses[index]=draft;
  try{previewIndividualAssessmentReport(analysisId);}finally{state.assessmentAnalyses[index]=original;}
}
function printIndividualAssessmentReportFromEditor(analysisId){
  const index=(state.assessmentAnalyses||[]).findIndex(x=>String(x.id)===String(analysisId));
  const draft=readIndividualEditorDraft(analysisId);if(index<0||!draft)return;
  const original=state.assessmentAnalyses[index];state.assessmentAnalyses[index]=draft;
  try{printIndividualAssessmentReport(analysisId);}finally{state.assessmentAnalyses[index]=original;}
}
window.previewIndividualAssessmentReportFromEditor=previewIndividualAssessmentReportFromEditor;
window.printIndividualAssessmentReportFromEditor=printIndividualAssessmentReportFromEditor;
function closeIndividualAssessmentReportEditor(){document.getElementById('mml-individual-report-editor')?.remove()}
function saveIndividualAssessmentReportFromChart(reportId,analysisId){
  const report=state.reports.find(x=>String(x.id)===String(reportId));
  const index=(state.assessmentAnalyses||[]).findIndex(x=>String(x.id)===String(analysisId));
  if(!report||index<0)return;
  const old=state.assessmentAnalyses[index];
  const keys=['sourceSummary','validity','coreFindings','strengths','vulnerabilities','helpfulDirections','counselingQuestions','crossChecks','caseHypotheses','cautions','emotionalPattern','thinkingPattern','relationshipPattern','stressPattern','dailyMeaning'];
  const value=k=>{const el=document.getElementById(`assessment-${analysisId}-${k}`);return String(el?.value??el?.innerText??old[k]??'').trim();};
  const now=new Date().toLocaleString('ko-KR');
  const edited={...old,...Object.fromEntries(keys.map(k=>[k,value(k)])),reviewed:true,needsReview:false,status:'상담자 검토 완료',reviewedAt:now,updatedAt:now};
  const next=typeof syncIndividualClientReport==='function'?syncIndividualClientReport(edited):edited;
  state.assessmentAnalyses[index]=next;
  save('modumam_assessment_analyses',state.assessmentAnalyses);
  const history=Array.isArray(report.versionHistory)?report.versionHistory:[];
  const snapshot={version:Number(report.version||1),savedAt:report.updatedAt||report.createdAt||now,title:report.title||'',summary:old.coreFindings||old.sourceSummary||'',individualFields:Object.fromEntries(keys.map(k=>[k,old[k]||'']))};
  const nextSections={...(report.sections||{}),sourceSummary:next.sourceSummary,validity:next.validity,coreFindings:next.coreFindings,strengths:next.strengths,vulnerabilities:next.vulnerabilities,helpfulDirections:next.helpfulDirections,counselingQuestions:next.counselingQuestions,emotionalPattern:next.emotionalPattern,thinkingPattern:next.thinkingPattern,relationshipPattern:next.relationshipPattern,stressPattern:next.stressPattern,dailyMeaning:next.dailyMeaning,cautions:next.cautions,summary:next.coreFindings||next.sourceSummary||''};
  state.reports=state.reports.map(x=>String(x.id)===String(reportId)?{...x,
    sections:nextSections,summary:nextSections.summary,strength:nextSections.strengths,caution:nextSections.vulnerabilities,plan:nextSections.helpfulDirections,
    // [MML-20260808-INDIVIDUAL-APPROVAL-LIFECYCLE-S13]
    // 전문가가 한 글자라도 수정·저장하면 승인 당시 문서와 현재 문서가 달라지므로 승인을 자동 해제합니다.
    approved:false,approvedForClient:false,clientVisible:false,published:false,
    approvedReportHtml:'',approvedReportHtmlVersion:0,approvedAt:'',approvedBy:'',publishedAt:'',
    reviewStatus:'saved',status:'저장완료 · 승인대기',approvalUpdatedAt:now,
    updatedAt:now,version:Number(x.version||1)+1,versionHistory:[snapshot,...history].slice(0,10)
  }:x);
  persistReports(state.reports);
  try{window.MMLClientReportPublication?.sync?.({force:true,reason:'individual-report-edited'});}catch(error){console.warn('[MML] 개별보고서 수정 후 공개상태 갱신 실패',error);}
  closeIndividualAssessmentReportEditor();
  alert('수정된 결과보고서를 저장했습니다. 내용이 변경되어 기존 승인은 해제되었습니다. 다시 승인하면 사용자에게 공개됩니다.');
  render();
}
window.editIndividualAssessmentReport=editIndividualAssessmentReport;
window.closeIndividualAssessmentReportEditor=closeIndividualAssessmentReportEditor;
window.saveIndividualAssessmentReportFromChart=saveIndividualAssessmentReportFromChart;
function restoreReportVersion(id,index){const r=state.reports.find(x=>String(x.id)===String(id));const h=(r&&r.versionHistory||[])[index];if(!r||!h)return;if(!confirm('선택한 이전 버전을 새 버전으로 복원하시겠습니까?'))return;const now=new Date().toLocaleString();const current={version:Number(r.version||1),savedAt:r.updatedAt||r.createdAt||now,summary:r.summary||'',strength:r.strength||'',caution:r.caution||'',plan:r.plan||'',title:r.title||''};state.reports=state.reports.map(x=>x.id===id?{...x,title:h.title||x.title,summary:h.summary||'',strength:h.strength||'',caution:h.caution||'',plan:h.plan||'',version:Number(x.version||1)+1,updatedAt:now,approvedForClient:false,versionHistory:[current,...(x.versionHistory||[])].slice(0,10)}:x);persistReports(state.reports);render()}
async function generateReportDraft(){
  const tests=sanitizeReportTests(state.reportForm.selectedTests);
  if(!state.reportForm.clientName||!state.reportForm.program||!tests.length){alert('예약자, 프로그램, 추가검사를 먼저 선택해 주세요.');return}
  state.reportForm.testType=tests.join(', ');
  const uploads=state.resultUploads.filter(u=>String(u.clientName||'').trim()===String(state.reportForm.clientName||'').trim() || (u.phone&&String(u.phone).replace(/\D/g,'')===String(state.reportForm.phone||'').replace(/\D/g,'')));
  const intake=state.intakes.find(i=>String(i.name||'').trim()===String(state.reportForm.clientName||'').trim() || (i.phone&&String(i.phone).replace(/\D/g,'')===String(state.reportForm.phone||'').replace(/\D/g,'')));
  const uploadSummary=uploads.filter(u=>tests.some(t=>String(u.testType||u.testName||'').toUpperCase().includes(String(t).toUpperCase().replace('K-CDI','KCDI')))).map(u=>`${u.testType||u.testName||'검사'}: ${u.summary||u.memo||'요약 미입력'}`).join('\n') || uploads.map(u=>`${u.testType||u.testName||'검사'}: ${u.summary||u.memo||'요약 미입력'}`).join('\n');
  state.reportDraftLoading=true;render();
  try{
    const payload={clientName:state.reportForm.clientName,program:state.reportForm.program,testType:tests.join(', '),selectedTests:tests,uploadSummary,intakeSummary:intake?.summary||intake?.concern||'',adminMemo:''};
    const endpoints=['/.netlify/functions/summary-report','/.netlify/functions/report-draft'];
    let data=null; let lastError='';
    for(const endpoint of endpoints){
      try{
        const response=await fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});
        const raw=await response.text();
        let parsed={}; try{parsed=raw?JSON.parse(raw):{}}catch(_){parsed={}}
        if(response.ok&&parsed.draft){data=parsed;break}
        const detail=parsed.error||parsed.message||raw.slice(0,240)||`HTTP ${response.status}`;
        lastError=`${endpoint} : ${detail}`;
        if(response.status!==404)break;
      }catch(error){lastError=`${endpoint} : ${error.message||'연결 실패'}`}
    }
    if(!data?.draft)throw new Error(lastError||'AI 요약 함수에 연결하지 못했습니다. Netlify Dev를 다시 시작해 주세요.');
    state.reportForm={...state.reportForm,...data.draft,selectedTests:tests,testType:tests.join(', ')};
    alert('7개 항목의 AI 요약이 작성되었습니다. 검사 원자료와 면담 내용을 확인한 뒤 수정·저장해 주세요.');
  }catch(error){alert(error.message||'AI 초안 생성 중 오류가 발생했습니다.');}
  finally{state.reportDraftLoading=false;render()}
}
function deleteReport(id){if(!confirm('보고서를 삭제하시겠습니까?'))return;state.reports=state.reports.filter(r=>String(r.id)!==String(id));persistReports(state.reports);render()}

async function createApprovedReportHtmlSnapshot(report){
  if(!report)return '';
  if(report.individualAssessmentReport){
    const analysis=resolveIndividualReportAnalysis(report);
    if(!analysis)throw new Error('개별보고서 원본을 찾지 못했습니다.');
    const finalAnalysis=typeof assessmentAnalysisWithEditorValues==='function'?assessmentAnalysisWithEditorValues(analysis):analysis;
    if(typeof individualAssessmentPreviewDocument!=='function')throw new Error('개별보고서 출력 엔진을 찾지 못했습니다.');
    return individualAssessmentPreviewDocument(finalAnalysis);
  }
  if((report.assessmentReport||report.integratedAssessmentReport)&&report.sections){
    const audience=report.integratedAssessmentReport?'counselor':'client';
    const response=await fetch('/.netlify/functions/comprehensive-report',{
      method:'POST',headers:{'Content-Type':'application/json'},
      body:JSON.stringify({
        audience,
        clientName:report.clientName||'',
        program:programBaseName(report.program),
        tests:Array.isArray(report.tests)?report.tests:[],
        publishedAt:report.publishedAt||'',approvedAt:report.approvedAt||'',updatedAt:report.updatedAt||'',
        generatedAt:report.generatedAt||report.createdAt||'',
        issuedAt:new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Seoul'}).format(new Date()),
        report:{...(report.sections||{})}
      })
    });
    const data=await response.json().catch(()=>({}));
    const documentHtml=String(data.documentHtml||data.html||'');
    if(!response.ok||!documentHtml||!/^<!doctype html>/i.test(documentHtml.trim()))throw new Error(data.error||'종합보고서 출력본을 만들지 못했습니다.');
    return documentHtml;
  }
  return '';
}
async function toggleReportApproval(id){
  const report=resolveAdminReportActionTarget(id);
  if(!report){alert('보고서 원본을 찾지 못했습니다. 보고서를 저장한 뒤 다시 시도해 주세요.');return;}
  const next=!report.approvedForClient;
  // 보고서 승인 여부는 사용자 신청 상태가 아니라 저장된 보고서 원본을 기준으로 판단합니다.
  if(!confirm(next?'이 보고서를 승인하여 내담자가 열람할 수 있게 할까요?':'승인을 취소하여 내담자 열람을 중단할까요?'))return;
  let approvedReportHtml=report.approvedReportHtml||'';
  if(next){
    try{approvedReportHtml=await createApprovedReportHtmlSnapshot(report)}
    catch(error){alert(error.message||'승인용 보고서 출력본을 만들지 못했습니다.');return;}
    if(!approvedReportHtml){alert('승인할 보고서 출력본이 비어 있습니다. 먼저 보고서를 저장해 주세요.');return;}
  }
  const now=new Date().toLocaleString('ko-KR');
  const approvalPatch={
    approved:next,
    reviewed:next?true:Boolean(report.reviewed),
    approvedForClient:next,
    approvedReportHtml:next?approvedReportHtml:'',
    approvedReportHtmlVersion:next?Number(report.version||1):0,
    approvedAt:next?now:'',
    approvedBy:next?'관리자':'',
    publishedAt:next?now:'',
    approvalUpdatedAt:now,
    reviewStatus:next?'approved':'saved',
    status:next?'승인완료 · 열람가능':'저장완료 · 승인대기',
    updatedAt:now
  };
  if(window.MMLReportStore?.setApproval){
    state.reports=window.MMLReportStore.setApproval(state.reports,id,next,{
      html:approvedReportHtml,
      approvedBy:'관리자'
    });
  }else{
    state.reports=state.reports.map(r=>String(r.id)===String(id)?{...r,...approvalPatch}:r);
  }
  // 승인 직후 사용자 페이지가 읽는 공개 스냅샷까지 즉시 갱신합니다.
  // 서버 저장소가 503이어도 동일 브라우저의 localStorage 공개본은 유지됩니다.
  persistReports(state.reports);
  try{window.MMLSyncEngine?.exportClientSnapshot?.({publish:true});}catch(error){console.warn('[MML] 사용자 공개 스냅샷 갱신 실패',error);}

  const target=state.reservations.find(r=>String(r.id)===String(report.reservationId))||state.reservations.find(r=>
    String(r.name||'').trim()===String(report.clientName||'').trim()&&
    (!report.phone||String(r.phone||'').replace(/\D/g,'')===String(report.phone||'').replace(/\D/g,''))
  );
  if(target){
    const isIndividual=Boolean(report.individualAssessmentReport);
    const isIntegrated=Boolean(report.assessmentReport&&!report.individualAssessmentReport&&!report.integratedAssessmentReport);
    const patch={
      assessmentReportStatus:next?'승인 완료':'관리자 검토 중',
      assessmentReportPublishedAt:next?now:'',
      assessmentReportApprovedAt:next?now:''
    };
    if(isIndividual){
      const ids=Array.isArray(target.approvedIndividualReportIds)?target.approvedIndividualReportIds.map(String):[];
      patch.approvedIndividualReportIds=next?[...new Set([...ids,String(report.id)])]:ids.filter(x=>x!==String(report.id));
    }
    if(isIntegrated){
      patch.approvedIntegratedReportId=next?report.id:'';
    }
    updateReservation(target.id,patch);
    // updateReservation 내부 저장 이후 예약 식별자가 포함된 공개본을 한 번 더 확정합니다.
    try{
      const refreshed=state.reports.find(r=>String(r.id)===String(report.id));
      if(refreshed){
        const identityPatch={
          reservationId:target.id,
          clientId:refreshed.clientId||target.clientId||target.memberId||target.userId||'',
          memberId:refreshed.memberId||target.memberId||target.clientId||target.userId||'',
          userId:refreshed.userId||target.userId||target.memberId||target.clientId||'',
          email:refreshed.email||target.email||target.userEmail||'',
          clientName:refreshed.clientName||target.name||target.clientName||'',
          phone:refreshed.phone||target.phone||''
        };
        state.reports=state.reports.map(r=>String(r.id)===String(report.id)?{...r,...identityPatch}:r);
        persistReports(state.reports);
      }
      window.MMLSyncEngine?.exportClientSnapshot?.({publish:true});
    }catch(error){console.warn('[MML] 승인 보고서 사용자 연결 갱신 실패',error);}
    render();
    return;
  }
  try{window.MMLSyncEngine?.exportClientSnapshot?.({publish:true});}catch(error){}
  render();
}
function openReportPreview(id){
  printReport(id);
}

function copyReportGuide(id){const r=state.reports.find(x=>String(x.id)===String(id));if(!r)return;copyText(`${r.clientName}님, 안녕하세요.
모두의 마음연구소입니다.

심리검사 결과보고서 확인이 가능하도록 등록되었습니다.

■ 보고서
${r.title}

홈페이지의 [결과확인] 메뉴에서 이름과 연락처를 입력하시면 확인하실 수 있습니다.

감사합니다.
모두의 마음연구소`)}
async function printReport(id,autoPrint=true){
  const r=resolveAdminReportActionTarget(id);if(!r){alert('보고서 원본을 찾지 못했습니다. 보고서를 저장한 뒤 다시 시도해 주세요.');return;}
  if(r.individualAssessmentReport){
    const analysis=resolveIndividualReportAnalysis(r);
    if(analysis){
      if(autoPrint)printIndividualAssessmentReport(analysis.id);
      else previewIndividualAssessmentReport(analysis.id);
      return;
    }
  }

  const w=window.open('','_blank','width=1100,height=900');
  if(!w){alert('팝업 차단을 해제해 주세요.');return;}
  w.document.write('<!doctype html><html lang="ko"><head><meta charset="utf-8"><title>보고서 준비 중</title></head><body style="font-family:Arial,sans-serif;padding:40px;color:#334155">최신 저장 보고서를 불러오는 중입니다.</body></html>');
  w.document.close();

  if((r.assessmentReport||r.integratedAssessmentReport)&&r.sections){
    try{
      // [FIX-20260722-ONE-REPORT-RENDERER-V94]
      // 승인된 내담자용 종합보고서는 관리자에서 승인한 HTML 원본을 그대로 사용합니다.
      // 별도 API 렌더링을 거치지 않아 관리자·사용자·PDF의 내용이 달라지지 않게 합니다.
      const approvedHtml=String(r.approvedReportHtml||'').trim();
      if(approvedHtml.includes('MML_ADMIN_DERIVED_REPORT_V1')){
        const printScript=autoPrint?'<script>window.onload=()=>setTimeout(()=>window.print(),250)<\/script>':'';
        const exactHtml=approvedHtml.replace('</body>',`${printScript}</body>`);
        w.document.open();w.document.write(exactHtml);w.document.close();
        return;
      }
      // 승인 원본이 없는 내부 원본 보고서만 기존 서버 렌더러를 사용합니다.
      // 최신 프롬프트로 생성된 뒤 상담사가 수정·저장한 동일한 보고서 객체만 렌더링합니다.
      const audience=r.integratedAssessmentReport?'counselor':'client';
      const response=await fetch('/.netlify/functions/comprehensive-report',{
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body:JSON.stringify({
          audience,
          clientName:r.clientName||'',
          program:programBaseName(r.program),
          tests:Array.isArray(r.tests)?r.tests:[],
          publishedAt:r.publishedAt||'',
          approvedAt:r.approvedAt||'',
          updatedAt:r.updatedAt||'',
          generatedAt:r.generatedAt||r.createdAt||'',
          issuedAt:new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Seoul'}).format(new Date()),
          report:{...(r.sections||{})}
        })
      });
      const data=await response.json().catch(()=>({}));
      if(!response.ok||!data.html)throw new Error(data.error||'보고서를 렌더링하지 못했습니다.');
      const printScript=autoPrint?'<script>window.onload=()=>setTimeout(()=>window.print(),250)<\\/script>':'';
      const html=String(data.html).replace('</body>',`${printScript}</body>`);
      w.document.open();w.document.write(html);w.document.close();
      return;
    }catch(error){
      w.close();
      alert(error.message||'PDF 보고서를 불러오는 중 오류가 발생했습니다.');
      return;
    }
  }

  w.document.open();
  w.document.write(`<html><head><meta charset="utf-8"><title>${esc(r.title)}</title><style>body{font-family:Arial,sans-serif;padding:40px;line-height:1.7;color:#1e293b}h1{font-size:28px}h2{margin-top:28px;font-size:18px;border-bottom:1px solid #ddd;padding-bottom:8px}.meta{background:#f8fafc;padding:16px;border-radius:12px;margin:20px 0}.box{white-space:pre-wrap;border:1px solid #e2e8f0;padding:16px;border-radius:12px}</style></head><body><p style="font-size:12px;color:#047857;font-weight:bold;">MODUMAM-LAB PSYCHOLOGICAL REPORT</p><h1>${esc(r.title)}</h1><div class="meta"><p><b>성명:</b> ${esc(r.clientName)}</p><p><b>프로그램:</b> ${esc(programBaseName(r.program))}</p><p><b>검사:</b> ${esc(r.testType)}</p><p><b>작성일:</b> ${esc(r.createdAt)}</p></div><h2>종합 소견</h2><div class="box">${esc(r.summary)}</div><h2>강점 및 자원</h2><div class="box">${esc(r.strength)}</div><h2>주의점 및 어려움</h2><div class="box">${esc(r.caution)}</div><h2>제안</h2><div class="box">${esc(r.plan)}</div>${autoPrint?`<script>window.onload=()=>window.print()<\\/script>`:''}</body></html>`);
  w.document.close();
}
function saveCounselingNote(k){const m=document.getElementById('note-'+k),d=document.getElementById('date-'+k);if(!m||!m.value.trim()){alert('상담 메모를 입력해 주세요.');return}const sk='modumam_counseling_notes_'+k;const notes=load(sk,[]);notes.unshift({id:Date.now(),date:d.value||new Date().toISOString().slice(0,10),memo:m.value.trim(),createdAt:new Date().toLocaleString()});save(sk,notes);alert('상담 메모가 저장되었습니다.');render()}
function deleteCounselingNote(k,id){if(!confirm('상담 메모를 삭제하시겠습니까?'))return;const sk='modumam_counseling_notes_'+k;save(sk,load(sk,[]).filter(n=>n.id!==id));render()}
function todayReservations(){const t=new Date().toISOString().slice(0,10);return state.reservations.filter(r=>r.date===t&&normalizeStatus(r.status)!=='예약취소').sort((a,b)=>String(a.time||'').localeCompare(String(b.time||'')))}
function openMemberChartByReservation(id,section){
  const r=state.reservations.find(x=>String(x.id)===String(id));
  if(!r)return;
  state.memberSearch=String(r.phone||r.name||'');
  state.memberStatus='전체';
  state.menu='members';
  render();
  if(section){setTimeout(()=>{const key=clientKey(r.name,r.phone);document.getElementById(`${section}-${key}`)?.scrollIntoView({behavior:'smooth',block:'start'});},80)}
}
function isAiResultCounselingReservation(r){
  const type=String(r?.type||'').replace(/\s+/g,'');
  return isAiCounselingMethod(type) || r?.aiCounseling===true;
}
function startCounseling(id){
  const r=state.reservations.find(x=>String(x.id)===String(id));
  if(!r){alert('예약 정보를 찾지 못했습니다.');return;}

  const now=new Date().toISOString();
  if(normalizeStatus(r.status)!=='상담진행'){
    r.status='상담진행';
    r.counselingStartedAt=r.counselingStartedAt||now;
    r.updatedAt=new Date().toLocaleString('ko-KR');
    save('modumam_reservations',state.reservations);
  }

  if(isAiResultCounselingReservation(r)){
    state.counselingModeId='';
    state.aiMonitoringSelectedId=String(r.id);
    state.menu='intake';
    render();
    return;
  }

  state.counselingModeId=String(r.id);
  state.menu='journal';
  render();
}
function closeCounselingMode(){state.counselingModeId='';state.menu='journal';render()}
function completeCounseling(id){
  const r=state.reservations.find(x=>String(x.id)===String(id));
  if(!r)return;
  if(!confirm(`${r.name}님의 상담을 완료 처리하시겠습니까?`))return;
  updateReservation(id,{status:'상담완료',counselingCompletedAt:new Date().toISOString()});
}

function openCounselingRecordByReservation(id){
  const r=state.reservations.find(x=>String(x.id)===String(id));if(!r)return;
  state.selectedClientKey=clientKey(r.name,r.phone);
  state.menu='counseling';render();
}
function completeCounselingAndOpenChart(id){
  const r=state.reservations.find(x=>String(x.id)===String(id));if(!r)return;
  if(!confirm(`${r.name}님의 상담을 완료 처리하고 전자차트를 열까요?`))return;
  updateReservation(id,{status:'상담완료',counselingCompletedAt:new Date().toISOString()});
  state.memberSearch=r.caseNumber||r.phone||r.name||'';
  state.menu='members';render();
}
window.openCounselingRecordByReservation=openCounselingRecordByReservation;
window.completeCounselingAndOpenChart=completeCounselingAndOpenChart;

function scheduleNextCounseling(id){
  const r=state.reservations.find(x=>String(x.id)===String(id));
  if(!r)return;
  const date=prompt('다음 상담일을 YYYY-MM-DD 형식으로 입력해 주세요.',r.date||new Date().toISOString().slice(0,10));
  if(date===null)return;
  if(!/^\d{4}-\d{2}-\d{2}$/.test(date)){alert('상담일은 YYYY-MM-DD 형식으로 입력해 주세요.');return;}
  const time=prompt('다음 상담시간을 09:00~18:00, 30분 단위로 입력해 주세요.',r.time||'09:00');
  if(time===null)return;
  if(!/^(09|1[0-7]):(00|30)$|^18:00$/.test(time)){alert('상담시간은 09:00~18:00 사이의 00분 또는 30분만 가능합니다.');return;}
  const next={...r,id:Date.now(),date,time,status:'예약신청',createdAt:new Date().toLocaleString(),statusHistory:[{from:'',to:'예약신청',at:new Date().toLocaleString(),reason:'다음 상담 예약'}],scheduleHistory:[],adminMemo:'이전 상담에서 다음 회기로 등록',aiResultCounselingEnabled:false};
  delete next.counselingStartedAt;delete next.counselingCompletedAt;
  state.reservations.unshift(next);save('modumam_reservations',state.reservations);alert('다음 상담 예약이 등록되었습니다.');render();
}
function navButton(k,l){return`<button onclick="setMenu('${k}')" class="shrink-0 px-4 py-2 rounded-xl text-xs font-extrabold ${state.menu===k?'bg-slate-900 text-white':'bg-slate-100 text-slate-600 hover:bg-slate-200'}">${l}</button>`}
function sideNavButton(k,icon,label,sub=''){
  const active=state.menu===k;
  return `<button onclick="setMenu('${k}')" class="w-full flex items-center gap-3 rounded-2xl px-3 py-3 text-left transition ${active?'bg-slate-900 text-white shadow-lg shadow-slate-900/10':'text-slate-600 hover:bg-slate-100'}"><span class="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${active?'bg-white/15':'bg-slate-100'} text-lg">${icon}</span><span class="min-w-0"><span class="block text-sm font-extrabold">${label}</span>${sub?`<span class="block truncate text-[10px] mt-0.5 ${active?'text-slate-300':'text-slate-400'}">${sub}</span>`:''}</span></button>`;
}
function titleForMenu(){return({dashboard:'오늘 업무',clients:'내담자관리',reservation:'예약관리',interpretation:'심리평가센터',intake:'AI 모니터링',cases:'AI 사례개념화',journal:'상담일지',counseling:'상담기록',termination:'종결기록',report:'심리검사 요약보고서',members:'전자차트',clinicalTimeline:'사례관리',clinicalDss:'AI 임상지원',statistics:'운영 통계',documents:'신청서·동의서',settings:'환경설정'})[state.menu]||'오늘 업무'}
function todayDisplayLabel(){try{return new Intl.DateTimeFormat('ko-KR',{year:'numeric',month:'long',day:'numeric',weekday:'long'}).format(new Date())}catch(e){return new Date().toLocaleDateString('ko-KR')}}
function layout(content){return`<main class="min-h-screen bg-slate-100">
  <div class="lg:flex lg:min-h-screen">
    <aside class="hidden lg:flex lg:w-64 xl:w-72 lg:shrink-0 lg:flex-col lg:border-r lg:border-slate-200 lg:bg-white lg:sticky lg:top-0 lg:h-screen">
      <div class="border-b border-slate-100 px-5 py-6">
        <p class="text-[11px] font-extrabold text-emerald-700">MODUMAM-LAB</p>
        <h1 class="mt-1 text-xl font-extrabold text-slate-950">상담운영센터 2.0</h1>
        <p class="mt-2 text-xs leading-relaxed text-slate-400">오늘 업무에서 상담·검사·보고서까지 이어서 관리합니다.</p>
      </div>
      <nav class="flex-1 overflow-y-auto px-3 py-4 space-y-1.5">
        <p class="px-3 pb-1 text-[10px] font-extrabold tracking-wider text-slate-300">TODAY</p>
        ${sideNavButton('dashboard','⌂','오늘 업무','상담 일정과 우선 업무')}
        
        ${sideNavButton('clients','👤','내담자관리','직접 등록·검색·연결')}
        ${sideNavButton('members','📋','전자차트','내담자별 통합 기록')}
        <p class="px-3 pt-4 pb-1 text-[10px] font-extrabold tracking-wider text-slate-300">CLIENT</p>
        
        ${sideNavButton('reservation','📅','예약관리','일정·검사·진행상태')}
        ${sideNavButton('interpretation','🧠','심리평가센터','검사분석·AI 종합해석보고서')}
        <p class="px-3 pt-4 pb-1 text-[10px] font-extrabold tracking-wider text-slate-300">COUNSELING</p>
        ${sideNavButton('journal','📝','상담일지','상담 진행·회기 작성')}
        ${sideNavButton('intake','👁','AI 모니터링','AI 결과상담 실시간 확인')}
        ${sideNavButton('counseling','📂','상담기록','저장 기록·축어록 관리')}
        <p class="px-3 pt-4 pb-1 text-[10px] font-extrabold tracking-wider text-slate-300">CENTER</p>
        ${sideNavButton('clinicalTimeline','🧭','사례관리','사례개념화·개입계획·회기·종결')}
        ${sideNavButton('clinicalDss','🩺','AI 임상지원','위험·일관성·근거 점검')}
        ${sideNavButton('statistics','📊','통계','운영 현황')}
        ${sideNavButton('settings','⚙','설정','백업·사용자 페이지')}
      </nav>
      <div class="border-t border-slate-100 p-4"><button onclick="logout()" class="w-full rounded-2xl bg-rose-50 px-4 py-3 text-sm font-extrabold text-rose-600 hover:bg-rose-100">로그아웃</button></div>
    </aside>
    <div class="min-w-0 flex-1">
      <header class="sticky top-0 z-40 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div class="px-4 py-4 sm:px-6 lg:px-8">
          <div class="flex items-center justify-between gap-4">
            <div><p class="text-[11px] font-extrabold text-emerald-700">상담운영센터 2.0 · BUILD 20260720-REQUEST-LINKED-CLIENT-REPORT-V8</p><h2 class="text-xl font-extrabold text-slate-950 sm:text-2xl">${titleForMenu()}</h2><p class="mt-1 hidden text-xs text-slate-400 sm:block">${todayDisplayLabel()}</p></div>
            <div class="hidden sm:flex items-center gap-2"><button onclick="location.href='/'" class="rounded-xl bg-slate-900 px-3 py-2 text-xs font-extrabold text-white">사용자 페이지</button></div>
          </div>
          <nav class="mt-4 flex gap-2 overflow-x-auto pb-1 lg:hidden">${navButton('dashboard','오늘 업무')}${navButton('clients','내담자')}${navButton('members','전자차트')}${navButton('reservation','예약')}${navButton('interpretation','심리평가')}${navButton('journal','상담일지')}${navButton('intake','AI모니터링')}${navButton('counseling','상담기록')}${navButton('clinicalTimeline','사례관리')}${navButton('clinicalDss','임상지원')}${navButton('statistics','통계')}${navButton('settings','설정')}<button onclick="logout()" class="shrink-0 rounded-xl bg-rose-50 px-4 py-2 text-xs font-extrabold text-rose-600">로그아웃</button></nav>
        </div>
      </header>
      <section class="p-4 sm:p-6 lg:p-8">${content}</section>
    </div>
  </div>
</main>`}
function card(label,value,sub,icon,color){const map={blue:'bg-blue-50 text-blue-600',purple:'bg-purple-50 text-purple-600',orange:'bg-orange-50 text-orange-600',emerald:'bg-emerald-50 text-emerald-600'};return`<div class="bg-white rounded-[1.75rem] border border-slate-100 p-4 sm:p-6 shadow-sm flex items-center justify-between"><div><p class="text-xs font-extrabold text-slate-400 mb-2">${label}</p><p class="text-2xl sm:text-4xl font-extrabold text-slate-900">${value}</p><p class="text-[11px] text-slate-400 font-bold mt-2">${sub}</p></div><div class="${map[color]} w-12 h-12 sm:w-14 sm:h-14 rounded-2xl flex items-center justify-center text-2xl">${icon}</div></div>`}
function empty(t){return`<div class="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-8 text-center text-sm text-slate-400">${t}</div>`}

function workflowStage(r){const status=normalizeStatus(r.status);const map={'예약신청':{key:'approval',label:'예약 승인 대기',order:1},'예약승인':{key:'payment',label:'결제 확인 대기',order:2},'결제완료':{key:'send',label:'검사 링크 발송 대기',order:3},'검사발송':{key:'testing',label:'검사 진행 확인',order:4},'검사완료':{key:'upload',label:'검사결과 업로드 대기',order:5},'결과업로드':{key:'report',label:'결과보고서 확인',order:6},'상담준비':{key:'counsel',label:'상담 준비',order:7},'상담진행':{key:'counsel',label:'상담 진행',order:8},'상담완료':{key:'done',label:'상담 완료',order:9},'종결':{key:'done',label:'종결',order:10},'예약취소':{key:'cancel',label:'예약 취소',order:99}};return map[status]||map['예약신청'];}
function workflowTasks(){
  return state.reservations
    .filter(r=>workflowStage(r).key!=='done'&&workflowStage(r).key!=='cancel')
    .map(r=>({...r,_stage:workflowStage(r)}))
    .sort((a,b)=>a._stage.order-b._stage.order||String(a.date||'').localeCompare(String(b.date||'')));
}
function workflowSummary(){
  const keys=[
    ['approval','예약 승인'],['payment','결제 확인'],['send','검사 발송'],
    ['testing','검사 진행'],['upload','결과 업로드'],['report','보고서 작성'],['counsel','상담 예정']
  ];
  const tasks=workflowTasks();
  return keys.map(([key,label])=>({key,label,count:tasks.filter(t=>t._stage.key===key).length}));
}

function taskBoard(){const rows=[
  ['🔴','예약 승인 대기',state.reservations.filter(r=>normalizeStatus(r.status)==='예약신청').length,'reservation'],
  ['🟠','결제 대기',state.reservations.filter(r=>normalizeStatus(r.status)==='예약승인').length,'reservation'],
  ['🟡','검사 링크 발송 대기',state.reservations.filter(r=>normalizeStatus(r.status)==='결제완료').length,'reservation'],
  ['🟢','검사 완료 확인',state.reservations.filter(r=>normalizeStatus(r.status)==='검사발송').length,'reservation'],
  ['🔵','결과보고서 작성',state.reservations.filter(r=>['검사완료','결과업로드'].includes(normalizeStatus(r.status))).length,'report'],
  ['🟣','오늘 상담',todayReservations().length,'dashboard']
];return rows.map(r=>`<button onclick="setMenu('${r[3]}')" class="w-full flex items-center justify-between bg-slate-50 hover:bg-slate-100 rounded-2xl p-4 mb-3 transition"><span class="text-sm font-extrabold text-slate-700">${r[0]} ${r[1]}</span><span class="text-sm font-extrabold bg-white border border-slate-200 rounded-full px-3 py-1">${r[2]}</span></button>`).join('')}


// [MOD-20260714-CENTER2-SPRINT4] 업무 자동화 엔진
// 진행상태와 실제 저장자료를 함께 확인해 다음 처리 업무를 자동으로 제안합니다.
function sameClientRecord(item,r){
  const itemPhone=String(item?.phone||'').replace(/\D/g,'');
  const resPhone=String(r?.phone||'').replace(/\D/g,'');
  return String(item?.reservationId||'')===String(r?.id||'') ||
    (String(item?.clientName||item?.name||'').trim()===String(r?.name||'').trim() && (!itemPhone||!resPhone||itemPhone===resPhone));
}
function reservationUploads(r){return state.resultUploads.filter(x=>sameClientRecord(x,r))}
function reservationReports(r){return state.reports.filter(x=>sameClientRecord(x,r))}
function reservationCaseData(r){
  const caseId=caseIdFromReservation(r);
  return {
    formulation:load('modumam_case_formulation_'+caseId,{}),
    sessions:load('modumam_case_sessions_'+caseId,[])
  };
}
function automatedTasks(){
  const tasks=[];
  state.reservations.forEach(r=>{
    const status=normalizeStatus(r.status);
    if(status==='예약취소')return;
    const uploads=reservationUploads(r);
    const reports=reservationReports(r);
    const approvedReport=reports.some(x=>x.approvedForClient);
    const caseData=reservationCaseData(r);
    const add=(priority,title,detail,actionLabel,action)=>tasks.push({id:`${r.id}-${title}`,priority,title,detail,actionLabel,action,reservation:r});

    if(status==='예약신청') add(1,'예약 승인 필요','신청 내용을 확인하고 예약을 승인해 주세요.','예약 승인',`openTodayTaskPage('reservation','${r.id}')`);
    else if(status==='예약승인') add(2,'결제 확인 필요','입금 여부를 확인한 뒤 결제완료로 변경해 주세요.','결제 확인',`openTodayTaskPage('reservation','${r.id}')`);
    else if(status==='결제완료') add(3,'검사 링크 발송','신청한 검사 링크를 등록하고 회원에게 발송해 주세요.','검사관리',`openTodayTaskPage('reservation','${r.id}')`);
    else if(status==='검사발송') add(4,'검사 완료 확인','검사 실시 여부와 결과 수신 여부를 확인해 주세요.','검사 완료',`openTodayTaskPage('reservation','${r.id}')`);
    else if(status==='검사완료' && uploads.length===0) add(5,'검사결과 업로드','심리평가센터에서 검사결과 파일과 요약을 등록해 주세요.','심리평가센터',`openTodayTaskPage('interpretation','${r.id}')`);
    else if(['검사완료','결과업로드'].includes(status) && uploads.length>0 && reports.length===0) add(6,'결과보고서 작성','업로드된 검사결과를 바탕으로 보고서를 작성해 주세요.','보고서 작성',`openTodayTaskPage('report','${r.id}')`);
    else if(reports.length>0 && !approvedReport) add(7,'보고서 검토·공개','전문가 검토 후 회원 공개 여부를 결정해 주세요.','보고서 열기',`openTodayTaskPage('report','${r.id}')`);

    if(uploads.length>0 && !Object.values(caseData.formulation||{}).some(Boolean))
      add(8,'사례개념화 초안','검사결과와 상담기록을 통합한 사례개념화 초안을 준비할 수 있습니다.','사례 열기',`openTodayTaskPage('cases','${r.id}')`);

    if(approvedReport && !r.aiResultCounselingEnabled)
      add(9,'AI 결과상담 승인 검토','공개 승인된 결과보고서가 있습니다. AI 결과상담 사용 여부를 결정해 주세요.','회원 전자차트',`openTodayTaskPage('members','${r.id}')`);

    if(status==='상담준비') add(10,'상담 시작 준비','전자차트와 참고자료를 확인한 뒤 상담을 시작해 주세요.','상담 시작',`openTodayTaskPage('journal','${r.id}')`);
    if(status==='상담진행') add(11,'상담기록 마무리','회기기록을 저장하고 상담완료 처리를 해 주세요.','상담모드',`openTodayTaskPage('journal','${r.id}')`);
    if(status==='상담완료') add(12,'다음 회기 또는 종결 결정',`${caseData.sessions.length}건의 회기기록이 있습니다. 다음 예약 또는 종결 여부를 결정해 주세요.`,`전자차트`,`openTodayTaskPage('members','${r.id}')`);
    if(status==='종결' && !r.closureReviewedAt) add(13,'종결기록 확인','상담목표 달성도와 추후 계획을 확인해 주세요.','종결 확인',`openTodayTaskPage('members','${r.id}')`);
  });
  return tasks.sort((a,b)=>a.priority-b.priority||String(a.reservation.date||'').localeCompare(String(b.reservation.date||'')));
}
function automationTaskCard(t){
  const r=t.reservation;
  return `<div class="border-b border-slate-100 last:border-0 py-3"><div class="flex items-start justify-between gap-3"><div><div class="flex flex-wrap items-center gap-2"><p class="text-sm font-extrabold">${esc(r.name)}님</p><span class="rounded-full bg-slate-100 px-2 py-1 text-[10px] font-bold text-slate-500">${esc(normalizeStatus(r.status))}</span></div><p class="mt-1 text-xs font-extrabold text-rose-600">${esc(t.title)}</p><p class="mt-1 text-[11px] leading-relaxed text-slate-500">${esc(t.detail)}</p><p class="mt-1 text-[10px] text-slate-400">${esc(r.date||'')} ${esc(r.time||'')} · ${esc(programBaseName(r.program))}</p></div><button onclick="${t.action}" class="shrink-0 rounded-xl bg-slate-900 px-3 py-2 text-[11px] font-extrabold text-white">${esc(t.actionLabel)}</button></div></div>`;
}

// [MOD-20260714-CENTER2-SPRINT9] 예약별 다음 업무를 한 가지로 집중 표시합니다.
function nextTaskForReservation(r){
  return automatedTasks().find(t=>String(t.reservation.id)===String(r.id))||null;
}
function focusedNextTaskBlock(r){
  const status=normalizeStatus(r.status);
  const id=JSON.stringify(String(r.id));

  const previousButton=status!=='예약신청'&&status!=='예약취소'
    ? `<button type="button" onclick='moveReservationToPreviousStage(${id})' class="rounded-xl border border-slate-300 bg-white px-4 py-3 text-xs font-extrabold text-slate-700">이전 단계·수정</button>`
    : '';

  const wrap=(title,detail,buttons)=>`
    <div class="rounded-2xl border border-amber-100 bg-amber-50 p-4">
      <div class="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <div>
          <p class="text-[11px] font-extrabold text-amber-700">현재 단계 안내</p>
          <p class="mt-1 text-sm font-extrabold text-slate-900">${title}</p>
          <p class="mt-1 text-[11px] leading-relaxed text-slate-600">${detail}</p>
        </div>
        <div class="flex flex-wrap gap-2">${buttons}${previousButton}</div>
      </div>
    </div>`;

  if(status==='예약신청'){
    return wrap(
      '예약 신청내용 확인',
      '신청 프로그램, 검사, 상담방식과 예약일정을 확인한 뒤 예약을 승인해 주세요.',
      `<button type="button" onclick='window.runNextAction(${id})' class="rounded-xl bg-slate-900 px-4 py-3 text-xs font-extrabold text-white">예약 승인</button>
       <button type="button" onclick='window.deleteReservation(${id})' class="rounded-xl border border-rose-200 bg-white px-4 py-3 text-xs font-extrabold text-rose-700">예약만 삭제</button>
       <button type="button" onclick='window.deleteClientCompletelyByReservation(${id})' class="rounded-xl bg-rose-600 px-4 py-3 text-xs font-extrabold text-white">내담자 전체 삭제</button>`
    );
  }

  if(status==='예약승인'){
    return wrap(
      '결제 안내 및 확인',
      '결제안내 메시지를 복사해 발송한 뒤 입금이 확인되면 결제확인을 눌러 주세요.',
      `<button type="button" onclick='copyPaymentMessage(${id})' class="rounded-xl border border-emerald-200 bg-white px-4 py-3 text-xs font-extrabold text-emerald-700">결제안내 복사</button>
       <button type="button" onclick='runNextAction(${id})' class="rounded-xl bg-slate-900 px-4 py-3 text-xs font-extrabold text-white">결제 확인</button>`
    );
  }

  if(status==='결제완료'){
    return wrap(
      '검사 안내 및 발송',
      '신청한 검사기관 사이트에서 검사를 등록하고 검사안내 메시지를 발송해 주세요.',
      `<button type="button" onclick='copyTestGuide(${id})' class="rounded-xl border border-indigo-200 bg-white px-4 py-3 text-xs font-extrabold text-indigo-700">검사안내 복사</button>
       <button type="button" onclick='runNextAction(${id})' class="rounded-xl bg-indigo-600 px-4 py-3 text-xs font-extrabold text-white">검사발송 완료</button>`
    );
  }

  if(status==='검사발송'){
    return wrap(
      '검사 완료 확인',
      '신청한 검사가 모두 완료되었는지 확인한 뒤 다음 단계로 이동해 주세요.',
      `<button type="button" onclick='runNextAction(${id})' class="rounded-xl bg-indigo-600 px-4 py-3 text-xs font-extrabold text-white">검사 완료 확인</button>`
    );
  }

  if(status==='검사완료'){
    return wrap(
      '심리평가 준비',
      '검사결과 파일을 심리평가센터에서 확인하고 결과보고서 작성을 시작해 주세요.',
      `<button type="button" onclick="setMenu('interpretation')" class="rounded-xl border border-purple-200 bg-white px-4 py-3 text-xs font-extrabold text-purple-700">심리평가센터</button>
       <button type="button" onclick='runNextAction(${id})' class="rounded-xl bg-purple-600 px-4 py-3 text-xs font-extrabold text-white">결과업로드 단계</button>`
    );
  }

  if(status==='결과업로드'){
    return wrap(
      '결과보고서 확인',
      '결과보고서를 검토하고 상담 준비가 완료되면 다음 단계로 이동해 주세요.',
      `<button type="button" onclick='setReportFromReservation(${id})' class="rounded-xl border border-purple-200 bg-white px-4 py-3 text-xs font-extrabold text-purple-700">보고서 확인</button>
       <button type="button" onclick='runNextAction(${id})' class="rounded-xl bg-purple-600 px-4 py-3 text-xs font-extrabold text-white">상담 준비</button>`
    );
  }

  if(status==='상담준비'){
    return wrap(
      '상담 시작 준비',
      '예약일정과 상담자료를 확인한 뒤 상담을 시작해 주세요.',
      `<button type="button" onclick='runNextAction(${id})' class="rounded-xl bg-emerald-600 px-4 py-3 text-xs font-extrabold text-white">상담 시작</button>`
    );
  }

  if(status==='상담진행'){
    return wrap(
      '상담 진행',
      '상담기록과 필요한 기록을 작성한 뒤 상담완료로 이동해 주세요.',
      `<button type="button" onclick='saveCurrentReservationChanges(${id})' class="rounded-xl border border-blue-200 bg-white px-4 py-3 text-xs font-extrabold text-blue-700">변경사항 저장</button>
       <button type="button" onclick="setMenu('counseling')" class="rounded-xl border border-emerald-200 bg-white px-4 py-3 text-xs font-extrabold text-emerald-700">상담기록</button>
       <button type="button" onclick='runNextAction(${id})' class="rounded-xl bg-emerald-600 px-4 py-3 text-xs font-extrabold text-white">상담 완료</button>`
    );
  }

  if(status==='상담완료'){
    return wrap(
      '종결 확인',
      '종결기록과 추후 계획을 확인한 뒤 종결해 주세요.',
      `<button type="button" onclick="setMenu('counseling')" class="rounded-xl border border-slate-300 bg-white px-4 py-3 text-xs font-extrabold text-slate-700">종결기록 확인</button>
       <button type="button" onclick='runNextAction(${id})' class="rounded-xl bg-slate-900 px-4 py-3 text-xs font-extrabold text-white">종결</button>`
    );
  }

  if(status==='종결'){
    return wrap(
      '종결 완료',
      '모든 운영 단계가 완료되었습니다.',
      ''
    );
  }

  if(status==='예약취소'){
    return `<div class="rounded-2xl border border-rose-200 bg-rose-50 p-4">
      <div class="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <div><p class="text-[11px] font-extrabold text-rose-700">취소된 예약</p><p class="mt-1 text-sm font-extrabold text-slate-900">예약을 복원하거나 삭제할 수 있습니다.</p><p class="mt-1 text-[11px] leading-relaxed text-slate-600">삭제해도 승인 보고서·상담일지·사례관리 기록은 유지됩니다.</p></div>
        <div class="flex flex-wrap gap-2">
          <button type="button" onclick='restoreCancelledReservation(${id})' class="rounded-xl border border-slate-300 bg-white px-4 py-3 text-xs font-extrabold text-slate-700">예약 복원</button>
          <button type="button" onclick='deleteCancelledReservation(${id})' class="rounded-xl bg-rose-600 px-4 py-3 text-xs font-extrabold text-white">취소 예약 삭제</button>
        </div>
      </div>
    </div>`;
  }

  return `<div class="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm font-bold text-slate-500">현재 단계에서 표시할 안내가 없습니다.</div>`;
}

function operationPipeline(r){const current=normalizeStatus(r.status);const steps=STATUS.filter(x=>x!=='예약취소');return `<div class="grid grid-cols-2 sm:grid-cols-5 lg:grid-cols-10 gap-2">${steps.map(step=>{const done=statusReached(current,step),active=current===step;return `<div class="rounded-xl px-2 py-2 text-center text-[11px] font-bold ${active?'bg-slate-900 text-white border border-slate-900':done?'bg-emerald-50 text-emerald-700 border border-emerald-100':'bg-slate-50 text-slate-400 border border-slate-100'}">${done?'✓':'□'} ${step}</div>`}).join('')}</div>`;}

function caseIdFromReservation(res) {
  if (res.caseId) return res.caseId;
  const rawDate = String(res.date || new Date().toISOString().slice(0,10)).replace(/[^0-9]/g, "");
  return "CASE-" + rawDate + "-" + String(res.id || Date.now()).slice(-3);
}

function buildCases() {
  return state.reservations.map(res => {
    const caseId = caseIdFromReservation(res);
    const tests = requestedTests(res);
    const reports = state.reports.filter(r =>
      String(r.reservationId || "") === String(res.id) ||
      String(r.clientName || "").trim() === String(res.name || "").trim()
    );
    const intake = findIntake ? findIntake(res) : null;
    const formulation = load("modumam_case_formulation_" + caseId, {
      complaint: "",
      currentProblem: "",
      trigger: "",
      maintaining: "",
      coreBelief: "",
      automaticThought: "",
      emotionPattern: "",
      behaviorPattern: "",
      protective: "",
      strength: "",
      riskAssessment: "",
      clinicalHypothesis: "",
      evidenceBasis: "",
      goal: "",
      intervention: "",
      confirmedChanges: "",
      uncertainPoints: "",
      nextFocus: ""
    });
    const sessions = load("modumam_case_sessions_" + caseId, []);
    return { caseId, res, tests, reports, intake, formulation, sessions };
  });
}

/* V27: 사례개념화·상담계획·회기기록 지원·슈퍼비전·기록 품질검사·종합사례보고서 코드는 js/modules/clinical-documents.js로 분리되었습니다. */

function interpretationTestLabel(type){return type==='PAT'?'PAT 부모양육태도검사':'STS 6요인 기질검사'}
function setInterpretationType(type){state.interpretationForm={reservationId:state.interpretationForm.reservationId,testType:type,scales:{}};state.interpretationDraft=null;state.interpretationSource=null;render()}
function setInterpretationReservation(id){state.interpretationForm.reservationId=String(id||'');state.interpretationDraft=null;state.interpretationSource=null;render()}
function readInterpretationScaleValues(){
  const type=state.interpretationForm.testType||'STS';
  const scales={};
  (TEST_INTERPRETATION_SCALES[type]||[]).forEach(scale=>{
    scales[scale.key]={label:scale.label,meaning:scale.meaning,score:document.getElementById(`interpret-score-${scale.key}`)?.value?.trim()||'',level:document.getElementById(`interpret-level-${scale.key}`)?.value||'확인필요',evidence:state.interpretationForm.scales?.[scale.key]?.evidence||''};
  });
  return scales;
}
function interpretationSourceSummary(reservation){
  const uploads=state.resultUploads.filter(u=>String(u.reservationId)===String(reservation?.id));
  const extracted=state.interpretationSource?.documentSummary||'';
  return [uploads.map(u=>`${u.testType}: ${u.summary||'업로드 결과 있음'}`).join('\n'),extracted].filter(Boolean).join('\n\n');
}
function fileToBase64(file){return new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result||'').split(',')[1]||'');reader.onerror=()=>reject(new Error('파일을 읽지 못했습니다.'));reader.readAsDataURL(file);});}
async function extractInterpretationFile(file){
  if(!file)return;
  const reservation=state.reservations.find(r=>String(r.id)===String(state.interpretationForm.reservationId));
  if(!reservation){alert('먼저 대상 회원을 선택해 주세요.');return;}
  const allowed=['application/pdf','image/png','image/jpeg','image/webp'];
  if(!allowed.includes(file.type)){alert('PDF, PNG, JPG, WEBP 파일만 업로드할 수 있습니다.');return;}
  if(file.size>4*1024*1024){alert('파일은 4MB 이하로 올려 주세요. 큰 PDF는 결과표 페이지만 따로 저장해 주세요.');return;}
  state.testExtractionLoading=true;state.interpretationDraft=null;render();
  try{
    const base64=await fileToBase64(file);
    const response=await fetch('/.netlify/functions/test-result-extraction',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({clientName:reservation.name,testType:state.interpretationForm.testType,fileName:file.name,mimeType:file.type,base64})});
    const data=await response.json().catch(()=>({}));
    if(!response.ok)throw new Error(data.error||'검사결과를 읽지 못했습니다.');
    const definitions=TEST_INTERPRETATION_SCALES[state.interpretationForm.testType]||[];
    const scales={};
    definitions.forEach(def=>{const found=data.scales?.[def.key]||{};scales[def.key]={label:def.label,meaning:def.meaning,score:String(found.score??'').trim(),level:['낮음','보통','높음'].includes(found.level)?found.level:'확인필요',evidence:String(found.evidence||'').trim(),confidence:String(found.confidence||'').trim()};});
    state.interpretationForm.scales=scales;
    state.interpretationSource={fileName:file.name,mimeType:file.type,documentSummary:data.documentSummary||'',warnings:Array.isArray(data.warnings)?data.warnings:[],model:data.model||'',extractedAt:new Date().toLocaleString('ko-KR')};
    alert('검사결과에서 척도값을 추출했습니다. 각 값을 확인한 뒤 해석을 생성해 주세요.');
  }catch(error){alert(error.message||'검사결과 분석 중 오류가 발생했습니다.');}
  finally{state.testExtractionLoading=false;render();}
}
async function generateTestInterpretation(){
  const reservation=state.reservations.find(r=>String(r.id)===String(state.interpretationForm.reservationId));
  if(!reservation){alert('해석 대상 회원을 선택해 주세요.');return;}
  const scales=readInterpretationScaleValues();
  const unresolved=Object.values(scales).filter(v=>v.level==='확인필요');
  if(unresolved.length){alert(`확인필요로 남아 있는 척도가 ${unresolved.length}개 있습니다. 결과지를 확인해 수준을 수정해 주세요.`);return;}
  if(!Object.values(scales).some(v=>v.score||v.level!=='보통')){if(!confirm('모든 척도가 보통으로 확인되었습니다. 그대로 초안을 생성할까요?'))return;}
  state.testInterpretationLoading=true;render();
  try{
    const response=await fetch('/.netlify/functions/test-interpretation',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({clientName:reservation.name,age:reservation.age||'',program:programBaseName(reservation.program),testType:state.interpretationForm.testType,scales,uploadedSummary:interpretationSourceSummary(reservation)})});
    const data=await response.json().catch(()=>({}));
    if(!response.ok)throw new Error(data.error||'검사 해석 초안을 생성하지 못했습니다.');
    state.interpretationForm.scales=scales;
    state.interpretationDraft={...data.interpretation,model:data.model||'',generatedAt:new Date().toLocaleString('ko-KR')};
  }catch(error){alert(error.message||'검사 해석 생성 중 오류가 발생했습니다.');}
  finally{state.testInterpretationLoading=false;render();}
}
function saveTestInterpretation(){
  const reservation=state.reservations.find(r=>String(r.id)===String(state.interpretationForm.reservationId));
  if(!reservation||!state.interpretationDraft){alert('먼저 AI 해석 초안을 생성해 주세요.');return;}
  const value=id=>document.getElementById(id)?.value?.trim()||'';
  const interpretation={
    id:Date.now(),reservationId:reservation.id,clientName:reservation.name,phone:reservation.phone||'',program:programBaseName(reservation.program),testType:state.interpretationForm.testType,scales:state.interpretationForm.scales,source:state.interpretationSource,
    oneLine:value('interpret-oneLine'),overall:value('interpret-overall'),strength:value('interpret-strength'),caution:value('interpret-caution'),coaching:value('interpret-coaching'),scaleInterpretations:value('interpret-scales'),status:'전문가 검토중',visibleToClient:false,createdAt:new Date().toLocaleString('ko-KR'),model:state.interpretationDraft.model||''
  };
  state.testInterpretations=[interpretation,...state.testInterpretations];
  save('modumam_test_interpretations',state.testInterpretations);
  alert('검사 해석 초안이 저장되었습니다. 전문가 검토 후 결과보고서에 반영해 주세요.');
  state.interpretationDraft=null;render();
}
function deleteTestInterpretation(id){if(!confirm('저장된 검사 해석을 삭제할까요?'))return;state.testInterpretations=state.testInterpretations.filter(x=>String(x.id)!==String(id));save('modumam_test_interpretations',state.testInterpretations);render()}
function copyInterpretation(id){const x=state.testInterpretations.find(v=>v.id===id);if(!x)return;copyText(`[${interpretationTestLabel(x.testType)}]\n${x.oneLine}\n\n[종합 이해]\n${x.overall}\n\n[강점]\n${x.strength}\n\n[주의할 점]\n${x.caution}\n\n[상담·코칭 제안]\n${x.coaching}\n\n[척도별 해석]\n${x.scaleInterpretations}`)}
function legacyTestInterpretationView(){
  const type=state.interpretationForm.testType||'STS';
  const scales=TEST_INTERPRETATION_SCALES[type]||[];
  const draft=state.interpretationDraft;
  const source=state.interpretationSource;
  return layout(`<div class="space-y-6">
    <div class="rounded-[2rem] bg-gradient-to-r from-slate-950 to-indigo-950 p-6 text-white shadow-xl sm:p-8"><p class="text-xs font-extrabold text-indigo-300">PSYCHOLOGICAL TEST INTERPRETATION</p><h2 class="mt-2 text-2xl font-extrabold">STS·PAT 검사결과 업로드 분석</h2><p class="mt-2 max-w-3xl text-sm leading-relaxed text-slate-300">검사결과 PDF 또는 이미지를 올리면 AI가 척도명·점수·수준을 먼저 추출합니다. 추출값을 상담자가 확인·수정한 뒤 전문 해석 초안을 생성합니다.</p></div>
    <div class="grid grid-cols-1 gap-6 xl:grid-cols-3">
      <div class="space-y-5 xl:col-span-1">
        <div class="rounded-[2rem] border border-slate-100 bg-white p-6 shadow-sm"><h3 class="text-lg font-extrabold">1. 검사 및 회원 선택</h3><select onchange="setInterpretationReservation(this.value)" class="mt-4 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm font-bold"><option value="">대상 회원 선택</option>${state.reservations.map(r=>`<option value="${r.id}" ${String(state.interpretationForm.reservationId)===String(r.id)?'selected':''}>${esc(r.name)} · ${esc(programBaseName(r.program))} · ${esc(r.date)}</option>`).join('')}</select><div class="mt-3 grid grid-cols-2 gap-2"><button onclick="setInterpretationType('STS')" class="rounded-2xl px-4 py-3 text-sm font-extrabold ${type==='STS'?'bg-slate-900 text-white':'bg-slate-100 text-slate-600'}">STS 6요인</button><button onclick="setInterpretationType('PAT')" class="rounded-2xl px-4 py-3 text-sm font-extrabold ${type==='PAT'?'bg-slate-900 text-white':'bg-slate-100 text-slate-600'}">PAT 양육태도</button></div></div>
        <div class="rounded-[2rem] border border-indigo-100 bg-white p-6 shadow-sm"><h3 class="text-lg font-extrabold">2. 검사결과 업로드</h3><p class="mt-1 text-xs leading-relaxed text-slate-400">결과표가 선명하게 보이는 PDF·PNG·JPG를 올려 주세요. 4MB 이하 권장입니다.</p><label class="mt-4 flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-indigo-200 bg-indigo-50 px-4 py-8 text-center"><span class="text-3xl">📄</span><span class="mt-2 text-sm font-extrabold text-indigo-700">검사결과 파일 선택</span><span class="mt-1 text-[11px] text-indigo-500">PDF · PNG · JPG · WEBP</span><input type="file" accept="application/pdf,image/png,image/jpeg,image/webp" class="hidden" onchange="extractInterpretationFile(this.files[0])"/></label>${state.testExtractionLoading?`<div class="mt-4 rounded-2xl bg-amber-50 p-4 text-sm font-bold text-amber-700">검사결과를 읽고 있습니다...</div>`:''}${source?`<div class="mt-4 rounded-2xl border border-emerald-100 bg-emerald-50 p-4"><p class="text-sm font-extrabold text-emerald-800">추출 완료</p><p class="mt-1 text-xs text-emerald-700">${esc(source.fileName)} · ${esc(source.extractedAt)}</p>${source.documentSummary?`<p class="mt-3 whitespace-pre-line text-xs leading-relaxed text-slate-600">${esc(source.documentSummary)}</p>`:''}${source.warnings?.length?`<div class="mt-3 rounded-xl bg-amber-50 p-3 text-xs text-amber-800">${source.warnings.map(w=>`• ${esc(w)}`).join('<br>')}</div>`:''}</div>`:''}</div>
        <div class="rounded-[2rem] border border-slate-100 bg-white p-6 shadow-sm"><h3 class="text-lg font-extrabold">3. 추출값 확인</h3><p class="mt-1 text-xs leading-relaxed text-slate-400">AI가 읽은 값은 반드시 원본 결과표와 대조해 주세요. 잘못 읽은 값은 직접 수정할 수 있습니다.</p><div class="mt-4 space-y-3">${scales.map(scale=>{const saved=state.interpretationForm.scales?.[scale.key]||{};return`<div class="rounded-2xl border border-slate-100 bg-slate-50 p-4"><div class="flex items-start justify-between gap-2"><div><p class="text-sm font-extrabold">${scale.label}</p><p class="mt-1 text-[11px] leading-relaxed text-slate-400">${scale.meaning}</p></div>${saved.confidence?`<span class="rounded-full bg-white px-2 py-1 text-[10px] font-bold text-slate-500">신뢰 ${esc(saved.confidence)}</span>`:''}</div><div class="mt-3 grid grid-cols-2 gap-2"><input id="interpret-score-${scale.key}" value="${esc(saved.score||'')}" placeholder="점수" class="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs"/><select id="interpret-level-${scale.key}" class="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold">${['확인필요','낮음','보통','높음'].map(level=>`<option value="${level}" ${(saved.level||'확인필요')===level?'selected':''}>${level}</option>`).join('')}</select></div>${saved.evidence?`<p class="mt-2 text-[10px] leading-relaxed text-slate-500">근거: ${esc(saved.evidence)}</p>`:''}</div>`}).join('')}</div><button onclick="generateTestInterpretation()" ${state.testInterpretationLoading||state.testExtractionLoading?'disabled':''} class="mt-4 w-full rounded-2xl bg-indigo-600 py-4 text-sm font-extrabold text-white disabled:opacity-50">${state.testInterpretationLoading?'AI 해석 초안 생성 중...':'확인한 값으로 AI 해석 생성'}</button></div>
      </div>
      <div class="space-y-5 xl:col-span-2">
        ${draft?`<div class="rounded-[2rem] border border-indigo-100 bg-white p-6 shadow-sm"><div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><p class="text-xs font-extrabold text-indigo-600">AI DRAFT · ${interpretationTestLabel(type)}</p><h3 class="mt-1 text-xl font-extrabold">전문가 검토용 해석 초안</h3></div><span class="rounded-full bg-amber-50 px-3 py-1 text-xs font-bold text-amber-700">진단·최종 소견 아님</span></div><div class="mt-5 space-y-4"><label class="block text-xs font-extrabold text-slate-500">한 줄 이해<textarea id="interpret-oneLine" rows="2" class="mt-2 w-full rounded-2xl border border-slate-200 p-4 text-sm">${esc(draft.oneLine||'')}</textarea></label><label class="block text-xs font-extrabold text-slate-500">종합 이해<textarea id="interpret-overall" rows="6" class="mt-2 w-full rounded-2xl border border-slate-200 p-4 text-sm">${esc(draft.overall||'')}</textarea></label><div class="grid grid-cols-1 gap-4 lg:grid-cols-2"><label class="block text-xs font-extrabold text-slate-500">강점<textarea id="interpret-strength" rows="5" class="mt-2 w-full rounded-2xl border border-slate-200 p-4 text-sm">${esc(draft.strength||'')}</textarea></label><label class="block text-xs font-extrabold text-slate-500">주의할 점<textarea id="interpret-caution" rows="5" class="mt-2 w-full rounded-2xl border border-slate-200 p-4 text-sm">${esc(draft.caution||'')}</textarea></label></div><label class="block text-xs font-extrabold text-slate-500">상담·부모코칭 제안<textarea id="interpret-coaching" rows="6" class="mt-2 w-full rounded-2xl border border-slate-200 p-4 text-sm">${esc(draft.coaching||'')}</textarea></label><label class="block text-xs font-extrabold text-slate-500">척도별 해석<textarea id="interpret-scales" rows="10" class="mt-2 w-full rounded-2xl border border-slate-200 p-4 text-sm">${esc(draft.scaleInterpretations||'')}</textarea></label></div><button onclick="saveTestInterpretation()" class="mt-5 w-full rounded-2xl bg-slate-900 py-4 text-sm font-extrabold text-white">검토용 해석 저장</button></div>`:`<div class="rounded-[2rem] border border-dashed border-slate-200 bg-white p-10 text-center text-sm text-slate-400">검사결과 파일을 업로드하고 추출값을 확인한 뒤 AI 해석을 생성하세요.</div>`}
        <div class="rounded-[2rem] border border-slate-100 bg-white p-6 shadow-sm"><div class="flex items-center justify-between"><div><h3 class="text-lg font-extrabold">저장된 검사 해석</h3><p class="mt-1 text-xs text-slate-400">결과보고서 작성 전 검토·수정하기 위한 내부 자료입니다.</p></div><span class="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold">${state.testInterpretations.length}건</span></div><div class="mt-5 space-y-3">${state.testInterpretations.length?state.testInterpretations.map(x=>`<div class="rounded-2xl border border-slate-100 bg-slate-50 p-5"><div class="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div><p class="text-sm font-extrabold">${esc(x.clientName)}님 · ${interpretationTestLabel(x.testType)}</p><p class="mt-1 text-xs text-slate-400">${esc(x.createdAt)} · ${esc(x.status)}${x.source?.fileName?` · ${esc(x.source.fileName)}`:''}</p><p class="mt-3 text-sm font-bold text-slate-700">${esc(x.oneLine)}</p></div><div class="flex gap-2"><button onclick="copyInterpretation(${x.id})" class="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold">복사</button><button onclick="deleteTestInterpretation(${x.id})" class="rounded-xl border border-rose-200 bg-white px-3 py-2 text-xs font-bold text-rose-600">삭제</button></div></div></div>`).join(''):'<p class="text-sm text-slate-400">저장된 검사 해석이 없습니다.</p>'}</div></div>
      </div>
    </div>
  </div>`)
}


// [MOD-20260716-SPRINT16-CROSS-ASSESSMENT]
// 회원 중심으로 모든 심리검사를 업로드·분석하고, 상담자용 검사별 분석과 심리검사 종합보고서를 분리합니다.
const ASSESSMENT_TEST_OPTIONS=['TCI','MMPI-2','PAI','STS','PAT','K-CDI','SCT','HTP','PHQ-9','GAD-7','회복탄력성','직무스트레스','직업흥미검사','기타'];
/* [MODULE-20260716-ASSESSMENT-CENTER-01]
   심리평가센터 기능은 ./modules/assessment-center.js 로 분리했습니다.
   이후 심리검사 분석·교차분석·심리보고서 수정은 해당 파일에서 진행합니다.
*/

document.addEventListener('click',event=>{
  const button=event.target.closest('[data-case-draft-action="generate"]');
  if(!button)return;

  event.preventDefault();
  event.stopPropagation();

  const caseId=String(button.dataset.caseId||'').trim();
  if(!caseId){
    alert('사례번호를 확인하지 못했습니다. 화면을 새로고침해 주세요.');
    return;
  }

  if(typeof window.generateCaseDraft!=='function'){
    alert('사례개념화 생성 기능을 불러오지 못했습니다. 브라우저를 새로고침해 주세요.');
    console.error('[MML CASE DRAFT] generateCaseDraft is not available');
    return;
  }

  window.generateCaseDraft(caseId).catch(error=>{
    console.error('[MML CASE DRAFT] click handler error',error);
    alert(error?.message||'사례개념화 생성 중 오류가 발생했습니다.');
  });
});

function casesView() {
  const cases = buildCases();

  return layout(`
    <div class="space-y-6">
      <div class="rounded-[2rem] bg-gradient-to-r from-slate-950 via-emerald-950 to-slate-900 p-6 text-white shadow-xl sm:p-8">
        <div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p class="text-xs font-extrabold text-emerald-300">CASE CONCEPTUALIZATION CENTER</p>
            <h2 class="mt-2 text-2xl font-extrabold">AI 사례개념화</h2>
            <p class="mt-2 max-w-3xl text-sm leading-relaxed text-slate-300">검사결과·결과보고서·상담기록을 통합하여 상담자가 검토하고 수정하는 사례개념화와 상담계획 화면입니다.</p>
          </div>
          <div class="flex flex-wrap items-center gap-2"><button type="button" onclick="setMenu('clinicalTimeline')" class="rounded-xl border border-white/20 bg-white/10 px-4 py-2 text-xs font-extrabold text-white">사례관리로 돌아가기</button><span class="w-fit rounded-full bg-white/10 px-4 py-2 text-xs font-extrabold text-white">전체 ${cases.length}건</span></div>
        </div>
      </div>

      <div class="space-y-7">
        ${cases.map(c => {
          const f = c.formulation || {};
          const cp = counselingPlanForCase(c.caseId);
          const sv = counselingSupervisionForCase(c.caseId);
          const rq = counselingRecordQualityForCase(c.caseId);
          const cr = clinicalCaseReportForCase(c.caseId);
          const caseNumber = c.res.caseNumber || c.caseId;
          const status = normalizeStatus(c.res.status);
          const sourceBadges = [
            c.tests.length ? `심리검사 ${c.tests.length}건` : '',
            c.reports.length ? `결과보고서 ${c.reports.length}건` : '',
            c.sessions.length ? `상담기록 ${c.sessions.length}건` : ''
          ].filter(Boolean);
          return `
            <article class="overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-sm">
              <div class="border-b border-slate-100 bg-slate-50 p-5 sm:p-6">
                <div class="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
                  <div class="min-w-0">
                    <div class="flex flex-wrap items-center gap-2">
                      <span class="rounded-full bg-emerald-100 px-3 py-1 text-[11px] font-extrabold text-emerald-700">사례번호</span>
                      <h3 class="break-all text-xl font-extrabold text-slate-950 sm:text-2xl">${esc(caseNumber)}</h3>
                      <span class="rounded-full px-3 py-1 text-xs font-extrabold ${statusClass(status)}">${esc(status)}</span>
                    </div>
                    <div class="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
                      <div class="rounded-2xl border border-slate-100 bg-white p-4"><p class="text-[10px] font-extrabold text-slate-400">내담자</p><p class="mt-1 text-sm font-extrabold text-slate-900">${esc(c.res.name||'-')}님</p><p class="mt-1 text-[11px] text-slate-400">${esc(c.res.phone||'연락처 없음')}</p></div>
                      <div class="rounded-2xl border border-slate-100 bg-white p-4"><p class="text-[10px] font-extrabold text-slate-400">프로그램</p><p class="mt-1 text-sm font-extrabold text-slate-900">${esc(programBaseName(c.res.program))}</p></div>
                      <div class="rounded-2xl border border-slate-100 bg-white p-4"><p class="text-[10px] font-extrabold text-slate-400">상담방법</p><p class="mt-1 text-sm font-extrabold text-slate-900">${esc(c.res.type||'미정')}</p></div>
                      <div class="rounded-2xl border border-slate-100 bg-white p-4"><p class="text-[10px] font-extrabold text-slate-400">예약일정</p><p class="mt-1 text-sm font-extrabold text-slate-900">${esc(c.res.date||'-')} ${esc(c.res.time||'')}</p></div>
                    </div>
                  </div>
                  <div class="grid shrink-0 grid-cols-3 gap-2 text-center">
                    <div class="min-w-20 rounded-2xl border border-slate-100 bg-white p-3"><p class="text-[10px] font-bold text-slate-400">검사</p><p class="mt-1 text-xl font-extrabold">${c.tests.length}</p></div>
                    <div class="min-w-20 rounded-2xl border border-slate-100 bg-white p-3"><p class="text-[10px] font-bold text-slate-400">보고서</p><p class="mt-1 text-xl font-extrabold">${c.reports.length}</p></div>
                    <div class="min-w-20 rounded-2xl border border-slate-100 bg-white p-3"><p class="text-[10px] font-bold text-slate-400">회기</p><p class="mt-1 text-xl font-extrabold">${c.sessions.length}</p></div>
                  </div>
                </div>
              </div>

              <div class="space-y-6 p-5 sm:p-6">
                <section class="rounded-[1.75rem] border border-slate-100 bg-slate-50 p-5">
                  <div class="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                      <h4 class="text-base font-extrabold text-slate-900">검사 로드맵 및 AI 분석 근거</h4>
                      <p class="mt-1 text-xs leading-relaxed text-slate-500">현재 연결된 자료를 확인한 뒤 AI 사례개념화 초안을 생성하세요. 회기기록은 상담자 검토 완료 상태만 반영됩니다.</p>
                      <div class="mt-3 flex flex-wrap gap-2">
                        <span class="rounded-full bg-emerald-50 px-3 py-1 text-[11px] font-extrabold text-emerald-700">검토 완료 회기 ${(c.sessions||[]).filter(s=>s.reviewStatus==='상담자 검토 완료').length}건</span>
                        ${(c.sessions||[]).some(s=>s.reviewStatus!=='상담자 검토 완료')?`<span class="rounded-full bg-amber-50 px-3 py-1 text-[11px] font-extrabold text-amber-700">검토 대기 ${(c.sessions||[]).filter(s=>s.reviewStatus!=='상담자 검토 완료').length}건 제외</span>`:''}
                      </div>
                      <div class="mt-3 flex flex-wrap gap-2">${sourceBadges.length?sourceBadges.map(x=>`<span class="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-[11px] font-extrabold text-emerald-700">✓ ${esc(x)}</span>`).join(''):'<span class="rounded-full border border-amber-200 bg-amber-50 px-3 py-1.5 text-[11px] font-extrabold text-amber-700">연결된 분석자료 없음</span>'}</div>
                    </div>
                    <div class="flex flex-wrap gap-2">
                      <button type="button" data-case-draft-action="generate" data-case-id="${esc(c.caseId)}" ${state.caseDraftLoading[c.caseId]?'disabled':''} class="rounded-xl bg-purple-600 px-4 py-3 text-xs font-extrabold text-white disabled:opacity-50">${state.caseDraftLoading[c.caseId]?'생성 중...':f.aiGeneratedAt?'AI 다시 생성':'AI 사례개념화 생성'}</button>
                      <button onclick="printCaseFormulation('${c.caseId}')" class="rounded-xl border border-slate-200 bg-white px-4 py-3 text-xs font-extrabold text-slate-700">PDF·인쇄</button>
                    </div>
                  </div>
                  <div class="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
                    ${c.tests.length?c.tests.map(t=>`<div class="rounded-2xl border border-slate-200 bg-white p-4"><p class="text-sm font-extrabold text-slate-800">${esc(t)}</p><p class="mt-1 text-[11px] text-slate-400">${esc((c.res.testStatuses||{})[t]||'미발송')}</p></div>`).join(''):'<div class="rounded-2xl border border-dashed border-slate-200 bg-white p-5 text-sm text-slate-400">신청 검사가 없습니다.</div>'}
                  </div>
                </section>

                <section class="rounded-[1.75rem] border border-purple-100 bg-white p-5 sm:p-6">
                  <div class="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <p class="text-xs font-extrabold text-purple-600">CASE FORMULATION</p>
                      <h4 class="mt-1 text-xl font-extrabold text-slate-950">사례개념화</h4>
                      <p class="mt-1 text-xs leading-relaxed text-slate-500">검사·결과보고서·상담기록을 바탕으로 작성한 상담자 내부 검토용 내용입니다.</p>
                      ${f.aiGeneratedAt?`<p class="mt-2 text-[11px] font-bold text-purple-600">AI 초안 생성 ${new Date(f.aiGeneratedAt).toLocaleString('ko-KR')}</p>`:''}
                    </div>
                    <button onclick="saveCaseFormulation('${c.caseId}')" class="rounded-xl bg-slate-900 px-5 py-3 text-xs font-extrabold text-white">사례개념화 저장</button>
                  </div>
                  <div class="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-2">
                    <label class="text-xs font-extrabold text-slate-500">주호소<textarea id="cf-complaint-${c.caseId}" rows="4" placeholder="내담자가 호소하는 핵심 어려움" class="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm leading-relaxed">${esc(f.complaint||'')}</textarea></label>
                    <label class="text-xs font-extrabold text-slate-500">현재 문제와 기능 영향<textarea id="cf-current-${c.caseId}" rows="4" placeholder="현재 문제와 일상·관계·기능에 미치는 영향" class="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm leading-relaxed">${esc(f.currentProblem||'')}</textarea></label>
                    <label class="text-xs font-extrabold text-slate-500">촉발요인<textarea id="cf-trigger-${c.caseId}" rows="4" placeholder="최근 어려움이 시작되거나 악화된 계기" class="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm leading-relaxed">${esc(f.trigger||'')}</textarea></label>
                    <label class="text-xs font-extrabold text-slate-500">유지요인<textarea id="cf-maintaining-${c.caseId}" rows="4" placeholder="어려움이 반복·지속되는 요인" class="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm leading-relaxed">${esc(f.maintaining||'')}</textarea></label>
                    <label class="text-xs font-extrabold text-slate-500">핵심 신념·자기이해<textarea id="cf-core-belief-${c.caseId}" rows="4" placeholder="반복적으로 드러나는 자기·타인·세상에 대한 이해 또는 추가 확인이 필요한 가설" class="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm leading-relaxed">${esc(f.coreBelief||'')}</textarea></label>
                    <label class="text-xs font-extrabold text-slate-500">자동적 사고<textarea id="cf-automatic-thought-${c.caseId}" rows="4" placeholder="상황에서 반복되는 생각·해석과 그 근거" class="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm leading-relaxed">${esc(f.automaticThought||'')}</textarea></label>
                    <label class="text-xs font-extrabold text-slate-500">정서 패턴<textarea id="cf-emotion-pattern-${c.caseId}" rows="4" placeholder="주요 감정, 강도 변화, 촉발 상황과 조절 방식" class="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm leading-relaxed">${esc(f.emotionPattern||'')}</textarea></label>
                    <label class="text-xs font-extrabold text-slate-500">행동·관계 패턴<textarea id="cf-behavior-pattern-${c.caseId}" rows="4" placeholder="회피·확인·과잉대응·관계 반응 등 반복되는 행동과 결과" class="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm leading-relaxed">${esc(f.behaviorPattern||'')}</textarea></label>
                    <label class="text-xs font-extrabold text-slate-500">보호요인<textarea id="cf-protective-${c.caseId}" rows="4" placeholder="안전과 회복에 도움이 되는 관계·환경·자원" class="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm leading-relaxed">${esc(f.protective||'')}</textarea></label>
                    <label class="text-xs font-extrabold text-slate-500">강점과 자원<textarea id="cf-strength-${c.caseId}" rows="4" placeholder="내담자의 강점·대처능력·활용 가능한 자원" class="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm leading-relaxed">${esc(f.strength||'')}</textarea></label>
                    <label class="text-xs font-extrabold text-slate-500">위험 및 안전평가<textarea id="cf-risk-${c.caseId}" rows="4" placeholder="자살·자해·타해·학대·폭력 위험과 현재 안전 확인. 자료가 없으면 추가 확인 필요" class="mt-2 w-full rounded-2xl border border-rose-100 bg-rose-50/40 px-4 py-3 text-sm leading-relaxed">${esc(f.riskAssessment||'')}</textarea></label>
                    <label class="text-xs font-extrabold text-slate-500">임상적 가설<textarea id="cf-hypothesis-${c.caseId}" rows="4" placeholder="사실과 구분한 조건부 가설 및 대안 가설" class="mt-2 w-full rounded-2xl border border-amber-100 bg-amber-50/40 px-4 py-3 text-sm leading-relaxed">${esc(f.clinicalHypothesis||'')}</textarea></label>
                    <label class="lg:col-span-2 text-xs font-extrabold text-slate-500">근거 연결<textarea id="cf-evidence-${c.caseId}" rows="5" placeholder="접수·검사·회기기록 중 어떤 자료가 어떤 해석을 지지하는지 구분" class="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm leading-relaxed">${esc(f.evidenceBasis||'')}</textarea></label>
                    <label class="text-xs font-extrabold text-slate-500">상담목표<textarea id="cf-goal-${c.caseId}" rows="5" placeholder="합의할 단기·중기·장기 목표와 확인 지표" class="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm leading-relaxed">${esc(f.goal||'')}</textarea></label>
                    <label class="text-xs font-extrabold text-slate-500">개입전략<textarea id="cf-intervention-${c.caseId}" rows="5" placeholder="초기·중기·종결 단계의 접근, 우선 개입, 모니터링 계획" class="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm leading-relaxed">${esc(f.intervention||'')}</textarea></label>
                    <label class="text-xs font-extrabold text-slate-500">확인된 변화<textarea id="cf-confirmed-changes-${c.caseId}" rows="4" placeholder="회기 경과에서 확인된 변화·실천·회복 신호" class="mt-2 w-full rounded-2xl border border-emerald-100 bg-emerald-50/40 px-4 py-3 text-sm leading-relaxed">${esc(f.confirmedChanges||'')}</textarea></label>
                    <label class="text-xs font-extrabold text-slate-500">추가 확인 필요<textarea id="cf-uncertain-${c.caseId}" rows="4" placeholder="근거가 부족하거나 자료가 일치하지 않는 내용" class="mt-2 w-full rounded-2xl border border-amber-100 bg-amber-50/40 px-4 py-3 text-sm leading-relaxed">${esc(f.uncertainPoints||'')}</textarea></label>
                    <label class="lg:col-span-2 text-xs font-extrabold text-slate-500">다음 회기 우선 초점<textarea id="cf-next-focus-${c.caseId}" rows="4" placeholder="다음 회기에서 확인하거나 다룰 우선 주제 1~3개" class="mt-2 w-full rounded-2xl border border-indigo-100 bg-indigo-50/40 px-4 py-3 text-sm leading-relaxed">${esc(f.nextFocus||'')}</textarea></label>
                  </div>
                </section>

                <section class="rounded-[1.75rem] border border-indigo-100 bg-indigo-50/30 p-5 sm:p-6">
                  <div class="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <p class="text-xs font-extrabold text-indigo-600">COUNSELING PLAN</p>
                      <h4 class="mt-1 text-xl font-extrabold text-slate-950">상담계획</h4>
                      <p class="mt-1 text-xs leading-relaxed text-slate-500">사례개념화와 검사·회기자료를 바탕으로 상담자가 검토하고 수정합니다.</p>
                      ${cp.generatedAt?`<p class="mt-2 text-[11px] font-bold text-indigo-600">AI 초안 ${new Date(cp.generatedAt).toLocaleString('ko-KR')} · ${cp.reviewed?'상담자 검토 완료':'검토 필요'}</p>`:''}
                    </div>
                    <div class="flex flex-wrap gap-2">
                      <button onclick="generateCounselingPlan('${c.caseId}')" ${state.counselingPlanLoading[c.caseId]?'disabled':''} class="rounded-xl bg-indigo-600 px-4 py-3 text-xs font-extrabold text-white disabled:opacity-50">${state.counselingPlanLoading[c.caseId]?'생성 중...':cp.generatedAt?'AI 다시 생성':'AI 상담계획 생성'}</button>
                      <button onclick="printCounselingPlan('${c.caseId}')" class="rounded-xl border border-slate-200 bg-white px-4 py-3 text-xs font-extrabold text-slate-700">PDF·인쇄</button>
                    </div>
                  </div>
                  <div class="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-3">
                    <textarea id="cp-short-${c.caseId}" rows="4" placeholder="단기 상담목표" class="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm">${esc(cp.shortTermGoals||'')}</textarea>
                    <textarea id="cp-mid-${c.caseId}" rows="4" placeholder="중기 상담목표" class="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm">${esc(cp.midTermGoals||'')}</textarea>
                    <textarea id="cp-long-${c.caseId}" rows="4" placeholder="장기 상담목표" class="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm">${esc(cp.longTermGoals||'')}</textarea>
                  </div>
                  <div class="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
                    <textarea id="cp-outcomes-${c.caseId}" rows="5" placeholder="성과 확인 지표 · 어떤 변화가 나타나면 목표에 가까워졌다고 볼지" class="rounded-2xl border border-emerald-100 bg-emerald-50/40 px-4 py-3 text-sm">${esc(cp.outcomeIndicators||'')}</textarea>
                    <textarea id="cp-rationale-${c.caseId}" rows="5" placeholder="상담 접근 선택 근거 · 왜 이 접근이 현재 사례에 적합한지" class="rounded-2xl border border-indigo-100 bg-indigo-50/40 px-4 py-3 text-sm">${esc(cp.treatmentRationale||'')}</textarea>
                    <textarea id="cp-initial-${c.caseId}" rows="6" placeholder="초기 단계 계획" class="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm">${esc(cp.initialPhase||'')}</textarea>
                    <textarea id="cp-middle-${c.caseId}" rows="6" placeholder="중기 단계 계획" class="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm">${esc(cp.middlePhase||'')}</textarea>
                    <textarea id="cp-term-${c.caseId}" rows="6" placeholder="종결·사후관리 계획" class="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm">${esc(cp.terminationPhase||'')}</textarea>
                    <textarea id="cp-roadmap-${c.caseId}" rows="6" placeholder="회기별 로드맵" class="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm">${esc(cp.sessionRoadmap||'')}</textarea>
                    <textarea id="cp-interventions-${c.caseId}" rows="6" placeholder="권장 개입" class="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm">${esc(cp.recommendedInterventions||'')}</textarea>
                    <textarea id="cp-precautions-${c.caseId}" rows="6" placeholder="개입 시 주의사항 · 피해야 할 접근, 속도 조절, 문화·가족·발달 맥락" class="rounded-2xl border border-amber-100 bg-amber-50/40 px-4 py-3 text-sm">${esc(cp.interventionPrecautions||'')}</textarea>
                    <textarea id="cp-monitor-${c.caseId}" rows="6" placeholder="위험·보호요인 모니터링" class="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm">${esc(cp.monitoringPoints||'')}</textarea>
                    <textarea id="cp-questions-${c.caseId}" rows="6" placeholder="다음 회기 질문" class="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm">${esc(cp.nextSessionQuestions||'')}</textarea>
                    <textarea id="cp-tasks-${c.caseId}" rows="6" placeholder="내담자 실천과제" class="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm">${esc(cp.clientTasks||'')}</textarea>
                    <textarea id="cp-collaboration-${c.caseId}" rows="5" placeholder="협력 및 자원연계 계획 · 보호자·기관·의료·지역자원과의 협력 조건" class="rounded-2xl border border-cyan-100 bg-cyan-50/40 px-4 py-3 text-sm">${esc(cp.collaborationPlan||'')}</textarea>
                    <textarea id="cp-review-schedule-${c.caseId}" rows="5" placeholder="계획 재검토 시점 · 언제 무엇을 기준으로 계획을 조정할지" class="rounded-2xl border border-violet-100 bg-violet-50/40 px-4 py-3 text-sm">${esc(cp.reviewSchedule||'')}</textarea>
                    <textarea id="cp-limit-${c.caseId}" rows="5" placeholder="한계와 유의사항" class="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm lg:col-span-2">${esc(cp.limitations||'')}</textarea>
                  </div>
                  <button onclick="saveCounselingPlan('${c.caseId}')" class="mt-4 w-full rounded-2xl bg-slate-900 py-3 text-sm font-extrabold text-white">상담계획 검토본 저장</button>
                </section>

                <section class="rounded-[1.75rem] border border-blue-100 bg-blue-50/30 p-5 sm:p-6">
                  <div class="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <p class="text-xs font-extrabold text-blue-700">CLINICAL CASE REPORT</p>
                      <h4 class="mt-1 text-xl font-extrabold text-slate-950">AI 종합사례보고서</h4>
                      <p class="mt-1 text-xs leading-relaxed text-slate-500">초기자료·심리평가·사례개념화·상담계획·검토 완료 회기기록을 하나의 전문가용 사례보고서로 통합합니다.</p>
                      ${cr.generatedAt?`<p class="mt-2 text-[11px] font-bold text-blue-700">AI 초안 ${new Date(cr.generatedAt).toLocaleString('ko-KR')} · ${cr.reviewed?'상담자 검토 완료':'검토 필요'}</p>`:''}
                    </div>
                    <div class="flex flex-wrap gap-2">
                      <button type="button" onclick="generateClinicalCaseReport('${c.caseId}')" ${state.clinicalCaseReportLoading[c.caseId]?'disabled':''} class="rounded-xl bg-blue-700 px-4 py-3 text-xs font-extrabold text-white disabled:opacity-50">${state.clinicalCaseReportLoading[c.caseId]?'통합 중...':cr.generatedAt?'AI 다시 생성':'AI 종합보고서 생성'}</button>
                      <button type="button" onclick="printClinicalCaseReport('${c.caseId}')" class="rounded-xl border border-slate-200 bg-white px-4 py-3 text-xs font-extrabold text-slate-700">PDF·인쇄</button>
                    </div>
                  </div>

                  <div class="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-2">
                    <textarea id="cr-context-${c.caseId}" rows="5" placeholder="1. 의뢰배경 및 상담 맥락" class="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm">${esc(cr.referralAndContext||'')}</textarea>
                    <textarea id="cr-assessment-${c.caseId}" rows="5" placeholder="2. 심리평가 및 초기자료 요약" class="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm">${esc(cr.assessmentSummary||'')}</textarea>
                    <textarea id="cr-formulation-${c.caseId}" rows="6" placeholder="3. 사례개념화 요약" class="rounded-2xl border border-indigo-100 bg-indigo-50/40 px-4 py-3 text-sm">${esc(cr.caseFormulationSummary||'')}</textarea>
                    <textarea id="cr-goals-${c.caseId}" rows="6" placeholder="4. 상담목표" class="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm">${esc(cr.counselingGoals||'')}</textarea>
                    <textarea id="cr-process-${c.caseId}" rows="7" placeholder="5. 상담 진행과정" class="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm">${esc(cr.counselingProcess||'')}</textarea>
                    <textarea id="cr-intervention-${c.caseId}" rows="7" placeholder="6. 주요 개입과 임상적 판단" class="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm">${esc(cr.interventionSummary||'')}</textarea>
                    <textarea id="cr-change-${c.caseId}" rows="6" placeholder="7. 변화 및 상담성과" class="rounded-2xl border border-emerald-100 bg-emerald-50/40 px-4 py-3 text-sm">${esc(cr.changeAndOutcome||'')}</textarea>
                    <textarea id="cr-risk-${c.caseId}" rows="6" placeholder="8. 위험 및 안전관리" class="rounded-2xl border border-rose-100 bg-rose-50/40 px-4 py-3 text-sm">${esc(cr.riskAndSafety||'')}</textarea>
                    <textarea id="cr-strengths-${c.caseId}" rows="5" placeholder="9. 강점과 회복자원" class="rounded-2xl border border-cyan-100 bg-cyan-50/40 px-4 py-3 text-sm">${esc(cr.strengthsAndResources||'')}</textarea>
                    <textarea id="cr-current-${c.caseId}" rows="6" placeholder="10. 현재 임상적 이해" class="rounded-2xl border border-violet-100 bg-violet-50/40 px-4 py-3 text-sm">${esc(cr.currentClinicalView||'')}</textarea>
                    <textarea id="cr-future-${c.caseId}" rows="6" placeholder="11. 향후 계획 및 권고" class="rounded-2xl border border-blue-100 bg-blue-50/40 px-4 py-3 text-sm">${esc(cr.futurePlan||'')}</textarea>
                    <textarea id="cr-limitations-${c.caseId}" rows="5" placeholder="12. 자료의 한계와 추가 확인사항" class="rounded-2xl border border-amber-100 bg-amber-50/40 px-4 py-3 text-sm">${esc(cr.limitations||'')}</textarea>
                  </div>

                  <button type="button" onclick="saveClinicalCaseReport('${c.caseId}')" class="mt-4 w-full rounded-2xl bg-slate-900 py-3 text-sm font-extrabold text-white">AI 종합사례보고서 검토본 저장</button>
                  <p class="mt-3 text-[10px] leading-relaxed text-slate-400">AI가 생성한 내용은 내부 임상 초안입니다. 상담자가 사실관계·임상적 해석·위험관리 내용을 확인한 후 사용하세요.</p>
                </section>

                <section class="rounded-[1.75rem] border border-teal-100 bg-teal-50/30 p-5 sm:p-6">
                  <div class="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <p class="text-xs font-extrabold text-teal-700">COUNSELING RECORD QUALITY</p>
                      <h4 class="mt-1 text-xl font-extrabold text-slate-950">상담기록 품질검사</h4>
                      <p class="mt-1 text-xs leading-relaxed text-slate-500">상담자 검토 완료 회기기록의 문서 완성도와 임상적 연결성을 점검합니다.</p>
                    </div>
                    <div class="flex flex-wrap gap-2">
                      <button type="button" onclick="generateCounselingRecordQuality('${c.caseId}')" ${state.recordQualityLoading[c.caseId]?'disabled':''} class="rounded-xl bg-teal-700 px-4 py-3 text-xs font-extrabold text-white disabled:opacity-50">${state.recordQualityLoading[c.caseId]?'검사 중...':rq.generatedAt?'다시 검사':'품질검사 실행'}</button>
                      <button type="button" onclick="printCounselingRecordQuality('${c.caseId}')" class="rounded-xl border border-slate-200 bg-white px-4 py-3 text-xs font-extrabold text-slate-700">PDF·인쇄</button>
                    </div>
                  </div>

                  ${rq.generatedAt?`
                    <div class="mt-5 grid grid-cols-1 gap-4 xl:grid-cols-[220px_1fr]">
                      <div class="rounded-3xl border p-5 ${qualityScoreTone(rq.totalScore)}">
                        <p class="text-xs font-extrabold">종합점수</p>
                        <p class="mt-2 text-4xl font-black">${esc(rq.totalScore||0)}<span class="text-base">점</span></p>
                        <p class="mt-3 text-xs leading-relaxed">${esc(rq.overallFeedback||'')}</p>
                      </div>
                      <div class="grid grid-cols-2 gap-3 md:grid-cols-4">
                        ${[
                          ['기록 완성도',rq.completenessScore],
                          ['목표 명확성',rq.goalClarityScore],
                          ['과정 구체성',rq.processSpecificityScore],
                          ['개입 기록',rq.interventionScore],
                          ['변화·결과',rq.outcomeScore],
                          ['위험·안전',rq.riskScore],
                          ['사실·해석',rq.factInferenceScore],
                          ['다음 회기 연결',rq.continuityScore]
                        ].map(([label,score])=>`
                          <div class="rounded-2xl border border-slate-100 bg-white p-4">
                            <p class="text-[11px] font-extrabold text-slate-500">${esc(label)}</p>
                            <p class="mt-2 text-2xl font-black text-slate-900">${esc(score||0)}<span class="text-xs">점</span></p>
                          </div>
                        `).join('')}
                      </div>
                    </div>
                    <div class="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
                      <div class="rounded-2xl border border-emerald-100 bg-emerald-50/40 p-4">
                        <p class="text-xs font-extrabold text-emerald-700">잘 기록된 부분</p>
                        <p class="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-slate-700">${esc(rq.recordStrengths||'')}</p>
                      </div>
                      <div class="rounded-2xl border border-amber-100 bg-amber-50/40 p-4">
                        <p class="text-xs font-extrabold text-amber-700">우선 수정사항</p>
                        <p class="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-slate-700">${esc(rq.priorityImprovements||'')}</p>
                      </div>
                    </div>
                    <p class="mt-3 text-[10px] text-slate-400">검사일시 ${new Date(rq.generatedAt).toLocaleString('ko-KR')} · 이 점수는 기록 품질 점검용이며 상담자 역량 평가점수가 아닙니다.</p>
                  `:`
                    <div class="mt-5 rounded-2xl border border-dashed border-teal-200 bg-white/70 p-5 text-center text-sm text-slate-500">
                      검토 완료된 회기기록을 기준으로 8개 영역의 기록 품질을 점검합니다.
                    </div>
                  `}
                </section>

                <section class="rounded-[1.75rem] border border-violet-100 bg-violet-50/30 p-5 sm:p-6">
                  <div class="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <p class="text-xs font-extrabold text-violet-600">AI CLINICAL SUPERVISION</p>
                      <h4 class="mt-1 text-xl font-extrabold text-slate-950">AI 상담 슈퍼비전</h4>
                      <p class="mt-1 text-xs leading-relaxed text-slate-500">검토 완료된 회기기록과 사례개념화·상담계획을 바탕으로 상담자의 개입을 점검합니다.</p>
                      ${sv.generatedAt?`<p class="mt-2 text-[11px] font-bold text-violet-600">AI 초안 ${new Date(sv.generatedAt).toLocaleString('ko-KR')} · ${sv.reviewed?'상담자 검토 완료':'검토 필요'}</p>`:''}
                    </div>
                    <div class="flex flex-wrap gap-2">
                      <button type="button" onclick="generateCounselingSupervision('${c.caseId}')" ${state.supervisionLoading[c.caseId]?'disabled':''} class="rounded-xl bg-violet-600 px-4 py-3 text-xs font-extrabold text-white disabled:opacity-50">${state.supervisionLoading[c.caseId]?'분석 중...':sv.generatedAt?'AI 다시 생성':'AI 슈퍼비전 생성'}</button>
                      <button type="button" onclick="printCounselingSupervision('${c.caseId}')" class="rounded-xl border border-slate-200 bg-white px-4 py-3 text-xs font-extrabold text-slate-700">PDF·인쇄</button>
                    </div>
                  </div>

                  <div class="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-2">
                    <textarea id="sv-strengths-${c.caseId}" rows="5" placeholder="잘된 점과 강점 · 효과적이었던 반영, 질문, 개입, 관계형성" class="rounded-2xl border border-emerald-100 bg-emerald-50/40 px-4 py-3 text-sm">${esc(sv.strengths||'')}</textarea>
                    <textarea id="sv-missed-${c.caseId}" rows="5" placeholder="놓쳤을 수 있는 부분 · 충분히 탐색되지 않은 감정, 의미, 위험, 맥락" class="rounded-2xl border border-amber-100 bg-amber-50/40 px-4 py-3 text-sm">${esc(sv.missedPoints||'')}</textarea>
                    <textarea id="sv-intervention-${c.caseId}" rows="6" placeholder="개입 적절성 검토 · 시점, 강도, 내담자 반응, 대안 개입" class="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm">${esc(sv.interventionReview||'')}</textarea>
                    <textarea id="sv-alliance-${c.caseId}" rows="6" placeholder="상담관계 및 반응 검토 · 동맹, 저항, 거리감, 안전감, 속도" class="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm">${esc(sv.allianceReview||'')}</textarea>
                    <textarea id="sv-risk-${c.caseId}" rows="5" placeholder="위험·윤리·안전 검토 · 위험평가, 비밀보장, 경계, 기록상 주의사항" class="rounded-2xl border border-rose-100 bg-rose-50/40 px-4 py-3 text-sm">${esc(sv.riskEthics||'')}</textarea>
                    <textarea id="sv-counter-${c.caseId}" rows="5" placeholder="상담자 반응 및 역전이 점검 · 상담자가 느꼈을 가능성이 있는 압박, 구하고 싶은 마음, 회피" class="rounded-2xl border border-fuchsia-100 bg-fuchsia-50/40 px-4 py-3 text-sm">${esc(sv.countertransference||'')}</textarea>
                    <textarea id="sv-next-${c.caseId}" rows="6" placeholder="다음 회기 제안 · 우선 초점, 질문, 개입 순서, 확인할 변화" class="rounded-2xl border border-indigo-100 bg-indigo-50/40 px-4 py-3 text-sm">${esc(sv.nextSessionSuggestions||'')}</textarea>
                    <textarea id="sv-questions-${c.caseId}" rows="6" placeholder="슈퍼비전 질문 · 상담자가 스스로 점검할 질문" class="rounded-2xl border border-violet-100 bg-violet-50/40 px-4 py-3 text-sm">${esc(sv.supervisorQuestions||'')}</textarea>
                    <textarea id="sv-documentation-${c.caseId}" rows="5" placeholder="상담기록 피드백 · 사실과 해석 구분, 누락, 중복, 위험기록, 표현 개선" class="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm">${esc(sv.documentationFeedback||'')}</textarea>
                    <textarea id="sv-priority-${c.caseId}" rows="5" placeholder="우선 실행사항 · 다음 회기 전에 준비할 것 1~5개" class="rounded-2xl border border-cyan-100 bg-cyan-50/40 px-4 py-3 text-sm">${esc(sv.priorityActions||'')}</textarea>
                  </div>

                  <button type="button" onclick="saveCounselingSupervision('${c.caseId}')" class="mt-4 w-full rounded-2xl bg-slate-900 py-3 text-sm font-extrabold text-white">AI 슈퍼비전 검토본 저장</button>
                  <p class="mt-3 text-[10px] leading-relaxed text-slate-400">AI 슈퍼비전은 상담자의 성찰을 돕는 내부 참고자료이며 전문 슈퍼바이저의 판단을 대신하지 않습니다.</p>
                </section>

                <section class="rounded-[1.75rem] border border-slate-100 bg-white p-5">
                  <div class="flex items-center justify-between gap-3"><div><h4 class="text-base font-extrabold">참고 회기기록</h4><p class="mt-1 text-xs text-slate-400">상담기록에서 최종 저장된 회기자료입니다.</p></div><span class="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold">${c.sessions.length}건</span></div>
                  <div class="mt-4 space-y-3">${c.sessions.length?c.sessions.map((session,index)=>`<details class="rounded-2xl border border-slate-100 bg-slate-50" ${index===0?'open':''}><summary class="cursor-pointer list-none p-4 text-sm font-extrabold text-slate-800">${esc(session.date||'상담일 미입력')} · ${esc(session.sessionNumber?`${session.sessionNumber}회기`:session.goal||'회기기록')}</summary><div class="border-t border-slate-100 p-4 text-xs leading-relaxed text-slate-600"><div class="mb-3 flex justify-end gap-2"><button type="button" onclick="event.stopPropagation();printCounselingSessionRecord('${c.caseId}','${esc(String(session.id||''))}',${index})" class="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-extrabold text-slate-700">PDF / 인쇄</button><button type="button" onclick="event.stopPropagation();openCounselingSessionEditor('${c.caseId}','${esc(String(session.id||''))}',${index})" class="rounded-lg border border-purple-200 bg-white px-3 py-1.5 text-xs font-extrabold text-purple-700">기록 수정</button><button type="button" onclick="event.stopPropagation();deleteCounselingSessionRecord('${c.caseId}','${esc(String(session.id||''))}',${index})" class="rounded-lg border border-rose-200 bg-white px-3 py-1.5 text-xs font-extrabold text-rose-600">기록 삭제</button></div><p class="whitespace-pre-line"><b>상담내용</b>\n${esc(session.content||'')}</p>${session.change?`<p class="mt-3 whitespace-pre-line"><b>상담결과</b>\n${esc(session.change)}</p>`:''}${session.next?`<p class="mt-3 whitespace-pre-line"><b>다음회기</b>\n${esc(session.next)}</p>`:''}</div></details>`).join(''):'<div class="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-6 text-center text-sm text-slate-400">저장된 회기기록이 없습니다.</div>'}</div>
                </section>
              </div>
            </article>
          `;
        }).join('') || empty('케이스 데이터가 없습니다.')}
      </div>
    </div>
  `);
}


/* =========================================================
   상담신청서 · 동의서 관리
   - 사용자가 예약할 때 입력한 applicationForm / consentForm을 관리자에서 확인
   - 접수완료, 보완요청, 출력용 상담신청서 복사 기능 제공
========================================================= */
function documentStatus(r){
  if(r.documentReviewStatus) return r.documentReviewStatus;
  if(r.applicationForm && r.consentForm && r.consentForm.privacy && r.consentForm.counseling && r.consentForm.cancelPolicy) return '제출완료';
  return '미제출/확인필요';
}
function documentStatusClass(st){
  if(st==='확인완료') return 'bg-emerald-100 text-emerald-700';
  if(st==='보완요청') return 'bg-rose-100 text-rose-700';
  if(st==='제출완료') return 'bg-blue-100 text-blue-700';
  return 'bg-amber-100 text-amber-700';
}
function updateDocumentStatus(id,status){updateReservation(id,{documentReviewStatus:status})}
function copyApplicationText(id){
  const r=state.reservations.find(x=>String(x.id)===String(id));if(!r)return;
  const a=r.applicationForm||{}, c=r.consentForm||{};
  const text=`[모두의 마음연구소 상담신청서 및 동의 확인]

■ 신청인
성명: ${r.name||''}
생년월일: ${a.birth||''}
연락처: ${r.phone||''}
이메일: ${a.email||''}
선호 연락 방법: ${a.contactMethod||''}
소속/직업군: ${a.clientType||''}

■ 신청 내용
신청 프로그램: ${r.program||''}
상담 방식: ${r.type||''}
희망 일정: ${r.date||''} ${r.time||''}
선택 검사: ${(r.reportTests||r.includedTests||r.selectedTests||r.extraTests||[]).join(', ')||'없음'}

■ 현재 어려움 및 배경
현재 가장 힘든 점: ${a.concern||''}
이전 상담/치료/검사 경험: ${a.counselingHistory||''}
복용 중인 약: ${a.medication||''}
진단/치료 중인 질환: ${a.diagnosis||''}
최근 자해/자살 위험: ${a.risk||''}

■ 동의 확인
개인정보 수집·이용 동의: ${c.privacy?'동의':'미동의'}
심리검사/상담 및 비밀보장 예외 동의: ${c.counseling?'동의':'미동의'}
예약 변경/취소 및 노쇼 규정 확인: ${c.cancelPolicy?'동의':'미동의'}
전자서명: ${c.signature||''}
동의일시: ${c.signedAt||''}
문서버전: ${c.documentVersion||''}

관리자 확인상태: ${documentStatus(r)}`;
  copyText(text);
}
function printApplication(id){
  const r=state.reservations.find(x=>String(x.id)===String(id));if(!r)return;
  const a=r.applicationForm||{}, c=r.consentForm||{};
  const w=window.open('','_blank');
  w.document.write(`<html><head><title>상담신청서_${esc(r.name)}</title><style>body{font-family:Arial,sans-serif;padding:40px;line-height:1.7;color:#1e293b}h1{font-size:24px}.box{border:1px solid #e2e8f0;border-radius:14px;padding:16px;margin:14px 0;background:#f8fafc}p{margin:6px 0}.sign{margin-top:28px;border-top:1px solid #ddd;padding-top:18px}</style></head><body><p style="font-size:12px;color:#047857;font-weight:bold;">MODUMAM-LAB</p><h1>상담신청서 및 심리상담 동의 확인서</h1><div class="box"><p><b>성명:</b> ${esc(r.name)}</p><p><b>생년월일:</b> ${esc(a.birth)}</p><p><b>연락처:</b> ${esc(r.phone)}</p><p><b>이메일:</b> ${esc(a.email)}</p><p><b>선호 연락:</b> ${esc(a.contactMethod)}</p><p><b>소속/직업군:</b> ${esc(a.clientType)}</p></div><div class="box"><p><b>프로그램:</b> ${esc(programBaseName(r.program))}</p><p><b>상담 방식:</b> ${esc(r.type)}</p><p><b>희망 일정:</b> ${esc(r.date)} ${esc(r.time)}</p><p><b>선택 검사:</b> ${esc((r.reportTests||r.includedTests||r.selectedTests||r.extraTests||[]).join(', '))}</p></div><div class="box"><p><b>현재 가장 힘든 점:</b></p><p>${esc(a.concern)}</p><p><b>이전 상담/치료/검사 경험:</b> ${esc(a.counselingHistory)}</p><p><b>복용 중인 약:</b> ${esc(a.medication)}</p><p><b>진단/치료 중인 질환:</b> ${esc(a.diagnosis)}</p><p><b>최근 자해/자살 위험:</b> ${esc(a.risk)}</p></div><div class="box"><p><b>개인정보 수집·이용:</b> ${c.privacy?'동의':'미동의'}</p><p><b>심리검사/상담 및 비밀보장 예외:</b> ${c.counseling?'동의':'미동의'}</p><p><b>예약 변경/취소 및 노쇼 규정:</b> ${c.cancelPolicy?'동의':'미동의'}</p><p><b>동의일시:</b> ${esc(c.signedAt)}</p><p><b>문서버전:</b> ${esc(c.documentVersion)}</p></div><div class="sign"><p>작성자(전자서명): <b>${esc(c.signature)}</b></p><p>관리자 확인상태: ${esc(documentStatus(r))}</p></div><script>window.print();<\/script></body></html>`);
  w.document.close();
}
function documentsView(){
  const submitted=state.reservations.filter(r=>documentStatus(r)==='제출완료').length;
  const confirmed=state.reservations.filter(r=>documentStatus(r)==='확인완료').length;
  const need=state.reservations.filter(r=>['미제출/확인필요','보완요청'].includes(documentStatus(r))).length;
  return layout(`
    <div class="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
      ${card('제출완료',submitted+'건','관리자 확인 전','📄','blue')}
      ${card('확인완료',confirmed+'건','상담 진행 가능','✅','emerald')}
      ${card('확인필요',need+'건','보완 또는 미제출','⚠️','orange')}
    </div>
    <div class="bg-white rounded-[2rem] border border-slate-100 shadow-sm overflow-hidden">
      <div class="p-6 border-b border-slate-100">
        <h2 class="text-xl font-extrabold">상담신청서 · 동의서 관리</h2>
        <p class="text-sm text-slate-500 mt-1">예약 신청 시 작성한 신청서와 개인정보/상담/취소 동의 여부를 확인합니다.</p>
        <div class="mt-4 flex flex-wrap gap-2">
          <a href="../public/forms/application.pdf" target="_blank" class="px-4 py-2 rounded-full bg-slate-900 text-white text-xs font-bold">상담신청서 PDF</a>
          <a href="../public/forms/consent.pdf" target="_blank" class="px-4 py-2 rounded-full bg-emerald-700 text-white text-xs font-bold">심리상담 동의서 PDF</a>
          <a href="../public/forms/" target="_blank" class="px-4 py-2 rounded-full bg-white border border-slate-200 text-xs font-bold">서류 안내 페이지</a>
        </div>
      </div>
      <div class="p-5 sm:p-6 space-y-5">
        ${state.reservations.map(r=>{const a=r.applicationForm||{}, c=r.consentForm||{}, st=documentStatus(r);return `
          <div class="rounded-[2rem] border border-slate-100 bg-slate-50 p-5">
            <div class="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-4">
              <div>
                <p class="text-lg font-extrabold text-slate-900">${esc(r.name)}님</p>
                <p class="text-xs text-slate-500 mt-1">${esc(r.phone)} · ${esc(a.email)} · ${esc(programBaseName(r.program))}</p>
                <p class="text-xs text-slate-400 mt-1">제출일시: ${esc(a.submittedAt||c.signedAt||'기록 없음')}</p>
              </div>
              <span class="text-xs font-bold px-3 py-1 rounded-full ${documentStatusClass(st)}">${st}</span>
            </div>
            <div class="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <div class="bg-white rounded-2xl border border-slate-100 p-4">
                <p class="text-xs font-extrabold text-slate-400 mb-2">신청서</p>
                <p class="text-xs text-slate-700"><b>생년월일</b> ${esc(a.birth)}</p>
                <p class="text-xs text-slate-700"><b>연락방법</b> ${esc(a.contactMethod)}</p>
                <p class="text-xs text-slate-700"><b>직업군</b> ${esc(a.clientType)}</p>
                <p class="text-xs text-slate-700 mt-2 whitespace-pre-line"><b>주호소</b>\n${esc(a.concern||'미입력')}</p>
              </div>
              <div class="bg-white rounded-2xl border border-slate-100 p-4">
                <p class="text-xs font-extrabold text-slate-400 mb-2">배경정보</p>
                <p class="text-xs text-slate-700 whitespace-pre-line"><b>이전 경험</b>\n${esc(a.counselingHistory||'미입력')}</p>
                <p class="text-xs text-slate-700 whitespace-pre-line mt-2"><b>약/진단/위험</b>\n약: ${esc(a.medication||'없음')}\n진단: ${esc(a.diagnosis||'없음')}\n위험: ${esc(a.risk||'없음')}</p>
              </div>
              <div class="bg-white rounded-2xl border border-slate-100 p-4">
                <p class="text-xs font-extrabold text-slate-400 mb-2">동의서</p>
                <p class="text-xs ${c.privacy?'text-emerald-700':'text-rose-600'} font-bold">${c.privacy?'✓':'!'} 개인정보 수집·이용</p>
                <p class="text-xs ${c.counseling?'text-emerald-700':'text-rose-600'} font-bold mt-1">${c.counseling?'✓':'!'} 상담/검사 및 비밀보장 예외</p>
                <p class="text-xs ${c.cancelPolicy?'text-emerald-700':'text-rose-600'} font-bold mt-1">${c.cancelPolicy?'✓':'!'} 취소/노쇼 규정</p>
                <p class="text-xs text-slate-700 mt-2"><b>전자서명</b> ${esc(c.signature||'없음')}</p>
                <select onchange="updateDocumentStatus(${r.id}, this.value)" class="mt-4 w-full border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold">
                  ${['제출완료','확인완료','보완요청','미제출/확인필요'].map(x=>`<option value="${x}" ${st===x?'selected':''}>${x}</option>`).join('')}
                </select>
                <div class="grid grid-cols-2 gap-2 mt-3">
                  <button onclick="copyApplicationText(${r.id})" class="bg-slate-900 text-white rounded-xl py-2 text-xs font-bold">내용 복사</button>
                  <button onclick="printApplication(${r.id})" class="bg-white border border-slate-200 rounded-xl py-2 text-xs font-bold">출력</button>
                </div>
              </div>
            </div>
          </div>
        `}).join('')||empty('확인할 신청서/동의서가 없습니다.')}
      </div>
    </div>
  `);
}


/* =========================================================
   [ADMIN-V1-20260712] 심리검사 결과 업로드 · AI 결과상담 활성화
   - 현재 버전은 localStorage 기반입니다.
   - 파일은 2MB 이하 PDF/이미지 파일을 브라우저에 저장합니다.
   - 실제 운영 배포 시에는 Netlify Blobs/Supabase 등 서버 저장소 연결이 필요합니다.
========================================================= */
function resultUploadCountForReservation(reservationId){
  return state.resultUploads.filter(x=>String(x.reservationId)===String(reservationId)).length;
}
function toggleAiResultCounseling(id,enabled){
  const patch={aiResultCounselingEnabled:!!enabled};
  if(enabled&&!state.reservations.find(r=>String(r.id)===String(id))?.aiResultCounselingActivatedAt){patch.aiResultCounselingActivatedAt=new Date().toLocaleString();}
  updateReservation(id,patch);
}
function toggleResultUploadVisibility(id){
  const item=state.resultUploads.find(x=>String(x.id)===String(id));
  if(!item)return;
  item.visibleToClient=!item.visibleToClient;
  item.visibilityUpdatedAt=new Date().toLocaleString();
  save('modumam_test_result_uploads',state.resultUploads);
  render();
}
function deleteResultUpload(id){
  if(!confirm('업로드한 검사결과를 삭제하시겠습니까?'))return;
  state.resultUploads=state.resultUploads.filter(x=>String(x.id)!==String(id));
  save('modumam_test_result_uploads',state.resultUploads);
  render();
}
function downloadResultUpload(id){
  const item=state.resultUploads.find(x=>String(x.id)===String(id));
  if(!item||!item.dataUrl){alert('저장된 파일을 찾을 수 없습니다.');return;}
  const a=document.createElement('a');a.href=item.dataUrl;a.download=item.fileName||'검사결과';document.body.appendChild(a);a.click();a.remove();
}
function saveResultUpload(event){
  event.preventDefault();
  const reservationId=document.getElementById('result-reservation')?.value||'';
  const testType=document.getElementById('result-test-type')?.value||'';
  const summary=document.getElementById('result-summary')?.value?.trim()||'';
  const visible=document.getElementById('result-visible')?.checked||false;
  const file=document.getElementById('result-file')?.files?.[0];
  if(!reservationId){alert('대상 회원을 선택해 주세요.');return;}
  if(!testType){alert('검사명을 선택해 주세요.');return;}
  if(!file){alert('검사결과 파일을 선택해 주세요.');return;}
  if(file.size>2*1024*1024){alert('현재 로컬 버전에서는 2MB 이하 파일만 저장할 수 있습니다.');return;}
  const allowed=['application/pdf','image/png','image/jpeg','image/webp'];
  if(!allowed.includes(file.type)){alert('PDF, PNG, JPG, WEBP 파일만 업로드할 수 있습니다.');return;}
  const reservation=state.reservations.find(r=>String(r.id)===String(reservationId));
  const reader=new FileReader();
  reader.onload=()=>{
    const item={id:Date.now(),reservationId:reservation?.id||reservationId,clientName:reservation?.name||'',phone:reservation?.phone||'',program:programBaseName(reservation?.program),testType,summary,fileName:file.name,mimeType:file.type,size:file.size,dataUrl:reader.result,visibleToClient:visible,createdAt:new Date().toLocaleString()};
    state.resultUploads=[item,...state.resultUploads];
    save('modumam_test_result_uploads',state.resultUploads);
    if(reservation){updateReservation(reservation.id,{status:'결과업로드',resultUploadedAt:item.createdAt});}else{render();}
    alert('검사결과가 저장되었습니다.');
  };
  reader.onerror=()=>alert('파일을 읽는 중 오류가 발생했습니다.');
  reader.readAsDataURL(file);
}
function resultUploadsView(){
  const rows=state.reservations.slice().sort((a,b)=>{
    const aDate=`${a.date||''} ${a.time||''}`;
    const bDate=`${b.date||''} ${b.time||''}`;
    return bDate.localeCompare(aDate);
  });
  const activeAi=rows.filter(r=>r.aiResultCounselingEnabled===true).length;
  const aiCompleted=rows.filter(r=>!!r.aiResultCounselingCompletedAt).length;
  const pendingReservations=rows.filter(r=>!['상담완료','종결','예약취소'].includes(normalizeStatus(r.status))).length;

  return layout(`<div class="space-y-6">
    <div class="rounded-[2rem] bg-gradient-to-r from-slate-950 via-indigo-950 to-violet-950 p-6 text-white shadow-xl sm:p-8">
      <p class="text-xs font-extrabold text-violet-300">PSYCHOLOGICAL TEST OPERATIONS</p>
      <h2 class="mt-2 text-2xl font-extrabold">심리검사 예약 · AI 상담 관리</h2>
      <p class="mt-2 max-w-4xl text-sm leading-relaxed text-slate-300">심리검사 예약정보와 진행상태를 확인하고, 결과보고서가 준비된 회원의 AI 결과상담을 활성화합니다. 검사결과 파일 업로드와 분석은 심리평가센터에서 진행합니다.</p>
      <div class="mt-5 flex flex-wrap gap-2">
        <button onclick="setMenu('reservation')" class="rounded-xl bg-white px-4 py-2 text-xs font-extrabold text-slate-900">예약관리 열기</button>
        <button onclick="setMenu('interpretation')" class="rounded-xl border border-white/20 bg-white/10 px-4 py-2 text-xs font-extrabold text-white">심리평가센터 열기</button>
      </div>
    </div>

    <div class="grid grid-cols-1 gap-4 sm:grid-cols-4">
      ${card('전체 예약',rows.length+'건','심리검사·상담 예약','📅','blue')}
      ${card('진행 중',pendingReservations+'건','종결·취소 제외','⏳','orange')}
      ${card('AI 상담 활성',activeAi+'명','회원별 활성화','🤖','purple')}
      ${card('AI 상담 완료',aiCompleted+'건','상담 완료 기록','✅','emerald')}
    </div>

    <div class="rounded-[2rem] border border-slate-100 bg-white p-5 shadow-sm sm:p-6">
      <div class="mb-5 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h2 class="text-xl font-extrabold">예약 확인 및 AI 결과상담 활성화</h2>
          <p class="mt-1 text-sm text-slate-500">예약일정 · 프로그램명 · 검사명 · 상담방식을 확인하고 진행상태와 AI 상담 이용 여부를 관리합니다.</p>
        </div>
        <div class="rounded-2xl border border-indigo-100 bg-indigo-50 px-4 py-3 text-xs font-bold text-indigo-700">결과 업로드는 심리평가센터에서 관리</div>
      </div>

      <div class="space-y-4">${rows.map(r=>{
        const tests=requestedTests(r).map(shortTestName);
        const st=normalizeStatus(r.status);
        const uploads=state.resultUploads.filter(x=>String(x.reservationId)===String(r.id));
        const enabled=r.aiResultCounselingEnabled===true;
        const completed=!!r.aiResultCounselingCompletedAt;
        const aiLabel=completed?'상담 완료':enabled?'활성':'비활성';
        const aiClass=completed?'bg-emerald-100 text-emerald-700':enabled?'bg-violet-100 text-violet-700':'bg-slate-100 text-slate-500';
        return `<article class="rounded-3xl border border-slate-100 bg-slate-50 p-5">
          <div class="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
            <div class="min-w-0 flex-1">
              <div class="flex flex-wrap items-center gap-2">
                <p class="text-lg font-extrabold text-slate-900">${esc(r.name)}님</p>
                <span class="rounded-full px-3 py-1 text-[11px] font-extrabold ${statusClass(st)}">${esc(st)}</span>
                <span class="rounded-full px-3 py-1 text-[11px] font-extrabold ${aiClass}">AI 상담 ${aiLabel}</span>
              </div>
              <p class="mt-2 text-xs text-slate-500">${esc(r.phone||'연락처 없음')} · 신청일 ${esc(r.createdAt||r.date||'')}</p>

              <div class="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <div class="rounded-2xl border border-slate-100 bg-white p-4"><p class="text-[10px] font-extrabold text-slate-400">예약일정</p><p class="mt-1 text-sm font-extrabold text-slate-900">${esc(r.date||'미정')} ${esc(r.time||'')}</p></div>
                <div class="rounded-2xl border border-slate-100 bg-white p-4"><p class="text-[10px] font-extrabold text-slate-400">프로그램명</p><p class="mt-1 text-sm font-extrabold text-slate-900">${esc(programBaseName(r.program)||'미정')}</p></div>
                <div class="rounded-2xl border border-slate-100 bg-white p-4"><p class="text-[10px] font-extrabold text-slate-400">검사명</p><p class="mt-1 text-sm font-extrabold text-slate-900">${esc(tests.join(', ')||'없음')}</p></div>
                <div class="rounded-2xl border border-slate-100 bg-white p-4"><p class="text-[10px] font-extrabold text-slate-400">상담방식</p><p class="mt-1 text-sm font-extrabold text-slate-900">${esc(r.type||'미정')}</p></div>
              </div>

              <div class="mt-4 flex flex-wrap gap-2 text-[11px] font-bold">
                <span class="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-slate-600">평가센터 결과 ${uploads.length}건</span>
                ${r.resultReportApproved?'<span class="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-emerald-700">결과보고서 승인</span>':'<span class="rounded-full border border-amber-200 bg-amber-50 px-3 py-1.5 text-amber-700">결과보고서 확인 필요</span>'}
                ${completed?`<span class="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-emerald-700">완료 ${esc(r.aiResultCounselingCompletedAt)}</span>`:''}
              </div>
            </div>

            <div class="w-full space-y-3 xl:w-64">
              <label class="flex items-center justify-between gap-3 rounded-2xl border ${enabled?'border-violet-200 bg-violet-50':'border-slate-200 bg-white'} px-4 py-3 text-sm font-extrabold">
                <span>AI 결과상담 활성화</span>
                <input type="checkbox" ${enabled?'checked':''} ${completed?'disabled':''} onchange="toggleAiResultCounseling(${r.id},this.checked)" class="h-5 w-5"/>
              </label>
              <select onchange="updateReservation(${r.id},{status:this.value})" class="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-xs font-extrabold">
                ${STATUS.map(x=>`<option value="${x}" ${st===x?'selected':''}>${x}</option>`).join('')}
              </select>
              <div class="grid grid-cols-2 gap-2">
                <button onclick="openMemberChartByReservation(${r.id},'profile')" class="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-xs font-extrabold">전자차트</button>
                <button onclick="setMenu('reservation')" class="rounded-xl bg-slate-900 px-3 py-2.5 text-xs font-extrabold text-white">예약관리</button>
              </div>
              <button onclick="setMenu('interpretation')" class="w-full rounded-xl bg-indigo-600 px-3 py-2.5 text-xs font-extrabold text-white">심리평가센터에서 결과 확인</button>
            </div>
          </div>
        </article>`;
      }).join('')||empty('확인할 예약이 없습니다.')}</div>
    </div>
  </div>`);
}


// ===== [MODUMAM COUNSELING 시작] =====
function setCounselingJournalTab(tab){
  state.counselingJournalTab=tab==='termination'?'termination':'sessions';
  render();
}


async function callCounselingFunction(functionName, options = {}){
  const path=`/.netlify/functions/${functionName}`;
  const localHost=['localhost','127.0.0.1'].includes(window.location.hostname);
  const candidates=localHost
    ? [`http://localhost:8888${path}`,path]
    : [path];

  let lastError=null;

  for(const url of [...new Set(candidates)]){
    try{
      const response=await fetch(url,options);
      const raw=await response.text();

      let data={};
      try{
        data=raw?JSON.parse(raw):{};
      }catch{
        throw new Error(
          response.status===404
            ? 'AI 회기기록 함수를 찾지 못했습니다.'
            : 'AI 회기기록 서버 응답을 읽지 못했습니다.'
        );
      }

      if(!response.ok){
        throw new Error(
          data.error ||
          data.message ||
          `AI 회기기록 요청 실패 (HTTP ${response.status})`
        );
      }

      return data;
    }catch(error){
      lastError=error;
    }
  }

  if(localHost){
    throw new Error(
      `${lastError?.message||'로컬 AI 서버 연결 실패'}\n새 터미널에서 npx netlify dev를 실행하고 http://localhost:8888로 접속해 주세요.`
    );
  }

  throw lastError||new Error('AI 회기기록 서버에 연결하지 못했습니다.');
}



const COUNSELING_TRANSCRIPT_DB='modumam_counseling_files';
const COUNSELING_TRANSCRIPT_DB_VERSION=1;
const COUNSELING_TRANSCRIPT_STORE='transcripts';

function openCounselingTranscriptDb(){
  return new Promise((resolve,reject)=>{
    const request=indexedDB.open(
      COUNSELING_TRANSCRIPT_DB,
      COUNSELING_TRANSCRIPT_DB_VERSION
    );

    request.onupgradeneeded=()=>{
      const db=request.result;
      if(!db.objectStoreNames.contains(COUNSELING_TRANSCRIPT_STORE)){
        db.createObjectStore(COUNSELING_TRANSCRIPT_STORE,{keyPath:'id'});
      }
    };

    request.onsuccess=()=>resolve(request.result);
    request.onerror=()=>reject(
      request.error||new Error('축어록 파일 저장소를 열지 못했습니다.')
    );
  });
}

async function saveCounselingTranscriptFile(record){
  const db=await openCounselingTranscriptDb();

  try{
    await new Promise((resolve,reject)=>{
      const tx=db.transaction(COUNSELING_TRANSCRIPT_STORE,'readwrite');
      tx.objectStore(COUNSELING_TRANSCRIPT_STORE).put(record);
      tx.oncomplete=()=>resolve();
      tx.onerror=()=>reject(
        tx.error||new Error('축어록 파일을 저장하지 못했습니다.')
      );
      tx.onabort=()=>reject(
        tx.error||new Error('축어록 파일 저장이 중단되었습니다.')
      );
    });
  }finally{
    db.close();
  }
}

async function getCounselingTranscriptFile(transcriptId){
  const db=await openCounselingTranscriptDb();

  try{
    return await new Promise((resolve,reject)=>{
      const tx=db.transaction(COUNSELING_TRANSCRIPT_STORE,'readonly');
      const request=tx.objectStore(COUNSELING_TRANSCRIPT_STORE)
        .get(String(transcriptId));

      request.onsuccess=()=>resolve(request.result||null);
      request.onerror=()=>reject(
        request.error||new Error('축어록 파일을 불러오지 못했습니다.')
      );
    });
  }finally{
    db.close();
  }
}

async function removeCounselingTranscriptFile(transcriptId){
  const db=await openCounselingTranscriptDb();

  try{
    await new Promise((resolve,reject)=>{
      const tx=db.transaction(COUNSELING_TRANSCRIPT_STORE,'readwrite');
      tx.objectStore(COUNSELING_TRANSCRIPT_STORE)
        .delete(String(transcriptId));

      tx.oncomplete=()=>resolve();
      tx.onerror=()=>reject(
        tx.error||new Error('축어록 파일을 삭제하지 못했습니다.')
      );
      tx.onabort=()=>reject(
        tx.error||new Error('축어록 파일 삭제가 중단되었습니다.')
      );
    });
  }finally{
    db.close();
  }
}

function counselingUploadedTranscriptKey(caseId){
  return `modumam_uploaded_transcripts_${caseId}`;
}

function getUploadedCounselingTranscripts(caseId){
  return load(counselingUploadedTranscriptKey(caseId),[]);
}

function saveUploadedCounselingTranscript(caseId,record){
  const rows=getUploadedCounselingTranscripts(caseId);
  const next=[
    record,
    ...rows.filter(item=>String(item.id)!==String(record.id))
  ].slice(0,20);
  save(counselingUploadedTranscriptKey(caseId),next);
}

function updateUploadedCounselingTranscript(caseId,transcriptId,patch){
  const rows=getUploadedCounselingTranscripts(caseId).map(item=>
    String(item.id)===String(transcriptId)
      ? {...item,...patch}
      : item
  );
  save(counselingUploadedTranscriptKey(caseId),rows);
}

async function deleteUploadedCounselingTranscript(caseId,transcriptId){
  if(!confirm('업로드한 축어록 기록을 삭제하시겠습니까?'))return;

  const next=getUploadedCounselingTranscripts(caseId)
    .filter(item=>String(item.id)!==String(transcriptId));

  save(counselingUploadedTranscriptKey(caseId),next);

  try{
    await removeCounselingTranscriptFile(transcriptId);
  }catch(error){
    console.error('[축어록 IndexedDB 삭제]',error);
  }

  render();
}

const counselingTranscriptSelections={};
const counselingTranscriptMetadata={};
const counselingSessionRewriteTargets={};

function counselingNoteText(value,sectionLabel=''){
  if(value==null)return '';

  if(typeof value==='string'||typeof value==='number'||typeof value==='boolean'){
    const raw=String(value).trim();
    if(!raw||raw==='[object Object]')return '';
    return raw;
  }

  if(Array.isArray(value)){
    return value
      .map((item,index)=>{
        const normalized=counselingNoteText(item,sectionLabel);
        if(!normalized)return '';
        return /^\d+[\.\)]\s/.test(normalized)?normalized:`${index+1}. ${normalized}`;
      })
      .filter(Boolean)
      .join('\n');
  }

  if(typeof value==='object'){
    const keyLabels={
      summary:'요약',
      text:'내용',
      content:'상담내용',
      detail:'세부내용',
      description:'설명',
      observation:'관찰',
      client:'내담자',
      clientStatement:'내담자 진술',
      clientResponse:'내담자 반응',
      counselor:'상담자',
      counselorIntervention:'상담자 개입',
      intervention:'상담개입',
      response:'반응',
      change:'변화',
      outcome:'상담결과',
      result:'결과',
      task:'실천과제',
      homework:'실천과제',
      plan:'계획',
      next:'다음회기',
      goal:'목표',
      focus:'중점',
      risk:'위험요인',
      protective:'보호요인'
    };

    const priorityOrder=[
      'summary','clientStatement','clientResponse','client',
      'observation','counselorIntervention','intervention','counselor',
      'content','detail','description','text',
      'change','outcome','result','task','homework','plan','next','goal','focus',
      'risk','protective'
    ];

    const entries=[];
    const used=new Set();

    for(const key of priorityOrder){
      if(!(key in value))continue;
      const normalized=counselingNoteText(value[key],keyLabels[key]||key);
      if(normalized){
        entries.push(`${keyLabels[key]||key}\n${normalized}`);
        used.add(key);
      }
    }

    for(const [key,item] of Object.entries(value)){
      if(used.has(key))continue;
      const normalized=counselingNoteText(item,keyLabels[key]||key);
      if(normalized){
        entries.push(`${keyLabels[key]||key}\n${normalized}`);
      }
    }

    return entries.join('\n\n').trim();
  }

  const fallback=String(value).trim();
  return fallback==='[object Object]'?'':fallback;
}


function handleCounselingTranscriptInput(input){
  if(!input)return;

  const caseId=String(input.dataset.counselingCaseId||'');
  const file=input.files?.[0];

  if(!caseId){
    alert('사례 정보를 확인하지 못했습니다.');
    input.value='';
    return;
  }

  if(!file)return;

  selectCounselingTranscript(caseId,file);

  const transcriptCheckbox=document.getElementById(`session-source-transcript-${caseId}`);
  if(transcriptCheckbox)transcriptCheckbox.checked=true;

  const nameEl=document.getElementById(`counseling-transcript-name-${caseId}`);
  if(nameEl){
    nameEl.textContent=`첨부 완료: ${file.name} · ${Math.ceil(file.size/1024)}KB`;
    nameEl.className='mt-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-extrabold text-emerald-700';
  }
}
window.handleCounselingTranscriptInput=handleCounselingTranscriptInput;

function selectCounselingTranscript(caseId,file){
  if(!file)return;

  const extension=String(file.name||'').split('.').pop().toLowerCase();
  const allowedMime=['text/plain','application/pdf','image/png','image/jpeg','image/webp'];
  const allowedExtensions=['txt','pdf','png','jpg','jpeg','webp'];

  if(
    !allowedMime.includes(file.type) &&
    !allowedExtensions.includes(extension)
  ){
    alert('축어록은 TXT, PDF, PNG, JPG, WEBP 파일만 업로드할 수 있습니다.');
    return;
  }

  if(file.size>4*1024*1024){
    alert('축어록 파일은 4MB 이하로 올려 주세요.');
    return;
  }

  counselingTranscriptSelections[String(caseId)]=file;
  counselingTranscriptMetadata[String(caseId)]={
    name:String(file.name||'축어록'),
    size:Number(file.size||0),
    type:String(file.type||''),
    status:'첨부 완료'
  };

  const nameEl=document.getElementById(`counseling-transcript-name-${caseId}`);
  if(nameEl){
    nameEl.innerHTML=`<span class="font-extrabold">선택 완료:</span> ${esc(file.name)} · ${Math.ceil(file.size/1024)}KB`;
    nameEl.className='mt-3 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-700';
  }

  const runButton=document.getElementById(`counseling-transcript-run-${caseId}`);
  if(runButton){
    runButton.disabled=false;
    runButton.classList.remove('opacity-50','cursor-not-allowed');
    runButton.classList.add('cursor-pointer');
  }
}

async function uploadCounselingTranscriptAuto(caseId,reservationId){
  const input=document.getElementById(`counseling-transcript-file-${caseId}`);
  const file=input?.files?.[0];

  if(!file){
    alert('축어록 파일을 먼저 선택해 주세요.');
    input?.click();
    return;
  }

  const extension=String(file.name||'').split('.').pop().toLowerCase();
  const allowedMime=['text/plain','application/pdf','image/png','image/jpeg','image/webp'];
  const allowedExtensions=['txt','pdf','png','jpg','jpeg','webp'];

  if(!allowedMime.includes(file.type) && !allowedExtensions.includes(extension)){
    alert('축어록은 TXT, PDF, PNG, JPG, WEBP 파일만 업로드할 수 있습니다.');
    return;
  }

  if(file.size>8*1024*1024){
    alert('축어록 파일은 8MB 이하로 올려 주세요.');
    return;
  }

  const reservation=state.reservations.find(
    item=>String(item.id)===String(reservationId)
  );

  if(!reservation){
    alert('예약 정보를 찾지 못했습니다.');
    return;
  }

  const sessionNumber=Math.max(
    1,
    Number(document.getElementById(`counseling-session-number-${caseId}`)?.value)||1
  );

  const sessionDate=String(
    document.getElementById(`counseling-session-date-${caseId}`)?.value ||
    reservation.date ||
    new Date().toISOString().slice(0,10)
  );

  const button=document.getElementById(`counseling-transcript-run-${caseId}`);
  const status=document.getElementById(`counseling-transcript-status-${caseId}`);

  if(button){
    button.disabled=true;
    button.textContent='파일 저장 중...';
  }

  try{
    const transcriptId=String(Date.now());

    const mimeType=file.type || (
      extension==='pdf'?'application/pdf':
      extension==='txt'?'text/plain':
      extension==='png'?'image/png':
      extension==='webp'?'image/webp':
      'image/jpeg'
    );

    // 파일 본문은 용량 제한이 큰 IndexedDB에 저장합니다.
    await saveCounselingTranscriptFile({
      id:transcriptId,
      caseId:String(caseId),
      reservationId:String(reservationId),
      sessionNumber,
      sessionDate,
      fileName:file.name,
      fileSize:file.size,
      mimeType,
      blob:file,
      createdAt:new Date().toISOString()
    });

    // localStorage에는 작은 메타데이터만 저장합니다.
    const uploadRecord={
      id:transcriptId,
      reservationId:String(reservationId),
      sessionNumber,
      sessionDate,
      fileName:file.name,
      fileSize:file.size,
      mimeType,
      aiStatus:'대기',
      createdAt:new Date().toLocaleString('ko-KR')
    };

    saveUploadedCounselingTranscript(caseId,uploadRecord);

    if(input)input.value='';

    if(status){
      status.textContent=`업로드 완료: ${file.name}`;
      status.className='mt-3 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-700';
    }

    alert('축어록 파일 업로드가 완료되었습니다.');
    render();
  }catch(error){
    console.error('[상담일지 축어록 파일 저장]',error);

    if(status){
      status.textContent=`파일 업로드 실패: ${error?.message||'알 수 없는 오류'}`;
      status.className='mt-3 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-bold text-rose-700';
    }

    alert(error?.message||'축어록 파일 업로드 중 오류가 발생했습니다.');
  }finally{
    if(button){
      button.disabled=false;
      button.textContent='축어록 업로드';
    }
  }
}


async function retryCounselingTranscriptAI(caseId,reservationId,transcriptId){
  const reservation=state.reservations.find(
    item=>String(item.id)===String(reservationId)
  );

  const transcript=getUploadedCounselingTranscripts(caseId)
    .find(item=>String(item.id)===String(transcriptId));

  if(!reservation||!transcript){
    alert('축어록 또는 예약 정보를 찾지 못했습니다.');
    return;
  }

  try{
    updateUploadedCounselingTranscript(caseId,transcriptId,{aiStatus:'작성 중'});
    render();

    const storedFile=await getCounselingTranscriptFile(transcriptId);

    if(!storedFile?.blob){
      throw new Error('저장된 축어록 파일을 찾지 못했습니다.');
    }

    const base64=await fileToBase64(storedFile.blob);

    const data=await callCounselingFunction('counseling-transcript-summary',{
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({
        clientName:reservation.name||'',
        program:programBaseName(reservation.program),
        counselingMethod:reservation.type||'',
        date:transcript.sessionDate,
        sessionNumber:transcript.sessionNumber,
        fileName:transcript.fileName,
        mimeType:transcript.mimeType,
        base64
      })
    });

    if(!data?.note){
      throw new Error('AI 회기기록 결과를 받지 못했습니다.');
    }

    const note=data.note;
    const key='modumam_case_sessions_'+caseId;
    const sessions=load(key,[]);

    sessions.unshift({
      id:Date.now(),
      sessionNumber:transcript.sessionNumber,
      date:transcript.sessionDate,
      goal:note.goal||`${transcript.sessionNumber}회기 축어록 기반 회기기록`,
      content:note.content||'',
      change:note.change||'',
      task:note.task||'',
      next:note.next||'',
      transcriptSummary:note.summary||'',
      transcriptFileName:transcript.fileName,
      transcriptMimeType:transcript.mimeType,
      transcriptUploadId:transcript.id,
      aiGenerated:true,
      createdAt:new Date().toLocaleString('ko-KR')
    });

    save(key,sessions);

    updateUploadedCounselingTranscript(caseId,transcriptId,{
      aiStatus:'완료',
      aiError:'',
      aiCompletedAt:new Date().toLocaleString('ko-KR')
    });

    alert('AI 회기기록 작성이 완료되었습니다.');
    render();
  }catch(error){
    updateUploadedCounselingTranscript(caseId,transcriptId,{
      aiStatus:'실패',
      aiError:error?.message||'AI 작성 실패'
    });

    alert(error?.message||'AI 회기기록 작성에 실패했습니다.');
    render();
  }
}


window.retryCounselingTranscriptAI=retryCounselingTranscriptAI;
window.deleteUploadedCounselingTranscript=deleteUploadedCounselingTranscript;

function runCounselingTranscriptFromButton(button){
  if(!button)return;

  const caseId=String(button.dataset.counselingCaseId||'');
  const reservationId=String(button.dataset.counselingReservationId||'');

  if(!caseId||!reservationId){
    alert('회기기록에 필요한 사례 또는 예약 정보를 확인하지 못했습니다.');
    return;
  }

  uploadCounselingTranscriptAuto(caseId,reservationId);
}
window.runCounselingTranscriptFromButton=runCounselingTranscriptFromButton;


window.selectCounselingTranscript=selectCounselingTranscript;
window.uploadCounselingTranscriptAuto=uploadCounselingTranscriptAuto;
// ===== [MODUMAM COUNSELING 끝] =====

/* V29: 오늘상담·운영비서·대시보드·예약관리·접수·회원 전자차트·상담모드 코드는 js/modules/operations-workspace.js로 분리되었습니다. */

function terminationKey(reservationId){return 'modumam_termination_'+String(reservationId)}

/* V26: 사례종결평가 및 상담성과 통계 코드는 js/modules/outcomes-workspace.js로 분리되었습니다. */

function settingsView(){const st=getOperatingSettings();const allMethods=['장소 조율(대면)','찾아가는(대면)','Zoom(비대면)','24시 AI상담(비대면)'];return layout(`<div class="space-y-6 max-w-5xl">
  <div class="rounded-[2rem] bg-slate-950 p-6 text-white"><p class="text-xs font-extrabold text-emerald-300">OPERATING SETTINGS</p><h2 class="mt-2 text-2xl font-extrabold">환경설정</h2><p class="mt-2 text-sm text-slate-300">상담시간, 예약 간격, 상담방식과 프로그램별 기본검사를 코드 수정 없이 관리합니다.</p></div>
  <section class="rounded-[2rem] border border-slate-100 bg-white p-6 shadow-sm"><h3 class="text-lg font-extrabold">운영센터 기본정보</h3><div class="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2"><label class="text-xs font-bold text-slate-500">운영센터명<input id="setting-center-name" value="${esc(st.centerName)}" class="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm"></label><label class="text-xs font-bold text-slate-500">상담사명<input id="setting-counselor-name" value="${esc(st.counselorName)}" placeholder="선택 입력" class="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm"></label></div><label class="mt-4 block text-xs font-bold text-slate-500">회원 안내문<textarea id="setting-contact-message" rows="3" class="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm">${esc(st.contactMessage)}</textarea></label></section>
  <section class="rounded-[2rem] border border-slate-100 bg-white p-6 shadow-sm"><h3 class="text-lg font-extrabold">예약 운영시간</h3><div class="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3"><label class="text-xs font-bold text-slate-500">시작시간<input id="setting-open-time" type="time" value="${esc(st.openTime)}" class="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm"></label><label class="text-xs font-bold text-slate-500">종료시간<input id="setting-close-time" type="time" value="${esc(st.closeTime)}" class="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm"></label><label class="text-xs font-bold text-slate-500">예약 간격<select id="setting-interval" class="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm"><option value="30" ${Number(st.intervalMinutes)===30?'selected':''}>30분</option><option value="60" ${Number(st.intervalMinutes)===60?'selected':''}>60분</option></select></label></div><p class="mt-3 text-xs text-slate-400">현재 생성되는 예약시간: ${buildCounselingTimes(st).join(', ')}</p></section>
  <section class="rounded-[2rem] border border-slate-100 bg-white p-6 shadow-sm"><h3 class="text-lg font-extrabold">사용 상담방식</h3><div class="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">${allMethods.map(m=>`<label class="flex items-center justify-between rounded-2xl border border-slate-200 p-4 text-sm font-bold"><span>${esc(m)}</span><input type="checkbox" ${st.enabledMethods.includes(m)?'checked':''} onchange="toggleOperatingMethod('${m}',this.checked)" class="h-5 w-5"></label>`).join('')}</div></section>
  <section class="rounded-[2rem] border border-slate-100 bg-white p-6 shadow-sm"><h3 class="text-lg font-extrabold">프로그램별 기본검사</h3><p class="mt-1 text-xs text-slate-400">검사명은 쉼표로 구분합니다. 예약·전자차트의 신청검사 표시에 자동 반영됩니다.</p><div class="mt-4 space-y-4"><label class="block text-xs font-bold text-slate-500">개인 마음이음<input id="setting-tests-personal" value="${esc((st.programDefaultTests['개인 마음이음']||[]).join(', '))}" class="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm"></label><label class="block text-xs font-bold text-slate-500">부부 마음이음<input id="setting-tests-couple" value="${esc((st.programDefaultTests['부부 마음이음']||[]).join(', '))}" class="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm"></label><label class="block text-xs font-bold text-slate-500">부모-자녀 마음이음<input id="setting-tests-parent" value="${esc((st.programDefaultTests['부모-자녀 마음이음']||[]).join(', '))}" class="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm"></label></div></section>
  <section class="rounded-[2rem] border border-slate-100 bg-white p-6 shadow-sm"><h3 class="text-lg font-extrabold">업무 자동화 기준</h3><div class="mt-4 space-y-3"><label class="flex items-center justify-between rounded-2xl bg-slate-50 p-4 text-sm font-bold"><span>진행상태에 따라 다음 업무 자동 생성</span><input id="setting-auto-rules" type="checkbox" ${st.autoRules?'checked':''} class="h-5 w-5"></label><label class="flex items-center justify-between rounded-2xl bg-slate-50 p-4 text-sm font-bold"><span>승인된 결과보고서가 있어야 AI 결과상담 승인</span><input id="setting-ai-report" type="checkbox" ${st.aiApprovalRequiresReport?'checked':''} class="h-5 w-5"></label></div></section>
  <section class="rounded-[2rem] border border-slate-100 bg-white p-6 shadow-sm"><div class="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div><h3 class="text-lg font-extrabold">데이터 백업·복원</h3><p class="mt-1 text-xs leading-relaxed text-slate-400">예약, 검사결과, 보고서, 사례개념화, 회기기록과 운영설정을 하나의 JSON 파일로 보관합니다.</p></div><span class="rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700">최근 백업: ${(()=>{const v=localStorage.getItem('modumam_last_backup_at');return v?new Date(v).toLocaleString('ko-KR'):'기록 없음'})()}</span></div><div class="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-3"><button onclick="downloadOperatingBackup()" class="rounded-2xl bg-slate-900 py-3 text-sm font-extrabold text-white">백업 파일 다운로드</button><select id="backup-restore-mode" class="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold"><option value="merge">현재 데이터에 병합</option><option value="replace">현재 데이터 전체 교체</option></select><button onclick="openBackupRestore()" class="rounded-2xl border border-slate-200 bg-white py-3 text-sm font-extrabold">백업 파일 복원</button></div><input id="backup-restore-file" type="file" accept="application/json,.json" class="hidden" onchange="restoreOperatingBackup(this)"><div class="mt-4 rounded-2xl bg-amber-50 p-4 text-xs leading-relaxed text-amber-800"><strong>복원 전 확인:</strong> 전체 교체는 현재 상담운영 데이터를 삭제한 후 백업 내용으로 바꿉니다. 중요한 변경 전에는 먼저 새 백업을 내려받아 주세요.</div></section>
  <section class="rounded-[2rem] border border-slate-100 bg-white p-6 shadow-sm"><div class="flex items-center justify-between gap-3"><div><h3 class="text-lg font-extrabold">관리자 변경기록</h3><p class="mt-1 text-xs text-slate-400">최근 저장·백업·복원 동작을 최대 300건까지 기록합니다.</p></div><button onclick="clearAuditLog()" class="rounded-xl border border-rose-200 bg-white px-3 py-2 text-xs font-bold text-rose-600">기록 비우기</button></div><div class="mt-4">${auditLogView()}</div></section>
  <div class="grid grid-cols-1 gap-3 sm:grid-cols-3"><button onclick="saveOperatingSettings()" class="rounded-2xl bg-emerald-600 py-3 text-sm font-extrabold text-white">설정 저장</button><button onclick="resetOperatingSettings()" class="rounded-2xl border border-slate-200 bg-white py-3 text-sm font-bold">기본값 복원</button><button onclick="location.href='/'" class="rounded-2xl border border-slate-200 bg-white py-3 text-sm font-bold">사용자 페이지</button></div>
</div>`)}


function loginView(){
  const now=Date.now();
  const locked=state.loginLockedUntil&&now<state.loginLockedUntil;
  const remain=locked?Math.max(1,Math.ceil((state.loginLockedUntil-now)/1000)):0;
  return `<main class="min-h-screen bg-slate-100 flex items-center justify-center p-4">
    <section class="w-full max-w-md rounded-[2rem] border border-slate-200 bg-white p-7 shadow-xl sm:p-9">
      <div class="text-center">
        <p class="text-xs font-extrabold text-emerald-700">MODUMAM-LAB</p>
        <h1 class="mt-2 text-2xl font-extrabold text-slate-950">상담운영센터 2.0</h1>
        <p class="mt-2 text-sm leading-relaxed text-slate-500">관리자 비밀번호를 입력해 주세요.</p>
      </div>
      <form onsubmit="login(event)" class="mt-7 space-y-4">
        <label class="block text-xs font-extrabold text-slate-500">관리자 비밀번호
          <input
            type="password"
            value="${esc(state.password||'')}"
            oninput="state.password=this.value"
            autocomplete="current-password"
            placeholder="비밀번호 입력"
            class="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm outline-none focus:border-emerald-500 focus:bg-white"
          />
        </label>
        ${state.loginError?`<div class="rounded-2xl border border-rose-100 bg-rose-50 px-4 py-3 text-xs font-bold leading-relaxed text-rose-600">${esc(state.loginError)}</div>`:''}
        ${locked?`<p class="text-center text-xs font-bold text-amber-600">${remain}초 후 다시 시도할 수 있습니다.</p>`:''}
        <button type="submit" class="w-full rounded-2xl bg-slate-900 py-4 text-sm font-extrabold text-white hover:bg-slate-800">관리자 로그인</button>
      </form>
      <button type="button" onclick="location.href='/'" class="mt-3 w-full rounded-2xl border border-slate-200 bg-white py-3 text-xs font-extrabold text-slate-600">사용자 페이지로 돌아가기</button>
      <p class="mt-5 text-center text-[11px] leading-relaxed text-slate-400">브라우저를 닫으면 관리자 로그인이 해제됩니다.</p>
    </section>
  </main>`;
}


/* V31 공통 UI 컴포넌트 별칭 */
function uiButton(label,options={}){return window.MMLUI?.button?.(label,options)||`<button type="button">${esc(label)}</button>`}
function uiBadge(label,options={}){return window.MMLUI?.badge?.(label,options)||`<span>${esc(label)}</span>`}
function uiCard(content,options={}){return window.MMLUI?.card?.(content,options)||`<section>${content}</section>`}
function uiEmpty(options={}){return window.MMLUI?.emptyState?.(options)||`<div>${esc(options.title||'표시할 내용이 없습니다.')}</div>`}
function uiProgress(value,options={}){return window.MMLUI?.progress?.(value,options)||''}
function uiToast(message,options={}){if(window.MMLUI?.toast)window.MMLUI.toast(message,options);else alert(message)}
async function uiConfirm(message,options={}){if(window.MMLUI?.confirm)return window.MMLUI.confirm({...options,message});return confirm(message)}


/* V34 시스템 안정화 별칭 */
function systemHealthCheck(){return window.MMLHealth?.runHealthCheck?.()||null}
function systemStorageCleanup(options={}){return window.MMLHealth?.cleanup?.(options)||null}
function exportSystemDiagnostics(){return window.MMLHealth?.exportDiagnostics?.()||null}

function render(){ensureReservationIdentifiers();const root=document.getElementById('app');if(!state.authed){root.innerHTML=loginView();return}if(state.counselingModeId){root.innerHTML=counselingModeView();return}const views={dashboard:dashboardView,clients:clientManagementView,reservation:reservationView,interpretation:testInterpretationView,intake:intakeView,cases:casesView,journal:counselingJournalEntryView,counseling:counselingJournalView,clinicalTimeline:clinicalTimelineView,clinicalDss:clinicalDssView,termination:terminationView,documents:documentsView,report:reportView,members:membersView,statistics:statisticsView,settings:settingsView};root.innerHTML=(views[state.menu]||dashboardView)()}

// 다른 탭의 사용자 예약 저장을 관리자 화면에 자동 반영합니다.
window.addEventListener('storage',(event)=>{
  if(['modumam_clients','modumam_reservations','modumam_reservation_inbox','modumam_last_reservation','modumam_intake_summaries','modumam_reports','modumam_test_result_uploads','modumam_ai_result_counseling_records'].includes(event.key)){
    if(syncSharedOperatingData()) render();
  }
});
window.addEventListener('focus',()=>{if(state.authed)refreshSharedOperatingData(false)});
document.addEventListener('visibilitychange',()=>{if(!document.hidden&&state.authed)refreshSharedOperatingData(false)});
try{
  const operatingChannel=new BroadcastChannel('modumam_operating_sync');
  operatingChannel.addEventListener('message',event=>{
    if(!state.authed)return;
    if(event.data?.type==='reservation-created'&&event.data?.reservation){
      const changed=receiveReservationRows([event.data.reservation],'신규 예약 알림');
      if(changed)render();
      return;
    }
    if(event.data?.type==='reservations-sync'&&Array.isArray(event.data?.reservations)){
      const changed=receiveReservationRows(event.data.reservations,'사용자 예약목록 응답');
      if(changed)render();
    }
    if(event.data?.type==='assessment-report-requested'){
      syncSharedOperatingData();
      render();
      return;
    }
    if(event.data?.type==='ai-result-monitoring-updated'){
      state.aiResultCounselingRecords=load('modumam_ai_result_counseling_records',[]);
      if(state.menu==='intake')render();
    }
  });
}catch(e){}

syncSharedOperatingData();
render();
syncIndexedReservationData().then(changed=>{if(changed||state.reservationDbCount)render();requestReservationsFromUserPages()});
// MOD-20260720-PDF-A4-FLOW-V8: 전자차트 종합보고서 PDF의 빈 페이지와 섹션 정렬 오류를 수정합니다.

// BUILD 20260721-CURRENT-FORM-DIRECT-PRINT-V55


// [MML-20260727-PERSISTENCE-FIX] IndexedDB 보고서 본문과 사용자 신청을 런타임 상태에 즉시 반영
(function bindReportPersistenceSync(){
  if(window.__MML_REPORT_PERSISTENCE_SYNC_BOUND__)return;
  window.__MML_REPORT_PERSISTENCE_SYNC_BOUND__=true;
  const refreshReports=(event)=>{
    const rows=event?.detail?.reports||window.MMLReportStore?.loadAll?.()||[];
    if(typeof state==='object'&&state)state.reports=Array.isArray(rows)?rows:[];
    try{window.MMLDataStore?.invalidate?.('modumam_reports')}catch(_){ }
    setTimeout(()=>{try{typeof render==='function'&&render()}catch(error){console.warn('[MML] 보고서 화면 갱신 실패',error)}},0);
  };
  window.addEventListener('mml:report-store-hydrated',refreshReports);
  window.addEventListener('mml:report-saved',refreshReports);
  window.addEventListener('storage',(event)=>{
    if(['modumam_assessment_report_requests_v1','modumam_reports','modumam_client_report_publications'].includes(event.key)){
      if(event.key==='modumam_reports')refreshReports();
      else setTimeout(()=>{try{typeof render==='function'&&render()}catch(_){ }},0);
    }
  });
  // 같은 탭에서 사용자/관리자 화면을 전환하는 경우 storage 이벤트가 발생하지 않아 주기적으로 신청 변경을 확인합니다.
  let lastRequestRaw='';
  setInterval(()=>{
    const raw=localStorage.getItem('modumam_assessment_report_requests_v1')||'[]';
    if(raw!==lastRequestRaw){lastRequestRaw=raw;try{typeof render==='function'&&render()}catch(_){ }}
  },1200);
})();


// MML-20260808-S11: 보고서 관리현황 액션을 명시적으로 전역에 노출합니다.
// 동적 렌더링된 inline handler가 브라우저 스코프/로드순서에 영향받지 않게 합니다.
window.resolveAdminReportActionTarget=resolveAdminReportActionTarget;
window.toggleReportApproval=toggleReportApproval;
window.printReport=printReport;
window.openReportPreview=openReportPreview;
window.MMLAssessmentReportActions={
  preview(id){return window.printReport(String(id),false)},
  edit(id){return window.editIndividualAssessmentReport(String(id))},
  revoke(id){return window.toggleReportApproval(String(id))},
  approve(id){return window.toggleReportApproval(String(id))},
  pdf(id){return window.printReport(String(id),true)}
};
