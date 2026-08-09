import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import matter from 'gray-matter';
import { fileURLToPath } from 'url';
import { loadSiteConfig } from './site-config-loader.mjs';
import { createBuildLogger } from './build-logger.mjs';
import { normalizeLocalImageUrl as resolveImageAsset } from './image-assets-utils.mjs';
import { getBasePath, withBasePath } from './base-path.mjs';
import {
  DEFAULT_STATIC_ROUTES,
  findDuplicatePostIds,
  parseMarkdownImages,
  validatePostContent
} from './post-content-validator.mjs';
import { extractMarkdownHeadings } from '../src/utils/headings-core.mjs';
import { buildRssFeed } from './feed-generator.mjs';

const logger = createBuildLogger('gen:data');
logger.start('Generate site data');

const siteConfig = loadSiteConfig({ logger });
const SITE_URL = siteConfig.url;
const BASE_PATH = getBasePath();
const SITE_TITLE = siteConfig.title;
const SITE_DESCRIPTION = siteConfig.description;
const AUTHOR_NAME = siteConfig.author.name;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const POSTS_DIR = path.join(__dirname, '../posts');
const POSTS_IMG_DIR = path.join(__dirname, '../posts-img');
const FRIENDS_DIR = path.join(__dirname, '../friends');
const OUTPUT_JSON_DIR = path.join(__dirname, '../generated');
const PUBLIC_DIR = path.join(__dirname, '../public');
const IMAGE_MANIFEST_FILE = path.join(OUTPUT_JSON_DIR, 'image-assets.json');
const imageManifest = fs.existsSync(IMAGE_MANIFEST_FILE)
  ? JSON.parse(fs.readFileSync(IMAGE_MANIFEST_FILE, 'utf-8'))
  : { assets: {} };

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

const xmlEscape = (value) => String(value ?? '')
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

// 文章正文与封面均使用 /posts-img/... 绝对路径（以站点根为基准）。
const toPostsImgPath = (value) => {
  const clean = String(value).replace(/\\/g, '/').replace(/^\/+/, '').replace(/^(\.\.\/)+/g, '').replace(/^\.\/+/, '');
  return `/posts-img/${clean.startsWith('posts-img/') ? clean.slice('posts-img/'.length) : clean}`;
};

const toPublicPath = (value) => withBasePath(value, BASE_PATH);

// coverImage 统一解析为站点可访问的 /posts-img/... 绝对路径
const normalizeCoverImage = (value) => {
  if (!value) {
    return undefined;
  }
  const raw = String(value);
  // 保留外部协议字符串；封面校验阶段仅允许 HTTP(S) URL。
  if (/^[a-z][a-z0-9+.-]*:/i.test(raw)) {
    return raw;
  }
  return toPostsImgPath(raw);
};

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

const countWords = (markdown) => {
  const plainText = markdownToSearchText(markdown);
  const hanCharacters = (plainText.match(/[\u4e00-\u9fff]/g) || []).length;
  const latinWords = (plainText.replace(/[\u4e00-\u9fff]/g, ' ').match(/[A-Za-z0-9_]+/g) || []).length;
  return hanCharacters + latinWords;
};

const countImages = (markdown) => parseMarkdownImages(markdown).length;

