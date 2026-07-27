console.info('[MML] ASSESSMENT-PLUGIN-REGISTRY-STEP24-STORAGE-STABLE loaded');

(function(global){
  'use strict';

  const VERSION='20260725-assessment-plugins-step24-storage-stable';
  const KEY='modumam_assessment_plugin_overrides';
  const LEGACY_KEY='modumam_assessment_plugins';
  const text=v=>String(v??'').trim();
  const now=()=>new Date().toISOString();

  const builtins=Object.freeze([
    {id:'TCI',name:'TCI 기질 및 성격검사',type:'personality',active:true},
    {id:'MMPI-2',name:'MMPI-2 다면적 인성검사',type:'clinical',active:true},
    {id:'PAI',name:'PAI 성격평가검사',type:'clinical',active:true},
    {id:'SCT',name:'SCT 문장완성검사',type:'projective',active:true},
    {id:'HTP',name:'HTP 집·나무·사람 그림검사',type:'projective',active:true},
    {id:'K-CDI',name:'K-CDI 아동우울검사',type:'child',active:true},
    {id:'STS',name:'STS 양육스트레스검사',type:'parent',active:true},
    {id:'PAT',name:'PAT 부모양육태도검사',type:'parent',active:true},
    {id:'PHQ-9',name:'PHQ-9 우울 선별검사',type:'screening',active:true},
    {id:'GAD-7',name:'GAD-7 불안 선별검사',type:'screening',active:true}
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
          action:'검사 플러그인 설정 저장',
          detail:`사용자 변경 ${rows.length}건`,
          source:'assessment-plugin-registry',
          server:false
        });
        return rows;
      }
    }catch(error){
      if(error?.name!=='QuotaExceededError')console.warn('[Assessment Plugin write]',error);
    }
    try{localStorage.setItem(KEY,JSON.stringify(rows))}
    catch(_){console.warn('[Assessment Plugins] 저장공간 부족으로 현재 실행 중 메모리만 사용합니다.')}
    return rows;
  }

  function merged(){
    const overrides=safeRead();
    return builtins.map(base=>({...base,...(overrides.find(x=>text(x.id).toUpperCase()===base.id.toUpperCase())||{})}))
      .concat(overrides.filter(x=>!builtins.some(base=>base.id.toUpperCase()===text(x.id).toUpperCase())));
  }

  function list(type){
    const rows=merged();
    return type?rows.filter(x=>text(x.type)===text(type)):rows;
  }

  function get(id){
    const key=text(id).toUpperCase();
    return merged().find(x=>text(x.id).toUpperCase()===key)||null;
  }

  function register(plugin){
    if(!plugin||!text(plugin.id))throw new Error('검사 플러그인 ID가 필요합니다.');
    const rows=safeRead().slice();
    const next={
      id:text(plugin.id),
      name:text(plugin.name)||text(plugin.id),
      type:text(plugin.type)||'assessment',
      active:plugin.active!==false,
      parserName:text(plugin.parserName),
      analyzerName:text(plugin.analyzerName),
      reportRendererName:text(plugin.reportRendererName),
      metadata:plugin.metadata||{},
      updatedAt:now()
    };
    const index=rows.findIndex(x=>text(x.id).toUpperCase()===next.id.toUpperCase());
    if(index>=0)rows[index]=next; else rows.push(next);
    safeWrite(rows);
    global.MMLOS?.emit?.('assessment.plugin.registered',{pluginId:next.id});
    return next;
  }

  function execute(id,stage,payload){
    const plugin=get(id);
    if(!plugin||!plugin.active)throw new Error('활성 검사 플러그인을 찾지 못했습니다.');
    const functionName={
      parse:plugin.parserName,
      analyze:plugin.analyzerName,
      renderReport:plugin.reportRendererName
    }[stage];
    if(!functionName)return {plugin,stage,payload,status:'no-handler'};
    const handler=global[functionName];
    if(typeof handler!=='function')return {plugin,stage,payload,status:'handler-missing'};
    return handler(payload,plugin);
  }

  function cleanupLegacy(){
    try{localStorage.removeItem(LEGACY_KEY)}catch(_){}
    return true;
  }

  cleanupLegacy();

  global.MMLAssessmentPlugins=Object.freeze({
    version:VERSION,key:KEY,builtins:()=>builtins.map(x=>({...x})),
    list,get,register,execute,cleanupLegacy
  });
})(window);
