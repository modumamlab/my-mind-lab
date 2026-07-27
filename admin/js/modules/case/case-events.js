(function(global){
'use strict';
const NS=global.MMLCaseModules=global.MMLCaseModules||{};
const WATCH_KEYS=new Map([
 ['modumam_reservations','reservation'],['modumam_reservation_inbox','reservation'],['modumam_test_result_uploads','assessment'],['modumam_reports','report'],['modumam_ai_result_counseling_records','counseling'],['modumam_counseling_journals','counseling']
]);
function emit(type,detail){global.dispatchEvent(new CustomEvent(type,{detail}))}
function sync(){if(!NS.caseService)return null;const result=NS.caseService.rebuildFromLegacy();emit('mml:cases-synced',result);return result}
function bind(){if(global.__MML_CASE_EVENTS_BOUND__)return;global.__MML_CASE_EVENTS_BOUND__=true;global.addEventListener('storage',event=>{if(WATCH_KEYS.has(event.key))sync()});global.addEventListener('mml:reservation-saved',event=>{if(event.detail)NS.caseService?.upsertFrom(event.detail,'reservation')});global.addEventListener('mml:assessment-saved',event=>{if(event.detail)NS.caseService?.upsertFrom(event.detail,'assessment')});global.addEventListener('mml:report-saved',event=>{if(event.detail)NS.caseService?.upsertFrom(event.detail,'report')});global.addEventListener('mml:counseling-saved',event=>{if(event.detail)NS.caseService?.upsertFrom(event.detail,'counseling')})}
NS.caseEvents=Object.freeze({sync,bind});
})(window);
