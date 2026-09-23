import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';
import { addPoints } from '@/lib/points';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const email = String(body.email || '').toLowerCase().trim();
    const password = String(body.password || '');
    const displayName = String(body.displayName || '').trim();

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: 'Email 格式不正確' }, { status: 400 });
    }
    if (password.length < 8) {
      return NextResponse.json({ error: '密碼至少需要 8 個字元' }, { status: 400 });
    }
    if (password.length > 72) {
      return NextResponse.json({ error: '密碼不可超過 72 個字元' }, { status: 400 });
    }
    // 暱稱長度檢查要在寫入前做：MySQL 欄位超長會直接拋錯變成 500
    if (!displayName) {
      return NextResponse.json({ error: '請填寫暱稱' }, { status: 400 });
    }
    if (displayName.length > 30) {
      return NextResponse.json({ error: '暱稱不可超過 30 個字元' }, { status: 400 });
    }

    const exists = await prisma.user.findUnique({ where: { email } });
    if (exists) {
      return NextResponse.json({ error: '此 Email 已被註冊' }, { status: 409 });
    }

    const user = await prisma.user.create({
      data: {
        email,
        name: displayName,
        displayName,
        passwordHash: await bcrypt.hash(password, 10),
        role: 'MEMBER',
      },
    });

    // 註冊禮：50 積分
    await addPoints({
      userId: user.id,
      amount: 50,
      reason: '註冊會員贈送積分',
      refType: 'MANUAL',
    });

    return NextResponse.json({ ok: true, email: user.email });
  } catch (e: any) {
    // 不回傳 e.message，避免外洩資料庫錯誤細節
    console.error('[register] 失敗：', e);
    return NextResponse.json({ error: '註冊失敗，請稍後再試' }, { status: 500 });
  }
}
