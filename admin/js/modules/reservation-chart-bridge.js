console.info('[MML] RESERVATION-CHART-BRIDGE-STEP1 loaded');

(function(global){
  'use strict';

  const RESERVATION_KEY='modumam_reservations';
  const CHART_KEY='modumam_chart_records';
  const LEGACY_CHART_KEY='modumam_electronic_charts';
  const VERSION='20260725-reservation-chart-step1';

  let syncing=false;
  let scheduled=null;

  function clone(value){
    try{return structuredClone(value)}catch(error){}
    try{return JSON.parse(JSON.stringify(value))}catch(error){return value}
  }

  function safeParse(text,fallback){
    try{return text?JSON.parse(text):clone(fallback)}
    catch(error){return clone(fallback)}
  }

  function read(key,fallback=[]){
    if(global.MMLDataStore?.read){
      return global.MMLDataStore.read(key,fallback,{fresh:true});
    }
    return safeParse(localStorage.getItem(key),fallback);
  }

  function write(key,value,options={}){
    if(global.MMLDataStore?.write){
      return global.MMLDataStore.write(key,value,{
        action:options.action||'전자차트 동기화',
        detail:options.detail||'',
        server:false,
        source:'reservation-chart-bridge',
        ...options
      });
    }
    localStorage.setItem(key,JSON.stringify(value));
    return clone(value);
  }

  function text(value){
    return String(value??'').trim();
  }

  function sameId(a,b){
    return text(a)!=='' && text(a)===text(b);
  }

  function reservationTests(reservation={}){
    const candidates=[
      reservation.tests,
      reservation.selectedTests,
      reservation.assessments,
      reservation.testNames,
      reservation.requestedTests
    ];

    for(const value of candidates){
      if(Array.isArray(value)){
        return [...new Set(value.map(text).filter(Boolean))];
      }
      if(typeof value==='string' && value.trim()){
        return [...new Set(value.split(/[,\n·/]/).map(text).filter(Boolean))];
      }
    }

    const statusKeys=reservation.testStatuses && typeof reservation.testStatuses==='object'
      ? Object.keys(reservation.testStatuses)
      : [];
    return [...new Set(statusKeys.map(text).filter(Boolean))];
  }

  function chartIdFor(reservationId){
    return `chart-${text(reservationId)}`;
  }

  function normalizeReservation(reservation={}){
    return {
      id:text(reservation.id),
      reservationNumber:text(reservation.reservationNumber||reservation.reservationNo),
      caseNumber:text(reservation.caseNumber),
      clientId:text(reservation.clientId||reservation.memberId||reservation.userId),
      clientName:text(reservation.name||reservation.clientName),
      phone:text(reservation.phone||reservation.contact),
      program:text(reservation.program),
      date:text(reservation.date||reservation.counselingDate||reservation.reservationDate),
      time:text(reservation.time||reservation.counselingTime),
      counselingMethod:text(reservation.type||reservation.counselingMethod||reservation.method),
      status:text(reservation.status),
      tests:reservationTests(reservation),
      raw:clone(reservation)
    };
  }

  function createChart(reservation,existing=null){
    const normalized=normalizeReservation(reservation);
    const now=new Date().toISOString();

    return {
      id:existing?.id||chartIdFor(normalized.id),
      reservationId:normalized.id,
      reservationNumber:normalized.reservationNumber,
      caseNumber:normalized.caseNumber,
      clientId:normalized.clientId,
      clientName:normalized.clientName,
      phone:normalized.phone,
      program:normalized.program,
      date:normalized.date,
      time:normalized.time,
      counselingMethod:normalized.counselingMethod,
      reservationStatus:normalized.status,
      tests:normalized.tests,
      reservation:normalized.raw,
      assessmentResults:Array.isArray(existing?.assessmentResults)?existing.assessmentResults:[],
      reports:Array.isArray(existing?.reports)?existing.reports:[],
      counselingRecords:Array.isArray(existing?.counselingRecords)?existing.counselingRecords:[],
      aiCounseling:Array.isArray(existing?.aiCounseling)?existing.aiCounseling:[],
      createdAt:existing?.createdAt||now,
      updatedAt:now,
      syncVersion:VERSION
    };
  }

  function getReservations(){
    const rows=read(RESERVATION_KEY,[]);
    return Array.isArray(rows)?rows:[];
  }

  function getCharts(){
    const primary=read(CHART_KEY,[]);
    if(Array.isArray(primary) && primary.length) return primary;

    const legacy=read(LEGACY_CHART_KEY,[]);
    return Array.isArray(legacy)?legacy:[];
  }

  function sync(options={}){
    if(syncing) return {ok:false,reason:'already-syncing'};
    syncing=true;

    try{
      const reservations=getReservations();
      const charts=getCharts();
      const next=[...charts];
      let created=0;
      let updated=0;

      reservations.forEach(reservation=>{
        const reservationId=text(reservation?.id);
        if(!reservationId) return;

        const index=next.findIndex(chart=>sameId(chart?.reservationId,reservationId));
        if(index<0){
          next.push(createChart(reservation));
          created+=1;
          return;
        }

        const previous=next[index];
        const refreshed=createChart(reservation,previous);
        const before=JSON.stringify({
          reservationNumber:previous.reservationNumber,
          caseNumber:previous.caseNumber,
          clientId:previous.clientId,
          clientName:previous.clientName,
          phone:previous.phone,
          program:previous.program,
          date:previous.date,
          time:previous.time,
          counselingMethod:previous.counselingMethod,
          reservationStatus:previous.reservationStatus,
          tests:previous.tests
        });
        const after=JSON.stringify({
          reservationNumber:refreshed.reservationNumber,
          caseNumber:refreshed.caseNumber,
          clientId:refreshed.clientId,
          clientName:refreshed.clientName,
          phone:refreshed.phone,
          program:refreshed.program,
          date:refreshed.date,
          time:refreshed.time,
          counselingMethod:refreshed.counselingMethod,
          reservationStatus:refreshed.reservationStatus,
          tests:refreshed.tests
        });

        if(before!==after){
          next[index]=refreshed;
          updated+=1;
        }
      });

      if(created||updated||options.force){
        write(CHART_KEY,next,{
          action:'예약-전자차트 동기화',
          detail:`생성 ${created}건 · 갱신 ${updated}건`
        });
        // 기존 전자차트 코드와의 호환을 위해 같은 데이터를 함께 유지합니다.
        localStorage.setItem(LEGACY_CHART_KEY,JSON.stringify(next));
      }

      const result={
        ok:true,
        reservations:reservations.length,
        charts:next.length,
        created,
        updated,
        at:new Date().toISOString()
      };

      global.dispatchEvent(new CustomEvent('mml:reservation-chart-synced',{detail:result}));
      return result;
    }finally{
      syncing=false;
    }
  }

  function schedule(reason='change'){
    clearTimeout(scheduled);
    scheduled=setTimeout(()=>sync({reason}),120);
  }

  function findByReservationId(reservationId){
    return getCharts().find(chart=>sameId(chart?.reservationId,reservationId))||null;
  }

  function diagnostics(){
    const reservations=getReservations();
    const charts=getCharts();
    const missing=reservations
      .filter(row=>text(row?.id))
      .filter(row=>!charts.some(chart=>sameId(chart?.reservationId,row.id)))
      .map(row=>({id:row.id,name:row.name||row.clientName||''}));

    return {
      ok:missing.length===0,
      version:VERSION,
      reservations:reservations.length,
      charts:charts.length,
      missing
    };
  }

  global.addEventListener('mml:data-sync',event=>{
    if(event?.detail?.key===RESERVATION_KEY) schedule('data-sync');
  });

  global.addEventListener('storage',event=>{
    if(event.key===RESERVATION_KEY) schedule('storage');
  });

  global.addEventListener('mml:reservations-module-ready',()=>schedule('module-ready'));
  global.addEventListener('focus',()=>schedule('focus'));

  global.MMLReservationChartBridge=Object.freeze({
    version:VERSION,
    sync,
    schedule,
    getCharts,
    findByReservationId,
    diagnostics
  });

  setTimeout(()=>sync({force:true,reason:'startup'}),350);
})(window);
