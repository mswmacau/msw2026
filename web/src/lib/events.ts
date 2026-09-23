import { getEvents, stripHtml, type WpEvent } from './wp';
import { RULES } from './points';

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

/** WordPress 尚未建立內容時使用的內建活動（同時也是上線前的預設資料） */
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
  return {
    slug: e.slug,
    title: stripHtml(e.title?.rendered || ''),
    subtitle: stripHtml(e.excerpt?.rendered || '').slice(0, 60),
    image: img,
    tag: 'WP 活動',
    schedule: '請見活動內頁',
    location: '澳門',
    points: '—',
    description: stripHtml(e.content?.rendered || ''),
    highlights: [],
  };
}

/** WordPress 有內容就用 WordPress，否則用內建資料 */
export async function getActivities(): Promise<Activity[]> {
  const wp = await getEvents();
  if (wp && wp.length) {
    const mapped = wp.map(fromWp);
    // 內建兩大核心活動永遠保留在最前
    return [...FALLBACK_ACTIVITIES.slice(0, 2), ...mapped];
  }
  return FALLBACK_ACTIVITIES;
}

export function getActivityBySlug(slug: string): Activity | undefined {
  return FALLBACK_ACTIVITIES.find((a) => a.slug === slug);
}
