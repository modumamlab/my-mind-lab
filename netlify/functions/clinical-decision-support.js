const jsonResponse=(obj,statusCode=200)=>({statusCode,headers:{"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"Content-Type","Access-Control-Allow-Methods":"POST, OPTIONS","Content-Type":"application/json; charset=utf-8"},body:JSON.stringify(obj)});
const clean=(value,max=18000)=>String(value??'').trim().slice(0,max);

function promptFor(body){
  const sessions=(Array.isArray(body.sessions)?body.sessions:[]).map((s,i)=>`[${s.sessionNumber||i+1}회기 ${clean(s.date,30)}]\n목표: ${clean(s.goal,1000)}\n내용: ${clean(s.content,4500)}\n결과: ${clean(s.result||s.change,2200)}\n과제: ${clean(s.task,1200)}\n다음: ${clean(s.next,1500)}`).join('\n\n');
  const tests=(Array.isArray(body.tests)?body.tests:[]).map((t,i)=>`[검사 ${i+1}] ${clean(t.name||t.testType,120)}\n${clean(t.summary||t.analysis||t.content||JSON.stringify(t),5000)}`).join('\n\n');
  return `당신은 임상심리사·상담자를 위한 임상 의사결정 지원 AI입니다. 상담자의 판단을 대신하지 말고, 제공된 자료에서 확인되는 위험 신호, 자료 누락, 기록 간 불일치, 근거 위치를 구조화하여 제시하세요.

[사례]
프로그램: ${clean(body.program,200)}
현재 상태: ${clean(body.currentStatus,100)}

[접수]
${clean(JSON.stringify(body.intake||{}),12000)||'없음'}

[심리검사]
${tests||'없음'}

[사례개념화]
${clean(JSON.stringify(body.formulation||{}),16000)||'없음'}

[상담계획]
${clean(JSON.stringify(body.counselingPlan||{}),16000)||'없음'}

[검토 완료 회기]
${sessions||'없음'}

[슈퍼비전]
${clean(JSON.stringify(body.supervision||{}),10000)||'없음'}

[기록 품질검사]
${clean(JSON.stringify(body.recordQuality||{}),8000)||'없음'}

[종합사례보고서]
${clean(JSON.stringify(body.clinicalCaseReport||{}),14000)||'없음'}

[종결평가]
${clean(JSON.stringify(body.termination||{}),14000)||'없음'}

필수 원칙:
- 자료에 없는 위험, 진단, 사건을 생성하지 않습니다.
- 위험 관련 직접 근거가 없으면 “낮음”이 아니라 “평가자료 부족”으로 표시합니다.
- 자살·자해, 타해, 학대, 정신병적 증상, 급성 중독·금단, 심각한 기능저하, 응급 의료 필요성을 각각 점검합니다.
- 각 판단은 출처(접수/검사명/회기/사례개념화/종결평가)와 근거 문구를 짧게 연결합니다.
- 사례개념화↔상담계획, 상담계획↔회기기록, 변화평가↔회기근거, 위험요인↔종결평가의 일관성을 확인합니다.
- 점수는 임상효과 점수가 아니라 기록 완성도 보조지표입니다.
- 개인정보를 반복하지 않습니다.

JSON만 반환하세요.
{
 "overallRiskLevel":"긴급/높음/주의/낮음/평가자료 부족 중 하나",
 "overallRiskReason":"종합 위험 판단의 직접 근거와 한계",
 "dataSufficiencyLevel":"충분/부분 충분/부족",
 "dataSufficiencyReason":"자료 충분성 이유",
 "caseQualityScore":0,
 "consistencyScore":0,
 "goalAlignmentScore":0,
 "consistencySummary":"기록 간 일관성 요약",
 "goalAlignmentSummary":"목표와 개입 연결성 요약",
 "terminationReadiness":"적절/조건부/추가상담 권고/평가자료 부족/해당 없음",
 "terminationReadinessReason":"종결 준비도 근거와 한계",
 "riskReview":[{"category":"자살·자해 위험","level":"긴급/높음/주의/낮음/평가자료 부족","evidence":"직접 근거 또는 자료 부족 설명","recommendedAction":"상담자가 확인할 조치"}],
 "consistencyChecks":[{"item":"사례개념화와 상담계획","status":"일치/부분 일치/불일치/자료 부족","explanation":"근거"}],
 "evidenceTrace":[{"claim":"AI가 제시한 핵심 판단","source":"회기/검사/문서","location":"예: 3회기 상담결과","evidence":"근거 요약"}],
 "missingEvidence":["추가로 확인할 자료"],
 "priorityActions":["상담자가 우선 확인할 사항"]
}`;
}

async function callGemini(apiKey,prompt){
  const models=[...new Set([process.env.GEMINI_PRIMARY_MODEL||'gemini-2.5-flash',process.env.GEMINI_FALLBACK_MODEL||'gemini-2.5-flash','gemini-2.5-flash'].filter(Boolean).filter(m=>!String(m).includes('lite')))];
  let lastError;
  for(const model of models){
    try{
      const response=await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({contents:[{role:'user',parts:[{text:prompt}]}],generationConfig:{temperature:0.08,topP:0.8,maxOutputTokens:10000,responseMimeType:'application/json'}})});
      const data=await response.json().catch(()=>({}));
      const text=data?.candidates?.[0]?.content?.parts?.map(p=>p.text||'').join('\n').trim();
      if(response.ok&&text)return{text,model};
      lastError={status:response.status,model,data};
    }catch(error){lastError={model,error:error.message}}
  }
  const error=new Error('clinical dss generation failed');error.detail=lastError;throw error;
}

const clamp=n=>Math.max(0,Math.min(100,Number(n)||0));
export const handler=async(event)=>{
  if(event.httpMethod==='OPTIONS')return jsonResponse({},200);
  if(event.httpMethod!=='POST')return jsonResponse({error:'POST only'},405);
  try{
    const body=JSON.parse(event.body||'{}');
    if((!Array.isArray(body.sessions)||!body.sessions.length)&&(!Array.isArray(body.tests)||!body.tests.length))return jsonResponse({error:'검토 완료 회기기록 또는 심리검사 자료가 필요합니다.'},400);
    const apiKey=process.env.GEMINI_API_KEY||process.env.GOOGLE_API_KEY||process.env.GOOGLE_GEMINI_API_KEY;
    if(!apiKey)return jsonResponse({error:'GEMINI_API_KEY가 설정되지 않았습니다.'},500);
    const out=await callGemini(apiKey,promptFor(body));
    let parsed;
    try{parsed=JSON.parse(out.text.replace(/^```json\s*/i,'').replace(/^```\s*/,'').replace(/```$/,'').trim())}
    catch{return jsonResponse({error:'AI 임상 점검 결과 형식을 읽지 못했습니다.'},502)}
    const result={
      overallRiskLevel:clean(parsed.overallRiskLevel,50),overallRiskReason:clean(parsed.overallRiskReason,5000),
      dataSufficiencyLevel:clean(parsed.dataSufficiencyLevel,50),dataSufficiencyReason:clean(parsed.dataSufficiencyReason,4000),
      caseQualityScore:clamp(parsed.caseQualityScore),consistencyScore:clamp(parsed.consistencyScore),goalAlignmentScore:clamp(parsed.goalAlignmentScore),
      consistencySummary:clean(parsed.consistencySummary,4000),goalAlignmentSummary:clean(parsed.goalAlignmentSummary,4000),
      terminationReadiness:clean(parsed.terminationReadiness,100),terminationReadinessReason:clean(parsed.terminationReadinessReason,4000),
      riskReview:Array.isArray(parsed.riskReview)?parsed.riskReview.slice(0,12):[],
      consistencyChecks:Array.isArray(parsed.consistencyChecks)?parsed.consistencyChecks.slice(0,12):[],
      evidenceTrace:Array.isArray(parsed.evidenceTrace)?parsed.evidenceTrace.slice(0,20):[],
      missingEvidence:Array.isArray(parsed.missingEvidence)?parsed.missingEvidence.slice(0,20):[],
      priorityActions:Array.isArray(parsed.priorityActions)?parsed.priorityActions.slice(0,12):[]
    };
    return jsonResponse({result,model:out.model,promptVersion:'clinical-dss-v1'});
  }catch(error){console.error('[CLINICAL DSS]',error.detail||error);return jsonResponse({error:'AI 임상 의사결정 지원 생성 중 오류가 발생했습니다.'},500)}
};
