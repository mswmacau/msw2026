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
    const name = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const dir = path.join(process.cwd(), 'public', 'uploads');
    await mkdir(dir, { recursive: true });

    const buffer = Buffer.from(await file.arrayBuffer());
    await writeFile(path.join(dir, name), buffer);

    return NextResponse.json({ url: `/uploads/${name}` });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || '上傳失敗' }, { status: 500 });
  }
}
