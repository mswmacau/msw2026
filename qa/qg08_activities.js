// B: activities - list, create, front-end verify, detail page, unpublish, republish, delete
const puppeteer = require('puppeteer-core');
const fs = require('fs');
const { shot, clickText, wait, BASE } = require('./harness');
const CHROME = '/usr/bin/chromium';
const COOKIES = '/workspace/msw/qa/qg_admin_cookies.json';

const T = {
  title: 'QA 驗證活動',
  subtitle: '每週五 20:00',
  schedule: '每週五 20:00 - 21:00',
  location: '澳門 測試公園',
  points: '每次 5 分',
  description: '這是自動化測試建立的活動，測試後會刪除。',
  highlights: ['重點一：測試用', '重點二：測試用'],
};

async function setCookie(browser) {
  for (const c of JSON.parse(fs.readFileSync(COOKIES, 'utf8'))) {
    const norm = (s) => { const v = String(s || 'None').toLowerCase(); return v === 'lax' ? 'Lax' : v === 'strict' ? 'Strict' : 'None'; };
    await browser.setCookie({ name: c.name, value: c.value, domain: c.domain, path: c.path, httpOnly: !!c.httpOnly, secure: !!c.secure, sameSite: norm(c.sameSite) });
  }
}

(async () => {
  const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu'] });
  await setCookie(browser);
  const admin = await browser.newPage();
  await admin.setViewport({ width: 1440, height: 900 });
  admin.on('pageerror', (e) => console.log('ADMIN pageerror: ' + e.message));
  await admin.goto(BASE + '/admin', { waitUntil: 'networkidle2', timeout: 30000 });
  await wait(1800);

  // ---- 8. activities tab + list
  await clickText(admin, '活動管理', { tag: 'button' });
  await wait(1500);
  await shot(admin, 'B01_activity_list');
  const listBefore = await admin.evaluate(async () => (await (await fetch('/api/admin/activities', { credentials: 'include' })).json()));
  console.log('--- activities before ---');
  console.log(JSON.stringify(listBefore.activities.map((a) => ({ id: a.id, slug: a.slug, title: a.title, published: a.published })), null, 2));

  // ---- 9. click 新增活動
  await clickText(admin, '新增活動');
  await wait(1200);
  await shot(admin, 'B02_new_activity_form');

  const formFields = await admin.evaluate(() => [...document.querySelectorAll('input, textarea, select')].filter((e) => e.getBoundingClientRect().width > 0).map((e) => ({ tag: e.tagName.toLowerCase(), type: e.type, placeholder: e.placeholder, required: e.required, label: (() => { const w = e.closest('label'); if (w) return w.innerText.trim().slice(0, 40); if (e.id) { const l = document.querySelector(`label[for="${e.id}"]`); if (l) return l.innerText.trim(); } return null; })() })));
  console.log('--- form fields ---');
  console.log(JSON.stringify(formFields, null, 2));

  // fill by placeholder / label heuristics
  const fill = await admin.evaluate((T) => {
    const vis = [...document.querySelectorAll('input, textarea')].filter((e) => (e.getBoundingClientRect().width > 0 || e.getBoundingClientRect().height > 0) && e.type !== 'hidden');
    const setter = (el, v) => {
      const proto = el.tagName === 'TEXTAREA' ? HTMLTextAreaElement : HTMLInputElement;
      Object.getOwnPropertyDescriptor(proto.prototype, 'value').set.call(el, v);
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
    };
    const byLabel = (kw) => vis.find((e) => {
      const w = e.closest('label'); const txt = w ? w.innerText : '';
      const l = e.id ? document.querySelector(`label[for="${e.id}"]`) : null;
      const lt = l ? l.innerText : '';
      return (txt + ' ' + lt + ' ' + (e.placeholder || '')).includes(kw);
    });
    const report = {};
    const put = (kw, val, key) => { const el = byLabel(kw); if (el) { setter(el, val); report[key] = 'ok'; } else report[key] = 'MISS'; };

    put('名稱', T.title, 'title');
    put('副標', T.subtitle, 'subtitle');
    put('時間', T.schedule, 'schedule');
    put('地點', T.location, 'location');
    put('積分', T.points, 'points');
    put('介紹', T.description, 'description');

    // highlights: textarea(s) that look like a list
    const tas = vis.filter((e) => e.tagName === 'TEXTAREA');
    report.textareas = tas.map((e) => ({ ph: e.placeholder, val: e.value.slice(0, 30) }));

    // checkbox 立即上架
    const cbs = [...document.querySelectorAll('input[type="checkbox"]')].filter((e) => e.getBoundingClientRect().width > 0 || e.getBoundingClientRect().height > 0);
    report.checkboxes = cbs.map((c) => ({ label: (() => { const w = c.closest('label'); if (w) return w.innerText.trim().slice(0, 30); if (c.id) { const l = document.querySelector(`label[for="${c.id}"]`); if (l) return l.innerText.trim(); } return null; })(), checked: c.checked }));
    return report;
  }, T);
  console.log('--- fill report ---');
  console.log(JSON.stringify(fill, null, 2));

  // highlights textarea: put two lines into the textarea that is currently empty and not description
  const hl = await admin.evaluate((T) => {
    const tas = [...document.querySelectorAll('textarea')].filter((e) => e.getBoundingClientRect().width > 0);
    const target = tas.find((e) => e.value === '') || tas[tas.length - 1];
    if (!target) return 'NO_TEXTAREA';
    Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set.call(target, T.highlights.join('\n'));
    target.dispatchEvent(new Event('input', { bubbles: true }));
    target.dispatchEvent(new Event('change', { bubbles: true }));
    return target.value;
  }, T);
  console.log('highlights textarea -> ' + JSON.stringify(hl));

  // ensure 立即上架 checked
  const cbState = await admin.evaluate(() => {
    const cbs = [...document.querySelectorAll('input[type="checkbox"]')].filter((e) => e.getBoundingClientRect().width > 0 || e.getBoundingClientRect().height > 0);
    return cbs.map((c) => ({ checked: c.checked, label: (c.closest('label') || {}).innerText?.trim().slice(0, 30) }));
  });
  console.log('checkboxes state: ' + JSON.stringify(cbState));
  await wait(500);
  await shot(admin, 'B02_activity_filled');

  // ---- save
  let saved = null;
  admin.on('response', async (r) => { if (r.url().includes('/api/admin/activities') && r.request().method() === 'POST') { saved = r.status(); } });
  try { await clickText(admin, '儲存'); } catch (e) { try { await clickText(admin, '上架'); } catch (e2) { console.log('save btn: ' + e2.message); } }
  await wait(3000);
  await shot(admin, 'B03_activity_saved');
  console.log('POST /api/admin/activities status = ' + saved);

  const after = await admin.evaluate(async () => (await (await fetch('/api/admin/activities', { credentials: 'include' })).json()));
  const created = after.activities.find((a) => a.title === T.title);
  console.log('--- created activity ---');
  console.log(JSON.stringify(created ? { id: created.id, slug: created.slug, title: created.title, subtitle: created.subtitle, schedule: created.schedule, location: created.location, points: created.points, published: created.published, highlights: created.highlights } : null, null, 2));
  fs.writeFileSync('/workspace/msw/qa/qg_activity.json', JSON.stringify(created || {}, null, 2));

  if (!created) { console.log('ACTIVITY NOT CREATED - aborting B'); await browser.close(); return; }

  // ---- 10. front /events
  const front = await browser.newPage();
  await front.setViewport({ width: 1440, height: 900 });
  await front.goto(BASE + '/events', { waitUntil: 'networkidle2', timeout: 30000 });
  await wait(1500);
  const ev = await front.evaluate((t) => ({
    hasNew: document.body.innerText.includes(t),
    cards: [...document.querySelectorAll('a[href^="/events/"]')].map((a) => ({ href: a.getAttribute('href'), text: a.innerText.trim().replace(/\s+/g, ' ').slice(0, 60) })),
  }), T.title);
  console.log('--- FRONT /events ---');
  console.log(JSON.stringify(ev, null, 2));
  await shot(front, 'B04_front_events_list');

  // ---- 11. detail page
  console.log('--- detail slug: ' + created.slug);
  const det = await browser.newPage();
  await det.setViewport({ width: 1440, height: 900 });
  const dresp = await det.goto(BASE + '/events/' + created.slug, { waitUntil: 'networkidle2', timeout: 30000 });
  await wait(1200);
  const detInfo = await det.evaluate((T) => ({
    status_h1: (document.querySelector('h1') || {}).innerText || null,
    hasTitle: document.body.innerText.includes(T.title),
    hasLocation: document.body.innerText.includes(T.location),
    hasPoints: document.body.innerText.includes(T.points),
    hasSchedule: document.body.innerText.includes(T.schedule),
    body: document.body.innerText.trim().slice(0, 500),
  }), T);
  console.log('--- DETAIL page status=' + dresp.status() + ' ---');
  console.log(JSON.stringify(detInfo, null, 2));
  await shot(det, 'B05_front_activity_detail');

  await browser.close();
})();
