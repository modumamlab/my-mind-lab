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

const clean=(value,max=18000)=>String(value??'').trim().slice(0,max);
const clampScore=value=>Math.max(0,Math.min(100,Math.round(Number(value)||0)));

function buildPrompt(body){
  const sessions=(Array.isArray(body.sessions)?body.sessions:[]).map((s,index)=>`
[${index+1}. ${clean(s.sessionNumber||index+1,20)}회기 · ${clean(s.date,30)}]
의뢰사유: ${clean(s.reason,1200)}
상담목표: ${clean(s.goal,1200)}
상담내용: ${clean(s.content,5000)}
상담결과·변화: ${clean(s.result,2200)}
실천과제: ${clean(s.task,1500)}
다음회기: ${clean(s.next,1800)}
`).join('\n');

  return `당신은 심리상담 회기기록의 문서 품질을 점검하는 임상 기록 보조 AI입니다.
아래 상담자 검토 완료 회기기록을 평가하세요.

[내담자]
${clean(body.clientName,100)}

[프로그램]
${clean(body.program,200)}

[회기기록]
${sessions||'없음'}

[중요 원칙]
- 상담자 개인의 역량, 인격, 상담 효과를 평가하지 않습니다.
- 오직 제공된 회기기록의 문서 품질과 임상적 연결성을 평가합니다.
- 긴 기록이라고 높은 점수를 주지 말고 필요한 정보가 명확히 구분되어 있는지 평가합니다.
- 실제 축어록이 없으므로 공감 수준이나 내담자 반응을 추정하지 않습니다.
- 자살·자해·타해·학대·폭력 위험이 기록에 없다는 이유만으로 위험 없음으로 판단하지 않습니다.
- 위험 관련 내용이 없는 경우 "직접 평가 여부가 기록에서 확인되지 않음"으로 평가합니다.
- 각 점수는 0~100 정수입니다.
- 모든 피드백은 비난 없이 바로 수정할 수 있는 문장으로 작성합니다.
- 자료에 없는 사실을 만들지 않습니다.
- 모든 값은 문자열 또는 숫자여야 하며 배열이나 객체를 사용하지 않습니다.

[평가 기준]
1. 기록 완성도: 의뢰사유·목표·내용·결과·과제·다음회기 항목이 실제 내용으로 채워졌는가
2. 목표 명확성: 회기 목표가 구체적이고 상담내용·결과와 연결되는가
3. 상담과정 구체성: 상담자 개입과 내담자 반응이 구분되어 기록되었는가
4. 개입 적절성 기록: 어떤 개입을 왜 사용했고 어떤 반응이 있었는지 확인 가능한가
5. 변화·결과 기록: 관찰된 변화와 미확인 사항이 구분되어 있는가
6. 위험·안전 기록: 위험평가 실시 여부와 필요한 안전조치가 기록되어 있는가
7. 사실·해석 구분: 직접 관찰·내담자 진술·상담자 해석·임상 가설이 구분되는가
8. 다음 회기 연결: 다음 회기 초점이 현재 결과와 사례 목표에 연결되는가

JSON만 반환하세요.
{
  "totalScore":0,
  "overallFeedback":"전체 기록 품질 요약",
  "completenessScore":0,
  "completenessFeedback":"기록 완성도 피드백",
  "goalClarityScore":0,
  "goalClarityFeedback":"목표 명확성 피드백",
  "processSpecificityScore":0,
  "processSpecificityFeedback":"상담과정 구체성 피드백",
  "interventionScore":0,
  "interventionFeedback":"개입 적절성 기록 피드백",
  "outcomeScore":0,
  "outcomeFeedback":"변화·결과 기록 피드백",
  "riskScore":0,
  "riskFeedback":"위험·안전 기록 피드백",
  "factInferenceScore":0,
  "factInferenceFeedback":"사실·해석 구분 피드백",
  "continuityScore":0,
  "continuityFeedback":"다음 회기 연결 피드백",
  "recordStrengths":"잘 기록된 부분 3~5개",
  "priorityImprovements":"우선 수정할 부분 3~5개와 수정 예시"
}`;
}

