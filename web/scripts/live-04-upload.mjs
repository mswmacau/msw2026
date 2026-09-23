import * as L from './live-lib.mjs';
import fs from 'fs';

const reg = JSON.parse(fs.readFileSync(`${L.SHOTS}/live-reg-result.json`, 'utf8'));
const EMAIL = reg.EMAIL;
const PASS = reg.PASS;
const KM = '7.77';

const browser = await L.launch();
const out = { EMAIL, KM };

// 以新會員身分登入，避免沿用上一支腳本已關閉的 session
const page = await L.newPage(browser);
const fileReqs = [];
page.on('response', (r) => {
  if (/\/api\/upload|uploads?\//i.test(r.url())) fileReqs.push(`${r.status()} ${r.url().replace(L.BASE, '')}`);
});

const lg = await L.login(page, EMAIL, PASS);
out.login = { url: lg.url, path: lg.url.replace(L.BASE, '') };
if (!/dashboard|run/.test(lg.url)) {
  out.loginFailed = true;
  console.log(L.dump(out));
  await browser.close();
  process.exit(0);
}

await page.goto(`${L.BASE}/run`, { waitUntil: 'networkidle2', timeout: 90000 });
await L.sleep(1500);
out.runForm = await L.formInfo(page);
out.beforeUpload = await L.readRun(page);

// 找檔案 input 上傳
const fileInput = await page.$('input[type=file]');
out.hasFileInput = !!fileInput;
if (fileInput) {
  await fileInput.uploadFile(L.IMG);
}
await L.sleep(2000);

// 填公里數（number input）
const filled = await page.evaluate(
  ({ KM }) => {
    const set = (el, v) => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(el, v);
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
    };
    const ins = [...document.querySelectorAll('input')];
    const nums = ins.filter((i) => i.type === 'number' || /km|公里/i.test(i.placeholder || ''));
    const notes = ins.filter((i) => i.tagName === 'TEXTAREA' || /備註|感想|描述/i.test(i.placeholder || ''));
    if (nums[0]) set(nums[0], KM);
    if (notes[0]) set(notes[0], 'live 測試上傳');
    return { numCount: nums.length, noteCount: notes.length, types: ins.map((i) => i.type) };
  },
  { KM }
);
out.filled = filled;
await L.sleep(600);

// 送前先看是否已有縮圖預覽
out.previewBefore = await L.imgHealth(page);
await L.shot(page, 'live-upload-form.png', true);

let clicked = await L.clickText(page, '送出');
if (!clicked) clicked = await L.clickText(page, '上傳');
if (!clicked) clicked = await L.clickText(page, '提交');
out.clicked = clicked;
await L.sleep(8000);

out.dialogs = page.__dialogs;
out.httpErrors = [...new Set(page.__httpErrors)].slice(0, 10);
out.fileReqs = [...new Set(fileReqs)];
out.afterUploadText = (await L.bodyText(page)).slice(0, 900);
out.afterUpload = await L.readRun(page);
out.previewAfter = await L.imgHealth(page);

const s = await L.shot(page, 'live-upload.png', true);
out.uploadShot = { ok: s.ok, size: s.size };
out.uploadShotOk = s.ok;

fs.writeFileSync(`${L.SHOTS}/live-upload-result.json`, JSON.stringify(out, null, 2));
console.log(L.dump({ ...out, afterUploadText: out.afterUploadText.slice(0, 400) }));
await browser.close();
