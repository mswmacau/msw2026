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
    if (b) b.click();
  });
  await sleep(2500);
}

console.log('== E1 普通會員（hui）訪問 /admin ==');
await loginOn(page, 'hui@msw.mo', 'msw2026');
await page.goto(`${BASE}/admin`, { waitUntil: 'networkidle2' });
await sleep(2000);
const adminView = await page.evaluate(() => ({
  url: location.href,
  hasNoPerm: document.body.innerText.includes('沒有權限'),
  text: document.body.innerText.slice(0, 200).replace(/\s+/g, ' '),
}));
console.log(JSON.stringify(adminView, null, 1));
await page.screenshot({ path: `${SHOTS}/member-8-member-admin-blocked.png`, fullPage: false });

console.log('\n== E2 普通會員 fetch PATCH /api/admin/members → 應 403 ==');
const r1 = await page.evaluate(async () => {
  const res = await fetch('/api/admin/members', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId: 'x', action: 'points', amount: 9999, reason: 'pretest_越權' }),
  });
  return { status: res.status, body: await res.text() };
});
console.log('PATCH →', JSON.stringify(r1));

console.log('\n== E3 普通會員 GET /api/admin/members → 應 403 ==');
const r2 = await page.evaluate(async () => {
  const res = await fetch('/api/admin/members');
  return { status: res.status, body: (await res.text()).slice(0, 150) };
});
console.log('GET →', JSON.stringify(r2));

console.log('\n== E4 未登入（新 context）訪問受保護接口 ==');
const ctx2 = await browser.createBrowserContext();
const p2 = await ctx2.newPage();
await p2.goto(`${BASE}/`, { waitUntil: 'networkidle2' });
const r3 = await p2.evaluate(async () => {
  const out = {};
  for (const [k, opt] of [
    ['GET /api/admin/members', { method: 'GET' }],
    ['PATCH /api/admin/members', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId: 'x', action: 'role', role: 'ADMIN' }) }],
    ['PATCH /api/profile', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ displayName: 'pretest_hack' }) }],
  ]) {
    try {
      const res = await fetch(opt.url || k.split(' ')[1], opt);
      out[k] = { status: res.status, body: (await res.text()).slice(0, 120) };
    } catch (e) { out[k] = { err: String(e) }; }
  }
  return out;
});
console.log(JSON.stringify(r3, null, 1));
await p2.goto(`${BASE}/admin`, { waitUntil: 'networkidle2' });
await sleep(1500);
console.log('未登入訪問 /admin 最終 url =', p2.url(), '| 含沒有權限 =', await p2.evaluate(() => document.body.innerText.includes('沒有權限')));

console.log('\n== E5 邊界：積分傳入非法值（管理員 token） ==');
const ctx3 = await browser.createBrowserContext();
const p3 = await ctx3.newPage();
await loginOn(p3, 'admin@msw.mo', 'msw2026admin');
const hui = await db.user.findUnique({ where: { email: 'hui@msw.mo' } });
const huiBefore = hui.points;

for (const [label, amount] of [
  ['0（應 400）', 0],
  ['"abc"（應 400）', 'abc'],
  ['null（應 400）', null],
  ['100001（超上限，應 400）', 100001],
  ['-100001（超下限，應 400）', -100001],
  ['2.7（小數，應四捨五入）', 2.7],
  ['"50"（字串數字）', '50'],
]) {
  const r = await p3.evaluate(async ([a]) => {
    const res = await fetch('/api/admin/members', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: window.__uid || "NOPE", action: 'points', amount: a, reason: 'pretest_邊界' }),
    });
    return { status: res.status, body: (await res.text()).slice(0, 100) };
  }, [amount]);
  console.log(`  amount=${label} → ${JSON.stringify(r)}`);
}
const huiMid = await db.user.findUnique({ where: { email: 'hui@msw.mo' } });
console.log(`  hui points: ${huiBefore} → ${huiMid.points}（僅 2.7→+3 與 "50"→+50 應生效）`);

console.log('\n== E6 邊界：不存在的 userId / 缺參數 ==');
for (const [label, body] of [
  ['不存在 userId', { userId: 'nonexistent-xyz', action: 'points', amount: 10 }],
  ['缺 userId', { action: 'points', amount: 10 }],
  ['未知 action', { userId: hui.id, action: 'delete' }],
  ['role 傳非法值', { userId: hui.id, action: 'role', role: 'SUPERUSER' }],
]) {
  const r = await p3.evaluate(async (b) => {
    const res = await fetch('/api/admin/members', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(b),
    });
    return { status: res.status, body: (await res.text()).slice(0, 100) };
  }, body);
  console.log(`  ${label} → ${JSON.stringify(r)}`);
}

console.log('\n== E7 邊界：/api/profile 密碼長度 ==');
const rpw = await p3.evaluate(async () => {
  const out = [];
  for (const [label, body] of [
    ['新密碼 7 字元（應 400）', { currentPassword: 'msw2026admin', newPassword: 'short77' }],
    ['只改密碼不給舊密碼（應 400）', { newPassword: 'msw2026newpw' }],
    ['空白 displayName（應 400）', { displayName: '   ' }],
    ['displayName 超長 50 字（應截斷 30）', { displayName: 'A'.repeat(50) }],
  ]) {
    const res = await fetch('/api/profile', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    out.push({ label, status: res.status, body: (await res.text()).slice(0, 90) });
  }
  return out;
});
rpw.forEach((x) => console.log(`  ${x.label} → ${x.status} ${x.body}`));
const adminNow = await db.user.findUnique({ where: { email: 'admin@msw.mo' } });
console.log('  admin displayName 現在 =', JSON.stringify(adminNow.displayName));

console.log('\n== E8 邊界：搜尋參數 ==');
for (const [label, q] of [
  ['空字串（應回全部）', ''],
  ['特殊字元 %', '%'],
  ['超長 500 字', 'A'.repeat(500)],
  ['SQL 注入樣式', "' OR 1=1--"],
  ['不存在關鍵字', 'zzzznomatch'],
]) {
  const r = await p3.evaluate(async (query) => {
    const res = await fetch(`/api/admin/members?q=${encodeURIComponent(query)}`);
    const d = await res.json();
    return { status: res.status, count: (d.members || []).length };
  }, q);
  console.log(`  q=${label} → ${JSON.stringify(r)}`);
}

console.log('\n== ERRORS ==', JSON.stringify(errors.filter((e) => !e.includes('_rsc')), null, 1));

await browser.close();
await db.$disconnect();
