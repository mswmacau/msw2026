import * as L from './live-lib.mjs';
import fs from 'fs';

const TS = Date.now();
const EMAIL = `liveqa${TS}@msw.mo`; // 不用 '+'，排除任何 URL 編碼疑慮
const NICK = `qa${String(TS).slice(-6)}`;
const PASS = 'liveTest2026';
const KM = '6.66';

const browser = await L.launch();
const out = { TS, EMAIL, NICK, PASS, KM };

/* ============ 步驟 1：註冊 ============ */
const m = await L.newPage(browser);
const regApi = [];
m.on('response', async (r) => {
  if (/\/api\/auth\//.test(r.url())) {
    let body = '';
    try { body = (await r.text()).slice(0, 200); } catch {}
    regApi.push(`${r.status()} ${r.request().method()} ${r.url().replace(L.BASE, '')} ${body}`);
  }
});

await m.goto(`${L.BASE}/register`, { waitUntil: 'networkidle2', timeout: 90000 });
await m.waitForSelector('input[placeholder*="阿明"]', { timeout: 30000 });
await m.waitForSelector('input[type=email]', { timeout: 30000 });

// 依 placeholder 精準填表
await L.fillByPlaceholder(m, '阿明', NICK);
await L.fillByPlaceholder(m, 'you@example.com', EMAIL);
await m.evaluate((v) => {
  document.querySelectorAll('input[type=password]').forEach((e) => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(e, v);
    e.dispatchEvent(new Event('input', { bubbles: true }));
  });
}, PASS);
await L.sleep(400);

out.regFieldValues = await m.evaluate(() => ({
  nick: document.querySelector('input[placeholder*="阿明"]')?.value,
  email: document.querySelector('input[type=email]')?.value,
  pw: [...document.querySelectorAll('input[type=password]')].map((e) => e.value.length),
}));
out.regFormValidBeforeSubmit = await L.formValidity(m);

await m.click('button[type=submit]');
await L.sleep(8000);
out.regPath = m.url().replace(L.BASE, '');
out.regOk = !/^\/register/.test(out.regPath);
out.regApi = regApi;
out.regPoints = await L.readDashboard(m);
out.regBodySnippet = (await L.bodyText(m)).replace(/\s+/g, ' ').slice(0, 300);
const sReg = await L.shot(m, 'live-register.png', true);
out.regShot = { ok: sReg.ok, size: sReg.size };

// dashboard 截圖與 50 分確認
await m.goto(`${L.BASE}/dashboard`, { waitUntil: 'networkidle2', timeout: 90000 });
await L.sleep(2500);
out.dashBefore = await L.readDashboard(m);
out.dashBeforeText = (await L.bodyText(m)).replace(/\s+/g, ' ').slice(0, 360);
const sDash = await L.shot(m, 'live-dashboard.png', true);
out.dashShot = { ok: sDash.ok, size: sDash.size };

/* ============ 步驟 2：上傳跑步紀錄 ============ */
await m.goto(`${L.BASE}/run`, { waitUntil: 'networkidle2', timeout: 90000 });
await L.sleep(1800);
await m.waitForSelector('input[type=file]', { timeout: 30000 });
await (await m.$('input[type=file]')).uploadFile(L.IMG);
await L.sleep(2500);
// 公里數：placeholder 例如 8.45
await L.fillByPlaceholder(m, '8.45', KM);
await L.fillByPlaceholder(m, '黑沙環', 'live QA 測試上傳');
await L.sleep(500);
out.uploadFormValid = await L.formValidity(m);

await m.click('button[type=submit]');
await L.sleep(8000);
out.uploadRun = await L.readRun(m);
out.uploadImgs = await L.imgHealth(m);
out.uploadImgsBroken = out.uploadImgs.filter((i) => !i.ok).length;
const sUp = await L.shot(m, 'live-upload.png', true);
out.uploadShot = { ok: sUp.ok, size: sUp.size };
out.uploadTextSnippet = (await L.bodyText(m)).replace(/\s+/g, ' ').slice(0, 300);

/* ============ 步驟 3：管理員審核 ============ */
const a = await L.newPage(browser);
await L.login(a, 'admin@msw.mo', 'msw2026admin');
await a.goto(`${L.BASE}/admin`, { waitUntil: 'networkidle2', timeout: 90000 });
await L.sleep(2500);

