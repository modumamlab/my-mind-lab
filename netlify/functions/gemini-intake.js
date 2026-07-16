const PROMPT_VERSION = "v36-10min-notice-info-mode"; // [MOD-20260712] 열린 질문 중심 대화 개선

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
    .slice(-18)
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
  /(마무리해|마음\s*정리|정리해\s*줘|리포트\s*(보여|만들|해)|끝낼래|끝내\s*줘|여기까지|대화\s*종료|이제\s*마칠|마무리\s*할래)/.test(text);

// [MOD-20260712-003] 심리·상담·검사 관련 지식 질문은 공감만 하지 않고 정보를 먼저 제공합니다.
const isInformationRequest = (text) => {
  const t = cleanText(text);
  const questionForm = /(뭐야|무엇|알려\s*줘|설명해|차이|의미|뜻|어떤\s*검사|어떻게\s*진행|효과|원인|증상|기준|방법|도움이\s*돼|필요해|괜찮아)/.test(t);
  const topic = /(TCI|MMPI|PAI|SCT|HTP|PAT|STS|K-CDI|기질|성격|심리검사|상담|우울|불안|공황|번아웃|애착|스트레스|트라우마|ADHD|자존감|감정조절|정신건강)/i.test(t);
  return questionForm && topic;
};

const makeCrisisReply = () =>
  "지금은 무엇보다 안전이 가장 중요합니다.\n\n스스로를 해치고 싶거나 당장 안전하지 않다고 느껴진다면, 지금 바로 112, 119 또는 자살예방상담전화 109에 연락해 주세요.\n\n가능하다면 지금 혼자 있지 말고, 곁에 연락할 수 있는 사람에게 바로 알려 주세요.";

const makeLimitReply = () =>
  "이 대화는 마음을 안전하게 살펴보기 위한 공간입니다.\n\n욕설, 비방, 혐오나 모욕적인 표현이 이어지면 상담 대화를 계속 진행하기 어렵습니다.\n\n마음을 나누고 싶으시다면, 지금 느끼는 감정이나 상황을 조금 더 안전한 표현으로 다시 적어 주세요.";

const buildConversationText = (messages) =>
  messages.map((m) => `${m.role === "user" ? "사용자" : "AI 마음지기"}: ${m.text}`).join("\n");

