console.info('[MML] AI-SUPERVISOR-ENGINE-STEP21 loaded');

(function(global){
  'use strict';

  const VERSION='20260725-ai-supervisor-step21';
  const STORE_KEY='modumam_ai_supervisor_reviews';
  const text=v=>String(v??'').trim();
  const arr=v=>Array.isArray(v)?v:[];
  const uniq=v=>[...new Set(arr(v).map(text).filter(Boolean))];
  const now=()=>new Date().toISOString();

  function read(){
    try{
      const value=global.MMLDataStore?.read
        ?global.MMLDataStore.read(STORE_KEY,[],{fresh:true})
        :JSON.parse(localStorage.getItem(STORE_KEY)||'[]');
      return Array.isArray(value)?value:[];
    }catch(_){return []}
  }

  function write(rows){
    if(global.MMLDataStore?.write){
      global.MMLDataStore.write(STORE_KEY,rows,{
        action:'AI 슈퍼바이저 저장',
        detail:`${rows.length}건`,
        source:'ai-supervisor-engine',
        server:false
      });
    }else{
      localStorage.setItem(STORE_KEY,JSON.stringify(rows));
    }
    return rows;
  }

  function save(item){
    const rows=read();
    const next={...item,id:text(item.id)||`supervision:${Date.now()}`,updatedAt:now()};
    const index=rows.findIndex(row=>text(row.id)===next.id);
    if(index>=0)rows[index]=next; else rows.unshift(next);
    write(rows);
    return next;
  }

  function bundle(reservationId){
    if(!global.MMLIntegratedWorkflowHub?.caseBundle){
      throw new Error('통합 워크플로 허브가 준비되지 않았습니다.');
    }
    return global.MMLIntegratedWorkflowHub.caseBundle(reservationId);
  }

  function records(reservationId){
    return arr(bundle(reservationId).electronicChart.counselingRecords)
      .slice()
      .sort((a,b)=>String(a.sessionDate||a.createdAt).localeCompare(String(b.sessionDate||b.createdAt)));
  }

  function formulations(reservationId){
    return arr(bundle(reservationId).electronicChart.formulations);
  }

  function reports(reservationId){
    return arr(bundle(reservationId).assessmentCenter.reports);
  }

  function collectRisks(rows){
    return uniq(rows.flatMap(row=>arr(row.riskFlags).map(flag=>flag.type||flag.label||flag)));
  }

  function collectThemes(rows){
    return uniq(rows.flatMap(row=>arr(row.themes)));
  }

  function collectStrengths(reservationId){
    const forms=formulations(reservationId);
    return uniq(forms.flatMap(row=>[
      ...arr(row.strengths),
      ...arr(row.protectiveFactors),
      ...arr(row.resources)
    ]));
  }

  function latestSummary(rows){
    const last=rows[rows.length-1];
    return text(last?.summary)||'이전 상담기록이 없습니다.';
  }

  function preSessionBrief(reservationId){
    const b=bundle(reservationId);
    const rows=records(reservationId);
    const themes=collectThemes(rows);
    const risks=collectRisks(rows);
    const strengths=collectStrengths(reservationId);
    const latest=rows[rows.length-1]||null;
    const follow=global.MMLCaseManagementEngine?.buildFollowUp?.(reservationId);

    return {
      type:'pre_session',
      reservationId:text(reservationId),
      generatedAt:now(),
      clientName:text(b.reservation?.clientName||b.reservation?.name||b.reservation?.userName),
      caseCore:latestSummary(rows),
      currentChanges:text(latest?.progress?.comparison)||'회기 간 변화는 상담자가 직접 확인해야 합니다.',
      riskFactors:risks,
      protectiveFactors:strengths,
      mustCheck:uniq([
        ...arr(follow?.changesToCheck),
        ...(risks.length?['현재 안전 상태와 즉시성','보호자·지지체계 연결 여부']:[])
      ]).slice(0,8),
      suggestedQuestions:arr(follow?.suggestedQuestions).slice(0,6),
      recommendedApproaches:uniq([
        themes.includes('불안')?'불안 유발 상황과 회피 패턴을 구체적으로 탐색':'',
        themes.includes('우울·무기력')?'행동활성화 가능성과 일상 기능을 확인':'',
        themes.includes('관계갈등')?'상호작용 순환과 의사소통 패턴을 탐색':'',
        themes.includes('자기비판')?'자기비판 언어를 알아차리고 대안적 자기대화를 연습':'',
        '내담자의 선택권과 속도를 존중하는 협력적 질문'
      ]).filter(Boolean)
    };
  }

  function splitMessages(session){
    const messages=arr(session?.messages||session?.transcript||session?.conversation);
    return messages.map(item=>({
      role:text(item.role||item.sender||item.author).toLowerCase(),
      content:text(item.content||item.text||item.message)
    })).filter(item=>item.content);
  }

  function qualityReviewFromMessages(messages){
    const counselor=messages.filter(m=>/assistant|counselor|상담|ai/.test(m.role));
    const client=messages.filter(m=>/user|client|내담/.test(m.role));
    const counselorText=counselor.map(m=>m.content).join(' ');
    const allText=messages.map(m=>m.content).join(' ');
    const questions=counselor.flatMap(m=>m.content.match(/[^?？！]*[?？！]/g)||[]);
    const openQuestions=questions.filter(q=>/(어떻게|무엇|어떤|언제부터|말해|들려|살펴|떠오르)/.test(q));
    const empathy=(counselorText.match(/그랬군요|힘들었|답답했|속상했|불안했|느껴져|이해돼|마음이|견뎌/g)||[]).length;
    const summaries=(counselorText.match(/정리하면|말씀을 들어보면|지금까지|요약하면|그러니까/g)||[]).length;
    const advice=(counselorText.match(/해야|해보세요|하는 게 좋|필요합니다|권합니다/g)||[]).length;
    const totalChars=Math.max(1,allText.length);
    const clientChars=client.reduce((sum,m)=>sum+m.content.length,0);

    return {
      openQuestionRatio:questions.length?Math.round(openQuestions.length/questions.length*100):0,
      empathyCount:empathy,
      summaryCount:summaries,
      adviceCount:advice,
      clientSpeechRatio:Math.round(clientChars/totalChars*100),
      messageCount:messages.length,
      interpretation:[
        questions.length===0?'상담자 질문이 기록되지 않았습니다.':
          openQuestions.length/questions.length<0.5?'열린 질문 비율을 조금 높여볼 수 있습니다.':'열린 질문이 비교적 충분합니다.',
        empathy===0?'정서 반영 문장을 추가로 확인해 보세요.':'정서 반영 표현이 확인됩니다.',
        advice>empathy+summaries?'해결책 제안이 공감·요약보다 앞서지 않았는지 검토해 보세요.':'공감·탐색 흐름이 비교적 유지되었습니다.',
        clientChars/totalChars<0.45?'내담자 발화 공간이 충분했는지 살펴보세요.':'내담자 발화 비율이 비교적 확보되었습니다.'
      ]
    };
  }

  function sessionById(sessionId){
    const rows=global.MMLAICounselingEngine?.readSessions?.()||[];
    return rows.find(row=>text(row.id)===text(sessionId))||null;
  }

  function afterSessionFeedback(sessionId){
    const session=sessionById(sessionId);
    if(!session)throw new Error('AI 상담 세션을 찾지 못했습니다.');
    const messages=splitMessages(session);
    const quality=qualityReviewFromMessages(messages);
    const reservationId=text(session.reservationId||session.bookingId);
    const caseRows=reservationId?records(reservationId):[];
    const risks=collectRisks(caseRows);

    return save({
      type:'post_session',
      sessionId:text(sessionId),
      reservationId,
      generatedAt:now(),
      strengths:uniq([
        quality.empathyCount>0?'정서 반영 표현을 사용했습니다.':'',
        quality.openQuestionRatio>=50?'열린 질문을 비교적 충분히 사용했습니다.':'',
        quality.clientSpeechRatio>=45?'내담자의 발화 공간을 확보했습니다.':''
      ]).filter(Boolean),
      exploreFurther:uniq([
        quality.openQuestionRatio<50?'닫힌 질문을 열린 질문으로 전환할 수 있는 지점':'',
        quality.summaryCount===0?'회기 중간 또는 말미의 요약':'',
        quality.adviceCount>quality.empathyCount?'조언 이전의 감정·욕구 탐색':'',
        ...risks.map(risk=>`${risk}의 현재 수준과 즉시성`)
      ]).filter(Boolean),
      nextSessionRecommendations:[
        '지난 회기 이후 변화와 과제 실행 경험을 먼저 확인합니다.',
        '내담자가 오늘 다루고 싶은 우선순위를 직접 선택하도록 돕습니다.',
        '회기 말에는 핵심 내용과 다음 행동을 함께 요약합니다.'
      ],
      missedRiskSignals:risks,
      quality
    });
  }

  function wholeCaseReview(reservationId){
    const rows=records(reservationId);
    const metrics=global.MMLCaseManagementEngine?.getMetrics?.(reservationId)||[];
    const themes=collectThemes(rows);
    const risks=collectRisks(rows);
    const segments=rows.map((row,index)=>({
      phase:index===0?'초기':index===rows.length-1?'현재':`${index+1}회기`,
      summary:text(row.summary),
      themes:arr(row.themes)
    }));

    const repeated=themes.filter(theme=>
      rows.filter(row=>arr(row.themes).includes(theme)).length>=2
    );

    return save({
      type:'whole_case',
      reservationId:text(reservationId),
      generatedAt:now(),
      sessionCount:rows.length,
      trajectory:segments,
      improved:uniq(rows.flatMap(row=>arr(row.progress?.improved))),
      repeatedPatterns:repeated,
      remainingDifficulties:uniq([
        ...arr(rows[rows.length-1]?.progress?.unchanged),
        ...arr(rows[rows.length-1]?.progress?.worsened),
        ...themes.slice(0,5)
      ]),
      riskReview:risks,
      metrics,
      strategySuggestions:[
        repeated.length?'반복되는 핵심 패턴을 한 문장으로 공동 정의하고 회기 목표와 연결합니다.':'',
        metrics.length>=2?'회복지표의 변화와 실제 생활 변화를 함께 비교합니다.':'',
        risks.length?'위험요인은 매 회기 현재 수준과 보호요인을 직접 재확인합니다.':'',
        '상담 목표가 여전히 내담자의 현재 우선순위와 일치하는지 재협의합니다.'
      ].filter(Boolean)
    });
  }

  function liveCopilot(note,reservationId){
    const source=text(note);
    const suggestions=[];
    if(!source)return {suggestions:['상담 메모를 입력하면 탐색 질문과 정서 반영 문장을 제안합니다.']};
    if(/힘들|불안|무섭|답답|속상|지침|피곤/.test(source)){
      suggestions.push('정서 반영: “그 상황에서 마음이 많이 지치고 긴장되었을 것 같아요.”');
    }
    if(/항상|맨날|절대|모두/.test(source)){
      suggestions.push('추가 질문: “그렇게 느끼지 않았던 예외적인 순간도 있었나요?”');
    }
    if(/해야|해결|방법/.test(source)){
      suggestions.push('점검: 해결책을 제안하기 전에 내담자가 바라는 변화와 준비 정도를 확인해 보세요.');
    }
    if(/죽|자해|사라지고|폭력|때리고/.test(source)){
      suggestions.push('안전 확인: 현재 생각의 강도, 계획·수단·즉시성, 보호요인을 상담자가 직접 확인하세요.');
    }
    suggestions.push('열린 질문: “지금 이야기에서 가장 중요하게 느껴지는 부분은 무엇인가요?”');
    return {reservationId:text(reservationId),note:source,suggestions:uniq(suggestions)};
  }

  function getByReservation(reservationId){
    return read().filter(row=>text(row.reservationId)===text(reservationId));
  }

  function diagnostics(){
    return {
      ok:true,
      version:VERSION,
      reviewCount:read().length,
      workflowReady:Boolean(global.MMLIntegratedWorkflowHub),
      caseManagementReady:Boolean(global.MMLCaseManagementEngine),
      counselingReady:Boolean(global.MMLAICounselingEngine),
      counselorSupportOnly:true
    };
  }

  global.MMLAISupervisorEngine=Object.freeze({
    version:VERSION,
    read,
    preSessionBrief,
    liveCopilot,
    afterSessionFeedback,
    wholeCaseReview,
    qualityReviewFromMessages,
    getByReservation,
    diagnostics
  });
})(window);
