import puppeteer from 'puppeteer-core';

export const BASE = 'http://localhost:3000';
export const SHOTS = '/workspace/msw/web/scripts/shots';

export async function launch() {
  const browser = await puppeteer.launch({
    executablePath: '/usr/bin/chromium',
    headless: 'new',
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
    defaultViewport: { width: 1440, height: 1000, deviceScaleFactor: 1 },
  });
  const page = await browser.newPage();
  const logs = [];
  const errors = [];
  page.on('console', (m) => {
    const line = `[console:${m.type()}] ${m.text()}`;
    logs.push(line);
    if (m.type() === 'error') errors.push(line);
  });
  page.on('pageerror', (e) => {
    errors.push(`[pageerror] ${e.message}`);
    logs.push(`[pageerror] ${e.message}`);
  });
  page.on('requestfailed', (r) => {
    errors.push(`[reqfail] ${r.url()} ${r.failure()?.errorText}`);
  });
  page.on('response', (r) => {
    if (r.status() >= 400) {
      errors.push(`[http:${r.status()}] ${r.url()}`);
      logs.push(`[http:${r.status()}] ${r.url()}`);
    }
  });
  // dialog 佇列：prompt 依序填入，confirm/alert 一律接受
  const dialogs = [];
  page.on('dialog', async (d) => {
    const msg = `[dialog:${d.type()}] ${d.message()}`;
    dialogs.push(msg);
    logs.push(msg);
    if (d.type() === 'prompt') {
      const v = page.__promptQueue && page.__promptQueue.length ? page.__promptQueue.shift() : '';
      await d.accept(String(v));
    } else {
      await d.accept();
    }
  });
  page.__dialogs = dialogs;
  return { browser, page, logs, errors, dialogs };
}

export function setPrompts(page, arr) {
  page.__promptQueue = [...arr];
}

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export async function login(page, email, password) {
  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle2' });
  await sleep(400);
  await page.evaluate(() => {
    const set = (sel, val) => {
      const el = document.querySelector(sel);
      if (!el) return;
      const setter = Object.getOwnPropertyDescriptor(
        window.HTMLInputElement.prototype,
        'value'
      ).set;
      setter.call(el, val);
      el.dispatchEvent(new Event('input', { bubbles: true }));
    };
    set('input[type=email], input[name=email]', '');
    set('input[type=password], input[name=password]', '');
  });
  await page.type('input[type=email], input[name=email]', email, { delay: 8 });
  await page.type('input[type=password], input[name=password]', password, { delay: 8 });
  const clicked = await page.evaluate(() => {
    const btns = [...document.querySelectorAll('button')];
    // 優先用文字找「登入」，避免誤點密碼顯示切換鈕（也是 type=submit）
    const b =
      btns.find((x) => x.textContent.trim() === '登入') ||
      btns.find((x) => x.type === 'submit' && !x.className.includes('grid h-10'));
    if (!b) return false;
    b.click();
    return true;
  });
  if (!clicked) throw new Error('login button not found');
  await sleep(2500);
  return page.url();
}

export async function logout(page) {
  try {
    await page.goto(`${BASE}/`, { waitUntil: 'networkidle2' });
    const clicked = await page.evaluate(() => {
      const b = [...document.querySelectorAll('button, a')].find(
        (x) => x.textContent.trim() === '登出'
      );
      if (!b) return false;
      b.click();
      return true;
    });
    await sleep(2000);
    return clicked;
  } catch {
    return false;
  }
}

/** 讀取會員 tab 表格 */
export async function readMemberTable(page) {
  return page.evaluate(() => {
    const rows = [...document.querySelectorAll('table tbody tr')];
    return rows
      .map((tr) => {
        const td = [...tr.querySelectorAll('td')];
        if (td.length < 6) return null;
        return {
          name: td[0]?.querySelector('p')?.textContent?.trim() || '',
          email: td[0]?.querySelectorAll('p')[1]?.textContent?.trim() || '',
          points: td[1]?.textContent?.trim(),
          totalPoints: td[2]?.textContent?.trim(),
          runs: td[3]?.textContent?.trim(),
          coupons: td[4]?.textContent?.trim(),
          role: td[5]?.textContent?.trim(),
        };
      })
      .filter(Boolean);
  });
}

/** 抓取畫面上的提示訊息（綠色成功 / 紅色錯誤） */
export async function readFlash(page) {
  return page.evaluate(() => {
    const out = [];
    document.querySelectorAll('p').forEach((p) => {
      const t = p.textContent.trim();
      const cls = p.className || '';
      if (
        (cls.includes('emerald') || cls.includes('energy')) &&
        t &&
        t.length < 120
      ) {
        out.push({ type: cls.includes('emerald') ? 'ok' : 'err', text: t });
      }
    });
    return out;
  });
}

export async function clickTab(page, labelKeyword) {
  return page.evaluate((kw) => {
    const b = [...document.querySelectorAll('button')].find((x) =>
      x.textContent.includes(kw)
    );
    if (!b) return false;
    b.click();
    return true;
  }, labelKeyword);
}
