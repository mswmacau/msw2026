import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser, requireAdmin } from '@/lib/auth';
import { currentMonth } from '@/lib/points';

/** GET：我的紀錄（一般會員）或全部紀錄（管理員帶 ?all=1） */
export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: '請先登入' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const all = searchParams.get('all') === '1';
  const status = searchParams.get('status');
  const month = searchParams.get('month');

  if (all && user.role !== 'ADMIN') {
    return NextResponse.json({ error: '沒有權限' }, { status: 403 });
  }

  const where: any = all ? {} : { userId: user.id };
  if (status) where.status = status;
  if (month) where.periodMonth = month;

  const records = await prisma.runRecord.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: 200,
    include: {
      user: { select: { id: true, displayName: true, name: true, email: true } },
    },
  });

  return NextResponse.json({
    records: records.map((r) => ({
      ...r,
      km: Number(r.km),
    })),
  });
}

/** POST：上傳跑步截圖 + 公里數 */
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: '請先登入' }, { status: 401 });

  try {
    const body = await req.json();
    const km = Number(body.km);
    const screenshotUrl = String(body.screenshotUrl || '');
    const periodMonth = String(body.periodMonth || currentMonth());
    const note = String(body.note || '').slice(0, 500);

    if (!Number.isFinite(km) || km <= 0 || km > 200) {
      return NextResponse.json({ error: '公里數需介於 0 – 200 之間' }, { status: 400 });
    }
    if (!screenshotUrl) {
      return NextResponse.json({ error: '請上傳跑步截圖' }, { status: 400 });
    }
    if (!/^\d{4}-\d{2}$/.test(periodMonth)) {
      return NextResponse.json({ error: '月份格式錯誤' }, { status: 400 });
    }

    const record = await prisma.runRecord.create({
      data: {
        userId: user.id,
        km,
        screenshotUrl,
        periodMonth,
        note: note || null,
        status: 'PENDING',
      },
    });

    return NextResponse.json({ ok: true, id: record.id });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || '提交失敗' }, { status: 500 });
  }
}
