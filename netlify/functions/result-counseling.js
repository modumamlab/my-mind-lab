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

const detectClinicalNeed = (messages) => {
  const lastUser = [...normalizeMessages(messages)].reverse().find((message) => message.role === "user")?.text || "";
  return {
    directionLoss: /뭘\s*해야|무엇을\s*해야|어떻게\s*해야|방향을\s*모르|결정을\s*못|선택을\s*못|막막|모르겠/.test(lastUser),
    informationNeed: /(알려\s*줘|설명해|방법|절차|어디서|어떻게\s*진행|차이|의미|정보|지원|기관)/.test(lastUser),
    actionDifficulty: /(시작을\s*못|실천을\s*못|미루|움직이기\s*힘|행동으로\s*못|계획만)/.test(lastUser)
  };
};

const detectConversationMove = (messages) => {
  const normalized = normalizeMessages(messages);
  const lastUser = [...normalized].reverse().find((message) => message.role === "user")?.text || "";
  const compact = lastUser.replace(/\s+/g, "");
  const acknowledgement = /^(응|네|예|그래|좋아|알겠어|알겠습니다|괜찮아|맞아|그렇구나|해볼게|해볼께|고마워|감사해|오케이|ok)[.!?~]*$/i.test(compact);
  const question = /[?？]|왜|어떻게|무엇|뭐|어디|언제|알려|설명/.test(lastUser);
  const disagreement = /(아닌데|아니야|안 맞|다른데|그렇지 않|잘 모르겠|동의하지 않)/.test(lastUser);
  const concreteExample = lastUser.length >= 12 && !acknowledgement && !question;
  return { acknowledgement, question, disagreement, concreteExample, lastUser };
};

const buildConversationDirector = ({ messages, clinicalNeed, conversationMove }) => {
  const normalized = normalizeMessages(messages);
  const userTurns = normalized.filter((message) => message.role === "user").length;
  const lastUser = conversationMove?.lastUser || "";

  let phase = "orientation";
  if (userTurns >= 2) phase = "exploration";
  if (userTurns >= 5) phase = "integration";
  if (userTurns >= 8) phase = "consolidation";

  let task = "interpret";
  if (conversationMove?.question || clinicalNeed?.informationNeed) task = "answer";
  else if (conversationMove?.disagreement) task = "recalibrate";
  else if (conversationMove?.acknowledgement) task = "advance";
  else if (conversationMove?.concreteExample) task = "connect";
  else if (clinicalNeed?.directionLoss) task = "structure";
  else if (clinicalNeed?.actionDifficulty) task = "apply";

  const taskGuides = {
    interpret: "검사자료의 한 가지 핵심 의미를 쉬운 말로 설명하고 실제 경험과 맞는지 확인합니다.",
    answer: "내담자의 질문에 먼저 직접 답한 뒤, 필요한 경우에만 검사자료와 연결합니다.",
    recalibrate: "검사 해석보다 내담자의 실제 경험을 우선하고 기존 해석을 수정하거나 보류합니다.",
    advance: "직전 내용을 반복하지 않고 아직 다루지 않은 중요한 검사 주제 하나로 이동합니다.",
    connect: "내담자가 제시한 사례의 생활 내용 자체가 아니라 그 사례에 드러난 심리적 기능과 패턴을 검사자료와 연결합니다.",
    structure: "검사결과에서 확인할 수 있는 선택지나 관점을 최대 3개로 구조화합니다.",
    apply: "검사결과에서 확인된 패턴을 관찰하거나 조절할 수 있는 작고 관련성 높은 적용을 하나 제안합니다."
  };

  const phaseGuides = {
    orientation: "전체 결과의 방향과 검사 한계를 안내하는 단계",
    exploration: "주요 특성과 실제 경험을 대조하는 단계",
    integration: "여러 검사결과와 생활 패턴을 통합해 이해하는 단계",
    consolidation: "핵심 통찰과 앞으로 살펴볼 점을 정리하는 단계"
  };

  return {
    purpose: "psychological_assessment_feedback",
    phase,
    phaseGuide: phaseGuides[phase],
    task,
    taskGuide: taskGuides[task],
    userTurns,
    lastUser
  };
};

