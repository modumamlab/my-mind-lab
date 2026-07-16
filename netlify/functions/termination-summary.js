const jsonResponse = (obj, statusCode = 200) => ({
  statusCode,
  headers: {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Content-Type": "application/json; charset=utf-8"
  },
  body: JSON.stringify(obj)
});

const clean = (value, max = 12000) => String(value || "").trim().slice(0, max);

function buildPrompt(body) {
  return `당신은 모두의 마음연구소 상담자의 종결기록 초안 작성을 돕는 AI입니다.
이 결과는 상담자 내부 검토용 초안이며 최종 판단과 수정은 상담자가 합니다.
제공된 기록만 사용하고, 근거가 부족하면 "추가 확인 필요"라고 작성하세요.
진단을 새로 내리거나 확정적 표현을 사용하지 마세요. 내담자의 변화와 강점, 남은 어려움, 사후관리 계획을 균형 있게 정리하세요.
쉬운 한국어로 구체적이고 전문적으로 작성하세요.

내담자: ${clean(body.clientName,100)}
프로그램: ${clean(body.program,200)}
상담방식: ${clean(body.counselingMethod,100)}
검사: ${Array.isArray(body.tests)?body.tests.map(v=>clean(v,100)).join(', '):clean(body.tests,500)}

AI 마음체크 요약:
${clean(body.intakeSummary)||'자료 없음'}

사례개념화:
${clean(JSON.stringify(body.formulation||{}),5000)||'자료 없음'}

결과보고서 요약:
${clean(body.reportSummary)||'자료 없음'}

회기기록:
${clean(JSON.stringify(body.sessions||[]),10000)||'자료 없음'}

기존 종결기록:
${clean(JSON.stringify(body.existing||{}),4000)||'없음'}

아래 JSON만 반환하세요. 마크다운 코드블록을 쓰지 마세요.
{
  "reason": "종결 사유를 1~3문장으로 작성",
  "summary": "상담 시작 배경, 주요 개입, 상담과정을 5~8문장으로 정리",
  "progress": "내담자의 주요 변화, 습득한 대처, 확인된 강점을 4~7문장으로 작성",
  "remaining": "남아 있는 어려움, 재발 가능 상황, 추가 확인이 필요한 부분을 조건부 표현으로 작성",
  "recommendation": "종결 이후 유지하면 좋은 자기돌봄·관계·생활 실천을 구체적으로 제안",
  "followUp": "추후 상담 재개 기준, 점검 시기, 위기 시 도움 요청 계획을 포함한 사후관리 계획",
  "clientFeedback": "내담자에게 종결 시 확인할 피드백 질문 2~4개"
}`;
}

async function callGemini(apiKey, prompt) {
  const models=[process.env.GEMINI_PRIMARY_MODEL||"gemini-2.5-flash",process.env.GEMINI_FALLBACK_MODEL||"gemini-2.5-flash"];
  let lastError;
  for(const model of [...new Set(models)]){
    try{
      const response=await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,{
        method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({contents:[{role:"user",parts:[{text:prompt}]}],generationConfig:{temperature:0.25,topP:0.9,maxOutputTokens:3000,responseMimeType:"application/json",thinkingConfig:{thinkingBudget:0}}})
      });
      const data=await response.json().catch(()=>({}));
      const text=data?.candidates?.[0]?.content?.parts?.map(p=>p.text||"").join("\n").trim();
      if(response.ok&&text)return{text,model};
      lastError={status:response.status,model,data};
    }catch(error){lastError={model,error:error.message};}
  }
  const error=new Error("termination summary generation failed");error.detail=lastError;throw error;
}

export const handler=async(event)=>{
  if(event.httpMethod==="OPTIONS")return jsonResponse({},200);
  if(event.httpMethod!=="POST")return jsonResponse({error:"POST only"},405);
  try{
    const body=JSON.parse(event.body||"{}");
    if(!clean(body.clientName))return jsonResponse({error:"내담자 정보가 없습니다."},400);
    const hasSource=clean(body.intakeSummary)||clean(body.reportSummary)||(Array.isArray(body.sessions)&&body.sessions.length)||Object.keys(body.formulation||{}).length;
    if(!hasSource)return jsonResponse({error:"종결요약에 사용할 상담자료가 없습니다."},400);
    const apiKey=process.env.GEMINI_API_KEY||process.env.GOOGLE_API_KEY||process.env.GOOGLE_GEMINI_API_KEY;
    if(!apiKey)return jsonResponse({error:"GEMINI_API_KEY가 설정되지 않았습니다."},500);
    const result=await callGemini(apiKey,buildPrompt(body));
    let parsed;
    try{parsed=JSON.parse(result.text.replace(/^```json\s*/i,"").replace(/```$/i,"").trim());}
    catch{return jsonResponse({error:"AI 종결요약 형식을 해석하지 못했습니다. 다시 생성해 주세요."},502);}
    const fields=["reason","summary","progress","remaining","recommendation","followUp","clientFeedback"];
    const termination=Object.fromEntries(fields.map(k=>[k,clean(parsed[k],7000)]));
    return jsonResponse({termination,model:result.model,promptVersion:"v1-clinician-review-required"});
  }catch(error){console.error("[TERMINATION SUMMARY]",error.detail||error);return jsonResponse({error:"AI 종결요약 생성 중 오류가 발생했습니다."},500);}
};
