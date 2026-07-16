const jsonResponse = (obj, statusCode = 200) => ({
  statusCode,
  headers: {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json; charset=utf-8'
  },
  body: JSON.stringify(obj)
});

const clean = (value, max = 18000) => String(value || '').trim().slice(0, max);

const REPORT_FIELDS = [
  'title',
  'subtitle',
  'evaluationOverview',
  'testGuide',
  'keyMessage',
  'emotionalProfile',
  'thinkingStyle',
  'relationshipStyle',
  'stressRecovery',
  'strengthsResources',
  'integratedUnderstanding',
  'currentSignals',
  'psychologicalSuggestions',
  'professionalSummary',
  'disclaimer'
];


const PROGRAM_ENGINES = {
  personal: {
    label: '개인 마음이음 통합 엔진',
    focus: '개인의 정서상태, 성격·기질, 사고와 자기평가, 스트레스 반응과 회복자원을 중심으로 통합합니다.',
    rules: [
      '기질·성격 검사는 비교적 지속적인 특성으로, 증상·정서 검사는 현재 상태로 구분합니다.',
      '현재의 어려움을 성격의 결함으로 해석하지 않고, 개인 특성과 최근 심리상태의 상호작용으로 설명합니다.',
      '자기이해, 강점, 스트레스 취약성, 회복자원을 균형 있게 제시합니다.'
    ]
  },
  couple: {
    label: '부부 마음이음 관계 통합 엔진',
    focus: '두 사람의 기질·성격 차이, 관계에서의 반응 방식, 의사소통 자원과 갈등 가능성을 관계 맥락에서 통합합니다.',
    rules: [
      '한 사람을 문제의 원인으로 지목하거나 우열을 판단하지 않습니다.',
      '차이는 결함이 아니라 상호작용에서 다르게 작동하는 특성으로 설명합니다.',
      '공통 강점, 상호 보완 가능성, 오해가 생기기 쉬운 지점을 균형 있게 제시합니다.'
    ]
  },
  parentChild: {
    label: '부모-자녀 마음이음 발달·양육 통합 엔진',
    focus: '아동의 발달과 기질, 양육자의 특성과 양육태도, 부모-자녀 적합성을 중심으로 통합합니다.',
    rules: [
      '아동의 행동을 문제행동으로 단정하지 않고 발달수준과 기질적 요구의 관점에서 설명합니다.',
      '양육태도는 비난이나 평가가 아니라 강점과 조정 가능한 상호작용 특성으로 제시합니다.',
      '아동 검사와 양육자 검사의 대상자를 혼동하지 않으며, 부모-자녀 적합성과 환경 조절 가능성을 함께 설명합니다.'
    ]
  },
  general: {
    label: '심리검사 일반 통합 엔진',
    focus: '실시된 심리검사의 측정영역과 근거를 중심으로 현재 상태, 비교적 지속적인 특성, 강점과 주의점을 통합합니다.',
    rules: [
      '각 검사의 측정 목적을 구분하고 동일한 비중으로 기계적으로 나열하지 않습니다.',
      '검사 간 일치와 차이를 모두 보존하면서 하나의 일관된 심리적 이해로 정리합니다.'
    ]
  }
};

function programEngine(program) {
  const name = clean(program, 180);
  if (name.includes('부모-자녀')) return PROGRAM_ENGINES.parentChild;
  if (name.includes('부부')) return PROGRAM_ENGINES.couple;
  if (name.includes('개인')) return PROGRAM_ENGINES.personal;
  return PROGRAM_ENGINES.general;
}

function normalizedTestKey(value) {
  return clean(value, 120).toUpperCase().replace(/[^A-Z0-9가-힣]/g, '');
}

function hasTest(testNames, ...aliases) {
  const keys = testNames.map(normalizedTestKey);
  return aliases.some((alias) => {
    const target = normalizedTestKey(alias);
    return keys.some((key) => key.includes(target) || target.includes(key));
  });
}

