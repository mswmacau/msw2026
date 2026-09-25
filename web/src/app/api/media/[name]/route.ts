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
  heic: 'image/heic',
};

/**
 * 讀取上傳圖片。
 *
 * 公開圖片（Logo、首頁背景、活動封面）必須讓未登入訪客也能看到，否則全站破圖：
 *   /api/media/pub-xxxxxxxx-1730000000-ab12cd.jpg → 公開資料夾
 *   /api/media/db-cuidxxxx                        → 資料庫（上傳者為管理員即公開）
 *   /api/media/https://...                        → 雲端圖床（Vercel Blob，本身即公開）
 *
 * 私密圖片（會員上傳的跑步截圖）：
 *   /api/media/xxxxxxxx-1730000000-ab12cd.jpg     → 僅本人或管理員可讀
 */
export async function GET(
  req: Request,
  { params }: { params: { name: string } }
) {
  const name = params.name;

  // 雲端圖床網址進到網址路徑後，雙斜線可能被正規化成單斜線（https:// → https:/），這裡還原
  const blobUrl = /^https?:\/{1,2}/.test(name)
    ? name.replace(/^(https?:)\/{1,2}/, '$1//')
    : null;
  const isBlob = !!blobUrl;
  const isPublicFile = name.startsWith('pub-');
  const isDb = name.startsWith('db-');

  // 防路徑穿越：只允許純檔名（雲端網址除外）
  if (!isBlob && !/^[A-Za-z0-9._-]+$/.test(name)) {
    return new NextResponse('檔名不合法', { status: 400 });
  }

  const user = await getCurrentUser();

  // ── 雲端圖床：本身就是公開網址，直接轉址 ──
  if (isBlob && blobUrl) {
    return NextResponse.redirect(blobUrl, 307);
  }

  // ── 資料庫 ──
  if (isDb) {
    const asset = await prisma.mediaAsset.findUnique({
      where: { id: name.slice(3) },
      select: { id: true, data: true, mime: true, size: true, uploaderId: true },
    });
    if (!asset) return new NextResponse('找不到檔案', { status: 404 });

    // 管理員上傳的圖片（Logo、封面）視為公開素材
    const owner = asset.uploaderId
      ? await prisma.user.findUnique({
          where: { id: asset.uploaderId },
          select: { role: true },
        })
      : null;
    const isPublicAsset = owner?.role === 'ADMIN';
    if (!isPublicAsset) {
      if (!user) return new NextResponse('未授權', { status: 401 });
      if (user.role !== 'ADMIN' && asset.uploaderId !== user.id) {
        return new NextResponse('沒有權限', { status: 403 });
      }
    }
    return new NextResponse(new Uint8Array(asset.data), {
      headers: {
        'Content-Type': asset.mime || 'application/octet-stream',
        'Content-Length': String(asset.size || asset.data.length),
        'Cache-Control': isPublicAsset ? 'public, max-age=604800' : 'private, max-age=3600',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  }

  // ── 公開資料夾（Logo / 背景 / 封面）──
  if (isPublicFile) {
    try {
      const file = await readFile(
        path.join(process.cwd(), 'data', 'public', name.slice(4))
      );
      const ext = name.split('.').pop()?.toLowerCase() || 'jpg';
      return new NextResponse(new Uint8Array(file), {
        headers: {
          'Content-Type': MIME[ext] || 'application/octet-stream',
          'Cache-Control': 'public, max-age=604800',
          'X-Content-Type-Options': 'nosniff',
        },
      });
    } catch {
      return new NextResponse('找不到檔案', { status: 404 });
    }
  }

  // ── 私密：會員上傳的跑步截圖 ──
  if (!user) return new NextResponse('未授權', { status: 401 });

  if (user.role !== 'ADMIN') {
    // 1) 自己上傳的圖（檔名帶使用者標記），即使尚未建立紀錄也能預覽
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
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch {
    return new NextResponse('找不到檔案', { status: 404 });
  }
}
