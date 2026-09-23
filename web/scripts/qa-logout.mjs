import puppeteer from 'puppeteer-core';

const BASE = 'http://localhost:3000';
const browser = await puppeteer.launch({
  executablePath: '/usr/bin/chromium',
  headless: 'new',
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
  defaultViewport: { width: 1440, height: 1000 },
});
const page = await browser.newPage();

// 以 ming 登入
await page.goto(`${BASE}/login`, { waitUntil: 'networkidle2' });
await page.type('input[type=email]', 'ming@msw.mo', { delay: 10 });
await page.type('input[type=password]', 'msw2026', { delay: 10 });
await page.evaluate(() => {
  [...document.querySelectorAll('button')].find((b) => b.textContent.trim() === '登入').click();
});
await page.waitForFunction(() => location.pathname === '/dashboard', { timeout: 20000 });

// 等待「登出」按鈕出現（hydration 後）並點擊
await page.waitForFunction(() => [...document.querySelectorAll('button, a')].some((x) => x.textContent.trim() === '登出'), { timeout: 10000 });
const clicked = await page.evaluate(() => {
  const b = [...document.querySelectorAll('button, a')].find((x) => x.textContent.trim() === '登出');
  b.click();
  return true;
});
console.log('logout clicked =', clicked);
await new Promise((r) => setTimeout(r, 2500));
console.log('url after logout =', page.url());

const sess = await page.evaluate(async () => {
  const r = await fetch('/api/auth/session');
  return await r.json();
});
console.log('session after logout =', JSON.stringify(sess));

// 受保護頁面應導回登入頁
await page.goto(`${BASE}/dashboard`, { waitUntil: 'networkidle2' });
await new Promise((r) => setTimeout(r, 800));
console.log('url visiting /dashboard after logout =', page.url(), '(預期 /login)');

await browser.close();
