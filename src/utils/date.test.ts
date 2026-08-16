import { describe, it, expect } from 'vitest';
import { formatDate, getDateTimestamp } from './date';

describe('getDateTimestamp', () => {
  it('合法日期返回本地时区的时间戳', () => {
    expect(getDateTimestamp('2026-08-12')).toBe(new Date(2026, 7, 12).getTime());
  });

  it('不同日期产生不同时间戳', () => {
    expect(getDateTimestamp('2026-08-12')).not.toBe(getDateTimestamp('2026-08-13'));
  });

  it('无效日期（日历日不存在）返回 0', () => {
    // 2026-02-30 会被 new Date 静默滚动为 3 月 2 日，实现中会识别为无效
    expect(getDateTimestamp('2026-02-30')).toBe(0);
  });

  it('无效日期（月份越界）返回 0', () => {
    expect(getDateTimestamp('2026-13-01')).toBe(0);
  });

  it('无效日期（格式错误）返回 0', () => {
    expect(getDateTimestamp('garbage')).toBe(0);
    expect(getDateTimestamp('')).toBe(0);
    expect(getDateTimestamp('2026/08/12')).toBe(0);
    // 尾部垃圾字符此前会被 split+parseInt 静默吞掉（'12abc' → 12），产出错误时间戳。
    expect(getDateTimestamp('2026-08-12abc')).toBe(0);
    expect(getDateTimestamp('2026-08-1 2')).toBe(0);
  });

  it('非补零月份同样被接受（split 后逐段解析）', () => {
    expect(getDateTimestamp('2026-8-12')).toBe(new Date(2026, 7, 12).getTime());
  });

  it('闰年 2 月 29 日有效', () => {
    expect(getDateTimestamp('2024-02-29')).toBe(new Date(2024, 1, 29).getTime());
  });

  it('非闰年 2 月 29 日无效', () => {
    expect(getDateTimestamp('2026-02-29')).toBe(0);
  });
});

describe('formatDate', () => {
  const zhOptions = { year: 'numeric' as const, month: 'long' as const, day: 'numeric' as const };

  it('按 locale 格式化合法日期', () => {
    const formatted = formatDate('2026-08-12', 'zh-CN', zhOptions);
    expect(formatted).toBe('2026年8月12日');
  });

  it('无效日期原样返回', () => {
    expect(formatDate('not-a-date', 'zh-CN', zhOptions)).toBe('not-a-date');
  });

  it('英文 locale 输出不同格式', () => {
    const formatted = formatDate('2026-08-12', 'en-US', { year: 'numeric', month: 'long', day: 'numeric' });
    expect(formatted).toContain('2026');
    expect(formatted).toContain('August');
  });
});
