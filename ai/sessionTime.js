const MIN_MINUTES = 10;
const WRAP_UP_MINUTES = 12;
const MAX_MINUTES = 15;

function getElapsedMinutes(sessionStart) {
  const start = Number(sessionStart || Date.now());
  return Math.max(0, (Date.now() - start) / 1000 / 60);
}

function getTimePhase(elapsedMinutes) {
  if (elapsedMinutes >= MAX_MINUTES) return "ended";
  if (elapsedMinutes >= WRAP_UP_MINUTES) return "wrap_up";
  if (elapsedMinutes >= MIN_MINUTES) return "check_readiness";
  if (elapsedMinutes >= MAX_MINUTES - 2) return "two_min_left";
  return "in_progress";
}

function buildTimeGuide(elapsedMinutes) {
  const phase = getTimePhase(elapsedMinutes);
  if (phase === "wrap_up") return "상담 시간이 12분을 넘어 마무리 단계입니다. 새 질문을 늘리지 말고 오늘 이야기를 정리하고 필요한 검사 추천으로 연결하세요.";
  if (phase === "ended") return "최대 이용시간 15분에 도달했습니다. 더 탐색하지 말고 오늘 이야기를 정리하고 종료 안내를 하세요.";
  if (phase === "check_readiness") return "10분 이상 진행되었습니다. 핵심 정보가 충분하면 정리 단계로 넘어가고, 부족하면 가장 중요한 질문 하나만 하세요.";
  if (phase === "two_min_left") return "상담 시간이 얼마 남지 않았습니다. 가장 남겨두고 싶은 이야기를 하나만 말할 수 있도록 안내하세요.";
  return "아직 상담 진행 중입니다. 자연스럽게 듣고, 필요한 경우 한 가지씩만 확인하세요.";
}

module.exports = { MIN_MINUTES, WRAP_UP_MINUTES, MAX_MINUTES, getElapsedMinutes, getTimePhase, buildTimeGuide };
