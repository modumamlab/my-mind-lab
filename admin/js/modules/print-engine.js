console.info('[MML] PRINT-ENGINE-MODULE-V32 loaded');

(function(global){
  'use strict';

  const ENGINE_STYLE_ID = 'mml-print-engine-style-v32';

  const baseCss = `
@page{size:A4;margin:14mm 14mm 16mm}
*{box-sizing:border-box}
html{-webkit-print-color-adjust:exact;print-color-adjust:exact}
body{
  margin:0;
  background:#eef2f7;
  color:#0f172a;
  font-family:"Pretendard","Apple SD Gothic Neo","Noto Sans KR",Arial,sans-serif;
  word-break:keep-all;
  overflow-wrap:anywhere;
}
.mml-print-shell{
  width:210mm;
  min-height:297mm;
  margin:18px auto;
  background:#fff;
  box-shadow:0 12px 35px rgba(15,23,42,.12);
}
.mml-print-content{padding:14mm}
.page,.report-page,.a4-page,[data-print-page]{
  max-width:100%;
  margin-left:auto;
  margin-right:auto;
  background:#fff;
}
section,article,.card,.report-card,[data-keep-together]{
  break-inside:avoid;
  page-break-inside:avoid;
}
h1,h2,h3,h4{
  break-after:avoid;
  page-break-after:avoid;
}
table{
  width:100%;
  border-collapse:collapse;
  break-inside:auto;
}
thead{display:table-header-group}
tfoot{display:table-footer-group}
tr{
  break-inside:avoid;
  page-break-inside:avoid;
}
img,svg,canvas{
  max-width:100%;
  height:auto;
  break-inside:avoid;
}
[data-page-break-before],.page-break-before{
  break-before:page;
  page-break-before:always;
}
[data-page-break-after],.page-break-after{
  break-after:page;
  page-break-after:always;
}
[data-allow-split]{
  break-inside:auto!important;
  page-break-inside:auto!important;
}
.mml-print-toolbar{
  position:fixed;
  right:18px;
  top:18px;
  z-index:99999;
  display:flex;
  gap:8px;
  padding:8px;
  border:1px solid #cbd5e1;
  border-radius:14px;
  background:rgba(255,255,255,.96);
  box-shadow:0 8px 25px rgba(15,23,42,.15);
}
.mml-print-toolbar button{
  border:0;
  border-radius:10px;
  padding:10px 15px;
  cursor:pointer;
  font-weight:800;
  font-family:inherit;
}
.mml-print-primary{background:#0f172a;color:#fff}
.mml-print-secondary{background:#e2e8f0;color:#334155}
@media print{
  html,body{width:auto!important;min-height:auto!important;background:#fff!important}
  body{margin:0!important}
  .mml-print-shell{
    width:auto!important;
    min-height:auto!important;
    margin:0!important;
    box-shadow:none!important;
  }
  .mml-print-content{padding:0!important}
  .mml-print-toolbar,.no-print,[data-no-print],button.no-print{
    display:none!important;
  }
  a{color:inherit;text-decoration:none}
}
`;

  function injectStyle(doc){
    if(!doc || !doc.head || doc.getElementById(ENGINE_STYLE_ID)) return;
    const style = doc.createElement('style');
    style.id = ENGINE_STYLE_ID;
    style.textContent = baseCss;
    doc.head.appendChild(style);
  }

  function addToolbar(win, options={}){
    const doc = win?.document;
    if(!doc?.body || options.toolbar === false || doc.querySelector('.mml-print-toolbar')) return;

    const toolbar = doc.createElement('div');
    toolbar.className = 'mml-print-toolbar';
    toolbar.setAttribute('data-no-print','true');

    const printButton = doc.createElement('button');
    printButton.type = 'button';
    printButton.className = 'mml-print-primary';
    printButton.textContent = options.printLabel || 'PDF·인쇄';
    printButton.onclick = ()=>win.print();

    const closeButton = doc.createElement('button');
    closeButton.type = 'button';
    closeButton.className = 'mml-print-secondary';
    closeButton.textContent = '닫기';
    closeButton.onclick = ()=>win.close();

    toolbar.append(printButton, closeButton);
    doc.body.appendChild(toolbar);
  }

  function normalizeDocument(win, options={}){
    const doc = win?.document;
    if(!doc?.documentElement) return false;

    injectStyle(doc);
    doc.documentElement.lang = doc.documentElement.lang || 'ko';

    if(doc.body){
      doc.body.dataset.mmlPrintEngine = 'v32';
      addToolbar(win, options);
    }

    return true;
  }

  function monitor(win, options={}){
    let attempts = 0;
    const timer = setInterval(()=>{
      attempts += 1;
      if(!win || win.closed){
        clearInterval(timer);
        return;
      }
      try{
        if(normalizeDocument(win, options) && docReady(win.document)){
          if(attempts > 8) clearInterval(timer);
        }
      }catch(error){}
      if(attempts > 80) clearInterval(timer);
    }, 100);

    try{
      win.addEventListener('beforeprint',()=>normalizeDocument(win, options));
      win.addEventListener('load',()=>normalizeDocument(win, options));
    }catch(error){}
  }

  function docReady(doc){
    return !!doc?.body && doc.readyState !== 'loading';
  }

  function openWindow(url='', target='_blank', features='width=960,height=900', options={}){
    const win = global.open(url, target, features);
    if(!win) return null;
    monitor(win, options);
    return win;
  }

  function documentHtml(options={}){
    const {
      title='문서',
      content='',
      styles='',
      toolbar=true,
      bodyClass='',
      autoPrint=false
    } = options;

    return `<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapeHtml(title)}</title>
<style>${baseCss}</style>
${styles ? `<style>${styles}</style>` : ''}
</head>
<body class="${escapeHtml(bodyClass)}">
<div class="mml-print-shell"><main class="mml-print-content">${content}</main></div>
${toolbar ? `<div class="mml-print-toolbar" data-no-print="true">
<button class="mml-print-primary" type="button" onclick="window.print()">PDF·인쇄</button>
<button class="mml-print-secondary" type="button" onclick="window.close()">닫기</button>
</div>` : ''}
${autoPrint ? '<script>window.addEventListener("load",()=>setTimeout(()=>window.print(),180))<\/script>' : ''}
</body>
</html>`;
  }

  function printHtml(options={}){
    const win = openWindow('', '_blank', options.features || 'width=960,height=900', {
      toolbar:options.toolbar !== false
    });
    if(!win) return null;

    win.document.open();
    win.document.write(documentHtml(options));
    win.document.close();
    normalizeDocument(win, options);

    if(options.autoPrint){
      win.addEventListener('load',()=>setTimeout(()=>win.print(),180),{once:true});
    }
    return win;
  }

  function printElement(elementOrSelector, options={}){
    const element = typeof elementOrSelector === 'string'
      ? document.querySelector(elementOrSelector)
      : elementOrSelector;

    if(!element) throw new Error('출력할 화면 요소를 찾지 못했습니다.');
    return printHtml({
      ...options,
      content:element.outerHTML
    });
  }

  function escapeHtml(value=''){
    return String(value ?? '')
      .replace(/&/g,'&amp;')
      .replace(/</g,'&lt;')
      .replace(/>/g,'&gt;')
      .replace(/"/g,'&quot;')
      .replace(/'/g,'&#039;');
  }

  const api = Object.freeze({
    version:'v32',
    baseCss,
    openWindow,
    normalizeDocument,
    documentHtml,
    printHtml,
    printElement
  });

  global.MMLPrintEngine = api;
  global.openPrintWindow = function(url='', target='_blank', features='width=960,height=900'){
    return api.openWindow(url,target,features);
  };
})(window);
