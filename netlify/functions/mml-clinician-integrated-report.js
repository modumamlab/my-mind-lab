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
    limitations: { type: 'STRING' }
  },
  required: [
    'title', 'subtitle', 'clinicalJudgment', 'convergentEvidence', 'discrepancies',
    'caseFormulation', 'coreProblems', 'strengthsProtection', 'riskFactors',
    'counselingPriorities', 'counselingStrategies', 'followUpQuestions',
    'monitoringPoints', 'professionalSummary', 'supervisorNote', 'limitations'
  ]
};

function compactTest(test, index) {
  const type = clean(test?.testType || test?.name || `검사 ${index + 1}`, 100);
  const validity = first(test?.validity, test?.validitySummary, test?.counselorReport?.validity);
  const findings = first(
    test?.coreFindings,
    test?.sourceSummary,
    test?.interpretation,
    test?.counselorReport?.summary,
    test?.counselorReport?.clinicalInterpretation
  );
  const strengths = first(test?.strengths, test?.counselorReport?.strengths);
  const vulnerabilities = first(test?.vulnerabilities, test?.cautions, test?.counselorReport?.risks);
  const hypotheses = first(test?.caseHypotheses, test?.counselorReport?.caseFormulation);

  return [
    `[${index + 1}. ${type}]`,
    validity && `타당도: ${clean(validity, 700)}`,
    findings && `핵심결과: ${clean(findings, 1800)}`,
    strengths && `강점: ${clean(strengths, 650)}`,
    vulnerabilities && `취약·주의: ${clean(vulnerabilities, 650)}`,
    hypotheses && `사례가설: ${clean(hypotheses, 650)}`
  ].filter(Boolean).join('\n');
}

function makePrompt(body) {
  const tests = body.tests.slice(0, 10).map(compactTest).join('\n\n');
  const cross = clean(JSON.stringify(body.crossAnalysis || {}), 2500) || '제공되지 않음';

  return `당신은 임상심리사 1급 수준의 심리평가 전문가입니다. 제공된 자료만 근거로 상담자 검토용 AI 종합해석보고서를 작성하십시오. 내담자용 설명문이 아닙니다.\n\n프로그램: ${clean(body.program, 120)}\n\n검사별 자료:\n${tests}\n\n교차분석:\n${cross}\n\n원칙:\n1) 진단을 확정하지 말고 가설과 근거를 구분합니다.\n2) 검사 간 일치·차이는 검사명을 밝혀 구체적으로 씁니다.\n3) 사례개념화는 취약·촉발·유지·보호·현재 기능을 연결합니다.\n4) 위험 근거가 없으면 면담 재확인이 필요하다고 씁니다.\n5) 각 필드는 핵심 문장 2~5개로 작성하고 중복을 피합니다.\n6) 개인정보, 점수 나열, 위로 문구, AI 안내문은 넣지 않습니다.\n7) JSON만 반환합니다.`;
}

