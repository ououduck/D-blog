/**
 * 阅读历史数据层：localStorage 持久化「继续阅读」记录（文章 id + 进度），
 * 含订阅通知与损坏容错，供首页继续阅读卡片与文章页进度恢复使用。
 */
import { isReadingComplete } from '@/utils/readingProgress';

const READING_HISTORY_STORAGE_KEY = 'd-blog-reading-history-v1';
const READING_HISTORY_EVENT = 'd-blog:reading-history-change';

export interface ReadingHistoryEntry {
  postId: string;
  progress: number;
  updatedAt: number;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
const clamp = (value: number) => Math.min(Math.max(value, 0), 1);

const normalizeEntry = (value: unknown): ReadingHistoryEntry | undefined => {
  if (!isRecord(value) || typeof value.postId !== 'string' || !value.postId.trim()) return undefined;
  if (typeof value.progress !== 'number' || !Number.isFinite(value.progress)) return undefined;
  if (typeof value.updatedAt !== 'number' || !Number.isFinite(value.updatedAt) || value.updatedAt < 0) return undefined;
  return {
    postId: value.postId,
    progress: clamp(value.progress),
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

export const getReadingHistory = () => readEntries().sort((a, b) => b.updatedAt - a.updatedAt);

export const getReadingHistoryEntry = (postId: string) => getReadingHistory().find((entry) => entry.postId === postId);

export const saveReadingHistory = (entry: Omit<ReadingHistoryEntry, 'updatedAt'> & { updatedAt?: number }) => {
  if (!entry.postId.trim()) return;
  const nextEntry: ReadingHistoryEntry = {
    postId: entry.postId,
    progress: clamp(entry.progress),
    updatedAt: entry.updatedAt ?? Date.now(),
  };
  if (isReadingComplete(nextEntry.progress)) {
    removeReadingHistory(entry.postId);
    return;
  }
  const entries = readEntries().filter((candidate) => candidate.postId !== entry.postId);
  writeEntries([nextEntry, ...entries].slice(0, 20));
};

export const removeReadingHistory = (postId: string) => {
  const entries = readEntries().filter((entry) => entry.postId !== postId);
  writeEntries(entries);
};

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
