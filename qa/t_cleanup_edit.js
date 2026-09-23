const {BASE,SHOT,launch,login,clickByText}=require('/workspace/msw/qa/lib.js');
const ACT_NAME='pretest_中文測試活動';
(async()=>{
const b=await launch();const p=await b.newPage();
p.on('dialog',d=>{console.log('DIALOG',d.type(),d.message());d.accept();});
await login(p,'admin@msw.mo','msw2026admin');
await p.goto(BASE+'/admin',{waitUntil:'networkidle2'});await new Promise(r=>setTimeout(r,2500));
await clickByText(p,'活動管理'); await new Promise(r=>setTimeout(r,2500));
const rowsBefore=await p.evaluate((name)=>[...document.querySelectorAll('tr')].map(r=>r.innerText).filter(t=>t.includes(name)),ACT_NAME);
console.log('ROWS_BEFORE_DELETE',JSON.stringify(rowsBefore));
if(rowsBefore.length){
  await p.evaluate((name)=>{
    const rows=[...document.querySelectorAll('tr')];
    const row=rows.find(r=>r.innerText.includes(name));if(!row)return;
    const del=[...row.querySelectorAll('button')].find(b=>/刪除/.test(b.textContent));
    if(del){del.scrollIntoView({block:'center'});del.click();}
  },ACT_NAME);
  await new Promise(r=>setTimeout(r,4000));
  await p.screenshot({path:SHOT+'/R3_18_after_delete.png',fullPage:true});
  const rowsAfter=await p.evaluate((name)=>[...document.querySelectorAll('tr')].map(r=>r.innerText).filter(t=>t.includes(name)),ACT_NAME);
  console.log('ROWS_AFTER_DELETE',JSON.stringify(rowsAfter));
} else { console.log('NO_TEST_ACTIVITY_TO_DELETE'); }
// edit modal save button
await clickByText(p,'活動管理'); await new Promise(r=>setTimeout(r,2500));
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
await b.close();
})().catch(e=>{console.error('FATAL',e.message);process.exit(1)});
