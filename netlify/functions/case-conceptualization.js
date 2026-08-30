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

const THEORY_GUIDES = {
  "인지행동치료(CBT)": "상황→자동적 사고→정서·신체반응→행동→단기 결과→장기 유지순환, 핵심신념과 인지왜곡, 행동실험과 인지재구성을 중심으로 분석",
  "인간중심상담": "자기개념과 경험의 불일치, 조건부 가치, 진솔성·무조건적 긍정적 존중·공감적 이해, 자기수용과 성장 가능성을 중심으로 분석",
  "정신역동": "초기 관계경험, 무의식적 핵심갈등, 불안, 방어기제, 반복되는 관계패턴과 전이 가능성을 조건부 가설로 분석",
  "애착이론": "애착경험, 내적작동모델, 관계 위협, 애착체계 활성화, 근접추구·회피 반응과 현재 관계패턴을 중심으로 분석",
  "해결중심 단기상담": "예외상황, 이미 작동하는 해결행동, 강점과 자원, 척도질문, 선호하는 미래와 작고 관찰 가능한 변화를 중심으로 분석",
  "현실치료": "기본욕구, 질적 세계, 현재의 선택과 전행동, 관계와 책임, WDEP(바람·행동·평가·계획)를 중심으로 분석",
  "게슈탈트": "현재 경험과 알아차림, 미해결 과제, 접촉경계, 회피 방식, 신체·정서 경험의 통합을 중심으로 분석",
  "아들러 개인심리학": "초기경험, 생활양식, 사적논리, 열등감과 보상, 행동의 목적, 사회적 관심과 격려를 중심으로 분석",
  "가족체계이론": "상호작용 순환, 가족규칙과 경계, 하위체계, 삼각관계, 세대 간 전수, 개인 증상의 체계적 기능을 중심으로 분석",
  "수용전념치료(ACT)": "경험회피와 인지적 융합, 현재순간 접촉, 수용, 탈융합, 맥락으로서의 자기, 가치와 전념행동을 중심으로 분석",
  "변증법적 행동치료(DBT)": "취약성 요인과 촉발사건, 행동연쇄, 정서조절·고통감내·대인관계 효율성·마음챙김, 수용과 변화의 균형을 중심으로 분석",
  "통합적 사례개념화": "발달·인지·정서·행동·관계·환경 요인을 자료 근거에 따라 통합하되 여러 이론을 무분별하게 혼합하지 말고 주된 유지기제와 변화경로를 명확히 분석"
};

function theoryContext(value){
  const theory=clean(value,100)||"통합적 사례개념화";
  return {theory,guide:THEORY_GUIDES[theory]||`상담자가 지정한 '${theory}'의 공인된 핵심개념과 변화기제를 적용하되, 이론을 확실히 알 수 없거나 명칭이 모호하면 임의로 정의하지 말고 추가 확인 필요로 표시`};
}

