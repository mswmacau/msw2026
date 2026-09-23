import puppeteer from 'puppeteer-core';

const BASE = 'http://localhost:3000';
const SHOTS = '/workspace/msw/web/scripts/shots';
const TARGET_CODE = 'MSW-202609-KSXUUUGF'; // 阿明 / ming@msw.mo，UNUSED

const browser = await puppeteer.launch({
  executablePath: '/usr/bin/chromium',
  headless: 'new',
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
  defaultViewport: { width: 1440, height: 1100, deviceScaleFactor: 1 },
});

const page = await browser.newPage();
const errs = [];
page.on('pageerror', (e) => errs.push('pageerror: ' + e.message));
page.on('console', (m) => { if (m.type() === 'error') errs.push('console: ' + m.text()); });
page.on('response', (r) => { if (r.status() >= 400) errs.push(`http${r.status()} ${r.url()}`); });

// ---- login ----
await page.goto(`${BASE}/login`, { waitUntil: 'networkidle2' });
await page.waitForSelector('input[type=email]');
await page.type('input[type=email]', 'admin@msw.mo', { delay: 5 });
await page.type('input[type=password]', 'msw2026admin', { delay: 5 });
await page.evaluate(() => {
  const b = [...document.querySelectorAll('button')].find((x) => x.textContent.trim() === '登入');
  b.click();
});
await page.waitForFunction(() => location.pathname === '/dashboard', { timeout: 30000 });
console.log('LOGIN ok, url =', page.url());

// ---- /admin ----
await page.goto(`${BASE}/admin`, { waitUntil: 'networkidle2' });
await new Promise((r) => setTimeout(r, 1200));

// 切到「優惠券」tab
const tabbed = await page.evaluate(() => {
  const b = [...document.querySelectorAll('button')].find((x) => x.textContent.replace(/\s/g, '').includes('優惠券'));
  if (!b) return false;
  b.click();
  return true;
});
await new Promise((r) => setTimeout(r, 1200));
console.log('coupon tab clicked =', tabbed);

// ================= P3：空值禁用態 =================
const emptyState = await page.evaluate(() => {
  const btn = [...document.querySelectorAll('button')].find((x) => x.textContent.includes('核銷'));
  if (!btn) return { found: false };
  const cs = getComputedStyle(btn);
  return {
    found: true,
    text: btn.textContent.trim(),
    disabled: btn.disabled,
    opacity: cs.opacity,
    cursor: cs.cursor,
    bg: cs.backgroundColor,
    ariaDisabled: btn.getAttribute('aria-disabled'),
  };
});
console.log('P3 empty-button state =', JSON.stringify(emptyState));
await page.screenshot({ path: `${SHOTS}/fix2-1-empty-button.png`, fullPage: false });

// 順便確認空值時點擊無反應（不發送請求）
let redeemCalls = 0;
page.on('request', (r) => {
  if (r.url().includes('/api/admin/coupons/redeem')) redeemCalls++;
});
await page.evaluate(() => {
  const btn = [...document.querySelectorAll('button')].find((x) => x.textContent.includes('核銷'));
  btn.click();
});
await new Promise((r) => setTimeout(r, 800));
console.log('P3 click-with-empty redeem requests =', redeemCalls);

// ================= 列表初始快照 =================
const listBefore = await page.evaluate(() => {
  const rows = [...document.querySelectorAll('table tbody tr')];
  return rows.map((tr) => {
    const td = [...tr.querySelectorAll('td')].map((x) => x.textContent.trim());
    return { code: td[0], member: td[1], status: td[4] };
  });
});
console.log('LIST BEFORE =', JSON.stringify(listBefore, null, 1));

// ================= P2-1：核銷後即時刷新 =================
// 標記：若頁面真的重整，此全域變數會消失
await page.evaluate(() => { window.__noReloadMarker = 'alive'; window.__navCount = performance.getEntriesByType('navigation').length; });

await page.click('input.font-mono');
await page.type('input.font-mono', TARGET_CODE, { delay: 10 });
const btnAfterType = await page.evaluate(() => {
  const btn = [...document.querySelectorAll('button')].find((x) => x.textContent.includes('核銷'));
  return { disabled: btn.disabled, opacity: getComputedStyle(btn).opacity };
});
console.log('button state after typing code =', JSON.stringify(btnAfterType));

await page.evaluate(() => {
  const btn = [...document.querySelectorAll('button')].find((x) => x.textContent.includes('核銷'));
  btn.click();
});
await new Promise((r) => setTimeout(r, 3500));

const afterRedeem = await page.evaluate((code) => {
  const resultBox = document.body.innerText.includes('核銷成功') ? '核銷成功' : (document.body.innerText.match(/✕[^\n]*/) || [''])[0];
  const rows = [...document.querySelectorAll('table tbody tr')].map((tr) => {
    const td = [...tr.querySelectorAll('td')].map((x) => x.textContent.trim());
    return { code: td[0], member: td[1], status: td[4], valid: td[5] };
  });
  const target = rows.find((r) => r.code === code);
  return {
    resultBox,
    targetRow: target || null,
    allRows: rows,
    marker: window.__noReloadMarker || 'GONE(頁面已重整)',
    navCount: window.__navCount ?? 'GONE',
    url: location.href,
  };
}, TARGET_CODE);
console.log('AFTER REDEEM =', JSON.stringify(afterRedeem, null, 1));

await page.screenshot({ path: `${SHOTS}/fix2-2-list-updated.png`, fullPage: false });

// ================= P2-2：過期券顯示 =================
await page.screenshot({ path: `${SHOTS}/fix2-3-expired.png`, fullPage: false });
const expiredRow = afterRedeem.allRows.find((r) => r.code === 'PRETEST-EXPIRED-01');
console.log('EXPIRED ROW =', JSON.stringify(expiredRow));

console.log('ERRORS =', JSON.stringify(errs, null, 1));
await browser.close();
