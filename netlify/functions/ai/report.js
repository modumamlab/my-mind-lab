export function shouldCloseSession({ context, intent, minutes }) {
  return Boolean(intent.wantsReport || minutes >= 15 || context.turnCount >= 14);
}

export function buildClosingInstruction(shouldClose) {
  if (!shouldClose) {
    return '아직 상담을 마무리하지 말고, 현재 대화의 흐름을 자연스럽게 이어가세요.';
  }

  return `
이번 응답에서는 상담을 자연스럽게 마무리하세요.
마무리에는 다음을 포함하세요.
1. 지금까지의 마음을 자연스럽게 정리합니다.
2. 심리학적 통찰을 하나 제시합니다.
3. 필요한 경우에는 심리검사를 추천합니다.
4. 추천하는 경우에는 추천 이유를 함께 설명합니다.
단, 사용자가 충분히 말하지 않은 내용은 새로 만들어내지 마세요.
`;
}
