const fixedPhrases = [
  /피로\/소진/g,
  /무기력\/에너지 저하/g,
  /emotion_reflection/g,
  /말이 바로 나오지 않는군요\.?/g,
  /그 이야기가 짧지만/g,
  /조금 더 이야기해 주세요\.?/g,
  /피곤하다는 말씀이 들립니다\.?/g,
  /그 마음이 느껴집니다\.?/g
];

export function postProcess(text = '') {
  let output = String(text || '').trim();

  fixedPhrases.forEach((pattern) => {
    output = output.replace(pattern, '');
  });

  output = output
    .replace(/\n{3,}/g, '\n\n')
    .replace(/^[\s\-•]+/gm, '')
    .trim();

  if (!output) {
    return '제가 앞서 해석하지 않기 위해 먼저 확인하고 싶습니다. 지금 말씀하신 내용에서 가장 중요하게 봐야 할 부분은 어떤 점일까요?';
  }

  return output;
}
