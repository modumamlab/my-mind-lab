console.info('[MML] HEALTH-ENGINE-MODULE-V34 loaded');

(function(global){
  'use strict';

  const HEALTH_KEY = 'modumam_system_health_v34';
  const ERROR_KEY = 'modumam_runtime_errors_v34';
  const PERF_KEY = 'modumam_performance_metrics_v34';
  const MAX_ERRORS = 100;
  const MAX_METRICS = 200;

  const state = {
    startedAt:new Date().toISOString(),
    modules:{},
    renderCount:0,
    lastRenderAt:'',
    lastRenderDuration:0,
    duplicateRenderSkips:0,
    errors:[],
    warnings:[]
  };

  function clone(value){
    try{return structuredClone(value)}catch(e){}
    try{return JSON.parse(JSON.stringify(value))}catch(e){return value}
  }

  function safeParse(text,fallback){
    try{return text ? JSON.parse(text) : clone(fallback)}
    catch(error){return clone(fallback)}
  }

  function now(){return new Date().toISOString()}

  function saveErrors(){
    try{
      localStorage.setItem(ERROR_KEY,JSON.stringify(state.errors.slice(0,MAX_ERRORS)));
    }catch(error){}
  }

  function captureError(error,context='runtime'){
    const item={
      id:`${Date.now()}-${Math.random().toString(36).slice(2,8)}`,
      at:now(),
      context:String(context||'runtime'),
      message:String(error?.message||error||'알 수 없는 오류'),
      stack:String(error?.stack||'').slice(0,4000)
    };
    state.errors.unshift(item);
    state.errors=state.errors.slice(0,MAX_ERRORS);
    saveErrors();
    return item;
  }

  function warning(message,context='system'){
    const item={at:now(),context,message:String(message||'')};
    state.warnings.unshift(item);
    state.warnings=state.warnings.slice(0,100);
    return item;
  }

  function markModule(name,status='loaded',detail=''){
    state.modules[String(name||'unknown')]={
      status,
      detail:String(detail||''),
      at:now()
    };
  }

  function storageUsage(){
    let bytes=0;
    let items=0;
    const largest=[];
    try{
      for(let i=0;i<localStorage.length;i++){
        const key=localStorage.key(i);
        const value=localStorage.getItem(key)||'';
        const size=(String(key).length+value.length)*2;
        bytes+=size;
        items+=1;
        largest.push({key,size});
      }
    }catch(error){
      captureError(error,'storageUsage');
    }
    largest.sort((a,b)=>b.size-a.size);
    return {
      bytes,
      kb:Math.round(bytes/1024),
      mb:Number((bytes/1024/1024).toFixed(2)),
      items,
      largest:largest.slice(0,10)
    };
  }

  function moduleStatus(){
    const expected={
      dataStore:!!global.MMLDataStore,
      sync:!!global.MMLSync,
      ui:!!global.MMLUI,
      print:!!global.MMLPrintEngine
    };
    Object.entries(expected).forEach(([name,ok])=>{
      markModule(name,ok?'loaded':'missing');
      if(!ok) warning(`${name} 모듈을 찾지 못했습니다.`,'moduleStatus');
    });
    return expected;
  }

  function dataValidation(){
    if(!global.MMLDataStore?.validateAll){
      return {ok:false,error:'MMLDataStore가 없습니다.'};
    }
    try{
      const result=global.MMLDataStore.validateAll();
      const errors=[];
      const warnings=[];
      Object.entries(result).forEach(([key,value])=>{
        (value.errors||[]).forEach(message=>errors.push({key,message}));
        (value.warnings||[]).forEach(message=>warnings.push({key,message}));
      });
      return {ok:errors.length===0,errors,warnings,result};
    }catch(error){
      captureError(error,'dataValidation');
      return {ok:false,error:String(error?.message||error)};
    }
  }

  function saveHealth(report){
    try{
      localStorage.setItem(HEALTH_KEY,JSON.stringify(report));
    }catch(error){
      captureError(error,'saveHealth');
    }
    return report;
  }

  function runHealthCheck(){
    const report={
      version:'v34',
      checkedAt:now(),
      startedAt:state.startedAt,
      modules:moduleStatus(),
      storage:storageUsage(),
      data:dataValidation(),
      render:{
        count:state.renderCount,
        lastAt:state.lastRenderAt,
        lastDuration:state.lastRenderDuration,
        duplicateSkips:state.duplicateRenderSkips
      },
      errors:state.errors.slice(0,20),
      warnings:state.warnings.slice(0,20),
      online:navigator.onLine,
      userAgent:navigator.userAgent
    };

    report.ok=
      Object.values(report.modules).every(Boolean) &&
      report.data.ok &&
      report.storage.mb < 4.5 &&
      report.errors.length===0;

    return saveHealth(report);
  }

  function cleanup(options={}){
    const removed=[];
    const keepAudit=Number(options.keepAudit||300);
    const keepErrors=Number(options.keepErrors||50);
    const keepMetrics=Number(options.keepMetrics||100);

    try{
      const auditKey='modumam_admin_audit_log';
      const audit=safeParse(localStorage.getItem(auditKey),[]);
      if(Array.isArray(audit)&&audit.length>keepAudit){
        localStorage.setItem(auditKey,JSON.stringify(audit.slice(0,keepAudit)));
        removed.push(`${audit.length-keepAudit}개 감사로그`);
      }

      const errors=safeParse(localStorage.getItem(ERROR_KEY),[]);
      if(Array.isArray(errors)&&errors.length>keepErrors){
        localStorage.setItem(ERROR_KEY,JSON.stringify(errors.slice(0,keepErrors)));
        removed.push(`${errors.length-keepErrors}개 오류로그`);
      }

      const metrics=safeParse(localStorage.getItem(PERF_KEY),[]);
      if(Array.isArray(metrics)&&metrics.length>keepMetrics){
        localStorage.setItem(PERF_KEY,JSON.stringify(metrics.slice(0,keepMetrics)));
        removed.push(`${metrics.length-keepMetrics}개 성능기록`);
      }

      const expiredBefore=Date.now()-(30*24*60*60*1000);
      const backupIndexes=[];
      for(let i=0;i<localStorage.length;i++){
        const key=localStorage.key(i);
        if(String(key).startsWith('modumam_backup__')&&String(key).endsWith('__index')){
          backupIndexes.push(key);
        }
      }
      backupIndexes.forEach(indexKey=>{
        const index=safeParse(localStorage.getItem(indexKey),[]);
        const keep=[];
        index.forEach(item=>{
          const time=Date.parse(item?.createdAt||'');
          if(time && time<expiredBefore){
            const baseKey=indexKey.replace(/__index$/,'');
            localStorage.removeItem(`${baseKey}__${item.id}`);
            removed.push(`오래된 백업 ${item.id}`);
          }else{
            keep.push(item);
          }
        });
        localStorage.setItem(indexKey,JSON.stringify(keep.slice(0,5)));
      });

      global.MMLDataStore?.invalidate?.();
    }catch(error){
      captureError(error,'cleanup');
    }

    return {removed,usage:storageUsage()};
  }

  function metric(name,duration,detail={}){
    const item={
      at:now(),
      name:String(name||'metric'),
      duration:Number(duration||0),
      detail:clone(detail)
    };
    try{
      const rows=safeParse(localStorage.getItem(PERF_KEY),[]);
      rows.unshift(item);
      localStorage.setItem(PERF_KEY,JSON.stringify(rows.slice(0,MAX_METRICS)));
    }catch(error){}
    return item;
  }

  let renderScheduled=false;
  let lastRenderRequest=0;

  function requestRender(callback){
    const current=performance.now();
    if(renderScheduled && current-lastRenderRequest<32){
      state.duplicateRenderSkips+=1;
      return false;
    }

    renderScheduled=true;
    lastRenderRequest=current;

    requestAnimationFrame(()=>{
      const started=performance.now();
      try{
        if(typeof callback==='function') callback();
      }catch(error){
        captureError(error,'render');
        throw error;
      }finally{
        const duration=performance.now()-started;
        state.renderCount+=1;
        state.lastRenderAt=now();
        state.lastRenderDuration=Number(duration.toFixed(2));
        metric('render',duration);
        renderScheduled=false;
      }
    });
    return true;
  }

  function recentErrors(){
    return safeParse(localStorage.getItem(ERROR_KEY),[]);
  }

  function recentMetrics(){
    return safeParse(localStorage.getItem(PERF_KEY),[]);
  }

  function exportDiagnostics(){
    return {
      health:runHealthCheck(),
      errors:recentErrors(),
      metrics:recentMetrics(),
      sync:global.MMLSync?.state?.()||null,
      snapshot:global.MMLDataStore?.snapshot?.()||null
    };
  }

  global.addEventListener('error',event=>{
    captureError(event.error||event.message,'window.error');
  });

  global.addEventListener('unhandledrejection',event=>{
    captureError(event.reason,'unhandledrejection');
  });

  global.addEventListener('online',()=>markModule('network','online'));
  global.addEventListener('offline',()=>warning('네트워크 연결이 끊어졌습니다.','network'));

  const api=Object.freeze({
    version:'v34',
    state,
    markModule,
    captureError,
    warning,
    storageUsage,
    moduleStatus,
    dataValidation,
    runHealthCheck,
    cleanup,
    metric,
    requestRender,
    recentErrors,
    recentMetrics,
    exportDiagnostics
  });

  global.MMLHealth=api;

  setTimeout(()=>{
    const report=runHealthCheck();
    if(!report.ok){
      console.warn('[MML] 시스템 점검 경고',report);
    }
  },700);
})(window);
