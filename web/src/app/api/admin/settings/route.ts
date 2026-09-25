import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/lib/auth';
import { DEFAULT_SETTINGS, clearSettingsCache } from '@/lib/site';

/** GET：目前設定（含預設值） */
export async function GET() {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: '沒有權限' }, { status: 403 });

  const rows = await prisma.siteSetting.findMany();
  const map: Record<string, string> = { ...DEFAULT_SETTINGS };
  for (const r of rows) map[r.key] = r.value;
  return NextResponse.json({ settings: map });
}

/** PUT：批次更新設定（前台立即生效） */
export async function PUT(req: Request) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: '沒有權限' }, { status: 403 });

  try {
    const body = await req.json();
    const entries = Object.entries(body as Record<string, string>);
    if (!entries.length) {
      return NextResponse.json({ error: '沒有要更新的內容' }, { status: 400 });
    }

    for (const [key, value] of entries) {
      if (!(key in DEFAULT_SETTINGS)) continue; // 忽略未知欄位，避免寫入垃圾
      await prisma.siteSetting.upsert({
        where: { key },
        update: { value: String(value ?? '') },
        create: { key, value: String(value ?? '') },
      });
    }

    clearSettingsCache(); // 讓前台立即套用新設定
    return NextResponse.json({ ok: true, updated: entries.length });
  } catch (e: any) {
    console.error('[settings] 更新失敗：', e);
    return NextResponse.json({ error: '儲存失敗，請稍後再試' }, { status: 500 });
  }
}

/** DELETE：把某個設定還原成預設值 */
export async function DELETE(req: Request) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: '沒有權限' }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const key = searchParams.get('key');
  if (!key) return NextResponse.json({ error: '缺少 key' }, { status: 400 });
  await prisma.siteSetting.deleteMany({ where: { key } });
  clearSettingsCache();
  return NextResponse.json({ ok: true });
}
