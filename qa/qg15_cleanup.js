// Final cleanup verification: no QA leftovers in activities/settings; restore baseline if drift found
const puppeteer = require('puppeteer-core');
const fs = require('fs');
const { wait, BASE } = require('./harness');
const CHROME = '/usr/bin/chromium';
const COOKIES = '/workspace/msw/qa/qg_admin_cookies.json';
const BASELINE = JSON.parse(fs.readFileSync('/workspace/msw/qa/qg_baseline_settings.json', 'utf8'));

async function setCookie(b) { for (const c of JSON.parse(fs.readFileSync(COOKIES, 'utf8'))) { const n = (s) => { const v = String(s || 'None').toLowerCase(); return v === 'lax' ? 'Lax' : v === 'strict' ? 'Strict' : 'None'; }; await b.setCookie({ name: c.name, value: c.value, domain: c.domain, path: c.path, httpOnly: !!c.httpOnly, secure: !!c.secure, sameSite: n(c.sameSite) }); } }

(async () => {
  const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu'] });
  await setCookie(browser);
  const p = await browser.newPage();
  await p.goto(BASE + '/admin', { waitUntil: 'networkidle2', timeout: 30000 });
  await wait(1500);

  const acts = await p.evaluate(async () => (await (await fetch('/api/admin/activities', { credentials: 'include' })).json()).activities);
  const s = await p.evaluate(async () => (await (await fetch('/api/admin/settings', { credentials: 'include' })).json()).settings);

  console.log('--- activities now ---');
  console.log(JSON.stringify(acts.map((a) => ({ slug: a.slug, title: a.title, published: a.published })), null, 2));
  const qaLeft = acts.filter((a) => /QA|測試/.test(a.title) || /qa-/.test(a.slug));
  console.log('QA leftovers: ' + JSON.stringify(qaLeft.map((a) => a.slug)));

  console.log('--- key settings vs baseline ---');
  const keys = ['site_name', 'site_tagline', 'theme_bg', 'theme_primary', 'theme_accent', 'hero_title', 'hero_title_highlight', 'site_description'];
  const drift = {};
  for (const k of keys) {
    const ok = s[k] === BASELINE[k];
    if (!ok) drift[k] = { now: s[k], baseline: BASELINE[k] };
  }
  console.log('drift: ' + JSON.stringify(drift, null, 2));

  // also check for any leftover "QA" strings anywhere in settings
  const qaInSettings = Object.entries(s).filter(([k, v]) => /QA|12345/.test(String(v)));
  console.log('QA traces in settings: ' + JSON.stringify(qaInSettings));

  // restore any drift automatically
  if (Object.keys(drift).length) {
    const patch = {};
    for (const k of Object.keys(drift)) patch[k] = BASELINE[k];
    const r = await p.evaluate(async (base, body) => (await fetch(base + '/api/admin/settings', { method: 'PUT', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })).status, BASE, patch);
    console.log('RESTORED drift, status=' + r);
  }
  // delete any QA activity leftovers
  for (const a of qaLeft) {
    const r = await p.evaluate(async (id) => (await fetch(`/api/admin/activities?id=${id}`, { method: 'DELETE', credentials: 'include' })).status, a.id);
    console.log('deleted leftover ' + a.slug + ' -> ' + r);
  }

  const s2 = await p.evaluate(async () => (await (await fetch('/api/admin/settings', { credentials: 'include' })).json()).settings);
  console.log('FINAL site_name=' + JSON.stringify(s2.site_name) + ' theme_primary=' + s2.theme_primary + ' hero_title=' + JSON.stringify(s2.hero_title));
  await browser.close();
})();
