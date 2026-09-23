'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';

type PendingRun = {
  id: string;
  km: number;
  screenshotUrl: string;
  periodMonth: string;
  note: string | null;
  createdAt: string;
  userName: string;
  userEmail: string | null;
};

type Winner = {
  userId: string;
  km: number;
  name: string;
  email: string;
  alreadyIssued: boolean;
};

export function AdminConsole({
  month,
  initialPending,
  initialWinners,
  goal,
  totalCoupons,
}: {
  month: string;
  initialPending: PendingRun[];
  initialWinners: Winner[];
  goal: number;
  totalCoupons: number;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(initialPending);
  const [winners, setWinners] = useState(initialWinners);
  const [busy, setBusy] = useState<string | null>(null);
  const [toast, setToast] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const [tab, setTab] = useState<'review' | 'winners'>('review');
  const [monthInput, setMonthInput] = useState(month);
  const [lightbox, setLightbox] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  function flash(type: 'ok' | 'err', text: string) {
    setToast({ type, text });
    setTimeout(() => setToast(null), 3200);
  }

  async function review(id: string, action: 'approve' | 'reject') {
    let reason = '';
    if (action === 'reject') {
      reason = window.prompt('請輸入駁回原因（會顯示給會員）') || '管理員駁回';
    }
    setBusy(id);
    const res = await fetch(`/api/admin/runs/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, reason }),
    });
    const data = await res.json();
    setBusy(null);
    if (!res.ok) {
      flash('err', data.error || '操作失敗');
      return;
    }
    setPending((list) => list.filter((r) => r.id !== id));
    flash('ok', data.message || '已處理');
    startTransition(() => router.refresh());
  }

  async function loadWinners(m: string) {
    const res = await fetch(`/api/admin/coupons?month=${m}`);
    const data = await res.json();
    setWinners(data.winners ?? []);
    flash('ok', `已載入 ${m} 達成名單`);
  }

  async function issue(ids: string[]) {
    if (!ids.length) return flash('err', '沒有可發放的對象');
    setBusy('issue');
    const res = await fetch('/api/admin/coupons', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        month: monthInput,
        userIds: ids,
        title: `${monthInput} 月度 ${goal}KM 達成優惠券`,
        discount: '全館 8 折',
      }),
    });
    const data = await res.json();
    setBusy(null);
    if (!res.ok) return flash('err', data.error || '發放失敗');
    flash('ok', `已發出 ${data.issued} 張優惠券`);
    loadWinners(monthInput);
    startTransition(() => router.refresh());
  }

  return (
    <>
      <section className="section pt-12">
        <div className="container-msw">
          {/* Tabs */}
          <div className="flex gap-2 rounded-xl border border-white/10 bg-ink2 p-1.5">
            {(
              [
                ['review', `待確認 (${pending.length})`],
                ['winners', `月度達成名單 (${winners.length})`],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                onClick={() => setTab(key)}
                className={`flex-1 rounded-lg px-4 py-2.5 text-sm font-bold transition ${
                  tab === key
                    ? 'bg-cobaltBright text-white'
                    : 'text-white/50 hover:bg-white/5 hover:text-white'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {toast && (
            <p
              className={`mt-6 rounded-xl px-5 py-3.5 text-sm font-semibold ring-1 ${
                toast.type === 'ok'
                  ? 'bg-emerald-500/15 text-emerald-400 ring-emerald-500/30'
                  : 'bg-energy/15 text-energyBright ring-energy/30'
              }`}
            >
              {toast.text}
            </p>
          )}

          {/* ============ 待確認 ============ */}
          {tab === 'review' && (
            <div className="mt-8">
              {pending.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-white/15 p-16 text-center">
                  <p className="text-5xl">✅</p>
                  <p className="mt-4 font-bold">沒有待確認的紀錄</p>
                  <p className="mt-2 text-sm text-white/45">
                    會員上傳跑步截圖後會出現在這裡
                  </p>
                </div>
              ) : (
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                  {pending.map((r) => (
                    <div
                      key={r.id}
                      className="overflow-hidden rounded-2xl border border-white/10 bg-ink2"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={r.screenshotUrl}
                        alt="跑步截圖"
                        onClick={() => setLightbox(r.screenshotUrl)}
                        className="h-52 w-full cursor-zoom-in object-cover transition hover:opacity-85"
                      />
                      <div className="p-5">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="font-bold">{r.userName}</p>
                            <p className="text-xs text-white/40">{r.userEmail}</p>
                          </div>
                          <span className="text-xl font-black text-cobaltBright">
                            {r.km.toFixed(2)}
                            <span className="ml-1 text-xs text-white/40">KM</span>
                          </span>
                        </div>

                        <p className="mt-3 text-xs text-white/45">
                          {r.periodMonth} ·{' '}
                          {new Date(r.createdAt).toLocaleString('zh-TW')}
                        </p>
                        {r.note && (
                          <p className="mt-2 rounded-lg bg-white/5 px-3 py-2 text-xs text-white/60">
                            {r.note}
                          </p>
                        )}

                        <div className="mt-5 flex gap-2">
                          <button
                            disabled={busy === r.id}
                            onClick={() => review(r.id, 'approve')}
                            className="btn flex-1 bg-emerald-600 py-2.5 text-sm text-white hover:bg-emerald-500"
                          >
                            {busy === r.id ? '…' : '✓ 確認'}
                          </button>
                          <button
                            disabled={busy === r.id}
                            onClick={() => review(r.id, 'reject')}
                            className="btn flex-1 border border-energy/50 py-2.5 text-sm text-energyBright hover:bg-energy/15"
                          >
                            ✕ 駁回
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ============ 達成名單 ============ */}
          {tab === 'winners' && (
            <div className="mt-8">
              <div className="flex flex-wrap items-end gap-3 rounded-2xl border border-white/10 bg-ink2 p-5">
                <div>
                  <label className="label">選擇月份</label>
                  <input
                    type="month"
                    value={monthInput}
                    onChange={(e) => setMonthInput(e.target.value)}
                    className="input !w-auto"
                  />
                </div>
                <button
                  onClick={() => loadWinners(monthInput)}
                  className="btn-ghost !py-3 !text-sm"
                >
                  載入名單
                </button>
                <div className="ml-auto flex gap-3">
                  <button
                    disabled={busy === 'issue'}
                    onClick={() =>
                      issue(winners.filter((w) => !w.alreadyIssued).map((w) => w.userId))
                    }
                    className="btn-primary !py-3 !text-sm"
                  >
                    🎟️ 一鍵發放優惠券
                  </button>
                </div>
              </div>

              <p className="mt-4 text-xs text-white/40">
                達標門檻：單月 {goal} KM（僅計算已確認紀錄）。已發放過的會員不會重複發券。
                目前全站已發出 {totalCoupons} 張。
              </p>

              <div className="mt-6 overflow-x-auto rounded-2xl border border-white/10">
                <table className="w-full min-w-[640px] text-sm">
                  <thead className="bg-ink3 text-left text-xs uppercase tracking-wider text-white/50">
                    <tr>
                      <th className="px-5 py-4">會員</th>
                      <th className="px-5 py-4">Email</th>
                      <th className="px-5 py-4 text-right">累積里程</th>
                      <th className="px-5 py-4 text-center">狀態</th>
                      <th className="px-5 py-4 text-right">操作</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {winners.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="px-5 py-14 text-center text-white/40">
                          本月尚無人達標
                        </td>
                      </tr>
                    ) : (
                      winners.map((w) => (
                        <tr key={w.userId} className="hover:bg-white/[.02]">
                          <td className="px-5 py-4 font-semibold">{w.name}</td>
                          <td className="px-5 py-4 text-white/50">{w.email}</td>
                          <td className="px-5 py-4 text-right font-black text-cobaltBright">
                            {w.km.toFixed(1)} KM
                          </td>
                          <td className="px-5 py-4 text-center">
                            {w.alreadyIssued ? (
                              <span className="chip-approved">已發券</span>
                            ) : (
                              <span className="chip-pending">待發券</span>
                            )}
                          </td>
                          <td className="px-5 py-4 text-right">
                            <button
                              disabled={w.alreadyIssued || busy === 'issue'}
                              onClick={() => issue([w.userId])}
                              className="rounded-lg bg-cobaltBright px-4 py-2 text-xs font-bold text-white transition hover:bg-cobalt disabled:opacity-40"
                            >
                              發放
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* 圖片放大 */}
      {lightbox && (
        <div
          onClick={() => setLightbox(null)}
          className="fixed inset-0 z-[100] grid cursor-zoom-out place-items-center bg-black/90 p-8"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={lightbox}
            alt="放大預覽"
            className="max-h-[85vh] max-w-full rounded-xl object-contain"
          />
        </div>
      )}
    </>
  );
}
