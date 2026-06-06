import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import matter from 'gray-matter';
import { fileURLToPath } from 'url';
import { loadSiteConfig } from './site-config-loader.mjs';

const siteConfig = loadSiteConfig();
const SITE_URL = siteConfig.url;
const SITE_TITLE = siteConfig.title;
const SITE_DESCRIPTION = siteConfig.description;
const AUTHOR_NAME = siteConfig.author.name;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const POSTS_DIR = path.join(__dirname, '../posts');
const FRIENDS_DIR = path.join(__dirname, '../friends');
const OUTPUT_JSON_DIR = path.join(__dirname, '../generated');
const PUBLIC_DIR = path.join(__dirname, '../public');

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

const assertValidUrl = (value, label) => {
  try {
    new URL(value);
  } catch {
    throw new Error(`${label} must be a valid URL: ${value}`);
  }
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

const countImages = (markdown) => (markdown.match(/!\[[^\]]*\]\([^)]+\)/g) || []).length;

const normalizeTags = (value) => {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((tag) => String(tag).trim())
    .filter(Boolean);
};

const generateSiteStats = (postsWithSearch) => {
  const totalPosts = postsWithSearch.length;
  const totalWords = postsWithSearch.reduce((sum, post) => sum + (post.wordCount || 0), 0);
  const totalCategories = new Set(postsWithSearch.map((post) => post.category)).size;
  const totalTags = new Set(postsWithSearch.flatMap((post) => post.tags || [])).size;
  const totalImages = postsWithSearch.reduce((sum, post) => sum + (post.imageCount || 0), 0);

  fs.writeFileSync(
    path.join(OUTPUT_JSON_DIR, 'site-stats.json'),
    JSON.stringify(
      {
        totalPosts,
        totalWords,
        totalCategories,
        totalTags,
        totalImages
      },
      null,
      2
    )
  );

  console.log('JSON generated: site stats');
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

const POST_CATEGORIES = ['教程', '技术', '随笔', '分享', '其他'];

const normalizeCategory = (value) => {
  if (typeof value !== 'string') {
    return '其他';
  }

  const category = value.trim();
  if (!category) {
    return '其他';
  }

  return POST_CATEGORIES.includes(category) ? category : '其他';
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

  if (data.tags !== undefined && !Array.isArray(data.tags)) {
    errors.push('tags must be an array when provided');
  }

  if (typeof data.category === 'string' && data.category.trim() && !POST_CATEGORIES.includes(data.category.trim())) {
    errors.push(`category must be one of: ${POST_CATEGORIES.join(', ')}`);
  }

  if (errors.length > 0) {
    throw new Error(`Invalid front matter in ${filename}: ${errors.join('; ')}`);
  }
};

const usedPostIds = new Set();

const files = fs.readdirSync(POSTS_DIR).filter((file) => file.endsWith('.md'));
const postsWithSearch = files
  .map((filename) => {
    const filePath = path.join(POSTS_DIR, filename);
    const fileContent = fs.readFileSync(filePath, 'utf-8');
    const { data, content } = matter(fileContent);
    const { draft, readTime, author, authors, updatedAt, ...restData } = data;

    const id = String(data.id || filename.replace(/\.md$/, '')).trim();

    const formattedDate = formatFrontmatterDate(data.date);
    const formattedUpdatedAt = formatFrontmatterDate(updatedAt);
    validatePostFrontmatter(filename, data, formattedDate, formattedUpdatedAt, id);

    if (usedPostIds.has(id)) {
      throw new Error(`Duplicate post id "${id}" found in ${filename}.`);
    }
    usedPostIds.add(id);

    const normalizedAuthors = normalizeAuthors(author, authors);
    const category = normalizeCategory(data.category);
    const tags = normalizeTags(data.tags);
    const wordCount = countWords(content);
    const imageCount = countImages(content);

    if (!formattedDate) {
      throw new Error(`Post "${filename}" is missing a valid date field.`);
    }

    if (draft === true) {
      return null;
    }

    return {
      ...restData,
      category,
      tags,
      date: formattedDate,
      updatedAt: formattedUpdatedAt,
      authors: normalizedAuthors,
      id,
      filePath: `/posts/${filename}`,
      readTime: calculateReadTime(content),
      wordCount,
      imageCount,
      content,
      searchText: markdownToSearchText(content)
    };
  })
  .filter(Boolean)
  .sort((a, b) => new Date(b.date) - new Date(a.date));

const posts = postsWithSearch.map(({ searchText, content, ...post }) => post);

generateSiteStats(postsWithSearch);

fs.writeFileSync(path.join(OUTPUT_JSON_DIR, 'posts.json'), JSON.stringify(posts, null, 2));
fs.writeFileSync(path.join(OUTPUT_JSON_DIR, 'posts-search.json'), JSON.stringify(postsWithSearch.map(({ content, ...rest }) => rest), null, 2));
console.log(`JSON generated: ${posts.length} posts`);

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
      console.warn(`Skip invalid friend file ${filename}: missing ${missingFields.join(', ')}`);
      return [];
    }

    const friendUrl = data.url.trim();
    assertValidUrl(friendUrl, `friend ${filename} url`);

    if (seenFriendUrls.has(friendUrl)) {
      console.warn(`Skip duplicate friend file ${filename}: url ${friendUrl}`);
      return [];
    }
    seenFriendUrls.add(friendUrl);

    return [
      {
        name: data.name.trim(),
        description: data.description.trim(),
        avatar: data.avatar.trim(),
        url: friendUrl
      }
    ];
  } catch (error) {
    console.warn(`Skip invalid friend file ${filename}: ${error.message}`);
    return [];
  }
});

