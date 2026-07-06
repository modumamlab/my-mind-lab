const { recommendTests } = require("./testRecommendation");

function buildProfessionalSummary(state, elapsedMinutes) {
  const tests = recommendTests(state);
  const testText = tests.length
    ? tests.map(t => `- ${t.name}: ${t.reason}`).join("\n")
    : "- TCI 기질 및 성격검사: 현재 어려움을 이해하는 데 필요한 개인의 반응 경향을 살펴보는 데 도움이 됩니다.";

  return `오늘 이야기를 함께 나누면서, 지금의 어려움이 한순간 지나가는 감정보다 반복되는 긴장과 마음의 소진에 더 가까울 수 있다는 점을 확인했습니다.

지금 단계에서는 모든 것을 바로 해결하려 하기보다, 어떤 상황에서 마음과 몸이 먼저 반응하는지 차분히 이해해 보는 것이 도움이 됩니다.

현재 이야기 흐름을 바탕으로는 아래 검사를 우선 고려해 볼 수 있습니다.

${testText}

검사는 나를 판단하기 위한 것이 아니라, 나를 더 잘 이해하고 상담 방향을 정하기 위한 도구입니다. 더 깊은 해석과 상담은 모두의 마음연구소 전문가 상담에서 이어갈 수 있습니다.`;
}
module.exports = { buildProfessionalSummary };
