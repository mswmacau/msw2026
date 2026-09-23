import { launch, login, sleep, clickTab, readMemberTable, SHOTS, BASE } from './qa-mem-lib.mjs';

const { browser, page, logs, errors, dialogs } = await launch();

console.log('== A0 管理員登入 ==');
let url = await login(page, 'admin@msw.mo', 'msw2026admin');
console.log('url =', url);

console.log('\n== A1 前往 /admin ==');
await page.goto(`${BASE}/admin`, { waitUntil: 'networkidle2' });
await sleep(1500);
console.log('url =', page.url());

const tabs = await page.evaluate(() =>
  [...document.querySelectorAll('button')]
    .map((b) => b.textContent.trim())
    .filter((t) =>
      ['待審核', '達標得獎', '訓練', '優惠券', '會員'].some((k) => t.includes(k))
    )
);
console.log('A2 tabs =', JSON.stringify(tabs));

// 逐一切換 5 個 tab，確認都能正常切換
console.log('\n== A3 逐一切換 tab ==');
for (const t of tabs) {
  const label = t.split(' ')[0];
  await clickTab(page, label);
  await sleep(900);
  const active = await page.evaluate(() => {
    const b = [...document.querySelectorAll('button')].find(
      (x) => x.className.includes('bg-cobalt') || x.getAttribute('aria-current')
    );
    return b ? b.textContent.trim() : null;
  });
  console.log(`  tab「${label}」 clicked, active-ish =`, active);
}

console.log('\n== A4 回到會員 tab ==');
await clickTab(page, '會員');
await sleep(1500);
const rows = await readMemberTable(page);
console.log('members =', JSON.stringify(rows, null, 1));
console.log('count =', rows.length);
console.log(
  'ADMIN count =',
  rows.filter((r) => r.role === 'ADMIN').length,
  'MEMBER count =',
  rows.filter((r) => r.role === 'MEMBER').length
);
await page.screenshot({ path: `${SHOTS}/member-1-list.png`, fullPage: true });

console.log('\n== A5 搜尋 kelvin ==');
await page.evaluate(() => {
  const input = [...document.querySelectorAll('input')].find(
    (i) => i.placeholder && i.placeholder.includes('輸入暱稱或 Email')
  );
  const setter = Object.getOwnPropertyDescriptor(
    window.HTMLInputElement.prototype,
    'value'
  ).set;
  if (input) {
    setter.call(input, 'kelvin');
    input.dispatchEvent(new Event('input', { bubbles: true }));
  }
});
await sleep(300);
const clickedSearch = await page.evaluate(() => {
  const b = [...document.querySelectorAll('button')].find(
    (x) => x.textContent.trim() === '搜尋'
  );
  if (!b) return false;
  b.click();
  return true;
});
console.log('search clicked =', clickedSearch);
await sleep(1800);
const searchRows = await readMemberTable(page);
console.log('search result =', JSON.stringify(searchRows, null, 1));
await page.screenshot({ path: `${SHOTS}/member-2-search.png`, fullPage: true });

console.log('\n== A6 重設 ==');
const clickedReset = await page.evaluate(() => {
  const b = [...document.querySelectorAll('button')].find(
    (x) => x.textContent.trim() === '重設'
  );
  if (!b) return false;
  b.click();
  return true;
});
console.log('reset clicked =', clickedReset);
await sleep(1800);
const resetRows = await readMemberTable(page);
console.log('after reset count =', resetRows.length);
console.log('reset names =', resetRows.map((r) => r.email).join(', '));
const inputValue = await page.evaluate(() => {
  const input = [...document.querySelectorAll('input')].find(
    (i) => i.placeholder && i.placeholder.includes('輸入暱稱或 Email')
  );
  return input ? input.value : null;
});
console.log('search input value after reset =', JSON.stringify(inputValue));

console.log('\n== A7 版面檢查（溢出/重疊） ==');
const layout = await page.evaluate(() => {
  const de = document.documentElement;
  return {
    scrollW: de.scrollWidth,
    clientW: de.clientWidth,
    horizontalOverflow: de.scrollWidth > de.clientWidth + 2,
  };
});
console.log('layout =', JSON.stringify(layout));

console.log('\n== DIALOGS ==', JSON.stringify(dialogs));
console.log('== ERRORS ==', JSON.stringify(errors, null, 1));

await browser.close();
