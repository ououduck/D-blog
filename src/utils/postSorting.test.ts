import { describe, it, expect } from 'vitest';
import type { PostMetadata } from '../types';
import { sortPosts } from './postSorting';

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

describe('sortPosts', () => {
  it('置顶精选（featured-top）排最前，且按 featured-top 升序', () => {
    const posts = [
      makePost({ id: 'top-2', featured: true, 'featured-top': 2, date: '2026-03-01' }),
      makePost({ id: 'top-1', featured: true, 'featured-top': 1, date: '2026-01-01' }),
      makePost({ id: 'top-0', featured: true, 'featured-top': 0, date: '2026-02-01' }),
    ];
    expect(sortPosts(posts, 'newest').map((post) => post.id)).toEqual(['top-0', 'top-1', 'top-2']);
  });

  it('featured-top 为 0 时仍按置顶处理', () => {
    const posts = [
      makePost({ id: 'plain', date: '2026-05-01' }),
      makePost({ id: 'top', featured: true, 'featured-top': 0, date: '2026-01-01' }),
    ];
    expect(sortPosts(posts, 'newest')[0].id).toBe('top');
  });

  it('普通精选（featured）排在置顶之后、非精选之前', () => {
    const posts = [
      makePost({ id: 'normal', date: '2026-05-01' }),
      makePost({ id: 'pinned', featured: true, 'featured-top': 1, date: '2026-01-01' }),
      makePost({ id: 'featured', featured: true, date: '2026-03-01' }),
    ];
    expect(sortPosts(posts, 'newest').map((post) => post.id)).toEqual(['pinned', 'featured', 'normal']);
  });

  it('非精选按日期降序（newest）', () => {
    const posts = [
      makePost({ id: 'old', date: '2026-01-01' }),
      makePost({ id: 'new', date: '2026-06-01' }),
      makePost({ id: 'mid', date: '2026-03-01' }),
    ];
    expect(sortPosts(posts, 'newest').map((post) => post.id)).toEqual(['new', 'mid', 'old']);
  });

  it('非精选按日期升序（oldest）', () => {
    const posts = [
      makePost({ id: 'old', date: '2026-01-01' }),
      makePost({ id: 'new', date: '2026-06-01' }),
      makePost({ id: 'mid', date: '2026-03-01' }),
    ];
    expect(sortPosts(posts, 'oldest').map((post) => post.id)).toEqual(['old', 'mid', 'new']);
  });

  it('置顶与精选分组内仍按日期排序，不受 sortOrder 影响分组', () => {
    const posts = [
      makePost({ id: 'f-old', featured: true, date: '2026-01-01' }),
      makePost({ id: 'f-new', featured: true, date: '2026-06-01' }),
      makePost({ id: 'n-old', date: '2026-01-01' }),
    ];
    expect(sortPosts(posts, 'oldest').map((post) => post.id)).toEqual(['f-old', 'f-new', 'n-old']);
  });

  it('不修改原数组', () => {
    const posts = [makePost({ id: 'a', date: '2026-02-01' }), makePost({ id: 'b', date: '2026-01-01' })];
    const original = posts.map((post) => post.id);
    sortPosts(posts, 'newest');
    expect(posts.map((post) => post.id)).toEqual(original);
  });
});
