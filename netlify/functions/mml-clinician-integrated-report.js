const MODEL = process.env.GEMINI_REPORT_MODEL || 'gemini-2.5-flash';

const json = (obj, statusCode = 200) => ({
  statusCode,
  headers: {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json; charset=utf-8'
  },
  body: JSON.stringify(obj)
});

const clean = (value, max = 8000) => String(value ?? '')
  .replace(/\r/g, '')
  .replace(/[ \t]+/g, ' ')
  .replace(/\n{3,}/g, '\n\n')
  .trim()
  .slice(0, max);

const first = (...values) => values.map(v => clean(v)).find(Boolean) || '';

const SCHEMA = {
  type: 'OBJECT',
  properties: {
    title: { type: 'STRING' },
    subtitle: { type: 'STRING' },
    clinicalJudgment: { type: 'STRING' },
    convergentEvidence: { type: 'STRING' },
    discrepancies: { type: 'STRING' },
    caseFormulation: { type: 'STRING' },
    coreProblems: { type: 'STRING' },
    strengthsProtection: { type: 'STRING' },
    riskFactors: { type: 'STRING' },
    counselingPriorities: { type: 'STRING' },
    counselingStrategies: { type: 'STRING' },
    followUpQuestions: { type: 'STRING' },
    monitoringPoints: { type: 'STRING' },
    professionalSummary: { type: 'STRING' },
    supervisorNote: { type: 'STRING' },
    limitations: { type: 'STRING' },
    crossCommonPatterns: { type: 'STRING' },
    crossDifferences: { type: 'STRING' },
    crossStateTrait: { type: 'STRING' },
    crossResponseContext: { type: 'STRING' },
    crossRiskProtection: { type: 'STRING' },
    crossFollowUpQuestions: { type: 'STRING' },
    crossCounselingImplications: { type: 'STRING' },
    crossCaseIntegration: { type: 'STRING' },
    crossLimitations: { type: 'STRING' }
  },
  required: [
    'title', 'subtitle', 'clinicalJudgment', 'convergentEvidence', 'discrepancies',
    'caseFormulation', 'coreProblems', 'strengthsProtection', 'riskFactors',
    'counselingPriorities', 'counselingStrategies', 'followUpQuestions',
    'monitoringPoints', 'professionalSummary', 'supervisorNote', 'limitations',
    'crossCommonPatterns', 'crossDifferences', 'crossStateTrait', 'crossResponseContext',
    'crossRiskProtection', 'crossFollowUpQuestions', 'crossCounselingImplications',
    'crossCaseIntegration', 'crossLimitations'
  ]
};


const DIRECT_COMPREHENSIVE_SCHEMA = {
  type: 'OBJECT',
  properties: {
    clinicalJudgment: { type: 'STRING' },
    convergentEvidence: { type: 'STRING' },
    discrepancies: { type: 'STRING' },
    caseFormulation: { type: 'STRING' },
    coreProblems: { type: 'STRING' },
    strengthsProtection: { type: 'STRING' },
    riskFactors: { type: 'STRING' },
    professionalSummary: { type: 'STRING' },
    limitations: { type: 'STRING' }
  },
  required: [
    'clinicalJudgment','convergentEvidence','discrepancies','caseFormulation',
    'coreProblems','strengthsProtection','riskFactors','professionalSummary','limitations'
  ]
};

const REPAIR_SCHEMA = {
  type: 'OBJECT',
  properties: {
    clinicalJudgment: { type: 'STRING' },
    convergentEvidence: { type: 'STRING' },
    discrepancies: { type: 'STRING' },
    caseFormulation: { type: 'STRING' },
    coreProblems: { type: 'STRING' },
    professionalSummary: { type: 'STRING' }
  },
  required: ['clinicalJudgment','convergentEvidence','discrepancies','caseFormulation','coreProblems','professionalSummary']
};

