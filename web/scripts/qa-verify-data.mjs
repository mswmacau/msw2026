const BASE = 'http://localhost:3000';
let jar = new Map();
function cookieHeader() {
  return [...jar].map(([k, v]) => `${k}=${v}`).join('; ');
}
function storeCookies(res) {
  for (const c of res.headers.getSetCookie?.() || []) {
    const [pair] = c.split(';');
    const i = pair.indexOf('=');
    jar.set(pair.slice(0, i).trim(), pair.slice(i + 1).trim());
  }
}
async function apiLogin(email, password) {
  jar = new Map();
  const csrfRes = await fetch(`${BASE}/api/auth/csrf`);
  storeCookies(csrfRes);
  const csrf = await csrfRes.json();
  const res = await fetch(`${BASE}/api/auth/callback/credentials`, {
    method: 'POST',
    redirect: 'manual',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Cookie: cookieHeader() },
    body: new URLSearchParams({ csrfToken: csrf.csrfToken, email, password, json: 'true' }),
  });
  storeCookies(res);
  const sessRes = await fetch(`${BASE}/api/auth/session`, { headers: { Cookie: cookieHeader() } });
  storeCookies(sessRes);
  return sessRes.json();
}
async function get(path) {
  const r = await fetch(`${BASE}${path}`, { headers: { Cookie: cookieHeader() } });
  return { status: r.status, data: await r.json().catch(() => null) };
}

const ming = await apiLogin('ming@msw.mo', 'msw2026');
console.log('[ming] session.user =', JSON.stringify(ming?.user ?? ming));
console.log(`[ming] points = ${ming?.user?.points}, totalPoints = ${ming?.user?.totalPoints}`);

const admin = await apiLogin('admin@msw.mo', 'msw2026admin');
console.log('[admin] role =', admin?.user?.role, 'points =', admin?.user?.points);

for (const d of ['2026-09-14', '2026-09-21', '2026-09-20']) {
  const r = await get(`/api/checkin?all=1&date=${d}`);
  console.log(`[cleanup check] GET /api/checkin?all=1&date=${d} → sessionDate=${r.data?.sessionDate} count=${r.data?.count}`);
}
