import { Post, PostMetadata } from '../types';

let postsDataCache: PostMetadata[] | null = null;

const postFiles = import.meta.glob('../../posts/*.md', { query: '?raw', import: 'default' });

const loadPostsData = async (): Promise<PostMetadata[]> => {
  if (postsDataCache) {
    return postsDataCache;
  }

  const data = await import('../../generated/posts.json');
  postsDataCache = data.default as PostMetadata[];
  return postsDataCache;
};

const stripFrontmatter = (rawContent: string) => {
  const normalized = rawContent.charCodeAt(0) === 0xfeff ? rawContent.slice(1) : rawContent;
  return normalized.replace(/^---[\s\S]*?---[\r\n]*/, '');
};

export const getPosts = async (): Promise<PostMetadata[]> => {
  return loadPostsData();
};

export const getPostById = async (id: string): Promise<Post | undefined> => {
  const allPosts = await loadPostsData();
  const meta = allPosts.find((post) => post.id === id);

  if (!meta) {
    return undefined;
  }

  const relativePath = `../..${meta.filePath}`;
  const loader = postFiles[relativePath];

  if (!loader) {
    console.error(`Markdown file not found: ${relativePath}`);
    return undefined;
  }

  try {
    const rawContent = (await loader()) as string;

    return {
      ...meta,
      content: stripFrontmatter(rawContent)
    };
  } catch (error) {
    console.error(error);
    return undefined;
  }
};

interface SearchResult extends PostMetadata {
  score: number;
  matchedFields: string[];
}

export const searchPosts = async (query: string): Promise<PostMetadata[]> => {
  if (!query) {
    return [];
  }

  const lowerQuery = query.toLowerCase().trim();
  const allPosts = await loadPostsData();
  const results: SearchResult[] = [];

  allPosts.forEach((post) => {
    let score = 0;
    const matchedFields: string[] = [];

    const titleMatch = post.title.toLowerCase().includes(lowerQuery);
    if (titleMatch) {
      score += 10;
      matchedFields.push('title');
    }

    const categoryMatch = post.category.toLowerCase().includes(lowerQuery);
    if (categoryMatch) {
      score += 5;
      matchedFields.push('category');
    }

    const tagMatches = post.tags.filter(tag => tag.toLowerCase().includes(lowerQuery));
    if (tagMatches.length > 0) {
      score += tagMatches.length * 3;
      matchedFields.push('tags');
    }

    const excerptMatch = post.excerpt.toLowerCase().includes(lowerQuery);
    if (excerptMatch) {
      score += 2;
      matchedFields.push('excerpt');
    }

    if (score > 0) {
      results.push({
        ...post,
        score,
        matchedFields
      });
    }
  });

  return results
    .sort((a, b) => b.score - a.score)
    .map(({ score, matchedFields, ...post }) => post);
};

export const getAllCategories = async (): Promise<string[]> => {
  const allPosts = await loadPostsData();
  const categories = new Set(allPosts.map((post) => post.category));
  return Array.from(categories);
};
