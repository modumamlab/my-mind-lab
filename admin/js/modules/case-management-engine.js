console.info('[MML] CASE-MANAGEMENT-ENGINE-STEP19 loaded');

(function(global){
  'use strict';

  const VERSION='20260725-case-management-step19';
  const STORE_KEY='modumam_case_management';
  const METRIC_KEY='modumam_case_recovery_metrics';

  const text=value=>String(value??'').trim();
  const array=value=>Array.isArray(value)?value:[];
  const uniq=values=>[...new Set(array(values).map(text).filter(Boolean))];
  const nowIso=()=>new Date().toISOString();

  function safeParse(raw,fallback=[]){
    try{return raw?JSON.parse(raw):fallback}catch(_){return fallback}
  }

  function readStore(key,fallback=[]){
    try{
      if(global.MMLDataStore?.read){
        const value=global.MMLDataStore.read(key,fallback,{fresh:true});
        return value ?? fallback;
      }
    }catch(error){
      console.warn('[MML] case management datastore read fallback',error);
    }
    try{
      return safeParse(localStorage.getItem(key),fallback);
    }catch(_){
      return fallback;
    }
  }

  function writeStore(key,value,action='사례관리 저장'){
    try{
      if(global.MMLDataStore?.write){
        global.MMLDataStore.write(key,value,{
          action,
          detail:Array.isArray(value)?`${value.length}건`:'1건',
          source:'case-management-engine',
          server:false
        });
        return value;
      }
    }catch(error){
      console.warn('[MML] case management datastore write fallback',error);
    }
    localStorage.setItem(key,JSON.stringify(value));
    return value;
  }

  function readCases(){
    const value=readStore(STORE_KEY,[]);
    return Array.isArray(value)?value:[];
  }

  function readMetrics(){
    const value=readStore(METRIC_KEY,[]);
    return Array.isArray(value)?value:[];
  }

  function upsertCase(item){
    const rows=readCases();
    const index=rows.findIndex(row=>text(row.reservationId)===text(item.reservationId));
    const next={
      ...(index>=0?rows[index]:{}),
      ...item,
      updatedAt:nowIso()
    };
    if(index>=0)rows[index]=next;
    else rows.unshift(next);
    writeStore(STORE_KEY,rows,'사례관리 갱신');
    return next;
  }

  function upsertMetric(item){
    const rows=readMetrics();
    const id=text(item.id)||`metric:${text(item.reservationId)}:${Date.now()}`;
    const index=rows.findIndex(row=>text(row.id)===id);
    const next={...item,id,updatedAt:nowIso()};
    if(index>=0)rows[index]=next;
    else rows.unshift(next);
    writeStore(METRIC_KEY,rows,'회복지표 저장');
    return next;
  }

  function caseBundle(reservationId){
    if(!global.MMLIntegratedWorkflowHub?.caseBundle){
      throw new Error('통합 워크플로 허브가 준비되지 않았습니다.');
    }
    return global.MMLIntegratedWorkflowHub.caseBundle(reservationId);
  }

  function dateOf(item){
    return text(
      item?.date||
      item?.sessionDate||
      item?.createdAt||
      item?.approvedAt||
      item?.updatedAt
    );
  }

  function buildTimeline(reservationId){
    const bundle=caseBundle(reservationId);
    const rows=[];

    if(bundle.reservation){
      rows.push({
        type:'reservation',
        label:'예약 접수',
        date:dateOf(bundle.reservation),
        status:text(bundle.reservation.status)||'접수',
        source:bundle.reservation
      });
    }

    bundle.assessmentCenter.analyses.forEach(item=>rows.push({
      type:'assessment',
      label:`검사결과 ${text(item.testName||item.assessmentName)||'업로드'}`,
      date:dateOf(item),
      status:text(item.status)||'저장',
      source:item
    }));

    bundle.assessmentCenter.reports.forEach(item=>rows.push({
      type:'report',
      label:`${text(item.reportType)||'심리검사'} 보고서`,
      date:dateOf(item),
      status:text(item.status)||'생성',
      source:item
    }));

    bundle.electronicChart.formulations.forEach(item=>rows.push({
      type:'formulation',
      label:'AI 사례개념화',
      date:dateOf(item),
      status:text(item.status)||'작성',
      source:item
    }));

    bundle.electronicChart.counseling.forEach(item=>rows.push({
      type:'ai_counseling',
      label:`AI 상담 ${text(item.title)||'세션'}`,
      date:dateOf(item),
      status:text(item.status)||'진행',
      source:item
    }));

    array(bundle.electronicChart.counselingRecords).forEach(item=>rows.push({
      type:'counseling_record',
      label:`${Number(item.sessionNumber||1)}회기 상담기록`,
      date:dateOf(item),
      status:text(item.status)||'기록',
      source:item
    }));

    bundle.clientPortal.publications.forEach(item=>rows.push({
      type:'publication',
      label:'사용자 보고서 공개',
      date:dateOf(item),
      status:text(item.status)||'공개',
      source:item
    }));

    return rows
      .filter(item=>item.date)
      .sort((a,b)=>String(a.date).localeCompare(String(b.date)));
  }

  function calculateProgress(bundle){
    const steps=[
      bundle.state.hasReservation,
      bundle.state.hasChart,
      bundle.state.hasAssessment,
      bundle.state.hasReport,
      bundle.state.hasApprovedReport,
      bundle.state.hasFormulation,
      bundle.state.hasCounseling,
      bundle.state.hasCounselingRecord
    ];
    const complete=steps.filter(Boolean).length;
    return {
      complete,
      total:steps.length,
      percent:Math.round((complete/steps.length)*100)
    };
  }

  function buildDashboard(reservationId){
    const bundle=caseBundle(reservationId);
    const records=array(bundle.electronicChart.counselingRecords);
    const metrics=getMetrics(reservationId);
    const latestMetric=metrics[0]||null;
    const caseRow=readCases().find(item=>text(item.reservationId)===text(reservationId))||null;
    const timeline=buildTimeline(reservationId);
    const progress=calculateProgress(bundle);

    const incompleteHomework=records.flatMap(record=>
      array(record.homework)
        .filter(item=>typeof item==='string'||item?.completed!==true)
        .map(item=>typeof item==='string'?{
          task:item,
          completed:false,
          sessionNumber:record.sessionNumber
        }:{
          ...item,
          sessionNumber:record.sessionNumber
        })
    );

    return {
      version:VERSION,
      reservationId:text(reservationId),
      clientName:text(
        bundle.reservation?.clientName||
        bundle.reservation?.name||
        bundle.reservation?.userName
      ),
      status:text(caseRow?.status)||(
        records.length?'진행 중':'초기'
      ),
      progress,
      sessionCount:records.length,
      reportCount:bundle.assessmentCenter.reports.length,
      approvedReportCount:bundle.assessmentCenter.approvedReports.length,
      pendingHomework:incompleteHomework,
      latestMetric,
      timeline,
      riskFlags:records.flatMap(item=>array(item.riskFlags)),
      formulationCount:bundle.electronicChart.formulations.length,
      counselingSessionCount:bundle.electronicChart.counseling.length,
      lastActivity:timeline.length?timeline[timeline.length-1].date:'',
      nextAction:deriveNextAction(bundle,records,caseRow)
    };
  }

  function deriveNextAction(bundle,records,caseRow){
    if(text(caseRow?.status)==='종결')return '종결 후 추후관리 여부 확인';
    if(!bundle.state.hasChart)return '전자차트 생성 또는 동기화';
    if(bundle.state.hasAssessment&&!bundle.state.hasReport)return '심리검사 보고서 생성';
    if(bundle.state.hasReport&&!bundle.state.hasApprovedReport)return '보고서 검토 및 승인';
    if(bundle.state.hasApprovedReport&&!bundle.state.isPublished)return '사용자 보고서 공개 동기화';
    if(!bundle.state.hasFormulation)return '사례개념화 초안 생성';
    if(bundle.state.hasCounseling&&!bundle.state.hasCounselingRecord)return '상담기록 초안 생성';
    if(records.length)return '다음 회기 준비자료 확인';
    return '상담 일정 및 초기 목표 확인';
  }

  function getMetrics(reservationId){
    return readMetrics()
      .filter(item=>text(item.reservationId)===text(reservationId))
      .sort((a,b)=>String(b.date||b.createdAt).localeCompare(String(a.date||a.createdAt)));
  }

  function addRecoveryMetric(reservationId,{
    sessionNumber,
    date,
    anxiety,
    depression,
    stress,
    recovery,
    goalAchievement,
    note=''
  }={}){
    const normalize=value=>{
      const number=Number(value);
      if(!Number.isFinite(number))return null;
      return Math.max(0,Math.min(100,number));
    };

    return upsertMetric({
      id:`metric:${text(reservationId)}:${Number(sessionNumber||Date.now())}`,
      reservationId:text(reservationId),
      sessionNumber:Number(sessionNumber||0),
      date:text(date)||nowIso().slice(0,10),
      anxiety:normalize(anxiety),
      depression:normalize(depression),
      stress:normalize(stress),
      recovery:normalize(recovery),
      goalAchievement:normalize(goalAchievement),
      note:text(note),
      createdAt:nowIso()
    });
  }

  function buildFollowUp(reservationId){
    const dashboard=buildDashboard(reservationId);
    const records=caseBundle(reservationId).electronicChart.counselingRecords||[];
    const lastRecord=records
      .slice()
      .sort((a,b)=>String(b.sessionDate||b.createdAt).localeCompare(String(a.sessionDate||a.createdAt)))[0]||null;

    return {
      reservationId:text(reservationId),
      lastSessionSummary:text(lastRecord?.summary),
      unfinishedHomework:dashboard.pendingHomework,
      riskReview:uniq(dashboard.riskFlags.map(item=>item.type)),
      changesToCheck:[
        '지난 회기 이후 가장 달라진 점',
        '어려움이 가장 강해진 상황',
        '과제 실행 과정에서 도움이 된 점과 방해된 점',
        '현재 안전 상태와 보호요인'
      ],
      suggestedQuestions:array(lastRecord?.nextSessionBrief?.suggestedQuestions).length
        ?lastRecord.nextSessionBrief.suggestedQuestions
        :[
          '지난 회기 이후 가장 기억에 남는 변화는 무엇인가요?',
          '이번 주 가장 힘들었던 순간에는 무엇이 필요했나요?',
          '오늘 상담에서 가장 다루고 싶은 한 가지는 무엇인가요?'
        ],
      nextAction:dashboard.nextAction
    };
  }

  function buildTerminationEvaluation(reservationId,{reason='',counselorNote=''}={}){
    const dashboard=buildDashboard(reservationId);
    const bundle=caseBundle(reservationId);
    const records=array(bundle.electronicChart.counselingRecords);
    const metrics=getMetrics(reservationId).slice().reverse();
    const firstMetric=metrics[0]||null;
    const lastMetric=metrics[metrics.length-1]||null;

    const themes=uniq(records.flatMap(item=>array(item.themes)));
    const interventions=uniq(records.flatMap(item=>
      Object.values(item.structured||{})
        .flatMap(value=>String(value||'').split('\n'))
        .filter(line=>line.includes('반영')||line.includes('탐색')||line.includes('훈련')||line.includes('기록'))
    )).slice(0,8);

    const change=(key)=>{
      if(firstMetric?.[key]==null||lastMetric?.[key]==null)return null;
      return Number(lastMetric[key])-Number(firstMetric[key]);
    };

    return {
      id:`termination:${text(reservationId)}:${Date.now()}`,
      reservationId:text(reservationId),
      generatedAt:nowIso(),
      status:'상담사 검토 필요',
      counselorOnly:true,
      reason:text(reason)||'상담 목표 및 진행 상황을 종합하여 종결 여부를 검토합니다.',
      initialDifficulties:themes.slice(0,6),
      processSummary:records.map(item=>({
        sessionNumber:item.sessionNumber,
        date:item.sessionDate,
        summary:text(item.summary)
      })),
      majorInterventions:interventions,
      recoveryChanges:{
        anxiety:change('anxiety'),
        depression:change('depression'),
        stress:change('stress'),
        recovery:change('recovery'),
        goalAchievement:change('goalAchievement')
      },
      achievements:[
        dashboard.sessionCount?`${dashboard.sessionCount}회기의 상담기록이 누적되었습니다.`:'',
        dashboard.approvedReportCount?`${dashboard.approvedReportCount}건의 승인된 보고서가 있습니다.`:'',
        lastMetric?.goalAchievement!=null?`최종 목표 달성도는 ${lastMetric.goalAchievement}%로 기록되었습니다.`:''
      ].filter(Boolean),
      recommendations:[
        '상담에서 도움이 되었던 대처방법을 일상에서 반복합니다.',
        '어려움이 다시 커질 때 사용할 도움 요청 계획을 정리합니다.',
        '필요 시 추후상담 또는 재평가 일정을 협의합니다.'
      ],
      counselorNote:text(counselorNote)
    };
  }

  function closeCase(reservationId,{reason='',counselorNote=''}={}){
    const termination=buildTerminationEvaluation(reservationId,{reason,counselorNote});
    const row=upsertCase({
      reservationId:text(reservationId),
      status:'종결',
      closedAt:nowIso(),
      termination
    });
    return row;
  }

  function reopenCase(reservationId){
    return upsertCase({
      reservationId:text(reservationId),
      status:'진행 중',
      closedAt:'',
      reopenedAt:nowIso()
    });
  }

  function daysSince(value){
    const date=new Date(value);
    if(Number.isNaN(date.getTime()))return null;
    return Math.floor((Date.now()-date.getTime())/(1000*60*60*24));
  }

  function buildAlerts(){
    if(!global.MMLIntegratedWorkflowHub?.allCases)return [];
    const summaries=global.MMLIntegratedWorkflowHub.allCases();
    const alerts=[];

    summaries.forEach(summary=>{
      let dashboard;
      try{dashboard=buildDashboard(summary.reservationId)}catch(_){return}

      const idleDays=daysSince(dashboard.lastActivity);
      if(idleDays!=null&&idleDays>=14&&dashboard.status!=='종결'){
        alerts.push({
          type:'inactive_case',
          priority:'주의',
          reservationId:summary.reservationId,
          message:`${idleDays}일 동안 새로운 기록이 없습니다.`
        });
      }

      if(dashboard.pendingHomework.length){
        alerts.push({
          type:'unfinished_homework',
          priority:'확인',
          reservationId:summary.reservationId,
          message:`미완료 또는 확인 전 과제 ${dashboard.pendingHomework.length}건`
        });
      }

      if(summary.counts.reports>summary.counts.approvedReports){
        alerts.push({
          type:'report_approval',
          priority:'확인',
          reservationId:summary.reservationId,
          message:'검토 또는 승인 대기 보고서가 있습니다.'
        });
      }

      if(dashboard.riskFlags.length){
        alerts.push({
          type:'risk_review',
          priority:'높음',
          reservationId:summary.reservationId,
          message:'상담자가 직접 재확인해야 하는 위험 신호가 있습니다.'
        });
      }
    });

    const order={'높음':0,'주의':1,'확인':2};
    return alerts.sort((a,b)=>(order[a.priority]??9)-(order[b.priority]??9));
  }

  function operationalStatistics(){
    if(!global.MMLIntegratedWorkflowHub?.allCases){
      throw new Error('통합 워크플로 허브가 준비되지 않았습니다.');
    }

    const summaries=global.MMLIntegratedWorkflowHub.allCases();
    const caseRows=readCases();
    const records=global.MMLCounselingRecordEngine?.readAll?.()||[];
    const active=summaries.filter(item=>{
      const row=caseRows.find(caseItem=>text(caseItem.reservationId)===text(item.reservationId));
      return text(row?.status)!=='종결';
    });
    const closed=caseRows.filter(item=>text(item.status)==='종결');

    const approvedReports=summaries.reduce((sum,item)=>sum+Number(item.counts.approvedReports||0),0);
    const totalReports=summaries.reduce((sum,item)=>sum+Number(item.counts.reports||0),0);
    const counselingUsers=summaries.filter(item=>Number(item.counts.counselingSessions||0)>0).length;
    const averageSessions=summaries.length
      ?Number((records.length/summaries.length).toFixed(1))
      :0;

    return {
      version:VERSION,
      totalCases:summaries.length,
      activeCases:active.length,
      closedCases:closed.length,
      counselingRecordCount:records.length,
      averageSessions,
      totalReports,
      approvedReports,
      pendingApproval:Math.max(0,totalReports-approvedReports),
      aiCounselingCases:counselingUsers,
      aiCounselingRate:summaries.length
        ?Math.round((counselingUsers/summaries.length)*100)
        :0,
      alerts:buildAlerts()
    };
  }

  function diagnostics(){
    return {
      ok:true,
      version:VERSION,
      caseCount:readCases().length,
      metricCount:readMetrics().length,
      workflowHubReady:Boolean(global.MMLIntegratedWorkflowHub),
      counselingRecordReady:Boolean(global.MMLCounselingRecordEngine),
      counselorOnlyTermination:true
    };
  }

  global.MMLCaseManagementEngine=Object.freeze({
    version:VERSION,
    readCases,
    readMetrics,
    buildDashboard,
    buildTimeline,
    buildFollowUp,
    addRecoveryMetric,
    getMetrics,
    buildTerminationEvaluation,
    closeCase,
    reopenCase,
    buildAlerts,
    operationalStatistics,
    diagnostics
  });

  try{
    global.dispatchEvent(new CustomEvent('mml:case-management-ready',{
      detail:{version:VERSION}
    }));
  }catch(_){}
})(window);
