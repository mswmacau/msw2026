import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/lib/auth';
import { addPoints } from '@/lib/points';

/**
 * POST { code } 核銷優惠券。
 * 前台商家輸入會員出示的券號（或用 QR Code 掃描後帶入），核銷後即不可重複使用。
 */
export async function POST(req: Request) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: '沒有權限' }, { status: 403 });

  try {
    const { code } = await req.json();
    const clean = String(code || '').trim().toUpperCase();
    if (!clean) return NextResponse.json({ error: '請輸入優惠券號' }, { status: 400 });

    const coupon = await prisma.coupon.findUnique({
      where: { code: clean },
      include: { user: { select: { displayName: true, name: true, email: true } } },
    });
    if (!coupon) {
      return NextResponse.json({ error: '找不到這個優惠券號' }, { status: 404 });
    }
    if (coupon.status === 'USED') {
      return NextResponse.json(
        {
          error: `此券已於 ${coupon.usedAt?.toLocaleString('zh-TW')} 核銷過`,
          usedAt: coupon.usedAt,
        },
        { status: 409 }
      );
    }
    if (new Date() > coupon.expiresAt) {
      await prisma.coupon.update({
        where: { id: coupon.id },
        data: { status: 'EXPIRED' },
      });
      return NextResponse.json({ error: '此優惠券已過期' }, { status: 410 });
    }

    await prisma.coupon.update({
      where: { id: coupon.id },
      data: { status: 'USED', usedAt: new Date() },
    });
    await addPoints({
      userId: coupon.userId,
      amount: 20,
      reason: `優惠券核銷回饋（${coupon.code}）`,
      refType: 'COUPON',
      refId: coupon.id,
    });

    return NextResponse.json({
      ok: true,
      message: `核銷成功：${coupon.discount}`,
      coupon: {
        code: coupon.code,
        title: coupon.title,
        discount: coupon.discount,
        periodMonth: coupon.periodMonth,
        memberName: coupon.user.displayName || coupon.user.name || coupon.user.email,
      },
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || '核銷失敗' }, { status: 500 });
  }
}

/** GET ?code=XXX 查詢券號狀態（核銷前先確認，不改變狀態） */
export async function GET(req: Request) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: '沒有權限' }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const code = String(searchParams.get('code') || '').trim().toUpperCase();
  if (!code) return NextResponse.json({ error: '請輸入券號' }, { status: 400 });

  const coupon = await prisma.coupon.findUnique({
    where: { code },
    include: { user: { select: { displayName: true, name: true, email: true } } },
  });
  if (!coupon) return NextResponse.json({ error: '找不到這個優惠券號' }, { status: 404 });

  return NextResponse.json({
    code: coupon.code,
    title: coupon.title,
    discount: coupon.discount,
    status: coupon.status,
    expiresAt: coupon.expiresAt,
    periodMonth: coupon.periodMonth,
    memberName: coupon.user.displayName || coupon.user.name || coupon.user.email,
  });
}
