'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { domToast } from '@/lib/toast';

export function RunUploader({ month }: { month: string }) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [screenshotUrl, setScreenshotUrl] = useState('');
  const [km, setKm] = useState('');
  const [note, setNote] = useState('');
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  async function pickFile(file: File) {
    setMsg(null);
    setUploading(true);
    const fd = new FormData();
    fd.append('file', file);
    const res = await fetch('/api/upload', { method: 'POST', body: fd });
    const data = await res.json();
    setUploading(false);
    if (!res.ok) {
      setMsg({ type: 'err', text: data.error || '上傳失敗' });
      return;
    }
    setScreenshotUrl(data.url);
    setPreview(URL.createObjectURL(file));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!screenshotUrl) {
      setMsg({ type: 'err', text: '請先上傳跑步截圖' });
      return;
    }
    setSaving(true);
    setMsg(null);
    const res = await fetch('/api/runs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ km: Number(km), screenshotUrl, periodMonth: month, note }),
    });
    const data = await res.json();
    setSaving(false);
    if (!res.ok) {
      setMsg({ type: 'err', text: data.error || '提交失敗' });
      return;
    }
    setKm('');
    setNote('');
    setPreview(null);
    setScreenshotUrl('');
    if (fileRef.current) fileRef.current.value = '';
    setMsg({ type: 'ok', text: '已送出，等待管理員確認 👍' });
    // 用 DOM 提示確保一定看得到（router.refresh() 會重掛元件，React state 會被清掉）
    domToast('ok', '已送出，等待管理員確認 👍');
    setTimeout(() => router.refresh(), 1200);
  }

  return (
    <form onSubmit={submit} className="rounded-2xl border border-white/10 bg-ink2 p-7">
      <h2 className="h3">上傳跑步紀錄</h2>
      <p className="mt-2 text-sm text-white/45">
        截圖需清楚顯示距離與日期，管理員確認後才會計入累積。
      </p>

      {/* 截圖上傳 */}
      <div className="mt-6">
        <label className="label">跑步截圖 *</label>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => e.target.files?.[0] && pickFile(e.target.files[0])}
        />
        <div
          onClick={() => fileRef.current?.click()}
          className="cursor-pointer rounded-xl border-2 border-dashed border-white/20 bg-ink3/50 p-6 text-center transition hover:border-cobaltBright hover:bg-cobaltBright/5"
        >
          {uploading ? (
            <p className="text-sm text-white/60">上傳中…</p>
          ) : preview ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={preview}
              alt="預覽"
              className="mx-auto max-h-56 rounded-lg object-contain ring-1 ring-white/10"
            />
          ) : (
            <>
              <span className="mx-auto grid h-12 w-12 place-items-center rounded-xl bg-white/5 text-2xl">
                📷
              </span>
              <p className="mt-3 text-sm font-semibold">點擊選擇圖片</p>
              <p className="mt-1 text-xs text-white/40">JPG / PNG / WebP，8MB 以內</p>
            </>
          )}
        </div>
        {screenshotUrl && !uploading && (
          <p className="mt-2 text-xs text-emerald-400">✓ 截圖已就緒，可提交</p>
        )}
      </div>

      {/* 公里數 */}
      <div className="mt-6">
        <label className="label">公里數 *</label>
        <div className="relative">
          <input
            type="number"
            step="0.01"
            min="0.01"
            max="200"
            required
            value={km}
            onChange={(e) => setKm(e.target.value)}
            className="input pr-14"
            placeholder="例如 8.45"
          />
          <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-sm font-bold text-white/40">
            KM
          </span>
        </div>
      </div>

      {/* 備註 */}
      <div className="mt-6">
        <label className="label">備註（選填）</label>
        <input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          className="input"
          placeholder="例如：黑沙環海堤夜跑"
          maxLength={200}
        />
      </div>

      {/* 月份 */}
      <div className="mt-6">
        <label className="label">計入月份</label>
        <input value={month} readOnly className="input cursor-not-allowed opacity-60" />
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

      <button type="submit" disabled={saving || uploading} className="btn-primary mt-7 w-full">
        {saving ? '送出中…' : '送出紀錄'}
      </button>
    </form>
  );
}
