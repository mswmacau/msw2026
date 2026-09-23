'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { SETTING_FIELDS } from '@/lib/site-fields';

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

type CheckIn = {
  id: string;
  userId: string;
  name: string;
  email: string;
  points: number;
  createdAt: string;
};

type CouponRow = {
  id: string;
  code: string;
  title: string;
  discount: string;
  status: 'UNUSED' | 'USED' | 'EXPIRED';
  periodMonth: string;
  expiresAt: string;
  usedAt: string | null;
  memberName: string;
};

type MemberRow = {
  id: string;
  name: string;
  email: string;
  role: 'MEMBER' | 'ADMIN';
  points: number;
  totalPoints: number;
  runs: number;
  coupons: number;
  joinedAt: string;
};

type MemberLite = { id: string; name: string; email: string };

type ActivityRow = {
  id: string;
  slug: string;
  title: string;
  subtitle: string;
  image: string;
  tag: string;
  schedule: string;
  location: string;
  points: string;
  description: string;
  highlights: string; // JSON 字串
  published: boolean;
  sortOrder: number;
};

const EMPTY_ACTIVITY = {
  slug: '',
  title: '',
  subtitle: '',
  image: '/images/street-workout.jpg',
  tag: '活動',
  schedule: '',
  location: '澳門',
  points: '—',
  description: '',
  highlights: '',
  published: true,
  sortOrder: 0,
};