function compactTest(test, index) {
  const type = clean(test?.testType || test?.name || `검사 ${index + 1}`, 100);
  const validity = first(test?.validity, test?.validitySummary, test?.counselorReport?.validity);
  const sourceSummary = clean(test?.sourceSummary, 1400);
  const coreFindings = clean(test?.coreFindings, 1900);
  const interpretation = clean(test?.interpretation, 1400);
  const counselorSummary = clean(test?.counselorReport?.summary, 1400);
  const clinicalInterpretation = clean(test?.counselorReport?.clinicalInterpretation, 1700);
  const strengths = first(test?.strengths, test?.counselorReport?.strengths);
  const vulnerabilities = first(test?.vulnerabilities, test?.cautions, test?.counselorReport?.risks);
  const hypotheses = first(test?.caseHypotheses, test?.counselorReport?.caseFormulation);
  const crossChecks = clean(test?.crossChecks, 1000);
  const rawFacts = test?.rawFacts ? clean(JSON.stringify(test.rawFacts), 1800) : '';
  const confidence = [
    test?.reviewed === false ? '상담자 미검토' : '',
    Number.isFinite(Number(test?.confidenceScore)) ? `근거신뢰도 ${Number(test.confidenceScore)}%` : '',
    clean(test?.confidenceReason, 350),
    test?.needsReview ? '추가 검토 필요' : ''
  ].filter(Boolean).join(' / ');

  return [
    `[${index + 1}. ${type}]`,
    validity && `타당도·응답특성: ${clean(validity, 900)}`,
    confidence && `자료상태: ${confidence}`,
    rawFacts && `원자료 핵심사실: ${rawFacts}`,
    sourceSummary && `원자료 요약: ${sourceSummary}`,
    coreFindings && `핵심 해석: ${coreFindings}`,
    interpretation && `추가 해석: ${interpretation}`,
    counselorSummary && `상담자 요약: ${counselorSummary}`,
    clinicalInterpretation && `상담자 임상해석: ${clinicalInterpretation}`,
    strengths && `강점: ${clean(strengths, 850)}`,
    vulnerabilities && `취약·주의: ${clean(vulnerabilities, 850)}`,
    hypotheses && `사례가설: ${clean(hypotheses, 850)}`,
    crossChecks && `다른 자료와 교차확인할 점: ${crossChecks}`
  ].filter(Boolean).join('\n');
}
function makePrompt(body) {
  const tests = body.tests.slice(0, 10).map(compactTest).join('\n\n');
  const testNames = body.tests.slice(0, 10).map((t, i) => clean(t?.testType || t?.name || `검사 ${i + 1}`, 100)).filter(Boolean);
  const cross = clean(JSON.stringify(body.crossAnalysis || {}), 4200) || '제공되지 않음';

  return `당신은 임상심리사 1급 수준의 심리평가 전문가입니다. 제공된 자료만 근거로 상담자 검토용 AI 종합해석보고서를 작성하십시오. 내담자용 설명문이 아니라 전문가가 검토·수정하는 임상 통합 초안입니다.\n\n프로그램: ${clean(body.program, 120)}\n검사 구성: ${testNames.join(' + ')}\n\n[검사별 근거자료]\n${tests}\n\n[기존 교차분석 - 참고자료일 뿐이며 비어 있거나 불완전해도 아래 검사별 근거자료를 직접 비교하여 새 교차분석을 수행할 것]\n${cross}\n\n[가장 중요한 작성 원칙]\n1. 검사별 내용을 차례로 요약한 뒤 끝내지 마십시오. 반드시 '검사 A에서는 무엇이 확인되고, 검사 B에서는 무엇이 확인되며, 두 자료가 함께 무엇을 지지하는지'를 연결해서 해석하십시오.\n2. 두 개 이상의 검사가 있는 경우 clinicalJudgment, convergentEvidence, discrepancies, caseFormulation에는 실제 검사명을 최소 1회 이상 명시하십시오.\n3. TCI/JTCI는 비교적 지속적인 기질·성격 및 자기조절·대인관계 경향의 근거로, MMPI-2/PAI는 타당도 범위 안에서 현재 임상적·정서적 상태와 증상 표현의 근거로 우선 해석하십시오. 단, 입력자료가 이를 뒷받침할 때만 사용하십시오.\n4. SCT·HTP 같은 개방형·투사적 자료는 가설 생성 자료로만 쓰고 단독 결론을 내리지 마십시오.\n5. 기존 crossAnalysis의 존재 여부에 의존하지 마십시오. crossAnalysis가 비어 있거나 '확인 필요' 수준이어도 [검사별 근거자료]를 직접 대조하여 이번 응답에서 새 교차분석을 수행하십시오. '저장된 교차분석에 없다', '자동으로 확정하지 않았다', '교차확인이 필요하다'로 답변을 회피하지 마십시오. 단, 실제 근거가 부족하면 무엇이 부족한지 특정하고 직접 비교 가능한 범위까지만 기술하십시오.\n6. '검사마다 측정영역이 다르다', '면담에서 확인이 필요하다' 같은 일반론만으로 섹션을 채우지 마십시오. 반드시 어떤 결과가 어떻게 같거나 다른지를 먼저 쓰고, 그 다음 가능한 설명을 제시하십시오.\n7. 상태-특성 구분은 추상적으로 말하지 말고, 어느 검사 결과가 비교적 지속적 특성을 시사하고 어느 결과가 최근 상태를 시사하는지 구체적으로 연결하십시오.\n8. 사례개념화는 취약요인 → 부담이 커지기 쉬운 조건 → 유지요인 → 보호요인 → 현재 기능의 순서로 하나의 인과적 가설을 만드십시오. 실제 사건은 창작하지 마십시오.\n9. 위험 근거가 없으면 위험을 만들어내지 말고 '현재 자료에서 직접 근거 없음 / 면담 재확인 필요'로 구분하십시오.\n10. 각 섹션의 역할을 엄격히 분리하십시오. 같은 문장이나 같은 요약을 여러 필드에 재사용하지 마십시오.\n11. 개인정보, 점수 나열, 위로 문구, AI 안내문은 넣지 않습니다. 진단을 확정하지 않고 사실·검사해석·임상가설을 구분합니다.\n\n[필드별 역할]\n- clinicalJudgment: 전체 검사에서 가장 중요한 3~4개 임상 주제를 '통합 결론'으로만 서술. 검사별 설명을 차례로 다시 쓰지 말고, 각 주제마다 어떤 검사 근거가 함께 지지하는지만 짧게 연결. 사례개념화의 인과과정 문장은 사용하지 말 것.\n- convergentEvidence: 반드시 항목별로 '공통주제 → 검사 A의 구체 근거 → 검사 B의 구체 근거 → 통합 의미' 순서를 지킬 것. 최소 1개, 최대 3개 공통주제. 원자료 문장을 길게 복사하지 말고 핵심 근거만 압축. 공통 주제가 실제로 없으면 '뚜렷한 수렴 근거 없음'과 그 근거를 구체적으로 제시.\n- discrepancies: 반드시 '차이점 → 검사 A 근거 ↔ 검사 B 근거 → 가능한 임상적 설명' 구조로 작성. 차이가 없다면 '뚜렷한 불일치 없음'과 그 판단 근거를 명시. 원자료 요약문을 통째로 재사용하지 말 것.\n- caseFormulation: 반드시 '취약요인 → 부담이 커지는 조건 → 심리적 반응 → 유지요인 → 보호요인/현재기능'의 인과 흐름으로 작성. clinicalJudgment의 문장을 다시 설명하지 말고 왜 현재 패턴이 유지될 수 있는지를 가설 수준에서 연결. 검사별 소개 문단 금지.\n- coreProblems: 현재 기능에 영향을 주는 핵심 어려움 2~4개. clinicalJudgment 복사 금지.\n- strengthsProtection: 검사에서 실제 확인된 강점·보호요인과 그것이 어떤 위험을 완충할 수 있는지.\n- riskFactors: 실제 근거가 있는 위험만. 직접 근거와 추가 확인 필요를 분리.\n- counselingPriorities: 초기 상담에서 먼저 확인하거나 다룰 순서와 이유.\n- counselingStrategies: 위 통합가설과 연결된 구체적 개입 방향.\n- professionalSummary: 앞 내용을 복사하지 말고 '현재 가장 설득력 있는 통합가설 + 반드시 남겨둘 불확실성'을 압축해 종결.\n- cross* 필드: 본문과 동일 문장을 재사용하지 말고 교차분석 구조에 맞춰 별도로 작성.

[섹션 간 구조 강제]
- clinicalJudgment와 caseFormulation은 서로 다른 기능을 가져야 하며 동일한 문장·문단·검사소개 순서를 공유하지 마십시오.
- clinicalJudgment는 '무엇이 핵심인가'에 답하고, caseFormulation은 '그 패턴이 어떤 조건에서 어떻게 나타나고 유지되는가'에 답해야 합니다.
- convergentEvidence와 discrepancies에는 적어도 두 검사명이 모두 등장해야 하며 각 검사 근거가 서로 구분되어 보여야 합니다.
- 검사별 원문을 2문장 이상 연속 복사하지 말고 임상적으로 압축·통합하십시오.

[금지되는 저품질 표현]\n- '전반적으로 안정적입니다'처럼 원자료 근거가 없는 단정\n- '검사마다 측정하는 구성개념이 다릅니다'만으로 차이를 설명\n- 동일한 검사 설명 문단을 clinicalJudgment, caseFormulation, coreProblems, professionalSummary에 반복\n- 검사 간 실제 일치·차이를 밝히지 않은 채 '교차 확인이 필요합니다'로 종료\n- '현재 자동으로 확정하지 않았습니다', '현재 저장된 교차분석에 명시되어 있지 않습니다', '저장된 자료에 없습니다'처럼 시스템 내부 상태를 보고서 문장으로 출력\n\n각 필드는 3~6문장 정도로 충분한 근거와 임상적 연결을 담되 장황하게 반복하지 마십시오. JSON만 반환합니다.`;
}

