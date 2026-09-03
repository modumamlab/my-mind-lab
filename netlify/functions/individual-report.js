const jsonResponse = (obj, statusCode = 200) => ({
  statusCode,
  headers: {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json; charset=utf-8'
  },
  body: JSON.stringify(obj)
});

const clean = (value, max = 20000) => String(value || '').trim().slice(0, max);
const esc = (value) => clean(value).replace(/[&<>'"]/g, (ch) => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[ch]));

function profile(testName) {
  const test = clean(testName, 100) || '심리검사';
  const profiles = {
    TCI:{purpose:'기질과 성격의 상호작용을 통해 정서적 반응, 관계 방식, 자기조절 및 적응 특성을 이해하기 위한 검사입니다.',domains:['자극과 변화','불안과 위험 인식','관계 민감성','지속성과 인내','자기조절','협력과 의미']},
    'MMPI-2':{purpose:'현재의 정서 상태와 성격 특성, 스트레스 반응 및 적응상의 어려움을 폭넓게 살펴보기 위한 검사입니다.',domains:['응답 신뢰도','정서 상태','사고와 집중','신체화 반응','관계 경험','적응 자원']},
    PAI:{purpose:'정서·사고·대인관계 및 행동 특성을 다차원적으로 평가해 현재의 심리상태와 적응 방식을 이해하기 위한 검사입니다.',domains:['정서','사고','행동 조절','대인관계','스트레스','보호 자원']},
    SCT:{purpose:'문장을 자유롭게 완성하면서 자신, 가족, 관계, 미래에 대한 생각과 감정을 살펴보는 검사입니다.',domains:['자기 인식','가족 경험','관계 경험','정서 표현','미래 기대','갈등과 자원']},
    HTP:{purpose:'그림에 나타난 자기 모습, 관계 경험, 긴장과 심리적 자원을 살펴보는 검사입니다.',domains:['자기상','안정감','관계 경험','정서 표현','긴장 반응','심리 자원']},
    PAT:{purpose:'부모의 양육 태도와 자녀를 대하는 상호작용 특성을 이해하기 위한 검사입니다.',domains:['애정 표현','규칙과 한계','자율성 지원','기대 수준','의사소통','양육 자원']},
    'K-CDI':{purpose:'부모 또는 교사의 보고를 통해 아동의 영역별 발달 특성을 살펴보고 발달 상태를 선별하기 위한 검사입니다.',domains:['사회성','자조행동','대근육 운동','소근육 운동','표현언어','언어이해','글자·숫자','전체발달']},
    'PHQ-9':{purpose:'최근 경험한 우울 관련 증상의 빈도와 일상 기능에 미치는 영향을 확인하기 위한 선별검사입니다.',domains:['기분','흥미와 의욕','수면','에너지','집중','일상 기능']},
    'GAD-7':{purpose:'최근 경험한 불안과 걱정의 정도, 긴장 및 일상 기능에 미치는 영향을 확인하기 위한 선별검사입니다.',domains:['걱정','긴장','조절감','신체 반응','집중','일상 기능']},
    STS:{purpose:'개인의 타고난 기질 특성과 자기조절 경향을 6요인을 중심으로 이해하기 위한 검사입니다.',domains:['활동성','조심성','긍정정서','부정정서','사회적 민감성','의도적 조절']},
    '회복탄력성':{purpose:'어려움 이후 다시 균형을 회복하고 적응해 가는 심리적 자원을 살펴보기 위한 검사입니다.',domains:['정서 조절','충동 통제','낙관성','원인 분석','공감','관계 자원']}
  };
  const key = Object.keys(profiles).find((k) => test.toUpperCase().includes(k.toUpperCase()));
  return profiles[key] || {purpose:`${test} 결과를 통해 현재의 심리적 특성과 반응 경향, 적응 자원을 이해하기 위한 검사입니다.`,domains:['정서','사고','관계','스트레스','자기조절','도움이 되는 것']};
}

function sentences(value) {
  return clean(value).split(/\n+|(?<=[.!?다요])\s+/).map((x) => x.trim()).filter(Boolean);
}

function css() { return `
*{box-sizing:border-box}html,body{margin:0;padding:0}body{background:#e9efec;color:#20322d;font-family:Pretendard,'Noto Sans KR',Arial,sans-serif;-webkit-print-color-adjust:exact;print-color-adjust:exact}.mml-report{padding:18px 0}.mml-page{position:relative;width:210mm;min-height:297mm;margin:0 auto 18px;background:#fff;padding:16mm 15mm 14mm;box-shadow:0 18px 55px rgba(24,61,49,.14);overflow:hidden}.mml-page:before{content:'';position:absolute;left:0;top:0;width:100%;height:7mm;background:linear-gradient(90deg,#123f33 0 62%,#c89458 62% 74%,#edf2ef 74%)}.head{display:flex;justify-content:space-between;gap:28px;padding-top:7mm;padding-bottom:11px;border-bottom:1px solid #cad8d2}.kicker{margin:0 0 7px;font-size:9px;font-weight:800;letter-spacing:.18em;color:#a96e35}.head h1{margin:0;color:#123f33;font-size:27px;line-height:1.25;letter-spacing:-.04em}.subtitle{margin:8px 0 0;font-size:10.5px;line-height:1.7;color:#71817a}.logo{text-align:center;color:#123f33}.logo strong{display:block;border:1px solid #123f33;border-radius:50%;width:48px;height:48px;line-height:46px;font-size:14px;letter-spacing:-.15em}.logo span{display:block;margin-top:6px;font-size:9px;font-weight:700}.meta{display:grid;grid-template-columns:repeat(4,1fr);border:1px solid #d9e2de;border-radius:10px;margin-top:13px;overflow:hidden}.meta div{padding:9px 11px;border-right:1px solid #d9e2de;background:#f8faf9}.meta div:last-child{border-right:0}.meta span{display:block;font-size:8px;color:#88968f}.meta b{display:block;margin-top:4px;font-size:10.5px}.opening{display:grid;grid-template-columns:46px 1fr;gap:15px;margin-top:19px;padding:17px 18px;background:#123f33;color:#fff;border-radius:14px}.no{margin:0;color:#d6a369;font-size:22px;font-family:Georgia,serif}.opening h2{margin:0 0 8px;font-size:16px}.opening p{margin:0;font-size:11.5px;line-height:1.8;white-space:pre-line}.purpose{display:grid;grid-template-columns:1fr 1fr;gap:11px;margin-top:12px}.purpose div{border:1px solid #dde6e2;border-radius:12px;padding:12px 13px}.purpose span{font-size:9px;font-weight:800;color:#a96e35}.purpose p{margin:7px 0 0;font-size:9.8px;line-height:1.7;color:#596a63}.keygrid{display:grid;grid-template-columns:1fr 1fr;gap:11px;margin-top:12px}.card{border-radius:13px;padding:14px 15px;min-height:116px}.card.resource{background:#eef6f2;border:1px solid #cfe3d9}.card.focus{background:#fbf3e9;border:1px solid #ead5b8}.card>span{font-size:8px;letter-spacing:.15em;font-weight:800;color:#a96e35}.card h3{margin:5px 0 7px;font-size:12px;color:#123f33}.card p{margin:0;font-size:9.8px;line-height:1.72;white-space:pre-line}.section{margin-top:15px}.title{display:flex;align-items:flex-start;gap:12px;margin-bottom:10px}.title>p{margin:0;font-family:Georgia,serif;font-size:19px;color:#a96e35}.title h2{margin:0;font-size:15px;color:#123f33}.title span{display:block;margin-top:3px;font-size:8.5px;color:#87948e}.domains{display:grid;grid-template-columns:1fr 1fr;gap:8px}.domain{display:grid;grid-template-columns:25px 1fr;gap:8px;padding:9px 10px;border-bottom:1px solid #dfe7e3}.domain>span{font-family:Georgia,serif;color:#a96e35;font-size:11px}.domain b{font-size:10.5px}.domain p{margin:4px 0 0;font-size:8.8px;line-height:1.55;color:#66766f}.inner{display:flex;justify-content:space-between;align-items:flex-end;padding-top:7mm;padding-bottom:10px;border-bottom:1px solid #cad8d2}.inner h2{margin:0;font-size:20px;color:#123f33}.inner>span{font-size:10px;font-weight:700;color:#71817a}.panel{padding:13px 15px;border-left:3px solid #a96e35;background:#f7f9f8;margin-top:9px}.panel h3{margin:0 0 6px;font-size:11px;color:#123f33}.panel p,.direction p,.note p,.closing p{margin:0;font-size:10.2px;line-height:1.78;white-space:pre-line}.flow{display:grid;grid-template-columns:1fr 18px 1fr 18px 1fr;gap:5px;align-items:stretch}.flow>div{border:1px solid #dbe5e0;border-radius:11px;padding:11px;background:#fff}.flow span{font-size:8px;font-weight:800;color:#a96e35}.flow p{margin:6px 0 0;font-size:9px;line-height:1.6}.flow i{align-self:center;text-align:center;color:#a96e35;font-style:normal}.direction{border-radius:12px;background:#eef6f2;padding:14px 16px;border:1px solid #cfe3d9}.note{margin-top:13px;padding:12px 14px;border:1px solid #e2e8e5;border-radius:11px}.note h3{margin:0 0 7px;font-size:10.5px;color:#123f33}.closing{margin-top:13px;padding:14px 16px;background:#123f33;color:#fff;border-radius:12px}.closing span{display:block;margin-bottom:7px;font-size:9px;color:#d6a369;font-weight:800}.foot{position:absolute;left:15mm;right:15mm;bottom:8mm;display:flex;justify-content:space-between;border-top:1px solid #d9e2de;padding-top:7px;font-size:7.8px;color:#819089}.foot b{color:#123f33}@media print{body{background:#fff}.mml-report{padding:0}.mml-page{margin:0;box-shadow:none;page-break-after:always}.mml-page:last-child{page-break-after:auto}@page{size:A4;margin:0}}
`; }


function stripTechnicalEvidence(value) {
  return clean(value, 12000)
    .replace(/\bT\s*[-=]?\s*\d{1,3}\b/gi, '')
    .replace(/\b(?:백분위|percentile|원점수|표준점수)\s*[:=]?\s*\d+(?:\.\d+)?/gi, '')
    .replace(/\b(?:L|F|K|Hs|D|Hy|Pd|Mf|Pa|Pt|Sc|Ma|Si|NS|HA|RD|PS|SD|CO|ST|Es|Re)\s*[:=]\s*\d+(?:\.\d+)?/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function buildClientEvidence(a, test) {
  const validity = stripTechnicalEvidence(a.validity);
  const profile = [a.emotionalPattern, a.thinkingPattern, a.relationshipPattern, a.stressPattern]
    .map((v) => stripTechnicalEvidence(v))
    .filter(Boolean);
  const lines = [];
  if (validity) lines.push(`응답의 일관성과 해석 가능성을 먼저 확인했으며, ${validity}`);
  if (profile[0]) lines.push(profile[0]);
  if (profile[1] && lines.join(' ').length < 650) lines.push(profile[1]);
  if (!lines.length) {
    lines.push(`${test} 결과는 한 가지 점수보다 전체적인 반응의 흐름과 생활 맥락을 함께 살펴보아야 합니다.`);
  }
  return clean(lines.join('\n\n'), 1200);
}


function stripInlineTechnical(value) {
  return clean(value, 12000)
    .replace(/\([^)]*(?:백분위|T\s*점수|원점수|표준점수|NS|HA|RD|PS|SD|CO|ST|Es|Re|L|F|K|Hs|D|Hy|Pd|Mf|Pa|Pt|Sc|Ma|Si)[^)]*\)/gi, '')
    .replace(/\b(?:NS|HA|RD|PS|SD|CO|ST|Es|Re|L|F|K|Hs|D|Hy|Pd|Mf|Pa|Pt|Sc|Ma|Si)\s*(?:척도)?\s*[:=]?\s*(?:백분위\s*)?\d+(?:\.\d+)?\b/gi, '')
    .replace(/\b(?:T\s*점수|T-score|백분위|percentile|원점수|표준점수)\s*[:=]?\s*\d+(?:\.\d+)?\b/gi, '')
    .replace(/\b(?:낮음|높음|평균|보통)\s*\d+(?:\.\d+)?\b/g, '')
    .replace(/[·•]\s*(?=[·•]|$)/g, '')
    .replace(/\s{2,}/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function humanizeTechnicalTerms(value) {
  return clean(value, 12000)
    .replace(/자극추구(?:\s*척도)?(?:가|는)?\s*(?:매우\s*)?(?:낮(?:은|다|음)|낮게 나타남)/g, '새로운 자극을 빠르게 좇기보다 익숙하고 안정적인 방식을 선호하는 경향')
    .replace(/자극추구(?:\s*척도)?(?:가|는)?\s*(?:매우\s*)?(?:높(?:은|다|음)|높게 나타남)/g, '새로운 경험과 변화에 적극적으로 반응하는 경향')
    .replace(/위험회피(?:\s*척도)?(?:가|는)?\s*(?:매우\s*)?(?:낮(?:은|다|음)|낮게 나타남)/g, '불확실한 상황에서도 비교적 침착하게 움직이는 경향')
    .replace(/위험회피(?:\s*척도)?(?:가|는)?\s*(?:매우\s*)?(?:높(?:은|다|음)|높게 나타남)/g, '예상하기 어려운 상황을 신중하게 살피는 경향')
    .replace(/사회적 민감성(?:\s*척도)?(?:가|는)?\s*(?:매우\s*)?(?:낮(?:은|다|음)|낮게 나타남)/g, '다른 사람의 반응에 휩쓸리기보다 자신의 판단을 유지하려는 경향')
    .replace(/사회적 민감성(?:\s*척도)?(?:가|는)?\s*(?:매우\s*)?(?:높(?:은|다|음)|높게 나타남)/g, '다른 사람의 감정과 관계 분위기를 세심하게 알아차리는 경향')
    .replace(/인내력(?:\s*척도)?(?:가|는)?\s*(?:매우\s*)?(?:낮(?:은|다|음)|낮게 나타남)/g, '오랜 과제를 이어 갈 때 에너지가 쉽게 떨어질 수 있는 경향')
    .replace(/인내력(?:\s*척도)?(?:가|는)?\s*(?:매우\s*)?(?:높(?:은|다|음)|높게 나타남)/g, '어려움이 있어도 목표를 꾸준히 이어 가는 경향')
    .replace(/자율성(?:\s*척도)?(?:이|가|은|는)?\s*(?:매우\s*)?(?:낮(?:은|다|음)|낮게 나타남)/g, '스스로 방향을 정하고 책임지는 데 확신이 흔들릴 수 있는 경향')
    .replace(/자율성(?:\s*척도)?(?:이|가|은|는)?\s*(?:매우\s*)?(?:높(?:은|다|음)|높게 나타남)/g, '스스로 판단하고 선택한 일에 책임을 지려는 경향')
    .replace(/연대감(?:\s*척도)?(?:이|가|은|는)?\s*(?:매우\s*)?(?:낮(?:은|다|음)|낮게 나타남)/g, '관계에서도 자신의 기준과 독립성을 중요하게 여기는 경향')
    .replace(/연대감(?:\s*척도)?(?:이|가|은|는)?\s*(?:매우\s*)?(?:높(?:은|다|음)|높게 나타남)/g, '타인의 입장을 이해하고 협력하려는 경향')
    .replace(/자기초월(?:\s*척도)?(?:이|가|은|는)?\s*(?:매우\s*)?(?:낮(?:은|다|음)|낮게 나타남)/g, '구체적이고 현실적인 기준을 중심으로 판단하는 경향')
    .replace(/자기초월(?:\s*척도)?(?:이|가|은|는)?\s*(?:매우\s*)?(?:높(?:은|다|음)|높게 나타남)/g, '삶의 의미와 더 큰 맥락을 중요하게 여기는 경향')
    .replace(/자아강도(?:\s*척도)?(?:가|는)?\s*(?:매우\s*)?(?:높(?:은|다|음)|높게 나타남)/g, '스트레스 상황에서도 자신을 유지하고 문제를 견디는 힘이 비교적 안정적인 모습')
    .replace(/사회적 책임감(?:\s*척도)?(?:이|가|은|는)?\s*(?:매우\s*)?(?:높(?:은|다|음)|높게 나타남)/g, '맡은 역할과 약속을 중요하게 여기며 책임 있게 행동하려는 모습');
}

function clientNarrative(value, fallback = '') {
  let text = humanizeTechnicalTerms(value);
  text = stripInlineTechnical(text)
    .replace(/\b(?:MMPI-2?|TCI|PAI|SCT|HTP|PAT|K-CDI|PHQ-9|GAD-7|STS)\b/gi, '')
    .replace(/\b(?:척도|프로파일|임상척도|타당도척도)\b/g, '')
    .replace(/(?:높게|낮게)\s*나타났(?:습니다|다)/g, '두드러지는 경향이 있습니다')
    .replace(/(?:높은|낮은)\s*수준(?:입니다|으로 나타났습니다)/g, '특정한 경향이 확인됩니다')
    .replace(/\(\s*\)/g, '')
    .replace(/\s+([,.!?])/g, '$1')
    .replace(/\s{2,}/g, ' ')
    .replace(/\n\s+/g, '\n')
    .trim();
  return text || fallback;
}

function firstUsableNarrative(values, fallback) {
  for (const value of values) {
    const text = stripInlineTechnical(value);
    if (!text) continue;
    const sentence = sentences(text).find((x) => {
      const t = stripInlineTechnical(x);
      return t.length >= 18 && !/(백분위|T\s*점수|원점수|표준점수|\b(?:NS|HA|RD|PS|SD|CO|ST|Es|Re|Hs|Hy|Pd|Mf|Pa|Pt|Sc|Ma|Si)\b\s*[:=]?\s*\d)/i.test(t);
    });
    if (sentence) return clean(stripInlineTechnical(sentence), 240);
    if (text.length >= 24) return clean(text, 240);
  }
  return fallback;
}

function domainFallback(test, label) {
  const common = {
    '응답 신뢰도':'응답은 전반적으로 해석 가능한 범위에서 이해할 수 있으며, 한 문항보다 전체적인 반응의 흐름을 함께 살펴보는 것이 중요합니다.',
    '정서 상태':'감정을 드러내는 방식과 마음의 긴장 정도를 함께 살펴볼 필요가 있습니다.',
    '사고와 집중':'생각을 정리하고 판단하는 방식은 비교적 현실적일 수 있으나, 부담이 커지면 걱정이나 집중의 어려움이 나타날 수 있습니다.',
    '신체화 반응':'마음의 부담이 몸의 피로감이나 긴장으로 표현되는지 생활 속 경험과 함께 확인해 볼 필요가 있습니다.',
    '관계 경험':'관계에서는 신중함과 책임감이 강점이 될 수 있으며, 힘든 마음을 혼자 감당하지 않는 연습이 도움이 될 수 있습니다.',
    '적응 자원':'문제를 현실적으로 해결하려는 힘과 맡은 역할을 유지하려는 책임감이 중요한 자원으로 작용할 수 있습니다.',
    '자극과 변화':'새로운 상황을 받아들이는 속도와 익숙한 방식을 유지하려는 경향을 함께 살펴볼 수 있습니다.',
    '불안과 위험 인식':'예측하기 어려운 상황에서는 충분히 확인한 뒤 움직이려는 신중함이 나타날 수 있습니다.',
    '관계 민감성':'다른 사람의 반응과 관계의 분위기를 얼마나 민감하게 받아들이는지 살펴볼 수 있습니다.',
    '지속성과 인내':'목표를 이어 가는 힘과 어려운 상황에서 버티는 방식이 생활 속에서 어떻게 나타나는지 확인할 수 있습니다.',
    '자기조절':'자신의 감정과 행동을 조절하고 책임 있게 선택하려는 힘이 중요한 적응 자원으로 작용할 수 있습니다.',
    '협력과 의미':'타인과 협력하고 관계 속 의미를 찾는 방식이 현재의 적응과 회복에 어떤 도움을 주는지 살펴볼 수 있습니다.'
  };
  return common[label] || `${label} 영역은 검사 결과만으로 단정하지 않고 최근의 생활 경험과 함께 이해하는 것이 좋습니다.`;
}

function buildDomainNarratives(a, test, labels) {
  const candidates = {
    '응답 신뢰도':[a.validity, a.responseStyle, a.sourceSummary],
    '정서 상태':[a.emotionalPattern, a.coreFindings, a.vulnerabilities],
    '사고와 집중':[a.thinkingPattern, a.dailyMeaning, a.coreFindings],
    '신체화 반응':[a.stressPattern, a.vulnerabilities, a.dailyMeaning],
    '관계 경험':[a.relationshipPattern, a.strengths, a.vulnerabilities],
    '적응 자원':[a.strengths, a.helpfulDirections, a.coreFindings],
    '자극과 변화':[a.thinkingPattern, a.stressPattern, a.coreFindings],
    '불안과 위험 인식':[a.stressPattern, a.emotionalPattern, a.vulnerabilities],
    '관계 민감성':[a.relationshipPattern, a.emotionalPattern, a.strengths],
    '지속성과 인내':[a.strengths, a.stressPattern, a.coreFindings],
    '자기조절':[a.thinkingPattern, a.strengths, a.helpfulDirections],
    '협력과 의미':[a.relationshipPattern, a.strengths, a.helpfulDirections]
  };
  const general = [a.emotionalPattern,a.thinkingPattern,a.relationshipPattern,a.stressPattern,a.dailyMeaning,a.coreFindings,a.strengths,a.vulnerabilities,a.helpfulDirections];
  return labels.map((label, index) => clientNarrative(firstUsableNarrative(candidates[label] || [general[index], ...general], domainFallback(test, label)), domainFallback(test, label)));
}

function render(data) {
  const a = data.analysis || data;
  const test = clean(a.testType || a.testName || '심리검사', 100);
  const p = profile(test);
  const overview = clientNarrative(a.oneLine || a.coreFindings, '검사 결과에서는 현재의 심리적 특성과 적응 방식이 함께 확인됩니다.');
  const strengths = clientNarrative(a.strengths, '현재의 적응을 돕는 강점과 심리적 자원이 확인됩니다.');
  const caution = clientNarrative(a.vulnerabilities, '부담이 커지는 상황에서 조금 더 살펴볼 부분이 있습니다.');
  const validity = clientNarrative(a.validity, '검사 결과는 참고할 수 있는 범위입니다. 최근의 생활과 상황을 함께 생각해 주세요.');
  const evidence = clientNarrative(buildClientEvidence(a, test), `${test} 결과는 한 가지 점수보다 전체적인 반응의 흐름과 생활 맥락을 함께 살펴보아야 합니다.`);
  const suggestions = clientNarrative(a.helpfulDirections || a.counselingQuestions || a.crossChecks, '내 강점은 유지하면서, 힘들어지는 순간을 조금 더 빨리 알아차리고 나에게 맞는 회복 방법을 찾아보는 것이 도움이 됩니다.');
  const cautions = clientNarrative(a.cautions, '검사 결과는 지금 시점의 모습을 보여 줍니다. 최근에 있었던 일과 생활환경에 따라 달라질 수 있습니다.');
  const domainNarratives = buildDomainNarratives(a, test, p.domains);
  const domains = p.domains.map((d,i)=>`<div class="domain"><span>${String(i+1).padStart(2,'0')}</span><div><b>${esc(d)}</b><p>${esc(domainNarratives[i])}</p></div></div>`).join('');
  const name = clean(a.clientName || data.clientName, 100);
  const rawDate = clean(a.publishedAt || a.approvedAt || a.updatedAt || a.generatedAt || a.createdAt || data.createdAt, 60);
  const dm = rawDate.match(/(20\d{2})[^0-9]?(0?[1-9]|1[0-2])[^0-9]?(0?[1-9]|[12]\d|3[01])/);
  const date = dm ? `${dm[1]}.${String(dm[2]).padStart(2,'0')}.${String(dm[3]).padStart(2,'0')}` : new Date().toISOString().slice(0,10).replace(/-/g,'.');
  return `<main class="mml-report"><article class="mml-page"><header class="head"><div><p class="kicker">MODUMAM SIGNATURE REPORT</p><h1>${esc(test)} 개별 심리검사 보고서</h1><p class="subtitle">검사 결과를 바탕으로 지금의 마음을 쉽고 편안하게 이해하도록 돕는 보고서</p></div><div class="logo"><strong>ㅁㄷㅁ</strong><span>모두의 마음연구소</span></div></header><section class="meta"><div><span>성명</span><b>${esc(name)}</b></div><div><span>검사명</span><b>${esc(test)}</b></div><div><span>발행일</span><b>${esc(date)}</b></div><div><span>작성자</span><b>임상심리사 백인영</b></div></section><section class="opening"><p class="no">01</p><div><h2>지금 내 마음은</h2><p>${esc(overview)}</p></div></section><section class="purpose"><div><span>이 검사는 무엇을 살펴보나요?</span><p>${esc(p.purpose)}</p></div><div><span>결과는 이렇게 이해해 주세요</span><p>${esc(validity)}</p></div></section><section class="keygrid"><div class="card resource"><h3>나에게 힘이 되는 부분</h3><p>${esc(strengths)}</p></div><div class="card focus"><h3>조금 더 살펴볼 부분</h3><p>${esc(caution)}</p></div></section><section class="section"><div class="title"><p>02</p><div><h2>마음의 여러 모습</h2><span>검사 결과를 생활 속 모습과 연결해 정리했습니다.</span></div></div><div class="domains">${domains}</div></section><footer class="foot"><span>MODUMAMLAB</span><b>1 / 2</b></footer></article><article class="mml-page"><header class="inner"><div><p class="kicker">MODUMAM SIGNATURE REPORT</p><h2>${esc(test)} 결과를 조금 더 자세히 보기</h2></div><span>${esc(name)}</span></header><section class="section"><div class="title"><p>03</p><div><h2>검사 결과를 이해하는 핵심</h2><span>점수 자체보다 여러 결과가 함께 보여 주는 의미를 중심으로 정리했습니다.</span></div></div><div class="panel"><h3>결과를 해석할 때 참고한 점</h3><p>${esc(evidence)}</p></div><div class="panel"><h3>생활에서는 이렇게 나타날 수 있어요</h3><p>${esc(overview)}\n\n${esc(caution)}</p></div></section><section class="section"><div class="title"><p>04</p><div><h2>전체적으로 보면</h2><span>나의 모습, 부담이 되는 상황, 회복에 도움이 되는 부분을 함께 봅니다.</span></div></div><div class="flow"><div><span>나의 모습</span><p>${esc(strengths)}</p></div><i>→</i><div><span>힘들어질 때</span><p>${esc(caution)}</p></div><i>→</i><div><span>도움이 되는 것</span><p>${esc(suggestions)}</p></div></div></section><section class="section"><div class="title"><p>05</p><div><h2>앞으로 도움이 될 수 있는 방향</h2><span>생활 속에서 부담 없이 시도해 볼 수 있는 방향입니다.</span></div></div><div class="direction"><p>${esc(suggestions)}</p></div></section><section class="note"><h3>상담사의 한마디</h3><p>${esc(overview)}</p><p>${esc(cautions)}</p></section><section class="closing"><span>REPORT NOTE</span><p>이 보고서는 지금의 마음을 이해하기 위한 참고자료입니다. 한 번의 검사만으로 사람을 단정하거나 진단하지 않습니다.</p></section><footer class="foot"><span>MODUMAMLAB</span><b>2 / 2</b></footer></article></main>`;
}

export const handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return jsonResponse({}, 200);
  if (event.httpMethod !== 'POST') return jsonResponse({ error: 'METHOD_NOT_ALLOWED' }, 405);
  try {
    const body = JSON.parse(event.body || '{}');
    const html = render(body);
    return jsonResponse({ ok: true, html, css: css(), version: 'individual-report-v1.0.0' });
  } catch (error) {
    return jsonResponse({ ok: false, error: clean(error && error.message, 500) || 'REPORT_ENGINE_ERROR' }, 500);
  }
};
