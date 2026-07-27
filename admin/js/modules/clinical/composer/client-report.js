(function(global){
'use strict';
const modules=global.MMLClinicalModules=global.MMLClinicalModules||{};

function cleanText(value){
  return String(value??'')
    .replace(/\r\n/g,'\n')
    .replace(/[\t ]+/g,' ')
    .replace(/\n{3,}/g,'\n\n')
    .trim();
}

function uniqueTexts(values){
  const seen=new Set();
  const result=[];
  for(const value of (values||[]).flat(Infinity)){
    const text=cleanText(value);
    if(!text)continue;
    const key=text.replace(/\s+/g,' ').toLowerCase();
    if(seen.has(key))continue;
    seen.add(key);
    result.push(text);
  }
  return result;
}

function evidenceRows(evidence,domains){
  const byDomain=evidence?.byDomain||{};
  return (domains||[])
    .flatMap(domain=>Array.isArray(byDomain[domain])?byDomain[domain]:[])
    .filter(item=>item&&cleanText(item.finding));
}

function rankEvidence(item){
  const score={high:4,medium:3,low:2,limited:1};
  return score[item?.confidence]||0;
}

function findings(evidence,domains,limit=6){
  const rows=evidenceRows(evidence,domains)
    .slice()
    .sort((a,b)=>rankEvidence(b)-rankEvidence(a));
  return uniqueTexts(rows.map(item=>item.finding)).slice(0,limit);
}

function confidenceLanguage(hypothesis){
  if(!hypothesis)return '';
  if(hypothesis.confidence==='high')return '여러 검사에서 비교적 일관되게 확인됩니다.';
  if(hypothesis.confidence==='medium')return '두 가지 이상의 자료에서 같은 방향이 확인됩니다.';
  if(hypothesis.confidence==='low')return '한정된 자료에서 나타난 가능성으로 신중히 이해할 필요가 있습니다.';
  return '현재 자료만으로 단정하기보다 참고 수준으로 이해할 필요가 있습니다.';
}

function findHypothesis(reasoning,id){
  return (reasoning?.hypotheses||[]).find(item=>item.id===id)||null;
}

function section({number,title,summary='',points=[],confidence='',caution=''}){
  const normalizedPoints=uniqueTexts(points).slice(0,6);
  return {
    number,
    title,
    summary:cleanText(summary),
    points:normalizedPoints,
    confidence:cleanText(confidence),
    caution:cleanText(caution),
    hasContent:Boolean(cleanText(summary)||normalizedPoints.length)
  };
}

function buildTestSummaries(evidence){
  const sources=Array.isArray(evidence?.sourceInventory)?evidence.sourceInventory:[];
  return sources
    .filter(source=>source?.source&&source.source!=='integrated_report')
    .map(source=>({
      testName:cleanText(source.source),
      limited:Boolean(source.limited),
      findings:uniqueTexts((evidence.bySource?.[source.source]||[])
        .filter(item=>!['test_validity','recovery_direction'].includes(item.domain))
        .sort((a,b)=>rankEvidence(b)-rankEvidence(a))
        .map(item=>item.finding)).slice(0,4)
    }))
    .filter(item=>item.findings.length);
}

function buildClinicalReportContext(source){
  const evidence=modules.evidence?.buildNormalizedClinicalEvidence(source)||{};
  const reasoning=modules.reasoning?.buildClinicalReasoningEngine(source)||{};
  const decisionTrace=modules.reasoning?.buildClinicalDecisionTrace(source)||{};
  const caseConceptualization=modules.caseObject?.buildClientCaseConceptualizationObject(source)||{};

  const currentHypothesis=findHypothesis(reasoning,'current-functioning');
  const stableHypothesis=findHypothesis(reasoning,'stable-pattern');
  const relationshipHypothesis=findHypothesis(reasoning,'thinking-relationship');
  const stressHypothesis=findHypothesis(reasoning,'stress-maintenance');
  const strengthHypothesis=findHypothesis(reasoning,'protective-resources');

  const currentPoints=findings(evidence,['current_state','emotion','vulnerabilities_risk'],5);
  const profilePoints=findings(evidence,['stable_traits','cross_test_convergence'],5);
  const emotionPoints=findings(evidence,['emotion','current_state'],5);
  const relationshipPoints=findings(evidence,['thinking','relationship'],5);
  const stressPoints=findings(evidence,['stress_functioning','vulnerabilities_risk'],5);
  const strengthPoints=findings(evidence,['strengths_protective'],4);
  const recommendationPoints=findings(evidence,['recovery_direction'],5);
  const priorityPoints=(reasoning.clinicalPriorities||[])
    .slice()
    .sort((a,b)=>(a.order||99)-(b.order||99))
    .map(item=>item.label);

  const conflicts=(reasoning.conflicts||[]).map(item=>item.finding).filter(Boolean);
  const limitedSources=reasoning.synthesis?.limitedSources||[];

  return {
    schemaVersion:'mml-client-report-context-v2',
    generatedAt:new Date().toISOString(),
    purpose:'내담자 공유용 심리검사 보고서 작성 컨텍스트',
    sections:{
      currentMind:section({
        number:1,
        title:'현재 마음의 핵심 모습',
        summary:currentPoints[0]||'',
        points:currentPoints.slice(1),
        confidence:confidenceLanguage(currentHypothesis)
      }),
      mindProfile:section({
        number:2,
        title:'마음 프로파일',
        summary:profilePoints[0]||'',
        points:profilePoints.slice(1),
        confidence:confidenceLanguage(stableHypothesis)
      }),
      emotionalState:section({
        number:3,
        title:'정서와 심리상태',
        summary:emotionPoints[0]||'',
        points:emotionPoints.slice(1),
        confidence:confidenceLanguage(currentHypothesis)
      }),
      thinkingRelationship:section({
        number:4,
        title:'사고와 관계 방식',
        summary:relationshipPoints[0]||'',
        points:relationshipPoints.slice(1),
        confidence:confidenceLanguage(relationshipHypothesis),
        caution:conflicts.length?'검사 간 차이는 모순이라기보다 평소 특성, 최근 상태, 상황에 따른 반응 차이로 함께 이해합니다.':''
      }),
      stressDailyLife:section({
        number:5,
        title:'스트레스와 일상생활',
        summary:stressPoints[0]||'',
        points:stressPoints.slice(1),
        confidence:confidenceLanguage(stressHypothesis)
      }),
      professionalGuidance:section({
        number:6,
        title:'전문가 제언 및 회복 방향',
        summary:strengthPoints[0]||'',
        points:uniqueTexts([...priorityPoints,...recommendationPoints,...strengthPoints.slice(1)]).slice(0,6),
        confidence:confidenceLanguage(strengthHypothesis)
      })
    },
    testSummaries:buildTestSummaries(evidence),
    reportMeta:{
      evidenceCount:Number(evidence.totalEvidence||0),
      sourceCount:Array.isArray(evidence.sources)?evidence.sources.filter(source=>source!=='integrated_report').length:0,
      hasCrossTestSupport:Boolean(reasoning.synthesis?.hasCrossTestSupport),
      hasConflicts:Boolean(reasoning.synthesis?.hasConflicts),
      limitedSources:uniqueTexts(limitedSources)
    },
    writingRules:[
      '내담자가 이해하기 쉬운 생활 언어로 작성한다.',
      '검사명과 점수를 나열하기보다 현재 경험과 일상 영향 중심으로 설명한다.',
      '높은 근거는 분명하게, 중간 근거는 경향으로, 낮거나 제한된 근거는 가능성 수준으로 표현한다.',
      '검사 간 차이는 평소 특성, 최근 상태, 상황별 반응의 차이로 설명한다.',
      '취약요인만 강조하지 않고 강점과 보호요인을 함께 제시한다.',
      '근거가 없는 진단, 병명, 상담 장면, 행동관찰 내용을 새로 만들지 않는다.',
      '내부 필드명, 추론 점수, decisionTrace, confidence score는 본문에 노출하지 않는다.'
    ],
    internal:{
      evidence,
      reasoning,
      decisionTrace,
      caseConceptualization
    }
  };
}

modules.reportComposer=Object.freeze({buildClinicalReportContext});
})(window);