const readImageDimensions = (filePath) => {
  try {
    const buffer = fs.readFileSync(filePath);
    const extension = path.extname(filePath).toLowerCase();

    if (extension === '.png' && buffer.length >= 24 && buffer.toString('ascii', 1, 4) === 'PNG') {
      return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
    }

    if (extension === '.gif' && buffer.length >= 10 && buffer.toString('ascii', 0, 3) === 'GIF') {
      return { width: buffer.readUInt16LE(6), height: buffer.readUInt16LE(8) };
    }

    if (extension === '.webp' && buffer.length >= 20 && buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WEBP') {
      let chunkOffset = 12;

      while (chunkOffset + 8 <= buffer.length) {
        const chunk = buffer.toString('ascii', chunkOffset, chunkOffset + 4);
        const chunkSize = buffer.readUInt32LE(chunkOffset + 4);
        const dataOffset = chunkOffset + 8;
        const dataEnd = dataOffset + chunkSize;

        if (dataEnd > buffer.length) {
          break;
        }

        if (chunk === 'VP8X' && chunkSize >= 10) {
          return {
            width: 1 + buffer.readUIntLE(dataOffset + 4, 3),
            height: 1 + buffer.readUIntLE(dataOffset + 7, 3)
          };
        }

        if (
          chunk === 'VP8 '
          && chunkSize >= 10
          && buffer[dataOffset + 3] === 0x9d
          && buffer[dataOffset + 4] === 0x01
          && buffer[dataOffset + 5] === 0x2a
        ) {
          return {
            width: buffer.readUInt16LE(dataOffset + 6) & 0x3fff,
            height: buffer.readUInt16LE(dataOffset + 8) & 0x3fff
          };
        }

        if (chunk === 'VP8L' && chunkSize >= 5 && buffer[dataOffset] === 0x2f) {
          const bits = buffer.readUInt32LE(dataOffset + 1);
          return { width: (bits & 0x3fff) + 1, height: ((bits >> 14) & 0x3fff) + 1 };
        }

        chunkOffset = dataEnd + (chunkSize % 2);
      }
    }

    if (extension === '.jpg' || extension === '.jpeg') {
      if (buffer.length < 4 || buffer.readUInt16BE(0) !== 0xffd8) return undefined;
      let offset = 2;
      while (offset + 9 < buffer.length) {
        if (buffer[offset] !== 0xff) {
          offset += 1;
          continue;
        }
        const marker = buffer[offset + 1];
        offset += 2;
        if (marker === 0xd8 || marker === 0xd9) continue;
        if (offset + 2 > buffer.length) break;
        const segmentLength = buffer.readUInt16BE(offset);
        if (segmentLength < 2 || offset + segmentLength > buffer.length) break;
        const isStartOfFrame = marker >= 0xc0 && marker <= 0xc3
          || marker >= 0xc5 && marker <= 0xc7
          || marker >= 0xc9 && marker <= 0xcb
          || marker >= 0xcd && marker <= 0xcf;
        if (isStartOfFrame && segmentLength >= 7) {
          return { width: buffer.readUInt16BE(offset + 5), height: buffer.readUInt16BE(offset + 3) };
        }
        offset += segmentLength;
      }
    }
  } catch {
    return undefined;
  }

  return undefined;
};

const normalizeLocalImageUrl = (value, postId) => {
  const resolved = resolveImageAsset(value, postId, POSTS_IMG_DIR);
  if (!resolved || resolved.external || resolved.error || !resolved.filePath) return undefined;
  const dimensions = imageManifest.assets?.[resolved.url]?.width
    ? { width: imageManifest.assets[resolved.url].width, height: imageManifest.assets[resolved.url].height }
    : readImageDimensions(resolved.filePath);
  return { url: resolved.url, dimensions };
};

const extractImageDimensions = (markdown, postId) => {
  const dimensions = {};
  parseMarkdownImages(markdown).forEach(({ target }) => {
    const resolved = normalizeLocalImageUrl(target, postId);
    if (resolved?.dimensions?.width && resolved.dimensions.height) {
      dimensions[resolved.url] = resolved.dimensions;
    }
  });
  return Object.keys(dimensions).length > 0 ? dimensions : undefined;
};

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
    imageCount: post.imageCount || 0
  });
  const countBy = (items, getKey) => Array.from(items.reduce((map, item) => {
    const key = getKey(item);
    if (key) {
      map.set(key, (map.get(key) || 0) + 1);
    }
    return map;
  }, new Map()).entries())
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, 'zh-CN'));
  const categoryStats = countBy(postsWithSearch, (post) => post.category);
  const tagStats = countBy(postsWithSearch.flatMap((post) => post.tags || []), (tag) => tag).slice(0, 12);
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
        topImageCountPosts
      },
      null,
      2
    )
  );

  logger.step('Generated site-stats.json', `posts=${totalPosts} words=${totalWords} categories=${totalCategories} tags=${totalTags} images=${totalImages}`);
};

const calculateReadTime = (markdown) => {
  const plainText = markdownToSearchText(markdown);
  const hanCharacters = (plainText.match(/[\u4e00-\u9fff]/g) || []).length;
  const latinWords = (plainText.replace(/[\u4e00-\u9fff]/g, ' ').match(/[A-Za-z0-9_]+/g) || []).length;
  const readingUnits = hanCharacters + latinWords;
  const minutes = Math.max(1, Math.ceil(readingUnits / 300));

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
    url: typeof value.url === 'string' && value.url.trim() ? value.url.trim() : undefined
  };
};

