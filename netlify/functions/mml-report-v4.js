// MML Professional Individual Report v5
// Two-phase professional report composer for client-facing individual assessment reports.
const ENGINE_VERSION='MML-PRO-REPORT-V5.0-BALANCED';
const jsonResponse=(obj,statusCode=200)=>({statusCode,headers:{
  'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'Content-Type','Access-Control-Allow-Methods':'POST, OPTIONS','Content-Type':'application/json; charset=utf-8'
},body:JSON.stringify(obj)});
const clean=(v,max=16000)=>String(v??'').replace(/\r/g,'').replace(/[ \t]+/g,' ').replace(/\n{3,}/g,'\n\n').trim().slice(0,max);
const MODEL=process.env.GEMINI_REPORT_MODEL||'gemini-2.5-flash';

const CORE_SCHEMA={type:'OBJECT',properties:{
  currentMind:{type:'STRING'},interpretationBasis:{type:'STRING'},strengths:{type:'STRING'},focus:{type:'STRING'},readerNote:{type:'STRING'}
},required:['currentMind','interpretationBasis','strengths','focus','readerNote']};
const DETAIL_SCHEMA={type:'OBJECT',properties:{
  emotionalUnderstanding:{type:'STRING'},thinkingUnderstanding:{type:'STRING'},relationshipUnderstanding:{type:'STRING'},stressUnderstanding:{type:'STRING'},dailyMeaning:{type:'STRING'},recommendations:{type:'STRING'},professionalSummary:{type:'STRING'},professionalProfile:{type:'OBJECT',properties:{emotion:{type:'STRING'},thinking:{type:'STRING'},relationship:{type:'STRING'},stress:{type:'STRING'},selfRegulation:{type:'STRING'},recovery:{type:'STRING'}},required:['emotion','thinking','relationship','stress','selfRegulation','recovery']}
},required:['emotionalUnderstanding','thinkingUnderstanding','relationshipUnderstanding','stressUnderstanding','dailyMeaning','recommendations','professionalSummary','professionalProfile']};