function combinationEngine(testNames) {
  const guides = [];
  if (hasTest(testNames, 'TCI', 'JTCI') && hasTest(testNames, 'MMPI', 'MMPI-2', 'MMPI-A', 'PAI')) {
    guides.push('기질·성격과 현재의 정서·증상 상태를 구분하여 설명하고, 타고난 특성이 최근 스트레스 상황에서 어떻게 드러나는지 통합합니다.');
  }
  if (hasTest(testNames, 'TCI', 'JTCI') && hasTest(testNames, '회복탄력성')) {
    guides.push('기질적 민감성과 자기조절 특성을 회복자원과 연결하여, 취약성뿐 아니라 회복을 돕는 심리적 자원을 구체적으로 제시합니다.');
  }
  if (hasTest(testNames, 'MMPI', 'MMPI-2', 'MMPI-A', 'PAI') && hasTest(testNames, 'SCT', '문장완성')) {
    guides.push('구조화된 성격·정서 검사와 주관적 문장 반응에서 공통으로 확인되는 주제를 중심으로 통합하되, SCT의 표현을 사실이나 진단으로 단정하지 않습니다.');
  }
  if (hasTest(testNames, 'PAT') && hasTest(testNames, 'STS', 'JTCI') && hasTest(testNames, 'K-CDI', 'KCDI')) {
    guides.push('양육태도, 아동의 기질, 발달수준을 분리해 해석한 뒤 부모-자녀 적합성과 환경 조절 가능성으로 통합합니다. 발달수준과 기질적 특성을 혼동하지 않습니다.');
  }
  if (hasTest(testNames, 'TCI') && hasTest(testNames, 'TCI') && testNames.filter((n) => normalizedTestKey(n).includes('TCI')).length >= 2) {
    guides.push('두 사람의 TCI 결과는 개인별 특성을 먼저 분리해 이해한 뒤, 유사점·차이점·상호 보완 가능성과 갈등 시 반응 차이로 통합합니다.');
  }
  if (hasTest(testNames, 'PHQ-9', 'PHQ9') && hasTest(testNames, 'GAD-7', 'GAD7')) {
    guides.push('우울과 불안 선별 결과를 서로 구분하면서도 공존 가능성을 고려하고, 선별검사만으로 진단하지 않습니다.');
  }
  return guides.length ? guides : ['각 검사의 측정영역을 구분하고 기본검사를 중심으로 추가검사의 보완 근거를 통합합니다.'];
}

const REPORT_SCHEMA = {
  type: 'OBJECT',
  properties: Object.fromEntries(REPORT_FIELDS.map((key) => [key, { type: 'STRING' }])),
  required: REPORT_FIELDS
};

function testMaterial(body) {
  return (Array.isArray(body.tests) ? body.tests : [])
    .slice(0, 8)
    .map((test, index) => `
[검사 ${index + 1}: ${clean(test.testType, 100)}]
상담자 검토: ${test.reviewed ? '완료' : '미완료'}
판독 신뢰도: ${Number(test.confidenceScore || 0)}%
원자료 요약: ${clean(test.sourceSummary, 800)}
타당도 및 해석 제한: ${clean(test.validity, 600)}
핵심 결과: ${clean(test.coreFindings, 1500)}
강점 및 자원: ${clean(test.strengths, 800)}
주의 깊게 볼 특성: ${clean(test.vulnerabilities, 800)}
검사 간 교차 확인 근거: ${clean(test.crossChecks, 500)}
해석상 주의사항: ${clean(test.cautions, 500)}
`)
    .join('\n');
}

function crossMaterial(cross) {
  if (!cross) return '검사 간 교차분석 자료 없음';
  return `
[상담자 검토 완료 검사 간 교차분석]
공통 특징: ${clean(cross.commonPatterns, 1000)}
검사 간 차이: ${clean(cross.differences, 700)}
상태와 비교적 지속적인 특성의 구분: ${clean(cross.stateTrait, 700)}
응답 맥락: ${clean(cross.responseContext, 600)}
위험 및 보호요인: ${clean(cross.riskProtection, 800)}
통합적 이해: ${clean(cross.caseIntegration, 1000)}
해석의 한계: ${clean(cross.limitations, 500)}
`;
}

function currentReportMaterial(report) {
  if (!report || typeof report !== 'object') return '기존 보고서 없음';
  return REPORT_FIELDS.map((key) => `[${key}]\n${clean(report[key], 9000)}`).join('\n\n');
}

