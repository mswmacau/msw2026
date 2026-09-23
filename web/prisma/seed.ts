/**
 * 種子資料：建立管理員、示範會員、跑步紀錄，讓整套流程可以立刻驗證。
 * 執行：npm run db:seed
 */
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();
const MONTH = new Date().toISOString().slice(0, 7); // 例如 2026-09

async function main() {
  console.log('→ 建立管理員…');
  const admin = await prisma.user.upsert({
    where: { email: 'admin@msw.mo' },
    update: {},
    create: {
      email: 'admin@msw.mo',
      name: 'MSW 管理員',
      displayName: 'MSW 管理員',
      passwordHash: await bcrypt.hash('msw2026admin', 10),
      role: 'ADMIN',
      points: 0,
    },
  });
  console.log(`  ✓ 管理員：admin@msw.mo / msw2026admin`);

  const members = [
    { name: '阿明', email: 'ming@msw.mo', km: [12.4, 8.2, 21.0, 15.6] },
    { name: '小慧', email: 'hui@msw.mo', km: [10.0, 6.5, 18.3] },
    { name: 'Kelvin', email: 'kelvin@msw.mo', km: [30.0, 25.5, 20.2] },
    { name: '阿祖', email: 'joe@msw.mo', km: [5.5, 7.1] },
  ];

  const created = [];
  for (const m of members) {
    const u = await prisma.user.upsert({
      where: { email: m.email },
      update: {},
      create: {
        email: m.email,
        name: m.name,
        displayName: m.name,
        passwordHash: await bcrypt.hash('msw2026', 10),
        role: 'MEMBER',
      },
    });
    created.push({ user: u, km: m.km });
  }
  console.log(`  ✓ 建立 ${created.length} 位示範會員（密碼皆為 msw2026）`);

  // 跑步紀錄：一半已確認、一半待確認
  console.log('→ 建立跑步紀錄…');
  let i = 0;
  for (const { user, km } of created) {
    for (const k of km) {
      const approved = i % 2 === 0;
      await prisma.runRecord.create({
        data: {
          userId: user.id,
          km: k,
          // 用公開示意圖當作截圖，方便後台預覽測試
          screenshotUrl:
            k > 20 ? '/images/running-track.jpg' : '/images/training-outdoor.jpg',
          periodMonth: MONTH,
          note: k > 20 ? '週末長跑' : '平日夜跑',
          status: approved ? 'APPROVED' : 'PENDING',
          reviewedAt: approved ? new Date() : null,
          reviewerId: approved ? admin.id : null,
        },
      });
      i++;
    }

    // 積分：依照規則回饋
    const total = km.reduce((a, b) => a + b, 0);
    await prisma.user.update({
      where: { id: user.id },
      data: { points: Math.round(total), totalPoints: Math.round(total) },
    });
  }
  console.log(`  ✓ 跑步紀錄建立完成（月份：${MONTH}）`);

  console.log('\n完成！可用帳號：');
  console.log('  管理員  admin@msw.mo  / msw2026admin');
  console.log('  會員    ming@msw.mo   / msw2026');
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
