(function (global) {
  'use strict';

  const NS = global.MMLClinicalModules = global.MMLClinicalModules || {};

  function keysOf(value) {
    return value && typeof value === 'object' ? Object.keys(value) : [];
  }

  function checkModule(name, requiredFunctions) {
    const module = NS[name] || {};
    const missing = requiredFunctions.filter((fn) => typeof module[fn] !== 'function');
    return {
      name,
      loaded: keysOf(module).length > 0,
      ready: missing.length === 0,
      missing
    };
  }

  function safeCall(label, fn) {
    try {
      return { label, ok: true, value: fn() };
    } catch (error) {
      return {
        label,
        ok: false,
        error: error && error.message ? error.message : String(error)
      };
    }
  }

  function inspectStorage() {
    const result = { available: false, keys: [], error: null };
    try {
      if (!global.localStorage) return result;
      result.available = true;
      for (let i = 0; i < global.localStorage.length; i += 1) {
        const key = global.localStorage.key(i);
        if (key && /modumam|mml|clinical|report|assessment|counsel/i.test(key)) {
          result.keys.push(key);
        }
      }
      result.keys.sort();
    } catch (error) {
      result.error = error && error.message ? error.message : String(error);
    }
    return result;
  }

  function runPlatformDiagnostics(options) {
    const settings = Object.assign({ runSmokeTest: true }, options || {});
    const checks = [
      checkModule('evidence', ['buildEvidence']),
      checkModule('reasoning', ['buildReasoning']),
      checkModule('reportService', ['getReports', 'approveReport', 'publishReport']),
      checkModule('clinicalStore', ['inspectClinicalStore', 'buildCaseSnapshot']),
      checkModule('clinicalWorkflow', ['startWorkflow']),
      checkModule('homepageBridge', ['buildHomepageView', 'getMindRecordCards']),
      checkModule('adminBridge', ['getAdminCase', 'getReportQueue']),
      checkModule('selfReview', ['reviewClinicalOutput'])
    ];

    const runtime = [];
    const engine = global.MMLClinicalEngine || {};

    runtime.push(safeCall('inspectClinicalModules', function () {
      return typeof engine.inspectClinicalModules === 'function'
        ? engine.inspectClinicalModules()
        : { ready: false, reason: 'inspectClinicalModules API 없음' };
    }));

    if (typeof engine.inspectClinicalStore === 'function') {
      runtime.push(safeCall('inspectClinicalStore', function () {
        return engine.inspectClinicalStore();
      }));
    }

    if (typeof engine.inspectReportService === 'function') {
      runtime.push(safeCall('inspectReportService', function () {
        return engine.inspectReportService();
      }));
    }

    if (settings.runSmokeTest && typeof engine.runClinicalIntegrationValidation === 'function') {
      runtime.push(safeCall('runClinicalIntegrationValidation', function () {
        return engine.runClinicalIntegrationValidation();
      }));
    }

    const failedModules = checks.filter((item) => !item.ready);
    const failedRuntime = runtime.filter((item) => !item.ok);
    const ready = failedModules.length === 0 && failedRuntime.length === 0;

    return {
      ready,
      checkedAt: new Date().toISOString(),
      version: '1.0.0',
      modules: checks,
      runtime,
      storage: inspectStorage(),
      summary: {
        moduleCount: checks.length,
        failedModuleCount: failedModules.length,
        failedRuntimeCount: failedRuntime.length
      }
    };
  }

  function printPlatformDiagnostics(options) {
    const result = runPlatformDiagnostics(options);
    const method = result.ready ? 'info' : 'warn';
    if (global.console && typeof global.console.groupCollapsed === 'function') {
      global.console.groupCollapsed('[MML Clinical] 플랫폼 진단: ' + (result.ready ? '정상' : '확인 필요'));
      global.console[method](result);
      global.console.table(result.modules.map(function (item) {
        return {
          module: item.name,
          loaded: item.loaded,
          ready: item.ready,
          missing: item.missing.join(', ')
        };
      }));
      global.console.groupEnd();
    }
    return result;
  }

  NS.platformDiagnostics = Object.freeze({
    runPlatformDiagnostics,
    printPlatformDiagnostics,
    inspectStorage
  });
})(window);
