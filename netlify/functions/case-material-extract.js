const jsonResponse=(obj,statusCode=200)=>({
  statusCode,
  headers:{
    "Access-Control-Allow-Origin":"*",
    "Access-Control-Allow-Headers":"Content-Type",
    "Access-Control-Allow-Methods":"POST, OPTIONS",
    "Content-Type":"application/json; charset=utf-8"
  },
  body:JSON.stringify(obj)
});

const clean=(value,max=12000)=>String(value||"").trim().slice(0,max);
const ALLOWED_MIME_TYPES=new Set(["application/pdf","image/png","image/jpeg","image/webp","text/plain"]);

function buildPrompt(body){
  return `당신은 임상심리사의 사례자료 정리를 돕는 보조 AI입니다.
첨부 문서에서 실제로 확인되는 내용만 추출하세요. 진단하거나 문서에 없는 내용을 추측하지 마세요.
내담자: ${clean(body.clientName,100)}
파일명: ${clean(body.fileName,200)}

원칙:
- 사실, 내담자·보호자의 진술, 작성자의 의견, 임상적 가설을 가능한 범위에서 구분합니다.
- 자살·자해·타해·학대·폭력 등 안전 관련 표현은 누락하지 않되 과장하지 않습니다.
- 이름, 연락처, 주소 등 사례개념화에 불필요한 개인정보는 요약에서 반복하지 않습니다.
- 읽기 어렵거나 모호한 부분은 추측하지 말고 판독 불확실이라고 표시합니다.
- 이 결과는 사례개념화를 위한 근거 요약이며 최종 판단은 상담자가 합니다.

JSON만 반환하세요.
{
  "summary":"문서의 목적과 사례개념화에 관련된 주요 내용을 6~12문장으로 요약",
  "keyFacts":"확인 가능한 사건·증상 경험·관계·환경·기능 영향·대처·변화를 항목형 텍스트로 정리",
  "riskSignals":"문서에 명시된 안전 관련 신호와 현재 확인 필요. 관련 언급이 없으면 문서에서 확인되지 않음으로 작성",
  "protectiveResources":"문서에서 확인되는 강점·관계·환경·동기·대처 자원",
  "cautions":"판독 불확실, 작성시점, 출처, 상충 내용 및 추가 면담에서 확인할 사항"
}`;
}

async function callGemini(apiKey,body){
  const model=process.env.GEMINI_PRIMARY_MODEL||"gemini-2.5-flash";
  const response=await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,{
    method:"POST",headers:{"Content-Type":"application/json"},
    body:JSON.stringify({
      contents:[{role:"user",parts:[
        {text:buildPrompt(body)},
        {inlineData:{mimeType:body.mimeType,data:body.base64}}
      ]}],
      generationConfig:{temperature:0.1,topP:0.8,maxOutputTokens:2600,responseMimeType:"application/json",thinkingConfig:{thinkingBudget:0}}
    })
  });
  const data=await response.json().catch(()=>({}));
  const text=data?.candidates?.[0]?.content?.parts?.map(part=>part.text||"").join("\n").trim();
  if(!response.ok||!text){
    const error=new Error("case material extraction failed");
    error.detail={status:response.status,data};
    throw error;
  }
  return {text,model};
}

export const handler=async event=>{
  if(event.httpMethod==="OPTIONS")return jsonResponse({},200);
  if(event.httpMethod!=="POST")return jsonResponse({error:"POST only"},405);
  try{
    const body=JSON.parse(event.body||"{}");
    const mimeType=clean(body.mimeType,100);
    const base64=clean(body.base64,9000000);
    if(!ALLOWED_MIME_TYPES.has(mimeType))return jsonResponse({error:"지원하지 않는 파일 형식입니다."},400);
    if(!base64)return jsonResponse({error:"업로드된 파일 내용이 없습니다."},400);
    const apiKey=process.env.GEMINI_API_KEY||process.env.GOOGLE_API_KEY||process.env.GOOGLE_GEMINI_API_KEY;
    if(!apiKey)return jsonResponse({error:"GEMINI_API_KEY가 설정되지 않았습니다."},500);
    const result=await callGemini(apiKey,{...body,mimeType,base64});
    let parsed;
    try{parsed=JSON.parse(result.text.replace(/^```json\s*/i,"").replace(/```$/i,"").trim());}
    catch{return jsonResponse({error:"업로드 자료의 분석 형식을 해석하지 못했습니다."},502);}
    const material={
      summary:clean(parsed.summary,5000),keyFacts:clean(parsed.keyFacts,7000),
      riskSignals:clean(parsed.riskSignals,3000),protectiveResources:clean(parsed.protectiveResources,3000),
      cautions:clean(parsed.cautions,3000)
    };
    return jsonResponse({material,model:result.model,promptVersion:"mml-case-material-extract-v1"});
  }catch(error){
    console.error("[CASE MATERIAL EXTRACT]",error.detail||error);
    return jsonResponse({error:"사례자료 분석 중 오류가 발생했습니다."},500);
  }
};
