// Inspect feature-card icons + reveal animations
const puppeteer = require('puppeteer-core');
const { wait, BASE } = require('./harness');
const CHROME = '/usr/bin/chromium';

(async () => {
  const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu'] });
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });
  await page.goto(BASE + '/', { waitUntil: 'networkidle2', timeout: 30000 });
  await wait(1200);

  // inspect the feature cards region (~y=990..1595)
  const cards = await page.evaluate(() => {
    const sec = [...document.querySelectorAll('section')].find((s) => s.innerText.includes('打破場地與時間限制'));
    if (!sec) return null;
    const html = sec.outerHTML.slice(0, 2500);
    const svgs = sec.querySelectorAll('svg').length;
    const divs = [...sec.querySelectorAll('div')].filter((d) => d.className && /rounded/.test(d.className)).map((d) => ({ cls: String(d.className).slice(0, 80), childHTML: d.innerHTML.slice(0, 120) }));
    return { svgs, divs: divs.slice(0, 8), html };
  });
  console.log('--- feature section ---');
  console.log(JSON.stringify({ svgs: cards && cards.svgs, divs: cards && cards.divs }, null, 2));

  // animation state: are sections hidden before scroll?
  const anim = await page.evaluate(() => {
    return [...document.querySelectorAll('section')].map((s) => {
      const cs = getComputedStyle(s);
      const inner = s.firstElementChild ? getComputedStyle(s.firstElementChild) : null;
      return { cls: String(s.className).slice(0, 40), opacity: cs.opacity, transform: cs.transform, childOpacity: inner ? inner.opacity : null, childTransform: inner ? inner.transform : null };
    });
  });
  console.log('--- anim initial state ---');
  console.log(JSON.stringify(anim, null, 2));

  await browser.close();
})();
