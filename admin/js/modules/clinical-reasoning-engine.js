console.info('[MML] CLINICAL-REASONING-ENGINE-STEP13 loaded');

(function(global){
  'use strict';

  const VERSION='20260725-clinical-reasoning-step13';
  const STORE_KEY='modumam_clinical_formulations';

  const text=value=>String(value??'').trim();
  const array=value=>Array.isArray(value)?value:[];
  const unique=values=>[...new Set(array(values).map(text).filter(Boolean))];

  function safeParse(raw,fallback=[]){
    try{return raw?JSON.parse(raw):fallback}catch(_){return fallback}
  }

  function readAll(){
    try{
      if(global.MMLDataStore?.read){
        return array(global.MMLDataStore.read(STORE_KEY,[],{fresh:true}));
      }
    }catch(error){
      console.warn('[MML] clinical reasoning datastore read fallback',error);
    }
    return array(safeParse(localStorage.getItem(STORE_KEY),[]));
  }

  function saveAll(rows){
    const next=array(rows);
    try{
      if(global.MMLDataStore?.write){
        global.MMLDataStore.write(STORE_KEY,next,{
          action:'상담자용 사례개념화 저장',
          detail:`${next.length}건`,
          source:'clinical-reasoning-engine',
          server:false
        });
        return next;
      }
    }catch(error){
      console.warn('[MML] clinical reasoning datastore write fallback',error);
    }
    localStorage.setItem(STORE_KEY,JSON.stringify(next));
    return next;
  }

  function upsert(item){
    const rows=readAll();
    const index=rows.findIndex(row=>text(row.id)===text(item.id));
    const next={
      ...(index>=0?rows[index]:{}),
      ...item,
      updatedAt:new Date().toISOString()
    };
    if(index>=0)rows[index]=next;
    else rows.unshift(next);
    saveAll(rows);
    return next;
  }

  function inferValidity(results=[]){
    const rows=array(results);
    const notes=[];
    let interpretable=true;
    let confidence='보통';

    rows.forEach(result=>{
      const raw=JSON.stringify(result||{}).toLowerCase();

      if(
        raw.includes('무효')||
        raw.includes('invalid')||
        raw.includes('해석불가')||
        raw.includes('응답 일관성 저하')
      ){
        interpretable=false;
        notes.push(`${text(result.testLabel||result.testType)||'검사'}에서 해석 제한 신호가 확인됩니다.`);
      }

      if(
        raw.includes('과장')||
        raw.includes('과대보고')||
        raw.includes('symptom exaggeration')
      ){
        notes.push(`${text(result.testLabel||result.testType)||'검사'}에서 어려움을 크게 보고했을 가능성을 함께 검토해야 합니다.`);
      }

      if(
        raw.includes('축소')||
        raw.includes('방어')||
        raw.includes('과소보고')||
        raw.includes('defensiveness')
      ){
        notes.push(`${text(result.testLabel||result.testType)||'검사'}에서 어려움을 축소하거나 방어적으로 응답했을 가능성을 함께 검토해야 합니다.`);
      }
    });

    if(!interpretable)confidence='낮음';
    else if(notes.length===0)confidence='보통 이상';

    return {
      interpretable,
      confidence,
      notes:unique(notes),
      statement:interpretable
        ? '현재 제공된 자료는 해석 가능한 범위로 보입니다. 다만 실제 면담 내용과 검사 실시 조건을 함께 확인해야 합니다.'
        : '일부 검사에서 해석 제한 가능성이 확인되어 결과를 단독으로 사용하지 않는 것이 필요합니다.'
    };
  }

  function extractThemes(results=[]){
    const themeMap=[
      {id:'anxiety',label:'불안과 긴장',terms:['불안','긴장','걱정','예민','위험회피','신체화']},
      {id:'depression',label:'우울과 무기력',terms:['우울','무기력','의욕저하','피로','흥미저하']},
      {id:'relationships',label:'관계 부담',terms:['대인','관계','갈등','거리두기','거절민감','애착']},
      {id:'avoidance',label:'회피와 위축',terms:['회피','위축','소극','미루기','철수']},
      {id:'selfcriticism',label:'자기비판과 낮은 자기평가',terms:['자기비판','자존감','열등감','죄책감','완벽주의']},
      {id:'emotion',label:'정서조절 어려움',terms:['감정조절','분노','충동','감정기복','정서불안정']},
      {id:'stress',label:'스트레스 부담',terms:['스트레스','압박','부담','소진','번아웃']},
      {id:'control',label:'통제와 경직성',terms:['통제','경직','융통성','강박','완고']},
      {id:'dependency',label:'의존과 인정 욕구',terms:['의존','인정욕구','순응','의견표현 어려움']}
    ];

    const normalized=array(results).map(result=>({
      testType:text(result.testType),
      testLabel:text(result.testLabel||result.testType),
      source:[
        result.summary,
        result.interpretation,
        result.overall,
        result.detail,
        JSON.stringify(result.scales||{})
      ].map(text).join(' ')
    }));

    return themeMap.map(theme=>{
      const matches=normalized.filter(item=>
        theme.terms.some(term=>item.source.includes(term))
      );
      return matches.length?{
        ...theme,
        count:matches.length,
        tests:unique(matches.map(item=>item.testLabel)),
        evidence:matches.map(item=>({
          test:item.testLabel,
          excerpt:item.source.slice(0,240)
        }))
      }:null;
    }).filter(Boolean).sort((a,b)=>b.count-a.count);
  }

  function buildCommonFactors(themes=[]){
    return array(themes)
      .filter(theme=>theme.count>=2)
      .map(theme=>({
        theme:theme.label,
        tests:theme.tests,
        statement:`${theme.tests.join(', ')}에서 ${theme.label}과 관련된 특징이 반복해서 확인됩니다. 이는 현재 어려움을 이해하는 핵심 공통요인으로 검토할 수 있습니다.`
      }));
  }

  function buildDifferences(results=[],themes=[]){
    const rows=array(results);
    if(rows.length<2)return [];

    const differences=[];
    rows.forEach(result=>{
      const label=text(result.testLabel||result.testType);
      const summary=text(result.summary||result.interpretation);
      if(summary){
        differences.push({
          test:label,
          focus:summary.slice(0,280),
          meaning:`${label}은 다른 검사와 측정 초점이 다르므로, 이 결과는 모순이라기보다 마음의 다른 측면을 보여주는 정보로 해석합니다.`
        });
      }
    });
    return differences;
  }

  function buildFormulation({results=[],context={}}={}){
    const validity=inferValidity(results);
    const themes=extractThemes(results);
    const commonFactors=buildCommonFactors(themes);
    const differences=buildDifferences(results,themes);

    const primaryThemes=themes.slice(0,3);
    const protectiveThemes=unique([
      ...(array(context.strengths)),
      ...array(results).flatMap(result=>array(result.strengths))
    ]).slice(0,5);

    const currentDifficulties=primaryThemes.map(theme=>
      `${theme.label}: ${theme.tests.join(', ')}에서 관련 특징이 확인됩니다.`
    );

    const maintainingFactors=[];
    primaryThemes.forEach(theme=>{
      if(theme.id==='anxiety')maintainingFactors.push('불확실한 상황을 위협적으로 예상하고 피하려는 반응이 불안을 유지할 수 있습니다.');
      if(theme.id==='avoidance')maintainingFactors.push('부담되는 상황을 미루거나 피하면 단기적으로는 편해지지만 장기적으로 자신감이 낮아질 수 있습니다.');
      if(theme.id==='selfcriticism')maintainingFactors.push('실수와 부족함을 크게 평가하는 습관이 긴장과 무기력을 강화할 수 있습니다.');
      if(theme.id==='relationships')maintainingFactors.push('상대 반응을 지나치게 살피거나 자신의 요구를 억제하면서 관계 부담이 누적될 수 있습니다.');
      if(theme.id==='emotion')maintainingFactors.push('감정이 높아진 순간에 빠르게 반응하면서 이후 후회와 관계 스트레스가 이어질 수 있습니다.');
      if(theme.id==='stress')maintainingFactors.push('회복 시간 없이 요구가 누적되면 일상의 작은 부담도 크게 느껴질 수 있습니다.');
    });

    const protectiveFactors=protectiveThemes.length
      ? protectiveThemes
      : [
          '자신의 상태를 이해하려고 검사와 상담에 참여한 동기',
          '현재 어려움을 언어로 표현하고 도움을 구할 수 있는 능력',
          '일상을 유지해 온 경험과 기존 대처 자원'
        ];

    const goals={
      shortTerm:[
        '현재 가장 부담이 큰 증상과 생활 영향을 구체적으로 확인합니다.',
        '감정과 신체 반응을 알아차리고 안정시키는 방법을 마련합니다.',
        '검사 결과와 실제 경험이 일치하는지 상담에서 함께 검토합니다.'
      ],
      midTerm:[
        '불안을 유지하는 생각·회피·관계 패턴을 이해하고 새로운 대처를 연습합니다.',
        '자기비판을 줄이고 현실적인 자기평가와 감정표현을 강화합니다.',
        '생활 리듬과 스트레스 회복 습관을 안정화합니다.'
      ],
      longTerm:[
        '어려운 상황에서도 자신의 가치와 필요에 따라 선택하는 힘을 높입니다.',
        '관계에서 경계를 유지하면서도 친밀감과 상호성을 경험하도록 돕습니다.',
        '재발 신호를 알아차리고 스스로 회복 계획을 활용할 수 있도록 합니다.'
      ]
    };

    const interventionMap=[];
    const themeIds=primaryThemes.map(theme=>theme.id);
    if(themeIds.some(id=>['anxiety','avoidance','selfcriticism'].includes(id))){
      interventionMap.push({
        approach:'인지행동적 접근',
        rationale:'불안을 유지하는 자동적 생각, 회피 행동, 자기비판 패턴을 구체적으로 확인하고 새로운 대처를 연습하는 데 적합합니다.'
      });
    }
    if(themeIds.some(id=>['anxiety','stress','selfcriticism'].includes(id))){
      interventionMap.push({
        approach:'ACT 기반 접근',
        rationale:'불편한 감정을 없애려는 싸움을 줄이고, 중요한 가치에 따라 작은 행동을 선택하도록 돕는 데 활용할 수 있습니다.'
      });
    }
    if(themeIds.some(id=>['relationships','dependency'].includes(id))){
      interventionMap.push({
        approach:'애착·관계 중심 접근',
        rationale:'관계에서 반복되는 기대, 두려움, 거리 조절 방식을 안전한 상담관계 안에서 이해하는 데 도움이 됩니다.'
      });
    }
    if(themeIds.includes('emotion')){
      interventionMap.push({
        approach:'정서조절 기술 훈련',
        rationale:'감정의 상승 신호를 빠르게 알아차리고 충동적 반응 전에 멈추는 기술을 강화하는 데 필요합니다.'
      });
    }
    if(context.parentCoaching===true){
      interventionMap.push({
        approach:'부모코칭',
        rationale:'아동의 행동을 정서와 발달의 관점에서 이해하고, 일관된 반응과 상호작용 방식을 조정하는 데 활용합니다.'
      });
    }

    const cautions=[
      '검사 결과만으로 진단을 확정하지 않습니다.',
      '점수보다 실제 생활 기능과 면담에서 확인되는 경험을 우선합니다.',
      '해석과 내담자의 경험이 다를 경우 내담자의 설명을 수정 대상으로 보지 않고 추가 정보로 다룹니다.',
      '초기 상담에서는 변화 요구보다 안전감과 관계 형성을 우선합니다.',
      '위험 신호가 확인되면 별도의 자살·자해·타해 위험평가와 전문기관 연계를 시행합니다.'
    ];

    return {
      version:VERSION,
      validity,
      themes,
      commonFactors,
      differences,
      caseFormulation:{
        currentDifficulties,
        possibleContributingFactors:array(context.contributingFactors),
        maintainingFactors:unique(maintainingFactors),
        protectiveFactors,
        recoveryResources:protectiveFactors
      },
      goals,
      interventions:interventionMap,
      counselorCautions:cautions,
      clinicalDisclaimer:'이 자료는 상담자 검토용 가설이며, 진단서나 자동 치료계획이 아닙니다. 면담·행동관찰·생활 맥락·위험평가와 함께 수정해야 합니다.'
    };
  }

  function create({reservation={},results=[],context={}}={}){
    const now=new Date().toISOString();
    const formulation=buildFormulation({results,context});
    const item={
      id:`clinical-formulation:${text(reservation.id)||Date.now()}`,
      reservationId:text(reservation.id),
      clientId:text(reservation.clientId||reservation.userId),
      clientName:text(reservation.clientName||reservation.name),
      testTypes:unique(array(results).map(result=>result.testType)),
      formulation,
      status:'상담자 검토 필요',
      counselorOnly:true,
      approved:false,
      createdAt:now,
      updatedAt:now
    };
    return upsert(item);
  }

  function approve(id,{reviewer='상담자'}={}){
    const item=readAll().find(row=>text(row.id)===text(id));
    if(!item)throw new Error('사례개념화 자료를 찾지 못했습니다.');
    return upsert({
      ...item,
      approved:true,
      status:'상담자 검토 완료',
      reviewedBy:reviewer,
      reviewedAt:new Date().toISOString()
    });
  }

  function revoke(id){
    const item=readAll().find(row=>text(row.id)===text(id));
    if(!item)throw new Error('사례개념화 자료를 찾지 못했습니다.');
    return upsert({
      ...item,
      approved:false,
      status:'상담자 검토 필요',
      reviewedBy:'',
      reviewedAt:''
    });
  }

  function getByReservation(reservationId){
    return readAll().filter(row=>text(row.reservationId)===text(reservationId));
  }

  function diagnostics(){
    return {
      ok:true,
      version:VERSION,
      storeKey:STORE_KEY,
      count:readAll().length,
      unifiedReportEngine:Boolean(global.MMLUnifiedAIReportEngine),
      counselorOnly:true
    };
  }

  global.MMLClinicalReasoningEngine=Object.freeze({
    version:VERSION,
    readAll,
    saveAll,
    upsert,
    inferValidity,
    extractThemes,
    buildCommonFactors,
    buildDifferences,
    buildFormulation,
    create,
    approve,
    revoke,
    getByReservation,
    diagnostics
  });

  try{
    global.dispatchEvent(new CustomEvent('mml:clinical-reasoning-ready',{
      detail:{version:VERSION}
    }));
  }catch(_){}
})(window);
