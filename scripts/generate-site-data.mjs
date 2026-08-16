/**
 * 站点数据生成：解析 posts/shuoshuo/friends 内容并输出 generated/posts.json、搜索索引、sitemap、llms.txt 等全部构建期数据。
 */

import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import matter from 'gray-matter';
import { fileURLToPath } from 'url';
import { loadSiteConfig } from './site-config-loader.mjs';
import { createBuildLogger } from './build-logger.mjs';
import { getBasePath, withBasePath } from './base-path.mjs';
import {
  DEFAULT_STATIC_ROUTES,
  findDuplicatePostIds,
  parseMarkdownImages,
  validatePostContent,
} from './post-content-validator.mjs';
import { extractMarkdownHeadings } from '../src/utils/headings-core.mjs';
import { buildRssFeed } from './feed-generator.mjs';
import { fetchCommentCounts } from './fetch-giscus-comments.mjs';

const logger = createBuildLogger('gen:data');
logger.start('Generate site data');

/**
 * 全局异常兜底（Phase 1 审计项 9 修复）：
 * 本脚本主体为顶层同步逻辑，任何校验/解析 throw（如 front matter 校验失败）
 * 都会触发 uncaughtException。这里结构化记录错误并以非零码退出，
 * 替代 Node 默认的裸堆栈打印，便于在 Actions 日志中快速定位失败原因。
 * 注意：用 process.exitCode 而非 process.exit(1)——前者让事件循环自然收尾、
 * stdout/stderr 日志完成 flush 后再退出（避免日志被截断）；脚本为顶层同步
 * 逻辑，异常后没有挂起的异步工作，进程随即退出。非零码由 build.mjs 阶段
 * 判定，构建失败行为不变。
 */
process.on('uncaughtException', (error) => {
  logger.error('Site data generation failed', error instanceof Error ? error.stack : String(error));
  process.exitCode = 1;
});
process.on('unhandledRejection', (reason) => {
  logger.error(
    'Unhandled promise rejection during site data generation',
    reason instanceof Error ? reason.stack : String(reason),
  );
  process.exitCode = 1;
});

const siteConfig = loadSiteConfig({ logger });
const SITE_URL = siteConfig.url;
const BASE_PATH = getBasePath();
const SITE_TITLE = siteConfig.title;
const SITE_DESCRIPTION = siteConfig.description;
const AUTHOR_NAME = siteConfig.author.name;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const POSTS_DIR = path.join(__dirname, '../posts');
const IMAGE_ROOT = path.join(__dirname, '../posts-img');
const FRIENDS_DIR = path.join(__dirname, '../friends');
const SHUOSHUO_DIR = path.join(__dirname, '../shuoshuo');
const OUTPUT_JSON_DIR = path.join(__dirname, '../generated');
const PUBLIC_DIR = path.join(__dirname, '../public');

/**
 * 单篇文章文件大小上限（字节）：5 MiB。
 * Phase 3 加固：误提交超大文件（日志转储、二进制误入）会让 markdownToSearchText /
 * countWords 的多次全量正则遍历 + posts-search.json 体积失控，构建内存峰值爆炸。
 * 超限文章 fail-closed（构建失败）并给出明确指引。
 */
const MAX_POST_FILE_BYTES = 5 * 1024 * 1024;

/**
 * 允许透传进 posts.json 的未知 frontmatter 字段白名单。
 * Phase 3/4 加固：此前 `...restData` 会把 frontmatter 中所有未知键
 * （Obsidian 习惯的 aliases/cssclass 等）原样序列化进 generated/posts.json，
 * 进而污染 ssg-route-data 内联 JSON 与客户端数据契约。白名单外的键全部剔除。
 * 注意：title/excerpt 等核心业务字段在 buildPost 中显式传递（见下方），
 * 此处只管辖"额外布尔/数字标志"的透传，避免核心字段被误过滤。
 */
const POST_FRONTMATTER_ALLOWLIST = new Set(['featured', 'featured-top']);

if (!fs.existsSync(OUTPUT_JSON_DIR)) {
  fs.mkdirSync(OUTPUT_JSON_DIR, { recursive: true });
}

if (!fs.existsSync(PUBLIC_DIR)) {
  fs.mkdirSync(PUBLIC_DIR, { recursive: true });
}

const validateDateString = (value) => {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
};

const xmlEscape = (value) =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');

const HTTP_URL_PROTOCOLS = new Set(['http:', 'https:']);

const assertValidUrl = (value, label, allowedProtocols = HTTP_URL_PROTOCOLS) => {
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new Error(`${label} must be a valid URL: ${value}`);
  }

  if (!allowedProtocols.has(url.protocol)) {
    throw new Error(`${label} protocol must be one of ${Array.from(allowedProtocols).join(', ')}: ${value}`);
  }
};

const toPublicPath = (value) => withBasePath(value, BASE_PATH);

assertValidUrl(SITE_URL, 'siteConfig.url');

