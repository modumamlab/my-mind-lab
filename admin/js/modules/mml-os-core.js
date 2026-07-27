console.info('[MML] MML-OS-CORE-STEP24-STORAGE-STABLE loaded');

(function(global){
  'use strict';

  const VERSION='20260725-mml-os-core-step24-storage-stable';
  const INDEX_KEY='modumam_os_case_index';
  const EVENT_KEY='modumam_os_events';
  const LEGACY_CASE_KEY='modumam_os_cases';
  const text=v=>String(v??'').trim();
  const arr=v=>Array.isArray(v)?v:[];
  const now=()=>new Date().toISOString();

  function safeParse(raw,fallback){
    try{return JSON.parse(raw)}catch(_){return fallback}
  }

  function read(key,fallback=[]){
    try{
      if(global.MMLDataStore?.read){
        const value=global.MMLDataStore.read(key,fallback,{fresh:true});
        return value==null?fallback:value;
      }
    }catch(error){
      console.warn('[MML OS read fallback]',key,error);
    }
    try{
      const raw=localStorage.getItem(key);
      return raw==null?fallback:safeParse(raw,fallback);
    }catch(_){return fallback}
  }

  function compactOnQuota(){
    try{
      localStorage.removeItem(LEGACY_CASE_KEY);
      const events=arr(safeParse(localStorage.getItem(EVENT_KEY)||'[]',[])).slice(0,100);
      localStorage.setItem(EVENT_KEY,JSON.stringify(events));
    }catch(_){}
  }

  function write(key,value,detail){
    try{
      if(global.MMLDataStore?.write){
        return global.MMLDataStore.write(key,value,{
          action:'MML OS 경량 저장',
          detail:detail||key,
          source:'mml-os-core',
          server:false
        });
      }
    }catch(error){
      if(error?.name!=='QuotaExceededError')console.warn('[MML OS datastore write]',error);
    }

    try{
      localStorage.setItem(key,JSON.stringify(value));
      return value;
    }catch(error){
      if(error?.name==='QuotaExceededError'){
        compactOnQuota();
        try{
          localStorage.setItem(key,JSON.stringify(value));
          return value;
        }catch(_){
          console.warn('[MML OS] 브라우저 저장공간 부족으로 현재 실행 중 메모리만 사용합니다.');
          return value;
        }
      }
      throw error;
    }
  }

  const listeners=new Map();
  const runtimeCases=new Map();

  function on(type,handler){
    const key=text(type);
    if(!listeners.has(key))listeners.set(key,new Set());
    listeners.get(key).add(handler);
    return ()=>listeners.get(key)?.delete(handler);
  }

  function emit(type,payload={}){
    const event={
      id:`event:${Date.now()}:${Math.random().toString(36).slice(2,8)}`,
      type:text(type),
      payload,
      createdAt:now(),
      source:'mml-os'
    };
    const events=arr(read(EVENT_KEY,[]));
    events.unshift(event);
    write(EVENT_KEY,events.slice(0,200),`이벤트 ${event.type}`);

    [...(listeners.get(event.type)||[]),...(listeners.get('*')||[])].forEach(handler=>{
      try{handler(event)}catch(error){console.warn('[MML OS event handler]',error)}
    });

    try{
      global.dispatchEvent(new CustomEvent(`mml-os:${event.type}`,{detail:event}));
      global.dispatchEvent(new CustomEvent('mml-os:event',{detail:event}));
    }catch(_){}
    return event;
  }

  function buildCase(reservationIdValue){
    const id=text(reservationIdValue);
    const bundle=global.MMLIntegratedWorkflowHub?.caseBundle?.(id);
    if(!bundle)throw new Error('통합 워크플로 사례를 찾지 못했습니다.');

    const reservation=bundle.reservation||{};
    const caseState=global.MMLCaseManagementEngine?.getCase?.(id)||{};
    const clientState=global.MMLServiceStateEngine?.buildSnapshot?.(id)||null;
    const reports=arr(bundle.assessmentCenter?.reports);
    const records=arr(bundle.electronicChart?.counselingRecords);
    const counseling=arr(bundle.electronicChart?.counseling);
    const formulations=arr(bundle.electronicChart?.formulations);
    const metrics=global.MMLCaseManagementEngine?.getMetrics?.(id)||[];

    return {
      id:`case:${id}`,
      reservationId:id,
      version:VERSION,
      client:{
        id:text(reservation.clientId||reservation.memberId||reservation.userId),
        name:text(reservation.clientName||reservation.name||reservation.userName),
        email:text(reservation.email),
        phone:text(reservation.phone)
      },
      reservation,
      workflow:{
        status:text(clientState?.status||caseState.status||reservation.status||'예약 완료'),
        nextAction:text(clientState?.nextAction||caseState.nextAction),
        progress:Number(caseState.progress||0),
        updatedAt:now()
      },
      assessment:{
        files:arr(bundle.assessmentCenter?.files),
        analyses:arr(bundle.assessmentCenter?.analyses),
        completed:Boolean(bundle.state?.hasAssessment)
      },
      reports,
      publications:arr(bundle.clientPortal?.published),
      counseling:{
        sessions:counseling,
        records,
        active:Boolean(bundle.state?.hasCounseling),
        enabled:Boolean(clientState?.counseling?.enabled)
      },
      caseConceptualization:formulations,
      recovery:{metrics,latest:metrics[metrics.length-1]||null},
      supervisorReviews:global.MMLAISupervisorEngine?.getByReservation?.(id)||[],
      audit:{
        createdAt:text(caseState.createdAt||reservation.createdAt||now()),
        updatedAt:now(),
        source:'integrated-workflow-hub'
      }
    };
  }

  function indexRecord(item){
    return {
      reservationId:text(item.reservationId),
      clientId:text(item.client?.id),
      clientName:text(item.client?.name),
      programName:text(item.reservation?.programName||item.reservation?.program),
      status:text(item.workflow?.status),
      nextAction:text(item.workflow?.nextAction),
      reportCount:arr(item.reports).length,
      publicationCount:arr(item.publications).length,
      counselingSessionCount:arr(item.counseling?.sessions).length,
      counselingRecordCount:arr(item.counseling?.records).length,
      recoveryMetricCount:arr(item.recovery?.metrics).length,
      updatedAt:now()
    };
  }

  function saveCase(item){
    runtimeCases.set(text(item.reservationId),item);

    const rows=arr(read(INDEX_KEY,[]));
    const next=indexRecord(item);
    const index=rows.findIndex(row=>text(row.reservationId)===next.reservationId);
    if(index>=0)rows[index]=next; else rows.unshift(next);
    write(INDEX_KEY,rows.slice(0,500),'Case 인덱스 동기화');

    emit('case.saved',{reservationId:next.reservationId,status:next.status});
    return item;
  }

  function getCase(reservationIdValue){
    const id=text(reservationIdValue);
    if(runtimeCases.has(id))return runtimeCases.get(id);
    try{
      const item=buildCase(id);
      runtimeCases.set(id,item);
      return item;
    }catch(_){return null}
  }

  function allCases(){
    const indexRows=arr(read(INDEX_KEY,[]));
    if(indexRows.length)return indexRows.map(row=>getCase(row.reservationId)).filter(Boolean);
    const source=global.MMLIntegratedWorkflowHub?.allCases?.()||[];
    return source.map(row=>getCase(row.reservationId)).filter(Boolean);
  }

  function syncCase(reservationIdValue){
    const id=text(reservationIdValue);
    const previous=runtimeCases.get(id)||null;
    const next=saveCase(buildCase(id));

    if(!previous){
      emit('case.created',{reservationId:id});
    }else if(text(previous.workflow?.status)!==text(next.workflow?.status)){
      emit('workflow.status.changed',{
        reservationId:id,
        previousStatus:previous.workflow?.status,
        status:next.workflow?.status
      });
    }
    return next;
  }

  function syncAll(){
    const rows=global.MMLIntegratedWorkflowHub?.allCases?.()||[];
    const cases=rows.map(item=>syncCase(item.reservationId));
    emit('system.sync.completed',{count:cases.length});
    return cases;
  }

  const FLOW=['예약 완료','검사 진행중','검사 완료','보고서 작성중','승인 완료','AI 상담 가능','상담 진행중','종결'];

  function workflowIndex(status){
    return Math.max(0,FLOW.indexOf(text(status)));
  }

  function canTransition(from,to){
    const a=workflowIndex(from), b=workflowIndex(to);
    return b===a||b===a+1||to==='종결'||(from==='종결'&&to==='상담 진행중');
  }

  function transition(reservationIdValue,to,meta={}){
    const item=getCase(reservationIdValue)||syncCase(reservationIdValue);
    const from=text(item.workflow?.status);
    const target=text(to);
    if(!FLOW.includes(target))throw new Error(`지원하지 않는 워크플로 상태: ${target}`);
    if(!canTransition(from,target))throw new Error(`${from} → ${target} 전환은 허용되지 않습니다.`);

    item.workflow={...(item.workflow||{}),status:target,previousStatus:from,updatedAt:now(),transitionMeta:meta};
    saveCase(item);
    emit('workflow.transitioned',{reservationId:item.reservationId,from,to:target,meta});
    return item;
  }

  function eventHistory(filter={}){
    return arr(read(EVENT_KEY,[])).filter(event=>{
      if(filter.type&&text(event.type)!==text(filter.type))return false;
      if(filter.reservationId&&text(event.payload?.reservationId)!==text(filter.reservationId))return false;
      return true;
    });
  }

  function storageDiagnostics(){
    let total=0,keys=[];
    try{
      for(let i=0;i<localStorage.length;i++){
        const key=localStorage.key(i);
        const size=(localStorage.getItem(key)||'').length;
        total+=size;
        keys.push({key,size});
      }
    }catch(_){}
    return {
      version:VERSION,
      estimatedCharacters:total,
      largestKeys:keys.sort((a,b)=>b.size-a.size).slice(0,15),
      legacyFullCaseStorePresent:keys.some(x=>x.key===LEGACY_CASE_KEY),
      runtimeCaseCount:runtimeCases.size,
      persistedIndexCount:arr(read(INDEX_KEY,[])).length,
      eventCount:arr(read(EVENT_KEY,[])).length
    };
  }

  function cleanupLegacyStorage(){
    try{localStorage.removeItem(LEGACY_CASE_KEY)}catch(_){}
    const events=arr(read(EVENT_KEY,[])).slice(0,100);
    write(EVENT_KEY,events,'이벤트 이력 축소');
    emit('storage.cleaned',{removed:[LEGACY_CASE_KEY],eventCount:events.length});
    return storageDiagnostics();
  }

  function installDefaultAutomations(){
    on('workflow.status.changed',event=>{
      try{global.MMLServiceStateEngine?.syncReservation?.(event.payload?.reservationId)}catch(_){}
    });
    on('workflow.transitioned',event=>{
      try{global.MMLServiceStateEngine?.syncReservation?.(event.payload?.reservationId)}catch(_){}
    });
  }

  installDefaultAutomations();

  let timer=null;
  function start(interval=30000){
    stop();
    syncAll();
    timer=setInterval(()=>{try{syncAll()}catch(error){console.warn('[MML OS auto sync]',error)}},Math.max(15000,Number(interval)||30000));
    return timer;
  }
  function stop(){if(timer){clearInterval(timer);timer=null}}

  global.MMLOS=Object.freeze({
    version:VERSION,
    keys:{caseIndex:INDEX_KEY,events:EVENT_KEY,legacyCases:LEGACY_CASE_KEY},
    flow:FLOW.slice(),
    on,emit,buildCase,saveCase,syncCase,syncAll,getCase,allCases,
    transition,canTransition,eventHistory,storageDiagnostics,cleanupLegacyStorage,start,stop
  });

  setTimeout(()=>{
    try{
      cleanupLegacyStorage();
      start();
    }catch(error){console.warn('[MML OS initial sync]',error)}
  },1800);
})(window);
