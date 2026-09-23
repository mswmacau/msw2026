// A05-A06: 配色樣式 group -> theme_primary -> verify --c-cobalt-bright RGB triplet on front end
const puppeteer = require('puppeteer-core');
const fs = require('fs');
const { shot, clickText, wait, BASE } = require('./harness');
const CHROME = '/usr/bin/chromium';
const COOKIES = '/workspace/msw/qa/qg_admin_cookies.json';

async function setCookie(browser) {
  for (const c of JSON.parse(fs.readFileSync(COOKIES, 'utf8'))) {
    const norm = (s) => { const v = String(s || 'None').toLowerCase(); return v === 'lax' ? 'Lax' : v === 'strict' ? 'Strict' : 'None'; };
    await browser.setCookie({ name: c.name, value: c.value, domain: c.domain, path: c.path, httpOnly: !!c.httpOnly, secure: !!c.secure, sameSite: norm(c.sameSite) });
  }
}

function readVar(page) {
  return page.evaluate(() => {
    const cs = getComputedStyle(document.documentElement);
    const raw = cs.getPropertyValue('--c-cobalt-bright').trim();
    const styleTag = document.getElementById('msw-theme');
    return {
      varRaw: raw,
      themeStyleTag: styleTag ? styleTag.textContent : '(no #msw-theme tag)',
      // resolve to numeric triple
      triple: (() => { const m = raw.match(/(\d+)\s+(\d+)\s+(\d+)/); return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : null; })(),
    };
  });
}

(async () => {
  const browser = await puppeteer.launch({
    executablePath: CHROME, headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
  });
  await setCookie(browser);

  const admin = await browser.newPage();
  await admin.setViewport({ width: 1440, height: 900 });
  await admin.goto(BASE + '/admin', { waitUntil: 'networkidle2', timeout: 30000 });
  await wait(1500);

  await clickText(admin, '網站設定', { tag: 'button' });
  await wait(1000);
  await clickText(admin, '配色樣式', { tag: 'button' });
  await wait(1000);
  await shot(admin, 'A05_group_color');

  const colFields = await admin.evaluate(() => [...document.querySelectorAll('input')].filter((e) => (e.getBoundingClientRect().width > 0)).map((e) => ({ type: e.type, value: e.value, label: (() => { const w = e.closest('label'); if (w) return w.innerText.trim().slice(0, 30); if (e.id) { const l = document.querySelector(`label[for="${e.id}"]`); if (l) return l.innerText.trim(); } return null; })() })));
  console.log('--- color fields ---');
  console.log(JSON.stringify(colFields, null, 2));

  // set theme_primary = 00C2FF
  const ok = await admin.evaluate((v) => {
    // find the field whose current value is the primary default
    let el = [...document.querySelectorAll('input')].find((e) => /0057ff/i.test(e.value));
    if (!el) el = [...document.querySelectorAll('input[type="color"]')][1];
    if (!el) return false;
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
    setter.call(el, v);
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
    el.blur();
    return el.value;
  }, '#00C2FF');
  console.log('set primary -> ' + JSON.stringify(ok));
  await wait(400);
  await shot(admin, 'A05_color_changed');

  await clickText(admin, '儲存全部設定');
  await wait(2500);
  await shot(admin, 'A05_color_saved');

  const settingsNow = await admin.evaluate(async () => (await (await fetch('/api/admin/settings', { credentials: 'include' })).json()).settings);
  console.log('theme_primary now = ' + settingsNow.theme_primary);

  // FRONT END: hard reload, read CSS var
  const front = await browser.newPage();
  await front.setViewport({ width: 1440, height: 900 });
  await front.goto(BASE + '/', { waitUntil: 'networkidle2', timeout: 30000 });
  await wait(1000);
  const v = await readVar(front);
  console.log('--- FRONT END --c-cobalt-bright ---');
  console.log(JSON.stringify(v, null, 2));
  console.log('EXPECT triple [0,194,255] -> ' + (v.triple && v.triple.join(',') === '0,194,255' ? 'PASS' : 'FAIL'));
  await shot(front, 'A06_front_color_changed');

  await browser.close();
})();
