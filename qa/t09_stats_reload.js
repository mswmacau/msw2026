const { launch, wait, BASE } = require('./harness');

(async () => {
  const { browser, page } = await launch();
  await page.setViewport({ width: 1440, height: 900 });
  for (let i = 1; i <= 4; i++) {
    await page.goto(`${BASE}/`, { waitUntil: 'networkidle2' });
    await wait(1200);
    const t = await page.evaluate(() => {
      const m = document.body.innerText.match(/(\d+)\s*人[\s\S]{0,40}?(\d+)\s*KM[\s\S]{0,40}?(\d+)\s*人[\s\S]{0,40}?(\d+)\s*張/);
      return m ? m.slice(1, 5).join(' / ') : '(nf)';
    });
    console.log(`goto#${i} stats after 1200ms:`, t);
    await page.screenshot({ path: `/workspace/msw/qa-screenshots/dbg_stats_run${i}.png` });
  }
  console.log('--- now reload() variant ---');
  await page.goto(`${BASE}/`, { waitUntil: 'networkidle2' });
  await wait(1000);
  for (let i = 1; i <= 3; i++) {
    await page.reload({ waitUntil: 'networkidle2' });
    await wait(1200);
    const t = await page.evaluate(() => {
      const m = document.body.innerText.match(/(\d+)\s*人[\s\S]{0,40}?(\d+)\s*KM[\s\S]{0,40}?(\d+)\s*人[\s\S]{0,40}?(\d+)\s*張/);
      return m ? m.slice(1, 5).join(' / ') : '(nf)';
    });
    console.log(`reload#${i} stats after 1200ms:`, t);
    await page.screenshot({ path: `/workspace/msw/qa-screenshots/dbg_stats_reload${i}.png` });
  }
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
