const { analyzeMessage, buildSessionState, shouldFinalize, buildFinalSummary } = require("../../ai/clinicalReasoning");
const { chooseMode, buildDirectorNote } = require("../../ai/conversationDirector");
const { buildExpressionGuide } = require("../../ai/expressionMemory");
const { buildQuestionPlan } = require("../../ai/questionPlanner");

async function callGemini(apiKey, payloadText, systemPrompt) {
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: systemPrompt }] },
        contents: [{ role: "user", parts: [{ text: payloadText }] }],
        generationConfig: {
          temperature: 0.5,
          topP: 0.85,
          maxOutputTokens: 520,
        },
      }),
    }
  );

  const data = await response.json();
  if (data.error) throw new Error(data.error.message || "Gemini API 오류");
  return data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || "";
}

function getMessageText(m) {
  return String(m?.text || m?.content || m?.message || m?.value || "").trim();
}

function isUserMessage(m) {
  const role = m?.role || m?.sender || m?.type || m?.from;
  return role === "user" || role === "내담자";
}

function stripMarkdown(text) {
  return String(text || "")
    .replace(/^```[a-zA-Z]*\n?/, "")
    .replace(/```$/g, "")
    .trim();
}

function cleanAwkward(text) {
  return String(text || "")
    .replace(/[^.!?\n]*?(된|됐|됀)\s*(것|거|건)?\s*같[아아요]*\s*부터[^.!?\n]*/g, "생각보다 시간이 꽤 흘렀군요.")
    .replace(/[^.!?\n]*?인\s*(것|거|건)?\s*같[아아요]*\s*부터[^.!?\n]*/g, "그렇게 느끼기 시작한 지 시간이 좀 되었군요.")
    .replace(/위축\s*처럼/g, "위축감이")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function hasAwkward(text) {
  const t = String(text || "").replace(/\s+/g, " ");
  return /(된|됐|됀)\s*(것|거|건)?\s*같[아아요]*\s*부터/.test(t)
    || /인\s*(것|거|건)?\s*같[아아요]*\s*부터/.test(t)
    || /위축\s*처럼/.test(t)
    || /같아부터|같아요부터|같다면부터/.test(t);
}

function isShortDurationOnly(text, analysis) {
  const raw = String(text || "").replace(/\s+/g, " ").trim();
  return Boolean(analysis.duration) && raw.length <= 45;
}

function buildDurationOnlyResponse(analysis) {
  const duration = analysis.duration || "꽤 오랜";
  if (duration.includes("반년")) {
    return "벌써 반년 가까운 시간이 지났네요.\n\n그 시간을 혼자 견디는 동안 마음도 많이 지치셨을 것 같아요.";
  }
  return `${duration} 시간이 지났군요.\n\n짧지 않은 시간 동안 혼자 감당해 오셨을 것 같아요.`;
}

function sanitizeSessionForGemini(sessionState, latestAnalysis, mode, questionPlan, expressionGuide) {
  return `
[상담 상태]
- 내담자 답변 수: ${sessionState.userCount}
- 확인된 기간: ${sessionState.duration || "아직 명확하지 않음"}
- 주제 단서: ${sessionState.topics.length ? sessionState.topics.join(", ") : "아직 명확하지 않음"}
- 감정 단서: ${sessionState.emotions.length ? sessionState.emotions.join(", ") : "아직 명확하지 않음"}
- 신체 반응: ${sessionState.body.length ? sessionState.body.join(", ") : "아직 명확하지 않음"}
- 생활 영향: ${sessionState.hasImpact ? "일부 확인됨" : "아직 확인되지 않음"}
- 해결 시도: ${sessionState.hasCoping ? "일부 확인됨" : "아직 확인되지 않음"}
- 상담 경험: ${sessionState.hasCounselingHistory ? "일부 확인됨" : "아직 확인되지 않음"}

[최신 발화에서 이해한 의미]
- 기간: ${latestAnalysis.duration || "없음"}
- 대상/관계: ${latestAnalysis.target || latestAnalysis.topic.join(", ") || "없음"}
- 감정: ${latestAnalysis.emotion.length ? latestAnalysis.emotion.join(", ") : "없음"}
- 신체 반응: ${latestAnalysis.body.length ? latestAnalysis.body.join(", ") : "없음"}
- 생활 영향 단서: ${latestAnalysis.impact ? "있음" : "없음"}
- 해결 시도 단서: ${latestAnalysis.coping ? "있음" : "없음"}

[이번 응답 모드]
${mode}

[대화 디렉터 지시]
${buildDirectorNote(mode)}

[질문 계획]
${questionPlan || "질문하지 않아도 됩니다. 필요하면 짧게 머물러 주세요."}

[반복 방지 지침]
${expressionGuide}
`;
}

const SYSTEM_PROMPT = `
당신은 모두의 마음연구소의 AI 마음지기입니다.
무료 AI 마음리포트보다 더 전문적인 AI 마음 체크인 상담을 제공합니다.

핵심:
좋은 글을 쓰지 말고, 실제 상담실에서 자연스럽게 대화하세요.
내담자의 원문을 이어붙이지 말고, 의미를 이해해 상담자의 언어로 새롭게 말하세요.

대화 규칙:
- 매번 같은 구조로 답하지 않습니다.
- 질문은 필요할 때만 1개만 합니다.
- 질문 없는 짧은 반응도 허용합니다.
- 최근 AI 답변과 같은 표현, 같은 시작, 같은 질문을 반복하지 않습니다.
- 생활영향 질문을 너무 빨리 반복하지 않습니다.
- 아직 충분히 듣지 못했으면 심리검사를 추천하지 않습니다.
- 위기 표현은 안전 확인과 112, 119, 109 안내를 우선합니다.

답변 길이:
보통 1~4문장.
말하듯 자연스러운 해요체.
`;

exports.handler = async function (event) {
  try {
    const { messages } = JSON.parse(event.body || "{}");
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return {
        statusCode: 500,
        body: JSON.stringify({ error: "GEMINI_API_KEY가 설정되지 않았습니다." }),
      };
    }

    const safeMessages = Array.isArray(messages) ? messages : [];
    const userMessages = safeMessages.filter(isUserMessage).map(getMessageText);
    const aiMessages = safeMessages.filter((m) => !isUserMessage(m)).map(getMessageText);
    const latestUser = userMessages[userMessages.length - 1] || "";

    const latestAnalysis = analyzeMessage(latestUser);
    const sessionState = buildSessionState(userMessages);
    const mode = chooseMode(sessionState, aiMessages);
    const expressionGuide = buildExpressionGuide(aiMessages);
    const questionPlan = buildQuestionPlan(sessionState, latestAnalysis, mode);

    if (latestAnalysis.isRisk) {
      return {
        statusCode: 200,
        body: JSON.stringify({
          text: "지금은 무엇보다 안전이 먼저입니다. 혼자 견디기에는 너무 큰 고통일 수 있어요.\n\n지금 바로 자신을 해칠 위험이 있다면 112, 119, 자살예방상담전화 109 또는 가까운 응급실에 도움을 요청해 주세요.",
        }),
      };
    }

    if (isShortDurationOnly(latestUser, latestAnalysis)) {
      return {
        statusCode: 200,
        body: JSON.stringify({ text: buildDurationOnlyResponse(latestAnalysis) }),
      };
    }

    if (shouldFinalize(sessionState)) {
      return {
        statusCode: 200,
        body: JSON.stringify({ text: buildFinalSummary(sessionState) }),
      };
    }

    const payload = `
현재 AI 마음 체크인 상담 중입니다.

${sanitizeSessionForGemini(sessionState, latestAnalysis, mode, questionPlan, expressionGuide)}

다음 한 턴만 작성하세요.
- 내담자 원문은 제공되지 않습니다. 위의 의미 정보만 바탕으로 답하세요.
- 이번 응답 모드를 반드시 따르세요.
- 질문 모드가 아니면 질문하지 마세요.
- 실제 상담자가 입으로 말하듯 자연스럽게 작성하세요.
`;

    let text = stripMarkdown(await callGemini(apiKey, payload, SYSTEM_PROMPT));
    text = cleanAwkward(text);

    if (hasAwkward(text)) {
      const rewritePayload = `
아래 답변은 한국어 상담 대화로 어색합니다.

어색한 답변:
${text}

상담 정보:
${sanitizeSessionForGemini(sessionState, latestAnalysis, mode, questionPlan, expressionGuide)}

다시 작성하세요.
- 원문 이어붙이기 금지
- 짧고 자연스럽게
- 이번 모드: ${mode}
- 질문은 모드가 gentle_question일 때만 1개
`;
      text = cleanAwkward(stripMarkdown(await callGemini(apiKey, rewritePayload, SYSTEM_PROMPT)));
    }

    return {
      statusCode: 200,
      body: JSON.stringify({ text }),
    };
  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message }),
    };
  }
};
