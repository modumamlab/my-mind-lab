console.info('[MML] REPORT-VIEWER-STEP6.1 loaded');
(function(global){
'use strict';
const VERSION='20260725-unified-report-source-step6-1';
const text=v=>String(v??'').trim();
const list=v=>Array.isArray(v)?v:[];
const esc=v=>String(v??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#039;');
function loadReports(){
  if(global.MMLReportStore?.loadAll)return list(global.MMLReportStore.loadAll());
  try{return list(JSON.parse(localStorage.getItem('modumam_reports')||'[]'))}catch(_){return []}
}
function getById(id){
  if(global.MMLReportStore?.getById)return global.MMLReportStore.getById(id);
  return loadReports().find(r=>text(r.id)===text(id))||null;
}
function title(r={}){
  if(text(r.title))return text(r.title);
  if(r.individualAssessmentReport||r.reportType==='individualReport')return text(r.testType)?`${text(r.testType)} 개별 심리검사 보고서`:'개별 심리검사 보고서';
  if(r.integratedAssessmentReport||r.reportType==='counselorComprehensiveReport')return '통합 심리평가보고서';
  return '심리검사 종합보고서';
}
function flat(v){
  if(Array.isArray(v))return v.map(flat).filter(Boolean).join('\n');
  if(v&&typeof v==='object')return Object.values(v).map(flat).filter(Boolean).join('\n');
  return text(v);
}
function fallback(r={}){
  const entries=r.sections&&typeof r.sections==='object'?Object.entries(r.sections):[];
  const body=entries.length?entries.map(([k,v],i)=>`<section class="mml-report-section" data-keep-together><h2>${i+1}. ${esc(k)}</h2><div class="mml-report-text">${esc(flat(v)).replace(/\n/g,'<br>')}</div></section>`).join(''):`<section class="mml-report-section"><div class="mml-report-text">${esc(text(r.content||r.summary||r.interpretation||'저장된 보고서 내용을 확인할 수 없습니다.')).replace(/\n/g,'<br>')}</div></section>`;
  return `<article class="mml-canonical-report" data-report-id="${esc(r.id)}"><header class="mml-report-header"><p class="mml-report-brand">MODUMAM-LAB</p><h1>${esc(title(r))}</h1><p>${esc(text(r.testType||list(r.tests).join(', ')))}</p></header>${body}<footer class="mml-report-footer"><p>작성 임상심리사 백인영</p><p>${esc(text(r.updatedAt||r.createdAt))}</p></footer></article>`;
}
function canonicalHtml(reportOrId){
  const r=typeof reportOrId==='object'?reportOrId:getById(reportOrId);
  if(!r)throw new Error('보고서 원본을 찾지 못했습니다.');
  const approved=text(r.approvedReportHtml);
  const saved=text(r.reportHtml||r.renderedHtml||r.previewHtml||r.html);
  if(r.approvedForClient===true&&approved)return approved;
  return saved||approved||fallback(r);
}
function resolve(id){
  const report=getById(id); if(!report)return null;
  return {report,reportId:text(report.id),title:title(report),html:canonicalHtml(report),approvedForClient:report.approvedForClient===true,version:Number(report.version||1),updatedAt:report.updatedAt||report.createdAt||''};
}
function css(){return `.mml-canonical-report{font-family:"Pretendard","Noto Sans KR",sans-serif;color:#172033;line-height:1.75}.mml-report-header{padding:10mm 8mm 8mm;border-bottom:2px solid #dbe7e1;margin-bottom:7mm}.mml-report-brand{font-size:11px;font-weight:900;letter-spacing:.14em;color:#16805d}.mml-report-header h1{margin:6px 0 4px;font-size:26px}.mml-report-section{margin:0 8mm 6mm;padding:6mm;border:1px solid #e2e8f0;border-radius:16px}.mml-report-section h2{margin:0 0 3mm;font-size:16px}.mml-report-text{font-size:12.5px;line-height:1.85;color:#334155}.mml-report-footer{display:flex;justify-content:space-between;margin:8mm;padding-top:4mm;border-top:1px solid #e2e8f0;font-size:11px;color:#64748b}`;}
function documentHtml(value,opt={}){
  const x=value?.html?value:resolve(typeof value==='object'?value.id:value);
  if(!x)throw new Error('출력할 보고서를 찾지 못했습니다.');
  if(global.MMLPrintEngine?.documentHtml)return global.MMLPrintEngine.documentHtml({title:x.title,content:x.html,styles:css(),toolbar:opt.toolbar!==false,autoPrint:Boolean(opt.autoPrint)});
  return `<!doctype html><html lang="ko"><head><meta charset="utf-8"><title>${esc(x.title)}</title><style>${css()}</style></head><body>${x.html}${opt.autoPrint?'<script>window.onload=()=>window.print()<\/script>':''}</body></html>`;
}
function open(value,opt={}){
  const x=value?.html?value:resolve(typeof value==='object'?value.id:value);
  if(!x)throw new Error('열람할 보고서를 찾지 못했습니다.');
  if(global.MMLPrintEngine?.printHtml)return global.MMLPrintEngine.printHtml({title:x.title,content:x.html,styles:css(),toolbar:opt.toolbar!==false,autoPrint:Boolean(opt.printImmediately)});
  const w=global.open('','_blank','width=960,height=900'); if(!w)throw new Error('팝업이 차단되었습니다.');
  w.document.open(); w.document.write(documentHtml(x,{toolbar:opt.toolbar!==false,autoPrint:Boolean(opt.printImmediately)})); w.document.close(); return w;
}
function diagnostics(){
  const rows=loadReports(),unresolved=[];
  rows.forEach(r=>{try{canonicalHtml(r)}catch(e){unresolved.push({id:r.id,error:e.message})}});
  return {ok:unresolved.length===0,version:VERSION,storageKey:'modumam_reports',reports:rows.length,unresolved,singleSource:true};
}
global.MMLReportViewer=Object.freeze({version:VERSION,loadReports,getById,resolve,canonicalHtml,documentHtml,open,diagnostics});
try{global.dispatchEvent(new CustomEvent('mml:report-viewer-ready',{detail:{version:VERSION}}))}catch(_){}
})(window);
