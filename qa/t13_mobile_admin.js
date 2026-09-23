const { launch, shot, wait, BASE } = require('./harness');

(async () => {
  const m = await launch(true);
  const mp = m.page;
  console.log('===== D17b. Mobile /admin (ming session not needed; page is public URL, denied view) =====');
  await mp.goto(`${BASE}/admin`, { waitUntil: 'networkidle2' });
  await wait(1500);
  const ov = await mp.evaluate(() => ({
    scrollW: document.documentElement.scrollWidth,
    innerW: window.innerWidth,
    overflow: document.documentElement.scrollWidth > window.innerWidth,
    text: document.body.innerText.replace(/\s+/g, ' ').slice(0, 120),
  }));
  console.log('/admin @390px:', JSON.stringify(ov, null, 1));
  await shot(mp, 'd17_mobile_admin', false);
  await m.browser.close();
})().catch(e => { console.error('FATAL: ' + e.stack); process.exit(1); });
