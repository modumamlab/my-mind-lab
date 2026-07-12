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

const buildPrompt = ({ mode, reportText, messages }) => {
  const conversation = (Array.isArray(messages) ? messages : [])
    .slice(-30)
    .map((m) => `${m.role === "user" ? "내담자" : "AI 상담사"}: ${clean(m.text)}`)
    .join("\n");

  const common = `
당신은 모두의 마음연구소의 AI 결과상담사입니다.
임상심리사가 검토·승인한 심리검사 결과보고서를 근거로 상담합니다.

절대 원칙:
- 보고서에 없는 내용을 새로 진단하거나 단정하지 않습니다.
- 검사점수 하나만으로 사람을 규정하지 않습니다.
- "보고서에서는 ~한 경향이 나타났습니다"처럼 조건부 언어를 사용합니다.
- 보고서 내용과 내담자의 실제 경험을 연결합니다.
- 강점, 어려움, 환경, 회복 자원을 균형 있게 다룹니다.
- 쉬운 한국어와 존댓말을 사용합니다.
- 매 답변은 공감 → 보고서 근거의 쉬운 설명 → 필요한 경우 열린 질문 하나의 흐름을 따릅니다.
- 자살·자해 위험이 드러나면 검사 설명을 멈추고 112, 119, 자살예방상담전화 109 등 즉각적인 안전 안내를 우선합니다.

검토·승인 결과보고서:
${reportText}
`;

  if (mode === "overview") {
    return common + `
상담 시작 단계입니다.
보고서 전체를 먼저 전반적으로 설명하세요.

구성:
1. 따뜻한 시작 인사
2. 전체 결과의 핵심 흐름
3. 현재 어려움과 정서적 부담
4. 강점과 보호요인
5. 관계·일상·스트레스에서 나타날 수 있는 패턴
6. 회복과 변화 방향
7. 마지막에는 "결과를 보시면서 가장 궁금했던 부분은 무엇인가요?"와 같은 열린 질문 하나

보고서의 문장을 그대로 길게 복사하지 말고, 상담사가 설명하듯 자연스럽게 700~1100자로 작성하세요.
`;
  }

  if (mode === "summary") {
    return common + `
아래 상담 대화를 바탕으로 50분 AI 결과상담의 마무리 정리를 작성하세요.

상담 대화:
${conversation}

구성:
- 오늘 함께 이해한 핵심
- 결과보고서와 실제 경험이 연결된 부분
- 확인된 강점과 회복 자원
- 앞으로 살펴볼 주제
- 필요할 경우 전문가 상담에서 이어갈 부분

새로운 검사 해석이나 진단을 만들지 말고, 700~1200자의 따뜻하고 완결된 상담정리로 작성하세요.
질문으로 끝내지 마세요.
`;
  }

  return common + `
현재 상담 대화:
${conversation}

마지막 내담자 말에 직접 반응하세요.
보고서의 관련 내용을 쉬운 말로 설명하고 실제 경험과 연결하세요.
한 번에 질문은 하나만 하며, 답변은 3~7문장으로 작성하세요.
`;
};

async function callGemini({ apiKey, prompt }) {
  const models = [
    process.env.GEMINI_PRIMARY_MODEL || "gemini-2.5-flash",
    process.env.GEMINI_FALLBACK_MODEL || "gemini-2.5-flash-lite"
  ];

  let lastError = null;

  for (const model of [...new Set(models)]) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 25000);

      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          signal: controller.signal,
          body: JSON.stringify({
            contents: [{ role: "user", parts: [{ text: prompt }] }],
            generationConfig: {
              temperature: 0.55,
              topP: 0.9,
              maxOutputTokens: 1800,
              thinkingConfig: { thinkingBudget: 0 }
            }
          })
        }
      );
      clearTimeout(timeoutId);

      const data = await response.json().catch(() => ({}));
      const text = data?.candidates?.[0]?.content?.parts
        ?.map((part) => part.text || "")
        .join("\n")
        .trim();

      if (response.ok && text) return { text, model };
      lastError = { status: response.status, model, data };
    } catch (error) {
      lastError = { model, error: error.message };
    }
  }

  const error = new Error("AI result counseling failed");
  error.detail = lastError;
  throw error;
}

export const handler = async (event) => {
  if (event.httpMethod === "OPTIONS") return jsonResponse({}, 200);
  if (event.httpMethod !== "POST") return jsonResponse({ error: "POST only" }, 405);

  try {
    const body = JSON.parse(event.body || "{}");
    const mode = ["overview", "chat", "summary"].includes(body.mode) ? body.mode : "chat";
    const reportText = clean(body.reportText);
    const messages = Array.isArray(body.messages) ? body.messages : [];

    if (!reportText) {
      return jsonResponse({ error: "검토·승인된 결과보고서가 필요합니다." }, 400);
    }

    const allUserText = messages
      .filter((m) => m.role === "user")
      .map((m) => clean(m.text))
      .join(" ");

    if (/자살|죽고\s*싶|죽고싶|자해|사라지고\s*싶|끝내고\s*싶|목숨|유서/.test(allUserText)) {
      return jsonResponse({
        text: "지금은 검사결과 설명보다 안전이 가장 중요합니다. 스스로를 해칠 위험이 있거나 혼자 있기 어렵다면 지금 바로 112, 119 또는 자살예방상담전화 109에 연락해 주세요. 가능하다면 믿을 수 있는 사람에게 현재 상태를 바로 알려 주세요.",
        provider: "safety"
      });
    }

    const apiKey =
      process.env.GEMINI_API_KEY ||
      process.env.GOOGLE_API_KEY ||
      process.env.GOOGLE_GEMINI_API_KEY;

    if (!apiKey) {
      return jsonResponse({ error: "GEMINI_API_KEY가 설정되지 않았습니다." }, 500);
    }

    const prompt = buildPrompt({ mode, reportText, messages });
    const result = await callGemini({ apiKey, prompt });

    return jsonResponse({
      text: result.text,
      provider: "gemini",
      model: result.model,
      promptVersion: "v38-ai-result-counseling"
    });
  } catch (error) {
    console.error("[AI RESULT COUNSELING]", error.detail || error);
    return jsonResponse({
      error: "AI 결과상담 처리 중 문제가 발생했습니다."
    }, 500);
  }
};
