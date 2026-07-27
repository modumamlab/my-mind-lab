console.info('[MML] SERVER-STORE-MODULE-V37.4-LOCAL-FALLBACK loaded');

(function(global){
  'use strict';

  const API='/.netlify/functions/data-api';
  const STATUS_KEY='modumam_server_sync_status_v37';
  const QUEUE_KEYS=[
    'modumam_server_sync_queue_v37',
    'modumam_server_sync_queue',
    'modumam_server_sync_queue_v36'
  ];
  const ALLOWED_KEYS=new Set([
    'modumam_reservations',
    'modumam_intake_summaries',
    'modumam_reports',
    'modumam_test_result_uploads',
    'modumam_test_interpretations',
    'modumam_assessment_analyses',
    'modumam_assessment_report_drafts',
    'modumam_assessment_cross_analyses',
    'modumam_ai_result_counseling_records',
    'modumam_operating_settings'
  ]);

  const pendingWrites=new Map();
  const state={
    mode:'local-first-no-queue',
    online:navigator.onLine,
    serverAvailable:false,
    syncing:false,
    lastSyncAt:'',
    lastError:'',
    pending:0
  };

  function clone(value){
    try{return structuredClone(value)}catch(e){}
    try{return JSON.parse(JSON.stringify(value))}catch(e){return value}
  }

  function apiKey(){
    return sessionStorage.getItem('modumam_admin_api_key') || '';
  }

  function requestHeaders(extra={}){
    const result={'Content-Type':'application/json',...extra};
    const key=apiKey();
    if(key) result['X-MML-API-Key']=key;
    return result;
  }

  function persistStatus(){
    try{
      localStorage.setItem(STATUS_KEY,JSON.stringify({...state,updatedAt:new Date().toISOString()}));
    }catch(_){ }
  }

  function cleanupQueues(){
    try{QUEUE_KEYS.forEach(key=>localStorage.removeItem(key));}catch(_){ }
    state.pending=0;
    persistStatus();
  }

  async function request(path='',options={}){
    const response=await fetch(API+path,{
      ...options,
      headers:requestHeaders(options.headers||{}),
      cache:'no-store'
    });
    const body=await response.json().catch(()=>({}));
    if(!response.ok){
      const error=new Error(body.error||body.message||`서버 오류 ${response.status}`);
      error.status=response.status;
      error.code=body.code;
      throw error;
    }
    return body;
  }

  async function ping(){
    try{
      const body=await request('?action=ping',{method:'GET'});
      state.serverAvailable=body.ok===true && body.storage!=='disabled';
      state.lastError='';
    }catch(error){
      state.serverAvailable=false;
      state.lastError=String(error?.message||error);
    }
    persistStatus();
    return state.serverAvailable;
  }

  async function read(key,fallback=null){
    if(!ALLOWED_KEYS.has(key)) throw new Error(`허용되지 않은 서버 저장 키: ${key}`);
    const body=await request(`?key=${encodeURIComponent(key)}`,{method:'GET'});
    return body.found ? clone(body.value) : clone(fallback);
  }

  function localFallbackResult(key,error,operation){
    state.serverAvailable=false;
    state.lastError=String(error?.message||error||'서버 저장 실패');
    persistStatus();
    console.warn(`[MML ServerStore] ${operation} 서버 저장 실패 — 브라우저 로컬 저장은 정상 유지됩니다.`,key,error);
    return {
      ok:true,
      localOnly:true,
      serverSaved:false,
      key,
      operation,
      warning:state.lastError
    };
  }

  async function write(key,value,meta={}){
    if(!ALLOWED_KEYS.has(key)) throw new Error(`허용되지 않은 서버 저장 키: ${key}`);
    try{
      return await request('',{
        method:'PUT',
        body:JSON.stringify({key,value,meta})
      });
    }catch(error){
      // 보고서와 예약은 MMLDataStore가 이미 localStorage에 먼저 저장합니다.
      // Netlify Blobs가 로컬에서 준비되지 않았거나 5xx가 발생해도
      // 저장 버튼 전체를 실패시키지 않고 로컬 저장 결과를 확정합니다.
      if(!error?.status || Number(error.status)>=500 || error.code==='SERVER_STORAGE_NOT_INSTALLED'){
        return localFallbackResult(key,error,'write');
      }
      throw error;
    }
  }

  async function remove(key,meta={}){
    if(!ALLOWED_KEYS.has(key)) throw new Error(`허용되지 않은 서버 저장 키: ${key}`);
    try{
      return await request('',{
        method:'DELETE',
        body:JSON.stringify({key,meta})
      });
    }catch(error){
      if(!error?.status || Number(error.status)>=500 || error.code==='SERVER_STORAGE_NOT_INSTALLED'){
        return localFallbackResult(key,error,'remove');
      }
      throw error;
    }
  }

  async function hydrate(keys=[...ALLOWED_KEYS]){
    if(!await ping()) return {ok:false,reason:'server-unavailable'};
    const loaded=[];
    const skipped=[];
    for(const key of keys){
      try{
        const remote=await read(key,undefined);
        if(remote===undefined){skipped.push(key);continue;}
        localStorage.setItem(key,JSON.stringify(remote));
        global.MMLDataStore?.invalidate?.(key);
        loaded.push(key);
      }catch(_){skipped.push(key);}
    }
    state.lastSyncAt=new Date().toISOString();
    persistStatus();
    return {ok:true,loaded,skipped};
  }

  function runImmediate(key,task){
    if(!navigator.onLine || !ALLOWED_KEYS.has(key)) return false;
    const previous=pendingWrites.get(key);
    const token={cancelled:false};
    if(previous) previous.cancelled=true;
    pendingWrites.set(key,token);
    state.pending=pendingWrites.size;
    state.syncing=true;
    persistStatus();

    Promise.resolve().then(async()=>{
      await new Promise(resolve=>setTimeout(resolve,180));
      if(token.cancelled)return;
      try{
        await task();
        if(!token.cancelled){
          state.serverAvailable=true;
          state.lastSyncAt=new Date().toISOString();
          state.lastError='';
        }
      }catch(error){
        if(!token.cancelled){
          state.serverAvailable=false;
          state.lastError=String(error?.message||error);
          console.warn('[MML ServerStore] 서버 즉시 동기화 실패 — 로컬 저장은 유지됩니다.',key,error);
        }
      }finally{
        if(pendingWrites.get(key)===token)pendingWrites.delete(key);
        state.pending=pendingWrites.size;
        state.syncing=state.pending>0;
        persistStatus();
      }
    });
    return true;
  }

  function mirrorWrite(key,value,meta={}){
    // 보고서 전체 본문은 IndexedDB에 저장합니다. 서버 저장소가 실제로 사용 가능한
    // 상태에서만 가벼운 보고서 목록을 전송하여 로컬 Netlify 503 반복을 막습니다.
    if(key==='modumam_reports' && !state.serverAvailable){
      ping().catch(()=>{});
      return false;
    }
    return runImmediate(key,()=>write(key,clone(value),meta));
  }

  function mirrorRemove(key,meta={}){
    return runImmediate(key,()=>remove(key,meta));
  }

  async function flush(){
    cleanupQueues();
    return true;
  }

  function queue(){return [];}

  function setApiKey(value){
    if(value) sessionStorage.setItem('modumam_admin_api_key',String(value));
    else sessionStorage.removeItem('modumam_admin_api_key');
    return ping();
  }

  global.addEventListener('online',()=>{state.online=true;ping().catch(()=>{});});
  global.addEventListener('offline',()=>{state.online=false;persistStatus();});

  global.MMLServerStore=Object.freeze({
    version:'v37.4-local-fallback',
    state,
    allowedKeys:Object.freeze([...ALLOWED_KEYS]),
    ping,read,write,remove,hydrate,flush,
    mirrorWrite,mirrorRemove,setApiKey,queue
  });

  cleanupQueues();
  persistStatus();
  setTimeout(()=>ping().catch(()=>{}),500);
})(window);
