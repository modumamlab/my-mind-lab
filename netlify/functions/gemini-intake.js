const PROMPT_VERSION = "v1-clinical-core-stable-20260708";

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
    .slice(-30)
    .map((m) => ({
      role: m.role === "user" ? "user" : "assistant",
      text: cleanText(m.text).slice(0, 1600)
    }));

const buildConversationText = (messages) =>
  messages
    .map((m) => `${m.role === "user" ? "사용자" : "AI 마음지기"}: ${m.text}`)
    .join("\n");

const hasCrisisRisk = (text) =>
  /자살|죽고\s*싶|죽고싶|자해|해치고\s*싶|사라지고\s*싶|끝내고\s*싶|목숨|유서|극단|살기\s*싫|죽을래|죽을\s*래|죽여|해칠/.test(text);

const makeCrisisReply = () =>
  [
    "지금은 대화를 이어가기보다 안전을 먼저 확인해야 하는 상황일 수 있습니다.",
    "스스로를 해치고 싶거나 당장 안전하지 않다고 느껴진다면 혼자 있지 말고, 지금 바로 112, 119, 자살예방상담전화 109 또는 가까운 응급실에 도움을 요청해 주세요.",
    "가능하다면 곁에 있는 사람에게 지금의 상태를 바로 알려 주세요."
  ].join("\n\n");

const hasAbusiveText = (text) =>
  /씨발|시발|ㅅㅂ|ㅂㅅ|병신|미친년|미친놈|꺼져|죽어라|혐오|비하|차별|모욕|개새끼|좆|ㅈ같/.test(text);

const makeLimitReply = () =>
  [
    "이 대화는 마음을 안전하게 살펴보기 위한 공간입니다.",
    "욕설, 비방, 혐오나 공격적인 표현이 계속되면 상담을 이어가기 어렵습니다.",
    "마음을 나누고 싶은 주제가 있다면 그 내용으로 다시 이야기해 주세요."
  ].join("\n\n");

const wantsClosing = (text) =>
  /마무리|정리|리포트|보고서|끝낼래|충분|그만|마칠|여기까지|고마워|감사|도움이\s*됐|이제\s*알|정리됐|괜찮아졌/.test(text);

const looksIncomplete = (text) => {
  const t = cleanText(text);
  if (!t) return true;
  const completeEndings =
    /[.!?。？！]$|(습니다|습니까|어요|예요|네요|지요|까요|듯합니다|같습니다|있습니다|없습니다|바랍니다|주세요|드립니다|겠습니다|입니다)$/;
  if (completeEndings.test(t)) return false;
  return /셨|했|되|하|쓰셨|느껴|생각|마음과|에너지를|많이|수|있|없|같|때문|부터|에서|으로|에게|지만|고$/.test(t) || t.length < 80;
};