function makeDirectComprehensivePrompt(body) {
  const tests = (body.tests || []).slice(0, 8).map((test,index) => {
    const name = clean(test?.testType || test?.name || `검사 ${index + 1}`, 100);
    const validity = first(test?.validity, test?.validitySummary, test?.counselorReport?.validity);
    const core = first(test?.coreFindings, test?.counselorReport?.clinicalInterpretation, test?.sourceSummary);
    const strengths = first(test?.strengths, test?.counselorReport?.strengths);
    const risks = first(test?.vulnerabilities, test?.cautions, test?.counselorReport?.risks);
    return [
      `[${name}]`,
      validity && `타당도: ${clean(validity, 500)}`,
      core && `핵심결과: ${clean(core, 1100)}`,
      strengths && `강점: ${clean(strengths, 500)}`,
      risks && `취약·주의: ${clean(risks, 500)}`
    ].filter(Boolean).join('\n');
  }).join('\n\n');

  const names = (body.tests || []).slice(0, 8)
    .map((t,i)=>clean(t?.testType || t?.name || `검사 ${i+1}`,100))
    .filter(Boolean);

  return `당신은 임상심리사 1급 수준의 심리평가 전문가입니다.
아래 검사별 근거를 직접 비교하여 "심리검사 종합보고서"를 만들기 위한 내부 통합근거를 작성하십시오.
이 응답은 30초 제한의 서버 함수에서 사용하므로 각 필드는 2~4문장, 전체는 간결하고 밀도 높게 작성하십시오.

검사 구성: ${names.join(' + ')}

[검사별 근거]
${tests}

[작성 규칙]
1. 검사별 설명을 반복하지 말고 핵심 심리주제로 통합하십시오.
2. convergentEvidence는 공통주제 → 검사별 근거 → 통합 의미 순서로 작성하십시오.
3. discrepancies는 실제 차이 → 검사 A와 B의 근거 → 상태/특성 또는 측정영역 관점의 조건부 설명 순서로 작성하십시오.
4. caseFormulation은 취약요인 → 부담조건 → 심리적 반응 → 유지요인 → 보호요인의 흐름으로 작성하십시오.
5. clinicalJudgment와 caseFormulation은 같은 문장을 재사용하지 마십시오.
6. 위험 근거가 없으면 만들지 말고 직접 근거 없음과 추가 확인 필요를 구분하십시오.
7. 시스템 상태, AI, JSON, 저장 여부, "교차분석이 없다" 같은 문구를 보고서 본문에 쓰지 마십시오.
8. 진단을 확정하지 말고 입력된 검사자료 범위에서만 해석하십시오.
9. JSON만 반환하십시오.`;
}

