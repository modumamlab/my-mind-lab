(function(global){
'use strict';
const NS=global.MMLCaseModules=global.MMLCaseModules||{};
function hasReservation(c){return Boolean(c?.reservations?.length)}
function hasAssessment(c){return Boolean(c?.assessments?.length)}
function hasAnalysis(c){return (c?.assessments||[]).some(a=>Boolean(a.summary)||/완료|분석/.test(String(a.status||'')))}
function reportRows(c,type){return (c?.reports||[]).filter(r=>String(r.reportType||'').toLowerCase().includes(type))}
function hasIndividual(c){return reportRows(c,'individual').length>0 || (c?.reports||[]).some(r=>/개별/.test(String(r.reportType||r.type||'')))}
function hasApprovedIndividual(c){return (c?.reports||[]).some(r=>(String(r.reportType||'').toLowerCase().includes('individual')||/개별/.test(String(r.reportType||'')))&&(r.approved||/승인/.test(String(r.status||''))))}
function hasComprehensive(c){return reportRows(c,'comprehensive').length>0 || (c?.reports||[]).some(r=>/종합|통합/.test(String(r.reportType||r.type||'')))}
function hasApprovedComprehensive(c){return (c?.reports||[]).some(r=>(String(r.reportType||'').toLowerCase().includes('comprehensive')||/종합|통합/.test(String(r.reportType||'')))&&(r.approved||/승인/.test(String(r.status||''))))}
function hasCounseling(c){return Boolean(c?.counseling?.length)}
function validate(c,target,options){const state=NS.caseState?.STATE||{};const force=Boolean(options?.force);if(force)return{ok:true,errors:[],warnings:['강제 전환']};const errors=[];switch(target){
 case state.APPROVED: if(!hasReservation(c))errors.push('예약 정보가 없습니다.'); break;
 case state.PAID: if(!hasReservation(c))errors.push('예약 정보가 없습니다.'); break;
 case state.ASSESSMENT_SENT: if(!hasReservation(c))errors.push('예약 정보가 없습니다.'); break;
 case state.ASSESSMENT_COMPLETED: if(!hasAssessment(c))errors.push('검사결과가 등록되지 않았습니다.'); break;
 case state.AI_ANALYZED: if(!hasAssessment(c))errors.push('검사결과가 등록되지 않았습니다.'); break;
 case state.INDIVIDUAL_REPORT_CREATED: if(!hasAnalysis(c))errors.push('AI 분석 결과가 없습니다.'); break;
 case state.INDIVIDUAL_REPORT_APPROVED: if(!hasIndividual(c))errors.push('개별보고서가 생성되지 않았습니다.'); break;
 case state.COMPREHENSIVE_REPORT_CREATED: if(!hasAnalysis(c))errors.push('AI 분석 결과가 없습니다.'); break;
 case state.COMPREHENSIVE_REPORT_APPROVED: if(!hasComprehensive(c))errors.push('종합보고서가 생성되지 않았습니다.'); break;
 case state.AI_COUNSELING_AVAILABLE: if(!hasAssessment(c))errors.push('검사결과가 등록되지 않았습니다.'); break;
 case state.COUNSELING_COMPLETED: if(!hasCounseling(c))errors.push('상담 기록이 없습니다.'); break;
 case state.CLOSED: if(!hasCounseling(c)&&!hasApprovedIndividual(c)&&!hasApprovedComprehensive(c))errors.push('종결할 근거 기록이 없습니다.'); break;
 }
 return{ok:errors.length===0,errors,warnings:[]};}
NS.caseValidator=Object.freeze({validate,hasReservation,hasAssessment,hasAnalysis,hasIndividual,hasApprovedIndividual,hasComprehensive,hasApprovedComprehensive,hasCounseling});
})(window);
