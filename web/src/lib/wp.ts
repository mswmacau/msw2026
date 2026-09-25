/**
 * WordPress REST API 客戶端
 * 內容（活動、文章、頁面）全部由 WordPress 後台維護，
 * Next.js 只負責呈現，前後端職責分離。
 */
const WP = process.env.WP_URL || process.env.NEXT_PUBLIC_WP_URL || '';

export type WpPost = {
  id: number;
  slug: string;
  title: { rendered: string };
  excerpt: { rendered: string };
  content: { rendered: string };
  date: string;
  link: string;
  _embedded?: any;
  acf?: Record<string, any>;
};

export type WpEvent = WpPost & {
  meta?: Record<string, any>;
};

async function wpFetch<T>(path: string, revalidate = 60): Promise<T | null> {
  if (!WP) return null;
  // 部署到 Vercel 時不會有本地 WordPress，直接略過，避免每次 request 都白等一次連線
  if (process.env.VERCEL && /localhost|127\.0\.0\.1/.test(WP)) return null;
  try {
    const res = await fetch(`${WP}/wp-json/wp/v2${path}`, {
      headers: { Accept: 'application/json' },
      next: { revalidate },
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    // WordPress 尚未啟動或尚未建立內容時，前端自動降級為內建內容
    return null;
  }
}

/** 取得所有活動（CPT: msw_event） */
export async function getEvents(): Promise<WpEvent[]> {
  const data = await wpFetch<WpEvent[]>(
    '/msw_event?per_page=50&_embed=1&orderby=date&order=desc'
  );
  return data ?? [];
}

export async function getEventBySlug(slug: string): Promise<WpEvent | null> {
  // slug 可能是中文，必須 encode 後再放進 query string
  const data = await wpFetch<WpEvent[]>(
    `/msw_event?slug=${encodeURIComponent(slug)}&_embed=1`
  );
  if (data?.[0]) return data[0];

  // 少數情況下 WordPress 回傳的 slug 編碼方式不同，退回整批比對
  const all = await wpFetch<WpEvent[]>('/msw_event?per_page=50&_embed=1');
  return all?.find((e) => e.slug === slug) ?? null;
}

/** 取得最新文章（公告 / 教學） */
export async function getPosts(perPage = 6): Promise<WpPost[]> {
  const data = await wpFetch<WpPost[]>(
    `/posts?per_page=${perPage}&_embed=1&orderby=date&order=desc`
  );
  return data ?? [];
}

/** 取得 WordPress 頁面（關於我們等） */
export async function getPageBySlug(slug: string): Promise<WpPost | null> {
  const data = await wpFetch<WpPost[]>(`/pages?slug=${slug}`);
  return data?.[0] ?? null;
}

/** 取得媒體庫圖片網址 */
export async function getMediaUrl(id: number): Promise<string | null> {
  const data = await wpFetch<{ source_url: string }>(`/media/${id}`, 3600);
  return data?.source_url ?? null;
}

export function stripHtml(html: string) {
  return html.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim();
}
