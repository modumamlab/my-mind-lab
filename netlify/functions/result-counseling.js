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

const clean = (value) => String(value || "").trim();

const normalizeMessages = (messages) => (Array.isArray(messages) ? messages : [])
  .filter((message) => message && clean(message.text))
  .slice(-24)
  .map((message) => ({
    role: message.role === "user" ? "user" : "assistant",
    text: clean(message.text)
  }));

const removeImmediateDuplicateParagraphs = (value) => {
  const paragraphs = clean(value)
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);

  const result = [];
  for (const paragraph of paragraphs) {
    const previous = result[result.length - 1] || "";
    const normalizedCurrent = paragraph.replace(/\s+/g, " ");
    const normalizedPrevious = previous.replace(/\s+/g, " ");

    if (normalizedCurrent && normalizedCurrent === normalizedPrevious) continue;
    result.push(paragraph);
  }

  return result.join("\n\n").trim();
};

const buildPrompt = ({ mode, reportText, integratedReportText, messages }) => {
  const conversation = normalizeMessages(messages)
    .map((message) => `${message.role === "user" ? "내담자" : "AI 결과 해석상담사"}: ${message.text}`)
    .join("\n");

  const integratedText = clean(integratedReportText);

  const common = `
당신은 모두의 마음연구소의 "AI 결과 해석상담사"입니다.
아래에 제공된 심리검사 결과지와 상담자 승인 완료 통합 심리평가보고서만을 근거로 설명하고 상담합니다. 내담자용 모두의 마음연구소 심리보고서는 입력자료로 사용하지 않습니다.

반드시 지킬 원칙:
- 제공된 자료에 없는 점수, 사실, 진단, 병력, 생활사를 만들지 않습니다.
- 검사 결과를 확정적 진단처럼 표현하지 않습니다.
- "검사 결과에서는 ~한 경향이 나타났습니다"처럼 조건부 언어를 사용합니다.
- 점수 하나로 내담자를 규정하지 않고, 실제 경험과 맥락을 함께 확인합니다.
- 전문용어는 쉬운 말로 먼저 설명합니다.
- 강점, 어려움, 환경, 회복 자원을 균형 있게 다룹니다.
- 원점수, 상담자 내부 메모, 비공개 가설은 그대로 노출하지 않습니다.
- 같은 인사말이나 같은 문단을 반복하지 않습니다.
- 답변을 한 번에 완결하고 문장 중간에서 끝내지 않습니다.
- 쉬운 한국어와 존댓말을 사용합니다.
- 자살·자해 위험이 드러나면 검사 설명을 멈추고 즉각적인 안전 안내를 우선합니다.

심리검사 결과지:
${reportText}

상담자 승인 완료 통합 심리평가보고서:
${integratedText || "제공되지 않음"}

자료 활용 원칙:
- 검사결과지를 가장 우선적인 원자료로 사용합니다.
- 통합 심리평가보고서는 검사별 결과와 검사 간 연결을 이해하는 핵심 상담자료로 활용합니다.
- 통합보고서의 전문용어나 내부 표현을 그대로 읽어주지 말고 내담자가 이해하기 쉬운 말로 설명합니다.
- 내담자의 실제 경험이 보고서의 해석과 다르면 내담자의 경험을 우선하며 단정하지 않습니다.
`;

  if (mode === "overview") {
    return `${common}
상담 시작 단계입니다.

아래 순서로 550~850자 정도의 자연스럽고 완결된 첫 설명을 작성하세요.
1. 짧고 따뜻한 시작 인사
2. 검사 전체에서 보이는 핵심 흐름
3. 현재 어려움이나 부담으로 연결될 수 있는 부분
4. 강점과 보호요인
5. 검사 결과의 한계와 실제 경험을 함께 봐야 한다는 안내
6. 마지막에 열린 질문 하나

주의:
- 인사말은 한 번만 씁니다.
- 검사명을 반복해서 나열하지 않습니다.
- 제공자료에 없는 세부 내용을 추정하지 않습니다.
- 마지막 문장은 반드시 완결된 질문으로 끝냅니다.
`;
  }

  if (mode === "summary") {
    return `${common}
아래 상담 대화를 바탕으로 상담 마무리 정리를 작성하세요.

상담 대화:
${conversation || "대화 내용 없음"}

구성:
- 오늘 함께 이해한 핵심
- 검사 결과와 실제 경험이 연결된 부분
- 확인된 강점과 회복 자원
- 앞으로 살펴볼 주제
- 필요할 경우 전문가 상담에서 이어갈 부분

새로운 검사 해석이나 진단을 만들지 말고, 550~900자의 따뜻하고 완결된 상담정리로 작성하세요.
질문으로 끝내지 마세요.
`;
  }

  return `${common}
현재 상담 대화:
${conversation || "아직 대화가 시작되지 않았습니다."}

마지막 내담자 말에 직접 반응하세요.
공감한 뒤, 제공된 검사자료에서 관련되는 내용을 쉬운 말로 설명하고 실제 경험과 연결하세요.
한 번에 질문은 하나만 하며 3~7문장으로 완결되게 작성하세요.
앞서 했던 인사나 설명을 반복하지 마세요.
`;
};

