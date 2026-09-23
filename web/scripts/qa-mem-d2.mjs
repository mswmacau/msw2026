import { launch, sleep, SHOTS, BASE } from './qa-mem-lib.mjs';
import { PrismaClient } from '@prisma/client';
const db = new PrismaClient();

const EMAIL = 'ming@msw.mo';
const PW = 'msw2026new'; // 已於 D 組改為新密碼

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

await loginOn(page, EMAIL, PW);
console.log('login url =', page.url());

// 只改暱稱（不碰密碼），驗證 banner 是否落在視窗外 → 破版/看不到提示風險
await page.goto(`${BASE}/settings`, { waitUntil: 'networkidle2' });
await sleep(1500);

const geom = await page.evaluate(() => {
  const inputs = [...document.querySelectorAll('input')];
  const nameInput = inputs.find((i) => !i.readOnly && i.type !== 'password');
  const btn = [...document.querySelectorAll('button')].find((x) => x.textContent.includes('儲存資料'));
  const pwBtn = [...document.querySelectorAll('button')].find((x) => x.textContent.includes('更新密碼'));
  return {
    viewportH: window.innerHeight,
    scrollH: document.documentElement.scrollHeight,
    nameInputTop: nameInput?.getBoundingClientRect().top + window.scrollY,
    saveBtnBottom: btn?.getBoundingClientRect().bottom + window.scrollY,
    pwBtnBottom: pwBtn?.getBoundingClientRect().bottom + window.scrollY,
  };
});
console.log('layout =', JSON.stringify(geom, null, 1));

// 改暱稱
await page.evaluate(() => {
  const input = [...document.querySelectorAll('input')].find(
    (i) => !i.readOnly && i.type !== 'password'
  );
  const s = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
  s.call(input, '阿明改二');
  input.dispatchEvent(new Event('input', { bubbles: true }));
});
await sleep(300);
await page.evaluate(() => {
  [...document.querySelectorAll('button')].find((x) => x.textContent.includes('儲存資料')).click();
});
await sleep(2000);

const bannerInfo = await page.evaluate(() => {
  const p = [...document.querySelectorAll('p')].find(
    (x) => x.className.includes('emerald') || x.className.includes('energy')
  );
  if (!p) return null;
  const r = p.getBoundingClientRect();
  return {
    text: p.textContent.trim(),
    top: r.top,
    bottom: r.bottom,
    inViewport: r.top >= 0 && r.bottom <= window.innerHeight,
    pageY: r.top + window.scrollY,
    viewportH: window.innerHeight,
  };
});
console.log('成功 banner =', JSON.stringify(bannerInfo));
console.log('=> banner 是否需要捲動才可見:', bannerInfo && !bannerInfo.inViewport ? '是（截圖會看不到）' : '否');

await page.screenshot({ path: `${SHOTS}/settings-5-name-banner-scrolled.png`, fullPage: true });

// 捲到 banner 位置再截圖，確認提示真的存在
await page.evaluate(() => {
  const p = [...document.querySelectorAll('p')].find(
    (x) => x.className.includes('emerald') || x.className.includes('energy')
  );
  if (p) p.scrollIntoView({ block: 'center' });
});
await sleep(600);
await page.screenshot({ path: `${SHOTS}/settings-6-name-banner-visible.png`, fullPage: false });

await db.user.update({ where: { email: EMAIL }, data: { displayName: '阿明改', name: '阿明改' } });
console.log('已把暱稱還原為「阿明改」');

console.log('ERRORS =', JSON.stringify(errors.filter((e) => !e.includes('_rsc')), null, 1));
await browser.close();
await db.$disconnect();
