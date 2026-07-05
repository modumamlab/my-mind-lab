/* =========================================================
   모두의 마음연구소 관리자 모드
   파일 역할: 예약관리, 검사 진행관리, AI 접수기록, 보고서, 회원관리

   관리자 수정 위치
   1) 관리자 비밀번호: ADMIN_PASSWORD 검색
   2) 예약 상태값: STATUS 검색
   3) 결제 금액 계산: getPaymentInfo 검색
   4) 검사명 정리: normTest / requestedTests 검색
   5) 결과보고서 템플릿: modumamReportTemplate 검색
   6) 상담신청서·동의서 관리: documentsView 검색
   7) 내담자 전자차트: membersView 검색
========================================================= */

const ADMIN_PASSWORD="modumam2026";
const MAX_LOGIN_FAILS=5;
const LOCK_SECONDS=30;
const STATUS=["승인대기","예약확정","검사진행","결과작성","상담완료","예약취소"];
const FORM_LINKS={
  application:'https://modumam-lab.netlify.app/public/forms/application.pdf',
  consent:'https://modumam-lab.netlify.app/public/forms/consent.pdf',
  forms:'https://modumam-lab.netlify.app/public/forms/'
};
let state={authed:sessionStorage.getItem('modumam_admin_auth')==='true',menu:'dashboard',password:'',loginError:'',loginLockedUntil:Number(sessionStorage.getItem('modumam_admin_locked_until')||0),loginFailCount:Number(sessionStorage.getItem('modumam_admin_fail_count')||0),reservations:load('modumam_reservations',[{id:1,name:'김민우',phone:'010-1234-5678',type:'비대면 화상',date:'2026-06-25',time:'14:00',program:'개인 모두맘(TCI)',status:'예약확정',selectedTests:['TCI 기질 및 성격검사']}]),intakes:load('modumam_intake_summaries',[]),reports:load('modumam_reports',[]),reportForm:emptyReportForm()};
function emptyReportForm(){return{reservationId:'',clientName:'',phone:'',program:'',testType:'TCI',title:'',summary:'',strength:'',caution:'',plan:'',status:'작성중',approvedForClient:false}}
function load(k,f){try{const s=localStorage.getItem(k);return s?JSON.parse(s):f}catch(e){return f}}
function save(k,v){localStorage.setItem(k,JSON.stringify(v))}
function esc(v){return String(v||'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;')}
function statusClass(s){if(s==='상담완료')return'bg-emerald-100 text-emerald-700';if(s==='결과작성')return'bg-purple-100 text-purple-700';if(s==='검사진행')return'bg-indigo-100 text-indigo-700';if(s==='예약확정')return'bg-blue-100 text-blue-700';if(s==='예약취소')return'bg-rose-100 text-rose-700';return'bg-amber-100 text-amber-700'}
function getPaymentInfo(r){
  const type=String(r.type||'');
  const program=String(r.program||'');
  const face=['장소 조율(대면)','찾아가는(대면)','대면'].some(t=>type.includes(t));
  const base=face?80000:50000;
  const baseLabel=face?'상담비(기본검사 + 대면상담) 80,000원':'상담비(기본검사 + 비대면상담) 50,000원';
  const needsBasicExtra=program.includes('부부')||program.includes('부모-자녀');
  const basicExtra=needsBasicExtra?30000:0;
  const extras=r.extraTests||r.selectedTests||r.additionalTests||[];
  const freeKeywords=['무료','기본','문장완성검사','집-나무-사람','그림검사','우울검사','불안검사','스트레스검사'];
  let paid=Array.isArray(extras)?extras.filter(t=>!freeKeywords.some(k=>String(t).includes(k))).length:0;
  const extra=paid*30000;
  const parts=[baseLabel];
  if(needsBasicExtra) parts.push('기본검사 추가 30,000원');
  if(paid) parts.push('추가검사 '+paid+'건 '+extra.toLocaleString()+'원');
  return{total:(base+basicExtra+extra).toLocaleString()+'원',detail:parts.join(' + ')}
}
function requestedTests(r){let tests=[];const p=String(r.program||'');if(p.includes('부모-자녀'))tests.push('PAT 부모양육태도검사','KCDI 아동발달검사');else if(p.includes('부부'))tests.push('TCI 기질 및 성격검사 × 2');else if(p.includes('개인'))tests.push('TCI 기질 및 성격검사');const extras=r.extraTests||r.selectedTests||r.additionalTests||[];if(Array.isArray(extras))extras.forEach(t=>{const n=normTest(t);if(n)tests.push(String(t).includes('무료')?n+' (무료)':n)});return[...new Set(tests.filter(Boolean))]}
function clientKey(n,p){const phone=String(p||'').replace(/[^0-9]/g,'');return phone||String(n||'').trim()||'unknown'}
function buildClients(){const m={};state.reservations.forEach(r=>{const k=clientKey(r.name,r.phone);if(!m[k])m[k]={key:k,name:r.name||'이름 미입력',phone:r.phone||'',reservations:[],intakes:[],reports:[],notes:load('modumam_counseling_notes_'+k,[])};m[k].reservations.push(r)});state.intakes.forEach(i=>{const k=clientKey(i.name,i.phone);if(!m[k])m[k]={key:k,name:i.name||'이름 미입력',phone:i.phone||'',reservations:[],intakes:[],reports:[],notes:load('modumam_counseling_notes_'+k,[])};m[k].intakes.push(i)});state.reports.forEach(r=>{const same=Object.keys(m).find(k=>String(m[k].name).trim()===String(r.clientName).trim());const k=same||clientKey(r.clientName,r.phone);if(!m[k])m[k]={key:k,name:r.clientName||'이름 미입력',phone:r.phone||'',reservations:[],intakes:[],reports:[],notes:load('modumam_counseling_notes_'+k,[])};m[k].reports.push(r)});return Object.values(m)}
function findIntake(r){const p=String(r.phone||'').replace(/[^0-9]/g,'');const n=String(r.name||'').trim();return state.intakes.find(i=>{const ip=String(i.phone||'').replace(/[^0-9]/g,'');const iname=String(i.name||'').trim();return(p&&ip&&p===ip)||(n&&iname&&n===iname)})}
function hasReport(r){return state.reports.some(x=>String(x.clientName||'').trim()===String(r.name||'').trim())}
function progress(r){const tests=requestedTests(r),st=r.testStatuses||{},ai=!!findIntake(r);const sent=tests.some(t=>['발송완료','검사완료','결과확인'].includes(st[t]))||['검사진행','결과작성','상담완료'].includes(r.status);const doneT=tests.length&&tests.every(t=>['검사완료','결과확인'].includes(st[t]));const rep=hasReport(r)||['결과작성','상담완료'].includes(r.status);const done=r.status==='상담완료';const steps=[['예약',!!r.status&&r.status!=='예약취소'],['AI접수',ai],['검사발송',sent],['검사완료',doneT],['보고서',rep],['상담',done]];return{steps,pct:Math.round(steps.filter(s=>s[1]).length/steps.length*100),ai}}
function setMenu(m){state.menu=m;render()}
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
function updateReservation(id,patch){state.reservations=state.reservations.map(r=>r.id===id?{...r,...patch}:r);save('modumam_reservations',state.reservations);render()}
function updateTestStatus(id,t,s){state.reservations=state.reservations.map(r=>r.id===id?{...r,testStatuses:{...(r.testStatuses||{}),[t]:s}}:r);save('modumam_reservations',state.reservations);render()}
function markAllTestsSent(id){const r=state.reservations.find(x=>x.id===id);if(!r)return;const ts={};requestedTests(r).forEach(t=>ts[t]='발송완료');updateReservation(id,{testStatuses:ts,status:'검사진행'})}
function saveMemo(id){const el=document.getElementById('memo-'+id);if(!el)return;updateReservation(id,{adminMemo:el.value});alert('관리자 메모가 저장되었습니다.')}
function deleteReservation(id){if(!confirm('예약 기록을 삭제하시겠습니까?'))return;state.reservations=state.reservations.filter(r=>r.id!==id);save('modumam_reservations',state.reservations);render()}
function copyText(t){navigator.clipboard.writeText(t).then(()=>alert('복사되었습니다.'))}
function copyPaymentMessage(id){const r=state.reservations.find(x=>x.id===id);if(!r)return;const p=getPaymentInfo(r);copyText(`${r.name}님, 안녕하세요.\n모두의 마음연구소입니다.\n\n예약 신청이 확인되었습니다.\n\n■ 신청 프로그램\n${r.program}\n\n■ 상담 방식\n${r.type}\n\n■ 희망 일정\n${r.date} ${r.time}\n\n■ 결제 금액\n${p.total}\n${p.detail}\n\n■ 입금 계좌\n카카오뱅크 3333-21-2787124\n예금주 : 백인영\n\n입금 확인 후 검사 링크를 발송해 드리겠습니다.\n\n감사합니다.\n모두의 마음연구소`)}
function copyTestGuide(id){const r=state.reservations.find(x=>x.id===id);if(!r)return;copyText(`${r.name}님, 안녕하세요.\n모두의 마음연구소입니다.\n\n신청하신 심리검사 안내드립니다.\n\n■ 신청 프로그램\n${r.program}\n\n■ 진행 검사\n${requestedTests(r).map(t=>'- '+t).join('\n')}\n\n검사 링크는 순차적으로 발송드릴 예정입니다.\n검사 완료 후 해석상담 일정에 맞춰 결과를 함께 안내드리겠습니다.\n\n감사합니다.\n모두의 마음연구소`)}

