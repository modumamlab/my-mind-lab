console.info('[MML] UI-COMPONENTS-MODULE-V31 loaded');

(function(global){
  'use strict';

  function esc(value=''){
    return String(value ?? '')
      .replace(/&/g,'&amp;')
      .replace(/</g,'&lt;')
      .replace(/>/g,'&gt;')
      .replace(/"/g,'&quot;')
      .replace(/'/g,'&#039;');
  }

  function attrs(input={}){
    return Object.entries(input)
      .filter(([,value])=>value !== undefined && value !== null && value !== false)
      .map(([key,value])=>{
        if(value === true) return esc(key);
        return `${esc(key)}="${esc(value)}"`;
      })
      .join(' ');
  }

  const buttonTone = {
    primary:'bg-slate-900 text-white hover:bg-slate-800 border-slate-900',
    secondary:'bg-white text-slate-700 hover:bg-slate-50 border-slate-300',
    success:'bg-emerald-600 text-white hover:bg-emerald-700 border-emerald-600',
    warning:'bg-amber-500 text-white hover:bg-amber-600 border-amber-500',
    danger:'bg-rose-600 text-white hover:bg-rose-700 border-rose-600',
    ghost:'bg-transparent text-slate-600 hover:bg-slate-100 border-transparent'
  };

  const badgeTone = {
    neutral:'bg-slate-100 text-slate-700 border-slate-200',
    info:'bg-sky-50 text-sky-700 border-sky-200',
    success:'bg-emerald-50 text-emerald-700 border-emerald-200',
    warning:'bg-amber-50 text-amber-700 border-amber-200',
    danger:'bg-rose-50 text-rose-700 border-rose-200',
    violet:'bg-violet-50 text-violet-700 border-violet-200'
  };

  function button(label, options={}){
    const {
      tone='secondary',
      size='md',
      icon='',
      onclick='',
      type='button',
      disabled=false,
      className='',
      title='',
      id='',
      data={}
    } = options;

    const sizeClass = {
      sm:'px-2.5 py-1.5 text-xs rounded-lg',
      md:'px-3.5 py-2 text-sm rounded-xl',
      lg:'px-4.5 py-2.5 text-sm rounded-xl'
    }[size] || 'px-3.5 py-2 text-sm rounded-xl';

    const dataAttrs = Object.fromEntries(
      Object.entries(data).map(([key,value])=>[`data-${key}`,value])
    );

    return `<button ${attrs({
      id,
      type,
      onclick,
      disabled,
      title,
      ...dataAttrs
    })} class="inline-flex items-center justify-center gap-1.5 border font-semibold transition focus:outline-none focus:ring-2 focus:ring-slate-300 disabled:opacity-50 disabled:cursor-not-allowed ${sizeClass} ${buttonTone[tone] || buttonTone.secondary} ${className}">
      ${icon ? `<span aria-hidden="true">${esc(icon)}</span>` : ''}
      <span>${esc(label)}</span>
    </button>`;
  }

  function badge(label, options={}){
    const {tone='neutral', className=''} = options;
    return `<span class="inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold ${badgeTone[tone] || badgeTone.neutral} ${className}">${esc(label)}</span>`;
  }

  function card(content, options={}){
    const {
      title='',
      subtitle='',
      icon='',
      actions='',
      className='',
      bodyClass='',
      id=''
    } = options;

    return `<section ${attrs({id})} class="rounded-2xl border border-slate-200 bg-white shadow-sm ${className}">
      ${(title || subtitle || actions) ? `<header class="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 px-5 py-4">
        <div class="min-w-0">
          ${title ? `<h3 class="flex items-center gap-2 text-base font-bold text-slate-900">${icon ? `<span>${esc(icon)}</span>` : ''}${esc(title)}</h3>` : ''}
          ${subtitle ? `<p class="mt-1 text-sm leading-6 text-slate-500">${esc(subtitle)}</p>` : ''}
        </div>
        ${actions ? `<div class="flex flex-wrap items-center gap-2">${actions}</div>` : ''}
      </header>` : ''}
      <div class="p-5 ${bodyClass}">${content}</div>
    </section>`;
  }

  function statCard(label, value, options={}){
    const {hint='', icon='', tone='neutral'} = options;
    const toneClass = {
      neutral:'border-slate-200 bg-white',
      info:'border-sky-200 bg-sky-50/50',
      success:'border-emerald-200 bg-emerald-50/50',
      warning:'border-amber-200 bg-amber-50/50',
      danger:'border-rose-200 bg-rose-50/50'
    }[tone] || 'border-slate-200 bg-white';

    return `<div class="rounded-2xl border p-4 shadow-sm ${toneClass}">
      <div class="flex items-start justify-between gap-3">
        <div>
          <p class="text-xs font-semibold uppercase tracking-wide text-slate-500">${esc(label)}</p>
          <p class="mt-2 text-2xl font-extrabold text-slate-900">${esc(value)}</p>
          ${hint ? `<p class="mt-1 text-xs leading-5 text-slate-500">${esc(hint)}</p>` : ''}
        </div>
        ${icon ? `<span class="text-2xl" aria-hidden="true">${esc(icon)}</span>` : ''}
      </div>
    </div>`;
  }

  function emptyState(options={}){
    const {
      icon='📭',
      title='표시할 내용이 없습니다.',
      description='새로운 내용이 등록되면 이곳에 표시됩니다.',
      action=''
    } = options;

    return `<div class="flex min-h-52 flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-6 py-10 text-center">
      <div class="text-4xl" aria-hidden="true">${esc(icon)}</div>
      <h3 class="mt-4 text-base font-bold text-slate-800">${esc(title)}</h3>
      <p class="mt-2 max-w-xl text-sm leading-6 text-slate-500">${esc(description)}</p>
      ${action ? `<div class="mt-5">${action}</div>` : ''}
    </div>`;
  }

  function progress(value, options={}){
    const {label='', max=100, showValue=true, className=''} = options;
    const numeric = Number(value || 0);
    const safeMax = Math.max(1, Number(max || 100));
    const percent = Math.max(0, Math.min(100, Math.round((numeric/safeMax)*100)));

    return `<div class="${className}">
      ${(label || showValue) ? `<div class="mb-1.5 flex items-center justify-between gap-3 text-xs font-semibold text-slate-600">
        <span>${esc(label)}</span>
        ${showValue ? `<span>${percent}%</span>` : ''}
      </div>` : ''}
      <div class="h-2.5 overflow-hidden rounded-full bg-slate-200">
        <div class="h-full rounded-full bg-slate-800 transition-all" style="width:${percent}%"></div>
      </div>
    </div>`;
  }

  function alertBox(message, options={}){
    const {tone='info', title='', actions=''} = options;
    const toneClass = {
      info:'border-sky-200 bg-sky-50 text-sky-900',
      success:'border-emerald-200 bg-emerald-50 text-emerald-900',
      warning:'border-amber-200 bg-amber-50 text-amber-900',
      danger:'border-rose-200 bg-rose-50 text-rose-900',
      neutral:'border-slate-200 bg-slate-50 text-slate-800'
    }[tone] || 'border-slate-200 bg-slate-50 text-slate-800';

    return `<div class="rounded-xl border px-4 py-3 ${toneClass}">
      ${title ? `<div class="font-bold">${esc(title)}</div>` : ''}
      <div class="${title ? 'mt-1 ' : ''}text-sm leading-6">${esc(message)}</div>
      ${actions ? `<div class="mt-3 flex flex-wrap gap-2">${actions}</div>` : ''}
    </div>`;
  }

  function table(options={}){
    const {columns=[], rows=[], emptyMessage='표시할 데이터가 없습니다.', className=''} = options;
    if(!rows.length) return emptyState({icon:'📋', title:emptyMessage, description:''});

    return `<div class="overflow-x-auto rounded-xl border border-slate-200 ${className}">
      <table class="min-w-full divide-y divide-slate-200 text-sm">
        <thead class="bg-slate-50">
          <tr>${columns.map(col=>`<th class="whitespace-nowrap px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-slate-500">${esc(col.label || col.key)}</th>`).join('')}</tr>
        </thead>
        <tbody class="divide-y divide-slate-100 bg-white">
          ${rows.map(row=>`<tr class="hover:bg-slate-50">${columns.map(col=>{
            const raw = typeof col.render === 'function' ? col.render(row) : esc(row?.[col.key] ?? '');
            return `<td class="px-4 py-3 align-top text-slate-700">${raw}</td>`;
          }).join('')}</tr>`).join('')}
        </tbody>
      </table>
    </div>`;
  }

  function ensureModalRoot(){
    let root = document.getElementById('mml-ui-modal-root');
    if(!root){
      root = document.createElement('div');
      root.id = 'mml-ui-modal-root';
      document.body.appendChild(root);
    }
    return root;
  }

  function closeModal(){
    const root = document.getElementById('mml-ui-modal-root');
    if(root) root.innerHTML = '';
  }

  function openModal(options={}){
    const {
      title='',
      content='',
      confirmText='확인',
      cancelText='취소',
      tone='primary',
      onConfirm=null,
      onCancel=null,
      hideCancel=false,
      width='max-w-lg'
    } = options;

    const root = ensureModalRoot();
    root.innerHTML = `<div class="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-950/50 p-4" data-mml-modal-backdrop>
      <div class="w-full ${width} overflow-hidden rounded-2xl bg-white shadow-2xl" role="dialog" aria-modal="true">
        <div class="border-b border-slate-100 px-5 py-4">
          <h2 class="text-lg font-bold text-slate-900">${esc(title)}</h2>
        </div>
        <div class="max-h-[70vh] overflow-y-auto px-5 py-5 text-sm leading-6 text-slate-700">${content}</div>
        <div class="flex justify-end gap-2 border-t border-slate-100 bg-slate-50 px-5 py-4">
          ${hideCancel ? '' : button(cancelText,{tone:'secondary',onclick:'MMLUI.__cancelModal()'})}
          ${button(confirmText,{tone,onclick:'MMLUI.__confirmModal()'})}
        </div>
      </div>
    </div>`;

    global.MMLUI.__currentConfirm = onConfirm;
    global.MMLUI.__currentCancel = onCancel;

    const backdrop = root.querySelector('[data-mml-modal-backdrop]');
    backdrop?.addEventListener('click', event=>{
      if(event.target === backdrop) global.MMLUI.__cancelModal();
    });
  }

  function confirm(options={}){
    return new Promise(resolve=>{
      openModal({
        title:options.title || '확인',
        content:`<p>${esc(options.message || '계속 진행하시겠습니까?')}</p>`,
        confirmText:options.confirmText || '확인',
        cancelText:options.cancelText || '취소',
        tone:options.tone || 'primary',
        onConfirm:()=>resolve(true),
        onCancel:()=>resolve(false)
      });
    });
  }

  function toast(message, options={}){
    const {tone='neutral', duration=2400} = options;
    let root = document.getElementById('mml-ui-toast-root');
    if(!root){
      root = document.createElement('div');
      root.id = 'mml-ui-toast-root';
      root.className = 'fixed right-4 top-4 z-[10000] flex w-[min(92vw,360px)] flex-col gap-2';
      document.body.appendChild(root);
    }

    const toneClass = {
      neutral:'bg-slate-900 text-white',
      success:'bg-emerald-700 text-white',
      warning:'bg-amber-500 text-white',
      danger:'bg-rose-700 text-white',
      info:'bg-sky-700 text-white'
    }[tone] || 'bg-slate-900 text-white';

    const el = document.createElement('div');
    el.className = `rounded-xl px-4 py-3 text-sm font-semibold shadow-lg ${toneClass}`;
    el.textContent = String(message || '');
    root.appendChild(el);
    setTimeout(()=>el.remove(), duration);
  }

  const api = {
    version:'v31',
    esc,
    attrs,
    button,
    badge,
    card,
    statCard,
    emptyState,
    progress,
    alertBox,
    table,
    openModal,
    closeModal,
    confirm,
    toast,
    __currentConfirm:null,
    __currentCancel:null,
    __confirmModal(){
      const callback = api.__currentConfirm;
      closeModal();
      api.__currentConfirm = null;
      api.__currentCancel = null;
      if(typeof callback === 'function') callback();
    },
    __cancelModal(){
      const callback = api.__currentCancel;
      closeModal();
      api.__currentConfirm = null;
      api.__currentCancel = null;
      if(typeof callback === 'function') callback();
    }
  };

  global.MMLUI = api;
})(window);
