import {
  launch, newPage, shot, sleep, login, logout, clickText, hasText,
  bodyText, fill, readDashboard, readRun, BASE, IMG, DESKTOP,
} from './qa-final-lib.mjs';
import fs from 'fs';

const R = { steps: [], shots: [], errors: {} };
const log = (...a) => { console.log(...a); };
const rec = (k, v) => { R.steps.push({ k, v }); log(`  ▸ ${k}:`, JSON.stringify(v)); };

const TS = Date.now();
const EMAIL = `qa+${TS}@msw.mo`;
const PW = 'qaPass2026';
const NAME = `QA阿明${String(TS).slice(-5)}`;
const KM = 8.8;

const browser = await launch();
const mem = await newPage(browser, DESKTOP);
const admin = await newPage(browser, DESKTOP);

try {
  // ─────────── STEP 1: 註冊 ───────────
  log('\n=== STEP 1 註冊 /register ===');
  await mem.goto(`${BASE}/register`, { waitUntil: 'networkidle2', timeout: 60000 });
  await sleep(800);
  const regFields = await mem.evaluate(() =>
    [...document.querySelectorAll('form input')].map((i) => ({
      type: i.type, ph: i.placeholder,
    }))
  );
  rec('register.fields', regFields);

  // 依 DOM 順序填入：暱稱 / email / 密碼 / 確認密碼
  const filled = await mem.evaluate(
    ({ name, email, pw }) => {
      const set = (el, v) => {
        const s = Object.getOwnPropertyDescriptor(
          window.HTMLInputElement.prototype, 'value'
        ).set;
        s.call(el, v);
        el.dispatchEvent(new Event('input', { bubbles: true }));
      };
      const ins = [...document.querySelectorAll('form input')];
      [name, email, pw, pw].forEach((v, i) => ins[i] && set(ins[i], v));
      return ins.map((i) => `${i.type}:${i.value}`);
    },
    { name: NAME, email: EMAIL, pw: PW }
  );
  rec('register.filled', filled);
  R.shots.push(await shot(mem, 'reg-1-register.png'));

  await clickText(mem, '免費加入');
  await sleep(5000);
  const urlAfter = mem.url();
  rec('register.urlAfter', urlAfter);
  if (!urlAfter.includes('/dashboard')) {
    const err = await mem.evaluate(() => {
      const p = [...document.querySelectorAll('p,div')]
        .map((e) => e.textContent.trim())
        .filter((t) => /失敗|錯誤|不一致|已存在|exists/i.test(t) && t.length < 80);
      return err.length ? err : null || p.slice(0, 5);
    });
    rec('register.errorMsg', err);
    const httpErr = mem.__errors.filter((e) => e.includes('api/register'));
    rec('register.httpErrors', httpErr.slice(0, 5));
  }
  rec('register.autoLogin', urlAfter.includes('/dashboard'));

  // 確認 session 真的存在（抓 navbar 積分數字）
  const navPts = await mem.evaluate(() => {
    const a = [...document.querySelectorAll('a[href="/dashboard"]')]
      .find((x) => x.textContent.includes('積分'));
    return a ? a.textContent.replace(/\s+/g, ' ').trim() : null;
  });
  rec('register.navbarPoints', navPts);

  const dash1 = await readDashboard(mem);
  rec('dashboard.afterRegister', dash1);
  const t1 = await bodyText(mem);
  rec('dashboard.has50', /50/.test(t1));
  rec('dashboard.hasName', t1.includes(NAME));
  R.shots.push(await shot(mem, 'reg-2-dashboard.png'));

  // ─────────── STEP 2: 上傳跑步紀錄 ───────────
  log('\n=== STEP 2 上傳 /run ===');
  await mem.goto(`${BASE}/run`, { waitUntil: 'networkidle2', timeout: 60000 });
  await sleep(1200);
  const before = await readRun(mem);
  rec('run.before', before);

  const fi = await mem.$('input[type=file]');
  rec('run.fileInputExists', !!fi);
  if (!fi) throw new Error('file input not found');
  await fi.uploadFile(IMG);
  await sleep(2500);
  const ready = await hasText(mem, '截圖已就緒');
  rec('run.uploadReady', ready);

  await fill(mem, 'input[type=number]', String(KM));
  const kmVal = await mem.$eval('input[type=number]', (e) => e.value);
  rec('run.kmValue', kmVal);

  await fill(mem, 'input[placeholder="例如：黑沙環海堤夜跑"]', 'QA 回歸測試上傳');
  await clickText(mem, '送出紀錄');
  await sleep(3500);

  const toast = await hasText(mem, '已送出');
  rec('run.successToast', toast);
  const listPending = await hasText(mem, '待確認');
  rec('run.listHasPending', listPending);
  const after2 = await readRun(mem);
  rec('run.afterSubmit', after2);
  const rec8 = await mem.evaluate(() =>
    [...document.querySelectorAll('*')]
      .filter((e) => e.children.length === 0 && e.textContent.includes('8.8'))
      .slice(0, 3)
      .map((e) => e.textContent.trim())
  );
  rec('run.record8_8', rec8);
  R.shots.push(await shot(mem, 'reg-3-upload.png'));

  // ─────────── STEP 3: 管理員確認 ───────────
  log('\n=== STEP 3 管理員 /admin 確認 ===');
  const lg = await login(admin, 'admin@msw.mo', 'msw2026admin');
  rec('admin.login', lg);
  await admin.goto(`${BASE}/admin`, { waitUntil: 'networkidle2', timeout: 60000 });
  await sleep(2000);
  const tabText = await admin.evaluate(() =>
    [...document.querySelectorAll('button')].map((b) => b.textContent.trim())
      .filter((t) => /待確認截圖|訓練出席|達成名單|優惠券|會員/.test(t))
  );
  rec('admin.tabs', tabText);
  const pendingCountBefore = await admin.evaluate(() => {
    const b = [...document.querySelectorAll('button')].find((x) => x.textContent.includes('待確認截圖'));
    return b ? b.textContent.trim() : null;
  });
  rec('admin.pendingTabLabel', pendingCountBefore);

  // 精準定位「該會員的待確認卡片」
  const CARD = 'div.overflow-hidden.rounded-2xl';
  const cardInfo = await admin.evaluate(
    ({ email, sel }) => {
      const cards = [...document.querySelectorAll(sel)].filter((c) =>
        c.textContent.includes(email)
      );
      if (!cards.length) return { found: 0 };
      const c = cards[0];
      const img = c.querySelector('img');
      return {
        found: cards.length,
        hasImg: !!img,
        imgSrc: img ? img.getAttribute('src') : null,
        imgCursor: img ? getComputedStyle(img).cursor : null,
        cardKm: (c.textContent.match(/([\d.]+)\s*KM/) || [])[1] || null,
        hasApproveBtn: [...c.querySelectorAll('button')].some((b) => b.textContent.includes('✓')),
      };
    },
    { email: EMAIL, sel: CARD }
  );
  rec('admin.pendingCard', cardInfo);

  // 點擊放大截圖（lightbox）
  const lbInfo = await admin.evaluate(({ email, sel }) => {
    const c = [...document.querySelectorAll(sel)].find((x) => x.textContent.includes(email));
    const img = c && c.querySelector('img');
    if (!img) return { clicked: false };
    img.click();
    return { clicked: true };
  }, { email: EMAIL, sel: CARD });
  await sleep(1500);
  const lbOpen = await admin.evaluate(() => {
    const ov = [...document.querySelectorAll('div')].find(
      (d) => getComputedStyle(d).position === 'fixed' && d.querySelector('img')
    );
    return ov ? { open: true, cls: String(ov.className).slice(0, 60) } : { open: false };
  });
  rec('admin.lightbox', { ...lbInfo, ...lbOpen });
  R.shots.push(await shot(admin, 'reg-3b-lightbox.png'));
  await admin.evaluate(() => {
    const ov = [...document.querySelectorAll('div')].find(
      (d) => getComputedStyle(d).position === 'fixed' && d.querySelector('img')
    );
    if (ov) ov.click();
  });
  await sleep(1000);

  // 攔截 PATCH 回應，確認 API 真的成功
  const apiCalls = [];
  admin.on('response', async (r) => {
    if (r.url().includes('/api/admin/runs/')) {
      let body = '';
      try { body = (await r.text()).slice(0, 200); } catch {}
      apiCalls.push({ status: r.status(), url: r.url(), body });
    }
  });

  // 點該卡片上的 ✓ 確認
  const approved = await admin.evaluate(({ email, sel }) => {
    const c = [...document.querySelectorAll(sel)].find((x) => x.textContent.includes(email));
    if (!c) return { ok: false, err: 'card not found' };
    const b = [...c.querySelectorAll('button')].find((x) => x.textContent.includes('✓'));
    if (!b) return { ok: false, err: 'approve btn not found' };
    b.click();
    return { ok: true, btnText: b.textContent.trim() };
  }, { email: EMAIL, sel: CARD });
  rec('admin.approveClicked', approved);
  await sleep(4000);
  rec('admin.approveApiCalls', apiCalls);

  const afterState = await admin.evaluate((email) => {
    const b = [...document.querySelectorAll('button')].find((x) => x.textContent.includes('待確認截圖'));
    return {
      tabLabel: b ? b.textContent.trim() : null,
      emailStillOnPage: document.body.innerText.includes(email),
    };
  }, EMAIL);
  rec('admin.afterApprove', afterState);
  R.shots.push(await shot(admin, 'reg-4-admin-approved.png'));

  // ─────────── STEP 4: 會員端確認結果 ───────────
  log('\n=== STEP 4 會員端驗證 ===');
  await mem.goto(`${BASE}/run`, { waitUntil: 'networkidle2', timeout: 60000 });
  await sleep(2000);
  const after3 = await readRun(mem);
  rec('run.afterApprove', after3);
  const confirmedTxt = await mem.evaluate(() => {
    const m = document.body.innerText.match(/已確認[\s\S]{0,400}/);
    return m ? m[0].replace(/\s+/g, ' ').slice(0, 300) : null;
  });
  rec('run.confirmedSection', confirmedTxt);

  await mem.goto(`${BASE}/dashboard`, { waitUntil: 'networkidle2', timeout: 60000 });
  await sleep(1500);
  const dash2 = await readDashboard(mem);
  rec('dashboard.afterApprove', dash2);
  R.shots.push(await shot(mem, 'reg-5-member-confirmed.png'));

  R.summary = {
    email: EMAIL, name: NAME, km: KM,
    pointsAfterRegister: dash1.points,
    pointsAfterApprove: dash2.points,
    kmBefore: before.km, kmAfterSubmit: after2.km, kmAfterApprove: after3.km,
    pendingBefore: before.nums, pendingAfter: after2.nums, final: after3.nums,
  };
  R.errors.member = mem.__errors.slice(0, 15);
  R.errors.admin = admin.__errors.slice(0, 15);
} catch (e) {
  R.fatal = String(e.stack || e.message);
  console.log('\n!!! FATAL:', e.message);
  R.errors.member = mem.__errors?.slice(0, 15);
  R.errors.admin = admin.__errors?.slice(0, 15);
} finally {
  fs.writeFileSync('/workspace/msw/web/scripts/qa-part1.json', JSON.stringify(R, null, 2));
  console.log('\n===== PART1 SUMMARY =====');
  console.log(JSON.stringify(R.summary || R.fatal, null, 2));
  await browser.close();
}
