const jsonResponse=(obj,statusCode=200)=>({statusCode,headers:{"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"Content-Type","Access-Control-Allow-Methods":"POST, OPTIONS","Content-Type":"application/json; charset=utf-8"},body:JSON.stringify(obj)});
const clean=(v,max=10000)=>String(v||'').trim().slice(0,max);

const THEORY_GUIDES = {
  "인지행동치료(CBT)": "상황→자동적 사고→정서·신체반응→행동→단기 결과→장기 유지순환, 핵심신념과 인지왜곡, 행동실험과 인지재구성을 중심으로 분석",
  "인간중심상담": "자기개념과 경험의 불일치, 조건부 가치, 진솔성·무조건적 긍정적 존중·공감적 이해, 자기수용과 성장 가능성을 중심으로 분석",
  "정신역동": "초기 관계경험, 무의식적 핵심갈등, 불안, 방어기제, 반복되는 관계패턴과 전이 가능성을 조건부 가설로 분석",
  "애착이론": "애착경험, 내적작동모델, 관계 위협, 애착체계 활성화, 근접추구·회피 반응과 현재 관계패턴을 중심으로 분석",
  "해결중심 단기상담": "예외상황, 이미 작동하는 해결행동, 강점과 자원, 척도질문, 선호하는 미래와 작고 관찰 가능한 변화를 중심으로 분석",
  "현실치료": "기본욕구, 질적 세계, 현재의 선택과 전행동, 관계와 책임, WDEP(바람·행동·평가·계획)를 중심으로 분석",
  "게슈탈트": "현재 경험과 알아차림, 미해결 과제, 접촉경계, 회피 방식, 신체·정서 경험의 통합을 중심으로 분석",
  "아들러 개인심리학": "초기경험, 생활양식, 사적논리, 열등감과 보상, 행동의 목적, 사회적 관심과 격려를 중심으로 분석",
  "가족체계이론": "상호작용 순환, 가족규칙과 경계, 하위체계, 삼각관계, 세대 간 전수, 개인 증상의 체계적 기능을 중심으로 분석",
  "수용전념치료(ACT)": "경험회피와 인지적 융합, 현재순간 접촉, 수용, 탈융합, 맥락으로서의 자기, 가치와 전념행동을 중심으로 분석",
  "변증법적 행동치료(DBT)": "취약성 요인과 촉발사건, 행동연쇄, 정서조절·고통감내·대인관계 효율성·마음챙김, 수용과 변화의 균형을 중심으로 분석",
  "통합적 사례개념화": "발달·인지·정서·행동·관계·환경 요인을 자료 근거에 따라 통합하되 여러 이론을 무분별하게 혼합하지 말고 주된 유지기제와 변화경로를 명확히 분석"
};

function selectedTheory(body){
  const value=clean(body.theoreticalOrientation,100)||'통합적 사례개념화';
  return Object.hasOwn(THEORY_GUIDES,value)?value:null;
}
function counselingAidText(value){
  if(value===null||value===undefined)return '';
  if(Array.isArray(value))return value.map(counselingAidText).filter(Boolean).join('\n\n');
  if(typeof value==='object'){
    const labels={stage:'단계',title:'제목',step:'단계',phase:'단계',goal:'목표',objective:'목표',purpose:'목적',question:'질문',questions:'추천 질문',followUp:'후속 질문',followup:'후속 질문',followUpQuestions:'후속 질문',intervention:'권장 개입',interventions:'권장 개입',method:'진행방법',technique:'기법',description:'설명',content:'내용',check:'반응 확인·조정',checks:'반응 확인·조정',adjustment:'조정 기준',counselorAction:'상담자의 행동',clientCheck:'내담자와 확인할 점',example:'표현 예시'};
    return Object.entries(value).map(([key,item])=>{const text=counselingAidText(item);return text?(labels[key]||key)+': '+text:''}).filter(Boolean).join('\n');
  }
  const text=String(value).trim();
  return text.includes('[object Object]')?'이전 결과의 구조가 손실되었습니다. AI 상담보조를 다시 생성해 주세요.':text;
}
function counselingAidSteps(value){
  if(!Array.isArray(value))return [];
  return value.slice(0,8).filter(step=>step&&typeof step==='object'&&!Array.isArray(step)).map((step,index)=>({
    title:counselingAidText(step.title||step.stage||step.phase||('단계 '+(index+1))).slice(0,160),
    goal:counselingAidText(step.goal||step.objective||step.purpose).slice(0,2000),
    questions:counselingAidText(step.questions||step.question).slice(0,5000),
    followUp:counselingAidText(step.followUp||step.followup||step.followUpQuestions).slice(0,3000),
    intervention:counselingAidText(step.intervention||step.interventions||step.method).slice(0,4000),
    checks:counselingAidText(step.checks||step.check||step.adjustment).slice(0,2000)
  }));
}
function counselingAidStepSummary(steps,fields){
  return steps.map((step,index)=>(index+1)+'. '+step.title+'\n'+fields.map(key=>counselingAidText({[key]:step[key]})).filter(Boolean).join('\n')).join('\n\n');
}

function buildPrompt(body){
  const theory=selectedTheory(body)||'통합적 사례개념화';
  const mode=clean(body.mode,50)||'support';
  const shared=`당신은 모두의 마음연구소 임상심리사의 상담을 보조하는 AI입니다.
상담을 대신하거나 진단하지 않으며, 제공된 기록 안에서만 정리하고 제안합니다.
자료가 부족한 부분은 "확인 필요"라고 표시하고, 기록에 없는 사실·개입·변화를 만들어내지 마세요.
자살·자해·타해·학대·폭력 등 위험 신호가 있다면 현재 안전 확인 필요성을 분명히 표시하세요.
상담자의 전문적 판단과 내담자의 속도·관계를 우선합니다.

내담자: ${clean(body.clientName,100)}
프로그램: ${clean(body.program,200)}
상담방식: ${clean(body.counselingMethod,100)}
선택 상담이론: ${theory}
이론의 핵심 관점: ${THEORY_GUIDES[theory]}
진행상태: ${clean(body.reservationStatus,100)}
검사: ${Array.isArray(body.tests)?body.tests.map(v=>clean(v,100)).join(', '):clean(body.tests,500)}

AI 마음체크/접수:
${clean(body.intakeSummary)||'자료 없음'}

검사결과 업로드 요약:
${clean(body.uploadSummary)||'자료 없음'}

결과보고서 요약:
${clean(body.reportSummary)||'자료 없음'}

사례개념화:
${clean(JSON.stringify(body.formulation||{}),6000)||'자료 없음'}

최근 회기기록:
${clean(JSON.stringify(body.recentSessions||[]),8000)||'자료 없음'}

회원 프로필 메모:
${clean(body.profileMemo,2000)||'자료 없음'}

현재 상담자가 입력한 내용:
${clean(JSON.stringify(body.currentNote||{}),9000)||'입력 없음'}\n`;

  if(mode==='session_summary'){
    return `${shared}
지금 단계는 상담 후 "회기 정리"입니다.
현재 상담내용(content)을 가장 중요한 근거로 사용하세요. 내담자 정보·주호소·상담동기·검사결과는 맥락 참고용입니다.
상담자가 실제로 한 개입만 확인 가능한 범위에서 정리하고, 시행하지 않은 개입을 했다고 쓰지 마세요.
상담결과와 내담자의 변화는 반드시 상담내용에 근거해야 하며, 관찰되지 않은 변화는 "확인 필요"로 표시하세요.
다음 회기 계획은 이번 상담내용·결과·변화에서 자연스럽게 이어지도록 작성하세요.

아래 JSON만 반환하세요.
{
  "emotion":"상담내용에서 확인되는 핵심 정서와 흐름을 2~3문장",
  "focus":"기존 상담목표를 바꾸지 말고 이번 회기의 실제 초점을 1~2문장으로 요약",
  "questions":"빈 문자열",
  "intervention":"상담내용에서 확인되는 상담자의 질문·반영·명료화·해석·정보제공·과제설정 등 실제 개입을 2~5개로 정리. 확인되지 않으면 확인 필요",
  "sessionResult":"이번 회기에서 확인된 결과·합의·새롭게 명료해진 점을 2~4문장으로 정리",
  "clientChange":"회기 중 관찰되거나 내담자가 표현한 정서·인지·행동·관계의 변화·반응을 2~4문장으로 정리. 없는 변화는 만들지 말 것",
  "strengths":"상담내용에서 확인된 강점·보호요인을 간단히 정리",
  "caution":"현재 자료에서 확인이 필요한 안전·위험 또는 임상적 주의사항",
  "nextPlan":"이번 회기에서 자연스럽게 이어지는 다음 회기 목표·확인사항·가능한 과제를 2~4개로 정리"
}`;
  }

  return `${shared}
지금 단계는 상담 전·상담 중 "상담 보조"입니다.
특히 내담자 정보(clientInfo), 주호소문제(complaint), 상담동기(motivation)를 중심으로 상담자가 무엇을 탐색하고 어떻게 질문할지 제안하세요.
상담내용이 아직 없어도 정상입니다. 결과나 변화를 미리 단정하지 마세요.
선택한 상담이론의 핵심 관점과 변화기제를 이번 회기 목표·질문·개입에 일관되게 적용하세요. 다른 이론을 무분별하게 혼합하지 마세요.
회기는 ①관계 형성·현재 상태/안전 확인 ②주호소와 목표 합의 ③핵심 탐색 ④이론에 따른 개입 ⑤정리·피드백·다음 계획 순서로 구조화하되 내담자의 속도와 상황에 맞춰 조정하세요.
추천 질문은 단계별 개방형 질문 6~8개로 제시하세요. 각각 [단계/목적] 질문 → 반응에 따른 후속 질문 → 연결할 개입을 포함하세요.
질문은 한 번에 하나씩 제안하고 내담자가 답하기 어렵거나 원하지 않으면 반영·공감·선택권 제공으로 전환하세요. 기억이나 특정 답을 유도하지 마세요.
개입마다 목표·진행방법·상담자가 사용할 문장·반응 확인·중단/조정 기준을 구체적으로 제시하세요. 위험 신호가 있으면 일반 개입보다 현재 안전 확인과 기관 절차를 우선하세요.
현재 내용은 시행 전 제안입니다. 실시한 개입, 확정된 상담결과, 관찰된 변화처럼 작성하지 마세요.

sessionSteps는 회기 순서대로 5개 단계 객체를 포함하세요. 각 단계에 관련 추천질문·후속 질문·권장개입·반응확인을 함께 배치하세요. 전체 질문은 6~8개로 구성하세요. 나머지 필드는 문자열로 반환하세요.
아래 JSON만 반환하세요.
{
  "emotion":"현재 자료에서 예상이 아니라 확인되는 핵심 정서·정서 흐름. 부족하면 확인 필요",
  "focus":"주호소문제와 상담동기를 바탕으로 이번 회기 상담목표/초점을 1~3개로 제안",
  "sessionSteps":[{"title":"관계 형성·현재 상태 확인","goal":"이 단계의 목적","questions":["상담자가 사용할 개방형 질문"],"followUp":["반응에 따라 사용할 후속 질문"],"intervention":"목표·진행방법·표현 예시","checks":"반응 확인·중단/조정 기준"}],
  "sessionPlan":"5단계 회기 진행 순서. 각 단계에 목표·상담자의 행동·내담자와 확인할 점을 포함. 시간은 고정하지 말 것",
  "questions":"선택 이론에 따른 단계별 개방형 질문 6~8개. 각 질문에 목적·후속 질문·연결 개입을 포함. 질문별 줄바꿈",
  "intervention":"선택 이론에 따른 개입 3~5개. 각 개입의 목표·진행방법·실제 사용할 문장·반응 확인·중단/조정 기준. 시행 전 제안으로 작성",
  "sessionResult":"",
  "clientChange":"",
  "strengths":"확인되는 강점과 보호요인, 상담에서 활용할 자원 3~5개",
  "caution":"안전 확인, 피해야 할 단정, 관계 및 내담자 속도에서 주의할 점 2~4개",
  "nextPlan":"현재 회기에서 우선 확인하거나 이어갈 탐색 방향 2~4개"
}`;
}

async function callGemini(apiKey,prompt){
  const models=[process.env.GEMINI_PRIMARY_MODEL||'gemini-2.5-flash',process.env.GEMINI_FALLBACK_MODEL||'gemini-2.5-flash'];
  let lastError;
  for(const model of [...new Set(models)]){
    try{
      const response=await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({contents:[{role:'user',parts:[{text:prompt}]}],generationConfig:{temperature:0.35,topP:0.9,maxOutputTokens:5000,responseMimeType:'application/json',thinkingConfig:{thinkingBudget:0}}})});
      const data=await response.json().catch(()=>({}));
      const text=data?.candidates?.[0]?.content?.parts?.map(p=>p.text||'').join('\n').trim();
      if(response.ok&&text)return{text,model};
      lastError={status:response.status,model,data};
    }catch(error){lastError={model,error:error.message};}
  }
  const error=new Error('AI 상담도우미 호출 실패');error.detail=lastError;throw error;
}

export const handler=async(event)=>{
  if(event.httpMethod==='OPTIONS')return jsonResponse({},200);
  if(event.httpMethod!=='POST')return jsonResponse({error:'POST only'},405);
  try{
    const body=JSON.parse(event.body||'{}');
    const theory=selectedTheory(body);
    if(!theory)return jsonResponse({error:'지원하는 상담이론을 선택해 주세요.'},400);
    if(!clean(body.clientName))return jsonResponse({error:'회원 정보가 없습니다.'},400);
    const hasSource=clean(body.intakeSummary)||clean(body.uploadSummary)||clean(body.reportSummary)||clean(JSON.stringify(body.formulation||{}))||clean(JSON.stringify(body.recentSessions||[]))||clean(JSON.stringify(body.currentNote||{}));
    if(!hasSource)return jsonResponse({error:'상담도우미가 참고할 기록이 없습니다. 회기 메모나 상담자료를 먼저 입력해 주세요.'},400);
    const apiKey=process.env.GEMINI_API_KEY||process.env.GOOGLE_API_KEY||process.env.GOOGLE_GEMINI_API_KEY;
    if(!apiKey)return jsonResponse({error:'GEMINI_API_KEY가 설정되지 않았습니다.'},500);
    const result=await callGemini(apiKey,buildPrompt(body));
    let parsed;
    try{parsed=JSON.parse(result.text.replace(/^```json\s*/i,'').replace(/```$/i,'').trim());}
    catch{return jsonResponse({error:'AI 상담도우미 결과 형식을 해석하지 못했습니다. 다시 생성해 주세요.'},502);}
    const fields=['sessionPlan','emotion','focus','questions','intervention','sessionResult','clientChange','strengths','caution','nextPlan'];
    const aid=Object.fromEntries(fields.map(k=>[k,clean(counselingAidText(parsed[k]),14000)]));
    aid.sessionSteps=body.mode==='session_summary'?[]:counselingAidSteps(parsed.sessionSteps);
    if(aid.sessionSteps.length){
      aid.sessionPlan=clean(counselingAidStepSummary(aid.sessionSteps,['goal']),14000);
      aid.questions=clean(counselingAidStepSummary(aid.sessionSteps,['questions','followUp']),20000);
      aid.intervention=clean(counselingAidStepSummary(aid.sessionSteps,['intervention','checks']),20000);
    }
    aid.theoreticalOrientation=theory;
    return jsonResponse({aid,model:result.model,sourceSummary:'내담자 정보·주호소·상담동기·검사·회기기록·현재 상담내용 반영',promptVersion:'v6-stage-cards'});
  }catch(error){console.error('[COUNSELING AID]',error.detail||error);return jsonResponse({error:'AI 상담도우미 생성 중 오류가 발생했습니다.'},500);}
};