function testGuide(testType=''){
  const t=String(testType).toUpperCase();
  if(t.includes('TCI'))return 'TCI는 기질의 자동적 반응 경향과 성격의 자기조절·목표지향·협력성을 함께 해석합니다. 높은 점수와 낮은 점수를 단독으로 좋고 나쁨으로 판단하지 말고 조합과 생활 맥락을 설명합니다.';
  if(t.includes('MMPI'))return 'MMPI-2는 타당도 지표를 먼저 확인한 뒤 임상척도와 내용·보충척도의 전체 프로파일을 통합합니다. 진단명은 확정하지 않고 현재의 정서, 사고, 행동, 대인관계 기능을 설명합니다.';
  if(t.includes('PAI'))return 'PAI는 현재 증상 경험, 대인관계 특성, 치료 고려사항과 위험·보호요인을 함께 해석합니다. 임상적 상승과 기능 영향을 구분합니다.';
  if(t.includes('SCT'))return 'SCT는 반복되는 문장 주제와 정서적 톤을 탐색적 단서로 사용합니다. 단일 반응을 성격이나 병리로 단정하지 않습니다.';
  if(t.includes('HTP'))return 'HTP는 그림의 형식적·내용적 특징을 면담과 다른 검사 결과와 함께 탐색적 가설로만 사용합니다.';
  if(t.includes('PHQ')||t.includes('GAD'))return '선별검사는 현재 증상 수준과 기능 영향을 파악하는 자료이며 진단을 확정하지 않습니다.';
  return '해당 검사가 측정하는 범위와 해석 제한을 지키고, 제공된 원자료에 근거해 생활 속 의미를 설명합니다.';
}
function sourceText(body){
  const a=body.analysis||body.source||body;
  return `검사명: ${clean(body.testType||a.testType,120)}\n프로그램: ${clean(body.program,160)}\n검사별 해석 원칙: ${testGuide(body.testType||a.testType)}\n\n[원자료 기반 사실]\n${clean(JSON.stringify(a.rawFacts||{}),18000)}\n\n[검사 해석 초안]\n타당도: ${clean(a.validity,1800)}\n핵심 결과: ${clean(a.coreFindings||a.sourceSummary,4200)}\n정서: ${clean(a.emotionalPattern,1800)}\n사고: ${clean(a.thinkingPattern,1800)}\n관계: ${clean(a.relationshipPattern,1800)}\n스트레스: ${clean(a.stressPattern,1800)}\n강점: ${clean(a.strengths,1800)}\n취약성: ${clean(a.vulnerabilities,1800)}\n일상 의미: ${clean(a.dailyMeaning,2200)}\n도움 방향: ${clean(a.helpfulDirections,2200)}\n주의: ${clean(a.cautions,1200)}`;
}
function corePrompt(body){return `당신은 임상심리사 1급 수준의 심리평가 보고서 작성자입니다. 아래 자료만 근거로 내담자용 개별 심리검사 보고서의 핵심 부분을 작성하십시오.\n\n${sourceText(body)}\n\n[작성 기준]\n- 현재 마음의 핵심 모습은 2개 문단, 총 7~9문장입니다. 검사 결과의 핵심 특성→장점→부담이 커지는 조건→생활 의미를 자연스럽게 연결합니다.\n- 해석 기준은 3~4문장으로 타당도, 해석 가능 범위, 한계를 명확히 씁니다.\n- 강점은 3~5문장, 살펴볼 부분은 3~5문장입니다. 서로 같은 내용을 반복하지 않습니다.\n- 단순 점수 나열, 과도한 일반론, 감성적 위로, 진단 단정, 질문형 문장을 쓰지 않습니다.\n- 내담자가 이해할 수 있는 쉬운 한국어로 쓰되 전문적 의미를 유지합니다.\n- JSON만 반환합니다.`;}
function detailPrompt(body){return `당신은 임상심리사 1급 수준의 심리평가 보고서 작성자입니다. 아래 자료만 근거로 내담자용 개별 심리검사 보고서의 세부 해석과 회복 방향을 작성하십시오.\n\n${sourceText(body)}\n\n[작성 기준]\n- 정서, 사고, 관계, 스트레스, 일상 의미는 각각 역할이 다릅니다. 같은 결론을 반복하지 않습니다.\n- 각 영역은 중요도에 따라 2~5문장으로 씁니다. 근거가 약한 영역은 짧게 쓰고 추정하지 않습니다.\n- 각 문단은 특성→생활에서의 표현→강점 또는 부담 조건 순으로 연결합니다.\n- professionalProfile의 각 항목은 2~3문장으로 압축합니다.\n- 전문가 종합소견은 5~7문장으로 전체 검사 결과를 하나의 심리적 흐름으로 통합합니다.\n- 회복 방향은 번호 4개로 작성합니다. 각 항목은 제목 1줄과 이유·실행 방법 2~3문장으로 구성합니다.\n- 일반적인 수면·운동 조언만 나열하지 말고 검사 결과와 직접 연결합니다.\n- 진단 단정, 낙인, 과장, AI 안내문, 질문형 문장을 쓰지 않습니다.\n- JSON만 반환합니다.`;}
async function callGemini(apiKey,prompt,schema){
  const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),24000);
  try{
    const response=await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(MODEL)}:generateContent?key=${encodeURIComponent(apiKey)}`,{method:'POST',headers:{'Content-Type':'application/json'},signal:controller.signal,body:JSON.stringify({contents:[{role:'user',parts:[{text:prompt}]}],generationConfig:{temperature:.16,topP:.82,maxOutputTokens:4200,responseMimeType:'application/json',responseSchema:schema,thinkingConfig:{thinkingBudget:0}}})});
    const data=await response.json().catch(()=>({}));const text=data?.candidates?.[0]?.content?.parts?.map(p=>p.text||'').join('\n').trim();
    if(!response.ok||!text)throw new Error(data?.error?.message||`전문보고서 생성 실패 (HTTP ${response.status})`);
    return JSON.parse(text.replace(/^```json\s*/i,'').replace(/```$/i,'').trim());
  }finally{clearTimeout(timer)}
}
export const handler=async(event)=>{
  if(event.httpMethod==='OPTIONS')return jsonResponse({},200);
  if(event.httpMethod!=='POST')return jsonResponse({error:'POST 요청만 지원합니다.'},405);
  try{
    const body=JSON.parse(event.body||'{}');const apiKey=process.env.GEMINI_API_KEY||process.env.GOOGLE_API_KEY||process.env.GOOGLE_GEMINI_API_KEY;
    if(!apiKey)return jsonResponse({error:'GEMINI_API_KEY가 설정되지 않았습니다.'},500);
    if((body.mode||'individual')!=='individual')return jsonResponse({error:'개별보고서 모드만 지원합니다.'},400);
    const phase=body.phase==='detail'?'detail':'core';
    const data=await callGemini(apiKey,phase==='core'?corePrompt(body):detailPrompt(body),phase==='core'?CORE_SCHEMA:DETAIL_SCHEMA);
    const analysis=phase==='core'?{clientReport:{...data},counselorReport:{professionalSummary:data.currentMind}}:{clientReport:{...data,professionalProfile:data.professionalProfile},professionalProfile:data.professionalProfile,counselorReport:{professionalSummary:data.professionalSummary}};
    return jsonResponse({analysis,model:MODEL,engineVersion:ENGINE_VERSION,phase,needsReview:true});
  }catch(error){
    console.error('[MML PROFESSIONAL REPORT V5]',error);
    return jsonResponse({error:error?.name==='AbortError'?'전문보고서 생성 시간이 초과되었습니다. 다시 시도해 주세요.':clean(error?.message,1000)||'전문보고서를 생성하지 못했습니다.',engineVersion:ENGINE_VERSION},error?.name==='AbortError'?504:500);
  }
};
