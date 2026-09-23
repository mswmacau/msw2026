// A06: 首頁主視覺 group -> hero_title -> verify on front end
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

(async () => {
  const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu'] });
  await setCookie(browser);

  const admin = await browser.newPage();
  await admin.setViewport({ width: 1440, height: 900 });
  await admin.goto(BASE + '/admin', { waitUntil: 'networkidle2', timeout: 30000 });
  await wait(1500);

  await clickText(admin, '網站設定', { tag: 'button' });
  await wait(900);
  await clickText(admin, '首頁主視覺', { tag: 'button' });
  await wait(900);
  await shot(admin, 'A08_group_hero');

  const NEW = 'QA 主標題驗證 12345';
  const setRes = await admin.evaluate((v) => {
    const el = [...document.querySelectorAll('input')].filter((e) => e.getBoundingClientRect().width > 0).find((e) => e.value === '一起練，一起跑');
    if (!el) return 'NOT_FOUND';
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(el, v);
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
    el.blur();
    return el.value;
  }, NEW);
  console.log('set hero_title -> ' + setRes);
  await wait(400);
  await shot(admin, 'A08_hero_changed');

  await clickText(admin, '儲存全部設定');
  await wait(2500);
  await shot(admin, 'A08_hero_saved');
  const s = await admin.evaluate(async () => (await (await fetch('/api/admin/settings', { credentials: 'include' })).json()).settings);
  console.log('hero_title now = ' + JSON.stringify(s.hero_title));

  const front = await browser.newPage();
  await front.setViewport({ width: 1440, height: 900 });
  await front.goto(BASE + '/', { waitUntil: 'networkidle2', timeout: 30000 });
  await wait(1000);
  const h = await front.evaluate(() => {
    const h1 = document.querySelector('h1');
    return { h1: h1 ? h1.innerText : null, hasNew: document.body.innerText.includes('QA 主標題驗證 12345') };
  });
  console.log('--- FRONT ---');
  console.log(JSON.stringify(h, null, 2));
  await shot(front, 'A08_front_hero_changed');
  await browser.close();
})();
