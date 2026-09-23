import { launch, login, sleep, clickTab, readMemberTable, SHOTS, BASE } from './qa-mem-lib.mjs';
import { PrismaClient } from '@prisma/client';
const db = new PrismaClient();

const { browser, page, errors, dialogs } = await launch();

await login(page, 'admin@msw.mo', 'msw2026admin');
await page.goto(`${BASE}/admin`, { waitUntil: 'networkidle2' });
await sleep(1500);
await clickTab(page, '會員');
await sleep(1500);

console.log('== C1 對自己（admin@msw.mo）點「角色」，應被攔截 ==');
const adminBefore = await db.user.findUnique({ where: { email: 'admin@msw.mo' } });
console.log('admin role before =', adminBefore.role);

const clicked = await page.evaluate(() => {
  const tr = [...document.querySelectorAll('table tbody tr')].find((r) =>
    r.textContent.includes('admin@msw.mo')
  );
  if (!tr) return false;
  const b = [...tr.querySelectorAll('button')].find((x) => x.textContent.trim() === '角色');
  if (!b) return false;
  b.click();
  return true;
});
console.log('role button clicked =', clicked);
await sleep(2500);

const flash = await page.evaluate(() => {
  const cand = [...document.querySelectorAll('p, div')].filter((x) =>
    /不能變更|沒有權限|失敗|錯誤/.test(x.textContent) && x.textContent.trim().length < 100
  );
  return cand.map((c) => ({ text: c.textContent.trim(), cls: c.className.slice(0, 80) })).slice(0, 3);
});
console.log('flash/錯誤提示 =', JSON.stringify(flash, null, 1));

const adminAfter = await db.user.findUnique({ where: { email: 'admin@msw.mo' } });
console.log('admin role after =', adminAfter.role, adminAfter.role === 'ADMIN' ? 'PASS(未被降級)' : 'FAIL(被降級!)');

const rows = await readMemberTable(page);
const adminRow = rows.find((r) => r.email === 'admin@msw.mo');
console.log('UI admin row role =', adminRow.role);

// 讓 toast 完整顯示後截圖
await sleep(200);
await page.screenshot({ path: `${SHOTS}/member-6-self-role-blocked.png`, fullPage: false });

console.log('\n== C2 對 Kelvin 切角色 MEMBER→ADMIN→MEMBER ==');
const kelvinBefore = await db.user.findUnique({ where: { email: 'kelvin@msw.mo' } });
console.log('kelvin role before =', kelvinBefore.role);

await page.evaluate(() => {
  const tr = [...document.querySelectorAll('table tbody tr')].find((r) =>
    r.textContent.includes('kelvin@msw.mo')
  );
  const b = [...tr.querySelectorAll('button')].find((x) => x.textContent.trim() === '角色');
  b.click();
});
await sleep(2500);
const kelvinMid = await db.user.findUnique({ where: { email: 'kelvin@msw.mo' } });
console.log('kelvin role after 1st toggle =', kelvinMid.role);

const midRows = await readMemberTable(page);
console.log('UI kelvin role =', midRows.find((r) => r.email === 'kelvin@msw.mo').role);
await page.screenshot({ path: `${SHOTS}/member-7-role-toggled.png`, fullPage: false });

await page.evaluate(() => {
  const tr = [...document.querySelectorAll('table tbody tr')].find((r) =>
    r.textContent.includes('kelvin@msw.mo')
  );
  const b = [...tr.querySelectorAll('button')].find((x) => x.textContent.trim() === '角色');
  b.click();
});
await sleep(2500);
const kelvinEnd = await db.user.findUnique({ where: { email: 'kelvin@msw.mo' } });
console.log('kelvin role after 2nd toggle =', kelvinEnd.role);

const endRows = await readMemberTable(page);
console.log('UI kelvin role =', endRows.find((r) => r.email === 'kelvin@msw.mo').role);

console.log('\n== DIALOGS ==', JSON.stringify(dialogs, null, 1));
console.log('== ERRORS ==', JSON.stringify(errors.filter((e) => !e.includes('_rsc')), null, 1));

await browser.close();
await db.$disconnect();
