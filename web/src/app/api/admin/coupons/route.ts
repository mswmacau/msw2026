import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { getMonthlyWinners, issueCoupons, currentMonth } from '@/lib/points';
import { prisma } from '@/lib/prisma';

/** GET：某月份的達成名單 */
export async function GET(req: Request) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: '沒有權限' }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const month = searchParams.get('month') || currentMonth();
  const winners = await getMonthlyWinners(month);
  return NextResponse.json({ month, winners });
}

/** POST：批次發放優惠券 */
export async function POST(req: Request) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: '沒有權限' }, { status: 403 });

  try {
    const { month, userIds, title, discount, description } = await req.json();
    const target = String(month || currentMonth());
    let ids: string[] = Array.isArray(userIds) ? userIds : [];

    // 沒指定名單 → 自動抓全部達標者（未發過券的）
    if (!ids.length) {
      const winners = await getMonthlyWinners(target);
      ids = winners.filter((w) => !w.alreadyIssued).map((w) => w.userId);
    }

    const created = await issueCoupons(target, ids, { title, discount, description });
    return NextResponse.json({ ok: true, issued: created.length, coupons: created });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || '發放失敗' }, { status: 500 });
  }
}

/** DELETE：回收／作廢優惠券 */
export async function DELETE(req: Request) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: '沒有權限' }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');
  if (!id) return NextResponse.json({ error: '缺少 id' }, { status: 400 });
  await prisma.coupon.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
