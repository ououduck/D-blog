import { describe, it, expect } from 'vitest';
import type { PostMetadata } from '../types';
import { getRelatedPosts, getSeriesNavigation } from './postRelations';

const makePost = (overrides: Partial<PostMetadata> & { id: string }): PostMetadata => ({
  title: overrides.id,
  excerpt: '',
  date: '2026-01-01',
  tags: [],
  category: '未分类',
  filePath: `/posts/${overrides.id}.md`,
  readTime: '1分钟阅读',
  ...overrides,
});

const seriesPosts = [
  makePost({ id: 'p2', series: true, seriesName: '系列A', seriesOrder: 2, date: '2026-01-02' }),
  makePost({ id: 'p1', series: true, seriesName: '系列A', seriesOrder: 1, date: '2026-01-03' }),
  makePost({ id: 'p3', series: true, seriesName: '系列A', seriesOrder: 3, date: '2026-01-01' }),
];

describe('getSeriesNavigation', () => {
  it('按 seriesOrder 升序返回系列文章', () => {
    const nav = getSeriesNavigation(seriesPosts, seriesPosts[0]);
    expect(nav).not.toBeNull();
    expect(nav!.name).toBe('系列A');
    expect(nav!.posts.map((post) => post.id)).toEqual(['p1', 'p2', 'p3']);
  });

  it('中间文章正确给出上一篇与下一篇', () => {
    const nav = getSeriesNavigation(seriesPosts, seriesPosts[0]); // p2
    expect(nav!.currentIndex).toBe(1);
    expect(nav!.previous?.id).toBe('p1');
    expect(nav!.next?.id).toBe('p3');
  });

  it('首篇没有上一篇、末篇没有下一篇', () => {
    const first = getSeriesNavigation(seriesPosts, seriesPosts[1]); // p1
    expect(first!.previous).toBeNull();
    expect(first!.next?.id).toBe('p2');

    const last = getSeriesNavigation(seriesPosts, seriesPosts[2]); // p3
    expect(last!.previous?.id).toBe('p2');
    expect(last!.next).toBeNull();
  });

  it('无 series 元数据的文章返回 null', () => {
    const plain = makePost({ id: 'plain' });
    expect(getSeriesNavigation(seriesPosts, plain)).toBeNull();
  });

  it('有 series 标记但缺 seriesName 返回 null', () => {
    const weird = makePost({ id: 'weird', series: true });
    expect(getSeriesNavigation(seriesPosts, weird)).toBeNull();
  });

  it('文章不在系列列表内返回 null', () => {
    const otherSeries = makePost({ id: 'other', series: true, seriesName: '系列B', seriesOrder: 1 });
    expect(getSeriesNavigation(seriesPosts, otherSeries)).toBeNull();
  });

  it('缺 seriesOrder 的文章按日期降序（再按 id 升序）兜底', () => {
    const posts = [
      makePost({ id: 'no-order-2', series: true, seriesName: '兜底系列', date: '2026-01-01' }),
      makePost({ id: 'no-order-1', series: true, seriesName: '兜底系列', date: '2026-01-05' }),
      makePost({ id: 'ordered', series: true, seriesName: '兜底系列', seriesOrder: 1, date: '2026-01-10' }),
    ];
    const nav = getSeriesNavigation(posts, posts[0]);
    // seriesOrder=1 的排最前，其余按日期降序
    expect(nav!.posts.map((post) => post.id)).toEqual(['ordered', 'no-order-1', 'no-order-2']);
  });

  it('不同系列名的文章互不干扰', () => {
    const mixed = [...seriesPosts, makePost({ id: 'b1', series: true, seriesName: '系列B', seriesOrder: 1 })];
    const nav = getSeriesNavigation(mixed, mixed[3]); // b1
    expect(nav!.posts.map((post) => post.id)).toEqual(['b1']);
  });
});

describe('getRelatedPosts', () => {
  const base = makePost({
    id: 'current',
    tags: ['react', 'typescript'],
    category: '教程',
    series: true,
    seriesName: '系列A',
    seriesOrder: 1,
  });

  it('按共享标签数量加权排序（每个标签 4 分）', () => {
    const strong = makePost({ id: 'strong', tags: ['react', 'typescript'], category: '其他' });
    const weak = makePost({ id: 'weak', tags: ['react'], category: '其他' });
    const related = getRelatedPosts([weak, strong], base);
    expect(related.map((post) => post.id)).toEqual(['strong', 'weak']);
  });

  it('同分类加 2 分、同系列加 1 分', () => {
    const sameCategory = makePost({ id: 'same-cat', tags: ['react'], category: '教程' });
    const sameSeries = makePost({
      id: 'same-series',
      tags: ['react'],
      category: '其他',
      series: true,
      seriesName: '系列A',
      seriesOrder: 2,
    });
    const related = getRelatedPosts([sameSeries, sameCategory], base);
    // 同分类 4+2=6 > 同系列 4+1=5
    expect(related.map((post) => post.id)).toEqual(['same-cat', 'same-series']);
  });

  it('排除自身与 excludeIds 指定的文章', () => {
    const candidate = makePost({ id: 'candidate', tags: ['react'] });
    const related = getRelatedPosts([candidate], base, { excludeIds: ['candidate'] });
    expect(related).toEqual([]);
  });

  it('默认最多返回 3 篇', () => {
    const candidates = [1, 2, 3, 4].map((index) => makePost({ id: `cand-${index}`, tags: ['react', 'typescript'] }));
    const related = getRelatedPosts(candidates, base);
    expect(related.length).toBe(3);
  });

  it('limit 可配置', () => {
    const candidates = [1, 2, 3, 4].map((index) => makePost({ id: `cand-${index}`, tags: ['react', 'typescript'] }));
    const related = getRelatedPosts(candidates, base, { limit: 2 });
    expect(related.length).toBe(2);
  });

  it('零分（无共同点）的文章被剔除', () => {
    const unrelated = makePost({ id: 'unrelated', tags: ['其他'], category: '生活' });
    const related = getRelatedPosts([unrelated], base);
    expect(related).toEqual([]);
  });

  it('同分时按日期降序、再按 id 升序', () => {
    const older = makePost({ id: 'z-older', tags: ['react'], category: '其他', date: '2026-01-01' });
    const newer = makePost({ id: 'a-newer', tags: ['react'], category: '其他', date: '2026-06-01' });
    const sameDateA = makePost({ id: 'a-same', tags: ['react'], category: '其他', date: '2026-03-01' });
    const sameDateB = makePost({ id: 'b-same', tags: ['react'], category: '其他', date: '2026-03-01' });
    const related = getRelatedPosts([sameDateB, older, sameDateA, newer], base, { limit: 4 });
    expect(related.map((post) => post.id)).toEqual(['a-newer', 'a-same', 'b-same', 'z-older']);
  });

  it('标签比较忽略首尾空白', () => {
    const padded = makePost({ id: 'padded', tags: [' react '] });
    const related = getRelatedPosts([padded], base);
    expect(related.map((post) => post.id)).toEqual(['padded']);
  });

  it('空标签集合不匹配任何文章', () => {
    const noTags = makePost({ id: 'no-tags', tags: [] });
    expect(getRelatedPosts([noTags], base)).toEqual([]);
  });
});
