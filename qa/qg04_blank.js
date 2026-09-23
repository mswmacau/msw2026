// Investigate the large blank area on home page
const puppeteer = require('puppeteer-core');
const { shot, wait, BASE } = require('./harness');
const CHROME = '/usr/bin/chromium';

(async () => {
  const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu'] });
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });
  await page.goto(BASE + '/', { waitUntil: 'networkidle2', timeout: 30000 });
  await wait(1500);

  const info = await page.evaluate(() => {
    const out = [];
    document.querySelectorAll('main > *, main section, body > div').forEach((el) => {
      const r = el.getBoundingClientRect();
      out.push({
        tag: el.tagName.toLowerCase(),
        cls: (typeof el.className === 'string' ? el.className : '').slice(0, 60),
        top: Math.round(r.top + window.scrollY),
        h: Math.round(r.height),
        textLen: (el.innerText || '').trim().length,
        imgs: el.querySelectorAll('img').length,
        imgsBroken: [...el.querySelectorAll('img')].filter((i) => i.complete && i.naturalWidth === 0).length,
      });
    });
    return {
      docHeight: document.documentElement.scrollHeight,
      sections: out,
    };
  });
  console.log(JSON.stringify(info, null, 2));

  // scroll through to trigger lazy content and catch broken images
  const broken = [];
  page.on('response', (r) => { if (r.status() >= 400) broken.push(r.status() + ' ' + r.url()); });
  for (let y = 0; y < info.docHeight; y += 700) {
    await page.evaluate((y) => window.scrollTo(0, y), y);
    await wait(250);
  }
  await wait(1500);
  await page.evaluate(() => window.scrollTo(0, 0));
  await wait(500);

  const imgs = await page.evaluate(() => [...document.querySelectorAll('img')].map((i) => ({ src: i.currentSrc || i.src, w: i.naturalWidth, complete: i.complete })).filter((i) => i.complete && i.w === 0));
  console.log('--- broken imgs after scroll ---');
  console.log(JSON.stringify(imgs.slice(0, 20), null, 2));
  console.log('--- HTTP >=400 ---');
  console.log([...new Set(broken)].join('\n') || '(none)');

  await shot(page, 'A07_home_after_scroll');

  // viewport-only shot of the blank band (~y=1300)
  await page.evaluate(() => window.scrollTo(0, 1250));
  await wait(400);
  await shot(page, 'A07_blank_band_viewport', false);

  await browser.close();
})();
