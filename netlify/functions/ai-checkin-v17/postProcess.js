export function postProcess(text = '') {
  let value = String(text || '').trim();
  value = value.replace(/^AI 마음지기[:：]\s*/i, '').trim();
  value = value.replace(/^(답변|응답)[:：]\s*/i, '').trim();

  const banned = [
    /제가\s*앞서\s*해석하지\s*않기\s*위해\s*먼저\s*확인하고\s*싶어요\.?/gi,
    /방금\s*말씀하신\s*내용에서\s*지금\s*가장\s*중요하게\s*봐야\s*할\s*부분은\s*어떤\s*점일까요\??/gi,
    /말이\s*바로\s*나오지\s*않는군요\.?/gi,
    /그\s*이야기가\s*짧지만/gi,
    /그\s*말이\s*짧지만/gi,
    /쉽지\s*않았겠어요\.?/gi,
    /지금\s*떠오르는\s*만큼만/gi,
    /그\s*이야기가\s*그냥\s*지나치기\s*어렵게/gi,
    /천천히\s*따라가\s*보겠습니다\.?/gi,
    /편한\s*만큼만\s*이어가도\s*괜찮습니다\.?/gi,
    /그\s*마음이\s*느껴집니다\.?/gi
  ];
  for (const pattern of banned) value = value.replace(pattern, '').trim();

  const lines = value.split('\n').map((line) => line.trim()).filter(Boolean);
  const compact = [];
  for (const line of lines) {
    if (compact[compact.length - 1] !== line) compact.push(line);
  }
  value = compact.join('\n\n').trim();

  const genericOnly = [
    /^확인하고\s*싶습니다\.?$/,
    /^조금\s*더\s*알려주세요\.?$/,
    /^무엇이\s*가장\s*중요할까요\??$/
  ];
  if (!value || genericOnly.some((p) => p.test(value))) {
    value = '방금 표현하신 말을 같은 문장으로 넘기지 않고, 조금 더 구체적으로 이해해 보겠습니다. 지금 떠오르는 느낌이 몸의 피로에 가까운지, 마음까지 함께 지친 느낌에 가까운지부터 확인해 볼까요?';
  }

  if (value.length > 900) value = value.slice(0, 900).replace(/[^.!?。！？\n]*$/, '').trim();
  return value;
}