function directCrossAnalysisFromReport(report = {}) {
  return {
    commonPatterns: clean(report.convergentEvidence, 8000),
    differences: clean(report.discrepancies, 8000),
    stateTrait: clean(report.discrepancies, 6000),
    responseContext: '',
    riskProtection: [clean(report.riskFactors,4000), clean(report.strengthsProtection,4000)].filter(Boolean).join('\n\n'),
    followUpQuestions: '',
    counselingImplications: clean(report.coreProblems, 5000),
    caseIntegration: clean(report.caseFormulation, 8000),
    limitations: clean(report.limitations, 5000)
  };
}

function fallbackReport(body, reason = '') {
  const tests = body.tests || [];
  const cross = body.crossAnalysis || {};
  const names = tests.map((t, i) => clean(t?.testType || t?.name || `검사 ${i + 1}`, 80)).filter(Boolean);
  const evidenceRows = tests.map((t, i) => {
    const name = names[i] || `검사 ${i + 1}`;
    const core = first(t?.coreFindings, t?.sourceSummary, t?.interpretation, t?.counselorReport?.clinicalInterpretation, t?.counselorReport?.summary);
    const valid = first(t?.validity, t?.validitySummary, t?.counselorReport?.validity);
    const strength = first(t?.strengths, t?.counselorReport?.strengths);
    const risk = first(t?.vulnerabilities, t?.cautions, t?.counselorReport?.risks);
    return { name, core: clean(core, 1200), valid: clean(valid, 500), strength: clean(strength, 600), risk: clean(risk, 600) };
  }).filter(row => row.core || row.strength || row.risk);

  const evidenceText = evidenceRows.length
    ? evidenceRows.map(row => `${row.name}: ${row.core || '세부 핵심해석은 상담자 검토가 필요합니다.'}`).join('\n\n')
    : '검사별 분석 자료의 세부 문장이 충분하지 않아 원자료와 면담 내용을 함께 재검토해야 합니다.';

  const common = clean(cross.commonPatterns, 2200);
  const differences = clean(cross.differences, 2200);
  const stateTrait = clean(cross.stateTrait, 2000);
  const responseContext = clean(cross.responseContext, 1800);
  const riskProtection = clean(cross.riskProtection, 1800);
  const counselingImplications = clean(cross.counselingImplications, 1800);
  const caseIntegration = clean(cross.caseIntegration, 2400);
  const followUps = clean(cross.followUpQuestions, 1800);
  const crossLimitations = clean(cross.limitations, 1400);

  const explicitComparison = evidenceRows.length >= 2
    ? `${evidenceRows[0].name}에서는 ${evidenceRows[0].core || '핵심 결과의 상담자 재검토가 필요'}가 확인되며, ${evidenceRows[1].name}에서는 ${evidenceRows[1].core || '핵심 결과의 상담자 재검토가 필요'}가 확인됩니다. ${common ? `두 자료를 함께 보면 ${common}` : '두 결과가 같은 심리적 주제를 지지하는지 또는 서로 다른 측면을 측정한 것인지 원자료와 면담에서 교차확인해야 합니다.'}`
    : evidenceText;

  const strengths = evidenceRows.filter(row => row.strength).map(row => `${row.name}: ${row.strength}`);
  const risks = evidenceRows.filter(row => row.risk).map(row => `${row.name}: ${row.risk}`);

  return {
    title: 'AI 종합해석보고서',
    subtitle: '심리검사 자료를 통합한 상담자용 전문 검토 보고서',
    clinicalJudgment: caseIntegration || explicitComparison,
    convergentEvidence: common || (evidenceRows.length >= 2
      ? `${names.slice(0, 2).join('와 ')}의 핵심 결과를 직접 비교하면 다음과 같습니다. ${explicitComparison} 두 결과가 동일한 심리구성개념을 직접 측정한다고 단정할 수는 없으므로, 문장 수준에서 공통으로 드러나는 정서·관계·자기조절·스트레스 주제가 있는 범위까지만 수렴 근거로 해석합니다.`
      : '현재 입력 자료가 제한적이므로 검사 간 일치 여부를 충분히 판단하기 어렵습니다.'),
    discrepancies: differences || (evidenceRows.length >= 2
      ? `${evidenceRows[0].name}에서는 ${evidenceRows[0].core || '핵심 결과의 추가 확인이 필요합니다.'}가 중심이고, ${evidenceRows[1].name}에서는 ${evidenceRows[1].core || '핵심 결과의 추가 확인이 필요합니다.'}가 중심입니다. 두 기술이 강조하는 영역이 다르므로 이를 곧바로 모순으로 보지 않고, 비교적 지속적인 특성 대 최근 상태, 측정영역의 차이, 검사 시점의 맥락 중 어떤 설명이 자료에 가장 부합하는지 상담자가 원자료와 함께 판단해야 합니다.`
      : '검사 간 차이를 판단할 자료가 충분하지 않습니다.'),
    caseFormulation: caseIntegration || [
      stateTrait && `상태-특성 관점에서는 ${stateTrait}`,
      responseContext && `응답 및 상황 맥락은 ${responseContext}`,
      common && `현재 유지되는 핵심 패턴으로는 ${common}`,
      riskProtection && `위험·보호요인 측면에서는 ${riskProtection}`
    ].filter(Boolean).join('\n') || explicitComparison,
    coreProblems: evidenceRows.filter(row => row.risk).length
      ? evidenceRows.filter(row => row.risk).map(row => `${row.name}에서 확인할 핵심 어려움: ${row.risk}`).join('\n')
      : `현재 기능에 영향을 주는 핵심 어려움은 검사별 근거를 바탕으로 추가 정리가 필요합니다.\n${evidenceRows.map(row => `${row.name}: ${row.core}`).join('\n')}`,
    strengthsProtection: strengths.length
      ? strengths.join('\n') + (riskProtection ? `\n교차분석: ${riskProtection}` : '')
      : (riskProtection || '현재 자료에서 명확히 확인된 보호요인은 제한적입니다. 문제해결 경험, 지지관계, 일상 유지능력, 도움 요청 가능성을 면담에서 확인해야 합니다.'),
    riskFactors: risks.length
      ? risks.join('\n')
      : '현재 입력 자료에서 직접 확인되는 고위험 근거는 명확하지 않습니다. 자해·자살사고, 충동성, 현실검증력 저하, 급격한 기능저하는 면담에서 별도로 재확인해야 합니다.',
    counselingPriorities: counselingImplications || '① 검사 간 공통 패턴과 실제 생활 장면의 일치 여부 확인\n② 검사 간 차이가 있다면 최근 상태와 평소 특성을 구분\n③ 현재 기능 저하와 위험·보호요인 재평가\n④ 변화 목표를 구체적 행동 수준으로 합의',
    counselingStrategies: counselingImplications
      ? `${counselingImplications}\n검사결과는 내담자의 실제 경험과 맞는지 공동 검토하고, 가장 근거가 분명한 영역부터 단계적으로 개입합니다.`
      : '검사 결과를 단정적으로 전달하기보다 내담자의 실제 경험과 맞는지 공동 검토합니다. 정서 조절, 사고 패턴, 관계 장면, 스트레스 관리 중 검사와 면담에서 반복 확인되는 영역부터 단계적으로 개입합니다.',
    followUpQuestions: followUps || '최근 가장 힘든 상황은 무엇이었는가? 그때 어떤 생각·감정·행동이 반복되었는가? 검사에서 나타난 평소 경향과 최근 상태가 실제 생활에서 어떻게 다르게 경험되는가? 일상 기능과 관계에 미친 영향은 어느 정도인가? 회복에 도움이 된 자원은 무엇인가?',
    monitoringPoints: '기분 및 불안 변화, 수면·식사·집중, 회피 또는 충동행동, 관계 갈등, 학업·직업 기능, 안전 관련 변화를 검사 결과와 실제 생활 변화에 맞추어 지속적으로 확인합니다.',
    professionalSummary: `${caseIntegration || common || explicitComparison}${differences ? `\n다만 ${differences}` : ''}${crossLimitations ? `\n해석상 한계: ${crossLimitations}` : ''}`,
    supervisorNote: `이 보고서는 ${reason ? `${clean(reason, 180)}로 인해 ` : ''}저장된 검사별 분석과 교차분석을 기반으로 즉시 구성된 상담자 검토용 초안입니다. 원자료, 타당도, 임상 면담과 행동관찰을 대조하여 문구를 수정한 뒤 사용해야 합니다.`,
    limitations: crossLimitations || '심리검사는 현재 심리상태를 이해하기 위한 하나의 자료이며 단독으로 진단이나 치료 결정을 확정하지 않습니다. 입력되지 않은 원자료, 생활사, 면담 및 행동관찰 정보는 반영되지 않았습니다.',
    crossCommonPatterns: common || (evidenceRows.length >= 2 ? `${evidenceRows[0].name}과 ${evidenceRows[1].name}의 핵심 결과를 직접 대조해 공통으로 반복되는 정서·관계·자기조절·스트레스 주제만 수렴 근거로 채택합니다. ${explicitComparison}` : '단일 검사 자료이므로 검사 간 공통 패턴을 판단하지 않습니다.'),
    crossDifferences: differences || (evidenceRows.length >= 2 ? `${evidenceRows[0].name}의 중심 결과와 ${evidenceRows[1].name}의 중심 결과가 강조하는 영역을 직접 비교하면 차이가 있습니다. 이 차이는 곧바로 모순을 뜻하지 않으며 상태-특성, 측정영역, 응답맥락 중 자료로 지지되는 설명을 우선 검토합니다.` : '단일 검사 자료이므로 검사 간 차이를 판단하지 않습니다.'),
    crossStateTrait: stateTrait || '현재 상태 반응과 비교적 지속적인 기질·성격 특성을 검사 특성과 면담 자료에 따라 구분해 확인해야 합니다.',
    crossResponseContext: responseContext || '검사 시점의 스트레스, 응답 태도, 검사 목적과 측정영역을 함께 검토해야 합니다.',
    crossRiskProtection: riskProtection || (risks.length || strengths.length ? [...risks, ...strengths].join('\n') : '위험·보호요인을 면담에서 재확인해야 합니다.'),
    crossFollowUpQuestions: followUps || '평소 성격적 경향과 최근 상태의 차이, 반복되는 스트레스 장면, 일상 기능 변화, 관계 갈등, 회복자원, 안전 관련 위험 신호를 구체적으로 확인합니다.',
    crossCounselingImplications: counselingImplications || '검사 간 반복되는 패턴을 초기 상담의 우선 가설로 사용하되 실제 경험과 맞는지 공동 검토합니다.',
    crossCaseIntegration: caseIntegration || explicitComparison,
    crossLimitations: crossLimitations || '검사 간 통합은 입력된 검사자료 범위 안에서만 가능하며 생활사·면담·행동관찰과 함께 최종 판단해야 합니다.'
  };
}

