import { prisma } from './prisma';

export const RULES = {
  MONTHLY_KM_GOAL: Number(process.env.NEXT_PUBLIC_MONTHLY_KM_GOAL || 300),
  POINTS_PER_KM: Number(process.env.NEXT_PUBLIC_POINTS_PER_KM || 1),
  TRAINING_POINTS: Number(process.env.NEXT_PUBLIC_TRAINING_POINTS || 10),
  MONTHLY_GOAL_BONUS: 300, // 完成 300km 月任務額外積分
};

/** 目前月份，格式 2026-09 */
export function currentMonth(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

/** 月份的第一天 / 最後一天（Asia/Macau 語意下用 UTC 边界即可，顯示時再格式化） */
export function monthRange(month: string) {
  const [y, m] = month.split('-').map(Number);
  const start = new Date(Date.UTC(y, m - 1, 1, 0, 0, 0));
  const end = new Date(Date.UTC(y, m, 0, 23, 59, 59));
  return { start, end };
}

/** 會員某月份的累積（只計 APPROVED） */
export async function getMonthKm(userId: string, month: string) {
  const agg = await prisma.runRecord.aggregate({
    where: { userId, periodMonth: month, status: 'APPROVED' },
    _sum: { km: true },
  });
  return Number(agg._sum.km ?? 0);
}

export async function getMonthSummary(userId: string, month = currentMonth()) {
  const km = await getMonthKm(userId, month);
  const [pending, approved, rejected] = await Promise.all([
    prisma.runRecord.count({ where: { userId, periodMonth: month, status: 'PENDING' } }),
    prisma.runRecord.count({ where: { userId, periodMonth: month, status: 'APPROVED' } }),
    prisma.runRecord.count({ where: { userId, periodMonth: month, status: 'REJECTED' } }),
  ]);
  const goal = RULES.MONTHLY_KM_GOAL;
  return {
    month,
    km,
    goal,
    remaining: Math.max(0, goal - km),
    percent: Math.min(100, Math.round((km / goal) * 100)),
    completed: km >= goal,
    pending,
    approved,
    rejected,
  };
}

/** 增加／扣減積分並寫入明細 */
export async function addPoints(opts: {
  userId: string;
  amount: number;
  reason: string;
  refType?: string;
  refId?: string;
}) {
  const { userId, amount, reason, refType, refId } = opts;
  return prisma.$transaction(async (tx) => {
    const user = await tx.user.update({
      where: { id: userId },
      data: {
        points: { increment: amount },
        totalPoints: { increment: amount > 0 ? amount : 0 },
      },
    });
    await tx.pointLog.create({
      data: { userId, amount, reason, refType, refId },
    });
    return user;
  });
}

/**
 * 管理員確認一筆跑步紀錄
 * 確認後：公里數計入累積、依照 1km = 1 分回饋積分，
 * 若該月累積達標（300km）則額外發放完成獎勵積分。
 */
export async function approveRunRecord(runId: string, reviewerId: string) {
  // 條件式更新：只有仍是 PENDING 才能被確認。
  // 若用「先查後改」，並發請求會同時通過檢查導致重複加分。
  const updated = await prisma.runRecord.updateMany({
    where: { id: runId, status: 'PENDING' },
    data: {
      status: 'APPROVED',
      reviewedAt: new Date(),
      reviewerId,
      rejectReason: null,
    },
  });
  if (updated.count === 0) {
    const exists = await prisma.runRecord.findUnique({ where: { id: runId } });
    throw new Error(exists ? '該筆紀錄已處理過' : '找不到該筆紀錄');
  }

  const run = await prisma.runRecord.findUniqueOrThrow({ where: { id: runId } });
  const km = Number(run.km);
  await addPoints({
    userId: run.userId,
    amount: Math.round(km * RULES.POINTS_PER_KM),
    reason: `跑步紀錄確認 ${km} km`,
    refType: 'RUN',
    refId: run.id,
  });

  // 檢查是否剛好跨過月度門檻（只發一次：以「確認後總數」判斷並用明細去重）
  const total = await getMonthKm(run.userId, run.periodMonth);
  if (total >= RULES.MONTHLY_KM_GOAL) {
    const already = await prisma.pointLog.findFirst({
      where: {
        userId: run.userId,
        refType: 'MONTHLY_GOAL',
        refId: run.periodMonth,
      },
    });
    if (!already) {
      await addPoints({
        userId: run.userId,
        amount: RULES.MONTHLY_GOAL_BONUS,
        reason: `完成 ${run.periodMonth} 月 ${RULES.MONTHLY_KM_GOAL}km 任務`,
        refType: 'MONTHLY_GOAL',
        refId: run.periodMonth,
      });
    }
  }

  return { km, monthTotal: total };
}

export async function rejectRunRecord(
  runId: string,
  reviewerId: string,
  reason: string
) {
  // 同樣用條件式更新避免並發重複處理
  const updated = await prisma.runRecord.updateMany({
    where: { id: runId, status: 'PENDING' },
    data: {
      status: 'REJECTED',
      reviewedAt: new Date(),
      reviewerId,
      rejectReason: reason,
    },
  });
  if (updated.count === 0) {
    const exists = await prisma.runRecord.findUnique({ where: { id: runId } });
    throw new Error(exists ? '該筆紀錄已處理過' : '找不到該筆紀錄');
  }
  return prisma.runRecord.findUniqueOrThrow({ where: { id: runId } });
}

/** 某月份達成名單（後台用來發放優惠券） */
export async function getMonthlyWinners(month: string) {
  const grouped = await prisma.runRecord.groupBy({
    by: ['userId'],
    where: { periodMonth: month, status: 'APPROVED' },
    _sum: { km: true },
  });
  const winners = grouped
    .map((g) => ({ userId: g.userId, km: Number(g._sum.km ?? 0) }))
    .filter((w) => w.km >= RULES.MONTHLY_KM_GOAL)
    .sort((a, b) => b.km - a.km);

  const users = await prisma.user.findMany({
    where: { id: { in: winners.map((w) => w.userId) } },
    select: { id: true, email: true, displayName: true, name: true },
  });
  const map = new Map(users.map((u) => [u.id, u]));

  const existing = await prisma.coupon.findMany({
    where: { periodMonth: month },
    select: { userId: true },
  });
  const issued = new Set(existing.map((c) => c.userId));

  return winners.map((w) => ({
    userId: w.userId,
    km: w.km,
    name: map.get(w.userId)?.displayName || map.get(w.userId)?.name || '—',
    email: map.get(w.userId)?.email || '',
    alreadyIssued: issued.has(w.userId),
  }));
}

function couponCode(month: string, userId: string) {
  const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `MSW-${month.replace('-', '')}-${userId.slice(-4).toUpperCase()}${rand}`;
}

/** 批次發放優惠券 */
export async function issueCoupons(
  month: string,
  userIds: string[],
  opts: { title?: string; discount?: string; description?: string } = {}
) {
  const expiresAt = new Date();
  expiresAt.setMonth(expiresAt.getMonth() + 3); // 三個月有效期

  const created = [];
  for (const userId of userIds) {
    const dup = await prisma.coupon.findFirst({
      where: { userId, periodMonth: month },
    });
    if (dup) continue;
    created.push(
      await prisma.coupon.create({
        data: {
          code: couponCode(month, userId),
          userId,
          title: opts.title || `${month} 月度 ${RULES.MONTHLY_KM_GOAL}km 達成優惠券`,
          description: opts.description || '憑此券於 MSW 街健館課程 / 周邊消費使用',
          discount: opts.discount || '全館 8 折',
          periodMonth: month,
          expiresAt,
        },
      })
    );
  }
  return created;
}

/** 定期訓練活動：下一個週一 20:00 */
export function nextMonday20(from = new Date()) {
  const d = new Date(from);
  const day = d.getDay(); // 0=日 1=一
  const diff = ((8 - day) % 7) || 7;
  d.setDate(d.getDate() + diff);
  d.setHours(20, 0, 0, 0);
  return d;
}

/**
 * 轉成 'YYYY-MM-DD'（**本地時區**）。
 * 注意：不可用 toISOString()，那會轉成 UTC 而讓 UTC+8 的凌晨退回前一天。
 */
export function ymdLocal(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
    d.getDate()
  ).padStart(2, '0')}`;
}

/**
 * 解析 'YYYY-MM-DD' 為**本地時區**的 Date。
 * new Date('2026-09-21') 會被當成 UTC 午夜，在 UTC+8 環境會變成當天 08:00，
 * 進而影響「取該週週一」的計算，因此必須手動用本地欄位組裝。
 */
export function parseLocalDate(s: string) {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d, 0, 0, 0, 0);
}

/** 取得某一天所屬「那一週的週一」日期（00:00），作為訓練場次的唯一識別 */export function getMondayOfWeek(d = new Date()) {
  const date = new Date(d);
  date.setHours(0, 0, 0, 0);
  const day = date.getDay(); // 0=週日
  const diff = day === 0 ? -6 : 1 - day;
  date.setDate(date.getDate() + diff);
  return date;
}

/** 今天是否是那一週的週一 */
export function isTrainingDay(d = new Date()) {
  return getMondayOfWeek(d).getTime() === new Date(
    d.getFullYear(), d.getMonth(), d.getDate()
  ).getTime();
}

/** 是否在可簽到時段內（週一 19:30 – 21:30） */
export function canCheckInNow(d = new Date()) {
  if (!isTrainingDay(d)) return false;
  const minutes = d.getHours() * 60 + d.getMinutes();
  return minutes >= 19 * 60 + 30 && minutes <= 21 * 60 + 30;
}