function copyDocumentReminder(id){
  const r=state.reservations.find(x=>x.id===id);if(!r)return;
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
function openIntake(id){const r=state.reservations.find(x=>x.id===id);const i=r?findIntake(r):null;alert(i?(i.summary||'요약 없음'):'연결된 AI 접수면접 요약이 없습니다.')}
function reportCode(r){return r.code||('MR-'+String(r.id).slice(-6))}
function setReportFromReservation(id){const r=state.reservations.find(x=>x.id===id);if(!r)return;let tt=String(r.program).includes('부모-자녀')?'PAT · KCDI':'TCI';state.reportForm={...emptyReportForm(),reservationId:id,clientName:r.name||'',phone:r.phone||'',program:r.program||'',testType:tt,title:`${r.name||'내담자'}님 ${tt} 결과보고서`};state.menu='report';render()}
function templateReport(){applyDetailedTemplate()}
function createReport(e){e.preventDefault();const id=Date.now();const rep={...state.reportForm,id,code:'MR-'+String(id).slice(-6),reportType:'관리자용',approvedForClient:false,createdAt:new Date().toLocaleString(),version:1};state.reports=[rep,...state.reports];save('modumam_reports',state.reports);if(rep.reservationId){state.reservations=state.reservations.map(r=>r.id===rep.reservationId?{...r,status:'결과작성'}:r);save('modumam_reservations',state.reservations)}state.reportForm=emptyReportForm();alert('보고서가 저장되었습니다. 내담자 공개는 승인 버튼을 눌러야 활성화됩니다.');render()}
function deleteReport(id){if(!confirm('보고서를 삭제하시겠습니까?'))return;state.reports=state.reports.filter(r=>r.id!==id);save('modumam_reports',state.reports);render()}

function toggleReportApproval(id){
  state.reports=state.reports.map(r=>r.id===id?{...r,approvedForClient:!r.approvedForClient}:r);
  save('modumam_reports',state.reports);
  render();
}
function openReportPreview(id){
  printReport(id);
}

function copyReportGuide(id){const r=state.reports.find(x=>x.id===id);if(!r)return;copyText(`${r.clientName}님, 안녕하세요.
모두의 마음연구소입니다.

심리검사 결과보고서 확인이 가능하도록 등록되었습니다.

■ 보고서
${r.title}

홈페이지의 [결과확인] 메뉴에서 이름과 연락처를 입력하시면 확인하실 수 있습니다.

감사합니다.
모두의 마음연구소`)}
function printReport(id){const r=state.reports.find(x=>x.id===id);if(!r)return;const w=window.open('','_blank');w.document.write(`<html><head><title>${esc(r.title)}</title><style>body{font-family:Arial,sans-serif;padding:40px;line-height:1.7;color:#1e293b}h1{font-size:28px}h2{margin-top:28px;font-size:18px;border-bottom:1px solid #ddd;padding-bottom:8px}.meta{background:#f8fafc;padding:16px;border-radius:12px;margin:20px 0}.box{white-space:pre-wrap;border:1px solid #e2e8f0;padding:16px;border-radius:12px}</style></head><body><p style="font-size:12px;color:#047857;font-weight:bold;">MODUMAM LAB PSYCHOLOGICAL REPORT</p><h1>${esc(r.title)}</h1><div class="meta"><p><b>성명:</b> ${esc(r.clientName)}</p><p><b>프로그램:</b> ${esc(r.program)}</p><p><b>검사:</b> ${esc(r.testType)}</p><p><b>작성일:</b> ${esc(r.createdAt)}</p><p><b>결과확인 코드:</b> ${esc(reportCode(r))}</p></div><h2>종합 소견</h2><div class="box">${esc(r.summary)}</div><h2>강점 및 자원</h2><div class="box">${esc(r.strength)}</div><h2>주의점 및 어려움</h2><div class="box">${esc(r.caution)}</div><h2>상담 계획 및 제안</h2><div class="box">${esc(r.plan)}</div><script>window.print();<\/script></body></html>`);w.document.close()}
function saveCounselingNote(k){const m=document.getElementById('note-'+k),d=document.getElementById('date-'+k);if(!m||!m.value.trim()){alert('상담 메모를 입력해 주세요.');return}const sk='modumam_counseling_notes_'+k;const notes=load(sk,[]);notes.unshift({id:Date.now(),date:d.value||new Date().toISOString().slice(0,10),memo:m.value.trim(),createdAt:new Date().toLocaleString()});save(sk,notes);alert('상담 메모가 저장되었습니다.');render()}
function deleteCounselingNote(k,id){if(!confirm('상담 메모를 삭제하시겠습니까?'))return;const sk='modumam_counseling_notes_'+k;save(sk,load(sk,[]).filter(n=>n.id!==id));render()}
function todayReservations(){const t=new Date().toISOString().slice(0,10);return state.reservations.filter(r=>r.date===t)}
function navButton(k,l){return`<button onclick="setMenu('${k}')" class="shrink-0 px-4 py-2 rounded-full text-xs sm:text-sm font-extrabold ${state.menu===k?'bg-slate-900 text-white':'bg-slate-100 text-slate-600 hover:bg-slate-200'}">${l}</button>`}
function titleForMenu(){return({dashboard:'Dashboard',reservation:'심리검사 예약 CRM',cases:'케이스관리',intake:'AI 접수면접 관리',report:'결과보고서 관리',members:'내담자 전자차트',statistics:'운영 통계',documents:'신청서·동의서 관리',settings:'환경설정'})[state.menu]||'Dashboard'}
function layout(content){return`<main class="min-h-screen"><header class="sticky top-0 z-40 bg-white/95 backdrop-blur border-b border-slate-200"><div class="px-4 sm:px-8 py-4"><div class="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4"><div><p class="text-xs font-bold text-emerald-700">MODUMAM LAB ADMIN · 안정화버전 2026-07-04</p><h1 class="text-xl sm:text-2xl font-extrabold text-slate-900">${titleForMenu()}</h1></div><nav class="flex gap-2 overflow-x-auto pb-1">${navButton('dashboard','대시')}${navButton('reservation','예약·검사')}${navButton('documents','신청서')}${navButton('cases','케이스')}${navButton('intake','AI')}${navButton('report','보고서')}${navButton('members','전자차트')}${navButton('statistics','통계')}${navButton('settings','설정')}<button onclick="logout()" class="shrink-0 px-4 py-2 rounded-full text-xs sm:text-sm font-extrabold bg-rose-50 text-rose-600">로그아웃</button></nav></div></div></header><section class="p-4 sm:p-8">${content}</section></main>`}
function card(label,value,sub,icon,color){const map={blue:'bg-blue-50 text-blue-600',purple:'bg-purple-50 text-purple-600',orange:'bg-orange-50 text-orange-600',emerald:'bg-emerald-50 text-emerald-600'};return`<div class="bg-white rounded-[1.75rem] border border-slate-100 p-4 sm:p-6 shadow-sm flex items-center justify-between"><div><p class="text-xs font-extrabold text-slate-400 mb-2">${label}</p><p class="text-2xl sm:text-4xl font-extrabold text-slate-900">${value}</p><p class="text-[11px] text-slate-400 font-bold mt-2">${sub}</p></div><div class="${map[color]} w-12 h-12 sm:w-14 sm:h-14 rounded-2xl flex items-center justify-center text-2xl">${icon}</div></div>`}
function empty(t){return`<div class="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-8 text-center text-sm text-slate-400">${t}</div>`}
function taskBoard(){const rows=[['🔴','예약 승인 대기',state.reservations.filter(r=>!r.status||r.status==='승인대기').length],['🟡','검사 링크 발송',state.reservations.filter(r=>r.status==='예약확정').length],['🟢','검사 완료 확인',state.reservations.filter(r=>r.status==='검사진행').length],['🔵','결과보고서 작성',state.reservations.filter(r=>r.status==='결과작성').length],['🟣','오늘 상담',todayReservations().length],['⚫','상담 완료',state.reservations.filter(r=>r.status==='상담완료').length]];return rows.map(r=>`<button onclick="setMenu('reservation')" class="w-full flex items-center justify-between bg-slate-50 hover:bg-slate-100 rounded-2xl p-4 mb-3 transition"><span class="text-sm font-extrabold text-slate-700">${r[0]} ${r[1]}</span><span class="text-sm font-extrabold bg-white border border-slate-200 rounded-full px-3 py-1">${r[2]}</span></button>`).join('')}

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

function generateCaseDraft(caseId) {
  const c = buildCases().find(item => item.caseId === caseId);
  if (!c) return;

  const testText = c.tests.join(", ") || "검사 미입력";
  const intakeText = c.intake ? (c.intake.summary || c.intake.concern || "") : "";
  const reportText = c.reports.map(r => r.summary).filter(Boolean).join("\n");

  const draft = {
    complaint: c.res.program + " / " + (intakeText ? "AI접수 요약 참고" : "주호소 추가 입력 필요"),
    currentProblem: `현재 ${c.res.name}님 사례는 ${c.res.program}으로 접수되었으며, 실시 또는 신청된 검사는 ${testText}입니다. 상담에서는 검사 결과와 실제 호소 문제를 연결하여 현재 어려움의 양상을 구체화할 필요가 있습니다.`,
    trigger: "최근 생활사건, 관계 변화, 양육 스트레스, 발달 변화, 직장/가정 내 스트레스 등 촉발요인을 면담에서 확인합니다.",
    maintaining: "반복되는 사고·정서·행동 패턴, 양육태도와 발달특성의 부조화, 회피 또는 과잉통제, 의사소통 부족 등이 어려움을 유지하는 요인인지 확인합니다.",
    protective: "상담 동기, 가족의 관심, 기존 강점, 긍정적 관계 자원, 검사와 상담을 통해 이해하려는 태도를 보호요인으로 살펴봅니다.",
    strength: "현재 확인되는 강점은 변화 가능성, 자기이해 의지, 관계 회복 욕구, 실천 가능성입니다. 검사 결과에 따라 구체화가 필요합니다.",
    goal: "1) 현재 어려움 이해 2) 검사 결과 해석 3) 일상 속 실천전략 수립 4) 변화 점검 및 사후관리",
    intervention: "심리검사 해석상담, 정서 명명화, 기질 맞춤 전략, 양육코칭, 의사소통 연습, 실천과제 점검을 단계적으로 적용합니다."
  };

  save("modumam_case_formulation_" + caseId, draft);
  alert("사례개념화 초안이 생성되었습니다. 내용을 검토해 주세요.");
  render();
}


function casesView() {
  const cases = buildCases();

  return layout(`
    <div class="bg-white rounded-[2rem] border border-slate-100 p-6 shadow-sm">
      <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h2 class="text-xl font-extrabold">케이스관리</h2>
          <p class="text-sm text-slate-500 mt-1">예약 1건을 하나의 상담 사례로 보고, 검사·보고서·사례개념화·회기기록을 연결합니다.</p>
        </div>
        <span class="text-xs font-bold bg-emerald-50 text-emerald-700 px-3 py-1 rounded-full">${cases.length}건</span>
      </div>

      <div class="space-y-6">
        ${cases.map(c => {
          const f = c.formulation || {};
          return `
            <div class="rounded-[2rem] border border-slate-100 bg-slate-50 p-5 sm:p-6">
              <div class="flex flex-col xl:flex-row xl:items-start xl:justify-between gap-5 mb-5">
                <div>
                  <div class="flex flex-wrap items-center gap-2">
                    <p class="text-xl font-extrabold text-slate-900">${c.caseId}</p>
                    <span class="text-xs font-bold px-3 py-1 rounded-full ${statusClass(c.res.status)}">${c.res.status || "승인대기"}</span>
                  </div>
                  <p class="text-sm text-slate-500 mt-2">${c.res.name || "-"}님 · ${c.res.program || "-"} · ${c.res.date || "-"} ${c.res.time || ""}</p>
                </div>
                <div class="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
                  <div class="bg-white rounded-2xl border border-slate-100 p-3"><p class="text-xs text-slate-400 font-bold">검사</p><p class="text-xl font-extrabold">${c.tests.length}</p></div>
                  <div class="bg-white rounded-2xl border border-slate-100 p-3"><p class="text-xs text-slate-400 font-bold">AI접수</p><p class="text-xl font-extrabold">${c.intake ? "1" : "0"}</p></div>
                  <div class="bg-white rounded-2xl border border-slate-100 p-3"><p class="text-xs text-slate-400 font-bold">보고서</p><p class="text-xl font-extrabold">${c.reports.length}</p></div>
                  <div class="bg-white rounded-2xl border border-slate-100 p-3"><p class="text-xs text-slate-400 font-bold">회기</p><p class="text-xl font-extrabold">${c.sessions.length}</p></div>
                </div>
              </div>

              <div class="grid grid-cols-1 xl:grid-cols-2 gap-5">
                <div class="space-y-5">
                  <div class="bg-white rounded-2xl border border-slate-100 p-5">
                    <div class="flex items-center justify-between mb-3">
                      <h3 class="text-sm font-extrabold">검사 로드맵</h3>
                      <button onclick="generateCaseDraft('${c.caseId}')" class="bg-purple-600 text-white rounded-xl px-4 py-2 text-xs font-bold">AI 초안</button>
                    </div>
                    ${c.tests.length ? `
                      <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        ${c.tests.map(t => `
                          <div class="bg-slate-50 border border-slate-100 rounded-2xl p-3">
                            <p class="text-xs font-extrabold text-slate-700">${t}</p>
                            <p class="text-[11px] text-slate-400 mt-1">${(c.res.testStatuses || {})[t] || "미발송"}</p>
                          </div>
                        `).join("")}
                      </div>
                    ` : `<p class="text-sm text-slate-400">신청 검사가 없습니다.</p>`}
                  </div>

                  <div class="bg-white rounded-2xl border border-slate-100 p-5">
                    <h3 class="text-sm font-extrabold mb-3">사례개념화</h3>
                    <div class="space-y-3">
                      <textarea id="cf-complaint-${c.caseId}" rows="2" placeholder="주호소" class="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-sm">${f.complaint || ""}</textarea>
                      <textarea id="cf-current-${c.caseId}" rows="3" placeholder="현재 문제" class="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-sm">${f.currentProblem || ""}</textarea>
                      <textarea id="cf-trigger-${c.caseId}" rows="2" placeholder="촉발요인" class="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-sm">${f.trigger || ""}</textarea>
                      <textarea id="cf-maintaining-${c.caseId}" rows="2" placeholder="유지요인" class="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-sm">${f.maintaining || ""}</textarea>
                      <textarea id="cf-protective-${c.caseId}" rows="2" placeholder="보호요인" class="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-sm">${f.protective || ""}</textarea>
                      <textarea id="cf-strength-${c.caseId}" rows="2" placeholder="강점" class="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-sm">${f.strength || ""}</textarea>
                      <textarea id="cf-goal-${c.caseId}" rows="2" placeholder="상담목표" class="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-sm">${f.goal || ""}</textarea>
                      <textarea id="cf-intervention-${c.caseId}" rows="2" placeholder="개입전략" class="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-sm">${f.intervention || ""}</textarea>
                      <button onclick="saveCaseFormulation('${c.caseId}')" class="w-full bg-slate-900 text-white rounded-2xl py-3 text-sm font-extrabold">사례개념화 저장</button>
                    </div>
                  </div>
                </div>

                <div class="space-y-5">
                  <div class="bg-white rounded-2xl border border-slate-100 p-5">
                    <h3 class="text-sm font-extrabold mb-3">회기기록 추가</h3>
                    <input id="session-date-${c.caseId}" type="date" value="${new Date().toISOString().slice(0,10)}" class="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-sm mb-3" />
                    <input id="session-goal-${c.caseId}" placeholder="오늘 회기 목표" class="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-sm mb-3" />
                    <textarea id="session-content-${c.caseId}" rows="3" placeholder="오늘 상담 내용" class="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-sm mb-3"></textarea>
                    <textarea id="session-change-${c.caseId}" rows="2" placeholder="내담자 변화/반응" class="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-sm mb-3"></textarea>
                    <textarea id="session-task-${c.caseId}" rows="2" placeholder="마음 숙제/실천과제" class="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-sm mb-3"></textarea>
                    <textarea id="session-next-${c.caseId}" rows="2" placeholder="다음 회기 목표" class="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-sm mb-3"></textarea>
                    <button onclick="saveCaseSession('${c.caseId}')" class="w-full bg-emerald-600 text-white rounded-2xl py-3 text-sm font-extrabold">회기기록 저장</button>
                  </div>

                  <div class="bg-white rounded-2xl border border-slate-100 p-5">
                    <h3 class="text-sm font-extrabold mb-3">회기기록</h3>
                    ${c.sessions.length ? c.sessions.map(s => `
                      <div class="bg-slate-50 border border-slate-100 rounded-2xl p-4 mb-3">
                        <div class="flex justify-between mb-2">
                          <p class="text-xs font-bold text-emerald-700">${s.date || ""} · ${s.goal || "회기"}</p>
                          <button onclick="deleteCaseSession('${c.caseId}', ${s.id})" class="text-xs font-bold text-rose-600">삭제</button>
                        </div>
                        <p class="text-xs text-slate-600 whitespace-pre-line"><b>내용</b>\n${s.content || ""}</p>
                        ${s.change ? `<p class="text-xs text-slate-600 whitespace-pre-line mt-2"><b>변화</b>\n${s.change}</p>` : ""}
                        ${s.task ? `<p class="text-xs text-slate-600 whitespace-pre-line mt-2"><b>과제</b>\n${s.task}</p>` : ""}
                        ${s.next ? `<p class="text-xs text-slate-600 whitespace-pre-line mt-2"><b>다음 회기</b>\n${s.next}</p>` : ""}
                      </div>
                    `).join("") : `<p class="text-sm text-slate-400">저장된 회기기록이 없습니다.</p>`}
                  </div>

                  <div class="bg-slate-900 text-white rounded-2xl p-5">
                    <h3 class="text-sm font-extrabold mb-3">마음 타임라인</h3>
                    <div class="border-l border-white/20 pl-4 space-y-4">
                      <div><p class="text-xs font-bold text-emerald-300">${c.res.date || ""} · 예약</p><p class="text-xs text-slate-300">${c.res.program || ""}</p></div>
                      ${c.intake ? `<div><p class="text-xs font-bold text-emerald-300">AI 접수</p><p class="text-xs text-slate-300">접수면접 요약 저장</p></div>` : ""}
                      ${c.tests.map(t => `<div><p class="text-xs font-bold text-emerald-300">심리검사</p><p class="text-xs text-slate-300">${t}</p></div>`).join("")}
                      ${c.reports.map(r => `<div><p class="text-xs font-bold text-emerald-300">보고서</p><p class="text-xs text-slate-300">${r.title || ""}</p></div>`).join("")}
                      ${c.sessions.map(s => `<div><p class="text-xs font-bold text-emerald-300">${s.date || ""} · 회기</p><p class="text-xs text-slate-300">${s.goal || ""}</p></div>`).join("")}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          `;
        }).join("") || empty("케이스 데이터가 없습니다.")}
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
  const r=state.reservations.find(x=>x.id===id);if(!r)return;
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
  const r=state.reservations.find(x=>x.id===id);if(!r)return;
  const a=r.applicationForm||{}, c=r.consentForm||{};
  const w=window.open('','_blank');
  w.document.write(`<html><head><title>상담신청서_${esc(r.name)}</title><style>body{font-family:Arial,sans-serif;padding:40px;line-height:1.7;color:#1e293b}h1{font-size:24px}.box{border:1px solid #e2e8f0;border-radius:14px;padding:16px;margin:14px 0;background:#f8fafc}p{margin:6px 0}.sign{margin-top:28px;border-top:1px solid #ddd;padding-top:18px}</style></head><body><p style="font-size:12px;color:#047857;font-weight:bold;">MODUMAM LAB</p><h1>상담신청서 및 심리상담 동의 확인서</h1><div class="box"><p><b>성명:</b> ${esc(r.name)}</p><p><b>생년월일:</b> ${esc(a.birth)}</p><p><b>연락처:</b> ${esc(r.phone)}</p><p><b>이메일:</b> ${esc(a.email)}</p><p><b>선호 연락:</b> ${esc(a.contactMethod)}</p><p><b>소속/직업군:</b> ${esc(a.clientType)}</p></div><div class="box"><p><b>프로그램:</b> ${esc(r.program)}</p><p><b>상담 방식:</b> ${esc(r.type)}</p><p><b>희망 일정:</b> ${esc(r.date)} ${esc(r.time)}</p><p><b>선택 검사:</b> ${esc((r.selectedTests||r.extraTests||[]).join(', '))}</p></div><div class="box"><p><b>현재 가장 힘든 점:</b></p><p>${esc(a.concern)}</p><p><b>이전 상담/치료/검사 경험:</b> ${esc(a.counselingHistory)}</p><p><b>복용 중인 약:</b> ${esc(a.medication)}</p><p><b>진단/치료 중인 질환:</b> ${esc(a.diagnosis)}</p><p><b>최근 자해/자살 위험:</b> ${esc(a.risk)}</p></div><div class="box"><p><b>개인정보 수집·이용:</b> ${c.privacy?'동의':'미동의'}</p><p><b>심리검사/상담 및 비밀보장 예외:</b> ${c.counseling?'동의':'미동의'}</p><p><b>예약 변경/취소 및 노쇼 규정:</b> ${c.cancelPolicy?'동의':'미동의'}</p><p><b>동의일시:</b> ${esc(c.signedAt)}</p><p><b>문서버전:</b> ${esc(c.documentVersion)}</p></div><div class="sign"><p>작성자(전자서명): <b>${esc(c.signature)}</b></p><p>관리자 확인상태: ${esc(documentStatus(r))}</p></div><script>window.print();<\/script></body></html>`);
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
                <p class="text-xs text-slate-500 mt-1">${esc(r.phone)} · ${esc(a.email)} · ${esc(r.program)}</p>
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

function dashboardView(){const today=todayReservations();return layout(`<div class="grid grid-cols-2 gap-4 sm:gap-5 mb-8">${card('오늘 예약',today.length+'건','오늘 진행 예정','📅','blue')}${card('AI 접수면접',state.intakes.length+'건','저장된 접수 요약','🤖','purple')}${card('결과작성 대기',state.reservations.filter(r=>r.status==='결과작성'||r.status==='검사진행').length+'건','보고서 작성 필요','📝','orange')}${card('상담완료',state.reservations.filter(r=>r.status==='상담완료').length+'건','누적 완료','✅','emerald')}</div><div class="grid grid-cols-1 xl:grid-cols-3 gap-6"><div class="xl:col-span-2 bg-white rounded-[2rem] border border-slate-100 p-6 shadow-sm"><h2 class="text-lg font-extrabold mb-5">오늘 일정</h2>${today.length?today.map(r=>`<div class="flex items-center justify-between border-b border-slate-100 py-4 last:border-0"><div><p class="font-extrabold">${esc(r.time)||'--:--'} · ${esc(r.name)}님</p><p class="text-sm text-slate-500 mt-1">${esc(r.program)} / ${esc(r.type)}</p></div><span class="text-xs font-bold px-3 py-1 rounded-full ${statusClass(r.status)}">${r.status||'승인대기'}</span></div>`).join(''):empty('오늘 예약 일정이 없습니다.')}</div><div class="bg-white rounded-[2rem] border border-slate-100 p-6 shadow-sm"><h2 class="text-lg font-extrabold mb-5">상담 업무 보드</h2>${taskBoard()}</div></div>`)}
function reservationView(){return layout(`<div class="bg-white rounded-[2rem] border border-slate-100 shadow-sm overflow-hidden"><div class="p-6 border-b border-slate-100"><h2 class="text-xl font-extrabold">예약 · 검사 CRM</h2><p class="text-sm text-slate-500 mt-1">예약, AI접수, 검사발송, 보고서, 상담완료까지 진행률로 관리합니다.</p></div><div class="p-5 sm:p-6 space-y-5">${state.reservations.map(r=>{const p=progress(r),tests=requestedTests(r);return`<div class="rounded-[2rem] border border-slate-100 bg-slate-50 p-5 sm:p-6"><div class="flex flex-wrap items-center gap-2 mb-4"><p class="text-xl font-extrabold">${esc(r.name)}님</p><span class="text-xs font-bold px-3 py-1 rounded-full ${statusClass(r.status)}">${r.status||'승인대기'}</span>${p.ai?'<span class="text-xs font-bold px-3 py-1 rounded-full bg-purple-100 text-purple-700">AI접수 완료</span>':'<span class="text-xs font-bold px-3 py-1 rounded-full bg-slate-200 text-slate-500">AI접수 없음</span>'}${r.adminMemo?'<span class="text-xs font-bold px-3 py-1 rounded-full bg-amber-100 text-amber-700">메모 있음</span>':''}</div><div class="bg-white rounded-2xl border border-slate-100 p-4 mb-5"><div class="flex justify-between mb-2"><p class="text-xs font-bold text-slate-500">상담 진행률</p><p class="text-sm font-extrabold text-emerald-700">${p.pct}%</p></div><div class="h-3 bg-slate-100 rounded-full overflow-hidden"><div class="h-full bg-emerald-500 rounded-full" style="width:${p.pct}%"></div></div><div class="grid grid-cols-3 sm:grid-cols-6 gap-2 mt-4">${p.steps.map(s=>`<div class="rounded-xl px-2 py-2 text-center text-[11px] font-bold ${s[1]?'bg-emerald-50 text-emerald-700 border border-emerald-100':'bg-slate-50 text-slate-400 border border-slate-100'}">${s[1]?'✓':'□'} ${s[0]}</div>`).join('')}</div></div><div class="grid grid-cols-1 lg:grid-cols-4 gap-3 mb-4"><div class="bg-white rounded-2xl p-4 border border-slate-100"><p class="text-xs text-slate-400 font-bold">연락처</p><p class="font-bold mt-1">${esc(r.phone)}</p></div><div class="bg-white rounded-2xl p-4 border border-slate-100"><p class="text-xs text-slate-400 font-bold">프로그램</p><p class="font-bold mt-1">${esc(r.program)}</p></div><div class="bg-white rounded-2xl p-4 border border-slate-100"><p class="text-xs text-slate-400 font-bold">상담 방식</p><p class="font-bold mt-1">${esc(r.type)}</p></div><div class="bg-white rounded-2xl p-4 border border-slate-100"><p class="text-xs text-slate-400 font-bold">일정</p><p class="font-bold mt-1">${esc(r.date)} ${esc(r.time)}</p></div></div><div class="grid grid-cols-1 xl:grid-cols-3 gap-4"><div class="xl:col-span-2"><div class="bg-white rounded-2xl border border-slate-100 p-4"><div class="flex items-center justify-between mb-3"><h3 class="text-sm font-extrabold">신청 검사 및 발송 관리</h3><button onclick="markAllTestsSent(${r.id})" class="bg-indigo-50 text-indigo-700 border border-indigo-100 rounded-xl px-3 py-2 text-xs font-bold">전체 발송완료</button></div><div class="grid grid-cols-1 md:grid-cols-2 gap-3">${tests.length?tests.map(t=>`<div class="border border-slate-100 rounded-2xl p-4 bg-slate-50"><p class="text-sm font-extrabold">${esc(t)}</p><select onchange='updateTestStatus(${r.id}, ${JSON.stringify(t)}, this.value)' class="mt-3 w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold">${['미발송','발송완료','검사완료','결과확인'].map(st=>`<option value="${st}" ${(r.testStatuses||{})[t]===st?'selected':''}>${st}</option>`).join('')}</select></div>`).join(''):empty('신청된 검사가 없습니다.')}</div></div><div class="bg-white rounded-2xl border border-slate-100 p-4 mt-4"><div class="flex justify-between items-center mb-3"><div><h3 class="text-sm font-extrabold">관리자 메모</h3><p class="text-xs text-slate-400 mt-1">연락, 결제, 검사 발송, 상담 참고사항을 기록합니다.</p></div><button onclick="saveMemo(${r.id})" class="bg-slate-900 text-white rounded-xl px-4 py-2 text-xs font-bold">메모 저장</button></div><textarea id="memo-${r.id}" rows="3" class="w-full border border-slate-200 rounded-2xl px-4 py-3 text-sm resize-none" placeholder="예) 오전 연락 완료, 결제 확인 대기, TCI 먼저 발송 예정">${esc(r.adminMemo)}</textarea></div></div><div class="bg-white rounded-2xl border border-slate-100 p-4"><p class="text-xs font-bold text-slate-500 mb-2">예약 상태 변경</p><select onchange="updateReservation(${r.id},{status:this.value})" class="w-full border border-slate-200 rounded-2xl px-4 py-3 text-sm font-bold mb-3">${STATUS.map(st=>`<option value="${st}" ${(r.status||'승인대기')===st?'selected':''}>${st}</option>`).join('')}</select><div class="grid grid-cols-2 gap-2"><button onclick="copyPaymentMessage(${r.id})" class="bg-emerald-600 text-white rounded-2xl py-3 text-xs font-extrabold">결제안내</button><button onclick="copyTestGuide(${r.id})" class="bg-indigo-600 text-white rounded-2xl py-3 text-xs font-extrabold">검사안내</button><button onclick="copyDocumentReminder(${r.id})" class="bg-teal-600 text-white rounded-2xl py-3 text-xs font-extrabold">서류안내</button><button onclick="updateReservation(${r.id},{status:'검사진행'})" class="bg-slate-900 text-white rounded-2xl py-3 text-xs font-extrabold">검사발송</button><button onclick="setReportFromReservation(${r.id})" class="bg-purple-600 text-white rounded-2xl py-3 text-xs font-extrabold">보고서 작성</button><button onclick="openIntake(${r.id})" class="bg-white border border-purple-200 text-purple-700 rounded-2xl py-3 text-xs font-extrabold">AI요약</button><button onclick="updateReservation(${r.id},{status:'상담완료'})" class="bg-green-600 text-white rounded-2xl py-3 text-xs font-extrabold">상담완료</button><button onclick="deleteReservation(${r.id})" class="col-span-2 bg-white border border-rose-200 text-rose-700 rounded-2xl py-3 text-xs font-extrabold">삭제</button></div></div></div></div>`}).join('')||empty('예약이 없습니다.')}</div></div>`)}
function intakeView(){return layout(`<div class="grid grid-cols-1 xl:grid-cols-2 gap-6">${state.intakes.length?state.intakes.map(i=>`<div class="bg-white rounded-[2rem] border border-slate-100 p-6 shadow-sm"><div class="flex justify-between gap-3 mb-4"><div><p class="font-extrabold text-lg">${esc(i.name||'이름 미입력')}</p><p class="text-xs text-slate-500 mt-1">${esc(i.phone)} · ${esc(i.email)}</p><p class="text-xs text-slate-400 mt-1">${esc(i.date)}</p></div><span class="text-xs font-bold bg-amber-50 text-amber-700 px-3 py-1 rounded-full h-fit">${esc(i.status||'신규접수')}</span></div>${i.risk?`<p class="text-xs font-bold text-rose-600 bg-rose-50 border border-rose-100 rounded-2xl p-3 mb-4">위기 신호: ${esc(i.risk)}</p>`:''}<pre class="whitespace-pre-wrap text-xs leading-relaxed bg-slate-50 border border-slate-100 rounded-2xl p-4 max-h-96 overflow-auto">${esc(i.summary||'요약 없음')}</pre><button onclick='copyText(${JSON.stringify(i.summary||'')})' class="mt-4 text-xs font-bold border border-slate-200 rounded-xl px-4 py-2">요약 복사</button></div>`).join(''):empty('저장된 AI 접수면접 요약이 없습니다.')}</div>`)}

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

function reportView(){return layout(`<div class="grid grid-cols-1 xl:grid-cols-3 gap-6"><div class="bg-white rounded-[2rem] border border-slate-100 p-6 shadow-sm"><h2 class="text-xl font-extrabold mb-2">예약자 선택</h2><p class="text-sm text-slate-500 mb-5">예약자를 선택하면 보고서 정보가 자동 입력됩니다.</p><div class="space-y-3 max-h-[720px] overflow-auto">${state.reservations.map(r=>`<button onclick="setReportFromReservation(${r.id})" class="w-full text-left bg-slate-50 hover:bg-emerald-50 border border-slate-100 hover:border-emerald-200 rounded-2xl p-4"><p class="font-extrabold">${esc(r.name)}님</p><p class="text-xs text-slate-500 mt-1">${esc(r.program)}</p><p class="text-xs text-slate-400 mt-1">${esc(r.date)} ${esc(r.time)}</p></button>`).join('')||empty('예약자가 없습니다.')}</div></div><form onsubmit="createReport(event)" class="xl:col-span-2 bg-white rounded-[2rem] border border-slate-100 p-6 shadow-sm space-y-4"><div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"><div><h2 class="text-xl font-extrabold">관리자 결과보고서 작성</h2><p class="text-sm text-slate-500 mt-1">보고서는 하나만 작성하고, 승인된 보고서만 내담자 결과확인에 공개됩니다.</p></div><button type="button" onclick="applyDetailedTemplate()" class="bg-emerald-600 text-white rounded-2xl px-5 py-3 text-sm font-extrabold">템플릿 적용</button></div><div class="grid grid-cols-1 sm:grid-cols-2 gap-3"><input required value="${esc(state.reportForm.clientName)}" oninput="state.reportForm.clientName=this.value" placeholder="내담자 이름" class="border border-slate-200 rounded-2xl px-4 py-3 text-sm"/><input value="${esc(state.reportForm.phone)}" oninput="state.reportForm.phone=this.value" placeholder="연락처" class="border border-slate-200 rounded-2xl px-4 py-3 text-sm"/><input value="${esc(state.reportForm.program)}" oninput="state.reportForm.program=this.value" placeholder="프로그램명" class="border border-slate-200 rounded-2xl px-4 py-3 text-sm"/><select onchange="state.reportForm.testType=this.value" class="border border-slate-200 rounded-2xl px-4 py-3 text-sm">${['TCI','STS','PAT','KCDI','PAT · KCDI','MMPI-2','SCT','HTP','통합'].map(t=>`<option ${state.reportForm.testType===t?'selected':''}>${t}</option>`).join('')}</select></div><div class="bg-amber-50 border border-amber-100 rounded-2xl p-4 text-sm text-amber-800 font-bold">현재 보고서는 관리자용 원본으로 저장됩니다. 저장 후 [내담자 공개 승인]을 누른 보고서만 내담자가 이름과 연락처로 확인할 수 있습니다.</div><input required value="${esc(state.reportForm.title)}" oninput="state.reportForm.title=this.value" placeholder="보고서 제목" class="w-full border border-slate-200 rounded-2xl px-4 py-3 text-sm"/><textarea required rows="6" oninput="state.reportForm.summary=this.value" placeholder="종합 소견" class="w-full border border-slate-200 rounded-2xl px-4 py-3 text-sm">${esc(state.reportForm.summary)}</textarea><textarea rows="5" oninput="state.reportForm.strength=this.value" placeholder="강점 및 자원" class="w-full border border-slate-200 rounded-2xl px-4 py-3 text-sm">${esc(state.reportForm.strength)}</textarea><textarea rows="5" oninput="state.reportForm.caution=this.value" placeholder="주의점 및 어려움" class="w-full border border-slate-200 rounded-2xl px-4 py-3 text-sm">${esc(state.reportForm.caution)}</textarea><textarea rows="5" oninput="state.reportForm.plan=this.value" placeholder="상담 계획 및 권장사항" class="w-full border border-slate-200 rounded-2xl px-4 py-3 text-sm">${esc(state.reportForm.plan)}</textarea><button class="w-full bg-slate-900 text-white rounded-2xl py-4 text-sm font-extrabold">보고서 저장</button></form><div class="xl:col-span-3 bg-white rounded-[2rem] border border-slate-100 p-6 shadow-sm"><h2 class="text-xl font-extrabold mb-2">저장된 보고서</h2><p class="text-sm text-slate-500 mb-5">관리자가 공개 승인한 보고서만 내담자에게 표시됩니다.</p><div class="grid grid-cols-1 xl:grid-cols-2 gap-4">${state.reports.map(r=>`<div class="border border-slate-100 rounded-2xl p-5 bg-slate-50"><div class="flex justify-between gap-3"><div><p class="font-extrabold">${esc(r.clientName)} · ${esc(r.testType)}</p><p class="text-xs text-slate-500 mt-1">${esc(r.title)}</p><p class="text-xs text-slate-400 mt-1">${esc(r.createdAt)}</p></div><span class="text-[11px] font-bold rounded-full px-3 py-1 h-fit ${r.approvedForClient?'bg-emerald-100 text-emerald-700':'bg-slate-200 text-slate-600'}">${r.approvedForClient?'내담자 공개':'비공개'}</span></div><pre class="whitespace-pre-wrap text-xs bg-white rounded-xl p-3 mt-3 max-h-40 overflow-auto border border-slate-100">${esc(r.summary)}</pre><div class="grid grid-cols-2 sm:grid-cols-5 gap-2 mt-4"><button onclick="toggleReportApproval(${r.id})" class="${r.approvedForClient?'bg-slate-600':'bg-emerald-600'} text-white rounded-xl py-2 text-xs font-bold">${r.approvedForClient?'공개취소':'내담자 공개 승인'}</button><button onclick="copyReportGuide(${r.id})" class="bg-emerald-50 text-emerald-700 border border-emerald-100 rounded-xl py-2 text-xs font-bold">안내복사</button><button onclick="printReport(${r.id})" class="bg-orange-500 text-white rounded-xl py-2 text-xs font-extrabold">PDF/인쇄</button><button onclick='copyText(${JSON.stringify(r.summary||'')})' class="bg-white border border-slate-200 rounded-xl py-2 text-xs font-bold">요약복사</button><button onclick="deleteReport(${r.id})" class="bg-white border border-rose-200 text-rose-700 rounded-xl py-2 text-xs font-bold">삭제</button></div></div>`).join('')||empty('저장된 보고서가 없습니다.')}</div></div></div>`)}
function membersView(){const clients=buildClients();return layout(`<div class="bg-white rounded-[2rem] border border-slate-100 p-6 shadow-sm"><div class="flex items-center justify-between gap-4 mb-6"><div><h2 class="text-xl font-extrabold">내담자 전자차트</h2><p class="text-sm text-slate-500 mt-1">한 명의 내담자별 예약, 신청서·동의서, AI 접수, 검사, 마음기록, 회기기록, 사례개념화를 한 화면에서 확인합니다.</p></div><span class="text-xs font-bold bg-emerald-50 text-emerald-700 px-3 py-1 rounded-full">${clients.length}명</span></div><div class="space-y-6">${clients.map(c=>{const tests=[...new Set(c.reservations.flatMap(r=>requestedTests(r)))],memos=c.reservations.filter(r=>r.adminMemo);return`<div class="rounded-[2rem] border border-slate-100 bg-slate-50 p-5 sm:p-6"><div class="flex flex-wrap items-center gap-2 mb-4"><p class="text-xl font-extrabold">👤 ${esc(c.name)}님</p><span class="text-xs font-bold bg-white border border-slate-200 rounded-full px-3 py-1">${esc(c.phone||'연락처 없음')}</span></div><div class="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-5"><div class="bg-white rounded-2xl p-4 border border-slate-100"><p class="text-xs text-slate-400 font-bold">예약</p><p class="text-2xl font-extrabold">${c.reservations.length}</p></div><div class="bg-white rounded-2xl p-4 border border-slate-100"><p class="text-xs text-slate-400 font-bold">AI접수</p><p class="text-2xl font-extrabold">${c.intakes.length}</p></div><div class="bg-white rounded-2xl p-4 border border-slate-100"><p class="text-xs text-slate-400 font-bold">검사</p><p class="text-2xl font-extrabold">${tests.length}</p></div><div class="bg-white rounded-2xl p-4 border border-slate-100"><p class="text-xs text-slate-400 font-bold">보고서</p><p class="text-2xl font-extrabold">${c.reports.length}</p></div><div class="bg-white rounded-2xl p-4 border border-slate-100"><p class="text-xs text-slate-400 font-bold">회기/상담메모</p><p class="text-2xl font-extrabold">${c.notes.length}</p></div></div><div class="bg-white rounded-2xl border border-slate-100 p-4 mb-5"><h3 class="text-sm font-extrabold mb-3">진행 체크리스트</h3><div class="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs font-bold">${['회원','AI접수','예약/결제','검사','신청서','동의서','상담','결과'].map((label,idx)=>{const done=idx===0|| (label==='AI접수'&&c.intakes.length>0) || (label==='예약/결제'&&c.reservations.some(r=>['예약확정','검사진행','결과작성','상담완료'].includes(r.status))) || (label==='검사'&&tests.length>0) || (label==='상담'&&c.notes.length>0) || (label==='결과'&&c.reports.length>0);return `<span class="rounded-full px-3 py-2 text-center ${done?'bg-emerald-50 text-emerald-700 border border-emerald-100':'bg-slate-50 text-slate-400 border border-slate-100'}">${done?'●':'○'} ${label}</span>`}).join('')}</div></div><div class="grid grid-cols-1 xl:grid-cols-2 gap-5"><div class="space-y-5"><div class="bg-white rounded-2xl border border-slate-100 p-5"><h3 class="text-sm font-extrabold mb-3">예약이력</h3>${c.reservations.length?c.reservations.map(r=>`<div class="border-b border-slate-100 last:border-0 py-3"><p class="text-sm font-bold">${esc(r.date)} ${esc(r.time)} · ${esc(r.program)}</p><p class="text-xs text-slate-400 mt-1">${esc(r.type)} · ${esc(r.status||'승인대기')}</p></div>`).join(''):'<p class="text-sm text-slate-400">예약이력이 없습니다.</p>'}</div><div class="bg-white rounded-2xl border border-slate-100 p-5"><h3 class="text-sm font-extrabold mb-3">신청 검사</h3>${tests.length?`<div class="flex flex-wrap gap-2">${tests.map(t=>`<span class="text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-100 rounded-full px-3 py-1">${esc(t)}</span>`).join('')}</div>`:'<p class="text-sm text-slate-400">신청 검사가 없습니다.</p>'}</div><div class="bg-white rounded-2xl border border-slate-100 p-5"><h3 class="text-sm font-extrabold mb-3">관리자 메모</h3>${memos.length?memos.map(r=>`<div class="bg-amber-50 border border-amber-100 rounded-2xl p-3 mb-2"><p class="text-xs font-bold text-amber-700">${esc(r.date)} · ${esc(r.program)}</p><p class="text-xs text-slate-600 whitespace-pre-line mt-1">${esc(r.adminMemo)}</p></div>`).join(''):'<p class="text-sm text-slate-400">관리자 메모가 없습니다.</p>'}</div></div><div class="space-y-5"><div class="bg-white rounded-2xl border border-slate-100 p-5"><h3 class="text-sm font-extrabold mb-3">상담 메모 추가</h3><input id="date-${c.key}" type="date" value="${new Date().toISOString().slice(0,10)}" class="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-sm mb-3"/><textarea id="note-${c.key}" rows="4" placeholder="주호소, 상담 중 확인된 내용, 다음 회기 계획을 기록하세요." class="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-sm resize-none"></textarea><button onclick="saveCounselingNote('${c.key}')" class="w-full mt-3 bg-slate-900 text-white rounded-2xl py-3 text-sm font-extrabold">상담 메모 저장</button><div class="mt-5 space-y-3">${c.notes.length?c.notes.map(n=>`<div class="bg-slate-50 border border-slate-100 rounded-2xl p-4"><div class="flex justify-between mb-2"><p class="text-xs font-bold text-emerald-700">${esc(n.date)}</p><button onclick="deleteCounselingNote('${c.key}',${n.id})" class="text-xs font-bold text-rose-600">삭제</button></div><p class="text-xs text-slate-600 whitespace-pre-line">${esc(n.memo)}</p></div>`).join(''):'<p class="text-sm text-slate-400">저장된 상담 메모가 없습니다.</p>'}</div></div><div class="bg-white rounded-2xl border border-slate-100 p-5"><h3 class="text-sm font-extrabold mb-3">결과보고서</h3>${c.reports.length?c.reports.map(r=>`<div class="border-b border-slate-100 last:border-0 py-3"><div class="flex items-start justify-between gap-3"><div><p class="text-sm font-bold">${esc(r.testType)} · ${esc(r.title)}</p><p class="text-xs text-slate-400 mt-1">${esc(r.createdAt)} · ${r.approvedForClient?'내담자 공개':'비공개'}</p></div><div class="flex gap-1 shrink-0"><button onclick="printReport(${r.id})" class="text-[11px] font-bold bg-orange-500 text-white rounded-lg px-2 py-1">PDF</button><button onclick="toggleReportApproval(${r.id})" class="text-[11px] font-bold ${r.approvedForClient?'bg-slate-200 text-slate-700':'bg-emerald-600 text-white'} rounded-lg px-2 py-1">${r.approvedForClient?'취소':'승인'}</button></div></div></div>`).join(''):'<p class="text-sm text-slate-400">저장된 보고서가 없습니다.</p>'}</div></div></div></div>`}).join('')||empty('회원 데이터가 없습니다.')}</div></div>`)}
function statisticsView(){const total=state.reservations.length,complete=state.reservations.filter(r=>r.status==='상담완료').length;return layout(`<div class="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5 mb-8">${card('전체 예약',total+'건','누적','📅','blue')}${card('상담 완료율',total?Math.round(complete/total*100)+'%':'0%','상담완료 기준','✅','emerald')}${card('AI 접수',state.intakes.length+'건','누적 접수','🤖','purple')}${card('보고서',state.reports.length+'건','저장됨','📝','orange')}</div><div class="bg-white rounded-[2rem] border border-slate-100 p-6 shadow-sm"><h2 class="text-xl font-extrabold mb-4">통계 준비중</h2><p class="text-sm text-slate-500">프로그램별 예약, 월별 상담, 재예약률 통계를 확장할 수 있습니다.</p></div>`)}
function settingsView(){return layout(`<div class="bg-white rounded-[2rem] border border-slate-100 p-6 shadow-sm max-w-3xl"><h2 class="text-xl font-extrabold mb-4">환경설정</h2><p class="text-sm text-slate-500 leading-relaxed">현재 버전은 브라우저 localStorage 기반 관리자입니다. 같은 브라우저에서 사용자 예약 데이터와 관리자 데이터가 연결됩니다.</p><div class="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-6"><button onclick="copyText(JSON.stringify(localStorage,null,2))" class="border border-slate-200 rounded-2xl py-3 text-sm font-bold">localStorage 백업 복사</button><button onclick="location.href='/'" class="border border-slate-200 rounded-2xl py-3 text-sm font-bold">사용자 페이지로 이동</button></div></div>`)}
function loginView(){const locked=state.loginLockedUntil&&Date.now()<state.loginLockedUntil;const remain=locked?Math.ceil((state.loginLockedUntil-Date.now())/1000):0;return`<div class="min-h-screen bg-slate-950 flex items-center justify-center p-4"><form onsubmit="login(event)" class="bg-white rounded-[2rem] w-full max-w-md p-8 shadow-2xl"><p class="text-xs font-bold text-emerald-700 mb-2">MODUMAM LAB ADMIN · 보안 로그인</p><h1 class="text-3xl font-extrabold text-slate-900 mb-3">관리자 로그인</h1><p class="text-sm text-slate-500 mb-6">관리자 비밀번호 입력 후 관리자 시스템으로 이동합니다.</p><input type="password" autofocus placeholder="관리자 비밀번호" oninput="state.password=this.value" ${locked?'disabled':''} class="w-full bg-slate-50 border border-slate-200 px-4 py-4 rounded-2xl text-sm outline-none focus:ring-4 focus:ring-emerald-100 focus:border-emerald-500 disabled:opacity-50"/>${state.loginError?`<div class="mt-3 bg-rose-50 border border-rose-100 text-rose-700 rounded-2xl p-4 text-sm font-bold">${esc(state.loginError)}</div>`:''}${locked?`<div class="mt-3 bg-amber-50 border border-amber-100 text-amber-700 rounded-2xl p-4 text-sm font-bold">잠금 해제까지 ${remain}초</div>`:''}<button ${locked?'disabled':''} class="w-full mt-5 bg-slate-900 hover:bg-slate-800 text-white rounded-2xl py-4 text-sm font-extrabold disabled:opacity-50">로그인</button><button type="button" onclick="location.href='/'" class="w-full mt-3 border border-slate-200 rounded-2xl py-4 text-sm font-bold text-slate-600 hover:bg-slate-50">사용자 페이지로 돌아가기</button></form></div>`}
function render(){const root=document.getElementById('app');if(!state.authed){root.innerHTML=loginView();return}const views={dashboard:dashboardView,reservation:reservationView,cases:casesView,documents:documentsView,intake:intakeView,report:reportView,members:membersView,statistics:statisticsView,settings:settingsView};root.innerHTML=(views[state.menu]||dashboardView)()}
render();
