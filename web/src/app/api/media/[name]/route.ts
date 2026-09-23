import { NextResponse } from 'next/server';
import { readFile } from 'fs/promises';
import path from 'path';
import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

const MIME: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
};

/**
 * 受控讀取上傳的跑步截圖。
 * 權限：僅「截圖本人」或「管理員」可讀，避免會員之間互相看到彼此的運動紀錄。
 */
export async function GET(
  req: Request,
  { params }: { params: { name: string } }
) {
  const user = await getCurrentUser();
  if (!user) return new NextResponse('未授權', { status: 401 });

  const name = params.name;
  // 防路徑穿越：只允許純檔名
  if (!/^[A-Za-z0-9._-]+$/.test(name)) {
    return new NextResponse('檔名不合法', { status: 400 });
  }

  // 管理員可看全部
  if (user.role !== 'ADMIN') {
    // 1) 自己上傳的圖（檔名帶使用者標記），即使尚未建立跑步紀錄也能預覽
    const isOwnUpload = name.startsWith(`${user.id.slice(-8)}-`);
    // 2) 或已關聯到自己名下的跑步紀錄
    const owned = isOwnUpload
      ? true
      : await prisma.runRecord.findFirst({
          where: { userId: user.id, screenshotUrl: { contains: name } },
          select: { id: true },
        });
    if (!owned) return new NextResponse('沒有權限', { status: 403 });
  }

  try {
    const file = await readFile(path.join(process.cwd(), 'data', 'uploads', name));
    const ext = name.split('.').pop()?.toLowerCase() || 'jpg';
    return new NextResponse(new Uint8Array(file), {
      headers: {
        'Content-Type': MIME[ext] || 'application/octet-stream',
        'Cache-Control': 'private, max-age=3600',
      },
    });
  } catch {
    return new NextResponse('找不到檔案', { status: 404 });
  }
}
