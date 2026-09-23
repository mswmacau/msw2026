import { PrismaClient } from '@prisma/client';
const p = new PrismaClient();

const kelvin = await p.user.findUnique({ where: { email: 'kelvin@msw.mo' } });

// 建立一張已過期券（測試用，測完會刪除）
const existing = await p.coupon.findUnique({ where: { code: 'MSW-202601-EXPIRED' } });
if (!existing) {
  await p.coupon.create({
    data: {
      code: 'MSW-202601-EXPIRED',
      userId: kelvin.id,
      title: 'QA 過期測試券',
      description: '自動化測試用，測完刪除',
      discount: '全館 8 折',
      periodMonth: '2026-01',
      status: 'UNUSED',
      expiresAt: new Date('2026-02-01T00:00:00Z'),
    },
  });
  console.log('created expired coupon');
} else {
  console.log('expired coupon already exists, status =', existing.status, 'expiresAt =', existing.expiresAt);
}

console.log(JSON.stringify(await p.coupon.findMany({ select: { code: true, status: true, expiresAt: true } }), null, 1));
await p.$disconnect();
