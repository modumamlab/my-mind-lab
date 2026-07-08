const PROMPT_VERSION = "v27-clinical-core-stable";

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

const cleanText = (value) => String(value || "").trim();

const normalizeMessages = (messages) =>
  (Array.isArray(messages) ? messages : [])
    .filter((m) => m && cleanText(m.text))
    .slice(-24)
    .map((m) => ({
      role: m.role === "user" ? "user" : "assistant",
      text: cleanText(m.text)
    }));

const getLastUser = (messages) =>
  [...messages].reverse().find((m) => m.role === "user")?.text || "";

const getUserText = (messages) =>
  messages.filter((m) => m.role === "user").map((m) => m.text).join(" ");

const hasCrisisRisk = (text) =>
  /자살|죽고\s*싶|죽고싶|자해|해치고\s*싶|사라지고\s*싶|끝내고\s*싶|목숨|유서|극단|죽어버리고|살기\s*싫/.test(text);

const hasAbusiveText = (text) =>
  /씨발|시발|ㅅㅂ|병신|미친년|미친놈|꺼져|죽어라|개새끼|혐오|비하|차별|모욕/.test(text);

const wantsClosing = (text) =>
  /(마무리|정리|리포트|끝낼래|충분|고마워|도움이\s*됐|이제\s*알|정리됐|괜찮아졌|여기까지|검사|추천|예약)/.test(text);

const makeCrisisReply = () =>
  "지금은 무엇보다 안전이 가장 중요합니다.\n\n스스로를 해치고 싶거나 당장 안전하지 않다고 느껴진다면, 지금 바로 112, 119 또는 자살예방상담전화 109에 연락해 주세요.\n\n가능하다면 지금 혼자 있지 말고, 곁에 연락할 수 있는 사람에게 바로 알려 주세요.";

const makeLimitReply = () =>
  "이 대화는 마음을 안전하게 살펴보기 위한 공간입니다.\n\n욕설, 비방, 혐오나 모욕적인 표현이 이어지면 상담 대화를 계속 진행하기 어렵습니다.\n\n마음을 나누고 싶으시다면, 지금 느끼는 감정이나 상황을 조금 더 안전한 표현으로 다시 적어 주세요.";

const buildConversationText = (messages) =>
  messages.map((m) => `${m.role === "user" ? "사용자" : "AI 마음지기"}: ${m.text}`).join("\n");

const buildPrompt = ({ messages, minutes, shouldClose }) => {
  const conversation = buildConversationText(messages);
  const lastUser = getLastUser(messages);
  const userTurns = messages.filter((m) => m.role === "user").length;

  return `
당신은 '모두의 마음연구소'의 AI 마음지기입니다.

당신의 역할은 단순히 위로하거나 조언하는 것이 아니라, 내담자가 자신의 마음을 알아차리고, 이해하며, 다시 연결할 수 있도록 돕는 것입니다.
당신은 정답을 알려주는 사람이 아니라, 사용자가 자신의 마음을 발견하도록 함께 탐색하는 동반자입니다.

【상담 원칙】
- 항상 존중과 공감을 담은 존댓말을 사용합니다.
- 사용자가 실제로 말한 내용을 중심으로 대화를 이어갑니다.
- 대화의 전체 맥락을 이해하며 자연스럽게 이어갑니다.
- 사용자의 표현을 가능한 그대로 반영합니다.
- 의미가 불분명한 경우에는 해석보다 먼저 이해한 내용이 맞는지 확인합니다.
- 확인되지 않은 내용은 추측하거나, 진단하거나, 단정하지 않습니다.
- 해결책을 서둘러 제시하기보다 사용자가 자신의 마음을 스스로 이해하도록 돕습니다.
- 같은 표현이나 같은 질문을 반복하지 않습니다.
- 준비된 예시나 템플릿을 선택하지 않습니다.
- 사용자의 이야기를 분류하지 않고, 현재 대화를 바탕으로 매번 새로운 응답을 생성합니다.

【응답 방식】
- 응답은 2~4문장으로 작성합니다.
- 질문은 꼭 필요한 경우에만 하나 사용합니다.
- 질문보다 이해와 반영이 더 적절하면 질문하지 않습니다.
- 상담자가 실제 상담실에서 사용할 법한 자연스럽고 따뜻한 언어를 사용합니다.
- 문장을 반드시 끝까지 완성합니다.
- 조사나 어미 중간에서 멈추지 않습니다.
- 답변은 완결된 문장으로 끝냅니다.

【상담 제한】
욕설, 비방, 혐오, 차별, 모욕, 반복적인 공격적 표현이나 상담의 목적과 무관한 부적절한 대화가 지속될 경우에는 상담을 정중하게 제한합니다.

【상담 종료】
현재 대화 시간은 약 ${minutes}분입니다.
현재 사용자 발화 수는 ${userTurns}회입니다.
이번 응답에서 상담 마무리 필요 여부: ${shouldClose ? "예" : "아니오"}

${shouldClose ? `
이번 응답은 상담을 자연스럽게 마무리하는 마지막 응답입니다.
새로운 질문으로 끝내지 않습니다.
마무리에서는
1. 지금까지의 마음을 자연스럽게 정리합니다.
2. 심리학적 통찰을 하나 제공합니다.
3. 필요한 경우에는 심리검사를 추천합니다.
4. 추천하는 이유를 함께 설명합니다.
` : ""}

현재 대화:
${conversation || "아직 대화가 시작되지 않았습니다."}

마지막 사용자 말:
${lastUser}

출력 규칙:
- AI 마음지기의 답변만 작성합니다.
- 제목, 번호, 분석 과정은 쓰지 않습니다.
- 2~4문장으로 답합니다.
- 문장을 반드시 끝까지 완성합니다.
`;
};