const buildPrompt = ({ messages, minutes, shouldClose, informationMode }) => {
  const conversation = buildConversationText(messages);
  const lastUser = getLastUser(messages);
  const userTurns = messages.filter((m) => m.role === "user").length;

  return `
당신은 '모두의 마음연구소'의 AI 마음지기입니다.
당신은 진단하거나 치료하는 전문 상담자가 아니라, 사용자가 자신의 마음을 안전하게 말하고 이해하도록 돕는 대화형 마음지기입니다.

【이번 버전의 핵심】
- 질문은행이나 고정 시나리오를 사용하지 않습니다.
- 미리 정해 둔 질문 순서대로 진행하지 않습니다.
- 현재 대화의 맥락과 마지막 사용자 말에서 가장 중요한 의미를 찾아 즉석에서 반응합니다.
- 닫힌 질문보다 열린 질문을 우선합니다.
- 한 번에 질문은 하나만 합니다.
- 사용자가 길게 말했으면 먼저 충분히 정리하고 공감한 뒤, 다음 이야기를 꺼내기 쉬운 질문을 합니다.
- 사용자가 짧게 말했으면 짧게 받아 주고 부담이 적은 열린 질문을 합니다.
- 공감 → 쉬운 마음정리 → 열린 질문 또는 이야기 초대의 흐름을 자연스럽게 사용합니다.
- 모든 답변을 반드시 질문으로 끝내지는 않습니다.
- 다만 대화 초반과 중간에는 사용자가 다음 이야기를 이어갈 수 있도록, 특별한 이유가 없다면 마지막에 열린 질문 또는 이야기 초대를 하나 포함합니다.
- 사용자가 이미 충분히 길게 말하고 있거나 감정이 매우 벅찬 상태라면 질문 없이 공감과 정리만 할 수 있습니다.

【열린 질문 원칙】
좋은 질문은 사용자가 자기 경험을 자유롭게 설명할 수 있게 합니다.
예:
- 그 일이 요즘 마음에 어떻게 남아 있나요?
- 그 순간 가장 힘들었던 것은 무엇이었나요?
- 그 마음을 조금 더 이야기해 주신다면 어떤 이야기부터 꺼내고 싶으신가요?
- 지금 가장 알아주었으면 하는 마음은 무엇인가요?
- 그 일이 일상에는 어떤 영향을 주고 있나요?

다음과 같은 닫힌 질문을 남발하지 마세요.
- 힘드셨나요?
- 불안한가요?
- 잠을 못 자나요?
- 맞나요?
- 괜찮아졌나요?

사용자가 이미 말한 내용을 다시 확인하기 위한 질문도 피합니다.
질문은 대화를 이어가기 위해 꼭 필요한 경우에만 하나 사용합니다.

【정보제공 모드】
${informationMode ? `
사용자가 심리학, 정신건강, 상담 방법 또는 심리검사에 관한 정보를 직접 요청했습니다.
이번 답변은 공감만 반복하지 말고 다음 원칙을 따릅니다.
- 먼저 질문에 대한 핵심 정보를 정확하고 쉬운 말로 3~6문장 안에서 설명합니다.
- 알려진 일반 정보와 사용자의 개인 상태에 대한 판단을 구분합니다.
- 진단을 단정하지 않으며, 증상이 지속되거나 일상 기능이 크게 떨어지면 전문가 평가가 필요할 수 있음을 알립니다.
- 검사 질문이라면 검사 목적, 무엇을 살펴보는지, 결과의 활용과 한계를 간단히 설명합니다.
- 정보 제공 뒤에는 현재 상황과 연결해 살펴볼지 선택할 수 있는 짧은 문장 하나를 덧붙일 수 있습니다.
- 사용자가 정보만 요청했다면 억지로 감정을 묻거나 상담 대화로 끌고 가지 않습니다.
` : `현재는 일반 마음대화 모드입니다. 사용자의 감정과 상황을 중심으로 반응합니다.`}

【응답 원칙】
- 항상 존댓말을 사용합니다.
- 사용자가 실제로 말한 내용에만 반응합니다.
- 확인되지 않은 원인, 과거 경험, 성격을 추측하거나 단정하지 않습니다.
- 해결책과 조언을 서두르지 않습니다.
- 전문 용어보다 쉬운 언어로 마음을 설명합니다.
- 같은 공감 문장, 같은 질문, 같은 문장 구조를 반복하지 않습니다.
- 사용자의 핵심 단어를 그대로 되풀이하는 데 그치지 말고 의미를 이해해 자연스럽게 반영합니다.
- 일반 응답은 2~5문장입니다.
- 제목, 번호, 분석 과정은 쓰지 않습니다.
- 문장을 반드시 끝까지 완성합니다.

【응답 구성】
대화 초반과 중간에는 다음 흐름을 기본으로 사용합니다.
1. 구체적인 공감
2. 쉬운 마음정리
3. 열린 질문 하나 또는 이야기 초대 하나

필요에 따라 다음 중 2~3가지를 자연스럽게 조합합니다.
1. 사용자의 상황과 감정을 구체적으로 반영
2. 마음을 쉬운 말로 정리
3. 사용자가 더 말하기 쉬운 열린 질문 하나
4. 질문 없이도 이어 말할 수 있는 초대 문장

질문 대신 사용할 수 있는 이야기 초대:
- 서두르지 않으셔도 괜찮습니다. 지금 떠오르는 이야기부터 이어가 주세요.
- 그 마음이 어떻게 생겨났는지 천천히 들려주셔도 괜찮습니다.
- 지금 가장 마음에 남는 장면부터 이야기해 주세요.

【심리검사 추천】
- 대화 초반과 중간에는 심리검사를 추천하지 않습니다.
- 사용자가 직접 요청하거나 대화를 마무리할 때만 1~2개를 추천합니다.
• 먼저 사용자의 주제를 구분합니다: 구직·진로 / 현재 재직 중 직무스트레스 / 정서 / 관계 / 양육 / 부부.
• 구직·취업·재취업을 준비하는 사람에게 직무스트레스검사를 추천하지 않습니다. 이 경우에는 필요할 때 직업흥미검사 또는 TCI를 고려합니다.
• 직무스트레스검사는 현재 재직 중이며 업무환경, 업무량, 역할갈등, 상사·동료·조직 문제 또는 소진이 실제로 확인될 때만 추천합니다.
• 대화 내용과 직접 연결되는 검사가 없거나 검사 필요성이 낮으면 아무 검사도 추천하지 않습니다.

- 진단이 아니라 현재 마음과 반응 방식을 이해하기 위한 참고 도구라고 설명합니다.

【안전】
자살, 자해, 타해 등 안전과 관련된 표현이 확인되면 일반 대화를 멈추고 안전 안내를 최우선으로 합니다.

【상담 종료】
현재 대화 시간은 약 ${minutes}분입니다.
현재 사용자 발화 수는 ${userTurns}회입니다.
이번 응답에서 마무리 필요 여부: ${shouldClose ? "예" : "아니오"}

${shouldClose ? `
이번 응답은 마음체크를 자연스럽게 마무리합니다.
새로운 질문으로 끝내지 않습니다.
마무리 답변은 다음 순서가 자연스럽게 드러나도록 작성합니다.
- 오늘의 마음체크: 오늘 나눈 이야기를 개인 맞춤형 공감과 쉬운 언어로 정리
- 지금 마음에서 보이는 신호: 3~5개의 핵심 신호
- 나에게 도움이 될 수 있는 심리검사: 1~2개와 사용자 이야기와 연결된 추천 이유
- 함께 기억하면 좋은 한마디: 짧고 따뜻한 한 문장
제목이나 번호를 과도하게 쓰지 말고, 앱 결과 화면에서 다시 구성하기 쉬운 내용으로 작성합니다.
` : ""}

현재 대화:
${conversation || "아직 대화가 시작되지 않았습니다."}

마지막 사용자 말:
${lastUser}

출력 규칙:
- AI 마음지기의 답변만 작성합니다.
- 일반 응답은 2~5문장입니다.
- 열린 질문은 꼭 필요할 때 하나만 사용합니다.
- 문장을 반드시 끝까지 완성합니다.
`;
};

