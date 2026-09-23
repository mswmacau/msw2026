import puppeteer from 'puppeteer-core';

const BASE = 'http://localhost:3000';
const SHOTS = '/workspace/msw/web/scripts/shots';
const CODE = 'MSW-202609-99ZA938Z';

const logs = [];
const errors = [];
function attach(page, tag) {
  page.on('console', (m) => {
    const t = m.type();
    const line = `[${tag}][console:${t}] ${m.text()}`;
    logs.push(line);
    if (t === 'error') errors.push(line);
  });
  page.on('pageerror', (e) => {
    const line = `[${tag}][pageerror] ${e.message}`;
    logs.push(line); errors.push(line);
  });
  page.on('requestfailed', (r) => {
    if (r.url().includes('_rsc')) return;
    const line = `[${tag}][requestfailed] ${r.url()} :: ${r.failure()?.errorText}`;
    logs.push(line); errors.push(line);
  });
  page.on('response', (r) => {
    if (r.status() >= 400) { const line = `[${tag}][http:${r.status()}] ${r.url()}`; logs.push(line); errors.push(line); }
  });
}

const browser = await puppeteer.launch({
  executablePath: '/usr/bin/chromium',
  headless: 'new',
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
  defaultViewport: { width: 1440, height: 1000, deviceScaleFactor: 1 },
});
const page = await browser.newPage();
attach(page, 'admin');

await page.goto(`${BASE}/login`, { waitUntil: 'networkidle2' });
await page.waitForSelector('input[type=email]');
await page.type('input[type=email]', 'admin@msw.mo', { delay: 5 });
await page.type('input[type=password]', 'msw2026admin', { delay: 5 });
await page.evaluate(() => [...document.querySelectorAll('button')].find((b) => b.textContent.trim() === '登入').click());
await page.waitForFunction(() => location.pathname === '/dashboard', { timeout: 20000 });

await page.goto(`${BASE}/admin`, { waitUntil: 'networkidle2' });
await new Promise((r) => setTimeout(r, 1500));
await page.evaluate(() => [...document.querySelectorAll('button')].find((b) => b.textContent.replace(/\s+/g,'').includes('優惠券')).click());
await new Promise((r) => setTimeout(r, 1500));

console.log('===== LIST AFTER FULL PAGE RELOAD (核銷後重新載入) =====');
const rows = await page.evaluate(() => [...document.querySelectorAll('table tbody tr')].map((r) => r.innerText.replace(/\s+/g,' ').trim()));
console.log(JSON.stringify(rows, null, 1));
const tabCount = await page.evaluate(() => {
  const t = [...document.querySelectorAll('button')].map((b) => b.textContent.replace(/\s+/g,' ').trim())
    .filter((x) => ['待確認截圖','訓練出席','達成名單','優惠券'].some((k) => x.startsWith(k)));
  return t;
});
console.log('TABS =', JSON.stringify(tabCount));
await page.screenshot({ path: `${SHOTS}/coupon-2b-list-after-reload.png`, fullPage: true });

async function getInput() {
  for (const h of await page.$$('input')) {
    if (await h.evaluate((el) => el.type === 'text')) return h;
  }
  throw new Error('no input');
}

async function redeem(code) {
  const input = await getInput();
  // clear via React-safe native setter
  await input.evaluate((el) => {
    const s = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
    s.call(el, '');
    el.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await input.click();
  await input.type(code, { delay: 10 });
  const typed = await input.evaluate((el) => el.value);
  await page.evaluate(() => [...document.querySelectorAll('button')].find((b) => b.textContent.includes('核銷')).click());
  await new Promise((r) => setTimeout(r, 2200));
  const msg = await page.evaluate(() => {
    const el = [...document.querySelectorAll('div')].find((e) => /mt-5 rounded-xl/.test(e.className) && /ring-1/.test(e.className));
    return el ? { text: el.innerText.replace(/\s+/g,' ').trim(), color: getComputedStyle(el).color, bg: getComputedStyle(el).backgroundColor, cls: el.className } : null;
  });
  return { typed, msg };
}

console.log('\n===== C (重做). 錯誤券號 MSW-FAKE-0000 =====');
const c = await redeem('MSW-FAKE-0000');
console.log('typed =', JSON.stringify(c.typed));
console.log('msg =', JSON.stringify(c.msg, null, 1));
await page.screenshot({ path: `${SHOTS}/coupon-4-not-found.png`, fullPage: true });

console.log('\n===== EXTRA. 已過期券 pretest =====');
const e = await redeem('MSW-202601-EXPIRED');
console.log('typed =', JSON.stringify(e.typed));
console.log('msg =', JSON.stringify(e.msg, null, 1));
await page.screenshot({ path: `${SHOTS}/coupon-7-expired.png`, fullPage: true });

console.log('\n===== EXTRA. 空值核銷 =====');
const z = await redeem('   ');
console.log('typed =', JSON.stringify(z.typed));
console.log('msg =', JSON.stringify(z.msg, null, 1));
await page.screenshot({ path: `${SHOTS}/coupon-8-empty.png`, fullPage: true });

console.log('\n===== LOGS =====');
console.log(logs.length ? logs.join('\n') : '(none)');
console.log('===== ERROR COUNT =====', errors.length);
await browser.close();
