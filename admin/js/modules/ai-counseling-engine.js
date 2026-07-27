console.info('[MML] AI-COUNSELING-ENGINE-STEP14 loaded');

(function(global){
  'use strict';

  const VERSION='20260725-ai-counseling-engine-step14';
  const SESSION_KEY='modumam_ai_counseling_sessions';

  const text=value=>String(value??'').trim();
  const array=value=>Array.isArray(value)?value:[];
  const unique=values=>[...new Set(array(values).map(text).filter(Boolean))];

  function safeParse(raw,fallback=[]){
    try{return raw?JSON.parse(raw):fallback}catch(_){return fallback}
  }

  function readSessions(){
    try{
      if(global.MMLDataStore?.read){
        return array(global.MMLDataStore.read(SESSION_KEY,[],{fresh:true}));
      }
    }catch(error){
      console.warn('[MML] ai counseling datastore read fallback',error);
    }
    return array(safeParse(localStorage.getItem(SESSION_KEY),[]));
  }

  function saveSessions(rows){
    const next=array(rows);
    try{
      if(global.MMLDataStore?.write){
        global.MMLDataStore.write(SESSION_KEY,next,{
          action:'AI 상담 기록 저장',
          detail:`${next.length}건`,
          source:'ai-counseling-engine',
          server:false
        });
        return next;
      }
    }catch(error){
      console.warn('[MML] ai counseling datastore write fallback',error);
    }
    localStorage.setItem(SESSION_KEY,JSON.stringify(next));
    return next;
  }

  function upsertSession(session){
    const rows=readSessions();
    const index=rows.findIndex(item=>text(item.id)===text(session.id));
    const next={
      ...(index>=0?rows[index]:{}),
      ...session,
      updatedAt:new Date().toISOString()
    };
    if(index>=0)rows[index]=next;
    else rows.unshift(next);
    saveSessions(rows);
    return next;
  }

  function normalizeMessage(message){
    if(typeof message==='string'){
      return {role:'user',content:text(message),createdAt:new Date().toISOString()};
    }
    return {
      role:text(message?.role)||'user',
      content:text(message?.content||message?.text||message?.message),
      createdAt:message?.createdAt||new Date().toISOString(),
      meta:message?.meta||{}
    };
  }

  function sentenceKey(value=''){
    return text(value)
      .toLowerCase()
      .replace(/[^\p{L}\p{N}]+/gu,'')
      .replace(/(입니다|합니다|됩니다|있습니다|보입니다|느껴집니다|같습니다)$/,'');
  }

  function splitSentences(value=''){
    return text(value)
      .split(/(?<=[.!?다요])\s+|\n+/)
      .map(text)
      .filter(Boolean);
  }

  function removeRepetition(response='',history=[]){
    const recentAssistant=array(history)
      .filter(item=>item.role==='assistant')
      .slice(-6)
      .flatMap(item=>splitSentences(item.content))
      .map(sentenceKey)
      .filter(Boolean);

    const kept=[];
    const keys=[];
    splitSentences(response).forEach(sentence=>{
      const key=sentenceKey(sentence);
      if(!key)return;
      const duplicateCurrent=keys.some(existing=>
        existing===key ||
        (existing.length>16&&key.length>16&&(
          existing.includes(key)||key.includes(existing)
        ))
      );
      const duplicateHistory=recentAssistant.some(existing=>
        existing===key ||
        (existing.length>20&&key.length>20&&(
          existing.includes(key)||key.includes(existing)
        ))
      );

      if(!duplicateCurrent&&!duplicateHistory){
        kept.push(sentence);
        keys.push(key);
      }
    });

    return kept.join(' ');
  }

  function estimateThinkDelay(userText=''){
    const length=text(userText).length;
    if(length<=18)return 1000;
    if(length<=80)return 2000;
    return 5000;
  }

  function detectRisk(userText=''){
    const source=text(userText).toLowerCase();
    const critical=[
      '죽고 싶','자살','목숨을 끊','사라지고 싶','살고 싶지 않',
      '죽어버','자해','베고 싶','약을 먹고','뛰어내리',
      '죽이겠다','해치고 싶','폭발물을','칼로'
    ];
    const moderate=[
      '아무 의미 없','버틸 수 없','끝내고 싶','모든 걸 포기',
      '통제할 수 없','너무 위험'
    ];

    if(critical.some(term=>source.includes(term))){
      return {level:'critical',matched:critical.filter(term=>source.includes(term))};
    }
    if(moderate.some(term=>source.includes(term))){
      return {level:'elevated',matched:moderate.filter(term=>source.includes(term))};
    }
    return {level:'none',matched:[]};
  }

  function buildRiskResponse(risk){
    if(risk.level==='critical'){
      return {
        response:[
          '지금 말씀하신 내용은 혼자 견디기에는 매우 위험할 수 있어요.',
          '지금 당장 자신이나 다른 사람을 해칠 가능성이 있거나 구체적인 계획·수단이 있다면, 이 대화를 멈추고 112 또는 119에 연락하거나 가까운 응급실로 가주세요.',
          '가능하다면 혼자 있지 말고 믿을 수 있는 사람에게 지금 상황을 바로 알려주세요.',
          '지금 당장 실행할 계획이나 준비한 수단이 있나요?'
        ].join(' '),
        requiresHumanEscalation:true,
        endSession:false
      };
    }

    return {
      response:[
        '지금 버티기 어렵다는 신호로 들려요.',
        '안전을 먼저 확인하고 싶습니다.',
        '현재 자신을 해칠 생각이 구체적인 계획이나 준비로 이어진 상태인가요?'
      ].join(' '),
      requiresHumanEscalation:true,
      endSession:false
    };
  }

  function getClinicalContext(reservationId){
    try{
      const rows=global.MMLClinicalReasoningEngine?.getByReservation?.(reservationId);
      const latest=array(rows)[0];
      if(!latest)return null;
      return latest.formulation||null;
    }catch(_){
      return null;
    }
  }

  function inferConversationStage(history=[]){
    const userTurns=array(history).filter(item=>item.role==='user').length;
    if(userTurns<=1)return 'opening';
    if(userTurns<=4)return 'exploration';
    if(userTurns<=8)return 'meaning';
    return 'direction';
  }

  function pickOpenQuestion(stage,context,userText){
    const theme=context?.themes?.[0]?.label;
    const questions={
      opening:[
        '지금 가장 먼저 알아주었으면 하는 마음은 무엇인가요?',
        '오늘 이 이야기를 꺼내게 된 가장 큰 계기는 무엇이었나요?'
      ],
      exploration:[
        '그 마음이 가장 강해지는 순간에는 보통 어떤 일이 함께 일어나나요?',
        '그 상황에서 마음속으로 가장 먼저 떠오르는 생각은 무엇인가요?'
      ],
      meaning:[
        '이 경험이 자신이나 관계에 대해 어떤 의미처럼 느껴지나요?',
        '비슷한 일이 반복될 때 자신에게 어떤 말을 하게 되나요?'
      ],
      direction:[
        '지금 상황이 조금 나아졌다고 느끼려면 가장 먼저 무엇이 달라져야 할까요?',
        '오늘 대화가 끝날 때 가져가고 싶은 작은 방향은 무엇인가요?'
      ]
    };

    if(theme&&stage==='exploration'){
      return `${theme}이 특히 강해지는 상황을 하나 떠올려 보면, 그때 어떤 일이 있었나요?`;
    }

    const list=questions[stage]||questions.exploration;
    const index=text(userText).length%list.length;
    return list[index];
  }

  function buildEmpathicReflection(userText,context){
    const source=text(userText);
    if(!source)return '말로 꺼내기 어려운 마음일 수 있겠어요.';

    const theme=context?.themes?.[0]?.label;
    if(theme){
      return `말씀하신 경험 속에서 ${theme}이 크게 느껴지고, 그만큼 혼자 감당해 온 부담도 있었던 것 같아요.`;
    }

    if(source.length<20){
      return `짧게 말씀하셨지만 그 안에 적지 않은 마음이 담겨 있는 것 같아요.`;
    }

    return '여러 감정과 생각이 한꺼번에 겹쳐서 마음을 정리하기 어려웠을 것 같아요.';
  }

  function summarizeUserText(userText){
    const source=text(userText);
    if(!source)return '';
    const sentences=splitSentences(source);
    if(sentences.length<=2)return source;
    return sentences.slice(0,2).join(' ');
  }

  function buildDirection(context,stage){
    if(stage!=='direction')return '';
    const interventions=array(context?.interventions);
    const first=interventions[0];
    if(first){
      return `지금은 ${first.approach}처럼, 문제를 한꺼번에 해결하기보다 반복되는 반응을 하나씩 알아차리고 작은 변화를 시도하는 접근이 도움이 될 수 있습니다.`;
    }
    return '지금은 모든 답을 정하기보다, 부담을 가장 크게 만드는 한 가지를 골라 조절 가능한 작은 행동으로 나누는 것이 도움이 될 수 있습니다.';
  }

  function buildResponse({userText='',history=[],clinicalContext=null}={}){
    const risk=detectRisk(userText);
    if(risk.level!=='none'){
      const crisis=buildRiskResponse(risk);
      return {
        ...crisis,
        risk,
        stage:'safety',
        thinkDelay:1000
      };
    }

    const stage=inferConversationStage(history);
    const reflection=buildEmpathicReflection(userText,clinicalContext);
    const summary=summarizeUserText(userText);
    const direction=buildDirection(clinicalContext,stage);
    const question=pickOpenQuestion(stage,clinicalContext,userText);

    const parts=[
      reflection,
      summary&&summary!==reflection?`제가 이해한 바로는, ${summary}`:'',
      direction,
      question
    ].filter(Boolean);

    const response=removeRepetition(parts.join(' '),history);

    return {
      response,
      risk,
      stage,
      thinkDelay:estimateThinkDelay(userText),
      requiresHumanEscalation:false,
      endSession:false,
      structure:{
        reflection,
        summary,
        direction,
        openQuestion:question
      }
    };
  }

  function buildPromptBlueprint({session={},userText='',clinicalContext=null}={}){
    const stage=inferConversationStage(session.messages||[]);
    const formulation=clinicalContext||getClinicalContext(session.reservationId);

    return {
      version:VERSION,
      stage,
      rules:[
        '사용자의 말에 먼저 공감하고 핵심을 한 문장으로 요약합니다.',
        '한 번에 열린질문은 하나만 합니다.',
        '같은 공감문장과 같은 질문을 반복하지 않습니다.',
        '질문만 연속해서 던지지 않습니다.',
        '진단을 확정하거나 사용자를 단정하지 않습니다.',
        '심리학 용어는 쉬운 말로 설명합니다.',
        '사용자가 방향을 찾지 못하면 실질적인 선택지나 작은 행동을 제안합니다.',
        '위기 표현이 있으면 상담 흐름보다 안전 확인을 우선합니다.',
        '검사결과는 참고자료로만 사용하며 사용자의 실제 경험과 다르면 수정합니다.'
      ],
      clinicalContext:formulation?{
        themes:array(formulation.themes).slice(0,3),
        maintainingFactors:array(formulation.caseFormulation?.maintainingFactors).slice(0,3),
        protectiveFactors:array(formulation.caseFormulation?.protectiveFactors).slice(0,3),
        interventions:array(formulation.interventions).slice(0,2)
      }:null,
      instruction:[
        '당신은 모두의 마음연구소의 AI 마음지기입니다.',
        '대화의 목적은 사용자가 현재 마음을 알아차리고 이해하고 연결하도록 돕는 것입니다.',
        '',
        ...[
          '먼저 공감',
          '핵심 요약',
          '필요할 때만 짧은 심리학적 설명',
          '열린질문 1개',
          '방향을 잃었을 때 작은 선택지 제시'
        ].map(item=>`- ${item}`),
        '',
        `현재 대화 단계: ${stage}`,
        `사용자 최신 말: ${text(userText)}`
      ].join('\n')
    };
  }

  function createSession({reservationId='',clientId='',title='AI 마음상담'}={}){
    const now=new Date().toISOString();
    return upsertSession({
      id:`ai-counseling:${reservationId||clientId||Date.now()}:${Date.now()}`,
      reservationId:text(reservationId),
      clientId:text(clientId),
      title:text(title)||'AI 마음상담',
      status:'진행중',
      messages:[],
      startedAt:now,
      createdAt:now,
      updatedAt:now,
      counselorReviewRequired:false
    });
  }

  function appendMessage(sessionId,message){
    const session=readSessions().find(item=>text(item.id)===text(sessionId));
    if(!session)throw new Error('AI 상담 세션을 찾지 못했습니다.');
    const normalized=normalizeMessage(message);
    const next=upsertSession({
      ...session,
      messages:[...array(session.messages),normalized],
      counselorReviewRequired:
        session.counselorReviewRequired===true ||
        normalized.meta?.requiresHumanEscalation===true
    });
    return next;
  }

  function reply(sessionId,userMessage){
    const session=appendMessage(sessionId,{
      role:'user',
      content:text(userMessage)
    });
    const clinicalContext=getClinicalContext(session.reservationId);
    const result=buildResponse({
      userText:userMessage,
      history:session.messages,
      clinicalContext
    });

    const next=appendMessage(sessionId,{
      role:'assistant',
      content:result.response,
      meta:{
        stage:result.stage,
        risk:result.risk,
        requiresHumanEscalation:result.requiresHumanEscalation,
        thinkDelay:result.thinkDelay
      }
    });

    return {
      session:next,
      ...result
    };
  }

  function completeSession(sessionId,{summary=''}={}){
    const session=readSessions().find(item=>text(item.id)===text(sessionId));
    if(!session)throw new Error('AI 상담 세션을 찾지 못했습니다.');
    return upsertSession({
      ...session,
      status:'완료',
      completedAt:new Date().toISOString(),
      summary:text(summary)||buildSessionSummary(session)
    });
  }

  function buildSessionSummary(session){
    const userMessages=array(session?.messages)
      .filter(item=>item.role==='user')
      .map(item=>text(item.content))
      .filter(Boolean);
    if(!userMessages.length)return '기록된 사용자 대화가 없습니다.';
    const combined=userMessages.slice(-5).join(' ');
    return combined.length>500?`${combined.slice(0,500)}…`:combined;
  }

  function diagnostics(){
    return {
      ok:true,
      version:VERSION,
      storeKey:SESSION_KEY,
      sessionCount:readSessions().length,
      clinicalReasoning:Boolean(global.MMLClinicalReasoningEngine),
      safetyGuard:true,
      openQuestionLimit:1,
      thinkDelay:[1000,2000,5000]
    };
  }

  global.MMLAICounselingEngine=Object.freeze({
    version:VERSION,
    readSessions,
    saveSessions,
    upsertSession,
    createSession,
    appendMessage,
    reply,
    completeSession,
    buildSessionSummary,
    buildResponse,
    buildPromptBlueprint,
    detectRisk,
    estimateThinkDelay,
    removeRepetition,
    diagnostics
  });

  try{
    global.dispatchEvent(new CustomEvent('mml:ai-counseling-engine-ready',{
      detail:{version:VERSION}
    }));
  }catch(_){}
})(window);
