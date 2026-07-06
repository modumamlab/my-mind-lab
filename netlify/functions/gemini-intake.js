const { analyzeMessage, buildSessionState, getCompleteness } = require("../../ai/clinicalReasoning");
const { chooseMode, buildDirectorNote } = require("../../ai/conversationDirector");
const { buildExpressionGuide } = require("../../ai/expressionMemory");
const { buildQuestionPlan } = require("../../ai/questionPlanner");
const { detectSafety, buildAbuseWarning, buildRiskResponse } = require("../../ai/safetyGuard");
const { getElapsedMinutes, getTimePhase, buildTimeGuide, WRAP_UP_MINUTES } = require("../../ai/sessionTime");
const { buildProfessionalSummary } = require("../../ai/intakeSummary");

async function callGemini(apiKey, payloadText, systemPrompt) {
  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: systemPrompt }] },
      contents: [{ role: "user", parts: [{ text: payloadText }] }],
      generationConfig: { temperature: 0.52, topP: 0.82, maxOutputTokens: 520 },
    }),
  });
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
  return String(text || "").replace(/^```[a-zA-Z]*\n?/, "").replace(/```$/g, "").trim();
}

function cleanAwkward(text) {
  return String(text || "")
    .replace(/[^.!?\n]*?(된|됐|됀)\s*(것|거|건)?\s*같[아아요]*\s*부터[^.!?\n]*/g, "생각보다 시간이 꽤 흘렀군요.")
    .replace(/[^.!?\n]*?인\s*(것|거|건)?\s*같[아아요]*\s*부터[^.!?\n]*/g, "그렇게 느끼기 시작한 지 시간이 좀 되었군요.")
    .replace(/위축\s*처럼/g, "위축감이")
    .replace(/말씀해\s*주신\s*내용을\s*보니[,.]?\s*/g, "")
    .replace(/지금\s*이야기에서\s*중요한\s*단서를\s*조금\s*더\s*찾아보겠습니다[.。]?\s*/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

const SYSTEM_PROMPT = `
당신은 모두의 마음연구소의 AI 마음지기입니다.
AI 마음체크인은 무료 AI 마음리포트보다 더 전문적인 10~15분 AI 체크인 상담입니다.

핵심:
내담자가 "내 이야기를 정말 듣고 있구나"라고 느끼도록 자연스럽게 대화합니다.
상담을 대신하지 않지만 임상심리사의 초기면접 흐름을 참고합니다.

중요한 금지:
- "말씀해 주신 내용을 보니"로 반복 시작하지 않습니다.
- "중요한 단서", "흐름이라면", "생활에 얼마나 번지고" 같은 기계적 표현을 반복하지 않습니다.
- 매번 공감 후 질문하는 구조를 반복하지 않습니다.
- 질문이 필요하지 않으면 질문하지 않습니다.

대화:
- 실제 상담실에서 입으로 말하듯 자연스러운 해요체를 씁니다.
- 내담자 원문을 복사하거나 이어 붙이지 않습니다.
- 1~4문장으로 짧고 자연스럽게 답합니다.
- 질문은 필요할 때만 1개입니다.
- 위기 표현은 안전 안내가 우선입니다.
`;

exports.handler = async function(event) {
  try {
    const body = JSON.parse(event.body || "{}");
    const messages = Array.isArray(body.messages) ? body.messages : [];
    const sessionStart = body.sessionStart || Date.now();
    const abuseWarningCount = Number(body.abuseWarningCount || 0);
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return { statusCode: 500, body: JSON.stringify({ error: "GEMINI_API_KEY가 설정되지 않았습니다." }) };
    }

    const userMessages = messages.filter(isUserMessage).map(getMessageText);
    const aiMessages = messages.filter((m) => !isUserMessage(m)).map(getMessageText);
    const latestUser = userMessages[userMessages.length - 1] || "";

    const safety = detectSafety(latestUser, abuseWarningCount);
    if (safety.isRisk) return { statusCode: 200, body: JSON.stringify({ text: buildRiskResponse(), abuseWarningCount }) };
    if (safety.isAbuse) {
      return {
        statusCode: 200,
        body: JSON.stringify({ text: buildAbuseWarning(safety.warningCount), abuseWarningCount: safety.warningCount, blocked: safety.shouldBlock }),
      };
    }

    const latestAnalysis = analyzeMessage(latestUser);
    const state = buildSessionState(userMessages);
    const completeness = getCompleteness(state);
    const elapsedMinutes = getElapsedMinutes(sessionStart);
    const timePhase = getTimePhase(elapsedMinutes);

    if (timePhase === "ended" || elapsedMinutes >= WRAP_UP_MINUTES || (elapsedMinutes >= 10 && completeness.ratio >= 0.55)) {
      return {
        statusCode: 200,
        body: JSON.stringify({ text: buildProfessionalSummary(state, elapsedMinutes), finished: true, abuseWarningCount }),
      };
    }

    const mode = chooseMode(state, aiMessages, timePhase);
    const questionPlan = buildQuestionPlan(state, latestAnalysis, mode);
    const expressionGuide = buildExpressionGuide(aiMessages);

    const payload = `
[AI 마음체크인 운영 정보]
- 경과 시간: ${elapsedMinutes.toFixed(1)}분
- 시간 단계: ${timePhase}
- 시간 지침: ${buildTimeGuide(elapsedMinutes)}

[상담 상태]
${JSON.stringify(state, null, 2)}

[접수면접 완성도]
${JSON.stringify(completeness, null, 2)}

[최신 발화 의미 분석]
${JSON.stringify(latestAnalysis, null, 2)}

[이번 응답 모드]
${mode}

[대화 디렉터 지시]
${buildDirectorNote(mode)}

[질문 계획]
${questionPlan || "질문하지 않아도 됩니다. 필요하면 짧게 머물러 주세요."}

[반복 방지 지침]
${expressionGuide}

중요:
- 내담자의 원문 문장은 제공되지 않습니다.
- 위의 의미 정보만 바탕으로 답하세요.
- 상담자가 실제로 말하듯 자연스럽게 한 턴만 작성하세요.
- 질문 모드가 아니면 질문하지 마세요.
`;

    let text = stripMarkdown(await callGemini(apiKey, payload, SYSTEM_PROMPT));
    text = cleanAwkward(text);

    return { statusCode: 200, body: JSON.stringify({ text, abuseWarningCount, elapsedMinutes, timePhase }) };
  } catch (error) {
    return { statusCode: 500, body: JSON.stringify({ error: error.message }) };
  }
};
