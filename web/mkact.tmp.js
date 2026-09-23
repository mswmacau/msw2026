const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
(async () => {
  const slug = 'qa-驗證活動';
  const old = await p.activity.findUnique({ where: { slug } });
  if (old) await p.activity.delete({ where: { slug } });
  await p.activity.create({
    data: { slug, title: '中文網址測試', subtitle: '', published: true },
  });
  console.log('created:', slug);
  await p.$disconnect();
})();
