import { launch, sleep, SHOTS, BASE } from './qa-mem-lib.mjs';
import { PrismaClient } from '@prisma/client';
const db = new PrismaClient();

const EMAIL = 'ming@msw.mo';
const OLD_PW = 'msw2026';
const NEW_PW = 'msw2026new';
const NEW_NAME = '阿明改';

const { browser, page, errors, dialogs } = await launch();

async function loginOn(pg, email, pw) {
  await pg.goto(`${BASE}/login`, { waitUntil: 'networkidle2' });
  await sleep(500);
  await pg.evaluate(() => {
    document.querySelectorAll('input').forEach((i) => {
      const s = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
      s.call(i, '');
      i.dispatchEvent(new Event('input', { bubbles: true }));
    });
  });
  await pg.type('input[type=email]', email, { delay: 8 });
  await pg.type('input[type=password]', pw, { delay: 8 });
  await pg.evaluate(() => {
    const b = [...document.querySelectorAll('button')].find((x) => x.textContent.trim() === '登入');
    if (b) b.click();
  });
  await sleep(2500);
  return pg.url();
}

const before = await db.user.findUnique({ where: { email: EMAIL } });
console.log('== D0 baseline ==');
console.log('  displayName =', before.displayName, '| name =', before.name);

console.log('\n== D1 以 ming 登入，從會員中心點「帳號設定」連結 ==');
let url = await loginOn(page, EMAIL, OLD_PW);
console.log('login url =', url);

const linkFound = await page.evaluate(() => {
  const a = [...document.querySelectorAll('a')].find((x) => x.href.includes('/settings'));
  if (!a) return false;
  a.click();
  return true;
});
console.log('找到並點擊「帳號設定」連結 =', linkFound);
await sleep(2000);
console.log('url now =', page.url());

console.log('\n== D2 修改暱稱為「阿明改」 ==');
await page.evaluate((name) => {
  const input = [...document.querySelectorAll('input')].find(
    (i) => !i.readOnly && i.type !== 'password'
  );
  const s = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
  s.call(input, name);
  input.dispatchEvent(new Event('input', { bubbles: true }));
}, NEW_NAME);
await sleep(300);
await page.evaluate(() => {
  const b = [...document.querySelectorAll('button')].find((x) => x.textContent.includes('儲存資料'));
  b.click();
});
await sleep(2000);

const msg1 = await page.evaluate(() => {
  const p = [...document.querySelectorAll('p')].find(
    (x) => x.className.includes('emerald') || x.className.includes('energy')
  );
  return p ? { text: p.textContent.trim(), cls: p.className.slice(0, 60) } : null;
});
console.log('提示 =', JSON.stringify(msg1));
await page.screenshot({ path: `${SHOTS}/settings-1-name-updated.png`, fullPage: false });

const dbName = await db.user.findUnique({ where: { email: EMAIL } });
console.log('DB displayName =', dbName.displayName, '| name =', dbName.name);

console.log('\n== D3 重新整理，確認暱稱持久化 ==');
await page.reload({ waitUntil: 'networkidle2' });
await sleep(1500);
const persist = await page.evaluate(() => {
  const input = [...document.querySelectorAll('input')].find(
    (i) => !i.readOnly && i.type !== 'password'
  );
  return input ? input.value : null;
});
console.log('重整後 input value =', JSON.stringify(persist), persist === NEW_NAME ? 'PASS' : 'FAIL');

// 導覽列 / dashboard 是否也更新
await page.goto(`${BASE}/dashboard`, { waitUntil: 'networkidle2' });
await sleep(1500);
const dashName = await page.evaluate(() => document.querySelector('h1')?.textContent?.trim());
console.log('dashboard 顯示名稱 =', JSON.stringify(dashName));

