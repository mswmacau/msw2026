// A01/A02: real login via UI form, then /admin tab bar inspection
const { launch, shot, inputs, clickText, wait, BASE } = require('./harness');
const fs = require('fs');

const ADMIN = { email: 'admin@msw.mo', password: 'msw2026admin' };

(async () => {
  const { browser, page, errors } = await launch();

  await page.goto(BASE + '/login', { waitUntil: 'networkidle2', timeout: 30000 });
  await wait(700);
  console.log('--- /login inputs ---');
  console.log(JSON.stringify(await inputs(page), null, 2));
  await shot(page, 'A01_login_page');

  // fill
  await page.evaluate(() => {
    const set = (sel, v) => {
      const el = document.querySelector(sel);
      if (!el) return false;
      const proto = el.tagName === 'TEXTAREA' ? HTMLTextAreaElement : HTMLInputElement;
      Object.getOwnPropertyDescriptor(proto.prototype, 'value').set.call(el, v);
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
      return true;
    };
    const r = {};
    r.email = set('input[type="email"], input[name="email"]', '');
    r.pwd = set('input[type="password"]', '');
    return r;
  });

  // Use real typing to be maximally faithful to a human flow
  await page.type('input[type="email"], input[name="email"]', ADMIN.email, { delay: 15 });
  await page.type('input[type="password"]', ADMIN.password, { delay: 15 });
  await wait(300);
  const formState = await page.evaluate(() => {
    const btns = [...document.querySelectorAll('button')].map((b) => ({
      text: b.innerText.trim(), type: b.type, disabled: b.disabled,
      rect: b.getBoundingClientRect().width > 0,
    }));
    return { btns };
  });
  console.log('--- buttons ---');
  console.log(JSON.stringify(formState, null, 2));
  await shot(page, 'A01_login_filled');

  console.log('--- submit ---');
  await Promise.all([
    page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 }).catch((e) => console.log('nav: ' + e.message)),
    clickText(page, '登入', { tag: 'button' }),
  ]);
  await wait(2000);
  console.log('after login url: ' + page.url());
  await wait(1200);
  await shot(page, 'A02_after_login');

  // Is the session actually established? Ask the server, not the DOM.
  const sess = await page.evaluate(async () => {
    const r = await fetch('/api/auth/session', { credentials: 'include' });
    return { status: r.status, body: await r.text() };
  });
  console.log('--- session ---');
  console.log(JSON.stringify(sess, null, 2));

  // now /admin
  await page.goto(BASE + '/admin', { waitUntil: 'networkidle2', timeout: 30000 });
  await wait(1800);
  const adminState = await page.evaluate(() => ({
    url: location.pathname,
    h1: (document.querySelector('h1') || {}).innerText || null,
    bodyLen: document.body.innerText.trim().length,
    text: document.body.innerText.trim().slice(0, 600),
  }));
  console.log('--- /admin ---');
  console.log(JSON.stringify(adminState, null, 2));
  await shot(page, 'A02_admin_tabs');

  const tabs = await page.evaluate(() => {
    return [...document.querySelectorAll('button, [role="tab"], a')]
      .filter((e) => e.getBoundingClientRect().width > 0)
      .map((e) => e.innerText.trim().replace(/\s+/g, ' ').slice(0, 40))
      .filter(Boolean);
  });
  console.log('--- clickable labels on /admin ---');
  console.log(JSON.stringify(tabs, null, 2));

  const ck = await browser.cookies();
  fs.writeFileSync('/workspace/msw/qa/qg_admin_cookies.json', JSON.stringify(ck, null, 2));
  console.log('cookies saved: ' + ck.length);

  console.log('--- errors ---');
  console.log(errors.slice(0, 20).join('\n') || '(none)');
  await browser.close();
})();
