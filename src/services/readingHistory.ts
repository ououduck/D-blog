/**
 * 阅读历史数据层：localStorage 持久化「继续阅读」记录（文章 id + 进度），
 * 含订阅通知与损坏容错，供首页继续阅读卡片与文章页进度恢复使用。
 */
import { isReadingComplete } from '@/utils/readingProgress';
import { clamp } from '@/utils/clamp';

const READING_HISTORY_STORAGE_KEY = 'd-blog-reading-history-v1';
const READING_HISTORY_EVENT = 'd-blog:reading-history-change';

export interface ReadingHistoryEntry {
  postId: string;
  progress: number;
  updatedAt: number;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const normalizeEntry = (value: unknown): ReadingHistoryEntry | undefined => {
  if (!isRecord(value) || typeof value.postId !== 'string' || !value.postId.trim()) return undefined;
  if (typeof value.progress !== 'number' || !Number.isFinite(value.progress)) return undefined;
  if (typeof value.updatedAt !== 'number' || !Number.isFinite(value.updatedAt) || value.updatedAt < 0) return undefined;
  return {
    postId: value.postId,
    progress: clamp(value.progress, 0, 1),
    updatedAt: value.updatedAt,
  };
};

const readEntries = (): ReadingHistoryEntry[] => {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(READING_HISTORY_STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.map(normalizeEntry).filter((entry): entry is ReadingHistoryEntry => Boolean(entry));
  } catch {
    return [];
  }
};

const notify = () => {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(READING_HISTORY_EVENT));
  }
};

const writeEntries = (entries: ReadingHistoryEntry[]) => {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(READING_HISTORY_STORAGE_KEY, JSON.stringify(entries));
    notify();
  } catch {
    // 阅读历史为可选能力：隐私模式或配额限制不应影响阅读。
  }
};

/** 读取全部阅读历史（按最近更新倒序）。 */
export const getReadingHistory = () => readEntries().sort((a, b) => b.updatedAt - a.updatedAt);

export const getReadingHistoryEntry = (postId: string) => getReadingHistory().find((entry) => entry.postId === postId);
/** 保存阅读进度（合并/截断最近 20 条）。NaN 进度直接丢弃（clamp(NaN) 仍为
 * NaN，JSON.stringify 会序列化为 null，下次读取被 normalizeEntry 的
 * Number.isFinite 校验拒绝 → 整条记录被静默丢弃）。 */
export const saveReadingHistory = (entry: Omit<ReadingHistoryEntry, 'updatedAt'> & { updatedAt?: number }) => {
  if (typeof entry.postId !== 'string' || !entry.postId.trim()) return;
  if (typeof entry.progress !== 'number' || !Number.isFinite(entry.progress)) return;
  const nextEntry: ReadingHistoryEntry = {
    postId: entry.postId,
    progress: clamp(entry.progress, 0, 1),
    updatedAt: entry.updatedAt ?? Date.now(),
  };
  if (isReadingComplete(nextEntry.progress)) {
    removeReadingHistory(entry.postId);
    return;
  }
  const entries = readEntries().filter((candidate) => candidate.postId !== entry.postId);
  writeEntries([nextEntry, ...entries].slice(0, 20));
};

/** 删除单篇文章的阅读历史。 */
export const removeReadingHistory = (postId: string) => {
  const entries = readEntries().filter((entry) => entry.postId !== postId);
  writeEntries(entries);
};

/** 订阅阅读历史变更，返回取消订阅函数。 */
export const subscribeReadingHistory = (listener: () => void) => {
  if (typeof window === 'undefined') return () => undefined;
  const handleChange = () => listener();
  window.addEventListener(READING_HISTORY_EVENT, handleChange);
  window.addEventListener('storage', handleChange);
  return () => {
    window.removeEventListener(READING_HISTORY_EVENT, handleChange);
    window.removeEventListener('storage', handleChange);
  };
};
