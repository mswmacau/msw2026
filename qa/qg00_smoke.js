// T00: smoke - is the site even up, and does /login render with CSS?
const { launch, shot, BASE, wait } = require('./harness');

(async () => {
  const { browser, page, errors } = await launch();
  const results = [];

  const targets = ['/', '/login', '/events', '/about', '/contact', '/register', '/leaderboard', '/admin'];
  for (const t of targets) {
    try {
      const resp = await page.goto(BASE + t, { waitUntil: 'networkidle2', timeout: 30000 });
      await wait(600);
      const info = await page.evaluate(() => ({
        title: document.title,
        bodyLen: document.body.innerText.trim().length,
        bg: getComputedStyle(document.body).backgroundColor,
        sheets: document.styleSheets.length,
        cssRules: (() => { try { let n = 0; for (const s of document.styleSheets) { try { n += s.cssRules.length; } catch (e) {} } return n; } catch (e) { return -1; } })(),
        h1: (document.querySelector('h1') || {}).innerText || null,
      }));
      results.push({ path: t, status: resp.status(), ...info });
    } catch (e) {
      results.push({ path: t, error: e.message });
    }
  }
  console.log(JSON.stringify(results, null, 2));

  await page.goto(BASE + '/', { waitUntil: 'networkidle2' });
  await wait(800);
  await shot(page, 'T00_smoke_home');

  console.log('--- errors ---');
  console.log(errors.slice(0, 40).join('\n') || '(none)');
  await browser.close();
})();
