(function (global) {
  'use strict';

  const NS = global.MMLClinicalModules = global.MMLClinicalModules || {};
  const DEFAULT_SCRIPTS = [
    'core/evidence-builder.js',
    'core/reasoning-engine.js',
    'core/case-object.js',
    'composer/client-report.js',
    'composer/clinician-report.js',
    'composer/parent-report.js',
    'composer/ai-counseling.js',
    'composer/index.js',
    'review/self-review.js',
    'review/integration-validator.js',
    'report-engine.js',
    'counseling-session-service.js',
    'counseling-case-bridge.js',
    'case-concept-bridge.js',
    'workflow/clinical-workflow.js',
    'integration/clinical-app-bridge.js',
    'services/report-service.js',
    'store/clinical-store.js',
    'bootstrap/clinical-bootstrap.js',
    'integration/homepage-bridge.js',
    'integration/admin-bridge.js',
    'diagnostics/platform-diagnostics.js',
    'index.js',
    'bootstrap/clinical-runtime.js'
  ];

  const loaderScript = global.document && global.document.currentScript;
  const AUTOLOAD_ENABLED = !(loaderScript && String(loaderScript.dataset.autoload || '').toLowerCase() === 'false');
  const LOADER_VERSION = '20260724-clinical-loader-v7-compatible-module';
  let loadPromise = null;

  let loadState = {
    status: 'idle',
    startedAt: null,
    completedAt: null,
    baseUrl: '',
    loaded: [],
    skipped: [],
    failed: [],
    duplicateScripts: [],
    error: null
  };

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function normalizeUrl(url) {
    try { return new URL(url, global.document && global.document.baseURI || global.location.href).href; }
    catch (_) { return String(url || ''); }
  }

  function currentScriptUrl() {
    if (!global.document) return '';
    const current = global.document.currentScript;
    if (current && current.src) return current.src;
    const scripts = Array.from(global.document.scripts || []);
    const found = scripts.reverse().find(function (script) {
      return /clinical\/bootstrap\/clinical-loader\.js(?:\?|#|$)/.test(script.src || '');
    });
    return found && found.src || '';
  }

  function getBuildToken(explicitToken) {
    if (explicitToken) return String(explicitToken);
    const source = currentScriptUrl();
    try {
      const parsed = new URL(source, global.location && global.location.href || undefined);
      return parsed.searchParams.get('v') || LOADER_VERSION;
    } catch (_) {
      return LOADER_VERSION;
    }
  }

  function appendBuildToken(url, token) {
    if (!token) return normalizeUrl(url);
    try {
      const parsed = new URL(url, global.document && global.document.baseURI || global.location.href);
      if (!parsed.searchParams.has('v')) parsed.searchParams.set('v', token);
      return parsed.href;
    } catch (_) {
      return String(url || '');
    }
  }

  function resolveBaseUrl(explicitBase) {
    if (explicitBase) return normalizeUrl(String(explicitBase).replace(/\/?$/, '/'));
    const source = currentScriptUrl();
    if (!source) return normalizeUrl('./js/modules/clinical/');
    return normalizeUrl(new URL('../', source).href);
  }

  function canonicalScriptKey(url) {
    try {
      const parsed = new URL(url, global.document && global.document.baseURI || global.location.href);
      return parsed.origin + parsed.pathname;
    } catch (_) {
      return String(url || '').split(/[?#]/)[0];
    }
  }

  function scriptElementsByUrl() {
    const map = new Map();
    if (!global.document) return map;
    Array.from(global.document.scripts || []).forEach(function (script) {
      if (!script.src) return;
      const url = normalizeUrl(script.src);
      const key = canonicalScriptKey(url);
      const list = map.get(key) || [];
      list.push(script);
      map.set(key, list);
    });
    return map;
  }

  function detectDuplicateScripts() {
    const duplicates = [];
    scriptElementsByUrl().forEach(function (elements, url) {
      if (elements.length > 1) duplicates.push({ url: url, count: elements.length });
    });
    return duplicates;
  }

  function hasScript(url) {
    return scriptElementsByUrl().has(canonicalScriptKey(normalizeUrl(url)));
  }

  function loadScript(url, options) {
    const settings = Object.assign({ timeoutMs: 15000 }, options || {});
    const absolute = normalizeUrl(url);

    if (hasScript(absolute)) {
      return Promise.resolve({ url: absolute, skipped: true });
    }
    if (!global.document || !global.document.head) {
      return Promise.reject(new Error('문서 head를 찾을 수 없습니다: ' + absolute));
    }

    return new Promise(function (resolve, reject) {
      const script = global.document.createElement('script');
      let settled = false;
      const timer = global.setTimeout(function () {
        if (settled) return;
        settled = true;
        script.remove();
        reject(new Error('스크립트 로드 시간 초과: ' + absolute));
      }, Math.max(1000, Number(settings.timeoutMs) || 15000));

      script.src = absolute;
      script.async = false;
      if (settings.type) script.type = settings.type;
      script.dataset.mmlClinicalLoader = 'true';
      script.onload = function () {
        if (settled) return;
        settled = true;
        global.clearTimeout(timer);
        resolve({ url: absolute, skipped: false });
      };
      script.onerror = function () {
        if (settled) return;
        settled = true;
        global.clearTimeout(timer);
        script.remove();
        reject(new Error('스크립트 로드 실패: ' + absolute));
      };
      global.document.head.appendChild(script);
    });
  }

  async function loadClinicalPlatform(options) {
    const settings = Object.assign({
      baseUrl: '',
      scripts: DEFAULT_SCRIPTS,
      timeoutMs: 15000,
      force: false,
      startRuntime: true,
      buildToken: ''
    }, options || {});

    if (loadState.status === 'ready' && !settings.force) {
      return { ready: true, state: clone(loadState), engine: global.MMLClinicalEngine || null };
    }
    if (loadPromise && loadState.status === 'loading' && !settings.force) {
      return loadPromise;
    }

    const baseUrl = resolveBaseUrl(settings.baseUrl);
    const buildToken = getBuildToken(settings.buildToken);
    loadState = {
      status: 'loading',
      startedAt: new Date().toISOString(),
      completedAt: null,
      baseUrl: baseUrl,
      buildToken: buildToken,
      loaded: [],
      skipped: [],
      failed: [],
      duplicateScripts: detectDuplicateScripts(),
      error: null
    };

    loadPromise = (async function () {
      try {
        for (const relativePath of settings.scripts) {
          const url = appendBuildToken(new URL(relativePath, baseUrl).href, buildToken);
          try {
            const result = await loadScript(url, {
              timeoutMs: settings.timeoutMs,
              type: relativePath === 'report-engine.js' ? 'module' : ''
            });
            (result.skipped ? loadState.skipped : loadState.loaded).push(relativePath);
          } catch (error) {
            loadState.failed.push({ path: relativePath, message: error.message });
            throw error;
          }
        }

        if (global.MMLClinicalEngine && typeof global.MMLClinicalEngine.refreshClinicalEngine === 'function') {
          global.MMLClinicalEngine.refreshClinicalEngine();
        }
        if (settings.startRuntime && global.MMLClinicalEngine && typeof global.MMLClinicalEngine.startClinicalRuntime === 'function') {
          await global.MMLClinicalEngine.startClinicalRuntime({ force: settings.force });
        }

        loadState.status = 'ready';
        loadState.completedAt = new Date().toISOString();
        loadState.duplicateScripts = detectDuplicateScripts();
        global.dispatchEvent(new CustomEvent('mml:clinical-loader-ready', { detail: clone(loadState) }));
        return { ready: true, state: clone(loadState), engine: global.MMLClinicalEngine || null };
      } catch (error) {
        loadState.status = 'error';
        loadState.error = error && error.message ? error.message : String(error);
        loadState.completedAt = new Date().toISOString();
        try { global.dispatchEvent(new CustomEvent('mml:clinical-loader-error', { detail: clone(loadState) })); } catch (_) {}
        throw error;
      } finally {
        loadPromise = null;
      }
    })();
    return loadPromise;
  }

  async function retryClinicalPlatform(options) {
    const token = 'retry-' + Date.now();
    return loadClinicalPlatform(Object.assign({}, options || {}, { force: true, buildToken: token }));
  }

  function inspectClinicalLoadState() {
    const state = clone(loadState);
    state.duplicateScripts = detectDuplicateScripts();
    state.ready = state.status === 'ready' && state.failed.length === 0;
    return state;
  }

  function autoLoad() {
    if (!AUTOLOAD_ENABLED) return;
    loadClinicalPlatform().catch(function (error) {
      if (global.console && typeof global.console.error === 'function') {
        global.console.error('[MML Clinical Loader] 초기화 실패', error);
      }
    });
  }

  NS.clinicalLoader = Object.freeze({
    VERSION: LOADER_VERSION,
    DEFAULT_SCRIPTS: DEFAULT_SCRIPTS.slice(),
    loadClinicalPlatform: loadClinicalPlatform,
    retryClinicalPlatform: retryClinicalPlatform,
    inspectClinicalLoadState: inspectClinicalLoadState,
    detectDuplicateScripts: detectDuplicateScripts
  });
  global.MMLClinicalLoader = NS.clinicalLoader;

  if (global.document) {
    if (global.document.readyState === 'loading') {
      global.document.addEventListener('DOMContentLoaded', autoLoad, { once: true });
    } else {
      global.setTimeout(autoLoad, 0);
    }
  }
})(window);
