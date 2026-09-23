const {BASE,SHOT,launch}=require('/workspace/msw/qa/lib.js');
(async()=>{
const b=await launch();const p=await b.newPage();
const errs=[];p.on('console',m=>{if(m.type()==='error')errs.push(m.text())});
await p.goto(BASE+'/events',{waitUntil:'networkidle2',timeout:60000});
await new Promise(r=>setTimeout(r,1500));
await p.screenshot({path:SHOT+'/R3_01_events_list.png',fullPage:true});
// find card containing 週末長跑團練
const info=await p.evaluate(()=>{
  const cards=[...document.querySelectorAll('a,article,div')].filter(e=>e.textContent.includes('週末長跑團練'));
  const out=[];
  for(const c of cards){ if(c.children.length>6) continue;
    const a=c.tagName==='A'?c:c.querySelector('a')||c.closest('a');
    out.push({tag:c.tagName,cls:(c.className||'').toString().slice(0,60),href:a?a.getAttribute('href'):null,text:c.textContent.trim().slice(0,80)});
  }
  return out.slice(0,8);
});
console.log('CARDS:',JSON.stringify(info.map(i=>({href:i.href,text:i.text})),null,1));
// click via link href
const target=info.find(i=>i.href);
let status=null,url=null;
if(target){
  url=BASE+target.href;
  const r=await p.goto(url,{waitUntil:'networkidle2',timeout:60000});
  status=r.status();
}else{
  // click element
  const [nav]=await Promise.all([p.waitForNavigation({waitUntil:'networkidle2',timeout:30000}).catch(()=>null),
    p.evaluate(()=>{const els=[...document.querySelectorAll('a')];const e=els.find(x=>x.textContent.includes('週末長跑團練'));if(e)e.click();return !!e})]);
  status=nav?nav.status():null;url=p.url();
}
await new Promise(r=>setTimeout(r,1200));
const page=await p.evaluate(()=>({title:document.title,h1:document.querySelector('h1')?.textContent.trim(),
 body:document.body.innerText.slice(0,600),is404:document.body.innerText.includes('404')||document.title.includes('404')}));
await p.screenshot({path:SHOT+'/R3_02_wp_event_detail.png',fullPage:true});
console.log('URL:',url,'STATUS:',status);
console.log('PAGE:',JSON.stringify(page,null,1));
console.log('CONSOLE_ERR:',errs.slice(0,5));
await b.close();
})().catch(e=>{console.error('FATAL',e.message);process.exit(1)});
