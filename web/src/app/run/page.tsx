import Link from 'next/link';
import { getCurrentUser } from '@/lib/auth';
import { getMonthSummary, currentMonth, RULES } from '@/lib/points';
import { prisma } from '@/lib/prisma';
import { RunUploader } from './RunUploader';

export const dynamic = 'force-dynamic';
export const metadata = { title: '月度累積跑' };

export default async function RunPage() {
  const user = await getCurrentUser();
  const month = currentMonth();

  const summary = user ? await getMonthSummary(user.id, month) : null;
  const records = user
    ? await prisma.runRecord.findMany({
        where: { userId: user.id },
        orderBy: { createdAt: 'desc' },
        take: 30,
      })
    : [];

  return (
    <>
      {/* Header */}
      <section className="relative overflow-hidden border-b border-white/10 pt-32">
        <div
          className="absolute inset-0 bg-cover bg-center opacity-20"
          style={{ backgroundImage: 'url(/images/running-track.jpg)' }}
        />
        <div className="absolute inset-0 bg-gradient-to-b from-ink/70 to-ink" />
        <div className="container-msw relative pb-14">
          <span className="eyebrow">MONTHLY RUN CHALLENGE</span>
          <h1 className="h1 mt-5">月度累積跑</h1>
          <p className="lead mt-5 max-w-2xl">
            隨時隨地跑，上傳跑步 App 截圖並填寫公里數，經管理員確認後計入累積。
            單月達到 <span className="font-bold text-energyBright">{RULES.MONTHLY_KM_GOAL} 公里</span>
            即完成任務，月底由後台統一發放優惠券。
          </p>

          {/* 進度 */}
          {summary && (
            <div className="mt-10 max-w-3xl rounded-2xl border border-white/10 bg-white/[.04] p-7 backdrop-blur">
              <div className="flex flex-wrap items-end justify-between gap-4">
                <div>
                  <p className="text-xs tracking-wider text-white/45">
                    {month} 累積進度（已確認）
                  </p>
                  <p className="mt-1 text-4xl font-black">
                    {summary.km.toFixed(1)}
                    <span className="ml-2 text-lg text-white/40">
                      / {summary.goal} KM
                    </span>
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-xs tracking-wider text-white/45">狀態</p>
                  <p
                    className={`mt-1 text-lg font-black ${
                      summary.completed ? 'text-emerald-400' : 'text-cobaltBright'
                    }`}
                  >
                    {summary.completed ? '✅ 已完成任務' : `還差 ${summary.remaining.toFixed(1)} KM`}
                  </p>
                </div>
              </div>

              <div className="mt-6 h-3 w-full overflow-hidden rounded-full bg-white/10">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-cobaltBright to-energy transition-all duration-1000"
                  style={{ width: `${Math.max(2, summary.percent)}%` }}
                />
              </div>

              <div className="mt-5 grid grid-cols-3 gap-4 text-center">
                <div className="rounded-xl bg-white/[.03] py-3">
                  <p className="text-xl font-black text-amber-400">{summary.pending}</p>
                  <p className="text-[11px] text-white/45">待確認</p>
                </div>
                <div className="rounded-xl bg-white/[.03] py-3">
                  <p className="text-xl font-black text-emerald-400">{summary.approved}</p>
                  <p className="text-[11px] text-white/45">已確認</p>
                </div>
                <div className="rounded-xl bg-white/[.03] py-3">
                  <p className="text-xl font-black text-energyBright">{summary.rejected}</p>
                  <p className="text-[11px] text-white/45">已駁回</p>
                </div>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* 上傳區 */}
      <section className="section pt-16">
        <div className="container-msw">
          {!user ? (
            <div className="rounded-2xl border border-white/10 bg-ink2 p-10 text-center">
              <h2 className="h3">請先登入會員</h2>
              <p className="mt-3 text-sm text-white/50">
                登入後才能上傳跑步紀錄並累積積分與里程。
              </p>
              <div className="mt-7 flex justify-center gap-4">
                <Link href="/login?callbackUrl=/run" className="btn-primary">
                  會員登入
                </Link>
                <Link href="/register" className="btn-ghost">
                  註冊新帳號
                </Link>
              </div>
            </div>
          ) : (
            <div className="grid gap-10 lg:grid-cols-[1fr_1.1fr]">
              <RunUploader month={month} />

              {/* 我的紀錄 */}
              <div>
                <h2 className="h3 mb-6">我的上傳紀錄</h2>
                {records.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-white/15 p-10 text-center text-sm text-white/40">
                    還沒有任何紀錄，上傳第一筆吧！
                  </div>
                ) : (
                  <ul className="space-y-3">
                    {records.map((r) => (
                      <li
                        key={r.id}
                        className="flex items-center gap-4 rounded-xl border border-white/10 bg-ink2 p-4"
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={r.screenshotUrl}
                          alt="跑步截圖"
                          className="h-16 w-16 shrink-0 rounded-lg object-cover ring-1 ring-white/10"
                        />
                        <div className="min-w-0 flex-1">
                          <p className="font-bold">
                            {Number(r.km).toFixed(2)} KM
                            <span className="ml-2 text-xs font-normal text-white/40">
                              {r.periodMonth}
                            </span>
                          </p>
                          <p className="truncate text-xs text-white/45">
                            {new Date(r.createdAt).toLocaleString('zh-TW')}
                            {r.note ? ` · ${r.note}` : ''}
                          </p>
                        </div>
                        <span
                          className={
                            r.status === 'APPROVED'
                              ? 'chip-approved'
                              : r.status === 'PENDING'
                              ? 'chip-pending'
                              : 'chip-rejected'
                          }
                        >
                          {r.status === 'APPROVED'
                            ? '已確認'
                            : r.status === 'PENDING'
                            ? '待確認'
                            : '已駁回'}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}

                {records.some((r) => r.status === 'REJECTED' && r.rejectReason) && (
                  <div className="mt-4 rounded-xl bg-energy/10 p-4 text-xs text-white/70 ring-1 ring-energy/25">
                    <p className="font-bold text-energyBright">駁回原因</p>
                    <ul className="mt-2 space-y-1">
                      {records
                        .filter((r) => r.status === 'REJECTED' && r.rejectReason)
                        .slice(0, 3)
                        .map((r) => (
                          <li key={r.id}>· {r.rejectReason}</li>
                        ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </section>
    </>
  );
}
