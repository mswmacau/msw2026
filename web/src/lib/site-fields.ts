/**
 * 網站設定的「純資料」層：不含任何資料庫／伺服器依賴，
 * 因此可以安全地給客戶端元件（後台表單）直接 import。
 */

/** 網站設定預設值：後台沒有填的欄位就用這裡的值 */
export const DEFAULT_SETTINGS: Record<string, string> = {
  site_name: 'MSW 街健館',
  site_tagline: 'MACAU STREET WORKOUT',
  site_logo: '', // 留空則顯示文字 Logo
  site_description: '澳門街頭健身社群 — 定期訓練、月度累積跑、會員積分',

  hero_badge: '澳門街頭健身社群 · MACAU STREET WORKOUT',
  hero_title: '一起練，一起跑',
  hero_title_highlight: '走得比一個人更遠',
  hero_subtitle:
    'MSW 街健館讓你在澳門任何角落都能開始訓練。每週一晚上八點的定期訓練、每月 300 公里累積跑挑戰，配上會員積分與專屬優惠券——把運動變成一件有回報的事。',
  hero_cta_primary: '立即加入會員',
  hero_cta_secondary: '查看近期活動',

  about_title: '關於 MSW 街健館',
  about_intro:
    'MSW 是 Macau Street Workout 的縮寫。二〇二四年，幾個在黑沙環公園練單槓的人決定把「一起練」這件事變成一個有制度的社群——於是有了街健館。',

  footer_intro:
    'MSW 街健館是澳門街頭健身社群，我們相信訓練不該被場地和時間綁住。每週一晚上八點，一起練；每個月三百公里，一起跑。',
  footer_note: '澳門 · Macao, China',

  // 品牌色票（後台可直接改色，即時套用全站）
  theme_bg: '#0F0F0F',
  theme_primary: '#0057FF',
  theme_accent: '#E3001B',

  contact_email: 'hello@msw-streetworkout.com',
  contact_phone: '',
  contact_address: '澳門黑沙環公園體育設施（每月公告為準）',
  contact_ig: '@msw.macau',
  contact_fb: '',
  contact_yt: '',
};

/** 把 #RRGGBB 轉成 Tailwind 需要的 "R G B" 三元組 */
export function hexToRgbTriplet(hex: string, fallback: string): string {
  const m = /^#?([0-9a-f]{6})$/i.exec((hex || '').trim());
  const src = m ? m[1] : fallback.replace('#', '');
  const n = parseInt(src, 16);
  return `${(n >> 16) & 255} ${(n >> 8) & 255} ${n & 255}`;
}

/** 依設定產生覆寫 CSS 變數的樣式（放在 layout 的 <style> 裡） */
export function themeCss(s: Record<string, string>): string {
  const bg = hexToRgbTriplet(s.theme_bg || '', '#0F0F0F');
  const primary = hexToRgbTriplet(s.theme_primary || '', '#0057FF');
  const accent = hexToRgbTriplet(s.theme_accent || '', '#E3001B');
  return `:root{--c-ink:${bg};--c-cobalt-bright:${primary};--c-energy:${accent};}`;
}

/** 供前端顯示的設定項目定義（後台表單也用同一份，避免兩邊不同步） */
export const SETTING_FIELDS: {
  group: string;
  key: string;
  label: string;
  type: 'text' | 'textarea' | 'image' | 'color';
  hint?: string;
}[] = [
  { group: '品牌識別', key: 'site_name', label: '網站名稱', type: 'text' },
  { group: '品牌識別', key: 'site_tagline', label: '名稱下方小字（英文）', type: 'text' },
  {
    group: '品牌識別',
    key: 'site_logo',
    label: 'Logo 圖片',
    type: 'image',
    hint: '上傳後會取代文字 Logo，建議用正方形透明背景 PNG',
  },

  {
    group: '配色樣式',
    key: 'theme_bg',
    label: '主背景色',
    type: 'color',
    hint: '預設 #0F0F0F（近黑）',
  },
  {
    group: '配色樣式',
    key: 'theme_primary',
    label: '主色（藍）',
    type: 'color',
    hint: '預設 #0057FF（鈷藍）',
  },
  {
    group: '配色樣式',
    key: 'theme_accent',
    label: '強調色（紅）',
    type: 'color',
    hint: '預設 #E3001B（活力紅）',
  },

  { group: '首頁主視覺', key: 'hero_badge', label: '上方小標籤', type: 'text' },
  { group: '首頁主視覺', key: 'hero_title', label: '主標題（第一行）', type: 'text' },
  {
    group: '首頁主視覺',
    key: 'hero_title_highlight',
    label: '主標題（第二行，藍色漸層）',
    type: 'text',
  },
  { group: '首頁主視覺', key: 'hero_subtitle', label: '主標題下方說明', type: 'textarea' },
  { group: '首頁主視覺', key: 'hero_cta_primary', label: '主按鈕文字', type: 'text' },
  { group: '首頁主視覺', key: 'hero_cta_secondary', label: '次按鈕文字', type: 'text' },

  { group: '關於我們', key: 'about_title', label: '頁面標題', type: 'text' },
  { group: '關於我們', key: 'about_intro', label: '簡介文字', type: 'textarea' },

  { group: '聯絡資訊', key: 'contact_email', label: 'Email', type: 'text' },
  { group: '聯絡資訊', key: 'contact_phone', label: '電話', type: 'text' },
  { group: '聯絡資訊', key: 'contact_address', label: '訓練地點', type: 'text' },
  { group: '聯絡資訊', key: 'contact_ig', label: 'Instagram', type: 'text' },
  { group: '聯絡資訊', key: 'contact_fb', label: 'Facebook', type: 'text' },
  { group: '聯絡資訊', key: 'contact_yt', label: 'YouTube', type: 'text' },

  { group: '頁尾', key: 'footer_intro', label: '頁尾簡介', type: 'textarea' },
  { group: '頁尾', key: 'footer_note', label: '頁尾右下角文字', type: 'text' },
];
