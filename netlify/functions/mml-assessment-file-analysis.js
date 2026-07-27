// MML clinical interpretation stage
// Stage 2: interpret already extracted facts. No file/PDF is sent to this function.

const ENGINE_VERSION='MML-CLINICAL-INTERPRETATION-0.5-SPLIT';
const jsonResponse=(obj,statusCode=200)=>({statusCode,headers:{
  'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'Content-Type','Access-Control-Allow-Methods':'POST, OPTIONS','Content-Type':'application/json; charset=utf-8'
},body:JSON.stringify(obj)});
const clean=(value,max=18000)=>String(value??'').trim().slice(0,max);
const MODEL='gemini-2.5-flash';

const SCHEMA={type:'OBJECT',properties:{
  oneLine:{type:'STRING'},emotionalPattern:{type:'STRING'},thinkingPattern:{type:'STRING'},relationshipPattern:{type:'STRING'},stressPattern:{type:'STRING'},
  strengths:{type:'ARRAY',items:{type:'STRING'}},vulnerabilities:{type:'ARRAY',items:{type:'STRING'}},dailyMeaning:{type:'ARRAY',items:{type:'STRING'}},
  helpfulDirections:{type:'ARRAY',items:{type:'STRING'}},counselingQuestions:{type:'ARRAY',items:{type:'STRING'}},crossChecks:{type:'STRING'},
  caseHypotheses:{type:'ARRAY',items:{type:'STRING'}},cautions:{type:'STRING'},needsReview:{type:'BOOLEAN'}
},required:['oneLine','emotionalPattern','thinkingPattern','relationshipPattern','stressPattern','strengths','vulnerabilities','dailyMeaning','helpfulDirections','counselingQuestions','crossChecks','caseHypotheses','cautions','needsReview']};

function prompt(body){
  return `당신은 임상심리사의 심리검사 해석을 돕는 전문 분석 엔진입니다.
선택 검사: ${clean(body.testType,100)}
프로그램: ${clean(body.program,200)}

아래 자료는 이전 단계에서 결과지에서 직접 추출한 사실입니다. 이 자료에 있는 내용만 근거로 해석하세요.

[추출 사실]
${clean(JSON.stringify(body.extractedFacts||{}),24000)}

작성 원칙:
- 점수와 프로파일의 조합을 해석하되 자료에 없는 진단·생활사·사건을 만들지 않습니다.
- 사실과 가설을 구분합니다. 근거가 약한 내용은 caseHypotheses에만 둡니다.
- 정서, 사고, 관계, 스트레스 영역이 같은 문장을 반복하지 않게 합니다.
- 강점과 취약성은 반드시 추출된 척도 또는 프로파일 근거와 연결합니다.
- 내담자에게 전달 가능한 쉬운 한국어를 쓰되, 임상적으로 모호한 위로 문구는 피합니다.
- 각 핵심 영역은 2~4문장, 목록은 2~4개로 제한합니다.
- 검사별 범위를 지킵니다. 선별검사는 진단하지 않고, 투사검사는 탐색적 가설로만 다룹니다.
- 상담자 검토가 필요한 이유가 있으면 needsReview를 true로 설정합니다.
- JSON만 반환합니다.`;
}

