function buildInterventionPlan(state, latestAnalysis, mode) {
  const plan = { primary: "person_centered", secondary: null, level: 2, question: null, guidance: null };

  if (mode === "stabilize_emotion") {
    plan.primary = "emotion_stabilization"; plan.level = 2;
    plan.question = "지금 이 순간 안전하게 곁에 있어 줄 사람이나 머물 수 있는 곳이 있는지 하나만 확인하세요.";
    return plan;
  }
  if (mode === "direction_support") {
    plan.primary = "decision_support"; plan.secondary = "problem_solving"; plan.level = 4;
    plan.guidance = "선택지를 최대 3개로 정리하고 각각의 이점, 부담, 필요한 조건을 설명한 뒤 가장 작은 다음 행동 하나를 제안하세요.";
    return plan;
  }
  if (mode === "information_support") {
    plan.primary = "psychoeducation"; plan.level = 3;
    plan.guidance = "질문에 직접 답하되 일반 정보와 개인 판단을 구분하고 확인되지 않은 최신 정보는 단정하지 마세요.";
    return plan;
  }
  if (mode === "small_action_support") {
    plan.primary = "recovery_coaching"; plan.secondary = "problem_solving"; plan.level = 3;
    plan.question = "부담을 가장 작게 줄였을 때 오늘 할 수 있는 한 가지가 무엇인지 물어보세요.";
    return plan;
  }
  if (mode === "ambivalence_exploration") {
    plan.primary = "motivational_interviewing"; plan.level = 2;
    plan.question = "변화하고 싶은 마음과 망설이는 마음이 각각 무엇을 걱정하는지 하나만 탐색하세요.";
    return plan;
  }
  if (mode === "self_compassion_reflection") {
    plan.primary = "person_centered"; plan.secondary = "cbt"; plan.level = 2;
    plan.question = "같은 상황의 소중한 사람에게는 어떤 말을 해주고 싶은지 부담 없이 물어볼 수 있습니다.";
    return plan;
  }

  if (["listen_without_question", "small_summary", "finalize"].includes(mode)) return plan;
  if (!state.duration && state.userCount >= 2) plan.question = "언제부터 그런 어려움이 이어졌는지 하나만 확인하세요.";
  else if (latestAnalysis?.body?.length && !state.hasImpact && state.userCount >= 4) plan.question = "몸의 반응이 가장 심해지는 순간을 하나만 물어보세요.";
  else if (!state.hasCoping && state.userCount >= 5) plan.question = "그동안 혼자 해본 방법이 있었는지 하나만 물어보세요.";
  return plan;
}

function buildQuestionPlan(state, latestAnalysis, mode) {
  return buildInterventionPlan(state, latestAnalysis, mode).question;
}

module.exports = { buildQuestionPlan, buildInterventionPlan };
