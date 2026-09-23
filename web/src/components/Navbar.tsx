'use client';

import Link from 'next/link';
import { useSession, signOut } from 'next-auth/react';
import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';

const NAV = [
  { href: '/', label: '首頁' },
  { href: '/events', label: '活動' },
  { href: '/run', label: '月度累積跑' },
  { href: '/leaderboard', label: '排行榜' },
  { href: '/about', label: '關於我們' },
];

export function Navbar({ settings }: { settings?: Record<string, string> }) {
  const { data: session, status } = useSession();
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => setOpen(false), [pathname]);

  const role = (session?.user as any)?.role;
  const points = (session?.user as any)?.points ?? 0;

  const siteName = settings?.site_name || 'MSW 街健館';
  const siteTagline = settings?.site_tagline || 'MACAU STREET WORKOUT';
  const siteLogo = settings?.site_logo || '';

  return (
    <header
      className={`fixed inset-x-0 top-0 z-50 transition-all duration-300 ${
        scrolled
          ? 'border-b border-white/10 bg-ink/85 backdrop-blur-xl'
          : 'bg-transparent'
      }`}
    >
      <nav className="container-msw flex h-[72px] items-center justify-between gap-6">
        {/* Logo */}
        <Link href="/" className="group flex items-center gap-3">
          {siteLogo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={siteLogo}
              alt={siteName}
              className="h-10 w-10 rounded-xl object-contain"
            />
          ) : (
            <span className="relative grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br from-cobaltBright to-cobalt font-black text-white shadow-lg shadow-cobalt/40">
              {siteName.replace(/\s/g, '').charAt(0) || 'M'}
              <span className="absolute -bottom-1 -right-1 h-3 w-3 rounded-full bg-energy ring-2 ring-ink" />
            </span>
          )}
          <span className="leading-none">
            <span className="block text-[17px] font-black tracking-tight">
              {siteName}
            </span>
            <span className="block text-[10px] font-medium tracking-[.18em] text-white/50">
              {siteTagline}
            </span>
          </span>
        </Link>

        {/* Desktop nav */}
        <ul className="hidden items-center gap-1 lg:flex">
          {NAV.map((item) => {
            const active =
              item.href === '/' ? pathname === '/' : pathname.startsWith(item.href);
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={`relative rounded-full px-4 py-2 text-[15px] font-medium transition ${
                    active
                      ? 'text-white'
                      : 'text-white/60 hover:bg-white/5 hover:text-white'
                  }`}
                >
                  {item.label}
                  {active && (
                    <span className="absolute inset-x-4 -bottom-0.5 h-[2px] rounded-full bg-energy" />
                  )}
                </Link>
              </li>
            );
          })}
          {role === 'ADMIN' && (
            <li>
              <Link
                href="/admin"
                className="rounded-full px-4 py-2 text-[15px] font-bold text-energyBright hover:bg-energy/10"
              >
                管理後台
              </Link>
            </li>
          )}
        </ul>

        {/* Right */}
        <div className="hidden items-center gap-3 lg:flex">
          {status === 'authenticated' ? (
            <>
              <Link
                href="/dashboard"
                className="flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-4 py-2 text-sm font-semibold transition hover:border-cobaltBright hover:bg-cobaltBright/10"
              >
                <span className="grid h-6 w-6 place-items-center rounded-full bg-cobaltBright text-[11px] font-black">
                  {points}
                </span>
                <span className="text-white/60">積分</span>
              </Link>
              <Link href="/dashboard" className="btn-ghost !px-5 !py-2 !text-sm">
                會員中心
              </Link>
              <button
                onClick={() => signOut({ callbackUrl: '/' })}
                className="text-sm text-white/45 transition hover:text-white"
              >
                登出
              </button>
            </>
          ) : (
            <>
              <Link href="/login" className="btn-ghost !px-5 !py-2.5 !text-sm">
                會員登入
              </Link>
              <Link href="/register" className="btn-primary !px-6 !py-2.5 !text-sm">
                立即加入
              </Link>
            </>
          )}
        </div>

        {/* Mobile toggle */}
        <button
          onClick={() => setOpen((v) => !v)}
          aria-label="選單"
          className="grid h-10 w-10 place-items-center rounded-lg border border-white/15 lg:hidden"
        >
          <span className="relative block h-4 w-5">
            <span
              className={`absolute left-0 h-[2px] w-5 bg-white transition-all ${
                open ? 'top-[7px] rotate-45' : 'top-0'
              }`}
            />
            <span
              className={`absolute left-0 top-[7px] h-[2px] w-5 bg-white transition-all ${
                open ? 'opacity-0' : 'opacity-100'
              }`}
            />
            <span
              className={`absolute left-0 h-[2px] w-5 bg-white transition-all ${
                open ? 'top-[7px] -rotate-45' : 'top-[14px]'
              }`}
            />
          </span>
        </button>
      </nav>

      {/* Mobile menu */}
      {open && (
        <div className="border-t border-white/10 bg-ink/95 backdrop-blur-xl lg:hidden">
          <ul className="container-msw flex flex-col py-4">
            {NAV.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className="block border-b border-white/5 py-3 text-[15px] font-medium text-white/80"
                >
                  {item.label}
                </Link>
              </li>
            ))}
            {role === 'ADMIN' && (
              <li>
                <Link
                  href="/admin"
                  className="block border-b border-white/5 py-3 font-bold text-energyBright"
                >
                  管理後台
                </Link>
              </li>
            )}
            <li className="mt-4 flex gap-3">
              {status === 'authenticated' ? (
                <>
                  <Link href="/dashboard" className="btn-cobalt flex-1 !py-3 !text-sm">
                    會員中心
                  </Link>
                  <button
                    onClick={() => signOut({ callbackUrl: '/' })}
                    className="btn-ghost !py-3 !text-sm"
                  >
                    登出
                  </button>
                </>
              ) : (
                <>
                  <Link href="/login" className="btn-ghost flex-1 !py-3 !text-sm">
                    會員登入
                  </Link>
                  <Link href="/register" className="btn-primary flex-1 !py-3 !text-sm">
                    立即加入
                  </Link>
                </>
              )}
            </li>
          </ul>
        </div>
      )}
    </header>
  );
}
