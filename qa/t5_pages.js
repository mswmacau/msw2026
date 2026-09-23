const {BASE,SHOT,launch}=require('/workspace/msw/qa/lib.js');
const paths=['/','/events','/about','/contact','/login','/register','/leaderboard'];
(async()=>{
const b=await launch();const p=await b.newPage();
for(const path of paths){
  const r=await p.goto(BASE+path,{waitUntil:'networkidle2',timeout:45000});
  await new Promise(r2=>setTimeout(r2,900));
  const d=await p.evaluate(()=>{
    const sheets=[...document.styleSheets].length;
    let hasCss=false;
    try{ const nav=document.querySelector('header,nav');
      if(nav) hasCss=getComputedStyle(nav).display!=='inline' && getComputedStyle(nav).position!=='static' || getComputedStyle(document.body).backgroundColor!=='rgba(0, 0, 0, 0)';
    }catch(e){}
    return {title:document.title,bg:getComputedStyle(document.body).backgroundColor,
      sheets, links:document.querySelectorAll('link[rel=stylesheet]').length,
      navH:document.querySelector('header,nav')?.getBoundingClientRect().height||0,
      textLen:document.body.innerText.length};
  });
  console.log(path,'|',r.status(),'|',JSON.stringify(d));
  await p.screenshot({path:SHOT+'/R3_05'+path.replace(/\//g,'_')+'.png',fullPage:false});
}
await b.close();
})().catch(e=>{console.error('FATAL',e.message);process.exit(1)});
