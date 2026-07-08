const crisisRegex = /(자살|죽고\s*싶|죽고싶|자해|해치고|사라지고\s*싶|끝내고\s*싶|극단|목숨|유서|살기\s*싫|죽을\s*래|죽을래|죽여|해칠)/i;
const abusiveRegex = /(씨발|시발|병신|꺼져|죽어|혐오|비하|차별|모욕|개새끼|미친놈|미친년|좆|ㅅㅂ|ㅂㅅ)/i;

export function detectSafety(text = '') {
  const source = String(text || '');
  return {
    crisis: crisisRegex.test(source),
    abusive: abusiveRegex.test(source)
  };
}

export function makeCrisisReply() {
  return [
    '지금은 대화를 이어가기보다 안전을 먼저 확인해야 하는 상황일 수 있습니다.',
    '스스로를 해치고 싶거나 당장 안전하지 않다고 느껴진다면 혼자 있지 말고, 지금 바로 112, 119, 자살예방상담전화 109 또는 가까운 응급실에 도움을 요청해 주세요.',
    '가능하다면 곁에 있는 사람에게 지금의 상태를 바로 알려 주세요.'
  ].join('\n\n');
}

export function makeAbuseLimitReply() {
  return [
    '이 대화는 마음을 안전하게 살펴보기 위한 공간입니다.',
    '욕설, 비방, 혐오나 공격적인 표현이 계속되면 상담을 이어가기 어렵습니다.',
    '마음을 나누고 싶은 주제가 있다면 그 내용으로 다시 이야기해 주세요.'
  ].join('\n\n');
}
