import * as L from './live-lib.mjs';

const TS = Date.now();
const EMAIL = `plain${TS}@msw.mo`;
const NICK = `n${String(TS).slice(-6)}`;
const PASS = 'liveTest2026';

const browser = await L.launch();
const p = await L.newPage(browser);
const api = [];
p.on('response', async (r) => {
  if (/\/api\//.test(r.url())) {
    let body = null;
    try {
      body = (await r.text()).slice(0, 400);
    } catch {}
    api.push({ status: r.status(), url: r.url().replace(L.BASE, ''), method: r.request().method(), body });
  }
});
p.on('requestfailed', (r) => api.push({ failed: r.url().replace(L.BASE, ''), err: r.failure()?.errorText }));

await p.goto(`${L.BASE}/register`, { waitUntil: 'networkidle2', timeout: 90000 });
await p.waitForSelector('input[type=email]');
await p.waitForSelector('input[type=password]');
await L.fill(p, 'input[type=text]', NICK);
await L.fill(p, 'input[type=email]', EMAIL);
await p.evaluate((v) => {
  document.querySelectorAll('input[type=password]').forEach((e) => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(e, v);
    e.dispatchEvent(new Event('input', { bubbles: true }));
  });
}, PASS);
await L.sleep(400);

const pre = await p.evaluate(() => {
  const q = (s) => document.querySelector(s);
  return {
    url: location.href,
    inputCount: document.querySelectorAll('input').length,
    types: [...document.querySelectorAll('input')].map((e) => e.type),
    text: q('input[type=text]')?.value ?? '(null)',
    email: q('input[type=email]')?.value ?? '(null)',
    pw: [...document.querySelectorAll('input[type=password]')].map((e) => e.value.length),
  };
});

await p.click('button[type=submit]');
await L.sleep(9000);

const post = await p.evaluate(() => {
  const t = document.body.innerText;
  return {
    url: location.href,
    hasError: /錯誤|失敗|已存在|invalid|Invalid|請輸入|請填|至少|不正確/.test(t),
    lines: t.split('\n').map((s) => s.trim()).filter((s) => /錯誤|失敗|已存在|請輸入|請填|至少|不正確|Email|密碼/.test(s)).slice(0, 12),
  };
});

console.log(JSON.stringify({ EMAIL, NICK, pre, post, api }, null, 2));
await p.screenshot({ path: `${L.SHOTS}/live-reg-error.png`, fullPage: true });
await browser.close();
