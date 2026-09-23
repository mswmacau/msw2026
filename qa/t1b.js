const {BASE,SHOT,launch}=require('/workspace/msw/qa/lib.js');
const slug='%e9%80%b1%e6%9c%ab%e9%95%b7%e8%b7%91%e5%9c%98%e7%b7%b4';
(async()=>{
const b=await launch();const p=await b.newPage();
const errs=[];p.on('console',m=>{if(m.type()==='error')errs.push(m.text())});
p.on('response',r=>{if(r.url().includes('/events/'))console.log('RESP',r.status(),r.url().slice(-60))});
await p.goto(BASE+'/events',{waitUntil:'networkidle2',timeout:60000});
await new Promise(r=>setTimeout(r,1200));
// precise: smallest anchor containing the text
const href=await p.evaluate(()=>{
  const as=[...document.querySelectorAll('a')].filter(a=>a.textContent.includes('週末長跑團練'));
  as.sort((x,y)=>x.textContent.length-y.textContent.length);
  const a=as[0];
  if(a){a.scrollIntoView({block:'center'});return a.getAttribute('href');}
  return null;});
console.log('TARGET_HREF:',href);
await new Promise(r=>setTimeout(r,400));
await p.screenshot({path:SHOT+'/R3_01_events_list.png',fullPage:true});
let status=null;
const [nav]=await Promise.all([
  p.waitForNavigation({waitUntil:'networkidle2',timeout:45000}).catch(e=>null),
  p.evaluate(()=>{const as=[...document.querySelectorAll('a')].filter(a=>a.textContent.includes('週末長跑團練'));as.sort((x,y)=>x.textContent.length-y.textContent.length);as[0].click();})
]);
status=nav?nav.status():'no-nav';
await new Promise(r=>setTimeout(r,1500));
const page=await p.evaluate(()=>({url:location.pathname,title:document.title,h1:document.querySelector('h1')?.textContent.trim(),
 body:document.body.innerText.replace(/\n{2,}/g,'\n').slice(0,900),
 is404:/404/.test(document.title)||document.body.innerText.includes('404'),
 bg:getComputedStyle(document.body).backgroundColor, css:document.styleSheets.length}));
await p.screenshot({path:SHOT+'/R3_02_wp_event_detail.png',fullPage:true});
console.log('CLICK_STATUS:',status);
console.log(JSON.stringify(page,null,1));
// also test raw slug & api
for(const u of ['/events/週末長跑團練','/events/'+slug]){
  const r=await p.goto(BASE+u,{waitUntil:'domcontentloaded',timeout:30000});
  console.log('DIRECT',u.slice(0,40),r.status());
}
console.log('ERRS',errs.slice(0,4));
await b.close();
})().catch(e=>{console.error('FATAL',e.message);process.exit(1)});
