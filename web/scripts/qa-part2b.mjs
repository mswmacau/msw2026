import { launch, newPage, shot, sleep, login, clickText, fill, BASE, DESKTOP } from './qa-final-lib.mjs';
import fs from 'fs';

const R = { steps: [] };
const rec = (k, v) => { R.steps.push({ k, v }); console.log(`  ▸ ${k}:`, JSON.stringify(v)); };

const browser = await launch();
const a = await newPage(browser, DESKTOP);
try {
  await login(a, 'admin@msw.mo', 'msw2026admin');
  await a.goto(`${BASE}/admin`, { waitUntil: 'networkidle2', timeout: 60000 });
  await sleep(1800);
  await clickText(a, '優惠券');
  await sleep(1500);

  const api = [];
  a.on('response', async (r) => {
    if (r.url().includes('/coupons/redeem')) {
      let b = ''; try { b = (await r.text()).slice(0, 220); } catch {}
      api.push({ status: r.status(), body: b });
    }
  });

  // 空券號：按鈕應 disabled
  const emptyDisabled = await a.evaluate(() => {
    const b = [...document.querySelectorAll('button')].find((x) => x.textContent.includes('核銷'));
    return b ? b.disabled : null;
  });
  rec('emptyCode.btnDisabled', emptyDisabled);

  // 重複核銷（已核銷過的 DEMO01），1.5s 內抓 toast
  await fill(a, 'input[placeholder="MSW-202609-XXXX"]', 'MSW-202609-DEMO01');
  await clickText(a, '核銷');
  await sleep(1500);
  const dup = await a.evaluate(() => {
    const t = document.body.innerText;
    const m = t.match(/(✓|✕)\s*([^\n]{2,40})/g);
    const toast = [...document.querySelectorAll('div')]
      .filter((d) => /mb-8|mt-8/.test(String(d.className)) === false)
      .map((d) => d.textContent.trim())
      .filter((x) => /^✓|^✕/.test(x) && x.length < 80);
    return { toast: toast.slice(0, 4), marks: m ? m.slice(0, 6) : null };
  });
  rec('duplicate.toast', dup);

  // 小寫輸入應自動轉大寫
  await fill(a, 'input[placeholder="MSW-202609-XXXX"]', 'msw-202609-demo01');
  await sleep(600);
  const upper = await a.$eval('input[placeholder="MSW-202609-XXXX"]', (e) => e.value);
  rec('lowercase.normalized', upper);

  rec('api', api);
  R.shots = [await shot(a, 'reg-7b-redeem-dup.png')];
  R.errors = a.__errors.filter((e) => !e.includes('_rsc')).slice(0, 10);
} catch (e) {
  R.fatal = String(e.message);
} finally {
  fs.writeFileSync('/workspace/msw/web/scripts/qa-part2b.json', JSON.stringify(R, null, 2));
  await browser.close();
}
