console.info('[MML] ADMIN-BOOTSTRAP-260725-STEP25 loaded');

(function(global){
  'use strict';

  const externalManifest=global.MMLAdminModuleManifest;
  if(!externalManifest){
    throw new Error('관리자 모듈 manifest를 찾을 수 없습니다.');
  }

  const BUILD=externalManifest.build;
  const manifest=Object.freeze(externalManifest.resolve());
  const registry=new Map();
  const diagnostics={
    build:BUILD,
    mode:externalManifest.mode,
    startedAt:'',
    completedAt:'',
    status:'idle',
    loaded:[],
    skipped:[],
    failed:[],
    clinicalError:null
  };

  function now(){return new Date().toISOString()}

  function existingScript(src){
    const base=String(src||'').split('?')[0];
    return [...document.scripts].find(script=>{
      const current=script.getAttribute('src')||'';
      return current.split('?')[0]===base;
    })||null;
  }

  function waitForExisting(script,timeout){
    return new Promise((resolve,reject)=>{
      if(script.dataset.mmlLoaded==='true') return resolve(script);
      const timer=setTimeout(()=>reject(new Error('기존 스크립트 로드 대기시간 초과: '+script.src)),timeout);
      script.addEventListener('load',()=>{
        clearTimeout(timer);
        script.dataset.mmlLoaded='true';
        resolve(script);
      },{once:true});
      script.addEventListener('error',()=>{
        clearTimeout(timer);
        reject(new Error('기존 스크립트 로드 실패: '+script.src));
      },{once:true});
    });
  }

  function loadScript(item,options={}){
    const timeout=Number(options.timeout||15000);
    if(registry.has(item.id)) return registry.get(item.id);

    const promise=new Promise((resolve,reject)=>{
      const prior=existingScript(item.src);
      if(prior){
        diagnostics.skipped.push({id:item.id,reason:'already-present'});
        waitForExisting(prior,timeout).then(resolve,reject);
        return;
      }

      const script=document.createElement('script');
      script.src=item.src;
      if(item.type) script.type=item.type;
      script.dataset.mmlModuleId=item.id;
      script.async=false;

      const timer=setTimeout(()=>{
        script.remove();
        reject(new Error(`스크립트 로드 시간 초과: ${item.id}`));
      },timeout);

      script.onload=()=>{
        clearTimeout(timer);
        script.dataset.mmlLoaded='true';
        diagnostics.loaded.push({id:item.id,at:now()});
        resolve(script);
      };
      script.onerror=()=>{
        clearTimeout(timer);
        reject(new Error(`스크립트 로드 실패: ${item.id} (${item.src})`));
      };
      document.body.appendChild(script);
    });

    registry.set(item.id,promise);
    return promise;
  }

  function dependencyCheck(item){
    const missing=(item.dependsOn||[]).filter(id=>{
      if(diagnostics.loaded.some(row=>row.id===id)) return false;
      if(diagnostics.skipped.some(row=>row.id===id)) return false;
      if(registry.has(id)) return false;
      const prior=manifest.find(row=>row.id===id);
      if(prior && existingScript(prior.src)) return false;
      return true;
    });
    if(missing.length) throw new Error(`${item.id} 의존 모듈 누락: ${missing.join(', ')}`);
  }

  async function loadManifest(){
    const manifestCheck=externalManifest.validate();
    if(!manifestCheck.ok){
      throw new Error('모듈 manifest 오류: '+manifestCheck.errors.join(' / '));
    }

    for(const item of manifest){
      try{
        dependencyCheck(item);
        await loadScript(item);
      }catch(error){
        diagnostics.failed.push({
          id:item.id,
          required:!!item.required,
          message:String(error?.message||error),
          at:now()
        });
        console.error('[MML Bootstrap] 모듈 로드 실패',item.id,error);
        if(item.required) throw error;
      }
    }
  }

  function showFatal(error){
    const app=document.getElementById('app');
    if(!app) return;
    app.innerHTML=`<div style="max-width:760px;margin:48px auto;padding:24px;background:#fff;border:1px solid #fecaca;border-radius:16px;color:#991b1b;font-family:system-ui,sans-serif">
      <strong style="font-size:18px">관리자 페이지 초기화에 실패했습니다.</strong>
      <p style="margin:10px 0 0;line-height:1.65">새로고침 후에도 같은 문제가 있으면 아래 오류를 확인해 주세요.</p>
      <pre style="margin-top:14px;padding:12px;overflow:auto;background:#fff1f2;border-radius:10px;white-space:pre-wrap">${escapeHtml(String(error?.message||error))}</pre>
      <button type="button" onclick="location.reload()" style="margin-top:14px;border:0;border-radius:10px;background:#991b1b;color:#fff;padding:9px 14px;font-weight:700;cursor:pointer">다시 불러오기</button>
    </div>`;
  }

  function showClinicalWarning(error){
    let banner=document.getElementById('mml-clinical-warning');
    if(banner) banner.remove();
    banner=document.createElement('div');
    banner.id='mml-clinical-warning';
    banner.setAttribute('role','alert');
    banner.style.cssText='position:fixed;left:16px;right:16px;bottom:16px;z-index:99999;max-width:920px;margin:auto;padding:14px 16px;background:#fff7ed;border:1px solid #fdba74;border-radius:14px;color:#9a3412;box-shadow:0 10px 30px rgba(15,23,42,.16);font-family:system-ui,sans-serif';
    banner.innerHTML='<strong>임상 통합 모듈 일부를 불러오지 못했습니다.</strong><span style="display:block;margin-top:4px;line-height:1.5">관리자 기본 화면은 계속 사용할 수 있습니다.</span><button type="button" id="mml-clinical-retry" style="margin-top:9px;padding:7px 12px;border:0;border-radius:9px;background:#c2410c;color:white;cursor:pointer">다시 연결</button>';
    document.body.appendChild(banner);

    const retry=document.getElementById('mml-clinical-retry');
    if(retry) retry.onclick=async()=>{
      retry.disabled=true;
      retry.textContent='연결 중…';
      try{
        if(!global.MMLClinicalLoader) throw new Error('Clinical Loader를 찾을 수 없습니다.');
        const fn=global.MMLClinicalLoader.retryClinicalPlatform||global.MMLClinicalLoader.loadClinicalPlatform;
        await fn.call(global.MMLClinicalLoader,{startRuntime:true,buildToken:BUILD});
        banner.remove();
        if(externalManifest.mode==='development') global.MMLAdminIntegrationCheck?.run?.();
      }catch(retryError){
        retry.disabled=false;
        retry.textContent='다시 연결';
        console.error('[MML Clinical Retry] 실패',retryError);
      }
    };
    console.error('[MML Clinical Bootstrap] 임상 모듈 연결 실패',error);
  }

  function escapeHtml(value=''){
    return String(value??'')
      .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
      .replace(/"/g,'&quot;').replace(/'/g,'&#039;');
  }

  async function startClinical(){
    const loaderPath='./js/modules/clinical/bootstrap/clinical-loader.js?v=20260724-clinical-loader-v5';

    try{
      if(!global.MMLClinicalLoader?.loadClinicalPlatform){
        const response=await fetch(loaderPath,{method:'HEAD',cache:'no-store'});
        if(!response.ok){
          diagnostics.clinicalError=null;
          diagnostics.skipped.push({
            id:'clinical-platform',
            reason:'loader-not-installed'
          });
          console.info('[MML Clinical] 선택 모듈이 설치되어 있지 않아 건너뜁니다.');
          return null;
        }

        await loadScript({
          id:'clinical-loader',
          src:loaderPath,
          required:false
        });
      }

      if(!global.MMLClinicalLoader?.loadClinicalPlatform){
        diagnostics.skipped.push({
          id:'clinical-platform',
          reason:'loader-unavailable'
        });
        return null;
      }

      await global.MMLClinicalLoader.loadClinicalPlatform({
        startRuntime:true,
        buildToken:BUILD
      });

      diagnostics.loaded.push({
        id:'clinical-platform',
        at:now()
      });
      return null;
    }catch(error){
      diagnostics.clinicalError=String(error?.message||error);
      diagnostics.failed.push({
        id:'clinical-platform',
        required:false,
        message:String(error?.message||error),
        at:now()
      });
      console.warn('[MML Clinical] 선택 모듈 연결 실패. 관리자 기본 기능은 계속 실행합니다.',error);
      return null;
    }
  }

  async function start(){
    if(diagnostics.status==='starting'||diagnostics.status==='ready') return diagnostics;
    diagnostics.status='starting';
    diagnostics.startedAt=now();

    const clinicalError=await startClinical();

    try{
      await loadManifest();
      global.MMLAdminIntegrationCheck?.run?.();
      if(clinicalError && global.MMLClinicalLoader){
        showClinicalWarning(clinicalError);
      }
      diagnostics.status='ready';
      diagnostics.completedAt=now();
      global.MMLHealth?.markModule?.('admin-bootstrap','loaded',BUILD);
      return diagnostics;
    }catch(error){
      diagnostics.status='failed';
      diagnostics.completedAt=now();
      global.MMLHealth?.captureError?.(error,'admin-bootstrap');
      showFatal(error);
      throw error;
    }
  }

  function retryFailed(){
    diagnostics.failed=[];
    diagnostics.status='idle';
    return start();
  }

  global.MMLAdminBootstrap=Object.freeze({
    version:'20260725-step25',
    build:BUILD,
    mode:externalManifest.mode,
    manifest,
    diagnostics,
    start,
    retryFailed
  });

  start().catch(error=>{
    console.error('[MML Admin Bootstrap] 시작 실패',error);
  });
})(window);
