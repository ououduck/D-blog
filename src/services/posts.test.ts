import { describe, it, expect } from 'vitest';
import type { PostMetadata } from '../types';
import { getDateTimestamp } from '@/utils/date';
import { getFieldMatchScore, getInitialPosts, getPostById, getPosts, searchPosts } from './posts';

/**
 * 搜索逻辑测试。
 *
 * searchPosts 依赖 generated/ 数据（由 `npm run gen:data` 生成）与
 * import.meta.glob / 动态 import()，Vitest 原生支持，无需 mock。
 * 测试通过真实站点数据推导查询词，避免把具体内容写死。
 */
describe('getFieldMatchScore', () => {
  const weight = 8;

  it('整句精确匹配得分最高（weight * 12）', () => {
    const score = getFieldMatchScore('hello world', ['hello', 'world'], 'hello world', weight);
    // 整句精确 12 + 词精确 5 + 词包含 2
    expect(score).toBe(weight * 12 + weight * 4 + weight * 2);
  });

  it('整句前缀匹配次之（weight * 9）', () => {
    const score = getFieldMatchScore('hello world!!!', ['hello', 'world'], 'hello world', weight);
    expect(score).toBe(weight * 9 + weight * 4 + weight * 2);
  });

  it('整句包含匹配再次之（weight * 6）', () => {
    const score = getFieldMatchScore('say hello world now', ['hello', 'world'], 'hello world', weight);
    expect(score).toBe(weight * 6 + weight * 2 + weight * 2);
  });

  it('精确/前缀/包含匹配的分数严格递减', () => {
    const exact = getFieldMatchScore('typescript', ['typescript'], 'typescript', weight);
    const prefix = getFieldMatchScore('typescripting', ['typescript'], 'typescript', weight);
    const contains = getFieldMatchScore('using typescript today', ['typescript'], 'typescript', weight);
    expect(exact).toBeGreaterThan(prefix);
    expect(prefix).toBeGreaterThan(contains);
  });

  it('词级匹配：精确（5）> 前缀（4）> 包含（2）', () => {
    const termExact = getFieldMatchScore('react', ['react'], 'react router', weight);
    const termPrefix = getFieldMatchScore('reactjs', ['react'], 'react router', weight);
    const termContains = getFieldMatchScore('preact-lite', ['react'], 'react router', weight);
    expect(termExact).toBe(weight * 5);
    expect(termPrefix).toBe(weight * 4);
    expect(termContains).toBe(weight * 2);
  });

  it('空字符串返回 0', () => {
    expect(getFieldMatchScore('', ['a'], 'a', weight)).toBe(0);
    expect(getFieldMatchScore('   ', ['a'], 'a', weight)).toBe(0);
  });

  it('无任何匹配返回 0', () => {
    expect(getFieldMatchScore('xyz', ['a', 'b'], 'a b', weight)).toBe(0);
  });
});

describe('searchPosts 基本行为', () => {
  it('空查询返回空数组', async () => {
    expect(await searchPosts('')).toEqual([]);
    expect(await searchPosts('   ')).toEqual([]);
    expect(await searchPosts('\t\n')).toEqual([]);
  });

  it('返回结果不携带内部 searchText 字段', async () => {
    const allPosts = await getPosts();
    const results = await searchPosts(allPosts[0].title);
    expect(results.length).toBeGreaterThan(0);
    for (const result of results) {
      expect(result).not.toHaveProperty('searchText');
    }
  });

  it('搜索不区分大小写', async () => {
    const allPosts = await getPosts();
    // 推导含 ASCII 字母的查询词：从标题/正文中找出首个拉丁字母片段（如
    // "React"、"SPA"），分别做大小写变换后断言结果集一致 —— 此前直接用
    // 中文标题的 toLocaleLowerCase()/toLocaleUpperCase()（恒等变换），
    // 两次查询完全相同，从未真正验证大小写折叠逻辑。
    const haystack = [allPosts[0].title, allPosts[0].excerpt].join(' ');
    const asciiWord = haystack.match(/[A-Za-z]{2,}/)?.[0];
    if (!asciiWord) {
      // 站点数据无 ASCII 词时无法构造有效用例（测试不应依赖特定内容）。
      return;
    }
    const lower = await searchPosts(asciiWord.toLowerCase());
    const upper = await searchPosts(asciiWord.toUpperCase());
    expect(lower.length).toBeGreaterThan(0);
    expect(upper.map((post) => post.id)).toEqual(lower.map((post) => post.id));
    expect(upper.length).toBe(lower.length);
  });

  it('相同查询命中缓存：两次调用返回同一数组引用', async () => {
    const allPosts = await getPosts();
    const first = await searchPosts(allPosts[0].title);
    const second = await searchPosts(allPosts[0].title);
    expect(first).toBe(second);
    expect(first.length).toBeGreaterThan(0);
  });

  it('不同 scope 使用不同缓存键', async () => {
    const allPosts = await getPosts();
    const first = await searchPosts(allPosts[0].title, { scope: 'all' });
    const second = await searchPosts(allPosts[0].title, { scope: 'title' });
    expect(first).not.toBe(second);
  });
});

