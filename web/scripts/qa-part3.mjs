import { launch, newPage, shot, sleep, login, BASE, DESKTOP } from './qa-final-lib.mjs';
import fs from 'fs';

const R = { pages: [], shots: [] };
const log = (...a) => console.log(...a);

const browser = await launch();
const anon = await newPage(browser, DESKTOP);
const mem = await newPage(browser, DESKTOP);
const adm = await newPage(browser, DESKTOP);

try {
  log('=== 登入 ===');
  log('  member:', JSON.stringify(await login(mem, 'ming@msw.mo', 'msw2026')));
  log('  admin :', JSON.stringify(await login(adm, 'admin@msw.mo', 'msw2026admin')));

  const PAGES = [
    { p: '/', file: 'desktop-home', ctx: 'mem' },
    { p: '/events', file: 'desktop-events', ctx: 'mem' },
    { p: '/run', file: 'desktop-run', ctx: 'mem' },
    { p: '/dashboard', file: 'desktop-dashboard', ctx: 'mem' },
    { p: '/admin', file: 'desktop-admin', ctx: 'adm' },
    { p: '/leaderboard', file: 'desktop-leaderboard', ctx: 'mem' },
    { p: '/about', file: 'desktop-about', ctx: 'mem' },
    { p: '/faq', file: 'desktop-faq', ctx: 'mem' },
    { p: '/contact', file: 'desktop-contact', ctx: 'mem' },
    { p: '/settings', file: 'desktop-settings', ctx: 'mem' },
    { p: '/login', file: 'desktop-login', ctx: 'anon' },
    { p: '/register', file: 'desktop-register', ctx: 'anon' },
  ];
  const CTX = { mem, adm, anon };

  for (const { p, file, ctx } of PAGES) {
    const page = CTX[ctx];
    let status = null;
    try {
      const resp = await page.goto(`${BASE}${p}`, { waitUntil: 'networkidle2', timeout: 60000 });
      status = resp ? resp.status() : null;
    } catch (e) { status = 'ERR:' + e.message.slice(0, 60); }
    await sleep(1800);
    const info = await page.evaluate(() => {
      const t = document.body.innerText;
      return {
        title: document.title,
        is404: /could not be found|This page could not be found|404/i.test(t),
        scrollH: document.documentElement.scrollHeight,
        textLen: t.length,
      };
    });
    const s = await shot(page, `${file}.png`);
    R.pages.push({ p, ctx, status, ...info, shot: s });
    log(`  ${p.padEnd(14)} [${ctx}] status=${status} 404=${info.is404} shot=${s.ok ? s.size : 'FAIL'}`);
    R.shots.push(s);
  }

  // 首頁往下滾動的內文區
  await mem.goto(`${BASE}/`, { waitUntil: 'networkidle2', timeout: 60000 });
  await sleep(1500);
  await mem.evaluate(() => window.scrollBy(0, window.innerHeight * 0.95));
  await sleep(2200);
  await mem.evaluate(() => window.scrollBy(0, 300));
  await sleep(1800);
  R.shots.push(await shot(mem, 'desktop-home-2.png'));
  await mem.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await sleep(2000);
  R.shots.push(await shot(mem, 'desktop-home-3.png'));
  log('  home scroll shots done');

  R.errors = {
    mem: mem.__errors.filter((e) => !e.includes('_rsc')).slice(0, 12),
    adm: adm.__errors.filter((e) => !e.includes('_rsc')).slice(0, 12),
    anon: anon.__errors.filter((e) => !e.includes('_rsc')).slice(0, 12),
  };
} catch (e) {
  R.fatal = String(e.stack || e.message);
} finally {
  fs.writeFileSync('/workspace/msw/web/scripts/qa-part3.json', JSON.stringify(R, null, 2));
  log('\n===== PART3 DONE =====');
  await browser.close();
}
