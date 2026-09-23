import { launch, newPage, sleep, login, fill, BASE, DESKTOP } from './qa-final-lib.mjs';
import fs from 'fs';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const R = { cases: [] };
const rec = (k, v) => { R.cases.push({ k, v }); console.log(`  ▸ ${k}:`, JSON.stringify(v)); };

const browser = await launch();
const mem = await newPage(browser, DESKTOP);
const adm = await newPage(browser, DESKTOP);

try {
  await login(mem, 'ming@msw.mo', 'msw2026');
  await login(adm, 'admin@msw.mo', 'msw2026admin');

  console.log('\n=== 併發重複確認同一筆紀錄（race condition）===');
  // 1. 會員提交一筆新紀錄
  const r = await mem.evaluate(async () => {
    const res = await fetch('/api/runs', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ km: 7.7, screenshotUrl: '/images/running-track.jpg', periodMonth: '2026-09', note: 'race測試' }),
    });
    return { status: res.status, body: (await res.json()) };
  });
  rec('1.submit', r);

  // 從 DB 取該筆 id + 會員目前積分
  const runRec = await prisma.runRecord.findFirst({
    where: { note: 'race測試', status: 'PENDING' }, orderBy: { createdAt: 'desc' },
  });
  const before = await prisma.user.findUnique({ where: { email: 'ming@msw.mo' }, select: { id: true, points: true } });
  rec('2.setup', { runId: runRec?.id, km: Number(runRec?.km), pointsBefore: before.points, userId: before.id });

  // 2. 同時打 5 次 approve（模擬管理員雙擊 / 多請求）
  const results = await adm.evaluate(async (id) => {
    const ps = Array.from({ length: 5 }).map(() =>
      fetch(`/api/admin/runs/${id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'approve' }),
      }).then(async (x) => ({ status: x.status, body: (await x.text()).slice(0, 90) })).catch((e) => ({ status: 'ERR', body: e.message }))
    );
    return Promise.all(ps);
  }, runRec.id);
  rec('3.concurrentApprove', results);

  await sleep(1500);
  const after = await prisma.user.findUnique({ where: { email: 'ming@msw.mo' }, select: { points: true } });
  const logs = await prisma.pointLog.findMany({
    where: { userId: before.id, refType: 'RUN', refId: runRec.id }, select: { amount: true },
  });
  rec('4.result', {
    pointsBefore: before.points,
    pointsAfter: after.points,
    delta: after.points - before.points,
    expectedIfOnce: Number(runRec.km),
    runPointLogsForThisRecord: logs.length,
    totalLoggedForRecord: logs.reduce((s, l) => s + l.amount, 0),
  });

  // 清理
  await prisma.pointLog.deleteMany({ where: { refId: runRec.id } });
  await prisma.runRecord.delete({ where: { id: runRec.id } });
  await prisma.user.update({ where: { id: before.id }, data: { points: { decrement: after.points - before.points } } });
  const cleaned = await prisma.user.findUnique({ where: { id: before.id }, select: { points: true } });
  rec('5.cleanup', { pointsRestoredTo: cleaned.points });
} catch (e) {
  R.fatal = String(e.stack || e.message);
  console.log('!!! FATAL ' + e.message);
} finally {
  fs.writeFileSync('/workspace/msw/web/scripts/qa-part6.json', JSON.stringify(R, null, 2));
  await prisma.$disconnect();
  await browser.close();
}
