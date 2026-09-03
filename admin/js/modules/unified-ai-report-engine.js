console.info('[MML] UNIFIED-AI-REPORT-ENGINE-STEP12 loaded');

(function(global){
  'use strict';

  const VERSION='20260725-report-quality-step12';

  const TEST_LABELS={
    TCI:'TCI 기질 및 성격검사',
    'MMPI-2':'MMPI-2 다면적 인성검사',
    MMPI:'MMPI-2 다면적 인성검사',
    PAI:'PAI 성격평가검사',
    SCT:'SCT 문장완성검사',
    HTP:'HTP 집·나무·사람 그림검사',
    'K-CDI':'K-CDI 아동발달검사',
    KCDI:'K-CDI 아동발달검사',
    STS:'STS 6요인 기질검사',
    PAT:'PAT-2 부모양육태도검사 2판',
    'PHQ-9':'PHQ-9 우울 선별검사',
    PHQ9:'PHQ-9 우울 선별검사',
    'GAD-7':'GAD-7 불안 선별검사',
    GAD7:'GAD-7 불안 선별검사'
  };

  const SECTION_ORDER=[
    ['currentMind','현재 마음의 핵심 모습'],
    ['profile','마음 프로파일'],
    ['emotionalState','정서와 심리상태'],
    ['thinkingRelationship','사고와 관계 방식'],
    ['stressDailyLife','스트레스와 일상생활'],
    ['professionalGuidance','전문가 제언 및 회복 방향'],
    ['testSummaries','개별검사 요약']
  ];

  function text(value){return String(value??'').trim();}
  function array(value){return Array.isArray(value)?value:[]}
  function clone(value){
    try{return structuredClone(value)}catch(_){}
    try{return JSON.parse(JSON.stringify(value))}catch(_){return value}
  }
  function uniq(values){
    return [...new Set(array(values).map(text).filter(Boolean))];
  }
  function normalizeTestCode(value=''){
    const raw=text(value).toUpperCase().replace(/\s+/g,'');
    if(raw==='MMPI2')return 'MMPI-2';
    if(raw==='KCDI')return 'K-CDI';
    if(raw==='PHQ9')return 'PHQ-9';
    if(raw==='GAD7')return 'GAD-7';
    return raw;
  }
  function testLabel(value=''){
    const code=normalizeTestCode(value);
    return TEST_LABELS[code]||text(value)||'심리검사';
  }
  function splitLines(value){
    if(Array.isArray(value))return value.map(text).filter(Boolean);
    return text(value).split(/\n+/).map(text).filter(Boolean);
  }
  function numbered(value){
    const rows=splitLines(value);
    return rows.map((row,index)=>`${index+1}. ${row.replace(/^\d+[.)]\s*/,'')}`).join('\n');
  }
  function sentenceKey(value=''){
    return text(value)
      .toLowerCase()
      .replace(/[^\p{L}\p{N}]+/gu,'')
      .replace(/(입니다|합니다|됩니다|있습니다|보입니다|나타납니다)$/,'');
  }

  function dedupeLines(value){
    const rows=splitLines(value);
    const kept=[];
    const keys=[];

    rows.forEach(row=>{
      const clean=text(row).replace(/^\d+[.)]\s*/,'');
      const key=sentenceKey(clean);
      if(!key)return;

      const duplicate=keys.some(existing=>
        existing===key ||
        (existing.length>14&&key.length>14&&(
          existing.includes(key)||
          key.includes(existing)
        ))
      );

      if(!duplicate){
        kept.push(clean);
        keys.push(key);
      }
    });

    return kept;
  }

  function dedupeText(value){
    return dedupeLines(value).join('\n');
  }

  function sentenceList(value){
    if(Array.isArray(value))return dedupeLines(value);
    return dedupeLines(text(value).split(/(?<=[.!?다요])\s+/));
  }

  function buildCrossAnalysis(results=[]){
    const rows=array(results).filter(Boolean);
    const summaries=rows
      .map(item=>({
        testType:item.testType,
        label:item.testLabel,
        summary:text(item.summary)
      }))
      .filter(item=>item.summary);

    if(!summaries.length){
      return {
        common:'',
        differences:'',
        meaning:'',
        dailyImpact:''
      };
    }

    const commonTerms=[
      ['불안','긴장','걱정','예민'],
      ['우울','무기력','의욕','피로'],
      ['관계','대인','갈등','거리'],
      ['충동','분노','감정조절'],
      ['자기비판','자존감','자기평가'],
      ['회피','위축','소극'],
      ['스트레스','부담','압박']
    ];

    const matched=commonTerms
      .map(group=>{
        const tests=summaries.filter(item=>
          group.some(term=>item.summary.includes(term))
        );
        return tests.length>=2
          ? {term:group[0],tests}
          : null;
      })
      .filter(Boolean);

    const common=matched.length
      ? matched.map(item=>
          `${item.tests.map(test=>test.label).join('과 ')}에서 ${item.term}과 관련된 특징이 함께 확인됩니다. 이는 특정 상황에서만 나타나는 반응이라기보다 현재의 정서적 부담과 대처 방식에 공통적으로 영향을 주는 경향으로 이해할 수 있습니다.`
        ).join('\n')
      : `${summaries.map(item=>item.label).join(', ')}의 결과를 함께 보면 각 검사가 서로 다른 측면을 측정하지만, 현재 경험하는 어려움과 적응 방식을 일관된 흐름으로 설명하고 있습니다.`;

    const differences=summaries.length>1
      ? summaries.map(item=>
          `${item.label}에서는 ${item.summary}`
        ).join('\n')
      : '';

    const meaning=matched.length
      ? `여러 검사에서 반복해서 확인된 특징은 단일 점수보다 임상적으로 더 중요하게 볼 수 있습니다. 다만 각 결과는 확정적인 진단이 아니라 현재 상태와 생활 맥락을 함께 이해하기 위한 근거로 활용해야 합니다.`
      : `검사마다 강조하는 영역이 다르므로 결과의 차이는 모순이라기보다 마음의 서로 다른 측면을 보여주는 것으로 해석하는 것이 적절합니다.`;

    const dailyImpact=matched.map(item=>{
      if(item.term==='불안')return '예측하기 어려운 상황에서 걱정이 앞서거나 결정을 미루고, 몸의 긴장과 피로가 쉽게 누적될 수 있습니다.';
      if(item.term==='우울')return '해야 할 일을 시작하는 힘이 떨어지고, 평소 가능했던 활동에서도 만족감이나 성취감을 느끼기 어려울 수 있습니다.';
      if(item.term==='관계')return '상대의 반응을 지나치게 살피거나 갈등을 피하기 위해 자신의 요구를 뒤로 미룰 수 있습니다.';
      if(item.term==='충동')return '감정이 높아진 순간에 반응이 빨라지고, 이후 후회나 관계 부담으로 이어질 수 있습니다.';
      if(item.term==='자기비판')return '실수나 부족한 점을 크게 받아들이고 자신의 강점과 성취를 충분히 인정하지 못할 수 있습니다.';
      if(item.term==='회피')return '부담되는 상황을 미루거나 피하면서 단기적으로는 편해지지만 장기적으로 불안과 자신감 저하가 유지될 수 있습니다.';
      if(item.term==='스트레스')return '일상의 작은 요구도 크게 느껴지고 회복에 필요한 휴식과 정서적 여유가 부족해질 수 있습니다.';
      return '';
    }).filter(Boolean).join('\n');

    return {
      common:dedupeText(common),
      differences:dedupeText(differences),
      meaning:dedupeText(meaning),
      dailyImpact:dedupeText(dailyImpact)
    };
  }

  function buildCounselorComment(ai={},results=[]){
    const source=text(
      ai.counselorComment||
      ai.closingMessage||
      ai.finalMessage
    );
    if(source)return dedupeText(source);

    const strengths=dedupeLines(ai.strengths).slice(0,2);
    const guidance=dedupeLines(ai.professionalGuidance).slice(0,2);
    const testNames=uniq(array(results).map(item=>item.testLabel)).join(', ');

    return [
      `${testNames||'이번 심리검사'} 결과는 지금의 어려움을 단순히 약점으로 판단하기보다, 마음이 어떤 상황에서 부담을 크게 느끼고 어떻게 대처해 왔는지를 이해하도록 돕습니다.`,
      strengths.length
        ? `결과에서 확인된 강점은 ${strengths.join(', ')}입니다. 이 강점은 회복 과정에서 중요한 자원이 될 수 있습니다.`
        : '지금까지 어려움을 견디며 일상을 이어 온 힘 자체가 회복을 위한 중요한 자원입니다.',
      guidance.length
        ? `앞으로는 ${guidance.join(', ')}의 방향을 생활 속에서 작게 실천해 보는 것이 도움이 됩니다.`
        : '한 번에 모든 것을 바꾸기보다 부담이 가장 큰 한 가지부터 조절해 나가는 것이 좋습니다.',
      '검사 결과는 현재 상태를 이해하기 위한 자료이며, 사람 전체를 규정하거나 미래를 결정하는 결론은 아닙니다.',
      '상담에서는 검사 결과와 실제 경험이 어떻게 연결되는지 함께 확인하며 자신에게 맞는 회복 방법을 구체화할 수 있습니다.'
    ].join('\n');
  }

  function qualityNormalizeAi(aiResult={},results=[]){
    const source=aiResult&&typeof aiResult==='object'?aiResult:{};
    const cross=buildCrossAnalysis(results);
    const normalized={
      summary:dedupeText(source.summary||source.overallSummary||source.overview),
      currentMind:dedupeText(source.currentMind||source.currentState||source.coreMind),
      profile:dedupeText(source.profile||source.mindProfile),
      emotionalState:dedupeText(source.emotionalState||source.emotion||source.psychologicalState),
      thinkingRelationship:dedupeText(source.thinkingRelationship||source.cognitionRelationship||source.relationship),
      stressDailyLife:dedupeText(source.stressDailyLife||source.stress||source.dailyLife),
      professionalGuidance:numbered(dedupeLines(
        source.professionalGuidance||
        source.recommendations||
        source.guidance||
        source.suggestions
      )),
      strengths:dedupeLines(source.strengths),
      concerns:dedupeLines(source.concerns),
      recommendations:dedupeLines(source.recommendations),
      commonFindings:dedupeText(source.commonFindings||source.crossTestCommon||cross.common),
      differences:dedupeText(source.differences||source.crossTestDifferences||cross.differences),
      psychologicalMeaning:dedupeText(source.psychologicalMeaning||source.clinicalMeaning||cross.meaning),
      dailyImpact:dedupeText(source.dailyImpact||source.functionalImpact||cross.dailyImpact),
      counselorComment:'',
      testSummaries:source.testSummaries&&typeof source.testSummaries==='object'
        ? Object.fromEntries(
            Object.entries(source.testSummaries)
              .map(([key,value])=>[key,dedupeText(value)])
          )
        : {}
    };
    normalized.counselorComment=buildCounselorComment(
      {...source,...normalized},
      results
    );
    return normalized;
  }

  function buildPromptBlueprint({mode='comprehensive',tests=[]}={}){
    const testNames=uniq(array(tests).map(testLabel));
    const commonRules=[
      '업로드된 검사결과에 명시된 사실만 사용합니다.',
      '점수나 해석 근거가 없는 내용은 추정하지 않습니다.',
      '같은 의미를 다른 표현으로 반복하지 않습니다.',
      '진단을 확정하거나 내담자를 단정하는 표현을 사용하지 않습니다.',
      '전문용어는 쉬운 말로 풀어 설명합니다.',
      '강점과 어려움을 균형 있게 기술합니다.',
      '전문가 제언은 3~5개 번호 항목으로 작성합니다.',
      '상담사 한마디는 따뜻하지만 과장되지 않은 5~8문장으로 작성합니다.'
    ];

    const sections=mode==='individual'
      ? [
          '검사 목적',
          '현재 마음의 핵심 특징',
          '검사결과 해석',
          '일상에서 나타날 수 있는 모습',
          '강점',
          '어려움',
          '회복 방향',
          '상담사 한마디'
        ]
      : [
          '현재 마음의 핵심 모습',
          '마음 프로파일',
          '정서와 심리상태',
          '사고와 관계 방식',
          '스트레스와 일상생활',
          '검사 간 공통점',
          '검사 간 차이점',
          '심리적 의미',
          '생활 영향',
          '전문가 제언 및 회복 방향',
          '개별검사 요약',
          '상담사 한마디'
        ];

    return {
      version:VERSION,
      mode,
      tests:testNames,
      rules:commonRules,
      sections,
      instruction:[
        `${testNames.join(', ')||'심리검사'} 결과를 바탕으로 ${mode==='individual'?'개별':'종합'} 심리검사 보고서를 작성하세요.`,
        ...commonRules.map(rule=>`- ${rule}`),
        '',
        '반드시 다음 순서로 작성하세요.',
        ...sections.map((section,index)=>`${index+1}. ${section}`)
      ].join('\n')
    };
  }

  function normalizeAiResult(aiResult={},results=[]){
    return qualityNormalizeAi(aiResult,results);
  }
  function normalizeAssessmentResult(result={}){
    const source=result&&typeof result==='object'?result:{};
    const testType=normalizeTestCode(
      source.testType||
      source.testName||
      source.assessmentType||
      source.code
    );
    return {
      id:text(source.id),
      testType,
      testLabel:testLabel(testType),
      summary:text(
        source.clientSummary||
        source.summary||
        source.interpretation||
        source.analysis||
        source.resultText
      ),
      validity:text(source.validity||source.reliability||source.validitySummary),
      reviewed:Boolean(source.reviewed),
      sourceId:text(source.sourceId||source.fileId||source.id),
      source:clone(source)
    };
  }
  function normalizeAssessmentResults(value){
    return array(value)
      .map(normalizeAssessmentResult)
      .filter(item=>item.testType||item.summary);
  }
  function buildIndividualSections(result,ai){
    const sections={};
    const currentMind=ai.currentMind||result.summary;
    if(currentMind)sections['현재 마음의 핵심 모습']=currentMind;
    if(ai.profile)sections['마음 프로파일']=ai.profile;
    if(ai.emotionalState)sections['정서와 심리상태']=ai.emotionalState;
    if(ai.thinkingRelationship)sections['사고와 관계 방식']=ai.thinkingRelationship;
    if(ai.stressDailyLife)sections['스트레스와 일상생활']=ai.stressDailyLife;
    if(ai.strengths.length)sections['강점']=ai.strengths.map(item=>`• ${item}`).join('\n');
    if(ai.concerns.length)sections['어려움']=ai.concerns.map(item=>`• ${item}`).join('\n');
    if(ai.dailyImpact)sections['일상에서 나타날 수 있는 모습']=ai.dailyImpact;
    if(ai.professionalGuidance)sections['회복 방향']=ai.professionalGuidance;
    if(ai.counselorComment)sections['상담사 한마디']=ai.counselorComment;

    const detail=[
      result.validity?`결과 해석 기준\n${result.validity}`:'',
      result.summary?`검사결과 요약\n${result.summary}`:''
    ].filter(Boolean).join('\n\n');

    if(detail)sections[`${result.testLabel} 결과 요약`]=detail;
    return sections;
  }
  function buildTestSummaries(results,ai){
    return results.map(result=>{
      const aiSummary=text(
        ai.testSummaries?.[result.testType]||
        ai.testSummaries?.[result.testLabel]
      );
      return `■ ${result.testLabel}\n${aiSummary||result.summary||'저장된 검사결과 요약을 확인해 주세요.'}`;
    }).join('\n\n');
  }
  function buildComprehensiveSections(results,ai){
    const sections={};

    SECTION_ORDER.forEach(([key,title])=>{
      if(key==='testSummaries'){
        const summaries=buildTestSummaries(results,ai);
        if(summaries)sections[title]=summaries;
        return;
      }
      const value=text(ai[key]);
      if(value)sections[title]=value;
    });

    if(!sections['현재 마음의 핵심 모습']){
      const summaries=results.map(item=>item.summary).filter(Boolean);
      if(summaries.length)sections['현재 마음의 핵심 모습']=dedupeText(summaries.join('\n\n'));
    }

    if(ai.commonFindings)sections['검사 간 공통점']=ai.commonFindings;
    if(ai.differences)sections['검사 간 차이점']=ai.differences;
    if(ai.psychologicalMeaning)sections['심리적 의미']=ai.psychologicalMeaning;
    if(ai.dailyImpact)sections['생활 영향']=ai.dailyImpact;
    if(ai.counselorComment)sections['상담사 한마디']=ai.counselorComment;

    return sections;
  }
  function baseReport({
    reservation={},
    reportType,
    testType='',
    tests=[],
    aiResult={},
    sections={},
    title=''
  }){
    const now=new Date().toISOString();
    const reservationId=text(reservation.id||reservation.reservationId);
    const clientId=text(reservation.clientId||reservation.memberId||reservation.userId);
    const clientName=text(reservation.clientName||reservation.name);
    const normalizedTests=uniq(tests.map(normalizeTestCode));

    return {
      id:`REPORT-${reservationId||'NORES'}-${reportType}-${testType||'ALL'}-${Date.now()}`,
      reservationId,
      clientId,
      clientName,
      program:text(reservation.program),
      reportType,
      individualAssessmentReport:reportType==='individualReport',
      comprehensiveReport:reportType==='comprehensiveReport',
      assessmentReport:reportType==='comprehensiveReport',
      title,
      testType:normalizeTestCode(testType),
      tests:normalizedTests,
      selectedTests:normalizedTests,
      sections,
      summary:text(aiResult.summary),
      recommendations:text(aiResult.professionalGuidance),
      approved:false,
      reviewed:false,
      approvedForClient:false,
      reviewStatus:'draft',
      status:'초안',
      version:1,
      generatedBy:'unified-ai-report-engine',
      generatorVersion:VERSION,
      createdAt:now,
      updatedAt:now
    };
  }
  function createIndividual({
    reservation={},
    assessmentResult={},
    aiResult={}
  }={}){
    const result=normalizeAssessmentResult(assessmentResult);
    if(!result.testType&&!result.summary){
      throw new Error('개별보고서를 생성할 검사결과가 없습니다.');
    }

    const ai=normalizeAiResult(aiResult,[result]);
    return baseReport({
      reservation,
      reportType:'individualReport',
      testType:result.testType,
      tests:[result.testType],
      aiResult:ai,
      sections:buildIndividualSections(result,ai),
      title:`${result.testLabel} 개별 심리검사 보고서`
    });
  }
  function createComprehensive({
    reservation={},
    assessmentResults=[],
    aiResult={}
  }={}){
    const results=normalizeAssessmentResults(assessmentResults);
    if(!results.length){
      throw new Error('종합보고서를 생성할 검사결과가 없습니다.');
    }

    const ai=normalizeAiResult(aiResult,results);
    return baseReport({
      reservation,
      reportType:'comprehensiveReport',
      tests:results.map(item=>item.testType),
      aiResult:ai,
      sections:buildComprehensiveSections(results,ai),
      title:'심리검사 종합보고서'
    });
  }
  function requestedKinds(request={}){
    const individual=uniq(
      request.individualTests||
      request.tests||
      request.selectedTests||
      []
    );
    const comprehensive=Boolean(
      request.comprehensive||
      request.comprehensiveReport||
      request.integrated||
      request.requestComprehensive
    );
    return {individual,comprehensive};
  }
  function createRequested({
    reservation={},
    request={},
    assessmentResults=[],
    aiResult={}
  }={}){
    const results=normalizeAssessmentResults(assessmentResults);
    const kinds=requestedKinds(request);
    const reports=[];

    kinds.individual.forEach(test=>{
      const code=normalizeTestCode(test);
      const result=results.find(item=>item.testType===code);
      if(result){
        reports.push(createIndividual({
          reservation,
          assessmentResult:result,
          aiResult:aiResult?.individual?.[code]||aiResult
        }));
      }
    });

    if(kinds.comprehensive&&results.length){
      reports.push(createComprehensive({
        reservation,
        assessmentResults:results,
        aiResult:aiResult?.comprehensive||aiResult
      }));
    }

    return reports;
  }
  function fallbackLoad(){
    try{return array(JSON.parse(localStorage.getItem('modumam_reports')||'[]'))}
    catch(_){return []}
  }
  function fallbackSaveAll(rows){
    localStorage.setItem('modumam_reports',JSON.stringify(array(rows)));
    return array(rows);
  }
  function save(report){
    let rows;
    if(global.MMLReportStore?.saveReport){
      rows=global.MMLReportStore.saveReport(report);
    }else{
      const current=fallbackLoad();
      const index=current.findIndex(item=>text(item.id)===text(report.id));
      if(index>=0)current[index]={...current[index],...clone(report),updatedAt:new Date().toISOString()};
      else current.unshift(clone(report));
      rows=fallbackSaveAll(current);
    }
    const saved=array(rows).find(item=>text(item.id)===text(report.id))||report;
    try{
      global.dispatchEvent(new CustomEvent('mml:ai-report-generated',{
        detail:{report:clone(saved),version:VERSION}
      }));
    }catch(_){}
    return saved;
  }
  function saveMany(reports=[]){
    let savedRows;
    if(global.MMLReportStore?.saveAll&&global.MMLReportStore?.loadAll&&global.MMLReportStore?.upsert){
      let rows=global.MMLReportStore.loadAll();
      array(reports).forEach(report=>{
        rows=global.MMLReportStore.upsert(rows,report);
      });
      savedRows=global.MMLReportStore.saveAll(rows);
    }else{
      let rows=fallbackLoad();
      array(reports).forEach(report=>{
        const index=rows.findIndex(item=>text(item.id)===text(report.id));
        if(index>=0)rows[index]={...rows[index],...clone(report),updatedAt:new Date().toISOString()};
        else rows.unshift(clone(report));
      });
      savedRows=fallbackSaveAll(rows);
    }
    const ids=new Set(array(reports).map(item=>text(item.id)));
    const saved=savedRows.filter(item=>ids.has(text(item.id)));
    try{
      global.dispatchEvent(new CustomEvent('mml:ai-reports-generated',{
        detail:{reports:clone(saved),version:VERSION}
      }));
    }catch(_){}
    return saved;
  }
  function generateAndSaveIndividual(input){
    return save(createIndividual(input));
  }
  function generateAndSaveComprehensive(input){
    return save(createComprehensive(input));
  }
  function generateAndSaveRequested(input){
    return saveMany(createRequested(input));
  }
  function validateInput({assessmentResults=[],aiResult={},mode='comprehensive'}={}){
    const results=normalizeAssessmentResults(assessmentResults);
    const ai=normalizeAiResult(aiResult);
    const errors=[];

    if(mode==='comprehensive'&&!results.length){
      errors.push('검사결과가 없습니다.');
    }
    if(!ai.summary&&!ai.currentMind&&!ai.emotionalState){
      errors.push('AI 해석 핵심 내용이 없습니다.');
    }
    if(!ai.professionalGuidance){
      errors.push('전문가 제언 및 회복 방향이 없습니다.');
    }

    return {
      valid:errors.length===0,
      errors,
      assessmentResults:results,
      aiResult:ai
    };
  }
  function diagnostics(){
    return {
      ok:Boolean(global.MMLReportViewer?.open),
      version:VERSION,
      reportStore:Boolean(global.MMLReportStore),
      reportViewer:Boolean(global.MMLReportViewer),
      storageKey:global.MMLReportStore?.STORAGE_KEY||'modumam_reports',
      supportedTests:Object.keys(TEST_LABELS),
      singleSource:true
    };
  }

  global.MMLUnifiedAIReportEngine=Object.freeze({
    version:VERSION,
    TEST_LABELS:Object.freeze({...TEST_LABELS}),
    normalizeTestCode,
    testLabel,
    normalizeAiResult,
    qualityNormalizeAi,
    buildCrossAnalysis,
    buildCounselorComment,
    buildPromptBlueprint,
    dedupeText,
    dedupeLines,
    normalizeAssessmentResult,
    normalizeAssessmentResults,
    createIndividual,
    createComprehensive,
    createRequested,
    save,
    saveMany,
    generateAndSaveIndividual,
    generateAndSaveComprehensive,
    generateAndSaveRequested,
    validateInput,
    createClinicalFormulation(input={}){
      if(!global.MMLClinicalReasoningEngine?.create){
        throw new Error('상담자용 임상추론 엔진이 아직 준비되지 않았습니다.');
      }
      return global.MMLClinicalReasoningEngine.create(input);
    },
    createAICounselingSession(input={}){
      if(!global.MMLAICounselingEngine?.createSession){
        throw new Error('AI 상담 엔진이 아직 준비되지 않았습니다.');
      }
      return global.MMLAICounselingEngine.createSession(input);
    },
    replyAICounseling(sessionId,userMessage){
      if(!global.MMLAICounselingEngine?.reply){
        throw new Error('AI 상담 엔진이 아직 준비되지 않았습니다.');
      }
      return global.MMLAICounselingEngine.reply(sessionId,userMessage);
    },
    buildClinicalFormulation(input={}){
      if(!global.MMLClinicalReasoningEngine?.buildFormulation){
        throw new Error('상담자용 임상추론 엔진이 아직 준비되지 않았습니다.');
      }
      return global.MMLClinicalReasoningEngine.buildFormulation(input);
    },
    diagnostics
  });

  try{
    global.dispatchEvent(new CustomEvent('mml:unified-ai-report-engine-ready',{
      detail:{version:VERSION}
    }));
  }catch(_){}
})(window);
