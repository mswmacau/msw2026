import puppeteer from 'puppeteer-core';

const BASE = 'http://localhost:3000';
const SHOTS = '/workspace/msw/web/scripts/shots';

// ---- 直接用 fetch 登入取得會員積分（資料層校驗用） ----
let jar = new Map();
function cookieHeader() {
  return [...jar].map(([k, v]) => `${k}=${v}`).join('; ');
}
function storeCookies(res) {
  for (const c of res.headers.getSetCookie?.() || []) {
    const [pair] = c.split(';');
    const i = pair.indexOf('=');
    jar.set(pair.slice(0, i).trim(), pair.slice(i + 1).trim());
  }
}
async function apiLogin(email, password) {
  jar = new Map();
  const csrf = await (await fetch(`${BASE}/api/auth/csrf`, { headers: { Cookie: '' } })).json();
  const res = await fetch(`${BASE}/api/auth/callback/credentials`, {
    method: 'POST',
    redirect: 'manual',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Cookie: cookieHeader() },
    body: new URLSearchParams({ csrfToken: csrf.csrfToken, email, password, json: 'true' }),
  });
  storeCookies(res);
  const sess = await (await fetch(`${BASE}/api/auth/session`, { headers: { Cookie: cookieHeader() } })).json();
  return sess;
}

const mingBefore = await apiLogin('ming@msw.mo', 'msw2026');
console.log(`[data] ming 積分(操作前) = ${mingBefore?.user?.points}, totalPoints = ${mingBefore?.user?.totalPoints}`);

// ---- 瀏覽器流程 ----
const logs = [];
const errors = [];
const checkinTraffic = [];

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
  const line = `[pageerror] ${e.message}`;
  logs.push(line);
  errors.push(line);
});
page.on('response', (r) => {
  if (r.status() >= 400) errors.push(`[http:${r.status()}] ${r.url()}`);
});
page.on('request', (r) => {
  if (r.url().includes('/api/checkin')) {
    checkinTraffic.push({ step: 'request', method: r.method(), url: r.url(), postData: r.postData() });
  }
});
page.on('response', async (r) => {
  if (r.url().includes('/api/checkin')) {
    let body = '';
    try { body = JSON.stringify(await r.json()); } catch { body = '(non-json)'; }
    checkinTraffic.push({ step: 'response', status: r.status(), url: r.url(), body });
  }
});
page.on('dialog', async (d) => {
  console.log(`[dialog] type=${d.type()} message="${d.message()}" → accept()`);
  await d.accept();
});

// 登入管理員
await page.goto(`${BASE}/login`, { waitUntil: 'networkidle2' });
await page.type('input[type=email]', 'admin@msw.mo', { delay: 10 });
await page.type('input[type=password]', 'msw2026admin', { delay: 10 });
await page.evaluate(() => {
  [...document.querySelectorAll('button')].find((b) => b.textContent.trim() === '登入').click();
});
await page.waitForFunction(() => location.pathname === '/dashboard', { timeout: 20000 });

// 進入 /admin → 訓練出席 tab
await page.goto(`${BASE}/admin`, { waitUntil: 'networkidle2' });
await new Promise((r) => setTimeout(r, 1200));
await page.evaluate(() => {
  [...document.querySelectorAll('button')].find((b) => b.textContent.includes('訓練出席')).click();
});
await new Promise((r) => setTimeout(r, 800));

const before = await page.evaluate(() => {
  const sel = document.querySelector('select');
  return {
    date: document.querySelector('input[type=date]')?.value,
    rows: [...document.querySelectorAll('table tbody tr')].map((r) => r.innerText.replace(/\s+/g, ' ').trim()),
    options: sel ? [...sel.options].map((o) => `${o.value}|${o.text}`) : [],
  };
});
console.log('[C0] 操作前 =', JSON.stringify(before, null, 1));

// 選擇 阿明（ming@msw.mo）
const mingOption = before.options.find((o) => o.includes('ming@msw.mo'));
if (!mingOption) throw new Error('下拉找不到 ming@msw.mo');
const mingUserId = mingOption.split('|')[0];