function normalizeGeminiJsonText(value = '') {
  let text = String(value || '').replace(/^\uFEFF/, '').trim();
  text = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();

  // Keep only the first complete top-level JSON object/array when explanatory text leaks around it.
  const firstObject = text.search(/[\{\[]/);
  if (firstObject > 0) text = text.slice(firstObject);

  let depth = 0;
  let inString = false;
  let escaped = false;
  let endIndex = -1;
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (ch === '\\') escaped = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') {
      inString = true;
      continue;
    }
    if (ch === '{' || ch === '[') depth += 1;
    else if (ch === '}' || ch === ']') {
      depth -= 1;
      if (depth === 0) {
        endIndex = i;
        break;
      }
    }
  }
  if (endIndex >= 0) text = text.slice(0, endIndex + 1);
  return text.trim();
}

function parseGeminiJson(value = '', finishReason = '') {
  const normalized = normalizeGeminiJsonText(value);
  if (!normalized) throw new Error('Gemini JSON 응답이 비어 있습니다.');

  try {
    return JSON.parse(normalized);
  } catch (error) {
    const reason = String(finishReason || '').toUpperCase();
    const likelyTruncated = reason.includes('MAX_TOKENS')
      || /unterminated string|unexpected end of json|end of data/i.test(String(error?.message || ''));
    const detail = clean(error?.message || 'JSON 파싱 실패', 220);
    const tagged = new Error(likelyTruncated
      ? `Gemini JSON 응답이 끝까지 생성되지 않았습니다 (${reason || 'finishReason 미확인'}): ${detail}`
      : `Gemini JSON 형식 오류 (${reason || 'finishReason 미확인'}): ${detail}`);
    tagged.code = likelyTruncated ? 'GEMINI_JSON_TRUNCATED' : 'GEMINI_JSON_INVALID';
    tagged.finishReason = reason || '';
    throw tagged;
  }
}

