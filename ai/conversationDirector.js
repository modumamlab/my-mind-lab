function chooseMode(state, aiMessages, timePhase) {
  const lastAI = aiMessages[aiMessages.length - 1] || "";
  const recent = aiMessages.slice(-3).join(" ");
  if (timePhase === "ended" || timePhase === "wrap_up") return "finalize";
  if (timePhase === "two_min_left") return "time_notice";
  if (/[?？]/.test(lastAI)) return "no_question_hold";
  if (state.userCount <= 1) return "warm_reflection";
  if (!state.hasEmotion) return "emotion_reflection";
  if (!state.duration && state.userCount >= 2) return "gentle_question";
  if (!state.hasBody && state.emotions.some(e => e.includes("불안"))) return "body_reflection";
  if (state.userCount % 4 === 0) return "brief_summary";
  if (/말씀해 주신|중요한 단서|마음이 그냥 지나가기 어려운|살펴보고 싶습니다/.test(recent)) return "plain_response";
  if (/부담|영향|흐름|살펴/.test(recent)) return "plain_response";
  const modes = ["meaning_reflection", "no_question_hold", "short_empathy"];
  return modes[state.userCount % modes.length];
}

function buildDirectorNote(mode) {
  const notes = {
    warm_reflection: "처음 나온 이야기를 크게 해석하지 말고 안전하게 받아 주세요. 질문은 필요할 때만 합니다.",
    emotion_reflection: "감정 이름을 단정하지 말고 내담자가 느꼈을 법한 마음을 담백하게 비춰 주세요.",
    gentle_question: "새로운 정보를 하나만 부드럽게 확인하세요. 질문은 한 개만 사용하세요.",
    body_reflection: "몸의 반응을 마음의 긴장과 연결해 짧게 반영하세요. 생활 전반 질문은 하지 마세요.",
    brief_summary: "지금까지 나온 내용을 2문장 정도로 요약하세요. 질문은 하지 않는 것을 우선하세요.",
    no_question_hold: "직전 AI가 질문했거나 질문이 많았습니다. 이번에는 질문하지 말고 짧게 머물러 주세요.",
    plain_response: "어려운 상담 용어 없이 아주 자연스럽게 말하세요. '말씀해 주신 내용을 보니/중요한 단서/부담/흐름/영향/살펴보다' 표현을 피하세요.",
    meaning_reflection: "내담자 원문을 따라하지 말고 의미를 상담자 언어로 재진술하세요.",
    short_empathy: "짧게 받아 주세요. 질문하지 않아도 됩니다.",
    time_notice: "시간이 얼마 남지 않았음을 부드럽게 안내하고, 가장 중요한 이야기 하나만 말할 수 있게 해 주세요.",
    finalize: "더 탐색하지 말고 오늘 대화를 정리하고 필요한 검사 추천과 다음 연결을 안내하세요."
  };
  return notes[mode] || notes.meaning_reflection;
}

module.exports = { chooseMode, buildDirectorNote };
