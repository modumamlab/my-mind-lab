console.info('[MML] UNIFIED-STORE-GATEWAY-STEP25 loaded');

(function(global){
  'use strict';

  const VERSION='20260725-unified-store-step25';
  const memory=new Map();
  const text=v=>String(v??'').trim();

  function clone(value){
    try{return structuredClone(value)}
    catch(_){
      try{return JSON.parse(JSON.stringify(value))}
      catch(__){return value}
    }
  }

  function read(key,fallback=null,options={}){
    const name=text(key);
    if(!name)return clone(fallback);

    if(memory.has(name) && options.fresh!==true){
      return clone(memory.get(name));
    }

    try{
      if(global.MMLDataStore?.read){
        const value=global.MMLDataStore.read(name,fallback,{fresh:options.fresh===true});
        memory.set(name,clone(value));
        return clone(value);
      }
    }catch(error){
      console.warn('[UnifiedStore] MMLDataStore.read 실패',name,error);
    }

    try{
      const raw=localStorage.getItem(name);
      const value=raw==null?fallback:JSON.parse(raw);
      memory.set(name,clone(value));
      return clone(value);
    }catch(error){
      console.warn('[UnifiedStore] localStorage.read 실패',name,error);
      return clone(fallback);
    }
  }

  function write(key,value,options={}){
    const name=text(key);
    if(!name)throw new Error('저장 키가 필요합니다.');
    const next=clone(value);
    memory.set(name,next);

    try{
      if(global.MMLDataStore?.write){
        global.MMLDataStore.write(name,next,{
          action:options.action||'통합 저장',
          detail:options.detail||name,
          source:options.source||'unified-store-gateway',
          server:options.server===true
        });
        notify(name,next,options);
        return clone(next);
      }
    }catch(error){
      if(error?.name!=='QuotaExceededError')console.warn('[UnifiedStore] MMLDataStore.write 실패',name,error);
    }

    try{
      localStorage.setItem(name,JSON.stringify(next));
    }catch(error){
      if(error?.name==='QuotaExceededError'){
        console.warn('[UnifiedStore] 저장공간 부족: 메모리 상태로 계속 동작',name);
      }else{
        console.warn('[UnifiedStore] localStorage.write 실패',name,error);
      }
    }
    notify(name,next,options);
    return clone(next);
  }

  function remove(key,options={}){
    const name=text(key);
    memory.delete(name);
    try{
      if(global.MMLDataStore?.remove){
        global.MMLDataStore.remove(name,{
          action:options.action||'통합 저장 삭제',
          detail:options.detail||name,
          source:options.source||'unified-store-gateway'
        });
      }else{
        localStorage.removeItem(name);
      }
    }catch(error){
      console.warn('[UnifiedStore] remove 실패',name,error);
    }
    notify(name,null,{...options,removed:true});
  }

  function update(key,updater,fallback=null,options={}){
    if(typeof updater!=='function')throw new Error('updater 함수가 필요합니다.');
    const current=read(key,fallback,{fresh:true});
    return write(key,updater(clone(current)),options);
  }

  function notify(key,value,options={}){
    try{
      global.dispatchEvent(new CustomEvent('mml:store-changed',{
        detail:{key,value:clone(value),options,updatedAt:new Date().toISOString()}
      }));
    }catch(_){}
  }

  function inspect(){
    const keys=[];
    try{
      for(let i=0;i<localStorage.length;i++){
        const key=localStorage.key(i);
        const raw=localStorage.getItem(key)||'';
        keys.push({key,size:raw.length});
      }
    }catch(_){}
    return {
      version:VERSION,
      cachedKeys:[...memory.keys()],
      localStorageKeys:keys.sort((a,b)=>b.size-a.size),
      localStorageCharacters:keys.reduce((sum,row)=>sum+row.size,0),
      dataStoreAvailable:Boolean(global.MMLDataStore)
    };
  }

  global.MMLUnifiedStore=Object.freeze({
    version:VERSION,
    read,write,remove,update,inspect,
    clearMemory(){memory.clear()}
  });
})(window);
