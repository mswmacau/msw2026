// B (final): create activity, verify front, unpublish, republish, delete
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
    const n = (s) => { const v = String(s || 'None').toLowerCase(); return v === 'lax' ? 'Lax' : v === 'strict' ? 'Strict' : 'None'; };
    await browser.setCookie({ name: c.name, value: c.value, domain: c.domain, path: c.path, httpOnly: !!c.httpOnly, secure: !!c.secure, sameSite: n(c.sameSite) });
  }
}

async function fillModal(page, T) {
  return page.evaluate((T) => {
    const modal = [...document.querySelectorAll('div')].find((d) => d.innerText && d.innerText.includes('活動名稱') && d.querySelectorAll('input,textarea').length > 4);
    if (!modal) return { error: 'NO_MODAL' };
    const setter = (el, v) => { const proto = el.tagName === 'TEXTAREA' ? HTMLTextAreaElement : HTMLInputElement; Object.getOwnPropertyDescriptor(proto.prototype, 'value').set.call(el, v); el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true })); };
    const controls = [...modal.querySelectorAll('input, textarea')].filter((e) => e.type !== 'checkbox' && e.type !== 'hidden');
    const labelFor = (el) => { let node = el, hops = 0; while (node && hops < 4) { const prev = node.previousElementSibling; if (prev && /活動名稱|副標題|時間|地點|積分說明|活動介紹/.test(prev.innerText || '')) { const m = (prev.innerText || '').match(/活動名稱|副標題|時間|地點|積分說明|活動介紹/); return m ? m[0] : null; } node = node.parentElement; hops += 1; } return null; };
    const want = { '活動名稱': T.title, '副標題': T.subtitle, '時間': T.schedule, '地點': T.location, '積分說明': T.points, '活動介紹': T.description };
    const report = {};
    for (const el of controls) { const lf = labelFor(el); if (lf && want[lf] !== undefined) { setter(el, want[lf]); report[lf] = 'ok'; } }
    const hl = controls.find((e) => /新手友善/.test(e.placeholder || ''));
    if (hl) { setter(hl, T.highlights.join('\n')); report.highlights = 'ok'; }
    const cb = [...modal.querySelectorAll('input[type="checkbox"]')].find((c) => (c.closest('label') || {}).innerText?.includes('立即上架'));
    if (cb) { if (!cb.checked) cb.click(); report.published = cb.checked; }
    return report;
  }, T);
}

// click a button by exact text inside the modal, scrolling it into view first
async function clickModalBtn(page, text) {
  const r = await page.evaluate((text) => {
    const modal = [...document.querySelectorAll('div')].find((d) => d.innerText && d.innerText.includes('活動名稱') && d.querySelectorAll('input,textarea').length > 4);
    if (!modal) return 'NO_MODAL';
    const btn = [...modal.querySelectorAll('button')].find((b) => b.innerText.trim() === text);
    if (!btn) return 'NO_BTN';
    btn.scrollIntoView({ block: 'center' });
    return 'found';
  }, text);
  if (r !== 'found') return r;
  await wait(300);
  await page.evaluate((text) => {
    const modal = [...document.querySelectorAll('div')].find((d) => d.innerText && d.innerText.includes('活動名稱') && d.querySelectorAll('input,textarea').length > 4);
    const btn = [...modal.querySelectorAll('button')].find((b) => b.innerText.trim() === text);
    btn.click();
  }, text);
  return 'clicked';
}

