import puppeteer from 'puppeteer-core';

const BASE = 'http://localhost:3000';
const SHOTS = '/workspace/msw/web/scripts/shots';

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
    logs.push(line);
    errors.push(line);
  });
  page.on('requestfailed', (r) => {
    const line = `[${tag}][requestfailed] ${r.url()} :: ${r.failure()?.errorText}`;
    logs.push(line);
    errors.push(line);
  });
  page.on('response', (r) => {
    if (r.status() >= 400) {
      const line = `[${tag}][http:${r.status()}] ${r.url()}`;
      logs.push(line);
      errors.push(line);
    }
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

// ---- login ----
await page.goto(`${BASE}/login`, { waitUntil: 'networkidle2' });
await page.waitForSelector('input[type=email]');
await page.type('input[type=email]', 'admin@msw.mo', { delay: 8 });
await page.type('input[type=password]', 'msw2026admin', { delay: 8 });
await page.evaluate(() => {
  const b = [...document.querySelectorAll('button')].find((x) => x.textContent.trim() === '登入');
  if (!b) throw new Error('no login btn');
  b.click();
});
let loginOk = true;
try {
  await page.waitForFunction(() => location.pathname === '/dashboard', { timeout: 20000 });
} catch { loginOk = false; }
console.log('LOGIN url =', page.url(), 'ok =', loginOk);

// ---- /admin ----
await page.goto(`${BASE}/admin`, { waitUntil: 'networkidle2' });
await new Promise((r) => setTimeout(r, 1800));

const adminInfo = await page.evaluate(() => {
  const btns = [...document.querySelectorAll('button')];
  return {
    h1: document.querySelector('h1')?.textContent?.trim(),
    allButtonTexts: btns.map((b) => b.textContent.replace(/\s+/g, ' ').trim()).filter(Boolean).slice(0, 40),
  };
});
console.log('ADMIN H1 =', adminInfo.h1);
console.log('ADMIN BUTTONS =', JSON.stringify(adminInfo.allButtonTexts, null, 1));

async function clickTab(text) {
  const clicked = await page.evaluate((t) => {
    const b = [...document.querySelectorAll('button')].find((x) => x.textContent.replace(/\s+/g,'').includes(t));
    if (!b) return false;
    b.click();
    return true;
  }, text);
  await new Promise((r) => setTimeout(r, 1200));
  return clicked;
}

// ---- 達成名單 ----
const c3 = await clickTab('達成名單');
const winners = await page.evaluate(() => {
  const rows = [...document.querySelectorAll('table tbody tr')].map((r) => r.innerText.replace(/\s+/g, ' ').trim());
  const btns = [...document.querySelectorAll('button')].map((b) => b.textContent.replace(/\s+/g,' ').trim());
  return { rows, issueBtns: btns.filter((t) => t.includes('發')) };
});
console.log('TAB 達成名單 clicked =', c3);
console.log('WINNERS ROWS =', JSON.stringify(winners.rows, null, 1));
console.log('ISSUE BTNS =', JSON.stringify(winners.issueBtns));
await page.screenshot({ path: `${SHOTS}/prep-winners.png`, fullPage: true });

// ---- 優惠券 tab ----
const c4 = await clickTab('優惠券');
const couponTab = await page.evaluate(() => {
  const inputs = [...document.querySelectorAll('input')].map((i) => ({ type: i.type, ph: i.placeholder, name: i.name, id: i.id }));
  const btns = [...document.querySelectorAll('button')].map((b) => b.textContent.replace(/\s+/g,' ').trim());
  const rows = [...document.querySelectorAll('table tbody tr')].map((r) => r.innerText.replace(/\s+/g, ' ').trim());
  return { inputs, btns: btns.slice(0, 30), rowCount: rows.length, rows: rows.slice(0, 20), bodyText: document.body.innerText.slice(0, 1500) };
});
console.log('TAB 優惠券 clicked =', c4);
console.log('COUPON INPUTS =', JSON.stringify(couponTab.inputs));
console.log('COUPON BTNS =', JSON.stringify(couponTab.btns));
console.log('COUPON ROWS =', couponTab.rowCount);
console.log(JSON.stringify(couponTab.rows, null, 1));
console.log('--- BODY ---');
console.log(couponTab.bodyText);
await page.screenshot({ path: `${SHOTS}/prep-coupon-tab.png`, fullPage: true });

console.log('\n===== LOGS =====');
console.log(logs.length ? logs.join('\n') : '(no console output)');
console.log('===== ERRORS =====', errors.length);

await browser.close();
