// MML clinical interpretation stage
// Stage 2: interpret already extracted facts. No file/PDF is sent to this function.

const ENGINE_VERSION='MML-CLINICAL-INTERPRETATION-1.0-CANONICAL';
const jsonResponse=(obj,statusCode=200)=>({statusCode,headers:{
  'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'Content-Type','Access-Control-Allow-Methods':'POST, OPTIONS','Content-Type':'application/json; charset=utf-8'
},body:JSON.stringify(obj)});
const clean=(value,max=18000)=>String(value??'').trim().slice(0,max);
const MODEL='gemini-2.5-flash';

const SCHEMA={type:'OBJECT',properties:{
  oneLine:{type:'STRING'},emotionalPattern:{type:'STRING'},thinkingPattern:{type:'STRING'},relationshipPattern:{type:'STRING'},stressPattern:{type:'STRING'},
  strengths:{type:'ARRAY',items:{type:'STRING'}},vulnerabilities:{type:'ARRAY',items:{type:'STRING'}},dailyMeaning:{type:'ARRAY',items:{type:'STRING'}},
  helpfulDirections:{type:'ARRAY',items:{type:'STRING'}},counselingQuestions:{type:'ARRAY',items:{type:'STRING'}},crossChecks:{type:'STRING'},
  caseHypotheses:{type:'ARRAY',items:{type:'STRING'}},cautions:{type:'STRING'},needsReview:{type:'BOOLEAN'},
  clientReport:{type:'OBJECT',properties:{
    currentMind:{type:'STRING'},interpretationBasis:{type:'STRING'},strengths:{type:'STRING'},focus:{type:'STRING'},
    emotionalUnderstanding:{type:'STRING'},thinkingUnderstanding:{type:'STRING'},relationshipUnderstanding:{type:'STRING'},stressUnderstanding:{type:'STRING'},
    dailyMeaning:{type:'STRING'},recommendations:{type:'STRING'},readerNote:{type:'STRING'}
  },required:['currentMind','interpretationBasis','strengths','focus','emotionalUnderstanding','thinkingUnderstanding','relationshipUnderstanding','stressUnderstanding','dailyMeaning','recommendations','readerNote']},
  counselorReport:{type:'OBJECT',properties:{
    validity:{type:'STRING'},summary:{type:'STRING'},clinicalInterpretation:{type:'STRING'},strengths:{type:'STRING'},risks:{type:'STRING'},caseFormulation:{type:'STRING'},reviewPoints:{type:'STRING'}
  },required:['validity','summary','clinicalInterpretation','strengths','risks','caseFormulation','reviewPoints']},
  professionalProfile:{type:'OBJECT',properties:{
    emotion:{type:'STRING'},thinking:{type:'STRING'},relationship:{type:'STRING'},stress:{type:'STRING'},selfRegulation:{type:'STRING'},recovery:{type:'STRING'}
  },required:['emotion','thinking','relationship','stress','selfRegulation','recovery']}
},required:['oneLine','emotionalPattern','thinkingPattern','relationshipPattern','stressPattern','strengths','vulnerabilities','dailyMeaning','helpfulDirections','counselingQuestions','crossChecks','caseHypotheses','cautions','needsReview','clientReport','counselorReport','professionalProfile']};