const meaningTokens = (value) => {
  const stopwords = new Set([
    "백인영님","검사결과","검사","결과","말씀","말씀해","말씀하신","것으로","보입니다",
    "나타났습니다","있습니다","있어요","입니다","그리고","하지만","또한","이러한","통해",
    "자신","스스로","마음","부분","경향","도움","생각","정도","오늘","지금","내담자"
  ]);
  return new Set(
    clean(value)
      .toLowerCase()
      .replace(/[^0-9a-z가-힣\s]/g, " ")
      .split(/\s+/)
      .map((token) => token.replace(/(은|는|이|가|을|를|에|의|도|로|으로|와|과|에서|에게|께서)$/g, ""))
      .filter((token) => token.length >= 2 && !stopwords.has(token))
  );
};

const semanticOverlap = (a, b) => {
  const left = meaningTokens(a);
  const right = meaningTokens(b);
  if (!left.size || !right.size) return 0;
  let intersection = 0;
  left.forEach((token) => { if (right.has(token)) intersection += 1; });
  return intersection / Math.max(1, Math.min(left.size, right.size));
};

const isSemanticallyRepetitive = (candidate, messages) => {
  const previousAssistant = normalizeMessages(messages)
    .filter((message) => message.role === "assistant")
    .slice(-3);
  return previousAssistant.some((message) => semanticOverlap(candidate, message.text) >= 0.5);
};

