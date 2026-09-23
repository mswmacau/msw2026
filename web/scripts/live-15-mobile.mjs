import * as L from './live-lib.mjs';
import fs from 'fs';

const browser = await L.launch();
const out = [];

const ROUTES = [
  ['/', 'live-mobile-home.png', false],
  ['/run', 'live-mobile-run.png', true],
  ['/admin', 'live-mobile-admin.png', true],
];

for (const [route, shotName, needAuth] of ROUTES) {
  const p = await L.newPage(browser, L.MOBILE);
  const rec = { route };
  try {
    if (needAuth) {
      const lg = await L.login(p, 'admin@msw.mo', 'msw2026admin');
      rec.login = lg.path;
    }
    await p.goto(`${L.BASE}${route}`, { waitUntil: 'networkidle2', timeout: 90000 });
    await L.sleep(2500);
    rec.path = p.url().replace(L.BASE, '');
    rec.ov = await L.overflow(p);
    rec.viewport = await p.evaluate(() => ({ w: window.innerWidth, h: window.innerHeight }));
    const s = await L.shot(p, shotName, true);
    rec.shot = shotName;
    rec.shotOk = s.ok;
    rec.shotSize = s.size;
    rec.httpErrors = [...new Set(p.__httpErrors)].slice(0, 6);
  } catch (e) {
    rec.fatal = String(e.message).slice(0, 200);
  }
  out.push(rec);
  await L.closePage(p);
}

console.log(L.dump(out.map((o) => ({
  route: o.route, path: o.path, vw: o.viewport?.w, scrollW: o.ov?.scrollWidth,
  overflow: o.ov?.overflow, offenders: o.ov?.offenders?.slice(0, 4), shotOk: o.shotOk,
}))));
fs.writeFileSync(`${L.SHOTS}/live-mobile-result.json`, JSON.stringify(out, null, 2));
await browser.close();
