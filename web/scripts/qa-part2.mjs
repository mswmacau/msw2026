import {
  launch, newPage, shot, sleep, login, clickText, bodyText, fill, BASE, DESKTOP,
} from './qa-final-lib.mjs';
import fs from 'fs';

const R = { steps: [], shots: [] };
const log = (...a) => console.log(...a);
const rec = (k, v) => { R.steps.push({ k, v }); log(`  ▸ ${k}:`, JSON.stringify(v)); };

const TABS = [
  { label: '待確認截圖', marker: /沒有待確認的紀錄|跑步截圖|✓ 確認/ },
  { label: '訓練出席', marker: /選擇會員|訓練出席|簽到/ },
  { label: '達成名單', marker: /達標門檻|一鍵發放優惠券/ },
  { label: '優惠券', marker: /優惠券核銷/ },
  { label: '會員', marker: /搜尋會員|調整積分/ },
];

const browser = await launch();
const admin = await newPage(browser, DESKTOP);

try {
  log('=== 管理員登入 ===');
  rec('login', await login(admin, 'admin@msw.mo', 'msw2026admin'));
  await admin.goto(`${BASE}/admin`, { waitUntil: 'networkidle2', timeout: 60000 });
  await sleep(2000);

  log('\n=== 五個 tab 切換 ===');
  for (const t of TABS) {
    const clicked = await clickText(admin, t.label);
    await sleep(1600);
    const txt = await bodyText(admin);
    const active = await admin.evaluate((label) => {
      const b = [...document.querySelectorAll('button')].find((x) => x.textContent.includes(label));
      return b ? { text: b.textContent.trim(), cls: String(b.className).slice(0, 70) } : null;
    }, t.label);
    const ok = t.marker.test(txt);
    rec(`tab.${t.label}`, { clicked, matched: ok, activeBtn: active });
  }

  // 會員 tab 截圖
  await clickText(admin, '會員');
  await sleep(1800);
  const memTab = await admin.evaluate(() => {
    const rows = [...document.querySelectorAll('table tbody tr')].length;
    return { rows, head: document.body.innerText.slice(0, 0) };
  });
  rec('tab.會員.rows', memTab);
  R.shots.push(await shot(admin, 'reg-6-admin-tabs.png'));

  log('\n=== 優惠券核銷 MSW-202609-DEMO01 ===');
  await clickText(admin, '優惠券');
  await sleep(1800);
  const before = await admin.evaluate(() => {
    const t = document.body.innerText;
    const i = t.indexOf('MSW-202609-DEMO01');
    return { snippet: i >= 0 ? t.slice(Math.max(0, i - 120), i + 160).replace(/\s+/g, ' ') : null };
  });
  rec('coupon.before', before);

  await fill(admin, 'input[placeholder="MSW-202609-XXXX"]', 'MSW-202609-DEMO01');
  const val = await admin.$eval('input[placeholder="MSW-202609-XXXX"]', (e) => e.value);
  rec('coupon.inputValue', val);

  const api = [];
  admin.on('response', async (r) => {
    if (r.url().includes('/api/admin/coupons/redeem')) {
      let body = ''; try { body = (await r.text()).slice(0, 250); } catch {}
      api.push({ status: r.status(), body });
    }
  });

  await clickText(admin, '核銷');
  await sleep(4000);
  rec('coupon.apiCalls', api);
  const after = await admin.evaluate(() => {
    const t = document.body.innerText;
    const i = t.indexOf('MSW-202609-DEMO01');
    const emerald = [...document.querySelectorAll('p,div')]
      .map((e) => e.textContent.trim())
      .filter((x) => x.length > 0 && x.length < 200 && /核銷|成功|已使用|無效|找不到/.test(x))
      .slice(0, 6);
    return {
      snippet: i >= 0 ? t.slice(Math.max(0, i - 150), i + 200).replace(/\s+/g, ' ') : null,
      hasRedeemedChip: t.includes('已核銷'),
      msgs: emerald,
    };
  });
  rec('coupon.after', after);
  R.shots.push(await shot(admin, 'reg-7-redeem.png'));

  log('\n=== 邊界：重複核銷同一張券 ===');
  await fill(admin, 'input[placeholder="MSW-202609-XXXX"]', 'MSW-202609-DEMO01');
  await clickText(admin, '核銷');
  await sleep(3500);
  const dup = await admin.evaluate(() => {
    const t = document.body.innerText;
    return {
      err: /已核銷|已使用|無效|不存在|失敗/.test(t),
      msgs: [...document.querySelectorAll('p,div')]
        .map((e) => e.textContent.trim())
        .filter((x) => x.length > 0 && x.length < 160 && /已核銷|已使用|無效|不存在|失敗/.test(x))
        .slice(0, 5),
    };
  });
  rec('coupon.duplicate', dup);

  log('\n=== 邊界：不存在的券號 ===');
  await fill(admin, 'input[placeholder="MSW-202609-XXXX"]', 'MSW-000000-XXXXX');
  await clickText(admin, '核銷');
  await sleep(3500);
  const bad = await admin.evaluate(() =>
    [...document.querySelectorAll('p,div')]
      .map((e) => e.textContent.trim())
      .filter((x) => x.length > 0 && x.length < 160 && /找不到|無效|不存在|失敗/.test(x))
      .slice(0, 5)
  );
  rec('coupon.notFound', bad);

  R.errors = admin.__errors.filter((e) => !e.includes('_rsc')).slice(0, 15);
} catch (e) {
  R.fatal = String(e.stack || e.message);
  log('\n!!! FATAL: ' + e.message);
} finally {
  fs.writeFileSync('/workspace/msw/web/scripts/qa-part2.json', JSON.stringify(R, null, 2));
  log('\n===== PART2 DONE =====');
  await browser.close();
}