const listText=value=>Array.isArray(value)?value.map(v=>clean(v,2500)).filter(Boolean).join('\n'):clean(value);
const parseJson=text=>JSON.parse(clean(text,50000).replace(/^```json\s*/i,'').replace(/^```\s*/i,'').replace(/```$/i,'').trim());

export const handler=async(event)=>{
  if(event.httpMethod==='OPTIONS')return jsonResponse({},200);
  if(event.httpMethod!=='POST')return jsonResponse({error:'POST 요청만 지원합니다.'},405);
  try{
    const body=JSON.parse(event.body||'{}');
    if(!clean(body.clientName))return jsonResponse({error:'회원 정보가 없습니다.'},400);
    if(!clean(body.testType))return jsonResponse({error:'검사 종류가 없습니다.'},400);
    if(!body.extractedFacts||typeof body.extractedFacts!=='object')return jsonResponse({error:'추출된 검사 사실이 없습니다.'},400);
    const apiKey=process.env.GEMINI_API_KEY||process.env.GOOGLE_API_KEY||process.env.GOOGLE_GEMINI_API_KEY;
    if(!apiKey)return jsonResponse({error:'GEMINI_API_KEY가 설정되지 않았습니다.'},500);

    const controller=new AbortController();
    const timeoutId=setTimeout(()=>controller.abort(),24000);
    let result;
    try{
      const response=await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${apiKey}`,{
        method:'POST',headers:{'Content-Type':'application/json'},signal:controller.signal,
        body:JSON.stringify({contents:[{role:'user',parts:[{text:prompt(body)}]}],generationConfig:{
          temperature:0.12,topP:0.78,maxOutputTokens:3600,responseMimeType:'application/json',responseSchema:SCHEMA,thinkingConfig:{thinkingBudget:0}
        }})
      });
      const data=await response.json().catch(()=>({}));
      const text=data?.candidates?.[0]?.content?.parts?.map(p=>p.text||'').join('\n').trim();
      if(!response.ok||!text)throw new Error(data?.error?.message||`검사 해석 실패 (HTTP ${response.status})`);
      result=parseJson(text);
    }finally{clearTimeout(timeoutId);}

    const facts=body.extractedFacts||{};
    const confidenceScore=Math.max(0,Math.min(100,Math.round(Number(facts.confidenceScore)||0)));
    const unclear=Array.isArray(facts.missingOrUnclear)?facts.missingOrUnclear:[];
    const scoreFacts=Array.isArray(facts.scoreFacts)?facts.scoreFacts.slice(0,24):[];
    const validityFacts=Array.isArray(facts.validityFacts)?facts.validityFacts:[];
    const profileFacts=Array.isArray(facts.profileFacts)?facts.profileFacts:[];
    const sourceLines=[...validityFacts,...scoreFacts.map(x=>`${clean(x?.scale,120)}: ${[clean(x?.score,120),clean(x?.direction,120)].filter(Boolean).join(' · ')}`),...profileFacts].filter(Boolean);

    const analysis={
      detectedTestType:clean(facts.detectedTestType,100)||'확인필요',
      confidenceScore,
      confidenceReason:[clean(facts.documentQuality,800),unclear.length?`확인 필요: ${unclear.join(', ')}`:''].filter(Boolean).join(' '),
      needsReview:Boolean(result.needsReview)||confidenceScore<80||unclear.length>0,
      sourceSummary:clean(result.oneLine),
      validity:listText(validityFacts)||'현재 확인된 결과지 범위에서 해석했으며 상담자가 원자료와 함께 검토해야 합니다.',
      coreFindings:[result.oneLine,result.emotionalPattern,result.thinkingPattern,result.relationshipPattern,result.stressPattern,listText(result.dailyMeaning)].map(v=>clean(v)).filter(Boolean).join('\n\n'),
      strengths:listText(result.strengths),vulnerabilities:listText(result.vulnerabilities),counselingQuestions:listText(result.counselingQuestions),
      crossChecks:clean(result.crossChecks),caseHypotheses:listText(result.caseHypotheses),cautions:clean(result.cautions),
      oneLine:clean(result.oneLine),emotionalPattern:clean(result.emotionalPattern),thinkingPattern:clean(result.thinkingPattern),relationshipPattern:clean(result.relationshipPattern),stressPattern:clean(result.stressPattern),
      dailyMeaning:listText(result.dailyMeaning),helpfulDirections:listText(result.helpfulDirections),
      rawFacts:{validityFacts,scoreFacts,profileFacts,visibleTextFacts:Array.isArray(facts.visibleTextFacts)?facts.visibleTextFacts:[],missingOrUnclear:unclear,sourceLines},
      engineVersion:ENGINE_VERSION
    };
    return jsonResponse({analysis,model:MODEL,engineVersion:ENGINE_VERSION,qualityChecked:true});
  }catch(error){
    console.error('[MML ASSESSMENT INTERPRETATION]',error);
    return jsonResponse({error:error?.name==='AbortError'?'검사 해석 시간이 초과되었습니다. 다시 시도해 주세요.':clean(error?.message,1000)||'검사결과를 해석하지 못했습니다.',engineVersion:ENGINE_VERSION},error?.name==='AbortError'?504:500);
  }
};
