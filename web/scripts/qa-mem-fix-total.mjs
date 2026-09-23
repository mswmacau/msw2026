import { PrismaClient } from '@prisma/client';
const db = new PrismaClient();
const u = await db.user.findUnique({ where: { email: 'kelvin@msw.mo' } });
console.log('before: points=', u.points, 'totalPoints=', u.totalPoints);
// 測試前總累積 376（無任何 pointLog 基線），還原為 376
await db.user.update({ where: { email: 'kelvin@msw.mo' }, data: { totalPoints: 376 } });
const v = await db.user.findUnique({ where: { email: 'kelvin@msw.mo' } });
console.log('after : points=', v.points, 'totalPoints=', v.totalPoints);
await db.$disconnect();
