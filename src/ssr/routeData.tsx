import { createContext, useContext } from 'react';
import { Post, PostMetadata } from '../types';
import { getSeriesNavigation, getRelatedPosts, type SeriesNavigation } from '../utils/postRelations';

/**
 * 构建期 SSG 注入的路由数据（仅文章页）。
 * 客户端水合时 context 保持 SSR 时的值，SPA 导航到其他文章时取不到数据，
 * 由 Post 组件回落到原有的异步加载逻辑。
 */
export interface SsgRouteData {
  post: Post;
  adjacentPosts: { prev: PostMetadata | null; next: PostMetadata | null };
  seriesNavigation: SeriesNavigation | null;
  relatedPosts: PostMetadata[];
}

export const SsgRouteContext = createContext<SsgRouteData | undefined>(undefined);

export const useSsgRouteData = (): SsgRouteData | undefined => useContext(SsgRouteContext);

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
  try {
    const data = JSON.parse(element.textContent || '');
    element.remove();
    return data as SsgRouteData;
  } catch {
    return undefined;
  }
};

/**
 * 根据 posts（含 content 的完整文章列表）与当前 URL 构造路由数据。
 * posts 顺序必须与 generated/posts.json 一致（新 → 旧），与客户端 getPosts() 相同。
 */
export const buildSsgRouteData = (posts: Post[], url: string): SsgRouteData | undefined => {
  const match = url.split(/[?#]/, 1)[0].match(/^\/post\/([^/]+)$/);
  if (!match) return undefined;

  const id = decodeURIComponent(match[1]);
  const post = posts.find((candidate) => candidate.id === id);
  if (!post) return undefined;

  const currentIndex = posts.findIndex((candidate) => candidate.id === id);
  const previous = currentIndex > 0 ? posts[currentIndex - 1] : null;
  const next = currentIndex < posts.length - 1 ? posts[currentIndex + 1] : null;

  return {
    post,
    adjacentPosts: { prev: previous, next },
    seriesNavigation: getSeriesNavigation(posts, post),
    relatedPosts: getRelatedPosts(posts, post, {
      limit: 3,
      excludeIds: [previous?.id, next?.id].filter((value): value is string => Boolean(value))
    })
  };
};
