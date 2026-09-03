console.info('[MML] ADMIN-MODULE-MANIFEST-260725-STEP25 loaded');

(function(global){
  'use strict';

  const isLocal =
    location.hostname === 'localhost' ||
    location.hostname === '127.0.0.1' ||
    location.hostname.endsWith('.local');

  const mode = isLocal ? 'development' : 'production';
  const build = '20260831-rc3-5-cancel-chip-removed-v1';

  const core = [
    {
      id:'data-store',
      src:'./js/modules/data-store.js?v=20260724-server-data-v37-1-fixed',
      required:true
    },
    {
      id:'sync-engine',
      src:'./js/modules/sync-engine.js?v=20260724-sync-engine-v33',
      required:true,
      dependsOn:['data-store']
    },
    {
      id:'ui-components',
      src:'./js/modules/ui-components.js?v=20260724-ui-components-v31',
      required:true
    },
    {
      id:'print-engine',
      src:'./js/modules/print-engine.js?v=20260724-print-engine-v32',
      required:true,
      dependsOn:['ui-components']
    },
    {
      id:'report-viewer',
      src:'./js/modules/report-viewer.js?v=20260725-unified-report-source-step6-1',
      required:true,
      dependsOn:['print-engine']
    },
    {
      id:'unified-ai-report-engine',
      src:'./js/modules/unified-ai-report-engine.js?v=20260725-report-quality-step12',
      required:true,
      dependsOn:['report-viewer']
    },
    {
      id:'clinical-reasoning-engine',
      src:'./js/modules/clinical-reasoning-engine.js?v=20260725-clinical-reasoning-step13',
      required:true,
      dependsOn:['unified-ai-report-engine']
    },
    {
      id:'ai-counseling-engine',
      src:'./js/modules/ai-counseling-engine.js?v=20260725-ai-counseling-engine-step14',
      required:true,
      dependsOn:['clinical-reasoning-engine']
    },
    {
      id:'workflow-diagnostics',
      src:'./js/modules/workflow-diagnostics.js?v=20260725-workflow-diagnostics-step9',
      required:true,
      dependsOn:['ai-counseling-engine']
    }
  ];

  const workspaces = [
    {
      id:'clinical-workspace',
      src:'./js/modules/clinical-workspace.js?v=20260724-modular-v25',
      required:true,
      dependsOn:['data-store']
    },
    {
      id:'outcomes-workspace',
      src:'./js/modules/outcomes-workspace.js?v=20260830-journal-two-stage-ai-v24',
      required:true,
      dependsOn:['data-store']
    },
    {
      id:'clinical-documents',
      src:'./js/modules/clinical-documents.js?v=20260830-journal-two-stage-ai-v24',
      required:true,
      dependsOn:['data-store','print-engine']
    },
    {
      id:'assessment-reports',
      src:'./js/modules/assessment-reports.js?v=20260831-rc33-request-type-fix',
      required:true,
      dependsOn:['data-store','print-engine']
    },
    {
      id:'operations-workspace',
      src:'./js/modules/operations-workspace.js?v=20260903-rc3-14-ai-event-all-counseling-v1',
      required:true,
      dependsOn:['data-store','ui-components']
    }
  ];

  const startup = [
    {
      id:'admin-main',
      src:'./js/admin.js?v=20260903-rc3-14-ai-event-all-counseling-v1',
      required:true
    },
    {
      id:'reservation-events',
      src:'./js/reservations/reservation-events.js?v=20260722-refactor-r1',
      required:false,
      type:'module'
    },
    {
      id:'chart-sync-manager',
      src:'./js/modules/chart-sync-manager.js?v=20260725-chart-sync-manager-step3',
      required:true,
      dependsOn:['data-store','sync-engine','admin-main']
    },
    {
      id:'client-report-publication',
      src:'./js/modules/client-report-publication.js?v=20260727-persistence-fix-v2',
      required:true,
      dependsOn:['data-store','chart-sync-manager','report-viewer','admin-main']
    },
    {
      id:'assessment-report-lifecycle',
      src:'./js/modules/assessment-report-lifecycle.js?v=20260725-assessment-report-lifecycle-step10',
      required:true,
      dependsOn:['client-report-publication','admin-main']
    },
    {
      id:'integrated-workflow-hub',
      src:'./js/modules/integrated-workflow-hub.js?v=20260725-integrated-workflow-step17',
      required:true,
      dependsOn:[
        'assessment-report-lifecycle',
        'clinical-reasoning-engine',
        'ai-counseling-engine'
      ]
    },
    {
      id:'counseling-record-engine',
      src:'./js/modules/counseling-record-engine.js?v=20260725-counseling-record-step18',
      required:true,
      dependsOn:[
        'integrated-workflow-hub',
        'ai-counseling-engine'
      ]
    },
    {
      id:'case-management-engine',
      src:'./js/modules/case-management-engine.js?v=20260725-case-management-step19',
      required:true,
      dependsOn:[
        'counseling-record-engine',
        'integrated-workflow-hub'
      ]
    },
    {
      id:'case-management-ui',
      src:'./js/modules/case-management-ui.js?v=20260725-case-management-ui-step20',
      required:true,
      dependsOn:[
        'case-management-engine',
        'counseling-record-engine',
        'admin-main'
      ]
    },
    {
      id:'ai-supervisor-engine',
      src:'./js/modules/ai-supervisor-engine.js?v=20260725-ai-supervisor-step21',
      required:true,
      dependsOn:[
        'case-management-engine',
        'ai-counseling-engine',
        'integrated-workflow-hub'
      ]
    },
    {
      id:'ai-supervisor-ui',
      src:'./js/modules/ai-supervisor-ui.js?v=20260725-ai-supervisor-ui-step21',
      required:true,
      dependsOn:[
        'ai-supervisor-engine',
        'case-management-ui'
      ]
    },
    {
      id:'service-state-engine',
      src:'./js/modules/service-state-engine.js?v=20260725-service-state-step22',
      required:true,
      dependsOn:[
        'integrated-workflow-hub',
        'case-management-engine',
        'client-report-publication'
      ]
    },
    {
      id:'today-workspace-ui',
      src:'./js/modules/today-workspace-ui.js?v=20260725-today-workspace-step22',
      required:true,
      dependsOn:[
        'service-state-engine',
        'case-management-ui',
        'admin-main'
      ]
    },
    {
      id:'mml-os-core',
      src:'./js/modules/mml-os-core.js?v=20260725-mml-os-core-step24-storage-stable',
      required:true,
      dependsOn:[
        'integrated-workflow-hub',
        'case-management-engine',
        'service-state-engine'
      ]
    },
    {
      id:'prompt-registry',
      src:'./js/modules/prompt-registry.js?v=20260725-prompt-registry-step24-storage-stable',
      required:true,
      dependsOn:[
        'mml-os-core'
      ]
    },
    {
      id:'assessment-plugin-registry',
      src:'./js/modules/assessment-plugin-registry.js?v=20260725-assessment-plugins-step24-storage-stable',
      required:true,
      dependsOn:[
        'mml-os-core'
      ]
    },
    {
      id:'dashboard-api',
      src:'./js/modules/dashboard-api.js?v=20260725-dashboard-api-step23',
      required:true,
      dependsOn:[
        'mml-os-core'
      ]
    },
    {
      id:'unified-store-gateway',
      src:'./js/modules/unified-store-gateway.js?v=20260725-unified-store-step25',
      required:true,
      dependsOn:[
        'data-store'
      ]
    },
    {
      id:'unified-workflow-state',
      src:'./js/modules/unified-workflow-state.js?v=20260725-unified-workflow-step25',
      required:true,
      dependsOn:[]
    },
    {
      id:'admin-feature-shells',
      src:'./js/modules/admin-feature-shells.js?v=20260725-admin-feature-shells-step25',
      required:true,
      dependsOn:[
        'admin-main'
      ]
    },
    {
      id:'refactor-diagnostics',
      src:'./js/modules/refactor-diagnostics.js?v=20260725-refactor-diagnostics-step25',
      required:true,
      dependsOn:[
        'unified-store-gateway',
        'unified-workflow-state',
        'admin-feature-shells'
      ]
    }
  ];

  const development = [
    {
      id:'health-engine',
      src:'./js/modules/health-engine.js?v=20260724-stabilization-v34',
      required:false,
      dependsOn:['data-store','sync-engine']
    },
    {
      id:'integration-check',
      src:'./js/admin-integration-check.js?v=20260830-app-schedule-apply-v30',
      required:false
    },
    {
      id:'admin-recovery-check',
      src:'./js/admin-recovery-check.js?v=20260727-persistence-fix-v2',
      required:false
    }
  ];

  const production = [];

  function resolve(){
    return [
      ...core,
      ...(mode === 'development' ? development.slice(0,1) : []),
      ...workspaces,
      ...startup,
      ...(mode === 'development' ? development.slice(1) : production)
    ].map((item,index)=>Object.freeze({
      order:index+1,
      ...item
    }));
  }

  function byId(id){
    return resolve().find(item=>item.id===id)||null;
  }

  function validate(){
    const rows=resolve();
    const ids=new Set();
    const errors=[];

    rows.forEach(item=>{
      if(!item.id) errors.push('ID가 없는 모듈이 있습니다.');
      if(!item.src) errors.push(`${item.id||'unknown'} 경로가 없습니다.`);
      if(ids.has(item.id)) errors.push(`중복 모듈 ID: ${item.id}`);
      ids.add(item.id);
    });

    rows.forEach(item=>{
      (item.dependsOn||[]).forEach(dep=>{
        if(!ids.has(dep)) errors.push(`${item.id} 의존 모듈 누락: ${dep}`);
      });
    });

    return {
      ok:errors.length===0,
      mode,
      build,
      count:rows.length,
      errors
    };
  }

  global.MMLAdminModuleManifest=Object.freeze({
    version:'20260725-step25',
    build,
    mode,
    core:Object.freeze(core),
    workspaces:Object.freeze(workspaces),
    startup:Object.freeze(startup),
    development:Object.freeze(development),
    production:Object.freeze(production),
    resolve,
    byId,
    validate
  });
})(window);
