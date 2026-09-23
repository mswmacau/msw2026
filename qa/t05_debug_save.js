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
  await wait(1000);

  console.log('=== dump settings form HTML (first 6000 chars) ===');
  const html = await page.evaluate(() => {
    // find the container that has the 儲存 button
    const btn = [...document.querySelectorAll('button')].find(b => (b.innerText || '').includes('儲存全部設定'));
    if (!btn) return 'NO SAVE BUTTON';
    let node = btn;
    for (let i = 0; i < 8 && node; i++) {
      if ((node.innerText || '').includes('網站名稱')) break;
      node = node.parentElement;
    }
    return node ? node.outerHTML.slice(0, 6000) : 'NOT FOUND';
  });
  console.log(html);

  console.log('\n=== set 網站名稱 via REAL TYPING ===');
  // click the first input (網站名稱) and select-all + type
  const inputHandle = await page.evaluateHandle(() => {
    const inputs = [...document.querySelectorAll('input')].filter(el => {
      const r = el.getBoundingClientRect();
      return (r.width > 0 || r.height > 0) && el.type === 'text';
    });
    return inputs[0]; // first visible text input = 網站名稱
  });
  const el = inputHandle.asElement();
  console.log('  input value before:', await el.evaluate(e => e.value));
  await el.click({ clickCount: 3 });
  await page.keyboard.down('Control'); await page.keyboard.press('a'); await page.keyboard.up('Control');
  await page.keyboard.press('Backspace');
  await page.type('css selector unused', 'MSW 街健館 QA').catch(() => {});
  // type directly on focused element
  await page.keyboard.type('MSW 街健館 QA', { delay: 20 });
  await wait(400);
  console.log('  input value after typing:', await el.evaluate(e => e.value));

  console.log('\n=== click save, log ALL non-GET requests ===');
  const reqs = [];
  const onReq = (r) => { if (r.method() !== 'GET') reqs.push(r.method() + ' ' + r.url()); };
  const onRes = async (r) => { if (r.request().method() !== 'GET') { let body = ''; try { body = (await r.text()).slice(0, 300); } catch (e) {} reqs.push(`  -> ${r.status()} body: ${body}`); } };
  page.on('request', onReq);
  page.on('response', onRes);
  await clickText(page, '儲存全部設定', { tag: 'button' });
  await wait(2500);
  page.off('request', onReq); page.off('response', onRes);
  console.log('requests during save:', JSON.stringify(reqs, null, 1));

  console.log('\n=== body text right after save (toast?) ===');
  console.log((await page.evaluate(() => document.body.innerText)).split('\n').filter(l => l.trim()).slice(0, 40).join(' | '));
  await page.screenshot({ path: '/workspace/msw/qa-screenshots/dbg_save_toast.png' });

  console.log('\n=== re-navigate to /admin settings, read field (persistence) ===');
  await page.goto(`${BASE}/admin`, { waitUntil: 'networkidle2' });
  await wait(1200);
  await clickText(page, '網站設定', { tag: 'button' });
  await wait(1000);
  const val = await page.evaluate(() => {
    const inputs = [...document.querySelectorAll('input')].filter(el => (el.getBoundingClientRect().width > 0) && el.type === 'text');
    return inputs.map(i => i.value);
  });
  console.log('  text inputs after reload:', JSON.stringify(val));

  console.log('\n=== curl front page HTML: name present? ===');
  const { execSync } = require('child_process');
  const out = execSync(`curl -s ${BASE}/ | grep -o "MSW 街健館 QA" | head -3; echo "exit:$?"`).toString();
  console.log(out);

  await browser.close();
})().catch(e => { console.error('FATAL: ' + e.stack); process.exit(1); });
