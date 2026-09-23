import { launch, login, sleep, clickTab, readMemberTable, setPrompts, SHOTS, BASE } from './qa-mem-lib.mjs';
import { PrismaClient } from '@prisma/client';
const db = new PrismaClient();

const TARGET_EMAIL = 'kelvin@msw.mo';

async function dbSnapshot(tag) {
  const u = await db.user.findUnique({ where: { email: TARGET_EMAIL } });
  const logs = await db.pointLog.findMany({
    where: { userId: u.id },
    orderBy: { createdAt: 'desc' },
    take: 5,
  });
  console.log(`--- DB(${tag}) points=${u.points} totalPoints=${u.totalPoints} ---`);
  logs.forEach((l) =>
    console.log(`    log: ${l.amount > 0 ? '+' : ''}${l.amount} | ${l.reason} | ${l.refType} | ${l.createdAt.toISOString()}`)
  );
  return { points: u.points, totalPoints: u.totalPoints, logs };
}

const { browser, page, errors, dialogs } = await launch();

console.log('== B0 管理員登入 → /admin 會員 tab ==');
await login(page, 'admin@msw.mo', 'msw2026admin');
await page.goto(`${BASE}/admin`, { waitUntil: 'networkidle2' });
await sleep(1500);
await clickTab(page, '會員');
await sleep(1500);

const before = await dbSnapshot('before');
const rowsBefore = await readMemberTable(page);
const kRowBefore = rowsBefore.find((r) => r.email === TARGET_EMAIL);
console.log('UI before =', JSON.stringify(kRowBefore));

console.log('\n== B1 對 Kelvin 調整積分 +50，原因「測試加分」 ==');
setPrompts(page, ['50', '測試加分']);
const clicked = await page.evaluate((email) => {
  const tr = [...document.querySelectorAll('table tbody tr')].find((r) =>
    r.textContent.includes(email)
  );
  if (!tr) return false;
  const b = [...tr.querySelectorAll('button')].find((x) =>
    x.textContent.includes('調整積分')
  );
  if (!b) return false;
  b.click();
  return true;
}, TARGET_EMAIL);
console.log('adjust button clicked =', clicked);
await sleep(2500);

const flashAfter = await page.evaluate(() => {
  const p = [...document.querySelectorAll('p')].find(
    (x) => x.className.includes('emerald') || x.className.includes('energy')
  );
  return p ? p.textContent.trim() : null;
});
console.log('flash =', JSON.stringify(flashAfter));

const rowsAfter = await readMemberTable(page);
const kRowAfter = rowsAfter.find((r) => r.email === TARGET_EMAIL);
console.log('UI after +50 =', JSON.stringify(kRowAfter));
console.log(
  `即時更新：${kRowBefore.points} → ${kRowAfter.points}`,
  kRowAfter.points === String(Number(kRowBefore.points) + 50) ? 'PASS' : 'FAIL'
);
await page.screenshot({ path: `${SHOTS}/member-3-points-added.png`, fullPage: false });

const afterAdd = await dbSnapshot('after +50');

console.log('\n== B2 以 Kelvin 登入檢查 /dashboard 積分卡與積分明細 ==');
// 另開新 context 避免 admin session 干擾
const ctx2 = await browser.createBrowserContext();
const p2 = await ctx2.newPage();
const errs2 = [];
p2.on('pageerror', (e) => errs2.push(e.message));
p2.on('console', (m) => m.type() === 'error' && errs2.push(m.text()));

async function loginOn(pg, email, pw) {
  await pg.goto(`${BASE}/login`, { waitUntil: 'networkidle2' });
  await sleep(500);
  await pg.type('input[type=email]', email, { delay: 8 });
  await pg.type('input[type=password]', pw, { delay: 8 });
  await pg.evaluate(() => {
    const b = [...document.querySelectorAll('button')].find(
      (x) => x.textContent.trim() === '登入'
    );
    if (b) b.click();
  });
  await sleep(2500);
}

await loginOn(p2, TARGET_EMAIL, 'msw2026');
console.log('kelvin login url =', p2.url());
await p2.goto(`${BASE}/dashboard`, { waitUntil: 'networkidle2' });
await sleep(2000);

const dash = await p2.evaluate(() => {
  const text = document.body.innerText;
  const nums = {};
  document.querySelectorAll('p').forEach((p) => {
    const t = p.textContent.trim();
    const parent = p.parentElement?.textContent || '';
    if (t === '可用積分' || t === '歷史累積') {
      const val = p.parentElement?.querySelector('.font-black, .text-3xl, .text-2xl');
      nums[t] = p.nextElementSibling?.textContent?.trim() || parent.replace(t, '').trim();
    }
  });
  // 找積分明細區塊
  const idx = text.indexOf('積分明細');
  const logSection = idx >= 0 ? text.slice(idx, idx + 600) : '(找不到積分明細)';
  const hasTestAdd = text.includes('測試加分');
  return { nums, hasTestAdd, logSection, url: location.href };
});
console.log('dashboard nums =', JSON.stringify(dash.nums));
console.log('含「測試加分」 =', dash.hasTestAdd);
console.log('積分明細區塊:\n' + dash.logSection);
await p2.screenshot({ path: `${SHOTS}/member-4-pointlog.png`, fullPage: true });

console.log('\n== B3 負數調整 -50 ==');
await page.evaluate(() => {
  // 關閉可能的 toast
});
setPrompts(page, ['-50', '測試扣分']);
const clickedMinus = await page.evaluate((email) => {
  const tr = [...document.querySelectorAll('table tbody tr')].find((r) =>
    r.textContent.includes(email)
  );
  const b = [...tr.querySelectorAll('button')].find((x) =>
    x.textContent.includes('調整積分')
  );
  if (!b) return false;
  b.click();
  return true;
}, TARGET_EMAIL);
console.log('minus button clicked =', clickedMinus);
await sleep(2500);
const rowsMinus = await readMemberTable(page);
const kRowMinus = rowsMinus.find((r) => r.email === TARGET_EMAIL);
console.log('UI after -50 =', JSON.stringify(kRowMinus));
console.log(
  `扣分：${kRowAfter.points} → ${kRowMinus.points}`,
  kRowMinus.points === String(Number(kRowAfter.points) - 50) ? 'PASS' : 'FAIL'
);
await page.screenshot({ path: `${SHOTS}/member-5-points-minus.png`, fullPage: false });

const afterMinus = await dbSnapshot('after -50');
console.log('\n賬目核對:');
console.log(`  points: ${before.points} → +50 → ${afterAdd.points} → -50 → ${afterMinus.points}`);
console.log(`  totalPoints(歷史累積): ${before.totalPoints} → ${afterAdd.totalPoints} → ${afterMinus.totalPoints}`);
console.log('  totalPoints 是否只增不減（歷史累積語意）:', afterMinus.totalPoints >= afterAdd.totalPoints ? '是' : '否');

console.log('\n== DIALOGS ==', JSON.stringify(dialogs, null, 1));
console.log('== ERRORS ==', JSON.stringify(errors.filter((e) => !e.includes('_rsc')), null, 1));
console.log('== ERRORS(context2) ==', JSON.stringify(errs2, null, 1));

await browser.close();
await db.$disconnect();
