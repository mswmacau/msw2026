const { launch, shot, wait, BASE, clickText, clickables, inputs } = require('./harness');

async function login(page) {
  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle2', timeout: 60000 });
  await wait(600);
  await page.evaluate(() => {
    const els = [...document.querySelectorAll('input')].filter(e => e.getBoundingClientRect().height > 0);
    const set = (el, v) => {
      const proto = el.tagName === 'TEXTAREA' ? HTMLTextAreaElement : HTMLInputElement;
      Object.getOwnPropertyDescriptor(proto.prototype, 'value').set.call(el, v);
      el.dispatchEvent(new Event('input', { bubbles: true }));
    };
    els.forEach(el => {
      if (el.type === 'email' || /mail/i.test(el.name + el.id + el.placeholder)) set(el, 'admin@msw.mo');
      else if (el.type === 'password') set(el, 'msw2026admin');
    });
  });
  await page.evaluate(() => {
    const btn = document.querySelector('form button[type="submit"]') || document.querySelector('form button');
    if (btn) btn.click();
  });
  await wait(2200);
}

(async () => {
  const { browser, page } = await launch();
  await login(page);
  console.log('logged in: ' + page.url());

  await page.goto(`${BASE}/admin`, { waitUntil: 'networkidle2' });
  await wait(1500);

  console.log('=== Click 網站設定 tab ===');
  await clickText(page, '網站設定');
  await wait(1500);
  await shot(page, 'a04_settings_tab');

  console.log('--- body text ---');
  console.log((await page.evaluate(() => document.body.innerText)).slice(0, 4000));

  console.log('--- clickables ---');
  console.log(JSON.stringify((await clickables(page)).filter(c => ['button'].includes(c.tag) || c.href), null, 1));

  console.log('--- inputs ---');
  console.log(JSON.stringify(await inputs(page), null, 1));

  await browser.close();
})().catch(e => { console.error('FATAL: ' + e.stack); process.exit(1); });