const markdownToSearchText = (markdown) =>
  markdown
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`[^`]*`/g, ' ')
    .replace(/!\[[^\]]*]\([^)]+\)/g, ' ')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '$1')
    .replace(/<[^>]+>/g, ' ')
    .replace(/[#>*_~|-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

/** 统计 Markdown 的可读单元数：汉字按字、拉丁字符按词（countWords / calculateReadTime 共用同一口径）。 */
const countReadingUnits = (markdown) => {
  const plainText = markdownToSearchText(markdown);
  const hanCharacters = (plainText.match(/[\u4e00-\u9fff]/g) || []).length;
  const latinWords = (plainText.replace(/[\u4e00-\u9fff]/g, ' ').match(/[A-Za-z0-9_]+/g) || []).length;
  return hanCharacters + latinWords;
};

const countWords = (markdown) => countReadingUnits(markdown);

// 正文图片数量统计：外链图床图片无法在构建期读取尺寸（由前端 CSS aspect-ratio
// 兜底）；本地 posts-img/ 路径仍被 post-content-validator 校验（文件必须存在）。
const countImages = (markdown) => parseMarkdownImages(markdown).length;

const generateSiteStats = (postsWithSearch) => {
  const totalPosts = postsWithSearch.length;
  const totalWords = postsWithSearch.reduce((sum, post) => sum + (post.wordCount || 0), 0);
  const totalCategories = new Set(postsWithSearch.map((post) => post.category)).size;
  const totalTags = new Set(postsWithSearch.flatMap((post) => post.tags || [])).size;
  const totalImages = postsWithSearch.reduce((sum, post) => sum + (post.imageCount || 0), 0);
  const toPostSummary = (post) => ({
    id: post.id,
    title: post.title,
    excerpt: post.excerpt,
    date: post.date,
    updatedAt: post.updatedAt,
    category: post.category,
    tags: post.tags,
    coverImage: post.coverImage,
    readTime: post.readTime,
    wordCount: post.wordCount || 0,
    imageCount: post.imageCount || 0,
  });
  const countBy = (items, getKey) =>
    Array.from(
      items
        .reduce((map, item) => {
          const key = getKey(item);
          if (key) {
            map.set(key, (map.get(key) || 0) + 1);
          }
          return map;
        }, new Map())
        .entries(),
    )
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, 'zh-CN'));
  const categoryStats = countBy(postsWithSearch, (post) => post.category);
  const tagStats = countBy(
    postsWithSearch.flatMap((post) => post.tags || []),
    (tag) => tag,
  ).slice(0, 12);
  const recentPosts = postsWithSearch
    .slice()
    .sort((a, b) => new Date(b.updatedAt || b.date) - new Date(a.updatedAt || a.date))
    .slice(0, 5)
    .map(toPostSummary);
  const topWordCountPosts = postsWithSearch
    .slice()
    .sort((a, b) => (b.wordCount || 0) - (a.wordCount || 0))
    .slice(0, 5)
    .map(toPostSummary);
  const topImageCountPosts = postsWithSearch
    .slice()
    .sort((a, b) => (b.imageCount || 0) - (a.imageCount || 0))
    .slice(0, 5)
    .map(toPostSummary);

  fs.writeFileSync(
    path.join(OUTPUT_JSON_DIR, 'site-stats.json'),
    JSON.stringify(
      {
        totalPosts,
        totalWords,
        totalCategories,
        totalTags,
        totalImages,
        categoryStats,
        tagStats,
        recentPosts,
        topWordCountPosts,
        topImageCountPosts,
      },
      null,
      2,
    ),
  );

  logger.step(
    'Generated site-stats.json',
    `posts=${totalPosts} words=${totalWords} categories=${totalCategories} tags=${totalTags} images=${totalImages}`,
  );
};

const calculateReadTime = (markdown) => {
  const minutes = Math.max(1, Math.ceil(countReadingUnits(markdown) / 300));

  return `${minutes}分钟阅读`;
};

const normalizeAuthor = (value) => {
  if (typeof value === 'string') {
    const name = value.trim();
    return name ? { name } : null;
  }

  if (!value || typeof value !== 'object') {
    return null;
  }

  if (typeof value.name !== 'string' || value.name.trim() === '') {
    return null;
  }

  return {
    name: value.name.trim(),
    avatar: typeof value.avatar === 'string' && value.avatar.trim() ? value.avatar.trim() : undefined,
    role: typeof value.role === 'string' && value.role.trim() ? value.role.trim() : undefined,
    bio: typeof value.bio === 'string' && value.bio.trim() ? value.bio.trim() : undefined,
    url: typeof value.url === 'string' && value.url.trim() ? value.url.trim() : undefined,
  };
};

const normalizeAuthors = (author, authors) => {
  const rawAuthors = [...(Array.isArray(authors) ? authors : authors ? [authors] : []), ...(author ? [author] : [])];

  const normalizedAuthors = rawAuthors.map((entry) => normalizeAuthor(entry)).filter(Boolean);

  return normalizedAuthors.length > 0
    ? normalizedAuthors.filter(
        (entry, index, collection) => collection.findIndex((candidate) => candidate.name === entry.name) === index,
      )
    : undefined;
};

const formatFrontmatterDate = (value) => {
  if (!value) {
    return undefined;
  }

  if (value instanceof Date) {
    // gray-matter（js-yaml timestamp）把 "2026-08-13" 解析为 UTC 午夜。
    // 必须用 UTC 读取各字段：若用本地时区 getters，在 UTC-5/-8 等负偏移
    // 机器上构建会把日期整体提前一天（如 2026-08-13 → 2026-08-12），
    // 影响文章排序、RSS pubDate 与 sitemap lastmod。
    const year = value.getUTCFullYear();
    const month = String(value.getUTCMonth() + 1).padStart(2, '0');
    const day = String(value.getUTCDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  return String(value);
};

const CONTENT_CONFIG_FILE = path.join(__dirname, '../config/content.config.json');
let contentConfig;
try {
  contentConfig = JSON.parse(fs.readFileSync(CONTENT_CONFIG_FILE, 'utf-8'));
} catch (error) {
  throw new Error(`Failed to load ${CONTENT_CONFIG_FILE}: ${error instanceof Error ? error.message : String(error)}`);
}
const POST_CATEGORIES =
  Array.isArray(contentConfig.postCategories) && contentConfig.postCategories.length > 0
    ? contentConfig.postCategories
    : ['其他'];
const FALLBACK_CATEGORY =
  typeof contentConfig.fallbackCategory === 'string' && contentConfig.fallbackCategory.trim()
    ? contentConfig.fallbackCategory.trim()
    : POST_CATEGORIES[POST_CATEGORIES.length - 1];

const normalizeCategory = (value) => {
  if (typeof value !== 'string') {
    return FALLBACK_CATEGORY;
  }

  const category = value.trim();
  if (!category) {
    return FALLBACK_CATEGORY;
  }

  return POST_CATEGORIES.includes(category) ? category : FALLBACK_CATEGORY;
};

const validatePostFrontmatter = (filename, data, formattedDate, formattedUpdatedAt, id) => {
  const errors = [];

  if (typeof id !== 'string' || id.trim() === '') {
    errors.push('id must be a non-empty string');
  }
  if (typeof data.title !== 'string' || data.title.trim() === '') {
    errors.push('title must be a non-empty string');
  }
  if (typeof data.excerpt !== 'string' || data.excerpt.trim() === '') {
    errors.push('excerpt must be a non-empty string');
  }
  if (!formattedDate || !validateDateString(formattedDate)) {
    errors.push('date must use YYYY-MM-DD format');
  }
  if (formattedUpdatedAt && !validateDateString(formattedUpdatedAt)) {
    errors.push('updatedAt must use YYYY-MM-DD format');
  }
  if (!Array.isArray(data.tags)) {
    errors.push('tags must be an array');
  } else {
    const seenTags = new Set();
    data.tags.forEach((tag, index) => {
      if (typeof tag !== 'string' || !tag.trim()) {
        errors.push(`tags[${index}] must be a non-empty string`);
        return;
      }
      const normalizedTag = tag.trim();
      if (seenTags.has(normalizedTag)) {
        errors.push(`tags contains duplicate label "${normalizedTag}"`);
      }
      seenTags.add(normalizedTag);
    });
  }
  if (
    typeof id === 'string' &&
    (id !== id.trim() ||
      /\s|[\\/?#%"'<>]/.test(id) ||
      id === '.' ||
      id === '..' ||
      id.includes('/./') ||
      id.includes('/../'))
  ) {
    errors.push(`id "${id}" contains characters that are unsafe in a post URL`);
  }
  if (typeof data.category === 'string' && data.category.trim() && !POST_CATEGORIES.includes(data.category.trim())) {
    errors.push(`category must be one of: ${POST_CATEGORIES.join(', ')}`);
  }
  if (data.featured !== undefined && typeof data.featured !== 'boolean') {
    errors.push('featured must be a boolean when provided');
  }
  if (
    data['featured-top'] !== undefined &&
    (typeof data['featured-top'] !== 'number' || !Number.isFinite(data['featured-top']))
  ) {
    errors.push('featured-top must be a finite number when provided');
  }
  if (data.series !== undefined && typeof data.series !== 'boolean') {
    errors.push('series must be a boolean when provided');
  }
  if (data.series === true) {
    if (typeof data['series-name'] !== 'string' || data['series-name'].trim() === '') {
      errors.push('series-name must be a non-empty string when series is true');
    }
    if (
      typeof data['series-order'] !== 'number' ||
      !Number.isInteger(data['series-order']) ||
      data['series-order'] < 1
    ) {
      errors.push('series-order must be a positive integer when series is true');
    }
  }

  return errors.length > 0 ? `Invalid front matter in ${filename}: ${errors.join('; ')}` : undefined;
};

const files = fs.readdirSync(POSTS_DIR).filter((file) => {
  if (!file.endsWith('.md')) return false;
  try {
    return fs.statSync(path.join(POSTS_DIR, file)).isFile();
  } catch {
    return false;
  }
});

// Phase 3 加固：超限文件错误独立收集（validationErrors 在 map 之后才初始化，
// 不能在 map 回调中直接引用它，否则触发 TDZ ReferenceError）。
const oversizedFileErrors = [];

const postRecords = files
  .map((filename) => {
    const filePath = path.join(POSTS_DIR, filename);
    // Phase 3 加固：先校验文件大小（fail-closed），超限文件不读入内存。
    try {
      const stat = fs.statSync(filePath);
      if (stat.size > MAX_POST_FILE_BYTES) {
        oversizedFileErrors.push(
          `Post file ${filename} exceeds size limit (${stat.size} > ${MAX_POST_FILE_BYTES} bytes); likely a binary/attachment mis-committed as Markdown.`,
        );
        return {
          filename,
          filePath,
          data: {},
          content: '',
          restData: {},
          draft: false,
          id: '',
          formattedDate: undefined,
          formattedUpdatedAt: undefined,
          headingIds: [],
          contentStartLine: 0,
          errors: [],
        };
      }
    } catch {
      // statSync 失败（文件在遍历后被删除等极端竞态）：跳过该文件，不中断构建。
      return null;
    }
    const fileContent = fs.readFileSync(filePath, 'utf-8');
    let data = {};
    let content = fileContent;
    let parseError;

    try {
      ({ data, content } = matter(fileContent));
    } catch (error) {
      parseError = `Invalid front matter in ${filename}: ${error instanceof Error ? error.message : String(error)}`;
      content = '';
    }

    // 仅解构实际使用的字段；其余未知键全部进入 restData，由下方白名单过滤剔除
    // （frontmatter 中的 author/authors/coverImage 等经 data.* 显式读取）。
    const { draft, updatedAt, ...restData } = data;
    const id = typeof data.id === 'string' ? data.id : '';
    const formattedDate = formatFrontmatterDate(data.date);
    const formattedUpdatedAt = formatFrontmatterDate(updatedAt);
    const frontMatterError =
      parseError || validatePostFrontmatter(filename, data, formattedDate, formattedUpdatedAt, id);
    const contentStartLine = (() => {
      const lines = fileContent.split(/\r?\n/);
      if (!/^\uFEFF?---\s*$/.test(lines[0] || '')) return 0;
      const closingIndex = lines.findIndex((line, index) => index > 0 && /^---\s*$/.test(line));
      return closingIndex >= 0 ? closingIndex + 1 : 0;
    })();
    const headingIds = extractMarkdownHeadings(content).map((heading) => heading.id);

    return {
      filename,
      filePath,
      data,
      content,
      // Phase 3 加固：白名单过滤未知 frontmatter 键，杜绝污染产物数据契约。
      restData: Object.fromEntries(Object.entries(restData).filter(([key]) => POST_FRONTMATTER_ALLOWLIST.has(key))),
      draft: draft === true,
      id,
      formattedDate,
      formattedUpdatedAt,
      headingIds,
      contentStartLine,
      errors: frontMatterError ? [frontMatterError] : [],
    };
  })
  .filter(Boolean);

const allPostIndex = new Map();
const publishedPostIndex = new Map();
// Phase 3 加固：合并超限文件错误（它们在 map 阶段独立收集，避免 TDZ）。
const validationErrors = [...oversizedFileErrors, ...postRecords.flatMap((record) => record.errors)];
findDuplicatePostIds(postRecords).forEach(({ id, filename }) => {
  validationErrors.push(`Duplicate post id "${id}" found in ${filename}.`);
});
postRecords.forEach((record) => {
  if (!record.id) return;
  if (!allPostIndex.has(record.id)) {
    allPostIndex.set(record.id, record);
  }
  if (!record.draft && !publishedPostIndex.has(record.id)) {
    publishedPostIndex.set(record.id, record);
  }
});

const normalizeTagsStrict = (value) => (Array.isArray(value) ? value.map((tag) => tag.trim()) : []);

const buildPost = (record) => {
  const { filename, content, data, restData, id, formattedDate, formattedUpdatedAt, draft } = record;
  const normalizedAuthors = normalizeAuthors(data.author, data.authors);
  const category = normalizeCategory(data.category);
  const tags = normalizeTagsStrict(data.tags);
  // coverImage 保留外部协议字符串（图床链接）；本地路径（已废弃）原样透传供校验器拦截。
  const normalizedCoverImage = data.coverImage ? String(data.coverImage) : undefined;
  const isSeries = data.series === true;
  const seriesName = isSeries && typeof data['series-name'] === 'string' ? data['series-name'].trim() : undefined;
  const seriesOrder = isSeries && Number.isInteger(data['series-order']) ? data['series-order'] : undefined;

  return draft
    ? null
    : {
        ...restData,
        // 核心业务字段显式传递（Phase 4 修复）：title/excerpt 原本依赖 restData 透传，
        // 白名单过滤后会被剔除导致下游 llms.txt/RSS 崩溃。这里显式取值，
        // 且 validatePostFrontmatter 已保证二者为非空字符串。
        title: data.title,
        excerpt: data.excerpt,
        ...(isSeries ? { series: true, seriesName, seriesOrder } : {}),
        coverImage: normalizedCoverImage,
        category,
        tags,
        date: formattedDate,
        updatedAt: formattedUpdatedAt,
        authors: normalizedAuthors,
        id,
        filePath: `/posts/${filename}`,
        readTime: calculateReadTime(content),
        wordCount: countWords(content),
        imageCount: countImages(content),
        content,
        searchText: markdownToSearchText(content),
      };
};

postRecords.forEach((record) => {
  validationErrors.push(
    ...validatePostContent(record, {
      filename: record.filename,
      imageRoot: IMAGE_ROOT,
      allPosts: allPostIndex,
      publishedPosts: publishedPostIndex,
      staticRoutes: DEFAULT_STATIC_ROUTES,
      skipFrontMatter: true,
      lineOffset: record.contentStartLine,
    }),
  );
});

const seriesOrders = new Map();
postRecords.forEach((record) => {
  if (
    record.draft ||
    record.data.series !== true ||
    !record.id ||
    !record.data['series-name'] ||
    !Number.isInteger(record.data['series-order'])
  ) {
    return;
  }

  const key = record.data['series-name'].trim();
  const order = record.data['series-order'];
  const seenOrders = seriesOrders.get(key) ?? new Map();
  const previous = seenOrders.get(order);
  if (previous) {
    validationErrors.push(
      `Duplicate series-order ${order} for series "${key}" in ${record.filename}; already used by ${previous}.`,
    );
  } else {
    seenOrders.set(order, record.filename);
    seriesOrders.set(key, seenOrders);
  }
});

// ── 说说（短动态）解析：shuoshuo/*.md，frontmatter 提供 id/date/images，正文即动态内容 ──
// 与文章同级的质量门槛：id/date 缺失或重复直接 fail-closed，避免脏数据进入产物。
const shuoshuoFiles = fs.existsSync(SHUOSHUO_DIR)
  ? fs.readdirSync(SHUOSHUO_DIR).filter((file) => file.endsWith('.md'))
  : [];

const shuoshuoRecords = shuoshuoFiles.map((filename) => {
  const filePath = path.join(SHUOSHUO_DIR, filename);
  let data = {};
  let content = '';

  try {
    const fileContent = fs.readFileSync(filePath, 'utf-8');
    ({ data, content } = matter(fileContent));
  } catch (error) {
    validationErrors.push(
      `Invalid front matter in shuoshuo/${filename}: ${error instanceof Error ? error.message : String(error)}`,
    );
  }

  const id = typeof data.id === 'string' ? data.id.trim() : '';
  const formattedDate = formatFrontmatterDate(data.date);
  const images = Array.isArray(data.images) ? data.images.map((value) => String(value).trim()).filter(Boolean) : [];

  if (!id) {
    validationErrors.push(`Invalid front matter in shuoshuo/${filename}: id must be a non-empty string`);
  } else if (/\s|[\\/?#%"'<>]/.test(id) || id === '.' || id === '..') {
    validationErrors.push(
      `Invalid front matter in shuoshuo/${filename}: id "${id}" contains characters that are unsafe in a URL`,
    );
  }
  if (!formattedDate || !validateDateString(formattedDate)) {
    validationErrors.push(`Invalid front matter in shuoshuo/${filename}: date must use YYYY-MM-DD format`);
  }

  return {
    filename,
    id,
    date: formattedDate,
    images,
    content: content.trim(),
    filePath: `/shuoshuo/${filename}`,
  };
});

const seenShuoShuoIds = new Map();
shuoshuoRecords.forEach((record) => {
  if (!record.id) return;
  const previous = seenShuoShuoIds.get(record.id);
  if (previous) {
    validationErrors.push(
      `Duplicate shuoshuo id "${record.id}" found in shuoshuo/${record.filename} and shuoshuo/${previous}.`,
    );
  } else {
    seenShuoShuoIds.set(record.id, record.filename);
  }
});

const shuoshuo = shuoshuoRecords
  .filter((record) => record.id && record.date)
  .sort((a, b) => b.date.localeCompare(a.date) || a.id.localeCompare(b.id))
  .map(({ filename: _filename, ...record }) => record);

if (validationErrors.length > 0) {
  throw new Error(validationErrors.join('\n'));
}

const postsWithSearch = postRecords
  .map(buildPost)
  .filter(Boolean)
  .sort((a, b) => new Date(b.date) - new Date(a.date) || a.id.localeCompare(b.id));

generateSiteStats(postsWithSearch);
// 评论数：构建期从 GitHub GraphQL 拉取 Giscus 评论数（方案 A 快照）。
// 无 token / API 失败 / 限速时优雅跳过（返回 null），页面侧不展示评论数，不阻塞构建。
const commentCounts = await fetchCommentCounts({ posts: postsWithSearch });
if (commentCounts) {
  postsWithSearch.forEach((post) => {
    const count = commentCounts.get(post.id);
    if (count !== undefined) {
      post.commentCount = count;
    }
  });
  logger.step('Injected comment counts', `posts=${commentCounts.size}`);
} else {
  logger.warn('评论数获取已跳过，文章卡片将不展示评论数');
}
const posts = postsWithSearch.map(({ searchText, content, ...post }) => post);
fs.writeFileSync(path.join(OUTPUT_JSON_DIR, 'posts.json'), JSON.stringify(posts, null, 2));
fs.writeFileSync(
  path.join(OUTPUT_JSON_DIR, 'posts-search.json'),
  JSON.stringify(
    postsWithSearch.map(({ content, ...rest }) => rest),
    null,
    2,
  ),
);
logger.step('Generated posts data', `posts=${posts.length} sourceFiles=${files.length}`);

const requiredFriendFields = ['name', 'description', 'avatar', 'url'];
const friendFiles = fs.existsSync(FRIENDS_DIR)
  ? fs.readdirSync(FRIENDS_DIR).filter((file) => file.endsWith('.json'))
  : [];

const seenFriendUrls = new Set();
const friends = friendFiles.flatMap((filename) => {
  const filePath = path.join(FRIENDS_DIR, filename);

  try {
    const rawContent = fs.readFileSync(filePath, 'utf-8');
    const data = JSON.parse(rawContent);
    const missingFields = requiredFriendFields.filter(
      (field) => typeof data[field] !== 'string' || data[field].trim() === '',
    );

    if (missingFields.length > 0) {
      logger.warn('Skip invalid friend file', `${filename}: missing ${missingFields.join(', ')}`);
      return [];
    }

    const friendUrl = data.url.trim();
    const friendAvatar = data.avatar.trim();
    assertValidUrl(friendUrl, `friend ${filename} url`);
    assertValidUrl(friendAvatar, `friend ${filename} avatar`);

    if (seenFriendUrls.has(friendUrl)) {
      logger.warn('Skip duplicate friend file', `${filename}: url ${friendUrl}`);
      return [];
    }
    seenFriendUrls.add(friendUrl);

    return [
      {
        name: data.name.trim(),
        description: data.description.trim(),
        avatar: friendAvatar,
        url: friendUrl,
        // 已失联标记透传（由 friend-link-check Action 维护）：仅 true 时输出，
        // 保持产物精简；false/缺失视为正常状态。
        ...(data.unavailable === true ? { unavailable: true } : {}),
      },
    ];
  } catch (error) {
    logger.warn('Skip invalid friend file', `${filename}: ${error.message}`);
    return [];
  }
});

fs.writeFileSync(path.join(OUTPUT_JSON_DIR, 'friends.json'), JSON.stringify(friends, null, 2));
logger.step('Generated friends.json', `friends=${friends.length} sourceFiles=${friendFiles.length}`);

fs.writeFileSync(path.join(OUTPUT_JSON_DIR, 'shuoshuo.json'), JSON.stringify(shuoshuo, null, 2));
logger.step('Generated shuoshuo.json', `shuoshuo=${shuoshuo.length} sourceFiles=${shuoshuoFiles.length}`);

const siteAbsoluteUrl = (route = '/') => new URL(toPublicPath(route), `${SITE_URL}/`).toString();

const generateSitemap = () => {
  // 静态页面 lastmod 使用内容驱动的稳定值：取最新文章的更新时间，
  // 而非“今天”。构建日期会随每次部署变化，导致 lastmod 频繁抖动、
  // 搜索引擎反复重新抓取，而内容未变时 lastmod 变化毫无信息量。
  const latestPostDate =
    posts.length > 0
      ? new Date(Math.max(...posts.map((post) => new Date(post.updatedAt || post.date).getTime())))
          .toISOString()
          .split('T')[0]
      : new Date().toISOString().split('T')[0];
  const staticPages = [
    { path: '', changefreq: 'daily', priority: '1.0', lastmod: latestPostDate },
    { path: 'archive', changefreq: 'daily', priority: '0.9', lastmod: latestPostDate },
    { path: 'tags', changefreq: 'weekly', priority: '0.8', lastmod: latestPostDate },
    { path: 'stats', changefreq: 'weekly', priority: '0.6', lastmod: latestPostDate },
    { path: 'friends', changefreq: 'weekly', priority: '0.7', lastmod: latestPostDate },
    { path: 'shuoshuo', changefreq: 'weekly', priority: '0.6', lastmod: latestPostDate },
    { path: 'guestbook', changefreq: 'weekly', priority: '0.5', lastmod: latestPostDate },
    { path: 'about', changefreq: 'monthly', priority: '0.7', lastmod: latestPostDate },
    { path: 'cover', changefreq: 'monthly', priority: '0.5', lastmod: latestPostDate },
    { path: 'watermark', changefreq: 'monthly', priority: '0.5', lastmod: latestPostDate },
    { path: 'sponsor', changefreq: 'monthly', priority: '0.5', lastmod: latestPostDate },
    { path: 'search', changefreq: 'monthly', priority: '0.5', lastmod: latestPostDate },
  ];
  const postUrl = (post) => siteAbsoluteUrl(`/post/${post.id}`);
  const postLastmod = (post) => new Date(post.updatedAt || post.date).toISOString().split('T')[0];

  // 1. 静态页面 sitemap。
  const pagesXml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  ${staticPages
    .map(
      (page) => `
  <url>
    <loc>${xmlEscape(siteAbsoluteUrl(page.path))}</loc>
    <lastmod>${page.lastmod}</lastmod>
    <changefreq>${page.changefreq}</changefreq>
    <priority>${page.priority}</priority>
  </url>`,
    )
    .join('')}
</urlset>`;
  fs.writeFileSync(path.join(PUBLIC_DIR, 'sitemap-pages.xml'), pagesXml);

  // 2. 文章 sitemap。
  const postsXml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  ${posts
    .map(
      (post) => `
  <url>
    <loc>${xmlEscape(postUrl(post))}</loc>
    <lastmod>${postLastmod(post)}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.8</priority>
  </url>`,
    )
    .join('')}
