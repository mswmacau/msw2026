import { prisma } from './prisma';
import { DEFAULT_SETTINGS } from './site-fields';

export * from './site-fields';

// 同一個 serverless 實例內短暫快取（20 秒）：
// 每個頁面都會讀設定，快取可省下大量跨區資料庫來回（Vercel ↔ Neon）
let settingsCache: { at: number; data: Record<string, string> } | null = null;
const SETTINGS_TTL = 20_000;

/** 取得網站設定（後台有改過的以資料庫為準） */
export async function getSettings(): Promise<Record<string, string>> {
  if (settingsCache && Date.now() - settingsCache.at < SETTINGS_TTL) {
    return settingsCache.data;
  }
  try {
    const rows = await prisma.siteSetting.findMany();
    const map: Record<string, string> = { ...DEFAULT_SETTINGS };
    for (const r of rows) map[r.key] = r.value;
    settingsCache = { at: Date.now(), data: map };
    return map;
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

/** 後台儲存設定後呼叫：讓前台不必等快取過期就能看到新設定 */
export function clearSettingsCache() {
  settingsCache = null;
}

export function setting(
  s: Record<string, string>,
  key: string,
  fallback = ''
) {
  return s[key] ?? fallback;
}
