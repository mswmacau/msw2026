const {BASE,SHOT,launch}=require('/workspace/msw/qa/lib.js');
const setVal=`(el,v)=>{const s=Object.getOwnPropertyDescriptor(el.constructor.prototype,'value').set;s.call(el,v);el.dispatchEvent(new Event('input',{bubbles:true}));}`;
(async()=>{
const b=await launch();const p=await b.newPage();
p.on('console',m=>{if(m.type()==='error')console.log('CERR',m.text().slice(0,120))});
await p.goto(BASE+'/login',{waitUntil:'networkidle2',timeout:60000});
await new Promise(r=>setTimeout(r,1200));
const fields=await p.evaluate(()=>[...document.querySelectorAll('input')].map(i=>({t:i.type,n:i.name,id:i.id,ph:i.placeholder})));
console.log('LOGIN_FIELDS',JSON.stringify(fields));
await p.evaluate((sv,email,pw)=>{
  const inputs=[...document.querySelectorAll('input')];
  const em=inputs.find(i=>i.type==='email')||inputs[0];
  const pwi=inputs.find(i=>i.type==='password');
  const set=eval(sv);
  set(em,email);set(pwi,pw);
},setVal,'admin@msw.mo','msw2026admin');
await new Promise(r=>setTimeout(r,500));
await p.screenshot({path:SHOT+'/R3_06_admin_login_filled.png'});
await p.evaluate(()=>{const btn=[...document.querySelectorAll('button')].find(b=>/登入|登錄|Sign|Log/i.test(b.textContent));if(btn)btn.click();return btn?btn.textContent:null});
await new Promise(r=>setTimeout(r,4000));
console.log('AFTER_LOGIN_URL',p.url());
await p.screenshot({path:SHOT+'/R3_06_after_login.png',fullPage:true});
const body=await p.evaluate(()=>document.body.innerText.slice(0,300));
console.log('BODY',body.replace(/\n+/g,' | '));
await b.close();
})().catch(e=>{console.error('FATAL',e.message);process.exit(1)});
