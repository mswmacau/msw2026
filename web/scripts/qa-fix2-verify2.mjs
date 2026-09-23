import puppeteer from 'puppeteer-core';

const BASE = 'http://localhost:3000';
const SHOTS = '/workspace/msw/web/scripts/shots';
const HUI_ID = 'cmudcldk60002e6q6htx6kgcq'; // hui@msw.mo 小慧

const browser = await puppeteer.launch({
  executablePath: '/usr/bin/chromium',
  headless: 'new',
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
  defaultViewport: { width: 1440, height: 1100, deviceScaleFactor: 1 },
});
const page = await browser.newPage();
const errs = [];
page.on('pageerror', (e) => errs.push('pageerror: ' + e.message));
page.on('response', (r) => { if (r.status() >= 400) errs.push(`http${r.status()} ${r.url()}`); });

// login
await page.goto(`${BASE}/login`, { waitUntil: 'networkidle2' });
await page.waitForSelector('input[type=email]');
await page.type('input[type=email]', 'admin@msw.mo', { delay: 5 });
await page.type('input[type=password]', 'msw2026admin', { delay: 5 });
await page.evaluate(() => {
  [...document.querySelectorAll('button')].find((x) => x.textContent.trim() === '登入').click();
});
await page.waitForFunction(() => location.pathname === '/dashboard', { timeout: 30000 });

// 兜底：發一張 PRETEST 複驗用券（小慧）
const issued = await page.evaluate(async (uid) => {
  const res = await fetch('/api/admin/coupons', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      month: '2026-09',
      userIds: [uid],
      title: 'PRETEST 複驗用券',
      discount: '9折',
    }),
  });
  return { status: res.status, body: await res.json() };
}, HUI_ID);
console.log('ISSUE =', JSON.stringify(issued));
const newCode = issued.body?.coupons?.[0]?.code;
console.log('NEW CODE =', newCode);

// /admin → 優惠券 tab
await page.goto(`${BASE}/admin`, { waitUntil: 'networkidle2' });
await new Promise((r) => setTimeout(r, 1000));
await page.evaluate(() => {
  [...document.querySelectorAll('button')]
    .find((x) => x.textContent.replace(/\s/g, '').includes('優惠券'))
    .click();
});
await new Promise((r) => setTimeout(r, 1000));

// 不重整頁面，直接輸入券號核銷
await page.evaluate(() => { window.__noReloadMarker = 'alive'; });
await page.click('input.font-mono');
await page.type('input.font-mono', newCode, { delay: 10 });
await page.evaluate(() => {
  [...document.querySelectorAll('button')].find((x) => x.textContent.includes('核銷')).click();
});
await new Promise((r) => setTimeout(r, 3500));

const check = await page.evaluate((code) => {
  const rows = [...document.querySelectorAll('table tbody tr')].map((tr) => {
    const td = [...tr.querySelectorAll('td')].map((x) => x.textContent.trim());
    return { code: td[0], member: td[1], status: td[4] };
  });
  return {
    successShown: document.body.innerText.includes('核銷成功'),
    target: rows.find((r) => r.code === code) || null,
    rows,
    marker: window.__noReloadMarker || 'GONE',
  };
}, newCode);
console.log('CHECK =', JSON.stringify(check, null, 1));

await page.screenshot({ path: `${SHOTS}/fix2-2-list-updated.png`, fullPage: true });
console.log('ERRORS =', JSON.stringify(errs));
await browser.close();
