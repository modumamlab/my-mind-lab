(function (global) {
  'use strict';

  const NS = global.MMLClinicalModules = global.MMLClinicalModules || {};
  const DEFAULT_REQUIRED = [
    'evidence',
    'reasoning',
    'reportService',
    'clinicalStore',
    'clinicalWorkflow',
    'homepageBridge',
    'adminBridge'
  ];

  let runtimePromise = null;

  let runtimeState = {
    status: 'idle',
    startedAt: null,
    readyAt: null,
    attempts: 0,
    missing: [],
    error: null,
    diagnostics: null
  };

  function hasModule(name) {
    const module = NS[name];
    return Boolean(module && typeof module === 'object' && Object.keys(module).length);
  }

  function inspectDependencies(required) {
    const names = Array.isArray(required) && required.length ? required : DEFAULT_REQUIRED;
    const missing = names.filter(function (name) { return !hasModule(name); });
    return {
      ready: missing.length === 0,
      required: names.slice(),
      loaded: names.filter(hasModule),
      missing
    };
  }

  function emit(name, detail) {
    try {
      global.dispatchEvent(new CustomEvent(name, { detail: detail || {} }));
    } catch (_) {}
  }

  function refreshEngine() {
    if (global.MMLClinicalEngine && typeof global.MMLClinicalEngine.refreshClinicalEngine === 'function') {
      return global.MMLClinicalEngine.refreshClinicalEngine();
    }
    return global.MMLClinicalEngine || null;
  }

  async function initializeServices(options) {
    const settings = Object.assign({ force: false, runDiagnostics: true }, options || {});
    const engine = refreshEngine();
    if (!engine) throw new Error('MMLClinicalEngine을 찾을 수 없습니다. clinical/index.js 로드 순서를 확인하세요.');

    if (typeof engine.initializeClinicalPlatform === 'function') {
      await Promise.resolve(engine.initializeClinicalPlatform({ force: settings.force }));
    }

    if (typeof engine.syncCompletedSessions === 'function') {
      await Promise.resolve(engine.syncCompletedSessions());
    }

    if (settings.runDiagnostics && typeof engine.runPlatformDiagnostics === 'function') {
      const diagnostics = engine.runPlatformDiagnostics({ runSmokeTest: false });
      if (diagnostics && diagnostics.ready === false) {
        runtimeState.diagnostics = diagnostics;
        if (global.console && typeof global.console.warn === 'function') {
          global.console.warn('[MML Clinical Runtime] 플랫폼 진단 경고 — 기본 기능은 계속 시작합니다.', diagnostics);
        }
        emit('mml:clinical-runtime-diagnostics-warning', {
          diagnostics: diagnostics,
          state: getClinicalRuntimeState()
        });
      } else {
        runtimeState.diagnostics = diagnostics || null;
      }
    }

    return engine;
  }

  function startClinicalRuntime(options) {
    const settings = Object.assign({
      timeoutMs: 12000,
      intervalMs: 100,
      required: DEFAULT_REQUIRED,
      force: false,
      runDiagnostics: true
    }, options || {});

    if (runtimeState.status === 'ready' && !settings.force) {
      return Promise.resolve({ ready: true, state: getClinicalRuntimeState(), engine: global.MMLClinicalEngine });
    }
    if (runtimePromise && ['waiting', 'initializing'].includes(runtimeState.status) && !settings.force) {
      return runtimePromise;
    }

    runtimeState = {
      status: 'waiting',
      startedAt: new Date().toISOString(),
      readyAt: null,
      attempts: 0,
      missing: [],
      error: null,
      diagnostics: null
    };
    emit('mml:clinical-runtime-starting', getClinicalRuntimeState());

    runtimePromise = new Promise(function (resolve, reject) {
      const started = Date.now();

      function tick() {
        runtimeState.attempts += 1;
        const dependency = inspectDependencies(settings.required);
        runtimeState.missing = dependency.missing.slice();

        if (!dependency.ready && global.console && typeof global.console.warn === 'function') {
          global.console.warn('[MML Clinical Runtime] 누락 모듈', {
            missing: dependency.missing.slice(),
            loaded: dependency.loaded.slice(),
            required: dependency.required.slice(),
            registered: Object.keys(NS || {})
          });
        }

        if (dependency.ready) {
          runtimeState.status = 'initializing';
          initializeServices(settings).then(function (engine) {
            runtimeState.status = 'ready';
            runtimeState.readyAt = new Date().toISOString();
            runtimeState.error = null;
            const result = { ready: true, state: getClinicalRuntimeState(), engine };
            emit('mml:clinical-runtime-ready', result);
            runtimePromise = null;
            resolve(result);
          }).catch(function (error) {
            runtimeState.status = 'error';
            runtimeState.error = error && error.message ? error.message : String(error);
            emit('mml:clinical-runtime-error', getClinicalRuntimeState());
            runtimePromise = null;
            reject(error);
          });
          return;
        }

        if (Date.now() - started >= settings.timeoutMs) {
          const error = new Error('Clinical Runtime 초기화 시간 초과. 누락 모듈: ' + dependency.missing.join(', '));
          runtimeState.status = 'timeout';
          runtimeState.error = error.message;
          emit('mml:clinical-runtime-error', getClinicalRuntimeState());
          runtimePromise = null;
          reject(error);
          return;
        }

        global.setTimeout(tick, Math.max(25, Number(settings.intervalMs) || 100));
      }

      tick();
    });
    return runtimePromise;
  }

  function getClinicalRuntimeState() {
    return JSON.parse(JSON.stringify(runtimeState));
  }

  function resetClinicalRuntime() {
    runtimePromise = null;
    runtimeState = {
      status: 'idle', startedAt: null, readyAt: null, attempts: 0, missing: [], error: null, diagnostics: null
    };
    return getClinicalRuntimeState();
  }

  function autoStart() {
    startClinicalRuntime().catch(function (error) {
      if (global.console && typeof global.console.warn === 'function') {
        global.console.warn('[MML Clinical Runtime] 자동 초기화 실패', error);
      }
    });
  }

  NS.clinicalRuntime = Object.freeze({
    inspectDependencies,
    startClinicalRuntime,
    getClinicalRuntimeState,
    resetClinicalRuntime
  });

  if (global.document) {
    if (global.document.readyState === 'loading') {
      global.document.addEventListener('DOMContentLoaded', autoStart, { once: true });
    } else {
      global.setTimeout(autoStart, 0);
    }
  }
})(window);