async function callGemini({ apiKey, prompt, closing = false }) {
  const configuredModels = [
    process.env.GEMINI_PRIMARY_MODEL || "gemini-2.5-flash",
    process.env.GEMINI_FALLBACK_MODEL || "gemini-2.5-flash"
  ];

  // 동일 모델 중복 제거
  const models = [...new Set(configuredModels.filter(Boolean))];

  let lastError = null;

  for (const model of models) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), closing ? 22000 : 15000);
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          signal: controller.signal,
          body: JSON.stringify({
            contents: [{ role: "user", parts: [{ text: prompt }] }],
            generationConfig: {
              temperature: closing ? 0.5 : 0.7,
              topP: 0.9,
              topK: 32,
              maxOutputTokens: closing ? 1000 : 650,
              // 상담 대화는 복잡한 수학 추론보다 안정적인 반응과 속도가 중요하므로
              // Gemini 2.5 Flash의 불필요한 thinking 토큰을 사용하지 않습니다.
              thinkingConfig: { thinkingBudget: 0 }
            }
          })
        }
      );
      clearTimeout(timeoutId);

      const data = await response.json().catch(() => ({}));
      const candidate = data?.candidates?.[0] || null;
      const text = candidate?.content?.parts
        ?.map((p) => p.text || "")
        .join("\n")
        .trim();
      const finishReason = candidate?.finishReason || "UNKNOWN";

      if (response.ok && text) {
        return {
          text,
          model,
          finishReason,
          usageMetadata: data?.usageMetadata || null
        };
      }

      lastError = { model, status: response.status, finishReason, data };
      console.error("[MODUMAM AI] Gemini non-ok/empty", lastError);
      if (response.status === 429) {
        console.error("[MODUMAM AI] 사용량 제한 또는 크레딧/등급 상태를 AI Studio에서 확인해 주세요.");
      }
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

