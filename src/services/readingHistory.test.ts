import { describe, it, expect, beforeEach } from 'vitest';
import {
  getReadingHistory,
  getReadingHistoryEntry,
  saveReadingHistory,
  removeReadingHistory,
  subscribeReadingHistory,
} from './readingHistory';

const STORAGE_KEY = 'd-blog-reading-history-v1';

beforeEach(() => {
  window.localStorage.clear();
});

describe('readingHistory 服务', () => {
  it('初始为空列表', () => {
    expect(getReadingHistory()).toEqual([]);
  });

  it('保存后按更新时间倒序返回', () => {
    saveReadingHistory({ postId: 'a', progress: 0.2 });
    saveReadingHistory({ postId: 'b', progress: 0.5 });
    const entries = getReadingHistory();
    expect(entries.map((entry) => entry.postId)).toEqual(['b', 'a']);
  });

  it('progress 越界值被 clamp 到 0~1（低于完成阈值时保留）', () => {
    saveReadingHistory({ postId: 'a', progress: 0.98 });
    expect(getReadingHistoryEntry('a')?.progress).toBe(0.98);
    saveReadingHistory({ postId: 'b', progress: -0.5 });
    expect(getReadingHistoryEntry('b')?.progress).toBe(0);
  });

  it('读完后（≥99.5%）自动移除记录', () => {
    saveReadingHistory({ postId: 'a', progress: 0.3 });
    saveReadingHistory({ postId: 'a', progress: 1 });
    expect(getReadingHistoryEntry('a')).toBeUndefined();
  });

  it('重复保存同一文章只保留最新一条', () => {
    saveReadingHistory({ postId: 'a', progress: 0.2 });
    saveReadingHistory({ postId: 'a', progress: 0.6 });
    expect(getReadingHistory()).toHaveLength(1);
    expect(getReadingHistoryEntry('a')?.progress).toBe(0.6);
  });

  it('超过 20 条时截断最旧的记录', () => {
    for (let index = 0; index < 25; index += 1) {
      saveReadingHistory({ postId: `post-${index}`, progress: 0.1 });
    }
    const entries = getReadingHistory();
    expect(entries).toHaveLength(20);
    expect(entries[0].postId).toBe('post-24');
  });

  it('删除指定文章', () => {
    saveReadingHistory({ postId: 'a', progress: 0.3 });
    saveReadingHistory({ postId: 'b', progress: 0.4 });
    removeReadingHistory('a');
    expect(getReadingHistoryEntry('a')).toBeUndefined();
    expect(getReadingHistoryEntry('b')).toBeDefined();
  });

  it('损坏的 localStorage 数据被忽略并返回空列表', () => {
    window.localStorage.setItem(STORAGE_KEY, '{not valid json');
    expect(getReadingHistory()).toEqual([]);
  });

  it('非数组或非法条目被过滤', () => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify([{ postId: 'a', progress: 'bad', updatedAt: 1 }, 'junk']));
    expect(getReadingHistory()).toEqual([]);
  });

  it('订阅在写入后收到通知，取消订阅后不再通知', () => {
    let notified = 0;
    const unsubscribe = subscribeReadingHistory(() => {
      notified += 1;
    });
    saveReadingHistory({ postId: 'a', progress: 0.1 });
    expect(notified).toBe(1);
    unsubscribe();
    saveReadingHistory({ postId: 'b', progress: 0.1 });
    expect(notified).toBe(1);
  });
});