</urlset>`;
  fs.writeFileSync(path.join(PUBLIC_DIR, 'sitemap-posts.xml'), postsXml);

  // 3. 图片 sitemap：收录文章封面。正文图片（PicGo 图床外链）不在此枚举：
  //    其 URL 已出现在页面 <img> 与 og:image 中，Google 可据此索引。
  //    Google image sitemap 规范允许 image:loc 指向自有 CDN；img.pldduck.com
  //    为站点自有图床域名。仅收录 http(s) 且带图片扩展名的 URL（data:/blob: 等
  //    动态数据在协议检查处即被排除）。
  const isIndexableImage = (url) => {
    const clean = String(url).split(/[?#]/, 1)[0].toLowerCase();
    if (!/^https?:\/\//.test(clean)) return false;
    return /\.(?:jpe?g|png|gif|webp|avif)$/i.test(clean);
  };
  const normalizeImageUrl = (url) => String(url).split(/[?#]/, 1)[0];
  const imagesXml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">
  ${posts
    .map((post) => {
      const images = [];
      const addImage = (imageUrl) => {
        const normalized = normalizeImageUrl(imageUrl);
        if (isIndexableImage(imageUrl) && !images.some((entry) => entry.loc === normalized)) {
          images.push({ loc: normalized, title: post.title });
        }
      };
      if (post.coverImage) {
        addImage(post.coverImage);
      }
      if (images.length === 0) {
        return '';
      }
      return `
  <url>
    <loc>${xmlEscape(postUrl(post))}</loc>${images
      .map(
        (image) => `
    <image:image>
      <image:loc>${xmlEscape(image.loc)}</image:loc>
      <image:title>${xmlEscape(image.title)}</image:title>
    </image:image>`,
      )
      .join('')}
  </url>`;
    })
    .join('')}
</urlset>`;
  fs.writeFileSync(path.join(PUBLIC_DIR, 'sitemap-images.xml'), imagesXml);

  // 4. 说说 sitemap：每条说说一个独立可索引页 /shuoshuo/<id>，
  //    lastmod 用内容日期（稳定，不随构建抖动）。图片说说仅收 URL 本身，
  //    配图已出现在页面 <img> 与 og:image 中，Google 可据此索引。
  const shuoshuoUrl = (item) => siteAbsoluteUrl(`/shuoshuo/${item.id}`);
  const shuoshuoXml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  ${shuoshuo
    .map(
      (item) => `
  <url>
    <loc>${xmlEscape(shuoshuoUrl(item))}</loc>
    <lastmod>${item.date}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.5</priority>
  </url>`,
    )
    .join('')}
