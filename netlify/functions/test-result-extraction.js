const jsonResponse=(obj,statusCode=200)=>({statusCode,headers:{"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"Content-Type","Access-Control-Allow-Methods":"POST, OPTIONS","Content-Type":"application/json; charset=utf-8"},body:JSON.stringify(obj)});
const clean=(v,max=12000)=>String(v||'').trim().slice(0,max);
const SCALE_DEFS={
  STS:[['activity','활동성'],['cautiousness','조심성'],['positiveEmotion','긍정정서'],['negativeEmotion','부정정서'],['socialSensitivity','사회적 민감성'],['effortfulControl','의도적 조절']],
  PAT:[['supportExpression','지지표현'],['rationalExplanation','합리적 설명'],['achievementPressure','성취압력'],['interference','간섭'],['punishment','처벌'],['monitoring','감독'],['overExpectation','과잉기대'],['inconsistency','비일관성']]
};
function extractionPrompt(body){
  const defs=(SCALE_DEFS[body.testType]||[]).map(([key,label])=>`- ${key}: ${label}`).join('\n');
  return `당신은 심리검사 결과표에서 구조화된 수치만 추출하는 보조 AI입니다.\n검사 종류: ${body.testType}\n파일명: ${clean(body.fileName,200)}\n대상자: ${clean(body.clientName,100)}\n\n추출할 척도:\n${defs}\n\n중요 규칙:\n- 이미지나 PDF에 실제로 보이는 값만 추출합니다.\n- 점수, 백분위, T점수, 표준점수 등 표기된 수치는 원문 그대로 score에 기록합니다.\n- 결과표에 낮음/보통/높음 또는 이에 준하는 구간이 명시되어 있으면 level을 낮음, 보통, 높음 중 하나로 변환합니다.\n- 수준이 명시되지 않았거나 기준을 확실히 알 수 없으면 level은 반드시 확인필요로 합니다.\n- 검사 규준이나 절단점을 임의로 추정하지 않습니다.\n- 읽기 어려운 값은 빈 문자열과 확인필요로 반환합니다.\n- evidence에는 결과표에서 어떤 문구나 위치를 보고 판단했는지 짧게 씁니다.\n- confidence는 높음, 보통, 낮음 중 하나입니다.\n- 대상자의 개인정보는 요약에 불필요하게 반복하지 않습니다.\n\n아래 JSON만 반환하세요.\n{\n  "documentSummary":"결과표에서 확인된 검사명, 점수 체계, 전반적 구조를 2~4문장으로 요약",\n  "warnings":["판독이 불명확하거나 상담자가 반드시 확인할 항목"],\n  "scales":{\n    ${defs.split('\n').map(line=>{const key=line.match(/- ([^:]+)/)?.[1];return `"${key}":{"score":"","level":"확인필요","evidence":"","confidence":"낮음"}`}).join(',\n    ')}\n  }\n}`;
}
async function callGemini(apiKey,body){
  const models=[process.env.GEMINI_PRIMARY_MODEL||'gemini-2.5-flash',process.env.GEMINI_FALLBACK_MODEL||'gemini-2.5-flash'];
  let lastError;
  for(const model of [...new Set(models)]){
    try{
      const response=await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({contents:[{role:'user',parts:[{text:extractionPrompt(body)},{inlineData:{mimeType:body.mimeType,data:body.base64}}]}],generationConfig:{temperature:0.1,topP:0.8,maxOutputTokens:3000,responseMimeType:'application/json',thinkingConfig:{thinkingBudget:0}}})});
      const data=await response.json().catch(()=>({}));
      const text=data?.candidates?.[0]?.content?.parts?.map(p=>p.text||'').join('\n').trim();
      if(response.ok&&text)return{text,model};
      lastError={status:response.status,model,data};
    }catch(error){lastError={model,error:error.message};}
  }
  const error=new Error('검사결과 추출 AI 호출 실패');error.detail=lastError;throw error;
}
export const handler=async(event)=>{
  if(event.httpMethod==='OPTIONS')return jsonResponse({},200);
  if(event.httpMethod!=='POST')return jsonResponse({error:'POST only'},405);
  try{
    const body=JSON.parse(event.body||'{}');
    if(!['STS','PAT'].includes(body.testType))return jsonResponse({error:'현재는 STS와 PAT 결과만 분석합니다.'},400);
    if(!clean(body.base64,8_000_000))return jsonResponse({error:'검사결과 파일이 없습니다.'},400);
    if(!['application/pdf','image/png','image/jpeg','image/webp'].includes(body.mimeType))return jsonResponse({error:'지원하지 않는 파일 형식입니다.'},400);
    const apiKey=process.env.GEMINI_API_KEY||process.env.GOOGLE_API_KEY||process.env.GOOGLE_GEMINI_API_KEY;
    if(!apiKey)return jsonResponse({error:'GEMINI_API_KEY가 설정되지 않았습니다.'},500);
    const result=await callGemini(apiKey,body);
    let parsed;
    try{parsed=JSON.parse(result.text.replace(/^```json\s*/i,'').replace(/```$/i,'').trim());}
    catch{return jsonResponse({error:'AI 추출 결과 형식을 읽지 못했습니다. 더 선명한 결과표로 다시 시도해 주세요.'},502);}
    const defs=SCALE_DEFS[body.testType]||[];
    const scales={};
    for(const [key] of defs){const v=parsed?.scales?.[key]||{};scales[key]={score:clean(v.score,80),level:['낮음','보통','높음'].includes(v.level)?v.level:'확인필요',evidence:clean(v.evidence,300),confidence:['높음','보통','낮음'].includes(v.confidence)?v.confidence:'낮음'};}
    return jsonResponse({documentSummary:clean(parsed.documentSummary,1500),warnings:Array.isArray(parsed.warnings)?parsed.warnings.map(x=>clean(x,300)).filter(Boolean).slice(0,10):[],scales,model:result.model,promptVersion:'sts-pat-extraction-v1'});
  }catch(error){console.error('[TEST RESULT EXTRACTION]',error.detail||error);return jsonResponse({error:'검사결과 분석 중 오류가 발생했습니다.'},500);}
};