const postProcess = (text) => {
  let output = cleanText(text);

  output = output
    .replace(/^AI 마음지기\s*[:：]\s*/i, "")
    .replace(/^답변\s*[:：]\s*/i, "")
    .replace(/피로\/소진/g, "")
    .replace(/emotion_reflection/g, "")
    .replace(/좋은 응답[:：]?/g, "")
    .replace(/대화 예시[:：]?/g, "")
    .replace(/말이 바로 나오지 않는군요\.?/g, "")
    .replace(/그 이야기가 짧지만/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  return output;
};

const getClinicalPrompt = () => `
당신은 '모두의 마음연구소'의 AI 마음지기입니다.

당신의 역할은 단순히 위로하거나 조언하는 것이 아니라,
내담자가 자신의 마음을 알아차리고, 이해하며, 다시 연결할 수 있도록 돕는 것입니다.

당신은 정답을 알려주는 사람이 아니라,
사용자가 자신의 마음을 발견하도록 함께 탐색하는 동반자입니다.

【상담 철학】
사람은 문제 자체보다 자신의 마음을 충분히 이해하지 못할 때 더 오래 힘들어질 수 있습니다.
당신은 사용자의 마음을 대신 해석하거나 판단하지 않습니다.
사용자가 자신의 마음을 조금 더 선명하게 바라볼 수 있도록 함께합니다.

【상담 원칙】
- 항상 존중과 공감을 담은 존댓말을 사용합니다.
- 사용자가 실제로 말한 내용을 중심으로 대화를 이어갑니다.
- 대화의 전체 맥락을 충분히 이해한 후 자연스럽게 이어갑니다.
- 사용자의 속도를 존중합니다.
- 사용자의 표현을 가능한 그대로 반영합니다.
- 의미가 불분명한 경우에는 해석보다 먼저 이해한 내용이 맞는지 확인합니다.
- 확인되지 않은 내용은 추측하거나, 진단하거나, 단정하지 않습니다.
- 사용자가 충분히 말하기 전에는 성급하게 결론을 내리지 않습니다.
- 해결책을 서둘러 제시하기보다 사용자가 자신의 마음을 스스로 이해하도록 돕습니다.
- 같은 표현이나 같은 질문을 반복하지 않습니다.
- 이전 대화를 기억하며 자연스럽게 이어갑니다.
- 현재 대화에서 가장 적절한 방식으로 공감, 반영, 명료화, 이해, 질문, 정리 중 하나를 자연스럽게 선택합니다.
- 준비된 예시나 템플릿을 선택하지 않습니다.
- 매 응답은 현재까지의 대화를 바탕으로 새롭게 생성합니다.

【응답 방식】
- 응답은 일반적으로 2~4문장으로 작성합니다.
- 질문은 꼭 필요한 경우에만 하나 사용합니다.
- 질문보다 이해와 반영이 더 적절한 경우에는 질문하지 않습니다.
- 상담자가 실제 상담실에서 사용할 법한 자연스럽고 따뜻한 언어를 사용합니다.
- AI처럼 설명하거나 분석하는 말투보다 사람과 대화하는 말투를 사용합니다.
- 모든 문장은 반드시 끝까지 완성합니다.
- 조사나 어미 중간에서 문장을 멈추지 않습니다.
- 답변은 완결된 문장으로 끝냅니다.

【상담 제한】
욕설, 비방, 혐오, 차별, 모욕, 반복적인 공격적 표현이나 상담의 목적과 무관한 부적절한 대화가 지속될 경우에는 상담을 정중하게 제한합니다.

【안전】
자살, 자해, 타해 등 안전과 관련된 내용이 확인되면 안전을 최우선으로 안내합니다.

【가장 중요한 원칙】
사용자의 이야기를 분류하지 않습니다.
정해진 응답을 선택하지 않습니다.
상황별 템플릿을 사용하지 않습니다.
현재까지의 대화를 충분히 이해한 후, 그 순간 가장 적절한 새로운 응답을 생성합니다.
`;

const buildPrompt = ({ messages, minutes, shouldClose }) => {
  const conversation = buildConversationText(messages);
  const lastUser = [...messages].reverse().find((m) => m.role === "user")?.text || "";
  const userTurns = messages.filter((m) => m.role === "user").length;

  const closingRule = shouldClose
    ? `
【이번 응답은 상담 마무리 응답입니다】
이번 응답에서는 새로운 질문을 하지 않습니다.
다음 흐름으로 자연스럽게 마무리합니다.
1. 지금까지 사용자가 이야기한 마음을 따뜻하게 정리합니다.
2. 상담자가 줄 수 있는 심리학적 통찰을 하나 제공합니다.
3. 필요한 경우에는 심리검사를 추천합니다.
4. 추천하는 이유를 함께 설명합니다.
5. 마지막은 희망과 연결의 메시지로 마무리합니다.
`
    : `
【이번 응답은 상담 진행 응답입니다】
아직 상담을 마무리하지 않습니다.
사용자의 마지막 말과 전체 맥락을 바탕으로 자연스럽게 이어갑니다.
필요할 때만 질문을 하나 사용합니다.
`;

  return `
${getClinicalPrompt()}

현재 대화 시간: 약 ${minutes}분
사용자 발화 수: ${userTurns}회
상담 마무리 여부: ${shouldClose ? "마무리" : "진행"}

${closingRule}

현재 대화:
${conversation || "아직 대화가 시작되지 않았습니다."}

마지막 사용자 말:
${lastUser}

출력 규칙:
- AI 마음지기의 답변만 작성합니다.
- 분석 과정이나 지침 설명은 쓰지 않습니다.
- 제목을 붙이지 않습니다.
- 2~4문장으로 답합니다.
- 모든 문장을 반드시 끝까지 완성합니다.
- 답변은 완결된 문장으로 끝냅니다.
- 상담 진행 응답에서는 필요한 경우에만 질문을 하나 사용합니다.
- 상담 마무리 응답에서는 새로운 질문을 하지 않습니다.
`;
};

async function callGemini({ apiKey, prompt, maxOutputTokens = 1200 }) {
  const models = ["gemini-2.5-flash", "gemini-1.5-flash"];
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
              temperature: 0.65,
              topP: 0.9,
              topK: 32,
              maxOutputTokens
            }
          })
        }
      );

      const data = await response.json().catch(() => ({}));

      if (response.ok) {
        const text = data?.candidates?.[0]?.content?.parts
          ?.map((part) => part.text || "")
          .join("\n")
          .trim();

        return { text, model, raw: data };
      }

      lastError = { model, status: response.status, data };
      console.error("[MODUMAM AI] Gemini error", lastError);
    } catch (error) {
      lastError = { model, error: error.message };
      console.error("[MODUMAM AI] Gemini fetch error", lastError);
    }
  }

  const error = new Error("Gemini API call failed");
  error.detail = lastError;
  throw error;
}

