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

async function openAdminTab(page, tab) {
  await page.goto(`${BASE}/admin`, { waitUntil: 'networkidle2' });
  await wait(1200);
  await clickText(page, tab, { tag: 'button' });
  await wait(1000);
}

async function setField(page, label, value, sel = 'input, textarea') {
  const ok = await page.evaluate((label, value, sel) => {
    const txt = (el) => (el.innerText || '').trim().replace(/\s+/g, ' ');
    const inputs = [...document.querySelectorAll(sel)].filter((el) => {
      if (['hidden', 'file', 'color', 'checkbox', 'radio'].includes(el.type)) return false;
      const r = el.getBoundingClientRect();
      return r.width > 0 || r.height > 0;
    });
    for (const el of inputs) {
      let node = el, found = '';
      for (let up = 0; up < 4 && node; up++) {
        let sib = node.previousElementSibling;
        while (sib) { const t = txt(sib); if (t) { found = t; break; } sib = sib.previousElementSibling; }
        if (found) break;
        node = node.parentElement;
      }
      if (found === label || (found && found.startsWith(label))) {
        const proto = el.tagName === 'TEXTAREA' ? HTMLTextAreaElement : HTMLInputElement;
        Object.getOwnPropertyDescriptor(proto.prototype, 'value').set.call(el, value);
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
        el.blur();
        return true;
      }
    }
    return false;
  }, label, value, sel);
  if (!ok) throw new Error(`setField: label "${label}" not found`);
  console.log(`  set "${label}" = ${JSON.stringify(value).slice(0, 60)}`);
}

async function watchApi(page, fn) {
  const store = [];
  const onRes = async (r) => {
    if (r.request().method() !== 'GET') {
      let body = ''; try { body = (await r.text()).slice(0, 260); } catch (e) {}
      store.push(`${r.status()} ${r.request().method()} ${r.url()} ${body}`);
    }
  };
  page.on('response', onRes);
  await fn();
  await wait(1800);
  page.off('response', onRes);
  return store;
}

// click a button with exact text inside the table row containing "QA 驗證活動"
async function clickInQaRow(page, btnText) {
  const ok = await page.evaluate((btnText) => {
    const cands = [...document.querySelectorAll('tr, [class*="row"], li')].filter(d =>
      d.innerText && d.innerText.includes('QA 驗證活動') && d.innerText.length < 500);
    for (const row of cands) {
      const btn = [...row.querySelectorAll('button')].find(b => (b.innerText || '').trim() === btnText);
      if (btn) { btn.scrollIntoView({ block: 'center', behavior: 'instant' }); setTimeout(() => btn.click(), 80); return true; }
    }
    return false;
  }, btnText);
  if (!ok) throw new Error(`clickInQaRow: button "${btnText}" not found in QA row`);
  console.log(`  clicked row button "${btnText}"`);
}

