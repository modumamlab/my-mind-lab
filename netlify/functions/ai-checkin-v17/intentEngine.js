export function analyzeIntent(context) {
  const last = context.lastUser || '';
  const all = context.allUserText || '';
  const compact = last.replace(/\s+/g, '');

  const isCorrection = /(아니|그게\s*아니|그런\s*뜻|잘못|틀렸|수정|그게\s*아닌데|그런\s*말이\s*아니)/.test(last);
  const isQuestion = /\?|어떻게|어쩌|뭘|무엇|방법|왜|그럼|그래서|해야\s*해|해야\s*하지|바라보는\s*방법|뜻이야|말이야/.test(last);
  const asksHow = /어떻게|어쩌|방법|해야\s*해|해야\s*하지|뭘\s*해야|무엇부터|그럼|그래서/.test(last);
  const asksMeaning = /왜|뜻|의미|뭐야|말이야|어디서부터|원인|이유/.test(last);
  const isEmotion = /(힘들|지쳐|피곤|아무것도|하기\s*싫|하고\s*싶지|막막|모르겠|떠오르지|생각조차|눈물|공허|답답|외롭|무섭|불안|긴장|화나|짜증|억울|서운|버거|무거|무기력|의욕)/.test(last);
  const wantsReport = /(마무리|정리해|리포트|검사|추천|예약|끝낼래|충분)/.test(last);

  let mode = 'emotion_reflection';
  if (isCorrection) mode = 'correction';
  else if (isQuestion && asksHow) mode = 'answer_question';
  else if (isQuestion) mode = 'answer_question';
  else if (wantsReport) mode = 'summary_report';
  else if (isEmotion) mode = 'emotion_reflection';

  const themes = [];
  const push = (regex, label) => { if (regex.test(last) || regex.test(all)) themes.push(label); };
  push(/아무것도|하기\s*싫|하고\s*싶지|무기력|의욕|움직|손이\s*안|귀찮|못하겠/, '무기력/에너지 저하');
  push(/생각조차|생각\s*안|머리|멍|떠오르지|정리\s*안|과부하/, '생각 과부하/정리 어려움');
  push(/모르겠|막막|앞으로|방향|답이\s*없|어디서부터/, '막막함/방향 상실');
  push(/피곤|지쳐|소진|쉬어도|번아웃|버거/, '피로/소진');
  push(/불안|긴장|무서|두려|걱정/, '불안/긴장');
  push(/눈물|울|슬프|서글프/, '슬픔');
  push(/화|짜증|억울|분노|서운|답답/, '분노/답답함');

  return {
    mode,
    isQuestion,
    asksHow,
    asksMeaning,
    isCorrection,
    wantsReport,
    themes: [...new Set(themes)].slice(0, 4),
    lastCompact: compact
  };
}
