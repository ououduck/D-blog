import { describe, it, expect } from 'vitest';
import {
  applyTombstones,
  collectOfflineAssetUrls,
  toOfflineAssetUrl,
  validateOfflinePost,
  type OfflinePost,
} from './offlinePosts';

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

const makeOfflinePost = (overrides: Partial<OfflinePost> = {}): OfflinePost =>
  ({
    ...makeValidPost(),
    ...overrides,
  }) as OfflinePost;

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

describe('applyTombstones — 墓碑过滤', () => {
  it('无墓碑时全部保留', () => {
    const posts = [makeOfflinePost({ id: 'a' }), makeOfflinePost({ id: 'b' })];
    expect(applyTombstones(posts, {}).map((post) => post.id)).toEqual(['a', 'b']);
  });

  it('墓碑时间 ≥ 保存时间时剔除该文章', () => {
    const post = makeOfflinePost({ id: 'a', savedAt: 1000 });
    expect(applyTombstones([post], { a: 1000 })).toEqual([]);
    expect(applyTombstones([post], { a: 2000 })).toEqual([]);
  });

  it('删除后重新保存（savedAt > 墓碑时间）时文章恢复', () => {
    const post = makeOfflinePost({ id: 'a', savedAt: 3000 });
    expect(applyTombstones([post], { a: 2000 })).toEqual([post]);
  });

  it('墓碑不影响其他文章', () => {
    const posts = [makeOfflinePost({ id: 'a', savedAt: 1000 }), makeOfflinePost({ id: 'b', savedAt: 1000 })];
    expect(applyTombstones(posts, { a: 2000 }).map((post) => post.id)).toEqual(['b']);
  });
});

describe('toOfflineAssetUrl — 离线缓存 URL 判定', () => {
  it('站内绝对路径可缓存（应用 base path）', () => {
    expect(toOfflineAssetUrl('/images/a.png')).toBe('/images/a.png');
  });

  it('外部图床/协议 URL 不缓存', () => {
    expect(toOfflineAssetUrl('https://cdn.example.com/a.png')).toBeUndefined();
    expect(toOfflineAssetUrl('//cdn.example.com/a.png')).toBeUndefined();
    expect(toOfflineAssetUrl('data:image/png;base64,xxx')).toBeUndefined();
  });

  it('相对路径（非 / 开头）不缓存', () => {
    expect(toOfflineAssetUrl('images/a.png')).toBeUndefined();
  });

  it('剥离紧贴的尖括号包裹与查询/哈希后缀', () => {
    expect(toOfflineAssetUrl('</images/a.png>')).toBe('/images/a.png');
    expect(toOfflineAssetUrl('/images/a.png?v=2#frag')).toBe('/images/a.png');
  });

  it('空值返回 undefined', () => {
    expect(toOfflineAssetUrl('')).toBeUndefined();
    expect(toOfflineAssetUrl('   ')).toBeUndefined();
  });
});

describe('collectOfflineAssetUrls — 文章资源 URL 收集', () => {
  it('收集封面与 Markdown/HTML 图片并去重', () => {
    const post = makeOfflinePost({
      coverImage: '/covers/a.png',
      content: [
        '![图1](/images/1.png)',
        '<img src="/images/2.jpg" alt="图2">',
        '![外链](https://cdn.example.com/x.png)',
        '重复 ![图1](/images/1.png)',
      ].join('\n'),
    });
    const urls = collectOfflineAssetUrls(post);
    // 外链图床 URL 被过滤，站内图片去重。
    expect(urls).toEqual(['/covers/a.png', '/images/1.png', '/images/2.jpg']);
  });

  it('无内容时只收集封面', () => {
    const post = makeOfflinePost({ coverImage: '/covers/a.png' });
    expect(collectOfflineAssetUrls(post)).toEqual(['/covers/a.png']);
  });

  it('封面为外链时不收集', () => {
    const post = makeOfflinePost({ coverImage: 'https://cdn.example.com/a.png' });
    expect(collectOfflineAssetUrls(post)).toEqual([]);
  });
});
