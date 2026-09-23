import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import { currentMonth, RULES } from '@/lib/points';

export const dynamic = 'force-dynamic';
export const metadata = { title: '積分排行榜' };

const MEDALS = ['🥇', '🥈', '🥉'];

export default async function LeaderboardPage() {
  const month = currentMonth();

  const [topPoints, monthRows] = await Promise.all([
    prisma.user.findMany({
      where: { role: 'MEMBER' },
      orderBy: { points: 'desc' },
      take: 20,
      select: { id: true, displayName: true, name: true, points: true, totalPoints: true },
    }),
    prisma.runRecord.groupBy({
      by: ['userId'],
      where: { periodMonth: month, status: 'APPROVED' },
      _sum: { km: true },
      orderBy: { _sum: { km: 'desc' } },
      take: 20,
    }),
  ]);

  const users = await prisma.user.findMany({
    where: { id: { in: monthRows.map((r) => r.userId) } },
    select: { id: true, displayName: true, name: true },
  });
  const nameMap = new Map(users.map((u) => [u.id, u.displayName || u.name || '匿名']));

  const monthLeaders = monthRows.map((r) => ({
    userId: r.userId,
    name: nameMap.get(r.userId) || '匿名',
    km: Number(r._sum.km ?? 0),
  }));

  return (
    <>
      <section className="border-b border-white/10 pt-32">
        <div className="container-msw pb-12">
          <span className="eyebrow">LEADERBOARD</span>
          <h1 className="h1 mt-5">積分排行榜</h1>
          <p className="lead mt-5 max-w-2xl">
            每確認 1 公里累積 {RULES.POINTS_PER_KM} 分，出席定期訓練再拿{' '}
            {RULES.TRAINING_POINTS} 分。排名每月結算一次。
          </p>
        </div>
      </section>

      <section className="section pt-14">
        <div className="container-msw grid gap-8 lg:grid-cols-2">
          {/* 積分榜 */}
          <div className="card !p-0">
            <div className="border-b border-white/10 p-6">
              <h2 className="h3">總積分排行</h2>
              <p className="mt-1 text-xs text-white/45">依目前可用積分排序</p>
            </div>
            <ul className="divide-y divide-white/5">
              {topPoints.length === 0 && (
                <li className="p-10 text-center text-sm text-white/40">
                  還沒有會員資料
                </li>
              )}
              {topPoints.map((u, i) => (
                <li
                  key={u.id}
                  className="flex items-center gap-4 px-6 py-4 transition hover:bg-white/[.03]"
                >
                  <span className="w-8 shrink-0 text-center text-lg font-black">
                    {MEDALS[i] ?? i + 1}
                  </span>
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-cobaltBright/30 to-energy/20 font-black">
                    {(u.displayName || u.name || '?').slice(0, 1)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-bold">
                      {u.displayName || u.name || '匿名會員'}
                    </p>
                    <p className="text-xs text-white/40">
                      歷史累積 {u.totalPoints} 分
                    </p>
                  </div>
                  <span className="text-xl font-black text-cobaltBright">
                    {u.points}
                  </span>
                </li>
              ))}
            </ul>
          </div>

          {/* 本月里程榜 */}
          <div className="card !p-0">
            <div className="border-b border-white/10 p-6">
              <h2 className="h3">{month} 里程排行</h2>
              <p className="mt-1 text-xs text-white/45">
                目標 {RULES.MONTHLY_KM_GOAL} KM（僅計算已確認紀錄）
              </p>
            </div>
            <ul className="divide-y divide-white/5">
              {monthLeaders.length === 0 && (
                <li className="p-10 text-center text-sm text-white/40">
                  本月尚無已確認里程
                </li>
              )}
              {monthLeaders.map((u, i) => {
                const pct = Math.min(100, (u.km / RULES.MONTHLY_KM_GOAL) * 100);
                return (
                  <li key={u.userId} className="px-6 py-4">
                    <div className="flex items-center gap-4">
                      <span className="w-8 shrink-0 text-center text-lg font-black">
                        {MEDALS[i] ?? i + 1}
                      </span>
                      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-cobaltBright/30 to-energy/20 font-black">
                        {u.name.slice(0, 1)}
                      </span>
                      <p className="min-w-0 flex-1 truncate font-bold">{u.name}</p>
                      <span className="text-xl font-black text-energyBright">
                        {u.km.toFixed(1)}
                        <span className="ml-1 text-xs text-white/40">KM</span>
                      </span>
                    </div>
                    <div className="ml-12 mt-2 h-1.5 overflow-hidden rounded-full bg-white/10">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-cobaltBright to-energy"
                        style={{ width: `${Math.max(2, pct)}%` }}
                      />
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>

        <div className="container-msw mt-12 text-center">
          <Link href="/run" className="btn-primary">
            上傳我的跑步紀錄
          </Link>
        </div>
      </section>
    </>
  );
}
