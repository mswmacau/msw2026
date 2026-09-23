// Item 8: mobile 390x844 — / and /admin, scrollWidth must not exceed innerWidth
const { launch, wait, shot, sessionRole, BASE } = require('./R2_lib');

(async () => {
  const browser = await launch();
  const results = [];

  const check = async (path, name, loggedInRole) => {
    const p = await browser.newPage();
    await p.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
    await p.goto(BASE + path, { waitUntil: 'networkidle2', timeout: 30000 });
    await wait(1800);
    const m = await p.evaluate(() => {
      const doc = document.documentElement;
      const overflows = [];
      document.querySelectorAll('*').forEach((el) => {
        const r = el.getBoundingClientRect();
        if (r.width > 0 && (el.scrollWidth > el.clientWidth + 2) && getComputedStyle(el).overflowX !== 'auto' && getComputedStyle(el).overflowX !== 'scroll' && el.clientWidth > 0) {
          // only report elements that push beyond viewport
          if (r.right > window.innerWidth + 2) {
            overflows.push({ tag: el.tagName, cls: String(el.className).slice(0, 40), right: Math.round(r.right), sw: el.scrollWidth, cw: el.clientWidth });
          }
        }
      });
      return {
        scrollWidth: doc.scrollWidth,
        clientWidth: doc.clientWidth,
        innerWidth: window.innerWidth,
        bodyScrollWidth: document.body.scrollWidth,
        overflows: overflows.slice(0, 8),
      };
    });
    const pass = m.scrollWidth <= m.innerWidth;
    results.push([`${name}: scrollWidth=${m.scrollWidth} innerWidth=${m.innerWidth}`, pass]);
    console.log(`[${name}] ${JSON.stringify(m)}`);
    await shot(p, `R2_36_mobile_${name}`);
    await p.close();
  };

  await check('/', 'home');
  // /admin as anonymous → login page redirect? admin requires auth; do logged-in admin check with member cookies? member is denied.
  // Use admin session cookies saved earlier.
  const { execSync } = require('child_process');
  const fs = require('fs');
  const cookies = JSON.parse(fs.readFileSync('/workspace/msw/qa/R2_admin_cookies.json', 'utf8'));
  for (const c of cookies) {
    const v = String(c.sameSite || 'None').toLowerCase();
    try {
      await browser.setCookie({
        name: c.name, value: c.value, domain: c.domain, path: c.path,
        httpOnly: !!c.httpOnly, secure: !!c.secure,
        sameSite: v === 'lax' ? 'Lax' : v === 'strict' ? 'Strict' : 'None',
        expires: c.expires && c.expires > 0 ? c.expires : undefined,
      });
    } catch (e) {}
  }
  const probe = await browser.newPage();
  await probe.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
  await probe.goto(BASE + '/login', { waitUntil: 'domcontentloaded' });
  await wait(600);
  console.log('[admin-mobile] role = ' + (await sessionRole(probe)));
  await probe.close();

  await check('/admin', 'admin');

  console.log('\n===== MOBILE SUMMARY =====');
  for (const [name, ok] of results) console.log((ok ? 'PASS' : 'FAIL') + ' | ' + name);

  await browser.close();
})();
