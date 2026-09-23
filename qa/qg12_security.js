// C: permissions & security
// 14. ming (member) login -> /admin should be denied
// 15. unauthenticated /api/admin/settings & /api/admin/activities should be 403
// + extra: member token / API access, negative & bogus param handling
const puppeteer = require('puppeteer-core');
const fs = require('fs');
const { shot, clickText, wait, BASE } = require('./harness');
const CHROME = '/usr/bin/chromium';

async function newBrowser() {
  return puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu'] });
}

(async () => {
  const browser = await newBrowser();

  // ---------- 15. UNAUTHENTICATED API ----------
  const anon = await browser.newPage();
  await anon.goto(BASE + '/login', { waitUntil: 'domcontentloaded', timeout: 30000 });
  const anonRes = await anon.evaluate(async (base) => {
    const out = {};
    for (const p of ['/api/admin/settings', '/api/admin/activities']) {
      const r = await fetch(base + p, { credentials: 'omit' });
      out[p] = { status: r.status, body: (await r.text()).slice(0, 120) };
    }
    // also try mutating methods unauthenticated
    const put = await fetch(base + '/api/admin/settings', { method: 'PUT', credentials: 'omit', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ site_name: 'HACKED' }) });
    out['PUT /api/admin/settings'] = { status: put.status, body: (await put.text()).slice(0, 120) };
    const del = await fetch(base + '/api/admin/activities?id=nonexistent', { method: 'DELETE', credentials: 'omit' });
    out['DELETE /api/admin/activities'] = { status: del.status, body: (await del.text()).slice(0, 120) };
    return out;
  }, BASE);
  console.log('--- [15] UNAUTHENTICATED ---');
  console.log(JSON.stringify(anonRes, null, 2));
  await anon.goto(BASE + '/api/admin/settings', { waitUntil: 'domcontentloaded' });
  await wait(400);
  await shot(anon, 'C01_anon_admin_settings_api');

  // ---------- 14. MEMBER LOGIN ----------
  const member = await browser.newPage();
  await member.setViewport({ width: 1440, height: 900 });
  await member.goto(BASE + '/login', { waitUntil: 'networkidle2', timeout: 30000 });
  await wait(800);
  await member.type('input[type="email"]', 'ming@msw.mo', { delay: 15 });
  await member.type('input[type="password"]', 'msw2026', { delay: 15 });
  await wait(300);
  await Promise.all([
    member.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 }).catch(() => {}),
    clickText(member, '登入', { tag: 'button' }),
  ]);
  await wait(2000);
  const mSess = await member.evaluate(async () => { const r = await fetch('/api/auth/session', { credentials: 'include' }); return await r.text(); });
  console.log('--- member session ---');
  console.log(mSess);
  await shot(member, 'C02_ming_logged_in');
  const memberCookies = await browser.cookies();
  fs.writeFileSync('/workspace/msw/qa/qg_ming_cookies.json', JSON.stringify(memberCookies, null, 2));

  // direct /admin as member
  await member.goto(BASE + '/admin', { waitUntil: 'networkidle2', timeout: 30000 });
  await wait(1800);
  const mAdmin = await member.evaluate(() => ({
    url: location.pathname,
    h1: (document.querySelector('h1') || {}).innerText || null,
    bodyLen: document.body.innerText.trim().length,
    text: document.body.innerText.trim().slice(0, 300),
    hasAdminTabs: /活動管理|網站設定/.test(document.body.innerText),
    hasStats: /待確認截圖|會員總數/.test(document.body.innerText),
  }));
  console.log('--- [14] member -> /admin ---');
  console.log(JSON.stringify(mAdmin, null, 2));
  await shot(member, 'C03_ming_admin_denied');

  // member token against admin APIs
  const mApi = await member.evaluate(async (base) => {
    const out = {};
    for (const p of ['/api/admin/settings', '/api/admin/activities', '/api/admin/members', '/api/admin/coupons']) {
      const r = await fetch(base + p, { credentials: 'include' });
      out[p] = { status: r.status, body: (await r.text()).slice(0, 100) };
    }
    return out;
  }, BASE);
  console.log('--- member token -> admin APIs ---');
  console.log(JSON.stringify(mApi, null, 2));

  // ---------- parameter validation ----------
  const bad = await member.evaluate(async (base) => {
    const out = {};
    // bogus activity id on delete (authenticated as member - should be 403 anyway)
    const r1 = await fetch(base + '/api/admin/activities?id=-1', { method: 'DELETE', credentials: 'include' });
    out['DELETE id=-1 (member)'] = r1.status;
    // runs with negative/absurd values
    const r2 = await fetch(base + '/api/runs?km=-5&limit=-1', { credentials: 'include' });
    out['GET /api/runs?km=-5&limit=-1'] = { status: r2.status, body: (await r2.text()).slice(0, 100) };
    return out;
  }, BASE);
  console.log('--- param validation (member) ---');
  console.log(JSON.stringify(bad, null, 2));

  await browser.close();
})();