const normalizeAuthors = (author, authors) => {
  const rawAuthors = [
    ...(Array.isArray(authors) ? authors : authors ? [authors] : []),
    ...(author ? [author] : [])
  ];

  const normalizedAuthors = rawAuthors
    .map((entry) => normalizeAuthor(entry))
    .filter(Boolean);

  return normalizedAuthors.length > 0
    ? normalizedAuthors.filter((entry, index, collection) => collection.findIndex((candidate) => candidate.name === entry.name) === index)
    : undefined;
};

const formatFrontmatterDate = (value) => {
  if (!value) {
    return undefined;
  }

  if (value instanceof Date) {
    const year = value.getFullYear();
    const month = String(value.getMonth() + 1).padStart(2, '0');
    const day = String(value.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  return String(value);
};

const CONTENT_CONFIG_FILE = path.join(__dirname, '../config/content.config.json');
const contentConfig = JSON.parse(fs.readFileSync(CONTENT_CONFIG_FILE, 'utf-8'));
const POST_CATEGORIES = Array.isArray(contentConfig.postCategories) && contentConfig.postCategories.length > 0
  ? contentConfig.postCategories
  : ['其他'];
const FALLBACK_CATEGORY = typeof contentConfig.fallbackCategory === 'string' && contentConfig.fallbackCategory.trim()
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
    typeof id === 'string'
    && (
      id !== id.trim()
      || /\s|[\\/?#%"'<>]/.test(id)
      || id === '.'
      || id === '..'
      || id.includes('/./')
      || id.includes('/../')
    )
  ) {
    errors.push(`id "${id}" contains characters that are unsafe in a post URL`);
  }
  if (typeof data.category === 'string' && data.category.trim() && !POST_CATEGORIES.includes(data.category.trim())) {
    errors.push(`category must be one of: ${POST_CATEGORIES.join(', ')}`);
  }
  if (data.featured !== undefined && typeof data.featured !== 'boolean') {
    errors.push('featured must be a boolean when provided');
  }
  if (data['featured-top'] !== undefined && (
    typeof data['featured-top'] !== 'number' || !Number.isFinite(data['featured-top'])
  )) {
    errors.push('featured-top must be a finite number when provided');
  }
  if (data.series !== undefined && typeof data.series !== 'boolean') {
    errors.push('series must be a boolean when provided');
  }
  if (data.series === true) {
    if (typeof data['series-name'] !== 'string' || data['series-name'].trim() === '') {
      errors.push('series-name must be a non-empty string when series is true');
    }
    if (typeof data['series-order'] !== 'number' || !Number.isInteger(data['series-order']) || data['series-order'] < 1) {
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

const postRecords = files.map((filename) => {
  const filePath = path.join(POSTS_DIR, filename);
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

  const { draft, readTime, author, authors, updatedAt, coverImage, top: _legacyTop, series: rawSeries, 'series-name': rawSeriesName, 'series-order': rawSeriesOrder, ...restData } = data;
  const id = typeof data.id === 'string' ? data.id : '';
  const formattedDate = formatFrontmatterDate(data.date);
  const formattedUpdatedAt = formatFrontmatterDate(updatedAt);
  const frontMatterError = parseError || validatePostFrontmatter(filename, data, formattedDate, formattedUpdatedAt, id);
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
    restData,
    draft: draft === true,
    id,
    formattedDate,
    formattedUpdatedAt,
    headingIds,
    contentStartLine,
    errors: frontMatterError ? [frontMatterError] : []
  };
});

const allPostIndex = new Map();
const publishedPostIndex = new Map();
const validationErrors = postRecords.flatMap((record) => record.errors);
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
  const {
    filename, content, data, restData, id, formattedDate, formattedUpdatedAt, draft
  } = record;
  const normalizedAuthors = normalizeAuthors(data.author, data.authors);
  const category = normalizeCategory(data.category);
  const tags = normalizeTagsStrict(data.tags);
  const normalizedCoverImage = normalizeCoverImage(data.coverImage);
  const coverDimensions = normalizedCoverImage && !/^[a-z][a-z0-9+.-]*:/i.test(normalizedCoverImage)
    ? normalizeLocalImageUrl(normalizedCoverImage, id)?.dimensions
    : undefined;
  const imageDimensions = extractImageDimensions(content, id);
  const isSeries = data.series === true;
  const seriesName = isSeries && typeof data['series-name'] === 'string' ? data['series-name'].trim() : undefined;
  const seriesOrder = isSeries && Number.isInteger(data['series-order']) ? data['series-order'] : undefined;

  if (!formattedDate) {
    validationErrors.push(`Invalid front matter in ${filename}: date must use YYYY-MM-DD format`);
  }
  return draft ? null : {
    ...restData,
    ...(isSeries ? { series: true, seriesName, seriesOrder } : {}),
    coverImage: normalizedCoverImage,
    coverWidth: coverDimensions?.width,
    coverHeight: coverDimensions?.height,
    imageDimensions,
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
    searchText: markdownToSearchText(content)
  };
};

postRecords.forEach((record) => {
  validationErrors.push(...validatePostContent(record, {
    filename: record.filename,
    imageRoot: POSTS_IMG_DIR,
    allPosts: allPostIndex,
    publishedPosts: publishedPostIndex,
    staticRoutes: DEFAULT_STATIC_ROUTES,
    skipFrontMatter: true,
    lineOffset: record.contentStartLine,
    getImageDimensions: (url, filePath) => {
      const asset = imageManifest.assets?.[url];
      if (asset?.width && asset?.height) {
        return { width: asset.width, height: asset.height };
      }
      return readImageDimensions(filePath);
    }
  }));
});

const seriesOrders = new Map();
postRecords.forEach((record) => {
  if (record.draft || record.data.series !== true || !record.id || !record.data['series-name'] || !Number.isInteger(record.data['series-order'])) {
    return;
  }

  const key = record.data['series-name'].trim();
  const order = record.data['series-order'];
  const seenOrders = seriesOrders.get(key) ?? new Map();
  const previous = seenOrders.get(order);
  if (previous) {
    validationErrors.push(`Duplicate series-order ${order} for series "${key}" in ${record.filename}; already used by ${previous}.`);
  } else {
    seenOrders.set(order, record.filename);
    seriesOrders.set(key, seenOrders);
  }
});

if (validationErrors.length > 0) {
  throw new Error(validationErrors.join('\n'));
}

const postsWithSearch = postRecords.map(buildPost).filter(Boolean)
  .sort((a, b) => new Date(b.date) - new Date(a.date) || a.id.localeCompare(b.id));
const posts = postsWithSearch.map(({ searchText, content, ...post }) => post);

generateSiteStats(postsWithSearch);
fs.writeFileSync(path.join(OUTPUT_JSON_DIR, 'posts.json'), JSON.stringify(posts, null, 2));
fs.writeFileSync(path.join(OUTPUT_JSON_DIR, 'posts-search.json'), JSON.stringify(postsWithSearch.map(({ content, ...rest }) => rest), null, 2));
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
      (field) => typeof data[field] !== 'string' || data[field].trim() === ''
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
        url: friendUrl
      }
    ];
  } catch (error) {
    logger.warn('Skip invalid friend file', `${filename}: ${error.message}`);
    return [];
  }
});

