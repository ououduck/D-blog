import { describe, it, expect } from 'vitest';
import { validateOfflinePost, type OfflinePost } from './offlinePosts';

const makeValidPost = (): Record<string, unknown> => ({
  id: 'post-1',
  title: '测试文章',
  excerpt: '摘要',
  date: '2026-03-14',
  category: '技术',
  filePath: '/posts/test.md',
  readTime: '5分钟阅读',
  tags: ['React', 'TypeScript'],
  savedAt: 1700000000000,
  schema: 'd-blog-offline-post',
  version: 1,
});

describe('validateOfflinePost', () => {
  it('接受完整合法数据并克隆', () => {
    const result = validateOfflinePost(makeValidPost());
    expect(result).toBeDefined();
    expect(result?.id).toBe('post-1');
    expect(result?.tags).toEqual(['React', 'TypeScript']);
    // 克隆而非引用：修改原对象不影响结果。
    const original = makeValidPost();
    const cloned = validateOfflinePost(original);
    (original.tags as string[]).push('Hacked');
    expect(cloned?.tags).toEqual(['React', 'TypeScript']);
  });

  it('拒绝非对象/数组/空值', () => {
    expect(validateOfflinePost(null)).toBeUndefined();
    expect(validateOfflinePost('string')).toBeUndefined();
    expect(validateOfflinePost(123)).toBeUndefined();
    expect(validateOfflinePost([])).toBeUndefined();
  });

  it('拒绝缺失必填字段', () => {
    const base = makeValidPost();
    for (const key of ['id', 'title', 'excerpt', 'date', 'category', 'filePath', 'readTime']) {
      const invalid = { ...base, [key]: '' };
      expect(validateOfflinePost(invalid), `缺失 ${key}`).toBeUndefined();
    }
    const noTags = { ...base, tags: 'not-array' };
    expect(validateOfflinePost(noTags)).toBeUndefined();
    const badTag = { ...base, tags: ['ok', 42] };
    expect(validateOfflinePost(badTag)).toBeUndefined();
  });

  it('拒绝 schema/version 不匹配', () => {
    expect(validateOfflinePost({ ...makeValidPost(), schema: 'other' })).toBeUndefined();
    expect(validateOfflinePost({ ...makeValidPost(), version: 999 })).toBeUndefined();
  });

  it('拒绝非法的 savedAt 时间戳', () => {
    expect(validateOfflinePost({ ...makeValidPost(), savedAt: -1 })).toBeUndefined();
    expect(validateOfflinePost({ ...makeValidPost(), savedAt: 1.5 })).toBeUndefined();
    expect(validateOfflinePost({ ...makeValidPost(), savedAt: Number.NaN })).toBeUndefined();
  });

  it('拒绝非法的 featured-top（null/字符串）', () => {
    expect(validateOfflinePost({ ...makeValidPost(), 'featured-top': null })).toBeUndefined();
    expect(validateOfflinePost({ ...makeValidPost(), 'featured-top': '1' })).toBeUndefined();
    // 合法数值通过
    expect(validateOfflinePost({ ...makeValidPost(), 'featured-top': 1 })?.['featured-top']).toBe(1);
  });

  it('拒绝非法的 series 组合', () => {
    // seriesOrder 非法（非整数）→ 整体拒绝
    expect(
      validateOfflinePost({ ...makeValidPost(), series: true, seriesName: '系列', seriesOrder: 1.5 }),
    ).toBeUndefined();
    // seriesName 类型非法 → 整体拒绝
    expect(validateOfflinePost({ ...makeValidPost(), series: true, seriesName: 123, seriesOrder: 1 })).toBeUndefined();
    // 完整合法 → 透传 series 字段
    const valid = validateOfflinePost({
      ...makeValidPost(),
      series: true,
      seriesName: '系列',
      seriesOrder: 2,
    });
    expect(valid?.series).toBe(true);
    expect(valid?.seriesName).toBe('系列');
    expect(valid?.seriesOrder).toBe(2);
  });

  it('series: true 缺配套字段时优雅降级（保留文章、丢弃系列信息）', () => {
    const result = validateOfflinePost({ ...makeValidPost(), series: true });
    expect(result).toBeDefined();
    expect(result?.series).toBeUndefined();
  });

  it('可选字段透传（updatedAt/coverImage/content/searchText）', () => {
    const result = validateOfflinePost({
      ...makeValidPost(),
      updatedAt: '2026-03-20',
      coverImage: 'https://cdn.example.com/x.png',
      content: '# 正文',
      searchText: '搜索文本',
    });
    expect(result?.updatedAt).toBe('2026-03-20');
    expect(result?.coverImage).toBe('https://cdn.example.com/x.png');
    expect(result?.content).toBe('# 正文');
    expect(result?.searchText).toBe('搜索文本');
  });

  it('authors 校验：非法条目整体拒绝', () => {
    expect(validateOfflinePost({ ...makeValidPost(), authors: 'bad' })).toBeUndefined();
    expect(validateOfflinePost({ ...makeValidPost(), authors: [{ name: 123 }] })).toBeUndefined();
    const valid = validateOfflinePost({ ...makeValidPost(), authors: [{ name: '作者', avatar: '/a.png' }] });
    expect(valid?.authors).toEqual([{ name: '作者', avatar: '/a.png' }]);
  });
});
