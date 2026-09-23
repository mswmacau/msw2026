import * as L from './live-lib.mjs';

const browser = await L.launch();
const out = {};

// 記錄所有導航與跨域嘗試
const page = await L.newPage(browser);
const navLog = [];
page.on('framenavigated', (f) => {
  if (f === page.mainFrame()) navLog.push(f.url());
});
const reqHosts = new Set();
page.on('request', (r) => {
  try {
    reqHosts.add(new URL(r.url()).host);
  } catch {}
});

await page.goto(`${L.BASE}/login`, { waitUntil: 'networkidle2', timeout: 90000 });
await L.sleep(1000);
out.beforeLogin = { url: page.url(), text: (await L.bodyText(page)).slice(0, 200) };

await L.fill(page, 'input[type=email]', 'admin@msw.mo');
await L.fill(page, 'input[type=password]', 'msw2026admin');
await L.clickText(page, '登入');
await L.sleep(6000);

out.afterLogin = {
  url: page.url(),
  path: page.url().replace(L.BASE, ''),
  isLocalhost: /localhost|127\.0\.0\.1/.test(page.url()),
  host: (() => { try { return new URL(page.url()).host; } catch { return null; } })(),
  text: (await L.bodyText(page)).slice(0, 300),
};
out.navLog = [...new Set(navLog)];
out.reqHosts = [...reqHosts];
out.httpErrors = [...new Set(page.__httpErrors)];
out.errors = [...new Set(page.__errors)].slice(0, 8);

const s = await L.shot(page, 'live-login-ok.png', true);
out.shot = { name: 'live-login-ok.png', ok: s.ok, size: s.size };

// 登入後是否能在 dashboard 看到會員資料
await page.goto(`${L.BASE}/dashboard`, { waitUntil: 'networkidle2', timeout: 90000 });
await L.sleep(2000);
out.dashboard = {
  url: page.url(),
  path: page.url().replace(L.BASE, ''),
  dash: await L.readDashboard(page),
  text: (await L.bodyText(page)).slice(0, 400),
};
const s2 = await L.shot(page, 'live-dashboard-admin.png', true);
out.dashShot = { ok: s2.ok, size: s2.size };

// 管理員能否進 /admin
await page.goto(`${L.BASE}/admin`, { waitUntil: 'networkidle2', timeout: 90000 });
await L.sleep(2500);
out.admin = { url: page.url(), path: page.url().replace(L.BASE, ''), text: (await L.bodyText(page)).slice(0, 500) };
const s3 = await L.shot(page, 'live-admin-auth.png', true);
out.adminShot = { ok: s3.ok, size: s3.size };

console.log(L.dump(out));
await browser.close();
