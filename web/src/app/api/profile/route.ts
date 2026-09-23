import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth';

/** PATCH：會員自助修改暱稱 / 密碼 */
export async function PATCH(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: '請先登入' }, { status: 401 });

  try {
    const { displayName, currentPassword, newPassword } = await req.json();
    const data: any = {};

    if (typeof displayName === 'string' && displayName.trim()) {
      const name = displayName.trim().slice(0, 30);
      data.displayName = name;
      data.name = name;
    }

    if (newPassword) {
      if (String(newPassword).length < 8) {
        return NextResponse.json({ error: '新密碼至少需要 8 個字元' }, { status: 400 });
      }
      // 若原本用密碼註冊，必須驗證舊密碼
      if (user.passwordHash) {
        if (!currentPassword) {
          return NextResponse.json({ error: '請輸入目前密碼' }, { status: 400 });
        }
        const ok = await bcrypt.compare(currentPassword, user.passwordHash);
        if (!ok) {
          return NextResponse.json({ error: '目前密碼不正確' }, { status: 403 });
        }
      }
      data.passwordHash = await bcrypt.hash(String(newPassword), 10);
    }

    if (!Object.keys(data).length) {
      return NextResponse.json({ error: '沒有需要更新的資料' }, { status: 400 });
    }

    await prisma.user.update({ where: { id: user.id }, data });
    return NextResponse.json({ ok: true, message: '資料已更新' });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || '更新失敗' }, { status: 500 });
  }
}