async function completeIfNeeded({ apiKey, text }) {
  const finalText = postProcess(text);
  if (!looksIncomplete(finalText)) return finalText;

  const retryPrompt = `
아래 AI 답변이 중간에서 끊겼습니다.

끊긴 답변:
${finalText}

위 내용을 바탕으로 같은 의미를 유지하되,
완결된 자연스러운 상담 답변으로 다시 작성하세요.

규칙:
- 2~4문장
- 문장을 반드시 끝까지 완성
- 존댓말
- 진단하거나 단정하지 않기
- 질문은 필요할 때만 1개
- AI 답변만 출력
`;

  try {
    const retry = await callGemini({ apiKey, prompt: retryPrompt, maxOutputTokens: 900 });
    const retried = postProcess(retry.text);
    return retried || finalText || "지금 마음을 충분히 이해하기 위해 잠시 멈춰 듣고 있습니다. 방금 말씀하신 내용에서 가장 중요하게 남아 있는 부분을 함께 살펴보겠습니다.";
  } catch (error) {
    console.error("[MODUMAM AI] retry failed", error.detail || error);
    return finalText || "AI 마음지기 응답이 완성되지 않았습니다. 잠시 후 다시 보내 주세요.";
  }
}

export const handler = async function (event) {
  if (event.httpMethod === "OPTIONS") return jsonResponse({}, 200);
  if (event.httpMethod !== "POST") return jsonResponse({ error: "POST only" }, 405);

  try {
    const body = JSON.parse(event.body || "{}");
    const messages = normalizeMessages(body.messages);
    const sessionStart = Number(body.sessionStart || Date.now());
    const minutes = Math.max(0, Math.round((Date.now() - sessionStart) / 60000));
    const userTurns = messages.filter((m) => m.role === "user").length;
    const lastUser = [...messages].reverse().find((m) => m.role === "user")?.text || "";
    const allUserText = messages
      .filter((m) => m.role === "user")
      .map((m) => m.text)
      .join(" ");

    if (hasCrisisRisk(allUserText)) {
      return jsonResponse({
        text: makeCrisisReply(),
        isComplete: false,
        promptVersion: PROMPT_VERSION,
        engine: { mode: "clinical-core", safety: "CRISIS", fallback: "OFF" }
      });
    }

    if (hasAbusiveText(lastUser)) {
      return jsonResponse({
        text: makeLimitReply(),
        isComplete: false,
        promptVersion: PROMPT_VERSION,
        engine: { mode: "clinical-core", safety: "LIMITED", fallback: "OFF" }
      });
    }

    const apiKey =
      process.env.GEMINI_API_KEY ||
      process.env.GOOGLE_API_KEY ||
      process.env.GOOGLE_GEMINI_API_KEY;

    if (!apiKey) {
      return jsonResponse(
        {
          error: "GEMINI_API_KEY is missing",
          text: "AI 마음지기 연결 설정이 아직 완료되지 않았습니다. Netlify 환경변수에서 GEMINI_API_KEY를 확인해 주세요.",
          isComplete: false,
          promptVersion: PROMPT_VERSION,
          engine: { mode: "clinical-core", safety: "OK", fallback: "OFF" }
        },
        503
      );
    }

    const shouldClose = wantsClosing(lastUser) || minutes >= 15 || userTurns >= 12;
    const prompt = buildPrompt({ messages, minutes, shouldClose });
    const { text, model } = await callGemini({
      apiKey,
      prompt,
      maxOutputTokens: shouldClose ? 1600 : 1200
    });

    const finalText = await completeIfNeeded({ apiKey, text });

    return jsonResponse({
      text: finalText,
      isComplete: shouldClose,
      promptVersion: PROMPT_VERSION,
      engine: {
        mode: "clinical-core-stable",
        safety: "OK",
        fallback: "OFF",
        model,
        minutes,
        userTurns,
        shouldClose
      }
    });
  } catch (error) {
    console.error("[MODUMAM AI] handler error", error.detail || error);

    return jsonResponse(
      {
        error: "AI mindjigi handler error",
        text: "AI 마음지기 연결이 잠시 원활하지 않습니다.\n\n이전처럼 정해진 상담 문장으로 대신 답하지 않겠습니다. 잠시 후 다시 보내 주세요.",
        isComplete: false,
        promptVersion: PROMPT_VERSION,
        engine: { mode: "clinical-core-stable", safety: "UNKNOWN", fallback: "OFF" }
      },
      502
    );
  }
};
