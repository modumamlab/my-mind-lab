(function(global){
'use strict';
const modules=global.MMLWorkflowModules||{};
const api=Object.freeze({version:'1.0.0-workflow-patch1',...(modules.rules||{}),...(modules.actions||{}),...(modules.engine||{}),events:modules.events||{}});
global.MMLWorkflowEngine=api;
try{modules.events?.bind();const result=modules.engine?.sync('workflow-init');console.info('[MML Workflow]',api.version,'ready',result?.count||0,'cases');}
catch(error){console.warn('[MML Workflow] 초기화 실패',error);}
})(window);
