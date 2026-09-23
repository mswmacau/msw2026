import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser, requireAdmin } from '@/lib/auth';
import {
  addPoints,
  getMondayOfWeek,
  canCheckInNow,
  isTrainingDay,
  ymdLocal,
  parseLocalDate,
  RULES,
} from '@/lib/points';

/** GET：出席名單（管理員帶 all=1），或查詢自己今天是否已簽到 */
export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: '請先登入' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const dateParam = searchParams.get('date');
  const target = dateParam ? parseLocalDate(dateParam) : new Date();
  const sessionDate = getMondayOfWeek(target);

  if (searchParams.get('all') === '1') {
    const admin = await requireAdmin();
    if (!admin) return NextResponse.json({ error: '沒有權限' }, { status: 403 });

    const rows = await prisma.trainingCheckIn.findMany({
      where: { sessionDate },
      orderBy: { createdAt: 'asc' },
      include: {
        user: { select: { id: true, displayName: true, name: true, email: true } },
      },
    });
    return NextResponse.json({
      sessionDate: ymdLocal(sessionDate),
      count: rows.length,
      rows: rows.map((r) => ({
        id: r.id,
        userId: r.userId,
        name: r.user.displayName || r.user.name || r.user.email,
        email: r.user.email,
        points: r.points,
        createdAt: r.createdAt,
      })),
    });
  }

  const mine = await prisma.trainingCheckIn.findFirst({
    where: { userId: user.id, sessionDate },
  });
  return NextResponse.json({
    sessionDate: ymdLocal(sessionDate),
    signedIn: !!mine,
    canCheckIn: canCheckInNow() && !mine,
    isTrainingDay: isTrainingDay(),
  });
}

/** POST：會員自助簽到（週一 19:30–21:30），管理員可為任意日期補簽 */
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: '請先登入' }, { status: 401 });

  try {
    const body = await req.json().catch(() => ({}));
    const isAdmin = user.role === 'ADMIN';
    const targetUserId = isAdmin && body.userId ? String(body.userId) : user.id;

    const targetDate = body.date ? parseLocalDate(String(body.date)) : new Date();
    if (Number.isNaN(targetDate.getTime())) {
      return NextResponse.json({ error: '日期格式錯誤' }, { status: 400 });
    }
    const sessionDate = getMondayOfWeek(targetDate);

    // 一般會員只能在活動當天開放時段內簽到；管理員補簽不受限
    if (!isAdmin && !canCheckInNow()) {
      if (!isTrainingDay()) {
        return NextResponse.json(
          { error: '定期訓練只在每週一舉行，今天沒有訓練活動' },
          { status: 403 }
        );
      }
      return NextResponse.json(
        { error: '尚未開放簽到（每週一 19:30 – 21:30）' },
        { status: 403 }
      );
    }

    const existing = await prisma.trainingCheckIn.findFirst({
      where: { userId: targetUserId, sessionDate },
    });
    if (existing) {
      return NextResponse.json(
        { error: '該場次已簽到，無法重複' },
        { status: 409 }
      );
    }

    const checkIn = await prisma.trainingCheckIn.create({
      data: {
        userId: targetUserId,
        sessionDate,
        points: RULES.TRAINING_POINTS,
      },
    });
    await addPoints({
      userId: targetUserId,
      amount: RULES.TRAINING_POINTS,
      reason: `出席 ${ymdLocal(sessionDate)} 定期訓練`,
      refType: 'TRAINING',
      refId: checkIn.id,
    });

    return NextResponse.json({
      ok: true,
      sessionDate: ymdLocal(sessionDate),
      points: RULES.TRAINING_POINTS,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || '簽到失敗' }, { status: 500 });
  }
}

/** DELETE：管理員移除誤簽的出席紀錄（同時扣回積分） */
export async function DELETE(req: Request) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: '沒有權限' }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');
  if (!id) return NextResponse.json({ error: '缺少 id' }, { status: 400 });

  const row = await prisma.trainingCheckIn.findUnique({ where: { id } });
  if (!row) return NextResponse.json({ error: '找不到紀錄' }, { status: 404 });

  await prisma.trainingCheckIn.delete({ where: { id } });
  await addPoints({
    userId: row.userId,
    amount: -row.points,
    reason: `取消 ${ymdLocal(row.sessionDate)} 訓練出席`,
    refType: 'TRAINING',
    refId: row.id,
  });

  return NextResponse.json({ ok: true });
}
