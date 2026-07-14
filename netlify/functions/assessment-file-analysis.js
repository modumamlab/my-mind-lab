const jsonResponse=(obj,statusCode=200)=>({statusCode,headers:{"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"Content-Type","Access-Control-Allow-Methods":"POST, OPTIONS","Content-Type":"application/json; charset=utf-8"},body:JSON.stringify(obj)});
const clean=(v,max=12000)=>String(v||'').trim().slice(0,max);
function prompt(body){
return `당신은 임상심리사의 심리검사 원자료 검토를 돕는 보조 AI입니다.
검사: ${clean(body.testType,100)}
대상자: ${clean(body.clientName,100)}
프로그램: ${clean(body.program,200)}
파일명: ${clean(body.fileName,200)}

업로드된 파일에 실제로 보이는 내용만 근거로 상담자용 분석 초안을 작성하세요.

필수 원칙:
- 파일이 선명하지 않거나 페이지가 누락됐으면 추정하지 말고 확인 필요로 표시합니다.
- 검사명, 점수, 척도, 프로파일을 원자료에서 확인하지 못하면 만들지 않습니다.
- MMPI-2·PAI는 타당도와 해석 가능성을 먼저 확인합니다.
- TCI·STS·PAT·K-CDI·선별검사는 검사 목적과 규준의 한계를 반영합니다.
- SCT·HTP 등 투사적 자료는 면담 및 다른 검사와 교차 확인할 가설로만 작성합니다.
- 위험 신호가 명확히 보이면 현재 안전을 추가 확인하도록 적되 진단을 확정하지 않습니다.
- confidenceScore는 파일 선명도, 검사명 식별, 점수·척도 식별, 페이지 완전성에 근거한 0~100 정수입니다.
- 80점 미만이면 needsReview를 true로 하고, 판독이 불확실한 항목을 구체적으로 적습니다.
- 모든 내용은 상담자 전용 AI 초안이며 전문가가 원본과 대조해야 합니다.

JSON만 반환하세요.
{
 "detectedTestType":"파일에서 확인한 검사명. 불확실하면 확인필요",
 "confidenceScore":0,
 "confidenceReason":"신뢰도 점수의 구체적 근거",
 "needsReview":true,
 "sourceSummary":"원자료에서 실제 확인된 검사명, 점수 체계, 주요 척도와 결과",
 "validity":"검사 해석 가능성, 타당도, 응답 일관성, 자료 품질과 제한",
 "coreFindings":"핵심 척도·프로파일·반응 특징을 검사별 전문성에 맞게 분석",
 "strengths":"확인되는 강점과 보호요인",
 "vulnerabilities":"취약요인, 스트레스 상황에서 어려울 수 있는 부분, 위험 신호",
 "counselingQuestions":"상담에서 확인할 구체적 질문 5~10개",
 "crossChecks":"다른 검사, 면담, 행동관찰과 교차 확인할 부분",
 "caseHypotheses":"사례개념화에 반영할 수 있는 임상적 가설. 사실과 가설을 구분",
 "cautions":"과잉해석을 피하기 위한 주의사항과 원자료 한계"
}`;
}
async function callGemini(apiKey,body){
 const models=[process.env.GEMINI_PRIMARY_MODEL||'gemini-2.5-flash',process.env.GEMINI_FALLBACK_MODEL||'gemini-2.5-flash-lite'];let lastError;
 for(const model of [...new Set(models)]){try{const response=await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({contents:[{role:'user',parts:[{text:prompt(body)},{inlineData:{mimeType:body.mimeType,data:body.base64}}]}],generationConfig:{temperature:0.15,topP:0.8,maxOutputTokens:5500,responseMimeType:'application/json',thinkingConfig:{thinkingBudget:0}}})});const data=await response.json().catch(()=>({}));const text=data?.candidates?.[0]?.content?.parts?.map(p=>p.text||'').join('\n').trim();if(response.ok&&text)return{text,model};lastError={status:response.status,model,data};}catch(error){lastError={model,error:error.message};}}
 const error=new Error('검사 분석 AI 호출 실패');error.detail=lastError;throw error;
}
export const handler=async(event)=>{if(event.httpMethod==='OPTIONS')return jsonResponse({},200);if(event.httpMethod!=='POST')return jsonResponse({error:'POST only'},405);try{const body=JSON.parse(event.body||'{}');if(!clean(body.clientName))return jsonResponse({error:'회원 정보가 없습니다.'},400);if(!clean(body.testType))return jsonResponse({error:'검사 종류가 없습니다.'},400);if(!clean(body.base64,9_000_000))return jsonResponse({error:'검사결과 파일이 없습니다.'},400);if(!['application/pdf','image/png','image/jpeg','image/webp'].includes(body.mimeType))return jsonResponse({error:'지원하지 않는 파일 형식입니다.'},400);const apiKey=process.env.GEMINI_API_KEY||process.env.GOOGLE_API_KEY||process.env.GOOGLE_GEMINI_API_KEY;if(!apiKey)return jsonResponse({error:'GEMINI_API_KEY가 설정되지 않았습니다.'},500);const result=await callGemini(apiKey,body);let parsed;try{parsed=JSON.parse(result.text.replace(/^```json\s*/i,'').replace(/```$/i,'').trim());}catch{return jsonResponse({error:'AI 분석 결과 형식을 읽지 못했습니다. 더 선명한 결과 파일로 다시 시도해 주세요.'},502);}const fields=['detectedTestType','confidenceReason','sourceSummary','validity','coreFindings','strengths','vulnerabilities','counselingQuestions','crossChecks','caseHypotheses','cautions'];const analysis=Object.fromEntries(fields.map(k=>[k,clean(parsed[k],12000)]));analysis.confidenceScore=Math.max(0,Math.min(100,Math.round(Number(parsed.confidenceScore)||0)));analysis.needsReview=Boolean(parsed.needsReview)||analysis.confidenceScore<80;if(analysis.detectedTestType&&analysis.detectedTestType!=='확인필요'&&!String(body.testType).includes(analysis.detectedTestType)&&!analysis.detectedTestType.includes(String(body.testType))){analysis.needsReview=true;analysis.confidenceReason=`선택한 검사(${body.testType})와 파일에서 감지한 검사(${analysis.detectedTestType})가 다릅니다. ${analysis.confidenceReason}`;}return jsonResponse({analysis,model:result.model,promptVersion:'assessment-engine-file-v2'});}catch(error){console.error('[ASSESSMENT FILE ANALYSIS]',error.detail||error);return jsonResponse({error:'검사결과 분석 중 오류가 발생했습니다.'},500);}};
