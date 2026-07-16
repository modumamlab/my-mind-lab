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

const clean = (value, max = 12000) =>
  String(value ?? "").trim().slice(0, max);

const SUPPORTED_MIME_TYPES = [
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/webp"
];

function buildPrompt(body) {
  return `당신은 임상심리사의 심리검사 원자료 검토를 돕는 보조 AI입니다.
검사: ${clean(body.testType, 100)}
대상자: ${clean(body.clientName, 100)}
프로그램: ${clean(body.program, 200)}
파일명: ${clean(body.fileName, 200)}

업로드된 파일에 실제로 보이는 내용만 근거로 상담자용 분석 초안을 작성하세요.

필수 원칙:
- 파일이 선명하지 않거나 페이지가 누락됐으면 추정하지 말고 확인 필요로 표시합니다.
- 검사명, 점수, 척도, 프로파일을 원자료에서 확인하지 못하면 만들지 않습니다.
- MMPI-2·PAI는 타당도와 해석 가능성을 먼저 확인합니다.
- TCI·STS·PAT·K-CDI·선별검사는 검사 목적과 규준의 한계를 반영합니다.
- SCT·HTP 등 투사적 자료는 면담 및 다른 검사와 교차 확인할 가설로만 작성합니다.
- 위험 신호가 명확히 보이면 현재 안전을 추가 확인하도록 적되 진단을 확정하지 않습니다.
- confidenceScore는 파일 선명도, 검사명 식별, 점수·척도 식별, 페이지 완전성에 근거한 0~100 정수입니다.
- 80점 미만이면 needsReview를 true로 하고, 판독이 불확실한 항목을 구체적으로 적습니다.
- 모든 내용은 상담자 전용 AI 초안이며 전문가가 원본과 대조해야 합니다.

JSON만 반환하세요.
{
  "detectedTestType":"파일에서 확인한 검사명. 불확실하면 확인필요",
  "confidenceScore":0,
  "confidenceReason":"신뢰도 점수의 구체적 근거",
  "needsReview":true,
  "sourceSummary":"원자료에서 실제 확인된 검사명, 점수 체계, 주요 척도와 결과",
  "validity":"검사 해석 가능성, 타당도, 응답 일관성, 자료 품질과 제한",
  "coreFindings":"핵심 척도·프로파일·반응 특징을 검사별 전문성에 맞게 분석",
  "strengths":"확인되는 강점과 보호요인",
  "vulnerabilities":"취약요인, 스트레스 상황에서 어려울 수 있는 부분, 위험 신호",
  "counselingQuestions":"상담에서 확인할 구체적 질문 5~10개",
  "crossChecks":"다른 검사, 면담, 행동관찰과 교차 확인할 부분",
  "caseHypotheses":"사례개념화에 반영할 수 있는 임상적 가설. 사실과 가설을 구분",
  "cautions":"과잉해석을 피하기 위한 주의사항과 원자료 한계"
}`;
}

async function callModel(apiKey, model, body) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 45000);

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          contents: [{
            role: "user",
            parts: [
              { text: buildPrompt(body) },
              {
                inlineData: {
                  mimeType: body.mimeType,
                  data: body.base64
                }
              }
            ]
          }],
          generationConfig: {
            temperature: 0.15,
            topP: 0.8,
            maxOutputTokens: 5500,
            responseMimeType: "application/json",
            thinkingConfig: { thinkingBudget: 0 }
          }
        })
      }
    );

    const data = await response.json().catch(() => ({}));
    const text = data?.candidates?.[0]?.content?.parts
      ?.map((part) => part.text || "")
      .join("\n")
      .trim();

    if (response.ok && text) return { text, model };

    const message =
      data?.error?.message ||
      `Gemini 응답 오류 (HTTP ${response.status})`;
    const error = new Error(message);
    error.status = response.status;
    error.detail = data;
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}

async function callGemini(apiKey, body) {
  const models = [...new Set([
    process.env.GEMINI_PRIMARY_MODEL || "gemini-2.5-flash",
    process.env.GEMINI_FALLBACK_MODEL || "gemini-2.5-flash"
  ].filter(Boolean))];

  let lastError = null;

  for (const model of models) {
    try {
      return await callModel(apiKey, model, body);
    } catch (error) {
      lastError = {
        model,
        status: error.status || 0,
        message: error.name === "AbortError"
          ? "AI 분석 요청 시간이 초과되었습니다."
          : error.message,
        detail: error.detail || null
      };
      console.error("[ASSESSMENT FILE ANALYSIS MODEL ERROR]", lastError);
    }
  }

  const error = new Error(
    lastError?.message || "검사 분석 AI 호출에 실패했습니다."
  );
  error.detail = lastError;
  throw error;
}

