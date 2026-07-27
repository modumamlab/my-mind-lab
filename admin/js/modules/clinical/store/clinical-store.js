(function(global){
'use strict';

const root=global.MMLClinicalModules=global.MMLClinicalModules||{};
const VERSION='1.0.0';
const STORAGE_KEY='modumam_clinical_store_v1';
const EVENT_NAME='mml:clinical-store-changed';

const clone=value=>{try{return JSON.parse(JSON.stringify(value??null));}catch(_){return value;}};
const now=()=>new Date().toISOString();
const text=value=>String(value??'').trim();
const uid=prefix=>`${prefix}-${Date.now()}-${Math.random().toString(36).slice(2,9)}`;

function emptyState(){
  return {
    version:VERSION,
    updatedAt:now(),
    clients:[],
    reservations:[],
    assessments:[],
    workflows:[],
    reports:[],
    counselingSessions:[],
    counselingRecords:[],
    caseConceptDrafts:[],
    caseConceptRecords:[],
    chartRecords:[],
    meta:{migratedAt:'',migrationSources:[]}
  };
}

function normalizeState(input){
  const base=emptyState();
  const source=input&&typeof input==='object'?input:{};
  Object.keys(base).forEach(key=>{
    if(Array.isArray(base[key]))base[key]=Array.isArray(source[key])?source[key]:[];
    else if(key==='meta')base.meta={...base.meta,...(source.meta||{})};
    else if(source[key]!==undefined)base[key]=source[key];
  });
  base.version=VERSION;
  base.updatedAt=source.updatedAt||now();
  return base;
}

function load(){
  try{
    const raw=global.localStorage?.getItem(STORAGE_KEY);
    return normalizeState(raw?JSON.parse(raw):emptyState());
  }catch(error){
    console.warn('[ClinicalStore] 저장소 읽기 실패',error);
    return emptyState();
  }
}

function save(state,detail={}){
  const next=normalizeState(state);
  next.updatedAt=now();
  try{global.localStorage?.setItem(STORAGE_KEY,JSON.stringify(next));}catch(error){console.warn('[ClinicalStore] 저장소 쓰기 실패',error);}
  try{global.dispatchEvent(new CustomEvent(EVENT_NAME,{detail:{...clone(detail),state:clone(next),at:next.updatedAt}}));}catch(_){ }
  return clone(next);
}

function list(collection,filter={}){
  const rows=load()[collection]||[];
  const entries=Object.entries(filter||{}).filter(([,value])=>value!==undefined&&value!==null&&value!=='');
  return clone(rows.filter(item=>entries.every(([key,value])=>{
    if(Array.isArray(value))return value.map(String).includes(String(item?.[key]));
    return String(item?.[key]??'')===String(value);
  })));
}

function get(collection,id){
  return clone((load()[collection]||[]).find(item=>String(item.id)===String(id))||null);
}

function upsert(collection,record,options={}){
  const state=load();
  const rows=Array.isArray(state[collection])?state[collection]:[];
  const incoming=clone(record)||{};
  const identityKeys=options.identityKeys||['id'];
  let index=-1;
  if(incoming.id!==undefined)index=rows.findIndex(item=>String(item.id)===String(incoming.id));
  if(index<0&&identityKeys.length){
    index=rows.findIndex(item=>identityKeys.every(key=>incoming[key]!==undefined&&String(item?.[key]??'')===String(incoming[key])));
  }
  const id=incoming.id||(index>=0?rows[index].id:uid(options.prefix||collection.slice(0,-1).toUpperCase()));
  const next={...(index>=0?rows[index]:{}),...incoming,id,updatedAt:now(),createdAt:incoming.createdAt||(index>=0?rows[index].createdAt:now())};
  if(index>=0)rows[index]=next; else rows.unshift(next);
  state[collection]=rows;
  save(state,{action:index>=0?'updated':'created',collection,id});
  return clone(next);
}

function remove(collection,id){
  const state=load();
  const rows=state[collection]||[];
  const removed=rows.find(item=>String(item.id)===String(id))||null;
  state[collection]=rows.filter(item=>String(item.id)!==String(id));
  save(state,{action:'deleted',collection,id});
  return clone(removed);
}

function replaceCollection(collection,records=[]){
  const state=load();
  state[collection]=(Array.isArray(records)?records:[]).map(item=>({...clone(item),id:item.id||uid(collection.slice(0,-1).toUpperCase()),updatedAt:item.updatedAt||now(),createdAt:item.createdAt||now()}));
  return save(state,{action:'collection-replaced',collection,count:state[collection].length});
}

function parseLegacy(key){
  try{
    const raw=global.localStorage?.getItem(key);
    if(!raw)return [];
    const parsed=JSON.parse(raw);
    if(Array.isArray(parsed))return parsed;
    if(Array.isArray(parsed?.items))return parsed.items;
    if(Array.isArray(parsed?.records))return parsed.records;
    if(Array.isArray(parsed?.data))return parsed.data;
    return parsed&&typeof parsed==='object'?[parsed]:[];
  }catch(_){return [];}
}

function migrateLegacyStores(options={}){
  const force=Boolean(options.force);
  const current=load();
  if(current.meta?.migratedAt&&!force)return {migrated:false,reason:'already-migrated',state:current};

  const mappings=[
    {collection:'reports',keys:['modumam_reports','modumam_report_store','mml_reports']},
    {collection:'assessments',keys:['modumam_clinical_assessments','mml_clinical_assessments']},
    {collection:'workflows',keys:['modumam_clinical_workflows','mml_clinical_workflows']},
    {collection:'counselingSessions',keys:['modumam_ai_counseling_sessions']},
    {collection:'counselingRecords',keys:['modumam_ai_result_counseling_records']},
    {collection:'caseConceptDrafts',keys:['modumam_case_concept_drafts']},
    {collection:'caseConceptRecords',keys:['modumam_case_concept_records']},
    {collection:'chartRecords',keys:['modumam_chart_records','mml_chart_records']}
  ];

  const sources=[];
  mappings.forEach(({collection,keys})=>{
    const merged=[];
    keys.forEach(key=>{
      const rows=parseLegacy(key);
      if(rows.length){sources.push(key);merged.push(...rows);}
    });
    const existing=current[collection]||[];
    const map=new Map();
    [...existing,...merged].forEach(item=>{
      const identity=item?.id||`${item?.reservationId||''}|${item?.clientId||''}|${item?.reportType||item?.type||''}|${item?.testType||''}|${item?.sessionId||''}`;
      map.set(String(identity||uid('MIG')),clone(item));
    });
    current[collection]=Array.from(map.values());
  });
  current.meta={...(current.meta||{}),migratedAt:now(),migrationSources:Array.from(new Set(sources))};
  const state=save(current,{action:'legacy-migrated',sources:current.meta.migrationSources});
  return {migrated:true,sources:current.meta.migrationSources,state};
}

function buildCaseSnapshot(filter={}){
  const state=load();
  const matches=item=>Object.entries(filter).every(([key,value])=>value===undefined||value===null||value===''||String(item?.[key]??'')===String(value));
  return clone({
    client:state.clients.find(matches)||null,
    reservation:state.reservations.find(matches)||null,
    assessments:state.assessments.filter(matches),
    workflows:state.workflows.filter(matches),
    reports:state.reports.filter(matches),
    counselingSessions:state.counselingSessions.filter(matches),
    counselingRecords:state.counselingRecords.filter(matches),
    caseConceptDrafts:state.caseConceptDrafts.filter(matches),
    caseConceptRecords:state.caseConceptRecords.filter(matches),
    chartRecords:state.chartRecords.filter(matches),
    generatedAt:now()
  });
}

function upsertAssessment(record){return upsert('assessments',record,{prefix:'ASSESSMENT',identityKeys:['reservationId','testType']});}
function upsertWorkflow(record){return upsert('workflows',record,{prefix:'WORKFLOW',identityKeys:['reservationId']});}
function upsertReport(record){return upsert('reports',record,{prefix:'REPORT',identityKeys:['reservationId','reportType','testType']});}
function upsertCounselingSession(record){return upsert('counselingSessions',record,{prefix:'SESSION',identityKeys:['sessionId']});}
function upsertCounselingRecord(record){return upsert('counselingRecords',record,{prefix:'COUNSELING',identityKeys:['sessionId']});}
function upsertCaseConceptDraft(record){return upsert('caseConceptDrafts',record,{prefix:'CONCEPT-DRAFT',identityKeys:['reservationId','status']});}
function upsertCaseConceptRecord(record){return upsert('caseConceptRecords',record,{prefix:'CONCEPT',identityKeys:['draftId']});}
function upsertChartRecord(record){return upsert('chartRecords',record,{prefix:'CHART',identityKeys:['sourceType','sourceId']});}

function inspectClinicalStore(){
  const state=load();
  const counts={};
  Object.keys(emptyState()).forEach(key=>{if(Array.isArray(state[key]))counts[key]=state[key].length;});
  return {ready:true,version:VERSION,storageKey:STORAGE_KEY,updatedAt:state.updatedAt,counts,migratedAt:state.meta?.migratedAt||'',migrationSources:state.meta?.migrationSources||[]};
}

root.clinicalStore=Object.freeze({
  version:VERSION,storageKey:STORAGE_KEY,eventName:EVENT_NAME,
  load,save,list,get,upsert,remove,replaceCollection,migrateLegacyStores,buildCaseSnapshot,
  upsertAssessment,upsertWorkflow,upsertReport,upsertCounselingSession,upsertCounselingRecord,
  upsertCaseConceptDraft,upsertCaseConceptRecord,upsertChartRecord,inspectClinicalStore
});
})(window);