</urlset>`;
  fs.writeFileSync(path.join(PUBLIC_DIR, 'sitemap-shuoshuo.xml'), shuoshuoXml);

  // 5. sitemap index：聚合四个子 sitemap，robots.txt 指向该 index。
  const latestShuoShuoDate = shuoshuo.length > 0 ? shuoshuo[0].date : latestPostDate;
  const sitemapIndexXml = `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <sitemap>
    <loc>${xmlEscape(siteAbsoluteUrl('/sitemap-pages.xml'))}</loc>
    <lastmod>${latestPostDate}</lastmod>
  </sitemap>
  <sitemap>
    <loc>${xmlEscape(siteAbsoluteUrl('/sitemap-posts.xml'))}</loc>
    <lastmod>${latestPostDate}</lastmod>
  </sitemap>
  <sitemap>
    <loc>${xmlEscape(siteAbsoluteUrl('/sitemap-images.xml'))}</loc>
    <lastmod>${latestPostDate}</lastmod>
  </sitemap>
  <sitemap>
    <loc>${xmlEscape(siteAbsoluteUrl('/sitemap-shuoshuo.xml'))}</loc>
    <lastmod>${latestShuoShuoDate}</lastmod>
  </sitemap>
</sitemapindex>`;
  fs.writeFileSync(path.join(PUBLIC_DIR, 'sitemap-index.xml'), sitemapIndexXml);

  const robotsTxt = [
    'User-agent: *',
    'Allow: /',
    'Disallow: /api/',
    'Disallow: /generated/',
    'Disallow: /sw.js',
    'Disallow: /workbox-*.js',
    'Disallow: /offline.html',
    '',
    // AI 智能体（Agent browsing）：站点为静态 SSR 页面，正文可直接抓取，全部放行。
    'User-agent: GPTBot',
    'Allow: /',
    '',
    'User-agent: ClaudeBot',
    'Allow: /',
    '',
    'User-agent: Google-Extended',
    'Allow: /',
    '',
    'User-agent: CCBot',
    'Allow: /',
    '',
    'User-agent: PerplexityBot',
    'Allow: /',
    '',
    'User-agent: Amazonbot',
    'Allow: /',
    '',
    'User-agent: Applebot-Extended',
    'Allow: /',
    '',
    'User-agent: Meta-ExternalAgent',
    'Allow: /',
    '',
    'User-agent: cohere-ai',
    'Allow: /',
    '',
    // OpenAI 搜索/聊天助手（ChatGPT 联网搜索、SearchGPT）与 xAI Grok 搜索。
    'User-agent: OAI-SearchBot',
    'Allow: /',
    '',
    'User-agent: ChatGPT-User',
    'Allow: /',
    '',
    'User-agent: GrokBot',
    'Allow: /',
    '',
    // 字节跳动/抖音系（豆包、抖音搜索）的通用爬虫。
    'User-agent: Bytespider',
    'Allow: /',
    '',
    `Sitemap: ${siteAbsoluteUrl('/sitemap-index.xml')}`,
    '',
  ].join('\r\n');
  fs.writeFileSync(path.join(PUBLIC_DIR, 'robots.txt'), robotsTxt);
  logger.step(
    'Generated sitemaps',
    `pages=${staticPages.length} posts=${posts.length} shuoshuo=${shuoshuo.length} imageSitemap=1 index=1`,
  );
};

const generateRss = () => {
  const rssContent = buildRssFeed(postsWithSearch, {
    siteUrl: SITE_URL,
    basePath: BASE_PATH,
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    author: AUTHOR_NAME,
  });

  fs.writeFileSync(path.join(PUBLIC_DIR, 'feed.xml'), rssContent);
  logger.step('Generated feed.xml', `items=${postsWithSearch.length}`);
};

/**
 * llms.txt：面向 AI 智能体/LLM 的站点导航文件（https://llmstxt.org）。
 * 提供站点简介与文章链接列表，便于智能体浏览时快速定位内容。
 */
const generateLlmsTxt = () => {
  // Markdown 链接文本转义：标题/片段含 [ ] ( ) 时不转义会被提前闭合或嵌套
  // （如「[译] 深入理解 React」），llmstxt 解析器得到损坏的链接。
  const escapeLinkText = (text) => text.replace(/[\]()]/g, (char) => `\\${char}`).replace(/\[/g, '\\[');
  const sortedPosts = [...posts].sort((a, b) => (a.date === b.date ? 0 : a.date > b.date ? -1 : 1));
  const postLines = sortedPosts.map(
    (post) =>
      `- [${escapeLinkText(post.title)}](${siteAbsoluteUrl(`/post/${post.id}`)}): ${post.excerpt.replace(/\n+/g, ' ').trim()}`,
  );
  // 说说为短动态，直接把剥离后的纯文本附在链接后，便于智能体直接读取内容。
  const shuoshuoLines = shuoshuo.map((item) => {
    const snippet = markdownToSearchText(item.content).slice(0, 60) || '图片/纯动态';
    return `- [说说：${escapeLinkText(snippet)}](${siteAbsoluteUrl(`/shuoshuo/${item.id}`)}): ${snippet}`;
  });

  const content = [
    `# ${SITE_TITLE}`,
    '',
    `> ${SITE_DESCRIPTION}`,
    '',
    `> 作者：${AUTHOR_NAME}`,
    `> 语言：zh-CN`,
    '',
    '## 站内页面',
    '',
    `- [首页](${siteAbsoluteUrl('/')})`,
    `- [归档](${siteAbsoluteUrl('/archive')})`,
    `- [标签](${siteAbsoluteUrl('/tags')})`,
    `- [统计](${siteAbsoluteUrl('/stats')})`,
    `- [友链](${siteAbsoluteUrl('/friends')})`,
    `- [说说](${siteAbsoluteUrl('/shuoshuo')})`,
    `- [关于](${siteAbsoluteUrl('/about')})`,
    `- [赞助](${siteAbsoluteUrl('/sponsor')})`,
    `- [RSS 订阅](${siteAbsoluteUrl('/feed.xml')})`,
    '',
    '## 文章',
    '',
    ...postLines,
    '',
    '## 说说',
    '',
    ...shuoshuoLines,
    '',
    '## 全文版',
    '',
    `Full-text version: ${siteAbsoluteUrl('/llms-full.txt')}`,
    '',
  ].join('\n');

  fs.writeFileSync(path.join(PUBLIC_DIR, 'llms.txt'), content);
  logger.step('Generated llms.txt', `posts=${posts.length} shuoshuo=${shuoshuo.length}`);
};

