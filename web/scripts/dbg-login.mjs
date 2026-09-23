import { launch, sleep, BASE } from './qa-mem-lib.mjs';
const { browser, page } = await launch();
await page.goto(`${BASE}/login`, { waitUntil: 'networkidle2' });
await sleep(800);
const html = await page.evaluate(() => {
  const inputs = [...document.querySelectorAll('input')].map(i => ({type:i.type, name:i.name, id:i.id, placeholder:i.placeholder, cls:i.className}));
  const btns = [...document.querySelectorAll('button')].map(b => ({text:b.textContent.trim(), type:b.type, cls:b.className.slice(0,60)}));
  return {inputs, btns, url: location.href, text: document.body.innerText.slice(0,500)};
});
console.log(JSON.stringify(html, null, 1));
await browser.close();
