// B (rewritten): drive the real 新增活動 modal by placeholder/label, then full lifecycle
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

// Fill the modal by walking label->input using DOM order, keyed on label text
async function fillModal(page, T) {
  return page.evaluate((T) => {
    // find the modal container
    const modal = [...document.querySelectorAll('div')].find((d) => d.innerText && d.innerText.includes('活動名稱') && d.innerText.includes('儲存') && d.querySelectorAll('input,textarea').length > 4);
    if (!modal) return { error: 'NO_MODAL' };
    const setter = (el, v) => {
      const proto = el.tagName === 'TEXTAREA' ? HTMLTextAreaElement : HTMLInputElement;
      Object.getOwnPropertyDescriptor(proto.prototype, 'value').set.call(el, v);
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
    };
    // map: for each label-ish text node, find the nearest following input
    const controls = [...modal.querySelectorAll('input, textarea')].filter((e) => e.type !== 'checkbox' && e.type !== 'hidden');
    const labelFor = (el) => {
      // walk up a couple of levels, look for preceding text
      let node = el, hops = 0;
      while (node && hops < 4) {
        const prev = node.previousElementSibling;
        if (prev && /活動名稱|副標題|分類標籤|網址代稱|顯示順序|封面圖片|時間|地點|積分說明|活動介紹/.test(prev.innerText || '')) {
          const m = (prev.innerText || '').match(/活動名稱|副標題|分類標籤|網址代稱|顯示順序|封面圖片|時間|地點|積分說明|活動介紹/);
          return m ? m[0] : null;
        }
        node = node.parentElement; hops += 1;
      }
      return null;
    };
    const report = {};
    const want = {
      '活動名稱': T.title, '副標題': T.subtitle, '時間': T.schedule,
      '地點': T.location, '積分說明': T.points, '活動介紹': T.description,
    };
    for (const el of controls) {
      const lf = labelFor(el);
      const key = lf || ('ph:' + (el.placeholder || '').slice(0, 10));
      if (lf && want[lf] !== undefined) { setter(el, want[lf]); report[lf] = 'ok'; }
      else report[key] = 'skip(v=' + (el.value || '').slice(0, 12) + ')';
    }
    // highlights textarea = the one with the 3-line placeholder
    const hl = controls.find((e) => /新手友善/.test(e.placeholder || ''));
    if (hl) { setter(hl, T.highlights.join('\n')); report['highlights'] = 'ok'; } else report['highlights'] = 'MISS';
    // checkbox 立即上架
    const cb = [...modal.querySelectorAll('input[type="checkbox"]')].find((c) => (c.closest('label') || {}).innerText?.includes('立即上架'));
    if (cb) { if (!cb.checked) cb.click(); report['published'] = cb.checked; }
    return report;
  }, T);
}

(async () => {
  const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu'] });
  await setCookie(browser);
  const admin = await browser.newPage();
  await admin.setViewport({ width: 1440, height: 900 });
  admin.on('pageerror', (e) => console.log('ADMIN pageerror: ' + e.message));
  await admin.goto(BASE + '/admin', { waitUntil: 'networkidle2', timeout: 30000 });
  await wait(1800);

  await clickText(admin, '活動管理', { tag: 'button' });
  await wait(1500);
  await shot(admin, 'B01_activity_list');

  await clickText(admin, '新增活動');
  await wait(1200);
  await shot(admin, 'B02_new_activity_form');

  const rep = await fillModal(admin, T);
  console.log('--- fill report ---');
  console.log(JSON.stringify(rep, null, 2));
  await wait(500);
  await shot(admin, 'B03_activity_filled');

  // capture the POST response
  let postStatus = null, postBody = null;
  const onResp = async (r) => {
    if (r.url().includes('/api/admin/activities') && r.request().method() === 'POST') {
      postStatus = r.status();
      try { postBody = await r.text(); } catch (e) {}
    }
  };
  admin.on('response', onResp);

  // click 儲存 inside the modal (exact)
  const clicked = await admin.evaluate(() => {
    const modal = [...document.querySelectorAll('div')].find((d) => d.innerText && d.innerText.includes('活動名稱') && d.querySelectorAll('input,textarea').length > 4);
    const btn = [...modal.querySelectorAll('button')].find((b) => b.innerText.trim() === '儲存' || b.innerText.trim() === '確認新增');
    if (!btn) return 'NO_BTN';
    btn.click();
    return btn.innerText.trim();
  });
  console.log('clicked save button: ' + clicked);
  await wait(3000);
  await shot(admin, 'B04_activity_saved');
  console.log('POST status=' + postStatus + ' body=' + postBody);

  const after = await admin.evaluate(async () => (await (await fetch('/api/admin/activities', { credentials: 'include' })).json()));
  const created = after.activities.find((a) => a.title === T.title);
  console.log('--- created ---');
  console.log(JSON.stringify(created ? { id: created.id, slug: created.slug, title: created.title, subtitle: created.subtitle, schedule: created.schedule, location: created.location, points: created.points, published: created.published, highlights: created.highlights } : null, null, 2));
  fs.writeFileSync('/workspace/msw/qa/qg_activity.json', JSON.stringify(created || {}, null, 2));
  if (!created) { console.log('ABORT B: not created'); await browser.close(); return; }

  // 10. front /events
  const front = await browser.newPage();
  await front.setViewport({ width: 1440, height: 900 });
  await front.goto(BASE + '/events', { waitUntil: 'networkidle2', timeout: 30000 });
  await wait(1500);
  const ev = await front.evaluate((t) => ({ hasNew: document.body.innerText.includes(t), links: [...document.querySelectorAll('a[href^="/events/"]')].map((a) => a.getAttribute('href')) }), T.title);
  console.log('--- FRONT /events ---');
  console.log(JSON.stringify(ev, null, 2));
  await shot(front, 'B05_front_events_list');

  // 11. detail
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
    body: document.body.innerText.trim().slice(0, 400),
  }), T);
  console.log('--- DETAIL status=' + dr.status() + ' ---');
  console.log(JSON.stringify(di, null, 2));
  await shot(det, 'B06_front_activity_detail');

  await browser.close();
})();
