const puppeteer = require('puppeteer-core');
const fs = require('fs');
const { shot, clickText, wait, BASE } = require('./harness');
const CHROME = '/usr/bin/chromium';
const COOKIES = '/workspace/msw/qa/qg_admin_cookies.json';
async function setCookie(b) { for (const c of JSON.parse(fs.readFileSync(COOKIES,'utf8'))) { const n=(s)=>{const v=String(s||'None').toLowerCase();return v==='lax'?'Lax':v==='strict'?'Strict':'None';}; await b.setCookie({name:c.name,value:c.value,domain:c.domain,path:c.path,httpOnly:!!c.httpOnly,secure:!!c.secure,sameSite:n(c.sameSite)}); } }

(async () => {
  const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--no-sandbox','--disable-setuid-sandbox','--disable-dev-shm-usage','--disable-gpu'] });
  await setCookie(browser);
  const admin = await browser.newPage();
  await admin.setViewport({ width: 1440, height: 900 });
  await admin.goto(BASE + '/admin', { waitUntil: 'networkidle2', timeout: 30000 });
  await wait(1600);
  await clickText(admin, '活動管理', { tag: 'button' });
  await wait(1200);
  await clickText(admin, '新增活動');
  await wait(1200);

  const m = await admin.evaluate(() => {
    const modal = [...document.querySelectorAll('div')].find((d) => d.innerText && d.innerText.includes('活動名稱') && d.querySelectorAll('input,textarea').length > 4);
    if (!modal) return { error: 'no modal' };
    const btns = [...modal.querySelectorAll('button')].map((b) => { const r = b.getBoundingClientRect(); return { text: b.innerText.trim(), top: Math.round(r.top), bottom: Math.round(r.bottom), visible: r.top >= 0 && r.bottom <= window.innerHeight, w: Math.round(r.width) }; });
    // find the scrollable ancestor
    let sc = modal; const chain = [];
    while (sc) { const cs = getComputedStyle(sc); chain.push({ tag: sc.tagName, cls: String(sc.className).slice(0,50), overflowY: cs.overflowY, scrollH: sc.scrollHeight, clientH: sc.clientHeight }); sc = sc.parentElement; }
    return {
      modalRect: (() => { const r = modal.getBoundingClientRect(); return { top: Math.round(r.top), bottom: Math.round(r.bottom), h: Math.round(r.height) }; })(),
      winH: window.innerHeight,
      btns,
      chain: chain.slice(0, 6),
    };
  });
  console.log(JSON.stringify(m, null, 2));
  await browser.close();
})();
