import { Post, PostMetadata } from '../types';

let postsDataCache: PostMetadata[] | null = null;
let postsSearchIndexCache: SearchIndexEntry[] | null = null;
const searchResultsCache = new Map<string, PostMetadata[]>();

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

const normalizeSearchText = (value: string) =>
  value
    .normalize('NFKC')
    .toLocaleLowerCase()
    .trim()
    .replace(/\s+/g, ' ');

const splitSearchTerms = (value: string) => normalizeSearchText(value).split(' ').filter(Boolean);

interface SearchIndexEntry {
  post: PostMetadata;
  dateTimestamp: number;
  title: string;
  excerpt: string;
  category: string;
  content: string;
  tags: string[];
}

const buildSearchIndex = (posts: PostMetadata[]): SearchIndexEntry[] =>
  posts.map((post) => ({
    post,
    dateTimestamp: new Date(post.date).getTime(),
    title: normalizeSearchText(post.title),
    excerpt: normalizeSearchText(post.excerpt),
    category: normalizeSearchText(post.category),
    content: normalizeSearchText(post.searchText ?? ''),
    tags: post.tags.map((tag) => normalizeSearchText(String(tag)))
  }));

const loadPostsSearchIndex = async (): Promise<SearchIndexEntry[]> => {
  if (postsSearchIndexCache) {
    return postsSearchIndexCache;
  }

  const posts = await loadPostsData();
  postsSearchIndexCache = buildSearchIndex(posts);
  return postsSearchIndexCache;
};

const getFieldMatchScore = (value: string, terms: string[], fullQuery: string, weight: number) => {
  if (!value) {
    return 0;
  }

  let score = 0;

  if (value === fullQuery) {
    score += weight * 12;
  } else if (value.startsWith(fullQuery)) {
    score += weight * 9;
  } else if (value.includes(fullQuery)) {
    score += weight * 6;
  }

  terms.forEach((term) => {
    if (value === term) {
      score += weight * 5;
      return;
    }

    if (value.startsWith(term)) {
      score += weight * 4;
      return;
    }

    if (value.includes(term)) {
      score += weight * 2;
    }
  });

  return score;
};

export const getPosts = async (): Promise<PostMetadata[]> => {
  return loadPostsData();
};

export const preloadPosts = async (): Promise<void> => {
  await loadPostsData();
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
  dateTimestamp: number;
}

export const searchPosts = async (query: string): Promise<PostMetadata[]> => {
  const normalizedQuery = normalizeSearchText(query);

  if (!normalizedQuery) {
    return [];
  }

  const cachedResult = searchResultsCache.get(normalizedQuery);
  if (cachedResult) {
    return cachedResult;
  }

  const allPosts = await loadPostsSearchIndex();
  const searchTerms = splitSearchTerms(normalizedQuery);
  const results: SearchResult[] = [];

  allPosts.forEach((entry) => {
    let score = 0;
    const matchedTerms = new Set<string>();
    const searchableFields = [
      { key: 'title', value: entry.title, weight: 8 },
      { key: 'category', value: entry.category, weight: 4 },
      { key: 'excerpt', value: entry.excerpt, weight: 2 },
      { key: 'content', value: entry.content, weight: 1 }
    ] as const;

    searchableFields.forEach(({ value, weight }) => {
      const fieldScore = getFieldMatchScore(value, searchTerms, normalizedQuery, weight);
      if (fieldScore > 0) {
        score += fieldScore;
      }

      searchTerms.forEach((term) => {
        if (value.includes(term)) {
          matchedTerms.add(term);
        }
      });
    });

    entry.tags.forEach((tag) => {
      const fieldScore = getFieldMatchScore(tag, searchTerms, normalizedQuery, 5);
      if (fieldScore > 0) {
        score += fieldScore;
      }

      searchTerms.forEach((term) => {
        if (tag.includes(term)) {
          matchedTerms.add(term);
        }
      });
    });

    const matchesFullQuery =
      searchableFields.some(({ value }) => value.includes(normalizedQuery)) ||
      entry.tags.some((tag) => tag.includes(normalizedQuery));

    if (score > 0 && (matchesFullQuery || matchedTerms.size === searchTerms.length)) {
      results.push({
        ...entry.post,
        score,
        dateTimestamp: entry.dateTimestamp
      });
    }
  });

  const resolvedResults = results
    .sort((a, b) => b.score - a.score || b.dateTimestamp - a.dateTimestamp)
    .map(({ score, dateTimestamp, ...post }) => post);

  searchResultsCache.set(normalizedQuery, resolvedResults);
  return resolvedResults;
};

export const preloadPostSearch = async (): Promise<void> => {
  await loadPostsSearchIndex();
};

export const getAllCategories = async (): Promise<string[]> => {
  const allPosts = await loadPostsData();
  const categories = new Set(allPosts.map((post) => post.category));
  return Array.from(categories);
};
