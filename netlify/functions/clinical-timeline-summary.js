const jsonResponse=(obj,statusCode=200)=>({statusCode,headers:{"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"Content-Type","Access-Control-Allow-Methods":"POST, OPTIONS","Content-Type":"application/json; charset=utf-8"},body:JSON.stringify(obj)});
const clean=(value,max=18000)=>String(value??'').trim().slice(0,max);

function buildPrompt(body){
  const sessions=(Array.isArray(body.sessions)?body.sessions:[]).map((s,index)=>`
[${index+1}. ${clean(s.sessionNumber||index+1,20)}회기 · ${clean(s.date,30)}]
회기목표: ${clean(s.goal,1200)}
상담내용: ${clean(s.content,5000)}
상담결과·변화: ${clean(s.result||s.change,2400)}
실천과제: ${clean(s.task,1600)}
다음회기: ${clean(s.next,1800)}
`).join('\n');

  return `당신은 임상심리사와 상담자가 사례의 변화 흐름을 점검하도록 돕는 임상 타임라인 요약 AI입니다.

[기본정보]
내담자: ${clean(body.clientName,100)}
프로그램: ${clean(body.program,200)}
현재상태: ${clean(body.currentStatus,100)}

[초기자료]
${clean(JSON.stringify(body.intake||{}),12000)||'없음'}

[사례개념화]
${clean(JSON.stringify(body.formulation||{}),16000)||'없음'}

[상담계획]
${clean(JSON.stringify(body.counselingPlan||{}),16000)||'없음'}

[종합사례보고서]
${clean(JSON.stringify(body.clinicalCaseReport||{}),16000)||'없음'}

[종결평가]
${clean(JSON.stringify(body.termination||{}),14000)||'없음'}

[검토 완료 회기기록]
${sessions||'없음'}

원칙:
- 자료에서 확인된 내용만 사용합니다.
- 초기, 중간, 현재 순서로 정리합니다.
- 좋아진 점, 유지되는 어려움, 새롭게 확인된 점을 구분합니다.
- 변화 근거를 내담자 진술, 상담자 관찰, 생활기능, 과제로 구분합니다.
- 위험 기록이 없으면 위험 없음으로 단정하지 않습니다.
- 진단을 새로 내리지 않습니다.
- 모든 값은 문자열입니다.

JSON만 반환하세요.
{
  "changeSummary":"초기부터 현재까지의 핵심 변화 흐름",
  "initialState":"초기 상태",
  "turningPoints":"주요 전환점과 근거",
  "currentRecoveryFlow":"현재 회복 흐름",
  "remainingDifficulties":"유지되는 어려움",
  "functionalChanges":"생활기능 변화",
  "evidenceSummary":"변화 근거",
  "nextClinicalChecks":"다음 임상 확인사항 3~5개"
}`;
}

async function callGemini(apiKey,prompt){
  const models=[...new Set([process.env.GEMINI_PRIMARY_MODEL||'gemini-2.5-flash',process.env.GEMINI_FALLBACK_MODEL||'gemini-2.5-flash','gemini-2.5-flash'].filter(Boolean).filter(m=>!String(m).includes('lite')))];
  let lastError;
  for(const model of models){
    try{
      const response=await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,{
        method:'POST',headers:{'Content-Type':'application/json'},
        body:JSON.stringify({contents:[{role:'user',parts:[{text:prompt}]}],generationConfig:{temperature:0.14,topP:0.84,maxOutputTokens:8000,responseMimeType:'application/json'}})
      });
      const data=await response.json().catch(()=>({}));
      const text=data?.candidates?.[0]?.content?.parts?.map(p=>p.text||'').join('\n').trim();
      if(response.ok&&text)return{text,model};
      lastError={status:response.status,model,data};
    }catch(error){lastError={model,error:error.message}}
  }
  const error=new Error('clinical timeline generation failed');error.detail=lastError;throw error;
}

export const handler=async(event)=>{
  if(event.httpMethod==='OPTIONS')return jsonResponse({},200);
  if(event.httpMethod!=='POST')return jsonResponse({error:'POST only'},405);
  try{
    const body=JSON.parse(event.body||'{}');
    if(!Array.isArray(body.sessions)||!body.sessions.length)return jsonResponse({error:'상담자 검토 완료 회기기록이 없습니다.'},400);
    const apiKey=process.env.GEMINI_API_KEY||process.env.GOOGLE_API_KEY||process.env.GOOGLE_GEMINI_API_KEY;
    if(!apiKey)return jsonResponse({error:'GEMINI_API_KEY가 설정되지 않았습니다.'},500);
    const result=await callGemini(apiKey,buildPrompt(body));
    let parsed;
    try{parsed=JSON.parse(result.text.replace(/^```json\s*/i,'').replace(/^```\s*/,'').replace(/```$/,'').trim())}
    catch{return jsonResponse({error:'AI 변화요약 결과 형식을 읽지 못했습니다.'},502)}
    const fields=['changeSummary','initialState','turningPoints','currentRecoveryFlow','remainingDifficulties','functionalChanges','evidenceSummary','nextClinicalChecks'];
    return jsonResponse({timeline:Object.fromEntries(fields.map(f=>[f,clean(parsed[f],14000)])),model:result.model,promptVersion:'clinical-timeline-v1'});
  }catch(error){
    console.error('[CLINICAL TIMELINE]',error.detail||error);
    return jsonResponse({error:'AI 변화요약 생성 중 오류가 발생했습니다.'},500);
  }
};
