const { launch, wait, BASE } = require('./harness');

(async () => {
  const { browser, page } = await launch();
  await page.goto(`${BASE}/`, { waitUntil: 'networkidle2' });
  // sample the stats text at intervals to see if it's a count-up animation
  for (const ms of [300, 800, 1500, 2500, 4000]) {
    await wait(ms === 300 ? 300 : ms - [300, 800, 1500, 2500, 4000][[300, 800, 1500, 2500, 4000].indexOf(ms) - 1]);
    const t = await page.evaluate(() => {
      const el = [...document.querySelectorAll('section, div')].find(d => /本月展開跑目標|積分回饋|下城定期訓練|每週一/.test(d.innerText || '') && d.children.length < 30);
      const body = document.body.innerText;
      const m = body.match(/(\d+)\s*人[\s\S]{0,40}?(\d+)\s*KM[\s\S]{0,40}?(\d+)\s*人[\s\S]{0,40}?(\d+)\s*張/);
      return m ? m.slice(1, 5).join(' / ') : '(pattern not found)';
    });
    console.log(`t≈${ms}ms stats:`, t);
  }
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
