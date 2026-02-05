import { Post } from '../types';
import { postsConfig } from '../site.config';

const postFiles = import.meta.glob('../posts/*.md', { query: '?raw', import: 'default' });

const fetchMarkdown = async (path: string): Promise<string> => {
  const relativePath = `..${path}`;
  const loader = postFiles[relativePath];

  if (!loader) {
    console.error(`Markdown file not found: ${relativePath}`);
    return '# Error Loading Content\n\nFile not found.';
  }

  try {
    const content = await loader();
    return content as string;
  } catch (error) {
    console.error(error);
    return '# Error Loading Content\n\nCould not load the article content.';
  }
};

export const getPosts = async (): Promise<Post[]> => {

  return Promise.resolve(postsConfig.map(config => ({
      ...config,
      content: ''
  })));
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
  

  return Promise.resolve(postsConfig.filter(post => 
      post.title.toLowerCase().includes(lowerQuery) || 
      post.tags.some(tag => tag.toLowerCase().includes(lowerQuery)) ||
      post.category.toLowerCase().includes(lowerQuery) ||
      post.excerpt.toLowerCase().includes(lowerQuery)
  ).map(p => ({ ...p, content: '' })));
};

export const getAllCategories = async (): Promise<string[]> => {
  const categories = new Set(postsConfig.map(post => post.category));
  return Promise.resolve(Array.from(categories));
}