const buildPrompt = ({ mode, reportText, integratedReportText, messages, clinicalNeed, conversationMove, director }) => {
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
- 조언보다 통찰을 먼저 제공하고, 방향을 제시할 때는 최대 3개의 선택지만 구조화합니다.
- 잠정적 의견을 제시할 수 있지만 반드시 검사자료 또는 내담자의 직접 표현에 근거를 둡니다.
- 선택지의 이점·부담·필요조건을 짧게 설명하고 최종 결정은 내담자에게 남깁니다.
- 행동 제안은 오늘 또는 이번 주에 실행 가능한 한 가지로 작게 제시합니다.
- 정책, 기관, 비용, 지원제도처럼 최신 확인이 필요한 정보는 확인된 자료가 없으면 단정하지 않습니다.

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

  if (mode === "closing") {
    return `${common}
예약된 50분의 상담 시간이 완료되어 상담을 종결하는 단계입니다.

상담 대화:
${conversation || "대화 내용 없음"}

종결 응답 작성 원칙:
- 내담자가 마지막으로 남긴 말을 먼저 짧게 받아줍니다.
- 오늘 함께 확인한 핵심 의미를 1~2가지로 정리합니다.
- 검사결과는 내담자를 단정하는 결론이 아니라 자기이해를 위한 자료임을 자연스럽게 상기시킵니다.
- 필요한 경우 전문가 상담에서 이어볼 수 있음을 안내합니다.
- 상담 시간이 완료되어 오늘 상담을 마무리한다는 사실을 분명히 말합니다.
- 새로운 질문이나 새로운 주제를 제시하지 않습니다.
- 과제나 행동계획을 새로 만들지 않습니다.
- 따뜻하고 안정적인 존댓말로 4~7문장, 450자 이내로 완결합니다.
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

Conversation Director:
- 상담 목적: 심리검사 결과 해석상담
- 현재 단계: ${director?.phaseGuide || "주요 특성과 실제 경험을 대조하는 단계"}
- 이번 응답의 핵심 과업: ${director?.taskGuide || "검사결과의 한 가지 의미를 설명합니다."}
- 사용자 대화 수: ${director?.userTurns || 0}

응답 원칙:
- 이번 응답에서는 위 핵심 과업 하나만 수행합니다.
- 내담자가 제시한 일상 사례는 그 행동 자체를 코칭하기보다, 그 사례에 드러난 정서·사고·관계·대처 패턴을 이해하는 자료로 사용합니다.
- 일상 사례가 검사결과와 관련이 약하면 억지로 연결하지 말고, 짧게 인정한 뒤 더 중요한 검사 주제로 자연스럽게 이동합니다.
- 검사결과를 생활 속 경험과 연결할 때에는 어떤 검사 근거와 연결되는지 명확히 하되, 전문용어는 쉬운 말로 바꿉니다.
- 직전 답변에서 이미 설명한 의미를 표현만 바꾸어 반복하지 않습니다.
- 내담자가 짧게 수용하면 재설명하지 말고 다음 핵심 검사 주제로 이동합니다.
- 내담자가 해석에 동의하지 않으면 실제 경험을 우선하고 해석을 수정하거나 보류합니다.
- 질문은 검사결과의 의미를 확인하거나 실제 경험과 대조하기 위해 필요할 때만 하나 사용합니다.
- 행동 제안은 검사결과에서 확인된 패턴을 더 잘 관찰하거나 조절하는 데 직접 도움이 될 때만 제시합니다.
- 일반 생활관리, 생산성 코칭, 과제 수행 자체가 대화의 목적이 되지 않도록 합니다.
- 2~5문장, 전체 700자 이내로 완결되게 작성합니다.
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
            maxOutputTokens: 4096
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

    const finishReason = candidate?.finishReason || "";
    if (finishReason === "MAX_TOKENS") {
      const error = new Error("Gemini 응답이 문장 중간에서 잘렸습니다.");
      error.status = 422;
      error.model = model;
      error.finishReason = finishReason;
      error.apiData = data;
      throw error;
    }

    return {
      text: removeImmediateDuplicateParagraphs(text),
      model,
      finishReason
    };
  } finally {
    clearTimeout(timeoutId);
  }
}

async function callGemini({ apiKey, prompt }) {
  const configuredModels = [
    process.env.GEMINI_PRIMARY_MODEL,
    process.env.GEMINI_FALLBACK_MODEL,
    "gemini-2.5-flash"
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

    const mode = ["overview", "chat", "summary", "closing"].includes(body.mode) ? body.mode : "chat";
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
        promptVersion: "mml-v6-result-counseling-graceful-end"
      });
    }

    const apiKey =
      process.env.GEMINI_API_KEY ||
      process.env.GOOGLE_API_KEY ||
      process.env.GOOGLE_GEMINI_API_KEY;

    if (!apiKey) {
      return jsonResponse({ error: "GEMINI_API_KEY가 설정되지 않았습니다." }, 500);
    }

    const clinicalNeed = detectClinicalNeed(messages);
    const conversationMove = detectConversationMove(messages);
    const director = buildConversationDirector({ messages, clinicalNeed, conversationMove });

    const prompt = buildPrompt({
      mode,
      reportText,
      integratedReportText,
      messages,
      clinicalNeed,
      conversationMove,
      director
    });
    let result = await callGemini({ apiKey, prompt });

    if (mode === "chat" && isSemanticallyRepetitive(result.text, messages)) {
      const recentAssistant = messages
        .filter((message) => message.role === "assistant")
        .slice(-3)
        .map((message, index) => `[이전 답변 ${index + 1}] ${message.text}`)
        .join("\n\n");

      const retryPrompt = `${prompt}

중요한 재작성 지시:
방금 만든 초안이 이전 답변과 의미상 겹칩니다.
아래 이전 답변에서 이미 다룬 해석과 결론은 생략하세요.
Conversation Director가 지정한 현재 단계와 핵심 과업에 따라 새로운 대화 기능 하나만 수행하세요.
마지막 내담자 말의 표면적 행동을 코칭하지 말고, 검사 해석에 필요한 심리적 의미만 다루세요.

${recentAssistant}`;

      result = await callGemini({ apiKey, prompt: retryPrompt });
    }

    return jsonResponse({
      text: result.text,
      provider: "gemini",
      model: result.model,
      finishReason: result.finishReason,
      integratedReportApplied: Boolean(integratedReportText),
      clinicalNeed,
      director: { phase: director.phase, task: director.task },
      promptVersion: "mml-v6-result-counseling-graceful-end"
    });
  } catch (error) {
    const detail = Array.isArray(error?.detail) ? error.detail : [{ message: clean(error?.message || error) }];
    console.error("[AI RESULT COUNSELING FAILED]", detail);

    return jsonResponse({
      error: "AI 결과 해석상담 응답을 생성하지 못했습니다.",
      detail: process.env.CONTEXT === "dev" || process.env.NETLIFY_DEV === "true" ? detail : undefined,
      promptVersion: "mml-v6-result-counseling-graceful-end"
    }, 500);
  }
};
