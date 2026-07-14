const jsonResponse=(obj,statusCode=200)=>({statusCode,headers:{"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"Content-Type","Access-Control-Allow-Methods":"POST, OPTIONS","Content-Type":"application/json; charset=utf-8"},body:JSON.stringify(obj)});
const clean=(v,max=20000)=>String(v||'').trim().slice(0,max);
function buildPrompt(body){
 const tests=(Array.isArray(body.tests)?body.tests:[]).map((t,i)=>`[${i+1}. ${clean(t.testType,100)}]
판독 신뢰도: ${Number(t.confidenceScore||0)}%
신뢰도 근거: ${clean(t.confidenceReason,1500)}
원자료 요약: ${clean(t.sourceSummary,3000)}
타당도/한계: ${clean(t.validity,2000)}
핵심 결과: ${clean(t.coreFindings,5000)}
강점: ${clean(t.strengths,2500)}
취약요인: ${clean(t.vulnerabilities,2500)}
교차 확인: ${clean(t.crossChecks,2500)}
사례 가설: ${clean(t.caseHypotheses,2500)}
주의사항: ${clean(t.cautions,2000)}
상담자 검토: ${t.reviewed?'완료':'미완료'}
확인 필요: ${t.needsReview?'예':'아니오'}`).join('\n\n');
 const cross=body.crossAnalysis?`

상담자 검토용 검사 간 교차분석:
공통 특징: ${clean(body.crossAnalysis.commonPatterns,3500)}
차이·추가확인: ${clean(body.crossAnalysis.differences,3500)}
상태-특성 구분: ${clean(body.crossAnalysis.stateTrait,3000)}
상황·응답 맥락: ${clean(body.crossAnalysis.responseContext,3000)}
위험·보호요인: ${clean(body.crossAnalysis.riskProtection,3000)}
추가 확인 질문: ${clean(body.crossAnalysis.followUpQuestions,3000)}
상담 시사점: ${clean(body.crossAnalysis.counselingImplications,3000)}
통합 가설: ${clean(body.crossAnalysis.caseIntegration,3500)}
한계: ${clean(body.crossAnalysis.limitations,2500)}`:'';
 return `당신은 임상심리사의 검사 통합과 내담자 제공용 종합 심리평가 보고서 초안 작성을 돕는 AI입니다.
대상자: ${clean(body.clientName,100)}
프로그램: ${clean(body.program,200)}

상담자용 검사별 분석:
${tests}${cross}

작성 원칙:
- 여러 검사에서 반복 확인되는 일치점과 서로 다른 결과를 별도로 분석합니다.
- 신뢰도가 낮거나 상담자 검토가 끝나지 않은 검사는 종합 결론의 근거로 강하게 사용하지 않습니다.
- 검사 간 차이가 있으면 방어적 반응, 상태-특성 차이, 상황 맥락, 측정 영역 차이 등의 가능한 설명을 가설로 제시하되 단정하지 않습니다.
- 검사별 전문용어와 숫자 나열보다 내담자가 이해할 수 있는 쉬운 한국어를 사용합니다.
- 병리화, 낙인, 진단 확정, 과도한 인과 추론을 하지 않습니다.
- 타당도나 원자료 제한을 종합 이해에 명확히 반영합니다.
- 강점과 보호요인을 충분히 포함합니다.
- 상담자용 질문과 위험 메모는 그대로 노출하지 않고 안전하고 이해 가능한 표현으로 바꿉니다.
- 이 문서는 전문가 최종 검토 전 초안입니다.

JSON만 반환하세요.
{
 "title":"종합 심리평가 보고서 제목",
 "purpose":"검사 목적과 보고서 이용 안내",
 "currentUnderstanding":"현재 마음과 전반적 상태",
 "emotionalStress":"정서와 스트레스 반응",
 "personality":"성격·기질·자기조절 특성",
 "relationships":"대인관계와 의사소통 특성",
 "agreementAnalysis":"검사 간 반복적으로 일치하는 특징과 공통 강점·어려움",
 "discrepancies":"검사 간 차이, 모순처럼 보이는 부분, 가능한 맥락적 설명, 추가 확인이 필요한 점",
 "followUpPoints":"면담, 행동관찰, 추가검사에서 확인할 핵심 항목",
 "strengths":"강점과 보호요인",
 "difficultSituations":"어려움을 느낄 수 있는 상황과 주의점",
 "integratedUnderstanding":"신뢰도와 한계를 반영한 전체 검사 결과의 통합적 이해",
 "dailySuggestions":"일상에서 실천 가능한 구체적 제안",
 "counselingTopics":"상담에서 함께 살펴보면 도움이 될 주제",
 "disclaimer":"검사 결과의 한계, 진단 대체 불가, 전문가 해석 필요 안내"
}`;
}
async function callGemini(apiKey,prompt){const models=[process.env.GEMINI_PRIMARY_MODEL||'gemini-2.5-flash',process.env.GEMINI_FALLBACK_MODEL||'gemini-2.5-flash-lite'];let lastError;for(const model of [...new Set(models)]){try{const response=await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({contents:[{role:'user',parts:[{text:prompt}]}],generationConfig:{temperature:0.2,topP:0.85,maxOutputTokens:7500,responseMimeType:'application/json',thinkingConfig:{thinkingBudget:0}}})});const data=await response.json().catch(()=>({}));const text=data?.candidates?.[0]?.content?.parts?.map(p=>p.text||'').join('\n').trim();if(response.ok&&text)return{text,model};lastError={status:response.status,model,data};}catch(error){lastError={model,error:error.message};}}const error=new Error('종합보고서 AI 호출 실패');error.detail=lastError;throw error;}
export const handler=async(event)=>{if(event.httpMethod==='OPTIONS')return jsonResponse({},200);if(event.httpMethod!=='POST')return jsonResponse({error:'POST only'},405);try{const body=JSON.parse(event.body||'{}');if(!clean(body.clientName))return jsonResponse({error:'회원 정보가 없습니다.'},400);if(!Array.isArray(body.tests)||!body.tests.length)return jsonResponse({error:'검사별 분석 자료가 없습니다.'},400);const apiKey=process.env.GEMINI_API_KEY||process.env.GOOGLE_API_KEY||process.env.GOOGLE_GEMINI_API_KEY;if(!apiKey)return jsonResponse({error:'GEMINI_API_KEY가 설정되지 않았습니다.'},500);const result=await callGemini(apiKey,buildPrompt(body));let parsed;try{parsed=JSON.parse(result.text.replace(/^```json\s*/i,'').replace(/```$/i,'').trim());}catch{return jsonResponse({error:'종합보고서 결과 형식을 읽지 못했습니다. 다시 생성해 주세요.'},502);}const fields=['title','purpose','currentUnderstanding','emotionalStress','personality','relationships','agreementAnalysis','discrepancies','followUpPoints','strengths','difficultSituations','integratedUnderstanding','dailySuggestions','counselingTopics','disclaimer'];const report=Object.fromEntries(fields.map(k=>[k,clean(parsed[k],15000)]));return jsonResponse({report,model:result.model,promptVersion:'integrated-client-report-v3-cross-reviewed'});}catch(error){console.error('[INTEGRATED ASSESSMENT REPORT]',error.detail||error);return jsonResponse({error:'종합보고서 생성 중 오류가 발생했습니다.'},500);}};