function buildPrompt(body) {
  const {theory,guide}=theoryContext(body.theoreticalOrientation);
  return `당신은 모두의 마음연구소 임상심리사의 사례개념화 초안 작성 보조 AI입니다.
이 결과는 상담자 내부 검토용 초안이며, 최종 판단·수정·승인은 임상심리사가 합니다.
제공된 자료만 사용하고, 근거가 없는 내용은 추정하지 마세요. 자료가 부족하면 반드시 "추가 확인 필요"라고 쓰세요.
진단명, 확정적 단정, 낙인, 병리화 표현을 금지합니다. 검사 점수나 원자료가 없으면 특정 척도가 높거나 낮다고 쓰지 마세요.
사실(내담자가 말한 내용/검사 결과)과 임상적 가설을 구분하고, 가설은 "~일 가능성을 함께 살펴볼 필요가 있습니다"처럼 조건부로 표현하세요.
위험 관련 자료가 있으면 과장하지 말고 현재 안전 확인과 추가 평가 필요성을 명확히 적으세요.
쉬운 한국어로 전문적이고 구체적으로 작성하며, 보호요인·강점·환경 맥락을 반드시 포함하세요.
사례개념화는 현재 문제뿐 아니라 촉발요인, 유지요인, 회복자원, 내담자가 이미 시도한 변화와 다음 상담 방향이 연결되도록 작성하세요.
기존 사례개념화가 있으면 새 자료로 확인된 내용, 달라진 내용, 여전히 불확실한 내용을 구분하세요.

선택한 사례개념화 이론: ${theory}
이론 적용 지침: ${guide}
- 단순히 이론 이름만 언급하지 말고, 이 이론의 핵심개념과 문제의 발생·촉발·유지 과정 및 변화기제를 사례자료에 연결하세요.
- 상담목표와 개입전략은 반드시 선택 이론에 맞게 작성하세요. 다른 이론의 기법은 필요성과 역할이 명확한 경우에만 보조적으로 제안하세요.
- 사례자료에 근거가 없는 이론적 해석은 사실처럼 단정하지 말고 확인이 필요한 가설로 표시하세요.

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

상담자가 직접 업로드한 사례자료 요약:
${clean(body.caseMaterialSummary,18000) || '연결 자료 없음'}

회기기록 요약:
${clean(body.sessionSummary) || '연결 자료 없음'}

관리자 메모:
${clean(body.adminMemo) || '입력 없음'}

기존 사례개념화(있을 경우 참고하되 근거 없이 유지하지 않기):
${clean(JSON.stringify(body.existingFormulation || {}), 5000)}

아래 JSON만 반환하세요. 마크다운 코드블록을 쓰지 마세요.
{
  "theoryPerspective": "선택 이론의 핵심개념으로 사례를 이해한 관점과 핵심 변화기제를 5~8문장으로 작성",
  "complaint": "내담자가 경험하는 핵심 어려움과 도움 요청을 2~4문장으로 정리. 자료가 없으면 추가 면담 필요를 명시",
  "currentProblem": "현재 정서·사고·행동·관계·일상 기능에 미치는 영향을 사실과 가설을 구분하여 5~8문장으로 통합",
  "trigger": "어려움을 시작하거나 악화시킨 사건·변화·맥락. 근거별로 정리하고 불명확한 부분은 확인 질문으로 표시",
  "maintaining": "어려움을 지속시킬 수 있는 사고·정서·행동·관계·환경 요인을 4~7문장으로 작성. 확정하지 않기",
  "coreBelief": "선택 이론에서 다루는 핵심 자기·타인·세계에 대한 이해, 내적 표상 또는 생활양식. 해당 개념이 맞지 않는 이론에서는 그 이론에 적합한 핵심구조로 작성",
  "automaticThought": "촉발상황에서 나타나는 즉각적 해석·내적 반응. 자동적 사고 개념을 쓰지 않는 이론에서는 이에 대응하는 현재 경험이나 의미구성으로 작성",
  "emotionPattern": "주요 정서, 촉발 맥락, 정서조절 방식과 반복 양상을 근거와 함께 작성",
  "behaviorPattern": "반복되는 행동·대인관계 반응과 단기 결과 및 장기 유지효과를 작성",
  "protective": "가족·관계·생활자원·상담동기·안전요인 등 확인되는 보호요인과 추가 확인할 자원을 작성",
  "strength": "내담자의 강점, 대처 노력, 자기이해, 변화 가능성을 구체적 근거와 함께 작성",
  "riskAssessment": "자살·자해·타해·학대·폭력 등 현재 안전 관련 근거와 추가 확인 필요를 작성. 관련 자료가 없으면 위험 없음으로 단정하지 말고 현재 안전 확인 필요라고 작성",
  "clinicalHypothesis": "선택 이론에 따른 문제 발생과 유지의 통합 가설 및 가능한 대안 가설을 조건부 표현으로 작성",
  "evidenceBasis": "접수·검사·보고서·회기기록 중 어떤 자료가 각 해석을 지지하는지 출처별로 연결",
  "goal": "단기·중기·장기 상담목표를 구분해 측정 가능한 방향으로 작성",
  "intervention": "초기 1~2회기, 중기, 종결·사후관리 순서로 상담계획을 작성. 필요한 추가 면담·검사 해석·위험 확인 포함",
  "confirmedChanges": "이전 기록과 비교해 새롭게 확인된 변화·실천·회복 신호. 비교자료가 없으면 추가 확인 필요",
  "uncertainPoints": "근거가 부족하거나 서로 다른 자료가 있어 추가 확인이 필요한 내용",
  "nextFocus": "다음 회기에서 우선적으로 확인하거나 다룰 주제 1~3개"
}`;
}

async function callGemini(apiKey, prompt) {
  const models = [process.env.GEMINI_PRIMARY_MODEL || "gemini-2.5-flash", process.env.GEMINI_FALLBACK_MODEL || "gemini-2.5-flash"];
  let lastError;
  for (const model of [...new Set(models)]) {
    try {
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.25, topP: 0.9, maxOutputTokens: 6000, responseMimeType: "application/json", thinkingConfig: { thinkingBudget: 0 } }
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
    const hasSource = clean(body.intakeSummary) || clean(body.uploadSummary) || clean(body.reportSummary) || clean(body.caseMaterialSummary) || clean(body.sessionSummary) || clean(body.adminMemo);
    if (!hasSource) return jsonResponse({ error: "사례개념화에 사용할 자료가 없습니다. 접수내용, 검사결과 요약, 보고서 또는 회기기록을 먼저 입력해 주세요." }, 400);
    const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || process.env.GOOGLE_GEMINI_API_KEY;
    if (!apiKey) return jsonResponse({ error: "GEMINI_API_KEY가 설정되지 않았습니다." }, 500);
    const selectedTheory=theoryContext(body.theoreticalOrientation).theory;
    const result = await callGemini(apiKey, buildPrompt(body));
    let parsed;
    try { parsed = JSON.parse(result.text.replace(/^```json\s*/i, "").replace(/```$/i, "").trim()); }
    catch { return jsonResponse({ error: "AI 사례개념화 형식을 해석하지 못했습니다. 다시 생성해 주세요." }, 502); }
    const fields = ["theoryPerspective","complaint","currentProblem","trigger","maintaining","coreBelief","automaticThought","emotionPattern","behaviorPattern","protective","strength","riskAssessment","clinicalHypothesis","evidenceBasis","goal","intervention","confirmedChanges","uncertainPoints","nextFocus"];
    const formulation = Object.fromEntries(fields.map(k => [k, clean(parsed[k], 8000)]));
    return jsonResponse({ formulation, theoreticalOrientation:selectedTheory, model: result.model, promptVersion: "mml-v2-theory-based-case-formulation" });
  } catch (error) {
    console.error("[CASE CONCEPTUALIZATION]", error.detail || error);
    return jsonResponse({ error: "AI 사례개념화 생성 중 오류가 발생했습니다." }, 500);
  }
};
