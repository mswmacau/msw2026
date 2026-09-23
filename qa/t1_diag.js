const {BASE,SHOT,launch}=require('/workspace/msw/qa/lib.js');
(async()=>{
const b=await launch();const p=await b.newPage();
const logs=[];
p.on('response',r=>{logs.push({s:r.status(),u:r.url().slice(-60),req:r.request().method()});});
await p.goto(BASE+'/login',{waitUntil:'networkidle2'});await new Promise(r=>setTimeout(r,1200));
await p.evaluate(()=>{const i=[...document.querySelectorAll('input')];i[0].value='admin@msw.mo';i[1].value='msw2026admin';i[0].dispatchEvent(new Event('input',{bubbles:true}));i[1].dispatchEvent(new Event('input',{bubbles:true}));});
await p.evaluate(()=>[...document.querySelectorAll('button')].find(b=>/登入/.test(b.textContent))?.click());
await new Promise(r=>setTimeout(r,4000));
await p.goto(BASE+'/admin',{waitUntil:'networkidle2',timeout:60000});await new Promise(r=>setTimeout(r,2500));
await p.evaluate(()=>{const x=document.evaluate("//*[contains(text(),'網站設定')]",document,null,XPathResult.FIRST_ORDERED_NODE_TYPE,null).singleNodeValue;if(x){x.scrollIntoView({block:'center'});x.click();}});
await new Promise(r=>setTimeout(r,3000));
// try direct API update
const cookies=await p.cookies();console.log('COOKIES',cookies.map(c=>c.name));
await p.screenshot({path:SHOT+'/R3_08_admin_settings.png',fullPage:true});
await p.evaluate(()=>{const i=[...document.querySelectorAll('input')].find(e=>e.value==='MSW 街健館');if(i){i.focus();i.select();}});
await p.keyboard.type('pretest_X');
await new Promise(r=>setTimeout(r,500));
await p.evaluate(()=>{const s=[...document.querySelectorAll('button')].find(b=>/儲存全部設定/.test(b.textContent));if(s)s.click();});
await new Promise(r=>setTimeout(r,8000));
await p.screenshot({path:SHOT+'/R3_09_settings_saved.png',fullPage:true});
console.log('URL_AFTER_SAVE',p.url());
console.log('LOGS',JSON.stringify(logs.filter(l=>/admin|settings|login/.test(l.u)).slice(-20)));
await b.close();
})().catch(e=>{console.error('FATAL',e.message);process.exit(1)});
