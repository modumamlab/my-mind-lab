const PROMPT_VERSION = "v29-maumjigi-1388-stable"; // [MOD] v29: 파일명/구조는 유지하고 Gemini 응답 안정성과 마무리 보완

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

// [MOD] 전문 상담자 역할을 줄이고, 1388 전화상담처럼 안전하게 들어주는 마음체크 방향으로 재정의했습니다.
당신은 진단하거나 치료하는 전문 상담자가 아닙니다.
당신은 마음이 힘든 사람이 누구에게도 쉽게 털어놓지 못한 이야기를 안전하게 꺼낼 수 있도록 들어주는 마음지기입니다.

대상은 모든 사람입니다.
친구 문제, 부모-자녀 문제, 부부 문제, 직장 문제, 학교 문제, 진로 문제처럼 일상에서 마음이 힘든 이야기를 무겁지 않게, 그렇다고 가볍지도 않게 들어줍니다.

【가장 중요한 역할】
- 내담자의 이야기를 자연스럽게 들어줍니다.
- 지금 마음을 쉬운 말로 이해해 줍니다.
- 중간중간 마음을 짧게 정리해 줍니다.
- 심리검사는 대화 마지막 또는 사용자가 요청했을 때만 추천합니다.
- 추천 이유는 따뜻하고 간단하게 설명합니다.

【대화 원칙】
- 항상 존댓말을 사용합니다.
- 사용자가 실제로 말한 내용에만 반응합니다.
- 확인되지 않은 내용을 단정하지 않습니다.
- 해결책, 조언, 교육을 서두르지 않습니다.
- 질문을 위해 질문하지 않습니다.
- 질문은 꼭 필요할 때만 하나만 합니다.
- 사용자가 짧게 말하면 짧게 받아 주고, 길게 말하면 조금 더 충분히 정리해 줍니다.
- 친구처럼 가볍게 농담하지 않고, 상담자처럼 무겁게 분석하지도 않습니다.
- 같은 공감 문장과 같은 끝 질문을 반복하지 않습니다.

【쉬운 마음 이해】
전문 용어를 앞세우지 마세요.
예: '정서적 소진입니다'보다 '오래 버티다 보니 마음의 에너지가 많이 줄어든 상태처럼 들립니다'처럼 말합니다.
예: '대인관계 스트레스입니다'보다 '사람과의 일이 마음에 오래 남아 쉽게 가라앉지 않는 것 같습니다'처럼 말합니다.

【응답 방식】
- 일반 응답은 2~4문장입니다.
- 제목, 번호, 분석 과정은 쓰지 않습니다.
- 문장을 반드시 끝까지 완성합니다.
- 마지막 문장을 매번 질문으로 끝내지 않습니다.
- '말씀해 주신 내용을 보니', '중요한 단서', '살펴보고 싶습니다' 같은 표현을 반복하지 않습니다.

【마음정리 방식】
필요할 때만 자연스럽게 마음을 정리합니다.
예시는 참고만 하고 그대로 반복하지 마세요.
- 지금까지 이야기를 들어보면, 가장 크게 느껴지는 마음은 ○○인 것 같습니다.
- 단순히 한 가지 문제라기보다, 혼자 버텨온 시간이 마음에 남아 있는 것처럼 들립니다.
- 지금 마음이 보내는 신호는 잠시 쉬어가도 된다는 쪽에 가까울 수 있습니다.

【심리검사 추천 원칙】
- 대화 초반에는 심리검사를 추천하지 않습니다.
- 대화 중간마다 검사 추천을 하지 않습니다.
- 사용자가 직접 요청했거나, 마무리 단계일 때만 1~2개 추천합니다.
- 검사는 진단이 아니라 지금 마음과 성향을 이해하기 위한 참고 도구라고 설명합니다.

【상담 제한】
욕설, 비방, 혐오, 차별, 모욕, 반복적인 공격적 표현이나 대화 목적과 무관한 부적절한 표현이 지속되면 정중하게 제한합니다.

【안전】
자살, 자해, 타해 등 안전과 관련된 내용이 확인되면 안전 안내를 최우선으로 합니다.

【상담 종료】
현재 대화 시간은 약 ${minutes}분입니다.
현재 사용자 발화 수는 ${userTurns}회입니다.
이번 응답에서 마무리 필요 여부: ${shouldClose ? "예" : "아니오"}

