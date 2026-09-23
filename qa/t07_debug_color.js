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
  await clickText(page, '網站設定', { tag: 'button' });
  await wait(900);
  await clickText(page, '配色樣式', { tag: 'button' });
  await wait(900);

  // which group tab is active?
  const active = await page.evaluate(() => [...document.querySelectorAll('button')].filter(b => /樣式|識別|主視覺/.test(b.innerText)).map(b => ({ t: b.innerText, cls: b.className.slice(0, 70) })));
  console.log('group tabs:', JSON.stringify(active, null, 1));

  // dump inputs with char codes of nearest label
  const dump = await page.evaluate(() => {
    const txt = (el) => (el.innerText || '').trim().replace(/\s+/g, ' ');
    return [...document.querySelectorAll('input, textarea')].filter(el => el.type !== 'hidden' && el.type !== 'file' && (el.getBoundingClientRect().width > 0 || el.getBoundingClientRect().height > 0)).map(el => {
      let node = el, found = '';
      for (let up = 0; up < 4 && node; up++) {
        let sib = node.previousElementSibling;
        while (sib) { const t = txt(sib); if (t) { found = t; break; } sib = sib.previousElementSibling; }
        if (found) break;
        node = node.parentElement;
      }
      return { type: el.type, value: el.value, ph: el.placeholder, found, foundCodes: [...found.slice(0, 6)].map(c => c.codePointAt(0).toString(16)).join(',') };
    });
  });
  console.log(JSON.stringify(dump, null, 1));

  // dump HTML of color group
  const html = await page.evaluate(() => {
    const inp = [...document.querySelectorAll('input[type="color"]')].find(i => i.getBoundingClientRect().width > 0);
    if (!inp) return 'NO COLOR INPUT VISIBLE';
    let node = inp;
    for (let i = 0; i < 6 && node; i++) { if ((node.innerText || '').includes('主色')) break; node = node.parentElement; }
    return node.outerHTML.slice(0, 3000);
  });
  console.log('\ncolor group HTML:\n' + html);

  await browser.close();
})().catch(e => { console.error('FATAL: ' + e.stack); process.exit(1); });
