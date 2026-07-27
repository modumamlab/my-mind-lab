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

function buildPrompt(body){
  const sessions=(Array.isArray(body.sessions)?body.sessions:[]).map((s,index)=>`
[${index+1}. ${clean(s.sessionNumber||index+1,20)}회기 · ${clean(s.date,30)}]
의뢰사유: ${clean(s.reason,1200)}
상담목표: ${clean(s.goal,1200)}
상담내용: ${clean(s.content,5000)}
상담결과: ${clean(s.result,2200)}
다음회기: ${clean(s.next,1800)}
`).join('\n');

  return `당신은 임상심리사와 상담자의 사례 성찰을 지원하는 임상 슈퍼비전 보조 AI입니다.
아래 자료를 바탕으로 상담자의 개입과 기록을 검토하세요.

[기본정보]
내담자: ${clean(body.clientName,100)}
프로그램: ${clean(body.program,200)}
상담방식: ${clean(body.counselingMethod,100)}
현재상태: ${clean(body.currentStatus,80)}

[사례개념화]
${clean(JSON.stringify(body.formulation||{}),14000)||'없음'}

[상담계획]
${clean(JSON.stringify(body.counselingPlan||{}),14000)||'없음'}

[상담자 검토 완료 회기기록]
${sessions||'없음'}

[기존 슈퍼비전]
${clean(JSON.stringify(body.existingSupervision||{}),8000)||'없음'}

[작성 원칙]
- 상담자의 전문성을 존중하는 협력적 문체로 작성합니다.
- 내담자를 진단하거나 상담자를 평가·비난하지 않습니다.
- 축어록이 아니라 요약 회기기록을 바탕으로 하므로 단정하지 않습니다.
- 잘된 점을 구체적인 개입과 내담자 반응에 연결합니다.
- 놓친 부분은 "확인할 수 있음", "추가 탐색이 도움될 수 있음"처럼 조건부로 씁니다.
- 상담자의 감정이나 역전이는 사실로 단정하지 말고 성찰 질문으로 제시합니다.
- 자살·자해·타해·학대·폭력·심각한 기능저하가 언급된 경우 안전 확인과 기록을 우선 검토합니다.
- 위험 언급이 없더라도 직접 위험평가가 실시되었는지는 별도로 확인하도록 제안합니다.
- 상담기록의 사실·해석·가설이 구분되었는지 점검합니다.
- 다음 회기 제안은 우선순위를 1~3개로 제한하고 실제 사용할 수 있는 질문과 개입 순서를 포함합니다.
- 자료에서 확인되지 않은 발언, 개입, 변화, 위험을 만들어내지 않습니다.
- 모든 값은 문자열이어야 하며 배열이나 객체를 사용하지 않습니다.

JSON만 반환하세요.
{
  "strengths":"잘된 점과 상담자의 강점. 근거가 된 회기와 개입을 함께 설명",
  "missedPoints":"충분히 탐색되지 않았을 수 있는 정서·의미·맥락·위험·보호요인",
  "interventionReview":"개입의 시점·강도·목표 적합성·내담자 반응과 가능한 대안 개입",
  "allianceReview":"상담동맹, 안전감, 저항 또는 거리감, 상담 속도와 관계 패턴에 대한 검토",
  "riskEthics":"위험평가, 안전계획, 비밀보장, 경계, 기록과 연계에서 확인할 윤리적 사항",
  "countertransference":"상담자가 점검해 볼 정서적 반응과 역전이 가능성을 조건부 성찰 질문으로 작성",
  "nextSessionSuggestions":"다음 회기 우선 초점 1~3개, 실제 질문, 개입 순서와 관찰 지표",
  "supervisorQuestions":"상담자가 스스로 답해 볼 슈퍼비전 질문 5~8개",
  "documentationFeedback":"회기기록의 강점, 누락, 중복, 사실·해석 구분, 위험기록과 표현 개선",
  "priorityActions":"다음 회기 전에 준비하거나 확인할 우선 실행사항 1~5개"
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
              temperature:0.18,
              topP:0.85,
              maxOutputTokens:8000,
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

  const error=new Error('AI 슈퍼비전 호출 실패');
  error.detail=lastError;
  throw error;
}

export const handler=async(event)=>{
  if(event.httpMethod==='OPTIONS')return jsonResponse({},200);
  if(event.httpMethod!=='POST')return jsonResponse({error:'POST only'},405);

  try{
    const body=JSON.parse(event.body||'{}');
    const sessions=Array.isArray(body.sessions)?body.sessions:[];

    if(!clean(body.clientName))return jsonResponse({error:'내담자 정보가 없습니다.'},400);
    if(!sessions.length)return jsonResponse({error:'검토 완료된 회기기록이 없습니다.'},400);

    const apiKey=
      process.env.GEMINI_API_KEY||
      process.env.GOOGLE_API_KEY||
      process.env.GOOGLE_GEMINI_API_KEY;

    if(!apiKey)return jsonResponse({error:'GEMINI_API_KEY가 설정되지 않았습니다.'},500);

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
      return jsonResponse({error:'AI 슈퍼비전 결과 형식을 읽지 못했습니다. 다시 생성해 주세요.'},502);
    }

    const fields=[
      'strengths','missedPoints','interventionReview','allianceReview',
      'riskEthics','countertransference','nextSessionSuggestions',
      'supervisorQuestions','documentationFeedback','priorityActions'
    ];

    const supervision=Object.fromEntries(
      fields.map(field=>[field,clean(parsed[field],16000)])
    );

    return jsonResponse({
      supervision,
      model:result.model,
      promptVersion:'counseling-supervision-v1-clinical-reflection'
    });
  }catch(error){
    console.error('[COUNSELING SUPERVISION]',error.detail||error);
    return jsonResponse({error:'AI 슈퍼비전 생성 중 오류가 발생했습니다.'},500);
  }
};
