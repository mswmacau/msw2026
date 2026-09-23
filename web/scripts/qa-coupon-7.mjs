import puppeteer from 'puppeteer-core';
const BASE = 'http://localhost:3000';
const SHOTS = '/workspace/msw/web/scripts/shots';
const browser = await puppeteer.launch({
  executablePath: '/usr/bin/chromium', headless: 'new',
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
  defaultViewport: { width: 1440, height: 1000, deviceScaleFactor: 1 },
});
const page = await browser.newPage();
await page.goto(`${BASE}/login`, { waitUntil: 'networkidle2' });
await page.waitForSelector('input[type=email]');
await page.type('input[type=email]', 'admin@msw.mo', { delay: 5 });
await page.type('input[type=password]', 'msw2026admin', { delay: 5 });
await page.evaluate(() => [...document.querySelectorAll('button')].find((b) => b.textContent.trim() === '登入').click());
await page.waitForFunction(() => location.pathname === '/dashboard', { timeout: 20000 }).catch(() => {});
await page.goto(`${BASE}/admin`, { waitUntil: 'networkidle2' });
await new Promise((r) => setTimeout(r, 1500));
await page.evaluate(() => [...document.querySelectorAll('button')].find((b) => b.textContent.replace(/\s+/g,'').includes('優惠券')).click());
await new Promise((r) => setTimeout(r, 1500));
await page.screenshot({ path: `${SHOTS}/coupon-list-final.png`, fullPage: true });

async function getInput() { for (const h of await page.$$('input')) if (await h.evaluate((el) => el.type === 'text')) return h; throw new Error('no input'); }
const input = await getInput();
await input.evaluate((el) => { const s = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set; s.call(el, ''); el.dispatchEvent(new Event('input', { bubbles: true })); });
await input.click(); await input.type('MSW-FAKE-0000', { delay: 8 });
await page.evaluate(() => [...document.querySelectorAll('button')].find((b) => b.textContent.includes('核銷')).click());
await new Promise((r) => setTimeout(r, 2200));
await page.screenshot({ path: `${SHOTS}/coupon-4-not-found.png`, fullPage: true });

await browser.close();
console.log('clean not-found screenshot done');
