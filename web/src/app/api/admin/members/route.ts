import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/lib/auth';
import { addPoints, getMondayOfWeek } from '@/lib/points';

/** GET：會員清單（支援搜尋暱稱 / Email） */
export async function GET(req: Request) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: '沒有權限' }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const q = String(searchParams.get('q') || '').trim();

  const users = await prisma.user.findMany({
    where: q
      ? {
          OR: [
            { email: { contains: q } },
            { displayName: { contains: q } },
            { name: { contains: q } },
          ],
        }
      : {},
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
  });

  return NextResponse.json({
    members: users.map((u) => ({
      id: u.id,
      name: u.displayName || u.name || u.email,
      email: u.email,
      role: u.role,
      points: u.points,
      totalPoints: u.totalPoints,
      runs: u._count.runRecords,
      coupons: u._count.coupons,
      joinedAt: u.createdAt.toISOString(),
    })),
  });
}

/**
 * PATCH：管理員操作會員
 * body:
 *   { userId, action: 'points', amount, reason }  → 手動加減積分
 *   { userId, action: 'role',    role }           → 調整角色
 */
export async function PATCH(req: Request) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: '沒有權限' }, { status: 403 });

  try {
    const body = await req.json();
    const userId = String(body.userId || '');
    if (!userId) return NextResponse.json({ error: '缺少 userId' }, { status: 400 });

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) return NextResponse.json({ error: '找不到會員' }, { status: 404 });

    if (body.action === 'points') {
      const amount = Number(body.amount);
      if (!Number.isFinite(amount) || amount === 0) {
        return NextResponse.json({ error: '積分數量不正確' }, { status: 400 });
      }
      if (Math.abs(amount) > 100000) {
        return NextResponse.json({ error: '單次調整不可超過 100,000 分' }, { status: 400 });
      }
      await addPoints({
        userId,
        amount: Math.round(amount),
        reason: body.reason || (amount > 0 ? '管理員手動加分' : '管理員手動扣分'),
        refType: 'MANUAL',
      });
      return NextResponse.json({
        ok: true,
        message: `已${amount > 0 ? '增加' : '扣減'} ${Math.abs(Math.round(amount))} 分`,
      });
    }

    if (body.action === 'role') {
      const role = String(body.role) === 'ADMIN' ? 'ADMIN' : 'MEMBER';
      // 防止把管理者降級導致系統沒有管理員
      if (userId === admin.id) {
        return NextResponse.json({ error: '不能變更自己的角色' }, { status: 400 });
      }
      await prisma.user.update({ where: { id: userId }, data: { role } });
      return NextResponse.json({ ok: true, message: `已設為 ${role}` });
    }

    return NextResponse.json({ error: '未知操作' }, { status: 400 });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || '操作失敗' }, { status: 500 });
  }
}
