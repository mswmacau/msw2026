import puppeteer from 'puppeteer-core';
import fs from 'fs';

export const BASE = 'https://a6dd31b4ad670a126.app.workbuddy.host';
export const SHOTS = '/workspace/msw/web/scripts/shots';
export const IMG = '/workspace/msw/web/public/images/running-track.jpg';

export const DESKTOP = { width: 1440, height: 900, deviceScaleFactor: 1 };
export const MOBILE = { width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true };

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export async function launch() {
  return puppeteer.launch({
    executablePath: '/usr/bin/chromium',
    headless: true,
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
    defaultViewport: DESKTOP,
  });
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
  const httpErrors = [];
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(`[console] ${m.text().slice(0, 200)}`);
  });
  page.on('pageerror', (e) => errors.push(`[pageerror] ${e.message.slice(0, 200)}`));
  page.on('requestfailed', (r) => errors.push(`[reqfail] ${r.url().slice(0, 160)} ${r.failure()?.errorText}`));
  page.on('response', (r) => {
    if (r.status() >= 400) httpErrors.push(`${r.status()} ${r.url().replace(BASE, '')}`);
  });
  const prompts = [];
  page.on('dialog', async (d) => {
    dialogs.push(`[${d.type()}] ${d.message()}`);
    if (d.type() === 'prompt') await d.accept(prompts.shift() ?? '');
    else await d.accept();
  });
  page.__errors = errors;
  page.__dialogs = dialogs;
  page.__httpErrors = httpErrors;
  page.__prompts = prompts;
  page.__ctx = ctx;
  return page;
}

export async function closePage(page) {
  try {
    await page.__ctx.close();
  } catch {
    try {
      await page.close();
    } catch {}
  }
}

