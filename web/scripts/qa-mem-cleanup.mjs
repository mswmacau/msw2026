import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
const db = new PrismaClient();

const actions = [];

// 1) ming 密碼還原為 msw2026
await db.user.update({
  where: { email: 'ming@msw.mo' },
  data: { passwordHash: await bcrypt.hash('msw2026', 10), displayName: '阿明', name: '阿明' },
});
actions.push('ming@msw.mo: 密碼還原 msw2026，暱稱還原「阿明」');

// 2) Kelvin 的測試積分變動還原（+50/-50 兩筆已抵銷，僅清 pointLog）
const kelvin = await db.user.findUnique({ where: { email: 'kelvin@msw.mo' } });
const delK = await db.pointLog.deleteMany({
  where: { userId: kelvin.id, reason: { in: ['測試加分', '測試扣分'] } },
});
actions.push(`kelvin@msw.mo: 刪除 ${delK.count} 筆測試 pointLog，積分維持 376`);

// 3) hui 的 pretest 邊界積分還原（35 → 87，需扣回 52）
const hui = await db.user.findUnique({ where: { email: 'hui@msw.mo' } });
const delH = await db.pointLog.deleteMany({
  where: { userId: hui.id, reason: 'pretest_邊界' },
});
await db.user.update({ where: { id: hui.id }, data: { points: 35, totalPoints: 35 } });
actions.push(`hui@msw.mo: 刪除 ${delH.count} 筆 pretest_邊界 log，積分 ${hui.points} → 35，totalPoints → 35`);

// 4) 角色還原
await db.user.update({ where: { email: 'kelvin@msw.mo' }, data: { role: 'MEMBER' } });
await db.user.update({ where: { email: 'joe@msw.mo' }, data: { role: 'MEMBER' } });
await db.user.update({ where: { email: 'admin@msw.mo' }, data: { role: 'ADMIN', displayName: 'MSW 管理員', name: 'MSW 管理員' } });
actions.push('角色還原：admin=ADMIN，kelvin/joe=以 MEMBER');

// 驗證
const users = await db.user.findMany({
  select: { email: true, displayName: true, role: true, points: true, totalPoints: true },
  orderBy: { createdAt: 'asc' },
});
console.log('=== 清理後狀態 ===');
actions.forEach((a) => console.log(' -', a));
console.log('\n=== USERS ===');
console.table(users);

const logs = await db.pointLog.findMany({ orderBy: { createdAt: 'desc' } });
console.log('\n=== 剩餘 pointLog ===');
console.table(logs.map((l) => ({ user: l.userId.slice(-6), amount: l.amount, reason: l.reason })));

await db.$disconnect();
