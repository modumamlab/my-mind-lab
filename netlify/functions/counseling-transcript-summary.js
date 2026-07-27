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

  return `당신은 모두의 마음연구소 상담자의 회기기록 작성을 돕는 임상 기록 지원 AI입니다.
업로드된 축어록에 실제로 포함된 내용만 근거로 상담자 검토용 회기기록 초안을 작성하세요.

내담자: ${clean(body.clientName,100)}
프로그램: ${clean(body.program,200)}
상담방식: ${clean(body.counselingMethod,100)}
상담일: ${clean(body.date,30)}
회기: ${sessionNumber}회기
파일명: ${clean(body.fileName,200)}

${transcriptText?`축어록 본문:
${clean(transcriptText,18000)}`:'첨부한 PDF 또는 이미지 축어록을 직접 읽어 분석하세요.'}

[분석 순서]
1. 회기 시작 시 내담자가 제시한 핵심 호소와 주제
2. 상담자가 탐색한 내용과 실제 사용한 개입
3. 내담자의 주요 정서·사고·행동 반응
4. 회기 중 나타난 변화 또는 변화 없음
5. 합의된 과제와 다음 회기에서 확인할 내용
6. 안전 관련 위험 신호

[사실성 원칙]
- 축어록에 실제로 있는 내용만 사용합니다.
- 진단, 성격, 과거력, 가족관계를 추정하지 않습니다.
- 내담자 발언과 상담자 개입을 구분합니다.
- 상담자가 실제로 사용하지 않은 기법을 만들어내지 않습니다.
- 변화가 확인되지 않으면 "뚜렷한 변화는 확인되지 않음"이라고 씁니다.
- 과제가 합의되지 않았으면 과제를 새로 만들지 않습니다.
- 불분명한 내용은 "추가 확인 필요"라고 표시합니다.
- 자살·자해·타해·학대·폭력 위험이 명확히 언급되면 현재 안전 확인 필요를 기록합니다.
- 위험 내용이 없다면 위험이 없다고 단정하지 말고 "축어록에서 명확한 위험 신호는 확인되지 않음"이라고 씁니다.
- 상담자 검토용 초안이며 반드시 수정·확인해야 합니다.

[문장 품질 원칙]
- 같은 내용을 반복하지 않습니다.
- 한 문단에는 하나의 핵심만 씁니다.
- 쉬운 한국어를 사용합니다.
- 지나치게 긴 문장을 피합니다.
- 판단보다 관찰 가능한 내용과 발언을 우선합니다.
- 전문용어는 축어록 근거가 있고 기록에 필요한 경우에만 사용합니다.

[필드별 작성 기준]
- summary:
  회기 흐름을 5~8문장으로 정리합니다.
  시작 호소 → 탐색 → 개입 → 반응 → 마무리 순서를 따릅니다.

- goal:
  이번 회기의 실제 핵심 목표나 다룬 주제를 1~3문장으로 씁니다.
  명시적 목표가 없으면 실제 중심 주제를 기록합니다.

- content:
  다음 순서로 구분해 작성합니다.
  ① 주요 호소 및 상황
  ② 주요 정서
  ③ 주요 사고
  ④ 행동 및 대처
  ⑤ 상담자 개입
  각 항목은 축어록 근거가 있을 때만 씁니다.

- change:
  다음 순서로 구분해 작성합니다.
  ① 정서 변화
  ② 인지 변화
  ③ 행동 변화
  ④ 회기 말 반응
  확인되지 않은 변화는 만들지 않습니다.

- task:
  상담 중 실제로 합의된 실천과제만 기록합니다.
  합의가 없으면 "합의된 실천과제 없음"이라고 씁니다.

- next:
  다음 순서로 작성합니다.
  ① 다음 회기 목표
  ② 추가 확인이 필요한 내용
  ③ 안전 확인 필요 여부
  안전 부분은 축어록 근거에 따라 구체적으로 씁니다.

JSON만 반환하세요.
{
  "summary":"회기 전체 흐름 요약",
  "goal":"${sessionNumber}회기의 핵심 목표 또는 중심 주제",
  "content":"주요 호소·정서·사고·행동·상담자 개입을 구분한 기록",
  "change":"정서·인지·행동 변화와 회기 말 반응",
  "task":"실제로 합의된 실천과제",
  "next":"다음 회기 목표·추가 확인·안전 확인 필요 여부"
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
              temperature:0.1,
              topP:0.85,
              maxOutputTokens:4600,
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
      promptVersion:'counseling-transcript-session-note-v3-clinical-structured'
    });
  }catch(error){
    console.error('[COUNSELING TRANSCRIPT SESSION NOTE]',error.detail||error);
    return jsonResponse({
      error:error.message||'축어록 AI 회기기록 작성 중 오류가 발생했습니다.'
    },500);
  }
};