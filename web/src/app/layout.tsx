import type { Metadata } from 'next';
import './globals.css';
import { Navbar } from '@/components/Navbar';
import { Footer } from '@/components/Footer';
import { SessionProvider } from '@/components/SessionProvider';
import { getSettings, themeCss, DEFAULT_SETTINGS } from '@/lib/site';

export const dynamic = 'force-dynamic';

/** 網站標題與 SEO 描述跟著後台「網站設定」走 */
export async function generateMetadata(): Promise<Metadata> {
  const s = await getSettings();
  const name = s.site_name || 'MSW 街健館';
  const desc = s.site_description || DEFAULT_SETTINGS.site_description;
  return {
    title: {
      default: `${name} | ${s.site_tagline || 'Macau Street Workout'} 澳門街頭健身`,
      template: `%s | ${name}`,
    },
    description: desc,
    keywords: ['澳門', '街頭健身', 'Street Workout', 'MSW', '跑步', 'Macau'],
    openGraph: {
      title: `${name} | ${s.site_tagline || 'Macau Street Workout'}`,
      description: desc,
      type: 'website',
      locale: 'zh_TW',
    },
  };
}

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // 網站名稱 / Logo / 配色 / 聯絡資訊等由後台「網站設定」控制
  const settings = { ...DEFAULT_SETTINGS, ...(await getSettings()) };

  // 字型：只允許 CSS font-family 字串，去掉可能破壞 CSS 的字元
  // （< > 已先濾掉避免跳出 style 標籤；{ } 會破壞 CSS 結構）
  const font = (settings.theme_font || '').replace(/[<>{}]/g, '').trim();
  // 自訂 CSS 只能由管理員填寫，且必須移除 < > 以避免
  // 「</style><script>…</script>」這類跳出 style 標籤的寫法（儲存型 XSS）
  const customCss = (settings.custom_css || '').replace(/[<>]/g, '').trim();

  // 所有動態樣式集中在同一個 <style>，並用 dangerouslySetInnerHTML 輸出：
  // 若用 React children 輸出含引號的內容，SSR 會轉成 &quot; 而瀏覽器在 <style>
  // 內不會還原實體，導致 hydration 比對失敗（React #425/#418）
  // 注意：body 上有 Tailwind 的 font-sans class（class 優先於元素選擇器），
  // 所以要用 body.font-sans 這種寫法才蓋得過去
  const dynamicCss = [themeCss(settings), font ? `body.font-sans{font-family:${font};}` : '']
    .concat(customCss ? [customCss] : [])
    .join('\n');

  return (
    <html lang="zh-TW">
      <head>
        {/* 後台配色 / 字型 / 自訂 CSS：內容僅管理員可寫，屬可信任輸入 */}
        <style id="msw-theme" dangerouslySetInnerHTML={{ __html: dynamicCss }} />
      </head>
      <body className="min-h-screen bg-ink font-sans text-white antialiased">
        <SessionProvider>
          <Navbar settings={settings} />
          <main>{children}</main>
          <Footer settings={settings} />
        </SessionProvider>
      </body>
    </html>
  );
}
