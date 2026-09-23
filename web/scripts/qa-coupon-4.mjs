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
    logs.push(line); errors.push(line);
  });
  page.on('requestfailed', (r) => {
    if (r.url().includes('_rsc')) return;
    const line = `[${tag}][requestfailed] ${r.url()} :: ${r.failure()?.errorText}`;
    logs.push(line); errors.push(line);
  });
  page.on('response', (r) => {
    if (r.status() >= 400) { const line = `[${tag}][http:${r.status()}] ${r.url()}`; logs.push(line); errors.push(line); }
  });
}

const browser = await puppeteer.launch({
  executablePath: '/usr/bin/chromium',
  headless: 'new',
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
  defaultViewport: { width: 1440, height: 1000, deviceScaleFactor: 1 },
});

async function login(page, email, pw) {
  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle2' });
  await page.waitForSelector('input[type=email]');
  // clear cookies first handled by new browser context
  await page.type('input[type=email]', email, { delay: 5 });
  await page.type('input[type=password]', pw, { delay: 5 });
  await page.evaluate(() => [...document.querySelectorAll('button')].find((b) => b.textContent.trim() === '登入').click());
  await new Promise((r) => setTimeout(r, 3500));
  return page.url();
}

async function logout(page) {
  await page.goto(`${BASE}/dashboard`, { waitUntil: 'networkidle2' }).catch(() => {});
  const clicked = await page.evaluate(() => {
    const b = [...document.querySelectorAll('button')].find((x) => x.textContent.includes('登出'));
    if (b) { b.click(); return true; }
    return false;
  });
  await new Promise((r) => setTimeout(r, 2500));
  // hard clear session cookies to be safe
  const cookies = await page.cookies();
  for (const c of cookies) await page.deleteCookie(c);
  await new Promise((r) => setTimeout(r, 500));
  return clicked;
}

// ================= D. 會員端 =================
const ctxK = await browser.createBrowserContext();
const pageK = await ctxK.newPage();
attach(pageK, 'kelvin');
const kUrl = await login(pageK, 'kelvin@msw.mo', 'msw2026');
console.log('D0 kelvin after login url =', kUrl);

await pageK.goto(`${BASE}/dashboard`, { waitUntil: 'networkidle2' });
await new Promise((r) => setTimeout(r, 2500));

const dashInfo = await pageK.evaluate(() => {
  const txt = document.body.innerText;
  const idx = txt.indexOf('我的優惠券');
  return {
    hasCouponSection: idx >= 0,
    context: idx >= 0 ? txt.slice(idx, idx + 400) : null,
    pointsHits: (txt.match(/\d+/) || []).slice(0, 5),
    fullLen: txt.length,
  };
});
console.log('D1 hasCouponSection =', dashInfo.hasCouponSection);
console.log('D1 context =', JSON.stringify(dashInfo.context));

// locate 我的優惠券 section and scroll to it
const couponSection = await pageK.evaluate(() => {
  const heads = [...document.querySelectorAll('h1,h2,h3,h4,p,div')].filter((e) => e.textContent.trim() === '我的優惠券');
  return heads.length ? heads[heads.length - 1].tagName : null;
});
console.log('D2 section tag =', couponSection);

const box = await pageK.evaluate(() => {
  const heads = [...document.querySelectorAll('h1,h2,h3,h4,p,div')].filter((e) => e.textContent.trim() === '我的優惠券');
  if (!heads.length) return null;
  const el = heads[heads.length - 1];
  el.scrollIntoView({ block: 'center' });
  const r = el.getBoundingClientRect();
  return { top: r.top, left: r.left };
});
await new Promise((r) => setTimeout(r, 1500));
await pageK.screenshot({ path: `${SHOTS}/coupon-5-member-used.png`, fullPage: true });
await pageK.screenshot({ path: `${SHOTS}/coupon-5-member-used-viewport.png` });

// deep dive: coupon card DOM
const couponCards = await pageK.evaluate(() => {
  const all = [...document.querySelectorAll('div')].filter((d) => d.textContent.includes('MSW-202609'));
  return all.slice(-4).map((d) => ({
    text: d.innerText.replace(/\s+/g,' ').trim().slice(0, 300),
    opacity: getComputedStyle(d).opacity,
    color: getComputedStyle(d).color,
    cls: d.className,
  }));
});
console.log('D3 coupon cards =', JSON.stringify(couponCards, null, 1));

const pointsCard = await pageK.evaluate(() => {
  const t = document.body.innerText;
  const m = t.match(/[^\n]{0,40}積分[^\n]{0,60}/g);
  return m ? m.slice(0, 12) : null;
});
console.log('D4 points text =', JSON.stringify(pointsCard, null, 1));
console.log('D4 page URL =', pageK.url());
await ctxK.close();

// ================= E. 權限 =================
const ctxM = await browser.createBrowserContext();
const pageM = await ctxM.newPage();
attach(pageM, 'ming');
const mUrl = await login(pageM, 'ming@msw.mo', 'msw2026');
console.log('\nE0 ming after login url =', mUrl);

await pageM.goto(`${BASE}/admin`, { waitUntil: 'networkidle2' });
await new Promise((r) => setTimeout(r, 2500));
const adminState = await pageM.evaluate(() => ({
  url: location.pathname,
  body: document.body.innerText.slice(0, 800),
  hasForbidden: document.body.innerText.includes('沒有權限'),
}));
console.log('E1 url =', adminState.url);
console.log('E1 hasForbidden =', adminState.hasForbidden);
console.log('E1 body =', JSON.stringify(adminState.body));
await pageM.screenshot({ path: `${SHOTS}/coupon-6-member-forbidden.png`, fullPage: true });

// E2: member hits the redeem API directly
const apiAsMember = await pageM.evaluate(async () => {
  const r = await fetch('/api/admin/coupons/redeem', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ code: 'MSW-202609-KSXUUUGF' }),
  });
  return { status: r.status, body: await r.text() };
});
console.log('E2 member POST redeem =', JSON.stringify(apiAsMember, null, 1));

const apiGetAsMember = await pageM.evaluate(async () => {
  const r = await fetch('/api/admin/coupons/redeem?code=MSW-202609-KSXUUUGF');
  return { status: r.status, body: await r.text() };
});
console.log('E3 member GET redeem =', JSON.stringify(apiGetAsMember, null, 1));

// logout & anonymous API check
await logout(pageM);
const anonCtx = await browser.createBrowserContext();
const pageAnon = await anonCtx.newPage();
attach(pageAnon, 'anon');
const anonPost = await pageAnon.evaluate(async () => {
  const r = await fetch('/api/admin/coupons/redeem', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ code: 'MSW-202609-99ZA938Z' }),
  });
  return { status: r.status, body: await r.text() };
}).catch((e) => ({ err: String(e) }));
console.log('E4 anon POST redeem =', JSON.stringify(anonPost));

console.log('\n===== LOGS =====');
console.log(logs.length ? logs.join('\n') : '(none)');
console.log('===== ERROR COUNT =====', errors.length);
await browser.close();
