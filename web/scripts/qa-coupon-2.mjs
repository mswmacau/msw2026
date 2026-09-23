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
    if (r.url().includes('_rsc')) return;          // Next.js prefetch aborts = noise
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
await new Promise((r) => setTimeout(r, 1200));

// collect API responses for redeem
const apiCalls = [];
page.on('response', async (r) => {
  if (r.url().includes('/api/admin/coupons/redeem')) {
    let body = '';
    try { body = await r.text(); } catch { body = '<unreadable>'; }
    apiCalls.push({ method: r.request().method(), url: r.url(), status: r.status(), body });
  }
});

async function getInput() {
  const inputs = await page.$$('input');
  for (const h of inputs) {
    const isText = await h.evaluate((el) => el.type === 'text');
    if (isText) return h;
  }
  throw new Error('找不到核銷輸入框');
}

async function redeem(code) {
  const input = await getInput();
  await input.click({ clickCount: 3 });
  await page.keyboard.press('Backspace');
  await input.type(code, { delay: 8 });
  const typed = await input.evaluate((el) => el.value);
  await page.evaluate(() => [...document.querySelectorAll('button')].find((b) => b.textContent.includes('核銷')).click());
  await new Promise((r) => setTimeout(r, 2200));
  const msg = await page.evaluate(() => {
    // find the feedback message element near the redeem box
    const cands = [...document.querySelectorAll('div,p,span')].filter((e) => {
      const t = e.textContent.trim();
      return t && t.length < 200 && (t.includes('核銷') || t.includes('找不到') || t.includes('成功') || t.includes('已被') || t.includes('已使用') || t.includes('過期'));
    });
    return cands.slice(0, 6).map((e) => ({
      tag: e.tagName,
      text: e.textContent.replace(/\s+/g,' ').trim().slice(0, 180),
      color: getComputedStyle(e).color,
      bg: getComputedStyle(e).backgroundColor,
      cls: e.className,
    }));
  });
  return { typed, msg };
}

// ---------- A. 正常核銷 ----------
console.log('===== A. 正常核銷 =====');
const a = await redeem(CODE);
console.log('typed =', a.typed);
console.log('MESSAGE DOM =', JSON.stringify(a.msg, null, 1));
await page.screenshot({ path: `${SHOTS}/coupon-2-redeem-success.png`, fullPage: true });
const afterA = await page.evaluate(() => {
  const rows = [...document.querySelectorAll('table tbody tr')].map((r) => r.innerText.replace(/\s+/g,' ').trim());
  return rows;
});
console.log('LIST AFTER A =', JSON.stringify(afterA, null, 1));
console.log('API A =', JSON.stringify(apiCalls.at(-1), null, 1));

// ---------- B. 重複核銷 ----------
console.log('\n===== B. 重複核銷 =====');
const b = await redeem(CODE);
console.log('typed =', b.typed);
console.log('MESSAGE DOM =', JSON.stringify(b.msg, null, 1));
await page.screenshot({ path: `${SHOTS}/coupon-3-duplicate-blocked.png`, fullPage: true });
console.log('API B =', JSON.stringify(apiCalls.at(-1), null, 1));

// ---------- C. 錯誤券號 ----------
console.log('\n===== C. 錯誤券號 =====');
const c = await redeem('MSW-FAKE-0000');
console.log('typed =', c.typed);
console.log('MESSAGE DOM =', JSON.stringify(c.msg, null, 1));
await page.screenshot({ path: `${SHOTS}/coupon-4-not-found.png`, fullPage: true });
console.log('API C =', JSON.stringify(apiCalls.at(-1), null, 1));

// ---------- GET status API ----------
console.log('\n===== GET /api/admin/coupons/redeem?code=' + CODE + ' =====');
const getJson = await page.evaluate(async (code) => {
  const r = await fetch(`/api/admin/coupons/redeem?code=${encodeURIComponent(code)}`, { headers: { accept: 'application/json' } });
  const t = await r.text();
  return { status: r.status, body: t };
}, CODE);
console.log('STATUS =', getJson.status);
console.log('RAW BODY =');
console.log(getJson.body);

console.log('\n===== LOGS =====');
console.log(logs.length ? logs.join('\n') : '(none)');
console.log('===== ERROR COUNT =====', errors.length);

await browser.close();
