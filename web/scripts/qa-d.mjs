import puppeteer from 'puppeteer-core';

const BASE = 'http://localhost:3000';
const SHOTS = '/workspace/msw/web/scripts/shots';

const logs = [];
const errors = [];

const browser = await puppeteer.launch({
  executablePath: '/usr/bin/chromium',
  headless: 'new',
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
  defaultViewport: { width: 1440, height: 1000, deviceScaleFactor: 1 },
});
const page = await browser.newPage();
page.on('console', (m) => {
  const line = `[console:${m.type()}] ${m.text()}`;
  logs.push(line);
  if (m.type() === 'error') errors.push(line);
});
page.on('pageerror', (e) => {
  errors.push(`[pageerror] ${e.message}`);
  logs.push(`[pageerror] ${e.message}`);
});
page.on('response', (r) => {
  if (r.status() >= 400) {
    errors.push(`[http:${r.status()}] ${r.url()}`);
    logs.push(`[http:${r.status()}] ${r.url()}`);
  }
});
page.on('dialog', async (d) => d.accept());

// 1) 管理員登出（真實點擊）
await page.goto(`${BASE}/admin`, { waitUntil: 'networkidle2' });
const logoutClicked = await page.evaluate(() => {
  const b = [...document.querySelectorAll('button, a')].find((x) => x.textContent.trim() === '登出');
  if (!b) return false;
  b.click();
  return true;
});
await new Promise((r) => setTimeout(r, 1500));
console.log('D0 logout clicked =', logoutClicked, 'url =', page.url());

// 2) 以 ming 登入
await page.goto(`${BASE}/login`, { waitUntil: 'networkidle2' });
await page.type('input[type=email]', 'ming@msw.mo', { delay: 10 });
await page.type('input[type=password]', 'msw2026', { delay: 10 });
await page.evaluate(() => {
  [...document.querySelectorAll('button')].find((b) => b.textContent.trim() === '登入').click();
});
await page.waitForFunction(() => location.pathname === '/dashboard', { timeout: 20000 });
await new Promise((r) => setTimeout(r, 1500));
console.log('D1 ming logged in, url =', page.url());

// 3) 檢查 dashboard 內容
const state = await page.evaluate(() => {
  const text = document.body.innerText;
  // 會員卡
  const name = document.querySelector('h1')?.textContent;
  const pointBlocks = [...document.querySelectorAll('p')].filter((p) => p.textContent.trim() === '可用積分' || p.textContent.trim() === '歷史累積');
  // 本週場次區塊
  const hasWeekBlock = text.includes('本週場次');
  const weekBlockText = (() => {
    const el = [...document.querySelectorAll('p')].find((p) => p.textContent.trim() === '本週場次');
    if (!el) return null;
    const box = el.closest('div.flex');
    return box ? box.innerText.replace(/\s+/g, ' ').trim() : null;
  })();
  // 簽到按鈕狀態
  const chipTexts = [...document.querySelectorAll('span')].map((s) => s.textContent.trim()).filter((t) => t.includes('非活動日') || t.includes('已簽到') || t.includes('尚未開放') || t.includes('我要簽到'));
  const checkInBtn = [...document.querySelectorAll('button')].some((b) => b.textContent.includes('我要簽到'));
  // 積分明細
  const logsText = text.includes('積分明細');
  return {
    name,
    hasPointsCard: pointBlocks.length >= 2,
    hasWeekBlock,
    weekBlockText,
    chipTexts,
    checkInBtnVisible: checkInBtn,
    hasLogs: logsText,
    // 積分明細前幾筆
    recentLogs: (() => {
      const card = [...document.querySelectorAll('div.card, div')].find((c) => c.querySelector('h2')?.textContent === '積分明細');
      return card ? [...card.querySelectorAll('li')].slice(0, 5).map((li) => li.innerText.replace(/\s+/g, ' ').trim()) : null;
    })(),
    bodyTextSample: text.slice(0, 1200),
  };
});
console.log('D2 dashboard state =', JSON.stringify(state, null, 1));

await page.screenshot({ path: `${SHOTS}/member-dashboard.png`, fullPage: true });

// 4) 額外：會員直接 POST /api/checkin（非活動日應被 403 擋下）— 用頁面內 fetch（帶會員 cookie）
const guard = await page.evaluate(async () => {
  const r = await fetch('/api/checkin', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({}),
  });
  return { status: r.status, body: await r.json() };
});
console.log('D3 會員於週三自助簽到 = ', JSON.stringify(guard), '(預期 403)');

// 5) 會員嘗試 GET 管理端出席名單（all=1 應 403）
const guard2 = await page.evaluate(async () => {
  const r = await fetch('/api/checkin?all=1');
  return { status: r.status, body: await r.json() };
});
console.log('D4 會員存取管理端名單 = ', JSON.stringify(guard2), '(預期 403)');

// 6) 會員存取 /admin 頁面
await page.goto(`${BASE}/admin`, { waitUntil: 'networkidle2' });
await new Promise((r) => setTimeout(r, 800));
const adminGuard = await page.evaluate(() => document.body.innerText.slice(0, 200));
console.log('D5 會員開 /admin =', JSON.stringify(adminGuard));
await page.screenshot({ path: `${SHOTS}/member-admin-forbidden.png` });

console.log('\n===== CONSOLE / ERROR =====');
console.log(logs.join('\n') || '(無)');
console.log('error count =', errors.length);

await browser.close();
