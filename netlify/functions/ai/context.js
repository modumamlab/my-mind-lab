export function normalizeMessages(messages = []) {
  return (Array.isArray(messages) ? messages : [])
    .filter((m) => m && typeof m.text === 'string' && m.text.trim())
    .slice(-24)
    .map((m) => ({
      role: m.role === 'user' ? 'user' : 'assistant',
      text: String(m.text || '').trim().slice(0, 1600)
    }));
}

export function buildContext(messages = []) {
  const clean = normalizeMessages(messages);
  const userMessages = clean.filter((m) => m.role === 'user');
  const aiMessages = clean.filter((m) => m.role !== 'user');
  const lastUser = userMessages[userMessages.length - 1]?.text || '';
  const previousUser = userMessages[userMessages.length - 2]?.text || '';
  const allUserText = userMessages.map((m) => m.text).join('\n');
  const conversationText = clean
    .map((m) => `${m.role === 'user' ? '사용자' : 'AI 마음지기'}: ${m.text}`)
    .join('\n');

  return {
    messages: clean,
    userMessages,
    aiMessages,
    lastUser,
    previousUser,
    allUserText,
    conversationText,
    turnCount: userMessages.length
  };
}

export function detectUserIntent(context) {
  const last = context.lastUser || '';
  const wantsReport = /(마무리|정리|리포트|보고서|검사|추천|예약|끝낼래|충분|그만|마칠)/.test(last);
  const isQuestion = /\?|어떻게|어쩌|뭘|무엇|방법|왜|그럼|그래서|해야\s*해|해야\s*하지|뜻|의미|이유/.test(last);
  const isCorrection = /(아니|그게\s*아니|그런\s*뜻|잘못|틀렸|수정|그게\s*아닌데|그런\s*말이\s*아니)/.test(last);

  return { wantsReport, isQuestion, isCorrection };
}
