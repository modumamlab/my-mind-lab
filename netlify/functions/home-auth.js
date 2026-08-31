const json = (statusCode, body) => ({
  statusCode,
  headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
  body: JSON.stringify(body)
});

function parseDotEnv(source) {
  const values = {};
  String(source || '').split(/\r?\n/).forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) return;
    const match = trimmed.match(/^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (!match) return;
    let value = match[2].trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    values[match[1]] = value;
  });
  return values;
}

let localEnvCache = null;
async function localEnv() {
  if (localEnvCache) return localEnvCache;
  localEnvCache = {};
  // Netlify production uses process.env. This fallback is only for local netlify dev
  // when the CLI does not inject an existing project-root .env into the function.
  try {
    const fs = await import('node:fs/promises');
    const path = await import('node:path');
    const candidates = [
      path.join(process.cwd(), '.env'),
      path.resolve(process.cwd(), '..', '.env')
    ];
    for (const candidate of candidates) {
      try {
        const text = await fs.readFile(candidate, 'utf8');
        localEnvCache = parseDotEnv(text);
        if (Object.keys(localEnvCache).length) break;
      } catch (_) {}
    }
  } catch (_) {}
  return localEnvCache;
}

async function authConfig() {
  const fileEnv = await localEnv();
  const url = String(
    process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL ||
    fileEnv.SUPABASE_URL || fileEnv.VITE_SUPABASE_URL || ''
  ).replace(/\/rest\/v1\/?$/i, '').replace(/\/+$/, '');
  const key = String(
    process.env.SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
    fileEnv.SUPABASE_PUBLISHABLE_KEY || fileEnv.SUPABASE_ANON_KEY || fileEnv.VITE_SUPABASE_PUBLISHABLE_KEY || ''
  ).trim();
  return { url, key };
}

async function supabaseAuth(path, body) {
  const { url, key } = await authConfig();
  if (!url || !key) {
    console.error('[HOME AUTH CONFIG]', { hasUrl: Boolean(url), hasPublishableKey: Boolean(key), cwd: process.cwd() });
    throw new Error(`Supabase 환경변수가 설정되지 않았습니다. (URL: ${url ? '확인' : '누락'}, Publishable key: ${key ? '확인' : '누락'})`);
  }
  const response = await fetch(`${url}/auth/v1/${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: key, Authorization: `Bearer ${key}` },
    body: JSON.stringify(body)
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = data.msg || data.message || data.error_description || data.error || 'Supabase 인증 요청에 실패했습니다.';
    const error = new Error(message);
    error.status = response.status;
    throw error;
  }
  return data;
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return json(405, { error: 'Method not allowed' });
  try {
    const body = JSON.parse(event.body || '{}');
    const action = String(body.action || '');
    const email = String(body.email || '').trim().toLowerCase();
    const password = String(body.password || '');
    if (!email || !password) return json(400, { error: '이메일과 비밀번호를 입력해 주세요.' });

    if (action === 'signup') {
      const name = String(body.name || '').trim();
      const phone = String(body.phone || '').replace(/[^0-9]/g, '');
      if (!name || phone.length < 8) return json(400, { error: '이름과 연락처를 정확히 입력해 주세요.' });
      const data = await supabaseAuth('signup', { email, password, data: { name, phone } });
      return json(200, { user: data.user || null, session: data.access_token ? { access_token: data.access_token, refresh_token: data.refresh_token, expires_in: data.expires_in, expires_at: data.expires_at, token_type: data.token_type, user: data.user } : null });
    }

    if (action === 'login') {
      const data = await supabaseAuth('token?grant_type=password', { email, password });
      return json(200, { session: { access_token: data.access_token, refresh_token: data.refresh_token, expires_in: data.expires_in, expires_at: data.expires_at, token_type: data.token_type, user: data.user } });
    }

    return json(400, { error: '지원하지 않는 인증 요청입니다.' });
  } catch (error) {
    console.error('[HOME AUTH]', error);
    return json(error.status || 500, { error: error.message || '회원 인증 처리 중 오류가 발생했습니다.' });
  }
};
