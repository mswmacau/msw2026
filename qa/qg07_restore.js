// A07: restore site_name / theme_primary / hero_title to baseline, verify on front end
const puppeteer = require('puppeteer-core');
const fs = require('fs');
const { shot, clickText, wait, BASE } = require('./harness');
const CHROME = '/usr/bin/chromium';
const COOKIES = '/workspace/msw/qa/qg_admin_cookies.json';
const BASELINE = JSON.parse(fs.readFileSync('/workspace/msw/qa/qg_baseline_settings.json', 'utf8'));

async function setCookie(browser) {
  for (const c of JSON.parse(fs.readFileSync(COOKIES, 'utf8'))) {
    const norm = (s) => { const v = String(s || 'None').toLowerCase(); return v === 'lax' ? 'Lax' : v === 'strict' ? 'Strict' : 'None'; };
    await browser.setCookie({ name: c.name, value: c.value, domain: c.domain, path: c.path, httpOnly: !!c.httpOnly, secure: !!c.secure, sameSite: norm(c.sameSite) });
  }
}

(async () => {
  const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu'] });
  await setCookie(browser);
  const admin = await browser.newPage();
  await admin.setViewport({ width: 1440, height: 900 });
  await admin.goto(BASE + '/admin', { waitUntil: 'networkidle2', timeout: 30000 });
  await wait(1500);

  // Restore all three via the UI form (faithful path), one group at a time
  const plan = [
    { group: '品牌識別', from: 'MSW 街健館 QA', to: BASELINE.site_name },
    { group: '配色樣式', from: '#00C2FF', to: BASELINE.theme_primary },
    { group: '首頁主視覺', from: 'QA 主標題驗證 12345', to: BASELINE.hero_title },
  ];

  await clickText(admin, '網站設定', { tag: 'button' });
  await wait(900);

  for (const step of plan) {
    await clickText(admin, step.group, { tag: 'button' });
    await wait(800);
    const r = await admin.evaluate((from, to) => {
      const el = [...document.querySelectorAll('input')].filter((e) => e.getBoundingClientRect().width > 0).find((e) => e.value === from);
      if (!el) return 'NOT_FOUND:' + from;
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(el, to);
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
      el.blur();
      return el.value;
    }, step.from, step.to);
    console.log(`restore ${step.group}: "${step.from}" -> ${JSON.stringify(r)}`);
    await wait(300);
    await clickText(admin, '儲存全部設定');
    await wait(1800);
  }
  await shot(admin, 'A09_restore_saved');

  // verify via API
  const s = await admin.evaluate(async () => (await (await fetch('/api/admin/settings', { credentials: 'include' })).json()).settings);
  console.log('--- restored values ---');
  console.log(JSON.stringify({ site_name: s.site_name, theme_primary: s.theme_primary, hero_title: s.hero_title }, null, 2));
  const ok = s.site_name === BASELINE.site_name && s.theme_primary === BASELINE.theme_primary && s.hero_title === BASELINE.hero_title;
  console.log('RESTORE ' + (ok ? 'PASS' : 'FAIL'));

  // front-end check
  const front = await browser.newPage();
  await front.setViewport({ width: 1440, height: 900 });
  await front.goto(BASE + '/', { waitUntil: 'networkidle2', timeout: 30000 });
  await wait(1000);
  const f = await front.evaluate(() => ({
    nav: (document.querySelector('header') || {}).innerText?.split('\n').slice(0, 3).join(' | '),
    heroH1: (document.querySelector('h1') || {}).innerText,
    cobalt: getComputedStyle(document.documentElement).getPropertyValue('--c-cobalt-bright').trim(),
  }));
  console.log('--- FRONT restored ---');
  console.log(JSON.stringify(f, null, 2));
  await shot(front, 'A10_front_restored');
  await browser.close();
})();
