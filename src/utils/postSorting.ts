import type { PostMetadata } from '@/types';
import { getDateTimestamp } from '@/utils/date';
import { isPinnedFeaturedPost } from '@/utils/postSelection';

export const sortPosts = (posts: PostMetadata[], sortOrder: 'newest' | 'oldest') =>
  posts.slice().sort((a, b) => {
    const priorityA = isPinnedFeaturedPost(a) ? 0 : a.featured === true ? 1 : 2;
    const priorityB = isPinnedFeaturedPost(b) ? 0 : b.featured === true ? 1 : 2;

    if (priorityA !== priorityB) {
      return priorityA - priorityB;
    }

    if (priorityA === 0) {
      return a['featured-top']! - b['featured-top']!;
    }

    const dateA = getDateTimestamp(a.date);
    const dateB = getDateTimestamp(b.date);
    return sortOrder === 'newest' ? dateB - dateA : dateA - dateB;
  });