async function callGemini(apiKey, text, options = {}) {
  const schema = options.schema || SCHEMA;
  const timeoutMs = Number(options.timeoutMs) || 45000;
  const maxOutputTokens = Number(options.maxOutputTokens) || 8192;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(MODEL)}:generateContent?key=${encodeURIComponent(apiKey)}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text }] }],
          generationConfig: {
            temperature: 0.08,
            topP: 0.78,
            maxOutputTokens,
            responseMimeType: 'application/json',
            responseSchema: schema
          }
        })
      }
    );

    const data = await response.json().catch(() => ({}));
    const candidate = data?.candidates?.[0] || null;
    const finishReason = String(candidate?.finishReason || '');
    const output = candidate?.content?.parts?.map(part => part?.text || '').join('\n').trim();

    if (!response.ok) {
      throw new Error(data?.error?.message || `AI 호출 실패 (${response.status})`);
    }
    if (!output) {
      const reason = finishReason ? ` · finishReason=${finishReason}` : '';
      throw new Error(`Gemini가 JSON 본문을 반환하지 않았습니다${reason}`);
    }

    return parseGeminiJson(output, finishReason);
  } finally {
    clearTimeout(timer);
  }
}


function hasEvasiveCrossAnalysisLanguage(value = '') {
  const s = clean(value, 12000);
  return /자동으로 확정하지|저장된 교차분석|저장된 자료에|교차\s*확인이 필요|명시되어 있지 않/.test(s);
}

