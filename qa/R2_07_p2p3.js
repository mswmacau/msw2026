// P2-1 re-verify: site_name change -> document.title + og:title sync; then restore
// P3-1 re-verify: edit modal action bar fixed at bottom, buttons visible WITHOUT scrolling
const { launch, wait, shot, clickText, sessionRole, BASE } = require('./R2_lib');

const NEW_NAME = 'QA複驗測試站R2';

(async () => {
  const browser = await launch('/workspace/msw/qa/R2_admin_cookies.json');
  const admin = await browser.newPage();
  await admin.setViewport({ width: 1440, height: 900 });

  await admin.goto(BASE + '/login', { waitUntil: 'domcontentloaded' });
  await wait(700);
  console.log('[0] role = ' + (await sessionRole(admin)));

  // baseline title BEFORE change (fresh load)
  const before = await admin.goto(BASE + '/', { waitUntil: 'networkidle2', timeout: 30000 });
  await wait(1200);
  const titleBefore = await admin.evaluate(() => ({
    docTitle: document.title,
    og: (document.querySelector('meta[property="og:title"]') || {}).content || null,
  }));
  console.log('[1] BEFORE: ' + JSON.stringify(titleBefore));
  await shot(admin, 'R2_07_P2_title_before');

  // ---- admin: change site_name ----
  await admin.goto(BASE + '/admin', { waitUntil: 'networkidle2', timeout: 30000 });
  await wait(1700);
  await clickText(admin, '網站設定', { tag: 'button' });
  await wait(1300);

  const nameField = await admin.evaluate((v) => {
    const inputs = [...document.querySelectorAll('input')].filter((el) => {
      const r = el.getBoundingClientRect();
      return (r.width > 0 || r.height > 0) && el.type !== 'hidden';
    });
    // site name input = one whose current value is MSW 街健館
    const el = inputs.find((x) => x.value === 'MSW 街健館');
    if (!el) return { ok: false, values: inputs.slice(0, 6).map((x) => x.value) };
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(el, v);
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
    return { ok: true, now: el.value };
  }, NEW_NAME);
  console.log('[2] site_name input set = ' + JSON.stringify(nameField));
  await wait(400);
  await shot(admin, 'R2_08_P2_name_input_changed');

  await clickText(admin, '儲存全部設定', { tag: 'button' });
  await wait(2500);
  await shot(admin, 'R2_09_P2_name_saved');

  // ---- front: verify title sync ----
  await admin.goto(BASE + '/', { waitUntil: 'networkidle2', timeout: 30000 });
  await wait(1500);
  const titleAfter = await admin.evaluate(() => ({
    docTitle: document.title,
    og: (document.querySelector('meta[property="og:title"]') || {}).content || null,
    brand: (document.querySelector('header') || document.body).innerText.slice(0, 80),
  }));
  console.log('[3] AFTER: ' + JSON.stringify(titleAfter));
  await shot(admin, 'R2_10_P2_front_title_changed');

  const ogOk = titleAfter.docTitle.includes(NEW_NAME) && titleAfter.og && titleAfter.og.includes(NEW_NAME);
  console.log('[3] P2-1 verdict: ' + (ogOk ? 'FIXED (title + og both synced)' : 'NOT FIXED'));

  // ---- restore ----
  await admin.goto(BASE + '/admin', { waitUntil: 'networkidle2', timeout: 30000 });
  await wait(1700);
  await clickText(admin, '網站設定', { tag: 'button' });
  await wait(1300);
  await admin.evaluate(() => {
    const inputs = [...document.querySelectorAll('input')].filter((el) => {
      const r = el.getBoundingClientRect();
      return (r.width > 0 || r.height > 0) && el.type !== 'hidden';
    });
    const el = inputs.find((x) => x.value === 'QA複驗測試站R2');
    if (el) {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(el, 'MSW 街健館');
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
    }
  });
  await wait(400);
  await clickText(admin, '儲存全部設定', { tag: 'button' });
  await wait(2500);
  await shot(admin, 'R2_11_P2_name_restored_admin');

  await admin.goto(BASE + '/', { waitUntil: 'networkidle2', timeout: 30000 });
  await wait(1500);
  const titleRestored = await admin.evaluate(() => ({
    docTitle: document.title,
    og: (document.querySelector('meta[property="og:title"]') || {}).content || null,
  }));
  console.log('[4] RESTORED: ' + JSON.stringify(titleRestored));
  await shot(admin, 'R2_12_P2_front_restored');

  // ================= P3-1: edit modal without scrolling =================
  await admin.goto(BASE + '/admin', { waitUntil: 'networkidle2', timeout: 30000 });
  await wait(1700);
  await clickText(admin, '活動管理', { tag: 'button' });
  await wait(1300);

  // open first card's 編輯
  await admin.evaluate(() => {
    const btn = [...document.querySelectorAll('button')].find((b) => (b.innerText || '').trim() === '編輯');
    btn.scrollIntoView({ block: 'center', behavior: 'instant' });
    btn.click();
  });
  await wait(1600);

  // verify no scroll happened inside the modal / page after opening
  const modalState = await admin.evaluate(() => {
    const winH = window.innerHeight;
    const winW = window.innerWidth;
    const findBtn = (t) => [...document.querySelectorAll('button')].filter((b) => (b.innerText || '').trim() === t);
    const probe = (b) => {
      const r = b.getBoundingClientRect();
      const cx = Math.round(r.left + r.width / 2), cy = Math.round(r.top + r.height / 2);
      const topEl = document.elementFromPoint(cx, cy);
      return {
        text: b.innerText.trim(), top: Math.round(r.top), bottom: Math.round(r.bottom),
        inViewport: r.top >= 0 && r.bottom <= winH && r.height > 0,
        clickHitsItself: !!topEl && (topEl === b || b.contains(topEl)),
      };
    };
    const saves = findBtn('儲存活動').map(probe);
    const cancels = findBtn('取消').map(probe);
    const scrollables = [];
    document.querySelectorAll('div, section, form').forEach((d) => {
      const cs = getComputedStyle(d);
      if ((cs.overflowY === 'auto' || cs.overflowY === 'scroll') && d.scrollHeight > d.clientHeight + 4) {
        scrollables.push({ cls: String(d.className).slice(0, 50), scrollTop: d.scrollTop, scrollH: d.scrollHeight, clientH: d.clientHeight });
      }
    });
    return {
      winH, winW, winScrollY: window.scrollY,
      saveBtn: saves, cancelBtn: cancels,
      scrollableContainers: scrollables.slice(0, 5),
    };
  });
  console.log('[5] P3-1 modal state (NO scroll performed):');
  console.log(JSON.stringify(modalState, null, 2));

  await admin.screenshot({ path: '/workspace/msw/qa-screenshots/R2_13_P3_modal_no_scroll.png', fullPage: false });
  console.log('  [shot] R2_13_P3_modal_no_scroll.png (viewport only)');

  // close modal via 取消
  await admin.evaluate(() => {
    const b = [...document.querySelectorAll('button')].find((x) => (x.innerText || '').trim() === '取消');
    if (b) b.click();
  });
  await wait(800);
  await shot(admin, 'R2_14_P3_modal_closed');

  const verdictP3 = modalState.saveBtn.length && modalState.saveBtn[0].inViewport && modalState.saveBtn[0].clickHitsItself
    ? 'FIXED (儲存活動 in viewport without scrolling)'
    : 'NOT FIXED';
  console.log('[5] P3-1 verdict: ' + verdictP3);

  await browser.close();
})();
