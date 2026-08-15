import { describe, it, expect } from 'vitest';
import type { PostMetadata } from '../types';
import { getHeroPost, isPinnedFeaturedPost } from './postSelection';

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

describe('isPinnedFeaturedPost', () => {
  it('featured 且存在 featured-top 为 true', () => {
    expect(isPinnedFeaturedPost({ featured: true, 'featured-top': 0 })).toBe(true);
  });

  it('featured 但无 featured-top 为 false', () => {
    expect(isPinnedFeaturedPost({ featured: true })).toBe(false);
  });

  it('非 featured 即使有 featured-top 也为 false', () => {
    expect(isPinnedFeaturedPost({ featured: false, 'featured-top': 1 })).toBe(false);
    expect(isPinnedFeaturedPost({ 'featured-top': 1 })).toBe(false);
  });
});

describe('getHeroPost', () => {
  it('置顶精选优先于普通精选', () => {
    const posts = [
      makePost({ id: 'plain-featured', featured: true }),
      makePost({ id: 'pinned', featured: true, 'featured-top': 1 }),
    ];
    expect(getHeroPost(posts)?.id).toBe('pinned');
  });

  it('多个置顶时取 featured-top 最小者', () => {
    const posts = [
      makePost({ id: 'pinned-2', featured: true, 'featured-top': 2 }),
      makePost({ id: 'pinned-0', featured: true, 'featured-top': 0 }),
      makePost({ id: 'pinned-1', featured: true, 'featured-top': 1 }),
    ];
    expect(getHeroPost(posts)?.id).toBe('pinned-0');
  });

  it('无置顶时取第一篇普通精选', () => {
    const posts = [makePost({ id: 'first', featured: true }), makePost({ id: 'second', featured: true })];
    expect(getHeroPost(posts)?.id).toBe('first');
  });

  it('无任何精选返回 null', () => {
    expect(getHeroPost([makePost({ id: 'a' }), makePost({ id: 'b' })])).toBeNull();
    expect(getHeroPost([])).toBeNull();
  });

  it('featured-top 为 0 的置顶优先于 featured-top 更大的置顶', () => {
    const posts = [
      makePost({ id: 'top-3', featured: true, 'featured-top': 3 }),
      makePost({ id: 'top-0', featured: true, 'featured-top': 0 }),
    ];
    expect(getHeroPost(posts)?.id).toBe('top-0');
  });
});
