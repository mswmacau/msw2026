import { NextResponse } from 'next/server';
import { writeFile, mkdir } from 'fs/promises';
import path from 'path';
import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

const MAX_SIZE = 8 * 1024 * 1024; // 8MB
const ALLOWED = ['image/jpeg', 'image/png', 'image/webp', 'image/heic'];
const MIME: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  heic: 'image/heic',
};

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: '請先登入' }, { status: 401 });

  try {
    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    if (!file) return NextResponse.json({ error: '沒有收到檔案' }, { status: 400 });
    if (file.size > MAX_SIZE) {
      return NextResponse.json({ error: '檔案超過 8MB' }, { status: 400 });
    }
    if (!ALLOWED.includes(file.type)) {
      return NextResponse.json({ error: '只接受 JPG / PNG / WebP 圖片' }, { status: 400 });
    }

    const ext = file.type.split('/')[1].replace('jpeg', 'jpg');
    // 檔名帶上傳者標記：讓剛上傳、尚未建立紀錄的圖也能被本人預覽
    const name = `${user.id.slice(-8)}-${Date.now()}-${Math.random()
      .toString(36)
      .slice(2, 8)}.${ext}`;
    const buffer = Buffer.from(await file.arrayBuffer());

    // 管理員上傳的是公開素材（Logo、背景圖、活動封面），
    // 必須讓未登入訪客也能讀取，否則前台會破圖。
    const isPublicAsset = user.role === 'ADMIN';
    const finalName = isPublicAsset ? `pub-${name}` : name;

    // ── ① 雲端圖床（Vercel Blob）：有 BLOB_READ_WRITE_TOKEN 就優先用 ──
    const token = process.env.BLOB_READ_WRITE_TOKEN;
    if (token) {
      try {
        const res = await fetch(`https://blob.vercel-storage.com/${name}`, {
          method: 'PUT',
          headers: {
            authorization: `Bearer ${token}`,
            'x-api-version': '7',
            'x-content-type': file.type,
            'x-add-random-suffix': '1',
            'x-cache-control-max-age': '31536000',
          },
          body: new Uint8Array(buffer),
        });
        if (res.ok) {
          const data = (await res.json()) as { url?: string };
          if (data.url) return NextResponse.json({ url: data.url });
        }
        console.error('[upload] Blob 失敗，改用其他方式：', res.status);
      } catch (e) {
        console.error('[upload] Blob 連線失敗，改用其他方式：', e);
      }
    }

    // ── ② 寫入硬碟（本機 / 自架主機）───────────────────────────
    // 不可存進 public/：Next.js 啟動時已快照 public 檔案清單，
    // 執行時期寫入的檔案一律 404（後台審核會看不到圖）。
    try {
      const dir = isPublicAsset
        ? path.join(process.cwd(), 'data', 'public')
        : path.join(process.cwd(), 'data', 'uploads');
      await mkdir(dir, { recursive: true });
      await writeFile(
        path.join(dir, isPublicAsset ? name : name),
        buffer
      );
      return NextResponse.json({ url: `/api/media/${finalName}` });
    } catch (e) {
      // Vercel 等雲端平台的檔案系統是唯讀的，會走到這裡
      console.warn('[upload] 硬碟寫入失敗，改用資料庫儲存：', e);
    }

    // ── ③ 最後手段：存進資料庫（任何雲端平台都可用）─────────────
    const asset = await prisma.mediaAsset.create({
      data: {
        mime: MIME[ext] || file.type,
        data: buffer,
        size: buffer.length,
        uploaderId: user.id,
      },
      select: { id: true },
    });
    return NextResponse.json({ url: `/api/media/db-${asset.id}` });
  } catch (e: any) {
    console.error('[upload] 失敗：', e);
    return NextResponse.json({ error: '上傳失敗，請稍後再試' }, { status: 500 });
  }
}
