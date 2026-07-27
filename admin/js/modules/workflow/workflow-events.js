(function(global){
'use strict';
const NS=global.MMLWorkflowModules=global.MMLWorkflowModules||{};
const EVENTS=['mml:cases-synced','mml:reservation-saved','mml:assessment-saved','mml:report-saved','mml:report-approved','mml:counseling-saved'];
let timer=null;
function schedule(reason){clearTimeout(timer);timer=setTimeout(()=>NS.engine?.sync(reason),40)}
function bind(){
 if(global.__MML_WORKFLOW_EVENTS_BOUND__)return;
 global.__MML_WORKFLOW_EVENTS_BOUND__=true;
 EVENTS.forEach(type=>global.addEventListener(type,()=>schedule(type)));
 global.addEventListener('storage',event=>{
  if(['modumam_reservations','modumam_reservation_inbox','modumam_test_result_uploads','modumam_reports','modumam_clinical_assessment_records','modumam_ai_result_counseling_records','modumam_counseling_journals'].includes(event.key))schedule(`storage:${event.key}`);
 });
}
NS.events=Object.freeze({bind,schedule});
})(window);
