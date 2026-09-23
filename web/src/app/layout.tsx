import type { Metadata } from 'next';
import './globals.css';
import { Navbar } from '@/components/Navbar';
import { Footer } from '@/components/Footer';
import { SessionProvider } from '@/components/SessionProvider';
import { getSettings, themeCss, DEFAULT_SETTINGS } from '@/lib/site';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: {
    default: 'MSW 街健館 | Macau Street Workout 澳門街頭健身',
    template: '%s | MSW 街健館',
  },
  description:
    'MSW 街健館（Macau Street Workout）— 澳門街頭健身社群。定期訓練活動、月度累積跑 300km 挑戰、會員積分與優惠券。',
  keywords: ['澳門', '街頭健身', 'Street Workout', 'MSW', '跑步', 'Macau'],
  openGraph: {
    title: 'MSW 街健館 | Macau Street Workout',
    description: '澳門街頭健身社群 — 定期訓練、月度累積跑、會員積分',
    type: 'website',
    locale: 'zh_TW',
  },
};

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
