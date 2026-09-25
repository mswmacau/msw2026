'use client';

import { useState } from 'react';
import { signIn } from 'next-auth/react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';

export function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const callbackUrl = params.get('callbackUrl') || '/dashboard';
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const googleEnabled = process.env.NEXT_PUBLIC_GOOGLE_ENABLED === 'true';

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');
    const res = await signIn('credentials', { email, password, redirect: false });
    setLoading(false);
    if (res?.error) {
      setError('Email 或密碼不正確');
      return;
    }
    router.push(callbackUrl);
    router.refresh();
  }

  return (
    <div className="relative z-10 w-full max-w-md">
      <div className="rounded-3xl border border-white/10 bg-ink2/80 p-8 backdrop-blur-xl sm:p-10">
        <Link href="/" className="mb-8 flex items-center gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br from-cobaltBright to-cobalt font-black">M</span>
          <span className="text-lg font-black">MSW 街健館</span>
        </Link>

        <h1 className="text-3xl font-black">會員登入</h1>
        <p className="mt-2 text-sm text-white/50">
          還不是會員？{' '}
          <Link href="/register" className="font-semibold text-cobaltBright hover:underline">
            立即註冊
          </Link>
        </p>

        {googleEnabled && (
          <>
            <button
              onClick={() => signIn('google', { callbackUrl })}
              className="mt-8 flex w-full items-center justify-center gap-3 rounded-xl border border-white/20 bg-white/5 py-3.5 font-semibold transition hover:bg-white/10"
            >
              <svg className="h-5 w-5" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23z" />
                <path fill="#FBBC05" d="M5.84 14.09a6.6 6.6 0 0 1 0-4.18V7.07H2.18a11 11 0 0 0 0 9.86l3.66-2.84z" />
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
              </svg>
              使用 Google 帳號登入
            </button>
            <div className="my-6 flex items-center gap-4 text-xs text-white/35">
              <span className="h-px flex-1 bg-white/10" />
              或使用 Email
              <span className="h-px flex-1 bg-white/10" />
            </div>
          </>
        )}

        <form onSubmit={onSubmit} className="space-y-5">
          <div>
            <label className="label">Email</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="input"
              placeholder="you@example.com"
              autoComplete="email"
            />
          </div>
          <div>
            <label className="label">密碼</label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="input"
              placeholder="••••••••"
              autoComplete="current-password"
            />
          </div>

          {error && (
            <p className="rounded-lg bg-energy/15 px-4 py-3 text-sm text-energyBright ring-1 ring-energy/30">
              {error}
            </p>
          )}

          <button type="submit" disabled={loading} className="btn-primary w-full">
            {loading ? '登入中…' : '登入'}
          </button>
        </form>

        <p className="mt-6 text-center text-xs text-white/35">
          忘記密碼？請聯絡管理員協助重設。
        </p>
      </div>
    </div>
  );
}
