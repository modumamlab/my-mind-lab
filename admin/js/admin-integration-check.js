(function (global) {
  'use strict';

  const REQUIRED_ENGINE_APIS = [
    'inspectClinicalPlatform',
    'inspectReportService',
    'inspectClinicalStore',
    'getAdminCase',
    'getReportQueue',
    'approveAndPublishReport',
    'syncElectronicChart'
  ];

  function safeCall(fn, fallback) {
    try { return fn(); } catch (error) { return fallback === undefined ? { error: error.message || String(error) } : fallback; }
  }

  function checkFunction(target, name) {
    return Boolean(target && typeof target[name] === 'function');
  }

  function buildResult() {
    const engine = global.MMLClinicalEngine || null;
    const loader = global.MMLClinicalLoader || null;
    const reportStore = global.MMLReportStore || null;
    const assessmentStore = global.MMLClinicalAssessmentStore || null;
    const missing = [];

    if (!engine) missing.push('MMLClinicalEngine');
    if (!loader) missing.push('MMLClinicalLoader');
    if (!reportStore) missing.push('MMLReportStore');
    if (!assessmentStore) missing.push('MMLClinicalAssessmentStore');

    REQUIRED_ENGINE_APIS.forEach(function (name) {
      if (!checkFunction(engine, name)) missing.push('MMLClinicalEngine.' + name);
    });

    const loaderState = loader && checkFunction(loader, 'inspectClinicalLoadState')
      ? safeCall(function () { return loader.inspectClinicalLoadState(); }, null)
      : null;
    const runtimeState = engine && checkFunction(engine, 'getClinicalRuntimeState')
      ? safeCall(function () { return engine.getClinicalRuntimeState(); }, null)
      : null;
    const platform = engine && checkFunction(engine, 'inspectClinicalPlatform')
      ? safeCall(function () { return engine.inspectClinicalPlatform(); }, null)
      : null;
    const reportService = engine && checkFunction(engine, 'inspectReportService')
      ? safeCall(function () { return engine.inspectReportService(); }, null)
      : null;
    const clinicalStore = engine && checkFunction(engine, 'inspectClinicalStore')
      ? safeCall(function () { return engine.inspectClinicalStore(); }, null)
      : null;

    const failures = [];
    if (loaderState && loaderState.status !== 'ready') failures.push('Clinical Loader 상태: ' + loaderState.status);
    if (runtimeState && runtimeState.status && runtimeState.status !== 'ready') failures.push('Clinical Runtime 상태: ' + runtimeState.status);
    if (platform && platform.ready === false) failures.push('Clinical Platform 진단 실패');
    if (reportService && reportService.ready === false) failures.push('Unified Report Service 연결 실패');
    if (clinicalStore && clinicalStore.ready === false) failures.push('Unified Clinical Store 연결 실패');

    return {
      ready: missing.length === 0 && failures.length === 0,
      checkedAt: new Date().toISOString(),
      missing: missing,
      failures: failures,
      loader: loaderState,
      runtime: runtimeState,
      platform: platform,
      reportService: reportService,
      clinicalStore: clinicalStore
    };
  }

  function removeBanner() {
    const old = global.document && global.document.getElementById('mml-admin-integration-error');
    if (old) old.remove();
  }

  function showFailure(result) {
    if (!global.document || !global.document.body) return;
    removeBanner();
    const box = global.document.createElement('div');
    box.id = 'mml-admin-integration-error';
    box.setAttribute('role', 'alert');
    box.style.cssText = 'position:fixed;left:16px;right:16px;bottom:16px;z-index:99999;max-width:920px;margin:auto;padding:14px 16px;border:1px solid #fca5a5;border-radius:14px;background:#fff1f2;color:#9f1239;box-shadow:0 12px 30px rgba(15,23,42,.18);font:600 13px/1.55 system-ui,sans-serif';
    const details = result.missing.concat(result.failures).join(' · ') || '알 수 없는 초기화 오류';
    box.innerHTML = '<strong>임상 플랫폼 연결을 확인해 주세요.</strong><div style="margin-top:4px;font-weight:500">' + details.replace(/[&<>"']/g, function (ch) { return ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[ch]; }) + '</div>';
    global.document.body.appendChild(box);
  }

  function run(options) {
    const settings = Object.assign({ showFailureBanner: true }, options || {});
    const result = buildResult();
    global.MMLAdminIntegrationState = result;
    if (result.ready) removeBanner();
    else if (settings.showFailureBanner) showFailure(result);
    try { global.dispatchEvent(new CustomEvent('mml:admin-integration-checked', { detail: result })); } catch (_) {}
    if (global.console) {
      (result.ready ? global.console.info : global.console.error)('[MML Admin Integration Check]', result);
    }
    return result;
  }

  global.MMLAdminIntegrationCheck = Object.freeze({ run: run, inspect: buildResult });
})(window);
