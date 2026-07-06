function recommendTests(state) {
  const tests = [];
  if (state.emotions.some(e => e.includes("불안"))) tests.push({ name: "불안검사", reason: "긴장과 불안이 어느 정도인지 확인해 상담 방향을 잡는 데 도움이 됩니다." });
  if (state.emotions.some(e => e.includes("우울") || e.includes("슬픔"))) tests.push({ name: "우울검사", reason: "무기력과 기분 저하가 얼마나 지속되고 있는지 이해하는 데 도움이 됩니다." });
  if (state.topics.some(t => /대인|교수|직장|업무/.test(t)) || state.emotions.length) tests.push({ name: "TCI 기질 및 성격검사", reason: "스트레스 상황에서 반복되는 반응과 대처 방식을 이해하는 데 도움이 됩니다." });
  if (state.topics.some(t => /대인|교수|직장|업무/.test(t))) tests.push({ name: "SCT 문장완성검사", reason: "말로 정리하기 어려운 생각과 관계 속 마음을 살펴보는 데 도움이 됩니다." });
  return tests.slice(0, 2);
}
module.exports = { recommendTests };
