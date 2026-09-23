const { launch, shot, wait, BASE, clickText } = require('./harness');

async function login(page, email, pw) {
  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle2', timeout: 60000 });
  await wait(600);
  await page.evaluate(() => {
    const els = [...document.querySelectorAll('input')].filter(e => e.getBoundingClientRect().height > 0);
    els.forEach(el => { if (el.type === 'email' || /mail/i.test(el.name + el.id + el.placeholder)) el.value = ''; });
  });
  await page.evaluate((email, pw) => {
    const els = [...document.querySelectorAll('input')].filter(e => e.getBoundingClientRect().height > 0);
    const set = (el, v) => {
      const proto = el.tagName === 'TEXTAREA' ? HTMLTextAreaElement : HTMLInputElement;
      Object.getOwnPropertyDescriptor(proto.prototype, 'value').set.call(el, v);
      el.dispatchEvent(new Event('input', { bubbles: true }));
    };
    els.forEach(el => {
      if (el.type === 'email' || /mail/i.test(el.name + el.id + el.placeholder)) set(el, email);
      else if (el.type === 'password') set(el, pw);
    });
  }, email, pw);
  await page.evaluate(() => { const b = document.querySelector('form button[type="submit"]'); if (b) b.click(); });
  await wait(2200);
  console.log(`login(${email}) ->`, page.url());
}

(async () => {
  const { browser, page } = await launch();

  console.log('===== C14. Admin logout, ming login, open /admin =====');
  await login(page, 'admin@msw.mo', 'msw2026admin');
  await page.goto(`${BASE}/admin`, { waitUntil: 'networkidle2' });
  await wait(1000);
  // logout via header button
  await clickText(page, '登出', { tag: 'button' });
  await wait(2000);
  console.log('after logout url:', page.url());
  await shot(page, 'c01_after_logout');

  await login(page, 'ming@msw.mo', 'msw2026');
  await shot(page, 'c02_ming_logged_in');

  await page.goto(`${BASE}/admin`, { waitUntil: 'networkidle2' });
  await wait(1800);
  console.log('ming /admin url:', page.url());
  const adminTxt = await page.evaluate(() => document.body.innerText.replace(/\s+/g, ' ').slice(0, 500));
  console.log('ming /admin body:', adminTxt);
  await shot(page, 'c03_ming_admin_denied');

  // save ming cookies for API tests
  const mingCookies = await page.cookies();
  require('fs').writeFileSync('/workspace/msw/qa/ming_cookies.json', JSON.stringify(mingCookies, null, 1));

  console.log('\n===== D16. All front pages 200 + CSS loaded =====');
  const pages = ['/', '/events', '/about', '/contact', '/login', '/register', '/leaderboard', '/run', '/faq'];
  for (const p of pages) {
    const resp = await page.goto(`${BASE}${p}`, { waitUntil: 'networkidle2', timeout: 60000 });
    await wait(700);
    const css = await page.evaluate(() => {
      const bg = getComputedStyle(document.body).backgroundColor;
      const sheets = document.styleSheets.length;
      const header = document.querySelector('header');
      const headerBg = header ? getComputedStyle(header).backgroundColor || getComputedStyle(header).backgroundImage : null;
      const hasContent = document.body.innerText.trim().length > 100;
      return { bg, sheets, headerBg, hasContent };
    });
    console.log(`${p} -> ${resp.status()} | css: ${JSON.stringify(css)}`);
    if (['/events', '/leaderboard'].includes(p)) await shot(page, 'd16_page' + p.replace('/', '_'));
  }

  console.log('\n===== D17. Mobile 390x844 no horizontal overflow =====');
  const m = await launch(true);
  const mp = m.page;
  for (const p of ['/', '/admin']) {
    await mp.goto(`${BASE}${p}`, { waitUntil: 'networkidle2' });
    await wait(1200);
    const ov = await mp.evaluate(() => ({
      scrollW: document.documentElement.scrollWidth,
      innerW: window.innerWidth,
      overflow: document.documentElement.scrollWidth > window.innerWidth,
      overflowers: [...document.querySelectorAll('*')].filter(e => e.getBoundingClientRect().right > window.innerWidth + 1 && e.getBoundingClientRect().width > 30).slice(0, 5).map(e => e.tagName + '.' + String(e.className).slice(0, 40)),
    }));
    console.log(`${p} @390px:`, JSON.stringify(ov, null, 1));
    await shot(mp, 'd17_mobile' + p.replace('/', '_'), false);
    await m.browser.close();
  }

  await browser.close();
})().catch(e => { console.error('FATAL: ' + e.stack); process.exit(1); });
