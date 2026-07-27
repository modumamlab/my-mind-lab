const AI_MODELS={REPORT:'gemini-2.5-flash'};
function modelSequence(primary){
  return [
    primary,
    process.env.GEMINI_REPORT_MODEL,
    process.env.GEMINI_MODEL,
    'gemini-2.5-flash',
    'gemini-2.5-flash-lite'
  ].map(v=>String(v||'').trim()).filter(Boolean);
}

const jsonResponse = (obj, statusCode = 200) => ({
  statusCode,
  headers: {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Content-Type": "application/json; charset=utf-8"
  },
  body: JSON.stringify(obj)
});

const clean = (v, max = 20000) => String(v || '').trim().slice(0, max);

function buildPrompt(body) {
  const tests = (Array.isArray(body.tests) ? body.tests : []).map((t, i) => `[${i + 1}. ${clean(t.testType, 100)}]
판독 신뢰도: ${Number(t.confidenceScore || 0)}%
신뢰도 근거: ${clean(t.confidenceReason, 1500)}
원자료 요약: ${clean(t.sourceSummary, 3000)}
타당도/한계: ${clean(t.validity, 2000)}
핵심 결과: ${clean(t.coreFindings, 5000)}
강점: ${clean(t.strengths, 2500)}
취약요인: ${clean(t.vulnerabilities, 2500)}
교차 확인: ${clean(t.crossChecks, 2500)}
사례 가설: ${clean(t.caseHypotheses, 2500)}
주의사항: ${clean(t.cautions, 2000)}
상담자 검토: ${t.reviewed ? '완료' : '미완료'}
확인 필요: ${t.needsReview ? '예' : '아니오'}`).join('\n\n');

  const cross = body.crossAnalysis ? `

상담자 검토용 검사 간 교차분석:
공통 특징: ${clean(body.crossAnalysis.commonPatterns, 3500)}
차이·추가확인: ${clean(body.crossAnalysis.differences, 3500)}
상태-특성 구분: ${clean(body.crossAnalysis.stateTrait, 3000)}
상황·응답 맥락: ${clean(body.crossAnalysis.responseContext, 3000)}
위험·보호요인: ${clean(body.crossAnalysis.riskProtection, 3000)}
추가 확인 질문: ${clean(body.crossAnalysis.followUpQuestions, 3000)}
상담 시사점: ${clean(body.crossAnalysis.counselingImplications, 3000)}
통합 가설: ${clean(body.crossAnalysis.caseIntegration, 3500)}
한계: ${clean(body.crossAnalysis.limitations, 2500)}` : '';

  return `당신은 임상심리사의 심리검사 통합과 내담자용 심리검사 종합보고서 초안 작성을 돕는 AI입니다.

대상자: ${clean(body.clientName, 100)}
프로그램: ${clean(body.program, 200)}

상담자용 검사별 분석:
${tests}${cross}

[핵심 작성 순서]
1. 여러 검사에서 공통적으로 반복 확인된 특징
2. 특정 검사에서만 추가로 확인된 특징
3. 검사 사이의 차이 또는 상반되는 결과
4. 그 차이를 설명할 수 있는 상태-특성, 상황, 반응양식의 가능성
5. 일상생활과 관계에서 나타날 수 있는 영향
6. 강점과 보호요인
7. 현실적인 회복 방향

[문장 품질 규칙]
- 같은 의미를 다른 표현으로 반복하지 않습니다.
- 한 문단에는 하나의 핵심만 씁니다.
- "이러한 특성은", "또한", "반면", "기질적으로" 같은 연결어를 반복하지 않습니다.
- 한 문단은 3~5문장, 한 문장은 가능하면 35자 안팎으로 작성합니다.
- 검사명을 나열한 뒤 같은 해석을 다시 반복하지 않습니다.
- 근거가 같은 내용은 한 번만 설명하고, 여러 검사에서 확인됐다면 검사명을 함께 표시합니다.
- 입력 자료에 없는 사실, 진단, 과거력, 행동관찰을 만들어내지 않습니다.
- 가능성은 가능성으로 표현하고 단정하지 않습니다.
- 신뢰도가 낮거나 검토되지 않은 검사는 핵심 결론의 근거로 강하게 사용하지 않습니다.
- 내담자가 이해할 수 있는 쉬운 한국어를 사용합니다.
- 점수와 전문용어를 과도하게 노출하지 않습니다.
- 강점과 보호요인을 반드시 포함합니다.
- 상담자용 질문과 위험 메모는 그대로 노출하지 않습니다.
- 상담 계획이나 특정 프로그램 권유는 포함하지 않습니다.
- 전문가 최종 검토 전 초안임을 전제로 합니다.

[항목별 작성 기준]
- agreementAnalysis: 공통 특징을 먼저 제시하고, 각 특징마다 근거가 된 검사명을 괄호에 표시합니다.
- discrepancies: 차이 → 가능한 이유 → 추가 확인 필요 순서로 씁니다.
- integratedUnderstanding: 앞 항목을 반복하지 말고 전체 구조와 임상적 의미만 2~4문단으로 통합합니다.
- dailySuggestions: 실행 가능한 제언 4~6개를 번호별 줄바꿈으로 씁니다.
- strengths: 강점과 보호요인을 3~5개 핵심 포인트로 씁니다.
- disclaimer: 2~3문장으로 간결하게 씁니다.

JSON만 반환하세요.
{
  "title": "심리검사 종합보고서 제목",
  "purpose": "검사 목적과 보고서 이용 안내",
  "currentUnderstanding": "현재 마음의 핵심 모습",
  "emotionalStress": "정서와 심리상태",
  "personality": "성격·기질·자기조절 특성",
  "relationships": "사고와 관계 방식",
  "agreementAnalysis": "여러 검사에서 공통적으로 확인된 특징",
  "discrepancies": "검사 간 차이와 가능한 맥락적 설명",
  "followUpPoints": "추가 확인이 필요한 핵심 항목",
  "strengths": "강점과 보호요인",
  "difficultSituations": "스트레스와 일상생활에서 어려움을 느낄 수 있는 상황",
  "integratedUnderstanding": "전체 검사 결과의 통합적 이해",
  "dailySuggestions": "전문가 제언 및 회복 방향",
  "counselingTopics": "비워 둡니다",
  "disclaimer": "검사 결과의 한계와 전문가 검토 안내"
}`;
}

