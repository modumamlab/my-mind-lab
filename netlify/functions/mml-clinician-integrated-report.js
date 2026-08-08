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

  return `당신은 임상심리사 1급 수준의 심리평가 전문가입니다. 제공된 자료만 근거로 상담자 검토용 AI 종합해석보고서를 작성하십시오. 내담자용 설명문이 아니라 전문가가 검토·수정하는 임상 통합 초안입니다.\n\n프로그램: ${clean(body.program, 120)}\n검사 구성: ${testNames.join(' + ')}\n\n[검사별 근거자료]\n${tests}\n\n[기존 교차분석]\n${cross}\n\n[가장 중요한 작성 원칙]\n1. 검사별 내용을 차례로 요약한 뒤 끝내지 마십시오. 반드시 '검사 A에서는 무엇이 확인되고, 검사 B에서는 무엇이 확인되며, 두 자료가 함께 무엇을 지지하는지'를 연결해서 해석하십시오.\n2. 두 개 이상의 검사가 있는 경우 clinicalJudgment, convergentEvidence, discrepancies, caseFormulation에는 실제 검사명을 최소 1회 이상 명시하십시오.\n3. TCI/JTCI는 비교적 지속적인 기질·성격 및 자기조절·대인관계 경향의 근거로, MMPI-2/PAI는 타당도 범위 안에서 현재 임상적·정서적 상태와 증상 표현의 근거로 우선 해석하십시오. 단, 입력자료가 이를 뒷받침할 때만 사용하십시오.\n4. SCT·HTP 같은 개방형·투사적 자료는 가설 생성 자료로만 쓰고 단독 결론을 내리지 마십시오.\n5. '검사마다 측정영역이 다르다', '면담에서 확인이 필요하다' 같은 일반론만으로 섹션을 채우지 마십시오. 반드시 어떤 결과가 어떻게 달랐는지를 먼저 쓰고, 그 다음 가능한 설명을 제시하십시오.\n6. 상태-특성 구분은 추상적으로 말하지 말고, 어느 검사 결과가 비교적 지속적 특성을 시사하고 어느 결과가 최근 상태를 시사하는지 구체적으로 연결하십시오.\n7. 사례개념화는 취약요인 → 부담이 커지기 쉬운 조건 → 유지요인 → 보호요인 → 현재 기능의 순서로 하나의 인과적 가설을 만드십시오. 실제 사건은 창작하지 마십시오.\n8. 위험 근거가 없으면 위험을 만들어내지 말고 '현재 자료에서 직접 근거 없음 / 면담 재확인 필요'로 구분하십시오.\n9. 각 섹션의 역할을 엄격히 분리하십시오. 같은 문장이나 같은 요약을 여러 필드에 재사용하지 마십시오.\n10. 개인정보, 점수 나열, 위로 문구, AI 안내문은 넣지 않습니다. 진단을 확정하지 않고 사실·검사해석·임상가설을 구분합니다.\n\n[필드별 역할]\n- clinicalJudgment: 전체 검사에서 가장 중요한 3~5개 임상 주제를 통합한 최종 판단. 검사별 나열 금지.\n- convergentEvidence: 최소 2개 검사에서 같은 방향으로 지지되는 내용만. '검사명 → 근거 → 통합 의미' 형식.\n- discrepancies: 실제로 다르게 나타난 결과를 먼저 제시한 뒤 상태/특성, 측정영역, 응답맥락 등 가능한 설명을 조건부로 제시. 차이가 없다면 '뚜렷한 불일치 없음'과 그 근거를 명시.\n- caseFormulation: 취약·부담조건·유지·보호·현재기능을 연결한 하나의 사례가설.\n- coreProblems: 현재 기능에 영향을 주는 핵심 어려움 2~4개. clinicalJudgment 복사 금지.\n- strengthsProtection: 검사에서 실제 확인된 강점·보호요인과 그것이 어떤 위험을 완충할 수 있는지.\n- riskFactors: 실제 근거가 있는 위험만. 직접 근거와 추가 확인 필요를 분리.\n- counselingPriorities: 초기 상담에서 먼저 확인하거나 다룰 순서와 이유.\n- counselingStrategies: 위 통합가설과 연결된 구체적 개입 방향.\n- professionalSummary: 앞 내용을 복사하지 말고 '현재 가장 설득력 있는 통합가설 + 반드시 남겨둘 불확실성'을 압축해 종결.\n- cross* 필드: 본문과 동일 문장을 재사용하지 말고 교차분석 구조에 맞춰 별도로 작성.\n\n[금지되는 저품질 표현]\n- '전반적으로 안정적입니다'처럼 원자료 근거가 없는 단정\n- '검사마다 측정하는 구성개념이 다릅니다'만으로 차이를 설명\n- 동일한 검사 설명 문단을 clinicalJudgment, caseFormulation, coreProblems, professionalSummary에 반복\n- 검사 간 실제 일치·차이를 밝히지 않은 채 '교차 확인이 필요합니다'로 종료\n\n각 필드는 3~6문장 정도로 충분한 근거와 임상적 연결을 담되 장황하게 반복하지 마십시오. JSON만 반환합니다.`;
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
      ? `${names.slice(0, 2).join('와 ')}의 결과에서 같은 방향으로 지지되는 주제는 현재 자동으로 확정하지 않았습니다. 각 검사에서 확인된 핵심 결과는 다음과 같으며, 공통되는 부분만 상담자가 원자료와 대조해 통합 근거로 사용해야 합니다.\n${explicitComparison}`
      : '현재 입력 자료가 제한적이므로 검사 간 일치 여부를 충분히 판단하기 어렵습니다.'),
    discrepancies: differences || (evidenceRows.length >= 2
      ? `${evidenceRows[0].name}과 ${evidenceRows[1].name}에서 서로 다르게 나타난 구체적 결과는 현재 저장된 교차분석에 명시되어 있지 않습니다. 두 검사 결과를 단순히 동일한 의미로 합치지 말고, 실제 차이가 있는지 먼저 확인한 뒤 상태-특성·측정영역·응답맥락 차이로 설명 가능한지 검토해야 합니다.`
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
    crossCommonPatterns: common || '현재 저장된 교차분석에서 명확한 공통 패턴이 확인되지 않았습니다.',
    crossDifferences: differences || '현재 저장된 교차분석에서 구체적인 검사 간 차이가 정리되지 않았습니다. 차이 유무를 원자료에서 먼저 확인해야 합니다.',
    crossStateTrait: stateTrait || '현재 상태 반응과 비교적 지속적인 기질·성격 특성을 검사 특성과 면담 자료에 따라 구분해 확인해야 합니다.',
    crossResponseContext: responseContext || '검사 시점의 스트레스, 응답 태도, 검사 목적과 측정영역을 함께 검토해야 합니다.',
    crossRiskProtection: riskProtection || (risks.length || strengths.length ? [...risks, ...strengths].join('\n') : '위험·보호요인을 면담에서 재확인해야 합니다.'),
    crossFollowUpQuestions: followUps || '평소 성격적 경향과 최근 상태의 차이, 반복되는 스트레스 장면, 일상 기능 변화, 관계 갈등, 회복자원, 안전 관련 위험 신호를 구체적으로 확인합니다.',
    crossCounselingImplications: counselingImplications || '검사 간 반복되는 패턴을 초기 상담의 우선 가설로 사용하되 실제 경험과 맞는지 공동 검토합니다.',
    crossCaseIntegration: caseIntegration || explicitComparison,
    crossLimitations: crossLimitations || '검사 간 통합은 입력된 검사자료 범위 안에서만 가능하며 생활사·면담·행동관찰과 함께 최종 판단해야 합니다.'
  };
}
async function callGemini(apiKey, text) {
  // Netlify Dev 함수 제한(30초)보다 먼저 종료하여 500 타임아웃을 방지합니다.
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 22000);

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
            temperature: 0.12,
            topP: 0.8,
            maxOutputTokens: 4096,
            responseMimeType: 'application/json',
            responseSchema: SCHEMA
          }
        })
      }
    );

    const data = await response.json().catch(() => ({}));
    const output = data?.candidates?.[0]?.content?.parts?.map(part => part.text || '').join('\n').trim();
    if (!response.ok || !output) {
      throw new Error(data?.error?.message || `AI 호출 실패 (${response.status})`);
    }

    return JSON.parse(output.replace(/^```json\s*/i, '').replace(/```$/i, '').trim());
  } finally {
    clearTimeout(timer);
  }
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

  const discrepancy = clean(report.discrepancies, 12000);
  if (genericPatterns.some(pattern => pattern.test(discrepancy)) && discrepancy.length < 280) {
    issues.push('discrepancies: 실제 검사 간 차이보다 일반론 중심');
  }
  return [...new Set(issues)].slice(0, 12);
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
      promptVersion: 'mml-clinician-integrated-v4-cross-evidence',
      qualityChecked: false,
      qualityIssues: ['GEMINI_API_KEY가 없어 저장된 검사별 분석으로 초안을 구성했습니다.'],
      fallback: true
    }, 200);
  }

  try {
    const generated = await callGemini(apiKey, makePrompt(body));
    const qualityIssues = validateIntegratedReport(generated, body);
    return json({
      report: stripCrossFields(generated),
      crossAnalysis: crossAnalysisFromReport(generated),
      model: MODEL,
      promptVersion: 'mml-clinician-integrated-v4-cross-evidence',
      qualityChecked: qualityIssues.length === 0,
      qualityIssues,
      fallback: false
    });
  } catch (error) {
    console.error('[MML CLINICIAN INTEGRATED]', error);
    // AI 지연·일시 오류가 있어도 화면에는 본문이 있는 초안을 반환합니다.
    const fallback = fallbackReport(body, error?.name === 'AbortError' ? 'AI 응답 시간 초과' : clean(error?.message, 220));
    return json({
      report: stripCrossFields(fallback),
      crossAnalysis: crossAnalysisFromReport(fallback),
      model: 'local-fallback',
      promptVersion: 'mml-clinician-integrated-v4-cross-evidence',
      qualityChecked: false,
      qualityIssues: [error?.name === 'AbortError'
        ? 'AI 응답이 22초를 초과하여 저장된 검사별 분석으로 초안을 구성했습니다.'
        : `AI 호출 오류로 저장된 검사별 분석으로 초안을 구성했습니다: ${clean(error?.message, 180)}`],
      fallback: true
    }, 200);
  }
};
