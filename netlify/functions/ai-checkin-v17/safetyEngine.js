export function detectSafety(text = '') {
  const value = String(text || '');
  const crisisPattern = /자살|죽고\s*싶|죽고싶|자해|해치고|사라지고\s*싶|끝내고\s*싶|극단|목숨|유서|뛰어내리|칼로|약을\s*먹/i;
  return {
    crisis: crisisPattern.test(value)
  };
}

export function makeCrisisReply() {
  return `지금 이 마음은 혼자 버티기에는 너무 무거울 수 있습니다.\n\n스스로를 해치고 싶거나 당장 안전하지 않다고 느껴진다면, 지금은 대화를 이어가기보다 112, 119, 자살예방상담전화 109 또는 가까운 응급실의 도움을 먼저 받아야 합니다.\n\n지금 곁에 연락할 수 있는 사람이 있다면, 혼자 있지 않도록 바로 연결해 주세요.`;
}
