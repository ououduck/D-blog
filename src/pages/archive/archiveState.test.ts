import { describe, expect, it } from 'vitest';
import type { PostMetadata } from '../../types';
import {
  buildArchiveGroups,
  ensureYearExpanded,
  getAllExpansion,
  getInitialExpansion,
  isAllVisibleExpanded
} from './archiveState';

const post = (id: string, date: string, category: string): PostMetadata => ({
  id,
  date,
  category,
  title: id,
  excerpt: '',
  tags: [],
  filePath: `${id}.md`,
  readTime: '1 min'
});

const groups = buildArchiveGroups([
  post('old', '2023-02-01', '随笔'),
  post('newer', '2024-12-10', '前端'),
  post('new', '2024-11-08', '前端')
]);

describe('archive state helpers', () => {
  it('builds descending year and month groups with category totals', () => {
    expect(groups.map((group) => group.year)).toEqual(['2024年', '2023年']);
    expect(groups[0].months.map((month) => month.monthNum)).toEqual([12, 11]);
    expect(groups[0].total).toBe(2);
    expect(groups[0].categories).toEqual(['前端']);
  });

  it('initializes the requested year or falls back to the latest year', () => {
    expect([...getInitialExpansion(groups, '2023年').years]).toEqual(['2023年']);
    expect([...getInitialExpansion(groups, '2023年').months]).toEqual(['2023年-2']);
    expect([...getInitialExpansion(groups, 'missing').years]).toEqual(['2024年']);
    expect(getInitialExpansion([], null)).toEqual({ years: new Set(), months: new Set() });
  });

  it('collects every visible year and month for expansion', () => {
    const expansion = getAllExpansion(groups);
    expect([...expansion.years]).toEqual(['2024年', '2023年']);
    expect([...expansion.months]).toEqual(['2024年-12', '2024年-11', '2023年-2']);
  });

  it('requires all currently visible years and months to be expanded', () => {
    expect(isAllVisibleExpanded(groups, new Set(['2024年', '2023年']), new Set(['2024年-12', '2024年-11', '2023年-2']))).toBe(true);
    expect(isAllVisibleExpanded(groups, new Set(['2024年', '2023年', '2022年']), new Set(['2024年-12', '2024年-11', '2023年-2']))).toBe(true);
    expect(isAllVisibleExpanded(groups, new Set(['2024年', '2023年']), new Set(['2024年-12', '2023年-2']))).toBe(false);
    expect(isAllVisibleExpanded([], new Set(), new Set())).toBe(false);
  });

  it('ensures only a valid URL year is expanded without removing user state', () => {
    expect([...ensureYearExpanded(groups, new Set(['2024年']), '2023年')]).toEqual(['2024年', '2023年']);
    expect([...ensureYearExpanded(groups, new Set(['2024年']), 'missing')]).toEqual(['2024年']);
    expect([...ensureYearExpanded(groups, new Set(['2024年']), null)]).toEqual(['2024年']);
  });
});
