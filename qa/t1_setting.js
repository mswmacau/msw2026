const {BASE,SHOT,launch}=require('/workspace/msw/qa/lib.js');
const SV=`(el,v)=>{const s=Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype,'value').set;s.call(el,v);el.dispatchEvent(new Event('input',{bubbles:true}));}`;
const clickByText=(txt)=>{const els=[...document.querySelectorAll('button,a,[role=tab]')];const e=els.find(x=>x.textContent.trim().includes(txt));if(e){e.click();return true}return false};
(async()=>{
const b=await launch();const p=await b.newPage();
// login
await p.goto(BASE+'/login',{waitUntil:'networkidle2'});await new Promise(r=>setTimeout(r,1000));
await p.evaluate((sv)=>{const i=[...document.querySelectorAll('input')];const set=eval(sv);set(i[0],'admin@msw.mo');set(i[1],'msw2026admin');},SV);
await p.evaluate(()=>[...document.querySelectorAll('button')].find(b=>/登入/.test(b.textContent))?.click());
await new Promise(r=>setTimeout(r,3500));
await p.goto(BASE+'/admin',{waitUntil:'networkidle2',timeout:60000});await new Promise(r=>setTimeout(r,2000));
await p.screenshot({path:SHOT+'/R3_07_admin_home.png',fullPage:true});
const tabs=await p.evaluate(()=>[...document.querySelectorAll('button,[role=tab],a')].map(e=>e.textContent.trim()).filter(t=>t&&t.length<20).slice(0,40));
console.log('TABS',JSON.stringify(tabs));
const opened=await p.evaluate((f)=>{const els=[...document.querySelectorAll('button,[role=tab]')];const e=els.find(x=>x.textContent.includes('網站設定'));if(e){e.click();return true}return false});
console.log('OPEN_SETTINGS',opened);
await new Promise(r=>setTimeout(r,2000));
await p.screenshot({path:SHOT+'/R3_08_admin_settings.png',fullPage:true});
const inputs=await p.evaluate(()=>[...document.querySelectorAll('input,textarea')].map((e,i)=>({i,tag:e.tagName,t:e.type,v:e.value.slice(0,30),label:(e.closest('label')?.textContent||e.previousElementSibling?.textContent||'').slice(0,20)})));
console.log('SETTING_INPUTS',JSON.stringify(inputs.slice(0,12)));
await b.close();
})().catch(e=>{console.error('FATAL',e.message);process.exit(1)});
