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
  const result = { duration: extractDuration(raw), topic: [], emotion: [], body: [], thought: false, target: null, coping: false, counselingHistory: false, impact: false, support: false, needTest: false };
  if (/교수/.test(raw)) result.target = "교수님";
  if (/상사|팀장|동료|회사|직장|업무/.test(raw)) result.topic.push("직장/업무");
  if (/가족|남편|아내|부부|아이|자녀|부모/.test(raw)) result.topic.push("가족/양육");
  if (/친구|사람|관계|대인/.test(raw)) result.topic.push("대인관계");
  if (/진로|취업|이직|미래|앞으로/.test(raw)) result.topic.push("진로/미래");
  if (/불안|무서|두려|걱정|긴장|떨/.test(raw)) result.emotion.push("불안/긴장");
  if (/우울|무기력|외로|지침|힘들|괴로|싫/.test(raw)) result.emotion.push("우울/무기력");
  if (/화나|억울|분노|짜증/.test(raw)) result.emotion.push("분노/억울함");
  if (/위축|자신감|눈치/.test(raw)) result.emotion.push("위축감");
  if (/슬프|눈물|울/.test(raw)) result.emotion.push("슬픔");
  if (/숨|가슴|두근|떨|식은땀|멍해|배가|머리|몸/.test(raw)) result.body.push("신체 긴장 반응");
  if (/생각|걱정|예상|망할|실패|혼날|평가|보고/.test(raw)) result.thought = true;
  if (/잠|수면|식사|밥|일상|학교|출근|업무|공부|생활|관계|집중/.test(raw)) result.impact = true;
  if (/해봤|노력|참아|피하|상담|병원|약|도움|버텼|견뎠/.test(raw)) result.coping = true;
  if (/상담.*받|심리상담|병원|정신건강|치료|검사/.test(raw)) result.counselingHistory = true;
  if (/친구|가족|배우자|엄마|아빠|선생님|도움|지지/.test(raw)) result.support = true;
  if (/검사|심리검사|상담|알고\s*싶|이해하고\s*싶/.test(raw)) result.needTest = true;
  return result;
}

function buildSessionState(userMessages) {
  const analyses = userMessages.map(analyzeMessage);
  const all = (key) => analyses.flatMap((a) => Array.isArray(a[key]) ? a[key] : []);
  return {
    userCount: userMessages.length,
    duration: analyses.find(a => a.duration)?.duration || null,
    hasTopic: analyses.some(a => a.topic.length || a.target),
    hasEmotion: analyses.some(a => a.emotion.length),
    hasBody: analyses.some(a => a.body.length),
    hasThought: analyses.some(a => a.thought),
    hasImpact: analyses.some(a => a.impact),
    hasCoping: analyses.some(a => a.coping),
    hasCounselingHistory: analyses.some(a => a.counselingHistory),
    hasSupport: analyses.some(a => a.support),
    needTest: analyses.some(a => a.needTest),
    topics: [...new Set(all("topic").concat(analyses.map(a => a.target).filter(Boolean)))],
    emotions: [...new Set(all("emotion"))],
    body: [...new Set(all("body"))],
  };
}

function getCompleteness(state) {
  const items = [state.hasTopic, Boolean(state.duration), state.hasEmotion, state.hasBody, state.hasThought, state.hasImpact, state.hasCoping, state.hasCounselingHistory, state.hasSupport];
  const checked = items.filter(Boolean).length;
  return { checked, total: items.length, ratio: checked / items.length };
}

module.exports = { normalize, analyzeMessage, buildSessionState, getCompleteness };
