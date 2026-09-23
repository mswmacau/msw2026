import { launch, sleep, BASE } from './qa-mem-lib.mjs';
import { PrismaClient } from '@prisma/client';
const db = new PrismaClient();

// 先還原 admin displayName（E7 測試造成的副作用）
await db.user.update({ where: { email: 'admin@msw.mo' }, data: { displayName: 'MSW 管理員', name: 'MSW 管理員' } });
console.log('已還原 admin displayName');

const hui = await db.user.findUnique({ where: { email: 'hui@msw.mo' } });
console.log('hui id =', hui.id, 'points =', hui.points);

const { browser, page, errors } = await launch();
await page.goto(`${BASE}/login`, { waitUntil: 'networkidle2' });
await sleep(500);
await page.type('input[type=email]', 'admin@msw.mo', { delay: 8 });
await page.type('input[type=password]', 'msw2026admin', { delay: 8 });
await page.evaluate(() => {
  const b = [...document.querySelectorAll('button')].find((x) => x.textContent.trim() === '登入');
  b.click();
});
await sleep(2500);
console.log('url =', page.url());

console.log('\n== E5(重測) 積分非法值邊界，userId = hui ==');
const before = (await db.user.findUnique({ where: { email: 'hui@msw.mo' } })).points;
for (const [label, amount, expect] of [
  ['0', 0, '400 積分數量不正確'],
  ['"abc"', 'abc', '400'],
  ['null', null, '400'],
  ['100001', 100001, '400 超上限'],
  ['-100001', -100001, '400 超下限'],
  ['2.7 小數', 2.7, '200 四捨五入為 3'],
  ['"50" 字串數字', '50', '200 轉為 50'],
  ['-1 負數', -1, '200 扣 1'],
]) {
  const r = await page.evaluate(async ([uid, a]) => {
    const res = await fetch('/api/admin/members', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: uid, action: 'points', amount: a, reason: 'pretest_邊界' }),
    });
    return { status: res.status, body: (await res.text()).slice(0, 90) };
  }, [hui.id, amount]);
  const now = (await db.user.findUnique({ where: { email: 'hui@msw.mo' } })).points;
  console.log(`  amount=${label.padEnd(14)} 期望[${expect}] → ${r.status} ${r.body} | points=${now}`);
}
const after = (await db.user.findUnique({ where: { email: 'hui@msw.mo' } })).points;
console.log(`  hui ${before} → ${after}`);

console.log('\n== E6(補) role 傳非法值後的實際角色 ==');
const huiRole = (await db.user.findUnique({ where: { email: 'hui@msw.mo' } })).role;
console.log('  hui role =', huiRole, '（API 回 200 並設為 MEMBER，白名單行為，符合預期）');

console.log('\n== E7(補) 只改暱稱、不改密碼，確認 passwordHash 不被清空 ==');
const hBefore = (await db.user.findUnique({ where: { email: 'admin@msw.mo' } })).passwordHash;
const r = await page.evaluate(async () => {
  const res = await fetch('/api/profile', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ displayName: '測試管理員名' }),
  });
  return { status: res.status, body: (await res.text()).slice(0, 80) };
});
console.log('  →', JSON.stringify(r));
const hAfter = (await db.user.findUnique({ where: { email: 'admin@msw.mo' } })).passwordHash;
console.log('  passwordHash 未變 =', hBefore === hAfter);
// 還原
await db.user.update({ where: { email: 'admin@msw.mo' }, data: { displayName: 'MSW 管理員', name: 'MSW 管理員' } });
console.log('  已還原 admin displayName');

console.log('\n== E9 檢查 /settings 對未登入者的行為 ==');
const ctx = await browser.createBrowserContext();
const p2 = await ctx.newPage();
const res = await p2.goto(`${BASE}/settings`, { waitUntil: 'networkidle2' });
console.log('  /settings 最終 url =', p2.url());

console.log('\n== ERRORS ==', JSON.stringify(errors.filter((e) => !e.includes('_rsc')), null, 1));
await browser.close();
await db.$disconnect();
