import * as L from './live-lib.mjs';
import fs from 'fs';

const browser = await L.launch();
const out = {};

const http = async (path, opts = {}) => {
  const res = await fetch(L.BASE + path, { redirect: 'manual', ...opts });
  let text = '';
  try { text = (await res.text()).slice(0, 200); } catch {}
  return { status: res.status, location: res.headers.get('location'), body: text };
};

/* ---- 1) 無 token 存取受保護頁面 ---- */
for (const r of ['/dashboard', '/admin']) {
  out[`anon_${r}`] = await http(r);
}

/* ---- 2) 無 token 呼叫受保護 API ---- */
for (const r of ['/api/auth/session', '/api/me', '/api/runs', '/api/admin/pending']) {
  try { out[`anonapi_${r}`] = await http(r); } catch (e) { out[`anonapi_${r}`] = { err: String(e.message) }; }
}

/* ---- 3) 一般會員存取管理 API（應 401/403） ---- */
const m = await L.newPage(browser);
const EMAIL = JSON.parse(fs.readFileSync(`${L.SHOTS}/live-main-result.json`, 'utf8')).EMAIL;
const PASS = 'liveTest2026';
await L.login(m, EMAIL, PASS);
const cookies = await m.cookies();
const cookieHeader = cookies.map((c) => `${c.name}=${c.value}`).join('; ');
out.memberSession = { cookieCount: cookies.length };

for (const r of ['/api/admin/pending', '/api/admin/approve', '/api/admin/redeem']) {
  try {
    out[`memberapi_${r}`] = await http(r, { headers: { cookie: cookieHeader } });
  } catch (e) { out[`memberapi_${r}`] = { err: String(e.message) }; }
}

/* 會員嘗試 POST 核准（IDOR / 越權） */
try {
  out.memberApprovePost = await http('/api/admin/approve', {
    method: 'POST',
    headers: { cookie: cookieHeader, 'content-type': 'application/json' },
    body: JSON.stringify({ id: 999999, action: 'approve' }),
  });
} catch (e) { out.memberApprovePost = { err: String(e.message) }; }

/* ---- 4) 參數邊界：負數 / 超大 / 非數字 ---- */
for (const bad of ['-1', '0', '99999999999999999999', 'abc', "1' OR '1'='1"]) {
  try {
    out[`param_${bad}`] = await http(`/api/media/${encodeURIComponent(bad)}`);
  } catch (e) { out[`param_${bad}`] = { err: String(e.message) }; }
}

/* ---- 5) 頁面層 IDOR：會員是否能看到他人資料 ---- */
await m.goto(`${L.BASE}/admin`, { waitUntil: 'networkidle2', timeout: 90000 });
await L.sleep(2000);
out.memberSeesAdmin = {
  path: m.url().replace(L.BASE, ''),
  hasAdminConsole: /ADMIN CONSOLE|待確認截圖/.test(await L.bodyText(m)),
};

fs.writeFileSync(`${L.SHOTS}/live-sec-result.json`, JSON.stringify(out, null, 2));
console.log(L.dump(out));
await browser.close();
