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

const clean=(value,max=18000)=>String(value||'').trim().slice(0,max);
const SUPPORTED=['text/plain','application/pdf','image/png','image/jpeg','image/webp'];

function decodeTextBase64(base64){
  try{
    return Buffer.from(String(base64||''),'base64').toString('utf8');
  }catch{
    return '';
  }
}

function buildPrompt(body,transcriptText=''){
  const sessionNumber=Math.max(1,Number(body.sessionNumber)||1);

  return `당신은 모두의 마음연구소 상담자의 회기기록 작성을 돕는 AI입니다.
업로드된 축어록에 실제로 포함된 내용만 근거로 상담자 검토용 회기기록 초안을 작성하세요.

내담자: ${clean(body.clientName,100)}
프로그램: ${clean(body.program,200)}
상담방식: ${clean(body.counselingMethod,100)}
상담일: ${clean(body.date,30)}
회기: ${sessionNumber}회기
파일명: ${clean(body.fileName,200)}

${transcriptText?`축어록 본문:
${clean(transcriptText,18000)}`:'첨부한 PDF 또는 이미지 축어록을 직접 읽어 분석하세요.'}

작성 원칙:
- 축어록에 실제로 있는 내용만 사용합니다.
- 진단하거나 성격·과거사를 추정하지 않습니다.
- 내담자의 핵심 호소, 감정, 사고, 행동과 상담자 개입을 구분합니다.
- 불분명한 부분은 "추가 확인 필요"라고 씁니다.
- 자살·자해·타해·학대·폭력 위험이 명확하면 현재 안전 확인 필요를 기록합니다.
- 상담자 검토용 초안이며 반드시 수정·확인해야 합니다.
- 쉬운 한국어로 구체적으로 작성합니다.

JSON만 반환하세요.
{
  "summary":"축어록 전체 요약 5~8문장",
  "goal":"${sessionNumber}회기의 핵심 목표 또는 주제",
  "content":"주요 상담내용과 내담자 발언, 상담자 개입을 사실 중심으로 정리",
  "change":"내담자의 정서·인지·행동 반응과 회기 중 변화",
  "task":"합의된 실천과제. 확인되지 않으면 추가 확인 필요",
  "next":"다음 회기에서 확인할 주제와 상담 계획"
}`;
}

async function callGemini(apiKey,body){
  const models=[...new Set([
    process.env.GEMINI_PRIMARY_MODEL||'gemini-2.5-flash',
    process.env.GEMINI_FALLBACK_MODEL||'gemini-2.5-flash'
  ].filter(Boolean))];

  const transcriptText=body.mimeType==='text/plain'
    ? decodeTextBase64(body.base64)
    : '';

  let lastError=null;

  for(const model of models){
    try{
      const parts=[{text:buildPrompt(body,transcriptText)}];

      if(body.mimeType!=='text/plain'){
        parts.push({
          inlineData:{
            mimeType:body.mimeType,
            data:body.base64
          }
        });
      }

      const controller=new AbortController();
      const timeoutId=setTimeout(()=>controller.abort(),45000);

      const response=await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
        {
          method:'POST',
          headers:{'Content-Type':'application/json'},
          signal:controller.signal,
          body:JSON.stringify({
            contents:[{role:'user',parts}],
            generationConfig:{
              temperature:0.2,
              topP:0.85,
              maxOutputTokens:3600,
              responseMimeType:'application/json',
              thinkingConfig:{thinkingBudget:0}
            }
          })
        }
      );

      clearTimeout(timeoutId);

      const data=await response.json().catch(()=>({}));
      const text=data?.candidates?.[0]?.content?.parts
        ?.map(part=>part.text||'')
        .join('\n')
        .trim();

      if(response.ok&&text)return{text,model};

      lastError={
        model,
        status:response.status,
        message:data?.error?.message||`Gemini 오류 (HTTP ${response.status})`
      };
    }catch(error){
      lastError={
        model,
        message:error?.name==='AbortError'
          ? 'AI 축어록 분석 시간이 초과되었습니다.'
          : error.message
      };
    }
  }

  const error=new Error(lastError?.message||'AI 회기기록 생성 실패');
  error.detail=lastError;
  throw error;
}

export const handler=async(event)=>{
  if(event.httpMethod==='OPTIONS')return jsonResponse({},200);
  if(event.httpMethod!=='POST')return jsonResponse({error:'POST 요청만 지원합니다.'},405);

  try{
    const body=JSON.parse(event.body||'{}');

    if(!clean(body.clientName))return jsonResponse({error:'내담자 정보가 없습니다.'},400);
    if(!SUPPORTED.includes(body.mimeType))return jsonResponse({error:'TXT, PDF, PNG, JPG, WEBP 파일만 지원합니다.'},400);
    if(!body.base64||typeof body.base64!=='string')return jsonResponse({error:'축어록 파일이 없습니다.'},400);
    if(body.base64.length>6_000_000)return jsonResponse({error:'축어록 파일은 4MB 이하로 올려 주세요.'},413);

    const apiKey=
      process.env.GEMINI_API_KEY||
      process.env.GOOGLE_API_KEY||
      process.env.GOOGLE_GEMINI_API_KEY;

    if(!apiKey){
      return jsonResponse({
        error:'GEMINI_API_KEY가 설정되지 않았습니다. Netlify 환경변수를 확인해 주세요.'
      },500);
    }

    const result=await callGemini(apiKey,body);

    let parsed;
    try{
      parsed=JSON.parse(
        result.text
          .replace(/^```json\s*/i,'')
          .replace(/```$/i,'')
          .trim()
      );
    }catch{
      return jsonResponse({error:'AI 회기기록 결과 형식을 읽지 못했습니다. 다시 시도해 주세요.'},502);
    }

    const fields=['summary','goal','content','change','task','next'];
    const note=Object.fromEntries(
      fields.map(key=>[key,clean(parsed[key],14000)])
    );

    return jsonResponse({
      note,
      model:result.model,
      promptVersion:'counseling-transcript-session-note-v2'
    });
  }catch(error){
    console.error('[COUNSELING TRANSCRIPT SESSION NOTE]',error.detail||error);
    return jsonResponse({
      error:error.message||'축어록 AI 회기기록 작성 중 오류가 발생했습니다.'
    },500);
  }
};