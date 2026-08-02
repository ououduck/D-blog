import { Post, PostMetadata } from '../types';

let postsDataCache: PostMetadata[] | null = null;
let postsSearchIndexCache: SearchIndexEntry[] | null = null;
const SEARCH_CACHE_LIMIT = 80;
const searchResultsCache = new Map<string, PostSearchResult[]>();

const postFiles = import.meta.glob('../../posts/*.md', { query: '?raw', import: 'default' });

const loadPostsData = async (): Promise<PostMetadata[]> => {
  if (postsDataCache) {
    return postsDataCache;
  }

  const data = await import('../../generated/posts.json');
  postsDataCache = data.default as PostMetadata[];
  return postsDataCache;
};

const loadPostsSearchData = async (): Promise<Array<PostMetadata & { searchText?: string }>> => {
  const data = await import('../../generated/posts-search.json');
  return data.default as Array<PostMetadata & { searchText?: string }>;
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
  rawTitle: string;
  rawExcerpt: string;
  rawCategory: string;
  rawContent: string;
  rawTags: string[];
  title: string;
  excerpt: string;
  category: string;
  content: string;
  tags: string[];
}

const buildSearchIndex = (posts: Array<PostMetadata & { searchText?: string }>): SearchIndexEntry[] =>
  posts.map(({ searchText, ...post }) => ({
    post,
    dateTimestamp: new Date(post.date).getTime(),
    rawTitle: post.title,
    rawExcerpt: post.excerpt,
    rawCategory: post.category,
    rawContent: searchText ?? '',
    rawTags: post.tags.map((tag) => String(tag)),
    title: normalizeSearchText(post.title),
    excerpt: normalizeSearchText(post.excerpt),
    category: normalizeSearchText(post.category),
    content: normalizeSearchText(searchText ?? ''),
    tags: post.tags.map((tag) => normalizeSearchText(String(tag)))
  }));

