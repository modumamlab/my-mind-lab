console.info('[MML] UNIFIED-WORKFLOW-STATE-STEP25 loaded');

(function(global){
  'use strict';

  const VERSION='20260725-unified-workflow-step25';
  const FLOW=Object.freeze([
    '예약 완료',
    '결제 확인',
    '검사 진행중',
    '검사 완료',
    '보고서 작성중',
    '승인 완료',
    'AI 상담 가능',
    '상담 진행중',
    '종결'
  ]);
  const text=v=>String(v??'').trim();

  const aliases=Object.freeze({
    '예약신청':'예약 완료',
    '예약 신청':'예약 완료',
    '예약완료':'예약 완료',
    '결제완료':'결제 확인',
    '검사링크발송':'검사 진행중',
    '검사진행':'검사 진행중',
    '검사결과업로드':'검사 완료',
    '보고서생성':'보고서 작성중',
    '보고서저장':'보고서 작성중',
    '보고서승인':'승인 완료',
    '공개완료':'승인 완료',
    'AI상담활성':'AI 상담 가능',
    '상담진행':'상담 진행중',
    '상담완료':'상담 진행중',
    '종료':'종결'
  });

  function normalize(value){
    const raw=text(value);
    if(FLOW.includes(raw))return raw;
    if(aliases[raw])return aliases[raw];

    if(/종결|종료/.test(raw))return '종결';
    if(/상담.*진행|상담.*완료|기록.*저장/.test(raw))return '상담 진행중';
    if(/AI.*상담.*활성|상담.*가능/.test(raw))return 'AI 상담 가능';
    if(/승인|공개/.test(raw))return '승인 완료';
    if(/보고서.*작성|보고서.*생성|보고서.*저장/.test(raw))return '보고서 작성중';
    if(/검사.*완료|결과.*업로드/.test(raw))return '검사 완료';
    if(/검사.*진행|검사.*발송/.test(raw))return '검사 진행중';
    if(/결제/.test(raw))return '결제 확인';
    return '예약 완료';
  }

  function index(status){return FLOW.indexOf(normalize(status))}

  function canTransition(from,to,{allowSkip=false}={}){
    const a=index(from),b=index(to);
    if(a<0||b<0)return false;
    if(allowSkip)return true;
    if(b===a||b===a+1)return true;
    if(normalize(to)==='종결')return true;
    if(normalize(from)==='종결'&&normalize(to)==='상담 진행중')return true;
    return false;
  }

  function progress(status){
    const i=Math.max(0,index(status));
    return Math.round(i/(FLOW.length-1)*100);
  }

  function derive(input={}){
    if(input.caseClosed===true)return '종결';
    if(input.hasCounselingRecord===true)return '상담 진행중';
    if(input.aiCounselingEnabled===true)return 'AI 상담 가능';
    if(input.hasApprovedReport===true||input.isPublished===true)return '승인 완료';
    if(input.hasReport===true)return '보고서 작성중';
    if(input.hasAssessment===true)return '검사 완료';
    if(input.assessmentStarted===true)return '검사 진행중';
    if(input.paymentConfirmed===true)return '결제 확인';
    return normalize(input.status);
  }

  global.MMLUnifiedWorkflow=Object.freeze({
    version:VERSION,
    flow:FLOW.slice(),
    normalize,index,canTransition,progress,derive
  });
})(window);
