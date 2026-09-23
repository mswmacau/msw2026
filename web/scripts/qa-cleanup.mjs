import { PrismaClient } from '@prisma/client';
const p = new PrismaClient();

// 1) 還原「阿明」因 lowercase 邊界探測被誤核銷的券
const mingLog = await p.pointLog.findFirst({ where: { reason: { contains: 'MSW-202609-KSXUUUGF' } } });
if (mingLog) {
  await p.pointLog.delete({ where: { id: mingLog.id } });
  console.log('deleted accidental pointLog', mingLog.id, mingLog.amount);
}
const mingBefore = { points: 87, totalPoints: 107 };   // 測試前基線
await p.user.update({ where: { email: 'ming@msw.mo' }, data: mingBefore });
await p.coupon.update({
  where: { code: 'MSW-202609-KSXUUUGF' },
  data: { status: 'UNUSED', usedAt: null },
});
console.log('restored 阿明 coupon -> UNUSED, points ->', mingBefore);

// 2) 刪除測試用過期券
const del = await p.coupon.deleteMany({ where: { code: 'MSW-202601-EXPIRED' } });
console.log('deleted expired test coupon count =', del.count);

console.log('--- 現況 ---');
console.log(JSON.stringify(await p.user.findMany({ where: { email: { in: ['kelvin@msw.mo', 'ming@msw.mo'] } }, select: { name: true, points: true, totalPoints: true } }), null, 1));
console.log(JSON.stringify(await p.coupon.findMany({ select: { code: true, status: true, user: { select: { name: true } } } }), null, 1));
console.log(JSON.stringify(await p.pointLog.findMany({ where: { refType: 'COUPON' }, select: { amount: true, reason: true } }), null, 1));
await p.$disconnect();
