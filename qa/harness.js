// QA harness: shared helpers for real-browser verification
const puppeteer = require('puppeteer-core');
const fs = require('fs');

const CHROME = '/usr/bin/chromium';
const BASE = 'https://a6dd31b4ad670a126.app.workbuddy.host';
const SHOTS = '/workspace/msw/qa-screenshots';

function ensureDir() {
  if (!fs.existsSync(SHOTS)) fs.mkdirSync(SHOTS, { recursive: true });
}

async function launch(mobile = false) {
  ensureDir();
  const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: 'new',
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
    ],
  });
  const page = await browser.newPage();
  if (mobile) {
    await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  } else {
    await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 1 });
  }
  const errors = [];
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push('console.error: ' + m.text());
  });
  page.on('requestfailed', (r) => errors.push('requestfailed: ' + r.url() + ' ' + (r.failure() && r.failure().errorText)));
  return { browser, page, errors };
}

async function shot(page, name, full = true) {
  ensureDir();
  const path = `${SHOTS}/${name}.png`;
  await page.screenshot({ path, fullPage: full });
  console.log('  [shot] ' + path);
  return path;
}

// Collect visible clickable elements so we can navigate the real UI by text
async function clickables(page) {
  return page.evaluate(() => {
    const out = [];
    document.querySelectorAll('a, button, [role="tab"], input[type="submit"], label').forEach((el) => {
      const r = el.getBoundingClientRect();
      if (r.width === 0 && r.height === 0) return;
      const txt = (el.innerText || el.value || el.getAttribute('aria-label') || '').trim().replace(/\s+/g, ' ');
      out.push({
        tag: el.tagName.toLowerCase(),
        type: el.type || null,
        text: txt.slice(0, 60),
        id: el.id || null,
        cls: (el.className && typeof el.className === 'string' ? el.className : '').slice(0, 60),
        href: el.getAttribute('href'),
        disabled: !!el.disabled,
      });
    });
    return out;
  });
}

async function inputs(page) {
  return page.evaluate(() => {
    const out = [];
    document.querySelectorAll('input, textarea, select').forEach((el) => {
      const r = el.getBoundingClientRect();
      out.push({
        tag: el.tagName.toLowerCase(),
        type: el.type || (el.tagName === 'SELECT' ? 'select' : null),
        name: el.name,
        id: el.id,
        placeholder: el.placeholder,
        cls: (el.className && typeof el.className === 'string' ? el.className : '').slice(0, 50),
        visible: r.width > 0 || r.height > 0,
        value: (el.type === 'checkbox' || el.type === 'radio') ? el.checked : el.value,
        labelText: (() => {
          if (el.id) {
            const l = document.querySelector(`label[for="${el.id}"]`);
            if (l) return l.innerText.trim().replace(/\s+/g, ' ').slice(0, 60);
          }
          const wrap = el.closest('label');
          if (wrap) return wrap.innerText.trim().replace(/\s+/g, ' ').slice(0, 60);
          return null;
        })(),
      });
    });
    return out;
  });
}

// Click the first visible element whose text matches
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
  await wait(450); // allow smooth-scroll/layout to settle before trusted click
  try { await target.click({ delay: 40 }); } catch (e) { await target.evaluate((el) => el.click()); }
  return true;
}

// Set a value on input/textarea identified by label text, placeholder, name or id
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

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

module.exports = { launch, shot, clickables, inputs, clickText, setValue, wait, BASE, SHOTS };
