import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const source=readFileSync(new URL('../admin/js/admin-bootstrap.js',import.meta.url),'utf8');
async function run({failCore=false,failClinical=false}={}){
  const scripts=[],links=[],timers=new Map();
  let sequence=0,clinicalStarted=false;
  const app={innerHTML:''};
  const banner={style:{},setAttribute(){},remove(){}};
  const document={scripts,head:{appendChild(link){links.push(link);}},
    getElementById(id){return id==='app'?app:null;},
    createElement(tag){return tag==='div'?banner:{dataset:{},remove(){},getAttribute(key){return this[key];}};},
    body:{appendChild(script){
      if(!script.src)return;
      scripts.push(script);
      queueMicrotask(()=>{
        if(script.dataset.mmlModuleId==='clinical-loader'){
          assert.equal(app.innerHTML,'login');
          assert.equal(script.dataset.autoload,'false');
          clinicalStarted=true;
          if(failClinical)return script.onerror();
          context.MMLClinicalLoader={loadClinicalPlatform:()=>new Promise(()=>{})};
        }else{
          if(failCore)return script.onerror();
          app.innerHTML='login';
        }
        script.onload();
      });
    }}};
  const context={document,console:{info(){},warn(){},error(){}},
    setTimeout(fn){timers.set(++sequence,fn);return sequence;},clearTimeout(id){timers.delete(id);},
    MMLAdminModuleManifest:{build:'test',mode:'production',resolve:()=>[{id:'admin-main',src:'./main.js',required:true}],validate:()=>({ok:true})}};
  context.window=context;
  vm.runInNewContext(source,context);
  await new Promise(resolve=>setImmediate(resolve));
  assert.equal(context.MMLAdminBootstrap.diagnostics.status,failCore?'failed':'ready');
  assert.equal(clinicalStarted,!failCore);
  assert.equal(links[0].rel,'preload');
  if(failCore)assert.match(app.innerHTML,/초기화에 실패/);
  else assert.equal(app.innerHTML,'login');
  if(failClinical)assert.equal(banner.id,'mml-clinical-warning');
}
await run(); // Clinical runtime never resolves; login must still be ready.
await run({failCore:true});
await run({failClinical:true});
console.log('Admin bootstrap: slow clinical runtime, required failure, optional failure passed.');
