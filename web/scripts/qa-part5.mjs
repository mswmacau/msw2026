import { launch, newPage, shot, sleep, login, clickText, fill, BASE, DESKTOP, MOBILE } from './qa-final-lib.mjs';
import fs from 'fs';

const R = { cases: [], shots: [] };
const rec = (k, v) => { R.cases.push({ k, v }); console.log(`  ▸ ${k}:`, JSON.stringify(v)); };

const browser = await launch();
const anon = await newPage(browser, DESKTOP);
const mem = await newPage(browser, DESKTOP);
const adm = await newPage(browser, DESKTOP);

try {
  await login(mem, 'ming@msw.mo', 'msw2026');
  await login(adm, 'admin@msw.mo', 'msw2026admin');

  console.log('\n=== A. /run 邊界：公里數 ===');
  const runCases = [
    { km: '0', label: '0' },
    { km: '-5', label: '負數' },
    { km: '99999', label: '超大值' },
    { km: 'abc', label: '非數字' },
  ];
  for (const c of runCases) {
    await mem.goto(`${BASE}/run`, { waitUntil: 'networkidle2', timeout: 60000 });
    await sleep(1500);
    const fi = await mem.$('input[type=file]');
    await fi.uploadFile('/workspace/msw/web/public/images/running-track.jpg');
    await sleep(2200);
    await fill(mem, 'input[type=number]', c.km);
    // 用原生 submit 檢查 HTML5 驗證
    const validity = await mem.$eval('input[type=number]', (e) => ({
      value: e.value, valid: e.validity.valid, rangeUnder: e.validity.rangeUnderflow,
      rangeOver: e.validity.rangeOverflow, badInput: e.validity.badInput,
    }));
    const r = await mem.evaluate(async (km) => {
      const res = await fetch('/api/runs', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ km: km === 'abc' ? NaN : Number(km), screenshotUrl: '/images/running-track.jpg', periodMonth: '2026-09', note: 'QA邊界' }),
      });
      let b = ''; try { b = (await res.json()); } catch {}
      return { status: res.status, body: JSON.stringify(b).slice(0, 160) };
    }, c.km);
    rec(`km[${c.label}]`, { clientValidity: validity, api: r });
  }

  console.log('\n=== B. 未登入存取 ===');
  await anon.goto(`${BASE}/`, { waitUntil: 'networkidle2' });
  for (const p of ['/dashboard', '/admin', '/run']) {
    await anon.goto(`${BASE}${p}`, { waitUntil: 'networkidle2', timeout: 60000 });
    await sleep(1200);
    const info = await anon.evaluate(() => ({
      url: location.pathname,
      needLogin: /請先登入|會員登入|登入後/.test(document.body.innerText),
      hasAdmin: /管理後台|待確認截圖/.test(document.body.innerText),
    }));
    rec(`anon${p}`, info);
  }

  console.log('\n=== C. API 未帶 token ===');
  const apiProbe = await anon.evaluate(async () => {
    const out = {};
    const calls = [
      ['POST', '/api/runs', { km: 5, screenshotUrl: '/images/running-track.jpg', periodMonth: '2026-09' }],
      ['PATCH', '/api/admin/runs/xxx', { action: 'approve' }],
      ['POST', '/api/admin/coupons/redeem', { code: 'MSW-202609-DEMO01' }],
      ['POST', '/api/upload', null],
    ];
    for (const [m, u, b] of calls) {
      try {
        const opt = { method: m };
        if (b) { opt.headers = { 'Content-Type': 'application/json' }; opt.body = JSON.stringify(b); }
        const r = await fetch(u, opt);
        out[`${m} ${u}`] = r.status;
      } catch (e) { out[`${m} ${u}`] = 'ERR'; }
    }
    return out;
  });
  rec('anonApiStatus', apiProbe);

  console.log('\n=== D. 普通會員越權 ===');
  const memberProbe = await mem.evaluate(async () => {
    const out = {};
    const calls = [
      ['PATCH', '/api/admin/runs/anything', { action: 'approve' }],
      ['POST', '/api/admin/coupons/redeem', { code: 'MSW-202609-DEMO01' }],
      ['POST', '/api/admin/coupons', { month: '2026-09' }],
    ];
    for (const [m, u, b] of calls) {
      const r = await fetch(u, { method: m, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(b) });
      let t = ''; try { t = (await r.text()).slice(0, 90); } catch {}
      out[`${m} ${u}`] = { status: r.status, body: t };
    }
    return out;
  });
  rec('memberOnAdminApi', memberProbe);

  // /admin 頁面會員身份
  await mem.goto(`${BASE}/admin`, { waitUntil: 'networkidle2', timeout: 60000 });
  await sleep(1500);
  rec('memberOnAdminPage', await mem.evaluate(() => ({
    url: location.pathname,
    showsAdmin: /待確認截圖|管理後台|優惠券核銷/.test(document.body.innerText),
  })));

  console.log('\n=== E. 參數篡改：IDOR 看他人 records ===');
  const idor = await mem.evaluate(async () => {
    const out = {};
    for (const q of ['?userId=admin', '?month=-1', '?month=99999999']) {
      const r = await fetch(`/api/admin/members${q}`);
      out[q] = r.status;
    }
    return out;
  });
  rec('idorProbe', idor);

  console.log('\n=== F. 註冊邊界 ===');
  const regCases = [
    { name: 'A', email: 'pretest_short@msw.mo', pw: '1234567', label: '密碼7碼' },
    { name: 'B', email: 'not-an-email', pw: 'validpass123', label: 'Email格式錯' },
    { name: '', email: 'pretest_empty@msw.mo', pw: 'validpass123', label: '暱稱空' },
    { name: 'C', email: 'ming@msw.mo', pw: 'validpass123', label: 'Email重複' },
  ];
  for (const c of regCases) {
    const r = await anon.evaluate(async (c) => {
      const res = await fetch('/api/register', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ displayName: c.name, email: c.email, password: c.pw }),
      });
      let b = ''; try { b = await res.text(); } catch {}
      return { status: res.status, body: b.slice(0, 160) };
    }, c);
    rec(`reg[${c.label}]`, r);
  }

  console.log('\n=== G. 極端 Email / 超長輸入 ===');
  const longName = 'X'.repeat(300);
  const long = await anon.evaluate(async (n) => {
    const r = await fetch('/api/register', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ displayName: n, email: `pretest_${Date.now()}@msw.mo`, password: 'validpass123' }),
    });
    let t = ''; try { t = (await r.text()).slice(0, 120); } catch {}
    return { status: r.status, body: t };
  }, longName);
  rec('reg[暱稱300字]', long);

  R.errors = {
    mem: mem.__errors.filter((e) => !e.includes('_rsc')).slice(0, 10),
    adm: adm.__errors.filter((e) => !e.includes('_rsc')).slice(0, 10),
    anon: anon.__errors.filter((e) => !e.includes('_rsc')).slice(0, 10),
  };
} catch (e) {
  R.fatal = String(e.stack || e.message);
  console.log('!!! FATAL ' + e.message);
} finally {
  fs.writeFileSync('/workspace/msw/web/scripts/qa-part5.json', JSON.stringify(R, null, 2));
  console.log('\n===== PART5 DONE =====');
  await browser.close();
}
