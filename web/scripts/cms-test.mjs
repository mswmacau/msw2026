/**
 * 後台內容管理驗證：
 * 管理員在後台改網站名稱 / 配色 / 新增活動 → 前台立即生效
 */
const BASE = 'http://localhost:3000';
let jar = new Map();

function cookieHeader() {
  return [...jar].map(([k, v]) => `${k}=${v}`).join('; ');
}
function storeCookies(res) {
  const raw = res.headers.getSetCookie?.() || [];
  for (const c of raw) {
    const [pair] = c.split(';');
    const idx = pair.indexOf('=');
    jar.set(pair.slice(0, idx).trim(), pair.slice(idx + 1).trim());
  }
}
async function req(path, opts = {}) {
  const res = await fetch(BASE + path, {
    ...opts,
    redirect: 'manual',
    headers: { ...(opts.headers || {}), Cookie: cookieHeader() },
  });
  storeCookies(res);
  return res;
}
function log(step, ok, extra = '') {
  console.log(`${ok ? '✅' : '❌'} ${step}${extra ? ' — ' + extra : ''}`);
  if (!ok) process.exitCode = 1;
}
async function login(email, password) {
  jar = new Map();
  const csrfRes = await req('/api/auth/csrf');
  const { csrfToken } = await csrfRes.json();
  const body = new URLSearchParams({ csrfToken, email, password, json: 'true' });
  await req('/api/auth/callback/credentials', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });
  const sess = await req('/api/auth/session');
  return await sess.json().catch(() => ({}));
}
const j = async (r) => await r.json().catch(() => ({}));

console.log('\n===== MSW 後台內容管理驗證 =====\n');

// 0. 一般會員不該能改設定
const mem = await login('ming@msw.mo', 'msw2026');
const noPerm = await req('/api/admin/settings', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ site_name: 'HACKED' }) });
log('一般會員改設定被擋（403）', noPerm.status === 403, `HTTP ${noPerm.status}`);

// 1. 管理員登入
const admin = await login('admin@msw.mo', 'msw2026admin');
log('管理員登入', admin?.user?.email === 'admin@msw.mo', admin?.user?.email || '失敗');

// 2. 讀取設定
const before = await j(await req('/api/admin/settings'));
log('讀取網站設定', !!before.settings?.site_name, before.settings?.site_name);

// 3. 改網站名稱 + 主色
const put = await req('/api/admin/settings', {
  method: 'PUT',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ site_name: 'MSW 街健館（測試）', theme_primary: '#00C2FF' }),
});
log('儲存網站設定', put.ok, JSON.stringify(await j(put)));

// 4. 前台首頁應顯示新名稱
const home = await (await req('/')).text();
log('首頁套用新網站名稱', home.includes('MSW 街健館（測試）'));
log('首頁套用新主色（CSS 變數）', home.includes('--c-cobalt-bright:0 194 255'), '--c-cobalt-bright:0 194 255');

// 5. 活動管理：匯入內建活動
const seed = await j(await req('/api/admin/activities', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ seed: true }),
}));
log('匯入內建活動', seed.ok, `added=${seed.added}`);

// 6. 新增一個自訂活動
const slug = `qa-test-${Date.now().toString().slice(-6)}`;
const created = await j(await req('/api/admin/activities', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    title: '週三核心訓練班',
    subtitle: '每週三 19:30 – 20:30',
    slug,
    tag: '課程',
    schedule: '每週三 19:30 – 20:30',
    location: '澳門 · 祐漢公園',
    points: '每次 8 分',
    description: '核心與下肢穩定性訓練，適合所有程度。',
    highlights: ['不需器材', '新手可參加'],
    published: true,
    sortOrder: 9,
  }),
}));
log('新增活動', created.ok, `slug=${created.slug}`);

// 6b. 純中文活動名稱（不填網址代稱）→ 內頁不能 404（QA 曾回報 P1）
const cnSlug = await j(await req('/api/admin/activities', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    title: '週三核心訓練班',
    schedule: '每週三 19:30',
    location: '澳門',
    published: true,
  }),
}));
log('中文名稱活動建立成功', cnSlug.ok, `slug=${cnSlug.slug}`);
log('自動產生的 slug 為純英數字', /^[a-z0-9-]+$/.test(cnSlug.slug || ''), cnSlug.slug);
const cnDetail = await req(`/events/${cnSlug.slug}`);
const cnHtml = await cnDetail.text();
log('中文名稱活動內頁可開啟（非 404）', cnDetail.status === 200 && cnHtml.includes('週三核心訓練班'), `HTTP ${cnDetail.status}`);
await req(`/api/admin/activities?id=${cnSlug.id}`, { method: 'DELETE' });

// 7. 前台活動頁應出現新活動
const events = await (await req('/events')).text();
log('活動頁顯示新增活動', events.includes('週三核心訓練班'));

// 8. 活動內頁
const detail = await req(`/events/${slug}`);
const detailHtml = await detail.text();
log('活動內頁可開啟', detail.status === 200 && detailHtml.includes('週三核心訓練班'), `HTTP ${detail.status}`);
log('活動內頁顯示地點', detailHtml.includes('祐漢公園'));

// 9. 下架後前台消失
await req('/api/admin/activities', {
  method: 'PATCH',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ id: created.id, published: false }),
});
const events2 = await (await req('/events')).text();
log('下架後前台不再顯示', !events2.includes('週三核心訓練班'));

// 10. 刪除
const del = await req(`/api/admin/activities?id=${created.id}`, { method: 'DELETE' });
log('刪除活動', del.ok, `HTTP ${del.status}`);

// 11. 還原設定
await req('/api/admin/settings', {
  method: 'PUT',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ site_name: 'MSW 街健館', theme_primary: '#0057FF' }),
});
const home2 = await (await req('/')).text();
log('還原網站名稱', home2.includes('MSW 街健館') && !home2.includes('MSW 街健館（測試）'));

console.log('\n===== 驗證結束 =====\n');