(async () => {
  const { browser, page } = await launch();
  page.on('dialog', d => { console.log('  [dialog]', d.type(), d.message()); d.accept(); });
  const p2 = await browser.newPage();
  await p2.setCacheEnabled(false);
  await p2.setViewport({ width: 1440, height: 900 });

  await login(page);
  await openAdminTab(page, '活動管理');
  const exists = await page.evaluate(() => document.body.innerText.includes('QA 驗證活動'));

  if (!exists) {
    console.log('\n===== B9. Create activity =====');
    await clickText(page, '新增活動', { tag: 'button' });
    await wait(900);
    await setField(page, '活動名稱', 'QA 驗證活動');
    await setField(page, '副標題', '每週五 20:00');
    await setField(page, '時間', '每週五 20:00 – 21:00');
    await setField(page, '地點', '澳門 · 測試公園');
    await setField(page, '積分說明', '每次 5 分');
    await setField(page, '活動介紹', 'QA 自動化測試建立的活動介紹，驗證後會刪除。');
    await setField(page, '活動重點', 'QA 重點一：準時簽到\nQA 重點二：自帶飲用水');
    await wait(300);
    await shot(page, 'b03_new_activity_filled');
    const api = await watchApi(page, async () => {
      await page.evaluate(() => {
        const vis = (el) => { const r = el.getBoundingClientRect(); return r.width > 0 || r.height > 0; };
        const btns = [...document.querySelectorAll('button')].filter(vis).filter(b => (b.innerText || '').trim() === '儲存活動');
        btns[btns.length - 1].click();
      });
    });
    console.log('  save API:', JSON.stringify(api, null, 1));
    const toast = await page.evaluate(() => document.body.innerText.split('\n').map(s => s.trim()).filter(l => /成功|已新|已建|已儲|失敗|錯誤|已上架/.test(l)).slice(0, 4));
    console.log('  toast:', JSON.stringify(toast));
    await shot(page, 'b04_activity_created_toast');
  } else {
    console.log('\n===== B9. Activity already exists (from earlier run) — skip creation =====');
  }

  console.log('\n===== B10. Front /events shows QA 驗證活動 =====');
  await p2.goto(`${BASE}/events`, { waitUntil: 'networkidle2' });
  await wait(1200);
  const evCheck = await p2.evaluate(() => {
    const links = [...document.querySelectorAll('a[href^="/events/"]')].map(a => ({ href: a.getAttribute('href'), text: (a.innerText || '').replace(/\s+/g, ' ').slice(0, 60) }));
    return { hasQA: document.body.innerText.includes('QA 驗證活動'), qaLinks: links.filter(l => /qa/i.test(l.href)), allLinks: links.map(l => l.href) };
  });
  console.log(JSON.stringify(evCheck, null, 1));
  await shot(p2, 'b05_front_events_list');

  console.log('\n===== B11. Detail page =====');
  const qaLink = (evCheck.qaLinks && evCheck.qaLinks[0]) || evCheck.allLinks.map(h => ({ href: h })).find(l => /qa/i.test(l.href));
  if (qaLink) {
    await p2.goto(`${BASE}${qaLink.href}`, { waitUntil: 'networkidle2' });
    await wait(1200);
    const detail = await p2.evaluate(() => ({
      url: location.pathname,
      h1: document.querySelector('h1')?.innerText,
      checks: {
        loc: document.body.innerText.includes('澳門 · 測試公園'),
        pts: document.body.innerText.includes('每次 5 分'),
        time: document.body.innerText.includes('每週五 20:00 – 21:00'),
        sub: document.body.innerText.includes('每週五 20:00'),
        focus1: document.body.innerText.includes('QA 重點一'),
      },
    }));
    console.log('detail:', JSON.stringify(detail, null, 1));
    await shot(p2, 'b06_front_activity_detail');
  } else {
    console.log('  !! no qa link found');
  }

  console.log('\n===== B12. 下架 → front gone =====');
  await page.bringToFront();
  await openAdminTab(page, '活動管理');
  const api1 = await watchApi(page, async () => { await clickInQaRow(page, '下架'); });
  console.log('  unpublish API:', JSON.stringify(api1, null, 1));
  await shot(page, 'b07_activity_unpublished');
  const rowTxt = await page.evaluate(() => {
    const row = [...document.querySelectorAll('tr, li, div')].find(d => d.innerText && d.innerText.includes('QA 驗證活動') && d.innerText.length < 400);
    return row ? row.innerText.replace(/\s+/g, ' ').slice(0, 200) : '(row not found)';
  });
  console.log('  admin row:', JSON.stringify(rowTxt));

  await p2.bringToFront();
  await p2.goto(`${BASE}/events`, { waitUntil: 'networkidle2' });
  await wait(1200);
  console.log('  front after unpublish hasQA:', await p2.evaluate(() => document.body.innerText.includes('QA 驗證活動')));
  await shot(p2, 'b08_front_events_after_unpublish');

  console.log('\n===== B13. 上架 → front back → 刪除 =====');
  await page.bringToFront();
  await openAdminTab(page, '活動管理');
  const api2 = await watchApi(page, async () => { await clickInQaRow(page, '上架'); });
  console.log('  republish API:', JSON.stringify(api2, null, 1));
  await shot(page, 'b09_activity_republished');

  await p2.setCacheEnabled(false);
  await p2.goto(`${BASE}/events`, { waitUntil: 'networkidle2' });
  await wait(1000);
  console.log('  front after republish hasQA:', await p2.evaluate(() => document.body.innerText.includes('QA 驗證活動')));

  await page.bringToFront();
  await openAdminTab(page, '活動管理');
  const api3 = await watchApi(page, async () => { await clickInQaRow(page, '刪除'); });
  console.log('  delete API:', JSON.stringify(api3, null, 1));
  await shot(page, 'b10_activity_deleted');
  console.log('  admin contains after delete:', await page.evaluate(() => document.body.innerText.includes('QA 驗證活動')));

  await p2.setCacheEnabled(false);
  await p2.goto(`${BASE}/events`, { waitUntil: 'networkidle2' });
  await wait(1000);
  console.log('  front contains after delete:', await p2.evaluate(() => document.body.innerText.includes('QA 驗證活動')));
  await shot(p2, 'b11_front_events_after_delete');

  await browser.close();
})().catch(e => { console.error('FATAL: ' + e.stack); process.exit(1); });