function normalizeForSimilarity(value = '') {
  return clean(value, 20000)
    .replace(/\s+/g, ' ')
    .replace(/[.,!?·:;()\[\]{}'"“”‘’]/g, '')
    .trim();
}

function tokenSet(value = '') {
  return new Set(normalizeForSimilarity(value).split(' ').filter(token => token.length >= 2));
}

function similarity(a, b) {
  const A = tokenSet(a); const B = tokenSet(b);
  if (!A.size || !B.size) return 0;
  let overlap = 0;
  A.forEach(token => { if (B.has(token)) overlap += 1; });
  return overlap / Math.min(A.size, B.size);
}

function validateIntegratedReport(report = {}, body = {}) {
  const issues = [];
  const names = (body.tests || []).map((t, i) => clean(t?.testType || t?.name || `검사 ${i + 1}`, 100)).filter(Boolean);
  const multi = names.length >= 2;
  const coreFields = ['clinicalJudgment','convergentEvidence','discrepancies','caseFormulation','coreProblems','professionalSummary'];
  const genericPatterns = [
    /검사마다 측정(?:하는)? (?:구성개념|영역).*다르/,
    /교차 ?확인(?:이)? 필요/,
    /추가 검사자료와 면담 정보가 필요/,
    /결과 차이는 곧 오류를 의미하지 않/
  ];

  coreFields.forEach(key => {
    const text = clean(report[key], 12000);
    if (text.length < 90) issues.push(`${key}: 내용이 너무 짧음`);
  });

  if (multi) {
    ['clinicalJudgment','convergentEvidence','discrepancies','caseFormulation'].forEach(key => {
      const text = clean(report[key], 12000);
      const mentioned = names.filter(name => text.includes(name));
      if (!mentioned.length) issues.push(`${key}: 실제 검사명이 명시되지 않음`);
    });
    const convergent = clean(report.convergentEvidence, 12000);
    if (names.filter(name => convergent.includes(name)).length < Math.min(2, names.length)) {
      issues.push('convergentEvidence: 두 검사 이상의 구체적 근거 연결이 부족함');
    }
  }

  for (let i = 0; i < coreFields.length; i += 1) {
    for (let j = i + 1; j < coreFields.length; j += 1) {
      const a = clean(report[coreFields[i]], 12000);
      const b = clean(report[coreFields[j]], 12000);
      if (a.length > 120 && b.length > 120 && similarity(a, b) >= 0.72) {
        issues.push(`${coreFields[i]} ↔ ${coreFields[j]}: 내용 반복 가능성`);
      }
    }
  }

  const judgment = clean(report.clinicalJudgment, 12000);
  const formulation = clean(report.caseFormulation, 12000);
  if (judgment.length > 120 && formulation.length > 120 && similarity(judgment, formulation) >= 0.52) {
    issues.push('clinicalJudgment ↔ caseFormulation: 역할 중복으로 자동 재작성 필요');
  }
  if (/MMPI-2.*TCI|TCI.*MMPI-2/.test(judgment) && /MMPI-2.*TCI|TCI.*MMPI-2/.test(formulation) && similarity(judgment, formulation) >= 0.42) {
    issues.push('clinicalJudgment ↔ caseFormulation: 동일한 검사소개 순서 반복');
  }

  const discrepancy = clean(report.discrepancies, 12000);
  if (genericPatterns.some(pattern => pattern.test(discrepancy)) && discrepancy.length < 280) {
    issues.push('discrepancies: 실제 검사 간 차이보다 일반론 중심');
  }
  ['convergentEvidence','discrepancies','caseFormulation','crossCommonPatterns','crossDifferences'].forEach(key => {
    if (hasEvasiveCrossAnalysisLanguage(report[key])) {
      issues.push(`${key}: 시스템 상태/회피형 교차해석 문구가 포함됨`);
    }
  });
  return [...new Set(issues)].slice(0, 12);
}

function needsStructuralRepair(report = {}, body = {}, issues = []) {
  const judgment = clean(report.clinicalJudgment, 14000);
  const formulation = clean(report.caseFormulation, 14000);
  const convergent = clean(report.convergentEvidence, 14000);
  const discrepancy = clean(report.discrepancies, 14000);
  const names = (body.tests || []).map((t, i) => clean(t?.testType || t?.name || `검사 ${i + 1}`, 100)).filter(Boolean);
  const multi = names.length >= 2;
  if (judgment.length > 120 && formulation.length > 120 && similarity(judgment, formulation) >= 0.52) return true;
  if (issues.some(issue => /내용 반복|역할 중복|동일한 검사소개|일반론|회피형|구체적 근거 연결/.test(issue))) return true;
  if (multi && names.filter(name => convergent.includes(name)).length < 2) return true;
  if (multi && names.filter(name => discrepancy.includes(name)).length < 2) return true;
  return false;
}

function makeRepairPrompt(body, draft, issues = []) {
  const evidence = (body.tests || []).slice(0, 10).map(compactTest).join('\n\n');
  const names = (body.tests || []).slice(0, 10).map((t, i) => clean(t?.testType || t?.name || `검사 ${i + 1}`, 100)).filter(Boolean);
  const current = {
    clinicalJudgment: clean(draft.clinicalJudgment, 5000), convergentEvidence: clean(draft.convergentEvidence, 5000),
    discrepancies: clean(draft.discrepancies, 5000), caseFormulation: clean(draft.caseFormulation, 5000),
    coreProblems: clean(draft.coreProblems, 3500), professionalSummary: clean(draft.professionalSummary, 3500)
  };
  return `당신은 임상심리사 1급 수준의 심리평가 전문가입니다. 아래 초안은 구조 중복 또는 교차해석 품질 문제로 자동 재작성 대상이 되었습니다. 검사별 근거자료만 사용하여 6개 핵심 필드를 다시 작성하십시오. JSON만 반환하십시오.\n\n검사 구성: ${names.join(' + ')}\n\n[검사별 근거자료]\n${evidence}\n\n[현재 초안]\n${clean(JSON.stringify(current), 15000)}\n\n[자동 품질검사 지적]\n${issues.join(' / ') || '종합 임상판단과 사례개념화의 구조 중복'}\n\n[재작성 규칙]\n1. clinicalJudgment는 무엇이 핵심인가만 3~4개 통합 주제로 작성하고 검사별 소개 순서나 인과과정 설명을 쓰지 마십시오.\n2. convergentEvidence는 공통주제 → ${names[0] || '검사 A'} 근거 → ${names[1] || '검사 B'} 근거 → 통합 의미 구조로 1~3개 작성하십시오.\n3. discrepancies는 차이점 → 검사 A 근거 ↔ 검사 B 근거 → 상태/특성·측정영역·응답맥락 중 근거 있는 설명 구조를 지키십시오.\n4. caseFormulation은 검사 설명을 반복하지 말고 반드시 취약요인 → 부담조건 → 심리적 반응 → 유지요인 → 보호요인/현재기능의 흐름으로 하나의 임상가설을 작성하십시오.\n5. clinicalJudgment와 caseFormulation에서 같은 문장이나 같은 문단 순서를 재사용하지 말고 어휘와 문장 구조도 의도적으로 다르게 하십시오.\n6. coreProblems는 현재 기능에 영향을 주는 어려움 2~4개만 압축하고 professionalSummary는 가장 설득력 있는 통합가설과 남은 불확실성만 종결 요약하십시오.\n7. 원자료 문장을 길게 복사하지 말고 근거를 압축해서 해석하십시오. 진단을 확정하거나 자료에 없는 사건을 만들지 마십시오.`;
}

async function repairIntegratedReport(apiKey, body, draft, issues) {
  const repaired = await callGemini(apiKey, makeRepairPrompt(body, draft, issues), { schema: REPAIR_SCHEMA, timeoutMs: 25000, maxOutputTokens: 4096 });
  return { ...draft, ...repaired };
}

function crossAnalysisFromReport(report = {}) {
  return {
    commonPatterns: clean(report.crossCommonPatterns, 16000),
    differences: clean(report.crossDifferences, 16000),
    stateTrait: clean(report.crossStateTrait, 16000),
    responseContext: clean(report.crossResponseContext, 16000),
    riskProtection: clean(report.crossRiskProtection, 16000),
    followUpQuestions: clean(report.crossFollowUpQuestions, 16000),
    counselingImplications: clean(report.crossCounselingImplications, 16000),
    caseIntegration: clean(report.crossCaseIntegration, 16000),
    limitations: clean(report.crossLimitations, 16000)
  };
}

function stripCrossFields(report = {}) {
  const cleaned = { ...report };
  ['crossCommonPatterns','crossDifferences','crossStateTrait','crossResponseContext','crossRiskProtection','crossFollowUpQuestions','crossCounselingImplications','crossCaseIntegration','crossLimitations'].forEach(key => delete cleaned[key]);
  return cleaned;
}

export const handler = async (event) => {
  const startedAt = Date.now();
  if (event.httpMethod === 'OPTIONS') return json({}, 200);
  if (event.httpMethod !== 'POST') return json({ error: 'POST 요청만 지원합니다.' }, 405);

  let body = {};
  try {
    body = JSON.parse(event.body || '{}');
  } catch {
    return json({ error: '요청 데이터 형식이 올바르지 않습니다.' }, 400);
  }

  if (!Array.isArray(body.tests) || !body.tests.length) {
    return json({ error: '검사별 분석 자료가 없습니다.' }, 400);
  }

  const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || process.env.GOOGLE_GEMINI_API_KEY;
  if (!apiKey) {
    const fallback = fallbackReport(body, 'API 키 미설정');
    return json({
      report: stripCrossFields(fallback),
      crossAnalysis: crossAnalysisFromReport(fallback),
      model: 'local-fallback',
      promptVersion: directMode ? 'mml-direct-comprehensive-v1-compact-30s' : 'mml-clinician-integrated-v9-json-safe-parser',
      qualityChecked: false,
      qualityIssues: ['GEMINI_API_KEY가 없어 저장된 검사별 분석으로 초안을 구성했습니다.'],
      repaired: false,
      fallback: true,
      diagnostics: {
        geminiCalled: false,
        geminiSucceeded: false,
        fallbackUsed: true,
        repairNeeded: false,
        repairAttempted: false,
        repairSucceeded: false,
        elapsedMs: Date.now() - startedAt,
        reason: 'API 키 미설정'
      }
    }, 200);
  }

  try {
    const directMode = String(body.mode || '') === 'direct-comprehensive';
    let generated = await callGemini(
      apiKey,
      directMode ? makeDirectComprehensivePrompt(body) : makePrompt(body),
      directMode
        ? { schema: DIRECT_COMPREHENSIVE_SCHEMA, timeoutMs: 25000, maxOutputTokens: 4096 }
        : { timeoutMs: 25000, maxOutputTokens: 8192 }
    );
    let qualityIssues = validateIntegratedReport(generated, body);
    let repaired = false;
    const repairNeeded = directMode ? false : needsStructuralRepair(generated, body, qualityIssues);
    let repairAttempted = false;
    let repairSucceeded = false;
    let repairErrorMessage = '';

    if (repairNeeded) {
      repairAttempted = true;
      try {
        generated = await repairIntegratedReport(apiKey, body, generated, qualityIssues);
        repaired = true;
        repairSucceeded = true;
        qualityIssues = validateIntegratedReport(generated, body);
      } catch (repairError) {
        repairErrorMessage = clean(repairError?.message || repairError, 240);
        console.warn('[MML CLINICIAN INTEGRATED REPAIR]', repairErrorMessage);
        qualityIssues = [...new Set([...qualityIssues, '자동 재작성 시도가 완료되지 않아 상담자 검토가 필요합니다.'])].slice(0, 12);
      }
    }

    return json({
      report: stripCrossFields(generated),
      crossAnalysis: directMode ? directCrossAnalysisFromReport(generated) : crossAnalysisFromReport(generated),
      model: MODEL,
      promptVersion: 'mml-clinician-integrated-v9-json-safe-parser',
      qualityChecked: qualityIssues.length === 0,
      qualityIssues,
      repaired,
      fallback: false,
      diagnostics: {
        geminiCalled: true,
        geminiSucceeded: true,
        fallbackUsed: false,
        repairNeeded,
        repairAttempted,
        repairSucceeded,
        repairError: repairErrorMessage,
        elapsedMs: Date.now() - startedAt,
        finalQualityIssueCount: qualityIssues.length
      }
    });
  } catch (error) {
    console.error('[MML CLINICIAN INTEGRATED]', error);
    // AI 지연·일시 오류가 있어도 화면에는 본문이 있는 초안을 반환합니다.
    const fallback = fallbackReport(body, error?.name === 'AbortError' ? 'AI 응답 시간 초과' : clean(error?.message, 220));
    return json({
      report: stripCrossFields(fallback),
      crossAnalysis: crossAnalysisFromReport(fallback),
      model: 'local-fallback',
      promptVersion: 'mml-clinician-integrated-v9-json-safe-parser',
      qualityChecked: false,
      qualityIssues: [error?.name === 'AbortError'
        ? 'AI 응답이 45초 제한을 초과하여 저장된 검사별 분석으로 초안을 구성했습니다.'
        : `AI 응답 처리 오류로 저장된 검사별 분석으로 초안을 구성했습니다: ${clean(error?.message, 220)}`],
      repaired: false,
      fallback: true,
      diagnostics: {
        geminiCalled: true,
        geminiSucceeded: false,
        fallbackUsed: true,
        repairNeeded: false,
        repairAttempted: false,
        repairSucceeded: false,
        elapsedMs: Date.now() - startedAt,
        reason: error?.name === 'AbortError' ? 'AI 응답 시간 초과' : clean(error?.message, 240)
      }
    }, 200);
  }
};