async function callGemini(apiKey,prompt){
  const models=[...new Set([
    process.env.GEMINI_PRIMARY_MODEL||'gemini-2.5-flash',
    process.env.GEMINI_FALLBACK_MODEL||'gemini-2.5-flash',
    'gemini-2.5-flash'
  ].filter(Boolean).filter(model=>!String(model).includes('lite')))];

  let lastError;

  for(const model of models){
    try{
      const response=await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
        {
          method:'POST',
          headers:{'Content-Type':'application/json'},
          body:JSON.stringify({
            contents:[{role:'user',parts:[{text:prompt}]}],
            generationConfig:{
              temperature:0.12,
              topP:0.8,
              maxOutputTokens:7000,
              responseMimeType:'application/json'
            }
          })
        }
      );

      const data=await response.json().catch(()=>({}));
      const text=data?.candidates?.[0]?.content?.parts?.map(part=>part.text||'').join('\n').trim();

      if(response.ok&&text)return{text,model};
      lastError={status:response.status,model,data};
    }catch(error){
      lastError={model,error:error.message};
    }
  }

  const error=new Error('AI 기록 품질검사 호출 실패');
  error.detail=lastError;
  throw error;
}

export const handler=async(event)=>{
  if(event.httpMethod==='OPTIONS')return jsonResponse({},200);
  if(event.httpMethod!=='POST')return jsonResponse({error:'POST only'},405);

  try{
    const body=JSON.parse(event.body||'{}');
    const sessions=Array.isArray(body.sessions)?body.sessions:[];

    if(!sessions.length){
      return jsonResponse({error:'검토 완료된 회기기록이 없습니다.'},400);
    }

    const apiKey=
      process.env.GEMINI_API_KEY||
      process.env.GOOGLE_API_KEY||
      process.env.GOOGLE_GEMINI_API_KEY;

    if(!apiKey){
      return jsonResponse({error:'GEMINI_API_KEY가 설정되지 않았습니다.'},500);
    }

    const result=await callGemini(apiKey,buildPrompt(body));

    let parsed;
    try{
      parsed=JSON.parse(
        result.text
          .replace(/^```json\s*/i,'')
          .replace(/^```\s*/,'')
          .replace(/```$/,'')
          .trim()
      );
    }catch{
      return jsonResponse({error:'AI 품질검사 결과 형식을 읽지 못했습니다. 다시 실행해 주세요.'},502);
    }

    const scoreFields=[
      'totalScore','completenessScore','goalClarityScore','processSpecificityScore',
      'interventionScore','outcomeScore','riskScore','factInferenceScore','continuityScore'
    ];

    const textFields=[
      'overallFeedback','completenessFeedback','goalClarityFeedback',
      'processSpecificityFeedback','interventionFeedback','outcomeFeedback',
      'riskFeedback','factInferenceFeedback','continuityFeedback',
      'recordStrengths','priorityImprovements'
    ];

    const quality={};

    for(const field of scoreFields){
      quality[field]=clampScore(parsed[field]);
    }

    for(const field of textFields){
      quality[field]=clean(parsed[field],12000);
    }

    const dimensionAverage=Math.round(
      (
        quality.completenessScore+
        quality.goalClarityScore+
        quality.processSpecificityScore+
        quality.interventionScore+
        quality.outcomeScore+
        quality.riskScore+
        quality.factInferenceScore+
        quality.continuityScore
      )/8
    );

    quality.totalScore=dimensionAverage;

    return jsonResponse({
      quality,
      model:result.model,
      promptVersion:'counseling-record-quality-v1'
    });
  }catch(error){
    console.error('[COUNSELING RECORD QUALITY]',error.detail||error);
    return jsonResponse({error:'상담기록 품질검사 중 오류가 발생했습니다.'},500);
  }
};