async function callGemini({ apiKey, prompt, closing = false }) {
  const models = [
    "gemini-1.5-flash",
    "gemini-1.5-flash-latest",
    "gemini-2.0-flash",
    "gemini-2.5-flash"
  ];

  let lastError = null;

  for (const model of models) {
    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ role: "user", parts: [{ text: prompt }] }],
            generationConfig: {
              temperature: closing ? 0.55 : 0.68,
              topP: 0.9,
              topK: 32,
              maxOutputTokens: closing ? 1400 : 1200
            }
          })
        }
      );

      const data = await response.json().catch(() => ({}));
      const text = data?.candidates?.[0]?.content?.parts
        ?.map((p) => p.text || "")
        .join("\n")
        .trim();

      if (response.ok && text) {
        return { text, model };
      }

      lastError = { model, status: response.status, data };
      console.error("[MODUMAM AI] Gemini non-ok/empty", lastError);
    } catch (error) {
      lastError = { model, error: error.message };
      console.error("[MODUMAM AI] Gemini fetch error", lastError);
    }
  }

  const error = new Error("Gemini API call failed");
  error.detail = lastError;
  throw error;
}

const postProcess = (text) => {
  let output = cleanText(text);
  output = output
    .replace(/^AI 마음지기\s*[:：]\s*/i, "")
    .replace(/^답변\s*[:：]\s*/i, "")
    .replace(/피로\/소진/g, "")
    .replace(/emotion_reflection/g, "")
    .replace(/좋은 응답[:：]?/g, "")
    .replace(/대화 예시[:：]?/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  return output;
};

const looksIncomplete = (text) => {
  const t = cleanText(text);
  if (!t) return true;
  if (t.length < 35) return true;

  const completeEndings =
    /[.!?。？！]$|(?:습니다|습니까|어요|예요|네요|지요|까요|같습니다|있습니다|없습니다|바랍니다|주세요|드립니다|합니다|했습니다|되었습니다|느껴집니다|살펴보겠습니다)\.?$/;
  if (completeEndings.test(t)) return false;

  return /(셨|했|되|하|쓰셨|느껴|생각|마음과|에너지를|많이|수|것|점|부분|느낌|마음)$/.test(t);
};

const fallbackConnectionReply = () =>
  "AI 마음지기 연결이 잠시 원활하지 않습니다.\n\n정해진 상담 문장으로 대신 답하지 않겠습니다. 잠시 후 다시 보내 주세요.";

export const handler = async function (event) {
  if (event.httpMethod === "OPTIONS") return jsonResponse({}, 200);
  if (event.httpMethod !== "POST") return jsonResponse({ error: "POST only" }, 405);

  try {
    const body = JSON.parse(event.body || "{}");
    const messages = normalizeMessages(body.messages);
    const sessionStart = Number(body.sessionStart || Date.now());
    const minutes = Math.max(0, Math.round((Date.now() - sessionStart) / 60000));
    const lastUser = getLastUser(messages);
    const allUserText = getUserText(messages);
    const userTurns = messages.filter((m) => m.role === "user").length;
    const shouldClose = wantsClosing(lastUser) || minutes >= 15 || userTurns >= 12;

    if (hasCrisisRisk(allUserText)) {
      return jsonResponse({
        text: makeCrisisReply(),
        isComplete: false,
        promptVersion: PROMPT_VERSION,
        abuseWarningCount: Number(body.abuseWarningCount || 0),
        engine: { mode: "clinical-core", safety: "CRISIS", fallback: "OFF" }
      });
    }

    if (hasAbusiveText(lastUser)) {
      const count = Number(body.abuseWarningCount || 0) + 1;
      return jsonResponse({
        text: makeLimitReply(),
        isComplete: false,
        promptVersion: PROMPT_VERSION,
        abuseWarningCount: count,
        engine: { mode: "clinical-core", safety: "LIMITED", fallback: "OFF" }
      });
    }

    const apiKey =
      process.env.GEMINI_API_KEY ||
      process.env.GOOGLE_API_KEY ||
      process.env.GOOGLE_GEMINI_API_KEY;

    if (!apiKey) {
      return jsonResponse({
        text: "AI 마음지기 연결 설정이 아직 완료되지 않았습니다. Netlify 환경변수에서 GEMINI_API_KEY를 확인해 주세요.",
        isComplete: false,
        promptVersion: PROMPT_VERSION,
        abuseWarningCount: Number(body.abuseWarningCount || 0),
        engine: { mode: "clinical-core", safety: "OK", fallback: "OFF", error: "NO_API_KEY" }
      }, 200);
    }

    const prompt = buildPrompt({ messages, minutes, shouldClose });
    let { text, model } = await callGemini({ apiKey, prompt, closing: shouldClose });
    let finalText = postProcess(text);

    if (looksIncomplete(finalText)) {
      const retryPrompt = `
아래 AI 마음지기 답변이 중간에서 끊겼거나 완결되지 않았습니다.

끊긴 답변:
${finalText}

현재 대화:
${buildConversationText(messages)}

같은 의미를 유지하되, 완결된 자연스러운 상담 답변으로 다시 작성하세요.
규칙:
- 2~4문장
- 문장을 반드시 끝까지 완성
- 존댓말
- 추측, 진단, 단정 금지
- 질문은 필요할 때만 1개
- AI 답변만 출력
`;
      try {
        const retry = await callGemini({ apiKey, prompt: retryPrompt, closing: shouldClose });
        finalText = postProcess(retry.text);
        model = retry.model || model;
      } catch (retryError) {
        console.error("[MODUMAM AI] retry failed", retryError.detail || retryError);
      }
    }

    if (!finalText) finalText = fallbackConnectionReply();

    return jsonResponse({
      text: finalText,
      isComplete: shouldClose,
      promptVersion: PROMPT_VERSION,
      abuseWarningCount: Number(body.abuseWarningCount || 0),
      engine: {
        mode: "clinical-core-stable",
        safety: "OK",
        fallback: "OFF",
        model
      }
    }, 200);
  } catch (error) {
    console.error("[MODUMAM AI] handler error", error.detail || error);
    return jsonResponse({
      text: fallbackConnectionReply(),
      isComplete: false,
      promptVersion: PROMPT_VERSION,
      abuseWarningCount: 0,
      engine: { mode: "clinical-core-stable", safety: "UNKNOWN", fallback: "OFF", error: "HANDLER_ERROR" }
    }, 200);
  }
};
