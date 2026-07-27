(function(global){
'use strict';

const root=global.MMLClinicalModules=global.MMLClinicalModules||{};
const VERSION='1.0.0';
const READY_EVENT='mml:clinical-ready';
const ERROR_EVENT='mml:clinical-bootstrap-error';
let bootPromise=null;
let bootResult=null;

const now=()=>new Date().toISOString();
const clone=value=>{try{return JSON.parse(JSON.stringify(value??null));}catch(_){return value;}};

function getEngine(){return global.MMLClinicalEngine||{};}
function callOptional(target,name,args=[]){
  try{
    const fn=target?.[name];
    if(typeof fn!=='function')return {called:false,ok:true,value:null};
    return {called:true,ok:true,value:fn.apply(target,args)};
  }catch(error){
    return {called:true,ok:false,error:String(error?.message||error)};
  }
}

function inspect(){
  const engine=getEngine();
  const moduleInspection=callOptional(engine,'inspectClinicalModules').value||{};
  const storeInspection=callOptional(engine,'inspectClinicalStore').value||{};
  const reportInspection=callOptional(engine,'inspectReportService').value||{};
  return {
    ready:Boolean(moduleInspection.ready&&storeInspection.ready),
    version:VERSION,
    engineVersion:engine.version||'',
    modules:moduleInspection,
    store:storeInspection,
    reportService:reportInspection,
    bootedAt:bootResult?.bootedAt||''
  };
}

function dispatch(name,detail){
  try{global.dispatchEvent(new CustomEvent(name,{detail:clone(detail)}));}catch(_){ }
}

async function initializeClinicalPlatform(options={}){
  if(bootPromise&&!options.force)return bootPromise;

  bootPromise=(async()=>{
    const startedAt=now();
    const steps=[];
    let engine=getEngine();

    const refresh=callOptional(engine,'refreshClinicalEngine');
    steps.push({name:'refresh-engine',...refresh});
    if(refresh.ok&&refresh.value)engine=refresh.value;

    if(options.migrate!==false){
      const migration=callOptional(engine,'migrateLegacyStores',[{force:Boolean(options.forceMigration)}]);
      steps.push({name:'migrate-legacy-stores',...migration});
    }

    const sessionSync=callOptional(engine,'syncCompletedSessions');
    steps.push({name:'sync-completed-sessions',...sessionSync});

    if(options.syncAssessments!==false){
      const assessmentStore=global.MMLClinicalAssessmentStore;
      let records=[];
      try{
        if(typeof assessmentStore?.getAll==='function')records=assessmentStore.getAll()||[];
        else if(typeof assessmentStore?.list==='function')records=assessmentStore.list()||[];
        else if(Array.isArray(assessmentStore?.records))records=assessmentStore.records;
      }catch(error){
        steps.push({name:'read-assessment-store',called:true,ok:false,error:String(error?.message||error)});
      }
      if(Array.isArray(records)&&records.length&&typeof engine.syncAssessmentStoreRecord==='function'){
        let synced=0;
        const failures=[];
        for(const record of records){
          const id=record?.reservationId||record?.id;
          if(!id)continue;
          try{engine.syncAssessmentStoreRecord(id);synced+=1;}catch(error){failures.push({id,error:String(error?.message||error)});}
        }
        steps.push({name:'sync-assessment-records',called:true,ok:failures.length===0,value:{synced,failures}});
      }
    }

    const validation=callOptional(engine,'runClinicalIntegrationValidation');
    steps.push({name:'integration-validation',...validation});

    const failed=steps.filter(step=>step.called&&step.ok===false);
    bootResult={
      ready:failed.length===0,
      version:VERSION,
      startedAt,
      bootedAt:now(),
      steps,
      inspection:inspect()
    };

    if(bootResult.ready)dispatch(READY_EVENT,bootResult);
    else dispatch(ERROR_EVENT,bootResult);
    return clone(bootResult);
  })();

  return bootPromise;
}

function getClinicalBootstrapState(){return clone(bootResult||{ready:false,version:VERSION,bootedAt:'',steps:[]});}

root.clinicalBootstrap=Object.freeze({
  version:VERSION,
  readyEvent:READY_EVENT,
  errorEvent:ERROR_EVENT,
  initializeClinicalPlatform,
  getClinicalBootstrapState,
  inspectClinicalPlatform:inspect
});

function autoBoot(){
  initializeClinicalPlatform().catch(error=>{
    const detail={ready:false,version:VERSION,error:String(error?.message||error),bootedAt:now()};
    bootResult=detail;
    dispatch(ERROR_EVENT,detail);
    console.error('[MML Clinical Bootstrap] 초기화 실패',error);
  });
}

if(global.document?.readyState==='loading')global.document.addEventListener('DOMContentLoaded',autoBoot,{once:true});
else setTimeout(autoBoot,0);
})(window);
