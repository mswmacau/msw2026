import Link from 'next/link';
import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import {
  getMonthlyWinners,
  currentMonth,
  RULES,
  getMondayOfWeek,
  ymdLocal,
} from '@/lib/points';
import { AdminConsole } from './AdminConsole';

export const dynamic = 'force-dynamic';
export const metadata = { title: '管理後台' };

export default async function AdminPage() {
  const user = await getCurrentUser();
  if (!user) {
    return (
      <section className="container-msw flex min-h-screen flex-col items-center justify-center pt-24 text-center">
        <h1 className="h2">請先登入管理員帳號</h1>
        <Link href="/login?callbackUrl=/admin" className="btn-primary mt-8">
          前往登入
        </Link>
      </section>
    );
  }
  if (user.role !== 'ADMIN') {
    return (
      <section className="container-msw flex min-h-screen flex-col items-center justify-center pt-24 text-center">
        <span className="text-5xl">🔒</span>
        <h1 className="h2 mt-6">沒有權限</h1>
        <p className="mt-3 text-white/50">此頁面僅限管理員存取。</p>
        <Link href="/dashboard" className="btn-ghost mt-8">
          回到會員中心
        </Link>
      </section>
    );
  }

  const month = currentMonth();
  const thisMonday = getMondayOfWeek();
  const [pending, members, monthAgg, winners, coupons, weekCheckIns, allMembers, memberList] =
    await Promise.all([
    prisma.runRecord.findMany({
      where: { status: 'PENDING' },
      orderBy: { createdAt: 'asc' },
      include: { user: { select: { id: true, displayName: true, name: true, email: true } } },
      take: 100,
    }),
    prisma.user.count({ where: { role: 'MEMBER' } }),
    prisma.runRecord.aggregate({
      where: { periodMonth: month, status: 'APPROVED' },
      _sum: { km: true },
    }),
    getMonthlyWinners(month),
    prisma.coupon.findMany({
      orderBy: { createdAt: 'desc' },
      include: { user: { select: { displayName: true, name: true, email: true } } },
      take: 100,
    }),
    // 本週一定期訓練出席名單
    prisma.trainingCheckIn.findMany({
      where: { sessionDate: thisMonday },
      orderBy: { createdAt: 'asc' },
      include: {
        user: { select: { id: true, displayName: true, name: true, email: true } },
      },
    }),
    // 會員管理名單
    prisma.user.findMany({
      orderBy: { createdAt: 'desc' },
      take: 100,
      select: {
        id: true,
        email: true,
        displayName: true,
        name: true,
        role: true,
        points: true,
        totalPoints: true,
        createdAt: true,
        _count: { select: { runRecords: true, coupons: true } },
      },
    }),
    // 補簽用的會員下拉名單
    prisma.user.findMany({
      where: { role: 'MEMBER' },
      orderBy: { createdAt: 'asc' },
      select: { id: true, displayName: true, name: true, email: true },
    }),
  ]);

  return (
    <>
      <section className="border-b border-white/10 pt-32">
        <div className="container-msw pb-10">
          <span className="eyebrow">ADMIN CONSOLE</span>
          <h1 className="h2 mt-4">管理後台</h1>
          <p className="lead mt-3 max-w-2xl">
            確認會員上傳的跑步截圖、查看月度達成名單並發放優惠券。
          </p>

          <div className="mt-8 grid grid-cols-2 gap-4 lg:grid-cols-4">
            {[
              { label: '待確認紀錄', value: pending.length, color: 'text-amber-400' },
              { label: '會員總數', value: members, color: 'text-white' },
              {
                label: `${month} 已確認里程`,
                value: `${Math.round(Number(monthAgg._sum.km ?? 0))} km`,
                color: 'text-cobaltBright',
              },
              { label: '本月達標人數', value: winners.length, color: 'text-emerald-400' },
            ].map((s) => (
              <div key={s.label} className="rounded-2xl border border-white/10 bg-ink2 p-5">
                <p className={`text-2xl font-black ${s.color}`}>{s.value}</p>
                <p className="mt-1 text-xs text-white/45">{s.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <AdminConsole
        month={month}
        initialPending={pending.map((r) => ({
          ...r,
          km: Number(r.km),
          createdAt: r.createdAt.toISOString(),
          userName: r.user.displayName || r.user.name || r.user.email || '匿名',
          userEmail: r.user.email ?? '',
        }))}
        initialWinners={winners}
        goal={RULES.MONTHLY_KM_GOAL}
        totalCoupons={coupons.length}
        initialCoupons={coupons.map((c) => ({
          id: c.id,
          code: c.code,
          title: c.title,
          discount: c.discount,
          status: c.status as 'UNUSED' | 'USED' | 'EXPIRED',
          periodMonth: c.periodMonth,
          expiresAt: c.expiresAt.toISOString(),
          usedAt: c.usedAt ? c.usedAt.toISOString() : null,
          memberName: c.user.displayName || c.user.name || c.user.email || '匿名',
        }))}
        initialCheckIns={weekCheckIns.map((c) => ({
          id: c.id,
          userId: c.userId,
          name: c.user.displayName || c.user.name || c.user.email || '匿名',
          email: c.user.email ?? '',
          points: c.points,
          createdAt: c.createdAt.toISOString(),
        }))}
        memberList={memberList.map((u) => ({
          id: u.id,
          name: u.displayName || u.name || u.email || '匿名',
          email: u.email ?? '',
        }))}
        initialMembers={allMembers.map((u) => ({
          id: u.id,
          name: u.displayName || u.name || u.email || '匿名',
          email: u.email ?? '',
          role: u.role as 'MEMBER' | 'ADMIN',
          points: u.points,
          totalPoints: u.totalPoints,
          runs: u._count.runRecords,
          coupons: u._count.coupons,
          joinedAt: u.createdAt.toISOString(),
        }))}
        weekSessionDate={ymdLocal(thisMonday)}
      />
    </>
  );
}
