/**
 * 文章数据层：构建期数据（generated/posts.json）经 eager glob 内联同步可读，
 * 正文 Markdown 按需动态 import（import.meta.glob + ?raw），搜索索引
 * （generated/posts-search.json）首次使用时懒加载并缓存。
 * 提供全文搜索的多维权重评分（searchPosts）与结果 LRU 缓存。
 */
import type { Post, PostMetadata } from '../types';
import { getDateTimestamp } from '@/utils/date';
import { stripFrontmatter } from '@/utils/markdown-core.mjs';

const generatedPostModules = import.meta.glob<PostMetadata[]>('../../generated/posts.json', {
  eager: true,
  import: 'default',
});
const initialPosts = Object.values(generatedPostModules)[0] ?? [];
let postsSearchIndexCache: SearchIndexEntry[] | null = null;
// 并发合并：缓存为 null 时多个并发的 searchPosts 共享同一次动态 import +
// 索引构建，避免各跑一遍全量 buildSearchIndex。
let postsSearchIndexPromise: Promise<SearchIndexEntry[]> | null = null;
const SEARCH_CACHE_LIMIT = 80;
const searchResultsCache = new Map<string, PostSearchResult[]>();

const postFiles = import.meta.glob('../../posts/*.md', { query: '?raw', import: 'default' });

const loadPostsSearchData = async (): Promise<Array<PostMetadata & { searchText?: string }>> => {
  const data = await import('../../generated/posts-search.json');
  return data.default as Array<PostMetadata & { searchText?: string }>;
};

// toLowerCase（非 toLocaleLowerCase）：locale 无关的大小写归一化。土耳其语等
// locale 下 'I'.toLocaleLowerCase() 会变成点无点 'ı'，导致含 I 的查询（如
// "String"/"JSON" 代码片段）与内容失配。
// 导出供测试复刻同一匹配口径（posts.test.ts 的「标题不含查询词」前提判定）。
export const normalizeSearchText = (value: string) => value.normalize('NFKC').toLowerCase().trim().replace(/\s+/g, ' ');

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
    // 与全站日期口径统一：new Date('YYYY-MM-DD') 按 UTC 午夜解析，在东时区
    // 与 getDateTimestamp 的本地时区口径相差 8 小时（见 utils/date.ts 的注释）。
    dateTimestamp: getDateTimestamp(post.date),
    rawTitle: post.title,
    rawExcerpt: post.excerpt,
    rawCategory: post.category,
    rawContent: searchText ?? '',
    rawTags: post.tags.map((tag) => String(tag)),
    title: normalizeSearchText(post.title),
    excerpt: normalizeSearchText(post.excerpt),
    category: normalizeSearchText(post.category),
    content: normalizeSearchText(searchText ?? ''),
    tags: post.tags.map((tag) => normalizeSearchText(String(tag))),
  }));

const loadPostsSearchIndex = (): Promise<SearchIndexEntry[]> => {
  if (postsSearchIndexCache) {
    return Promise.resolve(postsSearchIndexCache);
  }
  if (!postsSearchIndexPromise) {
    postsSearchIndexPromise = loadPostsSearchData()
      .then(buildSearchIndex)
      .then((index) => {
        postsSearchIndexCache = index;
        postsSearchIndexPromise = null;
        return index;
      })
      .catch((error) => {
        postsSearchIndexPromise = null;
        throw error;
      });
  }
  return postsSearchIndexPromise;
};

/** 计算单字段的搜索匹配得分（精确/前缀/包含加权）。 */
export const getFieldMatchScore = (value: string, terms: string[], fullQuery: string, weight: number) => {
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

/** 同步读取构建期内联的文章元数据列表（新 → 旧，SSG / 首帧渲染用）。 */
export const getInitialPosts = (): PostMetadata[] => initialPosts;

/** 异步读取文章元数据列表（保留 async 签名与调用方兼容）。 */
export const getPosts = async (): Promise<PostMetadata[]> => initialPosts;

/**
 * 按 id 读取单篇文章（含正文）：优先动态加载打包的 Markdown 原文，
 * 加载失败且元数据存在时抛错（Markdown 文件缺失）。
 */
export const getPostById = async (id: string): Promise<Post | undefined> => {
  const meta = initialPosts.find((post) => post.id === id);
  const relativePath = meta ? `../..${meta.filePath}` : undefined;
  const loader = relativePath ? postFiles[relativePath] : undefined;

  if (meta && loader) {
    try {
      const rawContent = (await loader()) as string;
      return {
        ...meta,
        content: stripFrontmatter(rawContent),
      };
    } catch (error) {
      console.error(`Markdown 文件加载失败: ${relativePath}`, error);
    }
  }

  if (!meta) {
    return undefined;
  }

  const error = new Error(`Markdown 文件缺失: ${relativePath}`);
  console.error(error);
  throw error;
};

export type PostSearchScope = 'all' | 'category' | 'content' | 'title';
type PostSearchField = 'title' | 'category' | 'excerpt' | 'content' | 'tags';

interface PostSearchMatch {
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
  tags: '标签',
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

const createSearchSnippet = (
  rawValue: string,
  normalizedValue: string,
  terms: string[],
  field: PostSearchField,
): PostSearchMatch | undefined => {
  if (!rawValue) {
    return undefined;
  }

  const matchedTerms = terms.filter((term) => normalizedValue.includes(term));
  if (matchedTerms.length === 0) {
    return undefined;
  }

  const firstTerm = matchedTerms[0];
  const rawMatchIndex = rawValue.toLowerCase().indexOf(firstTerm);
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
    terms: matchedTerms,
  };
};

const getSearchableFields = (entry: SearchIndexEntry, scope: PostSearchScope) => {
  switch (scope) {
    case 'category':
      return [{ key: 'category', value: entry.category, weight: 6 }] as const;
    case 'content':
      return [
        { key: 'excerpt', value: entry.excerpt, weight: 2 },
        { key: 'content', value: entry.content, weight: 1 },
      ] as const;
    case 'title':
      return [{ key: 'title', value: entry.title, weight: 8 }] as const;
    case 'all':
    default:
      return [
        { key: 'title', value: entry.title, weight: 8 },
        { key: 'category', value: entry.category, weight: 4 },
        { key: 'excerpt', value: entry.excerpt, weight: 2 },
        { key: 'content', value: entry.content, weight: 1 },
      ] as const;
  }
};

const getBestSearchMatch = (
  entry: SearchIndexEntry,
  terms: string[],
  fields: ReadonlyArray<{ key: PostSearchField; value: string; weight: number }>,
  includeTags: boolean,
): PostSearchMatch | undefined => {
  const rawValues: Record<PostSearchField, string> = {
    title: entry.rawTitle,
    category: entry.rawCategory,
    excerpt: entry.rawExcerpt,
    content: entry.rawContent,
    tags: entry.rawTags.join('、'),
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

/**
 * 全文搜索：对标题/分类/摘要/正文/标签做多维权重评分（scope 可限定搜索域），
 * 结果按分数降序、日期倒序，并带命中片段（searchMatch）；结果按
 * scope::query 键做 LRU 缓存。空查询返回空数组。
 */
export const searchPosts = async (
  query: string,
  options: { scope?: PostSearchScope } = {},
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
        dateTimestamp: entry.dateTimestamp,
      });
    }
  });

  const resolvedResults = results
    .sort((a, b) => b.score - a.score || b.dateTimestamp - a.dateTimestamp)
    .map(({ score, dateTimestamp, ...post }) => post);

  setSearchCache(cacheKey, resolvedResults);
  return resolvedResults;
};
