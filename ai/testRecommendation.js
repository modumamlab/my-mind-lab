function recommendTests(state) {
  const tests = [];

  // [MOD] 심리검사는 대화 마지막에만 1~2개 추천하기 위한 가벼운 추천 로직으로 정리했습니다.
  if (state.emotions.some(e => e.includes("불안") || e.includes("긴장"))) {
    tests.push({ name: "불안검사", reason: "걱정과 긴장이 어느 정도 쌓여 있는지 확인하면 지금 마음을 이해하는 데 도움이 됩니다." });
  }

  if (state.emotions.some(e => e.includes("우울") || e.includes("슬픔") || e.includes("무기력"))) {
    tests.push({ name: "우울검사", reason: "무기력하거나 가라앉은 마음이 얼마나 이어지고 있는지 살펴보는 데 도움이 됩니다." });
  }

  if (state.topics.some(t => /가족|부부|자녀|부모|양육/.test(t))) {
    tests.push({ name: "TCI 기질 및 성격검사", reason: "가까운 관계에서 반복되는 반응과 마음의 패턴을 이해하는 데 도움이 됩니다." });
  }

  if (state.topics.some(t => /친구|대인|사람|관계|직장|업무|학교|교수/.test(t))) {
    tests.push({ name: "SCT 문장완성검사", reason: "말로 정리하기 어려운 생각과 관계 속 마음을 조금 더 자연스럽게 살펴볼 수 있습니다." });
  }

  if (!tests.length && state.emotions.length) {
    tests.push({ name: "TCI 기질 및 성격검사", reason: "스트레스를 받을 때 반복되는 마음의 반응과 나만의 대처 방식을 이해하는 데 도움이 됩니다." });
  }

  const unique = [];
  const seen = new Set();
  for (const test of tests) {
    if (!seen.has(test.name)) {
      unique.push(test);
      seen.add(test.name);
    }
  }

  return unique.slice(0, 2);
}
module.exports = { recommendTests };
