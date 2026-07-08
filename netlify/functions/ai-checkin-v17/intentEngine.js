export function analyzeIntent(context) {
  const last = context.lastUser || '';
  const compact = last.replace(/\s+/g, '');

  const isCorrection = /(아니|그게\s*아니|그런\s*뜻|잘못|틀렸|수정|오해|그게\s*아닌데|그런\s*말이\s*아니)/.test(last);
  const isQuestion = /\?|어떻게|어쩌|뭘|무엇|방법|왜|그럼|그래서|해야\s*해|해야\s*하지|뜻이야|말이야/.test(last);
  const wantsReport = /(마무리|정리해|리포트|검사|추천|예약|끝낼래|충분|그만|종료)/.test(last);

  let mode = 'dialogue';
  if (wantsReport) mode = 'summary_report';
  else if (isCorrection) mode = 'correction';
  else if (isQuestion) mode = 'answer_question';

  return {
    mode,
    isQuestion,
    isCorrection,
    wantsReport,
    lastCompact: compact
  };
}
