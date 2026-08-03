import type { PostMetadata } from '@/types';

/**
 * Select the post used for the home page's featured slot.
 * Explicit pinning wins over the featured flag; array order remains the
 * stable tie-breaker for posts with the same priority.
 */
export const getHeroPost = <T extends Pick<PostMetadata, 'top' | 'featured'>>(posts: T[]): T | null => (
  posts.find((post) => post.top !== undefined)
    ?? posts.find((post) => post.featured)
    ?? null
);
