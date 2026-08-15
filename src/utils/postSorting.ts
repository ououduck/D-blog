/**
 * 文章列表排序纯函数：按发布时间升/降序，保持稳定。
 */

import type { PostMetadata } from '@/types';
import { getDateTimestamp } from '@/utils/date';
import { isPinnedFeaturedPost } from '@/utils/postSelection';

/** 按发布时间排序文章列表（newest 降序 / oldest 升序，稳定排序）。 */
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
