const { launch, wait, BASE, clickText } = require('./harness');

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
  const errors = [];
  page.on('pageerror', e => errors.push('PAGEERROR: ' + e.message + '\n' + (e.stack || '').split('\n').slice(0, 5).join('\n')));
  page.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') errors.push('CONSOLE ' + m.type() + ': ' + m.text().slice(0, 400)); });

  await login(page);
  await page.goto(`${BASE}/admin`, { waitUntil: 'networkidle2' });
  await wait(1200);
  await clickText(page, '網站設定', { tag: 'button' });
  await wait(1000);
  errors.length = 0; // reset, ignore earlier noise

  // change the field via real typing
  const el = await page.evaluateHandle(() => {
    const inputs = [...document.querySelectorAll('input')].filter(i => i.type === 'text' && i.getBoundingClientRect().width > 0);
    return inputs[0];
  }).then(h => h.asElement());
  await el.click({ clickCount: 3 });
  await page.keyboard.press('Backspace');
  await page.keyboard.type('MSW 街健館 QA', { delay: 15 });
  await wait(300);
  console.log('field now:', await el.evaluate(e => e.value));

  const btnInfo = await page.evaluate(() => {
    const btn = [...document.querySelectorAll('button')].find(b => (b.innerText || '').includes('儲存全部設定'));
    if (!btn) return null;
    const r = btn.getBoundingClientRect();
    const cs = getComputedStyle(btn);
    const topEl = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
    return {
      disabled: btn.disabled,
      rect: { x: r.x, y: r.y, w: r.width, h: r.height },
      pointerEvents: cs.pointerEvents,
      opacity: cs.opacity,
      coveredBy: topEl ? (topEl.tagName + '.' + String(topEl.className).slice(0, 50)) : null,
      isSelf: topEl === btn || btn.contains(topEl),
      inForm: !!btn.closest('form'),
      formAction: btn.closest('form')?.getAttribute('action'),
      type: btn.type,
      reactProps: Object.keys(btn).filter(k => k.startsWith('__react')).map(k => k.slice(0, 30)),
    };
  });
  console.log('save button info:', JSON.stringify(btnInfo, null, 1));

  // Try clicking via puppeteer (trusted event)
  console.log('\n--- click via puppeteer .click() ---');
  const reqs = [];
  const onReq = r => { if (r.method() !== 'GET') reqs.push(r.method() + ' ' + r.url()); };
  page.on('request', onReq);
  const btn = await page.evaluateHandle(() => [...document.querySelectorAll('button')].find(b => (b.innerText || '').includes('儲存全部設定'))).then(h => h.asElement());
  await btn.click();
  await wait(2500);
  console.log('requests:', JSON.stringify(reqs));
  console.log('errors so far:', errors.length ? errors.join('\n---\n') : '(none)');
  console.log('toast check:', await page.evaluate(() => {
    const t = document.body.innerText;
    return [...t.matchAll(/(已儲[^\n]*|儲存成功[^\n]*|成功[^\n]*|失敗[^\n]*|錯誤[^\n]*)/g)].map(m => m[1].slice(0, 60));
  }));

  // try DOM click
  console.log('\n--- click via el.click() in page ---');
  reqs.length = 0;
  await page.evaluate(() => {
    const btn = [...document.querySelectorAll('button')].find(b => (b.innerText || '').includes('儲存全部設定'));
    btn.click();
  });
  await wait(2500);
  console.log('requests:', JSON.stringify(reqs));
  console.log('errors:', errors.length ? errors.join('\n---\n') : '(none)');

  // check React fiber for onClick handler
  console.log('\n--- react fiber inspection ---');
  console.log(await page.evaluate(() => {
    const btn = [...document.querySelectorAll('button')].find(b => (b.innerText || '').includes('儲存全部設定'));
    const key = Object.keys(btn).find(k => k.startsWith('__reactFiber$') || k.startsWith('__reactProps$'));
    if (!key) return 'no react key';
    const propsKey = Object.keys(btn).find(k => k.startsWith('__reactProps$'));
    const fiberKey = Object.keys(btn).find(k => k.startsWith('__reactFiber$'));
    const out = {};
    if (propsKey) out.propKeys = Object.keys(btn[propsKey]);
    if (fiberKey) {
      let f = btn[fiberKey];
      const chain = [];
      for (let i = 0; i < 12 && f; i++) { chain.push((f.tag || '') + ':' + (f.type && (f.type.name || f.type)) ); f = f.return; }
      out.fiberChain = chain;
    }
    return JSON.stringify(out);
  }));

  await browser.close();
})().catch(e => { console.error('FATAL: ' + e.stack); process.exit(1); });