describe('searchPosts 排序与匹配', () => {
  it('标题整句精确匹配的文章排第一', async () => {
    const allPosts = await getPosts();
    const target = allPosts[0];
    const results = await searchPosts(target.title);
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].id).toBe(target.id);
  });

  it('all scope：分类精确匹配的文章先于仅正文命中的文章', async () => {
    const searchData = (await import('../../generated/posts-search.json')).default as Array<
      PostMetadata & { searchText?: string }
    >;
    // 构造对比对：找一个「纯分类命中」的文章（category=教程，但标题/摘要/正文
    // 均不含"教程"——分类命中权重 4×12 独立贡献），与一个「纯正文命中」的文章
    //（category≠教程 但正文含"教程"）。断言前者在结果中排在后者之前。
    const pureCategoryHit = searchData.find(
      (post) =>
        post.category === '教程' &&
        !post.title.includes('教程') &&
        !post.excerpt.includes('教程') &&
        !(post.searchText ?? '').includes('教程'),
    );
    const pureContentHit = searchData.find(
      (post) => post.category !== '教程' && (post.searchText ?? '').includes('教程'),
    );
    // 站点数据不足时跳过（测试不依赖具体内容），但至少保证有分类命中结果。
    const results = await searchPosts('教程');
    expect(results.length).toBeGreaterThan(0);
    if (pureCategoryHit && pureContentHit) {
      const categoryIndex = results.findIndex((post) => post.id === pureCategoryHit.id);
      const contentIndex = results.findIndex((post) => post.id === pureContentHit.id);
      expect(categoryIndex).toBeGreaterThanOrEqual(0);
      expect(contentIndex).toBeGreaterThanOrEqual(0);
      expect(categoryIndex).toBeLessThan(contentIndex);
    }
  });

  it('多词查询：全部词命中才返回', async () => {
    const allPosts = await getPosts();
    const twoWord = allPosts.find((post) => post.title.split(/\s+/).length >= 2);
    if (twoWord) {
      const words = twoWord.title.split(/\s+/).slice(0, 2);
      const results = await searchPosts(words.join(' '));
      expect(results.some((post) => post.id === twoWord.id)).toBe(true);
    } else {
      const results = await searchPosts(allPosts[0].title);
      expect(results.length).toBeGreaterThan(0);
    }
  });

  it('部分词缺失时返回空', async () => {
    const results = await searchPosts('zzzz-不存在的词-qqqq-另外一个');
    expect(results).toEqual([]);
  });

  it('同分结果按日期倒序（dateTimestamp 本地时区口径回归）', async () => {
    const results = await searchPosts('教程', { scope: 'category' });
    // category 精确匹配得分相同，应整体按日期倒序（newest first）。
    for (let i = 1; i < results.length; i += 1) {
      expect(getDateTimestamp(results[i - 1].date)).toBeGreaterThanOrEqual(getDateTimestamp(results[i].date));
    }
  });
});

describe('searchPosts scope 筛选', () => {
  it('scope=title 只返回标题包含查询的文章', async () => {
    const allPosts = await getPosts();
    const title = allPosts[0].title;
    const results = await searchPosts(title, { scope: 'title' });
    expect(results.length).toBeGreaterThan(0);
    for (const result of results) {
      expect(result.title.toLocaleLowerCase()).toContain(title.toLocaleLowerCase());
    }
  });

  it('scope=category 只返回分类包含查询的文章', async () => {
    const results = await searchPosts('教程', { scope: 'category' });
    expect(results.length).toBeGreaterThan(0);
    for (const result of results) {
      expect(result.category).toBe('教程');
    }
  });

  it('scope=content 命中正文但标题不含查询词的文章', async () => {
    const allPosts = await getPosts();
    const searchData = (await import('../../generated/posts-search.json')).default as Array<
      PostMetadata & { searchText?: string }
    >;
    const allTitles = allPosts.map((post) => post.title.toLocaleLowerCase());

    // 找一个只出现在正文、不出现在任何标题里的词。
    let contentOnlyTerm: string | null = null;
    let ownerId: string | null = null;
    for (const post of searchData) {
      const words = (post.searchText ?? '').split(' ').filter((word) => word.length >= 2);
      const term = words.find((word) => !allTitles.some((title) => title.includes(word)));
      if (term) {
        contentOnlyTerm = term;
        ownerId = post.id;
        break;
      }
    }

    expect(contentOnlyTerm).not.toBeNull();
    const contentResults = await searchPosts(contentOnlyTerm!, { scope: 'content' });
    expect(contentResults.some((post) => post.id === ownerId)).toBe(true);
    // 同一词在 title scope 下不应命中任何文章。
    const titleResults = await searchPosts(contentOnlyTerm!, { scope: 'title' });
    expect(titleResults).toEqual([]);
  });

  it('非法 scope 回退为 all', async () => {
    const allPosts = await getPosts();
    const title = allPosts[0].title;
    // @ts-expect-error 传入非法 scope 验证回退行为
    const results = await searchPosts(title, { scope: 'bogus' });
    expect(results.length).toBeGreaterThan(0);
  });
});

describe('getPosts / getInitialPosts / getPostById', () => {
  it('getPosts 返回生成的数据且字段完整', async () => {
    const posts = await getPosts();
    expect(posts.length).toBeGreaterThan(0);
    for (const post of posts) {
      expect(post.id).toBeTruthy();
      expect(post.title).toBeTruthy();
      expect(post.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(Array.isArray(post.tags)).toBe(true);
      expect(post.filePath).toMatch(/^\/posts\//);
    }
  });

  it('getInitialPosts 与 getPosts 一致', async () => {
    const posts = await getPosts();
    expect(getInitialPosts()).toEqual(posts);
  });

  it('getPostById 能读取正文并剥离 front matter', async () => {
    const allPosts = await getPosts();
    const post = await getPostById(allPosts[0].id);
    expect(post).toBeDefined();
    expect(post!.content.length).toBeGreaterThan(0);
    expect(post!.content.startsWith('---')).toBe(false);
    expect(post!.content.trim().length).toBeGreaterThan(0);
  });

  it('getPostById 未知 id 返回 undefined', async () => {
    expect(await getPostById('definitely-not-a-real-post-id')).toBeUndefined();
  });
});
