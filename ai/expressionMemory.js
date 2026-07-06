function buildExpressionGuide(aiMessages) {
  const recent = aiMessages.slice(-5).join(" ");
  const used = [];
  ["말씀해 주신 내용을 보니", "중요한 단서", "그 부담이 생활에", "마음이 그냥 지나가기 어려운 신호", "살펴보고 싶습니다", "흐름이라면", "영향을 주고 있나요", "수면, 식사"].forEach(w => {
    if (recent.includes(w)) used.push(w);
  });
  if (!used.length) return "같은 시작 문장과 같은 끝 질문을 반복하지 마세요.";
  return `최근 반복되었거나 피해야 할 표현: ${used.join(", ")}
이번 답변에서는 위 표현을 사용하지 마세요.
특히 '말씀해 주신 내용을 보니', '중요한 단서', '살펴보고 싶습니다'로 시작하거나 끝내지 마세요.
질문 없이 짧게 머무르는 응답도 자연스럽습니다.`;
}
module.exports = { buildExpressionGuide };