async function requestGemini({ apiKey, model, prompt }) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 45000);

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.45,
            topP: 0.9,
            maxOutputTokens: 1600
          }
        })
      }
    );

    const rawText = await response.text();
    let data = {};
    try {
      data = rawText ? JSON.parse(rawText) : {};
    } catch (_) {
      data = { rawText };
    }

    if (!response.ok) {
      const apiMessage = clean(data?.error?.message || data?.message || rawText || `HTTP ${response.status}`);
      const error = new Error(apiMessage || `Gemini HTTP ${response.status}`);
      error.status = response.status;
      error.model = model;
      error.apiData = data;
      throw error;
    }

    const candidate = data?.candidates?.[0];
    const text = candidate?.content?.parts
      ?.map((part) => clean(part?.text))
      .filter(Boolean)
      .join("\n")
      .trim();

    if (!text) {
      const finishReason = candidate?.finishReason || "NO_TEXT";
      const blockReason = data?.promptFeedback?.blockReason || "";
      const error = new Error(`Gemini 응답 본문이 없습니다. finishReason=${finishReason}${blockReason ? `, blockReason=${blockReason}` : ""}`);
      error.model = model;
      error.apiData = data;
      throw error;
    }

    return {
      text: removeImmediateDuplicateParagraphs(text),
      model,
      finishReason: candidate?.finishReason || ""
    };
  } finally {
    clearTimeout(timeoutId);
  }
}

async function callGemini({ apiKey, prompt }) {
  const configuredModels = [
    process.env.GEMINI_PRIMARY_MODEL,
    process.env.GEMINI_FALLBACK_MODEL,
    "gemini-2.5-flash",
    "gemini-2.0-flash"
  ]
    .map(clean)
    .filter(Boolean);

  const models = [...new Set(configuredModels)];
  const attempts = [];

  for (const model of models) {
    try {
      return await requestGemini({ apiKey, model, prompt });
    } catch (error) {
      attempts.push({
        model,
        status: error?.status || null,
        message: clean(error?.message || error),
        name: error?.name || "Error"
      });
      console.error("[AI RESULT COUNSELING MODEL FAILED]", attempts[attempts.length - 1]);
    }
  }

  const error = new Error("사용 가능한 Gemini 모델에서 응답을 생성하지 못했습니다.");
  error.detail = attempts;
  throw error;
}

export const handler = async (event) => {
  if (event.httpMethod === "OPTIONS") return jsonResponse({}, 200);
  if (event.httpMethod !== "POST") return jsonResponse({ error: "POST only" }, 405);

  try {
    let body = {};
    try {
      body = JSON.parse(event.body || "{}");
    } catch (_) {
      return jsonResponse({ error: "요청 데이터 형식이 올바르지 않습니다." }, 400);
    }

    const mode = ["overview", "chat", "summary"].includes(body.mode) ? body.mode : "chat";
    const reportText = clean(body.reportText);
    const integratedReportText = clean(body.integratedReportText);
    const messages = normalizeMessages(body.messages);

    if (!reportText) {
      return jsonResponse({ error: "업로드된 심리검사 결과를 찾을 수 없습니다." }, 400);
    }

    const allUserText = messages
      .filter((message) => message.role === "user")
      .map((message) => message.text)
      .join(" ");

    if (/자살|죽고\s*싶|죽고싶|자해|사라지고\s*싶|끝내고\s*싶|목숨|유서/.test(allUserText)) {
      return jsonResponse({
        text: "지금은 검사결과 설명보다 안전이 가장 중요합니다. 스스로를 해칠 위험이 있거나 혼자 있기 어렵다면 지금 바로 112, 119 또는 자살예방상담전화 109에 연락해 주세요. 가능하다면 믿을 수 있는 사람에게 현재 상태를 바로 알려 주세요.",
        provider: "safety",
        promptVersion: "v47-result-sheet-integrated-only"
      });
    }

    const apiKey =
      process.env.GEMINI_API_KEY ||
      process.env.GOOGLE_API_KEY ||
      process.env.GOOGLE_GEMINI_API_KEY;

    if (!apiKey) {
      return jsonResponse({ error: "GEMINI_API_KEY가 설정되지 않았습니다." }, 500);
    }

    const prompt = buildPrompt({ mode, reportText, integratedReportText, messages });
    const result = await callGemini({ apiKey, prompt });

    return jsonResponse({
      text: result.text,
      provider: "gemini",
      model: result.model,
      finishReason: result.finishReason,
      integratedReportApplied: Boolean(integratedReportText),
      promptVersion: "v47-result-sheet-integrated-only"
    });
  } catch (error) {
    const detail = Array.isArray(error?.detail) ? error.detail : [{ message: clean(error?.message || error) }];
    console.error("[AI RESULT COUNSELING FAILED]", detail);

    return jsonResponse({
      error: "AI 결과 해석상담 응답을 생성하지 못했습니다.",
      detail: process.env.CONTEXT === "dev" || process.env.NETLIFY_DEV === "true" ? detail : undefined,
      promptVersion: "v47-result-sheet-integrated-only"
    }, 500);
  }
};
