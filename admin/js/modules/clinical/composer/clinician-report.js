(function(global){
'use strict';

const modules=global.MMLClinicalModules=global.MMLClinicalModules||{};

const clean=(value)=>String(value??'').replace(/\r\n/g,'\n').replace(/\n{3,}/g,'\n\n').trim();
const unique=(items)=>[...new Set((items||[]).map(clean).filter(Boolean))];
const confidenceRank={high:4,medium:3,low:2,limited:1};

function getEvidence(source){
  return modules.evidence?.buildNormalizedClinicalEvidence
    ? modules.evidence.buildNormalizedClinicalEvidence(source||{})
    : {items:[],byDomain:{},bySource:{},sourceInventory:[]};
}

function getReasoning(source){
  return modules.reasoning?.buildClinicalReasoningEngine
    ? modules.reasoning.buildClinicalReasoningEngine(source||{})
    : {hypotheses:[],conflicts:[],clinicalPriorities:[],evidenceCoverage:{}};
}

function compactEvidenceItem(item){
  return {
    id:clean(item?.id),
    source:clean(item?.source||item?.testType||item?.sourceType),
    domain:clean(item?.domain),
    finding:clean(item?.finding||item?.summary||item?.text),
    confidence:item?.confidence||'low',
    validity:clean(item?.validity),
    direction:clean(item?.direction),
    tags:Array.isArray(item?.tags)?unique(item.tags):[]
  };
}

function sortEvidence(items){
  return (items||[]).map(compactEvidenceItem)
    .filter(item=>item.finding)
    .sort((a,b)=>(confidenceRank[b.confidence]||0)-(confidenceRank[a.confidence]||0));
}

function buildEvidenceMatrix(evidence){
  return Object.entries(evidence?.byDomain||{}).map(([domain,items])=>{
    const rows=sortEvidence(items);
    const sources=unique(rows.map(item=>item.source).filter(source=>source&&source!=='integrated_report'));
    return {
      domain,
      evidenceCount:rows.length,
      independentSourceCount:sources.length,
      sources,
      confidence:rows.some(item=>item.confidence==='high')?'high':
        sources.length>=2?'medium':rows.some(item=>item.confidence==='limited')?'limited':'low',
      findings:unique(rows.map(item=>item.finding)).slice(0,8),
      items:rows
    };
  }).sort((a,b)=>b.evidenceCount-a.evidenceCount);
}

function buildSourceSummaries(evidence){
  return (evidence?.sourceInventory||[]).map(row=>{
    const items=sortEvidence(evidence?.bySource?.[row.source]||[]);
    return {
      source:row.source,
      limited:Boolean(row.limited),
      evidenceCount:items.length,
      domains:unique(items.map(item=>item.domain)),
      keyFindings:unique(items.map(item=>item.finding)).slice(0,6),
      validityNotes:unique(items.map(item=>item.validity))
    };
  });
}

function buildHypothesisReview(reasoning){
  return (reasoning?.hypotheses||[]).map(row=>({
    id:row.id,
    label:row.label,
    type:row.type,
    status:row.status,
    confidence:row.confidence,
    independentSourceCount:row.independentSourceCount||0,
    sources:row.sources||[],
    supportingEvidence:row.supportingEvidence||[],
    limitedEvidence:row.limitedEvidence||[],
    wordingGuide:row.wordingGuide||'',
    requiresCaution:Boolean(row.requiresCaution),
    clinicianDecision:'review_required'
  }));
}

function buildClinicalSections(reasoning,evidence){
  const matrix=buildEvidenceMatrix(evidence);
  const byDomain=Object.fromEntries(matrix.map(row=>[row.domain,row]));
  const select=(domains)=>domains.flatMap(domain=>byDomain[domain]?.findings||[]);
  return {
    currentFunctioning:{
      title:'현재 정서 및 심리기능',
      evidence:unique(select(['current_state','emotion','test_finding'])),
      hypothesis:(reasoning.hypotheses||[]).find(row=>row.id==='current-functioning')||null
    },
    stablePattern:{
      title:'기질·성격 및 비교적 안정적인 특성',
      evidence:unique(select(['stable_traits'])),
      hypothesis:(reasoning.hypotheses||[]).find(row=>row.id==='stable-pattern')||null
    },
    thinkingRelationship:{
      title:'사고 및 대인관계 방식',
      evidence:unique(select(['thinking','relationship'])),
      hypothesis:(reasoning.hypotheses||[]).find(row=>row.id==='thinking-relationship')||null
    },
    stressMaintenance:{
      title:'스트레스 반응과 유지요인',
      evidence:unique(select(['stress_functioning','vulnerabilities_risk'])),
      hypothesis:(reasoning.hypotheses||[]).find(row=>row.id==='stress-maintenance')||null
    },
    protectiveResources:{
      title:'강점과 보호요인',
      evidence:unique(select(['strengths_protective'])),
      hypothesis:(reasoning.hypotheses||[]).find(row=>row.id==='protective-resources')||null
    },
    recoveryDirection:{
      title:'임상적 우선순위 및 회복 방향',
      evidence:unique(select(['recovery_direction'])),
      priorities:reasoning.clinicalPriorities||[]
    }
  };
}

function buildClinicianReportContext(source){
  const evidence=getEvidence(source);
  const reasoning=getReasoning(source);
  const decisionTrace=modules.reasoning?.buildClinicalDecisionTrace
    ? modules.reasoning.buildClinicalDecisionTrace(source||{})
    : {};
  const caseConceptualization=modules.caseObject?.buildClientCaseConceptualizationObject
    ? modules.caseObject.buildClientCaseConceptualizationObject(source||{})
    : {};
  const evidenceMatrix=buildEvidenceMatrix(evidence);
  const limitedSources=(evidence.sourceInventory||[]).filter(row=>row.limited).map(row=>row.source);

  return {
    schemaVersion:'mml-clinician-report-context-v2',
    generatedAt:new Date().toISOString(),
    audience:'clinician',
    purpose:'상담자 검토용 심리평가 근거·가설·의사결정 패키지',
    summary:{
      evidenceCount:evidence.totalEvidence||evidence.items?.length||0,
      sourceCount:evidence.sources?.length||0,
      domainCount:evidence.domains?.length||0,
      supportedHypothesisCount:(reasoning.hypotheses||[]).filter(row=>['high','medium'].includes(row.confidence)).length,
      tentativeHypothesisCount:(reasoning.hypotheses||[]).filter(row=>row.confidence==='low').length,
      limitedHypothesisCount:(reasoning.hypotheses||[]).filter(row=>row.confidence==='limited').length,
      conflictCount:(reasoning.conflicts||[]).length,
      limitedSources
    },
    sections:buildClinicalSections(reasoning,evidence),
    sourceSummaries:buildSourceSummaries(evidence),
    evidenceMatrix,
    hypotheses:buildHypothesisReview(reasoning),
    conflicts:(reasoning.conflicts||[]).map(row=>({
      ...row,
      clinicianReview:'검사 시점, 반응 양식, 상태-특성 차이 및 상황 맥락을 확인한다.'
    })),
    clinicalPriorities:reasoning.clinicalPriorities||[],
    evidenceCoverage:reasoning.evidenceCoverage||{},
    decisionTrace,
    caseConceptualization,
    qualityFlags:{
      hasCrossTestSupport:Boolean(reasoning.synthesis?.hasCrossTestSupport),
      hasConflicts:Boolean(reasoning.synthesis?.hasConflicts),
      hasLimitedSources:limitedSources.length>0,
      needsClinicianReview:true
    },
    writingRules:[
      '업로드된 검사결과와 저장된 임상정보만 근거로 사용한다.',
      '검사결과, 임상가설, 확정 판단을 명확히 구분한다.',
      '두 개 이상의 독립된 검사에서 지지된 내용과 단일 검사 소견을 구분한다.',
      '해석 제한이 있는 검사 결과는 다른 근거보다 우선하지 않는다.',
      '검사 간 차이는 평소 특성, 최근 상태, 상황별 반응의 차이로 검토한다.',
      '위험 관련 표현은 자동 확정하지 않고 상담자의 직접 확인을 요구한다.',
      '내담자 공유본에는 원점수, T점수, 원자료, 의사결정 추적정보를 노출하지 않는다.'
    ]
  };
}

function buildClinicianReportDraft(source){
  const context=buildClinicianReportContext(source);
  return {
    title:'상담자용 심리평가 검토보고서',
    type:'clinician',
    generatedAt:context.generatedAt,
    sections:context.sections,
    hypotheses:context.hypotheses,
    conflicts:context.conflicts,
    clinicalPriorities:context.clinicalPriorities,
    sourceSummaries:context.sourceSummaries,
    evidenceMatrix:context.evidenceMatrix,
    qualityFlags:context.qualityFlags,
    reviewStatus:'draft'
  };
}

modules.clinicianReportComposer=Object.freeze({
  buildClinicianReportContext,
  buildClinicianReportDraft,
  buildEvidenceMatrix,
  buildSourceSummaries
});

if(typeof modules.refreshComposer==='function') modules.refreshComposer();
})(window);