function parseJson(text) {
  const normalized = String(text || "")
    .replace(/^```json\s*/i, "")
    .replace(/```$/i, "")
    .trim();

  return JSON.parse(normalized);
}

export const handler = async (event) => {
  if (event.httpMethod === "OPTIONS") return jsonResponse({}, 200);
  if (event.httpMethod !== "POST") {
    return jsonResponse({ error: "POST 요청만 지원합니다." }, 405);
  }

  try {
    const body = JSON.parse(event.body || "{}");

    if (!clean(body.clientName)) {
      return jsonResponse({ error: "회원 정보가 없습니다." }, 400);
    }
    if (!clean(body.testType)) {
      return jsonResponse({ error: "검사 종류가 없습니다." }, 400);
    }
    if (!body.base64 || typeof body.base64 !== "string") {
      return jsonResponse({ error: "검사결과 파일이 없습니다." }, 400);
    }
    if (!SUPPORTED_MIME_TYPES.includes(body.mimeType)) {
      return jsonResponse({ error: "PDF, PNG, JPG, WEBP 파일만 지원합니다." }, 400);
    }

    // Base64는 원본보다 약 33% 커집니다. 현재 관리자 화면의 5MB 제한과 맞춥니다.
    if (body.base64.length > 7_500_000) {
      return jsonResponse({
        error: "파일 용량이 너무 큽니다. 5MB 이하 파일 또는 결과표 핵심 페이지만 올려 주세요."
      }, 413);
    }

    const apiKey =
      process.env.GEMINI_API_KEY ||
      process.env.GOOGLE_API_KEY ||
      process.env.GOOGLE_GEMINI_API_KEY;

    if (!apiKey) {
      return jsonResponse({
        error: "GEMINI_API_KEY가 설정되지 않았습니다. Netlify 환경변수를 확인해 주세요."
      }, 500);
    }

    const result = await callGemini(apiKey, body);

    let parsed;
    try {
      parsed = parseJson(result.text);
    } catch (error) {
      console.error("[ASSESSMENT FILE ANALYSIS JSON ERROR]", result.text);
      return jsonResponse({
        error: "AI 분석 결과 형식을 읽지 못했습니다. 더 선명한 결과 파일로 다시 시도해 주세요."
      }, 502);
    }

    const fields = [
      "detectedTestType",
      "confidenceReason",
      "sourceSummary",
      "validity",
      "coreFindings",
      "strengths",
      "vulnerabilities",
      "counselingQuestions",
      "crossChecks",
      "caseHypotheses",
      "cautions"
    ];

    const analysis = Object.fromEntries(
      fields.map((key) => [key, clean(parsed[key], 12000)])
    );

    analysis.confidenceScore = Math.max(
      0,
      Math.min(100, Math.round(Number(parsed.confidenceScore) || 0))
    );
    analysis.needsReview =
      Boolean(parsed.needsReview) || analysis.confidenceScore < 80;

    const selectedType = clean(body.testType, 100);
    const detectedType = clean(analysis.detectedTestType, 100);

    if (
      detectedType &&
      detectedType !== "확인필요" &&
      !selectedType.includes(detectedType) &&
      !detectedType.includes(selectedType)
    ) {
      analysis.needsReview = true;
      analysis.confidenceReason =
        `선택한 검사(${selectedType})와 파일에서 감지한 검사(${detectedType})가 다릅니다. ` +
        analysis.confidenceReason;
    }

    return jsonResponse({
      analysis,
      model: result.model,
      promptVersion: "assessment-engine-file-v3-local-fix"
    });
  } catch (error) {
    const detail = error?.detail || {};
    console.error("[ASSESSMENT FILE ANALYSIS]", detail || error);

    const message =
      error?.name === "AbortError"
        ? "AI 분석 시간이 초과되었습니다. 결과표 핵심 페이지만 다시 올려 주세요."
        : error?.message || "검사결과 분석 중 오류가 발생했습니다.";

    return jsonResponse({
      error: message,
      errorCode: "ASSESSMENT_ANALYSIS_FAILED"
    }, 500);
  }
};