export function AdminConsole({
  month,
  initialPending,
  initialWinners,
  goal,
  totalCoupons,
  initialCoupons,
  initialCheckIns,
  memberList,
  initialMembers,
  weekSessionDate,
  initialSettings,
  initialActivities,
}: {
  month: string;
  initialPending: PendingRun[];
  initialWinners: Winner[];
  goal: number;
  totalCoupons: number;
  initialCoupons: CouponRow[];
  initialCheckIns: CheckIn[];
  memberList: MemberLite[];
  initialMembers: MemberRow[];
  weekSessionDate: string;
  initialSettings: Record<string, string>;
  initialActivities: ActivityRow[];
}) {
  const router = useRouter();
  const [pending, setPending] = useState(initialPending);
  const [winners, setWinners] = useState(initialWinners);
  const [coupons, setCoupons] = useState(initialCoupons);
  const [redeemCode, setRedeemCode] = useState('');
  const [redeemResult, setRedeemResult] = useState<any>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [toast, setToast] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const [members, setMembers] = useState(initialMembers);
  const [memberQuery, setMemberQuery] = useState('');
  const [tab, setTab] = useState<
    'review' | 'winners' | 'training' | 'coupons' | 'members' | 'settings' | 'activities'
  >('review');

  // ---- 網站設定 ----
  const [settings, setSettings] = useState(initialSettings);
  const [settingGroup, setSettingGroup] = useState(SETTING_FIELDS[0].group);
  const [uploadingKey, setUploadingKey] = useState<string | null>(null);

  // ---- 活動管理 ----
  const [activities, setActivities] = useState(initialActivities);
  const [editing, setEditing] = useState<(typeof EMPTY_ACTIVITY & { id?: string }) | null>(
    null
  );
  const [checkIns, setCheckIns] = useState(initialCheckIns);
  const [checkInDate, setCheckInDate] = useState(weekSessionDate);
  const [manualUser, setManualUser] = useState('');
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

  async function loadCheckIns(date: string) {
    const res = await fetch(`/api/checkin?all=1&date=${date}`);
    if (!res.ok) return flash('err', '讀取出席名單失敗');
    const data = await res.json();
    setCheckIns(data.rows ?? []);
    setCheckInDate(data.sessionDate);
    flash('ok', `${data.sessionDate} 出席 ${data.count} 人`);
  }

  async function manualCheckIn() {
    if (!manualUser) return flash('err', '請選擇會員');
    setBusy('checkin');
    const res = await fetch('/api/checkin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: manualUser, date: checkInDate }),
    });
    const data = await res.json();
    setBusy(null);
    if (!res.ok) return flash('err', data.error || '補簽失敗');
    flash('ok', '已補簽出席並給予積分');
    setManualUser('');
    loadCheckIns(checkInDate);
    startTransition(() => router.refresh());
  }

  async function removeCheckIn(id: string) {
    if (!window.confirm('確定移除這筆出席紀錄？積分一併扣回。')) return;
    setBusy(id);
    const res = await fetch(`/api/checkin?id=${id}`, { method: 'DELETE' });
    const data = await res.json();
    setBusy(null);
    if (!res.ok) return flash('err', data.error || '移除失敗');
    flash('ok', '已移除出席紀錄');
    loadCheckIns(checkInDate);
    startTransition(() => router.refresh());
  }

  async function loadMembers(q = '') {
    const res = await fetch(`/api/admin/members?q=${encodeURIComponent(q)}`);
    if (!res.ok) return flash('err', '讀取會員清單失敗');
    const data = await res.json();
    setMembers(data.members ?? []);
  }

  async function adjustPoints(userId: string, name: string) {
    const input = window.prompt(
      `調整「${name}」的積分\n\n輸入正數加分、負數扣分（例如：50 或 -20）`,
      '10'
    );
    if (input === null) return;
    const amount = Number(input);
    if (!Number.isFinite(amount) || amount === 0) {
      return flash('err', '請輸入有效的數字');
    }
    const reason = window.prompt('請輸入調整原因（會顯示於會員的積分明細）', '管理員手動調整');
    if (reason === null) return;

    setBusy(userId);
    const res = await fetch('/api/admin/members', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, action: 'points', amount, reason: reason || '管理員調整' }),
    });
    const data = await res.json();
    setBusy(null);
    if (!res.ok) return flash('err', data.error || '調整失敗');
    flash('ok', data.message);
    loadMembers(memberQuery);
    startTransition(() => router.refresh());
  }

  async function toggleRole(row: MemberRow) {
    const next = row.role === 'ADMIN' ? 'MEMBER' : 'ADMIN';
    if (!window.confirm(`確定將「${row.name}」設為 ${next}？`)) return;
    setBusy(row.id + '-role');
    const res = await fetch('/api/admin/members', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: row.id, action: 'role', role: next }),
    });
    const data = await res.json();
    setBusy(null);
    if (!res.ok) return flash('err', data.error || '調整失敗');
    flash('ok', data.message);
    loadMembers(memberQuery);
    startTransition(() => router.refresh());
  }

  async function redeemCoupon() {
    const code = redeemCode.trim();
    if (!code) return flash('err', '請輸入優惠券號');
    setBusy('redeem');
    setRedeemResult(null);
    const res = await fetch('/api/admin/coupons/redeem', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code }),
    });
    const data = await res.json();
    setBusy(null);
    if (!res.ok) {
      setRedeemResult({ ok: false, ...data });
      flash('err', data.error || '核銷失敗');
      return;
    }
    setRedeemResult({ ok: true, ...data });
    setRedeemCode('');
    await loadCoupons();
    flash('ok', data.message || '核銷成功');
    startTransition(() => router.refresh());
  }

  async function loadCoupons() {
    const res = await fetch('/api/admin/coupons?list=1');
    if (!res.ok) return;
    const data = await res.json();
    setCoupons(data.coupons ?? []);
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

  /* ================= 網站設定 ================= */

  async function saveSettings(keys?: string[]) {
    const payload: Record<string, string> = {};
    for (const f of SETTING_FIELDS) {
      if (keys && !keys.includes(f.key)) continue;
      payload[f.key] = settings[f.key] ?? '';
    }
    setBusy('settings');
    const res = await fetch('/api/admin/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    setBusy(null);
    const data = await res.json();
    if (!res.ok) return flash('err', data.error || '儲存失敗');
    flash('ok', '設定已儲存，前台已更新');
    startTransition(() => router.refresh());
  }

  async function uploadImage(key: string, file: File) {
    setUploadingKey(key);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch('/api/upload', { method: 'POST', body: fd });
      const data = await res.json();
      if (!res.ok) {
        flash('err', data.error || '上傳失敗');
        return;
      }
      setSettings((s) => ({ ...s, [key]: data.url }));
      flash('ok', '圖片已上傳，記得按「儲存設定」');
    } catch {
      flash('err', '上傳失敗，請稍後再試');
    } finally {
      setUploadingKey(null);
    }
  }

  /* ================= 活動管理 ================= */

  async function loadActivities() {
    const res = await fetch('/api/admin/activities');
    if (!res.ok) return flash('err', '讀取活動失敗');
    const data = await res.json();
    setActivities(
      (data.activities ?? []).map((a: any) => ({
        ...a,
        highlights: JSON.stringify(a.highlights ?? []),
      }))
    );
  }

  async function seedActivities() {
    setBusy('seed');
    const res = await fetch('/api/admin/activities', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ seed: true }),
    });
    const data = await res.json();
    setBusy(null);
    if (!res.ok) return flash('err', data.error || '匯入失敗');
    flash('ok', `已匯入 ${data.added} 個內建活動`);
    await loadActivities();
    startTransition(() => router.refresh());
  }

  async function saveActivity() {
    if (!editing) return;
    if (!editing.title.trim()) return flash('err', '請填寫活動名稱');
    setBusy('activity');
    const isEdit = Boolean(editing.id);
    const highlights = (editing.highlights || '')
      .split('\n')
      .map((x) => x.trim())
      .filter(Boolean);

    const res = await fetch('/api/admin/activities', {
      method: isEdit ? 'PATCH' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...editing, highlights, id: editing.id }),
    });
    const data = await res.json();
    setBusy(null);
    if (!res.ok) return flash('err', data.error || '儲存失敗');
    flash('ok', isEdit ? '活動已更新' : '活動已新增');
    setEditing(null);
    await loadActivities();
    startTransition(() => router.refresh());
  }

  async function togglePublish(a: ActivityRow) {
    setBusy(a.id);
    const res = await fetch('/api/admin/activities', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: a.id, published: !a.published }),
    });
    setBusy(null);
    if (!res.ok) return flash('err', '更新失敗');
    flash('ok', a.published ? '已下架（前台不顯示）' : '已上架');
    await loadActivities();
    startTransition(() => router.refresh());
  }

  async function deleteActivity(a: ActivityRow) {
    if (!window.confirm(`確定刪除「${a.title}」？此動作無法復原。`)) return;
    setBusy(a.id);
    const res = await fetch(`/api/admin/activities?id=${a.id}`, { method: 'DELETE' });
    const data = await res.json();
    setBusy(null);
    if (!res.ok) return flash('err', data.error || '刪除失敗');
    flash('ok', '活動已刪除');
    await loadActivities();
    startTransition(() => router.refresh());
  }

  const settingGroups = Array.from(new Set(SETTING_FIELDS.map((f) => f.group)));

  return (
    <>
      <section className="section pt-12">
        <div className="container-msw">
          {/* Tabs */}
          <div className="flex flex-wrap gap-2 rounded-xl border border-white/10 bg-ink2 p-1.5">
            {(
              [
                ['review', `待確認截圖 (${pending.length})`],
                ['training', `訓練出席 (${checkIns.length})`],
                ['winners', `達成名單 (${winners.length})`],
                ['coupons', `優惠券 (${totalCoupons})`],
                ['members', `會員 (${members.length})`],
                ['activities', `活動管理 (${activities.length})`],
                ['settings', '網站設定'],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                onClick={() => setTab(key)}
                className={`flex-1 whitespace-nowrap rounded-lg px-3 py-2.5 text-[13px] font-bold transition ${
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
            <div className="pointer-events-none fixed inset-x-0 top-24 z-[90] flex justify-center px-5">
              <p
                className={`pointer-events-auto rounded-xl px-6 py-3.5 text-sm font-semibold shadow-2xl ring-1 backdrop-blur ${
                  toast.type === 'ok'
                    ? 'bg-emerald-500/20 text-emerald-300 ring-emerald-500/40'
                    : 'bg-energy/20 text-energyBright ring-energy/40'
                }`}
              >
                {toast.text}
              </p>
            </div>
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

          {/* ============ 訓練出席 ============ */}
          {tab === 'training' && (
            <div className="mt-8">
              <div className="flex flex-wrap items-end gap-3 rounded-2xl border border-white/10 bg-ink2 p-5">
                <div>
                  <label className="label">訓練場次（週別）</label>
                  <input
                    type="date"
                    value={checkInDate}
                    onChange={(e) => setCheckInDate(e.target.value)}
                    className="input !w-auto"
                  />
                </div>
                <button
                  onClick={() => loadCheckIns(checkInDate)}
                  className="btn-ghost !py-3 !text-sm"
                >
                  載入名單
                </button>

                <div className="ml-auto flex flex-wrap items-end gap-3">
                  <div>
                    <label className="label">手動補簽</label>
                    <select
                      value={manualUser}
                      onChange={(e) => setManualUser(e.target.value)}
                      className="input !w-auto min-w-[200px]"
                    >
                      <option value="">選擇會員…</option>
                      {memberList
                        .filter((m) => !checkIns.some((c) => c.userId === m.id))
                        .map((m) => (
                          <option key={m.id} value={m.id}>
                            {m.name}（{m.email}）
                          </option>
                        ))}
                    </select>
                  </div>
                  <button
                    disabled={busy === 'checkin'}
                    onClick={manualCheckIn}
                    className="btn-cobalt !py-3 !text-sm"
                  >
                    ＋ 補簽
                  </button>
                </div>
              </div>

              <p className="mt-4 text-xs text-white/40">
                會員可於每週一 19:30 – 21:30 在會員中心自助簽到（每次{' '}
                {10} 積分）；缺席或忘記簽到可由管理員在此補簽，誤簽則可移除並自動扣回積分。
              </p>

              <div className="mt-6 overflow-x-auto rounded-2xl border border-white/10">
                <table className="w-full min-w-[620px] text-sm">
                  <thead className="bg-ink3 text-left text-xs uppercase tracking-wider text-white/50">
                    <tr>
                      <th className="px-5 py-4">會員</th>
                      <th className="px-5 py-4">Email</th>
                      <th className="px-5 py-4">簽到時間</th>
                      <th className="px-5 py-4 text-center">積分</th>
                      <th className="px-5 py-4 text-right">操作</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {checkIns.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="px-5 py-14 text-center text-white/40">
                          本週尚無出席紀錄
                        </td>
                      </tr>
                    ) : (
                      checkIns.map((c) => (
                        <tr key={c.id} className="hover:bg-white/[.02]">
                          <td className="px-5 py-4 font-semibold">{c.name}</td>
                          <td className="px-5 py-4 text-white/50">{c.email}</td>
                          <td className="px-5 py-4 text-white/50">
                            {new Date(c.createdAt).toLocaleString('zh-TW')}
                          </td>
                          <td className="px-5 py-4 text-center font-black text-emerald-400">
                            +{c.points}
                          </td>
                          <td className="px-5 py-4 text-right">
                            <button
                              disabled={busy === c.id}
                              onClick={() => removeCheckIn(c.id)}
                              className="rounded-lg border border-energy/50 px-3 py-1.5 text-xs font-bold text-energyBright transition hover:bg-energy/15"
                            >
                              移除
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
          {/* ============ 會員管理 ============ */}
          {tab === 'members' && (
            <div className="mt-8">
              <div className="flex flex-wrap items-end gap-3 rounded-2xl border border-white/10 bg-ink2 p-5">
                <div className="flex-1">
                  <label className="label">搜尋會員</label>
                  <input
                    value={memberQuery}
                    onChange={(e) => setMemberQuery(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && loadMembers(memberQuery)}
                    placeholder="輸入暱稱或 Email"
                    className="input"
                  />
                </div>
                <button onClick={() => loadMembers(memberQuery)} className="btn-ghost !py-3 !text-sm">
                  搜尋
                </button>
                <button onClick={() => { setMemberQuery(''); loadMembers(''); }} className="btn-ghost !py-3 !text-sm">
                  重設
                </button>
              </div>

              <p className="mt-4 text-xs text-white/40">
                點「調整積分」可手動加減分並留下原因紀錄；積分調整會即時反映在會員中心與排行榜。
              </p>

              <div className="mt-6 overflow-x-auto rounded-2xl border border-white/10">
                <table className="w-full min-w-[880px] text-sm">
                  <thead className="bg-ink3 text-left text-xs uppercase tracking-wider text-white/50">
                    <tr>
                      <th className="px-5 py-4">會員</th>
                      <th className="px-5 py-4 text-right">可用積分</th>
                      <th className="px-5 py-4 text-right">歷史累積</th>
                      <th className="px-5 py-4 text-center">跑步紀錄</th>
                      <th className="px-5 py-4 text-center">優惠券</th>
                      <th className="px-5 py-4 text-center">角色</th>
                      <th className="px-5 py-4 text-right">操作</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {members.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="px-5 py-14 text-center text-white/40">
                          沒有符合的會員
                        </td>
                      </tr>
                    ) : (
                      members.map((m) => (
                        <tr key={m.id} className="hover:bg-white/[.02]">
                          <td className="px-5 py-4">
                            <p className="font-semibold">{m.name}</p>
                            <p className="text-xs text-white/40">{m.email}</p>
                          </td>
                          <td className="px-5 py-4 text-right font-black text-cobaltBright">
                            {m.points}
                          </td>
                          <td className="px-5 py-4 text-right text-white/60">
                            {m.totalPoints}
                          </td>
                          <td className="px-5 py-4 text-center text-white/60">{m.runs}</td>
                          <td className="px-5 py-4 text-center text-white/60">{m.coupons}</td>
                          <td className="px-5 py-4 text-center">
                            {m.role === 'ADMIN' ? (
                              <span className="chip bg-energy/20 text-energyBright">ADMIN</span>
                            ) : (
                              <span className="chip bg-white/10 text-white/60">MEMBER</span>
                            )}
                          </td>
                          <td className="px-5 py-4">
                            <div className="flex justify-end gap-2">
                              <button
                                disabled={busy === m.id}
                                onClick={() => adjustPoints(m.id, m.name)}
                                className="rounded-lg bg-cobaltBright px-3 py-1.5 text-xs font-bold text-white transition hover:bg-cobalt"
                              >
                                調整積分
                              </button>
                              <button
                                disabled={busy === m.id + '-role'}
                                onClick={() => toggleRole(m)}
                                className="rounded-lg border border-white/20 px-3 py-1.5 text-xs font-bold text-white/70 transition hover:bg-white/10"
                              >
                                角色
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ============ 優惠券核銷 ============ */}
          {tab === 'coupons' && (
            <div className="mt-8 space-y-6">
              {/* 核銷區 */}
              <div className="rounded-2xl border border-energy/25 bg-gradient-to-br from-energy/10 to-transparent p-6">
                <h2 className="h3">優惠券核銷</h2>
                <p className="mt-2 text-sm text-white/50">
                  輸入會員出示的券號即可核銷。核銷後不可重複使用，會員同時獲得 20 點回饋積分。
                </p>

                <div className="mt-5 flex flex-wrap gap-3">
                  <input
                    value={redeemCode}
                    onChange={(e) => setRedeemCode(e.target.value.toUpperCase())}
                    onKeyDown={(e) => e.key === 'Enter' && redeemCoupon()}
                    placeholder="MSW-202609-XXXX"
                    className="input flex-1 font-mono tracking-wider"
                  />
                  <button
                    disabled={busy === 'redeem' || !redeemCode.trim()}
                    onClick={redeemCoupon}
                    className="btn-primary !py-3 !text-sm"
                  >
                    {busy === 'redeem' ? '處理中…' : '🎟️ 核銷'}
                  </button>
                </div>

                {redeemResult && (
                  <div
                    className={`mt-5 rounded-xl px-5 py-4 text-sm ring-1 ${
                      redeemResult.ok
                        ? 'bg-emerald-500/15 text-emerald-300 ring-emerald-500/30'
                        : 'bg-energy/15 text-energyBright ring-energy/30'
                    }`}
                  >
                    {redeemResult.ok ? (
                      <div>
                        <p className="font-bold">✓ {redeemResult.message}</p>
                        <p className="mt-1 text-white/70">
                          會員：{redeemResult.coupon.memberName} · 券號：
                          <code className="font-mono">{redeemResult.coupon.code}</code>
                        </p>
                        <p className="mt-1 text-xs text-white/50">
                          {redeemResult.coupon.title}
                        </p>
                      </div>
                    ) : (
                      <p className="font-bold">✕ {redeemResult.error}</p>
                    )}
                  </div>
                )}
              </div>

              {/* 券列表 */}
              <div className="overflow-x-auto rounded-2xl border border-white/10">
                <table className="w-full min-w-[760px] text-sm">
                  <thead className="bg-ink3 text-left text-xs uppercase tracking-wider text-white/50">
                    <tr>
                      <th className="px-5 py-4">券號</th>
                      <th className="px-5 py-4">會員</th>
                      <th className="px-5 py-4">內容</th>
                      <th className="px-5 py-4">月份</th>
                      <th className="px-5 py-4">狀態</th>
                      <th className="px-5 py-4 text-right">有效期</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {coupons.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="px-5 py-14 text-center text-white/40">
                          尚未發出任何優惠券
                        </td>
                      </tr>
                    ) : (
                      coupons.map((c) => (
                        <tr key={c.id} className="hover:bg-white/[.02]">
                          <td className="px-5 py-4 font-mono text-xs text-white/70">
                            {c.code}
                          </td>
                          <td className="px-5 py-4 font-semibold">{c.memberName}</td>
                          <td className="px-5 py-4">
                            <p className="font-semibold">{c.title}</p>
                            <p className="text-energyBright">{c.discount}</p>
                          </td>
                          <td className="px-5 py-4 text-white/50">{c.periodMonth}</td>
                          <td className="px-5 py-4">
                            {c.status === 'USED' ? (
                              <span className="chip bg-white/10 text-white/50">已核銷</span>
                            ) : c.status === 'EXPIRED' ||
                              new Date(c.expiresAt) < new Date() ? (
                              <span className="chip-rejected">已過期</span>
                            ) : (
                              <span className="chip-approved">未使用</span>
                            )}
                          </td>
                          <td className="px-5 py-4 text-right text-white/50">
                            {new Date(c.expiresAt).toLocaleDateString('zh-TW')}
                            {c.usedAt && (
                              <span className="block text-[11px] text-white/35">
                                核銷於 {new Date(c.usedAt).toLocaleDateString('zh-TW')}
                              </span>
                            )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ============ 活動管理 ============ */}
          {tab === 'activities' && (
            <div className="mt-8 space-y-6">
              <div className="rounded-2xl border border-white/10 bg-ink2 p-5">
                <div className="flex flex-wrap items-center gap-3">
                  <div>
                    <h2 className="h3">活動管理</h2>
                    <p className="mt-1 text-xs text-white/45">
                      新增／編輯前台「活動」頁的內容。下架的活動不會出現在前台，但資料保留。
                    </p>
                  </div>
                  <div className="ml-auto flex flex-wrap gap-3">
                    {activities.length === 0 && (
                      <button
                        disabled={busy === 'seed'}
                        onClick={seedActivities}
                        className="btn-ghost !py-3 !text-sm"
                      >
                        {busy === 'seed' ? '匯入中…' : '匯入三個內建活動'}
                      </button>
                    )}
                    <button
                      onClick={() => setEditing({ ...EMPTY_ACTIVITY })}
                      className="btn-cobalt !py-3 !text-sm"
                    >
                      ＋ 新增活動
                    </button>
                  </div>
                </div>
              </div>

              <div className="overflow-x-auto rounded-2xl border border-white/10">
                <table className="w-full min-w-[760px] text-sm">
                  <thead className="bg-ink3 text-left text-xs uppercase tracking-wider text-white/50">
                    <tr>
                      <th className="px-5 py-4">活動</th>
                      <th className="px-5 py-4">時間</th>
                      <th className="px-5 py-4">地點</th>
                      <th className="px-5 py-4">積分</th>
                      <th className="px-5 py-4 text-center">狀態</th>
                      <th className="px-5 py-4 text-right">操作</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {activities.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="px-5 py-14 text-center text-white/40">
                          尚未建立活動（前台目前顯示內建預設內容）
                        </td>
                      </tr>
                    ) : (
                      activities.map((a) => (
                        <tr key={a.id} className="hover:bg-white/[.02]">
                          <td className="px-5 py-4">
                            <p className="font-semibold">{a.title}</p>
                            <p className="text-xs text-white/40">
                              /events/{a.slug}
                            </p>
                          </td>
                          <td className="px-5 py-4 text-white/60">{a.schedule}</td>
                          <td className="px-5 py-4 text-white/60">{a.location}</td>
                          <td className="px-5 py-4 text-cobaltBright">{a.points}</td>
                          <td className="px-5 py-4 text-center">
                            {a.published ? (
                              <span className="chip-approved">上架中</span>
                            ) : (
                              <span className="chip-pending">已下架</span>
                            )}
                          </td>
                          <td className="px-5 py-4">
                            <div className="flex justify-end gap-2">
                              <button
                                onClick={() =>
                                  setEditing({
                                    ...a,
                                    highlights: (() => {
                                      try {
                                        return JSON.parse(a.highlights || '[]').join('\n');
                                      } catch {
                                        return '';
                                      }
                                    })(),
                                  })
                                }
                                className="rounded-lg bg-cobaltBright px-3 py-1.5 text-xs font-bold text-white transition hover:bg-cobalt"
                              >
                                編輯
                              </button>
                              <button
                                disabled={busy === a.id}
                                onClick={() => togglePublish(a)}
                                className="rounded-lg border border-white/20 px-3 py-1.5 text-xs font-bold text-white/70 transition hover:bg-white/10"
                              >
                                {a.published ? '下架' : '上架'}
                              </button>
                              <button
                                disabled={busy === a.id}
                                onClick={() => deleteActivity(a)}
                                className="rounded-lg border border-energy/50 px-3 py-1.5 text-xs font-bold text-energyBright transition hover:bg-energy/15"
                              >
                                刪除
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ============ 網站設定 ============ */}
          {tab === 'settings' && (
            <div className="mt-8 space-y-6">
              <div className="rounded-2xl border border-cobaltBright/30 bg-cobaltBright/5 p-5">
                <h2 className="h3">網站設定</h2>
                <p className="mt-2 text-sm text-white/55">
                  改完按「儲存設定」就會立刻套用到前台，不需要重新部署。
                  想還原某一項，把它清空後儲存即可回到預設值。
                </p>
              </div>

              {/* 分組 */}
              <div className="flex flex-wrap gap-2">
                {settingGroups.map((g) => (
                  <button
                    key={g}
                    onClick={() => setSettingGroup(g)}
                    className={`rounded-full px-4 py-2 text-sm font-bold transition ${
                      settingGroup === g
                        ? 'bg-white text-ink'
                        : 'border border-white/15 text-white/60 hover:bg-white/5 hover:text-white'
                    }`}
                  >
                    {g}
                  </button>
                ))}
              </div>

              <div className="space-y-5 rounded-2xl border border-white/10 bg-ink2 p-6">
                {SETTING_FIELDS.filter((f) => f.group === settingGroup).map((f) => (
                  <div key={f.key}>
                    <label className="label">{f.label}</label>

                    {f.type === 'textarea' && (
                      <textarea
                        rows={4}
                        value={settings[f.key] ?? ''}
                        onChange={(e) =>
                          setSettings((s) => ({ ...s, [f.key]: e.target.value }))
                        }
                        className="input"
                      />
                    )}

                    {f.type === 'text' && (
                      <input
                        value={settings[f.key] ?? ''}
                        onChange={(e) =>
                          setSettings((s) => ({ ...s, [f.key]: e.target.value }))
                        }
                        className="input"
                      />
                    )}

                    {f.type === 'color' && (
                      <div className="flex items-center gap-3">
                        <input
                          type="color"
                          value={/^#[0-9a-f]{6}$/i.test(settings[f.key] || '')
                            ? settings[f.key]
                            : '#000000'}
                          onChange={(e) =>
                            setSettings((s) => ({
                              ...s,
                              [f.key]: e.target.value.toUpperCase(),
                            }))
                          }
                          className="h-11 w-16 cursor-pointer rounded-lg border border-white/15 bg-transparent"
                        />
                        <input
                          value={settings[f.key] ?? ''}
                          onChange={(e) =>
                            setSettings((s) => ({ ...s, [f.key]: e.target.value }))
                          }
                          placeholder="#0057FF"
                          className="input flex-1 font-mono"
                        />
                      </div>
                    )}

                    {f.type === 'image' && (
                      <div className="flex flex-wrap items-center gap-4">
                        {settings[f.key] ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={settings[f.key]}
                            alt="預覽"
                            className="h-16 w-16 rounded-xl border border-white/15 object-contain"
                          />
                        ) : (
                          <span className="grid h-16 w-16 place-items-center rounded-xl border border-dashed border-white/20 text-xs text-white/40">
                            未設定
                          </span>
                        )}
                        <label className="btn-ghost cursor-pointer !py-2.5 !text-sm">
                          {uploadingKey === f.key ? '上傳中…' : '上傳圖片'}
                          <input
                            type="file"
                            accept="image/*"
                            hidden
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) uploadImage(f.key, file);
                              e.target.value = '';
                            }}
                          />
                        </label>
                        {settings[f.key] && (
                          <button
                            onClick={() => setSettings((s) => ({ ...s, [f.key]: '' }))}
                            className="text-sm text-white/45 underline transition hover:text-energyBright"
                          >
                            移除（改回文字 Logo）
                          </button>
                        )}
                        <input
                          value={settings[f.key] ?? ''}
                          onChange={(e) =>
                            setSettings((s) => ({ ...s, [f.key]: e.target.value }))
                          }
                          placeholder="或直接貼上圖片網址"
                          className="input mt-1 w-full"
                        />
                      </div>
                    )}

                    {f.hint && <p className="mt-2 text-xs text-white/40">{f.hint}</p>}
                  </div>
                ))}
              </div>

              <div className="flex flex-wrap gap-3">
                <button
                  disabled={busy === 'settings'}
                  onClick={() => saveSettings()}
                  className="btn-primary"
                >
                  {busy === 'settings' ? '儲存中…' : '💾 儲存全部設定'}
                </button>
                <a
                  href="/"
                  target="_blank"
                  rel="noreferrer"
                  className="btn-ghost"
                >
                  開新視窗看前台 →
                </a>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* 活動編輯彈窗 */}
      {editing && (
        <div className="fixed inset-0 z-[95] overflow-y-auto bg-black/80 p-5">
          <div className="mx-auto my-8 max-w-2xl overflow-hidden rounded-2xl border border-white/10 bg-ink2">
            {/* 表單本體可捲動，操作列固定在底部，避免要滑很久才找得到儲存鈕 */}
            <div className="max-h-[calc(100vh-190px)] overflow-y-auto p-7">
              <h3 className="h3">
                {editing.id ? `編輯活動：${editing.title}` : '新增活動'}
              </h3>
              <div className="mt-6 grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label className="label">活動名稱 *</label>
                <input
                  value={editing.title}
                  onChange={(e) => setEditing({ ...editing, title: e.target.value })}
                  className="input"
                  placeholder="例如：週三核心訓練班"
                />
              </div>
              <div>
                <label className="label">副標題</label>
                <input
                  value={editing.subtitle}
                  onChange={(e) => setEditing({ ...editing, subtitle: e.target.value })}
                  className="input"
                  placeholder="例如：每週三 19:30 – 20:30"
                />
              </div>
              <div>
                <label className="label">分類標籤</label>
                <input
                  value={editing.tag}
                  onChange={(e) => setEditing({ ...editing, tag: e.target.value })}
                  className="input"
                  placeholder="常態活動 / 月度挑戰 / 課程"
                />
              </div>
              <div>
                <label className="label">網址代稱（英文）</label>
                <input
                  value={editing.slug}
                  onChange={(e) => setEditing({ ...editing, slug: e.target.value })}
                  className="input"
                  placeholder="留空會自動用活動名稱產生"
                />
              </div>
              <div>
                <label className="label">顯示順序</label>
                <input
                  type="number"
                  value={editing.sortOrder}
                  onChange={(e) =>
                    setEditing({ ...editing, sortOrder: Number(e.target.value) })
                  }
                  className="input"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="label">封面圖片</label>
                <div className="flex flex-wrap items-center gap-3">
                  {editing.image && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={editing.image}
                      alt="預覽"
                      className="h-14 w-20 rounded-lg border border-white/15 object-cover"
                    />
                  )}
                  <label className="btn-ghost cursor-pointer !py-2.5 !text-sm">
                    上傳圖片
                    <input
                      type="file"
                      accept="image/*"
                      hidden
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        e.target.value = '';
                        if (!file) return;
                        const fd = new FormData();
                        fd.append('file', file);
                        const res = await fetch('/api/upload', { method: 'POST', body: fd });
                        const data = await res.json();
                        if (res.ok) setEditing({ ...editing, image: data.url });
                        else flash('err', data.error || '上傳失敗');
                      }}
                    />
                  </label>
                  <input
                    value={editing.image}
                    onChange={(e) => setEditing({ ...editing, image: e.target.value })}
                    className="input min-w-[220px] flex-1"
                    placeholder="/images/street-workout.jpg"
                  />
                </div>
              </div>
              <div>
                <label className="label">時間</label>
                <input
                  value={editing.schedule}
                  onChange={(e) => setEditing({ ...editing, schedule: e.target.value })}
                  className="input"
                  placeholder="每週三 19:30 – 20:30"
                />
              </div>
              <div>
                <label className="label">地點</label>
                <input
                  value={editing.location}
                  onChange={(e) => setEditing({ ...editing, location: e.target.value })}
                  className="input"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="label">積分說明</label>
                <input
                  value={editing.points}
                  onChange={(e) => setEditing({ ...editing, points: e.target.value })}
                  className="input"
                  placeholder="每次出席 10 分"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="label">活動介紹</label>
                <textarea
                  rows={5}
                  value={editing.description}
                  onChange={(e) =>
                    setEditing({ ...editing, description: e.target.value })
                  }
                  className="input"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="label">活動重點（一行一個）</label>
                <textarea
                  rows={4}
                  value={editing.highlights}
                  onChange={(e) =>
                    setEditing({ ...editing, highlights: e.target.value })
                  }
                  className="input"
                  placeholder={'新手友善\n不需自備器材\n現場簽到給積分'}
                />
              </div>
              <div className="sm:col-span-2">
                <label className="flex items-center gap-3 text-sm font-semibold">
                  <input
                    type="checkbox"
                    checked={editing.published}
                    onChange={(e) =>
                      setEditing({ ...editing, published: e.target.checked })
                    }
                    className="h-4 w-4 accent-cobaltBright"
                  />
                  立即上架（前台活動頁顯示）
                </label>
              </div>
            </div>
            </div>

            {/* 操作列固定在卡片底部 */}
            <div className="sticky bottom-0 flex flex-wrap gap-3 border-t border-white/10 bg-ink2/95 px-7 py-5 backdrop-blur">
              <button
                disabled={busy === 'activity'}
                onClick={saveActivity}
                className="btn-primary"
              >
                {busy === 'activity' ? '儲存中…' : '儲存活動'}
              </button>
              <button onClick={() => setEditing(null)} className="btn-ghost">
                取消
              </button>
            </div>
          </div>
        </div>
      )}

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