function prompt(body){
  const facts=body.extractedFacts&&typeof body.extractedFacts==='object'?body.extractedFacts:{};
  const previous=body.analysisSnapshot&&typeof body.analysisSnapshot==='object'?body.analysisSnapshot:{};
  return `당신은 임상심리사의 심리검사 결과 해석과 보고서 작성을 돕는 단일 전문 분석 엔진입니다.
선택 검사: ${clean(body.testType,100)}
프로그램: ${clean(body.program,200)}
작업 모드: ${body.mode==='report-refresh'?'기존 분석을 근거로 전문보고서 재작성':'추출 사실 해석 + 전문보고서 동시 작성'}

[결과지에서 직접 추출한 사실]
${clean(JSON.stringify(facts),24000)}

[기존 상담자 검토 자료 - 재작성 시 참고]
${clean(JSON.stringify(previous),12000)}

작성 원칙:
1. 입력 자료에 있는 사실만 근거로 사용하고, 없는 생활사·진단·사건·행동관찰은 만들지 않습니다.
2. 사실과 임상적 가설을 구분합니다. 근거가 약한 내용은 caseHypotheses 또는 counselorReport.reviewPoints에만 둡니다.
3. 정서·사고·관계·스트레스 영역은 서로 다른 핵심을 설명하며 같은 문장을 반복하지 않습니다.
4. 강점과 취약성은 확인 가능한 척도·프로파일·문장 근거에 연결합니다.
5. 검사별 해석 범위를 지킵니다. 선별검사는 진단하지 않고, SCT·HTP 같은 투사 자료는 탐색적 가설로만 다룹니다.
6. clientReport는 내담자에게 직접 제공할 수 있는 쉬운 한국어로 작성하고 점수 나열, 내부 필드명, 상담자 질문을 노출하지 않습니다.
7. counselorReport는 전문가 검토용으로 타당도, 핵심 해석, 사례가설, 추가 확인사항을 명확히 구분합니다.
8. professionalProfile은 감정·사고·관계·스트레스·자기조절·회복의 6영역을 각각 2~4문장으로 요약합니다.
9. clientReport.recommendations는 검사 근거와 연결된 현실적인 실천방향 3~5개를 줄바꿈으로 제시합니다.
10. 검사 결과만으로 확정할 수 없는 내용은 가능성 표현을 사용합니다.
11. 상담자 검토가 필요한 이유가 있으면 needsReview를 true로 설정합니다.
12. JSON만 반환합니다.`;
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
    const hasFacts=body.extractedFacts&&typeof body.extractedFacts==='object';
    const hasSnapshot=body.analysisSnapshot&&typeof body.analysisSnapshot==='object';
    if(!hasFacts&&!hasSnapshot)return jsonResponse({error:'해석에 사용할 검사 사실 또는 기존 분석 자료가 없습니다.'},400);
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

    const facts=hasFacts?body.extractedFacts:(body.analysisSnapshot?.rawFacts||{});
    const confidenceScore=Math.max(0,Math.min(100,Math.round(Number(facts.confidenceScore??body.analysisSnapshot?.confidenceScore)||0)));
    const unclear=Array.isArray(facts.missingOrUnclear)?facts.missingOrUnclear:[];
    const scoreFacts=Array.isArray(facts.scoreFacts)?facts.scoreFacts.slice(0,24):[];
    const validityFacts=Array.isArray(facts.validityFacts)?facts.validityFacts:[];
    const profileFacts=Array.isArray(facts.profileFacts)?facts.profileFacts:[];
    const sourceLines=[...validityFacts,...scoreFacts.map(x=>`${clean(x?.scale,120)}: ${[clean(x?.score,120),clean(x?.direction,120)].filter(Boolean).join(' · ')}`),...profileFacts].filter(Boolean);

    const analysis={
      detectedTestType:clean(facts.detectedTestType,100)||'확인필요',
      confidenceScore,
      confidenceReason:[clean(facts.documentQuality||body.analysisSnapshot?.confidenceReason,800),unclear.length?`확인 필요: ${unclear.join(', ')}`:''].filter(Boolean).join(' '),
      needsReview:Boolean(result.needsReview)||confidenceScore<80||unclear.length>0,
      sourceSummary:clean(result.oneLine),
      validity:listText(validityFacts)||'현재 확인된 결과지 범위에서 해석했으며 상담자가 원자료와 함께 검토해야 합니다.',
      coreFindings:[result.oneLine,result.emotionalPattern,result.thinkingPattern,result.relationshipPattern,result.stressPattern,listText(result.dailyMeaning)].map(v=>clean(v)).filter(Boolean).join('\n\n'),
      strengths:listText(result.strengths),vulnerabilities:listText(result.vulnerabilities),counselingQuestions:listText(result.counselingQuestions),
      crossChecks:clean(result.crossChecks),caseHypotheses:listText(result.caseHypotheses),cautions:clean(result.cautions),
      oneLine:clean(result.oneLine),emotionalPattern:clean(result.emotionalPattern),thinkingPattern:clean(result.thinkingPattern),relationshipPattern:clean(result.relationshipPattern),stressPattern:clean(result.stressPattern),
      dailyMeaning:listText(result.dailyMeaning),helpfulDirections:listText(result.helpfulDirections),
      clientReport:{...(result.clientReport||{}),overview:clean(result.clientReport?.currentMind),professionalProfile:result.professionalProfile||{}},
      counselorReport:result.counselorReport||{},professionalProfile:result.professionalProfile||{},
      professionalReportReady:true,reportGenerationRequired:false,reportEngineVersion:ENGINE_VERSION,
      rawFacts:{validityFacts,scoreFacts,profileFacts,visibleTextFacts:Array.isArray(facts.visibleTextFacts)?facts.visibleTextFacts:[],missingOrUnclear:unclear,sourceLines},
      engineVersion:ENGINE_VERSION
    };
    return jsonResponse({analysis,model:MODEL,engineVersion:ENGINE_VERSION,qualityChecked:true});
  }catch(error){
    console.error('[MML ASSESSMENT INTERPRETATION]',error);
    return jsonResponse({error:error?.name==='AbortError'?'검사 해석 시간이 초과되었습니다. 다시 시도해 주세요.':clean(error?.message,1000)||'검사결과를 해석하지 못했습니다.',engineVersion:ENGINE_VERSION},error?.name==='AbortError'?504:500);
  }
};
