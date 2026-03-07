import { Post, PostMetadata } from '../types';

// 使用缓存避免重复加载
let postsDataCache: PostMetadata[] | null = null;

// 动态导入 JSON 数据
const loadPostsData = async (): Promise<PostMetadata[]> => {
  if (postsDataCache) {
    return postsDataCache;
  }

  const data = await import('../../generated/posts.json');
  postsDataCache = data.default as PostMetadata[];
  return postsDataCache;
};

// 建立 Markdown 文件的导入映射
const postFiles = import.meta.glob('../../posts/*.md', { query: '?raw', import: 'default' });

export const getPosts = async (): Promise<PostMetadata[]> => {
  return loadPostsData();
};

export const getPostById = async (id: string): Promise<Post | undefined> => {
  const allPosts = await loadPostsData();
  const meta = allPosts.find(p => p.id === id);

  if (!meta) {
    return undefined;
  }

  // 构建 import.meta.glob 需要的相对路径
  const relativePath = `..${(meta as any).filePath}`;
  const loader = postFiles[relativePath];

  if (!loader) {
    console.error(`Markdown file not found: ${relativePath}`);
    return undefined;
  }

  try {
    const rawContent = await loader() as string;

    // 使用 \r?\n 兼容 Windows (CRLF) 和 Unix (LF) 换行符
    const content = rawContent.replace(/^---[\s\S]*?---\r?\n/, '');

    return {
      ...meta,
      content
    };
  } catch (error) {
    console.error(error);
    return undefined;
  }
};

export const searchPosts = async (query: string): Promise<PostMetadata[]> => {
  if (!query) return [];
  const lowerQuery = query.toLowerCase();
  const allPosts = await loadPostsData();

  return allPosts.filter(post =>
      post.title.toLowerCase().includes(lowerQuery) ||
      post.tags.some(tag => tag.toLowerCase().includes(lowerQuery)) ||
      post.category.toLowerCase().includes(lowerQuery) ||
      post.excerpt.toLowerCase().includes(lowerQuery)
  );
};

export const getAllCategories = async (): Promise<string[]> => {
  const allPosts = await loadPostsData();
  const categories = new Set(allPosts.map(post => post.category));
  return Array.from(categories);
}