(async () => {
  const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu'] });
  await setCookie(browser);
  const admin = await browser.newPage();
  await admin.setViewport({ width: 1440, height: 900 });
  await admin.goto(BASE + '/admin', { waitUntil: 'networkidle2', timeout: 30000 });
  await wait(1600);

  await clickText(admin, '活動管理', { tag: 'button' });
  await wait(1400);
  await shot(admin, 'B01_activity_list');

  // clean any leftovers from earlier runs
  let pre = await admin.evaluate(async () => (await (await fetch('/api/admin/activities', { credentials: 'include' })).json()));
  for (const a of pre.activities.filter((a) => a.title === T.title)) {
    await admin.evaluate(async (id) => fetch(`/api/admin/activities?id=${id}`, { method: 'DELETE', credentials: 'include' }), a.id);
    console.log('cleaned leftover id=' + a.id);
  }

  // ---- create
  await clickText(admin, '新增活動');
  await wait(1200);
  await shot(admin, 'B02_new_activity_form');
  const rep = await fillModal(admin, T);
  console.log('fill: ' + JSON.stringify(rep));
  await wait(400);
  await shot(admin, 'B03_activity_filled');

  let postStatus = null;
  admin.on('response', (r) => { if (r.url().includes('/api/admin/activities') && r.request().method() === 'POST') postStatus = r.status(); });
  const c = await clickModalBtn(admin, '儲存活動');
  console.log('click 儲存活動 -> ' + c);
  await wait(3000);
  await shot(admin, 'B04_activity_saved');
  console.log('POST status = ' + postStatus);

  const after = await admin.evaluate(async () => (await (await fetch('/api/admin/activities', { credentials: 'include' })).json()));
  const created = after.activities.find((a) => a.title === T.title);
  console.log('--- created ---');
  console.log(JSON.stringify(created ? { id: created.id, slug: created.slug, title: created.title, subtitle: created.subtitle, schedule: created.schedule, location: created.location, points: created.points, published: created.published, highlights: created.highlights } : null, null, 2));
  fs.writeFileSync('/workspace/msw/qa/qg_activity.json', JSON.stringify(created || {}, null, 2));
  if (!created) { console.log('ABORT: not created'); await browser.close(); return; }

  // ---- 10. front list
  const front = await browser.newPage();
  await front.setViewport({ width: 1440, height: 900 });
  await front.goto(BASE + '/events', { waitUntil: 'networkidle2', timeout: 30000 });
  await wait(1500);
  const ev = await front.evaluate((t) => ({ hasNew: document.body.innerText.includes(t), links: [...document.querySelectorAll('a[href^="/events/"]')].map((a) => a.getAttribute('href')) }), T.title);
  console.log('--- FRONT /events (published) ---');
  console.log(JSON.stringify(ev, null, 2));
  await shot(front, 'B05_front_events_list');

  // ---- 11. detail
  const det = await browser.newPage();
  await det.setViewport({ width: 1440, height: 900 });
  const dr = await det.goto(BASE + '/events/' + created.slug, { waitUntil: 'networkidle2', timeout: 30000 });
  await wait(1200);
  const di = await det.evaluate((T) => ({
    h1: (document.querySelector('h1') || {}).innerText || null,
    hasTitle: document.body.innerText.includes(T.title),
    hasLocation: document.body.innerText.includes(T.location),
    hasPoints: document.body.innerText.includes(T.points),
    hasSchedule: document.body.innerText.includes(T.schedule),
    hasHighlights: document.body.innerText.includes('重點一') && document.body.innerText.includes('重點二'),
  }), T);
  console.log('--- DETAIL status=' + dr.status() + ' ---');
  console.log(JSON.stringify(di, null, 2));
  await shot(det, 'B06_front_activity_detail');

  // ---- 12. unpublish
  const unpub = await admin.evaluate(async (id) => { const r = await fetch('/api/admin/activities', { method: 'PATCH', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, published: false }) }); return r.status; }, created.id);
  console.log('PATCH unpublish status = ' + unpub);
  await wait(1200);
  await admin.reload({ waitUntil: 'networkidle2' });
  await wait(1500);
  await shot(admin, 'B07_activity_unpublished');

  await front.reload({ waitUntil: 'networkidle2' });
  await wait(1500);
  const ev2 = await front.evaluate((t) => ({ hasNew: document.body.innerText.includes(t) }), T.title);
  console.log('--- FRONT /events (unpublished) ---');
  console.log(JSON.stringify(ev2, null, 2));
  await shot(front, 'B08_front_events_after_unpublish');

  const det2 = await det.reload({ waitUntil: 'networkidle2' });
  await wait(1000);
  const di2 = await det.evaluate((t) => ({ statusText: document.body.innerText.trim().slice(0, 80), hasNew: document.body.innerText.includes(t) }), T.title);
  console.log('--- DETAIL (unpublished) http=' + (det2 && det2.status()) + ' ---');
  console.log(JSON.stringify(di2, null, 2));
  await shot(det, 'B09_front_detail_after_unpublish');

  // ---- 13. republish then delete
  const repub = await admin.evaluate(async (id) => { const r = await fetch('/api/admin/activities', { method: 'PATCH', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, published: true }) }); return r.status; }, created.id);
  console.log('PATCH republish status = ' + repub);
  await wait(1200);
  await admin.reload({ waitUntil: 'networkidle2' });
  await wait(1500);
  await shot(admin, 'B10_activity_republished');

  const del = await admin.evaluate(async (id) => { const r = await fetch(`/api/admin/activities?id=${id}`, { method: 'DELETE', credentials: 'include' }); return r.status; }, created.id);
  console.log('DELETE status = ' + del);
  await wait(1200);
  await admin.reload({ waitUntil: 'networkidle2' });
  await wait(1500);
  await shot(admin, 'B11_activity_deleted');

  const finalList = await admin.evaluate(async () => (await (await fetch('/api/admin/activities', { credentials: 'include' })).json()));
  console.log('--- final titles ---');
  console.log(JSON.stringify(finalList.activities.map((a) => a.title), null, 2));
  console.log('QA activity present after delete = ' + finalList.activities.some((a) => a.title === T.title));

  await front.reload({ waitUntil: 'networkidle2' });
  await wait(1500);
  const ev3 = await front.evaluate((t) => ({ hasNew: document.body.innerText.includes(t) }), T.title);
  console.log('FRONT after delete hasNew = ' + JSON.stringify(ev3));
  await shot(front, 'B12_front_events_after_delete');

  await browser.close();
})();
