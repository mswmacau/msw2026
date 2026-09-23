import * as L from './live-lib.mjs';
import fs from 'fs';

const COUPON = 'MSW-202609-DEMO01';
const browser = await L.launch();
const out = { COUPON };

const a = await L.newPage(browser);
await L.login(a, 'admin@msw.mo', 'msw2026admin');
await a.goto(`${L.BASE}/admin`, { waitUntil: 'networkidle2', timeout: 90000 });
await L.sleep(2000);

// 切到「優惠券」tab
const tabClick = await L.clickText(a, '優惠券', 'button');
out.tabClicked = tabClick;
await L.sleep(2500);

out.couponTabText = (await L.bodyText(a)).replace(/\s+/g, ' ').slice(0, 700);
out.couponForm = await L.formInfo(a);
const sTab = await L.shot(a, 'live-coupon-tab.png', true);
out.tabShot = { ok: sTab.ok, size: sTab.size };

// 找到核銷輸入框與按鈕（依 placeholder / label 探測）
const prepared = await a.evaluate((COUPON) => {
  const ins = [...document.querySelectorAll('input,textarea')];
  const el =
    ins.find((e) => /券|code|coupon|優惠/i.test(e.placeholder || '')) ||
    ins.find((e) => e.type === 'text') ||
    ins[0];
  if (!el) return { ok: false, reason: 'no input on coupon tab', placeholders: ins.map((e) => e.placeholder) };
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
  setter.call(el, COUPON);
  el.dispatchEvent(new Event('input', { bubbles: true }));
  el.dispatchEvent(new Event('change', { bubbles: true }));
  return { ok: true, placeholder: el.placeholder || null, value: el.value };
}, COUPON);
out.prepared = prepared;
await L.sleep(500);

// 點核銷
let clicked = await L.clickText(a, '核銷');
if (!clicked) clicked = await L.clickText(a, '確認使用');
if (!clicked) clicked = await L.clickText(a, '使用');
if (!clicked) clicked = await L.clickText(a, '兌換');
out.redeemClicked = clicked;
await L.sleep(6000);

out.dialogs = a.__dialogs;
out.httpErrors = [...new Set(a.__httpErrors)].slice(0, 8);
out.afterText = (await L.bodyText(a)).replace(/\s+/g, ' ').slice(0, 800);
const sR = await L.shot(a, 'live-redeem.png', true);
out.redeemShot = { ok: sR.ok, size: sR.size };
out.successMarkers = {
  hasSuccess: /核銷成功|已核銷|使用成功|兌換成功|成功/.test(out.afterText),
  hasUsed: /已使用|已核銷/.test(out.afterText),
  hasError: /失敗|錯誤|不存在|已使用過|invalid|Invalid/.test(out.afterText),
};

fs.writeFileSync(`${L.SHOTS}/live-coupon-result.json`, JSON.stringify(out, null, 2));
console.log(L.dump({
  tabClicked: out.tabClicked, prepared: out.prepared, redeemClicked: out.redeemClicked,
  dialogs: out.dialogs, markers: out.successMarkers, httpErrors: out.httpErrors,
  afterText: out.afterText.slice(0, 500),
}));
await browser.close();
