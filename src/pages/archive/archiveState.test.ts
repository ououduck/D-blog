import { describe, it, expect } from 'vitest';
import {
  buildArchiveGroups,
  getAllExpansion,
  getInitialExpansion,
  getMonthKey,
  isAllVisibleExpanded,
  ensureYearExpanded,
} from './archiveState';
import type { PostMetadata } from '../../types';

const makePost = (id: string, date: string, category = '技术'): PostMetadata => ({
  id,
  title: id,
  excerpt: '摘要',
  date,
  tags: [],
  category,
  filePath: `/posts/${id}.md`,
  readTime: '5分钟阅读',
});

describe('getMonthKey', () => {
  it('拼接年月键', () => {
    expect(getMonthKey('2026', 8)).toBe('2026-8');
  });
});

describe('buildArchiveGroups', () => {
  it('空列表返回空数组', () => {
    expect(buildArchiveGroups([])).toEqual([]);
  });

  it('按年份分组并按年份倒序', () => {
    const groups = buildArchiveGroups([
      makePost('a', '2026-03-01'),
      makePost('b', '2025-01-01'),
      makePost('c', '2026-01-01'),
    ]);
    // zh-CN 下 formatDate 的年份为「2026年」（带"年"后缀），分组键与此一致
    expect(groups.map((group) => group.year)).toEqual(['2026年', '2025年']);
    expect(groups[0].total).toBe(2);
    expect(groups[1].total).toBe(1);
  });

  it('同一年份按月分组并按月份倒序', () => {
    const groups = buildArchiveGroups([
      makePost('a', '2026-03-01'),
      makePost('b', '2026-01-01'),
      makePost('c', '2026-03-15'),
    ]);
    expect(groups).toHaveLength(1);
    const months = groups[0].months;
    expect(months.map((month) => month.monthNum)).toEqual([3, 1]);
    expect(months[0].total).toBe(2);
    expect(months[0].posts.map((post) => post.id)).toEqual(['c', 'a']);
  });

  it('无效日期文章仍被分到对应年份（不抛错）', () => {
    const groups = buildArchiveGroups([makePost('a', 'garbage')]);
    expect(groups.length).toBeGreaterThanOrEqual(1);
  });

  it('多篇同月无效日期文章不产生 NaN 月分组，且月份回退为 1 月', () => {
    const groups = buildArchiveGroups([makePost('a', 'garbage'), makePost('b', 'garbage')]);
    expect(groups).toHaveLength(1);
    expect(groups[0].months).toHaveLength(1);
    expect(groups[0].months[0].monthNum).toBe(1);
    expect(groups[0].months[0].month).toBe('1月');
    expect(groups[0].months[0].total).toBe(2);
    expect(groups[0].months[0].posts.map((post) => post.id)).toEqual(['a', 'b']);
  });

  it('混合有效与无效日期：有效月份分组不受 NaN 影响', () => {
    const groups = buildArchiveGroups([
      makePost('a', '2026-03-01'),
      makePost('b', 'bad-date'),
      makePost('c', '2026-01-01'),
    ]);
    expect(groups.map((group) => group.year)).toEqual(['2026年', 'bad-date']);
    const validYear = groups.find((group) => group.year === '2026年');
    expect(validYear?.months.map((month) => month.monthNum)).toEqual([3, 1]);
  });

  it('未知年份分组排序稳定（排在有效年份之后）', () => {
    const groups = buildArchiveGroups([makePost('a', '2026-03-01'), makePost('b', 'garbage')]);
    expect(groups.map((group) => group.year)).toEqual(['2026年', 'garbage']);
  });

  it('年份排序按真实年份倒序（不依赖插入顺序）', () => {
    const groups = buildArchiveGroups([
      makePost('a', '2024-05-01'),
      makePost('b', '2026-03-01'),
      makePost('c', '2025-01-01'),
    ]);
    expect(groups.map((group) => group.year)).toEqual(['2026年', '2025年', '2024年']);
  });
});

describe('getAllExpansion / getInitialExpansion / isAllVisibleExpanded / ensureYearExpanded', () => {
  const groups = buildArchiveGroups([makePost('a', '2026-03-01'), makePost('b', '2025-01-01')]);

  it('getAllExpansion 展开全部年份与月份', () => {
    const expansion = getAllExpansion(groups);
    expect([...expansion.years].sort()).toEqual(['2025年', '2026年']);
    expect([...expansion.months].sort()).toEqual(['2025年-1', '2026年-3']);
  });

  it('getInitialExpansion 默认展开最新年份的首月', () => {
    const expansion = getInitialExpansion(groups, null);
    expect([...expansion.years]).toEqual(['2026年']);
    expect([...expansion.months]).toEqual(['2026年-3']);
  });

  it('getInitialExpansion 指定年份时展开该年份', () => {
    const expansion = getInitialExpansion(groups, '2025年');
    expect([...expansion.years]).toEqual(['2025年']);
  });

  it('getInitialExpansion 空分组返回空展开', () => {
    expect(getInitialExpansion([], null)).toEqual({ years: new Set(), months: new Set() });
  });

  it('isAllVisibleExpanded 全展开为 true，缺一个为 false', () => {
    const all = getAllExpansion(groups);
    expect(isAllVisibleExpanded(groups, all.years, all.months)).toBe(true);
    expect(isAllVisibleExpanded(groups, new Set(all.years), new Set())).toBe(false);
    expect(isAllVisibleExpanded([], new Set(), new Set())).toBe(false);
  });

  it('ensureYearExpanded 幂等：已展开或年份不存在时不新增', () => {
    expect(ensureYearExpanded(groups, new Set(['2026年']), '2026年')).toEqual(new Set(['2026年']));
    expect(ensureYearExpanded(groups, new Set(), '1999年')).toEqual(new Set());
    expect(ensureYearExpanded(groups, new Set(), null)).toEqual(new Set());
    expect(ensureYearExpanded(groups, new Set(['2026年']), '2025年')).toEqual(new Set(['2026年', '2025年']));
  });
});
