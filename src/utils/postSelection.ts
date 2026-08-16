/**
 * 文章选取工具：首页精选槽位（hero）选取——置顶精选（featured-top）
 * 优先于普通 featured 标记。
 */
import type { PostMetadata } from '@/types';

type FeaturedPostFields = Pick<PostMetadata, 'featured' | 'featured-top'>;

const isFeaturedPost = (post: Pick<PostMetadata, 'featured'>) => post.featured === true;

/** 判断是否为置顶精选文章（featured 且带数值型 featured-top 权重）。 */
export const isPinnedFeaturedPost = (post: FeaturedPostFields) =>
  isFeaturedPost(post) && typeof post['featured-top'] === 'number';

/**
 * 选取首页精选槽位的文章：显式置顶（featured-top）优先于普通 featured 标记，
 * 多个置顶时取 featured-top 最小者。
 */
export const getHeroPost = <T extends FeaturedPostFields>(posts: T[]): T | null => {
  const pinnedPost = posts
    .filter(isPinnedFeaturedPost)
    .reduce<T | null>(
      (current, post) => (current === null || post['featured-top']! < current['featured-top']! ? post : current),
      null,
    );

  return pinnedPost ?? posts.find(isFeaturedPost) ?? null;
};
