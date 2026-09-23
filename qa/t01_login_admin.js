const { launch, shot, clickables, wait, BASE } = require('./harness');

(async () => {
  const { browser, page, errors } = await launch();

  console.log('=== A1. Login page ===');
  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle2', timeout: 60000 });
  await wait(800);
  await shot(page, 'a01_login_page');

  console.log('--- login form fields ---');
  console.log(JSON.stringify(await page.evaluate(() => {
    return [...document.querySelectorAll('input, button')].filter(e => e.getBoundingClientRect().width > 0 || e.getBoundingClientRect().height > 0)
      .map(e => ({ tag: e.tagName, type: e.type, name: e.name, id: e.id, ph: e.placeholder, text: (e.innerText||'').trim().slice(0,40) }));
  }), null, 1));

  // Fill credentials and submit
  await page.evaluate(() => {
    const els = [...document.querySelectorAll('input')].filter(e => e.getBoundingClientRect().height > 0);
    const set = (el, v) => {
      const proto = el.tagName === 'TEXTAREA' ? HTMLTextAreaElement : HTMLInputElement;
      Object.getOwnPropertyDescriptor(proto.prototype, 'value').set.call(el, v);
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
    };
    els.forEach(el => {
      const isEmail = el.type === 'email' || /mail|账号|帳號|email/i.test(el.name + el.id + el.placeholder);
      const isPw = el.type === 'password';
      if (isEmail) set(el, 'admin@msw.mo');
      else if (isPw) set(el, 'msw2026admin');
    });
  });
  await wait(300);
  await shot(page, 'a01_login_filled');

  console.log('Submitting login...');
  await Promise.all([
    page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 }).catch(e => console.log('  nav wait: ' + e.message)),
    page.evaluate(() => {
      const form = document.querySelector('form');
      const btn = document.querySelector('form button[type="submit"]') || document.querySelector('form button');
      if (btn) btn.click(); else if (form) form.requestSubmit();
    }),
  ]);
  await wait(2500);
  console.log('URL after login: ' + page.url());
  await shot(page, 'a02_after_login');

  console.log('--- cookies ---');
  const cookies = await browser.cookies ? await page.cookies() : [];
  console.log(JSON.stringify((await page.cookies()).map(c => ({ name: c.name, httpOnly: c.httpOnly, secure: c.secure, path: c.path, exp: c.expires })), null, 1));

  console.log('--- localStorage / sessionStorage ---');
  console.log(JSON.stringify(await page.evaluate(() => {
    const o = {};
    for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); o['ls:'+k] = localStorage.getItem(k).slice(0, 80); }
    for (let i = 0; i < sessionStorage.length; i++) { const k = sessionStorage.key(i); o['ss:'+k] = sessionStorage.getItem(k).slice(0, 80); }
    return o;
  }), null, 1));

  console.log('\n=== A2. Go to /admin ===');
  await page.goto(`${BASE}/admin`, { waitUntil: 'networkidle2', timeout: 60000 });
  await wait(2000);
  console.log('URL: ' + page.url());
  await shot(page, 'a03_admin_initial');

  console.log('--- admin page clickables ---');
  console.log(JSON.stringify(await clickables(page), null, 1));

  console.log('--- body text (first 2000 chars) ---');
  console.log((await page.evaluate(() => document.body.innerText)).slice(0, 2000));

  console.log('\n--- errors collected ---');
  console.log(errors.slice(0, 30).join('\n') || '(none)');

  await browser.close();
})().catch(e => { console.error('FATAL: ' + e.stack); process.exit(1); });
