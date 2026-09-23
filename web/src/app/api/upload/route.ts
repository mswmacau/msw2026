import { NextResponse } from 'next/server';
import { writeFile, mkdir } from 'fs/promises';
import path from 'path';
import { getCurrentUser } from '@/lib/auth';

const MAX_SIZE = 8 * 1024 * 1024; // 8MB
const ALLOWED = ['image/jpeg', 'image/png', 'image/webp', 'image/heic'];

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
    // 不可存進 public/：Next.js 啟動時已快照 public 檔案清單，
    // 執行時期寫入的檔案在正式環境一律 404（後台審核會看不到圖）。
    const dir = path.join(process.cwd(), 'data', 'uploads');
    await mkdir(dir, { recursive: true });

    const buffer = Buffer.from(await file.arrayBuffer());
    await writeFile(path.join(dir, name), buffer);

    return NextResponse.json({ url: `/api/media/${name}` });
  } catch (e: any) {
    console.error('[upload] 失敗：', e);
    return NextResponse.json({ error: '上傳失敗，請稍後再試' }, { status: 500 });
  }
}
