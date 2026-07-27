// MML assessment document fact extractor
// Stage 1: read only verifiable facts from PDF/image. No clinical narrative report here.

const jsonResponse=(obj,statusCode=200)=>({
  statusCode,
  headers:{
    'Access-Control-Allow-Origin':'*',
    'Access-Control-Allow-Headers':'Content-Type',
    'Access-Control-Allow-Methods':'POST, OPTIONS',
    'Content-Type':'application/json; charset=utf-8'
  },
  body:JSON.stringify(obj)
});

const clean=(value,max=12000)=>String(value??'').trim().slice(0,max);
const SUPPORTED=['application/pdf','image/png','image/jpeg','image/webp'];
const MODEL='gemini-2.5-flash';

const EXTRACT_SCHEMA={
  type:'OBJECT',
  properties:{
    detectedTestType:{type:'STRING'},
    documentQuality:{type:'STRING'},
    confidenceScore:{type:'NUMBER'},
    validityFacts:{type:'ARRAY',items:{type:'STRING'}},
    scoreFacts:{
      type:'ARRAY',items:{
        type:'OBJECT',
        properties:{
          scale:{type:'STRING'},score:{type:'STRING'},direction:{type:'STRING'},source:{type:'STRING'}
        },
        required:['scale','score','direction','source']
      }
    },
    profileFacts:{type:'ARRAY',items:{type:'STRING'}},
    visibleTextFacts:{type:'ARRAY',items:{type:'STRING'}},
    missingOrUnclear:{type:'ARRAY',items:{type:'STRING'}}
  },
  required:['detectedTestType','documentQuality','confidenceScore','validityFacts','scoreFacts','profileFacts','visibleTextFacts','missingOrUnclear']
};

function prompt(body){
  return `당신은 심리검사 결과지의 사실 추출기입니다.
선택 검사: ${clean(body.testType,100)}
파일명: ${clean(body.fileName,200)}

이 단계에서는 심리해석이나 보고서를 작성하지 않습니다. 문서에서 눈으로 확인되는 사실만 빠르게 추출합니다.

원칙:
- 결과지에 실제 표시된 검사명, 타당도, 척도명, 점수, 백분위/T점수, 높고 낮은 방향, 프로파일 설명만 기록합니다.
- 읽히지 않는 값은 추측하지 말고 missingOrUnclear에 넣습니다.
- 개인정보는 이름을 포함해 출력하지 않습니다.
- scoreFacts는 해석에 중요한 척도만 최대 24개로 제한합니다.
- source에는 표, 그래프, 결과요약, 해석문 등 확인 위치를 짧게 씁니다.
- visibleTextFacts는 문서에 인쇄된 핵심 설명 문장만 최대 12개 기록합니다.
- 임상적 의미, 진단, 상담 제언은 작성하지 않습니다.
- JSON만 반환합니다.`;
}

function parseJson(text){
  return JSON.parse(clean(text,40000).replace(/^```json\s*/i,'').replace(/^```\s*/i,'').replace(/```$/i,'').trim());
}

export const handler=async(event)=>{
  if(event.httpMethod==='OPTIONS')return jsonResponse({},200);
  if(event.httpMethod!=='POST')return jsonResponse({error:'POST 요청만 지원합니다.'},405);
  try{
    const body=JSON.parse(event.body||'{}');
    if(!clean(body.testType))return jsonResponse({error:'검사 종류가 없습니다.'},400);
    if(!body.base64||typeof body.base64!=='string')return jsonResponse({error:'검사결과 파일이 없습니다.'},400);
    if(!SUPPORTED.includes(body.mimeType))return jsonResponse({error:'PDF, PNG, JPG, WEBP 파일만 지원합니다.'},400);
    if(body.base64.length>7_500_000)return jsonResponse({error:'파일은 5MB 이하 또는 결과표 핵심 페이지만 올려 주세요.'},413);
    const apiKey=process.env.GEMINI_API_KEY||process.env.GOOGLE_API_KEY||process.env.GOOGLE_GEMINI_API_KEY;
    if(!apiKey)return jsonResponse({error:'GEMINI_API_KEY가 설정되지 않았습니다.'},500);

    const controller=new AbortController();
    const timeoutId=setTimeout(()=>controller.abort(),24000);
    try{
      const response=await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${apiKey}`,{
        method:'POST',headers:{'Content-Type':'application/json'},signal:controller.signal,
        body:JSON.stringify({
          contents:[{role:'user',parts:[{text:prompt(body)},{inlineData:{mimeType:body.mimeType,data:body.base64}}]}],
          generationConfig:{
            temperature:0,
            topP:0.6,
            maxOutputTokens:2600,
            responseMimeType:'application/json',
            responseSchema:EXTRACT_SCHEMA,
            thinkingConfig:{thinkingBudget:0}
          }
        })
      });
      const data=await response.json().catch(()=>({}));
      const text=data?.candidates?.[0]?.content?.parts?.map(part=>part.text||'').join('\n').trim();
      if(!response.ok||!text)throw new Error(data?.error?.message||`문서 사실 추출 실패 (HTTP ${response.status})`);
      const extracted=parseJson(text);
      return jsonResponse({extracted,model:MODEL,stage:'document-facts-v1'});
    }finally{clearTimeout(timeoutId);}
  }catch(error){
    console.error('[MML ASSESSMENT FILE EXTRACT]',error);
    return jsonResponse({
      error:error?.name==='AbortError'
        ?'결과지 읽기 시간이 초과되었습니다. 결과표와 프로파일이 있는 핵심 페이지만 PDF로 다시 올려 주세요.'
        :clean(error?.message,1000)||'검사결과 사실을 추출하지 못했습니다.'
    },error?.name==='AbortError'?504:500);
  }
};
