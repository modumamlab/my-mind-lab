// MML shared integrated report renderer
// MML REPORT ENGINE v3 — 상담자용/내담자용 출력 전용 엔진
const jsonResponse=(obj,statusCode=200)=>({statusCode,headers:{'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'Content-Type','Access-Control-Allow-Methods':'POST, OPTIONS','Content-Type':'application/json; charset=utf-8'},body:JSON.stringify(obj)});
const clean=(v,max=30000)=>String(v||'').trim().slice(0,max);
const esc=(v)=>clean(v).replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
const nl=(v)=>esc(v).replace(/\n/g,'<br>');
const blocks=(v)=>clean(v).split(/\n{2,}/).map(x=>x.trim()).filter(Boolean).map(x=>`<p>${nl(x)}</p>`).join('');
const listHtml=(v)=>{const items=clean(v).split(/\n+/).map(x=>x.replace(/^[-•*\d.)\s]+/,'').trim()).filter(Boolean);return items.length>1?`<ul class="list">${items.map(x=>`<li>${esc(x)}</li>`).join('')}</ul>`:`<p>${nl(v)}</p>`};
const TECH_KEYS=/\b(?:resultSummary|overview|interpretationBasis|interpretation|strengths|focus|confidence|reasoning|clinicalNote|rawFacts|sourceSummary|coreFindings|dailyMeaning|helpfulDirections)\b\s*[:：]?/gi;
const clientSafe=(v)=>clean(v)
  .replace(TECH_KEYS,'')
  // 내담자 공개본에는 원점수·T점수·백분위·척도코드가 출력되지 않도록 최종 안전 필터를 적용합니다.
  .replace(/\bT\s*(?:점수)?\s*[=:]?\s*\d+(?:\.\d+)?/gi,'')
  .replace(/\b\d+(?:\.\d+)?\s*T(?:점수)?\b/gi,'')
  .replace(/\b[A-Z][A-Z0-9-]{0,7}\s*[=:]\s*\d+(?:\.\d+)?\s*T?\b/gi,'')
  .replace(/(?:T점수|점수|백분위|원점수|표준점수|척도\s*코드|코드타입)\s*[=:]?\s*\d+(?:\.\d+)?(?:\s*점)?/gi,'')
  .replace(/(?:백분위|원점수|표준점수|척도\s*코드|코드타입)\s*[=:]?\s*[^,.;\n]*/gi,'')
  .replace(/\b[A-Z][A-Z0-9-]{0,5}\s*[↑↓]\b/g,'')
  .replace(/\(\s*\)/g,'')
  .replace(/[ \t]{2,}/g,' ')
  .replace(/\n\s+/g,'\n')
  .trim();
const clientField=(r,key,fallback='')=>clientSafe(r[key]||fallback);

const sentenceUnits=(v)=>clientSafe(v).replace(/\n+/g,' ').split(/(?<=[.!?다요함됨임])\s+|[•·]\s*/).map(x=>x.trim()).filter(x=>x.length>12);
const normWords=(v)=>new Set(clientSafe(v).toLowerCase().replace(/[^0-9a-z가-힣 ]/g,' ').split(/\s+/).filter(x=>x.length>1));
const similarity=(a,b)=>{const A=normWords(a),B=normWords(b);if(!A.size||!B.size)return 0;let hit=0;for(const x of A)if(B.has(x))hit++;return hit/Math.min(A.size,B.size)};
const distinctText=(value,used=[],maxSentences=6,fallback='')=>{
  const accepted=[];
  for(const sent of sentenceUnits(value)){
    if(accepted.length>=maxSentences)break;
    if([...used,...accepted].some(prev=>similarity(sent,prev)>=0.72))continue;
    accepted.push(sent);
  }
  if(!accepted.length&&fallback){
    for(const sent of sentenceUnits(fallback)){
      if(accepted.length>=maxSentences)break;
      if([...used,...accepted].some(prev=>similarity(sent,prev)>=0.72))continue;
      accepted.push(sent);
    }
  }
  return accepted.join(' ');
};

const REPORT_TEST_NAMES=[
  ['TCI','TCI 기질 및 성격검사'],['MMPI-2','MMPI-2 다면적인성검사'],['PAI','PAI 성격평가검사'],
  ['SCT','SCT 문장완성검사'],['HTP','HTP 집·나무·사람 그림검사'],['K-CDI','K-CDI 아동우울검사'],
  ['STS','STS 양육스트레스검사'],['PAT','PAT 부모양육태도검사'],['PHQ-9','PHQ-9 우울 선별검사'],['GAD-7','GAD-7 불안 선별검사']
];
const formatTestSections=(value)=>{
  let text=clientSafe(value).replace(/\r/g,' ').replace(/[ \t]+/g,' ').trim();
  text=text.replace(/\s*[■◆▶]\s*/g,'\n\n■ ');
  for(const [code,title] of REPORT_TEST_NAMES){
    const escaped=code.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
    const full=title.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
    const pattern=new RegExp(`(?:^|\\s|[,:;])(?:■\\s*)?(?:${full}|${escaped})(?:\\s*[:：-])?`,'gi');
    text=text.replace(pattern,`\n\n■ ${title}\n`);
  }
  return text.replace(/^[\s\n]+/,'').replace(/\n{3,}/g,'\n\n').trim();
};
const formatNumberedItems=(value)=>clientSafe(value).replace(/\r/g,' ').replace(/[ \t]+/g,' ').replace(/(?:^|\s)(\d{1,2})\s*[.．)]\s*/g,(m,n)=>`\n\n${n}.\n`).replace(/^[\s\n]+/,'').replace(/\n{3,}/g,'\n\n').trim();
const rich=(v)=>{const lines=clientSafe(v).split(/\n+/).map(x=>x.trim()).filter(Boolean);let html='',list=[];const flush=()=>{if(list.length){html+=`<ul class="list">${list.map(x=>`<li>${esc(x)}</li>`).join('')}</ul>`;list=[];}};for(const line of lines){if(/^#{1,3}\s+/.test(line)){flush();html+=`<h3 class="rich-head">${esc(line.replace(/^#{1,3}\s+/,''))}</h3>`;}else if(/^(핵심 근거|확인된 결과|의미|해석|해석상 주의|공통 근거|차이의 의미|현재 기능|보호요인|취약요인)\s*[:：]/.test(line)){flush();const [a,...rest]=line.split(/[:：]/);html+=`<p class="evidence-line"><b>${esc(a)}</b><span>${esc(rest.join(':').trim())}</span></p>`;}else if(/^[-•*]\s+/.test(line)){list.push(line.replace(/^[-•*]\s+/,''));}else{flush();html+=`<p>${esc(line)}</p>`;}}flush();return html||`<p>${nl(v)}</p>`};

const reportDate=(body={})=>{
  const raw=body.issuedAt||body.renderedAt||'';
  if(raw){
    const d=new Date(raw);
    if(!Number.isNaN(d.getTime())){
      return `${d.getFullYear()}.${String(d.getMonth()+1).padStart(2,'0')}.${String(d.getDate()).padStart(2,'0')}`;
    }
    const m=String(raw).match(/(20\d{2})[^0-9]?(\d{1,2})[^0-9]?(\d{1,2})/);
    if(m)return `${m[1]}.${String(m[2]).padStart(2,'0')}.${String(m[3]).padStart(2,'0')}`;
  }
  const parts=new Intl.DateTimeFormat('ko-KR',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date());
  const map=Object.fromEntries(parts.map(x=>[x.type,x.value]));
  return `${map.year}.${map.month}.${map.day}`;
};
const normalizedTests=(tests=[])=>[...new Set((Array.isArray(tests)?tests:[]).map(v=>clean(v,120)).filter(Boolean))];
const testsLabel=(tests=[])=>normalizedTests(tests).join(' · ')||'등록된 심리검사';

const programReportTitle=(program='',fallback='')=>{
  const p=clean(program,180);
  if(p.includes('부모-자녀')||p.includes('부모자녀'))return '부모-자녀 마음이음 종합보고서';
  if(p.includes('부부'))return '부부 마음이음 종합보고서';
  if(p.includes('개인'))return '개인 마음이음 종합보고서';
  return fallback||'심리검사 해석보고서';
};

const testsSentence=(tests=[])=>{const names=normalizedTests(tests);return names.length?`본 보고서는 ${names.join(', ')} 결과를 종합하여 현재의 심리적 특성과 적응 양상을 이해할 수 있도록 작성되었습니다.`:'본 보고서는 실시한 심리검사 결과를 종합하여 현재의 심리적 특성과 적응 양상을 이해할 수 있도록 작성되었습니다.'};

function css(){return `*{box-sizing:border-box}html,body{margin:0}body{background:#e9efec;color:#20322d;font-family:Pretendard,'Noto Sans KR',Arial,sans-serif;-webkit-print-color-adjust:exact;print-color-adjust:exact}.report{padding:18px 0}.page{position:relative;width:210mm;min-height:297mm;margin:0 auto 18px;background:#fff;padding:13mm 15mm 10mm;box-shadow:0 18px 55px rgba(24,61,49,.14);overflow:visible;display:flex;flex-direction:column}.page:before{content:'';position:absolute;left:0;top:0;width:100%;height:6mm;background:linear-gradient(90deg,#123f33 0 62%,#c89458 62% 74%,#edf2ef 74%)}.head{display:flex;justify-content:space-between;gap:22px;padding-top:5mm;padding-bottom:9px;border-bottom:1px solid #cad8d2}.brand-logo{display:flex;align-items:center;gap:9px;min-width:120px;justify-content:flex-end}.logo{font-weight:900;color:#123f33;border:1px solid #123f33;border-radius:50%;width:46px;height:46px;display:grid;place-items:center;letter-spacing:-.12em}.brand-logo span{font-size:8px;line-height:1.35;text-align:right;color:#123f33;font-weight:700}.kicker{margin:0 0 6px;font-size:8.5px;font-weight:800;letter-spacing:.17em;color:#a96e35}.head h1{margin:0;color:#123f33;font-size:25px;line-height:1.2}.sub{margin:6px 0 0;color:#71817a;font-size:9.8px;line-height:1.55}.test-summary{margin:5px 0 0;color:#53655d;font-size:8.4px;line-height:1.5;font-weight:600}.meta{display:grid;grid-template-columns:repeat(4,1fr);margin-top:11px;border:1px solid #d9e2de;border-radius:10px;overflow:hidden}.meta div{padding:8px 10px;background:#f8faf9;border-right:1px solid #d9e2de;min-height:50px}.meta div:last-child{border-right:0}.meta span{display:block;font-size:7.8px;color:#88968f}.meta b{display:block;margin-top:3px;font-size:9.8px}.hero{margin-top:14px;background:#123f33;color:#fff;border-radius:13px;padding:13px 17px}.hero small{color:#d6a369;font-weight:800;font-size:8px}.hero h2{margin:4px 0 6px;font-size:15px}.hero p{margin:0;font-size:10.2px;line-height:1.68}.section{margin-top:12px}.title{display:flex;gap:9px;align-items:flex-start;margin-bottom:7px}.title strong{font-family:Georgia,serif;font-size:17px;color:#a96e35;line-height:1}.title h2{margin:0;font-size:14px;color:#123f33;line-height:1.25}.title p{margin:2px 0 0;font-size:8px;color:#87948e}.panel{border-left:3px solid #a96e35;background:#f7f9f8;padding:10px 13px;margin-top:6px}.panel h3{margin:0 0 5px;font-size:10.5px;color:#123f33}.panel p,.box p{margin:0;font-size:9.2px;line-height:1.58}.panel p+p,.box p+p{margin-top:6px}.grid2{display:grid;grid-template-columns:1fr 1fr;gap:8px}.box{border:1px solid #dbe5e0;border-radius:11px;padding:10px 12px}.box h3{margin:0 0 5px;font-size:10.3px;color:#123f33}.page-one .grid2 .box{min-height:0}.accent{background:#eef6f2;border-color:#cfe3d9}.warm{background:#fbf3e9;border-color:#ead5b8}.evidence{white-space:pre-wrap;font-size:8.5px;line-height:1.5;color:#52645c}.list{margin:0;padding-left:16px}.list li{margin:0 0 6px;font-size:9.1px;line-height:1.5}.quote{border-left:4px solid #d6a369;background:#fffaf4;padding:11px 14px;border-radius:0 11px 11px 0}.quote p{font-size:9.8px;line-height:1.62}.micro{font-size:8.2px;color:#75857e;line-height:1.45;margin-top:5px}.inner{display:flex;justify-content:space-between;align-items:flex-end;padding-top:5mm;padding-bottom:8px;border-bottom:1px solid #cad8d2}.inner h2{margin:0;font-size:18px;color:#123f33}.inner span{font-size:8.5px;color:#71817a}.page-detail .section{margin-top:11px}.page-detail .box,.page-detail .panel{padding:9px 12px}.foot{position:static;display:flex;justify-content:space-between;border-top:1px solid #d9e2de;padding-top:6px;margin-top:auto;font-size:7.4px;color:#819089;break-inside:avoid;page-break-inside:avoid}.foot .brand{font-weight:700;letter-spacing:.05em;color:#687871}.supervisor{background:#123f33;color:#fff;border-radius:12px;padding:12px 15px}.supervisor h3{margin:0 0 6px;color:#d6a369;font-size:10.5px}.supervisor p{margin:0;font-size:9.5px;line-height:1.6}.interpretation-basis{margin-top:13px}.basis-grid .box{min-height:0}.profile-section{margin-top:14px}.profile-grid .box{min-height:0;padding:11px 13px}.profile-grid .box p{font-size:9.25px;line-height:1.62}.feature-box{min-height:0;padding:14px 16px!important}.feature-box p{font-size:9.7px;line-height:1.68}.integrated-section{margin-top:15px!important}.integrated-panel{padding:14px 16px!important}.integrated-panel p{font-size:9.8px;line-height:1.72}.direction-box{padding:14px 16px!important}.direction-box p,.summary-panel p{font-size:9.8px;line-height:1.72}.summary-panel{padding:14px 16px!important}.reading-note{padding:12px 14px!important}.page-understanding .section:first-of-type,.page-direction .section:first-of-type{margin-top:16px}.grid3{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}.v2-cover .head{padding-bottom:8px}.executive-hero{padding:14px 17px}.executive-hero p{font-size:9.8px;line-height:1.62}.summary-cards .box{min-height:122px;padding:11px 12px}.summary-cards .box p{font-size:8.7px;line-height:1.55}.compact-purpose{margin-top:10px}.slim-panel{border-left:3px solid #a96e35;background:#f7f9f8;padding:8px 11px}.slim-panel p{margin:0;font-size:8.5px;line-height:1.5}.rich-head{margin:10px 0 5px;color:#123f33;font-size:11px;border-bottom:1px solid #dbe5e0;padding-bottom:4px}.evidence-line{display:grid;grid-template-columns:76px 1fr;gap:8px;margin:5px 0!important}.evidence-line b{color:#a96e35;font-size:8.6px}.evidence-line span{font-size:9.2px;line-height:1.55}.rich-text{padding:12px 14px!important}.rich-text p{font-size:9.4px;line-height:1.68}.common-panel{padding:12px 14px!important}.difference-box{padding:12px 14px!important}.flow-grid{display:grid;grid-template-columns:1fr 20px 1fr 20px 1fr;align-items:stretch;gap:5px}.flow-card{border:1px solid #dbe5e0;border-radius:10px;padding:10px;background:#f9fbfa;min-height:125px}.flow-card.protective{background:#eef6f2;border-color:#cfe3d9}.flow-card span{display:block;color:#a96e35;font-size:8px;font-weight:800;letter-spacing:.08em;margin-bottom:5px}.flow-card p{margin:0;font-size:8.4px;line-height:1.52}.flow-arrow{display:grid;place-items:center;color:#a96e35;font-weight:800}.professional-note{min-height:105px}.page-cross .section{margin-top:10px}.signature-report .cover-head{display:flex;justify-content:space-between;gap:28px;padding-top:5mm;padding-bottom:11px;border-bottom:1px solid #cad8d2}.signature-report .opening{display:grid;grid-template-columns:46px 1fr;gap:15px;margin-top:19px;padding:17px 18px;background:#123f33;color:#fff;border-radius:14px}.signature-report .opening-no{margin:0;color:#d6a369;font-size:22px;font-family:Georgia,serif}.signature-report .opening h2{margin:0 0 8px;font-size:16px}.signature-report .opening p{margin:0;font-size:10.3px;line-height:1.72}.signature-report .purpose-grid{display:grid;grid-template-columns:1fr 1fr;gap:11px;margin-top:12px}.signature-report .purpose-grid>div{border:1px solid #dde6e2;border-radius:12px;padding:12px 13px}.signature-report .purpose-grid span{font-size:9px;font-weight:800;color:#b4783d}.signature-report .purpose-grid p{margin:7px 0 0;font-size:9.2px;line-height:1.62;color:#596a63}.signature-report .key-grid{display:grid;grid-template-columns:1fr 1fr;gap:11px;margin-top:12px}.signature-report .key-card{border-radius:13px;padding:14px 15px;min-height:104px}.signature-report .key-card.resource{background:#eef6f2;border:1px solid #cfe3d9}.signature-report .key-card.focus{background:#fbf3e9;border:1px solid #ead5b8}.signature-report .key-card h3{margin:0 0 7px;font-size:11px;color:#123f33}.signature-report .key-card p{margin:0;font-size:9.1px;line-height:1.6}.signature-report .section-title{display:flex;align-items:flex-start;gap:12px;margin-bottom:10px}.signature-report .section-title>p{margin:0;font-family:Georgia,serif;font-size:19px;color:#b4783d}.signature-report .section-title h2{margin:0;font-size:15px;color:#123f33}.signature-report .section-title span{display:block;margin-top:3px;font-size:8.5px;color:#87948e}.signature-report .profile-section{margin-top:15px}.signature-report .domain-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px}.signature-report .domain{display:grid;grid-template-columns:25px 1fr;gap:8px;padding:9px 10px;border-bottom:1px solid #dfe7e3}.signature-report .domain>span{font-family:Georgia,serif;color:#b4783d;font-size:11px}.signature-report .domain b{font-size:10.5px}.signature-report .domain p{margin:4px 0 0;font-size:8.6px;line-height:1.5;color:#66766f}.signature-report .detail-section{margin-top:17px}.signature-report .text-panel,.signature-report .test-summary-card{padding:13px 15px;border-left:3px solid #b4783d;background:#f7f9f8}.signature-report .test-summary-card h3{font-size:11px;color:#123f33;margin:10px 0 5px}.signature-report .test-summary-card h3:first-child{margin-top:0}.signature-report .text-panel p,.signature-report .test-summary-card p,.signature-report .two-way-card p,.signature-report .direction-card p,.signature-report .reading-note p,.signature-report .closing p{margin:0;font-size:9.6px;line-height:1.7}.signature-report .two-way-card{border:1px solid #dbe5e0;border-radius:11px;padding:13px 15px;background:#fff}.signature-report .direction-card{border-radius:12px;background:#eef6f2;padding:14px 16px;border:1px solid #cfe3d9}.signature-report .reading-note{margin-top:15px;padding:12px 14px;border:1px solid #e2e8e5;border-radius:11px}.signature-report .reading-note h3{margin:0 0 7px;font-size:10.5px;color:#123f33}.signature-report .reading-note p+p{margin-top:7px}.signature-report .closing{margin-top:13px;padding:14px 16px;background:#123f33;color:#fff;border-radius:12px}.signature-report .closing span{display:block;margin-bottom:7px;font-size:9px;color:#d6a369;font-weight:800;letter-spacing:.06em}.signature-report .rich-head{font-size:10.5px;margin:9px 0 5px;color:#123f33}.signature-report .evidence-line{display:grid;grid-template-columns:65px 1fr;gap:7px;margin-top:6px!important}.signature-report .evidence-line b{color:#b4783d}
@media print{html,body{width:210mm;height:auto;background:#fff}.report{padding:0}.page{width:210mm;min-height:297mm;height:297mm;margin:0;box-shadow:none;overflow:hidden;page-break-after:always;break-after:page;padding:13mm 15mm 8mm;display:flex;flex-direction:column}.page:last-child{page-break-after:auto;break-after:auto}.foot{position:static;margin-top:auto}.head,.inner,.hero,.title,.box,.panel,.quote,.supervisor,.flow-card,.meta{break-inside:avoid;page-break-inside:avoid}h1,h2,h3{break-after:avoid;page-break-after:avoid}p{orphans:3;widows:3}@page{size:A4;margin:0}}`;}

function pageHead(title,name){return `<header class="inner"><div><p class="kicker">MODUMAM MIND REPORT</p><h2>${esc(title)}</h2></div><span>${esc(name)}</span></header>`}
function foot(n,total,audience){return `<footer class="foot"><span class="brand">MODUMAMLAB</span><b>${n} / ${total}</b></footer>`}
function counselor(body){
  const r=body.report||{},name=body.clientName||'',date=reportDate(body),tests=testsLabel(body.tests||[]);
  const validity=r.counselorValidityJudgment||r.clinicalValidity;
  const current=r.counselorCurrentState||r.clinicalCurrentState;
  const trait=r.counselorTemperamentCharacter||r.clinicalTrait;
  const cross=r.counselorCrossInterpretation||[r.clinicalConvergence,r.clinicalDivergence].filter(Boolean).join('\n\n');
  const evidence=r.evidenceSummary;
  const formulation=r.counselorCaseFormulation5P||r.clinicalFormulation;
  const focus=r.counselorCounselingFocus;
  const questions=r.counselorInitialQuestions;
  const intervention=r.counselorInterventionGuide;
  const monitor=r.counselorMonitoringPoints;
  return `<main class="report">
  <article class="page"><header class="head"><div><p class="kicker">MODUMAM COUNSELOR REPORT</p><h1>심리평가 상담지원보고서</h1><p class="sub">검사 근거를 사례개념화와 상담계획으로 연결하는 상담자용 보고서</p></div><div class="brand-logo"><div class="logo">ㅁㄷㅁ</div><span>모두의 마음연구소</span></div></header><section class="meta"><div><span>성명</span><b>${esc(name)}</b></div><div><span>프로그램</span><b>${esc(body.program)}</b></div><div><span>발행일</span><b>${esc(date)}</b></div><div><span>실시검사</span><b>${esc(tests)}</b></div></section><section class="hero"><small>CLINICAL SYNTHESIS</small><h2>상담을 위한 핵심 임상 이해</h2>${rich(r.counselorCoreUnderstanding)}</section><section class="section"><div class="title"><strong>01</strong><div><h2>해석 가능성과 현재 상태</h2></div></div><div class="grid2"><div class="box"><h3>타당도·해석 제한</h3>${rich(validity)}</div><div class="box warm"><h3>현재 심리상태</h3>${rich(current)}</div></div></section><section class="section"><div class="title"><strong>02</strong><div><h2>비교적 지속적인 기질·성격 특성</h2></div></div><div class="panel">${rich(trait)}</div></section>${foot(1,3,'counselor')}</article>

  <article class="page">${pageHead('근거와 사례개념화',name)}<section class="section"><div class="title"><strong>03</strong><div><h2>검사 근거 요약</h2><p>해석 내용과 이를 지지하는 검사자료를 연결합니다.</p></div></div><div class="panel rich-text">${rich(evidence)}</div></section><section class="section"><div class="title"><strong>04</strong><div><h2>검사 간 교차해석</h2></div></div><div class="box accent">${rich(cross)}</div></section><section class="section"><div class="title"><strong>05</strong><div><h2>5P 사례개념화</h2></div></div><div class="panel integrated-panel">${rich(formulation)}</div></section>${foot(2,3,'counselor')}</article>

  <article class="page">${pageHead('상담 계획',name)}<section class="section"><div class="title"><strong>06</strong><div><h2>상담 우선순위</h2></div></div><div class="panel">${rich(focus)}</div></section><section class="section"><div class="title"><strong>07</strong><div><h2>가설 확인 질문</h2></div></div><div class="box accent">${rich(questions)}</div></section><section class="section"><div class="title"><strong>08</strong><div><h2>초기 개입 가이드</h2></div></div><div class="box">${rich(intervention)}</div></section><section class="section"><div class="title"><strong>09</strong><div><h2>관찰·모니터링 포인트</h2></div></div><div class="box warm">${rich(monitor)}</div></section><section class="section"><div class="supervisor"><h3>전문가 종합 소견</h3>${rich(r.professionalSummary||r.supervisorNote)}</div></section>${foot(3,3,'counselor')}</article></main>`
}

function sentenceList(v){
  return clientSafe(v).replace(/\s+/g,' ').match(/[^.!?。！？]+[.!?。！？]?/g)?.map(x=>x.trim()).filter(Boolean)||[];
}
function compactText(v,max=700,maxSentences=5){
  const text=clientSafe(v).replace(/\n{3,}/g,'\n\n').trim();
  if(!text)return '';
  const seen=new Set(), picked=[];
  for(const sentence of sentenceList(text)){
    const key=sentence.replace(/[^가-힣A-Za-z0-9]/g,'').slice(0,45);
    if(!key||seen.has(key))continue;
    seen.add(key); picked.push(sentence);
    if(picked.length>=maxSentences)break;
  }
  let out=picked.join(' ');
  if(out.length>max)out=out.slice(0,max).replace(/\s+\S*$/,'')+'…';
  return out;
}
function testHeading(line){
  const m=String(line||'').match(/(MMPI(?:-2|-A)?|TCI|JTCI|PAI|SCT|HTP|PAT|CBCL|K-?CDI|PHQ-?9|GAD-?7|회복탄력성)[^\n]*/i);
  return m?m[0].replace(/[:：].*$/,'').trim():'';
}
function conciseTestFindings(v,tests=[]){
  const source=clientSafe(v); if(!source)return '';
  const lines=source.split(/\n+/).map(x=>x.trim()).filter(Boolean);
  const groups=[]; let cur=null;
  for(const line of lines){
    const heading=testHeading(line);
    if(heading){ if(cur)groups.push(cur); cur={title:heading,body:[]}; continue; }
    if(!cur)cur={title:'검사 결과',body:[]};
    if(!/^(해석상 주의|검사결과는|이 보고서는)/.test(line))cur.body.push(line.replace(/^(확인된 결과|핵심 결과|의미|강점 및 자원)\s*[:：]\s*/,''));
  }
  if(cur)groups.push(cur);
  const used=new Set(); const out=[];
  for(const g of groups){
    const title=g.title||'검사 결과'; const key=title.replace(/\s/g,'').toUpperCase();
    if(used.has(key))continue; used.add(key);
    const body=compactText(g.body.join(' '),900,7); if(body)out.push(`## ${title}\n${body}`);
  }
  for(const t of tests){
    if(!out.some(x=>x.toUpperCase().includes(String(t).toUpperCase().slice(0,4)))) out.push(`## ${t}\n이 검사는 다른 검사 결과와 함께 종합하여 현재의 마음과 평소의 특성을 이해하는 데 활용되었습니다.`);
  }
  return out.slice(0,8).join('\n\n');
}
function reportValue(r,...paths){
  for(const path of paths){
    const parts=String(path).split('.'); let cur=r;
    for(const part of parts){cur=cur&&typeof cur==='object'?cur[part]:undefined;}
    const value=clientSafe(cur); if(value)return value;
  }
  return '';
}
function testGroupsFromText(v,tests=[]){
  const source=clientSafe(v); const lines=source.split(/\n+/).map(x=>x.trim()).filter(Boolean);
  const groups=[]; let cur=null;
  for(const line of lines){
    const heading=testHeading(line);
    if(heading){if(cur&&cur.body.length)groups.push(cur);cur={title:heading,body:[]};continue;}
    if(!cur)cur={title:'검사 결과',body:[]};
    const cleaned=line.replace(/^(확인된 결과|핵심 결과|의미|강점 및 자원|일상에서의 모습|해석상 주의)\s*[:：]\s*/,'').trim();
    if(cleaned&&!/^(검사결과는|이 보고서는)/.test(cleaned))cur.body.push(cleaned);
  }
  if(cur&&cur.body.length)groups.push(cur);
  if(!groups.length&&source)groups.push({title:tests[0]||'심리검사',body:[source]});
  return groups.slice(0,8).map(g=>({title:g.title,summary:compactText(g.body.join(' '),330,3)})).filter(g=>g.summary);
}
function deriveCommonPatterns(testFindings,tests=[]){
  const groups=testGroupsFromText(testFindings,tests);
  if(groups.length<2)return groups.length?`${groups[0].title}에서 확인된 결과를 종합하면, ${groups[0].summary}`:'';
  const a=groups[0],b=groups[1],c=groups[2];
  const evidence=[`${a.title}에서는 ${a.summary}`,`${b.title}에서는 ${b.summary}`];
  if(c)evidence.push(`${c.title}에서는 ${c.summary}`);
  return compactText(`${evidence.join(' ')} 이 결과들을 함께 보면 서로 다른 검사에서도 현재의 적응과 평소의 대처방식을 이해하는 데 연결되는 특징이 반복해서 확인됩니다. 따라서 한 검사만 따로 보기보다, 앞에서 확인된 공통 흐름을 이 사람의 현재 모습과 비교적 지속적인 강점으로 함께 이해하는 것이 적절합니다.`,900,8);
}
function deriveDifferences(testFindings,tests=[]){
  const groups=testGroupsFromText(testFindings,tests);
  if(groups.length<2)return groups.length?`${groups[0].title}의 결과는 현재 경험과 평소 특성을 함께 살펴보며 이해하는 것이 적절합니다.`:'';
  const a=groups[0],b=groups[1];
  return compactText(`${a.title}에서는 ${a.summary} 반면 ${b.title}에서는 ${b.summary} 이 두 결과는 서로 모순된다기보다 각 검사가 현재의 심리상태와 비교적 지속적인 기질·성격 특성, 또는 서로 다른 생활 영역을 비추어 보여준 것으로 이해할 수 있습니다. 실제 생활에서는 두 모습이 상황에 따라 함께 나타날 수 있으므로, 어느 한쪽만 선택하기보다 언제 어떤 모습이 두드러지는지 함께 살펴보는 것이 적절합니다.`,850,7);
}
function firstNonEmpty(...vals){return vals.map(v=>clientSafe(v)).find(Boolean)||'';}
function client(body){
  const r=body.report||{},name=body.clientName||'',date=reportDate(body),tests=normalizedTests(body.tests),testNames=testsLabel(tests),testSummary=testsSentence(tests),reportTitle=programReportTitle(body.program,r.title);
  const joinDistinct=(...vals)=>{
    const used=[]; const parts=[];
    for(const value of vals){
      const text=distinctText(value,used,5,'');
      if(text){parts.push(text);used.push(...sentenceUnits(text));}
    }
    return parts.join('\n\n');
  };
  const core=firstNonEmpty(
    reportValue(r,'clientCoreMind','client.coreMind','clientSelfUnderstanding','client.selfUnderstanding','keyMessage','summary','integratedUnderstanding','clientProfessionalSummary','client.professionalSummary'),
    '현재의 마음과 평소의 특성을 함께 살펴보면, 현재 가장 두드러지는 심리적 특징과 이를 조절하는 데 활용할 수 있는 강점이 함께 확인됩니다.'
  );
  const purpose=firstNonEmpty(
    reportValue(r,'evaluationOverview','clientEvaluationPurpose','client.evaluationPurpose','evaluationPurpose'),
    `${testNames} 결과를 함께 살펴 현재의 마음, 성격 특성, 관계와 스트레스 대처 방식을 종합적으로 이해하기 위한 평가입니다.`
  );
  const validity=firstNonEmpty(
    reportValue(r,'clinicalValidity','validity','interpretationBasis','clientValidity','client.validity'),
    reportValue(r,'disclaimer','clientDisclaimer','client.disclaimer'),
    '검사 결과는 한 시점의 상태와 응답 경향을 반영합니다. 점수 하나보다 여러 검사에서 반복되거나 서로 보완되는 특징을 중심으로 이해하며, 최근의 생활환경과 경험을 함께 고려하는 것이 적절합니다.'
  );
  const strengths=firstNonEmpty(
    reportValue(r,'clientStrengthGuide','client.strengthGuide','strengthsResources','strengths','protectiveResources'),
    '현재의 적응을 돕는 강점과 심리적 자원이 확인됩니다. 이러한 자원은 부담이 높아지는 상황에서도 균형을 회복하는 데 중요한 기반이 될 수 있습니다.'
  );
  const caution=firstNonEmpty(
    reportValue(r,'currentSignals','clientCurrentSignals','client.currentSignals','riskAndLimits','caution','vulnerabilities'),
    '부담이 커질 때 긴장과 걱정이 오래 이어지거나 자신에게 지나치게 높은 기준을 적용하는 흐름이 나타날 수 있습니다. 이러한 신호가 일상 기능에 미치는 영향을 함께 살펴보는 것이 필요합니다.'
  );
  const profile=firstNonEmpty(
    reportValue(r,'clientMindProfile','client.mindProfile','clientTemperamentCharacter','client.temperamentCharacter','clientCommonPatterns','client.commonPatterns'),
    joinDistinct(reportValue(r,'emotionalProfile'),reportValue(r,'thinkingStyle'),reportValue(r,'relationshipStyle'),reportValue(r,'stressRecovery'),reportValue(r,'strengthsResources')),
    '기질과 성격, 정서조절, 관계 방식, 자기조절과 회복자원을 중심으로 마음의 전반적인 프로파일을 정리합니다.'
  );
  const individualSource=firstNonEmpty(reportValue(r,'clientTestFindings','client.testFindings','evidenceSummary','counselor.evidenceSummary','testGuide','individualTests'));
  const individual=formatTestSections(conciseTestFindings(individualSource,tests)||individualSource||tests.map(t=>`■ ${t}\n이 검사의 핵심 결과를 다른 검사 결과와 함께 종합해 현재의 마음과 적응 방식을 이해했습니다.`).join('\n\n'));
  const emotion=firstNonEmpty(
    reportValue(r,'clientEmotionState','client.emotionState','clientCurrentMind','client.currentMind','clinicalCurrentState','shared.clinicalCurrentState','emotionalProfile'),
    '현재의 불안, 긴장, 우울감, 정서조절과 일상 기능을 함께 살펴볼 수 있습니다.'
  );
  const thinking=firstNonEmpty(
    reportValue(r,'clientThinkingRelationship','client.thinkingRelationship','clientTemperamentCharacter','client.temperamentCharacter','clientDifferences','client.differences'),
    joinDistinct(reportValue(r,'thinkingStyle'),reportValue(r,'relationshipStyle')),
    '생각을 정리하고 판단하는 방식, 자기이해, 의사소통과 대인관계에서 나타나는 특징을 통합하여 이해합니다.'
  );
  const stress=firstNonEmpty(
    reportValue(r,'clientStressDaily','client.stressDaily','clientFunctionalFormulation','client.functionalFormulation','clinicalFormulation','shared.clinicalFormulation','stressRecovery'),
    '스트레스가 커지는 상황과 반응, 그 흐름이 일상생활과 에너지에 미치는 영향을 정리합니다.'
  );
  const recovery=formatNumberedItems(firstNonEmpty(
    reportValue(r,'clientExpertRecovery','client.expertRecovery','clientRecoveryGuide','client.recoveryGuide'),
    joinDistinct(reportValue(r,'strengthsResources'),reportValue(r,'psychologicalSuggestions'),reportValue(r,'professionalSummary')),
    '현재 확인된 강점과 회복자원을 바탕으로 실천 가능한 회복 방향을 제안합니다.'
  ));
  const disclaimer=compactText(reportValue(r,'clientDisclaimer','client.disclaimer','disclaimer'),300,2)||'이 보고서는 심리검사 결과를 바탕으로 현재의 상태와 경향을 이해하기 위한 참고자료이며, 단독으로 진단을 확정하지 않습니다.';
  const profileItems=[
    ['정서',firstNonEmpty(reportValue(r,'emotionalProfile'),emotion)],
    ['사고',firstNonEmpty(reportValue(r,'thinkingStyle'),thinking)],
    ['관계',firstNonEmpty(reportValue(r,'relationshipStyle'),thinking)],
    ['스트레스',firstNonEmpty(reportValue(r,'stressRecovery'),stress)],
    ['자기조절',firstNonEmpty(reportValue(r,'clientMindProfile','client.mindProfile'),profile)],
    ['회복 자원',firstNonEmpty(reportValue(r,'strengthsResources'),strengths)]
  ].map(([title,text],i)=>`<div class="domain"><span>${String(i+1).padStart(2,'0')}</span><div><b>${esc(title)}</b><p>${esc(compactText(text,180,2)||'검사 결과에서 확인된 특징을 생활 맥락과 함께 살펴볼 수 있습니다.')}</p></div></div>`).join('');
  const section=(no,title,text,kind='text-panel')=>`<section class="detail-section"><div class="section-title"><p>${no}</p><div><h2>${title}</h2></div></div><div class="${kind}">${rich(text)}</div></section>`;
  return `<main class="report signature-report">
  <article class="page signature-page page-one">
    <header class="cover-head"><div><p class="kicker">MODUMAM SIGNATURE REPORT</p><h1>${esc(reportTitle)}</h1><p class="sub">심리검사 결과를 한 사람의 삶과 마음의 맥락에서 이해하도록 돕는 심리평가 보고서</p></div><div class="brand-logo"><div class="logo">ㅁㄷㅁ</div><span>모두의 마음연구소</span></div></header>
    <section class="meta"><div><span>성명</span><b>${esc(name)}</b></div><div><span>프로그램</span><b>${esc(body.program)}</b></div><div><span>발행일</span><b>${esc(date)}</b></div><div><span>실시검사</span><b>${esc(testNames)}</b></div></section>
    <section class="opening"><p class="opening-no">01</p><div><h2>현재 마음의 핵심 모습</h2>${rich(core)}</div></section>
    <section class="purpose-grid"><div><span>평가 목적</span>${rich(purpose)}</div><div><span>결과 해석 기준</span>${rich(validity)}</div></section>
    <section class="key-grid"><div class="key-card resource"><h3>강점과 심리적 자원</h3>${rich(strengths)}</div><div class="key-card focus"><h3>살펴볼 부분</h3>${rich(caution)}</div></section>
    <section class="profile-section"><div class="section-title"><p>02</p><div><h2>마음 프로파일</h2><span>통합검사 결과에서 확인된 핵심 영역</span></div></div><div class="domain-grid">${profileItems}</div></section>
    ${foot(1,3,'client')}
  </article>
  <article class="page signature-page page-detail"><header class="inner"><div><p class="kicker">MODUMAM SIGNATURE REPORT</p><h2>검사 결과를 조금 더 자세히 보기</h2></div><span>${esc(name)}</span></header>
    ${section('03','개별검사 요약',individual,'test-summary-card')}
    ${section('04','정서와 심리상태',emotion,'text-panel')}
    ${section('05','사고와 관계 방식',thinking,'two-way-card')}
    ${foot(2,3,'client')}
  </article>
  <article class="page signature-page page-detail"><header class="inner"><div><p class="kicker">MODUMAM SIGNATURE REPORT</p><h2>통합적 이해와 회복 방향</h2></div><span>${esc(name)}</span></header>
    ${section('06','스트레스와 일상생활',stress,'two-way-card')}
    ${section('07','전문가 제언 및 회복 방향',recovery,'direction-card')}
    <section class="reading-note"><h3>보고서를 읽을 때 기억할 점</h3>${rich(disclaimer)}<p>심리검사 결과는 개인을 규정하는 결론이 아니라, 현재의 마음과 적응 방식을 이해하기 위한 하나의 자료입니다. 최근의 경험, 환경, 관계 맥락과 함께 살펴볼 때 가장 의미가 있습니다.</p></section>
    <section class="closing"><span>마음을 알아차리고, 이해하고, 연결합니다.</span><p>이번 검사에서 확인된 특성은 어려움만을 의미하지 않습니다. 자신을 이해하는 언어가 생길 때, 강점은 더 잘 활용되고 부담은 보다 현실적으로 다룰 수 있습니다.</p></section>
    ${foot(3,3,'client')}
  </article></main>`;
}

export const handleIntegratedReport = async(event)=>{if(event.httpMethod==='OPTIONS')return jsonResponse({},200);if(event.httpMethod!=='POST')return jsonResponse({ok:false,error:'POST only'},405);try{const body=JSON.parse(event.body||'{}');if(!body.report)return jsonResponse({ok:false,error:'보고서 데이터가 없습니다.'},400);const audience=body.audience==='counselor'?'counselor':'client';const html=audience==='counselor'?counselor(body):client(body);return jsonResponse({ok:true,audience,html:`<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${audience==='counselor'?'심리평가 상담가이드':programReportTitle(body.program,body.report?.title)}</title><style>${css()}</style></head><body>${html}</body></html>`,version:'mml-signature-report-v42-exact-shared-template'});}catch(e){return jsonResponse({ok:false,error:clean(e?.message,500)||'REPORT_ERROR'},500)}};
// MOD-20260720-PDF-A4-FLOW-V8: A4 인쇄 시 빈 페이지 및 푸터 단독 이월 방지.

// MOD-20260721-A4-CONNECTED-PAGES: 페이지를 297mm flex 문서로 고정하고 푸터를 흐름 안에 배치하여 빈 페이지·푸터 단독 이월을 제거.
