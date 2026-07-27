console.info('[MML] PROMPT-REGISTRY-STEP24-STORAGE-STABLE loaded');

(function(global){
  'use strict';

  const VERSION='20260725-prompt-registry-step24-storage-stable';
  const KEY='modumam_prompt_registry_overrides';
  const LEGACY_KEY='modumam_prompt_registry';
  const text=v=>String(v??'').trim();
  const arr=v=>Array.isArray(v)?v:[];
  const now=()=>new Date().toISOString();

  const defaults=Object.freeze([
    {id:'mind-check',name:'AI 마음체크',category:'intake',version:'1.0',active:true},
    {id:'ai-counseling',name:'AI 상담',category:'counseling',version:'1.0',active:true},
    {id:'assessment-report',name:'AI 심리검사 보고서',category:'report',version:'1.0',active:true},
    {id:'case-conceptualization',name:'AI 사례개념화',category:'clinical',version:'1.0',active:true},
    {id:'ai-supervisor',name:'AI 슈퍼바이저',category:'supervision',version:'1.0',active:true}
  ]);

  const memory={overrides:null};

  function safeRead(){
    if(memory.overrides)return memory.overrides;
    let rows=[];
    try{
      if(global.MMLDataStore?.read)rows=global.MMLDataStore.read(KEY,[],{fresh:true});
      else rows=JSON.parse(localStorage.getItem(KEY)||'[]');
    }catch(_){rows=[]}
    memory.overrides=Array.isArray(rows)?rows:[];
    return memory.overrides;
  }

  function safeWrite(rows){
    memory.overrides=rows;
    try{
      if(global.MMLDataStore?.write){
        global.MMLDataStore.write(KEY,rows,{
          action:'프롬프트 설정 저장',
          detail:`사용자 변경 ${rows.length}건`,
          source:'prompt-registry',
          server:false
        });
        return rows;
      }
    }catch(error){
      if(error?.name!=='QuotaExceededError')console.warn('[Prompt Registry write]',error);
    }
    try{localStorage.setItem(KEY,JSON.stringify(rows))}
    catch(error){console.warn('[Prompt Registry] 저장공간 부족으로 현재 실행 중 메모리만 사용합니다.')}
    return rows;
  }

  function merged(){
    const overrides=safeRead();
    return defaults.map(base=>({...base,...(overrides.find(x=>text(x.id)===base.id)||{})}))
      .concat(overrides.filter(x=>!defaults.some(base=>base.id===text(x.id))));
  }

  function list(category){
    const rows=merged();
    return category?rows.filter(x=>text(x.category)===text(category)):rows;
  }

  function get(id){return merged().find(x=>text(x.id)===text(id))||null}

  function register(item){
    const rows=safeRead().slice();
    const next={
      id:text(item.id)||`prompt:${Date.now()}`,
      name:text(item.name)||'이름 없는 프롬프트',
      category:text(item.category)||'general',
      version:text(item.version)||'1.0',
      active:item.active!==false,
      content:text(item.content),
      systemInstruction:text(item.systemInstruction),
      safetyRules:arr(item.safetyRules),
      variables:arr(item.variables),
      updatedAt:now()
    };
    const index=rows.findIndex(x=>text(x.id)===next.id);
    if(index>=0)rows[index]=next; else rows.push(next);
    safeWrite(rows);
    global.MMLOS?.emit?.('prompt.registered',{promptId:next.id,version:next.version});
    return next;
  }

  function setActive(id,active){
    const current=get(id);
    if(!current)throw new Error('프롬프트를 찾지 못했습니다.');
    return register({...current,active});
  }

  function resolve(id,variables={}){
    const item=get(id);
    if(!item||!item.active)throw new Error('활성 프롬프트를 찾지 못했습니다.');
    let content=text(item.content||item.systemInstruction);
    Object.entries(variables).forEach(([key,value])=>{
      content=content.replaceAll(`{{${key}}}`,String(value??''));
    });
    return {...item,resolvedContent:content};
  }

  function cleanupLegacy(){
    try{localStorage.removeItem(LEGACY_KEY)}catch(_){}
    return true;
  }

  cleanupLegacy();

  global.MMLPromptRegistry=Object.freeze({
    version:VERSION,key:KEY,defaults:()=>defaults.map(x=>({...x})),
    list,get,register,activate:id=>setActive(id,true),
    deactivate:id=>setActive(id,false),resolve,cleanupLegacy
  });
})(window);
