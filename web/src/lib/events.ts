import { getEvents, getEventBySlug, stripHtml, type WpEvent } from './wp';
import { RULES } from './points';
import { prisma } from './prisma';

export type Activity = {
  slug: string;
  title: string;
  subtitle: string;
  image: string;
  tag: string;
  schedule: string;
  location: string;
  points: string;
  description: string;
  highlights: string[];
};

/** 內建活動：資料庫還沒有資料時的預設內容（後台「匯入預設活動」也是用這份） */
export const FALLBACK_ACTIVITIES: Activity[] = [
  {
    slug: 'weekly-training',
    title: '定期訓練活動',
    subtitle: '逢星期一 20:00 – 21:00',
    image: '/images/street-workout.jpg',
    tag: '常態活動',
    schedule: '每週一 20:00 – 21:00',
    location: '澳門 · 黑沙環公園體育設施（每月地點公告為準）',
    points: `每次出席 ${RULES.TRAINING_POINTS} 分`,
    description:
      '以自重訓練為核心的團體課程：單槓引體上升、雙槓撐體、核心與下肢動作。新手從基礎動作模式開始，教練會依程度分組調整課表。不需自備器材，帶水壺與毛巾即可。',
    highlights: [
      '新手友善：每個動作都有退階版本',
      '教練現場調整動作，避免受傷',
      '現場簽到即累積積分',
      '下雨改至有蓋場地，公告於會員專區',
    ],
  },
  {
    slug: 'monthly-run',
    title: '月度累積跑',
    subtitle: `單月 ${RULES.MONTHLY_KM_GOAL} KM 達標`,
    image: '/images/running-track.jpg',
    tag: '月度挑戰',
    schedule: '全月不限時間、不限地點',
    location: '任何地方：海堤、跑道、跑步機',
    points: `每 1 KM 累積 ${RULES.POINTS_PER_KM} 分`,
    description:
      '用自己的節奏跑，上傳跑步 App 截圖與公里數，經管理員確認後計入累積。當月累積達到 ' +
      RULES.MONTHLY_KM_GOAL +
      ' 公里即完成任務，月底由後台統一發放專屬優惠券。',
    highlights: [
      '截圖需清楚顯示距離與日期',
      '可多次上傳，系統自動累加',
      '管理員人工確認，確保公平',
      `達標額外 ${300} 積分 + 優惠券`,
    ],
  },
  {
    slug: 'street-workout-basics',
    title: '街健基礎班',
    subtitle: '每月第一個星期六 15:00 – 16:30',
    image: '/images/training-outdoor.jpg',
    tag: '課程',
    schedule: '每月第一個星期六 15:00 – 16:30',
    location: '澳門 · 氹仔中央公園',
    points: '完成四堂課 50 分',
    description:
      '專為完全沒有街健經驗的人設計的四堂系列課：從握力、懸吊、撐體到第一個引體上升。小班制，每班上限 12 人。',
    highlights: ['小班制，最多 12 人', '四堂完整課表', '結訓可獲得專屬徽章', '可用積分折抵學費'],
  },
];

function fromWp(e: WpEvent, i: number): Activity {
  const img =
    e._embedded?.['wp:featuredmedia']?.[0]?.source_url ||
    FALLBACK_ACTIVITIES[i % FALLBACK_ACTIVITIES.length].image;
  // WordPress 後台填的活動資訊（mu-plugin 註冊的 msw_meta）
  const meta = (e as any).msw_meta || e.meta || {};
  return {
    slug: e.slug,
    title: stripHtml(e.title?.rendered || ''),
    subtitle: stripHtml(e.excerpt?.rendered || '').slice(0, 60),
    image: img,
    tag: 'WP 活動',
    // 沒填就留空，前台會自動隱藏該欄位，不再顯示「請見活動內頁」這種佔位文字
    schedule: String(meta.schedule || '').trim(),
    location: String(meta.location || '').trim(),
    points: String(meta.points || '').trim(),
    description: stripHtml(e.content?.rendered || ''),
    highlights: [],
  };
}

function fromDb(r: any): Activity {
  let highlights: string[] = [];
  try {
    const parsed = JSON.parse(r.highlights || '[]');
    if (Array.isArray(parsed)) highlights = parsed.map(String);
  } catch {
    highlights = [];
  }
  return {
    slug: r.slug,
    title: r.title,
    subtitle: r.subtitle || '',
    image: r.image || '/images/street-workout.jpg',
    tag: r.tag || '活動',
    schedule: r.schedule || '',
    location: r.location || '',
    points: r.points || '—',
    description: r.description || '',
    highlights,
  };
}

async function readDb(): Promise<Activity[]> {
  try {
    const rows = await prisma.activity.findMany({
      where: { published: true },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
    });
    return rows.map(fromDb);
  } catch {
    return [];
  }
}

/**
 * 前台活動來源優先序：
 * 1. 後台「活動管理」建立的活動（資料庫）
 * 2. WordPress msw_event 文章
 * 3. 內建預設活動
 */
export async function getActivities(): Promise<Activity[]> {
  const db = await readDb();
  if (db.length) {
    // WordPress 有額外活動時接在後面，兩邊都顯示
    const wp = await getEvents();
    const mapped = wp?.length ? wp.map(fromWp) : [];
    return [...db, ...mapped];
  }

  const wp = await getEvents();
  if (wp && wp.length) {
    const mapped = wp.map(fromWp);
    return [...FALLBACK_ACTIVITIES, ...mapped];
  }
  return FALLBACK_ACTIVITIES;
}

/**
 * 動態路由傳進來的 slug 有可能是 percent-encoded（非 ASCII 活動代稱會這樣），
 * 這裡產生所有可能的比對字串，盡量把活動找出來。
 */
function slugCandidates(raw: string): string[] {
  const list = [raw];
  try {
    const decoded = decodeURIComponent(raw);
    if (decoded !== raw) list.push(decoded);
  } catch {
    /* 不是合法編碼就略過 */
  }
  return Array.from(new Set(list.filter(Boolean)));
}

export async function getActivityBySlug(slug: string): Promise<Activity | undefined> {
  for (const s of slugCandidates(slug)) {
    try {
      const row = await prisma.activity.findUnique({ where: { slug: s } });
      if (row) return fromDb(row);
    } catch {
      /* 資料庫查不到就繼續往下找 */
    }
    const hit = FALLBACK_ACTIVITIES.find((a) => a.slug === s);
    if (hit) return hit;

    // WordPress 來的活動（slug 常是中文，查詢時要 encode）
    const wp = await getEventBySlug(s);
    if (wp) return fromWp(wp, 0);
  }
  return undefined;
}
