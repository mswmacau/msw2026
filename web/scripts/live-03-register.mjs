import * as L from './live-lib.mjs';
import fs from 'fs';

const TS = Date.now();
const EMAIL = `live+${TS}@msw.mo`;
const NICK = `live測試${String(TS).slice(-5)}`;
const PASS = 'liveTest2026';

const browser = await L.launch();
const out = { TS, EMAIL, NICK, PASS };
const page = await L.newPage(browser);

await page.goto(`${L.BASE}/register`, { waitUntil: 'networkidle2', timeout: 90000 });
await L.sleep(1200);
out.form = await L.formInfo(page);
await L.shot(page, 'live-register.png', true);

// 依 placeholder 填表（表單結構未知，逐一探測）
const filled = await page.evaluate(
  ({ EMAIL, NICK, PASS }) => {
    const set = (el, v) => {
      const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement : HTMLInputElement;
      Object.getOwnPropertyDescriptor(proto.prototype, 'value').set.call(el, v);
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
    };
    const ins = [...document.querySelectorAll('input')];
    const used = [];
    const byType = (t) => ins.filter((i) => i.type === t);
    const emails = byType('email');
    const pws = byType('password');
    const texts = ins.filter((i) => !['email', 'password', 'hidden', 'submit'].includes(i.type));

    if (emails[0]) { set(emails[0], EMAIL); used.push('email@' + (emails[0].placeholder || emails[0].name)); }
    if (texts[0]) { set(texts[0], NICK); used.push('nick@' + (texts[0].placeholder || texts[0].name)); }
    if (pws[0]) { set(pws[0], PASS); used.push('pw1'); }
    if (pws[1]) { set(pws[1], PASS); used.push('pw2'); }
    return { used, counts: { email: emails.length, pw: pws.length, text: texts.length } };
  },
  { EMAIL, NICK, PASS }
);
out.filled = filled;

await L.sleep(500);
let clicked = await L.clickText(page, '免費加入');
if (!clicked) clicked = await L.clickText(page, '註冊');
if (!clicked) clicked = await L.clickText(page, '加入', 'button');
out.clicked = clicked;
await L.sleep(7000);

out.afterSubmit = {
  url: page.url(),
  path: page.url().replace(L.BASE, ''),
  isLocalhost: /localhost|127\.0\.0\.1/.test(page.url()),
};
out.dialog = page.__dialogs;
out.httpErrors = [...new Set(page.__httpErrors)];
out.bodySnippet = (await L.bodyText(page)).slice(0, 500);
out.regRegistered = await L.readDashboard(page);
const s = await L.shot(page, 'live-register-after.png', true);
out.afterShot = { ok: s.ok, size: s.size };

// 進入會員中心確認積分
await page.goto(`${L.BASE}/dashboard`, { waitUntil: 'networkidle2', timeout: 90000 });
await L.sleep(2500);
out.dashboard = {
  path: page.url().replace(L.BASE, ''),
  dash: await L.readDashboard(page),
  text: (await L.bodyText(page)).slice(0, 700),
};
const s2 = await L.shot(page, 'live-dashboard.png', true);
out.dashShot = { ok: s2.ok, size: s2.size };

fs.writeFileSync(`${L.SHOTS}/live-reg-result.json`, JSON.stringify(out, null, 2));
console.log(L.dump(out));
await browser.close();
