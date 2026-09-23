// Test the slug/route hypothesis with a controlled pair (auto-CJK slug vs explicit ASCII slug)
const puppeteer = require('puppeteer-core');
const fs = require('fs');
const { wait, BASE } = require('./harness');
const CHROME = '/usr/bin/chromium';
const COOKIES = '/workspace/msw/qa/qg_admin_cookies.json';
const TITLE = 'QA 驗證活動';

async function setCookie(b) { for (const c of JSON.parse(fs.readFileSync(COOKIES, 'utf8'))) { const n = (s) => { const v = String(s || 'None').toLowerCase(); return v === 'lax' ? 'Lax' : v === 'strict' ? 'Strict' : 'None'; }; await b.setCookie({ name: c.name, value: c.value, domain: c.domain, path: c.path, httpOnly: !!c.httpOnly, secure: !!c.secure, sameSite: n(c.sameSite) }); } }

(async () => {
  const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu'] });
  await setCookie(browser);
  const p = await browser.newPage();
  await p.setViewport({ width: 1440, height: 900 });
  await p.goto(BASE + '/admin', { waitUntil: 'networkidle2', timeout: 30000 });
  await wait(1500);

  // clean previous
  let list = await p.evaluate(async () => (await (await fetch('/api/admin/activities', { credentials: 'include' })).json()));
  for (const a of list.activities.filter((a) => a.title.startsWith('QA '))) {
    await p.evaluate(async (id) => fetch(`/api/admin/activities?id=${id}`, { method: 'DELETE', credentials: 'include' }), a.id);
    console.log('cleaned ' + a.slug);
  }

  // create A: no slug -> auto CJK
  const a = await p.evaluate(async (base, title) => (await (await fetch(base + '/api/admin/activities', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title, published: true, description: 'auto-slug test' }) })).json()), BASE, TITLE);
  console.log('A (auto slug) -> ' + JSON.stringify(a));

  // create B: explicit ascii slug
  const b = await p.evaluate(async (base, title) => (await (await fetch(base + '/api/admin/activities', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title: title + ' ASCII', slug: 'qa-verify-activity', published: true, description: 'ascii-slug test' }) })).json()), BASE, TITLE);
  console.log('B (ascii slug) -> ' + JSON.stringify(b));

  // now fetch both front pages
  const check = async (slug, label) => {
    const r = await p.goto(BASE + '/events/' + slug, { waitUntil: 'networkidle2', timeout: 30000 });
    await wait(600);
    const info = await p.evaluate(() => ({ h1: (document.querySelector('h1') || {}).innerText || null }));
    console.log(`${label}: slug="${slug}" http=${r.status()} h1=${JSON.stringify(info.h1)}`);
  };
  await check(a.slug, 'A-auto');
  await check('qa-verify-activity', 'B-ascii');

  // What does the front-end list actually link to?
  await p.goto(BASE + '/events', { waitUntil: 'networkidle2' });
  await wait(1200);
  const links = await p.evaluate(() => [...document.querySelectorAll('a[href^="/events/"]')].map((x) => x.getAttribute('href')));
  console.log('list links: ' + JSON.stringify(links));

  // cleanup both
  for (const x of [a, b]) {
    if (x && x.id) {
      const s = await p.evaluate(async (id) => (await fetch(`/api/admin/activities?id=${id}`, { method: 'DELETE', credentials: 'include' })).status, x.id);
      console.log('deleted ' + x.slug + ' -> ' + s);
    }
  }
  const fin = await p.evaluate(async () => (await (await fetch('/api/admin/activities', { credentials: 'include' })).json()));
  console.log('remaining: ' + JSON.stringify(fin.activities.map((x) => x.slug)));
  await browser.close();
})();
