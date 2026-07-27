const REQUIRED_MODULES = [
  './admin-compatibility.js',
  './reservations/reservation-store.js',
  './reservations/reservation-service.js',
  './reservations/reservation-actions.js',
  './reservations/reservation-events.js'
];

export async function verifyAdminModules() {
  const results = [];
  for (const path of REQUIRED_MODULES) {
    try {
      await import(path);
      results.push({ path, ok: true });
    } catch (error) {
      results.push({ path, ok: false, error: String(error?.message || error) });
    }
  }
  return { ok: results.every(item => item.ok), results };
}

export function printModuleCheck(report) {
  report.results.forEach(item => {
    const method = item.ok ? 'info' : 'error';
    console[method](`[MML Admin] ${item.ok ? '확인' : '실패'} ${item.path}`, item.error || '');
  });
  return report.ok;
}
