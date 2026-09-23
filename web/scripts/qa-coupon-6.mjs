import puppeteer from 'puppeteer-core';
const BASE = 'http://localhost:3000';
const SHOTS = '/workspace/msw/web/scripts/shots';
const logs = []; const errors = [];
function attach(page, tag) {
  page.on('console', (m) => { const t = m.type(); const l = `[${tag}][console:${t}] ${m.text()}`; logs.push(l); if (t === 'error') errors.push(l); });
  page.on('pageerror', (e) => { const l = `[${tag}][pageerror] ${e.message}`; logs.push(l); errors.push(l); });
}
const browser = await puppeteer.launch({
  executablePath: '/usr/bin/chromium', headless: 'new',
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
  defaultViewport: { width: 1440, height: 1000, deviceScaleFactor: 1 },
});
async function login(page, email, pw) {
  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle2' });
  await page.waitForSelector('input[type=email]');
  await page.type('input[type=email]', email, { delay: 4 });
  await page.type('input[type=password]', pw, { delay: 4 });
  await page.evaluate(() => [...document.querySelectorAll('button')].find((b) => b.textContent.trim() === '登入').click());
  await page.waitForFunction(() => location.pathname === '/dashboard', { timeout: 20000 }).catch(() => {});
  await new Promise((r) => setTimeout(r, 1200));
}

// ---------- PART 1: 會員端乾淨截圖 ----------
const c1 = await browser.createBrowserContext(); const p1 = await c1.newPage(); attach(p1, 'kelvin');
await login(p1, 'kelvin@msw.mo', 'msw2026');
await p1.goto(`${BASE}/dashboard`, { waitUntil: 'networkidle2' });
await new Promise((r) => setTimeout(r, 2500));
await p1.evaluate(() => {
  const h = [...document.querySelectorAll('h2')].find((e) => e.textContent.trim() === '我的優惠券');
  if (h) h.scrollIntoView({ block: 'center' });
});
await new Promise((r) => setTimeout(r, 1200));
await p1.screenshot({ path: `${SHOTS}/coupon-5-member-used.png`, fullPage: true });
await p1.screenshot({ path: `${SHOTS}/coupon-5-member-used-viewport.png` });
const kInfo = await p1.evaluate(() => {
  const t = document.body.innerText;
  const i = t.indexOf('我的優惠券');
  return { snippet: t.slice(i, i + 260).replace(/\n+/g, ' | '), pts: (t.match(/可用積分\s*(\d+)/) || [])[1] };
});
console.log('KELVIN DASH =', JSON.stringify(kInfo, null, 1));
await c1.close();

// ---------- PART 2: 列表即時刷新驗證（用 阿明 的券，測後還原）----------
const c2 = await browser.createBrowserContext(); const p2 = await c2.newPage(); attach(p2, 'admin');
await login(p2, 'admin@msw.mo', 'msw2026admin');
await p2.goto(`${BASE}/admin`, { waitUntil: 'networkidle2' });
await new Promise((r) => setTimeout(r, 1500));
await p2.evaluate(() => [...document.querySelectorAll('button')].find((b) => b.textContent.replace(/\s+/g,'').includes('優惠券')).click());
await new Promise((r) => setTimeout(r, 1200));

const netBefore = [];
p2.on('request', (r) => netBefore.push(r.url()));
netBefore.length = 0;

const input = await (async () => { for (const h of await p2.$$('input')) if (await h.evaluate((el) => el.type === 'text')) return h; throw new Error('no input'); })();
await input.click();
await input.type('MSW-202609-KSXUUUGF', { delay: 8 });
await p2.evaluate(() => [...document.querySelectorAll('button')].find((b) => b.textContent.includes('核銷')).click());
await new Promise((r) => setTimeout(r, 6000));   // 等 6 秒看列表會不會自己更新

const reqs = netBefore.filter((u) => !u.includes('_rsc'));
console.log('\nREQUESTS AFTER REDEEM CLICK =', JSON.stringify(reqs, null, 1));
const listNow = await p2.evaluate(() => [...document.querySelectorAll('table tbody tr')].map((r) => r.innerText.replace(/\s+/g,' ').trim()));
console.log('LIST 6s AFTER REDEEM (no reload) =', JSON.stringify(listNow, null, 1));
await p2.screenshot({ path: `${SHOTS}/coupon-10-stale-list.png`, fullPage: true });

await p2.reload({ waitUntil: 'networkidle2' });
await new Promise((r) => setTimeout(r, 1500));
await p2.evaluate(() => [...document.querySelectorAll('button')].find((b) => b.textContent.replace(/\s+/g,'').includes('優惠券')).click());
await new Promise((r) => setTimeout(r, 1500));
const listReload = await p2.evaluate(() => [...document.querySelectorAll('table tbody tr')].map((r) => r.innerText.replace(/\s+/g,' ').trim()));
console.log('LIST AFTER MANUAL RELOAD =', JSON.stringify(listReload, null, 1));
await p2.screenshot({ path: `${SHOTS}/coupon-11-after-reload.png`, fullPage: true });

console.log('\n===== LOGS =====');
console.log(logs.length ? logs.join('\n') : '(none)');
console.log('===== ERROR COUNT =====', errors.length);
await browser.close();
