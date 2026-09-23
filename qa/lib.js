const puppeteer = require('/workspace/msw/web/node_modules/puppeteer-core');
const BASE = 'https://a6dd31b4ad670a126.app.workbuddy.host';
const SHOT = '/workspace/msw/qa-screenshots';
async function launch(viewport={width:1440,height:900}){
  return puppeteer.launch({executablePath:'/usr/bin/chromium',headless:'new',
    args:['--no-sandbox','--disable-dev-shm-usage','--disable-gpu','--no-proxy-server','--font-render-hinting=none'],
    defaultViewport:viewport});
}
async function login(p,email,pw){
  await p.goto(BASE+'/login',{waitUntil:'networkidle2',timeout:60000});
  await new Promise(r=>setTimeout(r,1200));
  const inputs=await p.$$('input');
  if(inputs.length<2) throw new Error('login inputs missing');
  await inputs[0].click();await p.keyboard.type(email);
  await inputs[1].click();await p.keyboard.type(pw);
  await p.evaluate(()=>{const b=[...document.querySelectorAll('button')].find(x=>/登入/.test(x.textContent));if(b)b.click();});
  await new Promise(r=>setTimeout(r,4500));
  const url=p.url();
  if(url.includes('/login')) throw new Error('login failed');
  return url;
}
async function findInputByLabel(p,labelText){
  return p.evaluateHandle((txt)=>{
    const labels=[...document.querySelectorAll('label')].filter(l=>l.textContent.includes(txt));
    let i=labels[0]?.querySelector('input,textarea,select');
    if(!i && labels[0]){ i=labels[0].nextElementSibling; if(i && (i.tagName==='INPUT'||i.tagName==='TEXTAREA'||i.tagName==='SELECT')) return i; }
    if(!i){ i=[...document.querySelectorAll('input,textarea,select')].find(e=>e.placeholder?.includes(txt)); }
    return i;
  },labelText);
}
async function setInputByLabel(p,labelText,value){
  const h=await findInputByLabel(p,labelText);
  const el=await h.asElement();if(!el) throw new Error('input not found: '+labelText);
  await el.click();await el.evaluate(e=>e.select());
  await p.keyboard.type(value);
  await new Promise(r=>setTimeout(r,400));
}
async function clickByText(p,txt){
  await p.evaluate((txt)=>{const x=document.evaluate(`//*[contains(text(),'${txt}')]`,document,null,XPathResult.FIRST_ORDERED_NODE_TYPE,null).singleNodeValue;if(x){x.scrollIntoView({block:'center'});x.click();}},txt);
  await new Promise(r=>setTimeout(r,500));
}
module.exports={puppeteer,BASE,SHOT,launch,login,findInputByLabel,setInputByLabel,clickByText};