fs.writeFileSync(path.join(OUTPUT_JSON_DIR, 'friends.json'), JSON.stringify(friends, null, 2));
logger.step('Generated friends.json', `friends=${friends.length} sourceFiles=${friendFiles.length}`);

const siteAbsoluteUrl = (route = '/') => new URL(toPublicPath(route), `${SITE_URL}/`).toString();

const generateSitemap = () => {
  const today = new Date().toISOString().split('T')[0];

  const staticPages = [
    { path: '', changefreq: 'daily', priority: '1.0', lastmod: today },
    { path: 'archive', changefreq: 'daily', priority: '0.9', lastmod: today },
    { path: 'tags', changefreq: 'weekly', priority: '0.8', lastmod: today },
    { path: 'stats', changefreq: 'weekly', priority: '0.6', lastmod: today },
    { path: 'friends', changefreq: 'weekly', priority: '0.7', lastmod: today },
    { path: 'about', changefreq: 'monthly', priority: '0.7', lastmod: today },
    { path: 'cover', changefreq: 'monthly', priority: '0.5', lastmod: today },
    { path: 'watermark', changefreq: 'monthly', priority: '0.5', lastmod: today },
    { path: 'sponsor', changefreq: 'monthly', priority: '0.5', lastmod: today }
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
  </url>`
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
  </url>`
    )
    .join('')}
