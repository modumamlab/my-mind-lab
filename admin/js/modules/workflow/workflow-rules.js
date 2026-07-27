(function(global){
'use strict';
const NS=global.MMLWorkflowModules=global.MMLWorkflowModules||{};
function text(v){return String(v??'').trim()}
function includesAny(value,words){const source=text(value).toLowerCase();return words.some(word=>source.includes(String(word).toLowerCase()))}
function reports(c){return Array.isArray(c?.reports)?c.reports:[]}
function assessments(c){return Array.isArray(c?.assessments)?c.assessments:[]}
function reservations(c){return Array.isArray(c?.reservations)?c.reservations:[]}
function counseling(c){return Array.isArray(c?.counseling)?c.counseling:[]}
function isIndividual(r){return includesAny(r?.reportType||r?.type,['individual','개별'])}
function isComprehensive(r){return includesAny(r?.reportType||r?.type,['comprehensive','종합','통합','counselorcomprehensivereport'])}
function isApproved(r){return Boolean(r?.approved||r?.approvedForClient)||includesAny(r?.status||r?.approvalStatus,['승인','열람가능','approved'])}
function hasAnalysis(c){return assessments(c).some(a=>Boolean(text(a?.summary))||includesAny(a?.status||a?.analysisStatus,['분석 완료','분석완료','완료','analyzed']))}
function reservationStage(c){
 const rows=reservations(c); if(!rows.length)return 'REQUESTED';
 const statuses=rows.map(r=>text(r?.status||r?.progressStatus));
 if(statuses.some(s=>includesAny(s,['검사발송','검사 발송','링크발송','검사안내'])))return 'ASSESSMENT_SENT';
 if(statuses.some(s=>includesAny(s,['결제완료','결제 확인','입금확인','paid'])))return 'PAID';
 if(statuses.some(s=>includesAny(s,['예약승인','승인완료','예약 확정','approved'])))return 'APPROVED';
 return 'REQUESTED';
}
function facts(c){
 const reportRows=reports(c);
 const individual=reportRows.filter(isIndividual);
 const comprehensive=reportRows.filter(isComprehensive);
 const approvedIndividual=individual.filter(isApproved);
 const approvedComprehensive=comprehensive.filter(isApproved);
 return {
  hasReservation:reservations(c).length>0,
  reservationStage:reservationStage(c),
  hasAssessment:assessments(c).length>0,
  hasAnalysis:hasAnalysis(c),
  hasIndividual:individual.length>0,
  hasApprovedIndividual:approvedIndividual.length>0,
  hasComprehensive:comprehensive.length>0,
  hasApprovedComprehensive:approvedComprehensive.length>0,
  hasPublishedReport:reportRows.some(r=>isApproved(r)),
  hasCounseling:counseling(c).length>0,
  individualCount:individual.length,
  comprehensiveCount:comprehensive.length
 };
}
function deriveState(c){
 const f=facts(c);
 if(f.hasCounseling&&includesAny(c?.status||c?.lifecycleState,['closed','종결']))return 'CLOSED';
 if(f.hasCounseling)return 'COUNSELING_COMPLETED';
 if(f.hasPublishedReport)return 'AI_COUNSELING_AVAILABLE';
 if(f.hasComprehensive)return 'COMPREHENSIVE_REPORT_CREATED';
 if(f.hasApprovedIndividual)return 'INDIVIDUAL_REPORT_APPROVED';
 if(f.hasIndividual)return 'INDIVIDUAL_REPORT_CREATED';
 if(f.hasAnalysis)return 'AI_ANALYZED';
 if(f.hasAssessment)return 'ASSESSMENT_COMPLETED';
 return f.reservationStage;
}
function availableActions(c){
 const f=facts(c);
 return {
  analyzeAssessment:{enabled:f.hasAssessment&&!f.hasAnalysis,reason:f.hasAssessment?'':'검사결과 업로드가 필요합니다.'},
  createIndividualReport:{enabled:f.hasAnalysis,reason:f.hasAnalysis?'':'AI 분석 완료가 필요합니다.'},
  approveIndividualReport:{enabled:f.hasIndividual&&!f.hasApprovedIndividual,reason:f.hasIndividual?'':'개별보고서 생성이 필요합니다.'},
  createComprehensiveReport:{enabled:f.hasAnalysis,reason:f.hasAnalysis?'':'AI 분석 완료가 필요합니다.'},
  approveComprehensiveReport:{enabled:f.hasComprehensive&&!f.hasApprovedComprehensive,reason:f.hasComprehensive?'':'종합보고서 생성이 필요합니다.'},
  viewApprovedReports:{enabled:f.hasPublishedReport,reason:f.hasPublishedReport?'':'승인된 보고서가 없습니다.'},
  enterAiCounseling:{enabled:f.hasAssessment&&f.hasPublishedReport,reason:!f.hasAssessment?'검사결과가 필요합니다.':(!f.hasPublishedReport?'승인된 보고서가 필요합니다.':'')}
 };
}
NS.rules=Object.freeze({facts,deriveState,availableActions,isIndividual,isComprehensive,isApproved});
})(window);
