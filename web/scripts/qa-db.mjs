import { PrismaClient } from '@prisma/client';
const p = new PrismaClient();

const users = await p.user.findMany({
  where: { email: { in: ['kelvin@msw.mo', 'ming@msw.mo'] } },
  select: { id: true, name: true, email: true, points: true, totalPoints: true, role: true },
});
console.log('=== USERS BASELINE ===');
console.log(JSON.stringify(users, null, 1));

const coupons = await p.coupon.findMany({
  select: { id: true, code: true, status: true, usedAt: true, expiresAt: true, periodMonth: true, title: true, userId: true, user: { select: { name: true, email: true } } },
  orderBy: { createdAt: 'asc' },
});
console.log('=== COUPONS BASELINE ===');
console.log(JSON.stringify(coupons, null, 1));

const kelvin = users.find((u) => u.email === 'kelvin@msw.mo');
if (kelvin) {
  const logs = await p.pointLog.findMany({ where: { userId: kelvin.id }, orderBy: { createdAt: 'desc' }, take: 10 });
  console.log('=== KELVIN POINT LOGS (baseline) ===');
  console.log(JSON.stringify(logs, null, 1));
}

await p.$disconnect();
