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

// ---------- A. 登入 ----------
await page.goto(`${BASE}/login`, { waitUntil: 'networkidle2' });
console.log('A0 login page url =', page.url());
await page.waitForSelector('input[type=email]');
await page.type('input[type=email]', 'admin@msw.mo', { delay: 10 });
await page.type('input[type=password]', 'msw2026admin', { delay: 10 });
await page.screenshot({ path: `${SHOTS}/login-filled.png` });

await page.evaluate(() => {
  const b = [...document.querySelectorAll('button')].find((x) => x.textContent.trim() === '登入');
  if (!b) throw new Error('找不到登入按鈕');
  b.click();
});

let loginOk = false;
try {
  await page.waitForFunction(() => location.pathname === '/dashboard', { timeout: 20000 });
  loginOk = true;
} catch (e) {
  loginOk = false;
}
console.log('A1 after login url =', page.url(), 'loginOk =', loginOk);
const loginErr = await page.evaluate(() => document.body.innerText.includes('Email 或密碼不正確'));
console.log('A2 login error shown =', loginErr);
await new Promise((r) => setTimeout(r, 1200));
await page.screenshot({ path: `${SHOTS}/admin-dashboard.png`, fullPage: true });

// ---------- B. 管理後台三個 tab ----------
await page.goto(`${BASE}/admin`, { waitUntil: 'networkidle2' });
await new Promise((r) => setTimeout(r, 1500));

const tabInfo = await page.evaluate(() => {
  const btns = [...document.querySelectorAll('button')].map((b) => b.textContent.trim()).slice(0, 6);
  return { title: document.querySelector('h1')?.textContent, btns };
});
console.log('B0 admin page =', JSON.stringify(tabInfo));

async function clickTab(text) {
  const clicked = await page.evaluate((t) => {
    const b = [...document.querySelectorAll('button')].find((x) => x.textContent.includes(t));
    if (!b) return false;
    b.click();
    return true;
  }, text);
  await new Promise((r) => setTimeout(r, 900));
  return clicked;
}

// B1 待確認截圖
const c1 = await clickTab('待確認截圖');
const b1state = await page.evaluate(() => {
  const cards = document.querySelectorAll('div.grid > div.overflow-hidden');
  const btns = [...document.querySelectorAll('button')].map((b) => b.textContent.trim());
  return {
    cardCount: cards.length,
    hasApprove: btns.some((t) => t.includes('確認')),
    hasReject: btns.some((t) => t.includes('駁回')),
    tabLabel: [...document.querySelectorAll('button')].find((b) => b.textContent.includes('待確認截圖'))?.className.includes('bg-cobaltBright'),
    bodyHasEmptyState: document.body.innerText.includes('沒有待確認的紀錄'),
  };
});
console.log('B1 clicked=', c1, JSON.stringify(b1state));
await page.screenshot({ path: `${SHOTS}/admin-1-review.png`, fullPage: true });

// B2 訓練出席
const c2 = await clickTab('訓練出席');
const b2state = await page.evaluate(() => {
  const dateInput = document.querySelector('input[type=date]');
  const sel = document.querySelector('select');
  const rows = document.querySelectorAll('table tbody tr');
  const rowTexts = [...rows].map((r) => r.innerText.replace(/\s+/g, ' ').trim());
  return {
    dateValue: dateInput ? dateInput.value : null,
    selectOptions: sel ? [...sel.options].map((o) => `${o.value}|${o.text}`) : null,
    rowCount: rows.length,
    rowTexts,
    tabLabel: [...document.querySelectorAll('button')].find((b) => b.textContent.includes('訓練出席'))?.textContent,
  };
});
console.log('B2 clicked=', c2, JSON.stringify(b2state, null, 1));
await page.screenshot({ path: `${SHOTS}/admin-2-training.png`, fullPage: true });

// B3 達成名單
const c3 = await clickTab('達成名單');
const b3state = await page.evaluate(() => {
  const rows = [...document.querySelectorAll('table tbody tr')].map((r) => r.innerText.replace(/\s+/g, ' ').trim());
  return {
    rowCount: rows.length,
    rows,
    hasIssueBtn: [...document.querySelectorAll('button')].some((b) => b.textContent.includes('發放')),
    tabLabel: [...document.querySelectorAll('button')].find((b) => b.textContent.includes('達成名單'))?.textContent,
  };
});
console.log('B3 clicked=', c3, JSON.stringify(b3state, null, 1));
await page.screenshot({ path: `${SHOTS}/admin-3-winners.png`, fullPage: true });

console.log('\n===== CONSOLE / ERROR LOG (A+B) =====');
console.log(logs.length ? logs.join('\n') : '(無 console 訊息)');
console.log('\n===== ERROR COUNT =====', errors.length);

await browser.close();
