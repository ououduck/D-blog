import type { PostMetadata } from '../types';
import { getDateTimestamp } from './date';

export interface SeriesNavigation {
  name: string;
  posts: PostMetadata[];
  currentIndex: number;
  previous: PostMetadata | null;
  next: PostMetadata | null;
}

const comparePostsByDateAndId = (a: PostMetadata, b: PostMetadata) =>
  getDateTimestamp(b.date) - getDateTimestamp(a.date) || a.id.localeCompare(b.id);

const getSeriesPosts = (posts: PostMetadata[], post: PostMetadata) => {
  if (!post.series || !post.seriesName) return [];

  return posts
    .filter((candidate) => candidate.series && candidate.seriesName === post.seriesName)
    .sort((a, b) => (a.seriesOrder ?? Number.MAX_SAFE_INTEGER) - (b.seriesOrder ?? Number.MAX_SAFE_INTEGER) || comparePostsByDateAndId(a, b));
};

export const getSeriesNavigation = (posts: PostMetadata[], post: PostMetadata): SeriesNavigation | null => {
  const seriesPosts = getSeriesPosts(posts, post);
  if (seriesPosts.length === 0) return null;

  const currentIndex = seriesPosts.findIndex((candidate) => candidate.id === post.id);
  if (currentIndex < 0) return null;

  return {
    name: post.seriesName as string,
    posts: seriesPosts,
    currentIndex,
    previous: seriesPosts[currentIndex - 1] ?? null,
    next: seriesPosts[currentIndex + 1] ?? null
  };
};

interface RelatedPostsOptions {
  limit?: number;
  excludeIds?: Iterable<string>;
}

export const getRelatedPosts = <T extends PostMetadata>(
  posts: T[],
  post: PostMetadata,
  options: RelatedPostsOptions = {}
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
