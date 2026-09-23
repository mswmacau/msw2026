import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getMonthSummary, currentMonth, RULES, nextMonday20 } from '@/lib/points';

export const dynamic = 'force-dynamic';
export const metadata = { title: '會員中心' };

export default async function DashboardPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login?callbackUrl=/dashboard');

  const month = currentMonth();
  const [summary, coupons, logs, checkIns, rank] = await Promise.all([
    getMonthSummary(user.id, month),
    prisma.coupon.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.pointLog.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
      take: 15,
    }),
    prisma.trainingCheckIn.findMany({
      where: { userId: user.id },
      orderBy: { sessionDate: 'desc' },
      take: 10,
    }),
    prisma.user.count({
      where: { role: 'MEMBER', points: { gt: user.points } },
    }),
  ]);

  const nextSession = nextMonday20();
  const alreadyJoined = checkIns.some(
    (c) => new Date(c.sessionDate).toDateString() === nextSession.toDateString()
  );

  return (
    <>
      <section className="border-b border-white/10 pt-32">
        <div className="container-msw pb-12">
          {/* 會員卡 */}
          <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-cobalt via-cobalt to-ink p-8">
            <div className="pointer-events-none absolute -right-16 -top-16 h-60 w-60 rounded-full bg-white/10 blur-3xl" />
            <div className="pointer-events-none absolute -bottom-20 left-1/3 h-52 w-52 rounded-full bg-energy/25 blur-3xl" />

            <div className="relative flex flex-wrap items-center justify-between gap-8">
              <div className="flex items-center gap-5">
                <span className="grid h-20 w-20 place-items-center rounded-2xl bg-white/15 text-3xl font-black backdrop-blur">
                  {(user.displayName || user.email || 'M').slice(0, 1).toUpperCase()}
                </span>
                <div>
                  <p className="text-xs tracking-wider text-white/60">會員</p>
                  <h1 className="text-3xl font-black">
                    {user.displayName || user.name || 'MSW 會員'}
                  </h1>
                  <p className="mt-1 text-sm text-white/60">{user.email}</p>
                  <p className="mt-2 text-xs text-white/50">
                    全站積分排名 第 {rank + 1} 名
                  </p>
                </div>
              </div>

              <div className="flex gap-8">
                <div>
                  <p className="text-xs tracking-wider text-white/60">可用積分</p>
                  <p className="text-4xl font-black">{user.points}</p>
                </div>
                <div>
                  <p className="text-xs tracking-wider text-white/60">歷史累積</p>
                  <p className="text-4xl font-black text-white/70">{user.totalPoints}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="section pt-14">
        <div className="container-msw grid gap-8 lg:grid-cols-[1.15fr_1fr]">
          {/* 左：本月任務 + 定期訓練 */}
          <div className="space-y-8">
            {/* 月度進度 */}
            <div className="card">
              <div className="flex items-center justify-between">
                <h2 className="h3">{month} 月度任務</h2>
                <span
                  className={
                    summary.completed ? 'chip-approved' : 'chip bg-cobaltBright/20 text-cobaltBright'
                  }
                >
                  {summary.completed ? '已達標' : '進行中'}
                </span>
              </div>

              <p className="mt-5 text-4xl font-black">
                {summary.km.toFixed(1)}
                <span className="ml-2 text-lg text-white/40">/ {summary.goal} KM</span>
              </p>
              <div className="mt-4 h-3 w-full overflow-hidden rounded-full bg-white/10">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-cobaltBright to-energy transition-all duration-1000"
                  style={{ width: `${Math.max(2, summary.percent)}%` }}
                />
              </div>
              <p className="mt-3 text-sm text-white/50">
                {summary.completed
                  ? '任務完成！月底將由後台發放優惠券。'
                  : `還差 ${summary.remaining.toFixed(1)} KM 達成 ${summary.goal} KM`}
              </p>

              <Link href="/run" className="btn-cobalt mt-6 w-full">
                上傳跑步紀錄
              </Link>
            </div>

            {/* 定期訓練 */}
            <div className="card">
              <h2 className="h3">定期訓練活動</h2>
              <div className="mt-5 flex flex-wrap items-center justify-between gap-4 rounded-xl bg-white/[.03] p-5">
                <div>
                  <p className="text-xs tracking-wider text-white/45">下場訓練</p>
                  <p className="mt-1 text-xl font-black">
                    {nextSession.toLocaleDateString('zh-TW', {
                      month: 'long',
                      day: 'numeric',
                      weekday: 'long',
                    })}
                  </p>
                  <p className="text-sm text-energyBright">20:00 – 21:00</p>
                </div>
                {alreadyJoined ? (
                  <span className="chip-approved">已報名</span>
                ) : (
                  <span className="chip-pending">現場簽到</span>
                )}
              </div>
              <p className="mt-4 text-sm text-white/50">
                出席簽到可獲得 {RULES.TRAINING_POINTS} 積分。請準時到場，由教練現場點名。
              </p>

              {checkIns.length > 0 && (
                <div className="mt-5">
                  <p className="text-xs tracking-wider text-white/45">近期出席</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {checkIns.slice(0, 8).map((c) => (
                      <span
                        key={c.id}
                        className="rounded-lg bg-emerald-500/15 px-3 py-1.5 text-xs font-semibold text-emerald-400"
                      >
                        {new Date(c.sessionDate).toLocaleDateString('zh-TW', {
                          month: 'numeric',
                          day: 'numeric',
                        })}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* 積分明細 */}
            <div className="card">
              <h2 className="h3">積分明細</h2>
              {logs.length === 0 ? (
                <p className="mt-4 text-sm text-white/40">尚無紀錄</p>
              ) : (
                <ul className="mt-4 divide-y divide-white/5">
                  {logs.map((l) => (
                    <li key={l.id} className="flex items-center justify-between py-3">
                      <div>
                        <p className="text-sm font-semibold">{l.reason}</p>
                        <p className="text-xs text-white/40">
                          {new Date(l.createdAt).toLocaleString('zh-TW')}
                        </p>
                      </div>
                      <span
                        className={`font-black ${
                          l.amount >= 0 ? 'text-emerald-400' : 'text-energyBright'
                        }`}
                      >
                        {l.amount >= 0 ? '+' : ''}
                        {l.amount}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          {/* 右：優惠券 */}
          <div className="space-y-8">
            <div className="card" id="coupons">
              <h2 className="h3">我的優惠券</h2>
              {coupons.length === 0 ? (
                <div className="mt-6 rounded-xl border border-dashed border-white/15 p-8 text-center">
                  <p className="text-3xl">🎟️</p>
                  <p className="mt-3 text-sm text-white/45">
                    完成單月 {RULES.MONTHLY_KM_GOAL} KM 任務後，
                    <br />
                    後台會在月底統一發放優惠券。
                  </p>
                </div>
              ) : (
                <ul className="mt-5 space-y-4">
                  {coupons.map((c) => (
                    <li
                      key={c.id}
                      className={`relative overflow-hidden rounded-xl border p-5 ${
                        c.status === 'USED'
                          ? 'border-white/10 bg-ink3 opacity-60'
                          : 'border-energy/40 bg-gradient-to-br from-energy/15 to-transparent'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <p className="font-bold">{c.title}</p>
                          <p className="mt-1 text-xs text-white/50">{c.description}</p>
                        </div>
                        <span className="text-2xl font-black text-energyBright">
                          {c.discount}
                        </span>
                      </div>
                      <div className="mt-4 flex items-center justify-between border-t border-dashed border-white/20 pt-3">
                        <code className="text-xs font-mono tracking-wider text-white/70">
                          {c.code}
                        </code>
                        <span className="text-[11px] text-white/40">
                          {c.status === 'USED'
                            ? '已使用'
                            : `有效期至 ${new Date(c.expiresAt).toLocaleDateString('zh-TW')}`}
                        </span>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="card">
              <h2 className="h3">快速連結</h2>
              <div className="mt-4 grid gap-3">
                {[
                  { href: '/run', label: '上傳跑步紀錄', icon: '🏃' },
                  { href: '/events', label: '查看近期活動', icon: '📅' },
                  { href: '/leaderboard', label: '積分排行榜', icon: '🏆' },
                  { href: '/about#rules', label: '積分與任務規則', icon: '📖' },
                ].map((l) => (
                  <Link
                    key={l.href}
                    href={l.href}
                    className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[.03] px-4 py-3 text-sm font-semibold transition hover:border-cobaltBright hover:bg-cobaltBright/10"
                  >
                    <span>{l.icon}</span>
                    {l.label}
                    <span className="ml-auto text-white/40">→</span>
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
