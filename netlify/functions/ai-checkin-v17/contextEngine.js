export function buildContext(messages = []) {
  const normalized = messages
    .filter((m) => m && typeof m.text === 'string')
    .slice(-20)
    .map((m) => ({ role: m.role === 'user' ? 'user' : 'ai', text: String(m.text || '').trim() }))
    .filter((m) => m.text);

  const userTurns = normalized.filter((m) => m.role === 'user');
  const aiTurns = normalized.filter((m) => m.role !== 'user');
  const lastUser = [...normalized].reverse().find((m) => m.role === 'user')?.text || '';
  const previousUser = userTurns.length > 1 ? userTurns[userTurns.length - 2].text : '';
  const userFlow = userTurns.map((m, i) => `${i + 1}. ${m.text}`).join('\n') || '(아직 내담자 말이 충분하지 않음)';
  const previousAi = aiTurns.slice(-5).map((m) => m.text).join('\n---\n') || '(이전 AI 답변 없음)';
  const allUserText = userTurns.map((m) => m.text).join('\n');

  return {
    normalized,
    userTurns,
    aiTurns,
    lastUser,
    previousUser,
    userFlow,
    previousAi,
    allUserText,
    turnCount: userTurns.length
  };
}
