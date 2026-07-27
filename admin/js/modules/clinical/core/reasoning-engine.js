(function(global){
'use strict';
const modules=global.MMLClinicalModules=global.MMLClinicalModules||{};
const evidenceModule=modules.evidence;
if(!evidenceModule) throw new Error('MML Clinical evidence-builder must load before reasoning-engine.');

const {
  cleanReportText,
  uniqueReportTexts,
  buildNormalizedClinicalEvidence,
  buildClinicalConflictMap
}=evidenceModule;

const CONFIDENCE_SCORE={high:3,medium:2,low:1,limited:0};
const DOMAIN_CONFIG={
  current_functioning:{
    label:'현재 정서 및 심리기능',
    type:'current_state',
    domains:['current_state','emotion','test_finding']
  },
  stable_pattern:{
    label:'비교적 안정적인 기질·성격 특성',
    type:'stable_trait',
    domains:['stable_traits']
  },
  thinking_relationship:{
    label:'사고 및 대인관계 방식',
    type:'relationship',
    domains:['thinking','relationship']
  },
  stress_maintenance:{
    label:'스트레스 반응과 일상 기능',
    type:'maintaining_factor',
    domains:['stress_functioning','vulnerabilities_risk']
  },
  protective_resources:{
    label:'강점과 보호요인',
    type:'protective_factor',
    domains:['strengths_protective']
  }
};

function sourceName(item){
  return cleanReportText(item?.source);
}

function isIndependentSource(source){
  return Boolean(source)&&source!=='integrated_report';
}

function uniqueSources(items,{independentOnly=false}={}){
  return [...new Set((items||[])
    .map(sourceName)
    .filter(source=>source&&(!independentOnly||isIndependentSource(source))))];
}

function usableEvidence(items){
  return (items||[]).filter(item=>item&&cleanReportText(item.finding));
}

function averageConfidence(items){
  const rows=usableEvidence(items);
  if(!rows.length)return 0;
  return rows.reduce((sum,item)=>sum+(CONFIDENCE_SCORE[item.confidence]??1),0)/rows.length;
}

function deriveConfidence(items){
  const rows=usableEvidence(items);
  const independent=uniqueSources(rows,{independentOnly:true});
  const allSources=uniqueSources(rows);
  const limitedCount=rows.filter(item=>item.confidence==='limited').length;
  const usableCount=rows.length-limitedCount;
  const average=averageConfidence(rows.filter(item=>item.confidence!=='limited'));

  if(!rows.length)return 'limited';
  if(usableCount===0)return 'limited';
  if(independent.length>=3&&average>=1.8)return 'high';
  if(independent.length>=2&&average>=1.2)return 'medium';
  if(independent.length===1||allSources.length)return 'low';
  return 'limited';
}

function confidenceMeta(confidence){
  const table={
    high:{status:'validated',label:'높음',score:.9,wordingGuide:'여러 검사에서 비교적 일관되게 확인됩니다.'},
    medium:{status:'supported',label:'중간',score:.72,wordingGuide:'두 가지 이상의 자료에서 같은 방향이 확인됩니다.'},
    low:{status:'tentative',label:'낮음',score:.48,wordingGuide:'한정된 자료에서 나타난 가능성으로 신중히 이해할 필요가 있습니다.'},
    limited:{status:'insufficient',label:'제한적',score:.2,wordingGuide:'검사 해석의 제한을 고려해 참고 수준으로 이해해야 합니다.'}
  };
  return table[confidence]||table.limited;
}

function summarizeEvidence(items,limit=6){
  const rows=usableEvidence(items)
    .slice()
    .sort((a,b)=>(CONFIDENCE_SCORE[b.confidence]??1)-(CONFIDENCE_SCORE[a.confidence]??1));
  return uniqueReportTexts(rows.map(item=>item.finding)).slice(0,limit);
}

function collectDomains(normalized,domains){
  const byDomain=normalized?.byDomain||{};
  return usableEvidence((domains||[]).flatMap(domain=>Array.isArray(byDomain[domain])?byDomain[domain]:[]));
}

function buildHypothesis(id,config,items){
  const confidence=deriveConfidence(items);
  const meta=confidenceMeta(confidence);
  const sources=uniqueSources(items);
  const independentSources=uniqueSources(items,{independentOnly:true});
  const limitedEvidence=items.filter(item=>item.confidence==='limited');
  return {
    id,
    label:config.label,
    type:config.type,
    confidence,
    status:meta.status,
    evidenceCount:items.length,
    usableEvidenceCount:items.length-limitedEvidence.length,
    independentSourceCount:independentSources.length,
    sources,
    independentSources,
    supportingEvidence:summarizeEvidence(items),
    limitedEvidence:summarizeEvidence(limitedEvidence,3),
    wordingGuide:meta.wordingGuide,
    requiresCaution:confidence==='low'||confidence==='limited'||limitedEvidence.length>0
  };
}

function buildConflictResolution(normalized){
  const conflictMap=buildClinicalConflictMap
    ? buildClinicalConflictMap(normalized)
    : {explicitDifferences:[],resolutionRules:[]};
  const differences=normalized?.byDomain?.cross_test_difference||[];
  const explicit=(conflictMap?.explicitDifferences||[]).length
    ? conflictMap.explicitDifferences
    : differences.map(item=>({source:item.source,finding:item.finding,confidence:item.confidence}));

  return explicit.map((item,index)=>({
    id:`conflict-${index+1}`,
    finding:cleanReportText(item.finding),
    source:cleanReportText(item.source)||'integrated_report',
    confidence:item.confidence||'medium',
    interpretationFrame:'평소 특성-최근 상태-상황별 반응의 차이로 우선 설명',
    resolutionRule:(conflictMap?.resolutionRules||[])[index%(conflictMap?.resolutionRules?.length||1)]
      ||'모순으로 단정하지 말고 검사 시점, 상황, 특성 및 상태의 차이를 함께 검토한다.'
  })).filter(item=>item.finding);
}

function buildPriorities(groups){
  const score=(items,weight=1)=>{
    const rows=usableEvidence(items);
    const usable=rows.filter(item=>item.confidence!=='limited').length;
    const independent=uniqueSources(rows,{independentOnly:true}).length;
    return Number(((usable*weight)+(independent*.75)).toFixed(2));
  };
  return [
    {key:'stabilize',label:'현재 정서와 일상 기능의 안정',score:score([...groups.current,...groups.stress],1.15)},
    {key:'stress',label:'스트레스 반응과 유지요인 완화',score:score(groups.stress,1.35)},
    {key:'relationship',label:'사고·관계 패턴의 균형 회복',score:score(groups.relationship,1)},
    {key:'strength',label:'강점과 보호요인의 실제 활용',score:score(groups.protective,.9)}
  ]
    .filter(item=>item.score>0)
    .sort((a,b)=>b.score-a.score)
    .map((item,index)=>({...item,order:index+1}));
}

function buildClinicalReasoningEngine(evidence){
  const normalized=buildNormalizedClinicalEvidence(evidence||{});
  const groups={
    current:collectDomains(normalized,DOMAIN_CONFIG.current_functioning.domains),
    stable:collectDomains(normalized,DOMAIN_CONFIG.stable_pattern.domains),
    relationship:collectDomains(normalized,DOMAIN_CONFIG.thinking_relationship.domains),
    stress:collectDomains(normalized,DOMAIN_CONFIG.stress_maintenance.domains),
    protective:collectDomains(normalized,DOMAIN_CONFIG.protective_resources.domains)
  };

  const hypotheses=[
    buildHypothesis('current-functioning',DOMAIN_CONFIG.current_functioning,groups.current),
    buildHypothesis('stable-pattern',DOMAIN_CONFIG.stable_pattern,groups.stable),
    buildHypothesis('thinking-relationship',DOMAIN_CONFIG.thinking_relationship,groups.relationship),
    buildHypothesis('stress-maintenance',DOMAIN_CONFIG.stress_maintenance,groups.stress),
    buildHypothesis('protective-resources',DOMAIN_CONFIG.protective_resources,groups.protective)
  ].filter(row=>row.evidenceCount>0);

  const conflicts=buildConflictResolution(normalized);
  const priorities=buildPriorities(groups);
  const highOrMedium=hypotheses.filter(row=>['high','medium'].includes(row.confidence));
  const limitedSources=(normalized.sourceInventory||[]).filter(row=>row.limited).map(row=>row.source);

  return {
    schemaVersion:'mml-clinical-reasoning-v2',
    generatedAt:new Date().toISOString(),
    reasoningSequence:[
      '검사별 해석 가능성과 제한을 먼저 확인한다.',
      '현재 상태와 비교적 안정적인 특성을 분리한다.',
      '둘 이상의 독립된 검사에서 같은 방향이 나타나는지 확인한다.',
      '단일 검사 결과는 가능성 수준으로 유지한다.',
      '검사 간 차이는 평소 특성, 최근 상태, 상황별 반응의 관계로 설명한다.',
      '취약요인과 보호요인을 함께 고려해 회복 우선순위를 정한다.'
    ],
    hypotheses,
    conflicts,
    clinicalPriorities:priorities,
    synthesis:{
      supportedHypotheses:highOrMedium.map(row=>row.id),
      tentativeHypotheses:hypotheses.filter(row=>row.confidence==='low').map(row=>row.id),
      insufficientHypotheses:hypotheses.filter(row=>row.confidence==='limited').map(row=>row.id),
      limitedSources,
      hasCrossTestSupport:highOrMedium.some(row=>row.independentSourceCount>=2),
      hasConflicts:conflicts.length>0
    },
    evidenceCoverage:{
      total:normalized.totalEvidence||0,
      sources:(normalized.sources||[]).length,
      independentSources:(normalized.sources||[]).filter(isIndependentSource).length,
      domains:(normalized.domains||[]).length,
      highConfidence:normalized.coverage?.highConfidence||0,
      limited:normalized.coverage?.limited||0
    },
    writingDirectives:[
      '높은 근거는 분명하게, 중간 근거는 지지되는 경향으로, 낮은 근거는 가능성 수준으로 표현한다.',
      '해석 제한이 있는 검사의 결과는 다른 근거보다 우선하지 않는다.',
      '각 결론은 근거 → 심리적 의미 → 일상 영향 → 강점 또는 주의점 순서로 작성한다.',
      '검사명을 나열하기보다 내담자의 현재 경험과 회복 흐름을 중심으로 통합한다.',
      '검사 간 차이는 모순으로 단정하지 않고 특성·상태·상황의 차이로 설명한다.'
    ]
  };
}

function buildClinicalDecisionTrace(evidence){
  const reasoning=buildClinicalReasoningEngine(evidence);
  const decisions=(reasoning.hypotheses||[]).map((hypothesis,index)=>{
    const meta=confidenceMeta(hypothesis.confidence);
    return {
      id:`decision-${index+1}`,
      hypothesisId:hypothesis.id,
      decision:hypothesis.label,
      type:hypothesis.type,
      status:hypothesis.status,
      confidence:meta.score,
      confidenceLabel:meta.label,
      evidence:hypothesis.supportingEvidence||[],
      sources:hypothesis.sources||[],
      independentSources:hypothesis.independentSources||[],
      evidenceCount:Number(hypothesis.evidenceCount||0),
      independentSourceCount:Number(hypothesis.independentSourceCount||0),
      requiresCaution:Boolean(hypothesis.requiresCaution),
      reasoning:hypothesis.independentSourceCount>=3
        ?'세 가지 이상의 독립된 검사에서 같은 방향의 근거가 확인되어 핵심 판단으로 채택합니다.'
        :hypothesis.independentSourceCount===2
          ?'두 가지 독립된 검사에서 같은 방향의 근거가 확인되어 지지되는 판단으로 채택합니다.'
          :hypothesis.independentSourceCount===1
            ?'한 가지 검사에서 주로 확인되어 가능성 수준으로 유지하며 다른 자료와 함께 해석합니다.'
            :'통합 서술 또는 제한된 자료에 근거하므로 참고 수준으로 유지합니다.',
      wordingGuide:hypothesis.wordingGuide||'',
      limitedEvidence:hypothesis.limitedEvidence||[],
      relatedConflicts:(reasoning.conflicts||[])
        .filter(row=>(hypothesis.sources||[]).some(source=>cleanReportText(row.source).includes(source)))
        .map(row=>row.finding)
        .filter(Boolean)
    };
  });

  return {
    schemaVersion:'mml-clinical-decision-trace-v2',
    generatedAt:new Date().toISOString(),
    decisions,
    conflicts:reasoning.conflicts||[],
    priorities:reasoning.clinicalPriorities||[],
    synthesis:reasoning.synthesis||{},
    summary:{
      totalDecisions:decisions.length,
      highConfidence:decisions.filter(row=>row.confidence>=.85).length,
      mediumConfidence:decisions.filter(row=>row.confidence>=.6&&row.confidence<.85).length,
      tentative:decisions.filter(row=>row.confidence>=.3&&row.confidence<.6).length,
      limited:decisions.filter(row=>row.confidence<.3).length,
      conflictCount:(reasoning.conflicts||[]).length
    },
    explainabilityRule:'내담자용 보고서에는 내부 점수와 추론 필드명을 노출하지 않고 근거 수준에 맞는 표현 강도만 반영한다. 상담자용 화면에는 근거, 출처, 제한, 충돌, 우선순위를 저장한다.'
  };
}

modules.reasoning=Object.freeze({
  buildClinicalReasoningEngine,
  buildClinicalDecisionTrace
});
})(window);
