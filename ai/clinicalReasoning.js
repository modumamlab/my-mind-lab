function normalize(text) {
  return String(text || "").replace(/\s+/g, " ").trim();
}

function extractDuration(text) {
  const raw = normalize(text);
  const m = raw.match(/(\d+)\s*(개월|달|년|주|일)\s*(정도|쯤|전쯤|전|가까이)?/);
  if (!m) return null;
  const n = Number(m[1]);
  const unit = m[2];

  if ((unit === "개월" || unit === "달") && n === 6) return "반년 가까이";
  if ((unit === "개월" || unit === "달") && n === 12) return "1년 가까이";
  if (unit === "년") return n === 1 ? "1년 가까이" : `${n}년 가까이`;
  if (unit === "주") return `${n}주 정도`;
  if (unit === "일") return `${n}일 정도`;
  return `${n}${unit} 정도`;
}

function analyzeMessage(text) {
  const raw = normalize(text);
  const result = {
    duration: extractDuration(raw),
    topic: [],
    emotion: [],
    body: [],
    target: null,
    coping: false,
    counselingHistory: false,
    impact: false,
    isRisk: false
  };

  if (/죽고|자살|사라지고|끝내고|해치고|자해|살기 싫/.test(raw)) result.isRisk = true;

  if (/교수/.test(raw)) result.target = "교수님";
  if (/상사|팀장|동료|회사|직장|업무/.test(raw)) result.topic.push("직장/업무");
  if (/가족|남편|아내|부부|아이|자녀|부모/.test(raw)) result.topic.push("가족/양육");
  if (/친구|사람|관계|대인/.test(raw)) result.topic.push("대인관계");

  if (/불안|무서|두려|걱정|긴장|떨/.test(raw)) result.emotion.push("불안/긴장");
  if (/우울|무기력|외로|지침|힘들|괴로|싫/.test(raw)) result.emotion.push("우울/무기력");
  if (/화나|억울|분노|짜증/.test(raw)) result.emotion.push("분노/억울함");
  if (/위축|자신감|눈치/.test(raw)) result.emotion.push("위축감");

  if (/숨|가슴|두근|떨|식은땀|멍해|배가|머리/.test(raw)) result.body.push("신체 긴장 반응");

  if (/잠|수면|식사|밥|일상|학교|출근|업무|공부|생활/.test(raw)) result.impact = true;
  if (/해봤|노력|참아|피하|상담|병원|약|도움/.test(raw)) result.coping = true;
  if (/상담.*받|심리상담|병원|정신건강|치료/.test(raw)) result.counselingHistory = true;

  return result;
}

function buildSessionState(userMessages) {
  const analyses = userMessages.map(analyzeMessage);
  return {
    userCount: userMessages.length,
    duration: analyses.find(a => a.duration)?.duration || null,
    hasTopic: analyses.some(a => a.topic.length || a.target),
    hasEmotion: analyses.some(a => a.emotion.length),
    hasBody: analyses.some(a => a.body.length),
    hasImpact: analyses.some(a => a.impact),
    hasCoping: analyses.some(a => a.coping),
    hasCounselingHistory: analyses.some(a => a.counselingHistory),
    hasRisk: analyses.some(a => a.isRisk),
    topics: [...new Set(analyses.flatMap(a => a.topic).concat(analyses.map(a => a.target).filter(Boolean)))],
    emotions: [...new Set(analyses.flatMap(a => a.emotion))],
    body: [...new Set(analyses.flatMap(a => a.body))]
  };
}

function shouldFinalize(state) {
  return state.userCount >= 8 && state.hasTopic && state.hasEmotion && (state.duration || state.hasImpact);
}

function buildFinalSummary(state) {
  const tests = [];
  if (state.emotions.some(e => e.includes("불안"))) tests.push("불안검사");
  if (state.emotions.some(e => e.includes("우울"))) tests.push("우울검사");
  if (state.hasTopic || state.hasEmotion) tests.push("TCI 기질 및 성격검사");

  const uniqueTests = [...new Set(tests)].slice(0, 2);

  return `지금까지 나눈 이야기를 보면, 현재의 어려움은 한순간의 감정이라기보다 반복되는 긴장과 마음의 소진이 함께 있는 것처럼 보입니다.

조금 더 깊이 이해하기 위해서는 지금의 정서 상태와 스트레스 반응을 함께 살펴보는 것이 도움이 될 수 있어요. ${uniqueTests.join(", ")}를 통해 상담 방향을 조금 더 분명하게 정리해 볼 수 있습니다.

검사는 나를 판단하기 위한 것이 아니라, 나를 더 잘 이해하기 위한 도구입니다.`;
}

module.exports = {
  analyzeMessage,
  buildSessionState,
  shouldFinalize,
  buildFinalSummary
};
