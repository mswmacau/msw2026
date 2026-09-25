import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/lib/auth';
import { clearActivitiesCache } from '@/lib/events';
import { FALLBACK_ACTIVITIES } from '@/lib/events';

/**
 * 產生網址代稱。
 * 注意：只保留英數字，中文一律轉成連字號。
 * 原因是 Next.js 動態路由對非 ASCII 的 slug 比對不穩，會讓活動內頁變成 404。
 */
function slugify(s: string) {
  const out = (s || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
  return out || `act-${Date.now().toString(36)}`;
}

/** GET：後台用的完整活動清單（含未上架） */
export async function GET() {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: '沒有權限' }, { status: 403 });

  const rows = await prisma.activity.findMany({
    orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
  });
  return NextResponse.json({
    activities: rows.map((r) => ({ ...r, highlights: JSON.parse(r.highlights || '[]') })),
  });
}

/** POST：新增活動 */
export async function POST(req: Request) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: '沒有權限' }, { status: 403 });

  try {
    const b = await req.json();

    // 一鍵匯入三個內建示範活動（資料庫還沒有活動時用）
    if (b.seed === true) {
      let added = 0;
      for (let i = 0; i < FALLBACK_ACTIVITIES.length; i += 1) {
        const a = FALLBACK_ACTIVITIES[i];
        const exists = await prisma.activity.findUnique({ where: { slug: a.slug } });
        if (exists) continue;
        await prisma.activity.create({
          data: {
            slug: a.slug,
            title: a.title,
            subtitle: a.subtitle,
            image: a.image,
            tag: a.tag,
            schedule: a.schedule,
            location: a.location,
            points: a.points,
            description: a.description,
            highlights: JSON.stringify(a.highlights),
            published: true,
            sortOrder: i,
          },
        });
        added += 1;
      }
      return NextResponse.json({ ok: true, added });
    }

    if (!b.title?.trim()) {
      return NextResponse.json({ error: '請填寫活動名稱' }, { status: 400 });
    }
    const slug = slugify(b.slug?.trim() || b.title);
    const exists = await prisma.activity.findUnique({ where: { slug } });
    if (exists) {
      return NextResponse.json({ error: '這個網址代稱已被使用' }, { status: 409 });
    }

    const created = await prisma.activity.create({
      data: {
        slug,
        title: String(b.title).trim(),
        subtitle: String(b.subtitle || '').trim(),
        image: String(b.image || '/images/street-workout.jpg').trim(),
        tag: String(b.tag || '活動').trim(),
        schedule: String(b.schedule || '').trim(),
        location: String(b.location || '澳門').trim(),
        points: String(b.points || '—').trim(),
        description: String(b.description || '').trim(),
        highlights: JSON.stringify(Array.isArray(b.highlights) ? b.highlights : []),
        published: b.published !== false,
        sortOrder: Number(b.sortOrder ?? 0),
      },
    });
    clearActivitiesCache();
    return NextResponse.json({ ok: true, id: created.id, slug: created.slug });
  } catch (e: any) {
    console.error('[activities] 新增失敗：', e);
    return NextResponse.json({ error: '新增失敗，請稍後再試' }, { status: 500 });
  }
}

/** PATCH：編輯活動（含上架 / 下架） */
export async function PATCH(req: Request) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: '沒有權限' }, { status: 403 });

  try {
    const b = await req.json();
    const id = String(b.id || '');
    if (!id) return NextResponse.json({ error: '缺少 id' }, { status: 400 });

    const data: any = {};
    for (const k of [
      'title', 'subtitle', 'image', 'tag', 'schedule',
      'location', 'points', 'description', 'slug',
    ]) {
      if (b[k] !== undefined) data[k] = String(b[k]).trim();
    }
    if (b.highlights !== undefined) {
      data.highlights = JSON.stringify(Array.isArray(b.highlights) ? b.highlights : []);
    }
    if (b.published !== undefined) data.published = Boolean(b.published);
    if (b.sortOrder !== undefined) data.sortOrder = Number(b.sortOrder);

    await prisma.activity.update({ where: { id }, data });
    clearActivitiesCache();
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    console.error('[activities] 更新失敗：', e);
    return NextResponse.json({ error: '更新失敗，請稍後再試' }, { status: 500 });
  }
}

/** DELETE：刪除活動 */
export async function DELETE(req: Request) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: '沒有權限' }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');
  if (!id) return NextResponse.json({ error: '缺少 id' }, { status: 400 });
  await prisma.activity.delete({ where: { id } });
  clearActivitiesCache();
    return NextResponse.json({ ok: true });
}
