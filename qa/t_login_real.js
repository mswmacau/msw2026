const {BASE,SHOT,launch}=require('/workspace/msw/qa/lib.js');
(async()=>{
const b=await launch();const p=await b.newPage();
const logs=[];p.on('response',r=>{logs.push({s:r.status(),u:r.url().slice(-80),m:r.request().method()});});
await p.goto(BASE+'/login',{waitUntil:'networkidle2'});await new Promise(r=>setTimeout(r,1500));
const inputs=await p.$$('input');console.log('inputs',inputs.length);
await inputs[0].click();await p.keyboard.type('admin@msw.mo');
await inputs[1].click();await p.keyboard.type('msw2026admin');
await p.screenshot({path:SHOT+'/R3_06_admin_login_filled.png'});
const btns=await p.$$('button');const loginBtn=btns.find(async b=>{/登入/.test(await b.evaluate(e=>e.textContent))}); // can't await in find easily
const clickOk=await p.evaluate(()=>{const b=[...document.querySelectorAll('button')].find(x=>/登入/.test(x.textContent));if(b){b.click();return true}return false});
console.log('clicked',clickOk);
await new Promise(r=>setTimeout(r,5000));
console.log('afterLoginUrl',p.url());
console.log('cookies',(await p.cookies()).map(c=>c.name));
await p.screenshot({path:SHOT+'/R3_06_after_login_real.png',fullPage:true});
console.log('logs',JSON.stringify(logs.slice(-10)));
await b.close();
})().catch(e=>{console.error('FATAL',e.message);process.exit(1)});
