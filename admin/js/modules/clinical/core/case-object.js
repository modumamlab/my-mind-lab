(function(global){
'use strict';
const modules=global.MMLClinicalModules=global.MMLClinicalModules||{};
const evidence=modules.evidence;
if(!evidence) throw new Error('MML Clinical evidence-builder must load before case-object.');
const {cleanReportText,uniqueReportTexts,firstReportText}=evidence;
function buildClientCaseConceptualizationObject(evidence){
  const inventory=Array.isArray(evidence?.sourceInventory)?evidence.sourceInventory:[];
  const evidenceByDomain={
    temperament:[],currentState:[],emotion:[],thinkingRelationship:[],stressFunctioning:[],strengths:[],vulnerabilities:[]
  };
  for(const row of inventory){
    const testType=cleanReportText(row.testType)||'검사';
    const core=cleanReportText(row.coreFindings);
    const strengths=cleanReportText(row.strengths);
    const vulnerabilities=cleanReportText(row.vulnerabilities||row.cautions);
    const packet=(text)=>text?`${testType}: ${text}`:'';
    if(/TCI|기질|성격/i.test(testType)&&core)evidenceByDomain.temperament.push(packet(core));
    if(/MMPI|PAI|PHQ|GAD|우울|불안/i.test(testType)&&core)evidenceByDomain.currentState.push(packet(core));
    if(/SCT|HTP|문장완성|그림/i.test(testType)&&core){
      evidenceByDomain.emotion.push(packet(core));
      evidenceByDomain.thinkingRelationship.push(packet(core));
    }
    if(core)evidenceByDomain.stressFunctioning.push(packet(core));
    if(strengths)evidenceByDomain.strengths.push(packet(strengths));
    if(vulnerabilities)evidenceByDomain.vulnerabilities.push(packet(vulnerabilities));
  }
  Object.keys(evidenceByDomain).forEach(key=>{evidenceByDomain[key]=uniqueReportTexts(evidenceByDomain[key]);});
  return {
    purpose:'보고서를 쓰기 전에 검사결과를 한 사람의 심리적 흐름으로 정리하는 내부 사례개념화',
    domains:{
      presentingConcern:firstReportText(evidence.currentState,evidence.professionalSummary),
      temperamentAndPersonality:firstReportText(evidence.stableTraits),
      currentEmotionalFunctioning:firstReportText(evidence.currentState),
      thinkingAndRelationship:firstReportText(evidence.relationshipPattern),
      stressAndDailyFunctioning:firstReportText(evidence.formulation),
      maintainingFactors:firstReportText(evidence.vulnerabilities,evidence.differences),
      protectiveFactors:firstReportText(evidence.strengths),
      recoveryPriorities:firstReportText(evidence.professionalSummary,evidence.strengths)
    },
    evidenceByDomain,
    formulationSequence:[
      '현재 가장 두드러진 어려움과 기능 저하를 먼저 확인한다.',
      '비교적 안정적인 기질·성격 특성과 최근 상태 변화를 구분한다.',
      '스트레스 상황, 내적 반응, 행동과 관계 반응, 일상 영향의 연결고리를 정리한다.',
      '어려움을 지속시키는 요인과 완충하는 보호요인을 함께 제시한다.',
      '근거가 충분한 내용은 명확히, 단일 검사 근거는 가능성 수준으로 표현한다.',
      '회복 방향은 현재 부담을 줄이는 순서와 기존 강점을 활용하는 순서로 정한다.'
    ],
    outputRule:'최종 보고서에는 사례개념화 필드명을 노출하지 않고, 현재 모습 → 성격·관계 특성 → 스트레스와 생활 영향 → 강점 → 회복 방향의 자연스러운 서사로 변환한다.'
  };
}


modules.caseObject=Object.freeze({
  buildClientCaseConceptualizationObject
});
})(window);
