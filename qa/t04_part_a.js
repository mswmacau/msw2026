const { launch, shot, wait, BASE, clickText } = require('./harness');
const TEXT_SEL = 'input:not([type="color"]):not([type="checkbox"]):not([type="radio"]):not([type="hidden"])';

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
  console.log('login ->', page.url());
}

async function openSettings(page, group = null) {
  await page.goto(`${BASE}/admin`, { waitUntil: 'networkidle2' });
  await wait(1200);
  await clickText(page, '網站設定', { tag: 'button' });
  await wait(900);
  if (group) { await clickText(page, group, { tag: 'button' }); await wait(700); }
}

async function setField(page, label, value, sel = 'input, textarea') {
  const ok = await page.evaluate((label, value, sel) => {
    const txt = (el) => (el.innerText || '').trim().replace(/\s+/g, ' ');
    const inputs = [...document.querySelectorAll(sel)].filter((el) => {
      if (el.type === 'hidden' || el.type === 'file') return false;
      const r = el.getBoundingClientRect();
      return r.width > 0 || r.height > 0;
    });
    for (const el of inputs) {
      let node = el, found = '';
      for (let up = 0; up < 4 && node; up++) {
        let sib = node.previousElementSibling;
        while (sib) {
          const t = txt(sib);
          if (t) { found = t; break; }
          sib = sib.previousElementSibling;
        }
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
  console.log(`  setField "${label}" = "${value}"`);
}

async function getField(page, label, sel = 'input, textarea') {
  return page.evaluate((label, sel) => {
    const txt = (el) => (el.innerText || '').trim().replace(/\s+/g, ' ');
    const inputs = [...document.querySelectorAll(sel)].filter((el) => {
      if (el.type === 'hidden' || el.type === 'file') return false;
      const r = el.getBoundingClientRect();
      return r.width > 0 || r.height > 0;
    });
    for (const el of inputs) {
      let node = el, found = '';
      for (let up = 0; up < 4 && node; up++) {
        let sib = node.previousElementSibling;
        while (sib) {
          const t = txt(sib);
          if (t) { found = t; break; }
          sib = sib.previousElementSibling;
        }
        if (found) break;
        node = node.parentElement;
      }
      if (found === label || (found && found.startsWith(label))) return el.value;
    }
    return null;
  }, label, sel);
}

// click save; capture PUT request+response; capture toast text
async function saveAll(page, shotName) {
  const events = [];
  const onReq = (r) => { if (r.method() !== 'GET') events.push({ type: 'req', s: `${r.method()} ${r.url()}` }); };
  const onRes = async (r) => {
    if (r.request().method() !== 'GET') {
      let body = ''; try { body = (await r.text()).slice(0, 200); } catch (e) {}
      events.push({ type: 'res', s: `${r.status()} ${r.request().method()} ${r.url()} body=${body}` });
    }
  };
  page.on('request', onReq);
  page.on('response', onRes);
  await clickText(page, '儲存全部設定', { tag: 'button' });
  // wait for toast
  let toast = null;
  try {
    await page.waitForFunction(() => /已儲存|成功|失敗|錯誤/.test(document.body.innerText), { timeout: 6000 });
    toast = await page.evaluate(() => document.body.innerText.split('\n').map(s => s.trim()).filter(l => /已儲存|成功|失敗|錯誤/.test(l)).slice(0, 3));
  } catch (e) { toast = ['(no toast within 6s)']; }
  await wait(500);
  page.off('request', onReq);
  page.off('response', onRes);
  console.log('  save network:', JSON.stringify(events, null, 1));
  console.log('  toast:', JSON.stringify(toast));
  await page.screenshot({ path: `/workspace/msw/qa-screenshots/${shotName}.png` });
  console.log(`  [shot] ${shotName}.png`);
  return { events, toast };
}

(async () => {
  const { browser, page } = await launch();
  await login(page);

  console.log('\n===== A3. Change site name to "MSW 街健館 QA" =====');
  await openSettings(page, '品牌識別');
  console.log('  current 網站名稱 =', JSON.stringify(await getField(page, '網站名稱')));
  await setField(page, '網站名稱', 'MSW 街健館 QA');
  await wait(300);
  await shot(page, 'a05_name_input_changed', false);
  await saveAll(page, 'a06_name_save_toast');

  console.log('\n===== A4. KEY VERIFY: fresh tab -> / shows new name =====');
  const p2 = await browser.newPage();
  await p2.setCacheEnabled(false);
  await p2.setViewport({ width: 1440, height: 900 });
  const resp = await p2.goto(`${BASE}/`, { waitUntil: 'networkidle2', timeout: 60000 });
  console.log('  front / status:', resp.status());
  await wait(1200);
  const nameCheck = await p2.evaluate(() => {
    const t = (sel) => { const e = document.querySelector(sel); return e ? e.innerText.replace(/\s+/g, ' ') : null; };
    return {
      title: document.title,
      bodyHasNew: document.body.innerText.includes('MSW 街健館 QA'),
      headerText: t('header'),
      footerText: t('footer') ? t('footer').slice(0, 160) : null,
    };
  });
  console.log('  name check:', JSON.stringify(nameCheck, null, 1));
  await p2.screenshot({ path: '/workspace/msw/qa-screenshots/a07_front_name_changed.png' });
  console.log('  [shot] a07_front_name_changed.png (viewport, top)');
  // raw HTML evidence (server-rendered?)
  const { execSync } = require('child_process');
  const raw = execSync(`curl -s ${BASE}/`).toString();
  console.log('  raw HTML contains new name:', raw.includes('MSW 街健館 QA'), '| contains old only:', raw.includes('MSW 街健館') && !raw.includes('MSW 街健館 QA'));
  console.log('  raw <title>:', (raw.match(/<title>([^<]*)<\/title>/) || [])[1]);

  console.log('\n===== A5. Change primary color to #00C2FF =====');
  await page.bringToFront();
  await openSettings(page, '配色樣式');
  console.log('  current 主色(藍) =', JSON.stringify(await getField(page, '主色（藍）', TEXT_SEL)));
  await setField(page, '主色（藍）', '#00C2FF', TEXT_SEL);
  await wait(300);
  await shot(page, 'a08_color_input_changed', false);
  await saveAll(page, 'a09_color_save_toast');

  await p2.setCacheEnabled(false);
  await p2.reload({ waitUntil: 'networkidle2' });
  await wait(1200);
  const colorCheck = await p2.evaluate(() => {
    const cs = getComputedStyle(document.documentElement);
    const vars = {};
    ['--c-cobalt', '--c-cobalt-bright', '--c-cobalt-deep'].forEach(v => { const val = cs.getPropertyValue(v).trim(); if (val) vars[v] = val; });
    // hero CTA button actual color
    const btn = [...document.querySelectorAll('a, button')].find(b => /立即加入會員|查看近期活動/.test(b.innerText || ''));
    let btnStyle = null;
    if (btn) { const s = getComputedStyle(btn); btnStyle = { text: btn.innerText.trim(), bg: s.backgroundColor, bgImg: s.backgroundImage.slice(0, 140) }; }
    return { vars, btnStyle };
  });
  console.log('  color check:', JSON.stringify(colorCheck, null, 1));
  await p2.screenshot({ path: '/workspace/msw/qa-screenshots/a10_front_color_changed.png' });
  console.log('  [shot] a10_front_color_changed.png');

  console.log('\n===== A6. Change hero title line2 =====');
  await page.bringToFront();
  await openSettings(page, '首頁主視覺');
  console.log('  current 主標題(第二行) =', JSON.stringify(await getField(page, '主標題（第二行，藍色漸層）')));
  await setField(page, '主標題（第二行，藍色漸層）', 'QA 主視覺驗證');
  await wait(300);
  await saveAll(page, 'a11_hero_save_toast');

  await p2.setCacheEnabled(false);
  await p2.reload({ waitUntil: 'networkidle2' });
  await wait(1200);
  const heroCheck = await p2.evaluate(() => {
    const h1 = document.querySelector('h1');
    return { h1: h1 ? h1.innerText.replace(/\s+/g, ' | ').slice(0, 100) : null, bodyHasNew: document.body.innerText.includes('QA 主視覺驗證') };
  });
  console.log('  hero check:', JSON.stringify(heroCheck, null, 1));
  await p2.screenshot({ path: '/workspace/msw/qa-screenshots/a12_front_hero_changed.png' });
  console.log('  [shot] a12_front_hero_changed.png');

  console.log('\n===== A7. RESTORE settings =====');
  await page.bringToFront();
  await openSettings(page, '品牌識別');
  await setField(page, '網站名稱', 'MSW 街健館');
  await saveAll(page, 'a13_restore_name');

  await openSettings(page, '配色樣式');
  console.log('  before restore 主色 =', JSON.stringify(await getField(page, '主色（藍）', TEXT_SEL)));
  await setField(page, '主色（藍）', '#0057FF', TEXT_SEL);
  await saveAll(page, 'a13_restore_color');

  await openSettings(page, '首頁主視覺');
  await setField(page, '主標題（第二行，藍色漸層）', '走得比一個人更遠');
  await saveAll(page, 'a13_restore_hero');

  await p2.setCacheEnabled(false);
  await p2.reload({ waitUntil: 'networkidle2' });
  await wait(1200);
  const restored = await p2.evaluate(() => ({
    nameQA_gone: !document.body.innerText.includes('MSW 街健館 QA'),
    name_ok: document.body.innerText.includes('MSW 街健館'),
    hero_ok: document.body.innerText.includes('走得比一個人更遠'),
    cobalt_bright: getComputedStyle(document.documentElement).getPropertyValue('--c-cobalt-bright').trim(),
  }));
  console.log('  restored check:', JSON.stringify(restored, null, 1));
  await p2.screenshot({ path: '/workspace/msw/qa-screenshots/a14_front_restored.png' });

  const cookies = await page.cookies();
  require('fs').writeFileSync('/workspace/msw/qa/admin_cookies.json', JSON.stringify(cookies, null, 1));
  console.log('admin cookies saved');

  await browser.close();
})().catch(e => { console.error('FATAL: ' + e.stack); process.exit(1); });
