import { prisma } from './prisma';
import { DEFAULT_SETTINGS } from './site-fields';

export * from './site-fields';

/** 取得網站設定（後台有改過的以資料庫為準） */
export async function getSettings(): Promise<Record<string, string>> {
  try {
    const rows = await prisma.siteSetting.findMany();
    const map: Record<string, string> = { ...DEFAULT_SETTINGS };
    for (const r of rows) map[r.key] = r.value;
    return map;
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function setting(
  s: Record<string, string>,
  key: string,
  fallback = ''
) {
  return s[key] ?? fallback;
}
