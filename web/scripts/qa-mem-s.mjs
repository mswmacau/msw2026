import { launch, sleep, SHOTS, BASE } from './qa-mem-lib.mjs';
import { PrismaClient } from '@prisma/client';
const db = new PrismaClient();

const { browser, page, errors } = await launch();

async function loginOn(pg, email, pw) {
  await pg.goto(`${BASE}/login`, { waitUntil: 'networkidle2' });
  await sleep(500);
  await pg.type('input[type=email]', email, { delay: 8 });
  await pg.type('input[type=password]', pw, { delay: 8 });
  await pg.evaluate(() => {
    const b = [...document.querySelectorAll('button')].find((x) => x.textContent.trim() === '登入');
    b.click();
  });
  await sleep(2500);
}

// S1: 會員 A（joe）登入，管理員把 joe 升為 ADMIN，驗證 joe 不需重登即可進 /admin（role 即時刷新）
console.log('== S1 role 變更是否即時生效（joe 已登入，被升為 ADMIN） ==');
const joe = await db.user.findUnique({ where: { email: 'joe@msw.mo' } });
console.log('joe 初始 role =', joe.role);

const ctxA = await browser.createBrowserContext();
const pA = await ctxA.newPage();
await loginOn(pA, 'joe@msw.mo', 'msw2026');
console.log('joe 登入 url =', pA.url());
await pA.goto(`${BASE}/admin`, { waitUntil: 'networkidle2' });
await sleep(1500);
console.log('升級前訪問 /admin 含「沒有權限」=', await pA.evaluate(() => document.body.innerText.includes('沒有權限')));

await db.user.update({ where: { email: 'joe@msw.mo' }, data: { role: 'ADMIN' } });
console.log('DB 已把 joe 升為 ADMIN');
await pA.goto(`${BASE}/admin`, { waitUntil: 'networkidle2' });
await sleep(2000);
const joeAdminView = await pA.evaluate(() => ({
  hasNoPerm: document.body.innerText.includes('沒有權限'),
  hasMemberTab: !!document.querySelector('div.flex.gap-2.rounded-xl'),
}));
console.log('升級後（未重登）訪問 /admin =', JSON.stringify(joeAdminView));
await pA.screenshot({ path: `${SHOTS}/member-9-role-live-upgrade.png`, fullPage: false });

// 降回 MEMBER，驗證即時收回
await db.user.update({ where: { email: 'joe@msw.mo' }, data: { role: 'MEMBER' } });
await pA.goto(`${BASE}/admin`, { waitUntil: 'networkidle2' });
await sleep(2000);
console.log('降級後（未重登）訪問 /admin 含「沒有權限」=', await pA.evaluate(() => document.body.innerText.includes('沒有權限')));

// S2: 積分即時性 —— 管理員改分後，會員 dashboard 重新載入是否反映
console.log('\n== S2 積分變更對會員端即時性 ==');
const ctxB = await browser.createBrowserContext();
const pB = await ctxB.newPage();
await loginOn(pB, 'joe@msw.mo', 'msw2026');
await pB.goto(`${BASE}/dashboard`, { waitUntil: 'networkidle2' });
await sleep(1500);
const p0 = await pB.evaluate(() => {
  const t = document.body.innerText;
  const m = t.match(/可用積分\s*(\d+)/);
  return m ? m[1] : null;
});
console.log('joe dashboard 初始可用積分 =', p0);
await db.$executeRaw`SELECT 1`;
const joeNow = await db.user.findUnique({ where: { email: 'joe@msw.mo' } });
console.log('DB joe points =', joeNow.points);
console.log('=> 一致 =', String(joeNow.points) === p0 ? 'PASS' : 'FAIL');

console.log('\n== S3 /settings 輸入超長暱稱的 UI 限制 ==');
const ctxC = await browser.createBrowserContext();
const pC = await ctxC.newPage();
await loginOn(pC, 'hui@msw.mo', 'msw2026');
await pC.goto(`${BASE}/settings`, { waitUntil: 'networkidle2' });
await sleep(1500);
const maxLen = await pC.evaluate(() => {
  const i = [...document.querySelectorAll('input')].find((x) => !x.readOnly && x.type !== 'password');
  return i ? { maxLength: i.maxLength, value: i.value } : null;
});
console.log('暱稱 input =', JSON.stringify(maxLen));
// 實際輸入 40 字看是否被截到 30
await pC.evaluate(() => {
  const i = [...document.querySelectorAll('input')].find((x) => !x.readOnly && x.type !== 'password');
  const s = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
  s.call(i, 'B'.repeat(40));
  i.dispatchEvent(new Event('input', { bubbles: true }));
});
await sleep(400);
const afterType = await pC.evaluate(() => {
  const i = [...document.querySelectorAll('input')].find((x) => !x.readOnly && x.type !== 'password');
  return i.value.length;
});
console.log('輸入 40 字後 input 實際長度 =', afterType);
const r = await pC.evaluate(async () => {
  const res = await fetch('/api/profile', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ displayName: 'B'.repeat(40) }),
  });
  return { status: res.status, body: await res.text() };
});
console.log('直接對 API 送 40 字 →', JSON.stringify(r));
const huiDb = await db.user.findUnique({ where: { email: 'hui@msw.mo' } });
console.log('DB 實際存了', huiDb.displayName.length, '字 =', JSON.stringify(huiDb.displayName));
await db.user.update({ where: { email: 'hui@msw.mo' }, data: { displayName: '小慧', name: '小慧' } });
console.log('已還原 hui 暱稱為「小慧」');

console.log('\n== ERRORS ==', JSON.stringify(errors.filter((e) => !e.includes('_rsc')), null, 1));
await browser.close();
await db.$disconnect();
