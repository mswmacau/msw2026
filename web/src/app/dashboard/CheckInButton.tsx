'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export function CheckInButton({
  sessionDate,
  signedIn,
  canCheckIn,
  isTrainingDay,
  points,
}: {
  sessionDate: string;
  signedIn: boolean;
  canCheckIn: boolean;
  isTrainingDay: boolean;
  points: number;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  async function checkIn() {
    setBusy(true);
    setMsg(null);
    const res = await fetch('/api/checkin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) {
      setMsg({ type: 'err', text: data.error || '簽到失敗' });
      return;
    }
    setMsg({ type: 'ok', text: `簽到成功！獲得 ${data.points} 積分 💪` });
    router.refresh();
  }

  if (signedIn) {
    return (
      <div className="text-right">
        <span className="chip-approved !px-4 !py-2">✓ 本週已簽到</span>
        <p className="mt-2 text-xs text-white/40">已獲得 {points} 積分</p>
      </div>
    );
  }

  return (
    <div className="text-right">
      {canCheckIn ? (
        <button onClick={checkIn} disabled={busy} className="btn-primary !px-5 !py-2.5 !text-sm">
          {busy ? '簽到中…' : '📍 我要簽到'}
        </button>
      ) : (
        <span className="chip-pending !px-4 !py-2">
          {isTrainingDay ? '尚未開放（19:30 開放）' : '非活動日'}
        </span>
      )}
      <p className="mt-2 max-w-[220px] text-xs text-white/40">
        {isTrainingDay
          ? '每週一 19:30 – 21:30 開放自助簽到'
          : '定期訓練固定於每週一舉行'}
      </p>
      {msg && (
        <p
          className={`mt-2 text-xs ${msg.type === 'ok' ? 'text-emerald-400' : 'text-energyBright'}`}
        >
          {msg.text}
        </p>
      )}
    </div>
  );
}
