import { describe, it, expect, beforeEach, vi } from 'vitest';
import { buildSsgRouteData } from './routeData';
import type { Post } from '@/types';

// readSsgRouteData 是模块级单例（首次读取后缓存），测试间需重置模块状态
// 与 DOM，保证各用例从干净状态开始。
const ROUTE_DATA_ID = 'ssg-route-data';

const resetRouteDataModule = async () => {
  vi.resetModules();
  document.getElementById(ROUTE_DATA_ID)?.remove();
};

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

describe('readSsgRouteData', () => {
  beforeEach(async () => {
    await resetRouteDataModule();
  });

  it('存在注入标签时解析并移除标签', async () => {
    const element = document.createElement('script');
    element.id = ROUTE_DATA_ID;
    element.type = 'application/json';
    element.textContent = JSON.stringify({ post: { id: 'a' } });
    document.body.appendChild(element);

    const { readSsgRouteData: read } = await import('./routeData');
    const data = read();
    expect(data).toEqual({ post: { id: 'a' } });
    // 标签被移除：不残留 <script> 在 DOM 中。
    expect(document.getElementById(ROUTE_DATA_ID)).toBeNull();
  });

  it('单例缓存：第二次调用不重新读 DOM（标签移除后仍返回首次结果）', async () => {
    const element = document.createElement('script');
    element.id = ROUTE_DATA_ID;
    element.type = 'application/json';
    element.textContent = JSON.stringify({ post: { id: 'a' } });
    document.body.appendChild(element);

    const { readSsgRouteData: read } = await import('./routeData');
    const first = read();
    // 模拟 React 并发/StrictMode 重渲染：再次调用（此时标签已移除）。
    const second = read();
    expect(first).toEqual({ post: { id: 'a' } });
    expect(second).toEqual(first);
  });

  it('损坏的 JSON 返回 undefined 且不抛错，标签被移除', async () => {
    const element = document.createElement('script');
    element.id = ROUTE_DATA_ID;
    element.type = 'application/json';
    element.textContent = '{not valid json';
    document.body.appendChild(element);

    const { readSsgRouteData: read } = await import('./routeData');
    expect(read()).toBeUndefined();
    expect(document.getElementById(ROUTE_DATA_ID)).toBeNull();
  });

  it('无注入标签返回 undefined', async () => {
    const { readSsgRouteData: read } = await import('./routeData');
    expect(read()).toBeUndefined();
  });
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
