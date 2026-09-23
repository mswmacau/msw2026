// Item 4: theme_primary -> 00C2FF, verify --c-cobalt-bright on front, restore 0057FF
const { launch, wait, shot, clickText, sessionRole, BASE } = require('./R2_lib');

(async () => {
  const browser = await launch('/workspace/msw/qa/R2_admin_cookies.json');
  const admin = await browser.newPage();
  await admin.setViewport({ width: 1440, height: 900 });

  await admin.goto(BASE + '/login', { waitUntil: 'domcontentloaded' });
  await wait(700);
  console.log('[0] role = ' + (await sessionRole(admin)));

  const readVar = (p) => p.evaluate(() => ({
    cobalt: getComputedStyle(document.documentElement).getPropertyValue('--c-cobalt-bright').trim(),
    inline: (document.documentElement.getAttribute('style') || '').slice(0, 200),
  }));

  // baseline front
  await admin.goto(BASE + '/', { waitUntil: 'networkidle2', timeout: 30000 });
  await wait(1500);
  const before = await readVar(admin);
  console.log('[1] BEFORE: ' + JSON.stringify(before));
  await shot(admin, 'R2_15_color_before');

  // admin: 配色樣式 group, set 主色
  await admin.goto(BASE + '/admin', { waitUntil: 'networkidle2', timeout: 30000 });
  await wait(1700);
  await clickText(admin, '網站設定', { tag: 'button' });
  await wait(1300);
  await clickText(admin, '配色樣式', { tag: 'button' });
  await wait(1000);

  const setRes = await admin.evaluate((val) => {
    const inputs = [...document.querySelectorAll('input')].filter((el) => {
      const r = el.getBoundingClientRect();
      return (r.width > 0 || r.height > 0) && el.type !== 'hidden';
    });
    const primary = inputs.find((x) => (x.value || '').toUpperCase() === '#0057FF');
    if (!primary) return { ok: false, values: inputs.map((x) => x.value).slice(0, 10) };
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(primary, val);
    primary.dispatchEvent(new Event('input', { bubbles: true }));
    primary.dispatchEvent(new Event('change', { bubbles: true }));
    return { ok: true, now: primary.value };
  }, '#00C2FF');
  console.log('[2] 主色 input set = ' + JSON.stringify(setRes));
  await wait(400);
  await shot(admin, 'R2_16_color_input_changed');

  await clickText(admin, '儲存全部設定', { tag: 'button' });
  await wait(2600);
  await shot(admin, 'R2_17_color_saved');

  // front re-check
  await admin.goto(BASE + '/', { waitUntil: 'networkidle2', timeout: 30000 });
  await wait(1800);
  const after = await readVar(admin);
  console.log('[3] AFTER: ' + JSON.stringify(after));
  const pass = after.cobalt.replace(/\s/g, '') === '0194255' || /0\s*194\s*255/.test(after.cobalt);
  console.log('[3] --c-cobalt-bright == "0 194 255" ? ' + pass + ' (raw: "' + after.cobalt + '")');
  await shot(admin, 'R2_18_front_color_changed');

  // restore
  await admin.goto(BASE + '/admin', { waitUntil: 'networkidle2', timeout: 30000 });
  await wait(1700);
  await clickText(admin, '網站設定', { tag: 'button' });
  await wait(1300);
  await clickText(admin, '配色樣式', { tag: 'button' });
  await wait(1000);
  await admin.evaluate(() => {
    const inputs = [...document.querySelectorAll('input')].filter((el) => {
      const r = el.getBoundingClientRect();
      return (r.width > 0 || r.height > 0) && el.type !== 'hidden';
    });
    const primary = inputs.find((x) => (x.value || '').toUpperCase() === '#00C2FF');
    if (primary) {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(primary, '#0057FF');
      primary.dispatchEvent(new Event('input', { bubbles: true }));
      primary.dispatchEvent(new Event('change', { bubbles: true }));
    }
  });
  await wait(400);
  await clickText(admin, '儲存全部設定', { tag: 'button' });
  await wait(2600);
  await shot(admin, 'R2_19_color_restored_admin');

  await admin.goto(BASE + '/', { waitUntil: 'networkidle2', timeout: 30000 });
  await wait(1800);
  const restored = await readVar(admin);
  console.log('[4] RESTORED: ' + JSON.stringify(restored));
  await shot(admin, 'R2_20_front_color_restored');

  // double-check via API
  const api = await admin.evaluate(async () => {
    const r = await fetch('/api/admin/settings', { credentials: 'include' });
    const j = await r.json();
    return { site_name: j.settings.site_name, theme_primary: j.settings.theme_primary };
  });
  console.log('[5] final settings via API = ' + JSON.stringify(api));

  await browser.close();
})();
