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

const clean=(value,max=20000)=>String(value??'').trim().slice(0,max);

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

  return `당신은 임상심리사와 상담자가 사용하는 전문가용 종합사례보고서 작성 보조 AI입니다.
아래 자료만 사용하여 상담 전 과정이 연결되는 종합사례보고서 초안을 작성하세요.

[기본정보]
내담자: ${clean(body.clientName,100)}
프로그램: ${clean(body.program,200)}
상담방식: ${clean(body.counselingMethod,100)}
현재상태: ${clean(body.currentStatus,100)}

[접수 및 초기자료]
${clean(JSON.stringify(body.intake||{}),12000)||'없음'}

[심리검사 목록]
${clean(JSON.stringify(body.tests||[]),5000)||'없음'}

[심리평가 보고서]
${clean(JSON.stringify(body.reports||[]),18000)||'없음'}

[사례개념화]
${clean(JSON.stringify(body.formulation||{}),18000)||'없음'}

[상담계획]
${clean(JSON.stringify(body.counselingPlan||{}),18000)||'없음'}

[AI 슈퍼비전 검토자료]
${clean(JSON.stringify(body.supervision||{}),12000)||'없음'}

[상담기록 품질검사]
${clean(JSON.stringify(body.recordQuality||{}),8000)||'없음'}

[상담자 검토 완료 회기기록]
${sessions||'없음'}

[기존 종합사례보고서]
${clean(JSON.stringify(body.existingReport||{}),12000)||'없음'}

[작성 원칙]
- 제공된 자료만 사용하며 확인되지 않은 사실·발언·변화·검사결과를 만들지 않습니다.
- 접수자료, 검사결과, 회기기록, 상담자의 해석을 서로 구분합니다.
- 사례개념화는 진단적 단정이 아니라 근거를 가진 임상적 가설로 작성합니다.
- 상담 진행과정은 회기별 나열보다 초기·중기·현재 단계의 변화 흐름이 보이도록 통합합니다.
- 상담성과는 확인된 변화, 부분적 변화, 아직 확인되지 않은 부분을 구분합니다.
- 위험 관련 기록이 없으면 위험 없음으로 쓰지 말고 직접 평가 여부가 자료에서 확인되지 않는다고 작성합니다.
- AI 슈퍼비전과 품질점수는 사실 자료가 아니라 상담자의 검토를 돕는 참고자료이므로 보고서의 근거로 단정하지 않습니다.
- 현재 진행 중인 사례라면 종결된 것처럼 작성하지 않습니다.
- 내담자를 비난하거나 낙인찍는 표현을 사용하지 않습니다.
- 향후 계획은 현재 사례개념화와 상담 반응에 연결하고 우선순위를 제시합니다.
- 모든 값은 문자열이어야 하며 배열이나 객체를 사용하지 않습니다.

JSON만 반환하세요.
{
  "referralAndContext":"의뢰배경, 주호소, 상담 시작 맥락과 현재 상황",
  "assessmentSummary":"접수자료와 심리평가 결과 중 상담에 중요한 내용. 자료 출처와 한계 구분",
  "caseFormulationSummary":"촉발요인, 유지요인, 핵심 신념·자동적 사고·정서·행동·관계 패턴, 보호요인을 연결한 임상적 가설",
  "counselingGoals":"단기·중기·장기 목표와 관찰 가능한 변화 지표",
  "counselingProcess":"초기·중기·현재 단계별 상담 진행과 내담자 반응의 흐름",
  "interventionSummary":"사용된 주요 개입, 선택 근거, 내담자 반응, 조정된 부분과 임상적 판단",
  "changeAndOutcome":"확인된 변화, 부분적 변화, 미확인 또는 지속되는 어려움과 근거",
  "riskAndSafety":"위험평가 실시 여부, 확인된 위험·보호요인, 안전관리와 추가 확인 필요",
  "strengthsAndResources":"내담자의 강점, 대처 노력, 관계·환경 자원과 회복 가능성",
  "currentClinicalView":"현재 시점의 통합적 임상 이해와 사례개념화의 변화 또는 유지",
  "futurePlan":"다음 회기 우선 초점, 상담계획 조정, 재평가·연계·종결 준비 방향",
  "limitations":"자료의 한계, 서로 일치하지 않는 정보, 추가 면담·평가가 필요한 내용"
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
              temperature:0.16,
              topP:0.85,
              maxOutputTokens:10000,
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

  const error=new Error('AI 종합사례보고서 호출 실패');
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
      return jsonResponse({error:'AI 종합사례보고서 결과 형식을 읽지 못했습니다. 다시 생성해 주세요.'},502);
    }

    const fields=[
      'referralAndContext','assessmentSummary','caseFormulationSummary',
      'counselingGoals','counselingProcess','interventionSummary',
      'changeAndOutcome','riskAndSafety','strengthsAndResources',
      'currentClinicalView','futurePlan','limitations'
    ];

    const report=Object.fromEntries(
      fields.map(field=>[field,clean(parsed[field],18000)])
    );

    return jsonResponse({
      report,
      model:result.model,
      promptVersion:'clinical-case-report-v1-integrated'
    });
  }catch(error){
    console.error('[CLINICAL CASE REPORT]',error.detail||error);
    return jsonResponse({error:'AI 종합사례보고서 생성 중 오류가 발생했습니다.'},500);
  }
};
