// D: regression - all public pages 200 + CSS loaded + styled (not white/unstyled); mobile 390x844 overflow
const puppeteer = require('puppeteer-core');
const fs = require('fs');
const { shot, wait, BASE } = require('./harness');
const CHROME = '/usr/bin/chromium';
const COOKIES = '/workspace/msw/qa/qg_admin_cookies.json';

async function setCookie(b) { for (const c of JSON.parse(fs.readFileSync(COOKIES, 'utf8'))) { const n = (s) => { const v = String(s || 'None').toLowerCase(); return v === 'lax' ? 'Lax' : v === 'strict' ? 'Strict' : 'None'; }; await b.setCookie({ name: c.name, value: c.value, domain: c.domain, path: c.path, httpOnly: !!c.httpOnly, secure: !!c.secure, sameSite: n(c.sameSite) }); } }

(async () => {
  const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu'] });

  // ---------- 16. desktop pages ----------
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });
  const paths = ['/', '/events', '/about', '/contact', '/login', '/register', '/leaderboard'];
  const rows = [];
  for (const path of paths) {
    const resp = await page.goto(BASE + path, { waitUntil: 'networkidle2', timeout: 30000 });
    await wait(700);
    const info = await page.evaluate(() => {
      const bodyBg = getComputedStyle(document.body).backgroundColor;
      const h1 = document.querySelector('h1');
      const h1Style = h1 ? getComputedStyle(h1) : null;
      let cssRules = 0, sheets = 0, cssErr = 0;
      for (const s of document.styleSheets) { sheets += 1; try { cssRules += s.cssRules.length; } catch (e) { cssErr += 1; } }
      return {
        title: document.title,
        bodyBg,
        textColor: getComputedStyle(document.body).color,
        h1: h1 ? h1.innerText.split('\n')[0].slice(0, 30) : null,
        h1Font: h1Style ? h1Style.fontFamily.split(',')[0] : null,
        h1Size: h1Style ? h1Style.fontSize : null,
        sheets, cssRules, cssErr,
        textLen: document.body.innerText.trim().length,
        tailwindApplied: !!document.querySelector('[class*="bg-ink"], [class*="text-cobaltBright"], [class*="bg-cobaltBright"]'),
      };
    });
    const styled = info.cssRules > 100 && info.bodyBg !== 'rgba(0, 0, 0, 0)' && info.bodyBg !== 'rgb(255, 255, 255)';
    rows.push({ path, http: resp.status(), ...info, styledOK: styled });
  }
  console.table(rows.map((r) => ({ path: r.path, http: r.http, bg: r.bodyBg, rules: r.cssRules, textLen: r.textLen, tw: r.tailwindApplied, styled: r.styledOK })));
  console.log(JSON.stringify(rows, null, 2));
  fs.writeFileSync('/workspace/msw/qa/qg_desktop_report.json', JSON.stringify(rows, null, 2));

  // screenshot each page
  for (const path of paths) {
    await page.goto(BASE + path, { waitUntil: 'networkidle2', timeout: 30000 });
    await wait(600);
    await shot(page, 'D16_page' + path.replace(/\//g, '_'));
  }

  // ---------- 17. mobile 390x844 ----------
  const mob = await browser.newPage();
  await mob.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const mobRows = [];
  for (const path of ['/', '/admin']) {
    await mob.goto(BASE + path, { waitUntil: 'networkidle2', timeout: 30000 });
    await wait(1200);
    const o = await mob.evaluate(() => {
      const de = document.documentElement;
      // find widest offenders
      const offenders = [];
      document.querySelectorAll('*').forEach((el) => {
        const r = el.getBoundingClientRect();
        if (r.width > window.innerWidth + 1 && r.right > window.innerWidth + 1) {
          offenders.push({ tag: el.tagName.toLowerCase(), cls: String(el.className).slice(0, 60), w: Math.round(r.width), right: Math.round(r.right) });
        }
      });
      return {
        scrollWidth: de.scrollWidth,
        innerWidth: window.innerWidth,
        overflow: de.scrollWidth - window.innerWidth,
        offenders: offenders.slice(0, 8),
      };
    });
    mobRows.push({ path, ...o, ok: o.scrollWidth <= o.innerWidth });
    await shot(mob, 'D17_mobile' + path.replace(/\//g, '_'));
  }
  console.log('--- MOBILE 390x844 ---');
  console.log(JSON.stringify(mobRows, null, 2));

  await browser.close();
})();
