const jsonResponse=(obj,statusCode=200)=>({statusCode,headers:{"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"Content-Type","Access-Control-Allow-Methods":"POST, OPTIONS","Content-Type":"application/json; charset=utf-8"},body:JSON.stringify(obj)});
const clean=(v,max=10000)=>String(v||'').trim().slice(0,max);

function buildPrompt(body){
  const mode=clean(body.mode,50)||'support';
  const shared=`당신은 모두의 마음연구소 임상심리사의 상담을 보조하는 AI입니다.
상담을 대신하거나 진단하지 않으며, 제공된 기록 안에서만 정리하고 제안합니다.
자료가 부족한 부분은 "확인 필요"라고 표시하고, 기록에 없는 사실·개입·변화를 만들어내지 마세요.
자살·자해·타해·학대·폭력 등 위험 신호가 있다면 현재 안전 확인 필요성을 분명히 표시하세요.
상담자의 전문적 판단과 내담자의 속도·관계를 우선합니다.

내담자: ${clean(body.clientName,100)}
프로그램: ${clean(body.program,200)}
상담방식: ${clean(body.counselingMethod,100)}
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
추천 질문은 심문처럼 이어지지 않도록 자연스러운 개방형 질문 4~6개로 작성하세요.

아래 JSON만 반환하세요.
{
  "emotion":"현재 자료에서 예상이 아니라 확인되는 핵심 정서·정서 흐름. 부족하면 확인 필요",
  "focus":"주호소문제와 상담동기를 바탕으로 이번 회기 상담목표/초점을 1~3개로 제안",
  "questions":"상담자가 내담자에게 자연스럽게 사용할 수 있는 개방형 질문 4~6개. 한 줄에 하나",
  "intervention":"현재 단계에서 고려할 수 있는 상담 개입 방향 3~5개. 아직 시행했다고 표현하지 말 것",
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
      const response=await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({contents:[{role:'user',parts:[{text:prompt}]}],generationConfig:{temperature:0.35,topP:0.9,maxOutputTokens:2800,responseMimeType:'application/json',thinkingConfig:{thinkingBudget:0}}})});
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
    if(!clean(body.clientName))return jsonResponse({error:'회원 정보가 없습니다.'},400);
    const hasSource=clean(body.intakeSummary)||clean(body.uploadSummary)||clean(body.reportSummary)||clean(JSON.stringify(body.formulation||{}))||clean(JSON.stringify(body.recentSessions||[]))||clean(JSON.stringify(body.currentNote||{}));
    if(!hasSource)return jsonResponse({error:'상담도우미가 참고할 기록이 없습니다. 회기 메모나 상담자료를 먼저 입력해 주세요.'},400);
    const apiKey=process.env.GEMINI_API_KEY||process.env.GOOGLE_API_KEY||process.env.GOOGLE_GEMINI_API_KEY;
    if(!apiKey)return jsonResponse({error:'GEMINI_API_KEY가 설정되지 않았습니다.'},500);
    const result=await callGemini(apiKey,buildPrompt(body));
    let parsed;
    try{parsed=JSON.parse(result.text.replace(/^```json\s*/i,'').replace(/```$/i,'').trim());}
    catch{return jsonResponse({error:'AI 상담도우미 결과 형식을 해석하지 못했습니다. 다시 생성해 주세요.'},502);}
    const fields=['emotion','focus','questions','intervention','sessionResult','clientChange','strengths','caution','nextPlan'];
    const aid=Object.fromEntries(fields.map(k=>[k,clean(parsed[k],7000)]));
    return jsonResponse({aid,model:result.model,sourceSummary:'내담자 정보·주호소·상담동기·검사·회기기록·현재 상담내용 반영',promptVersion:'v4-two-stage-counseling'});
  }catch(error){console.error('[COUNSELING AID]',error.detail||error);return jsonResponse({error:'AI 상담도우미 생성 중 오류가 발생했습니다.'},500);}
};
