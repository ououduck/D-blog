import { useCallback, useEffect, useState } from 'react';
import {
  getReadingHistory,
  saveReadingHistory,
  subscribeReadingHistory,
  type ReadingHistoryEntry
} from '@/services/readingHistory';

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
    refresh
  };
};
