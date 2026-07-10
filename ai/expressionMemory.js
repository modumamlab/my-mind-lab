function buildExpressionGuide(aiMessages) {
  const recent = aiMessages.slice(-5).join(" ");
  const used = [];

  // [MOD] 반복되어 상담 AI처럼 딱딱하게 들리는 표현을 더 넓게 차단합니다.
  [
    "말씀해 주신 내용을 보니",
    "중요한 단서",
    "그 부담이 생활에",
    "마음이 그냥 지나가기 어려운 신호",
    "살펴보고 싶습니다",
    "흐름이라면",
    "영향을 주고 있나요",
    "수면, 식사",
    "어떤 부분이 가장",
    "조금 더 이야기해 주실 수 있을까요",
    "정서적 소진",
    "대인관계 스트레스"
  ].forEach(w => {
    if (recent.includes(w)) used.push(w);
  });

  if (!used.length) {
    return "같은 시작 문장과 같은 끝 질문을 반복하지 마세요. 질문 없이 들어주거나 짧게 마음을 정리하는 응답도 자연스럽습니다.";
  }

  return `최근 반복되었거나 피해야 할 표현: ${used.join(", ")}
이번 답변에서는 위 표현을 사용하지 마세요.
특히 같은 공감 문장으로 시작하거나 매번 질문으로 끝내지 마세요.
마음체크는 검사 유도보다 편안한 마음 대화가 우선입니다.`;
}
module.exports = { buildExpressionGuide };
