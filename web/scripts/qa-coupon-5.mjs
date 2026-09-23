import puppeteer from 'puppeteer-core';

const BASE = 'http://localhost:3000';
const SHOTS = '/workspace/msw/web/scripts/shots';
const logs = []; const errors = [];
function attach(page, tag) {
  page.on('console', (m) => { const t = m.type(); const l = `[${tag}][console:${t}] ${m.text()}`; logs.push(l); if (t === 'error') errors.push(l); });
  page.on('pageerror', (e) => { const l = `[${tag}][pageerror] ${e.message}`; logs.push(l); errors.push(l); });
  page.on('requestfailed', (r) => { if (r.url().includes('_rsc')) return; const l = `[${tag}][requestfailed] ${r.url()} :: ${r.failure()?.errorText}`; logs.push(l); errors.push(l); });
  page.on('response', (r) => { if (r.status() >= 400) { const l = `[${tag}][http:${r.status()}] ${r.url()}`; logs.push(l); errors.push(l); } });
}

const browser = await puppeteer.launch({
  executablePath: '/usr/bin/chromium', headless: 'new',
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
  defaultViewport: { width: 1440, height: 1000, deviceScaleFactor: 1 },
});

async function login(page, email, pw) {
  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle2' });
  await page.waitForSelector('input[type=email]');
  await page.type('input[type=email]', email, { delay: 5 });
  await page.type('input[type=password]', pw, { delay: 5 });
  await page.evaluate(() => [...document.querySelectorAll('button')].find((b) => b.textContent.trim() === '登入').click());
  await page.waitForFunction(() => location.pathname === '/dashboard', { timeout: 20000 }).catch(() => {});
  await new Promise((r) => setTimeout(r, 1200));
}

// ---- 1. Kelvin dashboard points ----
const c1 = await browser.createBrowserContext(); const p1 = await c1.newPage(); attach(p1, 'kelvin');
await login(p1, 'kelvin@msw.mo', 'msw2026');
await p1.goto(`${BASE}/dashboard`, { waitUntil: 'networkidle2' });
await new Promise((r) => setTimeout(r, 2500));
const kPts = await p1.evaluate(() => {
  const t = document.body.innerText;
  const i = t.indexOf('可用積分');
  return { snippet: t.slice(Math.max(0, i - 120), i + 60).replace(/\n+/g, ' | ') };
});
console.log('KELVIN POINTS SNIPPET =', JSON.stringify(kPts, null, 1));

const usedStyle = await p1.evaluate(() => {
  const codes = [...document.querySelectorAll('*')].filter((e) => e.children.length === 0 && /^MSW-/.test(e.textContent.trim()));
  return codes.map((e) => {
    const card = e.closest('div.border,div.rounded,li') || e.parentElement;
    return {
      code: e.textContent.trim(),
      codeColor: getComputedStyle(e).color,
      codeOpacity: getComputedStyle(e).opacity,
      cardCls: card?.className?.slice?.(0, 160),
      cardOpacity: card ? getComputedStyle(card).opacity : null,
    };
  });
});
console.log('COUPON VISUAL =', JSON.stringify(usedStyle, null, 1));

// ---- 2. anon API ----
const c2 = await browser.createBrowserContext(); const p2 = await c2.newPage(); attach(p2, 'anon');
await p2.goto(BASE, { waitUntil: 'domcontentloaded' });
const anonPost = await p2.evaluate(async () => {
  const r = await fetch('/api/admin/coupons/redeem', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ code: 'MSW-202609-99ZA938Z' }) });
  return { status: r.status, body: await r.text() };
});
console.log('ANON POST =', JSON.stringify(anonPost));
const anonGet = await p2.evaluate(async () => {
  const r = await fetch('/api/admin/coupons/redeem?code=MSW-202609-99ZA938Z');
  return { status: r.status, body: await r.text() };
});
console.log('ANON GET =', JSON.stringify(anonGet));

// ---- 3. admin API edge cases ----
const c3 = await browser.createBrowserContext(); const p3 = await c3.newPage(); attach(p3, 'admin');
await login(p3, 'admin@msw.mo', 'msw2026admin');
const edges = await p3.evaluate(async () => {
  const out = [];
  const cases = [
    ['GET no code', 'GET', '/api/admin/coupons/redeem'],
    ['GET empty code', 'GET', '/api/admin/coupons/redeem?code='],
    ['GET unknown', 'GET', '/api/admin/coupons/redeem?code=NOPE'],
    ['GET injection', 'GET', `/api/admin/coupons/redeem?code=${encodeURIComponent("' OR 1=1 --")}`],
    ['GET long', 'GET', `/api/admin/coupons/redeem?code=${'A'.repeat(5000)}`],
    ['POST no body', 'POST', '/api/admin/coupons/redeem'],
    ['POST empty code', 'POST', '/api/admin/coupons/redeem'],
    ['POST lowercase', 'POST', '/api/admin/coupons/redeem'],
  ];
  for (const [name, method, url] of cases) {
    let r;
    if (name === 'POST no body') r = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({}) });
    else if (name === 'POST empty code') r = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ code: '' }) });
    else if (name === 'POST lowercase') r = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ code: 'msw-202609-ksxuuugf' }) });
    else r = await fetch(url, { method });
    const b = await r.text();
    out.push({ name, status: r.status, body: b.slice(0, 220) });
  }
  return out;
});
console.log('ADMIN API EDGE CASES =', JSON.stringify(edges, null, 1));

// ---- 4. all four tabs ----
await p3.goto(`${BASE}/admin`, { waitUntil: 'networkidle2' });
await new Promise((r) => setTimeout(r, 1800));
for (const [i, t] of ['待確認截圖', '訓練出席', '達成名單', '優惠券'].entries()) {
  await p3.evaluate((x) => [...document.querySelectorAll('button')].find((b) => b.textContent.replace(/\s+/g,'').includes(x))?.click(), t);
  await new Promise((r) => setTimeout(r, 1200));
  const active = await p3.evaluate((x) => {
    const b = [...document.querySelectorAll('button')].find((b) => b.textContent.replace(/\s+/g,'').includes(x));
    return { label: b?.textContent.replace(/\s+/g,' ').trim(), cls: b?.className.slice(0, 120) };
  }, t);
  const h = await p3.evaluate(() => document.body.scrollHeight);
  console.log(`TAB ${i + 1} ${t} ->`, JSON.stringify(active), 'pageHeight =', h);
  await p3.screenshot({ path: `${SHOTS}/coupon-9-tab${i + 1}-${t}.png`, fullPage: true });
}

console.log('\n===== LOGS =====');
console.log(logs.length ? logs.join('\n') : '(none)');
console.log('===== ERROR COUNT =====', errors.length);
await browser.close();
