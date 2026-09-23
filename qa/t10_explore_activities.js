const { launch, shot, wait, BASE, clickText, clickables } = require('./harness');

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
  await clickText(page, '活動管理', { tag: 'button' });
  await wait(1200);
  await shot(page, 'b01_activity_list');
  console.log('=== 活動管理 body text ===');
  console.log((await page.evaluate(() => document.body.innerText)).slice(0, 2500));

  console.log('\n=== buttons in activity area ===');
  const btns = await page.evaluate(() => {
    const vis = (el) => { const r = el.getBoundingClientRect(); return r.width > 0 || r.height > 0; };
    return [...document.querySelectorAll('button, a')].filter(vis).map(b => ({ tag: b.tagName.toLowerCase(), text: (b.innerText || '').trim().replace(/\s+/g, ' ').slice(0, 50), href: b.getAttribute('href') })).filter(x => x.text);
  });
  console.log(JSON.stringify(btns, null, 1));

  console.log('\n=== click ＋ 新增活動 ===');
  await clickText(page, '新增活動', { tag: 'button' });
  await wait(1000);
  await shot(page, 'b02_new_activity_form');

  const formDump = await page.evaluate(() => {
    const vis = (el) => { const r = el.getBoundingClientRect(); return r.width > 0 || r.height > 0; };
    const fields = [...document.querySelectorAll('input, textarea, select')].filter(el => el.type !== 'hidden' && el.type !== 'file' && vis(el)).map(el => {
      let node = el, found = '';
      const txt = (x) => (x.innerText || '').trim().replace(/\s+/g, ' ');
      for (let up = 0; up < 4 && node; up++) {
        let sib = node.previousElementSibling;
        while (sib) { const t = txt(sib); if (t) { found = t; break; } sib = sib.previousElementSibling; }
        if (found) break;
        node = node.parentElement;
      }
      return { tag: el.tagName.toLowerCase(), type: el.type, value: el.value, checked: el.checked, label: found, ph: el.placeholder };
    });
    const btns2 = [...document.querySelectorAll('button')].filter(vis).map(b => (b.innerText || '').trim().replace(/\s+/g, ' ')).filter(Boolean);
    return { fields, btns: btns2.slice(0, 30) };
  });
  console.log(JSON.stringify(formDump, null, 1));

  await browser.close();
})().catch(e => { console.error('FATAL: ' + e.stack); process.exit(1); });
