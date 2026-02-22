import { Post, PostMetadata } from '../types';
// 导入脚本自动生成的 JSON 数据
// @ts-ignore (忽略 JSON 导入的类型检查警告)
import postsData from '../generated/posts.json';

// 建立 Markdown 文件的导入映射
const postFiles = import.meta.glob('../posts/*.md', { query: '?raw', import: 'default' });

export const getPosts = async (): Promise<PostMetadata[]> => {
  // 直接返回生成的元数据列表
  return Promise.resolve(postsData as PostMetadata[]);
};

export const getPostById = async (id: string): Promise<Post | undefined> => {
  const allPosts = postsData as PostMetadata[];
  const meta = allPosts.find(p => p.id === id);
  
  if (!meta) {
    return undefined;
  }

  // 构建 import.meta.glob 需要的相对路径
  // 脚本生成的 filePath 是 "/posts/xxx.md"
  // 我们需要转换成 "../posts/xxx.md"
  const relativePath = `..${(meta as any).filePath}`;
  const loader = postFiles[relativePath];

  if (!loader) {
    console.error(`Markdown file not found: ${relativePath}`);
    return undefined;
  }

  try {
    const rawContent = await loader() as string;
    
    // 【关键】移除 Markdown 顶部的 Frontmatter (--- ... ---)
    // 防止 ReactMarkdown 把配置信息渲染到页面上
    const content = rawContent.replace(/^---[\s\S]*?---\n/, '');
    
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
  const allPosts = postsData as PostMetadata[];

  return Promise.resolve(allPosts.filter(post => 
      post.title.toLowerCase().includes(lowerQuery) || 
      post.tags.some(tag => tag.toLowerCase().includes(lowerQuery)) ||
      post.category.toLowerCase().includes(lowerQuery) ||
      post.excerpt.toLowerCase().includes(lowerQuery)
  ));
};

export const getAllCategories = async (): Promise<string[]> => {
  const allPosts = postsData as PostMetadata[];
  const categories = new Set(allPosts.map(post => post.category));
  return Promise.resolve(Array.from(categories));
}