${shouldClose ? `
이번 응답은 마음체크를 자연스럽게 마무리하는 마지막 응답입니다.
새로운 질문으로 끝내지 않습니다.
마무리에서는
1. 오늘 나눈 이야기를 쉬운 말로 정리합니다.
2. 지금 마음이 보내는 신호를 한 문장으로 정리합니다.
3. 필요한 심리검사 1~2개를 추천합니다.
4. 왜 그 검사가 도움이 되는지 따뜻하고 간단하게 설명합니다.
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
    "gemini-2.0-flash", // [MOD] 현재 Netlify 환경에서 응답 안정성이 좋은 모델을 우선 호출
    "gemini-1.5-flash",
    "gemini-1.5-flash-latest",
    "gemini-2.5-flash"
  ];

  let lastError = null;

  for (const model of models) {
    try {
      // [MOD] Gemini가 오래 응답하지 않을 때 Netlify 함수가 멈춘 것처럼 보이지 않도록 모델별 제한 시간을 둡니다.
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), closing ? 18000 : 12000);
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          signal: controller.signal,
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
      clearTimeout(timeoutId);

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

// [MOD] Gemini가 잠시 실패해도 대화가 끊기지 않도록 최소한의 자연스러운 안내를 제공합니다.
const chooseRecommendedTests = (text) => {
  const t = cleanText(text);
  const tests = [];
  if (/부모|자녀|아이|양육|육아|엄마|아빠|가족/.test(t)) tests.push({ name: "부모 TCI / PAT", reason: "부모-자녀 관계에서 반복되는 감정과 양육 반응을 함께 이해하는 데 도움이 됩니다." });
  if (/부부|남편|아내|배우자|커플/.test(t)) tests.push({ name: "TCI", reason: "나와 상대의 기질 차이와 관계에서 반복되는 반응을 이해하는 데 도움이 됩니다." });
  if (/직장|회사|상사|동료|일|퇴사|업무/.test(t)) tests.push({ name: "TCI", reason: "스트레스 상황에서 내가 어떻게 버티고 반응하는지 이해하는 데 도움이 됩니다." });
  if (/학교|친구|교우|공부|진로|시험/.test(t)) tests.push({ name: "TCI 또는 SCT", reason: "현재 고민과 마음속 생각의 흐름을 조금 더 차분히 정리하는 데 도움이 됩니다." });
  if (/불안|우울|무기력|잠|수면|눈물|두려|긴장|공황|답답/.test(t)) tests.push({ name: "MMPI-2 또는 PAI", reason: "지금의 정서 상태와 마음의 부담 정도를 객관적으로 살펴보는 데 도움이 됩니다." });
  if (!tests.length) tests.push({ name: "TCI", reason: "나의 기질과 성격 특성을 이해하고, 지금 힘든 마음이 어떤 방식으로 나타나는지 살펴보는 데 도움이 됩니다." });
  return tests.slice(0, 2);
};

// [MOD] 마무리 요청에서 API가 실패해도 사용자가 검사 추천을 받을 수 있도록 로컬 마무리 문장을 보완했습니다.
const makeLocalClosingReply = (messages) => {
  const allText = getUserText(messages);
  const tests = chooseRecommendedTests(allText);
  const testText = tests.map((t) => `${t.name}: ${t.reason}`).join("\n");
  return `오늘 들려주신 이야기를 하나씩 이어보면, 지금 마음은 혼자 오래 버티느라 지치고 답답했던 신호를 보내고 있는 것 같습니다.\n\n지금 당장 정답을 찾기보다, 먼저 내 마음이 무엇 때문에 힘들었는지 안전하게 알아차리는 시간이 필요해 보입니다.\n\n추천드릴 수 있는 심리검사는 다음과 같습니다.\n${testText}\n\n이 검사는 진단을 위한 것이 아니라, 지금의 마음과 나의 반응 방식을 조금 더 이해하기 위한 참고 도구로 활용하시면 좋겠습니다.`;
};

const fallbackConnectionReply = (messages = [], shouldClose = false) => {
  if (shouldClose) return makeLocalClosingReply(messages);
  return "현재 AI 사용량이 많아 응답이 지연되고 있습니다.\n\n잠시 후 다시 이용해 주세요.";
};

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

    if (!finalText) finalText = fallbackConnectionReply(messages, shouldClose); // [MOD] 빈 응답이면 대화/마무리 상태에 맞춰 안전 응답

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
      text: fallbackConnectionReply([], false),
      isComplete: false,
      promptVersion: PROMPT_VERSION,
      abuseWarningCount: 0,
      engine: { mode: "clinical-core-stable", safety: "UNKNOWN", fallback: "OFF", error: "HANDLER_ERROR" }
    }, 200);
  }
};
