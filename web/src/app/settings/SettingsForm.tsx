'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export function SettingsForm({
  initialName,
  email,
  hasPassword,
}: {
  initialName: string;
  email: string;
  hasPassword: boolean;
}) {
  const router = useRouter();
  const [displayName, setDisplayName] = useState(initialName);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  async function saveProfile() {
    setBusy(true);
    setMsg(null);
    const res = await fetch('/api/profile', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ displayName }),
    });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) return setMsg({ type: 'err', text: data.error || '更新失敗' });
    setMsg({ type: 'ok', text: '暱稱已更新' });
    router.refresh();
  }

  async function savePassword() {
    if (newPassword !== confirm) return setMsg({ type: 'err', text: '兩次輸入的新密碼不一致' });
    setBusy(true);
    setMsg(null);
    const res = await fetch('/api/profile', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ currentPassword, newPassword }),
    });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) return setMsg({ type: 'err', text: data.error || '修改失敗' });
    setCurrentPassword('');
    setNewPassword('');
    setConfirm('');
    setMsg({ type: 'ok', text: '密碼已更新，下次登入請用新密碼' });
  }

  return (
    <div className="mt-10 space-y-6">
      {/* 暱稱 */}
      <div className="card">
        <h2 className="h3">個人資料</h2>
        <div className="mt-6">
          <label className="label">暱稱（顯示於排行榜）</label>
          <input
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            className="input"
            maxLength={30}
          />
        </div>
        <div className="mt-6">
          <label className="label">Email</label>
          <input value={email} readOnly className="input cursor-not-allowed opacity-50" />
          <p className="mt-2 text-xs text-white/35">Email 為登入帳號，暫不提供自行修改。</p>
        </div>
        <button onClick={saveProfile} disabled={busy} className="btn-primary mt-7 w-full">
          {busy ? '儲存中…' : '儲存資料'}
        </button>
      </div>

      {/* 密碼 */}
      <div className="card">
        <h2 className="h3">變更密碼</h2>
        {!hasPassword ? (
          <p className="mt-4 rounded-lg bg-cobaltBright/10 px-4 py-3 text-sm text-cobaltBright ring-1 ring-cobaltBright/25">
            你的帳號使用 Google 登入，沒有設定密碼。
            填寫下方欄位可直接設定一組密碼，之後也能用 Email + 密碼登入。
          </p>
        ) : null}

        <div className="mt-6 space-y-5">
          {hasPassword && (
            <div>
              <label className="label">目前密碼</label>
              <input
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                className="input"
                autoComplete="current-password"
              />
            </div>
          )}
          <div>
            <label className="label">新密碼（至少 8 個字元）</label>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="input"
              autoComplete="new-password"
            />
          </div>
          <div>
            <label className="label">確認新密碼</label>
            <input
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              className="input"
              autoComplete="new-password"
            />
          </div>
        </div>
        <button
          onClick={savePassword}
          disabled={busy || !newPassword}
          className="btn-ghost mt-7 w-full"
        >
          更新密碼
        </button>
      </div>

      {msg && (
        <div className="pointer-events-none fixed inset-x-0 top-24 z-[90] flex justify-center px-5">
          <p
            className={`pointer-events-auto rounded-xl px-6 py-3.5 text-sm font-semibold shadow-2xl ring-1 backdrop-blur ${
              msg.type === 'ok'
                ? 'bg-emerald-500/20 text-emerald-300 ring-emerald-500/40'
                : 'bg-energy/20 text-energyBright ring-energy/40'
            }`}
          >
            {msg.text}
          </p>
        </div>
      )}

      <Link
        href="/dashboard"
        className="block text-center text-sm text-white/45 transition hover:text-white"
      >
        ← 回到會員中心
      </Link>
    </div>
  );
}
