(function(global){
'use strict';

const modules=global.MMLClinicalModules=global.MMLClinicalModules||{};

const clean=(value)=>String(value??'').replace(/\r\n/g,'\n').replace(/[ \t]+/g,' ').replace(/\n{3,}/g,'\n\n').trim();
const list=(value)=>Array.isArray(value)?value.map(clean).filter(Boolean):clean(value)?[clean(value)]:[];
const unique=(values)=>{
  const seen=new Set();
  return (values||[]).flat(Infinity).map(clean).filter(Boolean).filter(value=>{
    const key=value.toLowerCase().replace(/\s+/g,' ');
    if(seen.has(key))return false;
    seen.add(key);
    return true;
  });
};
const clip=(text,max=260)=>{
  const value=clean(text);
  return value.length>max?`${value.slice(0,max).trim()}…`:value;
};

const RISK_PATTERNS=[
  {level:'emergency',code:'suicide_imminent',pattern:/(지금|오늘|곧).{0,12}(죽고|자살|목숨|끝내고).{0,12}(싶|할 거|계획|준비)/i},
  {level:'high',code:'suicide_ideation',pattern:/(죽고 싶|자살|사라지고 싶|살고 싶지|삶을 끝)/i},
  {level:'high',code:'self_harm',pattern:/(자해|손목.{0,8}(긋|그었)|내 몸을 해치)/i},
  {level:'high',code:'violence',pattern:/(죽여버|해치고 싶|폭행|칼로|흉기)/i},
  {level:'high',code:'abuse',pattern:/(학대|성폭력|성추행|맞고 있|감금)/i},
  {level:'moderate',code:'psychosis_or_disorientation',pattern:/(환청|환각|누가 나를 감시|현실인지 모르|정신이 끊)/i}
];

function detectSafetyRisk(text){
  const source=clean(text);
  const matches=RISK_PATTERNS.filter(row=>row.pattern.test(source));
  const rank={none:0,moderate:1,high:2,emergency:3};
  const level=matches.reduce((current,row)=>rank[row.level]>rank[current]?row.level:current,'none');
  return {
    detected:level!=='none',
    level,
    codes:unique(matches.map(row=>row.code)),
    requiresHuman:level==='high'||level==='emergency',
    requiresImmediateAction:level==='emergency'
  };
}

function buildSafetyResponse(risk){
  if(!risk?.detected)return null;
  if(risk.level==='emergency'){
    return {
      type:'safety',
      message:'지금은 혼자 버티는 것보다 즉시 안전을 확보하는 것이 가장 중요합니다. 혼자 있지 말고 가까운 사람에게 지금 상태를 알려 주세요. 즉각적인 위험이 있다면 112 또는 119에 연락하거나 가까운 응급실로 이동해 주세요.',
      question:'지금 곁에 함께 있어 줄 사람에게 바로 연락할 수 있나요?',
      pauseClinicalInterpretation:true
    };
  }
  if(risk.level==='high'){
    return {
      type:'safety',
      message:'말해 주신 내용은 안전을 먼저 확인해야 하는 중요한 신호입니다. 지금 혼자 감당하지 말고 믿을 수 있는 사람이나 전문기관과 바로 연결되는 것이 필요합니다.',
      question:'현재 자신이나 다른 사람을 해칠 구체적인 계획이나 준비가 있나요?',
      pauseClinicalInterpretation:true
    };
  }
  return {
    type:'safety_check',
    message:'현재 경험이 매우 혼란스럽거나 버겁게 느껴질 수 있습니다. 검사 해석보다 먼저 지금의 상태와 안전을 확인하겠습니다.',
    question:'지금 주변 상황을 인식하고 안전하게 머물 수 있나요?',
    pauseClinicalInterpretation:true
  };
}

function normalizePriorities(reasoning){
  return (Array.isArray(reasoning?.clinicalPriorities)?reasoning.clinicalPriorities:[])
    .map((row,index)=>({
      order:Number(row?.order)||index+1,
      key:clean(row?.key),
      label:clean(row?.label||row?.title),
      score:Number(row?.score)||0
    }))
    .filter(row=>row.label)
    .sort((a,b)=>a.order-b.order||b.score-a.score);
}

function normalizeHypotheses(reasoning){
  return (Array.isArray(reasoning?.hypotheses)?reasoning.hypotheses:[])
    .map(row=>({
      id:clean(row?.id),
      label:clean(row?.label),
      confidence:clean(row?.confidence||'limited'),
      status:clean(row?.status),
      evidence:unique(row?.supportingEvidence||[]).slice(0,4),
      sources:unique(row?.sources||[])
    }))
    .filter(row=>row.label);
}

function buildCounselingContext(source={}){
  const caseObject=modules.caseObject?.buildClientCaseConceptualizationObject?.(source)||{};
  const reasoning=modules.reasoning?.buildClinicalReasoningEngine?.(source)||{};
  const decisionTrace=modules.reasoning?.buildClinicalDecisionTrace?.(source)||{};
  const domains=caseObject?.domains||{};
  const hypotheses=normalizeHypotheses(reasoning);
  const priorities=normalizePriorities(reasoning);
  const strengths=unique([
    domains.protectiveFactors,
    ...(caseObject?.evidenceByDomain?.strengths||[]),
    ...hypotheses.filter(row=>/protective|strength/i.test(row.id)).flatMap(row=>row.evidence)
  ]).slice(0,5);
  const vulnerabilities=unique([
    domains.maintainingFactors,
    ...(caseObject?.evidenceByDomain?.vulnerabilities||[])
  ]).slice(0,5);

  return {
    schemaVersion:'mml-clinical-counseling-context-v3',
    generatedAt:new Date().toISOString(),
    presentingConcern:clean(domains.presentingConcern),
    currentEmotionalFunctioning:clean(domains.currentEmotionalFunctioning),
    temperamentAndPersonality:clean(domains.temperamentAndPersonality),
    thinkingAndRelationship:clean(domains.thinkingAndRelationship),
    stressAndDailyFunctioning:clean(domains.stressAndDailyFunctioning),
    maintainingFactors:clean(domains.maintainingFactors),
    protectiveFactors:clean(domains.protectiveFactors),
    hypotheses,
    recoveryPriorities:priorities,
    strengths,
    vulnerabilities,
    conflicts:list(reasoning?.conflicts).slice(0,4),
    evidenceCoverage:reasoning?.evidenceCoverage||{},
    decisionTraceSummary:decisionTrace?.summary||{},
    conversationRules:{
      oneOpenQuestion:true,
      reflectBeforeInterpret:true,
      noDiagnosis:true,
      noScoreDisclosure:true,
      noInternalFieldDisclosure:true,
      uncertaintyLanguage:true,
      crisisOverridesInterpretation:true
    }
  };
}

function chooseFocus(context,turn={}){
  const requested=clean(turn.focus||turn.topic);
  if(requested)return requested;
  const latest=clean(turn.userMessage);
  const candidates=[
    ['정서와 현재 상태',context.currentEmotionalFunctioning,/불안|우울|기분|감정|무기력|초조/i],
    ['스트레스와 일상 기능',context.stressAndDailyFunctioning,/스트레스|수면|집중|일|생활|피곤/i],
    ['사고와 관계 방식',context.thinkingAndRelationship,/관계|사람|가족|친구|직장|상사|갈등/i],
    ['기질과 성격 특성',context.temperamentAndPersonality,/성격|기질|원래|평소|왜 이러/i]
  ];
  const matched=candidates.find(row=>row[2].test(latest)&&clean(row[1]));
  return matched?.[0]||context.recoveryPriorities?.[0]?.label||'현재 가장 부담되는 경험';
}

function selectEvidence(context,focus){
  const rows=[];
  const add=(label,text)=>{if(clean(text))rows.push({label,text:clip(text,220)});};
  if(/정서|현재/.test(focus))add('현재 상태',context.currentEmotionalFunctioning||context.presentingConcern);
  if(/스트레스|일상/.test(focus))add('스트레스와 생활',context.stressAndDailyFunctioning);
  if(/관계|사고/.test(focus))add('사고와 관계',context.thinkingAndRelationship);
  if(/기질|성격/.test(focus))add('평소 특성',context.temperamentAndPersonality);
  if(!rows.length){
    add('현재 상태',context.currentEmotionalFunctioning||context.presentingConcern);
    add('스트레스와 생활',context.stressAndDailyFunctioning);
  }
  context.hypotheses.filter(row=>row.confidence!=='limited').slice(0,2).forEach(row=>{
    if(row.evidence[0])add(row.label,row.evidence[0]);
  });
  return rows.slice(0,3);
}

function buildOpenQuestion(context,focus,turn={}){
  const message=clean(turn.userMessage);
  if(/직장|상사|업무/.test(message))return '그 상황에서 가장 힘든 순간은 언제이고, 그때 마음속에서는 어떤 생각이 가장 먼저 떠오르나요?';
  if(/관계|가족|친구|배우자|부모/.test(message))return '그 관계에서 특히 반복된다고 느끼는 장면은 무엇이며, 그때 가장 바라는 것은 무엇인가요?';
  if(/불안|초조|걱정/.test(message))return '불안이 가장 커지는 상황에서 몸의 느낌과 머릿속 생각은 어떻게 달라지나요?';
  if(/우울|무기력|지침/.test(message))return '요즘 가장 에너지가 떨어지는 시간이나 상황은 언제이며, 그 전후에 어떤 일이 있었나요?';
  if(/스트레스|피곤|수면|집중/.test(message))return '일상에서 부담이 가장 크게 쌓이는 지점은 어디이며, 그때 평소와 다르게 나타나는 반응은 무엇인가요?';
  if(/기질|성격/.test(focus))return '평소의 내 모습과 최근 힘들 때의 내 모습이 가장 다르게 느껴지는 부분은 무엇인가요?';
  return '지금 이야기한 내용 가운데 가장 먼저 이해받고 싶은 부분은 무엇인가요?';
}

function buildCounselingTurn(source={},turn={}){
  const context=source?.schemaVersion==='mml-clinical-counseling-context-v3'?source:buildCounselingContext(source);
  const userMessage=clean(turn.userMessage||turn.message);
  const risk=detectSafetyRisk(userMessage);
  const safety=buildSafetyResponse(risk);
  if(safety){
    return {
      schemaVersion:'mml-clinical-counseling-turn-v3',
      generatedAt:new Date().toISOString(),
      risk,
      focus:'안전 확인',
      response:safety.message,
      question:safety.question,
      nextAction:risk.requiresImmediateAction?'emergency_connection':'human_support_connection',
      pauseClinicalInterpretation:true
    };
  }

  const focus=chooseFocus(context,{...turn,userMessage});
  const evidence=selectEvidence(context,focus);
  const reflection=userMessage
    ?`${clip(userMessage,110)}라고 느끼신 데에는 지금까지 쌓인 부담과 그 상황에서의 반응이 함께 영향을 주었을 수 있습니다.`
    :'검사 결과는 현재의 어려움을 단정하는 답이라기보다, 반복되는 마음의 흐름을 이해하기 위한 자료로 활용할 수 있습니다.';
  const interpretation=evidence.length
    ?`${evidence[0].text} 이러한 경향은 모든 상황에서 동일하다는 뜻이 아니라, 부담이 커질 때 더 두드러질 가능성으로 이해하는 것이 적절합니다.`
    :'현재 자료만으로 단정하기보다 실제 경험과 함께 확인해 가는 것이 중요합니다.';
  const strength=context.strengths[0]
    ?`동시에 ${clip(context.strengths[0],160)}라는 강점 또는 보호요인도 함께 확인됩니다.`
    :'';
  const question=buildOpenQuestion(context,focus,{...turn,userMessage});

  return {
    schemaVersion:'mml-clinical-counseling-turn-v3',
    generatedAt:new Date().toISOString(),
    risk,
    focus,
    response:unique([reflection,interpretation,strength]).join(' '),
    question,
    evidenceUsed:evidence,
    nextAction:'continue_exploration',
    pauseClinicalInterpretation:false
  };
}

function buildCounselingSystemPrompt(contextOrSource={}){
  const context=contextOrSource?.schemaVersion==='mml-clinical-counseling-context-v3'
    ?contextOrSource
    :buildCounselingContext(contextOrSource);
  const priorities=context.recoveryPriorities.map(row=>`${row.order}. ${row.label}`).join('\n')||'현재 경험과 기능을 우선 확인';
  const strengths=context.strengths.map(item=>`- ${item}`).join('\n')||'- 확인된 강점을 실제 경험에서 탐색';
  return clean(`
당신은 모두의 마음연구소의 AI 검사결과 해석상담 보조자입니다.
검사결과를 진단이나 확정적 결론으로 전달하지 말고, 내담자의 실제 경험을 확인하는 대화로 연결하십시오.

[핵심 원칙]
1. 답변은 공감적 반영 → 검사결과의 가능성 수준 해석 → 강점 또는 균형 정보 → 열린 질문 1개 순서로 작성합니다.
2. 한 번의 답변에는 질문을 정확히 1개만 포함합니다.
3. 점수, 내부 추론 필드, decisionTrace, confidence 수치, 원자료를 노출하지 않습니다.
4. 검사 간 차이는 모순이나 병리로 단정하지 말고 평소 특성·최근 상태·상황별 반응의 차이로 설명합니다.
5. 자살, 자해, 타해, 학대, 현실검증 저하 신호가 있으면 검사 해석을 중단하고 안전 확인과 사람·기관 연결을 우선합니다.
6. 조언을 서두르지 말고 내담자가 느낀 의미와 반복되는 상황을 먼저 탐색합니다.
7. 의료적 진단, 약물 조정, 법률 판단을 하지 않습니다.

[현재 상담 우선순위]
${priorities}

[활용 가능한 강점]
${strengths}

[표현 방식]
- 단정 대신 “~일 수 있습니다”, “~한 경향이 나타날 수 있습니다”를 사용합니다.
- 내담자가 사용한 말을 그대로 반복하기보다 의미를 짧게 반영합니다.
- 답변은 한국어로, 3~5문장 이내로 작성합니다.
`);
}

function buildCounselingRecord({context={},turns=[],sessionId='',reservationId='',clientId=''}={}){
  const safeTurns=(Array.isArray(turns)?turns:[]).map((turn,index)=>({
    order:index+1,
    userMessage:clean(turn?.userMessage),
    assistantResponse:clean(turn?.response||turn?.assistantResponse),
    question:clean(turn?.question),
    focus:clean(turn?.focus),
    riskLevel:clean(turn?.risk?.level||turn?.riskLevel||'none'),
    createdAt:turn?.createdAt||new Date().toISOString()
  }));
  const focuses=unique(safeTurns.map(row=>row.focus)).slice(0,6);
  const risks=safeTurns.filter(row=>row.riskLevel&&row.riskLevel!=='none');
  return {
    schemaVersion:'mml-clinical-counseling-record-v3',
    sessionId:clean(sessionId),
    reservationId:clean(reservationId),
    clientId:clean(clientId),
    createdAt:new Date().toISOString(),
    status:risks.some(row=>row.riskLevel==='emergency')?'urgent_review':risks.length?'human_review':'completed',
    summary:{
      turnCount:safeTurns.length,
      exploredTopics:focuses,
      lastFocus:focuses[focuses.length-1]||'',
      safetyReviewRequired:risks.length>0
    },
    recoveryPriorities:normalizePriorities(context),
    turns:safeTurns,
    internal:{
      contextVersion:clean(context?.schemaVersion),
      riskEvents:risks.map(row=>({order:row.order,level:row.riskLevel}))
    }
  };
}

modules.counseling=Object.freeze({
  buildCounselingContext,
  buildCounselingSystemPrompt,
  buildCounselingTurn,
  buildCounselingRecord,
  detectSafetyRisk,
  buildSafetyResponse
});

})(window);
