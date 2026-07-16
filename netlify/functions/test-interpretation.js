const jsonResponse=(obj,statusCode=200)=>({statusCode,headers:{"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"Content-Type","Access-Control-Allow-Methods":"POST, OPTIONS","Content-Type":"application/json; charset=utf-8"},body:JSON.stringify(obj)});
const clean=(v,max=12000)=>String(v||'').trim().slice(0,max);
function buildPrompt(body){
  const type=body.testType==='PAT'?'PAT 부모양육태도검사':'STS 6요인 기질검사';
  const scales=Object.values(body.scales||{}).map(s=>`- ${clean(s.label,80)}: 점수 ${clean(s.score,30)||'미입력'}, 수준 ${clean(s.level,20)} / 의미: ${clean(s.meaning,300)}`).join('\n');
  const audience=body.testType==='PAT'?'부모 자신이 양육태도를 이해하고 실제 양육에 적용할 수 있도록':'부모가 아동의 타고난 기질을 이해하고 양육·생활지도에 적용할 수 있도록';
  return `당신은 모두의 마음연구소 임상심리사의 심리검사 해석 초안 작성을 돕는 AI입니다.
검사: ${type}
내담자/대상자: ${clean(body.clientName,100)}
프로그램: ${clean(body.program,200)}

입력 척도:
${scales}

업로드 결과 요약:
${clean(body.uploadedSummary,3000)||'자료 없음'}

작성 원칙:
- ${audience} 쉬운 한국어로 작성합니다.
- 검사 점수와 입력된 수준을 벗어나 추정하지 않습니다.
- 높음과 낮음을 좋고 나쁨으로 판단하지 않고, 강점과 어려울 수 있는 상황을 균형 있게 설명합니다.
- 진단, 병리화, 확정적 단정은 하지 않습니다.
- STS는 활동성·조심성·긍정정서·부정정서·사회적 민감성·의도적 조절의 상호작용을 설명합니다.
- PAT는 지지표현·합리적 설명·성취압력·간섭·처벌·감독·과잉기대·비일관성을 부모 비난 없이 이해하고 구체적인 부모코칭으로 연결합니다.
- 점수가 미입력된 경우 수치 해석은 하지 않고 수준만 반영합니다.
- 결과는 AI 초안이며 임상심리사의 검토가 필요합니다.

아래 JSON만 반환하세요.
{
  "oneLine":"결과의 핵심을 따뜻하고 정확하게 한 문장으로 요약",
  "overall":"척도들의 흐름과 상호작용을 4~7문단으로 종합 설명",
  "strength":"확인되는 강점과 활용 가능한 자원을 3~6개",
  "caution":"상황에 따라 어려울 수 있는 점과 과도한 해석을 피하기 위한 주의사항 3~6개",
  "coaching":"가정·상담에서 바로 적용할 수 있는 구체적인 제안 4~7개",
  "scaleInterpretations":"각 척도별로 [척도명 / 현재 수준 / 의미 / 나타날 수 있는 모습 / 도움 방법]을 구분해 작성"
}`;
}
async function callGemini(apiKey,prompt){
  const models=[process.env.GEMINI_PRIMARY_MODEL||'gemini-2.5-flash',process.env.GEMINI_FALLBACK_MODEL||'gemini-2.5-flash'];
  let lastError;
  for(const model of [...new Set(models)]){
    try{
      const response=await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({contents:[{role:'user',parts:[{text:prompt}]}],generationConfig:{temperature:0.3,topP:0.9,maxOutputTokens:4200,responseMimeType:'application/json',thinkingConfig:{thinkingBudget:0}}})});
      const data=await response.json().catch(()=>({}));
      const text=data?.candidates?.[0]?.content?.parts?.map(p=>p.text||'').join('\n').trim();
      if(response.ok&&text)return{text,model};
      lastError={status:response.status,model,data};
    }catch(error){lastError={model,error:error.message};}
  }
  const error=new Error('검사 해석 AI 호출 실패');error.detail=lastError;throw error;
}
export const handler=async(event)=>{
  if(event.httpMethod==='OPTIONS')return jsonResponse({},200);
  if(event.httpMethod!=='POST')return jsonResponse({error:'POST only'},405);
  try{
    const body=JSON.parse(event.body||'{}');
    if(!clean(body.clientName))return jsonResponse({error:'회원 정보가 없습니다.'},400);
    if(!['STS','PAT'].includes(body.testType))return jsonResponse({error:'현재는 STS와 PAT 해석만 지원합니다.'},400);
    if(!body.scales||!Object.keys(body.scales).length)return jsonResponse({error:'척도 입력값이 없습니다.'},400);
    const apiKey=process.env.GEMINI_API_KEY||process.env.GOOGLE_API_KEY||process.env.GOOGLE_GEMINI_API_KEY;
    if(!apiKey)return jsonResponse({error:'GEMINI_API_KEY가 설정되지 않았습니다.'},500);
    const result=await callGemini(apiKey,buildPrompt(body));
    let parsed;
    try{parsed=JSON.parse(result.text.replace(/^```json\s*/i,'').replace(/```$/i,'').trim());}
    catch{return jsonResponse({error:'AI 해석 결과 형식을 읽지 못했습니다. 다시 생성해 주세요.'},502);}
    const fields=['oneLine','overall','strength','caution','coaching','scaleInterpretations'];
    const interpretation=Object.fromEntries(fields.map(k=>[k,clean(parsed[k],10000)]));
    return jsonResponse({interpretation,model:result.model,promptVersion:'sts-pat-v1'});
  }catch(error){console.error('[TEST INTERPRETATION]',error.detail||error);return jsonResponse({error:'검사 해석 초안 생성 중 오류가 발생했습니다.'},500);}
};
