import { Post } from '../types';
import { postsConfig } from '../site.config';

const fetchMarkdown = async (path: string): Promise<string> => {
  try {
    const response = await fetch(path);
    if (!response.ok) {
      throw new Error(`Failed to load markdown: ${response.statusText}`);
    }
    return await response.text();
  } catch (error) {
    console.error(error);
    return '# Error Loading Content\n\nCould not fetch the article content.';
  }
};

export const getPosts = async (): Promise<Post[]> => {
  return new Promise((resolve) => {
    const posts: Post[] = postsConfig.map(config => ({
      ...config,
      content: ''
    }));
    setTimeout(() => resolve(posts), 800); 
  });
};

export const getPostById = async (id: string): Promise<Post | undefined> => {
  const config = postsConfig.find(p => p.id === id);
  
  if (!config) {
    return undefined;
  }

  const content = await fetchMarkdown(config.filePath);

  return {
    ...config,
    content
  };
};

export const searchPosts = async (query: string): Promise<Post[]> => {
  if (!query) return [];
  const lowerQuery = query.toLowerCase();
  
  return new Promise((resolve) => {
    setTimeout(() => {
        resolve(postsConfig.filter(post => 
            post.title.toLowerCase().includes(lowerQuery) || 
            post.tags.some(tag => tag.toLowerCase().includes(lowerQuery)) ||
            post.category.toLowerCase().includes(lowerQuery) ||
            post.excerpt.toLowerCase().includes(lowerQuery)
        ).map(p => ({ ...p, content: '' })));
    }, 300);
  });
};

export const getAllCategories = async (): Promise<string[]> => {
  return new Promise((resolve) => {
    setTimeout(() => {
      const categories = new Set(postsConfig.map(post => post.category));
      resolve(Array.from(categories));
    }, 100);
  });
}