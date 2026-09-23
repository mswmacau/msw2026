import type { Metadata } from 'next';
import './globals.css';
import { Navbar } from '@/components/Navbar';
import { Footer } from '@/components/Footer';
import { SessionProvider } from '@/components/SessionProvider';

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

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-TW">
      <body className="min-h-screen bg-ink font-sans text-white antialiased">
        <SessionProvider>
          <Navbar />
          <main>{children}</main>
          <Footer />
        </SessionProvider>
      </body>
    </html>
  );
}
