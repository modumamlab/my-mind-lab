function chooseMode(state, aiMessages, timePhase) {
  const lastAI = aiMessages[aiMessages.length - 1] || "";
  const recent = aiMessages.slice(-3).join(" ");

  if (timePhase === "ended" || timePhase === "wrap_up") return "finalize";
  if (timePhase === "two_min_left") return "gentle_time_notice";
  if (state.emotionIntensity >= 4) return "stabilize_emotion";
  if (state.directionLoss) return "direction_support";
  if (state.informationNeed) return "information_support";
  if (state.actionDifficulty) return "small_action_support";
  if (state.changeAmbivalence) return "ambivalence_exploration";
  if (state.repeatedSelfCriticism) return "self_compassion_reflection";
  if (/[?？]/.test(lastAI)) return "listen_without_question";
  if (state.userCount <= 1) return "safe_welcome";
  if (!state.hasEmotion) return "soft_reflection";
  if (state.userCount % 4 === 0) return "small_summary";
  if (/검사|심리검사|추천/.test(recent)) return "listen_without_question";
  return ["warm_listening", "soft_reflection", "listen_without_question", "small_summary"][state.userCount % 4];
}

function buildDirectorNote(mode) {
  const notes = {
    safe_welcome: "처음 꺼낸 이야기를 크게 해석하지 말고 안전하게 받아 주세요.",
    warm_listening: "해결책보다 먼저 상황과 마음을 구체적으로 이해해 주세요.",
    soft_reflection: "감정을 단정하지 말고 사용자의 표현을 바탕으로 담백하게 비춰 주세요.",
    listen_without_question: "이번 답변에서는 질문하지 말고 짧은 공감과 마음정리만 제공하세요.",
    small_summary: "지금까지 확인된 내용만 2~3문장으로 정리하고 강점이 보이면 함께 반영하세요.",
    stabilize_emotion: "정보나 해결책보다 정서적 안정과 현재 안전 확인을 우선하세요. 질문은 꼭 필요한 한 가지로 제한하세요.",
    direction_support: "사용자가 막막함을 느끼고 있습니다. 이해를 먼저 보여준 뒤 선택지를 최대 3개로 구조화하고, 장단점과 현실 조건을 짧게 설명하세요. 결정은 사용자에게 남기세요.",
    information_support: "확인 가능한 일반 정보만 쉬운 말로 제공하세요. 최신 정책·기관·비용처럼 외부 확인이 필요한 내용은 단정하지 마세요.",
    small_action_support: "큰 계획 대신 오늘 또는 이번 주에 할 수 있는 가장 작은 행동 한 가지를 함께 정하세요.",
    ambivalence_exploration: "변화하고 싶은 마음과 망설이는 마음을 모두 인정하고 어느 쪽도 강요하지 마세요.",
    self_compassion_reflection: "자기비난을 사실처럼 받아들이지 말고, 그동안의 노력과 맥락을 함께 비춰 주세요.",
    gentle_time_notice: "마무리 시간을 부드럽게 알리고 새로운 주제를 넓히지 마세요.",
    finalize: "오늘 이해한 점, 확인된 강점, 작은 다음 행동, 다음에 살펴볼 주제를 정리하고 새 질문으로 끝내지 마세요."
  };
  return notes[mode] || notes.warm_listening;
}

module.exports = { chooseMode, buildDirectorNote };
