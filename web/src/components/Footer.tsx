import Link from 'next/link';

const GROUPS = [
  {
    title: '活動',
    links: [
      { href: '/events', label: '全部活動' },
      { href: '/events/weekly-training', label: '定期訓練（週一 20:00）' },
      { href: '/run', label: '月度累積跑 300km' },
      { href: '/leaderboard', label: '積分排行榜' },
    ],
  },
  {
    title: '會員',
    links: [
      { href: '/login', label: '會員登入' },
      { href: '/register', label: '註冊帳號' },
      { href: '/dashboard', label: '會員中心' },
      { href: '/dashboard#coupons', label: '我的優惠券' },
    ],
  },
  {
    title: '關於',
    links: [
      { href: '/about', label: '關於 MSW' },
      { href: '/about#rules', label: '積分規則' },
      { href: '/contact', label: '聯絡我們' },
      { href: '/faq', label: '常見問題' },
    ],
  },
];

export function Footer({ settings }: { settings?: Record<string, string> }) {
  const siteName = settings?.site_name || 'MSW 街健館';
  const siteTagline = settings?.site_tagline || 'MACAU STREET WORKOUT';
  const siteLogo = settings?.site_logo || '';
  const footerIntro =
    settings?.footer_intro ||
    'MSW 街健館是澳門街頭健身社群，我們相信訓練不該被場地和時間綁住。每週一晚上八點，一起練；每個月三百公里，一起跑。';
  const footerNote = settings?.footer_note || '澳門 · Macao, China';

  const social = [
    { key: 'IG', label: 'IG', value: settings?.contact_ig || '' },
    { key: 'FB', label: 'FB', value: settings?.contact_fb || '' },
    { key: 'YT', label: 'YT', value: settings?.contact_yt || '' },
  ].filter((s) => s.value);

  return (
    <footer className="border-t border-white/10 bg-ink2">
      <div className="container-msw py-16">
        <div className="grid gap-12 lg:grid-cols-[1.4fr_2fr]">
          {/* Brand */}
          <div>
            <div className="flex items-center gap-3">
              {siteLogo ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={siteLogo}
                  alt={siteName}
                  className="h-11 w-11 rounded-xl object-contain"
                />
              ) : (
                <span className="grid h-11 w-11 place-items-center rounded-xl bg-gradient-to-br from-cobaltBright to-cobalt font-black text-white">
                  {siteName.replace(/\s/g, '').charAt(0) || 'M'}
                </span>
              )}
              <span className="leading-none">
                <span className="block text-lg font-black">{siteName}</span>
                <span className="block text-[10px] tracking-[.18em] text-white/45">
                  {siteTagline}
                </span>
              </span>
            </div>
            <p className="mt-5 max-w-sm text-sm leading-relaxed text-white/50">
              {footerIntro}
            </p>
            {social.length > 0 && (
              <div className="mt-6 flex gap-3">
                {social.map((s) => (
                  <span
                    key={s.key}
                    title={s.value}
                    className="grid h-9 w-9 place-items-center rounded-lg border border-white/15 text-[11px] font-bold text-white/60 transition hover:border-cobaltBright hover:text-white"
                  >
                    {s.label}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Links */}
          <div className="grid gap-8 sm:grid-cols-3">
            {GROUPS.map((g) => (
              <div key={g.title}>
                <h4 className="mb-4 text-sm font-bold tracking-wide text-white">
                  {g.title}
                </h4>
                <ul className="space-y-2.5">
                  {g.links.map((l) => (
                    <li key={l.href}>
                      <Link
                        href={l.href}
                        className="text-sm text-white/50 transition hover:text-cobaltBright"
                      >
                        {l.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-14 flex flex-col items-center justify-between gap-4 border-t border-white/10 pt-8 text-xs text-white/40 sm:flex-row">
          <p>© {new Date().getFullYear()} {siteName} {siteTagline}. All rights reserved.</p>
          <p className="flex items-center gap-1.5">
            {footerNote}
            <span className="h-1 w-1 rounded-full bg-energy" />
            每週一 20:00 定期訓練
          </p>
        </div>
      </div>
    </footer>
  );
}