const looksIncomplete = (text, finishReason = "UNKNOWN") => {
  const t = cleanText(text);

  // Gemini가 정상 종료가 아닌 이유로 멈춘 경우에는 재생성합니다.
  if (finishReason && !["STOP", "UNKNOWN"].includes(finishReason)) return true;

  if (!t || t.length < 35) return true;

  // 문장부호 또는 자연스러운 한국어 종결어미로 끝나는지 확인합니다.
  const completeEndings =
    /[.!?。？！"”’)]$|(?:습니다|습니까|어요|예요|이에요|네요|지요|죠|까요|군요|거예요|것입니다|같습니다|있습니다|없습니다|바랍니다|주세요|드립니다|합니다|했습니다|되었습니다|느껴집니다|살펴보겠습니다|괜찮습니다|보입니다|들립니다|수 있습니다)\.?$/;

  if (completeEndings.test(t)) return false;

  // 조사, 연결어미, 단어 중간, 불완전한 어간으로 끝난 경우를 넓게 감지합니다.
  const brokenEndings =
    /(?:고|며|면서|지만|는데|은데|라서|해서|되어|되고|하고|처럼|보다|까지|부터|에게|으로|로|과|와|의|를|을|이|가|은|는|도|만|에|에서|에게서|한테|듯|때문|상태|마음과|생각과|느낌과|에너지를|마음을|슬|허전하고|답답하고|힘들고|아프고|무섭고|외롭고|지치고|느껴|보여|들려|생각|마음|느낌|부분|점|것|수|때|상황|경험|이야기)$/;

  if (brokenEndings.test(t)) return true;

  // 마지막 문장이 너무 짧고 종결표현이 없으면 중간 절단으로 봅니다.
  const lastSentence = t.split(/[.!?。？！]\s*/).filter(Boolean).pop() || t;
  if (lastSentence.length <= 18 && !completeEndings.test(lastSentence)) return true;

  // 끝맺음이 전혀 없는 문장은 안전하게 재생성합니다.
  return true;
};

const chooseRecommendedTests = (text) => {
  const t = cleanText(text);
  const tests = [];

  if (/부모|자녀|아이|양육|육아|엄마|아빠|가족/.test(t))
    tests.push({ name: "부모 TCI / PAT", reason: "부모-자녀 관계에서 반복되는 감정과 양육 반응을 함께 이해하는 데 도움이 됩니다." });

  if (/부부|남편|아내|배우자|커플/.test(t))
    tests.push({ name: "TCI", reason: "나와 상대의 기질 차이와 관계에서 반복되는 반응을 이해하는 데 도움이 됩니다." });

  if (/직장|회사|상사|동료|일|퇴사|업무/.test(t))
    tests.push({ name: "TCI", reason: "스트레스 상황에서 내가 어떻게 버티고 반응하는지 이해하는 데 도움이 됩니다." });

  if (/학교|친구|교우|공부|진로|시험/.test(t))
    tests.push({ name: "TCI 또는 SCT", reason: "현재 고민과 마음속 생각의 흐름을 조금 더 차분히 정리하는 데 도움이 됩니다." });

  if (/불안|우울|무기력|잠|수면|눈물|두려|긴장|공황|답답/.test(t))
    tests.push({ name: "MMPI-2 또는 PAI", reason: "지금의 정서 상태와 마음의 부담 정도를 객관적으로 살펴보는 데 도움이 됩니다." });

  if (!tests.length)
    tests.push({ name: "TCI", reason: "나의 기질과 성격 특성을 이해하고, 지금 힘든 마음이 어떤 방식으로 나타나는지 살펴보는 데 도움이 됩니다." });

  return tests.slice(0, 2);
};

const makeLocalClosingReply = (messages) => {
  const allText = getUserText(messages);
  const tests = chooseRecommendedTests(allText);
  const testText = tests.map((t) => `${t.name}: ${t.reason}`).join("\n");

  return `오늘 들려주신 이야기를 이어보면, 지금 마음은 혼자 오래 버티느라 지치고 답답했던 신호를 보내고 있는 것 같습니다.\n\n지금 당장 정답을 찾기보다, 먼저 내 마음이 무엇 때문에 힘들었는지 안전하게 알아차리는 시간이 필요해 보입니다.\n\n추천드릴 수 있는 심리검사는 다음과 같습니다.\n${testText}\n\n이 검사는 진단을 위한 것이 아니라, 지금의 마음과 나의 반응 방식을 조금 더 이해하기 위한 참고 도구입니다.`;
};


const buildLocalCounselingReply = (messages = []) => {
  const lastUser = getLastUser(messages);
  const text = cleanText(lastUser);
  const allText = getUserText(messages);

  const makeReply = (reflection, meaning, invitation) =>
    [reflection, meaning, invitation].filter(Boolean).join("\n\n");

  if (/수입|지출|돈|경제|빚|대출|생활비|카드값|월세|관리비|재정/.test(text)) {
    return makeReply(
      "수입은 충분하지 않은데 지출은 계속 이어지는 상황이라 마음이 많이 무거우셨을 것 같습니다.",
      "돈에 대한 부담은 단순히 숫자의 문제가 아니라, 앞으로를 어떻게 버텨야 할지 막막하게 느끼게 만들기도 합니다.",
      "지금 가장 크게 압박으로 느껴지는 지출이 무엇인지부터 천천히 이야기해 주셔도 괜찮습니다."
    );
  }

  if (/회사|직장|업무|상사|동료|퇴사|이직|일이|야근|출근/.test(text)) {
    return makeReply(
      "일과 관련된 부담이 계속 마음에 남아 있어 쉽게 쉬지 못하고 계신 것 같습니다.",
      "하루가 끝나도 해야 할 일과 걱정이 이어지면 몸보다 마음이 먼저 지칠 수 있습니다.",
      "요즘 가장 마음을 놓지 못하게 만드는 일이 무엇인지 이야기해 주셔도 괜찮습니다."
    );
  }

  if (/부모|엄마|아빠|가족|남편|아내|배우자|아이|자녀|친구|관계|싸웠|갈등/.test(text)) {
    return makeReply(
      "가까운 사람과의 일이라서 마음에 더 오래 남고 아프게 느껴지셨을 것 같습니다.",
      "관계에서 생긴 상처는 사건 자체보다, 이해받지 못했다는 느낌이나 서운함으로 이어지기도 합니다.",
      "그 일에서 가장 마음에 남은 순간이 무엇이었는지 천천히 들려주셔도 괜찮습니다."
    );
  }

  if (/아프|암|병원|진단|건강|수술|치료|질병|검사 결과/.test(text)) {
    return makeReply(
      "건강과 관련된 소식 앞에서 마음이 많이 놀라고 무거워지셨을 것 같습니다.",
      "걱정과 두려움이 한꺼번에 밀려오면 무엇부터 생각해야 할지 막막하게 느껴질 수 있습니다.",
      "지금 가장 크게 마음을 붙잡고 있는 걱정부터 이야기해 주셔도 괜찮습니다."
    );
  }

  if (/피곤|지쳐|무기력|아무것도 하기 싫|의욕 없|방전|소진/.test(text)) {
    return makeReply(
      "지금은 무언가를 더 해내기보다, 버티는 것 자체가 힘들 만큼 에너지가 많이 줄어든 것처럼 들립니다.",
      "쉬어도 회복되지 않는 피로가 이어지면 마음도 쉽게 무거워질 수 있습니다.",
      "요즘 가장 에너지를 많이 빼앗는 일이 무엇인지부터 천천히 살펴봐도 괜찮습니다."
    );
  }

  if (/불안|걱정|무서|두려|긴장|초조|공황|답답/.test(text)) {
    return makeReply(
      "걱정과 긴장이 계속 이어져 마음이 편히 쉬지 못하고 계신 것 같습니다.",
      "불안이 커질수록 아직 일어나지 않은 일까지 미리 감당해야 하는 느낌이 들 수 있습니다.",
      "지금 불안을 가장 크게 만드는 상황이 무엇인지 이야기해 주셔도 괜찮습니다."
    );
  }

  if (/슬프|눈물|허전|외롭|상실|떠나|죽었|무지개다리/.test(text)) {
    return makeReply(
      "소중한 존재를 떠나보낸 슬픔이 지금도 마음 깊이 남아 있는 것 같습니다.",
      "함께했던 시간이 소중했던 만큼 허전함과 그리움도 크게 느껴질 수 있습니다.",
      "지금 가장 많이 떠오르는 기억이 있다면 천천히 들려주셔도 괜찮습니다."
    );
  }

  if (/화나|분노|짜증|억울|속상/.test(text)) {
    return makeReply(
      "그 일로 마음속에 화와 속상함이 많이 쌓여 있었던 것 같습니다.",
      "화가 난다는 것은 그만큼 중요하게 여긴 것이 지켜지지 않았다는 신호일 수도 있습니다.",
      "무엇이 가장 억울하거나 받아들이기 어려웠는지 이야기해 주셔도 괜찮습니다."
    );
  }

  return makeReply(
    "말씀해 주신 마음이 가볍지 않게 느껴집니다.",
    "지금 바로 정리되지 않아도 괜찮습니다. 중요한 것은 서두르지 않고 현재의 마음을 조금씩 알아가는 일입니다.",
    "지금 가장 먼저 꺼내고 싶은 이야기부터 이어가 주세요."
  );
};

const fallbackConnectionReply = (messages = [], shouldClose = false) => {
  if (shouldClose) return makeLocalClosingReply(messages);
  return buildLocalCounselingReply(messages);
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
    const autoTimeClose = minutes >= 15;
    const userRequestedClose = wantsClosing(lastUser);
    const informationMode = isInformationRequest(lastUser);
    const shouldClose = autoTimeClose || userRequestedClose;

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
        text: "AI 마음지기 연결 설정이 아직 완료되지 않았습니다. Netlify 환경변수의 GEMINI_API_KEY와 AI Studio 결제 프로젝트 연결 상태를 확인해 주세요.",
        isComplete: false,
        promptVersion: PROMPT_VERSION,
        abuseWarningCount: Number(body.abuseWarningCount || 0),
        engine: { mode: "clinical-core", safety: "OK", fallback: "OFF", error: "NO_API_KEY" }
      }, 200);
    }

    const prompt = autoTimeClose
      ? `
당신은 모두의 마음연구소 AI 마음지기입니다.
15분의 대화 시간이 모두 지났습니다.
사용자가 갑자기 끝났다고 느끼지 않도록, 지금까지 이야기해 주신 데 대해 감사와 공감을 전하고
이제 오늘 나눈 이야기를 바탕으로 마음을 정리해 드리겠다고 안내하세요.

규칙:
- 2~3개의 짧고 완결된 문장
- 존댓말
- 새로운 질문 금지
- 심리검사 추천이나 긴 분석 금지
- "시간 초과", "세션 종료", "시스템" 같은 기계적 표현 금지
- AI 답변만 출력

현재 대화:
${buildConversationText(messages)}
`
      : buildPrompt({ messages, minutes, shouldClose, informationMode });
    let first = await callGemini({ apiKey, prompt, closing: shouldClose });
    let finalText = postProcess(first.text);
    let model = first.model;
    let finishReason = first.finishReason || "UNKNOWN";
    let completionRetries = 0;

    while (looksIncomplete(finalText, finishReason) && completionRetries < 2) {
      completionRetries += 1;

      const retryPrompt = `
아래 AI 마음지기 답변은 문장 중간에서 끊겼거나 자연스럽게 끝나지 않았습니다.

불완전한 답변:
${finalText}

현재 대화:
${buildConversationText(messages)}

마지막 사용자 말:
${lastUser}

처음부터 다시 작성하세요. 불완전한 문장을 이어 붙이지 마세요.
- 사용자의 마지막 말에 직접 반응합니다.
- 2~4개의 완결된 문장으로 작성합니다.
- 존댓말을 사용합니다.
- 문장마다 끝맺음을 분명하게 합니다.
- 추측, 진단, 단정, 과도한 해석을 하지 않습니다.
- 대화 초반과 중간이라면 열린 질문 또는 이야기 초대는 하나만 사용합니다.
- 마무리 단계라면 질문하지 않습니다.
- 제목, 번호, 설명 없이 AI 답변만 출력합니다.
`;

      try {
        const retry = await callGemini({
          apiKey,
          prompt: retryPrompt,
          closing: shouldClose
        });

        finalText = postProcess(retry.text);
        model = retry.model || model;
        finishReason = retry.finishReason || "UNKNOWN";
      } catch (retryError) {
        console.error("[MODUMAM AI] completion retry failed", retryError.detail || retryError);
        break;
      }
    }

    // 두 번 재생성해도 완결되지 않으면 끊긴 문장을 사용자에게 표시하지 않습니다.
    if (looksIncomplete(finalText, finishReason)) {
      finalText = shouldClose
        ? makeLocalClosingReply(messages)
        : buildLocalCounselingReply(messages);
      finishReason = "LOCAL_COUNSELING_FALLBACK";
    }

    if (!finalText) finalText = fallbackConnectionReply(messages, shouldClose);

    return jsonResponse({
      text: finalText,
      isComplete: shouldClose,
      promptVersion: PROMPT_VERSION,
      abuseWarningCount: Number(body.abuseWarningCount || 0),
      engine: {
        mode: "clinical-gemini-paid",
        safety: "OK",
        fallback: finishReason === "LOCAL_COUNSELING_FALLBACK" ? "LOCAL_COUNSELING" : "OFF",
        model,
        finishReason,
        completionRetries
      }
    }, 200);
  } catch (error) {
    console.error("[MODUMAM AI] handler error", error.detail || error);

    let safeMessages = [];
    try {
      const body = JSON.parse(event.body || "{}");
      safeMessages = normalizeMessages(body.messages);
    } catch (parseError) {
      safeMessages = [];
    }

    return jsonResponse({
      text: fallbackConnectionReply(safeMessages, false),
      isComplete: false,
      promptVersion: PROMPT_VERSION,
      abuseWarningCount: 0,
      engine: {
        mode: "clinical-gemini-paid",
        safety: "UNKNOWN",
        fallback: "LOCAL_COUNSELING",
        error: "HANDLER_ERROR"
      }
    }, 200);
  }
};