export async function shot(page, name, full = false) {
  const p = `${SHOTS}/${name}`;
  try {
    await page.screenshot({ path: p, fullPage: full });
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

export async function bodyText(page) {
  return page.evaluate(() => document.body.innerText);
}

export async function hasText(page, sub) {
  return page.evaluate((s) => document.body.innerText.includes(s), sub);
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

/** 依 placeholder 片段填值（最穩健：不依賴 type 屬性） */
export async function fillByPlaceholder(page, sub, value) {
  return page.evaluate(
    ({ sub, value }) => {
      const el = [...document.querySelectorAll('input, textarea')].find((e) =>
        (e.placeholder || '').includes(sub)
      );
      if (!el) return false;
      const setter = Object.getOwnPropertyDescriptor(
        el instanceof HTMLTextAreaElement
          ? window.HTMLTextAreaElement.prototype
          : window.HTMLInputElement.prototype,
        'value'
      ).set;
      setter.call(el, '');
      setter.call(el, value);
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
      return true;
    },
    { sub, value }
  );
}

/** 檢查表單是否滿足 HTML5 驗證（可揪出「欄位沒填到」這類測試腳本缺陷） */
export async function formValidity(page) {
  return page.evaluate(() => {
    const form = document.querySelector('form');
    const fields = form
      ? [...form.querySelectorAll('input, textarea, select')]
      : [...document.querySelectorAll('input, textarea, select')];
    const bad = fields
      .filter((e) => !e.checkValidity())
      .map((e) => ({
        placeholder: e.placeholder || null,
        type: e.type,
        value: e.value,
        msg: e.validationMessage,
      }));
    return { valid: bad.length === 0, invalid: bad, fieldCount: fields.length };
  });
}

/** 列出頁面所有 input/select 供探測表單結構 */
export async function formInfo(page) {
  return page.evaluate(() => {
    const inputs = [...document.querySelectorAll('input, select, textarea')].map((el) => ({
      tag: el.tagName.toLowerCase(),
      type: el.type || null,
      name: el.name || null,
      id: el.id || null,
      placeholder: el.placeholder || null,
      accept: el.getAttribute('accept') || null,
      required: el.required,
      cls: String(el.className).slice(0, 60),
    }));
    const buttons = [...document.querySelectorAll('button, a[href]')]
      .map((el) => el.textContent.replace(/\s+/g, ' ').trim())
      .filter(Boolean)
      .slice(0, 40);
    return { inputs, buttons };
  });
}

export async function login(page, email, password) {
  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle2', timeout: 90000 });
  await sleep(800);
  await page.waitForSelector('input[type=email]', { timeout: 30000 });
  await page.waitForSelector('input[type=password]', { timeout: 30000 });
  await fill(page, 'input[type=email]', email);
  await fill(page, 'input[type=password]', password);
  await sleep(400);
  const vals = await page.evaluate(() => ({
    email: document.querySelector('input[type=email]')?.value || null,
    pwLen: document.querySelector('input[type=password]')?.value?.length ?? null,
  }));
  // 優先點真正的 submit 按鈕（文字節點 click 不可靠）
  let clicked = false;
  const submit = await page.$('button[type=submit]');
  if (submit) {
    await submit.click().then(() => (clicked = true)).catch(() => {});
  }
  if (!clicked) clicked = await clickText(page, '登入');
  await sleep(6000);
  const path = page.url().replace(BASE, '');
  const ok = !/^\/login/.test(path);
  return { clicked, url: page.url(), path, vals, ok };
}

export async function logout(page) {
  await page.goto(`${BASE}/`, { waitUntil: 'networkidle2', timeout: 90000 });
  await sleep(600);
  const ok = await clickText(page, '登出', 'button, a');
  await sleep(3000);
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
  const rows = await page.evaluate(() =>
    [...document.querySelectorAll('li, div')]
      .filter((el) => /待確認|已確認|已駁回/.test(el.textContent) && el.textContent.includes('KM'))
      .slice(0, 12)
      .map((el) => el.textContent.replace(/\s+/g, ' ').trim().slice(0, 140))
  );
  return { km: km ? Number(km[1]) : null, goal: km ? Number(km[2]) : null, nums, rows };
}

/** 圖片載入健康檢查（破圖偵測） */
export async function imgHealth(page) {
  return page.evaluate(() => {
    const imgs = [...document.querySelectorAll('img')];
    return imgs.map((i) => ({
      src: (i.currentSrc || i.src || '').slice(-70),
      w: i.naturalWidth,
      h: i.naturalHeight,
      complete: i.complete,
      ok: i.naturalWidth > 0 && i.naturalHeight > 0,
    }));
  });
}

/** CSS 是否真的載入（Tailwind 編譯後一定有 stylesheet link） */
export async function cssHealth(page) {
  return page.evaluate(() => {
    const sheets = [...document.querySelectorAll('link[rel=stylesheet]')].map((l) => l.href.slice(-60));
    const st = document.body ? getComputedStyle(document.body) : null;
    const h1 = document.querySelector('h1');
    return {
      sheets,
      bodyBg: st ? st.backgroundColor : null,
      bodyFontFamily: st ? st.fontFamily.slice(0, 60) : null,
      h1Size: h1 ? getComputedStyle(h1).fontSize : null,
      h1Weight: h1 ? getComputedStyle(h1).fontWeight : null,
      cssLoaded: sheets.length > 0,
    };
  });
}

/** 頁面基本健檢：標題、內文長度、是否出現 Next.js error / 500 */
export async function pageHealth(page) {
  const title = await page.title();
  const t = await bodyText(page);
  // 精準判定：只看可見文字與 Next.js 錯誤 UI 結構，避免把 bootstrap script 誤判
  const errMarkers =
    /Application error|Unhandled Runtime Error|Internal Server Error|This page could not be found|500\s*·/i.test(t);
  const errDom = await page.evaluate(() => {
    if (document.querySelector('nextjs-portal')) return 'nextjs-portal(dev overlay)';
    if (document.body?.hasAttribute('data-nextjs-error')) return 'data-nextjs-error';
    return null;
  });
  const bgs = await page.evaluate(() =>
    [...document.querySelectorAll('*')]
      .map((el) => getComputedStyle(el).backgroundImage)
      .filter((v) => v && v.startsWith('url(')).length
  );
  return {
    title,
    titleLen: title.length,
    textLen: t.length,
    isErrorPage: errMarkers || !!errDom,
    errDom,
    cssBgImages: bgs,
    snippet: t.replace(/\s+/g, ' ').trim().slice(0, 160),
  };
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

export function dump(obj) {
  return JSON.stringify(obj, null, 2);
}
