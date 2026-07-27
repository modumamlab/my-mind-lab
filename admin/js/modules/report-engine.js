
console.info('[MML] REPORT-ENGINE-MODULE-V38 loaded');

(function(global){
  'use strict';

  const REPORT_KEY='modumam_reports';
  const VERSION='v38';

  function clone(value){
    try{return structuredClone(value)}catch(e){}
    try{return JSON.parse(JSON.stringify(value))}catch(e){return value}
  }

  function esc(value=''){
    return String(value??'')
      .replace(/&/g,'&amp;')
      .replace(/</g,'&lt;')
      .replace(/>/g,'&gt;')
      .replace(/"/g,'&quot;')
      .replace(/'/g,'&#039;');
  }

  function nl(value=''){
    return esc(value).replace(/\n/g,'<br>');
  }

  function normalizeTests(value){
    if(Array.isArray(value)) return value.filter(Boolean).map(String);
    if(!value) return [];
    return String(value).split(/[,\n·]/).map(v=>v.trim()).filter(Boolean);
  }

  function normalizeSections(value){
    if(Array.isArray(value)){
      return value.map((item,index)=>({
        key:String(item?.key||`section-${index+1}`),
        title:String(item?.title||item?.label||`항목 ${index+1}`),
        text:String(item?.text||item?.content||'')
      }));
    }

    if(value && typeof value==='object'){
      return Object.entries(value).map(([key,text])=>({
        key,
        title:key,
        text:String(text??'')
      }));
    }

    return [];
  }

  function normalize(report={}){
    const now=new Date().toISOString();
    return {
      id:String(report.id||`report-${Date.now()}-${Math.random().toString(36).slice(2,8)}`),
      reservationId:String(report.reservationId||report.sourceReservationId||''),
      clientId:String(report.clientId||report.memberId||''),
      clientName:String(report.clientName||report.name||''),
      title:String(report.title||report.reportTitle||defaultTitle(report)),
      reportType:String(report.reportType||report.type||'integrated'),
      audience:String(report.audience||'client'),
      program:String(report.program||''),
      tests:normalizeTests(report.tests||report.testName||report.assessmentName),
      sections:normalizeSections(report.sections||report.report||report.content),
      summary:String(report.summary||report.overallSummary||''),
      recommendations:String(report.recommendations||report.suggestions||''),
      status:String(report.status||report.approvalStatus||'draft'),
      approvedForClient:
        report.approvedForClient===true ||
        report.approved===true ||
        String(report.status||'').toLowerCase()==='approved',
      createdAt:String(report.createdAt||now),
      updatedAt:String(report.updatedAt||now),
      approvedAt:String(report.approvedAt||''),
      source:clone(report)
    };
  }

  function defaultTitle(report={}){
    const type=String(report.reportType||report.type||'').toLowerCase();
    if(type.includes('individual')||type.includes('개별')) return '개별 심리검사 보고서';
    if(type.includes('comprehensive')||type.includes('integrated')||type.includes('종합')) return '심리검사 종합결과보고서';
    return '심리검사 결과보고서';
  }

  function getAll(){
    const rows=global.MMLDataStore?.read?.(REPORT_KEY,[])
      || JSON.parse(localStorage.getItem(REPORT_KEY)||'[]');
    return Array.isArray(rows)?rows.map(normalize):[];
  }

  function save(report,options={}){
    const normalized=normalize(report);
    const rows=getAll();
    const index=rows.findIndex(item=>item.id===normalized.id);
    if(index>=0) rows[index]={...rows[index],...normalized,updatedAt:new Date().toISOString()};
    else rows.unshift(normalized);

    if(global.MMLDataStore?.write){
      global.MMLDataStore.write(REPORT_KEY,rows,{
        action:index>=0?'보고서 수정':'보고서 생성',
        detail:normalized.title,
        entityId:normalized.id,
        ...options
      });
    }else{
      localStorage.setItem(REPORT_KEY,JSON.stringify(rows));
    }
    return normalized;
  }

  function remove(id,options={}){
    const rows=getAll();
    const next=rows.filter(item=>item.id!==String(id));
    if(next.length===rows.length) return false;

    if(global.MMLDataStore?.write){
      global.MMLDataStore.write(REPORT_KEY,next,{
        action:'보고서 삭제',
        entityId:String(id),
        ...options
      });
    }else{
      localStorage.setItem(REPORT_KEY,JSON.stringify(next));
    }
    return true;
  }

  function approve(id,approved=true,options={}){
    const rows=getAll();
    const index=rows.findIndex(item=>item.id===String(id));
    if(index<0) throw new Error('보고서를 찾을 수 없습니다.');

    const now=new Date().toISOString();
    rows[index]={
      ...rows[index],
      approvedForClient:!!approved,
      status:approved?'approved':'draft',
      approvedAt:approved?now:'',
      updatedAt:now
    };

    if(global.MMLDataStore?.write){
      global.MMLDataStore.write(REPORT_KEY,rows,{
        action:approved?'보고서 승인':'보고서 승인취소',
        entityId:String(id),
        ...options
      });
    }else{
      localStorage.setItem(REPORT_KEY,JSON.stringify(rows));
    }

    return clone(rows[index]);
  }

  function sectionHtml(section,index){
    if(!section?.text) return '';
    return `<section class="mml-report-section" data-keep-together>
      <h2><span>${index+1}</span>${esc(section.title||`항목 ${index+1}`)}</h2>
      <div class="mml-report-text">${nl(section.text)}</div>
    </section>`;
  }

  function buildHtml(report,options={}){
    const r=normalize(report);
    const issued=String(r.updatedAt||r.createdAt).slice(0,10).replaceAll('-','.');
    const testText=r.tests.length?r.tests.join(' · '):'검사 정보 없음';

    return `
      <article class="mml-report-document" data-report-id="${esc(r.id)}">
        <header class="mml-report-header">
          <div class="mml-report-brand">모두의 마음연구소</div>
          <h1>${esc(r.title)}</h1>
          <div class="mml-report-meta">
            ${r.clientName?`<span>내담자 ${esc(r.clientName)}</span>`:''}
            ${r.program?`<span>프로그램 ${esc(r.program)}</span>`:''}
            <span>작성일 ${esc(issued)}</span>
          </div>
        </header>

        <section class="mml-report-overview" data-keep-together>
          <div>
            <b>실시검사</b>
            <p>${esc(testText)}</p>
          </div>
          <div>
            <b>보고서 상태</b>
            <p>${r.approvedForClient?'승인 완료':'작성·검토 중'}</p>
          </div>
        </section>

        ${r.summary?sectionHtml({title:'종합 요약',text:r.summary},0):''}
        ${r.sections.map((section,index)=>sectionHtml(section,index+(r.summary?1:0))).join('')}
        ${r.recommendations?sectionHtml({title:'전문가 제언 및 회복 방향',text:r.recommendations},r.sections.length+(r.summary?1:0)):''}

        <footer class="mml-report-footer">
          본 보고서는 제공된 심리검사 결과를 바탕으로 작성되었으며, 단독 진단이나 확정적 판단을 대신하지 않습니다.
        </footer>
      </article>`;
  }

  const styles=`
    .mml-report-document{font-family:"Pretendard","Apple SD Gothic Neo","Noto Sans KR",Arial,sans-serif;color:#0f172a}
    .mml-report-header{border-bottom:3px solid #0f172a;padding-bottom:18px;margin-bottom:20px}
    .mml-report-brand{font-size:11px;font-weight:900;letter-spacing:.12em;color:#0f766e}
    .mml-report-header h1{font-size:28px;line-height:1.25;margin:8px 0 10px}
    .mml-report-meta{display:flex;flex-wrap:wrap;gap:8px 16px;font-size:12px;color:#64748b}
    .mml-report-overview{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:18px}
    .mml-report-overview>div{border:1px solid #cbd5e1;border-radius:12px;padding:14px;background:#f8fafc}
    .mml-report-overview b{display:block;font-size:11px;color:#475569;margin-bottom:5px}
    .mml-report-overview p{font-size:13px;line-height:1.65;margin:0}
    .mml-report-section{border:1px solid #e2e8f0;border-radius:14px;padding:17px 19px;margin-bottom:12px}
    .mml-report-section h2{display:flex;align-items:center;gap:8px;font-size:15px;margin:0 0 10px;color:#0f766e}
    .mml-report-section h2 span{display:inline-flex;width:23px;height:23px;align-items:center;justify-content:center;border-radius:999px;background:#ccfbf1;font-size:11px}
    .mml-report-text{font-size:13px;line-height:1.85;color:#334155}
    .mml-report-footer{margin-top:20px;border-top:1px solid #cbd5e1;padding-top:12px;font-size:10px;line-height:1.6;color:#64748b}
    @media(max-width:640px){.mml-report-overview{grid-template-columns:1fr}.mml-report-header h1{font-size:24px}}
  `;

  function preview(report,options={}){
    if(!global.MMLPrintEngine?.printHtml){
      throw new Error('공통 출력 엔진을 찾을 수 없습니다.');
    }

    return global.MMLPrintEngine.printHtml({
      title:normalize(report).title,
      content:buildHtml(report,options),
      styles,
      toolbar:options.toolbar!==false,
      autoPrint:!!options.autoPrint
    });
  }

  function find(id){
    return getAll().find(item=>item.id===String(id))||null;
  }

  function clientVisible(){
    return getAll().filter(item=>item.approvedForClient===true);
  }

  global.MMLReportEngine=Object.freeze({
    version:VERSION,
    normalize,
    getAll,
    find,
    save,
    remove,
    approve,
    buildHtml,
    preview,
    clientVisible,
    styles
  });
})(window);
