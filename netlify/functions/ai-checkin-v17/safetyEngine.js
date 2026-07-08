export function detectSafety(text = '') {
  const source = String(text || '');
  const crisis = /(자살|죽고\s*싶|죽고싶|자해|해치고\s*싶|사라지고\s*싶|끝내고\s*싶|극단|목숨|유서|죽어버리고|살기\s*싫)/.test(source);
  const aggression = /(죽여|해치겠다|때리고\s*싶|칼|흉기|복수하고\s*싶)/.test(source);
  const abuse = /(씨발|ㅅㅂ|병신|개새|꺼져|혐오|비하|비방|모욕|차별|닥쳐)/i.test(source);

  return {
    crisis: crisis || aggression,
    aggression,
    abuse
  };
}

export function makeCrisisReply() {
  return '지금은 무엇보다 안전이 가장 중요합니다.\n\n스스로를 해치고 싶거나 누군가를 해칠 위험이 조금이라도 있다면, 지금 바로 112, 119, 자살예방상담전화 109 또는 가까운 응급실에 도움을 요청해 주세요.\n\n가능하다면 지금 혼자 있지 말고, 곁에 있는 사람이나 연락할 수 있는 사람에게 현재 상태를 알려 주세요.';
}

export function makeAbuseLimitReply() {
  return '이 공간은 마음을 안전하게 살펴보기 위한 대화 공간입니다.\n\n욕설, 비방, 혐오, 모욕적인 표현이 이어지면 상담 대화를 계속 진행하기 어렵습니다.\n\n마음을 나누고 싶은 내용이 있다면 존중을 지키는 방식으로 다시 이야기해 주세요.';
}
