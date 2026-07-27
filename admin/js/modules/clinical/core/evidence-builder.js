(function(global){
'use strict';
const modules=global.MMLClinicalModules=global.MMLClinicalModules||{};

function cleanReportText(value){
  return String(value??'')
    .replace(/\r\n/g,'\n')
    .replace(/[\t ]+/g,' ')
    .replace(/\n{3,}/g,'\n\n')
    .trim();
}

function uniqueReportTexts(values){
  const seen=new Set();
  const rows=[];
  for(const value of (values||[]).flat(Infinity)){
    const text=cleanReportText(value);
    if(!text)continue;
    const key=text.replace(/\s+/g,' ').toLowerCase();
    if(seen.has(key))continue;
    seen.add(key);
    rows.push(text);
  }
  return rows;
}

function firstReportText(...values){
  return values.map(cleanReportText).find(Boolean)||'';
}

function normalizeConfidence(value,fallback='medium'){
  const text=cleanReportText(value).toLowerCase();
  if(['high','높음','높은','strong'].includes(text))return 'high';
  if(['medium','중간','moderate'].includes(text))return 'medium';
  if(['low','낮음','weak'].includes(text))return 'low';
  if(['limited','제한적','insufficient'].includes(text))return 'limited';
  return fallback;
}

function splitEvidenceText(value){
  if(Array.isArray(value))return uniqueReportTexts(value);
  const text=cleanReportText(value);
  if(!text)return [];
  return uniqueReportTexts(text
    .split(/\n+|(?:^|\s)[•■▪◦]\s*|(?=\d+[.)]\s+)/g)
    .map(item=>item.replace(/^[-–—]\s*/,'')));
}

function inferTestFamily(testType=''){
  const type=cleanReportText(testType);
  if(/TCI|기질|성격/i.test(type))return 'trait';
  if(/MMPI|PAI/i.test(type))return 'personality_psychopathology';
  if(/PHQ|GAD|우울|불안|척도/i.test(type))return 'symptom';
  if(/SCT|문장완성/i.test(type))return 'projective_verbal';
  if(/HTP|KFD|그림|집.?나무.?사람/i.test(type))return 'projective_drawing';
  if(/PAT|양육/i.test(type))return 'parenting';
  if(/STS|스트레스/i.test(type))return 'stress';
  if(/K-?CDI|발달/i.test(type))return 'development';
  return 'other';
}

function inferDomains(testType='',field='',text=''){
  const family=inferTestFamily(testType);
  const source=`${field} ${text}`;
  const domains=new Set();
  if(field==='validity')domains.add('test_validity');
  if(field==='strengths')domains.add('strengths_protective');
  if(field==='vulnerabilities'||field==='cautions'||field==='concerns')domains.add('vulnerabilities_risk');
  if(field==='recommendations')domains.add('recovery_direction');

  if(family==='trait')domains.add('stable_traits');
  if(['personality_psychopathology','symptom'].includes(family))domains.add('current_state');
  if(['projective_verbal','projective_drawing'].includes(family)){
    domains.add('emotion');
    domains.add('relationship');
  }
  if(['stress','parenting','development'].includes(family))domains.add('stress_functioning');

  if(/불안|걱정|긴장|우울|슬픔|무기력|정서|감정|분노|예민/i.test(source))domains.add('emotion');
  if(/사고|인지|해석|완벽|반추|판단/i.test(source))domains.add('thinking');
  if(/관계|대인|친밀|거리|갈등|의존|회피|표현/i.test(source))domains.add('relationship');
  if(/스트레스|부담|기능|수면|식사|집중|일상|학교|직장/i.test(source))domains.add('stress_functioning');
  if(/강점|자원|보호|회복|책임감|성실|공감|통찰/i.test(source))domains.add('strengths_protective');
  if(/위험|취약|주의|악화|충동|자해|자살/i.test(source))domains.add('vulnerabilities_risk');

  if(!domains.size&&field==='coreFindings')domains.add('test_finding');
  return [...domains];
}

function validityLimitsConfidence(validity=''){
  return /주의|제한|낮|부적절|무효|과장|축소|방어|해석.*어려|신뢰.*낮/i.test(cleanReportText(validity));
}

function evidenceFingerprint(item){
  return [item.domain,item.source,item.finding]
    .map(value=>cleanReportText(value).replace(/\s+/g,' ').toLowerCase())
    .join('|');
}

function makeEvidenceItem({id,domain,label,finding,source='integrated_report',testFamily='integrated',field='summary',confidence='medium',validity='',tags=[]}={}){
  const text=cleanReportText(finding);
  if(!text)return null;
  const normalizedConfidence=validityLimitsConfidence(validity)
    ? 'limited'
    : normalizeConfidence(confidence,'medium');
  return {
    id,
    domain:cleanReportText(domain)||'test_finding',
    label:cleanReportText(label)||'검사 근거',
    finding:text,
    source:cleanReportText(source)||'검사자료',
    testFamily:cleanReportText(testFamily)||'other',
    field:cleanReportText(field)||'summary',
    confidence:normalizedConfidence,
    validity:cleanReportText(validity),
    tags:uniqueReportTexts(tags),
    fingerprint:''
  };
}

function buildNormalizedClinicalEvidence(evidence={}){
  const rows=[];
  const seen=new Set();
  const add=(payload)=>{
    const item=makeEvidenceItem({...payload,id:`ev-${rows.length+1}`});
    if(!item)return;
    item.fingerprint=evidenceFingerprint(item);
    if(seen.has(item.fingerprint))return;
    seen.add(item.fingerprint);
    rows.push(item);
  };

  const integratedDomains=[
    ['currentState','current_state','현재 정서 및 심리상태'],
    ['stableTraits','stable_traits','기질·성격 및 비교적 안정적인 특성'],
    ['relationshipPattern','relationship','사고 및 대인관계 방식'],
    ['commonPatterns','cross_test_convergence','여러 검사에서 공통으로 확인된 특징'],
    ['differences','cross_test_difference','검사 간 차이 또는 함께 설명할 부분'],
    ['formulation','stress_functioning','스트레스 반응과 일상 기능'],
    ['strengths','strengths_protective','강점과 보호요인'],
    ['vulnerabilities','vulnerabilities_risk','취약요인과 주의할 신호'],
    ['recommendations','recovery_direction','회복 방향과 제언']
  ];

  integratedDomains.forEach(([sourceKey,domain,label])=>{
    splitEvidenceText(evidence?.[sourceKey]).forEach(text=>add({
      domain,label,finding:text,source:'integrated_report',testFamily:'integrated',field:sourceKey,confidence:'medium',tags:['integrated']
    }));
  });

  const inventory=Array.isArray(evidence?.testEvidence)
    ? evidence.testEvidence
    : Array.isArray(evidence?.sourceInventory)
      ? evidence.sourceInventory
      : [];

  inventory.forEach(test=>{
    const testName=cleanReportText(test.testType||test.testName||test.name)||'검사자료';
    const family=inferTestFamily(testName);
    const validity=cleanReportText(test.validity);
    const fieldMap=[
      ['coreFindings',test.coreFindings||test.summary||test.interpretation],
      ['validity',validity],
      ['strengths',test.strengths],
      ['vulnerabilities',test.vulnerabilities],
      ['cautions',test.cautions||test.concerns],
      ['recommendations',test.recommendations]
    ];

    fieldMap.forEach(([field,value])=>{
      splitEvidenceText(value).forEach(text=>{
        const domains=inferDomains(testName,field,text);
        domains.forEach(domain=>add({
          domain,
          label:`${testName} ${field==='validity'?'해석 가능성':field==='strengths'?'강점':field==='recommendations'?'제언':'핵심 결과'}`,
          finding:text,
          source:testName,
          testFamily:family,
          field,
          confidence:field==='validity'?'high':test.confidence||'medium',
          validity,
          tags:[family,field]
        }));
      });
    });
  });

  const byDomain=rows.reduce((acc,row)=>{
    (acc[row.domain]||(acc[row.domain]=[])).push(row);
    return acc;
  },{});
  const bySource=rows.reduce((acc,row)=>{
    (acc[row.source]||(acc[row.source]=[])).push(row);
    return acc;
  },{});
  const sourceInventory=Object.entries(bySource).map(([source,items])=>({
    source,
    evidenceCount:items.length,
    domains:[...new Set(items.map(item=>item.domain))],
    limited:items.some(item=>item.confidence==='limited')
  }));

  return {
    schemaVersion:'mml-clinical-evidence-v2',
    generatedAt:new Date().toISOString(),
    totalEvidence:rows.length,
    domains:Object.keys(byDomain),
    sources:Object.keys(bySource),
    items:rows,
    byDomain,
    bySource,
    sourceInventory,
    coverage:{
      domainCount:Object.keys(byDomain).length,
      sourceCount:Object.keys(bySource).length,
      highConfidence:rows.filter(item=>item.confidence==='high').length,
      limited:rows.filter(item=>item.confidence==='limited').length
    }
  };
}

function buildClinicalEvidenceConfidence(evidence){
  const normalized=buildNormalizedClinicalEvidence(evidence);
  const confidenceRank={high:3,medium:2,low:1,limited:0};
  const summarize=(rows=[])=>{
    const tests=[...new Set(rows.map(item=>item.source).filter(source=>source&&source!=='integrated_report'))];
    const limited=rows.some(item=>item.confidence==='limited');
    const average=rows.length?rows.reduce((sum,item)=>sum+(confidenceRank[item.confidence]??1),0)/rows.length:0;
    const supportCount=tests.length;
    const confidence=limited&&supportCount<2?'제한적':supportCount>=3&&average>=1.8?'높음':supportCount>=2?'중간':supportCount===1?'낮음':rows.length?'낮음':'근거없음';
    const language=confidence==='높음'?'여러 검사에서 비교적 일관되게 확인됩니다':confidence==='중간'?'두 가지 이상의 자료에서 같은 방향이 확인됩니다':confidence==='낮음'?'한정된 자료에서 나타난 가능성으로 신중히 이해할 필요가 있습니다':confidence==='제한적'?'검사 해석의 제한을 고려해 참고 수준으로 이해해야 합니다':'현재 자료만으로는 단정하지 않습니다';
    return {supportCount,tests,confidence,language,evidence:rows};
  };

  const domainAliases={
    temperament:['stable_traits'],
    currentState:['current_state'],
    emotion:['emotion','current_state'],
    thinkingRelationship:['thinking','relationship'],
    stressFunctioning:['stress_functioning'],
    strengths:['strengths_protective'],
    vulnerabilities:['vulnerabilities_risk']
  };

  return Object.fromEntries(Object.entries(domainAliases).map(([key,domains])=>[
    key,
    summarize(domains.flatMap(domain=>normalized.byDomain?.[domain]||[]))
  ]));
}

function buildClinicalConflictMap(evidence){
  const normalized=buildNormalizedClinicalEvidence(evidence);
  const differences=normalized.byDomain?.cross_test_difference||[];
  const comparisonRows=normalized.sourceInventory.map(source=>({
    testType:source.source,
    domains:source.domains,
    evidenceCount:source.evidenceCount,
    limited:source.limited,
    findings:(normalized.bySource?.[source.source]||[])
      .filter(item=>!['test_validity','recovery_direction'].includes(item.domain))
      .map(item=>item.finding)
  }));
  return {
    comparisonRows,
    explicitDifferences:differences.map(item=>({source:item.source,finding:item.finding,confidence:item.confidence})),
    resolutionRules:[
      '기질·성격검사의 결과와 현재 상태검사의 결과가 다르면 평소 특성과 최근 상태의 차이로 우선 검토한다.',
      '강점과 취약점이 함께 나타나면 둘 중 하나를 지우지 말고 어떤 상황에서 각각 드러나는지 설명한다.',
      '검사 간 차이를 병리나 방어로 단정하지 말고 상황, 자기인식, 검사 시점의 차이를 가능한 설명으로만 제시한다.',
      '단일 검사에서만 나타난 내용은 가능성 수준으로 표현하고 추가 확인이 필요함을 밝힌다.',
      '해석 제한이 있는 검사의 내용은 다른 근거보다 우선하지 않는다.'
    ],
    outputRule:'최종 보고서에서는 충돌 목록을 그대로 나열하지 말고, 평소 특성-최근 상태-상황별 반응의 관계로 풀어서 설명한다.'
  };
}

modules.evidence=Object.freeze({
  cleanReportText,
  uniqueReportTexts,
  firstReportText,
  normalizeConfidence,
  splitEvidenceText,
  inferTestFamily,
  inferDomains,
  buildNormalizedClinicalEvidence,
  buildClinicalEvidenceConfidence,
  buildClinicalConflictMap
});
})(window);
