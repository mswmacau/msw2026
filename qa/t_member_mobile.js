const {BASE,SHOT,launch,login}=require('/workspace/msw/qa/lib.js');
(async()=>{
const b=await launch({width:390,height:844});const p=await b.newPage();
// mobile home
await p.goto(BASE+'/',{waitUntil:'networkidle2'});await new Promise(r=>setTimeout(r,1500));
const homeSw=await p.evaluate(()=>({innerWidth:window.innerWidth,scrollWidth:document.documentElement.scrollWidth,scrollHeight:document.documentElement.scrollHeight,bodyScroll:document.body.scrollWidth,title:document.title}));
console.log('MOBILE_HOME',JSON.stringify(homeSw));
await p.screenshot({path:SHOT+'/R3_22_mobile_home.png',fullPage:false});
// mobile admin (logged out)
await p.goto(BASE+'/admin',{waitUntil:'networkidle2'});await new Promise(r=>setTimeout(r,2000));
const adminSw=await p.evaluate(()=>({innerWidth:window.innerWidth,scrollWidth:document.documentElement.scrollWidth,bodyScroll:document.body.scrollWidth,url:location.href,title:document.title,text:document.body.innerText.slice(0,200)}));
console.log('MOBILE_ADMIN',JSON.stringify(adminSw));
await p.screenshot({path:SHOT+'/R3_23_mobile_admin.png',fullPage:false});
await b.close();

// member flow desktop
const b2=await launch();const p2=await b2.newPage();
await login(p2,'ming@msw.mo','msw2026');
await p2.goto(BASE+'/admin',{waitUntil:'networkidle2'});await new Promise(r=>setTimeout(r,2000));
const adminDeny=await p2.evaluate(()=>({title:document.title,text:document.body.innerText.slice(0,300),url:location.href}));
console.log('MEMBER_ADMIN',JSON.stringify(adminDeny));
await p2.screenshot({path:SHOT+'/R3_19_member_admin_denied.png',fullPage:true});
await p2.goto(BASE+'/dashboard',{waitUntil:'networkidle2'});await new Promise(r=>setTimeout(r,2000));
const dash=await p2.evaluate(()=>({title:document.title,text:document.body.innerText.slice(0,200)}));
console.log('DASHBOARD',JSON.stringify(dash));
await p2.screenshot({path:SHOT+'/R3_20_member_dashboard.png',fullPage:true});
await p2.goto(BASE+'/run',{waitUntil:'networkidle2'});await new Promise(r=>setTimeout(r,2000));
const run=await p2.evaluate(()=>({title:document.title,text:document.body.innerText.slice(0,200)}));
console.log('RUN',JSON.stringify(run));
await p2.screenshot({path:SHOT+'/R3_21_member_run.png',fullPage:true});
await b2.close();
})().catch(e=>{console.error('FATAL',e.message);process.exit(1)});
