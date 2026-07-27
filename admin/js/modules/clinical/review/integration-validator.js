(function(global){
'use strict';
const modules=global.MMLClinicalModules=global.MMLClinicalModules||{};

const REQUIRED_APIS=[
  'buildNormalizedClinicalEvidence',
  'buildClinicalReasoningEngine',
  'buildClinicalReportContext',
  'reviewClinicalOutput',
  'sanitizeClinicalOutput'
];

function sampleSource(){
  return {
    currentState:'최근 긴장과 걱정이 늘고 피로가 누적된 모습이 확인됩니다.',
    stableTraits:'새로운 상황에서 신중하게 접근하고 위험 가능성을 먼저 살피는 경향이 있습니다.',
    relationshipPattern:'관계에서 상대의 반응을 세심하게 살피며 갈등을 피하려는 경향이 있습니다.',
    formulation:'스트레스가 지속될 때 생각이 많아지고 휴식과 일상 리듬이 흐트러질 수 있습니다.',
    strengths:'책임감이 있고 상황을 충분히 검토한 뒤 행동하려는 강점이 있습니다.',
    vulnerabilities:'불확실한 상황에서 걱정이 커지고 결정을 미루기 쉬울 수 있습니다.',
    recommendations:'수면과 휴식 리듬을 우선 회복하고 걱정을 구체적인 행동 단위로 나누어 다루는 것이 도움이 됩니다.',
    testEvidence:[
      {testType:'TCI',coreFindings:['위험회피 성향이 높아 낯선 상황에서 신중하게 반응할 수 있습니다.'],strengths:['성급하게 결정하지 않고 충분히 검토합니다.'],vulnerabilities:['불확실성에 대한 걱정이 커질 수 있습니다.'],confidence:'high'},
      {testType:'MMPI-2',coreFindings:['최근 불안과 피로가 함께 나타나는 경향이 확인됩니다.'],strengths:['현실검증력은 유지되고 있습니다.'],vulnerabilities:['스트레스가 누적될 때 집중력과 수면이 흔들릴 수 있습니다.'],confidence:'medium'}
    ]
  };
}

function runClinicalIntegrationValidation(source){
  const engine=global.MMLClinicalEngine||{};
  const missing=REQUIRED_APIS.filter(name=>typeof engine[name]!=='function');
  const checks={apiReady:missing.length===0,evidence:false,reasoning:false,composer:false,sanitizer:false,review:false};
  const errors=[];
  let context=null;
  let review=null;

  if(missing.length){
    errors.push(`필수 API 누락: ${missing.join(', ')}`);
  }else{
    try{
      const input=source||sampleSource();
      const evidence=engine.buildNormalizedClinicalEvidence(input);
      checks.evidence=Boolean(evidence&&Array.isArray(evidence.items)&&evidence.items.length>0);

      const reasoning=engine.buildClinicalReasoningEngine(input);
      checks.reasoning=Boolean(reasoning&&Array.isArray(reasoning.hypotheses));

      context=engine.buildClinicalReportContext(input);
      checks.composer=Boolean(context&&context.sections&&Object.keys(context.sections).length===6);

      const sanitized=engine.sanitizeClinicalOutput(context);
      checks.sanitizer=Boolean(sanitized&&!Object.prototype.hasOwnProperty.call(sanitized,'internal'));

      review=engine.reviewClinicalOutput({sections:sanitized.sections},{mode:'client'});
      checks.review=Boolean(review&&typeof review.passed==='boolean'&&typeof review.score==='number');
    }catch(error){
      errors.push(error instanceof Error?error.message:String(error));
    }
  }

  const failed=Object.entries(checks).filter(([,passed])=>!passed).map(([name])=>name);
  if(failed.length) errors.push(`검증 실패: ${failed.join(', ')}`);

  return Object.freeze({
    ready:errors.length===0,
    checks:Object.freeze({...checks}),
    missing:Object.freeze(missing),
    errors:Object.freeze(errors),
    quality:review?Object.freeze({passed:review.passed,score:review.score,severity:review.severity}):null,
    checkedAt:new Date().toISOString()
  });
}

modules.integrationValidator=Object.freeze({runClinicalIntegrationValidation});
if(typeof modules.refreshClinicalEngine==='function') modules.refreshClinicalEngine();
})(window);
