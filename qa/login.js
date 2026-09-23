const {BASE,SHOT,launch}=require('/workspace/msw/qa/lib.js');
async function login(p,email,pw){
  await p.goto(BASE+'/login',{waitUntil:'networkidle2',timeout:60000});
  await new Promise(r=>setTimeout(r,1000));
  await p.evaluate(()=>{
    const set=(sel,v)=>{const e=document.querySelector(sel);if(e){const s=Object.getOwnPropertyDescriptor(e.constructor.prototype,'value').set;s.call(e,v);e.dispatchEvent(new Event('input',{bubbles:true}));}};
    const inputs=[...document.querySelectorAll('input')];
    const em=inputs.find(i=>i.type==='email'||/email|帳號|信箱/i.test(i.name+i.id+i.placeholder));
    const pw=inputs.find(i=>i.type==='password');
    if(em){const s=Object.getOwnPropertyDescriptor(em.constructor.prototype,'value').set;s.call(em,email);em.dispatchEvent(new Event('input',{bubbles:true}));}
    if(pw){const s=Object.getOwnPropertyDescriptor(pw.constructor.prototype,'value').set;s.call(pw,pw2);pw.dispatchEvent(new Event('input',{bubbles:true}));}
  },email,pw).catch(()=>{});
}
module.exports={login};
