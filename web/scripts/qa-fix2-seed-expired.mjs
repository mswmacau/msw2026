import { PrismaClient } from '@prisma/client';
const p = new PrismaClient();

const CODE = 'PRETEST-EXPIRED-01';
const ming = await p.user.findUnique({ where: { email: 'ming@msw.mo' } });

const existing = await p.coupon.findUnique({ where: { code: CODE } });
if (!existing) {
  await p.coupon.create({
    data: {
      code: CODE,
      userId: ming.id,
      title: 'PRETEST 過期測試券',
      description: '複驗 P2-2 用，可刪除',
      discount: '全館 8 折',
      periodMonth: '2026-01',
      status: 'UNUSED',
      expiresAt: new Date('2026-02-01T00:00:00Z'),
    },
  });
  console.log('created', CODE);
} else {
  console.log('exists', CODE, existing.status, existing.expiresAt.toISOString());
}

console.log(
  JSON.stringify(
    await p.coupon.findMany({ select: { code: true, status: true, expiresAt: true } }),
    null,
    1
  )
);
await p.$disconnect();
