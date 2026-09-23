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

  return (
    <html lang="zh-TW">
      <head>
        {/* 後台配色設定：覆寫全站 CSS 變數 */}
        <style id="msw-theme">{themeCss(settings)}</style>
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
