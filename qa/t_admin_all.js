const {BASE,SHOT,launch,login,setInputByLabel,clickByText}=require('/workspace/msw/qa/lib.js');
const ACT_NAME='pretest_中文測試活動';
async function openSettings(p){
  await clickByText(p,'網站設定'); await new Promise(r=>setTimeout(r,2500));
}
async function setSiteName(p,oldV,newV){
  await p.evaluate((oldV)=>{const i=[...document.querySelectorAll('input')].find(e=>e.value===oldV);if(i){i.focus();i.select();}},oldV);
  await p.keyboard.type(newV); await new Promise(r=>setTimeout(r,600));
  await p.evaluate(()=>{const s=[...document.querySelectorAll('button')].find(b=>/儲存全部設定/.test(b.textContent));if(s)s.click();});
  await new Promise(r=>setTimeout(r,5000));
}
async function openActivities(p){
  await clickByText(p,'活動管理'); await new Promise(r=>setTimeout(r,2500));
}
(async()=>{
const b=await launch();const p=await b.newPage();
const logs=[];p.on('response',r=>{logs.push({s:r.status(),u:r.url().slice(-70),m:r.request().method()});});
// 1 login
await login(p,'admin@msw.mo','msw2026admin');
// 1a admin home
await p.goto(BASE+'/admin',{waitUntil:'networkidle2'});await new Promise(r=>setTimeout(r,2500));
await p.screenshot({path:SHOT+'/R3_07_admin_home.png',fullPage:true});
// 1b change site name
await openSettings(p);
await p.screenshot({path:SHOT+'/R3_08_admin_settings.png',fullPage:true});
await setSiteName(p,'MSW 街健館','pretest_秦戈測試館');
await p.screenshot({path:SHOT+'/R3_09_settings_saved.png',fullPage:true});
await p.goto(BASE+'/',{waitUntil:'networkidle2'});await new Promise(r=>setTimeout(r,1800));
const front1=await p.evaluate(()=>({title:document.title,brand:document.querySelector('header a')?.textContent.trim()}));
console.log('FRONT_AFTER_CHANGE',JSON.stringify(front1));
await p.screenshot({path:SHOT+'/R3_10_front_name_changed.png',fullPage:true});
// 1c restore
await p.goto(BASE+'/admin',{waitUntil:'networkidle2'});await new Promise(r=>setTimeout(r,2500));
await openSettings(p);
await setSiteName(p,'pretest_秦戈測試館','MSW 街健館');
await p.goto(BASE+'/',{waitUntil:'networkidle2'});await new Promise(r=>setTimeout(r,1800));
const front2=await p.evaluate(()=>({title:document.title,brand:document.querySelector('header a')?.textContent.trim()}));
console.log('RESTORED',JSON.stringify(front2));
await p.screenshot({path:SHOT+'/R3_11_front_name_restored.png',fullPage:true});

// 2 add activity
await p.goto(BASE+'/admin',{waitUntil:'networkidle2'});await new Promise(r=>setTimeout(r,2500));
await openActivities(p);
await p.screenshot({path:SHOT+'/R3_13_activities_list.png',fullPage:true});
await clickByText(p,'＋ 新增活動'); await new Promise(r=>setTimeout(r,2000));
await setInputByLabel(p,'活動名稱','pretest_中文測試活動');
await setInputByLabel(p,'副標題','R3 自動化副標');
await setInputByLabel(p,'分類標籤','課程');
// leave slug empty
await setInputByLabel(p,'顯示順序','99');
// set image URL via placeholder (skip file input)
await p.evaluate(()=>{const i=[...document.querySelectorAll('input[type=text]')].find(e=>e.placeholder?.includes('/images/'));if(i){i.focus();i.select();}});
await p.keyboard.type('/images/training-outdoor.jpg'); await new Promise(r=>setTimeout(r,400));
await setInputByLabel(p,'時間','測試時間 每週日 10:00');
await setInputByLabel(p,'地點','澳門測試場地');
await setInputByLabel(p,'積分說明','測試積分');
const ta=await p.evaluateHandle(()=>{const labels=[...document.querySelectorAll('label')].filter(l=>l.textContent.includes('活動介紹'));return labels[0]?.nextElementSibling||labels[0]?.querySelector('textarea');});
const taEl=await ta.asElement();if(taEl){await taEl.click();await p.keyboard.type('這是 R3 測試活動介紹。');}
await p.screenshot({path:SHOT+'/R3_14_add_activity_filled.png',fullPage:true});
await p.evaluate(()=>{const s=[...document.querySelectorAll('button')].find(b=>/儲存活動/.test(b.textContent));if(s)s.click();});
await new Promise(r=>setTimeout(r,5000));
await p.screenshot({path:SHOT+'/R3_15_add_activity_saved.png',fullPage:true});
// get generated slug from list
await p.goto(BASE+'/admin',{waitUntil:'networkidle2'});await new Promise(r=>setTimeout(r,2500));
await openActivities(p);
const rows=await p.evaluate((name)=>[...document.querySelectorAll('tr')].map(r=>r.innerText).filter(t=>t.includes(name)),ACT_NAME);
console.log('ACTIVITY_ROWS',JSON.stringify(rows));
const slugMatch=rows[0]?.match(/\/events\/([^\s\n]+)/);
const slug=slugMatch?slugMatch[1]:null;
console.log('GENERATED_SLUG',slug);
// verify frontend
await p.goto(BASE+'/events',{waitUntil:'networkidle2'});await new Promise(r=>setTimeout(r,1800));
const hasCard=await p.evaluate((n)=>document.body.innerText.includes(n),ACT_NAME);
console.log('EVENTS_HAS_CARD',hasCard);
await p.screenshot({path:SHOT+'/R3_16_events_with_test.png',fullPage:true});
if(slug){
  const r=await p.goto(BASE+'/events/'+slug,{waitUntil:'networkidle2'});await new Promise(r2=>setTimeout(r2,1500));
  const detail=await p.evaluate(()=>({title:document.title,h1:document.querySelector('h1')?.textContent?.trim(),notFound:document.body.innerText.includes('404')}));
  console.log('DETAIL',JSON.stringify(detail),'STATUS',r.status());
  await p.screenshot({path:SHOT+'/R3_17_test_activity_detail.png',fullPage:true});
}
// delete test activity
await p.goto(BASE+'/admin',{waitUntil:'networkidle2'});await new Promise(r=>setTimeout(r,2500));
await openActivities(p);
await p.evaluate((name)=>{
  const rows=[...document.querySelectorAll('tr')];
  const row=rows.find(r=>r.innerText.includes(name));if(!row)return;
  const del=[...row.querySelectorAll('button')].find(b=>/刪除/.test(b.textContent));
  if(del){del.scrollIntoView({block:'center'});del.click();}
},ACT_NAME);
await new Promise(r=>setTimeout(r,2500));
// handle confirm if any
await p.evaluate(()=>{const b=[...document.querySelectorAll('button')].find(x=>/確認|確定|刪除/.test(x.textContent));if(b)b.click();});
await new Promise(r=>setTimeout(r,3000));
await p.screenshot({path:SHOT+'/R3_18_after_delete.png',fullPage:true});
const afterRows=await p.evaluate((name)=>[...document.querySelectorAll('tr')].map(r=>r.innerText).filter(t=>t.includes(name)),ACT_NAME);
console.log('AFTER_DELETE_ROWS',JSON.stringify(afterRows));

// 3 edit modal save button visibility
await openActivities(p);
await p.evaluate(()=>{const rows=[...document.querySelectorAll('tr')];const row=rows.find(r=>r.innerText.includes('定期訓練活動'));const edit=[...row.querySelectorAll('button')].find(b=>/編輯/.test(b.textContent));if(edit){edit.scrollIntoView({block:'center'});edit.click();}});
await new Promise(r=>setTimeout(r,2500));
const saveVisible=await p.evaluate(()=>{
  const b=[...document.querySelectorAll('button')].find(x=>/儲存活動/.test(x.textContent));
  if(!b)return null;
  const r=b.getBoundingClientRect();
  return {top:r.top,left:r.left,bottom:r.bottom,right:r.right,vh:window.innerHeight,vw:window.innerWidth,visible:r.top>=0 && r.bottom<=window.innerHeight && r.left>=0 && r.right<=window.innerWidth};
});
console.log('SAVE_BUTTON_VISIBLE',JSON.stringify(saveVisible));
await p.screenshot({path:SHOT+'/R3_12_edit_modal.png',fullPage:false});
// close modal
await p.evaluate(()=>{const b=[...document.querySelectorAll('button')].find(x=>/取消/.test(x.textContent));if(b)b.click();});

console.log('NETWORK',JSON.stringify(logs.filter(l=>/admin|settings|activities|events/.test(l.u)).slice(-20)));
await b.close();
})().catch(e=>{console.error('FATAL',e.message);process.exit(1)});
