function normalize(text) {
  return String(text || "").replace(/\s+/g, " ").trim();
}

const profanityPatterns = [
  /씨발|시발|ㅅㅂ|병신|ㅂㅅ|좆|개새끼|미친놈|미친년|꺼져|닥쳐|죽어/i,
  /년놈|새끼|개같|엿먹/i
];

const hatePatterns = [
  /정신병자|정병|장애.*비하/i,
  /김치녀|한남|틀딱|급식충|맘충/i,
  /혐오|차별|인종|종교|성별|장애.*비하/i
];

const riskPatterns = [
  /죽고\s*싶|자살|자해|사라지고\s*싶|끝내고\s*싶|살기\s*싫|나를\s*해치|목숨/i,
  /죽여버리|해치고\s*싶|칼로|불\s*지르/i
];

function detectSafety(text, previousWarningCount = 0) {
  const raw = normalize(text);
  const isRisk = riskPatterns.some((p) => p.test(raw));
  const isAbuse = profanityPatterns.some((p) => p.test(raw)) || hatePatterns.some((p) => p.test(raw));
  const warningCount = isAbuse ? previousWarningCount + 1 : previousWarningCount;
  return { isRisk, isAbuse, warningCount, shouldBlock: isAbuse && warningCount >= 3 };
}

function buildAbuseWarning(warningCount) {
  if (warningCount <= 1) return "AI 마음체크인은 안전한 대화를 위한 공간입니다.\n\n지금 표현에는 상대를 해치거나 불편하게 만들 수 있는 말이 포함되어 있어요. 조금 더 차분한 표현으로 다시 이야기해 주세요.";
  if (warningCount === 2) return "반복적인 욕설이나 혐오 표현이 확인되었습니다.\n\nAI 마음체크인은 서로를 존중하는 대화를 기준으로 운영됩니다. 같은 표현이 한 번 더 반복되면 이용이 일시적으로 제한될 수 있습니다.";
  return "안전한 상담 환경을 위해 현재 AI 마음체크인 이용을 일시적으로 중단합니다.\n\n필요하신 경우 카카오채널로 문의해 주세요.";
}

function buildRiskResponse() {
  return "지금은 무엇보다 안전이 가장 중요합니다. 혼자 견디기에는 너무 큰 고통일 수 있어요.\n\n혹시 지금 바로 자신을 해칠 위험이 있거나, 구체적인 계획이 있다면 혼자 있지 말고 112, 119, 자살예방상담전화 109 또는 가까운 응급실에 바로 도움을 요청해 주세요.\n\n저는 지금 이 순간 대표님의 안전을 가장 먼저 생각하겠습니다.";
}

module.exports = { detectSafety, buildAbuseWarning, buildRiskResponse };