await page.select('select', mingUserId);
const selAfter = await page.evaluate(() => document.querySelector('select').value);
console.log(`[C1] 已選中會員 id=${selAfter} (期望 ${mingUserId})`);

// 點擊 ＋ 補簽
await page.evaluate(() => {
  const b = [...document.querySelectorAll('button')].find((x) => x.textContent.includes('補簽'));
  b.click();
});
await new Promise((r) => setTimeout(r, 2000));

const afterAdd = await page.evaluate(() => ({
  toast: [...document.querySelectorAll('p')].map((p) => p.textContent.trim()).filter((t) => t.includes('出席') || t.includes('補簽') || t.includes('已')),
  rows: [...document.querySelectorAll('table tbody tr')].map((r) => r.innerText.replace(/\s+/g, ' ').trim()),
  tabLabel: [...document.querySelectorAll('button')].find((b) => b.textContent.includes('訓練出席'))?.textContent,
  selectValue: document.querySelector('select')?.value,
}));
console.log('[C2] 補簽後 =', JSON.stringify(afterAdd, null, 1));
await page.screenshot({ path: `${SHOTS}/admin-4-after-checkin.png`, fullPage: true });

// 記下該筆 id 所在行
const rowText = afterAdd.rows[0] || '';

// 點擊 移除（dialog 由 page.on('dialog') accept）
await page.evaluate(() => {
  const btn = [...document.querySelectorAll('table tbody tr button')].find((b) => b.textContent.trim() === '移除');
  if (!btn) throw new Error('找不到移除按鈕');
  btn.click();
});
await new Promise((r) => setTimeout(r, 2000));

const afterRemove = await page.evaluate(() => ({
  rows: [...document.querySelectorAll('table tbody tr')].map((r) => r.innerText.replace(/\s+/g, ' ').trim()),
  tabLabel: [...document.querySelectorAll('button')].find((b) => b.textContent.includes('訓練出席'))?.textContent,
  toasts: [...document.querySelectorAll('p')].map((p) => p.textContent.trim()).filter((t) => t.includes('移除') || t.includes('出席')),
}));
console.log('[C3] 移除後 =', JSON.stringify(afterRemove, null, 1));
await page.screenshot({ path: `${SHOTS}/admin-5-after-remove.png`, fullPage: true });

// ---- 額外驗證：點「載入名單」（使用畫面上錯誤的日期 09-20）會發生什麼 ----
await page.evaluate(() => {
  const b = [...document.querySelectorAll('button')].find((x) => x.textContent.trim() === '載入名單');
  b.click();
});
await new Promise((r) => setTimeout(r, 1500));
const afterLoad = await page.evaluate(() => ({
  toast: [...document.querySelectorAll('p')].map((p) => p.textContent.trim()).find((t) => t.includes('出席')),
  rows: [...document.querySelectorAll('table tbody tr')].map((r) => r.innerText.replace(/\s+/g, ' ').trim()),
}));
console.log('[C4] 以畫面日期(2026-09-20)點「載入名單」後 =', JSON.stringify(afterLoad, null, 1));
await page.screenshot({ path: `${SHOTS}/admin-6-load-with-shown-date.png`, fullPage: true });

console.log('\n===== /api/checkin 網路流量 =====');
console.log(JSON.stringify(checkinTraffic, null, 1));

console.log('\n===== CONSOLE / ERROR =====');
console.log(logs.join('\n') || '(無)');
console.log('error count =', errors.length);

await browser.close();

// ---- 資料層複核：ming 積分（操作後，應與操作前一致） ----
const mingAfter = await apiLogin('ming@msw.mo', 'msw2026');
console.log(`\n[data] ming 積分(操作後) = ${mingAfter?.user?.points}, totalPoints = ${mingAfter?.user?.totalPoints}`);
console.log(`[data] 積分是否復原: ${mingBefore?.user?.points === mingAfter?.user?.points ? '是' : `否！${mingBefore?.user?.points} → ${mingAfter?.user?.points}`}`);
