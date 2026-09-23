// Item 6: permissions — member /admin denied, anon admin APIs 403
// Item 7: regression — all main pages 200 + CSS OK + /dashboard as member
const { launch, wait, shot, sessionRole, BASE } = require('./R2_lib');

(async () => {
  const browser = await launch();
  const results = [];

  // ---------- anonymous API checks ----------
  const anon = await browser.newPage();
  await anon.setViewport({ width: 1440, height: 900 });
  await anon.goto(BASE + '/login', { waitUntil: 'domcontentloaded' });
  await wait(600);
  const anonApi = await anon.evaluate(async () => {
    const out = {};
    for (const p of ['/api/admin/settings', '/api/admin/activities']) {
      const r = await fetch(p, { credentials: 'omit' });
      out[p] = { status: r.status, body: (await r.text()).slice(0, 100) };
    }
    // mutating attempts unauthenticated
    const put = await fetch('/api/admin/settings', { method: 'PUT', credentials: 'omit', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ site_name: 'HACKED-R2' }) });
    out['PUT /api/admin/settings'] = { status: put.status };
    const post = await fetch('/api/admin/activities', { method: 'POST', credentials: 'omit', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title: 'HACKED-R2', published: true }) });
    out['POST /api/admin/activities'] = { status: post.status, body: (await post.text()).slice(0, 100) };
    return out;
  });
  console.log('[6a] ANON admin APIs: ' + JSON.stringify(anonApi, null, 1));
  await anon.goto(BASE + '/api/admin/settings', { waitUntil: 'domcontentloaded' });
  await wait(500);
  await shot(anon, 'R2_31_anon_admin_api');
  results.push(['anon GET /api/admin/settings', anonApi['/api/admin/settings'].status === 403]);
  results.push(['anon GET /api/admin/activities', anonApi['/api/admin/activities'].status === 403]);
  results.push(['anon PUT /api/admin/settings', anonApi['PUT /api/admin/settings'].status === 403]);
  results.push(['anon POST /api/admin/activities', anonApi['POST /api/admin/activities'].status === 403]);

  // make sure HACKED did not persist
  const hacked = await anon.evaluate(async () => {
    const r = await fetch('/api/admin/settings', { credentials: 'omit' });
    return r.status;
  });
  console.log('[6a] re-check anon still 403 = ' + hacked);

  // ---------- member login ----------
  const member = await browser.newPage();
  await member.setViewport({ width: 1440, height: 900 });
  await member.goto(BASE + '/login', { waitUntil: 'networkidle2', timeout: 30000 });
  await wait(800);
  await member.type('input[type="email"]', 'ming@msw.mo', { delay: 10 });
  await member.type('input[type="password"]', 'msw2026', { delay: 10 });
  await wait(250);
  await member.evaluate(() => {
    const b = [...document.querySelectorAll('button')].find((x) => (x.innerText || '').includes('登入'));
    if (b) b.click();
  });
  await wait(2200);
  console.log('[6b] member session = ' + (await sessionRole(member)));
  await shot(member, 'R2_32_member_logged_in');

  const mApi = await member.evaluate(async () => {
    const out = {};
    for (const p of ['/api/admin/settings', '/api/admin/activities']) {
      const r = await fetch(p, { credentials: 'include' });
      out[p] = r.status;
    }
    return out;
  });
  console.log('[6b] MEMBER token -> admin APIs: ' + JSON.stringify(mApi));
  results.push(['member GET /api/admin/settings', mApi['/api/admin/settings'] === 403]);
  results.push(['member GET /api/admin/activities', mApi['/api/admin/activities'] === 403]);

  // member opens /admin in browser
  await member.goto(BASE + '/admin', { waitUntil: 'networkidle2', timeout: 30000 });
  await wait(1800);
  const mAdmin = await member.evaluate(() => ({
    url: location.pathname,
    text: document.body.innerText.trim().replace(/\s+/g, ' ').slice(0, 200),
    hasAdminTabs: /活動管理|網站設定|待確認截圖/.test(document.body.innerText),
  }));
  console.log('[6c] member -> /admin: ' + JSON.stringify(mAdmin));
  await shot(member, 'R2_33_member_admin_denied');
  results.push(['member /admin denied (no admin tabs)', mAdmin.url !== '/admin' || !mAdmin.hasAdminTabs]);

  // ---------- item 7: page regression ----------
  const pages = ['/', '/events', '/about', '/contact', '/login', '/register', '/leaderboard'];
  const checker = await browser.newPage();
  await checker.setViewport({ width: 1440, height: 900 });
  for (const path of pages) {
    const resp = await checker.goto(BASE + path, { waitUntil: 'networkidle2', timeout: 30000 });
    await wait(900);
    const css = await checker.evaluate(() => {
      const links = [...document.querySelectorAll('link[rel="stylesheet"]')];
      const styles = [...document.querySelectorAll('style')];
      const bodyBg = getComputedStyle(document.body).backgroundColor;
      const sample = document.querySelector('h1, h2, a, button');
      const sampleColor = sample ? getComputedStyle(sample).color : null;
      const hasVar = getComputedStyle(document.documentElement).getPropertyValue('--c-cobalt-bright').trim();
      return { stylesheets: links.length, inlineStyles: styles.length, bodyBg, sampleColor, cobaltVar: hasVar, textLen: document.body.innerText.trim().length };
    });
    const pass = resp.status() === 200 && (css.stylesheets > 0 || css.inlineStyles > 0) && css.textLen > 50;
    results.push([`GET ${path} = ${resp.status()} css(ssh=${css.stylesheets},inline=${css.inlineStyles}) var=${css.cobaltVar}`, pass]);
    console.log(`[7] ${path} -> HTTP ${resp.status()} | ${JSON.stringify(css)}`);
    await shot(checker, `R2_34_page${path === '/' ? '_home' : path.replace(/\//g, '_')}`);
  }

  // /dashboard as logged-in member
  const dash = await browser.newPage();
  await dash.setViewport({ width: 1440, height: 900 });
  // reuse member cookies from browser jar (set them per-browser earlier via member login in same browser)
  await dash.goto(BASE + '/login', { waitUntil: 'domcontentloaded' });
  await wait(600);
  // cookies are shared browser-wide; verify session
  const dashRole = await sessionRole(dash);
  console.log('[7] /dashboard pre-check role = ' + dashRole);
  const dresp = await dash.goto(BASE + '/dashboard', { waitUntil: 'networkidle2', timeout: 30000 });
  await wait(1600);
  const dInfo = await dash.evaluate(() => ({
    text: document.body.innerText.trim().replace(/\s+/g, ' ').slice(0, 160),
    bg: getComputedStyle(document.body).backgroundColor,
    len: document.body.innerText.trim().length,
  }));
  console.log(`[7] /dashboard -> HTTP ${dresp.status()} | ${JSON.stringify(dInfo)}`);
  results.push([`GET /dashboard (member) = ${dresp.status()}`, dresp.status() === 200 && dInfo.len > 50]);
  await shot(dash, 'R2_35_page_dashboard_member');

  console.log('\n===== SUMMARY =====');
  for (const [name, ok] of results) console.log((ok ? 'PASS' : 'FAIL') + ' | ' + name);

  await browser.close();
})();
