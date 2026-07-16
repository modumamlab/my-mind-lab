const jsonResponse=(obj,statusCode=200)=>({statusCode,headers:{"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"Content-Type","Access-Control-Allow-Methods":"POST, OPTIONS","Content-Type":"application/json; charset=utf-8"},body:JSON.stringify(obj)});
const clean=(v,max=10000)=>String(v||'').trim().slice(0,max);

function buildPrompt(body){
  return `당신은 모두의 마음연구소 임상심리사의 상담 회기 준비를 돕는 AI 상담도우미입니다.
상담을 대신하지 않으며, 제공된 기록 안에서만 상담자가 확인할 초점과 질문을 제안합니다.
진단하거나 단정하지 말고, 자료가 부족한 부분은 "확인 필요"라고 표시하세요.
검사 점수 원자료가 없으면 특정 척도가 높거나 낮다고 추정하지 마세요.
자살·자해·타해·학대·폭력 등 위험 신호가 자료에 있다면 직접적인 현재 안전 확인이 필요함을 주의사항에 포함하세요.
상담자의 전문적 판단, 관계 형성, 내담자 속도를 우선하며 질문은 심문처럼 이어지지 않게 4~6개만 제안하세요.
쉬운 한국어로 구체적으로 작성하세요.

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

현재 작성 중인 회기 메모:
${clean(JSON.stringify(body.currentNote||{}),8000)||'입력 없음'}

아래 JSON만 반환하세요.
{
  "emotion":"현재 자료에서 확인되는 핵심 정서와 정서의 흐름을 2~4문장으로 작성. 추정은 조건부 표현",
  "focus":"이번 회기에서 우선 다룰 상담 초점 2~3개를 설명과 함께 작성",
  "questions":"내담자에게 자연스럽게 물을 수 있는 개방형 질문 4~6개. 한 줄에 하나",
  "intervention":"현재 회기에 적합한 공감·명료화·정서조절·인지·행동·관계 개입 아이디어 3~5개",
  "strengths":"확인되는 강점과 보호요인, 상담에서 활용할 자원을 3~5개",
  "caution":"위험 확인, 피해야 할 단정, 내담자 속도와 관계에서 주의할 점 2~4개",
  "nextPlan":"이번 회기에서 다음 회기로 연결할 핵심과 작은 과제 또는 확인할 내용을 작성"
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
    const fields=['emotion','focus','questions','intervention','strengths','caution','nextPlan'];
    const aid=Object.fromEntries(fields.map(k=>[k,clean(parsed[k],7000)]));
    return jsonResponse({aid,model:result.model,sourceSummary:'검사·마음체크·사례개념화·회기기록·현재 메모 반영',promptVersion:'v2-session-context'});
  }catch(error){console.error('[COUNSELING AID]',error.detail||error);return jsonResponse({error:'AI 상담도우미 생성 중 오류가 발생했습니다.'},500);}
};
