const { launch, shot, wait, BASE, clickText } = require('./harness');

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
  await page.evaluate(() => { const b = document.querySelector('form button[type="submit"]'); if (b) b.click(); });
  await wait(2200);
}

(async () => {
  const { browser, page } = await launch();
  await login(page);
  await page.goto(`${BASE}/admin`, { waitUntil: 'networkidle2' });
  await wait(1200);
  await clickText(page, '網站設定');
  await wait(1200);

  for (const group of ['配色樣式', '首頁主視覺', '關於我們', '聯絡資訊', '頁尾']) {
    console.log(`\n########## GROUP: ${group} ##########`);
    await clickText(page, group);
    await wait(800);
    const dump = await page.evaluate(() => {
      const vis = (el) => { const r = el.getBoundingClientRect(); return r.width > 0 || r.height > 0; };
      const out = [];
      document.querySelectorAll('input, textarea, select').forEach((el) => {
        if (!vis(el) || el.type === 'hidden') return;
        // find nearby label: previous siblings text within the same container
        let label = '';
        let node = el.parentElement;
        for (let up = 0; up < 3 && node; up++) {
          let prev = node.previousElementSibling;
          while (prev) {
            const t = (prev.innerText || '').trim().replace(/\s+/g, ' ');
            if (t) { label = t.slice(0, 80); break; }
            prev = prev.previousElementSibling;
          }
          if (label) break;
          node = node.parentElement;
        }
        out.push({ tag: el.tagName.toLowerCase(), type: el.type || (el.tagName === 'SELECT' ? 'select' : ''), value: el.value, checked: el.checked, label, ph: el.placeholder });
      });
      // also list color-related inputs
      const btns = [...document.querySelectorAll('button')].filter(vis).map(b => (b.innerText || '').trim().replace(/\s+/g, ' ')).filter(Boolean);
      return { fields: out, buttons: btns.slice(0, 40) };
    });
    console.log(JSON.stringify(dump, null, 1));
    await shot(page, 'a04_group_' + group.replace(/\s+/g, '_'));
  }

  // read current CSS variables on front page
  const p2 = await browser.newPage();
  await p2.setViewport({ width: 1440, height: 900 });
  await p2.goto(`${BASE}/`, { waitUntil: 'networkidle2' });
  await wait(800);
  const vars = await p2.evaluate(() => {
    const cs = getComputedStyle(document.documentElement);
    const o = {};
    ['--c-cobalt', '--c-cobalt-bright', '--c-cobalt-deep'].forEach(v => { o[v] = cs.getPropertyValue(v).trim(); });
    return o;
  });
  console.log('\nCurrent front-page CSS vars:', JSON.stringify(vars, null, 1));

  await browser.close();
})().catch(e => { console.error('FATAL: ' + e.stack); process.exit(1); });