out.pendingBefore = await a.evaluate(() => {
  const m = document.body.innerText.match(/待確認截圖\s*[（(](\d+)/) || document.body.innerText.match(/(\d+)\s*\n\s*待確認紀錄/);
  return m ? Number(m[1]) : null;
});
out.adminImgsHealthy = (await L.imgHealth(a)).filter((i) => i.ok).length;
const sBefore = await L.shot(a, 'live-admin-pending.png', true);
out.adminShot = { ok: sBefore.ok, size: sBefore.size };

out.approve = await a.evaluate((MEMBER) => {
  const emailNode = [...document.querySelectorAll('*')].find(
    (el) => el.children.length === 0 && el.textContent.trim() === MEMBER
  );
  if (!emailNode) return { found: false };
  let card = emailNode;
  for (let i = 0; i < 10 && card; i++) {
    const c = [...card.querySelectorAll('button')].filter((b) => b.textContent.trim().startsWith('✓'));
    const r = [...card.querySelectorAll('button')].filter((b) => b.textContent.trim().startsWith('✕'));
    if (c.length === 1 && r.length === 1) {
      const t = card.textContent.replace(/\s+/g, ' ').trim().slice(0, 140);
      c[0].scrollIntoView({ block: 'center' });
      c[0].click();
      return { found: true, clicked: true, cardTxt: t };
    }
    card = card.parentElement;
  }
  return { found: true, clicked: false };
}, EMAIL);
await L.sleep(7000);

await a.reload({ waitUntil: 'networkidle2', timeout: 90000 });
await L.sleep(2500);
out.pendingAfter = await a.evaluate(() => {
  const m = document.body.innerText.match(/待確認截圖\s*[（(](\d+)/) || document.body.innerText.match(/(\d+)\s*\n\s*待確認紀錄/);
  return m ? Number(m[1]) : null;
});
out.adminConfirmedKm = await a.evaluate(() => {
  const m = document.body.innerText.match(/(\d+)\s*km\s*[\s\S]{0,30}?已確認里程/);
  return m ? Number(m[1]) : null;
});
const sApp = await L.shot(a, 'live-approve.png', true);
out.approveShot = { ok: sApp.ok, size: sApp.size };

/* ============ 步驟 4：會員端確認 ============ */
const m2 = await L.newPage(browser);
const lg = await L.login(m2, EMAIL, PASS);
out.memberLogin = { path: lg.path, ok: lg.ok, vals: lg.vals };
await m2.goto(`${L.BASE}/run`, { waitUntil: 'networkidle2', timeout: 90000 });
await L.sleep(2500);
out.memberRun = await L.readRun(m2);
out.memberRunText = (await L.bodyText(m2)).replace(/\s+/g, ' ').slice(0, 420);
await m2.goto(`${L.BASE}/dashboard`, { waitUntil: 'networkidle2', timeout: 90000 });
await L.sleep(2500);
out.memberDash = await L.readDashboard(m2);
out.memberDashText = (await L.bodyText(m2)).replace(/\s+/g, ' ').slice(0, 420);
const sConf = await L.shot(m2, 'live-confirmed.png', true);
out.confirmedShot = { ok: sConf.ok, size: sConf.size };

/* ============ 判定 ============ */
out.verdict = {
  register50: out.regPoints.points === 50 && out.dashBefore.points === 50,
  uploadPending: out.uploadRun.nums?.待確認 === 1,
  thumbRendered: out.uploadImgsBroken === 0 && out.uploadImgs.length > 0,
  approved: out.pendingAfter === (out.pendingBefore ?? 0) - 1,
  memberConfirmed: out.memberRun.nums?.已確認 === 1 && out.memberRun.nums?.待確認 === 0,
  kmCounted: out.memberRun.km === Number(KM),
  pointsGained: out.memberDash.points === 50 + Math.round(Number(KM)),
};

fs.writeFileSync(`${L.SHOTS}/live-main-result.json`, JSON.stringify(out, null, 2));
console.log(L.dump(out.verdict));
console.log('REG', out.regPath, JSON.stringify(out.regPoints), 'valid=', JSON.stringify(out.regFormValidBeforeSubmit));
console.log('UPLOAD', JSON.stringify(out.uploadRun.nums), 'km=', out.uploadRun.km, 'brokenImgs=', out.uploadImgsBroken);
console.log('ADMIN', out.pendingBefore, '->', out.pendingAfter, 'confirmedKm=', out.adminConfirmedKm, JSON.stringify(out.approve));
console.log('MEMBER login=', JSON.stringify(out.memberLogin), 'run=', JSON.stringify(out.memberRun.nums), 'km=', out.memberRun.km, 'dash=', JSON.stringify(out.memberDash));
await browser.close();
