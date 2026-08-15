import type { PostMetadata } from '@/types';

type FeaturedPostFields = Pick<PostMetadata, 'featured' | 'featured-top'>;

const isFeaturedPost = (post: Pick<PostMetadata, 'featured'>) => post.featured === true;

export const isPinnedFeaturedPost = (post: FeaturedPostFields) => (
  isFeaturedPost(post) && post['featured-top'] !== undefined
);

/**
 * Select the post used for the home page's featured slot.
 * Explicit featured pinning wins over the featured flag, with the smallest
 * featured-top value taking precedence.
 */
export const getHeroPost = <T extends FeaturedPostFields>(posts: T[]): T | null => {
  const pinnedPost = posts
    .filter(isPinnedFeaturedPost)
    .reduce<T | null>((current, post) => (
      current === null || post['featured-top']! < current['featured-top']!
        ? post
        : current
    ), null);

  return pinnedPost ?? posts.find(isFeaturedPost) ?? null;
};
