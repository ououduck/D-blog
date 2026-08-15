import { describe, it, expect } from 'vitest';
import { buildSsgRouteData } from './routeData';
import type { Post } from '@/types';

const makePost = (id: string, overrides: Partial<Post> = {}): Post => ({
  id,
  title: `${id} 标题`,
  excerpt: '摘要',
  date: '2026-01-01',
  category: '技术',
  filePath: `/posts/${id}.md`,
  readTime: '5分钟阅读',
  tags: [],
  content: `# ${id} 正文`,
  ...overrides,
});

describe('buildSsgRouteData', () => {
  const posts = [makePost('a'), makePost('b', { date: '2026-02-01', category: '分享' }), makePost('c')];

  it('非文章 URL 返回 undefined', () => {
    expect(buildSsgRouteData(posts, '/about')).toBeUndefined();
    expect(buildSsgRouteData(posts, '/')).toBeUndefined();
  });

  it('文章页返回当前文章完整内容与相邻文章元数据', () => {
    const data = buildSsgRouteData(posts, '/post/b');
    expect(data).toBeDefined();
    expect(data?.post.id).toBe('b');
    expect(data?.post.content).toContain('# b 正文');
    // 相邻文章剥离 content 与 searchText（减小内联 JSON）
    expect(data?.adjacentPosts.prev?.id).toBe('a');
    expect(data?.adjacentPosts.next?.id).toBe('c');
    expect('content' in (data?.adjacentPosts.prev ?? {})).toBe(false);
  });

  it('首尾文章相邻项为 null', () => {
    const first = buildSsgRouteData(posts, '/post/a');
    expect(first?.adjacentPosts.prev).toBeNull();
    expect(first?.adjacentPosts.next?.id).toBe('b');

    const last = buildSsgRouteData(posts, '/post/c');
    expect(last?.adjacentPosts.next).toBeNull();
  });

  it('不存在的文章返回 undefined', () => {
    expect(buildSsgRouteData(posts, '/post/not-exist')).toBeUndefined();
  });

  it('畸形百分号编码的 id 返回 undefined（不抛错）', () => {
    expect(buildSsgRouteData(posts, '/post/%E0%A4%A')).toBeUndefined();
  });

  it('带查询参数的文章 URL 正常解析', () => {
    const data = buildSsgRouteData(posts, '/post/a?from=home');
    expect(data?.post.id).toBe('a');
  });
});
