// R2 shared helpers: cookie reuse + fresh login fallback
const puppeteer = require('puppeteer-core');
const fs = require('fs');
const BASE = 'https://a6dd31b4ad670a126.app.workbuddy.host';
const CHROME = '/usr/bin/chromium';
const SHOTS = '/workspace/msw/qa-screenshots';

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

function normSameSite(s) {
  const v = String(s || 'None').toLowerCase();
  return v === 'lax' ? 'Lax' : v === 'strict' ? 'Strict' : 'None';
}

async function setCookies(browser, file) {
  const cookies = JSON.parse(fs.readFileSync(file, 'utf8'));
  for (const c of cookies) {
    try {
      await browser.setCookie({
        name: c.name, value: c.value, domain: c.domain, path: c.path,
        httpOnly: !!c.httpOnly, secure: !!c.secure, sameSite: normSameSite(c.sameSite),
        expires: c.expires && c.expires > 0 ? c.expires : undefined,
      });
    } catch (e) { /* ignore stale */ }
  }
}

async function launch(cookieFile) {
  const browser = await puppeteer.launch({
    executablePath: CHROME, headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
  });
  if (cookieFile && fs.existsSync(cookieFile)) await setCookies(browser, cookieFile);
  return browser;
}

// returns 'admin' | 'member' | 'none'
async function sessionRole(page) {
  const raw = await page.evaluate(async () => {
    try {
      const r = await fetch('/api/auth/session', { credentials: 'include' });
      return await r.text();
    } catch (e) { return ''; }
  });
  try {
    const j = JSON.parse(raw);
    return (j && j.user && j.user.role) || 'none';
  } catch (e) { return 'none'; }
}

async function freshLogin(browser, email, password) {
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });
  await page.goto(BASE + '/login', { waitUntil: 'networkidle2', timeout: 30000 });
  await wait(700);
  await page.type('input[type="email"]', email, { delay: 8 });
  await page.type('input[type="password"]', password, { delay: 8 });
  await wait(250);
  const btns = await page.$$('button');
  for (const b of btns) {
    const t = await b.evaluate((el) => (el.innerText || '').trim());
    if (t.includes('登入')) {
      await Promise.all([
        page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 }).catch(() => {}),
        b.evaluate((el) => el.click()),
      ]);
      break;
    }
  }
  await wait(1800);
  return page;
}

async function shot(page, name, full = true) {
  if (!fs.existsSync(SHOTS)) fs.mkdirSync(SHOTS, { recursive: true });
  const path = `${SHOTS}/${name}.png`;
  await page.screenshot({ path, fullPage: full });
  console.log('  [shot] ' + path);
  return path;
}

async function clickText(page, text, opts = {}) {
  const { tag = null, exact = false, index = 0 } = opts;
  const handles = await page.$$('a, button, [role="tab"], input[type="submit"], label, summary');
  const matches = [];
  for (const h of handles) {
    const info = await h.evaluate((el) => {
      const r = el.getBoundingClientRect();
      const t = (el.innerText || el.value || el.getAttribute('aria-label') || '').trim().replace(/\s+/g, ' ');
      return { visible: r.width > 0 || r.height > 0, text: t, tag: el.tagName.toLowerCase() };
    });
    if (!info.visible) continue;
    if (tag && info.tag !== tag) continue;
    const hit = exact ? info.text === text : info.text.includes(text);
    if (hit) matches.push(h);
  }
  if (!matches.length) throw new Error(`clickText: no visible element matching "${text}"`);
  const target = matches[Math.min(index, matches.length - 1)];
  await target.evaluate((el) => el.scrollIntoView({ block: 'center', behavior: 'instant' }));
  await wait(350);
  try { await target.click({ delay: 30 }); } catch (e) { await target.evaluate((el) => el.click()); }
  return true;
}

async function setValue(page, hint, value) {
  const ok = await page.evaluate((hint, value) => {
    const norm = (s) => (s || '').trim().replace(/\s+/g, ' ');
    const score = (el) => {
      const label = (() => {
        if (el.id) { const l = document.querySelector(`label[for="${el.id}"]`); if (l) return norm(l.innerText); }
        const w = el.closest('label'); if (w) return norm(w.innerText);
        return '';
      })();
      const parts = [norm(el.getAttribute('placeholder')), norm(el.name), norm(el.id), label, norm(el.getAttribute('aria-label'))];
      for (const p of parts) if (p && p.toLowerCase().includes(hint.toLowerCase())) return true;
      return false;
    };
    const cands = [...document.querySelectorAll('input, textarea')].filter((el) => {
      const r = el.getBoundingClientRect();
      return (r.width > 0 || r.height > 0) && el.type !== 'hidden';
    });
    const el = cands.find(score);
    if (!el) return false;
    const proto = el.tagName === 'TEXTAREA' ? HTMLTextAreaElement : HTMLInputElement;
    const setter = Object.getOwnPropertyDescriptor(proto.prototype, 'value').set;
    setter.call(el, value);
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
    el.blur();
    return true;
  }, hint, value);
  if (!ok) throw new Error(`setValue: no field matching "${hint}"`);
  return true;
}

module.exports = { wait, launch, setCookies, sessionRole, freshLogin, shot, clickText, setValue, BASE, SHOTS };
