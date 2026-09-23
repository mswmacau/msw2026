// Item 5: create English-slug activity -> visible on /events -> unpublish -> gone -> republish -> back -> delete
const { launch, wait, shot, clickText, sessionRole, BASE } = require('./R2_lib');

const TITLE = 'QA 回歸英文代稱活動';
const SLUG = 'qa-english-regression';

(async () => {
  const browser = await launch('/workspace/msw/qa/R2_admin_cookies.json');
  const admin = await browser.newPage();
  await admin.setViewport({ width: 1440, height: 900 });

  await admin.goto(BASE + '/login', { waitUntil: 'domcontentloaded' });
  await wait(700);
  console.log('[0] role = ' + (await sessionRole(admin)));

  // pre-clean
  const pre = await admin.evaluate(async (slug) => {
    const r = await fetch('/api/admin/activities', { credentials: 'include' });
    const j = await r.json();
    const hits = (j.activities || []).filter((a) => a.slug === slug || a.title === 'QA 回歸英文代稱活動');
    for (const a of hits) await fetch('/api/admin/activities?id=' + a.id, { method: 'DELETE', credentials: 'include' });
    return hits.length;
  }, SLUG);
  console.log('[0] pre-cleaned ' + pre);

  // ---------- CREATE via UI ----------
  await admin.goto(BASE + '/admin', { waitUntil: 'networkidle2', timeout: 30000 });
  await wait(1700);
  await clickText(admin, '活動管理', { tag: 'button' });
  await wait(1200);
  await clickText(admin, '新增活動');
  await wait(1300);
  await admin.evaluate(() => {
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
    put(vis[0], 'QA 回歸英文代稱活動');
    put(vis[1], '全月不限地點');
    put(vis[2], '月度挑戰');
    put(vis[3], 'qa-english-regression');
    put(vis[9], '每 1 KM 累積 2 分');
    put(vis[10], '回歸測試用活動描述。');
  });
  await wait(300);
  await admin.evaluate(() => {
    const cb = [...document.querySelectorAll('input[type=checkbox]')].filter((el) => {
      const r = el.getBoundingClientRect();
      return r.width > 0 || r.height > 0;
    }).pop();
    if (cb && !cb.checked) cb.click();
  });
  await wait(300);
  await shot(admin, 'R2_21_CRUD_form_filled');
  await clickText(admin, '儲存活動', { tag: 'button' });
  await wait(2400);
  await shot(admin, 'R2_22_CRUD_created');

  const created = await admin.evaluate(async (slug) => {
    const r = await fetch('/api/admin/activities', { credentials: 'include' });
    const j = await r.json();
    return (j.activities || []).find((a) => a.slug === slug) || null;
  }, SLUG);
  console.log('[1] created = ' + JSON.stringify(created));
  if (!created) { console.log('FATAL: not created'); await browser.close(); return; }

  // helper: does /events show it?
  const checkEvents = async (label) => {
    await admin.goto(BASE + '/events', { waitUntil: 'networkidle2', timeout: 30000 });
    await wait(1600);
    const res = await admin.evaluate((t) => ({
      listed: document.body.innerText.includes(t),
      cards: [...document.querySelectorAll('a[href^="/events/"]')].map((a) => a.getAttribute('href')),
    }), TITLE);
    console.log(`[${label}] on /events: listed=${res.listed} cards=${JSON.stringify(res.cards)}`);
    await shot(admin, `R2_23_CRUD_events_${label}`);
    return res;
  };

  await checkEvents('published');

  // ---------- UNPUBLISH via UI ----------
  await admin.goto(BASE + '/admin', { waitUntil: 'networkidle2', timeout: 30000 });
  await wait(1700);
  await clickText(admin, '活動管理', { tag: 'button' });
  await wait(1300);
  await admin.evaluate((slug) => {
    const rows = [...document.querySelectorAll('tr, li, div')].filter((d) => d.innerText && d.innerText.includes(slug) && d.querySelectorAll('button').length >= 2 && d.innerText.length < 400);
    const row = rows[rows.length - 1] || null;
    if (!row) throw new Error('row not found');
    const btn = [...row.querySelectorAll('button')].find((b) => (b.innerText || '').includes('下架'));
    if (!btn) throw new Error('下架 button not found');
    btn.click();
  }, SLUG);
  await wait(2200);
  await shot(admin, 'R2_24_CRUD_unpublished');

  const afterUnpub = await admin.evaluate(async (slug) => {
    const r = await fetch('/api/admin/activities', { credentials: 'include' });
    const j = await r.json();
    const hit = (j.activities || []).find((a) => a.slug === slug);
    return hit ? { published: hit.published } : null;
  }, SLUG);
  console.log('[2] after unpublish, DB published = ' + JSON.stringify(afterUnpub));
  await checkEvents('unpublished');

  // ---------- REPUBLISH via UI ----------
  await admin.goto(BASE + '/admin', { waitUntil: 'networkidle2', timeout: 30000 });
  await wait(1700);
  await clickText(admin, '活動管理', { tag: 'button' });
  await wait(1300);
  await admin.evaluate((slug) => {
    const rows = [...document.querySelectorAll('tr, li, div')].filter((d) => d.innerText && d.innerText.includes(slug) && d.querySelectorAll('button').length >= 2 && d.innerText.length < 400);
    const row = rows[rows.length - 1] || null;
    if (!row) throw new Error('row not found');
    const btn = [...row.querySelectorAll('button')].find((b) => (b.innerText || '').includes('上架'));
    if (!btn) throw new Error('上架 button not found');
    btn.click();
  }, SLUG);
  await wait(2200);
  await shot(admin, 'R2_25_CRUD_republished');

  const afterRep = await admin.evaluate(async (slug) => {
    const r = await fetch('/api/admin/activities', { credentials: 'include' });
    const j = await r.json();
    const hit = (j.activities || []).find((a) => a.slug === slug);
    return hit ? { published: hit.published } : null;
  }, SLUG);
  console.log('[3] after republish, DB published = ' + JSON.stringify(afterRep));
  await checkEvents('republished');

  // ---------- DELETE ----------
  await admin.goto(BASE + '/admin', { waitUntil: 'networkidle2', timeout: 30000 });
  await wait(1700);
  await clickText(admin, '活動管理', { tag: 'button' });
  await wait(1300);
  // handle possible confirm dialog
  admin.on('dialog', (d) => d.accept());
  await admin.evaluate((slug) => {
    const rows = [...document.querySelectorAll('tr, li, div')].filter((d) => d.innerText && d.innerText.includes(slug) && d.querySelectorAll('button').length >= 2 && d.innerText.length < 400);
    const row = rows[rows.length - 1] || null;
    if (!row) throw new Error('row not found');
    const btn = [...row.querySelectorAll('button')].find((b) => (b.innerText || '').includes('刪除'));
    if (!btn) throw new Error('刪除 button not found');
    btn.click();
  }, SLUG);
  await wait(2400);
  await shot(admin, 'R2_26_CRUD_deleted_admin');

  const final = await admin.evaluate(async (slug) => {
    const r = await fetch('/api/admin/activities', { credentials: 'include' });
    const j = await r.json();
    return { hit: (j.activities || []).find((a) => a.slug === slug) || null, all: (j.activities || []).map((a) => a.slug) };
  }, SLUG);
  console.log('[4] after delete: hit=' + JSON.stringify(final.hit) + ' all=' + JSON.stringify(final.all));

  // front should no longer show it
  await admin.goto(BASE + '/events', { waitUntil: 'networkidle2', timeout: 30000 });
  await wait(1500);
  const gone = await admin.evaluate((t) => !document.body.innerText.includes(t), TITLE);
  console.log('[5] gone from /events after delete = ' + gone);
  await shot(admin, 'R2_27_CRUD_events_after_delete');

  console.log('ITEM5 VERDICT: ' + (created && final.hit === null && gone ? 'PASS' : 'CHECK LOG'));

  await browser.close();
})();