async function callGemini(apiKey, prompt) {
  const models = modelSequence(AI_MODELS.REPORT);
  let lastError;

  for (const model of [...new Set(models)]) {
    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ role: 'user', parts: [{ text: prompt }] }],
            generationConfig: {
              temperature: 0.15,
              topP: 0.8,
              maxOutputTokens: 7000,
              responseMimeType: 'application/json'
            }
          })
        }
      );

      const data = await response.json().catch(() => ({}));
      const text = data?.candidates?.[0]?.content?.parts
        ?.map(p => p.text || '')
        .join('\n')
        .trim();

      if (response.ok && text) return { text, model };
      lastError = { status: response.status, model, data };
    } catch (error) {
      lastError = { model, error: error.message };
    }
  }

  const error = new Error('종합보고서 AI 호출 실패');
  error.detail = lastError;
  throw error;
}

function normalizeNumberedSuggestions(value) {
  const text = clean(value, 15000);
  if (!text) return '';
  const lines = text.split(/\n+/).map(v => v.trim()).filter(Boolean);
  if (lines.length <= 1) return text;
  return lines.map((line, index) => {
    const stripped = line.replace(/^\s*(?:\d+[.)]|[-•■])\s*/, '');
    return `${index + 1}. ${stripped}`;
  }).join('\n');
}

export const handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return jsonResponse({}, 200);
  if (event.httpMethod !== 'POST') return jsonResponse({ error: 'POST only' }, 405);

  try {
    const body = JSON.parse(event.body || '{}');

    if (!clean(body.clientName)) {
      return jsonResponse({ error: '회원 정보가 없습니다.' }, 400);
    }
    if (!Array.isArray(body.tests) || !body.tests.length) {
      return jsonResponse({ error: '검사별 분석 자료가 없습니다.' }, 400);
    }

    const apiKey =
      process.env.GEMINI_API_KEY ||
      process.env.GOOGLE_API_KEY ||
      process.env.GOOGLE_GEMINI_API_KEY;

    if (!apiKey) {
      return jsonResponse({ error: 'GEMINI_API_KEY가 설정되지 않았습니다.' }, 500);
    }

    const result = await callGemini(apiKey, buildPrompt(body));

    let parsed;
    try {
      parsed = JSON.parse(
        result.text.replace(/^```json\s*/i, '').replace(/```$/i, '').trim()
      );
    } catch {
      return jsonResponse({
        error: '종합보고서 결과 형식을 읽지 못했습니다. 다시 생성해 주세요.'
      }, 502);
    }

    const fields = [
      'title',
      'purpose',
      'currentUnderstanding',
      'emotionalStress',
      'personality',
      'relationships',
      'agreementAnalysis',
      'discrepancies',
      'followUpPoints',
      'strengths',
      'difficultSituations',
      'integratedUnderstanding',
      'dailySuggestions',
      'counselingTopics',
      'disclaimer'
    ];

    const report = Object.fromEntries(
      fields.map(key => [key, clean(parsed[key], 15000)])
    );

    report.dailySuggestions = normalizeNumberedSuggestions(report.dailySuggestions);
    report.counselingTopics = '';

    return jsonResponse({
      report,
      model: result.model,
      promptVersion: 'integrated-client-report-v4-evidence-first-nonrepetitive'
    });
  } catch (error) {
    console.error('[INTEGRATED ASSESSMENT REPORT]', error.detail || error);
    return jsonResponse({ error: '종합보고서 생성 중 오류가 발생했습니다.' }, 500);
  }
};