function buildPrompt(body, retryNote = '') {
  const testNames = (Array.isArray(body.tests) ? body.tests : [])
    .map((test) => clean(test.testType, 80))
    .filter(Boolean)
    .join(', ');
  const basicTests = (Array.isArray(body.basicTests) ? body.basicTests : []).map((v) => clean(v, 100)).filter(Boolean);
  const additionalTests = (Array.isArray(body.additionalTests) ? body.additionalTests : []).map((v) => clean(v, 100)).filter(Boolean);
  const basicLabel = basicTests.length ? basicTests.join(', ') : '등록된 기본검사 없음';
  const additionalLabel = additionalTests.length ? additionalTests.join(', ') : '추가검사 없음';
  const engine = programEngine(body.program);
  const comboGuides = combinationEngine((Array.isArray(body.tests) ? body.tests : []).map((test) => test.testType));

  return `당신은 임상심리사가 최종 승인만 하면 내담자에게 제공할 수 있는 수준의 "통합 심리평가보고서"를 완성하는 전문 심리평가 보고서 작성 엔진입니다.

[대상 정보]
대상자: ${clean(body.clientName, 100)}
프로그램: ${clean(body.program, 180)}
예약 프로그램 기본검사: ${basicLabel}
예약 시 선택한 추가검사: ${additionalLabel}
이번 보고서에 실제 반영된 검사: ${testNames}
적용 엔진: ${engine.label}

[프로그램 전용 해석 초점]
${engine.focus}
${engine.rules.map((rule, index) => `${index + 1}. ${rule}`).join('\n')}

[검사 조합별 통합 규칙]
${comboGuides.map((rule, index) => `${index + 1}. ${rule}`).join('\n')}

[검사 구성 반영 원칙]
- 예약정보는 검사 맥락을 이해하는 참고자료로만 사용합니다.
- 이번 보고서는 실제 업로드되고 상담자 검토가 완료된 검사만 근거로 작성합니다.
- 예약 당시 신청했지만 아직 업로드되지 않은 검사는 보고서 내용에 포함하거나 누락으로 평가하지 않습니다.
- 실제 반영된 검사가 여러 개이면 서로 독립된 설명처럼 나열하지 말고 공통점과 차이를 통합합니다.
- 검사 결과가 다른 양상을 보이면 차이를 삭제하지 말고 상태, 맥락, 측정영역의 차이로 신중하게 설명합니다.
- 심리평가 개요에는 이번 보고서에 실제 반영된 검사명을 명확히 기재합니다.

[검사별 검토 자료]
${testMaterial(body)}

${crossMaterial(body.crossAnalysis)}

${body.mode === 'revise' ? `[상담자 수정 요청]
${clean(body.counselorComment, 5000)}

[현재 보고서]
${currentReportMaterial(body.currentReport)}

[수정 원칙]
- 상담자 코멘트는 새로운 검사결과가 아니라, 제공된 검사자료를 정확히 반영하도록 돕는 전문 검토 의견입니다.
- 코멘트가 검사자료와 충돌하면 검사자료를 우선하고, 근거 없이 사실을 추가하지 않습니다.
- 지적된 문장만 기계적으로 바꾸지 말고 보고서 전체의 논리, 중복, 문체, 항목 간 일관성을 다시 점검합니다.
- 상담자 코멘트 문구를 그대로 복사하거나 보고서에 '상담자가 말하기를'처럼 노출하지 않습니다.
- 수정 후에도 모든 항목을 완성된 형태로 다시 반환합니다.` : ''}

[보고서의 역할]
- 검사결과지와 검사별 분석을 하나의 기준 문서로 통합하는 상담자용 통합 심리평가보고서입니다.
- 이 통합보고서는 전자차트 저장, 모두의 마음연구소 심리보고서 구성, AI 결과 해석상담의 기준자료로 사용됩니다.
- 상담에서 들은 이야기, 면담 정보, 행동관찰, 상담 목표, 사례개념화, 상담 질문은 절대 포함하지 않습니다.
- 오직 제공된 심리검사 결과와 상담자가 검토 완료한 검사 간 교차분석만 근거로 작성합니다.
- 검사별 점수나 척도 설명을 반복하는 설명서가 아니라, 여러 검사결과를 정확하게 통합한 완성형 심리보고서입니다.

[핵심 품질 기준]
1. 상담자가 문장을 다시 쓰지 않고 사실관계만 확인한 뒤 승인할 수 있는 수준으로 완성합니다.${body.mode === 'revise' ? ' 입력된 상담자 코멘트를 정확히 반영한 최종 수정본이어야 합니다.' : ''}
2. 제공되지 않은 점수, 생활사, 직업, 가족관계, 사건, 진단을 추정하거나 만들어내지 않습니다.
3. 상태와 비교적 지속적인 특성을 구분하고, 검사 간 일치점과 차이를 모순 없이 통합합니다.
4. 같은 의미를 다른 표현으로 반복하지 않습니다. 각 항목의 역할이 겹치지 않게 작성합니다.
5. 전문성을 유지하되 내담자가 이해하기 쉬운 자연스러운 한국어를 사용합니다.
6. "~일 수 있습니다", "~경향이 나타납니다", "~로 이해할 수 있습니다"처럼 비단정적으로 표현합니다.
7. 강점을 과장하지 않고 검사 근거가 있는 범위에서 구체적으로 설명합니다.
8. 상담을 권유하는 문장이나 열린 질문을 넣지 않습니다.
9. 감성적인 위로문, 홍보문, 상투적인 문구로 분량을 채우지 않습니다.
10. 생성 후 스스로 근거 일치성, 통합성, 균형성, 가독성, 중복, 상담정보 혼입 여부를 점검하고 수정한 최종본만 출력합니다.

[항목별 작성 기준]
- title: "통합 심리평가보고서"
- subtitle: 대상자의 검사결과를 통합해 이해한다는 의미의 짧고 품위 있는 부제 1문장
- evaluationOverview: 프로그램명과 이번 보고서에 실제 반영된 검사명을 기재하고, 심리검사 기반 보고서의 활용 범위를 3~5문장으로 안내
- testGuide: '이번 심리평가에 사용된 검사' 제목 아래에 넣을 내용. 실제 반영된 각 검사마다 검사명, 무엇을 살펴보는 검사인지, 이번 보고서에서 어떤 영역을 이해하는 데 활용했는지를 내담자가 이해하기 쉬운 말로 2~4문장씩 설명. 점수·척도 해석은 쓰지 않고, 사람을 진단하거나 단정하는 검사가 아니라 자기이해를 돕는 자료라는 안내를 포함
- keyMessage: 전체 검사결과의 핵심을 4~6문장으로 압축한 대표 요약. 점수와 검사명을 나열하지 않음
- emotionalProfile: 정서 경험과 조절 특성을 검사 근거로 2~3문단
- thinkingStyle: 사고, 판단, 자기평가 및 의사결정 특성을 2~3문단
- relationshipStyle: 대인관계와 의사소통 특성을 2~3문단. 검사에서 근거가 없으면 과도하게 확장하지 않음
- stressRecovery: 스트레스 반응과 회복 방식, 보호요인을 2~3문단
- strengthsResources: 확인된 강점과 심리적 자원을 3~4개 핵심 주제로 설명
- integratedUnderstanding: 여러 검사 결과를 상태/특성 관점에서 통합한 핵심 본문 4~6문단
- currentSignals: 현재 주의 깊게 살펴볼 심리적 신호를 낙인 없이 3~4개 주제로 설명
- psychologicalSuggestions: 검사결과에서 직접 도출되는 일반적 자기이해 및 심리적 관리 제안 3~4개. 개인의 구체적 생활사를 추정하지 않음
- professionalSummary: 전체 보고서를 마무리하는 전문가 종합 소견 3~5문단. 새로운 내용을 추가하지 않고 핵심 의미, 강점, 주의점, 변화 가능성을 균형 있게 정리
- disclaimer: 심리검사는 현재 상태와 경향을 이해하는 참고자료이며 단독 진단이 아니라는 한계 안내 3~4문장

${retryNote ? `[재작성 지시]\n${retryNote}\n` : ''}
JSON 객체 하나만 반환하세요.`;
}

