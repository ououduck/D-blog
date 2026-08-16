/**
 * 构建期 SSG 注入的路由数据（仅文章页）。
 * 客户端水合时 context 保持 SSR 时的值，SPA 导航到其他文章时取不到数据，
 * 由 Post 组件回落到原有的异步加载逻辑。
 *
 * 数据以 <script id="ssg-route-data" type="application/json"> 内联进每篇文章页的
 * HTML，因此体积直接贡献于 TTFB。相邻/相关文章在页面上只展示标题/封面/日期等
 * 元数据，无需完整正文——注入前剥离 content 与 searchText，可显著缩小每页 HTML。
 */
import { createContext, useContext } from 'react';
import { Post, PostMetadata } from '../types';
import { getSeriesNavigation, getRelatedPosts, type SeriesNavigation } from '../utils/postRelations';

export interface SsgRouteData {
  post: Post;
  adjacentPosts: { prev: PostMetadata | null; next: PostMetadata | null };
  seriesNavigation: SeriesNavigation | null;
  relatedPosts: PostMetadata[];
}

export const SsgRouteContext = createContext<SsgRouteData | undefined>(undefined);

export const useSsgRouteData = (): SsgRouteData | undefined => useContext(SsgRouteContext);

/**
 * 相邻/相关文章仅需渲染所需的元数据字段，剥离全文与搜索索引，
 * 减小注入每页 HTML 的 JSON 体积（文章正文可能达数十 KB）。
 */
const toMetadata = (post: Post): PostMetadata => {
  const { content: _content, searchText: _searchText, ...metadata } = post;
  return metadata;
};

/**
 * 客户端水合前读取 SSG 注入的路由数据（<script id="ssg-route-data">）。
 * 仅生产构建（SSG）存在该标签；开发模式返回 undefined。
 */
export const readSsgRouteData = (): SsgRouteData | undefined => {
  if (typeof document === 'undefined') {
    return undefined;
  }
  const element = document.getElementById('ssg-route-data');
  if (!element) {
    return undefined;
  }
  // 无论解析是否成功都移除内联标签，避免失败时残留 <script> 在 DOM 中。
  const raw = element.textContent || '';
  element.remove();
  try {
    return JSON.parse(raw) as SsgRouteData;
  } catch {
    return undefined;
  }
};

/**
 * 根据 posts（含 content 的完整文章列表）与当前 URL 构造路由数据。
 * posts 顺序必须与 generated/posts.json 一致（新 → 旧），与客户端 getPosts() 相同。
 * 当前文章保留完整 content（SSR 输出与水合内容一致），相邻/相关文章仅保留元数据。
 */
export const buildSsgRouteData = (posts: Post[], url: string): SsgRouteData | undefined => {
  const match = url.split(/[?#]/, 1)[0].match(/^\/post\/([^/]+)$/);
  if (!match) return undefined;

  let id: string;
  try {
    id = decodeURIComponent(match[1]);
  } catch {
    // 畸形百分号编码：按无此文章处理，避免整页 SSG 失败。
    return undefined;
  }
  const post = posts.find((candidate) => candidate.id === id);
  if (!post) return undefined;

  const currentIndex = posts.findIndex((candidate) => candidate.id === id);
  const previous = currentIndex > 0 ? posts[currentIndex - 1] : null;
  const next = currentIndex < posts.length - 1 ? posts[currentIndex + 1] : null;

  const seriesNavigation = getSeriesNavigation(posts, post);
  const strippedSeriesNavigation: SeriesNavigation | null = seriesNavigation
    ? {
        ...seriesNavigation,
        posts: seriesNavigation.posts.map(toMetadata),
        previous: seriesNavigation.previous ? toMetadata(seriesNavigation.previous) : null,
        next: seriesNavigation.next ? toMetadata(seriesNavigation.next) : null,
      }
    : null;

  return {
    post,
    adjacentPosts: {
      prev: previous ? toMetadata(previous) : null,
      next: next ? toMetadata(next) : null,
    },
    seriesNavigation: strippedSeriesNavigation,
    relatedPosts: getRelatedPosts(posts, post, {
      limit: 3,
      excludeIds: [previous?.id, next?.id].filter((value): value is string => Boolean(value)),
    }).map(toMetadata),
  };
};
