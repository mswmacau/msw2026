// P1-1 re-verify: pure-Chinese activity name, empty slug field -> auto ASCII slug, detail page must be 200
const fs = require('fs');
const { launch, wait, shot, clickText, setValue, sessionRole, BASE } = require('./R2_lib');

const TITLE = '週三核心訓練班';

(async () => {
  const browser = await launch('/workspace/msw/qa/R2_admin_cookies.json');
  const admin = await browser.newPage();
  await admin.setViewport({ width: 1440, height: 900 });

  // verify admin session still valid
  await admin.goto(BASE + '/login', { waitUntil: 'domcontentloaded' });
  await wait(700);
  const role = await sessionRole(admin);
  console.log('[0] admin session role = ' + role);
  if (role !== 'ADMIN') { console.log('FATAL: admin cookie invalid'); await browser.close(); return; }

  // clean any leftover test activity
  const clean = await admin.evaluate(async () => {
    const r = await fetch('/api/admin/activities', { credentials: 'include' });
    const j = await r.json();
    const hit = (j.activities || []).filter((a) => a.title === '週三核心訓練班' || a.slug === 'qa-english-regression');
    for (const a of hit) {
      await fetch('/api/admin/activities?id=' + a.id, { method: 'DELETE', credentials: 'include' });
    }
    return hit.map((a) => a.slug);
  });
  console.log('[0] pre-cleaned = ' + JSON.stringify(clean));

  await admin.goto(BASE + '/admin', { waitUntil: 'networkidle2', timeout: 30000 });
  await wait(1700);
  await clickText(admin, '活動管理', { tag: 'button' });
  await wait(1100);
  await clickText(admin, '新增活動');
  await wait(1300);

  // fill by visible-form order: 0 title, 1 subtitle, 2 tag, 3 slug, 9 points, 10 description, 12 published
  const fill = await admin.evaluate((title) => {
    const vis = [...document.querySelectorAll('input,textarea')].filter((el) => {
      const r = el.getBoundingClientRect();
      return (r.width > 0 || r.height > 0) && el.type !== 'hidden';
    });
    const put = (el, v) => {
      const proto = el.tagName === 'TEXTAREA' ? HTMLTextAreaElement : HTMLInputElement;
      Object.getOwnPropertyDescriptor(proto.prototype, 'value').set.call(el, v);
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
    };
    put(vis[0], title);              // 活動名稱 (pure Chinese)
    put(vis[1], '每週三 20:00 - 21:00'); // subtitle
    put(vis[2], '常態活動');           // tag
    // vis[3] = 網址代稱 -> intentionally LEFT EMPTY
    put(vis[9], '每次出席 10 分');
    put(vis[10], '核心訓練班自動產生 slug 驗證用描述。');
    return { slugFieldValue: vis[3].value, slugPlaceholder: vis[3].placeholder, titleValue: vis[0].value };
  }, TITLE);
  console.log('[1] form filled = ' + JSON.stringify(fill));

  // tick 立即上架
  await admin.evaluate(() => {
    const cb = [...document.querySelectorAll('input[type=checkbox]')].filter((el) => {
      const r = el.getBoundingClientRect();
      return r.width > 0 || r.height > 0;
    }).pop();
    if (cb && !cb.checked) cb.click();
  });
  await wait(400);
  const cbState = await admin.evaluate(() => {
    const cb = [...document.querySelectorAll('input[type=checkbox]')].filter((el) => {
      const r = el.getBoundingClientRect();
      return r.width > 0 || r.height > 0;
    }).pop();
    return cb ? { checked: cb.checked, label: cb.closest('label') ? cb.closest('label').innerText.trim() : null } : null;
  });
  console.log('[1] published checkbox = ' + JSON.stringify(cbState));
  await shot(admin, 'R2_02_P1_form_filled_CJK_no_slug');

  // save
  await clickText(admin, '儲存活動', { tag: 'button' });
  await wait(2200);
  await shot(admin, 'R2_02_P1_activity_saved');

  // read generated slug from API
  const after = await admin.evaluate(async (title) => {
    const r = await fetch('/api/admin/activities', { credentials: 'include' });
    const j = await r.json();
    const hit = (j.activities || []).find((a) => a.title === title);
    return hit ? { id: hit.id, slug: hit.slug, title: hit.title, published: hit.published } : null;
  }, TITLE);
  console.log('[2] created activity = ' + JSON.stringify(after));
  if (!after) { console.log('FATAL: activity not created'); await browser.close(); return; }

  const asciiOnly = /^[A-Za-z0-9-]+$/.test(after.slug);
  console.log('[2] slug is pure ASCII [A-Za-z0-9-] = ' + asciiOnly);

  // ---------- FRONT END: /events then CLICK IN ----------
  const events = await browser.newPage();
  await events.setViewport({ width: 1440, height: 900 });
  await events.goto(BASE + '/events', { waitUntil: 'networkidle2', timeout: 30000 });
  await wait(1500);
  await shot(events, 'R2_03_P1_front_events_list');

  const link = await events.evaluate((title) => {
    const cards = [...document.querySelectorAll('a[href^="/events/"]')];
    const hit = cards.find((a) => (a.innerText || '').includes(title));
    return hit ? { href: hit.getAttribute('href'), text: hit.innerText.trim().replace(/\s+/g, ' ').slice(0, 60) } : null;
  }, TITLE);
  console.log('[3] found link on /events = ' + JSON.stringify(link));

  let status = null;
  events.on('response', (res) => {
    const u = res.url();
    if (u.includes('/events/') && res.request().resourceType() === 'document') {
      status = res.status();
    }
  });

  if (!link) {
    console.log('[3] NO LINK -> navigating directly');
    await events.goto(BASE + '/events/' + after.slug, { waitUntil: 'networkidle2', timeout: 30000 });
  } else {
    await events.evaluate((title) => {
      const cards = [...document.querySelectorAll('a[href^="/events/"]')];
      const hit = cards.find((a) => (a.innerText || '').includes(title));
      hit.scrollIntoView({ block: 'center', behavior: 'instant' });
      hit.click();
    }, TITLE);
    await wait(3000);
  }
  await wait(1200);

  const detail = await events.evaluate(() => ({
    url: location.pathname,
    httpStatusSeen: null,
    title: document.title,
    h1: (document.querySelector('h1') || {}).innerText || null,
    has404: /404|找不到|頁面不存在|This page could not be found/i.test(document.body.innerText),
    bodySnippet: document.body.innerText.trim().replace(/\s+/g, ' ').slice(0, 220),
    textLength: document.body.innerText.trim().length,
  }));
  console.log('[4] detail page HTTP status (from response listener) = ' + status);
  console.log('[4] detail page = ' + JSON.stringify(detail, null, 2));
  await shot(events, 'R2_04_P1_activity_detail_200');

  // confirm real HTTP status with a clean navigation too
  const cleanNav = await events.goto(BASE + '/events/' + after.slug, { waitUntil: 'networkidle2', timeout: 30000 });
  const cleanInfo = await events.evaluate(() => ({
    title: document.title,
    h1: (document.querySelector('h1') || {}).innerText || null,
    has404: /404|This page could not be found/i.test(document.body.innerText),
  }));
  console.log('[5] direct navigation HTTP = ' + cleanNav.status() + ' ' + JSON.stringify(cleanInfo));
  await shot(events, 'R2_05_P1_detail_direct_nav');

  // also check via raw fetch status
  const rawStatus = await events.evaluate(async (slug) => {
    const r = await fetch('/events/' + slug, { credentials: 'omit' });
    return r.status;
  }, after.slug);
  console.log('[5] raw fetch HTTP = ' + rawStatus);

  fs.writeFileSync('/workspace/msw/qa/R2_p1_activity.json', JSON.stringify(after, null, 2));

  // ---------- CLEANUP ----------
  const del = await admin.evaluate(async (id) => {
    const r = await fetch('/api/admin/activities?id=' + id, { method: 'DELETE', credentials: 'include' });
    return { status: r.status, body: (await r.text()).slice(0, 120) };
  }, after.id);
  console.log('[6] cleanup delete = ' + JSON.stringify(del));

  const remaining = await admin.evaluate(async () => {
    const r = await fetch('/api/admin/activities', { credentials: 'include' });
    const j = await r.json();
    return (j.activities || []).map((a) => a.slug);
  });
  console.log('[6] remaining activities = ' + JSON.stringify(remaining));

  await admin.goto(BASE + '/admin', { waitUntil: 'networkidle2', timeout: 30000 });
  await wait(1500);
  await clickText(admin, '活動管理', { tag: 'button' });
  await wait(1200);
  await shot(admin, 'R2_06_P1_admin_after_cleanup');

  await browser.close();
})();
