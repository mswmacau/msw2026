// R2-00: login admin + member, capture baseline settings for later restore
const puppeteer = require('puppeteer-core');
const fs = require('fs');
const { shot, clickText, wait, BASE } = require('./harness');
const CHROME = '/usr/bin/chromium';

(async () => {
  const browser = await puppeteer.launch({
    executablePath: CHROME, headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
  });

  // ---------- ADMIN ----------
  const admin = await browser.newPage();
  await admin.setViewport({ width: 1440, height: 900 });
  await admin.goto(BASE + '/login', { waitUntil: 'networkidle2', timeout: 30000 });
  await wait(900);
  await shot(admin, 'R2_00_login_admin_form');
  await admin.type('input[type="email"]', 'admin@msw.mo', { delay: 12 });
  await admin.type('input[type="password"]', 'msw2026admin', { delay: 12 });
  await wait(300);
  await Promise.all([
    admin.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 }).catch(() => {}),
    clickText(admin, '登入', { tag: 'button' }),
  ]);
  await wait(2200);
  const adminSess = await admin.evaluate(async () => {
    const r = await fetch('/api/auth/session', { credentials: 'include' });
    return await r.text();
  });
  console.log('--- admin session ---');
  console.log(adminSess);
  await shot(admin, 'R2_00_admin_after_login');

  // baseline settings (source of truth for restore)
  const baseline = await admin.evaluate(async (base) => {
    const r = await fetch(base + '/api/admin/settings', { credentials: 'include' });
    return { status: r.status, json: await r.json() };
  }, BASE);
  console.log('--- baseline settings status=' + baseline.status + ' ---');
  fs.writeFileSync('/workspace/msw/qa/R2_baseline_settings.json', JSON.stringify(baseline.json, null, 2));
  console.log(JSON.stringify({
    site_name: baseline.json.site_name,
    theme_primary: baseline.json.theme_primary,
    site_tagline: baseline.json.site_tagline,
  }, null, 2));

  const adminCookies = await browser.cookies();
  fs.writeFileSync('/workspace/msw/qa/R2_admin_cookies.json', JSON.stringify(adminCookies, null, 2));

  // baseline activity list
  const acts = await admin.evaluate(async () => {
    const r = await fetch('/api/admin/activities', { credentials: 'include' });
    return await r.json();
  });
  console.log('--- baseline activities ---');
  console.log(JSON.stringify((acts.activities || []).map((a) => ({ id: a.id, slug: a.slug, title: a.title, published: a.published })), null, 2));
  fs.writeFileSync('/workspace/msw/qa/R2_baseline_activities.json', JSON.stringify(acts.activities || [], null, 2));

  await admin.close();

  // ---------- MEMBER ----------
  const member = await browser.newPage();
  await member.setViewport({ width: 1440, height: 900 });
  await member.goto(BASE + '/login', { waitUntil: 'networkidle2', timeout: 30000 });
  await wait(900);
  await member.type('input[type="email"]', 'ming@msw.mo', { delay: 12 });
  await member.type('input[type="password"]', 'msw2026', { delay: 12 });
  await wait(300);
  await Promise.all([
    member.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 }).catch(() => {}),
    clickText(member, '登入', { tag: 'button' }),
  ]);
  await wait(2200);
  const memberSess = await member.evaluate(async () => {
    const r = await fetch('/api/auth/session', { credentials: 'include' });
    return await r.text();
  });
  console.log('--- member session ---');
  console.log(memberSess);
  await shot(member, 'R2_00_member_after_login');
  const memberCookies = await browser.cookies();
  fs.writeFileSync('/workspace/msw/qa/R2_member_cookies.json', JSON.stringify(memberCookies, null, 2));

  await browser.close();
})();
