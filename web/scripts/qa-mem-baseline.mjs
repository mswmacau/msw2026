import { PrismaClient } from '@prisma/client';
const p = new PrismaClient();

const users = await p.user.findMany({
  select: {
    id: true,
    email: true,
    name: true,
    displayName: true,
    role: true,
    points: true,
    totalPoints: true,
  },
  orderBy: { createdAt: 'asc' },
});
console.log('=== BASELINE USERS ===');
console.log(JSON.stringify(users, null, 1));

for (const u of users) {
  const c = await p.runRecord.count({ where: { userId: u.id } });
  const cp = await p.coupon.count({ where: { userId: u.id } });
  const unused = await p.coupon.count({ where: { userId: u.id, status: 'UNUSED' } });
  console.log(`${u.email} runs=${c} coupons=${cp} unused=${unused}`);
}
await p.$disconnect();
