/**
 * 文章关联计算：相邻（上一篇/下一篇）、系列导航与相关文章（同分类/同标签权重评分）。
 */

import type { PostMetadata } from '../types';
import { getDateTimestamp } from './date';

export interface SeriesNavigation<T extends PostMetadata = PostMetadata> {
  name: string;
  posts: T[];
  currentIndex: number;
  previous: T | null;
  next: T | null;
}

const comparePostsByDateAndId = (a: PostMetadata, b: PostMetadata) =>
  getDateTimestamp(b.date) - getDateTimestamp(a.date) || a.id.localeCompare(b.id);

const getSeriesPosts = <T extends PostMetadata>(posts: T[], post: PostMetadata): T[] => {
  if (!post.series || !post.seriesName) return [];

  return posts
    .filter((candidate) => candidate.series && candidate.seriesName === post.seriesName)
    .sort(
      (a, b) =>
        (a.seriesOrder ?? Number.MAX_SAFE_INTEGER) - (b.seriesOrder ?? Number.MAX_SAFE_INTEGER) ||
        comparePostsByDateAndId(a, b),
    );
};

/** 计算系列文章导航（同系列上一/下一篇与全系列列表）。 */
export const getSeriesNavigation = <T extends PostMetadata>(
  posts: T[],
  post: PostMetadata,
): SeriesNavigation<T> | null => {
  const seriesPosts = getSeriesPosts(posts, post);
  if (seriesPosts.length === 0) return null;

  const currentIndex = seriesPosts.findIndex((candidate) => candidate.id === post.id);
  if (currentIndex < 0) return null;

  return {
    name: post.seriesName as string,
    posts: seriesPosts,
    currentIndex,
    previous: seriesPosts[currentIndex - 1] ?? null,
    next: seriesPosts[currentIndex + 1] ?? null,
  };
};

interface RelatedPostsOptions {
  limit?: number;
  excludeIds?: Iterable<string>;
}
/** 按同分类/同标签权重计算相关文章（排除指定 id，限量返回）。 */

export const getRelatedPosts = <T extends PostMetadata>(
  posts: T[],
  post: PostMetadata,
  options: RelatedPostsOptions = {},
): T[] => {
  const excluded = new Set([post.id, ...(options.excludeIds ?? [])]);
  const postTags = new Set(post.tags.map((tag) => tag.trim()).filter(Boolean));
  const limit = options.limit ?? 3;

  return posts
    .filter((candidate) => !excluded.has(candidate.id))
    .map((candidate) => {
      const sharedTags = candidate.tags.filter((tag) => postTags.has(tag.trim())).length;
      const sameCategory = candidate.category === post.category ? 1 : 0;
      const sameSeries = post.series && candidate.series && post.seriesName === candidate.seriesName ? 1 : 0;
      return { post: candidate, score: sharedTags * 4 + sameCategory * 2 + sameSeries };
    })
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score || comparePostsByDateAndId(a.post, b.post))
    .slice(0, limit)
    .map(({ post: relatedPost }) => relatedPost);
};
