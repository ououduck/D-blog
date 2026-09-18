/**
 * 最近搜索记录（localStorage）：命令面板与搜索页共用同一存储与去重口径。
 * 存储不可用（隐私模式等）时静默降级为无记录。
 */

export const RECENT_SEARCHES_KEY = 'dblog:recent-searches';
export const RECENT_SEARCHES_LIMIT = 5;
export const RECENT_SEARCH_EVENT = 'dblog:command-palette:recent-searches-changed';

export const readRecentSearches = (): string[] => {
  try {
    const raw = localStorage.getItem(RECENT_SEARCHES_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed)
      ? parsed.filter((value): value is string => typeof value === 'string').slice(0, RECENT_SEARCHES_LIMIT)
      : [];
  } catch {
    return [];
  }
};

export const recordRecentSearch = (query: string) => {
  const trimmed = query.trim();
  if (!trimmed) return;
  try {
    const next = [trimmed, ...readRecentSearches().filter((entry) => entry !== trimmed)].slice(
      0,
      RECENT_SEARCHES_LIMIT,
    );
    localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(next));
    window.dispatchEvent(new CustomEvent(RECENT_SEARCH_EVENT));
  } catch {
    // 存储不可用时仅失去「最近搜索」能力，不阻断搜索。
  }
};