/**
 * llms-full.txt：llms.txt 规范的可选全文扩展（https://llmstxt.org）。
 * 面向 LLM 的全站文章全文版：站点标题 + 文章目录（链接）+ 每篇全文
 * （篇名 H1 + Markdown 正文，篇间以 --- 分隔）。
 *
 * 数据源为 buildPost 已剥离 front matter 的 content（与 posts.json / posts-search.json
 * 同一过滤口径：draft 已剔除、正文为空时跳过并记录日志），排序与 llms.txt 一致（新 → 旧）。
 */
const generateLlmsFullTxt = () => {
  const sortedPosts = [...postsWithSearch].sort((a, b) => (a.date === b.date ? 0 : a.date > b.date ? -1 : 1));
  const tocLines = sortedPosts.map((post) => `- [${post.title}](${siteAbsoluteUrl(`/post/${post.id}`)})`);
  const sections = [];
  for (const post of sortedPosts) {
    // 规范化行尾（源文件可能为 CRLF），保证全文文件为纯 LF 换行。
    const body = String(post.content || '')
      .replace(/\r\n?/g, '\n')
      .trim();
    if (!body) {
      logger.warn('Skip post without body in llms-full.txt', `id=${post.id}`);
      continue;
    }
    // 每篇以篇名 H1 开头（正文自带标题保留为内容的一部分），保证智能体能一眼识别文章边界。
    sections.push(`# ${post.title}

${body}`);
  }

  const content = [
    `# ${SITE_TITLE} - 全文版`,
    '',
    `> ${SITE_DESCRIPTION}`,
    '',
    '## 文章目录',
    '',
    ...tocLines,
    '',
    '---',
    '',
    sections.join('\n\n---\n\n'),
    '',
  ].join('\n');

  fs.writeFileSync(path.join(PUBLIC_DIR, 'llms-full.txt'), content);
  const sizeKiB = (Buffer.byteLength(content, 'utf8') / 1024).toFixed(1);
  logger.step('Generated llms-full.txt', `posts=${sections.length} size=${sizeKiB}KiB`);
};

try {
  generateSitemap();
  generateRss();
  generateLlmsTxt();
  generateLlmsFullTxt();
} catch (error) {
  // 生成阶段的 I/O 或序列化失败（磁盘满、权限、畸形配置）：
  // 结构化记录后以非零码退出，阻止带缺文件件的产物继续构建。
  logger.error('Output generation failed', error instanceof Error ? error.stack : String(error));
  process.exitCode = 1;
}

if (process.exitCode) {
  logger.summary({
    posts: posts.length,
    friends: friends.length,
    shuoshuo: shuoshuo.length,
    outputs: 7,
    siteUrl: SITE_URL,
    status: 'failed',
  });
} else {
  logger.summary({
    posts: posts.length,
    friends: friends.length,
    shuoshuo: shuoshuo.length,
    outputs: 7,
    siteUrl: SITE_URL,
  });
}