fs.writeFileSync(path.join(OUTPUT_JSON_DIR, 'friends.json'), JSON.stringify(friends, null, 2));
console.log(`JSON generated: ${friends.length} friends`);

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
    { path: 'sponsor', changefreq: 'monthly', priority: '0.5', lastmod: today }
  ];

  const sitemapContent = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  ${staticPages
    .map(
      (page) => `
  <url>
    <loc>${xmlEscape(new URL(page.path, `${SITE_URL}/`).toString())}</loc>
    <lastmod>${page.lastmod}</lastmod>
    <changefreq>${page.changefreq}</changefreq>
    <priority>${page.priority}</priority>
  </url>`
    )
    .join('')}
  ${posts
    .map(
      (post) => `
  <url>
    <loc>${xmlEscape(`${SITE_URL}/post/${post.id}`)}</loc>
    <lastmod>${new Date(post.updatedAt || post.date).toISOString().split('T')[0]}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.8</priority>
  </url>`
    )
    .join('')}
</urlset>`;

  fs.writeFileSync(path.join(PUBLIC_DIR, 'sitemap.xml'), sitemapContent);
  console.log('Sitemap generated');
};

const generateRss = () => {
  const latestUpdate = postsWithSearch[0] ? new Date(postsWithSearch.reduce((latest, post) => {
    const current = new Date(post.updatedAt || post.date);
    return current > latest ? current : latest;
  }, new Date(postsWithSearch[0].updatedAt || postsWithSearch[0].date))) : new Date();

  // 简单的 Markdown 转 HTML（用于 RSS 全文内容）
  const simpleMarkdownToHtml = (md) => {
    return md
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/^### (.+)$/gm, '<h3>$1</h3>')
      .replace(/^## (.+)$/gm, '<h2>$1</h2>')
      .replace(/^# (.+)$/gm, '<h1>$1</h1>')
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.+?)\*/g, '<em>$1</em>')
      .replace(/`(.+?)`/g, '<code>$1</code>')
      .replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img alt="$1" src="$2" />')
      .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>')
      .replace(/^[-*] (.+)$/gm, '<li>$1</li>')
      .replace(/(<li>.*<\/li>\n?)+/g, '<ul>$&</ul>')
      .replace(/\n{2,}/g, '</p><p>')
      .replace(/^(?!<[hluoi])/gm, '<p>')
      .replace(/(?<![>])$/gm, '</p>')
      .replace(/<p><\/p>/g, '');
  };

  const rssContent = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:content="http://purl.org/rss/1.0/modules/content/">
  <channel>
    <title>${xmlEscape(SITE_TITLE)}</title>
    <link>${xmlEscape(SITE_URL)}</link>
    <description>${xmlEscape(SITE_DESCRIPTION)}</description>
    <language>zh-CN</language>
    <lastBuildDate>${latestUpdate.toUTCString()}</lastBuildDate>
    <atom:link href="${xmlEscape(`${SITE_URL}/feed.xml`)}" rel="self" type="application/rss+xml" />
    ${postsWithSearch
      .map(
        (post) => `
    <item>
      <title><![CDATA[${post.title}]]></title>
      <link>${xmlEscape(`${SITE_URL}/post/${post.id}`)}</link>
      <guid isPermaLink="true">${xmlEscape(`${SITE_URL}/post/${post.id}`)}</guid>
      <description><![CDATA[${post.excerpt}]]></description>
      <content:encoded><![CDATA[<article>${simpleMarkdownToHtml(post.content || '')}</article>]]></content:encoded>
      <pubDate>${new Date(post.date).toUTCString()}</pubDate>
      ${post.updatedAt ? `<atom:updated>${new Date(post.updatedAt).toISOString()}</atom:updated>` : ''}
      <category>${xmlEscape(post.category)}</category>
      ${(post.tags || []).map((tag) => `<category>${xmlEscape(tag)}</category>`).join('\n      ')}
      <author>${xmlEscape(post.authors?.[0]?.name || AUTHOR_NAME)}</author>
    </item>`
      )
      .join('')}
  </channel>
</rss>`;

  fs.writeFileSync(path.join(PUBLIC_DIR, 'feed.xml'), rssContent);
  console.log('RSS feed generated');
};

generateSitemap();
generateRss();
