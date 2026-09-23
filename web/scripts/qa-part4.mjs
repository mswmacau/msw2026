import {
  launch, newPage, shot, sleep, login, clickText, BASE, MOBILE, overflow,
} from './qa-final-lib.mjs';
import fs from 'fs';

const R = { pages: [], shots: [], menu: null, misc: {} };
const log = (...a) => console.log(...a);

const browser = await launch();
const mem = await newPage(browser, MOBILE);
const adm = await newPage(browser, MOBILE);
const anon = await newPage(browser, MOBILE);

try {
  log('=== 手機登入 ===');
  log('  member:', JSON.stringify(await login(mem, 'ming@msw.mo', 'msw2026')));
  log('  admin :', JSON.stringify(await login(adm, 'admin@msw.mo', 'msw2026admin')));

  const PAGES = [
    { p: '/', file: 'mobile-home', ctx: 'mem' },
    { p: '/events', file: 'mobile-events', ctx: 'mem' },
    { p: '/run', file: 'mobile-run', ctx: 'mem' },
    { p: '/dashboard', file: 'mobile-dashboard', ctx: 'mem' },
    { p: '/admin', file: 'mobile-admin', ctx: 'adm' },
    { p: '/login', file: 'mobile-login', ctx: 'anon' },
  ];
  const CTX = { mem, adm, anon };

  log('\n=== 逐頁截圖 + 橫向溢出偵測 ===');
  for (const { p, file, ctx } of PAGES) {
    const page = CTX[ctx];
    let status = null;
    try {
      const r = await page.goto(`${BASE}${p}`, { waitUntil: 'networkidle2', timeout: 60000 });
      status = r ? r.status() : null;
    } catch (e) { status = 'ERR'; }
    await sleep(2200);

    const ov = await overflow(page);

    // 文字被裁切 / 重疊偵測
    const clip = await page.evaluate(() => {
      const out = [];
      document.querySelectorAll('*').forEach((el) => {
        if (el.children.length > 0) return;
        const txt = (el.textContent || '').trim();
        if (!txt) return;
        const cs = getComputedStyle(el);
        if (cs.overflow === 'hidden' || cs.overflowX === 'hidden') {
          if (el.scrollWidth > el.clientWidth + 2 && el.clientWidth > 0) {
            out.push(`${el.tagName.toLowerCase()} "${txt.slice(0, 24)}" ${el.clientWidth}<${el.scrollWidth}`);
          }
        }
      });
      return out.slice(0, 6);
    });

    // 過小可點擊元件（<32px）
    const small = await page.evaluate(() => {
      const out = [];
      document.querySelectorAll('a,button').forEach((el) => {
        const r = el.getBoundingClientRect();
        if (r.width === 0 || r.height === 0) return;
        if (r.height < 32 || r.width < 32) {
          out.push(`${el.tagName.toLowerCase()} "${(el.textContent || '').trim().slice(0, 18)}" ${Math.round(r.width)}x${Math.round(r.height)}`);
        }
      });
      return out.slice(0, 8);
    });

    // 表格容器可否橫向滾動（/admin）
    const table = await page.evaluate(() => {
      const t = document.querySelector('table');
      if (!t) return null;
      let wrap = t.parentElement;
      let scrollable = null;
      for (let i = 0; i < 4 && wrap; i++) {
        const cs = getComputedStyle(wrap);
        if (cs.overflowX === 'auto' || cs.overflowX === 'scroll') {
          scrollable = { tag: wrap.tagName, overflowX: cs.overflowX, canScroll: wrap.scrollWidth > wrap.clientWidth };
          break;
        }
        wrap = wrap.parentElement;
      }
      return {
        tableW: Math.round(t.scrollWidth),
        viewportW: window.innerWidth,
        overflowXStyle: getComputedStyle(t.parentElement).overflowX,
        scrollable,
      };
    });

    const s = await shot(page, `${file}.png`);
    R.pages.push({ p, ctx, status, overflow: ov, clipped: clip, smallTargets: small, table, shot: s });
    R.shots.push(s);
    log(
      `  ${p.padEnd(12)} [${ctx}] ${status} overflow=${ov.overflow} (sw=${ov.scrollWidth}/iw=${ov.innerWidth}) clipped=${clip.length} small=${small.length}`
    );
    if (ov.overflow && ov.offenders.length) log(`      offenders: ${ov.offenders.slice(0, 4).join(' | ')}`);
    if (clip.length) log(`      clipped: ${clip.slice(0, 3).join(' | ')}`);
    if (small.length) log(`      small: ${small.slice(0, 4).join(' | ')}`);
    if (table) log(`      table: ${JSON.stringify(table)}`);
  }

  log('\n=== 漢堡選單 ===');
  await mem.goto(`${BASE}/`, { waitUntil: 'networkidle2', timeout: 60000 });
  await sleep(1800);
  const burger = await mem.evaluate(() => {
    const b = document.querySelector('button[aria-label="選單"]');
    if (!b) return { exists: false };
    const r = b.getBoundingClientRect();
    const cs = getComputedStyle(b);
    return { exists: true, visible: cs.display !== 'none' && r.width > 0, size: `${Math.round(r.width)}x${Math.round(r.height)}` };
  });
  R.misc.burger = burger;
  log('  burger:', JSON.stringify(burger));

  const opened = await mem.evaluate(() => {
    const b = document.querySelector('button[aria-label="選單"]');
    if (!b) return false;
    b.click();
    return true;
  });
  await sleep(1500);
  const menu = await mem.evaluate(() => {
    const nav = document.querySelector('nav');
    const lists = [...document.querySelectorAll('nav ~ div ul, div ul')];
    const links = [...document.querySelectorAll('a')]
      .filter((a) => {
        const r = a.getBoundingClientRect();
        return r.width > 0 && r.height > 0 && r.top < window.innerHeight && r.top > 60;
      })
      .map((a) => ({ t: a.textContent.trim().slice(0, 14), href: a.getAttribute('href'), h: Math.round(a.getBoundingClientRect().height) }));
    return { linkCount: links.length, links: links.slice(0, 12) };
  });
  R.menu = { opened, ...menu };
  log('  menu:', JSON.stringify(R.menu).slice(0, 400));
  R.shots.push(await shot(mem, 'mobile-menu-open.png'));

  // 點擊選單內連結
  const clicked = await mem.evaluate(() => {
    const a = [...document.querySelectorAll('a')].find(
      (x) => x.getAttribute('href') === '/events' && x.getBoundingClientRect().top > 60
    );
    if (!a) return null;
    a.click();
    return a.getAttribute('href');
  });
  await sleep(2500);
  R.misc.menuNavTarget = clicked;
  R.misc.urlAfterMenuClick = mem.url();
  log(`  clicked link ${clicked} -> ${mem.url()}`);

  // 管理後台在手機上的表格（切到會員 tab）
  await adm.goto(`${BASE}/admin`, { waitUntil: 'networkidle2', timeout: 60000 });
  await sleep(2000);
  await clickText(adm, '會員');
  await sleep(2000);
  const adminOv = await overflow(adm);
  const adminTable = await adm.evaluate(() => {
    const t = document.querySelector('table');
    if (!t) return null;
    let w = t.parentElement, sc = null;
    for (let i = 0; i < 4 && w; i++) {
      const cs = getComputedStyle(w);
      if (cs.overflowX === 'auto' || cs.overflowX === 'scroll') { sc = { tag: w.tagName, canScroll: w.scrollWidth > w.clientWidth, sw: w.scrollWidth, cw: w.clientWidth }; break; }
      w = w.parentElement;
    }
    return { tableSW: t.scrollWidth, viewport: window.innerWidth, wrapper: sc };
  });
  R.misc.adminMobile = { overflow: adminOv.overflow, scrollWidth: adminOv.scrollWidth, innerWidth: adminOv.innerWidth, table: adminTable };
  log('  /admin mobile:', JSON.stringify(R.misc.adminMobile));
  R.shots.push(await shot(adm, 'mobile-admin-members.png'));

  R.errors = {
    mem: mem.__errors.filter((e) => !e.includes('_rsc')).slice(0, 10),
    adm: adm.__errors.filter((e) => !e.includes('_rsc')).slice(0, 10),
    anon: anon.__errors.filter((e) => !e.includes('_rsc')).slice(0, 10),
  };
} catch (e) {
  R.fatal = String(e.stack || e.message);
  log('!!! FATAL ' + e.message);
} finally {
  fs.writeFileSync('/workspace/msw/web/scripts/qa-part4.json', JSON.stringify(R, null, 2));
  log('\n===== PART4 DONE =====');
  await browser.close();
}
