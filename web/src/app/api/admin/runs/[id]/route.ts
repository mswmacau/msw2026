import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { approveRunRecord, rejectRunRecord } from '@/lib/points';

/** PATCH：管理員確認 / 駁回一筆跑步紀錄 */
export async function PATCH(
  req: Request,
  { params }: { params: { id: string } }
) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: '沒有權限' }, { status: 403 });

  try {
    const { action, reason } = await req.json();
    if (action === 'approve') {
      const result = await approveRunRecord(params.id, admin.id);
      return NextResponse.json({
        ok: true,
        message: `已確認 ${result.km} km，該月累積 ${result.monthTotal} km`,
      });
    }
    if (action === 'reject') {
      await rejectRunRecord(params.id, admin.id, reason || '管理員駁回');
      return NextResponse.json({ ok: true, message: '已駁回' });
    }
    return NextResponse.json({ error: '未知操作' }, { status: 400 });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || '操作失敗' }, { status: 500 });
  }
}
