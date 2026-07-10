function chooseMode(state, aiMessages, timePhase) {
  const lastAI = aiMessages[aiMessages.length - 1] || "";
  const recent = aiMessages.slice(-3).join(" ");

  // [MOD] 마음체크는 전문 접수면접이 아니라 1388형 마음지기 대화입니다. 질문보다 들어주기와 마음정리를 우선합니다.
  if (timePhase === "ended" || timePhase === "wrap_up") return "finalize";
  if (timePhase === "two_min_left") return "gentle_time_notice";
  if (/[?？]/.test(lastAI)) return "listen_without_question";
  if (state.userCount <= 1) return "safe_welcome";
  if (!state.hasEmotion) return "soft_reflection";
  if (state.userCount % 4 === 0) return "small_summary";
  if (/검사|심리검사|추천/.test(recent)) return "listen_without_question";

  const modes = ["warm_listening", "soft_reflection", "listen_without_question", "small_summary"];
  return modes[state.userCount % modes.length];
}

function buildDirectorNote(mode) {
  const notes = {
    safe_welcome: "처음 꺼낸 이야기를 크게 해석하지 말고 안전하게 받아 주세요. 상담자처럼 무겁지 않게, 친구처럼 가볍지도 않게 반응하세요.",
    warm_listening: "해결책을 말하기보다 먼저 들어 주세요. 사용자가 꺼낸 상황과 감정을 쉬운 말로 받아 주세요.",
    soft_reflection: "감정 이름을 단정하지 말고, 사용자가 느꼈을 법한 마음을 담백하게 비춰 주세요.",
    listen_without_question: "이번 답변에서는 질문하지 말고 머물러 주세요. 짧은 공감이나 마음정리만으로 충분합니다.",
    small_summary: "지금까지 나온 이야기를 2~3문장으로 짧게 정리하세요. 심리검사는 아직 추천하지 마세요.",
    gentle_time_notice: "대화가 마무리로 가고 있음을 부드럽게 안내하고, 새 질문을 많이 하지 마세요.",
    finalize: "오늘 대화를 쉬운 말로 정리하고, 필요한 경우 심리검사 1~2개와 추천 이유를 안내하세요. 새 질문으로 끝내지 마세요."
  };
  return notes[mode] || notes.warm_listening;
}

module.exports = { chooseMode, buildDirectorNote };
