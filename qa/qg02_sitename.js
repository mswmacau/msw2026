// A03-A04: site settings -> 品牌識別 group -> change site_name -> save -> verify front-end
const puppeteer = require('puppeteer-core');
const fs = require('fs');
const { shot, clickText, wait, BASE, SHOTS } = require('./harness');

const CHROME = '/usr/bin/chromium';
const COOKIES = '/workspace/msw/qa/qg_admin_cookies.json';

(async () => {
  const browser = await puppeteer.launch({
    executablePath: CHROME, headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
  });

  // page 1: admin
  const admin = await browser.newPage();
  admin.on('pageerror', (e) => console.log('ADMIN pageerror: ' + e.message));
  await admin.setViewport({ width: 1440, height: 900 });
  const cookies = JSON.parse(fs.readFileSync(COOKIES, 'utf8'));
  for (const c of cookies) {
    const norm = (s) => { const v = String(s || 'None').toLowerCase(); return v === 'lax' ? 'Lax' : v === 'strict' ? 'Strict' : 'None'; };
    await browser.setCookie({
      name: c.name,
      value: c.value,
      domain: c.domain,
      path: c.path,
      httpOnly: !!c.httpOnly,
      secure: !!c.secure,
      sameSite: norm(c.sameSite),
      ...(c.expires && c.expires > 0 ? { expires: c.expires } : {}),
    });
  }

  await admin.goto(BASE + '/admin', { waitUntil: 'networkidle2', timeout: 30000 });
  await wait(1500);

  // BASELINE: read current settings via API (authenticated)
  const before = await admin.evaluate(async () => {
    const r = await fetch('/api/admin/settings', { credentials: 'include' });
    return { status: r.status, data: await r.json() };
  });
  console.log('--- BASELINE settings (authenticated) ---');
  console.log(JSON.stringify(before, null, 2));
  fs.writeFileSync('/workspace/msw/qa/qg_baseline_settings.json', JSON.stringify(before.data.settings, null, 2));

  // go to 網站設定 tab
  await clickText(admin, '網站設定', { tag: 'button' });
  await wait(1200);
  await shot(admin, 'A03_settings_tab');

  // open 品牌識別 group
  await clickText(admin, '品牌識別', { tag: 'button' }).catch(async () => {
    await clickText(admin, '品牌識別');
  });
  await wait(1000);
  await shot(admin, 'A03_group_brand');

  // dump fields now visible
  const fields = await admin.evaluate(() => {
    return [...document.querySelectorAll('input, textarea')].map((el) => ({
      tag: el.tagName.toLowerCase(), type: el.type, name: el.name, id: el.id,
      label: (() => { if (el.id) { const l = document.querySelector(`label[for="${el.id}"]`); if (l) return l.innerText.trim(); } const w = el.closest('label'); return w ? w.innerText.trim() : null; })(),
      value: el.value,
      visible: el.getBoundingClientRect().width > 0 || el.getBoundingClientRect().height > 0,
    })).filter((f) => f.visible);
  });
  console.log('--- visible fields ---');
  console.log(JSON.stringify(fields, null, 2));

  // Change 網站名稱 -> MSW 街健館 QA
  const NEWNAME = 'MSW 街健館 QA';
  const setName = await admin.evaluate((v) => {
    const el = [...document.querySelectorAll('input')].find((e) => e.value === 'MSW 街健館') ||
               [...document.querySelectorAll('input')].find((e) => (e.closest('label') || {}).innerText?.includes('網站名稱'));
    if (!el) return false;
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(el, v);
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
    el.blur();
    return true;
  }, NEWNAME);
  console.log('set site_name ok=' + setName);
  await wait(500);
  await shot(admin, 'A03_name_changed');

  // click 儲存全部設定
  let saveErr = null;
  try {
    await clickText(admin, '儲存全部設定');
  } catch (e) {
    saveErr = e.message;
    console.log('save button lookup failed: ' + e.message);
  }
  await wait(2500);
  await shot(admin, 'A03_name_saved');

  // capture toast text
  const toast = await admin.evaluate(() => document.body.innerText.split('\n').filter((l) => /成功|已儲存|儲存/.test(l)).slice(0, 10));
  console.log('--- toast-ish lines ---');
  console.log(JSON.stringify(toast, null, 2));

  // verify persistence via API on the admin page (independent of front-end render)
  const after = await admin.evaluate(async () => {
    const r = await fetch('/api/admin/settings', { credentials: 'include' });
    return await r.json();
  });
  console.log('--- settings after save: site_name = ' + JSON.stringify(after.settings.site_name));

  // FRONT END in a separate page (same browser context, fresh request)
  const front = await browser.newPage();
  await front.setViewport({ width: 1440, height: 900 });
  await front.goto(BASE + '/', { waitUntil: 'networkidle2', timeout: 30000 });
  await wait(1200);
  const frontInfo = await front.evaluate(() => ({
    title: document.title,
    navText: (document.querySelector('header') || {}).innerText || null,
    footerText: (document.querySelector('footer') || {}).innerText || null,
    hasNewName: document.body.innerText.includes('MSW 街健館 QA'),
    h1: (document.querySelector('h1') || {}).innerText || null,
  }));
  console.log('--- FRONT END after name change ---');
  console.log(JSON.stringify(frontInfo, null, 2));
  await shot(front, 'A04_front_name_changed');

  const cookieDump = await browser.cookies();
  fs.writeFileSync(COOKIES, JSON.stringify(cookieDump, null, 2));

  await browser.close();
})();
