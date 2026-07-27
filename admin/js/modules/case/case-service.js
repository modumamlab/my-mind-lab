(function(global){
'use strict';
const NS=global.MMLCaseModules=global.MMLCaseModules||{};
function uniqById(rows){const map=new Map();(rows||[]).forEach(row=>{if(row&&row.id)map.set(String(row.id),row)});return Array.from(map.values())}
function mergeCase(current,incoming){return{...(current||{}),...(incoming||{}),client:{...(current?.client||{}),...(incoming?.client||{})},meta:{...(current?.meta||{}),...(incoming?.meta||{})},reservations:uniqById([...(current?.reservations||[]),...(incoming?.reservations||[])]),assessments:uniqById([...(current?.assessments||[]),...(incoming?.assessments||[])]),reports:uniqById([...(current?.reports||[]),...(incoming?.reports||[])]),counseling:uniqById([...(current?.counseling||[]),...(incoming?.counseling||[])])}}
function getDeps(){const store=NS.caseStore,mapper=NS.caseMapper;if(!store||!mapper)throw new Error('Case Store 또는 Mapper가 준비되지 않았습니다.');return{store,mapper}}
function upsertFrom(source,type){const{store,mapper}=getDeps();const base=mapper.baseCase(source||{});const current=store.findById(base.id);const patch={...base};if(type==='reservation')patch.reservations=[mapper.mapReservation(source)];if(type==='assessment')patch.assessments=[mapper.mapAssessment(source)];if(type==='report')patch.reports=[mapper.mapReport(source)];if(type==='counseling')patch.counseling=[mapper.mapCounseling(source)];return store.upsert(mergeCase(current,patch))}
function readLegacy(key){try{const value=JSON.parse(localStorage.getItem(key)||'[]');return Array.isArray(value)?value:[]}catch(e){return[]}}
function rebuildFromLegacy(){const{store,mapper}=getDeps();const buckets=new Map();function add(source,type){if(!source||typeof source!=='object')return;const base=mapper.baseCase(source);const current=buckets.get(base.id)||store.findById(base.id)||base;const patch={...base};if(type==='reservation')patch.reservations=[mapper.mapReservation(source)];if(type==='assessment')patch.assessments=[mapper.mapAssessment(source)];if(type==='report')patch.reports=[mapper.mapReport(source)];if(type==='counseling')patch.counseling=[mapper.mapCounseling(source)];buckets.set(base.id,mergeCase(current,patch))}
readLegacy('modumam_reservations').forEach(row=>add(row,'reservation'));
readLegacy('modumam_reservation_inbox').forEach(row=>add(row,'reservation'));
readLegacy('modumam_test_result_uploads').forEach(row=>add(row,'assessment'));
readLegacy('modumam_reports').forEach(row=>add(row,'report'));
readLegacy('modumam_ai_result_counseling_records').forEach(row=>add(row,'counseling'));
readLegacy('modumam_counseling_journals').forEach(row=>add(row,'counseling'));
const rows=Array.from(buckets.values());rows.forEach(row=>store.upsert(row));return{count:rows.length,cases:store.readAll()}}
function getCase(id){return getDeps().store.findById(id)}
function listCases(){return getDeps().store.readAll()}
function updateStatus(id,status,options){const{store}=getDeps();const current=store.findById(id);if(!current)return null;const transition=NS.caseTransition?.transition(current,status,options);if(transition&&!transition.ok){const error=new Error((transition.errors||[]).join(' '));error.code='CASE_TRANSITION_REJECTED';error.details=transition;throw error}return store.upsert(transition?.case||{...current,status:String(status||current.status)})}
function forceStatus(id,status,reason){return updateStatus(id,status,{force:true,reason:reason||'legacy-sync'})}
function getAvailableActions(id){const current=getCase(id);if(!current)return[];const next=NS.caseTransition?.nextState(current);if(!next)return[];const check=NS.caseValidator?.validate(current,next)||{ok:true,errors:[]};return[{state:next,label:NS.caseState?.label(next)||next,enabled:check.ok,reasons:check.errors||[]}]}
NS.caseService=Object.freeze({mergeCase,upsertFrom,rebuildFromLegacy,getCase,listCases,updateStatus,forceStatus,getAvailableActions});
})(window);
