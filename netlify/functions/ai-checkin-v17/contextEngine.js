export function buildContext(messages = []) {
  const safeMessages = Array.isArray(messages)
    ? messages
        .filter((m) => m && typeof m.text === 'string' && m.text.trim())
        .slice(-24)
        .map((m) => ({
          role: m.role === 'user' ? 'user' : 'assistant',
          text: String(m.text || '').trim().slice(0, 1200)
        }))
    : [];

  const userMessages = safeMessages.filter((m) => m.role === 'user');
  const assistantMessages = safeMessages.filter((m) => m.role !== 'user');
  const lastUser = userMessages[userMessages.length - 1]?.text || '';
  const previousUser = userMessages[userMessages.length - 2]?.text || '';
  const allUserText = userMessages.map((m) => m.text).join('\n');
  const previousAssistantText = assistantMessages.map((m) => m.text).join('\n');

  const conversationText = safeMessages
    .map((m) => `${m.role === 'user' ? '내담자' : 'AI 마음지기'}: ${m.text}`)
    .join('\n');

  return {
    messages: safeMessages,
    userMessages,
    assistantMessages,
    lastUser,
    previousUser,
    allUserText,
    previousAssistantText,
    conversationText,
    turnCount: userMessages.length,
    assistantTurnCount: assistantMessages.length
  };
}
