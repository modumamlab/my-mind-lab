const jsonResponse=(obj,statusCode=200)=>({statusCode,headers:{"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"Content-Type","Access-Control-Allow-Methods":"POST, OPTIONS","Content-Type":"application/json; charset=utf-8"},body:JSON.stringify(obj)});
const clean=(v,max=14000)=>String(v||'').trim().slice(0,max);
function buildPrompt(body){return `당신은 상담자의 회기기록 작성을 돕는 AI입니다.
내담자: ${clean(body.clientName,100)}
프로그램: ${clean(body.program,200)}
상담방식: ${clean(body.counselingMethod,100)}
상담일: ${clean(body.date,30)}

축어록:
${clean(body.transcriptText,14000)}

실제 축어록에 있는 내용만 사용하고 진단하거나 추정하지 마세요.
내담자 발언, 상담자 개입, 변화, 과제, 다음 회기 방향을 구분하세요.
자료가 부족하면 추가 확인 필요라고 표시하세요.
JSON만 반환하세요.
{"goal":"회기 목표","content":"주요 상담내용과 상담자 개입","change":"내담자 반응과 변화","task":"실천과제","next":"다음 회기 계획"}`;}
async function callGemini(apiKey,prompt){const models=[process.env.GEMINI_PRIMARY_MODEL||'gemini-2.5-flash',process.env.GEMINI_FALLBACK_MODEL||'gemini-2.5-flash'];let lastError;for(const model of [...new Set(models)]){try{const response=await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({contents:[{role:'user',parts:[{text:prompt}]}],generationConfig:{temperature:0.2,topP:0.85,maxOutputTokens:3000,responseMimeType:'application/json',thinkingConfig:{thinkingBudget:0}}})});const data=await response.json().catch(()=>({}));const text=data?.candidates?.[0]?.content?.parts?.map(p=>p.text||'').join('\n').trim();if(response.ok&&text)return{text,model};lastError={status:response.status,model,data};}catch(error){lastError={model,error:error.message};}}const error=new Error('AI 회기기록 생성 실패');error.detail=lastError;throw error;}
export const handler=async(event)=>{if(event.httpMethod==='OPTIONS')return jsonResponse({},200);if(event.httpMethod!=='POST')return jsonResponse({error:'POST only'},405);try{const body=JSON.parse(event.body||'{}');if(!clean(body.clientName))return jsonResponse({error:'내담자 정보가 없습니다.'},400);if(!clean(body.transcriptText))return jsonResponse({error:'축어록 내용이 없습니다.'},400);const apiKey=process.env.GEMINI_API_KEY||process.env.GOOGLE_API_KEY||process.env.GOOGLE_GEMINI_API_KEY;if(!apiKey)return jsonResponse({error:'GEMINI_API_KEY가 설정되지 않았습니다.'},500);const result=await callGemini(apiKey,buildPrompt(body));let parsed;try{parsed=JSON.parse(result.text.replace(/^```json\s*/i,'').replace(/```$/i,'').trim());}catch{return jsonResponse({error:'AI 회기기록 형식을 읽지 못했습니다.'},502);}const fields=['goal','content','change','task','next'];const note=Object.fromEntries(fields.map(k=>[k,clean(parsed[k],10000)]));return jsonResponse({note,model:result.model,promptVersion:'session-note-from-transcript-v1'});}catch(error){console.error('[COUNSELING SESSION NOTE]',error.detail||error);return jsonResponse({error:'AI 회기기록 작성 중 오류가 발생했습니다.'},500);}};