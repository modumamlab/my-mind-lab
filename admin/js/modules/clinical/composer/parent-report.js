(function(global){
'use strict';

const modules=global.MMLClinicalModules=global.MMLClinicalModules||{};

const clean=(value)=>String(value??'').replace(/\s+/g,' ').trim();
const list=(value)=>Array.isArray(value)?value.filter(Boolean):value?[value]:[];
const uniq=(values)=>{
  const seen=new Set();
  return list(values).flat(Infinity).map(clean).filter(Boolean).filter((text)=>{
    const key=text.toLowerCase();
    if(seen.has(key))return false;
    seen.add(key);
    return true;
  });
};
const first=(...values)=>values.map(clean).find(Boolean)||'';

function getSourceInventory(source){
  return Array.isArray(source?.sourceInventory)?source.sourceInventory
    :Array.isArray(source?.testEvidence)?source.testEvidence
      :[];
}

function childFriendlyText(text){
  return clean(text)
    .replace(/위험회피(?:가|는| 성향이)? 높(?:다|습니다|은 편입니다)/g,'낯선 상황이나 예상하기 어려운 변화에 신중하게 반응하는 편입니다')
    .replace(/자극추구(?:가|는| 성향이)? 높(?:다|습니다|은 편입니다)/g,'새롭고 흥미로운 활동에 빠르게 끌리는 편입니다')
    .replace(/사회적 민감성(?:이)? 높(?:다|습니다|은 편입니다)/g,'다른 사람의 표정과 반응을 세심하게 살피는 편입니다')
    .replace(/인내력(?:이)? 낮(?:다|습니다|은 편입니다)/g,'힘들거나 지루한 상황에서 오래 버티는 데 도움이 더 필요할 수 있습니다')
    .replace(/우울(?:감| 수준)?(?:이)? 높(?:다|습니다|은 편입니다)/g,'기분이 가라앉거나 의욕이 줄어드는 시간이 잦을 수 있습니다')
    .replace(/불안(?: 수준)?(?:이)? 높(?:다|습니다|은 편입니다)/g,'걱정이 많아지거나 긴장하기 쉬운 모습이 나타날 수 있습니다')
    .replace(/공격성(?:이)? 높(?:다|습니다|은 편입니다)/g,'답답하거나 좌절될 때 말과 행동이 강해질 수 있습니다')
    .replace(/임상적|병리적|장애 가능성|문제행동/gi,'주의 깊게 살펴볼 모습')
    .replace(/내담자/g,'아이')
    .replace(/대상자/g,'아이');
}

function inferDomain(testType,text){
  const haystack=`${clean(testType)} ${clean(text)}`;
  if(/PAT|양육|부모|훈육|양육태도/i.test(haystack))return 'parenting';
  if(/스트레스|학교|학업/i.test(haystack))return 'stress';
  if(/K-?CDI|우울|불안|정서|기분|걱정/i.test(haystack))return 'emotion';
  if(/SCT|HTP|가족|친구|관계|대인/i.test(haystack))return 'relationship';
  if(/TCI|기질|성격|자극추구|위험회피|사회적 민감성|인내력/i.test(haystack))return 'temperament';
  if(/강점|보호|자원|회복|긍정/i.test(haystack))return 'strength';
  return 'daily';
}

function buildObservationMap(source,caseObject){
  const rows=[];
  const add=(domain,testType,text,kind='finding')=>{
    const value=childFriendlyText(text);
    if(!value)return;
    rows.push({domain,testType:clean(testType)||'통합자료',kind,text:value});
  };

  getSourceInventory(source).forEach((row)=>{
    const testType=first(row.testType,row.testName,row.name,'검사자료');
    const findings=first(row.coreFindings,row.finding,row.summary,row.interpretation);
    const strengths=first(row.strengths,row.protectiveFactors);
    const cautions=first(row.vulnerabilities,row.cautions,row.riskFactors);
    add(inferDomain(testType,findings),testType,findings,'finding');
    add('strength',testType,strengths,'strength');
    add(inferDomain(testType,cautions),testType,cautions,'caution');
  });

  const domains=caseObject?.domains||{};
  add('emotion','통합해석',domains.currentEmotionalFunctioning||domains.presentingConcern,'finding');
  add('temperament','통합해석',domains.temperamentAndPersonality||domains.temperament,'finding');
  add('relationship','통합해석',domains.thinkingAndRelationship,'finding');
  add('stress','통합해석',domains.stressAndDailyFunctioning,'finding');
  add('strength','통합해석',domains.protectiveFactors,'strength');
  add('daily','통합해석',domains.maintainingFactors,'caution');

  const uniqueRows=[];
  const seen=new Set();
  rows.forEach((row)=>{
    const key=`${row.domain}|${row.kind}|${row.text.toLowerCase()}`;
    if(seen.has(key))return;
    seen.add(key);
    uniqueRows.push(row);
  });
  return uniqueRows;
}

function confidenceLabel(reasoning,id){
  const row=list(reasoning?.hypotheses).find((item)=>item?.id===id);
  if(!row)return '가능성';
  return row.confidence==='high'?'여러 자료에서 일관되게 확인된 모습'
    :row.confidence==='medium'?'둘 이상의 자료에서 함께 나타난 모습'
      :row.confidence==='low'?'한정된 자료에서 나타난 가능성'
        :'추가 확인이 필요한 모습';
}

function deriveParentingGuides(observations,reasoning){
  const all=observations.map((row)=>row.text).join(' ');
  const doThis=[];
  const waitFor=[];
  const helpfulWords=[];
  const avoid=[];

  const push=(target,text)=>{if(text&&!target.includes(text))target.push(text);};

  if(/신중|걱정|긴장|낯선|변화|불안/i.test(all)){
    push(doThis,'예고 없이 바꾸기보다 다음 순서를 짧게 알려 주세요.');
    push(waitFor,'새로운 사람이나 장소에 적응할 시간을 충분히 주세요.');
    push(helpfulWords,'“처음이라 걱정될 수 있어. 천천히 해도 괜찮아.”');
    push(avoid,'“별것도 아닌데 왜 그래?”처럼 감정을 작게 만들지 마세요.');
  }
  if(/충동|빠르게|자극|흥미|산만|집중/i.test(all)){
    push(doThis,'해야 할 일을 한 번에 하나씩, 짧고 구체적으로 제시해 주세요.');
    push(waitFor,'흥분이 가라앉은 뒤에 규칙과 결과를 다시 확인해 주세요.');
    push(helpfulWords,'“먼저 이것 하나, 그다음에 네가 고른 것을 하자.”');
    push(avoid,'긴 설명이나 여러 지시를 한꺼번에 주지 마세요.');
  }
  if(/가라앉|의욕|무기력|우울|피곤|위축/i.test(all)){
    push(doThis,'수면·식사·활동 리듬을 무리 없이 일정하게 유지해 주세요.');
    push(waitFor,'말을 재촉하기보다 곁에 머물며 표현할 준비를 기다려 주세요.');
    push(helpfulWords,'“지금 말하지 않아도 괜찮아. 준비되면 들려줘.”');
    push(avoid,'의욕 부족을 게으름이나 고집으로 단정하지 마세요.');
  }
  if(/관계|친구|표정|반응|민감|거절|갈등/i.test(all)){
    push(doThis,'친구 관계에서 있었던 일을 사실·감정·바라는 점 순서로 함께 정리해 주세요.');
    push(waitFor,'갈등 직후 해결을 강요하기보다 감정이 잦아들 시간을 주세요.');
    push(helpfulWords,'“네가 어떻게 느꼈는지 먼저 듣고 싶어.”');
    push(avoid,'누가 옳은지 바로 판단하거나 다른 아이와 비교하지 마세요.');
  }
  if(/강해질|화|짜증|공격|좌절|버티/i.test(all)){
    push(doThis,'감정은 허용하되 해치는 행동의 한계는 짧고 분명하게 알려 주세요.');
    push(waitFor,'훈육은 아이가 진정된 뒤 짧게 다시 이야기해 주세요.');
    push(helpfulWords,'“화난 마음은 이해해. 하지만 때리거나 던지는 행동은 멈춰야 해.”');
    push(avoid,'부모도 큰 목소리로 맞서거나 과거 잘못까지 한꺼번에 꺼내지 마세요.');
  }

  if(!doThis.length)push(doThis,'아이의 행동을 바로 고치기 전에 그 행동이 무엇을 피하거나 얻으려는지 살펴봐 주세요.');
  if(!waitFor.length)push(waitFor,'아이가 감정과 생각을 정리할 시간을 조금 기다려 주세요.');
  if(!helpfulWords.length)push(helpfulWords,'“네 마음을 알고 싶어. 천천히 이야기해도 괜찮아.”');
  if(!avoid.length)push(avoid,'비교, 낙인, 반복적인 추궁은 피해주세요.');

  const priorities=list(reasoning?.clinicalPriorities).slice(0,3).map((row,index)=>({
    order:index+1,
    title:clean(row.label),
    guidance:row.key==='stabilize'?'생활 리듬과 정서 안정부터 돕습니다.'
      :row.key==='stress'?'부담을 키우는 상황을 줄이고 쉬어갈 방법을 함께 찾습니다.'
        :row.key==='relationship'?'감정과 바라는 점을 말로 표현하는 연습을 돕습니다.'
          :'아이의 강점을 일상에서 자주 사용할 기회를 만듭니다.'
  })).filter((row)=>row.title);

  return {doThis,waitFor,helpfulWords,avoid,priorities};
}

function summarizeDomain(observations,domain,max=3){
  return uniq(observations.filter((row)=>row.domain===domain).map((row)=>row.text)).slice(0,max);
}

function buildParentReportSections(context){
  const o=context.observations||[];
  const g=context.parentingGuides||{};
  const current=uniq([
    ...summarizeDomain(o,'emotion',2),
    ...summarizeDomain(o,'stress',2),
    ...summarizeDomain(o,'daily',1)
  ]).slice(0,4);
  const strengths=summarizeDomain(o,'strength',4);
  const emotionBehavior=uniq([
    ...summarizeDomain(o,'emotion',3),
    ...summarizeDomain(o,'temperament',2),
    ...summarizeDomain(o,'daily',1)
  ]).slice(0,5);
  const relationships=summarizeDomain(o,'relationship',4);

  return [
    {id:'current-child-mind',number:1,title:'현재 아이의 마음',summary:current[0]||'현재 자료에서는 아이의 마음을 한 가지 모습으로 단정하기보다 생활 장면과 함께 살펴보는 것이 중요합니다.',points:current},
    {id:'strengths',number:2,title:'아이의 강점',summary:strengths[0]||'아이에게 이미 있는 강점과 잘 되는 조건을 함께 찾는 것이 회복의 출발점입니다.',points:strengths},
    {id:'emotion-behavior',number:3,title:'감정과 행동',summary:emotionBehavior[0]||'행동만 보기보다 그 앞의 감정과 필요를 함께 이해해 주세요.',points:emotionBehavior,confidence:confidenceLabel(context.reasoning,'current-functioning')},
    {id:'relationships',number:4,title:'친구 및 가족 관계',summary:relationships[0]||'관계 모습은 상황과 상대에 따라 달라질 수 있으므로 반복되는 장면을 함께 살펴보는 것이 좋습니다.',points:relationships,confidence:confidenceLabel(context.reasoning,'relationship-pattern')},
    {id:'parent-help',number:5,title:'부모가 도와줄 수 있는 방법',summary:'아이의 마음을 먼저 이해하고, 행동의 한계는 짧고 분명하게 알려 주세요.',doThis:g.doThis||[],waitFor:g.waitFor||[]},
    {id:'home-practice',number:6,title:'가정에서 실천하기',summary:'완벽하게 바꾸려 하기보다 한 번에 한 가지를 꾸준히 실천해 보세요.',helpfulWords:g.helpfulWords||[],avoid:g.avoid||[],priorities:g.priorities||[]},
    {id:'professional-note',number:7,title:'전문가 한마디',summary:'아이의 현재 모습은 고정된 성격이나 부모의 잘못을 뜻하지 않습니다. 아이가 편안함을 느끼는 조건과 어려워지는 조건을 함께 알아가며 작은 성공 경험을 반복하는 것이 중요합니다.',points:['아이의 강점을 먼저 확인합니다.','어려운 행동 뒤의 감정과 필요를 살펴봅니다.','변화는 작고 반복 가능한 방법부터 시작합니다.']}
  ];
}

function buildParentReportContext(source){
  const caseObject=modules.caseObject?.buildClientCaseConceptualizationObject?.(source)||{};
  const reasoning=modules.reasoning?.buildClinicalReasoningEngine?.(source)||{};
  const decisionTrace=modules.reasoning?.buildClinicalDecisionTrace?.(source)||null;
  const evidence=modules.evidence?.buildNormalizedClinicalEvidence?.(source)||null;
  const observations=buildObservationMap(source,caseObject);
  const parentingGuides=deriveParentingGuides(observations,reasoning);
  const sections=buildParentReportSections({observations,parentingGuides,reasoning});
  const domains=caseObject?.domains||{};

  return {
    schemaVersion:'mml-parent-report-context-v2',
    generatedAt:new Date().toISOString(),
    audience:'parent_or_guardian',
    currentUnderstanding:childFriendlyText(domains.presentingConcern||domains.currentEmotionalFunctioning||''),
    temperamentAndNeeds:childFriendlyText(domains.temperamentAndPersonality||domains.temperament||domains.currentFunctioning||''),
    strengths:childFriendlyText(domains.protectiveFactors||''),
    difficultPatterns:childFriendlyText(domains.maintainingFactors||''),
    recoveryPriorities:list(reasoning.clinicalPriorities),
    observations,
    parentingGuides,
    sections,
    evidence,
    internal:{caseObject,reasoning,decisionTrace},
    languageRules:[
      '부모의 잘못이나 양육 실패로 단정하지 않는다.',
      '아동의 행동을 의도보다 감정·필요·기능의 관점에서 설명한다.',
      '전문용어와 검사 점수는 부모가 이해하기 쉬운 생활 언어로 바꾼다.',
      '단일 검사에서만 나타난 내용은 가능성 수준으로 표현한다.',
      '가정에서 바로 시도할 수 있는 작고 구체적인 행동을 제안한다.',
      '강점과 보호요인을 어려움보다 먼저 또는 함께 제시한다.',
      '부모용 공유본에는 internal, decisionTrace, 원점수, T점수, 백분위를 노출하지 않는다.'
    ],
    outputRule:'최종 부모보고서는 1. 현재 아이의 마음 2. 아이의 강점 3. 감정과 행동 4. 친구 및 가족 관계 5. 부모가 도와줄 수 있는 방법 6. 가정에서 실천하기 7. 전문가 한마디 순서로 작성한다.'
  };
}

function buildParentReport(source){
  const context=buildParentReportContext(source);
  return {
    schemaVersion:'mml-parent-report-v2',
    generatedAt:context.generatedAt,
    audience:context.audience,
    title:'부모·보호자용 심리검사 결과 안내',
    sections:context.sections,
    languageRules:context.languageRules,
    qualityMeta:{
      observationCount:context.observations.length,
      sourceCount:new Set(context.observations.map((row)=>row.testType).filter(Boolean)).size,
      sectionCount:context.sections.length
    }
  };
}

modules.parentReportComposer=Object.freeze({
  buildParentReportContext,
  buildParentReport,
  buildParentReportSections,
  deriveParentingGuides,
  childFriendlyText
});
})(window);