console.log('\n== D4 測試錯誤舊密碼（應被攔截） ==');
await page.goto(`${BASE}/settings`, { waitUntil: 'networkidle2' });
await sleep(1500);
await page.evaluate(([cur, np]) => {
  const pw = [...document.querySelectorAll('input[type=password]')];
  const s = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
  s.call(pw[0], cur);
  pw[0].dispatchEvent(new Event('input', { bubbles: true }));
  s.call(pw[1], np);
  pw[1].dispatchEvent(new Event('input', { bubbles: true }));
  s.call(pw[2], np);
  pw[2].dispatchEvent(new Event('input', { bubbles: true }));
}, ['wrongoldpw', NEW_PW]);
await sleep(300);
await page.evaluate(() => {
  const b = [...document.querySelectorAll('button')].find((x) => x.textContent.includes('更新密碼'));
  b.click();
});
await sleep(2000);
const msgErr = await page.evaluate(() => {
  const p = [...document.querySelectorAll('p')].find(
    (x) => x.className.includes('emerald') || x.className.includes('energy')
  );
  return p ? p.textContent.trim() : null;
});
console.log('錯誤舊密碼提示 =', JSON.stringify(msgErr));
await page.screenshot({ path: `${SHOTS}/settings-3-wrong-oldpw.png`, fullPage: false });
const stillOld = await db.user.findUnique({ where: { email: EMAIL } });
const bcryptCheck = await import('bcryptjs');
console.log('舊密碼仍有效 =', await bcryptCheck.default.compare(OLD_PW, stillOld.passwordHash), '(true = 未被改動)');

console.log('\n== D5 正式修改密碼 → msw2026new ==');
await page.evaluate(([cur, np]) => {
  const pw = [...document.querySelectorAll('input[type=password]')];
  const s = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
  [cur, np, np].forEach((v, i) => {
    s.call(pw[i], v);
    pw[i].dispatchEvent(new Event('input', { bubbles: true }));
  });
}, [OLD_PW, NEW_PW]);
await sleep(300);
await page.evaluate(() => {
  const b = [...document.querySelectorAll('button')].find((x) => x.textContent.includes('更新密碼'));
  b.click();
});
await sleep(2200);
const msgOk = await page.evaluate(() => {
  const p = [...document.querySelectorAll('p')].find(
    (x) => x.className.includes('emerald') || x.className.includes('energy')
  );
  return p ? p.textContent.trim() : null;
});
console.log('成功提示 =', JSON.stringify(msgOk));
await page.screenshot({ path: `${SHOTS}/settings-2-password.png`, fullPage: false });

const dbPw = await db.user.findUnique({ where: { email: EMAIL } });
console.log('DB 新密碼可登入 =', await bcryptCheck.default.compare(NEW_PW, dbPw.passwordHash));
console.log('DB 舊密碼可登入 =', await bcryptCheck.default.compare(OLD_PW, dbPw.passwordHash));

console.log('\n== D6 登出，用新密碼登入 ==');
await page.goto(`${BASE}/`, { waitUntil: 'networkidle2' });
await sleep(1200);
await page.evaluate(() => {
  const b = [...document.querySelectorAll('button, a')].find((x) => x.textContent.trim() === '登出');
  if (b) b.click();
});
await sleep(2500);
console.log('after logout url =', page.url());

const relog = await loginOn(page, EMAIL, NEW_PW);
console.log('新密碼登入後 url =', relog, relog.includes('/dashboard') ? 'PASS' : 'FAIL');
await page.goto(`${BASE}/dashboard`, { waitUntil: 'networkidle2' });
await sleep(1500);
const finalName = await page.evaluate(() => document.querySelector('h1')?.textContent?.trim());
console.log('登入後顯示名稱 =', JSON.stringify(finalName));
await page.screenshot({ path: `${SHOTS}/settings-4-relogin-newpw.png`, fullPage: false });

console.log('\n== DIALOGS ==', JSON.stringify(dialogs));
console.log('== ERRORS ==', JSON.stringify(errors.filter((e) => !e.includes('_rsc')), null, 1));

await browser.close();
await db.$disconnect();
