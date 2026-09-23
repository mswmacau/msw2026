import * as L from './live-lib.mjs';

const ROUTES = [
  ['/', 'live-home.png'],
  ['/events', 'live-events.png'],
  ['/run', 'live-run.png'],
  ['/login', 'live-login.png'],
  ['/register', 'live-register-page.png'],
  ['/dashboard', 'live-dashboard-anon.png'],
  ['/admin', 'live-admin-anon.png'],
  ['/leaderboard', 'live-leaderboard.png'],
  ['/about', 'live-about.png'],
];

const out = [];
const browser = await L.launch();

for (const [route, shotName] of ROUTES) {
  const page = await L.newPage(browser);
  let rec = { route };
  try {
    const resp = await page.goto(`${L.BASE}${route}`, { waitUntil: 'networkidle2', timeout: 90000 });
    await L.sleep(1500);
    rec.httpStatus = resp ? resp.status() : null;
    rec.finalUrl = page.url();
    rec.finalPath = page.url().replace(L.BASE, '') || '/';
    rec = { ...rec, ...(await L.pageHealth(page)) };
    rec.css = await L.cssHealth(page);
    const imgs = await L.imgHealth(page);
    rec.images = { total: imgs.length, broken: imgs.filter((i) => !i.ok).map((i) => i.src), healthy: imgs.filter((i) => i.ok).length };
    const s = await L.shot(page, shotName);
    rec.shot = shotName;
    rec.shotOk = s.ok;
    rec.shotSize = s.size;
    rec.httpErrors = [...new Set(page.__httpErrors)].slice(0, 8);
    rec.errors = [...new Set(page.__errors)].slice(0, 6);
  } catch (e) {
    rec.fatal = String(e.message).slice(0, 300);
  }
  out.push(rec);
  console.log(L.dump(rec));
  console.log('-----');
  await L.closePage(page);
}

await browser.close();
console.log('SUMMARY', JSON.stringify(out.map((o) => ({ r: o.route, http: o.httpStatus, to: o.finalPath, err: o.isErrorPage, imgs: o.images?.total, broken: o.images?.broken?.length }))));
