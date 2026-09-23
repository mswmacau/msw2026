const {BASE,SHOT,launch,login,setInputByLabel,clickByText}=require('/workspace/msw/qa/lib.js');
const ACT_NAME='中文測試活動';
(async()=>{
const b=await launch();const p=await b.newPage();
p.on('dialog',d=>{console.log('DIALOG',d.type(),d.message());d.accept();});
await login(p,'admin@msw.mo','msw2026admin');
await p.goto(BASE+'/admin',{waitUntil:'networkidle2'});await new Promise(r=>setTimeout(r,2500));
await clickByText(p,'活動管理'); await new Promise(r=>setTimeout(r,2500));
await p.evaluate(()=>{const b=[...document.querySelectorAll('button')].find(x=>/新增活動/.test(x.textContent));if(b)b.click();});
await new Promise(r=>setTimeout(r,2000));
await setInputByLabel(p,'活動名稱','中文測試活動');
await setInputByLabel(p,'副標題','純中文副標');
await setInputByLabel(p,'分類標籤','課程');
await setInputByLabel(p,'顯示順序','100');
await p.evaluate(()=>{const i=[...document.querySelectorAll('input[type=text]')].find(e=>e.placeholder?.includes('/images/'));if(i){i.focus();i.select();}});
await p.keyboard.type('/images/training-outdoor.jpg'); await new Promise(r=>setTimeout(r,400));
await setInputByLabel(p,'時間','每週五 18:00');
await setInputByLabel(p,'地點','澳門純中文測試');
await setInputByLabel(p,'積分說明','測試積分');
const ta=await p.evaluateHandle(()=>{const labels=[...document.querySelectorAll('label')].filter(l=>l.textContent.includes('活動介紹'));return labels[0]?.nextElementSibling||labels[0]?.querySelector('textarea');});
const taEl=await ta.asElement();if(taEl){await taEl.click();await p.keyboard.type('純中文測試活動介紹。');}
await p.screenshot({path:SHOT+'/R3_24_pure_chinese_add.png',fullPage:true});
await p.evaluate(()=>{const s=[...document.querySelectorAll('button')].find(b=>/儲存活動/.test(b.textContent));if(s)s.click();});
await new Promise(r=>setTimeout(r,6000));
await p.screenshot({path:SHOT+'/R3_25_pure_chinese_saved.png',fullPage:true});
// get slug
await p.goto(BASE+'/admin',{waitUntil:'networkidle2'});await new Promise(r=>setTimeout(r,2500));
await clickByText(p,'活動管理'); await new Promise(r=>setTimeout(r,2500));
const rows=await p.evaluate((name)=>[...document.querySelectorAll('tr')].map(r=>r.innerText).filter(t=>t.includes(name)),ACT_NAME);
console.log('ROWS',JSON.stringify(rows));
const slug=rows[0]?.match(/\/events\/([^\s\n]+)/)?.[1]||null;
console.log('SLUG',slug);
// frontend
await p.goto(BASE+'/events',{waitUntil:'networkidle2'});await new Promise(r=>setTimeout(r,1800));
const hasCard=await p.evaluate((n)=>document.body.innerText.includes(n),ACT_NAME);
console.log('HAS_CARD',hasCard);
await p.screenshot({path:SHOT+'/R3_26_pure_chinese_events.png',fullPage:true});
if(slug){
  const r=await p.goto(BASE+'/events/'+slug,{waitUntil:'networkidle2'});await new Promise(r2=>setTimeout(r2,1500));
  const detail=await p.evaluate(()=>({title:document.title,h1:document.querySelector('h1')?.textContent?.trim(),notFound:document.body.innerText.includes('404')}));
  console.log('DETAIL',JSON.stringify(detail),'STATUS',r.status());
  await p.screenshot({path:SHOT+'/R3_27_pure_chinese_detail.png',fullPage:true});
}
// delete
await p.goto(BASE+'/admin',{waitUntil:'networkidle2'});await new Promise(r=>setTimeout(r,2500));
await clickByText(p,'活動管理'); await new Promise(r=>setTimeout(r,2500));
await p.evaluate((name)=>{
  const rows=[...document.querySelectorAll('tr')];
  const row=rows.find(r=>r.innerText.includes(name));if(!row)return;
  const del=[...row.querySelectorAll('button')].find(b=>/刪除/.test(b.textContent));
  if(del){del.scrollIntoView({block:'center'});del.click();}
},ACT_NAME);
await new Promise(r=>setTimeout(r,4000));
await p.screenshot({path:SHOT+'/R3_28_pure_chinese_deleted.png',fullPage:true});
const after=await p.evaluate((name)=>[...document.querySelectorAll('tr')].map(r=>r.innerText).filter(t=>t.includes(name)),ACT_NAME);
console.log('AFTER_DELETE',JSON.stringify(after));
await b.close();
})().catch(e=>{console.error('FATAL',e.message);process.exit(1)});
