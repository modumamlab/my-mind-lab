function buildQuestionPlan(state, latestAnalysis, mode) {
  if (mode === "no_question_hold" || mode === "brief_summary" || mode === "plain_response") {
    return null;
  }

  if (!state.duration && state.userCount >= 2) {
    return "언제부터 그런 어려움이 이어졌는지 하나만 확인하세요.";
  }

  if (latestAnalysis.body.length && !state.hasImpact && state.userCount >= 4) {
    return "몸의 반응이 가장 심해지는 순간을 하나만 물어보세요.";
  }

  if (!state.hasCoping && state.userCount >= 5) {
    return "그동안 혼자 해본 방법이 있었는지 하나만 물어보세요.";
  }

  if (!state.hasCounselingHistory && state.userCount >= 6) {
    return "이전에 상담이나 도움을 받아본 경험이 있는지 하나만 물어보세요.";
  }

  return null;
}

module.exports = { buildQuestionPlan };
