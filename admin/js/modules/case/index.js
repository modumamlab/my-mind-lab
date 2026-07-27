(function(global){
'use strict';
const modules=global.MMLCaseModules||{};
const api=Object.freeze({version:'2.0.0-phase4-state-machine',...(modules.caseState||{}),...(modules.caseStore||{}),...(modules.caseMapper||{}),...(modules.caseValidator||{}),...(modules.caseTransition||{}),...(modules.caseService||{}),events:modules.caseEvents||{}});
global.MMLCaseRepository=api;
try{modules.caseEvents?.bind();const result=modules.caseEvents?.sync();console.info('[MML Case Repository]',api.version,'ready',result?.count||0,'cases')}catch(error){console.warn('[MML Case Repository] 초기 동기화 실패',error)}
})(window);
