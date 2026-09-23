import puppeteer from 'puppeteer-core';
import fs from 'fs';

export const BASE = 'http://localhost:3000';
export const SHOTS = '/workspace/msw/web/scripts/shots';
export const IMG = '/workspace/msw/web/public/images/running-track.jpg';

export const DESKTOP = { width: 1440, height: 900, deviceScaleFactor: 1 };
export const MOBILE = { width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true };

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export async function launch() {
  const browser = await puppeteer.launch({
    executablePath: '/usr/bin/chromium',
    headless: true,
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
    defaultViewport: DESKTOP,
  });
  return browser;
}

/** 建立隔離 context（各自持有 session cookie） */
export async function newPage(browser, vp = DESKTOP) {
  const ctx = browser.createBrowserContext
    ? await browser.createBrowserContext()
    : await browser.createIncognitoBrowserContext();
  const page = await ctx.newPage();
  await page.setViewport(vp);
  const errors = [];
  const dialogs = [];
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(`[console] ${m.text()}`);
  });
  page.on('pageerror', (e) => errors.push(`[pageerror] ${e.message}`));
  page.on('requestfailed', (r) => errors.push(`[reqfail] ${r.url()} ${r.failure()?.errorText}`));
  page.on('response', (r) => {
    if (r.status() >= 400) errors.push(`[http:${r.status()}] ${r.url()}`);
  });
  const prompts = [];
  page.on('dialog', async (d) => {
    dialogs.push(`[${d.type()}] ${d.message()}`);
    if (d.type() === 'prompt') await d.accept(prompts.shift() ?? '');
    else await d.accept();
  });
  page.__errors = errors;
  page.__dialogs = dialogs;
  page.__prompts = prompts;
  return page;
}

export async function shot(page, name) {
  const p = `${SHOTS}/${name}`;
  try {
    await page.screenshot({ path: p });
    const sz = fs.existsSync(p) ? fs.statSync(p).size : 0;
    return { name, ok: sz > 1000, size: sz };
  } catch (e) {
    return { name, ok: false, size: 0, err: String(e.message) };
  }
}

/** 依文字點擊元素（button/a） */
export async function clickText(page, text, tag = 'button') {
  return page.evaluate(
    ({ text, tag }) => {
      const els = [...document.querySelectorAll(`${tag}, [role=button]`)];
      const el =
        els.find((x) => x.textContent.trim() === text) ||
        els.find((x) => x.textContent.replace(/\s+/g, ' ').trim().includes(text));
      if (!el) return false;
      el.scrollIntoView({ block: 'center' });
      el.click();
      return true;
    },
    { text, tag }
  );
}

export async function hasText(page, sub) {
  return page.evaluate((s) => document.body.innerText.includes(s), sub);
}

export async function bodyText(page) {
  return page.evaluate(() => document.body.innerText);
}

/** 用原生 setter 填入 input，確保 React onChange 觸發 */
export async function fill(page, selector, value, clear = true) {
  return page.evaluate(
    ({ selector, value, clear }) => {
      const el = document.querySelector(selector);
      if (!el) return false;
      const setter = Object.getOwnPropertyDescriptor(
        el instanceof HTMLTextAreaElement
          ? window.HTMLTextAreaElement.prototype
          : window.HTMLInputElement.prototype,
        'value'
      ).set;
      if (clear) setter.call(el, '');
      setter.call(el, value);
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
      return true;
    },
    { selector, value, clear }
  );
}

export async function login(page, email, password) {
  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle2', timeout: 60000 });
  await sleep(600);
  await fill(page, 'input[type=email]', email);
  await fill(page, 'input[type=password]', password);
  const clicked = await clickText(page, '登入');
  await sleep(3000);
  return { clicked, url: page.url() };
}

export async function logout(page) {
  await page.goto(`${BASE}/`, { waitUntil: 'networkidle2', timeout: 60000 });
  await sleep(500);
  const ok = await clickText(page, '登出', 'button, a');
  await sleep(2500);
  return ok;
}

/** 從 dashboard 抓取 可用積分 / 本月 KM */
export async function readDashboard(page) {
  const t = await bodyText(page);
  const pts = t.match(/可用積分[\s\S]{0,60}?(\d+)/);
  const km = t.match(/([\d.]+)\s*\/\s*(\d+)\s*KM/);
  return {
    points: pts ? Number(pts[1]) : null,
    km: km ? Number(km[1]) : null,
    goal: km ? Number(km[2]) : null,
  };
}

/** 從 /run 抓取月度進度與統計 */
export async function readRun(page) {
  const t = await bodyText(page);
  const km = t.match(/([\d.]+)\s*\/\s*(\d+)\s*KM/);
  const nums = await page.evaluate(() => {
    const out = {};
    document.querySelectorAll('p').forEach((p) => {
      const label = p.textContent.trim();
      if (!['待確認', '已確認', '已駁回'].includes(label)) return;
      const prev = p.previousElementSibling;
      if (prev) out[label] = Number(prev.textContent.trim());
    });
    return out;
  });
  const rows = await page.evaluate(() => {
    return [...document.querySelectorAll('li, div')]
      .filter((el) => /待確認|已確認|已駁回/.test(el.textContent) && el.textContent.includes('KM'))
      .slice(0, 12)
      .map((el) => el.textContent.replace(/\s+/g, ' ').trim().slice(0, 120));
  });
  return { km: km ? Number(km[1]) : null, goal: km ? Number(km[2]) : null, nums, rows };
}

/** 橫向溢出偵測 */
export async function overflow(page) {
  return page.evaluate(() => {
    const de = document.documentElement;
    const offenders = [];
    document.querySelectorAll('*').forEach((el) => {
      const r = el.getBoundingClientRect();
      if (r.width > 0 && r.right > window.innerWidth + 1) {
        offenders.push(
          `${el.tagName.toLowerCase()}.${String(el.className).slice(0, 40)} right=${Math.round(r.right)}`
        );
      }
    });
    return {
      scrollWidth: de.scrollWidth,
      innerWidth: window.innerWidth,
      bodyScrollWidth: document.body.scrollWidth,
      overflow: de.scrollWidth > window.innerWidth,
      offenders: offenders.slice(0, 8),
    };
  });
}
