const bannedFragments = [
  '말이 바로 나오지 않는군요',
  '그 이야기가 짧지만',
  '피로/소진',
  'emotion_reflection',
  '좋은 응답:',
  '대화 예시:'
];

export function postProcess(text = '') {
  let result = String(text || '').trim();
  result = result.replace(/^AI 마음지기\s*[:：]\s*/i, '').trim();
  result = result.replace(/^답변\s*[:：]\s*/i, '').trim();

  for (const fragment of bannedFragments) {
    result = result.split(fragment).join('');
  }

  // 과도한 빈 줄 정리
  result = result.replace(/\n{3,}/g, '\n\n').trim();
  return result;
}