const loadPostsSearchIndex = async (): Promise<SearchIndexEntry[]> => {
  if (postsSearchIndexCache) {
    return postsSearchIndexCache;
  }

  const posts = await loadPostsSearchData();
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

export type PostSearchScope = 'all' | 'category' | 'content' | 'title';
export type PostSearchField = 'title' | 'category' | 'excerpt' | 'content' | 'tags';

export interface PostSearchMatch {
  field: PostSearchField;
  label: string;
  snippet: string;
  terms: string[];
}

export type PostSearchResult = PostMetadata & {
  searchMatch?: PostSearchMatch;
};

interface SearchResult extends PostSearchResult {
  score: number;
  dateTimestamp: number;
}

const SEARCH_FIELD_LABELS: Record<PostSearchField, string> = {
  title: '标题',
  category: '分类',
  excerpt: '摘要',
  content: '正文',
  tags: '标签'
};

const setSearchCache = (key: string, value: PostSearchResult[]) => {
  if (searchResultsCache.has(key)) {
    searchResultsCache.delete(key);
  }

  searchResultsCache.set(key, value);

  if (searchResultsCache.size > SEARCH_CACHE_LIMIT) {
    const oldestKey = searchResultsCache.keys().next().value;
    if (oldestKey) {
      searchResultsCache.delete(oldestKey);
    }
  }
};

const createSearchSnippet = (rawValue: string, normalizedValue: string, terms: string[], field: PostSearchField): PostSearchMatch | undefined => {
  if (!rawValue) {
    return undefined;
  }

  const matchedTerms = terms.filter((term) => normalizedValue.includes(term));
  if (matchedTerms.length === 0) {
    return undefined;
  }

  const firstTerm = matchedTerms[0];
  const rawMatchIndex = rawValue.toLocaleLowerCase().indexOf(firstTerm);
  const matchIndex = rawMatchIndex >= 0 ? rawMatchIndex : normalizedValue.indexOf(firstTerm);
  const maxLength = field === 'content' ? 84 : 72;
  const start = Math.max(0, Math.min(rawValue.length, matchIndex) - 28);
  const end = Math.min(rawValue.length, start + maxLength);
  const prefix = start > 0 ? '…' : '';
  const suffix = end < rawValue.length ? '…' : '';

  return {
    field,
    label: SEARCH_FIELD_LABELS[field],
    snippet: `${prefix}${rawValue.slice(start, end).replace(/\s+/g, ' ').trim()}${suffix}`,
    terms: matchedTerms
  };
};

const getSearchableFields = (entry: SearchIndexEntry, scope: PostSearchScope) => {
  switch (scope) {
    case 'category':
      return [{ key: 'category', value: entry.category, weight: 6 }] as const;
    case 'content':
      return [
        { key: 'excerpt', value: entry.excerpt, weight: 2 },
        { key: 'content', value: entry.content, weight: 1 }
      ] as const;
    case 'title':
      return [{ key: 'title', value: entry.title, weight: 8 }] as const;
    case 'all':
    default:
      return [
        { key: 'title', value: entry.title, weight: 8 },
        { key: 'category', value: entry.category, weight: 4 },
        { key: 'excerpt', value: entry.excerpt, weight: 2 },
        { key: 'content', value: entry.content, weight: 1 }
      ] as const;
  }
};

const getBestSearchMatch = (
  entry: SearchIndexEntry,
  terms: string[],
  fields: ReadonlyArray<{ key: PostSearchField; value: string; weight: number }>,
  includeTags: boolean
): PostSearchMatch | undefined => {
  const rawValues: Record<PostSearchField, string> = {
    title: entry.rawTitle,
    category: entry.rawCategory,
    excerpt: entry.rawExcerpt,
    content: entry.rawContent,
    tags: entry.rawTags.join('、')
  };

  const candidates = includeTags
    ? [...fields, { key: 'tags' as const, value: entry.tags.join(' '), weight: 5 }]
    : fields;

  const sortedCandidates = candidates.slice().sort((a, b) => b.weight - a.weight);

  for (const field of sortedCandidates) {
    const match = createSearchSnippet(rawValues[field.key], field.value, terms, field.key);
    if (match) {
      return match;
    }
  }

  return undefined;
};

export const searchPosts = async (
  query: string,
  options: { scope?: PostSearchScope } = {}
): Promise<PostSearchResult[]> => {
  const normalizedQuery = normalizeSearchText(query);
  const scope = options.scope ?? 'all';

  if (!normalizedQuery) {
    return [];
  }

  const cacheKey = `${scope}::${normalizedQuery}`;
  const cachedResult = searchResultsCache.get(cacheKey);
  if (cachedResult) {
    searchResultsCache.delete(cacheKey);
    searchResultsCache.set(cacheKey, cachedResult);
    return cachedResult;
  }

  const allPosts = await loadPostsSearchIndex();
  const searchTerms = splitSearchTerms(normalizedQuery);
  const results: SearchResult[] = [];

  allPosts.forEach((entry) => {
    let score = 0;
    const matchedTerms = new Set<string>();
    const searchableFields = getSearchableFields(entry, scope);

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

    if (scope === 'all') {
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
    }

    const matchesFullQuery =
      searchableFields.some(({ value }) => value.includes(normalizedQuery)) ||
      (scope === 'all' && entry.tags.some((tag) => tag.includes(normalizedQuery)));

    if (score > 0 && (matchesFullQuery || matchedTerms.size === searchTerms.length)) {
      results.push({
        ...entry.post,
        searchMatch: getBestSearchMatch(entry, searchTerms, searchableFields, scope === 'all'),
        score,
        dateTimestamp: entry.dateTimestamp
      });
    }
  });

  const resolvedResults = results
    .sort((a, b) => b.score - a.score || b.dateTimestamp - a.dateTimestamp)
    .map(({ score, dateTimestamp, ...post }) => post);

  setSearchCache(cacheKey, resolvedResults);
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

