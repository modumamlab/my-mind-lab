function rememberExpressions(aiMessages) {
  const recent = aiMessages.slice(-5).join(" ");
  const used = [];
  ["힘드셨", "부담", "흐름", "영향", "살펴", "이어져", "긴장", "혼자"].forEach(w => {
    if (recent.includes(w)) used.push(w);
  });
  return used;
}

function buildExpressionGuide(aiMessages) {
  const used = rememberExpressions(aiMessages);
  if (!used.length) {
    return "최근 반복 표현은 많지 않습니다. 그래도 같은 문장 구조를 반복하지 마세요.";
  }
  return `최근 사용된 표현: ${used.join(", ")}
이번 답변에서는 위 표현을 가능한 한 반복하지 말고, 더 쉬운 일상적 상담 언어를 사용하세요.
같은 시작 문장과 같은 끝 질문을 반복하지 마세요.`;
}

module.exports = { rememberExpressions, buildExpressionGuide };
