'use client';

import { useState } from 'react';
import { signIn } from 'next-auth/react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

export function RegisterForm() {
  const router = useRouter();
  const [form, setForm] = useState({
    displayName: '',
    email: '',
    password: '',
    confirm: '',
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm({ ...form, [k]: e.target.value });

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (form.password !== form.confirm) {
      setError('兩次輸入的密碼不一致');
      return;
    }
    setLoading(true);
    const res = await fetch('/api/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        displayName: form.displayName,
        email: form.email,
        password: form.password,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      setLoading(false);
      setError(data.error || '註冊失敗');
      return;
    }
    const sign = await signIn('credentials', {
      email: form.email,
      password: form.password,
      redirect: false,
    });
    setLoading(false);
    if (sign?.error) {
      router.push('/login');
      return;
    }
    router.push('/dashboard');
    router.refresh();
  }

  return (
    <div className="relative z-10 w-full max-w-md">
      <div className="rounded-3xl border border-white/10 bg-ink2/80 p-8 backdrop-blur-xl sm:p-10">
        <Link href="/" className="mb-8 flex items-center gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br from-cobaltBright to-cobalt font-black">M</span>
          <span className="text-lg font-black">MSW 街健館</span>
        </Link>

        <h1 className="text-3xl font-black">註冊會員</h1>
        <p className="mt-2 text-sm text-white/50">
          註冊即送 <span className="font-bold text-energyBright">50 積分</span>，
          並可立即參加定期訓練與月度累積跑。
        </p>

        <form onSubmit={onSubmit} className="mt-8 space-y-5">
          <div>
            <label className="label">暱稱（顯示於排行榜）</label>
            <input
              required
              value={form.displayName}
              onChange={set('displayName')}
              className="input"
              placeholder="例如：阿明"
            />
          </div>
          <div>
            <label className="label">Email</label>
            <input
              type="email"
              required
              value={form.email}
              onChange={set('email')}
              className="input"
              placeholder="you@example.com"
              autoComplete="email"
            />
          </div>
          <div>
            <label className="label">密碼（至少 8 個字元）</label>
            <input
              type="password"
              required
              minLength={8}
              value={form.password}
              onChange={set('password')}
              className="input"
              placeholder="••••••••"
              autoComplete="new-password"
            />
          </div>
          <div>
            <label className="label">確認密碼</label>
            <input
              type="password"
              required
              value={form.confirm}
              onChange={set('confirm')}
              className="input"
              placeholder="••••••••"
              autoComplete="new-password"
            />
          </div>

          {error && (
            <p className="rounded-lg bg-energy/15 px-4 py-3 text-sm text-energyBright ring-1 ring-energy/30">
              {error}
            </p>
          )}

          <button type="submit" disabled={loading} className="btn-primary w-full">
            {loading ? '註冊中…' : '免費加入'}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-white/45">
          已有帳號？{' '}
          <Link href="/login" className="font-semibold text-cobaltBright hover:underline">
            會員登入
          </Link>
        </p>
      </div>
    </div>
  );
}
