import * as L from './live-lib.mjs';
import fs from 'fs';

// 受控 A/B：兩個帳號只差在 email 是否有 '+'
const TS = Date.now();
const ACCOUNTS = [
  { tag: 'PLUS', email: `live+${TS}plus@msw.mo`, nick: `plus${String(TS).slice(-5)}` },
  { tag: 'NOPLUS', email: `livetest${TS}plain@msw.mo`, nick: `plain${String(TS).slice(-5)}` },
];
const PASS = 'liveTest2026';

const browser = await L.launch();
const out = [];

for (const acc of ACCOUNTS) {
  const rec = { ...acc, pass: PASS };
  const p = await L.newPage(browser);
  const authPosts = [];
  p.on('response', (r) => {
    if (r.url().includes('/api/auth/callback')) authPosts.push(`${r.status()} ${r.url().replace(L.BASE, '')}`);
  });

  // ---- 註冊 ----
  await p.goto(`${L.BASE}/register`, { waitUntil: 'networkidle2', timeout: 90000 });
  await p.waitForSelector('input[type=password]', { timeout: 30000 });
  await p.waitForSelector('input[type=email]', { timeout: 30000 });
  await L.fill(p, 'input[type=text]', acc.nick);
  await L.fill(p, 'input[type=email]', acc.email);
  await p.evaluate((v) => {
    const es = document.querySelectorAll('input[type=password]');
    const s = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
    [...es].forEach((e) => {
      s.call(e, v);
      e.dispatchEvent(new Event('input', { bubbles: true }));
    });
  }, PASS);
  await L.sleep(300);
  rec.regSubmittedValues = await p.evaluate(() => ({
    nick: document.querySelector('input[type=text]')?.value,
    email: document.querySelector('input[type=email]')?.value,
    pw1: document.querySelectorAll('input[type=password]')[0]?.value?.length,
    pw2: document.querySelectorAll('input[type=password]')[1]?.value?.length,
  }));
  await p.click('button[type=submit]');
  await L.sleep(8000);
  rec.regResultPath = p.url().replace(L.BASE, '');
  rec.regOk = !/^\/register/.test(rec.regResultPath);
  rec.regBody = (await L.bodyText(p)).replace(/\s+/g, ' ').slice(0, 260);
  rec.regAuthPosts = [...authPosts];

  // ---- 登出並重新登入（驗證登入本身）----
  if (rec.regOk) {
    await L.logout(p);
    await L.sleep(1500);
    const lg = await L.login(p, acc.email, PASS);
    rec.loginPath = lg.path;
    rec.loginOk = lg.ok;
    rec.loginBody = (await L.bodyText(p)).replace(/\s+/g, ' ').slice(0, 200);
  }
  await L.closePage(p);
  out.push(rec);
}

fs.writeFileSync(`${L.SHOTS}/live-ab-result.json`, JSON.stringify(out, null, 2));
console.log(L.dump(out.map((o) => ({
  tag: o.tag, email: o.email, regOk: o.regOk, regPath: o.regResultPath,
  loginOk: o.loginOk, loginPath: o.loginPath, regBody: o.regBody,
}))));
await browser.close();
