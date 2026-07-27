console.info('[MML] ADMIN-FEATURE-SHELLS-STEP25 loaded');

(function(global){
  'use strict';

  const VERSION='20260725-admin-feature-shells-step25';
  const registry=new Map();
  const text=v=>String(v??'').trim();

  function register(id,feature){
    const key=text(id);
    if(!key)throw new Error('기능 ID가 필요합니다.');
    registry.set(key,{
      id:key,
      title:text(feature?.title)||key,
      render:typeof feature?.render==='function'?feature.render:null,
      init:typeof feature?.init==='function'?feature.init:null,
      destroy:typeof feature?.destroy==='function'?feature.destroy:null,
      dependencies:Array.isArray(feature?.dependencies)?feature.dependencies:[],
      version:text(feature?.version)||'1.0'
    });
    return registry.get(key);
  }

  function get(id){return registry.get(text(id))||null}
  function list(){return [...registry.values()].map(x=>({...x}))}

  function render(id,context={}){
    const feature=get(id);
    if(!feature?.render)throw new Error(`${id} 기능의 render가 등록되지 않았습니다.`);
    return feature.render(context);
  }

  function migrateLegacy(){
    const candidates=[
      ['today',{title:'오늘 업무',render:global.todayWorkspaceView||global.todayView}],
      ['reservations',{title:'예약관리',render:global.reservationView||global.reservationsView}],
      ['electronic-chart',{title:'전자차트',render:global.electronicChartView}],
      ['assessment-center',{title:'심리평가센터',render:global.assessmentCenterView}],
      ['case-management',{title:'사례관리',render:global.clinicalTimelineView}],
      ['statistics',{title:'운영통계',render:global.statisticsView}],
      ['settings',{title:'설정',render:global.settingsView}]
    ];
    candidates.forEach(([id,feature])=>{
      if(typeof feature.render==='function'&&!registry.has(id))register(id,feature);
    });
    return list();
  }

  global.MMLAdminFeatures=Object.freeze({
    version:VERSION,register,get,list,render,migrateLegacy
  });

  setTimeout(()=>{try{migrateLegacy()}catch(error){console.warn('[MML feature migration]',error)}},500);
})(window);
