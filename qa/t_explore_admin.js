const {BASE,SHOT,launch,login}=require('/workspace/msw/qa/lib.js');
(async()=>{
const b=await launch();const p=await b.newPage();
await login(p,'admin@msw.mo','msw2026admin');
await p.goto(BASE+'/admin',{waitUntil:'networkidle2'});await new Promise(r=>setTimeout(r,2500));
await p.evaluate(()=>{const x=document.evaluate("//*[contains(text(),'活動管理')]",document,null,XPathResult.FIRST_ORDERED_NODE_TYPE,null).singleNodeValue;if(x){x.scrollIntoView({block:'center'});x.click();}});
await new Promise(r=>setTimeout(r,2500));
await p.screenshot({path:SHOT+'/R3_explore_activities.png',fullPage:true});
const info=await p.evaluate(()=>({btns:[...document.querySelectorAll('button')].map(b=>b.textContent.trim()).slice(0,30),
  inputs:[...document.querySelectorAll('input,textarea,select')].map(e=>({t:e.tagName,type:e.type||e.tagName,ph:e.placeholder||'',v:e.value.slice(0,30)})).slice(0,20),
  text:document.body.innerText.slice(0,600)}));
console.log(JSON.stringify(info,null,1));
await b.close();
})().catch(e=>{console.error('FATAL',e.message);process.exit(1)});
