import { launch, login, sleep, clickTab, readMemberTable, setPrompts, SHOTS, BASE } from './qa-mem-lib.mjs';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
const db = new PrismaClient();

const { browser, page, errors } = await launch();

console.log('=== 回歸驗證：清理後完整流程 ===');

// 1. admin 登入 → 會員列表
await login(page, 'admin@msw.mo', 'msw2026admin');
await page.goto(`${BASE}/admin`, { waitUntil: 'networkidle2' });
await sleep(1500);
await clickTab(page, '會員');
await sleep(1500);
const rows = await readMemberTable(page);
console.log('R1 會員列表 =', rows.length, '筆');
console.table(rows.map((r) => ({ n: r.name, p: r.points, t: r.totalPoints, r: r.role })));

// 2. 積分明細可正常顯示（kelvin 已清空 log）
const ctx = await browser.createBrowserContext();
const p2 = await ctx.newPage();
await p2.goto(`${BASE}/login`, { waitUntil: 'networkidle2' });
await sleep(500);
await p2.type('input[type=email]', 'kelvin@msw.mo', { delay: 8 });
await p2.type('input[type=password]', 'msw2026', { delay: 8 });
await p2.evaluate(() => {
  [...document.querySelectorAll('button')].find((x) => x.textContent.trim() === '登入').click();
});
await sleep(2500);
await p2.goto(`${BASE}/dashboard`, { waitUntil: 'networkidle2' });
await sleep(1500);
const kd = await p2.evaluate(() => {
  const t = document.body.innerText;
  return {
    points: (t.match(/可用積分\s*(\d+)/) || [])[1],
    total: (t.match(/歷史累積\s*(\d+)/) || [])[1],
    logEmpty: t.includes('暫無') || t.includes('尚無') || t.includes('還沒有'),
    snippet: t.slice(t.indexOf('積分明細'), t.indexOf('積分明細') + 120).replace(/\s+/g, ' '),
  };
});
console.log('R2 kelvin dashboard =', JSON.stringify(kd));

// 3. ming 用原密碼可登入（已還原）
const p3 = await ctx.newPage();
await p3.goto(`${BASE}/login`, { waitUntil: 'networkidle2' });
await sleep(500);
await p3.type('input[type=email]', 'ming@msw.mo', { delay: 8 });
await p3.type('input[type=password]', 'msw2026', { delay: 8 });
await p3.evaluate(() => {
  [...document.querySelectorAll('button')].find((x) => x.textContent.trim() === '登入').click();
});
await sleep(2500);
console.log('R3 ming 用原密碼 msw2026 登入 url =', p3.url(), p3.url().includes('dashboard') ? 'PASS' : 'FAIL');
const ming = await db.user.findUnique({ where: { email: 'ming@msw.mo' } });
console.log('   ming displayName =', ming.displayName);

// 4. 補一張 settings banner 缺陷缺陷示意截圖（預設視窗位置）
await p3.goto(`${BASE}/settings`, { waitUntil: 'networkidle2' });
await sleep(1500);
await p3.evaluate(() => {
  const i = [...document.querySelectorAll('input')].find((x) => !x.readOnly && x.type !== 'password');
  const s = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
  s.call(i, '阿明');
  i.dispatchEvent(new Event('input', { bubbles: true }));
});
await sleep(300);
await p3.evaluate(() => {
  [...document.querySelectorAll('button')].find((x) => x.textContent.includes('儲存資料')).click();
});
await sleep(2000);
await p3.screenshot({ path: `${SHOTS}/settings-7-banner-below-fold.png`, fullPage: false });
const band = await p3.evaluate(() => {
  const p = [...document.querySelectorAll('p')].find(
    (x) => x.className.includes('emerald') || x.className.includes('energy')
  );
  return p ? { text: p.textContent.trim(), top: Math.round(p.getBoundingClientRect().top) } : null;
});
console.log('R4 提交暱稱後 banner =', JSON.stringify(band), '（viewport 高度 1000，top>1000 即不可見）');

console.log('\nERRORS =', JSON.stringify(errors.filter((e) => !e.includes('_rsc')), null, 1));
await browser.close();
await db.$disconnect();