</urlset>`;
  fs.writeFileSync(path.join(PUBLIC_DIR, 'sitemap-posts.xml'), postsXml);

  // 3. 图片 sitemap：收录文章封面与正文图片，仅限本地资源（/posts-img、/generated-images）。
  //    外部图床/URL 无法确认可抓取，不进入 image sitemap。
  const isLocalImage = (url) => /^\/?(?:posts-img|generated-images)\//.test(String(url));
  const normalizeImageUrl = (url) => {
    const clean = String(url).replace(/^\/+/, '');
    return siteAbsoluteUrl(`/${clean.split(/[?#]/, 1)[0]}`);
  };
  const imagesXml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">
  ${posts
    .map((post) => {
      // 封面与正文图按 URL 去重：部分文章正文会再次引用封面图，
      // 避免 image sitemap 中出现重复条目。
      const seen = new Set();
      const images = [];
      const addImage = (imageUrl) => {
        const normalized = normalizeImageUrl(imageUrl);
        if (isLocalImage(imageUrl) && !seen.has(normalized)) {
          seen.add(normalized);
          images.push({ loc: normalized, title: post.title });
        }
      };
      if (post.coverImage) {
        addImage(post.coverImage);
      }
      Object.keys(post.imageDimensions || {}).forEach(addImage);
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
    </image:image>`
      )
      .join('')}
  </url>`;
    })
    .join('')}
</urlset>`;
  fs.writeFileSync(path.join(PUBLIC_DIR, 'sitemap-images.xml'), imagesXml);

  // 4. sitemap index：聚合三个子 sitemap，robots.txt 指向该 index。
  const sitemapIndexXml = `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <sitemap>
    <loc>${xmlEscape(siteAbsoluteUrl('/sitemap-pages.xml'))}</loc>
    <lastmod>${today}</lastmod>
  </sitemap>
  <sitemap>
    <loc>${xmlEscape(siteAbsoluteUrl('/sitemap-posts.xml'))}</loc>
    <lastmod>${today}</lastmod>
  </sitemap>
  <sitemap>
    <loc>${xmlEscape(siteAbsoluteUrl('/sitemap-images.xml'))}</loc>
    <lastmod>${today}</lastmod>
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
    `Sitemap: ${siteAbsoluteUrl('/sitemap-index.xml')}`,
    ''
  ].join('\r\n');
  fs.writeFileSync(path.join(PUBLIC_DIR, 'robots.txt'), robotsTxt);
  logger.step('Generated sitemaps', `pages=${staticPages.length} posts=${posts.length} imageSitemap=1 index=1`);
};

const generateRss = () => {
  const rssContent = buildRssFeed(postsWithSearch, {
    siteUrl: SITE_URL,
    basePath: BASE_PATH,
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    author: AUTHOR_NAME
  });

  fs.writeFileSync(path.join(PUBLIC_DIR, 'feed.xml'), rssContent);
  logger.step('Generated feed.xml', `items=${postsWithSearch.length}`);
};

/**
 * llms.txt：面向 AI 智能体/LLM 的站点导航文件（https://llmstxt.org）。
 * 提供站点简介与文章链接列表，便于智能体浏览时快速定位内容。
 */
const generateLlmsTxt = () => {
  const sortedPosts = [...posts].sort((a, b) => (a.date > b.date ? -1 : 1));
  const postLines = sortedPosts.map(
    (post) => `- [${post.title}](${siteAbsoluteUrl(`/post/${post.id}`)}): ${post.excerpt.replace(/\n+/g, ' ').trim()}`
  );

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
    `- [关于](${siteAbsoluteUrl('/about')})`,
    `- [赞助](${siteAbsoluteUrl('/sponsor')})`,
    `- [RSS 订阅](${siteAbsoluteUrl('/feed.xml')})`,
    '',
    '## 文章',
    '',
    ...postLines,
    ''
  ].join('\n');

  fs.writeFileSync(path.join(PUBLIC_DIR, 'llms.txt'), content);
  logger.step('Generated llms.txt', `posts=${posts.length}`);
};

generateSitemap();
generateRss();
generateLlmsTxt();

logger.summary({
  posts: posts.length,
  friends: friends.length,
  outputs: 6,
  siteUrl: SITE_URL
});
