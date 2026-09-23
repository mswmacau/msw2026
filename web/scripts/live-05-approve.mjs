import * as L from './live-lib.mjs';
import fs from 'fs';

const up = JSON.parse(fs.readFileSync(`${L.SHOTS}/live-upload-result.json`, 'utf8'));
const MEMBER = up.EMAIL;
const KM = Number(up.KM);

const browser = await L.launch();
const out = { MEMBER, KM };

/* ---------- A) 管理員登入 → 審核 ---------- */
const a = await L.newPage(browser);
const lg = await L.login(a, 'admin@msw.mo', 'msw2026admin');
out.adminLogin = lg.url.replace(L.BASE, '');
await a.goto(`${L.BASE}/admin`, { waitUntil: 'networkidle2', timeout: 90000 });
await L.sleep(2500);

// 記錄待確認清單（含截圖健康度）
const before = await a.evaluate(() => {
  const txt = document.body.innerText;
  const m = txt.match(/待確認截圖\s*[（(](\d+)/) || txt.match(/(\d+)\s*\n\s*待確認紀錄/);
  return { count: m ? Number(m[1]) : null };
});
out.pendingBefore = before;
out.adminImgs = await L.imgHealth(a);
out.adminImgsBroken = out.adminImgs.filter((i) => !i.ok).length;

// 依 email 定位最近且含「確認」按鈕的卡片容器（由近而遠，避免抓到整個列表）
const target = await a.evaluate(
  ({ MEMBER }) => {
    const emailNode = [...document.querySelectorAll('*')].find(
      (el) => el.children.length === 0 && el.textContent.trim() === MEMBER
    );
    if (!emailNode) return { found: false };
    let card = emailNode;
    for (let i = 0; i < 10 && card; i++) {
      const btns = [...card.querySelectorAll('button')];
      const confirms = btns.filter((b) => b.textContent.trim().startsWith('✓'));
      const rejects = btns.filter((b) => b.textContent.trim().startsWith('✕'));
      if (confirms.length === 1 && rejects.length === 1) {
        const cardTxt = card.textContent.replace(/\s+/g, ' ').trim().slice(0, 160);
        confirms[0].scrollIntoView({ block: 'center' });
        confirms[0].click();
        return { found: true, clicked: true, cardTxt, confirmLabel: confirms[0].textContent.trim() };
      }
      card = card.parentElement;
    }
    return { found: true, clicked: false, reason: 'no card with confirm+reject within 10 levels' };
  },
  { MEMBER }
);
out.approveClick = target;
await L.sleep(7000);

// 核准後重新載入，確認該筆已離開待確認清單
await a.reload({ waitUntil: 'networkidle2', timeout: 90000 });
await L.sleep(2500);
out.pendingAfter = await a.evaluate(() => {
  const txt = document.body.innerText;
  const m = txt.match(/待確認截圖\s*[（(](\d+)/) || txt.match(/(\d+)\s*\n\s*待確認紀錄/);
  return { count: m ? Number(m[1]) : null };
});
out.memberStillPending = await a.evaluate((m) => document.body.innerText.includes(m), MEMBER);

out.dialogs = a.__dialogs;
out.httpErrorsAfterApprove = [...new Set(a.__httpErrors)].slice(0, 10);
out.adminAfterText = (await L.bodyText(a)).replace(/\s+/g, ' ').slice(0, 400);
const s = await L.shot(a, 'live-approve.png', true);
out.approveShot = { ok: s.ok, size: s.size };

/* ---------- B) 會員查看是否已確認、積分是否增加 ---------- */
const b = await L.newPage(browser);
const lg2 = await L.login(b, MEMBER, up.PASS);
out.memberLogin = { url: lg2.url.replace(L.BASE, ''), ok: lg2.ok, vals: lg2.vals };
if (!lg2.ok) out.memberLoginFailed = true;
await b.goto(`${L.BASE}/run`, { waitUntil: 'networkidle2', timeout: 90000 });
await L.sleep(2500);
out.memberRun = await L.readRun(b);
out.memberRunText = (await L.bodyText(b)).replace(/\s+/g, ' ').slice(0, 500);

await b.goto(`${L.BASE}/dashboard`, { waitUntil: 'networkidle2', timeout: 90000 });
await L.sleep(2500);
out.memberDash = await L.readDashboard(b);
out.memberDashText = (await L.bodyText(b)).replace(/\s+/g, ' ').slice(0, 500);
const s2 = await L.shot(b, 'live-confirmed.png', true);
out.confirmedShot = { ok: s2.ok, size: s2.size };

/* 結論判定 */
out.verdict = {
  confirmed: /已確認/.test(out.memberRun.nums ? JSON.stringify(out.memberRun.nums) : '') && out.memberRun.nums?.已確認 >= 1,
  pendingNowZero: out.memberRun.nums?.待確認 === 0,
  pointsIncreased: out.memberDash.points > 50,
  kmMatched: out.memberRun.km === KM,
};

fs.writeFileSync(`${L.SHOTS}/live-approve-result.json`, JSON.stringify(out, null, 2));
console.log(L.dump({ ...out, memberRunText: out.memberRunText.slice(0, 200) }));
await browser.close();