function fallbackReport(body, reason = '') {
  const tests = body.tests || [];
  const names = tests.map((t, i) => clean(t?.testType || t?.name || `검사 ${i + 1}`, 80)).filter(Boolean);
  const findings = tests.map((t, i) => {
    const name = names[i] || `검사 ${i + 1}`;
    const text = first(t?.coreFindings, t?.sourceSummary, t?.interpretation, t?.counselorReport?.summary);
    return text ? `${name}: ${clean(text, 900)}` : '';
  }).filter(Boolean);
  const strengths = tests.map(t => first(t?.strengths, t?.counselorReport?.strengths)).filter(Boolean);
  const risks = tests.map(t => first(t?.vulnerabilities, t?.cautions, t?.counselorReport?.risks)).filter(Boolean);

  const evidenceText = findings.length
    ? findings.join('\n\n')
    : '검사별 분석 자료의 세부 문장이 충분하지 않아 원자료와 면담 내용을 함께 재검토해야 합니다.';

  return {
    title: 'AI 종합해석보고서',
    subtitle: '심리검사 자료를 통합한 상담자용 전문 검토 보고서',
    clinicalJudgment: evidenceText,
    convergentEvidence: findings.length > 1
      ? `현재 입력된 ${names.join(', ')} 결과에서 반복적으로 나타나는 정서·사고·관계·스트레스 관련 특징을 중심으로 교차 확인이 필요합니다. 각 검사에서 공통으로 관찰되는 내용은 단일 검사 결과보다 상대적으로 신뢰도 높은 가설로 검토할 수 있습니다.`
      : '현재 입력 자료가 제한적이므로 검사 간 일치 여부를 충분히 판단하기 어렵습니다. 추가 검사자료와 면담 정보가 필요합니다.',
    discrepancies: '검사마다 측정하는 구성개념과 응답 방식이 다르므로 결과 차이는 곧 오류를 의미하지 않습니다. 상황적 영향, 자기보고 방식, 방어 수준, 검사 시점의 상태를 면담에서 확인해야 합니다.',
    caseFormulation: `현재 자료에서는 ${findings[0] ? clean(findings[0], 1200) : '주요 심리적 특징'}을 중심 가설로 둘 수 있습니다. 이러한 특성이 스트레스 상황에서 강화되고 일상 기능이나 관계 방식에 영향을 미치는지 확인하며, 강점과 지지자원이 이를 어떻게 완충하는지 함께 평가해야 합니다.`,
    coreProblems: evidenceText,
    strengthsProtection: strengths.length
      ? strengths.map((v, i) => `${i + 1}. ${clean(v, 700)}`).join('\n')
      : '현재 자료에서 명확히 확인된 보호요인은 제한적입니다. 문제해결 경험, 지지관계, 일상 유지능력, 도움 요청 가능성을 면담에서 확인해야 합니다.',
    riskFactors: risks.length
      ? risks.map((v, i) => `${i + 1}. ${clean(v, 700)}`).join('\n')
      : '현재 자료에서 뚜렷한 고위험 근거는 확인되지 않으나, 자해·자살사고, 충동성, 현실검증력 저하, 급격한 기능저하는 면담에서 반드시 재확인해야 합니다.',
    counselingPriorities: '① 현재 호소문제와 기능 저하 정도 확인\n② 검사에서 반복되는 정서·사고·관계 패턴의 실제 생활 맥락 확인\n③ 위험요인과 보호요인 재평가\n④ 변화 목표를 구체적 행동 수준으로 합의',
    counselingStrategies: '검사 결과를 단정적으로 전달하기보다 내담자의 실제 경험과 맞는지 공동 검토합니다. 정서 조절, 사고 패턴 점검, 관계 장면의 반복 양상, 스트레스 관리 중 근거가 가장 분명한 영역부터 단계적으로 개입합니다.',
    followUpQuestions: '최근 가장 힘든 상황은 무엇이었는가? 그때 어떤 생각·감정·행동이 반복되었는가? 일상 기능과 관계에 미친 영향은 어느 정도인가? 증상을 완화하거나 버티게 한 자원은 무엇인가?',
    monitoringPoints: '기분 및 불안 변화, 수면·식사·집중, 회피 또는 충동행동, 관계 갈등, 학업·직업 기능, 자해·자살사고와 같은 안전 관련 변화를 지속적으로 확인합니다.',
    professionalSummary: evidenceText,
    supervisorNote: `이 보고서는 AI 호출 지연으로 검사별 저장 분석을 기반으로 즉시 구성된 초안입니다${reason ? ` (${clean(reason, 180)})` : ''}. 상담자는 원자료, 타당도, 임상 면담과 행동관찰을 대조하여 문구를 수정한 뒤 사용해야 합니다.`,
    limitations: '심리검사는 현재 심리상태를 이해하기 위한 하나의 자료이며 단독으로 진단이나 치료 결정을 확정하지 않습니다. 입력되지 않은 원자료, 생활사, 면담 및 행동관찰 정보는 반영되지 않았습니다.'
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
    return json({
      report: fallbackReport(body, 'API 키 미설정'),
      model: 'local-fallback',
      promptVersion: 'mml-clinician-integrated-v2',
      qualityChecked: false,
      qualityIssues: ['GEMINI_API_KEY가 없어 저장된 검사별 분석으로 초안을 구성했습니다.'],
      fallback: true
    }, 200);
  }

  try {
    const report = await callGemini(apiKey, makePrompt(body));
    return json({
      report,
      model: MODEL,
      promptVersion: 'mml-clinician-integrated-v2',
      qualityChecked: true,
      qualityIssues: [],
      fallback: false
    });
  } catch (error) {
    console.error('[MML CLINICIAN INTEGRATED]', error);
    // AI 지연·일시 오류가 있어도 화면에는 본문이 있는 초안을 반환합니다.
    return json({
      report: fallbackReport(body, error?.name === 'AbortError' ? 'AI 응답 시간 초과' : clean(error?.message, 220)),
      model: 'local-fallback',
      promptVersion: 'mml-clinician-integrated-v2',
      qualityChecked: false,
      qualityIssues: [error?.name === 'AbortError'
        ? 'AI 응답이 22초를 초과하여 저장된 검사별 분석으로 초안을 구성했습니다.'
        : `AI 호출 오류로 저장된 검사별 분석으로 초안을 구성했습니다: ${clean(error?.message, 180)}`],
      fallback: true
    }, 200);
  }
};
