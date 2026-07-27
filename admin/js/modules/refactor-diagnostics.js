console.info('[MML] REFACTOR-DIAGNOSTICS-STEP25 loaded');

(function(global){
  'use strict';

  const VERSION='20260725-refactor-diagnostics-step25';
  const text=v=>String(v??'').trim();
  const arr=v=>Array.isArray(v)?v:[];

  function moduleManifest(){
    const manifest=global.MMLAdminModuleManifest;
    const modules=arr(manifest?.modules||manifest?.getModules?.());
    return modules.map(item=>({
      id:text(item.id),
      src:text(item.src),
      required:item.required!==false,
      dependsOn:arr(item.dependsOn).map(text)
    }));
  }

  function dependencyReport(){
    const modules=moduleManifest();
    const ids=new Set(modules.map(x=>x.id));
    const missing=[];
    modules.forEach(module=>{
      module.dependsOn.forEach(dep=>{
        if(!ids.has(dep))missing.push({module:module.id,missing:dep});
      });
    });

    const graph=new Map(modules.map(x=>[x.id,x.dependsOn]));
    const cycles=[];
    const visiting=new Set(),visited=new Set();

    function walk(id,path=[]){
      if(visiting.has(id)){
        const start=path.indexOf(id);
        cycles.push(path.slice(start).concat(id));
        return;
      }
      if(visited.has(id))return;
      visiting.add(id);
      const next=graph.get(id)||[];
      next.forEach(dep=>walk(dep,path.concat(id)));
      visiting.delete(id);
      visited.add(id);
    }
    modules.forEach(x=>walk(x.id));

    return {moduleCount:modules.length,missing,cycles};
  }

  function storageReport(){
    const unified=global.MMLUnifiedStore?.inspect?.()||{};
    const directKeys=[];
    try{
      for(let i=0;i<localStorage.length;i++)directKeys.push(localStorage.key(i));
    }catch(_){}
    return {
      ...unified,
      directKeyCount:directKeys.length,
      largestKeys:arr(unified.localStorageKeys).slice(0,20)
    };
  }

  function runtimeReport(){
    return {
      version:VERSION,
      unifiedStore:Boolean(global.MMLUnifiedStore),
      unifiedWorkflow:Boolean(global.MMLUnifiedWorkflow),
      mmlOS:Boolean(global.MMLOS),
      serviceState:Boolean(global.MMLServiceStateEngine),
      caseManagement:Boolean(global.MMLCaseManagementEngine),
      workflowHub:Boolean(global.MMLIntegratedWorkflowHub),
      dashboardAPI:Boolean(global.MMLDashboardAPI)
    };
  }

  function full(){
    return {
      generatedAt:new Date().toISOString(),
      runtime:runtimeReport(),
      dependencies:dependencyReport(),
      storage:storageReport(),
      recommendations:[
        'admin.js의 화면 함수는 feature shell을 통해 단계적으로 이동합니다.',
        '새 모듈은 MMLUnifiedStore만 사용하고 직접 localStorage 접근을 추가하지 않습니다.',
        '예약·보고서·상담 상태는 MMLUnifiedWorkflow.normalize()를 거칩니다.',
        '기존 모듈 제거는 기능별 회귀검사 후 진행합니다.'
      ]
    };
  }

  global.MMLRefactorDiagnostics=Object.freeze({
    version:VERSION,
    moduleManifest,dependencyReport,storageReport,runtimeReport,full
  });
})(window);
