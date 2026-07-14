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

const clean = (value, max = 12000) => String(value || "").trim().slice(0, max);

function buildPrompt(body) {
  return `당신은 모두의 마음연구소 임상심리사의 사례개념화 초안 작성 보조 AI입니다.
이 결과는 상담자 내부 검토용 초안이며, 최종 판단·수정·승인은 임상심리사가 합니다.
제공된 자료만 사용하고, 근거가 없는 내용은 추정하지 마세요. 자료가 부족하면 반드시 "추가 확인 필요"라고 쓰세요.
진단명, 확정적 단정, 낙인, 병리화 표현을 금지합니다. 검사 점수나 원자료가 없으면 특정 척도가 높거나 낮다고 쓰지 마세요.
사실(내담자가 말한 내용/검사 결과)과 임상적 가설을 구분하고, 가설은 "~일 가능성을 함께 살펴볼 필요가 있습니다"처럼 조건부로 표현하세요.
위험 관련 자료가 있으면 과장하지 말고 현재 안전 확인과 추가 평가 필요성을 명확히 적으세요.
쉬운 한국어로 전문적이고 구체적으로 작성하며, 보호요인·강점·환경 맥락을 반드시 포함하세요.

내담자: ${clean(body.clientName, 100)}
프로그램: ${clean(body.program, 300)}
상담방식: ${clean(body.counselingMethod, 100)}
신청/실시 검사: ${Array.isArray(body.tests) ? body.tests.map(v => clean(v, 100)).join(', ') : clean(body.tests, 500)}

AI 마음체크/접수 요약:
${clean(body.intakeSummary) || '연결 자료 없음'}

검사결과 업로드 요약:
${clean(body.uploadSummary) || '연결 자료 없음'}

결과보고서 요약:
${clean(body.reportSummary) || '연결 자료 없음'}

회기기록 요약:
${clean(body.sessionSummary) || '연결 자료 없음'}

관리자 메모:
${clean(body.adminMemo) || '입력 없음'}

기존 사례개념화(있을 경우 참고하되 근거 없이 유지하지 않기):
${clean(JSON.stringify(body.existingFormulation || {}), 5000)}

아래 JSON만 반환하세요. 마크다운 코드블록을 쓰지 마세요.
{
  "complaint": "내담자가 경험하는 핵심 어려움과 도움 요청을 2~4문장으로 정리. 자료가 없으면 추가 면담 필요를 명시",
  "currentProblem": "현재 정서·사고·행동·관계·일상 기능에 미치는 영향을 사실과 가설을 구분하여 5~8문장으로 통합",
  "trigger": "어려움을 시작하거나 악화시킨 사건·변화·맥락. 근거별로 정리하고 불명확한 부분은 확인 질문으로 표시",
  "maintaining": "어려움을 지속시킬 수 있는 사고·정서·행동·관계·환경 요인을 4~7문장으로 작성. 확정하지 않기",
  "protective": "가족·관계·생활자원·상담동기·안전요인 등 확인되는 보호요인과 추가 확인할 자원을 작성",
  "strength": "내담자의 강점, 대처 노력, 자기이해, 변화 가능성을 구체적 근거와 함께 작성",
  "goal": "단기·중기·장기 상담목표를 구분해 측정 가능한 방향으로 작성",
  "intervention": "초기 1~2회기, 중기, 종결·사후관리 순서로 상담계획을 작성. 필요한 추가 면담·검사 해석·위험 확인 포함"
}`;
}

async function callGemini(apiKey, prompt) {
  const models = [process.env.GEMINI_PRIMARY_MODEL || "gemini-2.5-flash", process.env.GEMINI_FALLBACK_MODEL || "gemini-2.5-flash-lite"];
  let lastError;
  for (const model of [...new Set(models)]) {
    try {
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.25, topP: 0.9, maxOutputTokens: 3600, responseMimeType: "application/json", thinkingConfig: { thinkingBudget: 0 } }
        })
      });
      const data = await response.json().catch(() => ({}));
      const text = data?.candidates?.[0]?.content?.parts?.map(p => p.text || "").join("\n").trim();
      if (response.ok && text) return { text, model };
      lastError = { status: response.status, model, data };
    } catch (error) { lastError = { model, error: error.message }; }
  }
  const error = new Error("case conceptualization generation failed");
  error.detail = lastError;
  throw error;
}

export const handler = async (event) => {
  if (event.httpMethod === "OPTIONS") return jsonResponse({}, 200);
  if (event.httpMethod !== "POST") return jsonResponse({ error: "POST only" }, 405);
  try {
    const body = JSON.parse(event.body || "{}");
    if (!clean(body.clientName)) return jsonResponse({ error: "내담자 정보가 없습니다." }, 400);
    const hasSource = clean(body.intakeSummary) || clean(body.uploadSummary) || clean(body.reportSummary) || clean(body.sessionSummary) || clean(body.adminMemo);
    if (!hasSource) return jsonResponse({ error: "사례개념화에 사용할 자료가 없습니다. 접수내용, 검사결과 요약, 보고서 또는 회기기록을 먼저 입력해 주세요." }, 400);
    const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || process.env.GOOGLE_GEMINI_API_KEY;
    if (!apiKey) return jsonResponse({ error: "GEMINI_API_KEY가 설정되지 않았습니다." }, 500);
    const result = await callGemini(apiKey, buildPrompt(body));
    let parsed;
    try { parsed = JSON.parse(result.text.replace(/^```json\s*/i, "").replace(/```$/i, "").trim()); }
    catch { return jsonResponse({ error: "AI 사례개념화 형식을 해석하지 못했습니다. 다시 생성해 주세요." }, 502); }
    const fields = ["complaint","currentProblem","trigger","maintaining","protective","strength","goal","intervention"];
    const formulation = Object.fromEntries(fields.map(k => [k, clean(parsed[k], 8000)]));
    return jsonResponse({ formulation, model: result.model, promptVersion: "v1-clinician-review-required" });
  } catch (error) {
    console.error("[CASE CONCEPTUALIZATION]", error.detail || error);
    return jsonResponse({ error: "AI 사례개념화 생성 중 오류가 발생했습니다." }, 500);
  }
};
