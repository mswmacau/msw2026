import { launch, login, sleep, SHOTS, BASE } from './qa-mem-lib.mjs';

const { browser, page, errors } = await launch();
await login(page, 'admin@msw.mo', 'msw2026admin');
await page.goto(`${BASE}/admin`, { waitUntil: 'networkidle2' });
await sleep(1500);

const tabs = await page.evaluate(() => {
  const bar = document.querySelector('div.flex.gap-2.rounded-xl');
  if (!bar) return null;
  return [...bar.querySelectorAll('button')].map((b) => b.textContent.trim());
});
console.log('TABS =', JSON.stringify(tabs));

// 逐一切換，確認每個 tab 都渲染出對應內容且無 JS 錯誤
const expected = ['待確認截圖', '訓練出席', '達成名單', '優惠券', '會員'];
for (const kw of expected) {
  await page.evaluate((k) => {
    const bar = document.querySelector('div.flex.gap-2.rounded-xl');
    const b = [...bar.querySelectorAll('button')].find((x) =>
      x.textContent.includes(k)
    );
    if (b) b.click();
  }, kw);
  await sleep(1200);
  const state = await page.evaluate(() => {
    const bar = document.querySelector('div.flex.gap-2.rounded-xl');
    const active = [...bar.querySelectorAll('button')].find((b) =>
      b.className.includes('bg-cobaltBright')
    );
    const body = document.body.innerText;
    return {
      active: active ? active.textContent.trim() : null,
      hasTable: !!document.querySelector('table'),
      snippet: body.slice(body.indexOf('管理') >= 0 ? body.indexOf('管理') : 0, 0) || '',
      emptyStates: [...document.querySelectorAll('td, p')]
        .map((e) => e.textContent.trim())
        .filter((t) => t.includes('沒有') || t.includes('尚無') || t.includes('暫無'))
        .slice(0, 3),
    };
  });
  console.log(`  「${kw}」 ->`, JSON.stringify(state));
  await page.screenshot({ path: `${SHOTS}/tab-${kw}.png`, fullPage: false });
}

console.log('ERRORS =', JSON.stringify(errors.filter((e) => !e.includes('_rsc')), null, 1));
await browser.close();