function parseJson(text) {
  const raw = String(text || '').trim().replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '').trim();
  const candidates = [raw];
  const start = raw.indexOf('{');
  const end = raw.lastIndexOf('}');
  if (start >= 0 && end > start) candidates.push(raw.slice(start, end + 1));
  for (const candidate of candidates) {
    try { return JSON.parse(candidate); } catch (_) {}
    try {
      return JSON.parse(candidate.replace(/[“”]/g, '"').replace(/[‘’]/g, "'").replace(/,\s*([}\]])/g, '$1'));
    } catch (_) {}
  }
  return null;
}

function qualityIssues(report) {
  const issues = [];
  for (const key of REPORT_FIELDS) {
    if (!clean(report?.[key])) issues.push(`${key} 누락`);
  }
  const longFields = ['keyMessage', 'emotionalProfile', 'thinkingStyle', 'stressRecovery', 'integratedUnderstanding', 'professionalSummary'];
  for (const key of longFields) {
    if (clean(report?.[key]).length < 100) issues.push(`${key} 내용 부족`);
  }
  const all = REPORT_FIELDS.map((key) => clean(report?.[key])).join('\n');
  const forbidden = ['다음 상담', '상담에서 확인', '말씀하신', '면담에서', '행동관찰에서'];
  forbidden.forEach((word) => { if (all.includes(word)) issues.push(`상담 정보 표현 포함: ${word}`); });
  return issues;
}

