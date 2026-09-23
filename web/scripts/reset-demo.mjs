/**
 * 重置示範資料 — 把資料庫清乾淨後重建一組可用來展示的完整資料。
 * 用法：npm run demo:reset
 *
 * 內容包含：
 *  - 1 位管理員、4 位會員
 *  - 多筆跑步紀錄（一半待確認、一半已確認）
 *  - Kelvin 當月累積超過 300KM（已達標，可在後台看到達成名單）
 *  - 阿明一張「未使用」的優惠券（可用來展示核銷流程）
 */
import { execSync } from 'child_process';
import { PrismaClient } from '@prisma/client';

function run(cmd) {
  console.log(`$ ${cmd}`);
  execSync(cmd, { stdio: 'inherit' });
}

console.log('\n=== 重置 MSW 街健館示範資料 ===\n');
run('npx prisma db push --force-reset --skip-generate');
run('npx prisma generate');
run('npx tsx prisma/seed.ts');

const prisma = new PrismaClient();
const MONTH = (() => {
  const n = new Date();
  return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}`;
})();

// 讓 Kelvin 當月累積超過 300KM
const kelvin = await prisma.user.findUnique({ where: { email: 'kelvin@msw.mo' } });
const admin = await prisma.user.findUnique({ where: { email: 'admin@msw.mo' } });

const agg = await prisma.runRecord.aggregate({
  where: { userId: kelvin.id, periodMonth: MONTH, status: 'APPROVED' },
  _sum: { km: true },
});
let need = 320 - Number(agg._sum.km ?? 0);
while (need > 0) {
  const km = Math.min(25, need);
  await prisma.runRecord.create({
    data: {
      userId: kelvin.id,
      km,
      screenshotUrl: '/images/running-track.jpg',
      periodMonth: MONTH,
      note: '長距離訓練',
      status: 'APPROVED',
      reviewedAt: new Date(),
      reviewerId: admin.id,
    },
  });
  need -= km;
}
await prisma.user.update({
  where: { id: kelvin.id },
  data: { points: { increment: 300 }, totalPoints: { increment: 300 } },
});
console.log('  ✓ Kelvin 已設定為本月達標（320 KM）');

// 阿明一張未使用優惠券
const ming = await prisma.user.findUnique({ where: { email: 'ming@msw.mo' } });
const expires = new Date();
expires.setMonth(expires.getMonth() + 3);
await prisma.coupon.create({
  data: {
    code: `MSW-${MONTH.replace('-', '')}-DEMO01`,
    userId: ming.id,
    title: `${MONTH} 月度 300KM 達成優惠券`,
    description: '憑此券於 MSW 街健館課程 / 周邊消費使用',
    discount: '全館 8 折',
    periodMonth: MONTH,
    expiresAt: expires,
  },
});
console.log('  ✓ 阿明已取得一張未使用優惠券 MSW-' + MONTH.replace('-', '') + '-DEMO01');

const stats = await Promise.all([
  prisma.user.count(),
  prisma.runRecord.count(),
  prisma.runRecord.count({ where: { status: 'PENDING' } }),
  prisma.coupon.count(),
]);
console.log(
  `\n完成：${stats[0]} 位使用者、${stats[1]} 筆跑步紀錄（${stats[2]} 筆待確認）、${stats[3]} 張優惠券\n`
);
await prisma.$disconnect();
