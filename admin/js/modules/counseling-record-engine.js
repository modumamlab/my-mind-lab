console.info('[MML] COUNSELING-RECORD-ENGINE-STEP18 loaded');

(function(global){
  'use strict';

  const VERSION='20260725-counseling-record-step18';
  const STORE_KEY='modumam_counseling_records';

  const text=value=>String(value??'').trim();
  const array=value=>Array.isArray(value)?value:[];
  const uniq=values=>[...new Set(array(values).map(text).filter(Boolean))];

  function safeParse(raw,fallback=[]){
    try{return raw?JSON.parse(raw):fallback}catch(_){return fallback}
  }

  function readAll(){
    try{
      if(global.MMLDataStore?.read){
        const value=global.MMLDataStore.read(STORE_KEY,[],{fresh:true});
        if(Array.isArray(value))return value;
      }
    }catch(error){
      console.warn('[MML] counseling record datastore read fallback',error);
    }
    return array(safeParse(localStorage.getItem(STORE_KEY),[]));
  }

  function saveAll(rows){
    const next=array(rows);
    try{
      if(global.MMLDataStore?.write){
        global.MMLDataStore.write(STORE_KEY,next,{
          action:'상담기록 저장',
          detail:`${next.length}건`,
          source:'counseling-record-engine',
          server:false
        });
        return next;
      }
    }catch(error){
      console.warn('[MML] counseling record datastore write fallback',error);
    }
    localStorage.setItem(STORE_KEY,JSON.stringify(next));
    return next;
  }

  function upsert(record){
    const rows=readAll();
    const index=rows.findIndex(item=>text(item.id)===text(record.id));
    const next={
      ...(index>=0?rows[index]:{}),
      ...record,
      updatedAt:new Date().toISOString()
    };
    if(index>=0)rows[index]=next;
    else rows.unshift(next);
    saveAll(rows);
    return next;
  }

  function splitSentences(value=''){
    return text(value)
      .split(/(?<=[.!?다요])\s+|\n+/)
      .map(text)
      .filter(Boolean);
  }

  function userMessages(session){
    return array(session?.messages)
      .filter(item=>text(item.role)==='user')
      .map(item=>text(item.content))
      .filter(Boolean);
  }

  function assistantMessages(session){
    return array(session?.messages)
      .filter(item=>text(item.role)==='assistant')
      .map(item=>text(item.content))
      .filter(Boolean);
  }

  function summarizeSession(session){
    const users=userMessages(session);
    const assistants=assistantMessages(session);
    const recentUsers=users.slice(-6);
    const recentAssistants=assistants.slice(-4);

    return {
      presentingConcerns:recentUsers.slice(0,3),
      clientStatements:recentUsers,
      interventions:recentAssistants,
      sessionSummary:text(session?.summary)||
        recentUsers.join(' ').slice(0,900),
      messageCount:array(session?.messages).length
    };
  }

  function extractThemes(session){
    const source=userMessages(session).join(' ');
    const themeMap=[
      ['불안',['불안','긴장','걱정','초조','두렵']],
      ['우울·무기력',['우울','무기력','의욕','아무것도 하기 싫','지침']],
      ['관계갈등',['관계','갈등','상사','부모','배우자','친구']],
      ['회피',['피하고','미루','도망','회피']],
      ['자기비판',['내 탓','못난','자책','죄책감','자기비판']],
      ['수면',['잠','수면','불면','새벽']],
      ['스트레스',['스트레스','압박','부담','소진']]
    ];

    return themeMap
      .filter(([,terms])=>terms.some(term=>source.includes(term)))
      .map(([label])=>label);
  }

  function detectRiskFlags(session){
    const source=userMessages(session).join(' ').toLowerCase();
    const definitions=[
      ['자살위험',['죽고 싶','자살','살고 싶지 않','사라지고 싶']],
      ['자해위험',['자해','베고 싶','상처 내고 싶']],
      ['타해위험',['죽이고 싶','해치고 싶','때리고 싶']],
      ['학대·폭력',['학대','폭행','맞았','맞고 있']],
      ['중독위험',['술을 끊','도박','약물','마약']]
    ];

    return definitions.map(([type,terms])=>{
      const matched=terms.filter(term=>source.includes(term));
      return matched.length?{
        type,
        detected:true,
        matched,
        instruction:'AI 판단이 아니라 상담자가 직접 위험도와 즉시성을 확인해야 합니다.'
      }:null;
    }).filter(Boolean);
  }

  function buildSOAP(session,context={}){
    const summary=summarizeSession(session);
    const themes=extractThemes(session);
    const risks=detectRiskFlags(session);

    return {
      S:[
        ...summary.clientStatements.slice(-4),
        text(context.subjectiveNote)
      ].filter(Boolean).join('\n'),
      O:[
        `대화 메시지 ${summary.messageCount}개가 기록되었습니다.`,
        themes.length?`주요 주제: ${themes.join(', ')}`:'',
        risks.length?`직접 확인이 필요한 위험 신호: ${risks.map(item=>item.type).join(', ')}`:'',
        text(context.objectiveNote)
      ].filter(Boolean).join('\n'),
      A:[
        themes.length
          ? `${themes.join(', ')}와 관련된 어려움이 현재 상담의 주요 초점으로 보입니다.`
          : '현재 어려움의 핵심 주제는 추가 면담을 통해 구체화할 필요가 있습니다.',
        '이 평가는 AI가 작성한 초안이며, 상담자의 면담·관찰과 임상적 판단으로 수정해야 합니다.',
        text(context.assessmentNote)
      ].filter(Boolean).join('\n'),
      P:[
        '다음 회기에서 최근 어려움이 가장 강해지는 상황과 대처방식을 구체적으로 확인합니다.',
        risks.length?'위험 신호에 대해 구체적 계획·수단·의도·보호요인을 직접 평가합니다.':'',
        text(context.planNote)
      ].filter(Boolean).join('\n')
    };
  }

  function buildDAP(session,context={}){
    const summary=summarizeSession(session);
    const themes=extractThemes(session);
    const risks=detectRiskFlags(session);

    return {
      D:[
        summary.sessionSummary,
        text(context.dataNote)
      ].filter(Boolean).join('\n'),
      A:[
        themes.length
          ? `이번 회기에서는 ${themes.join(', ')}가 핵심 주제로 나타났습니다.`
          : '내담자의 현재 경험과 기능 수준을 추가로 확인할 필요가 있습니다.',
        risks.length?'위험 관련 표현이 있어 직접 확인이 필요합니다.':'',
        text(context.assessmentNote)
      ].filter(Boolean).join('\n'),
      P:[
        '내담자가 가장 부담을 느끼는 상황과 그때의 생각·감정·행동을 연결해 탐색합니다.',
        '실행 가능한 작은 대처행동을 함께 정합니다.',
        text(context.planNote)
      ].filter(Boolean).join('\n')
    };
  }

  function buildBIRP(session,context={}){
    const summary=summarizeSession(session);
    const themes=extractThemes(session);

    return {
      B:[
        summary.clientStatements.slice(-4).join('\n'),
        text(context.behaviorNote)
      ].filter(Boolean).join('\n'),
      I:[
        '감정을 반영하고 핵심 내용을 요약했습니다.',
        '열린질문을 통해 상황·생각·감정·행동의 연결을 탐색했습니다.',
        text(context.interventionNote)
      ].filter(Boolean).join('\n'),
      R:[
        themes.length
          ? `내담자는 ${themes.join(', ')}와 관련된 경험을 표현했습니다.`
          : '내담자는 현재 어려움에 대한 경험을 표현했습니다.',
        text(context.responseNote)
      ].filter(Boolean).join('\n'),
      P:[
        '다음 회기에서 변화 여부와 과제 실행 경험을 확인합니다.',
        text(context.planNote)
      ].filter(Boolean).join('\n')
    };
  }

  function buildHomework(session,context={}){
    const themes=extractThemes(session);
    const tasks=[];

    if(themes.includes('불안'))tasks.push('불안이 높아진 상황에서 생각·감정·신체반응을 간단히 기록합니다.');
    if(themes.includes('우울·무기력'))tasks.push('하루에 한 번, 부담이 가장 적은 활동을 10분간 실행하고 전후 기분을 기록합니다.');
    if(themes.includes('회피'))tasks.push('미루고 있는 일 중 가장 작은 한 단계를 정해 실행 여부를 표시합니다.');
    if(themes.includes('자기비판'))tasks.push('자기비판이 떠오를 때 사실과 해석을 구분해 적어봅니다.');
    if(themes.includes('수면'))tasks.push('취침·기상시간과 잠들기 전 활동을 기록합니다.');
    if(!tasks.length)tasks.push('감정이 크게 변한 순간을 한 번 기록하고 그때 필요했던 도움을 적어봅니다.');

    return uniq([
      ...tasks,
      ...array(context.homework)
    ]).slice(0,3);
  }

  function previousRecords(reservationId,currentId=''){
    return readAll()
      .filter(item=>
        text(item.reservationId)===text(reservationId)&&
        text(item.id)!==text(currentId)
      )
      .sort((a,b)=>String(a.sessionDate||a.createdAt).localeCompare(String(b.sessionDate||b.createdAt)));
  }

  function buildProgress(reservationId,current){
    const previous=previousRecords(reservationId,current.id);
    const last=previous[previous.length-1];
    if(!last){
      return {
        comparison:'첫 기록',
        improved:[],
        unchanged:[],
        worsened:[],
        newIssues:array(current.themes)
      };
    }

    const prevThemes=array(last.themes);
    const currentThemes=array(current.themes);

    return {
      comparison:`이전 ${previous.length}회기와 비교`,
      improved:prevThemes.filter(theme=>!currentThemes.includes(theme)),
      unchanged:currentThemes.filter(theme=>prevThemes.includes(theme)),
      worsened:[],
      newIssues:currentThemes.filter(theme=>!prevThemes.includes(theme))
    };
  }

  function buildNextSessionBrief(record){
    const themes=array(record.themes);
    const riskFlags=array(record.riskFlags);

    return {
      previousSummary:text(record.summary),
      focus:themes.length
        ? `${themes.slice(0,3).join(', ')}의 현재 변화와 생활 영향을 확인합니다.`
        : '지난 회기 이후 가장 큰 변화와 현재의 우선 어려움을 확인합니다.',
      cautions:[
        riskFlags.length?'위험 신호의 현재 상태와 즉시성을 직접 확인합니다.':'',
        'AI 기록과 내담자의 실제 경험이 다르면 내담자의 설명을 우선합니다.',
        '질문을 이어가기 전에 정서적 안전감과 상담관계를 확인합니다.'
      ].filter(Boolean),
      suggestedQuestions:[
        '지난 회기 이후 가장 달라진 점은 무엇이었나요?',
        '어려움이 가장 강했던 순간에는 어떤 생각과 반응이 있었나요?',
        '이번 회기에서 가장 도움받고 싶은 한 가지는 무엇인가요?'
      ],
      homeworkReview:array(record.homework)
    };
  }

  function createFromSession({
    session,
    reservation={},
    format='SOAP',
    context={}
  }={}){
    if(!session)throw new Error('AI 상담 세션이 필요합니다.');

    const now=new Date().toISOString();
    const reservationId=text(
      reservation.id||
      session.reservationId
    );
    const themes=extractThemes(session);
    const riskFlags=detectRiskFlags(session);
    const selectedFormat=text(format).toUpperCase();

    let structured;
    if(selectedFormat==='DAP')structured=buildDAP(session,context);
    else if(selectedFormat==='BIRP')structured=buildBIRP(session,context);
    else structured=buildSOAP(session,context);

    const summary=summarizeSession(session);
    const record={
      id:`counseling-record:${text(session.id)||Date.now()}`,
      reservationId,
      sessionId:text(session.id),
      clientId:text(
        reservation.clientId||
        reservation.userId||
        session.clientId
      ),
      sessionNumber:Number(context.sessionNumber||previousRecords(reservationId).length+1),
      sessionDate:text(context.sessionDate)||now.slice(0,10),
      counselingMethod:text(context.counselingMethod)||'AI 상담(비대면)',
      format:selectedFormat,
      structured,
      summary:summary.sessionSummary,
      themes,
      riskFlags,
      homework:buildHomework(session,context),
      goals:array(context.goals),
      status:'상담사 검토 필요',
      approved:false,
      counselorOnly:true,
      createdAt:now,
      updatedAt:now
    };

    record.progress=buildProgress(reservationId,record);
    record.nextSessionBrief=buildNextSessionBrief(record);

    return upsert(record);
  }

  function approve(id,{reviewer='상담자',edits={}}={}){
    const item=readAll().find(record=>text(record.id)===text(id));
    if(!item)throw new Error('상담기록을 찾지 못했습니다.');

    return upsert({
      ...item,
      ...edits,
      approved:true,
      status:'상담사 검토 완료',
      reviewedBy:text(reviewer),
      reviewedAt:new Date().toISOString()
    });
  }

  function revoke(id){
    const item=readAll().find(record=>text(record.id)===text(id));
    if(!item)throw new Error('상담기록을 찾지 못했습니다.');

    return upsert({
      ...item,
      approved:false,
      status:'상담사 검토 필요',
      reviewedBy:'',
      reviewedAt:''
    });
  }

  function getByReservation(reservationId){
    return readAll()
      .filter(item=>text(item.reservationId)===text(reservationId))
      .sort((a,b)=>String(a.sessionDate||a.createdAt).localeCompare(String(b.sessionDate||b.createdAt)));
  }

  function createFromSessionId(sessionId,options={}){
    const session=global.MMLAICounselingEngine?.readSessions?.()
      ?.find(item=>text(item.id)===text(sessionId));
    if(!session)throw new Error('AI 상담 세션을 찾지 못했습니다.');

    let reservation={id:session.reservationId};
    try{
      const bundle=global.MMLIntegratedWorkflowHub?.caseBundle?.(session.reservationId);
      if(bundle?.reservation)reservation=bundle.reservation;
    }catch(_){}

    return createFromSession({
      session,
      reservation,
      ...options
    });
  }

  function diagnostics(){
    return {
      ok:true,
      version:VERSION,
      storeKey:STORE_KEY,
      count:readAll().length,
      formats:['SOAP','DAP','BIRP'],
      aiCounselingReady:Boolean(global.MMLAICounselingEngine),
      workflowHubReady:Boolean(global.MMLIntegratedWorkflowHub),
      counselorOnly:true
    };
  }

  global.MMLCounselingRecordEngine=Object.freeze({
    version:VERSION,
    readAll,
    saveAll,
    upsert,
    summarizeSession,
    extractThemes,
    detectRiskFlags,
    buildSOAP,
    buildDAP,
    buildBIRP,
    buildHomework,
    buildProgress,
    buildNextSessionBrief,
    createFromSession,
    createFromSessionId,
    approve,
    revoke,
    getByReservation,
    diagnostics
  });

  try{
    global.dispatchEvent(new CustomEvent('mml:counseling-record-engine-ready',{
      detail:{version:VERSION}
    }));
  }catch(_){}
})(window);
