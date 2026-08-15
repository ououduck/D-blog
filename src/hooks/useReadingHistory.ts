import { useCallback, useEffect, useState } from 'react';
import {
  getReadingHistory,
  saveReadingHistory,
  subscribeReadingHistory,
  type ReadingHistoryEntry,
} from '@/services/readingHistory';

/**
 * 阅读历史 hook：订阅本地阅读历史变更，entries 按最近更新倒序，
 * latest 为最近一条（供"继续阅读"卡片使用）。
 */
export const useReadingHistory = () => {
  const [entries, setEntries] = useState<ReadingHistoryEntry[]>([]);

  const refresh = useCallback(() => setEntries(getReadingHistory()), []);

  useEffect(() => {
    refresh();
    return subscribeReadingHistory(refresh);
  }, [refresh]);

  return {
    entries,
    latest: entries[0],
    save: saveReadingHistory,
    refresh,
  };
};
