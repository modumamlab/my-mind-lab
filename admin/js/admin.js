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
const STATUS=["예약신청","예약승인","결제완료","검사발송","검사완료","결과업로드","상담준비","상담진행","상담완료","종결","예약취소"];
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
  closeTime:'18:00',
  intervalMinutes:30,
  enabledMethods:['장소 조율(대면)','찾아가는(대면)','Zoom(비대면)','AI(비대면)'],
  programDefaultTests:{
    '개인 마음이음':['TCI 기질 및 성격검사'],
    '부부 마음이음':['TCI 기질 및 성격검사 × 2'],
    '부모-자녀 마음이음':['STS 아동기질검사','K-CDI 아동발달검사','PAT 부모양육태도검사','TCI 기질 및 성격검사']
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

let state={counselingJournalTab:'sessions',authed:sessionStorage.getItem('modumam_admin_auth')==='true',menu:'dashboard',memberSearch:'',memberStatus:'전체',selectedClientKey:'',memberTab:'profile',counselingModeId:'',password:'',loginError:'',loginLockedUntil:Number(sessionStorage.getItem('modumam_admin_locked_until')||0),loginFailCount:Number(sessionStorage.getItem('modumam_admin_fail_count')||0),reservations:load('modumam_reservations',[]),intakes:load('modumam_intake_summaries',[]),reports:load('modumam_reports',[]),resultUploads:load('modumam_test_result_uploads',[]),reportForm:emptyReportForm(),reportEditingId:null,reportDraftLoading:false,caseDraftLoading:{},counselingPlanLoading:{},terminationDraftLoading:{},counselingAidLoading:{},testInterpretationLoading:false,testExtractionLoading:false,interpretationSource:null,testInterpretations:load('modumam_test_interpretations',[]),interpretationForm:{reservationId:'',testType:'STS',scales:{}},interpretationDraft:null,assessmentAnalyses:load('modumam_assessment_analyses',[]),assessmentReservationId:'',assessmentLoading:{},integratedReportLoading:false,integratedReportDraft:null,assessmentReportDrafts:load('modumam_assessment_report_drafts',[]),assessmentCrossLoading:false,assessmentCrossDraft:null,assessmentCrossAnalyses:load('modumam_assessment_cross_analyses',[]),aiResultCounselingRecords:load('modumam_ai_result_counseling_records',[]),reservationDbCount:0,reservationSyncError:''};
function emptyReportForm(){return{reservationId:'',clientName:'',phone:'',program:'',testType:'TCI',title:'',summary:'',strength:'',caution:'',plan:'',status:'작성중',approvedForClient:false}}
function load(k,f){try{const s=localStorage.getItem(k);return s?JSON.parse(s):f}catch(e){return f}}
function appendAuditLog(action,key,detail=''){
  try{
    const auditKey='modumam_admin_audit_log';
    const current=JSON.parse(localStorage.getItem(auditKey)||'[]');
    current.unshift({id:Date.now()+Math.random(),action:String(action||'변경'),key:String(key||''),detail:String(detail||''),at:new Date().toISOString()});
    localStorage.setItem(auditKey,JSON.stringify(current.slice(0,300)));
  }catch(e){}
}
function save(k,v){
  try{localStorage.setItem(k,JSON.stringify(v))}catch(error){console.warn('localStorage 저장 실패',k,error)}
  if(k==='modumam_reservations'&&Array.isArray(v)) replaceIndexedReservations(v).catch(error=>{state.reservationSyncError=String(error?.message||error)});
  if(String(k||'').startsWith('modumam_')&&!['modumam_admin_audit_log','modumam_counseling_mode_draft'].some(x=>String(k).startsWith(x))){
    appendAuditLog('저장',k);
  }
}

// [MOD-20260714-RESERVATION-LIVE-SYNC]
// 사용자 페이지에서 새 예약이 저장되면 관리자 화면이 최신 localStorage를 다시 읽습니다.
function mergeReservationsById(...lists){
  const map=new Map();
  lists.flat().filter(Boolean).forEach(item=>{
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
  const primaryReservations=load('modumam_reservations',[]);
  const inboxReservations=load('modumam_reservation_inbox',[]);
  const lastReservation=load('modumam_last_reservation',null);
  const primaryIds=new Set(primaryReservations.map(item=>String(item?.id||'')));
  const missing=[...inboxReservations,lastReservation].filter(item=>item&& !primaryIds.has(String(item.id||'')));
  const nextReservations=mergeReservationsById(missing,primaryReservations);
  if(nextReservations.length) localStorage.setItem('modumam_reservations',JSON.stringify(nextReservations));
  const nextIntakes=load('modumam_intake_summaries',[]);
  const nextReports=load('modumam_reports',[]);
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
  const incoming=Array.isArray(rows)?rows.filter(Boolean):[];
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
function statusClass(s){const n=normalizeStatus(s);if(['상담완료','종결'].includes(n))return'bg-emerald-100 text-emerald-700';if(['상담준비','상담진행'].includes(n))return'bg-teal-100 text-teal-700';if(n==='결과업로드')return'bg-purple-100 text-purple-700';if(n==='검사완료')return'bg-violet-100 text-violet-700';if(n==='검사발송')return'bg-indigo-100 text-indigo-700';if(n==='결제완료')return'bg-emerald-100 text-emerald-700';if(n==='예약승인')return'bg-blue-100 text-blue-700';if(n==='예약취소')return'bg-rose-100 text-rose-700';return'bg-amber-100 text-amber-700'}
function getPaymentInfo(r){
  const type=String(r.type||'').trim();
  const program=programBaseName(r.program||'');

  // 'AI(비대면)'에도 '대면' 글자가 포함되므로 includes('대면')만으로 판단하면 안 됩니다.
  const isNonFace=/AI|Zoom|화상|전화|비대면/i.test(type);
  const counselingFee=isNonFace?20000:50000;
  const counselingLabel=isNonFace?'비대면상담비 20,000원':'대면상담비 50,000원';

  const basicTestCount=(program.includes('부부')||program.includes('부모-자녀'))?2:1;
  const basicTestFee=basicTestCount*30000;

  const extras=r.extraTests||r.selectedTests||r.additionalTests||[];
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
  const defaults=getOperatingSettings().programDefaultTests||{};
  const basicRaw=Array.isArray(defaults[program])?defaults[program]:[];
  const extraRaw=r?.extraTests||r?.selectedTests||r?.additionalTests||[];
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
  let tests=[];const p=String(r.program||'');
  const defaults=getOperatingSettings().programDefaultTests||{};
  const programKey=p.includes('개별 심리검사')?'':p.includes('부모-자녀')?'부모-자녀 마음이음':p.includes('부부')?'부부 마음이음':p.includes('개인')?'개인 마음이음':'';
  if(programKey&&Array.isArray(defaults[programKey])) tests.push(...defaults[programKey]);
  const extras=r.extraTests||r.selectedTests||r.additionalTests||[];
  if(Array.isArray(extras)) extras.forEach(t=>{const n=normTest(t);if(n)tests.push(String(t).includes('무료')?n+' (무료)':n)});
  const seen=new Set();return tests.filter(Boolean).filter(t=>{const key=shortTestName(t);if(seen.has(key))return false;seen.add(key);return true;});
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

function buildClients(){const m={};state.reservations.forEach(r=>{const k=clientKey(r.name,r.phone);if(!m[k])m[k]={key:k,name:r.name||'이름 미입력',phone:r.phone||'',reservations:[],intakes:[],reports:[],uploads:[],aiResultRecords:[],notes:load('modumam_counseling_notes_'+k,[])};m[k].reservations.push(r)});state.intakes.forEach(i=>{const k=clientKey(i.name,i.phone);if(!m[k])m[k]={key:k,name:i.name||'이름 미입력',phone:i.phone||'',reservations:[],intakes:[],reports:[],uploads:[],aiResultRecords:[],notes:load('modumam_counseling_notes_'+k,[])};m[k].intakes.push(i)});state.reports.forEach(r=>{const same=Object.keys(m).find(k=>String(m[k].name).trim()===String(r.clientName).trim());const k=same||clientKey(r.clientName,r.phone);if(!m[k])m[k]={key:k,name:r.clientName||'이름 미입력',phone:r.phone||'',reservations:[],intakes:[],reports:[],uploads:[],aiResultRecords:[],notes:load('modumam_counseling_notes_'+k,[])};m[k].reports.push(r)});state.resultUploads.forEach(u=>{const same=Object.keys(m).find(k=>(u.phone&&clientKey('',u.phone)===k)||String(m[k].name).trim()===String(u.clientName||'').trim());const k=same||clientKey(u.clientName,u.phone);if(!m[k])m[k]={key:k,name:u.clientName||'이름 미입력',phone:u.phone||'',reservations:[],intakes:[],reports:[],uploads:[],aiResultRecords:[],notes:load('modumam_counseling_notes_'+k,[])};m[k].uploads.push(u)});(state.aiResultCounselingRecords||[]).forEach(record=>{const same=Object.keys(m).find(k=>String(m[k].name).trim()===String(record.clientName||'').trim()||(record.phone&&clientKey('',record.phone)===k));const reservation=state.reservations.find(r=>String(r.id)===String(record.reservationId));const k=same||clientKey(record.clientName||reservation?.name,record.phone||reservation?.phone);if(!m[k])m[k]={key:k,name:record.clientName||reservation?.name||'이름 미입력',phone:record.phone||reservation?.phone||'',reservations:[],intakes:[],reports:[],uploads:[],aiResultRecords:[],notes:load('modumam_counseling_notes_'+k,[])};m[k].aiResultRecords.push(record)});return Object.values(m).map(c=>{const latest=[...(c.reservations||[])].sort((a,b)=>String(b.date||'').localeCompare(String(a.date||'')))[0]||{};return {...c,caseNumber:(c.reservations||[]).find(r=>r.caseNumber)?.caseNumber||'',reservationNumber:latest.reservationNumber||'',profileMemo:load('modumam_client_profile_'+c.key,{memo:'',updatedAt:''})}})}
function findIntake(r){const p=String(r.phone||'').replace(/[^0-9]/g,'');const n=String(r.name||'').trim();return state.intakes.find(i=>{const ip=String(i.phone||'').replace(/[^0-9]/g,'');const iname=String(i.name||'').trim();return(p&&ip&&p===ip)||(n&&iname&&n===iname)})}
function hasReport(r){return state.reports.some(x=>String(x.clientName||'').trim()===String(r.name||'').trim())}
function progress(r){const current=normalizeStatus(r.status);const steps=STATUS.filter(x=>x!=='예약취소').map(step=>[step,statusReached(current,step)]);return{steps,pct:Math.round(steps.filter(x=>x[1]).length/steps.length*100),ai:!!findIntake(r)}}
function setMenu(m){syncSharedOperatingData();state.menu=m;render()}
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
  const isAi=value==='AI(비대면)';
  updateScheduleWithHistory(id,{type:value,aiCounseling:isAi,counselingDurationMinutes:isAi?50:null,reportRequired:isAi},'상담방식 변경');
}
function updateCounselingTime(id,value){
  if(!COUNSELING_TIMES.includes(value)){alert(`상담시간은 ${OPERATING_SETTINGS.openTime}부터 ${OPERATING_SETTINGS.closeTime}까지 ${OPERATING_SETTINGS.intervalMinutes}분 단위로 선택해 주세요.`);render();return;}
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
  if(!COUNSELING_TIMES.includes(time)){alert('상담시간을 올바르게 선택해 주세요.');return;}
  if(!type){alert('상담방식을 선택해 주세요.');return;}

  const changed=date!==String(reservation.date||'') || time!==String(reservation.time||'') || type!==String(reservation.type||'');
  if(!changed){alert('변경된 사항이 없습니다.');return;}

  const isAi=type==='AI(비대면)';
  updateScheduleWithHistory(id,{
    date,time,type,
    aiCounseling:isAi,
    counselingDurationMinutes:isAi?50:null,
    reportRequired:isAi,
    reservationUpdatedAt:new Date().toISOString()
  },'예약정보 변경');
  alert('변경사항을 저장했습니다. 오늘 업무에도 바로 반영됩니다.');
}
window.saveCurrentReservationChanges=saveCurrentReservationChanges;

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
  localStorage.setItem('modumam_reports',JSON.stringify(state.reports));
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
function setReportFromReservation(id){const r=state.reservations.find(x=>String(x.id)===String(id));if(!r)return;let tt=String(r.program).includes('부모-자녀')?'PAT · KCDI':'TCI';state.reportForm={...emptyReportForm(),reservationId:id,clientName:r.name||'',phone:r.phone||'',program:programBaseName(r.program),testType:tt,title:`${r.name||'내담자'}님 ${tt} 결과보고서`};state.menu='report';render()}
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
    rep={...state.reportForm,id,code:'MR-'+String(id).slice(-6),reportType:'관리자용',approvedForClient:false,createdAt:now,updatedAt:now,version:1,versionHistory:[]};
    state.reports=[rep,...state.reports];
  }
  save('modumam_reports',state.reports);
  if(rep.reservationId){state.reservations=state.reservations.map(r=>r.id===rep.reservationId?{...r,status:'결과업로드'}:r);save('modumam_reservations',state.reservations)}
  state.reportForm=emptyReportForm();state.reportEditingId=null;
  alert('보고서가 저장되었습니다. 수정 저장 시 기존 공개 승인은 해제되며, 검토 후 다시 승인해 주세요.');render();
}
function editReport(id){const r=state.reports.find(x=>String(x.id)===String(id));if(!r)return;state.reportEditingId=id;state.reportForm={...emptyReportForm(),reservationId:r.reservationId||'',clientName:r.clientName||'',phone:r.phone||'',program:programBaseName(r.program),testType:r.testType||'TCI',title:r.title||'',summary:r.summary||'',strength:r.strength||'',caution:r.caution||'',plan:r.plan||''};state.menu='report';render();window.scrollTo({top:0,behavior:'smooth'})}
function cancelReportEdit(){state.reportEditingId=null;state.reportForm=emptyReportForm();render()}
function restoreReportVersion(id,index){const r=state.reports.find(x=>String(x.id)===String(id));const h=(r&&r.versionHistory||[])[index];if(!r||!h)return;if(!confirm('선택한 이전 버전을 새 버전으로 복원하시겠습니까?'))return;const now=new Date().toLocaleString();const current={version:Number(r.version||1),savedAt:r.updatedAt||r.createdAt||now,summary:r.summary||'',strength:r.strength||'',caution:r.caution||'',plan:r.plan||'',title:r.title||''};state.reports=state.reports.map(x=>x.id===id?{...x,title:h.title||x.title,summary:h.summary||'',strength:h.strength||'',caution:h.caution||'',plan:h.plan||'',version:Number(x.version||1)+1,updatedAt:now,approvedForClient:false,versionHistory:[current,...(x.versionHistory||[])].slice(0,10)}:x);save('modumam_reports',state.reports);render()}
async function generateReportDraft(){
  if(!state.reportForm.clientName||!state.reportForm.testType){alert('예약자와 검사 종류를 먼저 선택해 주세요.');return}
  const uploads=state.resultUploads.filter(u=>String(u.clientName||'').trim()===String(state.reportForm.clientName||'').trim() || (u.phone&&String(u.phone).replace(/\D/g,'')===String(state.reportForm.phone||'').replace(/\D/g,'')));
  const intake=state.intakes.find(i=>String(i.name||'').trim()===String(state.reportForm.clientName||'').trim() || (i.phone&&String(i.phone).replace(/\D/g,'')===String(state.reportForm.phone||'').replace(/\D/g,'')));
  const uploadSummary=uploads.map(u=>`${u.testType||u.testName||'검사'}: ${u.summary||u.memo||'요약 미입력'}`).join('\n');
  state.reportDraftLoading=true;render();
  try{
    const response=await fetch('/.netlify/functions/report-draft',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({clientName:state.reportForm.clientName,program:state.reportForm.program,testType:state.reportForm.testType,uploadSummary,intakeSummary:intake?.summary||intake?.concern||'',adminMemo:''})});
    const data=await response.json().catch(()=>({}));
    if(!response.ok||!data.draft)throw new Error(data.error||'AI 초안 생성에 실패했습니다.');
    state.reportForm={...state.reportForm,...data.draft};
    alert('AI 초안이 작성되었습니다. 반드시 임상심리사가 검토·수정한 뒤 저장해 주세요.');
  }catch(error){alert(error.message||'AI 초안 생성 중 오류가 발생했습니다.');}
  finally{state.reportDraftLoading=false;render()}
}
function deleteReport(id){if(!confirm('보고서를 삭제하시겠습니까?'))return;state.reports=state.reports.filter(r=>String(r.id)!==String(id));save('modumam_reports',state.reports);render()}

function toggleReportApproval(id){
  let approvedReport=null;
  state.reports=state.reports.map(r=>{
    if(r.id!==id)return r;
    const next={...r,approvedForClient:!r.approvedForClient,approvalUpdatedAt:new Date().toLocaleString('ko-KR')};
    if(next.approvedForClient)approvedReport=next;
    return next;
  });
  save('modumam_reports',state.reports);
  if(approvedReport){
    const target=state.reservations.find(r=>String(r.id)===String(approvedReport.reservationId))||state.reservations.find(r=>String(r.name||'').trim()===String(approvedReport.clientName||'').trim()&&( !approvedReport.phone || String(r.phone||'').replace(/\D/g,'')===String(approvedReport.phone||'').replace(/\D/g,'') ));
    if(target&&workflowRank(target.status)<workflowRank('상담준비')){updateReservation(target.id,{status:'상담준비',reportApprovedAt:new Date().toLocaleString('ko-KR')});return;}
  }
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
function printReport(id){
  const r=state.reports.find(x=>String(x.id)===String(id));if(!r)return;
  const w=window.open('','_blank');
  if(r.assessmentReport&&r.sections){
    const sec=r.sections||{};
    const row=(title,text)=>text?`<section><h2>${esc(title)}</h2><div class="content">${esc(text)}</div></section>`:'';
    w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${esc(r.title)}</title><style>
      @page{size:A4;margin:18mm}*{box-sizing:border-box}body{font-family:Arial,'Noto Sans KR',sans-serif;color:#1f2937;line-height:1.75;margin:0;background:#fff}header{padding:8px 0 28px;border-bottom:3px solid #047857}.brand{font-size:11px;letter-spacing:.14em;color:#047857;font-weight:800}.subtitle{font-size:14px;color:#64748b;margin-top:8px}.meta{display:grid;grid-template-columns:repeat(2,1fr);gap:10px;background:#f0fdf4;border:1px solid #d1fae5;border-radius:16px;padding:18px;margin:24px 0}.meta p{margin:0;font-size:13px}.notice{background:#f8fafc;border-left:4px solid #10b981;padding:16px 18px;border-radius:10px;font-size:13px;color:#475569;margin:0 0 24px}section{break-inside:avoid;margin:0 0 26px}h1{font-size:29px;margin:6px 0 0}h2{font-size:17px;color:#065f46;margin:0 0 10px;padding-bottom:8px;border-bottom:1px solid #d1fae5}.content{white-space:pre-wrap;font-size:14px}.test-guide{background:#f8fafc;border:1px solid #e2e8f0;border-radius:16px;padding:18px}.footer{margin-top:34px;padding-top:14px;border-top:1px solid #e2e8f0;color:#94a3b8;font-size:10px}@media print{button{display:none}}
    </style></head><body><header><div class="brand">MODUMAM LAB PSYCHOLOGICAL REPORT</div><h1>${esc(r.title||'모두의 마음연구소 심리보고서')}</h1>${sec.subtitle?`<div class="subtitle">${esc(sec.subtitle)}</div>`:''}</header><div class="meta"><p><b>성명</b><br>${esc(r.clientName)}</p><p><b>프로그램</b><br>${esc(programBaseName(r.program))}</p><p><b>반영 검사</b><br>${esc((r.tests||[]).join(', ')||r.testType)}</p><p><b>작성일</b><br>${esc(r.updatedAt||r.createdAt)}</p></div><div class="notice">이 보고서는 심리검사 결과를 바탕으로 현재의 마음과 심리적 특성을 이해할 수 있도록 작성된 자료입니다. 개인을 평가하거나 단정하기 위한 목적이 아니라 자기이해를 돕기 위한 참고자료입니다.</div>${row('심리평가 개요',sec.evaluationOverview)}${sec.testGuide?`<section><h2>이번 심리평가에 사용된 검사</h2><div class="content test-guide">${esc(sec.testGuide)}</div></section>`:''}${row('한눈에 보는 핵심 심리요약',sec.keyMessage)}${row('정서적 특성',sec.emotionalProfile)}${row('사고와 의사결정 특성',sec.thinkingStyle)}${row('대인관계와 의사소통 특성',sec.relationshipStyle)}${row('스트레스 반응과 회복',sec.stressRecovery)}${row('강점과 심리적 자원',sec.strengthsResources)}${row('검사 간 통합적 이해',sec.integratedUnderstanding)}${row('현재 주의 깊게 살펴볼 신호',sec.currentSignals)}${row('심리검사 기반 제안',sec.psychologicalSuggestions)}${row('전문가 종합 소견',sec.professionalSummary)}${row('검사 해석의 범위와 한계',sec.disclaimer)}<div class="footer">모두의 마음연구소 · 상담자 검토 및 승인 완료</div><script>window.onload=()=>window.print()<\/script></body></html>`);
  }else{
    w.document.write(`<html><head><title>${esc(r.title)}</title><style>body{font-family:Arial,sans-serif;padding:40px;line-height:1.7;color:#1e293b}h1{font-size:28px}h2{margin-top:28px;font-size:18px;border-bottom:1px solid #ddd;padding-bottom:8px}.meta{background:#f8fafc;padding:16px;border-radius:12px;margin:20px 0}.box{white-space:pre-wrap;border:1px solid #e2e8f0;padding:16px;border-radius:12px}</style></head><body><p style="font-size:12px;color:#047857;font-weight:bold;">MODUMAM LAB PSYCHOLOGICAL REPORT</p><h1>${esc(r.title)}</h1><div class="meta"><p><b>성명:</b> ${esc(r.clientName)}</p><p><b>프로그램:</b> ${esc(programBaseName(r.program))}</p><p><b>검사:</b> ${esc(r.testType)}</p><p><b>작성일:</b> ${esc(r.createdAt)}</p><p><b>결과확인 코드:</b> ${esc(reportCode(r))}</p></div><h2>종합 소견</h2><div class="box">${esc(r.summary)}</div><h2>강점 및 자원</h2><div class="box">${esc(r.strength)}</div><h2>주의점 및 어려움</h2><div class="box">${esc(r.caution)}</div><h2>상담 계획 및 제안</h2><div class="box">${esc(r.plan)}</div><script>window.print();<\/script></body></html>`);
  }
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
  return type.includes('AI(비대면)') || type.includes('AI비대면') || r?.aiCounseling===true;
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
function titleForMenu(){return({dashboard:'오늘 업무',today:'오늘 상담',reservation:'예약관리',results:'심리검사 관리',interpretation:'심리평가센터',intake:'AI 모니터링',cases:'AI 사례개념화',journal:'상담일지',counseling:'상담기록',termination:'종결기록',report:'결과보고서',members:'전자차트',statistics:'운영 통계',documents:'신청서·동의서',settings:'환경설정'})[state.menu]||'오늘 업무'}
function todayDisplayLabel(){try{return new Intl.DateTimeFormat('ko-KR',{year:'numeric',month:'long',day:'numeric',weekday:'long'}).format(new Date())}catch(e){return new Date().toLocaleDateString('ko-KR')}}
function layout(content){return`<main class="min-h-screen bg-slate-100">
  <div class="lg:flex lg:min-h-screen">
    <aside class="hidden lg:flex lg:w-64 xl:w-72 lg:shrink-0 lg:flex-col lg:border-r lg:border-slate-200 lg:bg-white lg:sticky lg:top-0 lg:h-screen">
      <div class="border-b border-slate-100 px-5 py-6">
        <p class="text-[11px] font-extrabold text-emerald-700">MODUMAM LAB</p>
        <h1 class="mt-1 text-xl font-extrabold text-slate-950">상담운영센터 2.0</h1>
        <p class="mt-2 text-xs leading-relaxed text-slate-400">오늘 업무에서 상담·검사·보고서까지 이어서 관리합니다.</p>
      </div>
      <nav class="flex-1 overflow-y-auto px-3 py-4 space-y-1.5">
        <p class="px-3 pb-1 text-[10px] font-extrabold tracking-wider text-slate-300">TODAY</p>
        ${sideNavButton('dashboard','⌂','오늘 업무','상담 일정과 우선 업무')}
        ${sideNavButton('today','◷','오늘 상담','상담 시작·회기기록')}
        ${sideNavButton('members','📋','전자차트','회원별 통합 기록')}
        <p class="px-3 pt-4 pb-1 text-[10px] font-extrabold tracking-wider text-slate-300">CLIENT</p>
        
        ${sideNavButton('reservation','📅','예약관리','일정·검사·진행상태')}
        ${sideNavButton('results','📝','심리검사 관리','예약확인·AI 상담 활성')}
        ${sideNavButton('interpretation','🧠','심리평가센터','검사별 분석·종합보고서')}
        <p class="px-3 pt-4 pb-1 text-[10px] font-extrabold tracking-wider text-slate-300">COUNSELING</p>
        ${sideNavButton('journal','📝','상담일지','상담 진행·회기 작성')}
        ${sideNavButton('intake','👁','AI 모니터링','AI 결과상담 실시간 확인')}
        ${sideNavButton('cases','🤖','AI 사례개념화','회기기록 불러오기·상담계획')}
        ${sideNavButton('counseling','📂','상담기록','저장 기록·축어록 관리')}
        <p class="px-3 pt-4 pb-1 text-[10px] font-extrabold tracking-wider text-slate-300">CENTER</p>
        ${sideNavButton('statistics','📊','통계','운영 현황')}
        ${sideNavButton('settings','⚙','설정','백업·사용자 페이지')}
      </nav>
      <div class="border-t border-slate-100 p-4"><button onclick="logout()" class="w-full rounded-2xl bg-rose-50 px-4 py-3 text-sm font-extrabold text-rose-600 hover:bg-rose-100">로그아웃</button></div>
    </aside>
    <div class="min-w-0 flex-1">
      <header class="sticky top-0 z-40 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div class="px-4 py-4 sm:px-6 lg:px-8">
          <div class="flex items-center justify-between gap-4">
            <div><p class="text-[11px] font-extrabold text-emerald-700">상담운영센터 2.0 · BUILD 20260715-PAYMENT-TEST-GUIDE-31</p><h2 class="text-xl font-extrabold text-slate-950 sm:text-2xl">${titleForMenu()}</h2><p class="mt-1 hidden text-xs text-slate-400 sm:block">${todayDisplayLabel()}</p></div>
            <div class="hidden sm:flex items-center gap-2"><button onclick="setMenu('today')" class="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-extrabold text-slate-600">오늘 상담</button><button onclick="location.href='/'" class="rounded-xl bg-slate-900 px-3 py-2 text-xs font-extrabold text-white">사용자 페이지</button></div>
          </div>
          <nav class="mt-4 flex gap-2 overflow-x-auto pb-1 lg:hidden">${navButton('dashboard','오늘 업무')}${navButton('today','오늘 상담')}${navButton('members','전자차트')}${navButton('reservation','예약')}${navButton('results','검사')}${navButton('interpretation','해석')}${navButton('report','보고서')}${navButton('journal','상담일지')}${navButton('intake','AI모니터링')}${navButton('cases','사례')}${navButton('counseling','상담기록')}${navButton('statistics','통계')}${navButton('settings','설정')}<button onclick="logout()" class="shrink-0 rounded-xl bg-rose-50 px-4 py-2 text-xs font-extrabold text-rose-600">로그아웃</button></nav>
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
  ['🟣','오늘 상담',todayReservations().length,'reservation']
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
      protective: "",
      strength: "",
      goal: "",
      intervention: ""
    });
    const sessions = load("modumam_case_sessions_" + caseId, []);
    return { caseId, res, tests, reports, intake, formulation, sessions };
  });
}

function saveCaseFormulation(caseId) {
  const data = {
    complaint: document.getElementById("cf-complaint-" + caseId)?.value || "",
    currentProblem: document.getElementById("cf-current-" + caseId)?.value || "",
    trigger: document.getElementById("cf-trigger-" + caseId)?.value || "",
    maintaining: document.getElementById("cf-maintaining-" + caseId)?.value || "",
    protective: document.getElementById("cf-protective-" + caseId)?.value || "",
    strength: document.getElementById("cf-strength-" + caseId)?.value || "",
    goal: document.getElementById("cf-goal-" + caseId)?.value || "",
    intervention: document.getElementById("cf-intervention-" + caseId)?.value || ""
  };
  save("modumam_case_formulation_" + caseId, data);
  alert("사례개념화가 저장되었습니다.");
  render();
}

function saveCaseSession(caseId) {
  const date = document.getElementById("session-date-" + caseId)?.value || new Date().toISOString().slice(0,10);
  const goal = document.getElementById("session-goal-" + caseId)?.value || "";
  const content = document.getElementById("session-content-" + caseId)?.value || "";
  const change = document.getElementById("session-change-" + caseId)?.value || "";
  const task = document.getElementById("session-task-" + caseId)?.value || "";
  const next = document.getElementById("session-next-" + caseId)?.value || "";

  if (!content.trim()) {
    alert("회기 내용을 입력해 주세요.");
    return;
  }

  const key = "modumam_case_sessions_" + caseId;
  const sessions = load(key, []);
  sessions.unshift({
    id: Date.now(),
    date,
    goal,
    content,
    change,
    task,
    next,
    createdAt: new Date().toLocaleString()
  });
  save(key, sessions);
  alert("회기기록이 저장되었습니다.");
  render();
}

function deleteCaseSession(caseId, sessionId) {
  if (!confirm("회기기록을 삭제하시겠습니까?")) return;
  const key = "modumam_case_sessions_" + caseId;
  save(key, load(key, []).filter(s => s.id !== sessionId));
  render();
}


/* =========================================================
   V31 운영관리 시스템
   - AI는 상담을 대신하지 않고 상담자가 회기를 준비하도록 돕습니다.
   - 마음 체크인, 검사, 회기기록, 사례개념화 초안을 바탕으로
     오늘 확인할 질문과 개입 아이디어를 구조화합니다.
========================================================= */
async function generateCounselingAid(caseId) {
  const c = buildCases().find(item => item.caseId === caseId);
  if (!c || state.counselingAidLoading[caseId]) return;

  const activeReservation = counselingModeReservation();
  const currentNote = {
    theme: document.getElementById('cm-theme')?.value || '',
    emotion: document.getElementById('cm-emotion')?.value || '',
    content: document.getElementById('cm-content')?.value || '',
    change: document.getElementById('cm-change')?.value || '',
    next: document.getElementById('cm-next')?.value || ''
  };
  const f = c.formulation || {};
  const recentSessions = (c.sessions || []).slice(0, 5).map(s => ({
    date:s.date||'', goal:s.goal||s.theme||'', emotion:s.emotion||'', content:s.content||'', change:s.change||'', next:s.next||''
  }));
  const tests = (c.tests || []).map(shortTestName);
  const intakeSummary = c.intake ? [c.intake.summary,c.intake.concern,c.intake.report,c.intake.content].filter(Boolean).join('\n') : '';
  const reportSummary = (c.reports || []).map(r => [r.testType,r.summary,r.strength,r.caution,r.plan].filter(Boolean).join('\n')).join('\n\n');
  const uploadSummary = (c.uploads || []).map(u => `${u.testType||u.testName||'검사'}: ${u.summary||u.memo||'요약 미입력'}`).join('\n');
  const profileMemo = load('modumam_client_profile_'+clientKey(c.res.name,c.res.phone),{});

  state.counselingAidLoading[caseId] = true;
  render();
  try {
    const response = await fetch('/.netlify/functions/counseling-aid', {
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({
        clientName:c.res.name,
        program:programBaseName(c.res.program),
        counselingMethod:c.res.type,
        tests,
        intakeSummary,
        uploadSummary,
        reportSummary,
        formulation:f,
        recentSessions,
        currentNote,
        profileMemo:profileMemo.memo||profileMemo.text||'',
        reservationStatus:normalizeStatus(activeReservation?.status||c.res.status)
      })
    });
    const data = await response.json().catch(()=>({}));
    if(!response.ok || !data.aid) throw new Error(data.error||'AI 상담도우미 생성 실패');
    const aid={...data.aid,source:data.sourceSummary||'',model:data.model||'',updatedAt:new Date().toLocaleString('ko-KR')};
    save('modumam_counseling_aid_'+caseId,aid);
  } catch(error) {
    alert(error.message||'AI 상담도우미 생성 중 오류가 발생했습니다.');
  } finally {
    state.counselingAidLoading[caseId]=false;
    render();
  }
}

function saveCounselingAid(caseId) {
  const previous=load('modumam_counseling_aid_'+caseId,{});
  const aid = {
    ...previous,
    emotion: document.getElementById('aid-emotion-' + caseId)?.value || previous.emotion || '',
    focus: document.getElementById('aid-focus-' + caseId)?.value || '',
    questions: document.getElementById('aid-questions-' + caseId)?.value || '',
    intervention: document.getElementById('aid-intervention-' + caseId)?.value || '',
    strengths: document.getElementById('aid-strengths-' + caseId)?.value || previous.strengths || '',
    caution: document.getElementById('aid-caution-' + caseId)?.value || '',
    nextPlan: document.getElementById('aid-next-' + caseId)?.value || '',
    source: document.getElementById('aid-source-' + caseId)?.value || previous.source || '',
    updatedAt: new Date().toLocaleString('ko-KR')
  };
  save('modumam_counseling_aid_' + caseId, aid);
  alert('AI 상담도우미 메모가 저장되었습니다.');
  render();
}

function copyCounselingAid(caseId) {
  const aid = load('modumam_counseling_aid_' + caseId, null);
  if (!aid) { alert('먼저 AI 상담도우미를 생성해 주세요.'); return; }
  copyText(`AI 상담도우미 2.0\n\n[현재 핵심 정서]\n${aid.emotion || ''}\n\n[오늘 상담 초점]\n${aid.focus || ''}\n\n[추천 질문]\n${aid.questions || ''}\n\n[권장 개입]\n${aid.intervention || ''}\n\n[강점·보호요인]\n${aid.strengths || ''}\n\n[주의할 점]\n${aid.caution || ''}\n\n[다음 회기 연결]\n${aid.nextPlan || ''}`);
}

async function generateCaseDraft(caseId) {
  const c = buildCases().find(item => item.caseId === caseId);
  if (!c || state.caseDraftLoading[caseId]) return;

  const matchingUploads = state.resultUploads.filter(u =>
    String(u.reservationId || "") === String(c.res.id) ||
    (String(u.clientName || u.name || "").trim() === String(c.res.name || "").trim() &&
     String(u.phone || "").replace(/\D/g, "") === String(c.res.phone || "").replace(/\D/g, ""))
  );
  const intakeSummary = c.intake ? [c.intake.summary, c.intake.concern, c.intake.report, c.intake.content].filter(Boolean).join("\n") : "";
  const reportSummary = c.reports.map(r => [r.testType, r.summary, r.strength, r.caution, r.plan].filter(Boolean).join("\n")).join("\n\n");
  const uploadSummary = matchingUploads.map(u => `${u.testType || u.testName || "검사"}: ${u.summary || u.memo || "요약 미입력"}`).join("\n");
  const sessionSummary = c.sessions.map(s => `${s.date || ""} ${s.goal || ""}\n${s.content || ""}\n변화: ${s.change || ""}`).join("\n\n");
  const existing = c.formulation || {};

  state.caseDraftLoading[caseId] = true;
  render();
  try {
    const response = await fetch('/.netlify/functions/case-conceptualization', {
      method: 'POST',
      headers: {'Content-Type':'application/json'},
      body: JSON.stringify({
        caseId,
        clientName: c.res.name || '',
        program: programBaseName(c.res.program),
        counselingMethod: c.res.type || '',
        tests: c.tests,
        intakeSummary,
        uploadSummary,
        reportSummary,
        sessionSummary,
        adminMemo: c.res.adminMemo || '',
        existingFormulation: existing
      })
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data.formulation) throw new Error(data.error || 'AI 사례개념화 초안 생성에 실패했습니다.');
    save("modumam_case_formulation_" + caseId, {...data.formulation, aiGeneratedAt:new Date().toISOString(), aiModel:data.model || ''});
    alert("AI 사례개념화 초안이 생성되었습니다. 반드시 임상심리사가 근거를 확인하고 수정해 주세요.");
  } catch (error) {
    alert(error.message || "AI 사례개념화 초안 생성 중 오류가 발생했습니다.");
  } finally {
    state.caseDraftLoading[caseId] = false;
    render();
  }
}


// [MOD-20260716-SPRINT17-COUNSELING-PLAN]
// 검사별 분석·교차분석·사례개념화·회기기록을 통합해 상담자 검토용 상담계획 초안을 생성합니다.
function counselingPlanKey(caseId){return 'modumam_counseling_plan_'+caseId}
function counselingPlanForCase(caseId){return load(counselingPlanKey(caseId),{})}
function assessmentReservationForCase(c){return state.reservations.find(r=>String(r.id)===String(c?.res?.id))||c?.res||null}
async function generateCounselingPlan(caseId){
  const c=buildCases().find(x=>x.caseId===caseId);if(!c||state.counselingPlanLoading[caseId])return;
  const r=assessmentReservationForCase(c);if(!r)return;
  const analyses=analysesForReservation(r.id);
  const cross=state.assessmentCrossAnalyses.find(x=>String(x.reservationId)===String(r.id))||{};
  const formulation=load('modumam_case_formulation_'+caseId,{});
  const sessions=load('modumam_case_sessions_'+caseId,[]);
  const reports=reservationReports(r);
  const hasSource=analyses.length||Object.values(cross).some(v=>typeof v==='string'&&v.trim())||Object.values(formulation).some(v=>typeof v==='string'&&v.trim())||sessions.length||reports.length;
  if(!hasSource){alert('상담계획을 만들 자료가 없습니다. 검사별 분석, 교차분석, 사례개념화 또는 회기기록을 먼저 준비해 주세요.');return;}
  state.counselingPlanLoading[caseId]=true;render();
  try{
    const response=await fetch('/.netlify/functions/counseling-plan',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({
      caseId,clientName:r.name||'',program:programBaseName(r.program),counselingMethod:r.type||'',currentStatus:normalizeStatus(r.status),
      formulation,
      assessmentAnalyses:analyses.map(a=>({testType:a.testType,validity:a.validity,coreFindings:a.coreFindings,strengths:a.strengths,vulnerabilities:a.vulnerabilities,counselingQuestions:a.counselingQuestions,caseHypotheses:a.caseHypotheses,cautions:a.cautions,confidenceScore:a.confidenceScore,reviewed:a.reviewed,needsReview:a.needsReview})),
      crossAnalysis:cross,
      reports:reports.map(x=>({testType:x.testType,summary:x.summary,strength:x.strength,caution:x.caution,plan:x.plan,approvedForClient:x.approvedForClient})),
      sessions:sessions.map(x=>({date:x.date,goal:x.goal,content:x.content,change:x.change,task:x.task,next:x.next})),
      existingPlan:counselingPlanForCase(caseId)
    })});
    const data=await response.json().catch(()=>({}));if(!response.ok||!data.plan)throw new Error(data.error||'상담계획 초안을 생성하지 못했습니다.');
    save(counselingPlanKey(caseId),{...data.plan,model:data.model||'',generatedAt:new Date().toISOString(),reviewed:false});
    alert('상담계획 초안이 생성되었습니다. 상담자가 근거를 확인하고 수정해 주세요.');
  }catch(error){alert(error.message||'상담계획 생성 중 오류가 발생했습니다.');}
  finally{state.counselingPlanLoading[caseId]=false;render();}
}
function saveCounselingPlan(caseId){
  const value=id=>document.getElementById(id)?.value?.trim()||'';
  const plan={
    shortTermGoals:value(`cp-short-${caseId}`),midTermGoals:value(`cp-mid-${caseId}`),longTermGoals:value(`cp-long-${caseId}`),
    initialPhase:value(`cp-initial-${caseId}`),middlePhase:value(`cp-middle-${caseId}`),terminationPhase:value(`cp-term-${caseId}`),
    sessionRoadmap:value(`cp-roadmap-${caseId}`),recommendedInterventions:value(`cp-interventions-${caseId}`),
    monitoringPoints:value(`cp-monitor-${caseId}`),nextSessionQuestions:value(`cp-questions-${caseId}`),
    clientTasks:value(`cp-tasks-${caseId}`),limitations:value(`cp-limit-${caseId}`),reviewed:true,reviewedAt:new Date().toISOString(),updatedAt:new Date().toISOString()
  };
  save(counselingPlanKey(caseId),{...counselingPlanForCase(caseId),...plan});alert('상담계획을 저장했습니다.');render();
}
function printCounselingPlan(caseId){
  const c=buildCases().find(x=>x.caseId===caseId);const p=counselingPlanForCase(caseId);if(!c||!Object.values(p).some(v=>typeof v==='string'&&v.trim())){alert('저장된 상담계획이 없습니다.');return;}
  const w=window.open('','_blank');if(!w){alert('팝업 차단을 해제해 주세요.');return;}
  const row=(title,value)=>`<section><h2>${title}</h2><div>${esc(value||'미입력').replace(/\n/g,'<br>')}</div></section>`;
  w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${esc(c.res.name||'내담자')} 상담계획</title><style>body{font-family:Arial,'Noto Sans KR',sans-serif;max-width:900px;margin:40px auto;padding:0 28px;color:#1e293b;line-height:1.7}h1{font-size:26px;margin-bottom:4px}.meta{color:#64748b}section{border-top:1px solid #e2e8f0;padding:18px 0}h2{font-size:15px;color:#4f46e5;margin:0 0 8px}div{font-size:14px}.notice{background:#f8fafc;border:1px solid #e2e8f0;padding:14px;border-radius:12px;font-size:12px;color:#64748b}</style></head><body><h1>상담계획</h1><p class="meta">${esc(c.res.name||'')} · ${esc(programBaseName(c.res.program))} · ${esc(caseId)}</p><div class="notice">본 문서는 상담자 내부 검토용입니다. 내담자의 변화와 안전 상태에 따라 유연하게 수정합니다.</div>${row('단기 상담목표',p.shortTermGoals)}${row('중기 상담목표',p.midTermGoals)}${row('장기 상담목표',p.longTermGoals)}${row('초기 단계 계획',p.initialPhase)}${row('중기 단계 계획',p.middlePhase)}${row('종결·사후관리 계획',p.terminationPhase)}${row('회기별 로드맵',p.sessionRoadmap)}${row('권장 개입',p.recommendedInterventions)}${row('위험·보호요인 모니터링',p.monitoringPoints)}${row('다음 회기 질문',p.nextSessionQuestions)}${row('내담자 실천과제',p.clientTasks)}${row('한계와 유의사항',p.limitations)}<script>window.onload=()=>window.print()<\/script></body></html>`);w.document.close();
}
function printCaseFormulation(caseId) {
  const c = buildCases().find(item => item.caseId === caseId);
  if (!c) return;
  const f = load("modumam_case_formulation_" + caseId, {});
  if (!Object.values(f).some(v => typeof v === 'string' && v.trim())) { alert('저장된 사례개념화가 없습니다.'); return; }
  const w = window.open('', '_blank');
  if (!w) { alert('팝업 차단을 해제해 주세요.'); return; }
  const row = (title, value) => `<section><h2>${title}</h2><div>${esc(value || '미입력').replace(/\n/g,'<br>')}</div></section>`;
  w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${esc(c.res.name || '내담자')} 사례개념화</title><style>body{font-family:Arial,'Noto Sans KR',sans-serif;max-width:900px;margin:40px auto;padding:0 28px;color:#1e293b;line-height:1.7}h1{font-size:26px;margin-bottom:4px}p.meta{color:#64748b;margin-top:0}section{border-top:1px solid #e2e8f0;padding:18px 0}h2{font-size:15px;color:#047857;margin:0 0 8px}div{font-size:14px}.notice{background:#f8fafc;border:1px solid #e2e8f0;padding:14px;border-radius:12px;font-size:12px;color:#64748b}@media print{button{display:none}body{margin:0}}</style></head><body><h1>사례개념화</h1><p class="meta">${esc(c.res.name || '')} · ${esc(programBaseName(c.res.program))} · ${esc(c.caseId)}</p><div class="notice">본 문서는 상담자의 임상적 검토를 위한 내부 자료이며, AI 초안은 진단이나 확정적 판단을 대신하지 않습니다.</div>${row('주호소',f.complaint)}${row('현재 문제 및 기능 영향',f.currentProblem)}${row('촉발요인',f.trigger)}${row('유지요인',f.maintaining)}${row('보호요인',f.protective)}${row('강점 및 자원',f.strength)}${row('상담목표',f.goal)}${row('개입전략 및 상담계획',f.intervention)}<script>window.onload=()=>window.print()<\/script></body></html>`);
  w.document.close();
}



// [MOD-20260716-SPRINT12-TEST-INTERPRETATION]
// 대표님이 제공한 STS·PAT 하위척도 설명을 기준으로 AI 해석 초안을 생성합니다.
const TEST_INTERPRETATION_SCALES={
  STS:[
    {key:'activity',label:'활동성',meaning:'전반적인 에너지 수준과 움직임, 적극성의 정도'},
    {key:'cautiousness',label:'조심성',meaning:'새로운 사람과 환경에 접근할 때의 신중함'},
    {key:'positiveEmotion',label:'긍정정서',meaning:'기쁨·즐거움·만족 등 긍정적인 정서를 경험하고 표현하는 경향'},
    {key:'negativeEmotion',label:'부정정서',meaning:'걱정·불안·속상함·예민함 등 부정적인 정서를 경험하는 경향'},
    {key:'socialSensitivity',label:'사회적 민감성',meaning:'타인의 감정과 관계 신호에 관심을 보이고 반응하는 정도'},
    {key:'effortfulControl',label:'의도적 조절',meaning:'목표에 맞게 행동과 주의를 조절하고 기다리는 능력'}
  ],
  PAT:[
    {key:'supportExpression',label:'지지표현',meaning:'자녀에게 애정·격려·지지를 표현하는 정도'},
    {key:'rationalExplanation',label:'합리적 설명',meaning:'훈육 상황에서 자녀가 이해할 수 있도록 이유와 기준을 설명하는 정도'},
    {key:'achievementPressure',label:'성취압력',meaning:'자녀에게 높은 성취와 사회적 성공을 요구하는 정도'},
    {key:'interference',label:'간섭',meaning:'자녀의 자율성과 사생활에 개입하고 통제하는 정도'},
    {key:'punishment',label:'처벌',meaning:'신체적 체벌이나 심리적 위협을 훈육에 사용하는 정도'},
    {key:'monitoring',label:'감독',meaning:'자녀의 생활과 활동을 파악하고 관심을 기울이는 정도'},
    {key:'overExpectation',label:'과잉기대',meaning:'자녀의 능력이나 발달 수준보다 높은 기대를 갖는 정도'},
    {key:'inconsistency',label:'비일관성',meaning:'상황이나 기분에 따라 양육 기준과 반응이 달라지는 정도'}
  ]
};
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
// 회원 중심으로 모든 심리검사를 업로드·분석하고, 상담자용 검사별 분석과 내담자용 종합보고서를 분리합니다.
const ASSESSMENT_TEST_OPTIONS=['TCI','MMPI-2','PAI','STS','PAT','K-CDI','SCT','HTP','PHQ-9','GAD-7','회복탄력성','직무스트레스','직업흥미검사','기타'];
/* [MODULE-20260716-ASSESSMENT-CENTER-01]
   심리평가센터 기능은 ./modules/assessment-center.js 로 분리했습니다.
   이후 심리검사 분석·교차분석·심리보고서 수정은 해당 파일에서 진행합니다.
*/

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
          <span class="w-fit rounded-full bg-white/10 px-4 py-2 text-xs font-extrabold text-white">전체 ${cases.length}건</span>
        </div>
      </div>

      <div class="space-y-7">
        ${cases.map(c => {
          const f = c.formulation || {};
          const cp = counselingPlanForCase(c.caseId);
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
                      <p class="mt-1 text-xs leading-relaxed text-slate-500">현재 연결된 자료를 확인한 뒤 AI 사례개념화 초안을 생성하세요.</p>
                      <div class="mt-3 flex flex-wrap gap-2">${sourceBadges.length?sourceBadges.map(x=>`<span class="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-[11px] font-extrabold text-emerald-700">✓ ${esc(x)}</span>`).join(''):'<span class="rounded-full border border-amber-200 bg-amber-50 px-3 py-1.5 text-[11px] font-extrabold text-amber-700">연결된 분석자료 없음</span>'}</div>
                    </div>
                    <div class="flex flex-wrap gap-2">
                      <button onclick="generateCaseDraft('${c.caseId}')" ${state.caseDraftLoading[c.caseId]?'disabled':''} class="rounded-xl bg-purple-600 px-4 py-3 text-xs font-extrabold text-white disabled:opacity-50">${state.caseDraftLoading[c.caseId]?'생성 중...':f.aiGeneratedAt?'AI 다시 생성':'AI 사례개념화 생성'}</button>
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
                    <label class="text-xs font-extrabold text-slate-500">보호요인<textarea id="cf-protective-${c.caseId}" rows="4" placeholder="안전과 회복에 도움이 되는 관계·환경·자원" class="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm leading-relaxed">${esc(f.protective||'')}</textarea></label>
                    <label class="text-xs font-extrabold text-slate-500">강점과 자원<textarea id="cf-strength-${c.caseId}" rows="4" placeholder="내담자의 강점·대처능력·활용 가능한 자원" class="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm leading-relaxed">${esc(f.strength||'')}</textarea></label>
                    <label class="text-xs font-extrabold text-slate-500">상담목표<textarea id="cf-goal-${c.caseId}" rows="5" placeholder="합의할 단기·중기 상담목표" class="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm leading-relaxed">${esc(f.goal||'')}</textarea></label>
                    <label class="text-xs font-extrabold text-slate-500">개입전략<textarea id="cf-intervention-${c.caseId}" rows="5" placeholder="상담 접근, 우선 개입, 모니터링 계획" class="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm leading-relaxed">${esc(f.intervention||'')}</textarea></label>
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
                    <textarea id="cp-initial-${c.caseId}" rows="6" placeholder="초기 단계 계획" class="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm">${esc(cp.initialPhase||'')}</textarea>
                    <textarea id="cp-middle-${c.caseId}" rows="6" placeholder="중기 단계 계획" class="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm">${esc(cp.middlePhase||'')}</textarea>
                    <textarea id="cp-term-${c.caseId}" rows="6" placeholder="종결·사후관리 계획" class="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm">${esc(cp.terminationPhase||'')}</textarea>
                    <textarea id="cp-roadmap-${c.caseId}" rows="6" placeholder="회기별 로드맵" class="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm">${esc(cp.sessionRoadmap||'')}</textarea>
                    <textarea id="cp-interventions-${c.caseId}" rows="6" placeholder="권장 개입" class="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm">${esc(cp.recommendedInterventions||'')}</textarea>
                    <textarea id="cp-monitor-${c.caseId}" rows="6" placeholder="위험·보호요인 모니터링" class="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm">${esc(cp.monitoringPoints||'')}</textarea>
                    <textarea id="cp-questions-${c.caseId}" rows="6" placeholder="다음 회기 질문" class="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm">${esc(cp.nextSessionQuestions||'')}</textarea>
                    <textarea id="cp-tasks-${c.caseId}" rows="6" placeholder="내담자 실천과제" class="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm">${esc(cp.clientTasks||'')}</textarea>
                    <textarea id="cp-limit-${c.caseId}" rows="5" placeholder="한계와 유의사항" class="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm lg:col-span-2">${esc(cp.limitations||'')}</textarea>
                  </div>
                  <button onclick="saveCounselingPlan('${c.caseId}')" class="mt-4 w-full rounded-2xl bg-slate-900 py-3 text-sm font-extrabold text-white">상담계획 검토본 저장</button>
                </section>

                <section class="rounded-[1.75rem] border border-slate-100 bg-white p-5">
                  <div class="flex items-center justify-between gap-3"><div><h4 class="text-base font-extrabold">참고 회기기록</h4><p class="mt-1 text-xs text-slate-400">상담기록에서 최종 저장된 회기자료입니다.</p></div><span class="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold">${c.sessions.length}건</span></div>
                  <div class="mt-4 space-y-3">${c.sessions.length?c.sessions.map((session,index)=>`<details class="rounded-2xl border border-slate-100 bg-slate-50" ${index===0?'open':''}><summary class="cursor-pointer list-none p-4 text-sm font-extrabold text-slate-800">${esc(session.date||'상담일 미입력')} · ${esc(session.sessionNumber?`${session.sessionNumber}회기`:session.goal||'회기기록')}</summary><div class="border-t border-slate-100 p-4 text-xs leading-relaxed text-slate-600"><p class="whitespace-pre-line"><b>상담내용</b>\n${esc(session.content||'')}</p>${session.change?`<p class="mt-3 whitespace-pre-line"><b>상담결과</b>\n${esc(session.change)}</p>`:''}${session.next?`<p class="mt-3 whitespace-pre-line"><b>다음회기</b>\n${esc(session.next)}</p>`:''}</div></details>`).join(''):'<div class="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-6 text-center text-sm text-slate-400">저장된 회기기록이 없습니다.</div>'}</div>
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
선택 검사: ${(r.selectedTests||r.extraTests||[]).join(', ')||'없음'}

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
  w.document.write(`<html><head><title>상담신청서_${esc(r.name)}</title><style>body{font-family:Arial,sans-serif;padding:40px;line-height:1.7;color:#1e293b}h1{font-size:24px}.box{border:1px solid #e2e8f0;border-radius:14px;padding:16px;margin:14px 0;background:#f8fafc}p{margin:6px 0}.sign{margin-top:28px;border-top:1px solid #ddd;padding-top:18px}</style></head><body><p style="font-size:12px;color:#047857;font-weight:bold;">MODUMAM LAB</p><h1>상담신청서 및 심리상담 동의 확인서</h1><div class="box"><p><b>성명:</b> ${esc(r.name)}</p><p><b>생년월일:</b> ${esc(a.birth)}</p><p><b>연락처:</b> ${esc(r.phone)}</p><p><b>이메일:</b> ${esc(a.email)}</p><p><b>선호 연락:</b> ${esc(a.contactMethod)}</p><p><b>소속/직업군:</b> ${esc(a.clientType)}</p></div><div class="box"><p><b>프로그램:</b> ${esc(programBaseName(r.program))}</p><p><b>상담 방식:</b> ${esc(r.type)}</p><p><b>희망 일정:</b> ${esc(r.date)} ${esc(r.time)}</p><p><b>선택 검사:</b> ${esc((r.selectedTests||r.extraTests||[]).join(', '))}</p></div><div class="box"><p><b>현재 가장 힘든 점:</b></p><p>${esc(a.concern)}</p><p><b>이전 상담/치료/검사 경험:</b> ${esc(a.counselingHistory)}</p><p><b>복용 중인 약:</b> ${esc(a.medication)}</p><p><b>진단/치료 중인 질환:</b> ${esc(a.diagnosis)}</p><p><b>최근 자해/자살 위험:</b> ${esc(a.risk)}</p></div><div class="box"><p><b>개인정보 수집·이용:</b> ${c.privacy?'동의':'미동의'}</p><p><b>심리검사/상담 및 비밀보장 예외:</b> ${c.counseling?'동의':'미동의'}</p><p><b>예약 변경/취소 및 노쇼 규정:</b> ${c.cancelPolicy?'동의':'미동의'}</p><p><b>동의일시:</b> ${esc(c.signedAt)}</p><p><b>문서버전:</b> ${esc(c.documentVersion)}</p></div><div class="sign"><p>작성자(전자서명): <b>${esc(c.signature)}</b></p><p>관리자 확인상태: ${esc(documentStatus(r))}</p></div><script>window.print();<\/script></body></html>`);
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


function handleCounselingTranscriptInput(input){
  if(!input)return;

  const caseId=String(input.dataset.counselingCaseId||'');
  const file=input.files?.[0];

  if(!caseId){
    alert('사례 정보를 확인하지 못했습니다.');
    input.value='';
    return;
  }

  if(!file){
    return;
  }

  selectCounselingTranscript(caseId,file);
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

function todayCounselingView(){
  const rows=todayReservations();
  const active=rows.filter(r=>['상담준비','상담진행'].includes(normalizeStatus(r.status)));
  return layout(`<div class="space-y-6">
    <div class="bg-gradient-to-r from-slate-900 to-emerald-900 text-white rounded-[2rem] p-6 sm:p-8 shadow-sm">
      <div class="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4"><div><p class="text-xs font-extrabold text-emerald-300">TODAY COUNSELING</p><h2 class="text-2xl sm:text-3xl font-extrabold mt-2">오늘 상담 대기함</h2><p class="text-sm text-slate-200 mt-2">오늘의 예약을 확인하고 예약관리·상담 시작·다음 예약으로 바로 연결합니다.</p></div><div class="grid grid-cols-2 gap-3"><div class="bg-white/10 rounded-2xl px-5 py-4"><p class="text-xs text-slate-300">오늘 예약</p><p class="text-3xl font-extrabold">${rows.length}</p></div><div class="bg-white/10 rounded-2xl px-5 py-4"><p class="text-xs text-slate-300">상담 준비·진행</p><p class="text-3xl font-extrabold">${active.length}</p></div></div></div>
    </div>
    <div class="space-y-4">${rows.length?rows.map(r=>{const tests=requestedTests(r).map(shortTestName);const st=normalizeStatus(r.status);return `<div class="bg-white rounded-[2rem] border border-slate-100 p-5 sm:p-6 shadow-sm"><div class="flex flex-col xl:flex-row xl:items-start xl:justify-between gap-5"><div class="flex-1"><div class="flex flex-wrap items-center gap-2"><p class="text-xl font-extrabold">${esc(r.time||'--:--')} · ${esc(r.name)}님</p><span class="text-xs font-bold px-3 py-1 rounded-full ${statusClass(st)}">${esc(st)}</span></div><p class="text-xs text-slate-400 mt-1">${esc(r.caseNumber||'사례번호 생성 전')} · ${esc(r.reservationNumber||'-')} · ${esc(r.phone||'연락처 없음')}</p><div class="grid grid-cols-1 sm:grid-cols-4 gap-3 mt-5 text-sm"><div class="bg-slate-50 rounded-2xl p-3"><p class="text-[11px] font-bold text-slate-400">예약일정</p><p class="font-extrabold mt-1">${esc(r.date)} ${esc(r.time)}</p></div><div class="bg-slate-50 rounded-2xl p-3"><p class="text-[11px] font-bold text-slate-400">프로그램명</p><p class="font-extrabold mt-1">${esc(programBaseName(r.program))}</p></div><div class="bg-slate-50 rounded-2xl p-3"><p class="text-[11px] font-bold text-slate-400">검사명</p><p class="font-extrabold mt-1">${esc(tests.join(', ')||'없음')}</p></div><div class="bg-slate-50 rounded-2xl p-3"><p class="text-[11px] font-bold text-slate-400">상담방식</p><p class="font-extrabold mt-1">${esc(r.type||'미정')}</p></div></div></div><div class="xl:w-52 grid grid-cols-2 xl:grid-cols-1 gap-2"><button onclick="setMenu('reservation')" class="bg-white border border-slate-200 rounded-xl px-4 py-3 text-xs font-extrabold">예약관리</button><button onclick="startCounseling(${r.id})" class="bg-emerald-600 text-white rounded-xl px-4 py-3 text-xs font-extrabold">상담 시작</button><button onclick="openCounselingRecordByReservation(${r.id})" class="bg-blue-600 text-white rounded-xl px-4 py-3 text-xs font-extrabold">회기기록</button><button onclick="completeCounselingAndOpenChart(${r.id})" class="bg-slate-900 text-white rounded-xl px-4 py-3 text-xs font-extrabold">상담 완료</button><button onclick="scheduleNextCounseling(${r.id})" class="col-span-2 xl:col-span-1 bg-purple-600 text-white rounded-xl px-4 py-3 text-xs font-extrabold">다음 상담 예약</button></div></div></div>`}).join(''):empty('오늘 예정된 상담이 없습니다.')}</div>
  </div>`)
}


// [MOD-20260715-CENTER2-SPRINT10] 운영비서 브리핑
// 예약·검사·보고서·상담 데이터를 바탕으로 오늘 우선순위를 자동 정리합니다.
function operatingSecretaryData(){
  const today=todayReservations().slice().sort((a,b)=>String(a.time||'').localeCompare(String(b.time||'')));
  const tasks=automatedTasks();
  const nowDate=new Date().toISOString().slice(0,10);
  const overdue=state.reservations.filter(r=>{
    const st=normalizeStatus(r.status);
    return r.date && r.date<nowDate && !['상담완료','종결','예약취소'].includes(st);
  });
  const taskGroups={};
  tasks.forEach(t=>{taskGroups[t.title]=(taskGroups[t.title]||0)+1});
  const topGroups=Object.entries(taskGroups).sort((a,b)=>b[1]-a[1]).slice(0,4);
  const next=today[0]||null;
  const urgent=tasks.filter(t=>t.priority<=5).slice(0,5);
  const lines=[];
  if(next) lines.push(`오늘 가장 가까운 상담은 ${next.time||'시간 미정'} ${next.name}님이며, ${programBaseName(next.program)} · ${next.type||'상담방식 미정'}입니다.`);
  else lines.push('오늘 예정된 상담은 없습니다.');
  if(tasks.length) lines.push(`현재 자동 생성된 업무는 ${tasks.length}건이며, 우선 처리 업무는 ${urgent.length}건입니다.`);
  else lines.push('현재 추가로 처리할 자동 업무는 없습니다.');
  if(overdue.length) lines.push(`예정일이 지났지만 완료되지 않은 예약이 ${overdue.length}건 있어 확인이 필요합니다.`);
  if(topGroups.length) lines.push(`가장 많은 업무는 ${topGroups.map(([name,count])=>`${name} ${count}건`).join(', ')}입니다.`);
  return {today,tasks,overdue,topGroups,next,urgent,lines};
}
function operatingSecretaryText(){
  const d=operatingSecretaryData();
  const taskLines=d.urgent.length?d.urgent.map((t,i)=>`${i+1}. ${t.reservation.name}님 - ${t.title}`).join('\n'):'우선 처리 업무 없음';
  return `[모두의 마음연구소 오늘 운영 브리핑]\n${d.lines.join('\n')}\n\n[우선 처리]\n${taskLines}`;
}
async function copyOperatingSecretaryBrief(){
  try{
    await navigator.clipboard.writeText(operatingSecretaryText());
    alert('오늘 운영 브리핑을 복사했습니다.');
  }catch(e){
    const ta=document.createElement('textarea');ta.value=operatingSecretaryText();document.body.appendChild(ta);ta.select();document.execCommand('copy');ta.remove();alert('오늘 운영 브리핑을 복사했습니다.');
  }
}
function operatingSecretaryView(){
  const d=operatingSecretaryData();
  return `<section class="mb-6 overflow-hidden rounded-[2rem] border border-indigo-100 bg-gradient-to-br from-indigo-50 via-white to-emerald-50 shadow-sm">
    <div class="grid grid-cols-1 gap-0 xl:grid-cols-3">
      <div class="p-6 sm:p-7 xl:col-span-2">
        <div class="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div><div class="flex items-center gap-2"><span class="rounded-full bg-indigo-600 px-3 py-1 text-[11px] font-extrabold text-white">AI 운영비서</span><span class="text-[11px] font-bold text-slate-400">운영 데이터 자동 요약</span></div><h2 class="mt-3 text-xl font-extrabold text-slate-900">오늘 먼저 확인할 업무입니다.</h2></div>
          <button onclick="copyOperatingSecretaryBrief()" class="shrink-0 rounded-xl border border-indigo-200 bg-white px-4 py-2 text-xs font-extrabold text-indigo-700">브리핑 복사</button>
        </div>
        <div class="mt-5 space-y-2">${d.lines.map((line,i)=>`<div class="flex items-start gap-3 rounded-2xl bg-white/80 px-4 py-3"><span class="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${i===0?'bg-emerald-100 text-emerald-700':i===1?'bg-indigo-100 text-indigo-700':'bg-amber-100 text-amber-700'} text-xs font-extrabold">${i+1}</span><p class="text-sm font-bold leading-relaxed text-slate-700">${esc(line)}</p></div>`).join('')}</div>
      </div>
      <div class="border-t border-indigo-100 bg-white/70 p-6 xl:border-l xl:border-t-0">
        <div class="flex items-center justify-between"><div><p class="text-xs font-extrabold text-rose-600">PRIORITY</p><h3 class="mt-1 text-base font-extrabold">우선 처리 ${d.urgent.length}건</h3></div><button onclick="setMenu('reservation')" class="rounded-xl bg-slate-900 px-3 py-2 text-[11px] font-extrabold text-white">전체 업무</button></div>
        <div class="mt-4 space-y-3">${d.urgent.length?d.urgent.map(t=>`<button onclick="${t.action}" class="w-full rounded-2xl border border-slate-100 bg-white p-3 text-left hover:border-indigo-200"><div class="flex items-center justify-between gap-2"><p class="text-xs font-extrabold text-slate-900">${esc(t.reservation.name)}님</p><span class="rounded-full bg-rose-50 px-2 py-1 text-[10px] font-bold text-rose-600">${esc(normalizeStatus(t.reservation.status))}</span></div><p class="mt-1 text-[11px] font-extrabold text-indigo-700">${esc(t.title)}</p><p class="mt-1 text-[10px] text-slate-400">${esc(t.reservation.date||'')} ${esc(t.reservation.time||'')}</p></button>`).join(''):'<div class="rounded-2xl bg-emerald-50 p-4 text-xs font-bold text-emerald-700">현재 긴급한 우선 업무가 없습니다.</div>'}</div>
      </div>
    </div>
  </section>`;
}

function dashboardView(){
  // ===== [MODUMAM 오늘업무 우선처리·빠른메뉴 삭제 시작] =====
  const today=todayReservations();
  const tasks=automatedTasks();
  const recent=state.reservations
    .slice()
    .sort((a,b)=>Number(b.id||0)-Number(a.id||0))
    .slice(0,5);

  return layout(`<div class="space-y-6">
    <section class="rounded-[2rem] bg-slate-950 p-6 text-white shadow-xl shadow-slate-900/10 sm:p-8">
      <div class="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
        <div>
          <p class="text-xs font-extrabold text-emerald-300">TODAY WORK CENTER</p>
          <h2 class="mt-2 text-2xl font-extrabold sm:text-3xl">오늘 해야 할 일을 확인하세요.</h2>
          <p class="mt-2 max-w-3xl text-sm leading-relaxed text-slate-300">처리가 필요한 내용을 확인한 뒤 해당 관리 페이지로 이동하여 진행합니다.</p>
        </div>
        <button onclick="refreshSharedOperatingData(true)" class="rounded-xl border border-white/20 bg-white/10 px-4 py-3 text-xs font-extrabold text-white hover:bg-white/15">예약 새로 불러오기</button>
      </div>
    </section>

    <section class="rounded-[2rem] border border-slate-100 bg-white p-6 shadow-sm">
      <div class="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p class="text-xs font-extrabold text-rose-600">TODAY TASKS</p>
          <h2 class="mt-1 text-xl font-extrabold">오늘 해야 할 일</h2>
          <p class="mt-1 text-sm text-slate-500">업무 내용을 확인하고 버튼을 눌러 관련 관리 페이지에서 처리하세요.</p>
        </div>
        <span class="w-fit rounded-full bg-slate-100 px-3 py-1 text-xs font-extrabold text-slate-600">${tasks.length}건</span>
      </div>
      <div class="space-y-3">
        ${tasks.length
          ? tasks.slice(0,12).map(automationTaskCard).join('')
          : '<div class="rounded-2xl border border-dashed border-emerald-200 bg-emerald-50 p-8 text-center text-sm font-bold text-emerald-700">현재 처리할 업무가 없습니다.</div>'}
      </div>
    </section>

    <div class="grid grid-cols-1 gap-6 xl:grid-cols-2">
      <section class="rounded-[2rem] border border-slate-100 bg-white p-6 shadow-sm">
        <div class="mb-5 flex items-center justify-between gap-3">
          <div>
            <p class="text-xs font-extrabold text-emerald-600">TODAY</p>
            <h2 class="mt-1 text-xl font-extrabold">오늘 예약</h2>
          </div>
          <button onclick="setMenu('today')" class="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-extrabold">오늘 상담 열기</button>
        </div>
        <div class="space-y-3">
          ${today.length
            ? today.map(r=>{
                const tests=requestedTests(r).map(shortTestName);
                return `<article class="rounded-2xl border border-slate-100 bg-slate-50 p-4">
                  <div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <div class="flex flex-wrap items-center gap-2">
                        <p class="text-sm font-extrabold text-slate-900">${esc(r.time||'--:--')} · ${esc(r.name)}님</p>
                        <span class="rounded-full px-3 py-1 text-[10px] font-extrabold ${statusClass(r.status)}">${esc(normalizeStatus(r.status))}</span>
                      </div>
                      <p class="mt-2 text-xs text-slate-500">${esc(programBaseName(r.program))} · ${esc(tests.join(', ')||'검사 없음')} · ${esc(r.type||'상담방식 미정')}</p>
                    </div>
                    <button onclick="startCounseling(${r.id})" class="rounded-xl bg-emerald-600 px-4 py-2 text-xs font-extrabold text-white">상담 시작</button>
                  </div>
                </article>`;
              }).join('')
            : empty('오늘 예약 일정이 없습니다.')}
        </div>
      </section>

      <section class="rounded-[2rem] border border-slate-100 bg-white p-6 shadow-sm">
        <div class="mb-5 flex items-center justify-between gap-3">
          <div>
            <p class="text-xs font-extrabold text-indigo-600">RECENT</p>
            <h2 class="mt-1 text-xl font-extrabold">최근 신청</h2>
          </div>
          <button onclick="setMenu('reservation')" class="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-extrabold">전체 보기</button>
        </div>
        <div class="space-y-3">
          ${recent.length
            ? recent.map(r=>`<button onclick="openMemberChartByReservation(${r.id},'profile')" class="w-full rounded-2xl border border-slate-100 bg-slate-50 p-4 text-left hover:border-indigo-200">
                <div class="flex items-start justify-between gap-3">
                  <div>
                    <p class="text-sm font-extrabold text-slate-900">${esc(r.name)}님</p>
                    <p class="mt-1 text-[11px] text-slate-400">${esc(r.date||'')} ${esc(r.time||'')} · ${esc(programBaseName(r.program))}</p>
                  </div>
                  <span class="rounded-full px-2 py-1 text-[10px] font-extrabold ${statusClass(r.status)}">${esc(normalizeStatus(r.status))}</span>
                </div>
              </button>`).join('')
            : empty('최근 예약이 없습니다.')}
        </div>
      </section>
    </div>
  </div>`);
  // ===== [MODUMAM 오늘업무 우선처리·빠른메뉴 삭제 끝] =====
}

function reservationSyncStatus(){
  const primary=load('modumam_reservations',[]).length;
  const inbox=load('modumam_reservation_inbox',[]).length;
  return `<div class="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-sky-100 bg-sky-50 px-4 py-3"><div><p class="text-xs font-extrabold text-sky-900">예약 저장소 확인</p><p class="mt-1 text-[11px] text-sky-700">IndexedDB ${state.reservationDbCount||0}건 · 기본 저장소 ${primary}건 · 예약 수신함 ${inbox}건 · 현재 표시 ${state.reservations.length}건</p>${state.reservationSyncError?`<p class="mt-1 text-[11px] font-bold text-rose-600">저장소 오류: ${esc(state.reservationSyncError)}</p>`:''}</div><button onclick="refreshSharedOperatingData(true)" class="rounded-xl bg-sky-700 px-4 py-2 text-xs font-extrabold text-white">예약 새로 불러오기</button></div>`;
}
function reservationView(){
  return layout(`${reservationSyncStatus()}<div class="space-y-5">
    <div class="rounded-[2rem] bg-slate-950 p-6 text-white">
      <p class="text-xs font-extrabold text-emerald-300">RESERVATION WORKFLOW</p>
      <h2 class="mt-2 text-2xl font-extrabold">예약·검사 운영</h2>
      <p class="mt-2 text-sm text-slate-300">예약과 검사신청을 먼저 확인하고, 실제 업무 처리에 따라 진행상태가 자동으로 이동합니다.</p>
    </div>
    ${state.reservations.map(r=>{const p=progress(r),tests=requestedTests(r),st=normalizeStatus(r.status),terminal=['종결','예약취소'].includes(st);return `<section class="rounded-[2rem] border border-slate-100 bg-white p-5 shadow-sm sm:p-6">
      <div class="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div><div class="flex flex-wrap items-center gap-2"><h3 class="text-xl font-extrabold">${esc(r.name)}님</h3><span class="rounded-full px-3 py-1 text-xs font-bold ${statusClass(st)}">${esc(st)}</span>${p.ai?'<span class="rounded-full bg-purple-100 px-3 py-1 text-xs font-bold text-purple-700">AI체크인 완료</span>':''}</div><p class="mt-1 text-xs text-slate-400">${esc(r.phone||'연락처 없음')}</p></div>
        <button onclick="openMemberChartByReservation(${r.id},'profile')" class="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-extrabold">회원 전자차트</button>
      </div>

      <div class="mt-5 rounded-2xl border border-emerald-100 bg-emerald-50/50 p-4">
        <div class="mb-3"><p class="text-xs font-extrabold text-emerald-700">검사신청·예약확인</p><p class="mt-1 text-[11px] text-emerald-700/70">예약 운영에 필요한 핵심 정보를 가장 먼저 확인합니다.</p></div>
        <div class="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
          <div class="rounded-2xl border border-white bg-white p-4"><p class="text-[11px] font-bold text-slate-400">예약일정</p><div class="mt-2 grid grid-cols-2 gap-2"><input id="reservation-date-${esc(String(r.id))}" type="date" value="${esc(r.date)}" class="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm font-bold"><select id="reservation-time-${esc(String(r.id))}" class="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm font-bold">${COUNSELING_TIMES.map(time=>`<option value="${time}" ${String(r.time||'')===time?'selected':''}>${time}</option>`).join('')}</select></div></div>
          <div class="rounded-2xl border border-white bg-white p-4"><p class="text-[11px] font-bold text-slate-400">프로그램명</p><p class="mt-2 font-extrabold">${esc(programBaseName(r.program))}</p></div>
          <div class="rounded-2xl border border-white bg-white p-4"><p class="text-[11px] font-bold text-slate-400">신청 검사</p><div class="mt-2 flex flex-wrap gap-1.5">${tests.length?tests.map(t=>`<span class="rounded-full border border-purple-100 bg-purple-50 px-2.5 py-1 text-xs font-extrabold text-purple-700">${esc(shortTestName(t))}</span>`).join(''):'<span class="text-xs text-slate-400">신청 검사 없음</span>'}</div></div>
          <div class="rounded-2xl border border-white bg-white p-4"><p class="text-[11px] font-bold text-slate-400">상담방식</p><select id="reservation-method-${esc(String(r.id))}" class="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm font-bold">${COUNSELING_METHODS.map(method=>`<option value="${method}" ${String(r.type||'')===method?'selected':''}>${method==='Zoom(비대면)'?'화상(비대면)':method}</option>`).join('')}</select></div>
        </div>
      </div>

      <div class="mt-4 rounded-2xl border border-slate-100 bg-slate-50 p-4">
        <div><p class="text-sm font-extrabold">자동 진행상태</p><p class="mt-1 text-xs text-slate-500">${esc(autoStatusDescription(r))}</p></div><div class="mt-4">${focusedNextTaskBlock(r)}</div>
        <div class="mt-4">${operationPipeline(r)}</div>
      </div>

      <div class="mt-4 grid grid-cols-1 gap-4">
        <div class="rounded-2xl border border-slate-100 bg-white p-4"><div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><h4 class="text-sm font-extrabold">신청 검사 관리</h4><p class="mt-1 text-[11px] text-slate-400">검사기관 사이트를 저장하고 바로 열어 신청 검사를 관리합니다.</p></div><button onclick="markAllTestsSent(${r.id})" class="rounded-xl border border-indigo-100 bg-indigo-50 px-3 py-2 text-xs font-bold text-indigo-700">전체 발송완료</button></div><div class="mt-4 rounded-2xl border border-slate-100 bg-slate-50 p-4"><p class="text-xs font-extrabold text-slate-500">신청 검사</p><div class="mt-2 flex flex-wrap gap-2">${tests.length?tests.map(t=>`<span class="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700">${esc(t)}</span>`).join(''):'<span class="text-xs text-slate-400">신청된 검사가 없습니다.</span>'}</div></div><div class="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2"><article class="rounded-2xl border border-rose-100 bg-rose-50 p-4"><p class="text-[10px] font-extrabold text-rose-500">MAUMSARANG</p><h5 class="mt-1 text-base font-extrabold">마음사랑검사</h5><input id="test-provider-url-maumsarang" type="url" value="${esc(getTestProviderUrl('maumsarang'))}" class="mt-4 w-full rounded-xl border border-rose-200 bg-white px-3 py-2 text-xs"><div class="mt-3 grid grid-cols-2 gap-2"><button onclick="saveTestProviderUrl('maumsarang')" class="rounded-xl bg-rose-600 px-3 py-2 text-xs font-extrabold text-white">링크 저장</button><button onclick="openTestProviderUrl('maumsarang')" class="rounded-xl border border-rose-200 bg-white px-3 py-2 text-xs font-extrabold text-rose-700">사이트 열기</button></div></article><article class="rounded-2xl border border-indigo-100 bg-indigo-50 p-4"><p class="text-[10px] font-extrabold text-indigo-500">INPSYT</p><h5 class="mt-1 text-base font-extrabold">인싸이트검사</h5><input id="test-provider-url-insight" type="url" value="${esc(getTestProviderUrl('insight'))}" class="mt-4 w-full rounded-xl border border-indigo-200 bg-white px-3 py-2 text-xs"><div class="mt-3 grid grid-cols-2 gap-2"><button onclick="saveTestProviderUrl('insight')" class="rounded-xl bg-indigo-600 px-3 py-2 text-xs font-extrabold text-white">링크 저장</button><button onclick="openTestProviderUrl('insight')" class="rounded-xl border border-indigo-200 bg-white px-3 py-2 text-xs font-extrabold text-indigo-700">사이트 열기</button></div></article></div></div>

      </div>
    </section>`}).join('')||empty('예약이 없습니다.')}
  </div>`)
}
function aiMonitoringRecords(){
  const stored=load('modumam_ai_result_counseling_records',[]);
  const rows=Array.isArray(stored)?stored:[];
  const aiReservations=state.reservations.filter(isAiResultCounselingReservation);
  const map=new Map();

  rows.forEach(record=>{
    const key=String(record.sessionId||record.id||record.reservationId||Math.random());
    map.set(key,{...record});
  });

  aiReservations.forEach(r=>{
    const exists=[...map.values()].some(x=>String(x.reservationId)===String(r.id));
    if(!exists && ['상담준비','상담진행','상담완료'].includes(normalizeStatus(r.status))){
      const key='reservation-'+String(r.id);
      map.set(key,{
        id:key,
        sessionId:key,
        reservationId:r.id,
        clientName:r.name||'',
        phone:r.phone||'',
        counselingType:'AI 결과상담',
        reportTitle:'검사결과 해석상담',
        reservationDate:r.date||'',
        reservationTime:r.time||'',
        startedAt:r.counselingStartedAt||'',
        updatedAt:r.updatedAt||r.statusUpdatedAt||'',
        completedAt:r.aiResultCounselingCompletedAt||'',
        status:r.aiResultCounselingCompletedAt||normalizeStatus(r.status)==='상담완료'?'완료':'대기',
        summary:r.aiResultCounselingSummary||'',
        messages:[],
        messageCount:0,
        riskDetected:false,
        placeholder:true
      });
    }
  });

  return [...map.values()].sort((a,b)=>String(b.updatedAt||b.startedAt||'').localeCompare(String(a.updatedAt||a.startedAt||'')));
}

function aiMonitoringMessageBubble(message){
  const isUser=message?.role==='user';
  return `<div class="flex ${isUser?'justify-end':'justify-start'}"><div class="max-w-[88%] rounded-2xl px-4 py-3 ${isUser?'bg-slate-900 text-white':'border border-slate-200 bg-white text-slate-700'}"><p class="mb-1 text-[10px] font-extrabold ${isUser?'text-slate-300':'text-emerald-700'}">${isUser?'내담자':'AI 결과상담'}</p><p class="whitespace-pre-wrap text-sm leading-relaxed">${esc(message?.text||'')}</p><p class="mt-2 text-right text-[9px] text-slate-400">${esc(message?.time||'')}</p></div></div>`;
}
function intakeView(){
  const records=aiMonitoringRecords(),active=records.filter(r=>r.status==='진행중'),completed=records.filter(r=>r.status==='완료'),risk=records.filter(r=>r.riskDetected);
  return layout(`<div class="space-y-6"><div class="rounded-[2rem] bg-gradient-to-r from-slate-950 via-indigo-950 to-emerald-950 p-7 text-white shadow-xl"><p class="text-xs font-extrabold text-emerald-300">AI RESULT COUNSELING MONITORING</p><h2 class="mt-2 text-2xl font-extrabold">AI 모니터링</h2><p class="mt-2 max-w-4xl text-sm leading-relaxed text-slate-300">예약된 AI(비대면) 검사결과 해석상담의 진행 상태와 내담자·AI 대화를 읽기 전용으로 확인합니다.</p><div class="mt-5"><button onclick="refreshSharedOperatingData(true)" class="rounded-xl bg-white px-4 py-2 text-xs font-extrabold text-slate-900">새로고침</button></div></div><div class="grid grid-cols-1 gap-4 sm:grid-cols-4">${card('전체 AI 상담',records.length+'건','결과해석 AI 상담','🤖','purple')}${card('진행 중',active.length+'건','현재 상담 진행','●','emerald')}${card('완료',completed.length+'건','상담 종료 기록','✓','blue')}${card('위험표현',risk.length+'건','상담자 확인 필요','!','orange')}</div><div class="space-y-5">${records.length?records.map(record=>{const reservation=state.reservations.find(r=>String(r.id)===String(record.reservationId));const messages=Array.isArray(record.messages)?record.messages:[];const isActive=record.status==='진행중';return `<details class="overflow-hidden rounded-[2rem] border ${record.riskDetected?'border-rose-300':'border-slate-100'} bg-white shadow-sm" ${isActive||record.riskDetected||String(record.reservationId)===String(state.aiMonitoringSelectedId||'')?'open':''}><summary class="cursor-pointer list-none p-5 sm:p-6"><div class="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between"><div><div class="flex flex-wrap items-center gap-2"><p class="text-lg font-extrabold text-slate-950">${esc(record.clientName||reservation?.name||'이름 미입력')}님</p><span class="rounded-full px-3 py-1 text-[11px] font-extrabold ${isActive?'bg-emerald-100 text-emerald-700':'bg-slate-100 text-slate-600'}">${isActive?'● 진행 중':'상담 완료'}</span>${record.riskDetected?'<span class="rounded-full bg-rose-100 px-3 py-1 text-[11px] font-extrabold text-rose-700">위험표현 확인</span>':''}</div><p class="mt-2 text-xs text-slate-500">${esc(record.phone||reservation?.phone||'')} · ${esc(record.reservationDate||reservation?.date||'')} ${esc(record.reservationTime||reservation?.time||'')} · ${esc(record.reportTitle||'결과보고서')}</p></div><div class="rounded-xl bg-slate-50 px-4 py-3 text-center"><p class="text-[9px] font-bold text-slate-400">대화</p><p class="text-sm font-extrabold">${messages.length}개</p></div></div></summary><div class="border-t border-slate-100 bg-slate-50 p-5 sm:p-6"><div class="max-h-[620px] space-y-3 overflow-y-auto rounded-2xl border border-slate-100 bg-slate-100/70 p-4">${messages.length?messages.map(aiMonitoringMessageBubble).join(''):empty(record.placeholder?'내담자가 AI 결과상담을 시작하면 대화가 실시간으로 표시됩니다.':'아직 저장된 대화가 없습니다.')}</div>${record.summary?`<div class="mt-4 rounded-2xl border border-indigo-100 bg-indigo-50 p-4"><p class="text-xs font-extrabold text-indigo-700">AI 상담 마무리 요약</p><p class="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-slate-700">${esc(record.summary)}</p></div>`:''}<p class="mt-4 text-[10px] text-slate-400">시작 ${esc(record.startedAt||'')} · 최근 업데이트 ${esc(record.updatedAt||'')} · 읽기 전용</p></div></details>`;}).join(''):empty('내담자가 예약된 AI 결과상담을 시작하면 이곳에 표시됩니다.')}</div></div>`);
}
function detailedReportTemplate(testType, reportType) {
  const admin = reportType === "관리자용";

  const templates = {
    "TCI": {
      summary: admin
        ? `【TCI 관리자용 임상 소견】

1. 기질 프로파일
- 자극추구(NS):
- 위험회피(HA):
- 사회적 민감성(RD):
- 인내력(P):

2. 성격 프로파일
- 자율성(SD):
- 연대감(C):
- 자기초월(ST):

3. 사례개념화
- 주요 주호소:
- 반복되는 정서·행동 패턴:
- 스트레스 상황에서의 반응:
- 대인관계에서의 특징:

4. 임상적 주의점
- 위험 신호:
- 방어/회피 양상:
- 상담 저항 가능성:
`
        : `【TCI 기질 및 성격검사 결과 요약】

TCI는 타고난 기질과 후천적으로 발달한 성격을 함께 살펴보는 검사입니다.
이번 결과는 현재의 정서 반응, 스트레스 대처 방식, 대인관계 패턴을 이해하는 데 도움을 줍니다.

1. 기질 이해
- 자극추구:
- 위험회피:
- 사회적 민감성:
- 인내력:

2. 성격 이해
- 자율성:
- 연대감:
- 자기초월:

3. 현재 마음의 특징
`,
      strength: `【강점 및 자원】

- 자신의 반응 패턴을 이해하려는 동기가 있습니다.
- 기질적 특성을 알면 스트레스 상황에서 스스로를 덜 비난하고 조절 전략을 찾을 수 있습니다.
- 성격 자원은 상담과 일상 실천을 통해 확장될 수 있습니다.
`,
      caution: `【주의점 및 어려움】

- 특정 기질이 높거나 낮을 때 스트레스 상황에서 반복되는 반응이 나타날 수 있습니다.
- 정서적 예민함, 회피, 충동성, 관계 피로감 등이 개인에 따라 다르게 나타날 수 있습니다.
- 검사 결과는 고정된 성격 판단이 아니라 자기이해를 위한 자료입니다.
`,
      plan: `【상담 제안】

1. 기질을 바꾸려 하기보다 이해하고 조율하기
2. 스트레스 상황에서 자동으로 나타나는 반응 알아차리기
3. 대인관계에서 반복되는 패턴 탐색하기
4. 생활 속 자기조절 전략 만들기
5. 필요 시 추가검사 또는 심리상담 연계
`
    },

    "STS": {
      summary: admin
        ? `【STS 관리자용 해석】

1. 6요인 프로파일
- 정서성:
- 활동성:
- 사회성:
- 수줍음:
- 주의집중:
- 지속성:

2. 기질적 강점
3. 환경 적합성
4. 상담 및 양육/지도 시 고려점
`
        : `【STS 6요인 기질검사 결과 요약】

STS는 개인의 기질적 특성을 6가지 요인으로 살펴보는 검사입니다.
기질은 좋고 나쁨의 문제가 아니라, 환경과 만났을 때 어떻게 드러나는지를 이해하는 것이 중요합니다.

1. 정서 반응
2. 활동 수준
3. 사회적 접근성
4. 낯선 상황에서의 반응
5. 주의집중
6. 지속성
`,
      strength: `【강점】

- 타고난 기질을 이해하면 자신에게 맞는 환경과 대처 방식을 찾을 수 있습니다.
- 강점 기질은 학습, 관계, 일상 적응의 자원이 될 수 있습니다.
`,
      caution: `【주의점】

- 기질과 환경이 맞지 않을 때 피로감이나 갈등이 커질 수 있습니다.
- 특정 기질을 문제로 보기보다 조절과 환경 조율의 관점에서 이해해야 합니다.
`,
      plan: `【제안】

- 기질에 맞는 생활 리듬 만들기
- 정서 반응을 알아차리는 연습
- 관계 상황에서 무리하지 않는 자기표현 연습
- 필요 시 부모/교사/상담자와 환경 조율
`
    },

    "PAT": {
      summary: admin
        ? `【PAT 부모양육태도검사 관리자용 해석】

1. 양육태도 주요 프로파일
- 지지/수용:
- 자율성 존중:
- 일관성:
- 통제/지시:
- 과보호:
- 성취압력:
- 정서적 반응성:

2. 양육 스트레스 및 상호작용 가설
- 부모가 어려움을 느끼는 상황:
- 반복되는 양육 갈등 장면:
- 부모의 기대와 자녀 반응의 불일치:
- 양육자의 정서 소진 가능성:

3. 상담/코칭에서 확인할 내용
- 양육 신념:
- 훈육 방식:
- 부부/가족 내 양육 일관성:
- 부모 자신의 성장경험과 양육 반응의 연결:
`
        : `【PAT 부모양육태도검사 결과 요약】

PAT는 부모님의 양육태도와 자녀를 대하는 방식을 살펴보는 검사입니다.
이 결과는 부모를 평가하기 위한 것이 아니라, 현재 양육에서 도움이 되는 부분과 조율이 필요한 부분을 함께 찾기 위한 자료입니다.

1. 현재 양육태도의 특징
- 자녀를 지지하고 수용하는 방식:
- 자율성을 허용하는 정도:
- 규칙과 한계를 제시하는 방식:
- 훈육과 통제의 균형:

2. 부모-자녀 관계에서 나타날 수 있는 모습
`,
      strength: `【양육 강점】

- 자녀를 이해하려는 관심과 참여가 중요한 강점입니다.
- 부모가 자신의 양육 방식을 점검하려는 태도는 관계 변화의 출발점이 됩니다.
- 일상 속 작은 반응 변화만으로도 자녀의 안정감과 협력 행동이 달라질 수 있습니다.

구체적 강점:
1.
2.
3.
`,
      caution: `【주의점 및 조율이 필요한 부분】

- 부모의 기대 수준과 자녀의 발달 수준이 다를 경우 갈등이 커질 수 있습니다.
- 통제와 허용의 균형이 맞지 않으면 자녀가 혼란을 느낄 수 있습니다.
- 부모의 피로와 스트레스가 높을 때 일관된 양육 반응이 어려워질 수 있습니다.

확인할 부분:
1.
2.
3.
`,
      plan: `【양육코칭 제안】

1. 아이의 행동을 ‘문제’보다 ‘신호’로 바라보기
2. 짧고 구체적인 지시 사용하기
3. 제한은 분명하게, 감정은 따뜻하게 반응하기
4. 긍정 행동을 즉시 알아차리고 강화하기
5. 부모의 감정 조절과 회복 시간을 함께 확보하기
6. 가정 내 양육 원칙을 간단하게 정리하기
`
    },

    "KCDI": {
      summary: admin
        ? `【KCDI 아동발달검사 관리자용 해석】

1. 발달 영역별 결과
- 사회성:
- 자조행동:
- 대근육:
- 소근육:
- 표현언어:
- 언어이해:
- 글자/숫자:
- 정서/행동:
- 전체 발달 수준:

2. 관찰 및 면담에서 확인할 내용
- 또래 및 성인과의 상호작용:
- 일상생활 적응:
- 언어적 요구 표현:
- 감각/행동 특성:
- 놀이 수준:
- 정서조절 및 전환 어려움:

3. 발달 지원 필요성
- 추가 관찰 필요 영역:
- 부모 상담 포인트:
- 기관/어린이집 협력 사항:
- 전문기관 연계 필요성:
`
        : `【KCDI 아동발달검사 결과 요약】

KCDI는 자녀의 현재 발달 특성을 여러 영역에서 살펴보는 검사입니다.
이 결과는 아이의 발달을 단정하기 위한 것이 아니라, 아이에게 필요한 지원과 환경을 찾기 위한 자료입니다.

1. 발달 영역별 이해
- 사회성:
- 자조행동:
- 대근육:
- 소근육:
- 표현언어:
- 언어이해:
- 글자/숫자:
- 정서/행동:

2. 현재 아이에게 필요한 지원
`,
      strength: `【아이의 강점 및 자원】

- 아이가 잘하고 있는 영역을 먼저 확인하는 것이 중요합니다.
- 강점 영역은 부족한 영역을 돕는 발판이 될 수 있습니다.
- 발달은 속도의 차이가 있으므로 현재 수준에 맞춘 지원이 필요합니다.

강점으로 볼 수 있는 부분:
1.
2.
3.
`,
      caution: `【주의 깊게 볼 부분】

- 특정 발달 영역에서 지연 또는 어려움이 의심될 경우 지속적인 관찰이 필요합니다.
- 언어, 사회성, 정서조절, 일상생활 적응은 서로 연결되어 나타날 수 있습니다.
- 검사 결과만으로 단정하지 않고 실제 관찰과 부모 면담을 함께 고려해야 합니다.

추가 확인이 필요한 부분:
1.
2.
3.
`,
      plan: `【발달 지원 제안】

1. 아이의 현재 발달 수준에 맞춘 상호작용 제공
2. 짧고 반복적인 언어 자극 사용
3. 놀이 속에서 요구하기, 기다리기, 주고받기 연습
4. 성공 경험을 작게 나누어 제공하기
5. 가정과 기관이 같은 목표로 일관되게 지원하기
6. 필요 시 발달평가 또는 전문기관 상담 연계
`
    },

    "PAT · KCDI": {
      summary: admin
        ? `【PAT·KCDI 통합 관리자용 종합 소견】

1. PAT 부모양육태도 요약
- 지지/수용:
- 자율성 존중:
- 일관성:
- 통제/지시:
- 과보호/성취압력:
- 양육 스트레스:

2. KCDI 아동발달 요약
- 사회성:
- 자조행동:
- 대근육/소근육:
- 표현언어/언어이해:
- 인지/학습 기초:
- 정서/행동:

3. 부모-자녀 상호작용 가설
- 부모의 양육 반응과 자녀 발달 특성의 맞물림:
- 갈등 또는 어려움이 반복되는 장면:
- 자녀의 발달 신호를 부모가 해석하는 방식:
- 부모가 조율해야 할 기대 수준:

4. 코칭 우선순위
- 1순위:
- 2순위:
- 3순위:
`
        : `【부모-자녀 모두맘 통합 결과 요약】

부모-자녀 모두맘은 부모님의 양육태도(PAT)와 자녀의 발달 특성(KCDI)을 함께 살펴봅니다.
부모와 자녀를 따로 평가하기보다, 서로의 특성과 상호작용을 통합적으로 이해하는 데 목적이 있습니다.

1. 부모 양육태도 이해
- 부모가 자녀에게 반응하는 방식:
- 규칙과 자율성의 균형:
- 지지와 훈육의 균형:

2. 자녀 발달 특성 이해
- 현재 잘 발달하고 있는 영역:
- 지원이 필요한 영역:
- 일상에서 관찰할 부분:

3. 부모-자녀 상호작용
- 서로 잘 맞는 부분:
- 조율이 필요한 부분:
`,
      strength: `【가족의 강점 및 자원】

- 부모가 자녀를 이해하려는 관심과 참여가 중요한 자원입니다.
- 자녀의 발달 특성을 이해하면 양육 기대를 현실적으로 조율할 수 있습니다.
- 부모-자녀 관계는 작은 상호작용 변화만으로도 긍정적 변화가 나타날 수 있습니다.

강점:
1.
2.
3.
`,
      caution: `【주의점 및 조율이 필요한 부분】

- 자녀의 발달 속도와 부모의 기대 수준이 다를 때 갈등이 커질 수 있습니다.
- 아이의 행동을 의도적 문제로만 해석하면 상호작용이 경직될 수 있습니다.
- 부모의 피로와 양육 스트레스도 함께 살펴볼 필요가 있습니다.
- 발달 특성은 양육태도와 상호작용하며 나타날 수 있습니다.

조율이 필요한 부분:
1.
2.
3.
`,
      plan: `【통합 양육코칭 제안】

1. 아이의 발달 수준에 맞는 기대 설정
2. 부모의 지시를 짧고 구체적으로 조정
3. 긍정 행동 즉시 강화
4. 감정 이름 붙이기와 공감 반응 연습
5. 놀이 기반 상호작용 시간 확보
6. 가정과 기관의 일관된 지원 목표 설정
7. 필요 시 발달평가 또는 전문기관 연계
`
    },

    "MMPI-2": {
      summary: admin
        ? `【MMPI-2 관리자용 임상 해석】

1. 타당도 척도
- L:
- F:
- K:
- VRIN/TRIN:

2. 임상척도
- Hs:
- D:
- Hy:
- Pd:
- Mf:
- Pa:
- Pt:
- Sc:
- Ma:
- Si:

3. 코드타입 및 임상적 가설
4. 위험 신호
5. 면담에서 확인할 내용
`
        : `【MMPI-2 결과 요약】

MMPI-2는 현재 심리적 불편감, 정서 상태, 사고 및 대인관계 특성을 폭넓게 살펴보는 검사입니다.
결과는 진단을 확정하기 위한 것이 아니라, 상담에서 더 깊이 이해해야 할 영역을 찾는 데 활용됩니다.

1. 현재 정서 상태
2. 스트레스 반응
3. 대인관계 특성
4. 상담에서 다룰 주요 주제
`,
      strength: `【강점 및 보호요인】

- 자신의 어려움을 점검하고 도움을 요청하려는 시도 자체가 중요한 보호요인입니다.
- 검사 결과를 통해 막연한 어려움을 구체화할 수 있습니다.
`,
      caution: `【주의점】

- 높은 척도가 있다면 현재 심리적 부담이 크다는 신호일 수 있습니다.
- 위기 신호, 우울, 불안, 충동성, 현실검증력 관련 내용은 면담으로 추가 확인이 필요합니다.
`,
      plan: `【상담 제안】

1. 주호소와 검사 결과의 일치 여부 확인
2. 정서 안정화 및 위기 신호 점검
3. 반복되는 사고·감정·행동 패턴 탐색
4. 필요 시 정신건강의학과 또는 전문기관 연계
`
    },

    "SCT": {
      summary: `【SCT 문장완성검사 결과 요약】

SCT는 미완성 문장을 완성하는 방식으로 개인의 생각, 감정, 관계 경험, 자기개념을 탐색하는 검사입니다.

1. 자기이해 영역
2. 가족 및 관계 영역
3. 정서 표현
4. 미래 기대 및 욕구
`,
      strength: `【강점】

- 문장 속에 드러난 욕구와 자원을 확인할 수 있습니다.
- 말로 표현하기 어려운 감정이 간접적으로 드러날 수 있습니다.
`,
      caution: `【주의점】

- 반복적으로 나타나는 부정적 자기평가, 불안, 분노, 회피 표현은 상담에서 추가 탐색이 필요합니다.
`,
      plan: `【상담 제안】

- 핵심 문장 함께 살펴보기
- 반복되는 관계 주제 탐색
- 미표현 감정 언어화
- 자기이해와 자기수용 작업
`
    },

    "HTP": {
      summary: `【HTP 그림검사 결과 요약】

HTP는 집, 나무, 사람 그림을 통해 자기상, 정서 상태, 대인관계 경험을 탐색하는 투사적 검사입니다.

1. 집 그림: 환경과 안정감
2. 나무 그림: 자기 에너지와 성장감
3. 사람 그림: 자기상과 관계 표현
`,
      strength: `【강점】

- 언어로 표현하기 어려운 정서와 경험을 그림을 통해 탐색할 수 있습니다.
- 그림 해석은 면담과 함께 통합적으로 이해할 때 의미가 커집니다.
`,
      caution: `【주의점】

- 그림만으로 단정적 해석을 하지 않습니다.
- 크기, 압력, 생략, 위치 등은 면담 내용과 함께 확인해야 합니다.
`,
      plan: `【상담 제안】

- 그림에 담긴 느낌과 이야기 나누기
- 안전감, 자기상, 관계 경험 탐색
- 필요 시 SCT 또는 MMPI 등 추가검사와 통합
`
    },

    "통합": {
      summary: `【통합 심리검사 결과 요약】

여러 검사 결과와 상담 내용을 종합하여 현재 마음 상태, 주요 어려움, 강점, 상담 방향을 정리합니다.

1. 현재 주호소
2. 정서 및 스트레스 반응
3. 성격 및 기질 특성
4. 관계 패턴
5. 상담에서 우선적으로 다룰 주제
`,
      strength: `【강점 및 자원】

- 자기이해를 위한 동기
- 변화 가능성
- 관계적 자원
- 회복을 돕는 생활 자원
`,
      caution: `【주의점】

- 반복되는 정서적 어려움
- 대인관계 갈등 패턴
- 회피 또는 과잉노력
- 위기 신호 여부
`,
      plan: `【상담 계획】

1. 초기 안정화
2. 핵심 패턴 이해
3. 검사 해석상담
4. 일상 실천과제
5. 사후관리 및 재평가
`
    }
  };

  return templates[testType] || templates["통합"];
}




function modumamReportTemplate(testType){
  const common = {
    "TCI": {
      summary:`【TCI 기질 및 성격검사 종합 소견】

1. 기질 프로파일
- 자극추구(NS):
- 위험회피(HA):
- 사회적 민감성(RD):
- 인내력(P):

2. 성격 프로파일
- 자율성(SD):
- 연대감(C):
- 자기초월(ST):

3. 현재 마음의 특징
`,
      strength:`【강점 및 자원】

- 자신의 반응 패턴을 이해하려는 동기가 있습니다.
- 기질적 특성을 알면 스트레스 상황에서 스스로를 덜 비난하고 조절 전략을 찾을 수 있습니다.
- 성격 자원은 상담과 일상 실천을 통해 확장될 수 있습니다.
`,
      caution:`【주의점 및 어려움】

- 특정 기질이 높거나 낮을 때 스트레스 상황에서 반복되는 반응이 나타날 수 있습니다.
- 정서적 예민함, 회피, 충동성, 관계 피로감 등이 개인에 따라 다르게 나타날 수 있습니다.
`,
      plan:`【상담 제안】

1. 기질을 바꾸려 하기보다 이해하고 조율하기
2. 스트레스 상황에서 자동으로 나타나는 반응 알아차리기
3. 대인관계에서 반복되는 패턴 탐색하기
4. 생활 속 자기조절 전략 만들기
`
    },
    "STS": {
      summary:`【STS 6요인 기질검사 종합 소견】

1. 정서성:
2. 활동성:
3. 사회성:
4. 수줍음:
5. 주의집중:
6. 지속성:

기질은 좋고 나쁨이 아니라 환경과 만났을 때 어떻게 드러나는지를 이해하는 것이 중요합니다.
`,
      strength:`【강점】

- 타고난 기질을 이해하면 자신에게 맞는 환경과 대처 방식을 찾을 수 있습니다.
- 강점 기질은 학습, 관계, 일상 적응의 자원이 될 수 있습니다.
`,
      caution:`【주의점】

- 기질과 환경이 맞지 않을 때 피로감이나 갈등이 커질 수 있습니다.
- 특정 기질을 문제로 보기보다 조절과 환경 조율의 관점에서 이해해야 합니다.
`,
      plan:`【제안】

- 기질에 맞는 생활 리듬 만들기
- 정서 반응을 알아차리는 연습
- 관계 상황에서 무리하지 않는 자기표현 연습
`
    },
    "PAT": {
      summary:`【PAT 부모양육태도검사 종합 소견】

1. 양육태도 주요 프로파일
- 지지/수용:
- 자율성 존중:
- 일관성:
- 통제/지시:
- 과보호:
- 성취압력:
- 정서적 반응성:

2. 부모-자녀 관계에서 나타날 수 있는 모습
`,
      strength:`【양육 강점】

- 자녀를 이해하려는 관심과 참여가 중요한 강점입니다.
- 부모가 자신의 양육 방식을 점검하려는 태도는 관계 변화의 출발점이 됩니다.
- 일상 속 작은 반응 변화만으로도 자녀의 안정감과 협력 행동이 달라질 수 있습니다.
`,
      caution:`【주의점 및 조율이 필요한 부분】

- 부모의 기대 수준과 자녀의 발달 수준이 다를 경우 갈등이 커질 수 있습니다.
- 통제와 허용의 균형이 맞지 않으면 자녀가 혼란을 느낄 수 있습니다.
- 부모의 피로와 스트레스가 높을 때 일관된 양육 반응이 어려워질 수 있습니다.
`,
      plan:`【양육코칭 제안】

1. 아이의 행동을 ‘문제’보다 ‘신호’로 바라보기
2. 짧고 구체적인 지시 사용하기
3. 제한은 분명하게, 감정은 따뜻하게 반응하기
4. 긍정 행동을 즉시 알아차리고 강화하기
5. 부모의 감정 조절과 회복 시간을 함께 확보하기
`
    },
    "KCDI": {
      summary:`【KCDI 아동발달검사 종합 소견】

1. 발달 영역별 결과
- 사회성:
- 자조행동:
- 대근육:
- 소근육:
- 표현언어:
- 언어이해:
- 글자/숫자:
- 정서/행동:
- 전체 발달 수준:

2. 현재 아이에게 필요한 지원
`,
      strength:`【아이의 강점 및 자원】

- 아이가 잘하고 있는 영역을 먼저 확인하는 것이 중요합니다.
- 강점 영역은 부족한 영역을 돕는 발판이 될 수 있습니다.
- 발달은 속도의 차이가 있으므로 현재 수준에 맞춘 지원이 필요합니다.
`,
      caution:`【주의 깊게 볼 부분】

- 특정 발달 영역에서 지연 또는 어려움이 의심될 경우 지속적인 관찰이 필요합니다.
- 언어, 사회성, 정서조절, 일상생활 적응은 서로 연결되어 나타날 수 있습니다.
- 검사 결과만으로 단정하지 않고 실제 관찰과 부모 면담을 함께 고려해야 합니다.
`,
      plan:`【발달 지원 제안】

1. 아이의 현재 발달 수준에 맞춘 상호작용 제공
2. 짧고 반복적인 언어 자극 사용
3. 놀이 속에서 요구하기, 기다리기, 주고받기 연습
4. 성공 경험을 작게 나누어 제공하기
5. 가정과 기관이 같은 목표로 일관되게 지원하기
6. 필요 시 발달평가 또는 전문기관 상담 연계
`
    },
    "PAT · KCDI": {
      summary:`【PAT · KCDI 통합 종합 소견】

1. PAT 부모양육태도 요약
- 지지/수용:
- 자율성 존중:
- 일관성:
- 통제/지시:
- 과보호/성취압력:

2. KCDI 아동발달 요약
- 사회성:
- 자조행동:
- 대근육/소근육:
- 표현언어/언어이해:
- 정서/행동:

3. 부모-자녀 상호작용 가설
- 부모의 양육 반응과 자녀 발달 특성의 맞물림:
- 갈등 또는 어려움이 반복되는 장면:
- 자녀의 발달 신호를 부모가 해석하는 방식:
`,
      strength:`【가족의 강점 및 자원】

- 부모가 자녀를 이해하려는 관심과 참여가 중요한 자원입니다.
- 자녀의 발달 특성을 이해하면 양육 기대를 현실적으로 조율할 수 있습니다.
- 부모-자녀 관계는 작은 상호작용 변화만으로도 긍정적 변화가 나타날 수 있습니다.
`,
      caution:`【주의점 및 조율이 필요한 부분】

- 자녀의 발달 속도와 부모의 기대 수준이 다를 때 갈등이 커질 수 있습니다.
- 아이의 행동을 의도적 문제로만 해석하면 상호작용이 경직될 수 있습니다.
- 부모의 피로와 양육 스트레스도 함께 살펴볼 필요가 있습니다.
- 발달 특성은 양육태도와 상호작용하며 나타날 수 있습니다.
`,
      plan:`【통합 양육코칭 제안】

1. 아이의 발달 수준에 맞는 기대 설정
2. 부모의 지시를 짧고 구체적으로 조정
3. 긍정 행동 즉시 강화
4. 감정 이름 붙이기와 공감 반응 연습
5. 놀이 기반 상호작용 시간 확보
6. 가정과 기관의 일관된 지원 목표 설정
`
    },
    "MMPI-2": {
      summary:`【MMPI-2 종합 소견】

1. 타당도 척도
- L:
- F:
- K:
- VRIN/TRIN:

2. 임상척도
- Hs:
- D:
- Hy:
- Pd:
- Mf:
- Pa:
- Pt:
- Sc:
- Ma:
- Si:

3. 코드타입 및 임상적 가설
`,
      strength:`【강점 및 보호요인】

- 자신의 어려움을 점검하고 도움을 요청하려는 시도 자체가 중요한 보호요인입니다.
- 검사 결과를 통해 막연한 어려움을 구체화할 수 있습니다.
`,
      caution:`【주의점】

- 높은 척도가 있다면 현재 심리적 부담이 크다는 신호일 수 있습니다.
- 위기 신호, 우울, 불안, 충동성, 현실검증력 관련 내용은 면담으로 추가 확인이 필요합니다.
`,
      plan:`【상담 제안】

1. 주호소와 검사 결과의 일치 여부 확인
2. 정서 안정화 및 위기 신호 점검
3. 반복되는 사고·감정·행동 패턴 탐색
4. 필요 시 정신건강의학과 또는 전문기관 연계
`
    },
    "SCT": {
      summary:`【SCT 문장완성검사 종합 소견】

1. 자기이해 영역:
2. 가족 및 관계 영역:
3. 정서 표현:
4. 미래 기대 및 욕구:
`,
      strength:`【강점】

- 문장 속에 드러난 욕구와 자원을 확인할 수 있습니다.
- 말로 표현하기 어려운 감정이 간접적으로 드러날 수 있습니다.
`,
      caution:`【주의점】

- 반복적으로 나타나는 부정적 자기평가, 불안, 분노, 회피 표현은 상담에서 추가 탐색이 필요합니다.
`,
      plan:`【상담 제안】

- 핵심 문장 함께 살펴보기
- 반복되는 관계 주제 탐색
- 미표현 감정 언어화
- 자기이해와 자기수용 작업
`
    },
    "HTP": {
      summary:`【HTP 그림검사 종합 소견】

1. 집 그림: 환경과 안정감
2. 나무 그림: 자기 에너지와 성장감
3. 사람 그림: 자기상과 관계 표현
`,
      strength:`【강점】

- 언어로 표현하기 어려운 정서와 경험을 그림을 통해 탐색할 수 있습니다.
- 그림 해석은 면담과 함께 통합적으로 이해할 때 의미가 커집니다.
`,
      caution:`【주의점】

- 그림만으로 단정적 해석을 하지 않습니다.
- 크기, 압력, 생략, 위치 등은 면담 내용과 함께 확인해야 합니다.
`,
      plan:`【상담 제안】

- 그림에 담긴 느낌과 이야기 나누기
- 안전감, 자기상, 관계 경험 탐색
- 필요 시 SCT 또는 MMPI 등 추가검사와 통합
`
    },
    "통합": {
      summary:`【통합 심리검사 종합 소견】

1. 현재 주호소
2. 정서 및 스트레스 반응
3. 성격 및 기질 특성
4. 양육/관계 패턴
5. 상담에서 우선적으로 다룰 주제
`,
      strength:`【강점 및 자원】

- 자기이해를 위한 동기
- 변화 가능성
- 관계적 자원
- 회복을 돕는 생활 자원
`,
      caution:`【주의점】

- 반복되는 정서적 어려움
- 대인관계 갈등 패턴
- 회피 또는 과잉노력
- 위기 신호 여부
`,
      plan:`【상담 계획】

1. 초기 안정화
2. 핵심 패턴 이해
3. 검사 해석상담
4. 일상 실천과제
5. 사후관리 및 재평가
`
    }
  };
  return common[testType] || common["통합"];
}
function applyDetailedTemplate(){
  const t=modumamReportTemplate(state.reportForm.testType||"통합");
  state.reportForm.summary=t.summary||"";
  state.reportForm.strength=t.strength||"";
  state.reportForm.caution=t.caution||"";
  state.reportForm.plan=t.plan||"";
  render();
}

function reportView(){
  const editing=Boolean(state.reportEditingId);
  return layout(`<div class="grid grid-cols-1 xl:grid-cols-3 gap-6">
    <div class="bg-white rounded-[2rem] border border-slate-100 p-6 shadow-sm">
      <h2 class="text-xl font-extrabold mb-2">예약자 선택</h2><p class="text-sm text-slate-500 mb-5">예약자를 선택하면 보고서 정보가 자동 입력됩니다.</p>
      <div class="space-y-3 max-h-[720px] overflow-auto">${state.reservations.map(r=>`<button onclick="setReportFromReservation(${r.id})" class="w-full text-left bg-slate-50 hover:bg-emerald-50 border border-slate-100 hover:border-emerald-200 rounded-2xl p-4"><p class="font-extrabold">${esc(r.name)}님</p><p class="text-xs text-slate-500 mt-1">${esc(programBaseName(r.program))}</p><p class="text-xs text-slate-400 mt-1">${esc(r.date)} ${esc(r.time)}</p></button>`).join('')||empty('예약자가 없습니다.')}</div>
    </div>
    <form onsubmit="createReport(event)" class="xl:col-span-2 bg-white rounded-[2rem] border border-slate-100 p-6 shadow-sm space-y-4">
      <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"><div><p class="text-xs font-extrabold ${editing?'text-blue-600':'text-emerald-700'}">${editing?'EDIT MODE':'REPORT DRAFT'}</p><h2 class="text-xl font-extrabold">${editing?'결과보고서 수정':'관리자 결과보고서 작성'}</h2><p class="text-sm text-slate-500 mt-1">AI 초안은 참고자료이며 최종 저장·공개 전 임상심리사의 검토가 필요합니다.</p></div><div class="flex flex-wrap gap-2"><button type="button" onclick="applyDetailedTemplate()" class="bg-white border border-emerald-200 text-emerald-700 rounded-2xl px-4 py-3 text-sm font-extrabold">전문 템플릿</button><button type="button" onclick="generateReportDraft()" ${state.reportDraftLoading?'disabled':''} class="bg-purple-600 disabled:bg-purple-300 text-white rounded-2xl px-4 py-3 text-sm font-extrabold">${state.reportDraftLoading?'AI 작성 중...':'AI 초안 생성'}</button>${editing?'<button type="button" onclick="cancelReportEdit()" class="bg-slate-100 text-slate-600 rounded-2xl px-4 py-3 text-sm font-extrabold">수정 취소</button>':''}</div></div>
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-3"><input required value="${esc(state.reportForm.clientName)}" oninput="state.reportForm.clientName=this.value" placeholder="내담자 이름" class="border border-slate-200 rounded-2xl px-4 py-3 text-sm"/><input value="${esc(state.reportForm.phone)}" oninput="state.reportForm.phone=this.value" placeholder="연락처" class="border border-slate-200 rounded-2xl px-4 py-3 text-sm"/><input value="${esc(state.reportForm.program)}" oninput="state.reportForm.program=this.value" placeholder="프로그램명" class="border border-slate-200 rounded-2xl px-4 py-3 text-sm"/><select onchange="state.reportForm.testType=this.value" class="border border-slate-200 rounded-2xl px-4 py-3 text-sm">${['TCI','STS','PAT','KCDI','PAT · KCDI','MMPI-2','PAI','SCT','HTP','통합'].map(t=>`<option ${state.reportForm.testType===t?'selected':''}>${t}</option>`).join('')}</select></div>
      <div class="bg-amber-50 border border-amber-100 rounded-2xl p-4 text-sm text-amber-800 font-bold">AI가 작성한 내용은 진단이나 최종 소견이 아닙니다. 검사 원자료와 면담 내용을 확인하고 대표님이 직접 검토·수정한 뒤 공개해 주세요.</div>
      <input required value="${esc(state.reportForm.title)}" oninput="state.reportForm.title=this.value" placeholder="보고서 제목" class="w-full border border-slate-200 rounded-2xl px-4 py-3 text-sm"/>
      <textarea required rows="7" oninput="state.reportForm.summary=this.value" placeholder="종합 소견" class="w-full border border-slate-200 rounded-2xl px-4 py-3 text-sm">${esc(state.reportForm.summary)}</textarea>
      <textarea rows="5" oninput="state.reportForm.strength=this.value" placeholder="강점 및 자원" class="w-full border border-slate-200 rounded-2xl px-4 py-3 text-sm">${esc(state.reportForm.strength)}</textarea>
      <textarea rows="5" oninput="state.reportForm.caution=this.value" placeholder="주의점 및 어려움" class="w-full border border-slate-200 rounded-2xl px-4 py-3 text-sm">${esc(state.reportForm.caution)}</textarea>
      <textarea rows="5" oninput="state.reportForm.plan=this.value" placeholder="상담 계획 및 권장사항" class="w-full border border-slate-200 rounded-2xl px-4 py-3 text-sm">${esc(state.reportForm.plan)}</textarea>
      <button class="w-full ${editing?'bg-blue-700':'bg-slate-900'} text-white rounded-2xl py-4 text-sm font-extrabold">${editing?'수정본 저장 (새 버전)':'보고서 저장'}</button>
    </form>
    <div class="xl:col-span-3 bg-white rounded-[2rem] border border-slate-100 p-6 shadow-sm"><h2 class="text-xl font-extrabold mb-2">저장된 보고서</h2><p class="text-sm text-slate-500 mb-5">수정할 때마다 버전이 올라가며, 수정 후에는 회원 공개 승인이 자동 해제됩니다.</p><div class="grid grid-cols-1 xl:grid-cols-2 gap-4">${state.reports.map(r=>`<div class="border border-slate-100 rounded-2xl p-5 bg-slate-50"><div class="flex justify-between gap-3"><div><p class="font-extrabold">${esc(r.clientName)} · ${esc(r.testType)}</p><p class="text-xs text-slate-500 mt-1">${esc(r.title)}</p><p class="text-xs text-slate-400 mt-1">v${Number(r.version||1)} · ${esc(r.updatedAt||r.createdAt)}</p></div><span class="text-[11px] font-bold rounded-full px-3 py-1 h-fit ${r.approvedForClient?'bg-emerald-100 text-emerald-700':'bg-slate-200 text-slate-600'}">${r.approvedForClient?'회원 공개':'비공개'}</span></div><pre class="whitespace-pre-wrap text-xs bg-white rounded-xl p-3 mt-3 max-h-40 overflow-auto border border-slate-100">${esc(r.summary)}</pre><div class="grid grid-cols-2 sm:grid-cols-6 gap-2 mt-4"><button onclick="editReport(${r.id})" class="bg-blue-600 text-white rounded-xl py-2 text-xs font-bold">수정</button><button onclick="toggleReportApproval(${r.id})" class="${r.approvedForClient?'bg-slate-600':'bg-emerald-600'} text-white rounded-xl py-2 text-xs font-bold">${r.approvedForClient?'공개취소':'회원 공개'}</button><button onclick="copyReportGuide(${r.id})" class="bg-emerald-50 text-emerald-700 border border-emerald-100 rounded-xl py-2 text-xs font-bold">안내복사</button><button onclick="printReport(${r.id})" class="bg-orange-500 text-white rounded-xl py-2 text-xs font-extrabold">PDF/인쇄</button><button onclick='copyText(${JSON.stringify(r.summary||'')})' class="bg-white border border-slate-200 rounded-xl py-2 text-xs font-bold">요약복사</button><button onclick="deleteReport(${r.id})" class="bg-white border border-rose-200 text-rose-700 rounded-xl py-2 text-xs font-bold">삭제</button></div>${(r.versionHistory||[]).length?`<details class="mt-4"><summary class="cursor-pointer text-xs font-extrabold text-slate-600">이전 버전 ${(r.versionHistory||[]).length}개 보기</summary><div class="mt-2 space-y-2">${r.versionHistory.map((h,i)=>`<div class="flex items-center justify-between gap-3 bg-white border border-slate-100 rounded-xl p-3"><div><p class="text-xs font-bold">v${h.version||'?'} · ${esc(h.savedAt||'')}</p><p class="text-[11px] text-slate-400 line-clamp-1">${esc(h.title||'')}</p></div><button onclick="restoreReportVersion(${r.id},${i})" class="text-[11px] font-bold bg-slate-900 text-white rounded-lg px-3 py-2">복원</button></div>`).join('')}</div></details>`:''}</div>`).join('')||empty('저장된 보고서가 없습니다.')}</div></div>
  </div>`)
}
/* =========================================================
   V26 내담자 전자차트 고도화
   - 상담 전 30초 브리핑
   - 마음 체크인/검사/보고서/회기기록을 한 화면에서 연결
   - AI는 상담을 대신하지 않고 상담 준비자료만 제공합니다.
========================================================= */
function clientBriefing(c){
  const tests=[...new Set(c.reservations.flatMap(r=>requestedTests(r)))];
  const latestReservation=c.reservations[0]||{};
  const latestIntake=c.intakes[0]||null;
  const latestReport=c.reports[0]||null;
  const latestNote=c.notes[0]||null;
  const issues=[];
  if(latestIntake && (latestIntake.summary||latestIntake.concern)) issues.push('AI 마음 체크인 내용을 먼저 확인합니다.');
  if(tests.length) issues.push('신청/진행 검사: '+tests.slice(0,4).join(', '));
  if(latestReport) issues.push('최근 결과보고서: '+(latestReport.testType||latestReport.title||'보고서 확인'));
  if(latestNote) issues.push('최근 상담메모가 있습니다. 지난 회기 변화와 과제를 확인합니다.');
  if(!issues.length) issues.push('예약 기본정보와 주호소를 먼저 확인합니다.');
  const questions=[];
  questions.push('현재 가장 힘든 순간이 언제인지 확인하기');
  questions.push('최근 수면, 식욕, 신체 긴장 등 생활 변화를 확인하기');
  if(tests.some(t=>String(t).includes('TCI'))) questions.push('기질 특성과 현재 스트레스 반응의 연결 살펴보기');
  if(tests.some(t=>String(t).includes('MMPI'))) questions.push('정서 및 성격 특성과 주호소의 관련성 살펴보기');
  if(String(latestReservation.program||'').includes('부모')) questions.push('양육환경과 아동 발달 특성의 상호작용 확인하기');
  if(String(latestReservation.program||'').includes('부부')) questions.push('각자의 기질 차이와 의사소통 패턴 확인하기');
  return {issues,questions,goal:'현재 어려움을 검사 결과와 연결하여 이해하고, 첫 실천 목표를 함께 정리합니다.'};
}

function intakeSummaryBlock(c){
  if(!c.intakes.length) return '<p class="text-sm text-slate-400">연결된 AI 마음 체크인 기록이 없습니다.</p>';
  return c.intakes.map(i=>`<div class="bg-emerald-50 border border-emerald-100 rounded-2xl p-4 mb-3"><p class="text-xs font-extrabold text-emerald-700 mb-2">AI 마음 체크인</p><p class="text-xs text-slate-700 whitespace-pre-line">${esc(i.summary||i.concern||i.content||'요약 없음')}</p></div>`).join('');
}

function counselorBriefingBlock(c){
  const b=clientBriefing(c);
  return `<div class="bg-slate-900 text-white rounded-2xl p-5 mb-5">
    <div class="flex items-center justify-between gap-3 mb-3">
      <h3 class="text-sm font-extrabold">AI 상담 준비 브리핑</h3>
      <span class="text-[11px] font-bold bg-white/10 rounded-full px-3 py-1">상담 전 30초 확인</span>
    </div>
    <p class="text-xs text-slate-300 mb-4">AI는 상담을 대신하지 않고, 임상심리 전문가가 상담을 준비하는 참고자료를 정리합니다.</p>
    <div class="grid grid-cols-1 lg:grid-cols-3 gap-3">
      <div class="bg-white/10 rounded-2xl p-4"><p class="text-xs font-extrabold text-emerald-300 mb-2">오늘 확인할 내용</p>${b.issues.map(x=>`<p class="text-xs text-slate-100 mb-1">• ${esc(x)}</p>`).join('')}</div>
      <div class="bg-white/10 rounded-2xl p-4"><p class="text-xs font-extrabold text-emerald-300 mb-2">상담 질문 초안</p>${b.questions.slice(0,4).map(x=>`<p class="text-xs text-slate-100 mb-1">• ${esc(x)}</p>`).join('')}</div>
      <div class="bg-white/10 rounded-2xl p-4"><p class="text-xs font-extrabold text-emerald-300 mb-2">오늘의 상담목표</p><p class="text-xs text-slate-100 whitespace-pre-line">${esc(b.goal)}</p></div>
    </div>
  </div>`;
}

function parseStructuredSessionMemo(memo=''){
  const text=String(memo||'');
  const pick=(label)=>{
    const m=text.match(new RegExp(label+':\\s*([\\s\\S]*?)(?=\\n(?:주제|정서/반응|개입/상담내용|변화/관찰|다음 회기/과제):|$)'));
    return m?m[1].trim():'';
  };
  return {
    theme:pick('주제'), emotion:pick('정서/반응'), intervention:pick('개입/상담내용'),
    change:pick('변화/관찰'), next:pick('다음 회기/과제')
  };
}

function generateSessionAiSummary(k,noteId){
  const sk='modumam_counseling_notes_'+k;
  const notes=load(sk,[]);
  const idx=notes.findIndex(n=>String(n.id)===String(noteId));
  if(idx<0) return;
  const n=notes[idx];
  const d=parseStructuredSessionMemo(n.memo||'');
  const core=[d.theme,d.emotion,d.change].filter(Boolean).join(' / ') || '회기 핵심 내용이 입력되었습니다.';
  const summary=[
    d.theme?`이번 회기에서는 ${d.theme}을 중심으로 이야기를 나누었습니다.`:'',
    d.emotion?`내담자는 ${d.emotion}의 정서와 반응을 보였습니다.`:'',
    d.intervention?`상담에서는 ${d.intervention}을 확인하고 다루었습니다.`:'',
    d.change?`회기 중 확인된 변화와 관찰점은 ${d.change}입니다.`:''
  ].filter(Boolean).join(' ');
  const nextQuestions=[];
  if(d.change) nextQuestions.push('지난 회기 이후 확인된 변화가 일상에서 어떻게 이어졌는지 살펴봅니다.');
  if(d.next) nextQuestions.push(d.next);
  nextQuestions.push('최근 가장 힘들었던 순간과 조금 덜 힘들었던 순간의 차이를 확인합니다.');
  nextQuestions.push('현재 사용하고 있는 대처방법 중 도움이 된 것과 부담이 된 것을 구분합니다.');
  n.aiSummary=summary||core;
  n.aiNextQuestions=nextQuestions.slice(0,3).join('\n');
  n.aiCounselorFocus=[
    '내담자의 표현을 사실과 해석으로 구분해 확인합니다.',
    d.emotion?'주요 정서의 강도와 지속시간, 일상 기능 영향을 구체적으로 확인합니다.':'정서 상태와 생활 변화를 구체적으로 확인합니다.',
    '위험 신호가 의심되면 자해·자살사고 및 안전 여부를 직접 확인합니다.'
  ].join('\n');
  n.aiGeneratedAt=new Date().toLocaleString();
  notes[idx]=n;
  save(sk,notes);
  alert('AI 회기요약과 다음 회기 제안이 생성되었습니다. 상담자가 사실관계를 확인해 주세요.');
  render();
}

function copySessionAiSummary(k,noteId){
  const n=load('modumam_counseling_notes_'+k,[]).find(x=>String(x.id)===String(noteId));
  if(!n||!n.aiSummary){alert('먼저 AI 회기요약을 생성해 주세요.');return;}
  copyText(`[AI 회기요약]\n${n.aiSummary}\n\n[다음 회기 확인 질문]\n${n.aiNextQuestions||''}\n\n[상담자 확인 포인트]\n${n.aiCounselorFocus||''}`);
}

function saveStructuredSession(k){
  const date=document.getElementById('session-date-'+k)?.value||new Date().toISOString().slice(0,10);
  const theme=document.getElementById('session-theme-'+k)?.value||'';
  const emotion=document.getElementById('session-emotion-'+k)?.value||'';
  const intervention=document.getElementById('session-intervention-'+k)?.value||'';
  const change=document.getElementById('session-change-'+k)?.value||'';
  const next=document.getElementById('session-next-'+k)?.value||'';
  if(!theme.trim()&&!emotion.trim()&&!intervention.trim()&&!change.trim()){alert('회기 핵심 내용을 한 가지 이상 입력해 주세요.');return;}
  const memo=`[회기기록]\n주제: ${theme}\n정서/반응: ${emotion}\n개입/상담내용: ${intervention}\n변화/관찰: ${change}\n다음 회기/과제: ${next}`;
  const sk='modumam_counseling_notes_'+k;
  const notes=load(sk,[]);
  notes.unshift({id:Date.now(),date,memo,createdAt:new Date().toLocaleString(),type:'structured-session'});
  save(sk,notes);
  alert('회기기록이 전자차트에 저장되었습니다.');
  render();
}

function saveClientProfileMemo(k){
  const memo=document.getElementById('client-profile-memo-'+k)?.value||'';
  save('modumam_client_profile_'+k,{memo,updatedAt:new Date().toLocaleString()});
  alert('회원 프로필 메모를 저장했습니다.');
  render();
}
function setMemberSearch(v){state.memberSearch=v;render()}
function setMemberStatus(v){state.memberStatus=v;render()}
function findMemberChart(){
  const input=document.getElementById('member-chart-search');
  const value=String(input?.value||'').trim();
  if(!value){alert('내담자 이름·연락처·사례번호를 입력해 주세요.');input?.focus();return;}
  state.memberSearch=value;
  state.selectedClientKey='';
  render();
}
function clearMemberChartSearch(){state.memberSearch='';state.selectedClientKey='';render();}
window.findMemberChart=findMemberChart;
window.clearMemberChartSearch=clearMemberChartSearch;

function openClientChart(key,tab='profile'){
  state.selectedClientKey=String(key||'');
  state.memberTab=tab;
  render();
  setTimeout(()=>document.getElementById(`${tab}-${key}`)?.scrollIntoView({behavior:'smooth',block:'start'}),30);
}
function closeClientChart(){state.selectedClientKey='';state.memberTab='profile';render()}
function setMemberTab(tab,key){state.memberTab=tab;render();setTimeout(()=>document.getElementById(`${tab}-${key}`)?.scrollIntoView({behavior:'smooth',block:'start'}),30)}
function clientLatestStatus(c){return c.reservations[0]?.status||'기록없음'}

/* =========================================================
   V28 회원 상담 타임라인
   - 예약, 상태변경, 일정변경, 검사링크, AI 체크인,
     검사결과, 보고서, 회기기록을 시간순으로 통합 표시
========================================================= */
function timelineDateValue(value){
  if(!value) return 0;
  const raw=String(value).trim();
  const normalized=raw.replace(/\./g,'-').replace(/년|월/g,'-').replace(/일/g,'').replace(/오전|오후/g,'').trim();
  const t=Date.parse(normalized);
  return Number.isFinite(t)?t:0;
}
function timelineDisplayDate(value){
  if(!value) return '날짜 미상';
  const t=timelineDateValue(value);
  if(!t) return esc(String(value));
  return new Date(t).toLocaleString('ko-KR',{year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'});
}
function buildClientTimeline(c){
  const items=[];
  const push=(date,type,title,detail='',tone='slate',meta={})=>items.push({date,dateValue:timelineDateValue(date),type,title,detail,tone,...meta});
  (c.reservations||[]).forEach(r=>{
    push(r.createdAt||r.date,'예약',`${r.program||'상담'} 예약 신청`,`${r.date||''} ${r.time||''} · ${r.type||''}`,'blue');
    const statusHistory=Array.isArray(r.statusHistory)?r.statusHistory:[];
    statusHistory.forEach(h=>push(h.changedAt||h.createdAt,'진행상태',`예약 상태: ${h.after||h.to||h.status||r.status||''}`,h.before||h.from?`${h.before||h.from} → ${h.after||h.to||h.status||''}`:'','emerald'));
    if(!statusHistory.length && r.status) push(r.updatedAt||r.createdAt||r.date,'진행상태',`현재 상태: ${r.status}`,'','emerald');
    const scheduleHistory=Array.isArray(r.scheduleHistory)?r.scheduleHistory:(Array.isArray(r.scheduleChangeHistory)?r.scheduleChangeHistory:[]);
    scheduleHistory.forEach(h=>{
      const beforeObj=h.before||{};
      const afterObj=h.after||{};
      const before=[beforeObj.date||h.beforeDate,beforeObj.time||h.beforeTime,beforeObj.type||h.beforeType].filter(Boolean).join(' ');
      const after=[afterObj.date||h.afterDate,afterObj.time||h.afterTime,afterObj.type||h.afterType].filter(Boolean).join(' ');
      push(h.changedAt||h.createdAt,'일정변경','상담 일정·방식 변경',`${before||'이전 정보 없음'} → ${after||'변경 정보 없음'}`,'orange');
    });
    Object.entries(r.testLinks||{}).forEach(([testName,url])=>{
      if(!String(url||'').trim()) return;
      push(r.testLinksUpdatedAt||r.updatedAt||r.createdAt,'검사링크',`${testName||'심리검사'} 링크 등록`,String(url),'purple');
    });
    if(r.aiResultCounselingEnabled) push(r.aiResultCounselingEnabledAt||r.updatedAt||r.createdAt,'AI상담','AI 결과상담 활성화',r.aiResultCounselingCompletedAt?`완료: ${r.aiResultCounselingCompletedAt}`:'이용 가능','purple');
  });
  (c.intakes||[]).forEach(i=>push(i.createdAt||i.date,'AI체크인','AI 마음 체크인 기록',i.summary||i.concern||i.content||'요약 없음','emerald'));
  (c.uploads||[]).forEach(u=>push(u.createdAt||u.updatedAt,'검사결과',`${u.testType||'심리검사'} 결과 업로드`,`${u.fileName||''}${u.visibleToClient?' · 회원 공개':' · 관리자 전용'}`,'indigo'));
  (c.reports||[]).forEach(r=>push(r.updatedAt||r.createdAt,'보고서',`${r.testType||''} 결과보고서 ${r.approvedForClient?'공개':'저장'}`,`${r.title||''} · v${Number(r.version||1)}`,'orange'));
  (c.notes||[]).forEach(n=>push(n.createdAt||n.date,'회기기록',n.goal||n.theme||'상담 회기기록',n.memo||n.content||'','slate'));
  (c.aiResultRecords||[]).forEach(record=>push(record.completedAt||record.date,'AI 결과상담',`${record.reportTitle||'종합보고서'} 결과상담 완료`,record.summary||`대화 ${Number(record.messageCount||0)}개`,'purple'));
  if(c.profileMemo?.updatedAt) push(c.profileMemo.updatedAt,'관리메모','회원 프로필 메모 수정',c.profileMemo.memo||'','amber');
  return items.sort((a,b)=>b.dateValue-a.dateValue);
}
function clientTimelineBlock(c){
  const items=buildClientTimeline(c);
  const tone={
    blue:'bg-blue-100 text-blue-700 border-blue-200',emerald:'bg-emerald-100 text-emerald-700 border-emerald-200',orange:'bg-orange-100 text-orange-700 border-orange-200',purple:'bg-purple-100 text-purple-700 border-purple-200',indigo:'bg-indigo-100 text-indigo-700 border-indigo-200',amber:'bg-amber-100 text-amber-700 border-amber-200',slate:'bg-slate-100 text-slate-700 border-slate-200'
  };
  return `<div class="bg-white rounded-2xl border border-slate-100 p-5 mb-5">
    <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
      <div><h3 class="text-sm font-extrabold">상담 타임라인</h3><p class="text-xs text-slate-500 mt-1">예약부터 검사·보고서·상담기록까지 시간순으로 확인합니다.</p></div>
      <span class="text-[11px] font-extrabold bg-slate-100 text-slate-600 rounded-full px-3 py-1">총 ${items.length}건</span>
    </div>
    <div class="relative max-h-[420px] overflow-auto pr-1">
      ${items.length?`<div class="absolute left-[11px] top-2 bottom-2 w-px bg-slate-200"></div><div class="space-y-3">${items.map((it,idx)=>`<div class="relative pl-8"><span class="absolute left-0 top-1.5 w-6 h-6 rounded-full border flex items-center justify-center text-[10px] font-extrabold ${tone[it.tone]||tone.slate}">${items.length-idx}</span><div class="bg-slate-50 border border-slate-100 rounded-2xl p-4"><div class="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2"><div><p class="text-[11px] font-extrabold text-slate-400">${esc(it.type)}</p><p class="text-sm font-extrabold text-slate-800 mt-1">${esc(it.title)}</p></div><p class="text-[11px] text-slate-400 shrink-0">${timelineDisplayDate(it.date)}</p></div>${it.detail?`<p class="text-xs text-slate-600 whitespace-pre-line mt-2 line-clamp-4">${esc(it.detail)}</p>`:''}</div></div>`).join('')}</div>`:`<p class="text-sm text-slate-400">아직 타임라인에 표시할 기록이 없습니다.</p>`}
    </div>
  </div>`;
}

function memberChartSessionRows(c){
  const rows=[];
  const seen=new Set();
  const push=(item,source='상담일지')=>{
    const content=String(item.memo||item.content||item.intervention||'').trim();
    const key=String(item.id||`${item.date||''}-${content.slice(0,80)}`);
    if(seen.has(key))return;
    seen.add(key);
    const parsed=parseStructuredSessionMemo(content);
    rows.push({
      id:key,
      date:item.date||item.sessionDate||item.createdAt||'',
      sessionNumber:Number(item.sessionNumber||item.round||0),
      method:item.method||item.counselingMethod||'',
      referral:item.referralReason||item.complaint||item.theme||parsed.theme||'',
      goal:item.goal||item.sessionGoal||parsed.theme||'',
      content:item.sessionContent||content||parsed.intervention||'',
      result:item.result||item.change||parsed.change||item.aiSummary||'',
      next:item.next||item.nextSession||parsed.next||'',
      source
    });
  };
  (c.notes||[]).forEach(x=>push(x,'상담일지'));
  (c.reservations||[]).forEach(r=>{
    const caseId=caseIdFromReservation(r);
    load('modumam_case_sessions_'+caseId,[]).forEach(x=>push({...x,method:x.method||r.type},x.sourceLabel||'회기기록'));
  });
  return rows.sort((a,b)=>timelineDateValue(b.date)-timelineDateValue(a.date));
}

function memberReservationSection(c){
  const rows=(c.reservations||[]).slice().sort((a,b)=>`${b.date||''} ${b.time||''}`.localeCompare(`${a.date||''} ${a.time||''}`));
  return `<section class="rounded-[2rem] border border-slate-100 bg-white p-5 shadow-sm sm:p-6">
    <div class="mb-5 flex items-center justify-between gap-3"><div><p class="text-xs font-extrabold text-emerald-700">RESERVATION WORKFLOW</p><h3 class="mt-1 text-lg font-extrabold">예약 진행상태 정리</h3></div><span class="rounded-full bg-emerald-50 px-3 py-1 text-xs font-extrabold text-emerald-700">${rows.length}건</span></div>
    <div class="space-y-4">${rows.length?rows.map(r=>`<article class="rounded-2xl border border-slate-100 bg-slate-50 p-4"><div class="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between"><div class="min-w-0 flex-1"><div class="flex flex-wrap items-center gap-2"><span class="rounded-full px-3 py-1 text-[11px] font-extrabold ${statusClass(r.status)}">${esc(normalizeStatus(r.status))}</span><p class="text-sm font-extrabold">${esc(programBaseName(r.program))}</p></div><div class="mt-3 grid grid-cols-2 gap-3 lg:grid-cols-4"><div><p class="text-[10px] font-bold text-slate-400">예약일정</p><p class="mt-1 text-xs font-extrabold">${esc(r.date||'미정')} ${esc(r.time||'')}</p></div><div><p class="text-[10px] font-bold text-slate-400">검사명</p><p class="mt-1 text-xs font-extrabold">${esc(requestedTests(r).map(shortTestName).join(', ')||'없음')}</p></div><div><p class="text-[10px] font-bold text-slate-400">상담방법</p><p class="mt-1 text-xs font-extrabold">${esc(r.type||'미정')}</p></div><div><p class="text-[10px] font-bold text-slate-400">최근 변경</p><p class="mt-1 text-xs font-extrabold">${esc(r.statusUpdatedAt||r.scheduleUpdatedAt||r.updatedAt||'기록 없음')}</p></div></div></div><button onclick="setMenu('reservation')" class="shrink-0 rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-extrabold">예약관리</button></div><div class="mt-4">${operationPipeline(r)}</div></article>`).join(''):'<p class="text-sm text-slate-400">예약 기록이 없습니다.</p>'}</div>
  </section>`;
}

function assessmentDraftForReservation(reservationId){
  return (state.assessmentReportDrafts||[]).find(x=>String(x.reservationId)===String(reservationId))||null;
}
function assessmentDraftsForClient(c){
  const ids=new Set((c.reservations||[]).map(r=>String(r.id)));
  return (state.assessmentReportDrafts||[]).filter(x=>ids.has(String(x.reservationId)));
}
function openAssessmentDraftFromChart(reservationId){
  const draft=assessmentDraftForReservation(reservationId);
  if(!draft){alert('승인 대기 보고서를 찾지 못했습니다.');return;}
  state.assessmentReservationId=String(reservationId);
  state.integratedReportDraft={...draft};
  state.menu='interpretation';
  render();
  setTimeout(()=>document.getElementById('integrated-report-revision-comment')?.focus(),100);
}
function printAssessmentDraft(reservationId,client=false){
  const draft=assessmentDraftForReservation(reservationId);
  const reservation=state.reservations.find(r=>String(r.id)===String(reservationId));
  if(!draft||!reservation){alert('보고서 초안을 찾지 못했습니다.');return;}
  const data=client?(draft.clientReport||{}):draft;
  const sections={
    subtitle:data.subtitle||'',evaluationOverview:data.evaluationOverview||'',testGuide:data.testGuide||'',keyMessage:data.keyMessage||'',
    emotionalProfile:data.emotionalProfile||'',thinkingStyle:data.thinkingStyle||'',relationshipStyle:data.relationshipStyle||'',stressRecovery:data.stressRecovery||'',
    strengthsResources:data.strengthsResources||'',integratedUnderstanding:data.integratedUnderstanding||'',currentSignals:data.currentSignals||'',
    psychologicalSuggestions:data.psychologicalSuggestions||'',professionalSummary:data.professionalSummary||'',disclaimer:data.disclaimer||''
  };
  const temp={id:'draft-'+reservationId,title:client?(data.title||'모두의 마음연구소 심리보고서'):'통합 심리평가보고서',clientName:reservation.name,
    program:programBaseName(reservation.program),tests:draft.tests||requestedTests(reservation),updatedAt:draft.updatedAt||draft.generatedAt||'',sections};
  const old=state.reports;
  state.reports=[temp,...old];
  printReport(temp.id);
  state.reports=old;
}
function approveAssessmentDraftFromChart(reservationId){
  const draft=assessmentDraftForReservation(reservationId);
  if(!draft){alert('승인 대기 보고서를 찾지 못했습니다.');return;}
  if(!confirm('두 보고서를 최종 승인하고 내담자에게 검사결과지와 심리보고서를 공개할까요?'))return;
  state.assessmentReservationId=String(reservationId);
  state.integratedReportDraft={...draft};
  saveIntegratedAssessmentReport(true);
}


function approveAssessmentReportsFromChart(reservationId){
  const reservation=(state.reservations||[]).find(r=>String(r.id)===String(reservationId));
  if(!reservation){alert('예약 정보를 찾지 못했습니다.');return;}
  const integrated=(state.reports||[]).find(r=>String(r.reservationId)===String(reservationId)&&r.integratedAssessmentReport);
  const client=(state.reports||[]).find(r=>String(r.reservationId)===String(reservationId)&&r.assessmentReport&&!r.integratedAssessmentReport);
  if(!integrated||!client){alert('통합 심리평가보고서와 모두의 마음연구소 심리보고서가 모두 생성되어야 승인할 수 있습니다.');return;}
  if(!confirm('두 보고서를 최종 승인하고 내담자에게 심리검사 결과지와 심리보고서를 공개할까요?'))return;
  const now=new Date().toLocaleString('ko-KR');
  state.reports=(state.reports||[]).map(report=>{
    if(String(report.id)===String(integrated.id)){
      return {...report,reviewed:true,approved:true,status:'상담자 승인 완료',reviewStatus:'approved',reviewedAt:report.reviewedAt||now,approvedAt:now,reviewedBy:'상담자',approvedForClient:false,updatedAt:now};
    }
    if(String(report.id)===String(client.id)){
      return {...report,reviewed:true,approved:true,status:'상담자 승인 완료',reviewStatus:'approved',reviewedAt:report.reviewedAt||now,approvedAt:now,reviewedBy:'상담자',approvedForClient:true,publishedAt:now,updatedAt:now};
    }
    return report;
  });
  save('modumam_reports',state.reports);
  state.assessmentReportDrafts=(state.assessmentReportDrafts||[]).filter(x=>String(x.reservationId)!==String(reservationId));
  save('modumam_assessment_report_drafts',state.assessmentReportDrafts);
  updateReservation(reservationId,{
    integratedAssessmentReportStatus:'상담자 승인 완료',
    integratedAssessmentReportId:integrated.id,
    assessmentReportStatus:'상담자 승인 완료',
    assessmentReportId:client.id,
    assessmentReportApprovedAt:now,
    assessmentReportPublishedAt:now,
    aiResultCounselingEnabled:true
  });
  alert('최종 승인되었습니다. 내담자는 나의 마음기록에서 검사결과지와 심리보고서를 열람할 수 있습니다.');
  render();
}

function openAssessmentCenterForReport(reportId){
  const report=(state.reports||[]).find(r=>String(r.id)===String(reportId));
  if(!report){alert('보고서를 찾지 못했습니다.');return;}
  const reservationId=report.reservationId||report.bookingId||report.sourceReservationId;
  if(reservationId){
    state.assessmentReservationId=String(reservationId);
  }else{
    const match=(state.reservations||[]).find(r=>
      String(r.name||'').trim()===String(report.clientName||report.name||'').trim() &&
      (!report.program || programBaseName(r.program)===programBaseName(report.program))
    );
    if(match) state.assessmentReservationId=String(match.id);
  }
  state.menu='interpretation';
  render();
}

function memberAssessmentSection(c){
  const analyses=(state.assessmentAnalyses||[]).filter(a=>String(a.clientName||'').trim()===String(c.name||'').trim() || (a.phone&&clientKey('',a.phone)===c.key));
  const approvedAnalyses=analyses.filter(a=>a.reviewed||a.status==='상담자 검토 완료'||a.status==='상담자 승인 완료');
  const reports=(c.reports||[]).filter(r=>r.integratedAssessmentReport||r.assessmentReport||String(r.title||'').includes('심리보고서'));
  const drafts=assessmentDraftsForClient(c);
  const integratedReports=reports.filter(r=>r.integratedAssessmentReport);
  const clientReports=reports.filter(r=>r.assessmentReport&&!r.integratedAssessmentReport);
  const latestIntegrated=integratedReports.slice().sort((a,b)=>timelineDateValue(b.approvedAt||b.updatedAt||b.createdAt)-timelineDateValue(a.approvedAt||a.updatedAt||a.createdAt))[0]||null;
  const latestClient=clientReports.slice().sort((a,b)=>timelineDateValue(b.approvedAt||b.updatedAt||b.createdAt)-timelineDateValue(a.approvedAt||a.updatedAt||a.createdAt))[0]||null;
  const approvalReservationId=latestIntegrated?.reservationId||latestClient?.reservationId||'';
  const fullyApproved=Boolean(latestIntegrated?.approved&&latestClient?.approved&&latestClient?.approvedForClient);
  return `<section class="rounded-[2rem] border border-slate-100 bg-white p-5 shadow-sm sm:p-6">
    <div class="mb-5 flex items-center justify-between gap-3"><div><p class="text-xs font-extrabold text-indigo-600">PSYCHOLOGICAL ASSESSMENT</p><h3 class="mt-1 text-lg font-extrabold">심리평가</h3></div><div class="flex items-center gap-2"><button onclick="setMenu('interpretation')" class="rounded-xl border border-indigo-200 bg-white px-4 py-2 text-xs font-extrabold text-indigo-700">심리평가센터</button><span class="rounded-full bg-indigo-50 px-3 py-1 text-xs font-extrabold text-indigo-700">${reports.length+drafts.length}건</span></div></div>
    ${drafts.length?`<div class="mb-5 space-y-3">${drafts.map(d=>{const r=(c.reservations||[]).find(x=>String(x.id)===String(d.reservationId))||{};return `<div class="rounded-2xl border-2 border-amber-200 bg-amber-50 p-5"><div class="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between"><div><div class="flex flex-wrap items-center gap-2"><p class="text-sm font-extrabold text-amber-950">승인 대기 보고서</p><span class="rounded-full bg-white px-3 py-1 text-[10px] font-extrabold text-amber-700">AI 생성 완료 · 승인 전</span></div><p class="mt-2 text-xs text-amber-800">${esc(r.date||'')} ${esc(r.time||'')} · ${esc(programBaseName(r.program)||'심리검사')} · ${esc((d.tests||requestedTests(r)).join(', '))}</p></div><div class="flex flex-wrap gap-2"><button onclick="printAssessmentDraft('${d.reservationId}',false)" class="rounded-xl border border-amber-200 bg-white px-3 py-2 text-xs font-extrabold text-amber-800">통합보고서 보기</button><button onclick="printAssessmentDraft('${d.reservationId}',true)" class="rounded-xl border border-amber-200 bg-white px-3 py-2 text-xs font-extrabold text-amber-800">심리보고서 보기</button><button onclick="approveAssessmentDraftFromChart('${d.reservationId}')" class="rounded-xl bg-emerald-600 px-4 py-2 text-xs font-extrabold text-white">최종 승인 및 내담자 공개</button></div></div></div>`}).join('')}</div>`:''}
    <div class="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <div class="rounded-2xl border border-indigo-100 bg-indigo-50/50 p-4"><div class="flex items-center justify-between gap-3"><div><p class="text-[11px] font-extrabold text-indigo-600">상담자 전용</p><h4 class="mt-1 text-sm font-extrabold text-slate-900">통합 심리평가보고서</h4></div><span class="rounded-full bg-white px-3 py-1 text-[10px] font-bold text-indigo-700">${integratedReports.length}건</span></div><div class="mt-4 space-y-2">${integratedReports.length?integratedReports.map(r=>`<div class="flex flex-col gap-2 rounded-xl border border-indigo-100 bg-white p-3 sm:flex-row sm:items-center sm:justify-between"><div><p class="text-xs font-extrabold">${esc(r.title||'통합 심리평가보고서')}</p><p class="mt-1 text-[10px] text-slate-400">${esc(r.approvedAt||r.updatedAt||r.createdAt||'')} · 승인완료</p></div><div class="flex flex-wrap gap-2"><button onclick="printReport(${r.id})" class="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold">보기·인쇄</button><span class="rounded-xl bg-emerald-50 px-3 py-2 text-xs font-extrabold text-emerald-700">승인완료</span></div></div>`).join(''):'<p class="text-xs text-slate-400">승인된 통합보고서가 없습니다.</p>'}</div></div>
      <div class="rounded-2xl border border-emerald-100 bg-emerald-50/50 p-4"><div class="flex items-center justify-between gap-3"><div><p class="text-[11px] font-extrabold text-emerald-700">내담자 제공</p><h4 class="mt-1 text-sm font-extrabold text-slate-900">모두의 마음연구소 심리보고서</h4></div><span class="rounded-full bg-white px-3 py-1 text-[10px] font-bold text-emerald-700">${clientReports.length}건</span></div><div class="mt-4 space-y-2">${clientReports.length?clientReports.map(r=>`<div class="flex flex-col gap-2 rounded-xl border border-emerald-100 bg-white p-3 sm:flex-row sm:items-center sm:justify-between"><div><p class="text-xs font-extrabold">${esc(r.title||'모두의 마음연구소 심리보고서')}</p><p class="mt-1 text-[10px] text-slate-400">${esc(r.approvedAt||r.updatedAt||r.createdAt||'')} · ${r.approvedForClient?'내담자 공개':'공개 전'}</p></div><div class="flex flex-wrap gap-2"><button onclick="printReport(${r.id})" class="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold">보기·인쇄</button><span class="rounded-xl ${r.approvedForClient?'bg-emerald-50 text-emerald-700':'bg-amber-50 text-amber-700'} px-3 py-2 text-xs font-extrabold">${r.approvedForClient?'승인완료':'승인대기'}</span></div></div>`).join(''):'<p class="text-xs text-slate-400">승인된 심리보고서가 없습니다.</p>'}</div></div>
    </div>
    ${approvalReservationId?`<div class="mt-5 border-t border-slate-100 pt-5">${fullyApproved?`<div class="flex items-center justify-center gap-2 rounded-2xl bg-emerald-50 px-5 py-4 text-sm font-extrabold text-emerald-700"><span>✓</span><span>최종 승인 완료 · 내담자 공개 중</span></div>`:`<button onclick="approveAssessmentReportsFromChart('${approvalReservationId}')" class="w-full rounded-2xl bg-emerald-600 px-6 py-4 text-sm font-extrabold text-white shadow-sm hover:bg-emerald-700">최종 승인 및 내담자 공개</button>`}</div>`:''}
    ${!drafts.length&&!reports.length?`<button onclick="setMenu('interpretation')" class="mt-4 w-full rounded-xl border border-indigo-200 bg-white py-2.5 text-xs font-extrabold text-indigo-700">심리평가센터에서 보고서 생성</button>`:''}
  </section>`;
}

function memberAiCounselingSection(c){
  const rows=c.aiResultRecords||[];
  return `<section class="rounded-[2rem] border border-purple-100 bg-white p-5 shadow-sm sm:p-6"><div class="mb-5 flex items-center justify-between gap-3"><div><p class="text-xs font-extrabold text-purple-600">AI RESULT COUNSELING</p><h3 class="mt-1 text-lg font-extrabold">AI 결과상담기록</h3></div><span class="rounded-full bg-purple-50 px-3 py-1 text-xs font-extrabold text-purple-700">${rows.length}건</span></div><div class="space-y-3">${rows.length?rows.map(record=>`<details class="rounded-2xl border border-purple-100 bg-purple-50 p-4"><summary class="cursor-pointer list-none"><div class="flex flex-wrap items-center justify-between gap-3"><div><p class="text-sm font-extrabold text-purple-950">${esc(record.reportTitle||'AI 결과상담')}</p><p class="mt-1 text-[11px] text-purple-500">${esc(record.completedAt||record.date||'날짜 기록 없음')} · 대화 ${Number(record.messageCount||0)}개</p></div><span class="rounded-full bg-white px-3 py-1 text-[10px] font-bold text-amber-700">상담자 검토 필요</span></div></summary><p class="mt-4 whitespace-pre-line border-t border-purple-100 pt-4 text-xs leading-relaxed text-slate-700">${esc(record.summary||'저장된 상담정리가 없습니다.')}</p></details>`).join(''):'<p class="text-sm text-slate-400">AI 결과상담 기록이 없습니다.</p>'}</div></section>`;
}

function memberJournalSection(c){
  const rows=memberChartSessionRows(c);
  return `<section class="rounded-[2rem] border border-slate-100 bg-white p-5 shadow-sm sm:p-6"><div class="mb-5 flex items-center justify-between gap-3"><div><p class="text-xs font-extrabold text-blue-600">COUNSELING JOURNAL</p><h3 class="mt-1 text-lg font-extrabold">상담기록</h3></div><span class="rounded-full bg-blue-50 px-3 py-1 text-xs font-extrabold text-blue-700">${rows.length}건</span></div><div class="space-y-3">${rows.length?rows.map((x,index)=>`<details class="rounded-2xl border border-slate-100 bg-slate-50 p-4" ${index===0?'open':''}><summary class="cursor-pointer list-none"><div class="flex flex-wrap items-center justify-between gap-3"><div><p class="text-sm font-extrabold">${x.sessionNumber?`${x.sessionNumber}회기`:`${rows.length-index}회기`} · ${esc(String(x.date||'날짜 미상').slice(0,10))}</p><p class="mt-1 text-[11px] text-slate-400">${esc(x.method||'상담방법 미기록')} · ${esc(x.source)}</p></div><span class="rounded-full bg-white px-3 py-1 text-[10px] font-bold text-slate-500">펼쳐보기</span></div></summary><div class="mt-4 grid grid-cols-1 gap-3 border-t border-slate-200 pt-4 lg:grid-cols-2"><div class="rounded-xl bg-white p-3"><p class="text-[10px] font-extrabold text-slate-400">의뢰사유</p><p class="mt-2 whitespace-pre-line text-xs leading-relaxed text-slate-700">${esc(x.referral||'기록 없음')}</p></div><div class="rounded-xl bg-white p-3"><p class="text-[10px] font-extrabold text-slate-400">상담목표</p><p class="mt-2 whitespace-pre-line text-xs leading-relaxed text-slate-700">${esc(x.goal||'기록 없음')}</p></div><div class="rounded-xl bg-white p-3 lg:col-span-2"><p class="text-[10px] font-extrabold text-slate-400">상담내용</p><p class="mt-2 whitespace-pre-line text-xs leading-relaxed text-slate-700">${esc(x.content||'기록 없음')}</p></div><div class="rounded-xl bg-white p-3"><p class="text-[10px] font-extrabold text-slate-400">상담결과</p><p class="mt-2 whitespace-pre-line text-xs leading-relaxed text-slate-700">${esc(x.result||'기록 없음')}</p></div><div class="rounded-xl bg-white p-3"><p class="text-[10px] font-extrabold text-slate-400">다음회기</p><p class="mt-2 whitespace-pre-line text-xs leading-relaxed text-slate-700">${esc(x.next||'기록 없음')}</p></div></div></details>`).join(''):'<p class="text-sm text-slate-400">저장된 상담기록이 없습니다.</p>'}</div><button onclick="setMenu('counseling')" class="mt-4 w-full rounded-xl border border-slate-200 bg-white py-3 text-xs font-extrabold">상담기록에서 관리</button></section>`;
}

function memberFullChart(c){
  const latest=c.reservations[0]||{};
  const tests=[...new Set((c.reservations||[]).flatMap(r=>requestedTests(r)).map(shortTestName))];
  return `<article class="space-y-5 rounded-[2rem] border border-emerald-100 bg-slate-50 p-4 shadow-sm sm:p-6"><div class="rounded-[1.75rem] bg-gradient-to-r from-slate-950 to-emerald-950 p-5 text-white sm:p-6"><div class="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between"><div><div class="flex flex-wrap items-center gap-2"><h2 class="text-2xl font-extrabold">${esc(c.name)}님 전자차트</h2><span class="rounded-full bg-white/15 px-3 py-1 text-xs font-extrabold">${esc(normalizeStatus(latest.status||'예약신청'))}</span></div><p class="mt-2 text-sm text-slate-300">${esc(c.caseNumber||'사례번호 생성 전')} · ${esc(c.phone||'연락처 없음')} · ${esc(programBaseName(latest.program)||'프로그램 없음')}</p></div><button onclick="clearMemberChartSearch()" class="rounded-xl border border-white/20 bg-white/10 px-4 py-2 text-xs font-extrabold">다른 내담자 찾기</button></div><div class="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4"><div class="rounded-2xl bg-white/10 p-3"><p class="text-[10px] font-bold text-slate-300">사례번호 · 상태</p><p class="mt-1 text-xs font-extrabold">${esc(c.caseNumber||'생성 전')} · ${esc(caseStatusLabel(latest))}</p><p class="mt-1 text-[10px] text-slate-300">예약번호 ${esc(latest.reservationNumber||'-')}</p></div><div class="rounded-2xl bg-white/10 p-3"><p class="text-[10px] font-bold text-slate-300">신청 검사</p><p class="mt-1 text-xs font-extrabold">${esc(tests.join(', ')||'없음')}</p></div><div class="rounded-2xl bg-white/10 p-3"><p class="text-[10px] font-bold text-slate-300">상담방법</p><p class="mt-1 text-xs font-extrabold">${esc(latest.type||'미정')}</p></div><div class="rounded-2xl bg-white/10 p-3"><p class="text-[10px] font-bold text-slate-300">상담기록</p><p class="mt-1 text-xs font-extrabold">${memberChartSessionRows(c).length}건</p></div></div></div>${memberReservationSection(c)}${memberAssessmentSection(c)}${memberJournalSection(c)}</article>`;
}

function membersView(){
  const allClients=buildClients();
  const q=String(state.memberSearch||'').trim().toLowerCase();
  const normalizedQuery=q.replace(/[^0-9a-z가-힣]/gi,'');
  const clients=q?allClients.filter(c=>{
    const phone=String(c.phone||'').replace(/\D/g,'');
    const name=String(c.name||'').toLowerCase();
    const caseNumber=String(c.caseNumber||'').toLowerCase().replace(/[^0-9a-z]/g,'');return name.includes(q)||phone.includes(normalizedQuery)||caseNumber.includes(normalizedQuery);
  }):[];
  return layout(`<div class="space-y-6"><section class="rounded-[2rem] border border-slate-100 bg-white p-6 shadow-sm"><div class="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between"><div><p class="text-xs font-extrabold text-emerald-700">CLIENT CENTER 2.0</p><h2 class="mt-1 text-2xl font-extrabold">전자차트</h2><p class="mt-2 text-sm text-slate-500">이름·연락처·사례번호로 내담자를 찾으면 예약 진행상태, 심리검사 보고서와 그날 상담의 종합 정리본을 한 화면에서 확인합니다.</p></div><div class="flex w-full flex-col gap-2 sm:flex-row xl:w-auto"><input id="member-chart-search" value="${esc(state.memberSearch)}" onkeydown="if(event.key==='Enter')findMemberChart()" placeholder="이름·연락처·사례번호 입력" class="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm sm:w-80"/><button onclick="findMemberChart()" class="rounded-2xl bg-slate-900 px-6 py-3 text-sm font-extrabold text-white">내담자 찾기</button>${q?`<button onclick="clearMemberChartSearch()" class="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-extrabold text-slate-600">초기화</button>`:''}</div></div><div class="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4"><div class="rounded-2xl bg-slate-50 p-4"><p class="text-xs font-bold text-slate-400">전체 내담자</p><p class="text-2xl font-extrabold">${allClients.length}</p></div><div class="rounded-2xl bg-slate-50 p-4"><p class="text-xs font-bold text-slate-400">검색 결과</p><p class="text-2xl font-extrabold">${q?clients.length:'-'}</p></div><div class="rounded-2xl bg-slate-50 p-4"><p class="text-xs font-bold text-slate-400">심리평가 보고서</p><p class="text-2xl font-extrabold">${(state.assessmentAnalyses||[]).filter(a=>a.reviewed||a.status==='상담자 검토 완료'||a.status==='상담자 승인 완료').length+(state.reports||[]).length}</p></div><div class="rounded-2xl bg-slate-50 p-4"><p class="text-xs font-bold text-slate-400">상담기록</p><p class="text-2xl font-extrabold">${(state.sessionNotes||[]).length}</p></div></div></section>${!q?`<section class="rounded-[2rem] border border-dashed border-emerald-200 bg-emerald-50 p-12 text-center"><p class="text-4xl">🔎</p><h3 class="mt-4 text-lg font-extrabold text-emerald-950">내담자 이름 또는 연락처를 입력해 주세요.</h3><p class="mt-2 text-sm text-emerald-700">검색하면 해당 내담자의 전체 전자차트가 바로 펼쳐집니다.</p></section>`:clients.length?`<div class="space-y-6">${clients.map(memberFullChart).join('')}</div>`:`<section class="rounded-[2rem] border border-dashed border-rose-200 bg-rose-50 p-12 text-center"><p class="text-lg font-extrabold text-rose-800">일치하는 내담자를 찾지 못했습니다.</p><p class="mt-2 text-sm text-rose-600">이름·연락처·사례번호를 다시 확인해 주세요.</p></section>`}</div>`);
}


/* =========================================================
   [MOD-20260715-COUNSELING-JOURNAL-MENU]
   상담일지: 기존 상담 시작 화면으로 들어가는 독립 카테고리
========================================================= */
function counselingJournalEntryView(){
  const rows=state.reservations
    .filter(r=>!['예약취소','종결'].includes(normalizeStatus(r.status)) && !isAiResultCounselingReservation(r))
    .sort((a,b)=>`${a.date||''} ${a.time||''}`.localeCompare(`${b.date||''} ${b.time||''}`));
  return layout(`<div class="space-y-6">
    <section class="rounded-[2rem] bg-gradient-to-br from-emerald-700 to-slate-900 p-6 text-white shadow-lg sm:p-8">
      <p class="text-xs font-extrabold text-emerald-200">COUNSELING JOURNAL</p>
      <h2 class="mt-2 text-2xl font-extrabold">상담일지</h2>
      <p class="mt-2 text-sm leading-relaxed text-slate-200">대면·찾아가는·화상 상담을 진행하며 회기 내용을 작성하는 화면입니다.</p>
    </section>
    <section class="rounded-[2rem] border border-slate-100 bg-white p-5 shadow-sm sm:p-6">
      <div class="mb-5 flex items-center justify-between gap-3"><div><h3 class="text-lg font-extrabold">상담일지 대상 목록</h3><p class="mt-1 text-xs text-slate-400">대면·찾아가는·화상 상담을 선택하면 상담진행 화면이 바로 열립니다.</p></div><span class="rounded-full bg-emerald-50 px-3 py-1 text-xs font-extrabold text-emerald-700">${rows.length}건</span></div>
      <div class="space-y-3">${rows.length?rows.map(r=>`<article class="rounded-2xl border border-slate-100 bg-slate-50 p-4"><div class="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between"><div><div class="flex flex-wrap items-center gap-2"><h4 class="font-extrabold text-slate-900">${esc(r.name)}님</h4><span class="rounded-full px-3 py-1 text-[11px] font-extrabold ${statusClass(r.status)}">${esc(normalizeStatus(r.status))}</span></div><p class="mt-2 text-xs text-slate-500">${esc(r.date||'')} ${esc(r.time||'')} · ${esc(programBaseName(r.program))} · ${esc(r.type||'미정')}</p><p class="mt-1 text-xs text-slate-400">검사: ${esc(requestedTests(r).map(shortTestName).join(', ')||'없음')}</p></div><button onclick="startCounseling(${r.id})" class="rounded-xl bg-emerald-600 px-5 py-3 text-xs font-extrabold text-white hover:bg-emerald-700">상담일지 열기</button></div></article>`).join(''):empty('상담일지를 작성할 대면·화상 예약이 없습니다.')}</div>
    </section>
  </div>`)
}

/* =========================================================
   상담운영센터 2.0 · Sprint 4 상담모드
   회원 요약, 회기기록, AI 상담보조를 한 화면에서 사용합니다.
========================================================= */
function counselingModeReservation(){return state.reservations.find(r=>String(r.id)===String(state.counselingModeId))||null}
function counselingModeClient(r){return buildClients().find(c=>c.key===clientKey(r.name,r.phone))||null}
function counselingModeCase(r){return buildCases().find(c=>String(c.res.id)===String(r.id))||null}
function counselingModeDraftKey(id){return 'modumam_counseling_mode_draft_'+id}
function saveCounselingModeDraft(id){
  const data={
    date:document.getElementById('cm-date')?.value||new Date().toISOString().slice(0,10),
    theme:document.getElementById('cm-theme')?.value||'',
    emotion:document.getElementById('cm-emotion')?.value||'',
    content:document.getElementById('cm-content')?.value||'',
    change:document.getElementById('cm-change')?.value||'',
    next:document.getElementById('cm-next')?.value||'',
    updatedAt:new Date().toLocaleString('ko-KR')
  };
  save(counselingModeDraftKey(id),data);
  alert('상담 중 메모가 임시 저장되었습니다.');
}
function clearCounselingModeDraft(id){localStorage.removeItem(counselingModeDraftKey(id))}
function saveCounselingModeSession(id,finish=false){
  const r=state.reservations.find(x=>String(x.id)===String(id));
  if(!r)return;
  const date=document.getElementById('cm-date')?.value||new Date().toISOString().slice(0,10);
  const theme=(document.getElementById('cm-theme')?.value||'').trim();
  const emotion=(document.getElementById('cm-emotion')?.value||'').trim();
  const content=(document.getElementById('cm-content')?.value||'').trim();
  const change=(document.getElementById('cm-change')?.value||'').trim();
  const next=(document.getElementById('cm-next')?.value||'').trim();
  if(!content){alert('상담 내용 또는 주요 개입을 입력해 주세요.');return;}
  const now=new Date();
  const memo=[theme&&`[핵심 주제]\n${theme}`,emotion&&`[주요 정서와 반응]\n${emotion}`,`[상담 내용과 개입]\n${content}`,change&&`[변화·관찰]\n${change}`,next&&`[다음 회기 계획]\n${next}`].filter(Boolean).join('\n\n');
  const ckey=clientKey(r.name,r.phone);
  const notesKey='modumam_counseling_notes_'+ckey;
  const notes=load(notesKey,[]);
  const noteId=Date.now();
  notes.unshift({id:noteId,date,theme,emotion,intervention:content,change,next,memo,createdAt:now.toLocaleString('ko-KR'),type:'structured-session',reservationId:r.id});
  save(notesKey,notes);
  const caseId=caseIdFromReservation(r);
  const caseKey='modumam_case_sessions_'+caseId;
  const sessions=load(caseKey,[]);
  sessions.unshift({id:noteId,date,goal:theme,content,change,task:'',next,emotion,createdAt:now.toLocaleString('ko-KR'),reservationId:r.id});
  save(caseKey,sessions);
  clearCounselingModeDraft(id);
  if(finish){
    const target=state.reservations.find(x=>String(x.id)===String(id));
    if(target){target.status='상담완료';target.counselingCompletedAt=now.toISOString();target.updatedAt=now.toLocaleString('ko-KR');}
    save('modumam_reservations',state.reservations);
    state.counselingModeId='';state.menu='today';
    alert('회기기록을 저장하고 상담을 완료 처리했습니다.');
  }else alert('회기기록이 저장되었습니다.');
  render();
}
function counselingModeView(){
  const r=counselingModeReservation();
  if(!r){state.counselingModeId='';return todayCounselingView();}
  const client=counselingModeClient(r)||{name:r.name,phone:r.phone,reservations:[r],intakes:[],reports:[],uploads:[],notes:[]};
  const caseData=counselingModeCase(r)||{caseId:caseIdFromReservation(r),tests:requestedTests(r),intake:null,formulation:{},sessions:[]};
  const draft=load(counselingModeDraftKey(r.id),{});
  const aid=load('modumam_counseling_aid_'+caseData.caseId,null);
  const tests=requestedTests(r).map(shortTestName);
  const started=r.counselingStartedAt?new Date(r.counselingStartedAt).toLocaleString('ko-KR'):new Date().toLocaleString('ko-KR');
  const sessionNumber=(caseData.sessions?.length||0)+1; // [FIX-20260715-JOURNAL-UI]
  return `<main class="min-h-screen bg-slate-100">
    <header class="sticky top-0 z-50 border-b border-slate-200 bg-white/95 backdrop-blur"><div class="flex flex-col gap-3 px-4 py-4 sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:px-8"><div class="flex items-center gap-3"><button onclick="closeCounselingMode()" class="rounded-xl border border-slate-200 px-3 py-2 text-xs font-extrabold">← 상담일지</button><div><p class="text-[11px] font-extrabold text-emerald-700">${esc(r.caseNumber||'사례번호 생성 전')} · 상담일지 · ${sessionNumber}회기</p><h1 class="text-xl font-extrabold">${esc(r.name)}님 · ${esc(programBaseName(r.program))}</h1><p class="mt-1 text-xs text-slate-400">${esc(tests.join(' · ')||'검사 없음')} · 예약 ${esc(r.date)} ${esc(r.time)} · 시작 ${esc(started)}</p></div></div><div class="flex flex-wrap gap-2"><button onclick="saveCounselingModeDraft(${r.id})" class="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-extrabold">임시 저장</button><button onclick="saveCounselingModeSession(${r.id},false)" class="rounded-xl bg-blue-600 px-4 py-2 text-xs font-extrabold text-white">회기 저장</button><button onclick="saveCounselingModeSession(${r.id},true)" class="rounded-xl bg-slate-900 px-4 py-2 text-xs font-extrabold text-white">상담 종료</button></div></div></header>
    <div class="grid grid-cols-1 gap-5 p-4 sm:p-6 lg:grid-cols-[260px_minmax(0,1fr)_320px] lg:p-8">
      <aside class="space-y-4">
        <section class="rounded-[2rem] border border-slate-100 bg-white p-5 shadow-sm"><div class="flex items-center gap-3"><div class="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-100 text-xl">👤</div><div><h2 class="text-lg font-extrabold">${esc(r.name)}님</h2><p class="text-xs text-slate-400">${esc(r.phone||'연락처 없음')}</p></div></div><div class="mt-5 space-y-3 text-xs"><div class="rounded-2xl bg-slate-50 p-3"><p class="font-bold text-slate-400">프로그램</p><p class="mt-1 font-extrabold">${esc(programBaseName(r.program))}</p></div><div class="rounded-2xl bg-slate-50 p-3"><p class="font-bold text-slate-400">검사명</p><p class="mt-1 font-extrabold">${esc(tests.join(', ')||'없음')}</p></div><div class="rounded-2xl bg-slate-50 p-3"><p class="font-bold text-slate-400">상담방식</p><p class="mt-1 font-extrabold">${esc(r.type||'미정')}</p></div><div class="rounded-2xl bg-slate-50 p-3"><p class="font-bold text-slate-400">예약시간</p><p class="mt-1 font-extrabold">${esc(r.date)} ${esc(r.time)}</p></div><div class="rounded-2xl bg-slate-50 p-3"><p class="font-bold text-slate-400">진행상태</p><p class="mt-1 font-extrabold">${esc(normalizeStatus(r.status))}</p></div></div></section>
        <section class="rounded-[2rem] border border-slate-100 bg-white p-5 shadow-sm"><h3 class="text-sm font-extrabold">심리검사</h3><div class="mt-3 flex flex-wrap gap-2">${tests.length?tests.map(t=>`<span class="rounded-full bg-indigo-50 px-3 py-1.5 text-xs font-extrabold text-indigo-700">${esc(t)}</span>`).join(''):'<span class="text-xs text-slate-400">신청 검사 없음</span>'}</div></section>
        <details class="rounded-[2rem] border border-slate-100 bg-white p-5 shadow-sm"><summary class="cursor-pointer text-sm font-extrabold">최근 참고정보 펼치기</summary><div class="mt-4 space-y-3 text-xs"><div><p class="font-bold text-slate-400">AI 마음체크</p><p class="mt-1 whitespace-pre-line text-slate-600">${esc(caseData.intake?.summary||caseData.intake?.concern||'기록 없음')}</p></div><div><p class="font-bold text-slate-400">이전 회기</p><p class="mt-1 text-slate-600">${caseData.sessions.length}건</p></div><div><p class="font-bold text-slate-400">결과보고서</p><p class="mt-1 text-slate-600">${client.reports?.length||0}건</p></div></div></details>
      </aside>
      <section class="rounded-[2rem] border border-slate-100 bg-white p-5 shadow-sm sm:p-6"><div class="mb-5"><p class="text-xs font-extrabold text-blue-700">SESSION NOTE</p><h2 class="mt-1 text-xl font-extrabold">${sessionNumber}회기 상담일지</h2><p class="mt-1 text-xs text-slate-400">상담 중 필요한 내용을 실무 흐름에 따라 기록합니다.</p></div><div class="grid grid-cols-1 gap-3 sm:grid-cols-2"><div><label class="mb-1 block text-xs font-bold text-slate-500">상담일</label><input id="cm-date" type="date" value="${esc(draft.date||new Date().toISOString().slice(0,10))}" class="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm"/></div><div><label class="mb-1 block text-xs font-bold text-slate-500">오늘의 핵심주제</label><input id="cm-theme" value="${esc(draft.theme||'')}" placeholder="오늘 가장 중요한 상담 주제" class="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm"/></div></div><label class="mb-1 mt-4 block text-xs font-bold text-slate-500">내담자의 이야기와 주요 정서</label><textarea id="cm-emotion" rows="3" placeholder="표현된 감정, 신체반응, 말투와 태도" class="w-full resize-none rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm">${esc(draft.emotion||'')}</textarea><label class="mb-1 mt-4 block text-xs font-bold text-slate-500">상담자의 개입 및 상담 내용</label><textarea id="cm-content" rows="10" placeholder="내담자의 핵심 이야기, 상담자의 질문과 개입, 확인한 의미를 기록하세요." class="w-full resize-y rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm leading-relaxed">${esc(draft.content||'')}</textarea><label class="mb-1 mt-4 block text-xs font-bold text-slate-500">내담자의 변화·위험·보호요인</label><textarea id="cm-change" rows="4" placeholder="회기 중 변화, 강점, 위험 신호와 보호요인" class="w-full resize-none rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm">${esc(draft.change||'')}</textarea><label class="mb-1 mt-4 block text-xs font-bold text-slate-500">다음 회기 계획·과제</label><textarea id="cm-next" rows="4" placeholder="다음에 이어갈 주제와 실천과제" class="w-full resize-none rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm">${esc(draft.next||'')}</textarea></section>
      <aside class="space-y-4"><section class="rounded-[2rem] border border-purple-100 bg-white p-5 shadow-sm"><div class="flex items-center justify-between gap-2"><div><p class="text-xs font-extrabold text-purple-700">AI COUNSELING AID 2.0</p><h2 class="mt-1 text-lg font-extrabold">AI 상담도우미</h2></div><button onclick="generateCounselingAid('${caseData.caseId}')" ${state.counselingAidLoading[caseData.caseId]?'disabled':''} class="rounded-xl bg-purple-600 px-3 py-2 text-xs font-extrabold text-white disabled:opacity-50">${state.counselingAidLoading[caseData.caseId]?'분석 중...':(aid?'메모 반영해 갱신':'초안 생성')}</button></div><p class="mt-2 text-[11px] leading-relaxed text-slate-400">현재 작성 중인 회기 메모와 기존 검사·상담 자료를 함께 반영합니다.</p>${aid?`<div class="mt-4 space-y-3"><div><label class="text-xs font-extrabold text-purple-700">현재 핵심 정서</label><textarea id="aid-emotion-${caseData.caseId}" rows="3" class="mt-1 w-full resize-none rounded-xl border border-purple-100 bg-purple-50 p-3 text-xs leading-relaxed">${esc(aid.emotion||'')}</textarea></div><div><label class="text-xs font-extrabold text-purple-700">상담목표</label><textarea id="aid-focus-${caseData.caseId}" rows="4" class="mt-1 w-full resize-none rounded-xl border border-slate-200 p-3 text-xs leading-relaxed">${esc(aid.focus||'')}</textarea></div><div><label class="text-xs font-extrabold text-purple-700">추천 질문</label><textarea id="aid-questions-${caseData.caseId}" rows="7" class="mt-1 w-full resize-y rounded-xl border border-slate-200 p-3 text-xs leading-relaxed">${esc(aid.questions||'')}</textarea></div><div><label class="text-xs font-extrabold text-purple-700">권장 개입</label><textarea id="aid-intervention-${caseData.caseId}" rows="5" class="mt-1 w-full resize-y rounded-xl border border-slate-200 p-3 text-xs leading-relaxed">${esc(aid.intervention||'')}</textarea></div><div><label class="text-xs font-extrabold text-emerald-700">강점·보호요인</label><textarea id="aid-strengths-${caseData.caseId}" rows="4" class="mt-1 w-full resize-none rounded-xl border border-emerald-100 bg-emerald-50 p-3 text-xs leading-relaxed">${esc(aid.strengths||'')}</textarea></div><div><label class="text-xs font-extrabold text-rose-700">주의할 점</label><textarea id="aid-caution-${caseData.caseId}" rows="4" class="mt-1 w-full resize-none rounded-xl border border-rose-100 bg-rose-50 p-3 text-xs leading-relaxed">${esc(aid.caution||'')}</textarea></div><div><label class="text-xs font-extrabold text-blue-700">다음 회기 연결</label><textarea id="aid-next-${caseData.caseId}" rows="4" class="mt-1 w-full resize-none rounded-xl border border-blue-100 bg-blue-50 p-3 text-xs leading-relaxed">${esc(aid.nextPlan||'')}</textarea></div><textarea id="aid-source-${caseData.caseId}" class="hidden">${esc(aid.source||'')}</textarea><div class="grid grid-cols-2 gap-2"><button onclick="saveCounselingAid('${caseData.caseId}')" class="rounded-xl bg-slate-900 py-2 text-xs font-extrabold text-white">수정 저장</button><button onclick="copyCounselingAid('${caseData.caseId}')" class="rounded-xl border border-purple-200 py-2 text-xs font-extrabold text-purple-700">내용 복사</button></div><p class="text-[10px] text-slate-400">생성 ${esc(aid.updatedAt||'')} ${aid.model?`· ${esc(aid.model)}`:''}</p></div>`:`<div class="mt-5 rounded-2xl border border-dashed border-purple-200 bg-purple-50 p-4 text-xs leading-relaxed text-purple-700">회기 메모를 일부 입력한 뒤 초안을 생성하면 현재 정서와 상담 흐름에 더 맞는 제안을 받을 수 있습니다.</div>`}</section><section class="rounded-[2rem] border border-slate-100 bg-white p-5 shadow-sm"><h3 class="text-sm font-extrabold">상담 후 처리</h3><div class="mt-3 space-y-2"><button onclick="saveCounselingModeSession(${r.id},false)" class="w-full rounded-xl bg-blue-50 px-3 py-3 text-xs font-extrabold text-blue-700">회기기록 저장</button><button onclick="saveCounselingModeSession(${r.id},true)" class="w-full rounded-xl bg-slate-900 px-3 py-3 text-xs font-extrabold text-white">저장 후 상담 완료</button><button onclick="scheduleNextCounseling(${r.id})" class="w-full rounded-xl bg-purple-50 px-3 py-3 text-xs font-extrabold text-purple-700">다음 상담 예약</button></div></section><p class="px-2 text-[10px] leading-relaxed text-slate-400">AI 제안은 상담자의 판단을 돕는 참고자료이며 진단이나 최종 임상 판단을 대신하지 않습니다.</p></aside>
    </div>
  </main>`;
}


/* =========================================================
   상담운영센터 2.0 · SPRINT 5
   종결관리: 상담완료 이후 종결기록·사후관리·AI 종결요약 초안
========================================================= */
function terminationKey(reservationId){return 'modumam_termination_'+String(reservationId)}
function getTerminationRecord(reservationId){return load(terminationKey(reservationId),{reason:'',summary:'',progress:'',remaining:'',recommendation:'',followUp:'',clientFeedback:'',completedAt:'',aiGeneratedAt:'',aiModel:''})}
function saveTerminationRecord(reservationId){
  const r=state.reservations.find(x=>String(x.id)===String(reservationId));
  if(!r)return;
  const record={
    reason:document.getElementById('term-reason-'+reservationId)?.value||'',
    summary:document.getElementById('term-summary-'+reservationId)?.value||'',
    progress:document.getElementById('term-progress-'+reservationId)?.value||'',
    remaining:document.getElementById('term-remaining-'+reservationId)?.value||'',
    recommendation:document.getElementById('term-recommendation-'+reservationId)?.value||'',
    followUp:document.getElementById('term-followup-'+reservationId)?.value||'',
    clientFeedback:document.getElementById('term-feedback-'+reservationId)?.value||'',
    completedAt:new Date().toLocaleString('ko-KR'),
    aiGeneratedAt:getTerminationRecord(reservationId).aiGeneratedAt||'',
    aiModel:getTerminationRecord(reservationId).aiModel||''
  };
  save(terminationKey(reservationId),record);
  if(normalizeStatus(r.status)!=='종결')updateReservation(reservationId,{status:'종결',closedAt:new Date().toLocaleString('ko-KR')});
  alert('종결기록이 저장되었습니다.');
  render();
}
async function generateTerminationSummary(reservationId){
  const r=state.reservations.find(x=>String(x.id)===String(reservationId));
  if(!r)return;
  const caseId=caseIdFromReservation(r);
  const sessions=load('modumam_case_sessions_'+caseId,[]);
  const formulation=load('modumam_case_formulation_'+caseId,{});
  const reports=state.reports.filter(x=>String(x.reservationId||'')===String(r.id)||String(x.clientName||'').trim()===String(r.name||'').trim());
  const intake=findIntake(r);
  if(!sessions.length&&!reports.length&&!intake){alert('종결요약에 사용할 회기기록·보고서·AI 마음체크 자료가 없습니다.');return;}
  state.terminationDraftLoading[reservationId]=true;render();
  try{
    const response=await fetch('/.netlify/functions/termination-summary',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({
      clientName:r.name,program:programBaseName(r.program),counselingMethod:r.type,
      tests:requestedTests(r),intakeSummary:intake?.summary||intake?.concern||'',
      formulation,reportSummary:reports.map(x=>[x.title,x.summary,x.strength,x.caution,x.plan].filter(Boolean).join('\n')).join('\n\n'),
      sessions:sessions.map(x=>({date:x.date,goal:x.goal,content:x.content,change:x.change,task:x.task,next:x.next})),
      existing:getTerminationRecord(reservationId)
    })});
    const data=await response.json().catch(()=>({}));
    if(!response.ok||!data.termination)throw new Error(data.error||'AI 종결요약 생성에 실패했습니다.');
    save(terminationKey(reservationId),{...getTerminationRecord(reservationId),...data.termination,aiGeneratedAt:new Date().toISOString(),aiModel:data.model||''});
    alert('AI 종결요약 초안이 생성되었습니다. 반드시 상담자가 검토·수정해 주세요.');
  }catch(error){alert(error.message||'AI 종결요약 생성 중 오류가 발생했습니다.');}
  finally{state.terminationDraftLoading[reservationId]=false;render();}
}
function printTerminationRecord(reservationId){
  const r=state.reservations.find(x=>String(x.id)===String(reservationId));
  if(!r)return;
  const t=getTerminationRecord(reservationId);
  if(!Object.values(t).some(v=>typeof v==='string'&&v.trim())){alert('저장된 종결기록이 없습니다.');return;}
  const w=window.open('','_blank');if(!w){alert('팝업 차단을 해제해 주세요.');return;}
  const row=(title,value)=>`<section><h2>${title}</h2><div>${esc(value||'미입력').replace(/\n/g,'<br>')}</div></section>`;
  w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${esc(r.name)} 종결기록</title><style>body{font-family:Arial,'Noto Sans KR',sans-serif;max-width:900px;margin:40px auto;padding:0 28px;color:#1e293b;line-height:1.7}h1{font-size:26px;margin-bottom:4px}.meta{color:#64748b;margin-top:0}section{border-top:1px solid #e2e8f0;padding:18px 0}h2{font-size:15px;color:#047857;margin:0 0 8px}div{font-size:14px}.notice{background:#f8fafc;border:1px solid #e2e8f0;padding:14px;border-radius:12px;font-size:12px;color:#64748b}</style></head><body><h1>상담 종결기록</h1><p class="meta">${esc(r.name)} · ${esc(programBaseName(r.program))} · ${esc(r.date||'')} ${esc(r.time||'')}</p><div class="notice">본 문서는 상담자가 검토·작성한 내부 상담기록입니다.</div>${row('종결 사유',t.reason)}${row('상담과정 요약',t.summary)}${row('주요 변화와 성과',t.progress)}${row('남은 어려움과 주의점',t.remaining)}${row('권장사항',t.recommendation)}${row('사후관리 계획',t.followUp)}${row('내담자 종결 피드백',t.clientFeedback)}<script>window.onload=()=>window.print()<\/script></body></html>`);w.document.close();
}


// [FIX-20260715-SESSION-ORGANIZER-15] 상담일지·축어록 선택 기반 AI 회기록 정리
async function organizeCounselingSession(caseId,reservationId){
  const reservation=state.reservations.find(r=>String(r.id)===String(reservationId));
  if(!reservation){alert('예약 정보를 찾지 못했습니다.');return;}

  const useJournal=!!document.getElementById(`session-source-journal-${caseId}`)?.checked;
  const useTranscript=!!document.getElementById(`session-source-transcript-${caseId}`)?.checked;
  if(!useJournal&&!useTranscript){alert('상담일지 또는 축어록을 하나 이상 선택해 주세요.');return;}

  const sessionNumber=Math.max(1,Number(document.getElementById(`counseling-session-number-${caseId}`)?.value)||1);
  const sessionDate=String(document.getElementById(`counseling-session-date-${caseId}`)?.value||reservation.date||new Date().toISOString().slice(0,10));
  const sessions=load(`modumam_case_sessions_${caseId}`,[]);
  const journal=sessions.find(x=>!x.aiOrganized)||sessions[0]||null;
  const sourceParts=[];

  if(useJournal){
    if(!journal){alert('불러올 상담일지가 없습니다. 상담일지에서 회기 저장을 먼저 해 주세요.');return;}
    sourceParts.push(`[상담일지]\n의뢰사유: ${reservation.applicationForm?.concern||journal.theme||journal.goal||''}\n상담목표: ${journal.goal||journal.theme||''}\n주요정서: ${journal.emotion||''}\n상담내용: ${journal.content||''}\n상담결과: ${journal.change||''}\n다음회기: ${journal.next||''}`);
  }

  let transcriptFile=null;
  if(useTranscript){
    const input=document.getElementById(`counseling-transcript-file-${caseId}`);
    transcriptFile=input?.files?.[0]||null;
    if(!transcriptFile){alert('축어록 파일을 선택해 주세요.');input?.click();return;}
  }

  const button=document.getElementById(`session-organize-button-${caseId}`);
  if(button){button.disabled=true;button.textContent='AI 회기 정리 중...';}

  try{
    let fileName='상담일지.txt', mimeType='text/plain', base64='';
    if(transcriptFile && !useJournal){
      fileName=transcriptFile.name;
      mimeType=transcriptFile.type||'text/plain';
      base64=await fileToBase64(transcriptFile);
    }else{
      if(transcriptFile){
        const transcriptBase64=await fileToBase64(transcriptFile);
        sourceParts.push(`[축어록 파일]\n파일명: ${transcriptFile.name}\n첨부데이터(base64): ${transcriptBase64}`);
        fileName=`${sessionNumber}회기_상담일지_축어록.txt`;
      }
      const text=sourceParts.join('\n\n');
      base64=btoa(unescape(encodeURIComponent(text)));
    }

    const data=await callCounselingFunction('counseling-transcript-summary',{
      method:'POST',headers:{'Content-Type':'application/json'},
      body:JSON.stringify({clientName:reservation.name||'',program:programBaseName(reservation.program),counselingMethod:reservation.type||'',date:sessionDate,sessionNumber,fileName,mimeType,base64})
    });
    if(!data?.note)throw new Error('AI 회기록 결과를 받지 못했습니다.');
    const note=data.note;
    const reason=reservation.applicationForm?.concern||journal?.theme||journal?.goal||'';
    const record={
      id:Date.now(),sessionNumber,date:sessionDate,counselingMethod:reservation.type||'미정',
      reason,goal:note.goal||journal?.goal||'',content:note.content||journal?.content||'',
      result:note.change||note.summary||journal?.change||'',next:note.next||journal?.next||'',
      sourceTypes:[useJournal?'상담일지':'',useTranscript?'축어록':''].filter(Boolean),
      aiGenerated:true,aiOrganized:true,reviewStatus:'AI 초안',createdAt:new Date().toLocaleString('ko-KR')
    };
    save(`modumam_case_sessions_${caseId}`,[record,...sessions]);
    alert('AI 회기 정리가 완료되었습니다. 저장된 회기록에서 내용을 확인해 주세요.');
    render();
  }catch(error){alert(error?.message||'AI 회기 정리에 실패했습니다.');}
  finally{if(button){button.disabled=false;button.textContent='AI 회기 정리';}}
}
window.organizeCounselingSession=organizeCounselingSession;

function counselingJournalView(){
  const tab=state.counselingJournalTab||'sessions';
  const cases=buildCases();
  if(tab==='termination'){
    const rows=state.reservations.filter(r=>['상담완료','종결'].includes(normalizeStatus(r.status)));
    return layout(`<div class="space-y-6"><section class="rounded-[2rem] bg-gradient-to-r from-slate-950 to-emerald-950 p-6 text-white shadow-xl sm:p-8"><p class="text-xs font-extrabold text-emerald-300">COUNSELING</p><h2 class="mt-2 text-2xl font-extrabold">상담기록</h2><p class="mt-2 text-sm text-slate-300">상담기록을 관리합니다.</p><div class="mt-5 flex gap-2"><button onclick="setCounselingJournalTab('sessions')" class="rounded-xl bg-white/10 px-4 py-2 text-xs font-extrabold">회기기록</button><button onclick="setCounselingJournalTab('termination')" class="rounded-xl bg-white px-4 py-2 text-xs font-extrabold text-slate-950">종결기록</button></div></section><section class="rounded-[2rem] border border-slate-100 bg-white p-6 shadow-sm"><div class="mb-5 flex items-center justify-between"><div><p class="text-xs font-extrabold text-rose-600">TERMINATION RECORD</p><h3 class="mt-1 text-xl font-extrabold">종결기록</h3></div><button onclick="setMenu('termination')" class="rounded-xl bg-slate-900 px-4 py-2 text-xs font-extrabold text-white">종결기록 작성·확인</button></div><div class="space-y-3">${rows.length?rows.map(r=>`<button onclick="setMenu('termination')" class="w-full rounded-2xl border border-slate-100 bg-slate-50 p-4 text-left"><b>${esc(r.name)}님</b> · ${esc(r.date||'')}</button>`).join(''):empty('종결기록 대상이 없습니다.')}</div></section></div>`);
  }
  return layout(`<div class="space-y-6"><section class="rounded-[2rem] bg-gradient-to-r from-slate-950 to-emerald-950 p-6 text-white shadow-xl sm:p-8"><p class="text-xs font-extrabold text-emerald-300">COUNSELING SESSION RECORD</p><h2 class="mt-2 text-2xl font-extrabold">상담기록</h2><p class="mt-2 text-sm text-slate-300">상담일지와 축어록 중 필요한 자료를 선택해 AI가 회기록을 정리합니다.</p><div class="mt-5 flex gap-2"><button onclick="setCounselingJournalTab('sessions')" class="rounded-xl bg-white px-4 py-2 text-xs font-extrabold text-slate-950">회기기록</button><button onclick="setCounselingJournalTab('termination')" class="rounded-xl bg-white/10 px-4 py-2 text-xs font-extrabold">종결기록</button></div></section>
  ${cases.map(c=>`<section class="rounded-[2rem] border border-slate-100 bg-white p-5 shadow-sm sm:p-6"><div class="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between"><div><h3 class="text-xl font-extrabold">${esc(c.res.name)}님</h3><p class="mt-1 text-sm text-slate-500">${esc(programBaseName(c.res.program))} · ${esc(c.res.type||'')} · ${esc(c.res.date||'')} ${esc(c.res.time||'')}</p></div><span class="rounded-full bg-emerald-50 px-3 py-1 text-xs font-extrabold text-emerald-700">저장 ${c.sessions.length}건</span></div>
    <div class="mt-5 rounded-[1.75rem] border border-purple-100 bg-purple-50 p-5"><div><p class="text-xs font-extrabold text-purple-700">회기기록 정리</p><h4 class="mt-1 text-lg font-extrabold">자료 선택 후 AI 회기 정리</h4></div><div class="mt-4 flex flex-wrap gap-3"><label class="flex cursor-pointer items-center gap-2 rounded-xl border border-purple-200 bg-white px-4 py-3 text-sm font-extrabold"><input id="session-source-journal-${c.caseId}" type="checkbox" checked class="h-4 w-4">상담일지</label><label class="flex cursor-pointer items-center gap-2 rounded-xl border border-purple-200 bg-white px-4 py-3 text-sm font-extrabold"><input id="session-source-transcript-${c.caseId}" type="checkbox" class="h-4 w-4">축어록</label></div><div class="mt-4 grid grid-cols-1 gap-3 md:grid-cols-[100px_170px_1fr]"><label class="rounded-xl border border-purple-200 bg-white px-3 py-2"><span class="block text-[10px] font-extrabold text-purple-500">회기수</span><input id="counseling-session-number-${c.caseId}" type="number" min="1" value="${c.sessions.length+1}" class="mt-1 w-full border-0 p-0 text-sm font-extrabold outline-none"></label><label class="rounded-xl border border-purple-200 bg-white px-3 py-2"><span class="block text-[10px] font-extrabold text-purple-500">상담일</span><input id="counseling-session-date-${c.caseId}" type="date" value="${esc(c.res.date||new Date().toISOString().slice(0,10))}" class="mt-1 w-full border-0 p-0 text-sm font-extrabold outline-none"></label><label class="rounded-xl border border-purple-200 bg-white px-3 py-2"><span class="block text-[10px] font-extrabold text-purple-500">축어록 파일</span><input id="counseling-transcript-file-${c.caseId}" type="file" accept=".txt,.pdf,.png,.jpg,.jpeg,.webp,text/plain,application/pdf,image/png,image/jpeg,image/webp" class="mt-1 block w-full text-xs"></label></div><button id="session-organize-button-${c.caseId}" onclick="organizeCounselingSession('${c.caseId}',${JSON.stringify(String(c.res.id))})" class="mt-4 w-full rounded-xl bg-purple-600 px-4 py-3 text-sm font-extrabold text-white">AI 회기 정리</button><p class="mt-2 text-[10px] text-purple-500">상담일지만, 축어록만, 또는 두 자료를 함께 선택할 수 있습니다.</p></div>
    <div class="mt-6"><div class="mb-3 flex items-center justify-between"><h4 class="text-lg font-extrabold">저장된 회기록</h4><span class="text-xs font-bold text-slate-400">상담일자 · 회기수 · 상담방법</span></div><div class="space-y-4">${c.sessions.length?c.sessions.map((s,i)=>`<article class="rounded-2xl border border-slate-100 bg-slate-50 p-5"><div class="grid grid-cols-1 gap-3 sm:grid-cols-3"><div><p class="text-[10px] font-extrabold text-slate-400">상담일자</p><p class="mt-1 text-sm font-extrabold">${esc(s.date||c.res.date||'')}</p></div><div><p class="text-[10px] font-extrabold text-slate-400">회기수</p><p class="mt-1 text-sm font-extrabold">${esc(s.sessionNumber||c.sessions.length-i)}회기</p></div><div><p class="text-[10px] font-extrabold text-slate-400">상담방법</p><p class="mt-1 text-sm font-extrabold">${esc(s.counselingMethod||c.res.type||'미정')}</p></div></div><div class="mt-4 grid grid-cols-1 gap-4"><div><p class="text-xs font-extrabold text-emerald-700">의뢰사유</p><p class="mt-1 whitespace-pre-line text-sm leading-relaxed text-slate-700">${esc(s.reason||c.res.applicationForm?.concern||'미입력')}</p></div><div><p class="text-xs font-extrabold text-emerald-700">상담목표</p><p class="mt-1 whitespace-pre-line text-sm leading-relaxed text-slate-700">${esc(s.goal||'미입력')}</p></div><div><p class="text-xs font-extrabold text-emerald-700">상담내용</p><p class="mt-1 whitespace-pre-line text-sm leading-relaxed text-slate-700">${esc(s.content||'미입력')}</p></div><div><p class="text-xs font-extrabold text-emerald-700">상담결과</p><p class="mt-1 whitespace-pre-line text-sm leading-relaxed text-slate-700">${esc(s.result||s.change||'미입력')}</p></div><div><p class="text-xs font-extrabold text-emerald-700">다음회기</p><p class="mt-1 whitespace-pre-line text-sm leading-relaxed text-slate-700">${esc(s.next||'미입력')}</p></div></div>${s.sourceTypes?.length?`<p class="mt-4 text-[10px] font-bold text-purple-600">AI 생성근거: ${s.sourceTypes.map(esc).join(' + ')}</p>`:''}</article>`).join(''):empty('저장된 회기록이 없습니다.')}</div></div></section>`).join('')||empty('상담 사례가 없습니다.')}</div>`);
}

function terminationView(){
  const rows=state.reservations.filter(r=>['상담완료','종결'].includes(normalizeStatus(r.status))).sort((a,b)=>String(b.date||'').localeCompare(String(a.date||'')));
  return layout(`<div class="space-y-6"><div class="rounded-[2rem] bg-slate-950 p-6 text-white"><p class="text-xs font-extrabold text-emerald-300">CASE CLOSING</p><h2 class="mt-2 text-2xl font-extrabold">종결관리</h2><p class="mt-2 text-sm text-slate-300">상담완료 사례의 변화·남은 과제·사후관리 계획을 정리하고 종결기록을 저장합니다.</p></div>${rows.map(r=>{const t=getTerminationRecord(r.id),caseId=caseIdFromReservation(r),sessions=load('modumam_case_sessions_'+caseId,[]);return `<section class="rounded-[2rem] border border-slate-100 bg-white p-5 shadow-sm sm:p-6"><div class="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between"><div><div class="flex flex-wrap items-center gap-2"><h3 class="text-xl font-extrabold">${esc(r.name)}님</h3><span class="rounded-full px-3 py-1 text-xs font-bold ${statusClass(r.status)}">${esc(normalizeStatus(r.status))}</span></div><p class="mt-2 text-sm text-slate-500">${esc(programBaseName(r.program))} · ${esc(r.type||'')} · 회기 ${sessions.length}건</p><p class="mt-1 text-xs text-slate-400">신청검사: ${requestedTests(r).map(shortTestName).join(', ')||'없음'}</p></div><div class="flex flex-wrap gap-2"><button onclick="generateTerminationSummary(${r.id})" ${state.terminationDraftLoading[r.id]?'disabled':''} class="rounded-xl bg-purple-600 px-4 py-2 text-xs font-extrabold text-white disabled:opacity-50">${state.terminationDraftLoading[r.id]?'생성 중...':'AI 종결요약'}</button><button onclick="printTerminationRecord(${r.id})" class="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-extrabold">PDF·인쇄</button></div></div>${t.aiGeneratedAt?`<p class="mt-3 text-[11px] font-bold text-purple-600">AI 초안 생성: ${new Date(t.aiGeneratedAt).toLocaleString('ko-KR')}</p>`:''}<div class="mt-5 grid grid-cols-1 gap-3 xl:grid-cols-2"><textarea id="term-reason-${r.id}" rows="2" placeholder="종결 사유" class="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm">${esc(t.reason)}</textarea><textarea id="term-summary-${r.id}" rows="4" placeholder="상담과정 요약" class="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm">${esc(t.summary)}</textarea><textarea id="term-progress-${r.id}" rows="4" placeholder="주요 변화와 성과" class="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm">${esc(t.progress)}</textarea><textarea id="term-remaining-${r.id}" rows="4" placeholder="남은 어려움과 주의점" class="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm">${esc(t.remaining)}</textarea><textarea id="term-recommendation-${r.id}" rows="4" placeholder="권장사항" class="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm">${esc(t.recommendation)}</textarea><textarea id="term-followup-${r.id}" rows="4" placeholder="사후관리 계획" class="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm">${esc(t.followUp)}</textarea><textarea id="term-feedback-${r.id}" rows="3" placeholder="내담자 종결 피드백" class="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm xl:col-span-2">${esc(t.clientFeedback)}</textarea></div><button onclick="saveTerminationRecord(${r.id})" class="mt-4 w-full rounded-2xl bg-slate-900 py-3 text-sm font-extrabold text-white">종결기록 저장</button></section>`}).join('')||empty('상담완료 또는 종결 상태의 사례가 없습니다.')}</div>`)
}
function monthKey(date){return String(date||'').slice(0,7)||'미정'}
function countBy(items,getKey){return items.reduce((acc,item)=>{const key=getKey(item)||'기타';acc[key]=(acc[key]||0)+1;return acc},{})}
function statBars(obj,maxItems=8){const rows=Object.entries(obj).sort((a,b)=>b[1]-a[1]).slice(0,maxItems),max=Math.max(1,...rows.map(x=>x[1]));return rows.length?`<div class="space-y-3">${rows.map(([k,v])=>`<div><div class="flex justify-between text-xs"><span class="font-bold text-slate-600">${esc(k)}</span><span class="font-extrabold">${v}건</span></div><div class="mt-1 h-2 overflow-hidden rounded-full bg-slate-100"><div class="h-full rounded-full bg-slate-900" style="width:${Math.max(5,Math.round(v/max*100))}%"></div></div></div>`).join('')}</div>`:'<p class="text-sm text-slate-400">집계할 데이터가 없습니다.</p>'}
function statisticsView(){
  const active=state.reservations.filter(r=>normalizeStatus(r.status)!=='예약취소');
  const total=active.length;
  const completed=active.filter(r=>['상담완료','종결'].includes(normalizeStatus(r.status))).length;
  const terminated=active.filter(r=>normalizeStatus(r.status)==='종결').length;
  const monthCounts=countBy(active,r=>monthKey(r.date));
  const programCounts=countBy(active,r=>programBaseName(r.program));
  const methodCounts=countBy(active,r=>counselingMethodKey(r.type));
  const testCounts={};active.forEach(r=>requestedTests(r).forEach(t=>{const k=shortTestName(t);testCounts[k]=(testCounts[k]||0)+1}));
  const recentMonths=Object.entries(monthCounts).sort((a,b)=>String(b[0]).localeCompare(String(a[0]))).slice(0,6).reverse();
  return layout(`<div class="grid grid-cols-2 gap-4 xl:grid-cols-6 mb-8">${card('전체 예약',total+'건','취소 제외','📅','blue')}${card('상담 완료',completed+'건',total?Math.round(completed/total*100)+'%':'0%','✅','emerald')}${card('종결 사례',terminated+'건','종결기록 관리','🏁','orange')}${card('검사결과',state.resultUploads.length+'건','업로드','🧠','purple')}${card('결과보고서',state.reports.length+'건','저장됨','📄','orange')}${card('AI 마음체크',state.intakes.length+'건','누적','🤖','purple')}</div><div class="grid grid-cols-1 gap-5 xl:grid-cols-2"><section class="rounded-[2rem] border border-slate-100 bg-white p-6 shadow-sm"><h2 class="text-lg font-extrabold">최근 6개월 예약</h2><p class="mt-1 text-xs text-slate-400">예약일 기준 월별 건수</p><div class="mt-5 grid grid-cols-6 items-end gap-3 h-52">${recentMonths.length?recentMonths.map(([m,v])=>{const max=Math.max(...recentMonths.map(x=>x[1]),1);return `<div class="flex h-full flex-col justify-end text-center"><p class="mb-2 text-xs font-extrabold">${v}</p><div class="mx-auto w-full max-w-10 rounded-t-xl bg-emerald-500" style="height:${Math.max(12,Math.round(v/max*150))}px"></div><p class="mt-2 text-[10px] text-slate-400">${esc(m)}</p></div>`}).join(''):'<p class="col-span-6 text-sm text-slate-400">예약 데이터가 없습니다.</p>'}</div></section><section class="rounded-[2rem] border border-slate-100 bg-white p-6 shadow-sm"><h2 class="text-lg font-extrabold">프로그램별 이용</h2><p class="mt-1 text-xs text-slate-400">기본 프로그램 기준</p><div class="mt-5">${statBars(programCounts)}</div></section><section class="rounded-[2rem] border border-slate-100 bg-white p-6 shadow-sm"><h2 class="text-lg font-extrabold">심리검사별 신청</h2><p class="mt-1 text-xs text-slate-400">기본검사와 추가검사 포함</p><div class="mt-5">${statBars(testCounts)}</div></section><section class="rounded-[2rem] border border-slate-100 bg-white p-6 shadow-sm"><h2 class="text-lg font-extrabold">상담방식별 이용</h2><p class="mt-1 text-xs text-slate-400">장소 조율·찾아가는·화상·AI</p><div class="mt-5">${statBars(methodCounts)}</div></section></div>`)
}
function toggleOperatingMethod(method,checked){
  const settings=getOperatingSettings();
  const set=new Set(settings.enabledMethods||[]);
  checked?set.add(method):set.delete(method);
  settings.enabledMethods=[...set];
  save('modumam_operating_settings',settings);refreshOperatingSettings();render();
}
function collectProgramTests(id){return String(document.getElementById(id)?.value||'').split(',').map(v=>v.trim()).filter(Boolean)}
function saveOperatingSettings(){
  const settings={
    ...getOperatingSettings(),
    centerName:document.getElementById('setting-center-name').value.trim()||DEFAULT_OPERATING_SETTINGS.centerName,
    counselorName:document.getElementById('setting-counselor-name').value.trim(),
    contactMessage:document.getElementById('setting-contact-message').value.trim(),
    openTime:document.getElementById('setting-open-time').value||'09:00',
    closeTime:document.getElementById('setting-close-time').value||'18:00',
    intervalMinutes:Number(document.getElementById('setting-interval').value)||30,
    autoRules:document.getElementById('setting-auto-rules').checked,
    aiApprovalRequiresReport:document.getElementById('setting-ai-report').checked,
    programDefaultTests:{
      '개인 마음이음':collectProgramTests('setting-tests-personal'),
      '부부 마음이음':collectProgramTests('setting-tests-couple'),
      '부모-자녀 마음이음':collectProgramTests('setting-tests-parent')
    }
  };
  const start=Number(settings.openTime.replace(':','')),end=Number(settings.closeTime.replace(':',''));
  if(start>end){alert('운영 종료시간은 시작시간보다 늦어야 합니다.');return}
  if(!settings.enabledMethods.length){alert('상담방식을 한 가지 이상 활성화해 주세요.');return}
  save('modumam_operating_settings',settings);refreshOperatingSettings();alert('운영 설정을 저장했습니다. 회원 예약 화면에는 새로고침 후 반영됩니다.');render();
}

function collectBackupItems(){
  const items={};
  for(let i=0;i<localStorage.length;i++){
    const key=localStorage.key(i);
    if(key&&key.startsWith('modumam_')) items[key]=localStorage.getItem(key);
  }
  return items;
}
function backupSummary(items=collectBackupItems()){
  const keys=Object.keys(items);
  const bytes=keys.reduce((sum,key)=>sum+key.length+String(items[key]||'').length,0);
  return {count:keys.length,bytes,labels:{
    reservations:keys.filter(k=>k==='modumam_reservations').length,
    reports:keys.filter(k=>k==='modumam_reports').length,
    uploads:keys.filter(k=>k==='modumam_test_result_uploads').length,
    caseFiles:keys.filter(k=>k.startsWith('modumam_case_')).length,
    notes:keys.filter(k=>k.startsWith('modumam_counseling_notes_')).length
  }};
}
function downloadOperatingBackup(){
  const items=collectBackupItems();
  const payload={
    schema:'modumam-counseling-center-backup',
    version:1,
    exportedAt:new Date().toISOString(),
    origin:location.origin,
    summary:backupSummary(items),
    items
  };
  const stamp=new Date().toISOString().replace(/[:.]/g,'-');
  const blob=new Blob([JSON.stringify(payload,null,2)],{type:'application/json;charset=utf-8'});
  const url=URL.createObjectURL(blob),a=document.createElement('a');
  a.href=url;a.download=`modumam-backup-${stamp}.json`;document.body.appendChild(a);a.click();a.remove();URL.revokeObjectURL(url);
  localStorage.setItem('modumam_last_backup_at',new Date().toISOString());
  appendAuditLog('백업','전체 데이터',`${payload.summary.count}개 저장항목`);
  alert(`백업 파일을 만들었습니다.\n저장항목 ${payload.summary.count}개`);
  render();
}
function openBackupRestore(){const el=document.getElementById('backup-restore-file');if(el)el.click()}
async function restoreOperatingBackup(input){
  const file=input&&input.files&&input.files[0];if(!file)return;
  if(file.size>25*1024*1024){alert('백업 파일은 25MB 이하만 복원할 수 있습니다.');input.value='';return}
  try{
    const payload=JSON.parse(await file.text());
    if(!payload||payload.schema!=='modumam-counseling-center-backup'||!payload.items||typeof payload.items!=='object') throw new Error('지원하지 않는 백업 형식입니다.');
    const entries=Object.entries(payload.items).filter(([key,value])=>key.startsWith('modumam_')&&typeof value==='string');
    if(!entries.length) throw new Error('복원할 상담운영 데이터가 없습니다.');
    const mode=(document.getElementById('backup-restore-mode')||{}).value||'merge';
    const message=mode==='replace'
      ? `현재 상담운영 데이터를 지우고 백업 ${entries.length}개 항목으로 교체합니다. 계속할까요?`
      : `백업 ${entries.length}개 항목을 현재 데이터에 병합합니다. 같은 항목은 백업 내용으로 바뀝니다. 계속할까요?`;
    if(!confirm(message)){input.value='';return}
    if(mode==='replace'){
      const remove=[];for(let i=0;i<localStorage.length;i++){const key=localStorage.key(i);if(key&&key.startsWith('modumam_'))remove.push(key)}
      remove.forEach(key=>localStorage.removeItem(key));
    }
    entries.forEach(([key,value])=>localStorage.setItem(key,value));
    appendAuditLog('복원','전체 데이터',`${mode==='replace'?'교체':'병합'} · ${entries.length}개 항목 · ${file.name}`);
    alert('백업 복원이 완료되었습니다. 화면을 다시 불러옵니다.');
    location.reload();
  }catch(error){alert(`백업 복원에 실패했습니다.\n${error.message||'파일을 확인해 주세요.'}`)}finally{input.value=''}
}
function clearAuditLog(){if(!confirm('관리자 변경기록을 모두 삭제할까요? 상담·예약 데이터는 삭제되지 않습니다.'))return;localStorage.removeItem('modumam_admin_audit_log');appendAuditLog('초기화','관리자 변경기록');render()}
function auditLogView(limit=30){
  const logs=load('modumam_admin_audit_log',[]).slice(0,limit);
  if(!logs.length)return '<p class="text-sm text-slate-400">아직 저장된 관리자 변경기록이 없습니다.</p>';
  return `<div class="max-h-96 space-y-2 overflow-y-auto pr-1">${logs.map(log=>`<div class="rounded-2xl border border-slate-100 bg-slate-50 p-3"><div class="flex flex-wrap items-center justify-between gap-2"><p class="text-xs font-extrabold text-slate-700">${esc(log.action)} · ${esc(log.key)}</p><p class="text-[10px] text-slate-400">${esc(new Date(log.at).toLocaleString('ko-KR'))}</p></div>${log.detail?`<p class="mt-1 text-[11px] text-slate-500">${esc(log.detail)}</p>`:''}</div>`).join('')}</div>`;
}

function resetOperatingSettings(){if(!confirm('운영 설정을 기본값으로 되돌릴까요?'))return;save('modumam_operating_settings',DEFAULT_OPERATING_SETTINGS);refreshOperatingSettings();render()}
function settingsView(){const st=getOperatingSettings();const allMethods=['장소 조율(대면)','찾아가는(대면)','Zoom(비대면)','AI(비대면)'];return layout(`<div class="space-y-6 max-w-5xl">
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
        <p class="text-xs font-extrabold text-emerald-700">MODUMAM LAB</p>
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

function render(){ensureReservationIdentifiers();const root=document.getElementById('app');if(!state.authed){root.innerHTML=loginView();return}if(state.counselingModeId){root.innerHTML=counselingModeView();return}const views={dashboard:dashboardView,today:todayCounselingView,reservation:reservationView,results:resultUploadsView,interpretation:testInterpretationView,intake:intakeView,cases:casesView,journal:counselingJournalEntryView,counseling:counselingJournalView,termination:terminationView,documents:documentsView,report:reportView,members:membersView,statistics:statisticsView,settings:settingsView};root.innerHTML=(views[state.menu]||dashboardView)()}

// 다른 탭의 사용자 예약 저장을 관리자 화면에 자동 반영합니다.
window.addEventListener('storage',(event)=>{
  if(['modumam_reservations','modumam_reservation_inbox','modumam_last_reservation','modumam_intake_summaries','modumam_reports','modumam_test_result_uploads','modumam_ai_result_counseling_records'].includes(event.key)){
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
    if(event.data?.type==='ai-result-monitoring-updated'){
      state.aiResultCounselingRecords=load('modumam_ai_result_counseling_records',[]);
      if(state.menu==='intake')render();
    }
  });
}catch(e){}

syncSharedOperatingData();
render();
syncIndexedReservationData().then(changed=>{if(changed||state.reservationDbCount)render();requestReservationsFromUserPages()});