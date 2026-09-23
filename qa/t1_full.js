const {BASE,SHOT,launch}=require('/workspace/msw/qa/lib.js');
async function setSiteName(p,oldV,newV){
  await p.evaluate((oldV)=>{const i=[...document.querySelectorAll('input')].find(e=>e.value===oldV);if(i){i.focus();i.select();}},oldV);
  await p.keyboard.type(newV);
  await new Promise(r=>setTimeout(r,600));
  await p.evaluate(()=>{const s=[...document.querySelectorAll('button')].find(b=>/儲存全部設定/.test(b.textContent));if(s)s.click();});
  await new Promise(r=>setTimeout(r,6000));
}
(async()=>{
const b=await launch();const p=await b.newPage();
await p.goto(BASE+'/login',{waitUntil:'networkidle2'});await new Promise(r=>setTimeout(r,1200));
await p.evaluate(()=>{const i=[...document.querySelectorAll('input')];i[0].value='admin@msw.mo';i[1].value='msw2026admin';i[0].dispatchEvent(new Event('input',{bubbles:true}));i[1].dispatchEvent(new Event('input',{bubbles:true}));});
await p.evaluate(()=>[...document.querySelectorAll('button')].find(b=>/登入/.test(b.textContent))?.click());
await new Promise(r=>setTimeout(r,4000));
await p.goto(BASE+'/admin',{waitUntil:'networkidle2',timeout:60000});await new Promise(r=>setTimeout(r,2500));
await p.evaluate(()=>{const x=document.evaluate("//*[contains(text(),'網站設定')]",document,null,XPathResult.FIRST_ORDERED_NODE_TYPE,null).singleNodeValue;if(x){x.scrollIntoView({block:'center'});x.click();}});
await new Promise(r=>setTimeout(r,3000));
await p.screenshot({path:SHOT+'/R3_08_admin_settings.png',fullPage:true});
await setSiteName(p,'MSW 街健館','pretest_秦戈測試館');
await p.screenshot({path:SHOT+'/R3_09_settings_saved.png',fullPage:true});
await p.goto(BASE+'/',{waitUntil:'networkidle2'});await new Promise(r2=>setTimeout(r2,2000));
const front=await p.evaluate(()=>({title:document.title,brand:document.querySelector('header a')?.textContent.trim()}));
console.log('FRONT_AFTER_CHANGE',JSON.stringify(front));
await p.screenshot({path:SHOT+'/R3_10_front_name_changed.png',fullPage:true});
// restore
await p.goto(BASE+'/admin',{waitUntil:'networkidle2'});await new Promise(r2=>setTimeout(r2,2500));
await p.evaluate(()=>{const x=document.evaluate("//*[contains(text(),'網站設定')]",document,null,XPathResult.FIRST_ORDERED_NODE_TYPE,null).singleNodeValue;if(x){x.scrollIntoView({block:'center'});x.click();}});
await new Promise(r2=>setTimeout(r2,3000));
await setSiteName(p,'pretest_秦戈測試館','MSW 街健館');
await p.goto(BASE+'/',{waitUntil:'networkidle2'});await new Promise(r2=>setTimeout(r2,2000));
console.log('RESTORED',JSON.stringify(await p.evaluate(()=>({title:document.title,brand:document.querySelector('header a')?.textContent.trim()}))));
await p.screenshot({path:SHOT+'/R3_11_front_name_restored.png',fullPage:true});
await b.close();
})().catch(e=>{console.error('FATAL',e.message);process.exit(1)});