async function requestGemini(apiKey, model, prompt) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 25000);
  try {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.12,
          topP: 0.82,
          maxOutputTokens: 4200,
          thinkingConfig: { thinkingBudget: 0 },
          responseMimeType: 'application/json',
          responseSchema: REPORT_SCHEMA
        }
      })
    });
    const rawText = await response.text();
    let data = {};
    try { data = rawText ? JSON.parse(rawText) : {}; } catch (_) { data = { rawText }; }
    const text = data?.candidates?.[0]?.content?.parts?.map((part) => part?.text || '').filter(Boolean).join('\n').trim();
    if (!response.ok || !text) {
      const error = new Error(data?.error?.message || rawText || `Gemini HTTP ${response.status}`);
      error.status = response.status;
      throw error;
    }
    return text;
  } finally { clearTimeout(timer); }
}

async function callGemini(apiKey, prompt) {
  // 보고서 품질은 gemini-2.5-flash로 유지하되, 한 번만 호출하여
  // Netlify Functions의 30초 제한 안에서 응답하도록 합니다.
  const model = clean(process.env.GEMINI_REPORT_MODEL, 100) || 'gemini-2.5-flash';
  const text = await requestGemini(apiKey, model, prompt);
  return { text, model };
}

export const handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return jsonResponse({}, 200);
  if (event.httpMethod !== 'POST') return jsonResponse({ error: 'POST only' }, 405);
  try {
    const body = JSON.parse(event.body || '{}');
    if (!clean(body.clientName)) return jsonResponse({ error: '회원 정보가 없습니다.' }, 400);
    if (body.mode === 'revise' && !clean(body.counselorComment)) return jsonResponse({ error: '반영할 상담자 코멘트가 없습니다.' }, 400);
    if (body.mode === 'revise' && (!body.currentReport || typeof body.currentReport !== 'object')) return jsonResponse({ error: '수정할 기존 심리보고서가 없습니다.' }, 400);
    if (!Array.isArray(body.tests) || !body.tests.length) return jsonResponse({ error: '검사별 분석 자료가 없습니다.' }, 400);
    if (body.tests.some((test) => !test.reviewed)) return jsonResponse({ error: '상담자 검토가 완료된 검사별 분석만 사용할 수 있습니다.' }, 400);
    // 실제 업로드되고 상담자 검토가 완료된 검사만 보고서 근거로 사용합니다.
    // 예약 시 신청한 검사 전체의 업로드를 강제하지 않으며, 교차분석은 준비된 경우에만 보조자료로 반영합니다.

    const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || process.env.GOOGLE_GEMINI_API_KEY;
    if (!apiKey) return jsonResponse({ error: 'GEMINI_API_KEY가 설정되지 않았습니다.' }, 500);

    const result = await callGemini(apiKey, buildPrompt(body));
    const parsed = parseJson(result.text);
    const issues = qualityIssues(parsed);

    // 동일 요청 안에서 재생성하지 않습니다. 재호출로 인한 30초 초과를 막고,
    // 구조화 JSON이 정상 생성된 경우에만 즉시 반환합니다.
    if (!parsed || issues.length) {
      return jsonResponse({ error: `보고서 형식을 완성하지 못했습니다: ${issues.join(', ') || '결과 형식 오류'}. 다시 생성해 주세요.` }, 502);
    }

    const report = Object.fromEntries(REPORT_FIELDS.map((key) => [key, clean(parsed[key], 18000)]));
    return jsonResponse({ report, model: result.model, promptVersion: body.mode === 'revise' ? 'integrated-assessment-master-revision-v1' : 'integrated-assessment-master-v1', engine: programEngine(body.program).label, qualityChecked: true, revised: body.mode === 'revise' });
  } catch (error) {
    console.error('[INTEGRATED ASSESSMENT REPORT]', error);
    const message = error?.name === 'AbortError'
      ? '심리보고서 생성 시간이 25초를 초과했습니다. 잠시 후 다시 생성해 주세요.'
      : `심리보고서 생성 중 오류가 발생했습니다. ${String(error?.message || '')}`.trim();
    return jsonResponse({ error: message }, 500);
  }
};
