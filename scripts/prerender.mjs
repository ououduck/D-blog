import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { loadSiteConfig, toAbsoluteUrl } from './site-config-loader.mjs';
import { createBuildLogger } from './build-logger.mjs';

const logger = createBuildLogger('prerender');

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DIST_DIR = path.join(__dirname, '../dist');
const POSTS_FILE = path.join(__dirname, '../generated/posts.json');
const siteConfig = loadSiteConfig({ logger });
const siteTitle = siteConfig.title;
const authorName = siteConfig.author.name;
const SITE_URL = siteConfig.url;
const SITE_SUFFIX = siteTitle;


// Check if dist exists
if (!fs.existsSync(DIST_DIR)) {
  logger.error('dist directory not found', 'Run "vite build" before prerender.');
  process.exit(1);
}

// Read template
const indexHtmlPath = path.join(DIST_DIR, 'index.html');
if (!fs.existsSync(indexHtmlPath)) {
  logger.error('dist/index.html not found');
  process.exit(1);
}
const stripNonCriticalPreloads = (html) => html
  .replace(/\n?\s*<link rel="modulepreload"[^>]+href="\.\/assets\/(?:syntax|katex|markdown|dompurify|mermaid)[^"]+"[^>]*>/g, '')
  .replace(/\n?\s*<link rel="stylesheet"[^>]+href="\.\/assets\/(?:syntax|katex)[^"]+"[^>]*>/g, '');

const template = stripNonCriticalPreloads(fs.readFileSync(indexHtmlPath, 'utf-8'));

// Read posts
if (!fs.existsSync(POSTS_FILE)) {
  logger.error('generated/posts.json not found', 'Run "npm run gen:data" before prerender.');
  process.exit(1);
}
const posts = JSON.parse(fs.readFileSync(POSTS_FILE, 'utf-8'));

const escapeHtmlText = (value) => String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const escapeHtmlAttribute = (value) => escapeHtmlText(value).replace(/"/g, '&quot;').replace(/'/g, '&#39;');
const escapeJsonForHtml = (value) => JSON.stringify(value)
  .replace(/</g, '\\u003c')
  .replace(/>/g, '\\u003e')
  .replace(/&/g, '\\u0026')
  .replace(/\u2028/g, '\\u2028')
  .replace(/\u2029/g, '\\u2029');

const createImagePreload = (imageUrl, imagesizes) => {
  if (!imageUrl) {
    return '';
  }

  const sizesAttr = imagesizes ? ` imagesizes="${escapeHtmlAttribute(imagesizes)}"` : '';
  return `\n    <link rel="preload" as="image" href="${escapeHtmlAttribute(imageUrl)}" fetchpriority="high"${sizesAttr}>`;
};

const createStaticPageMeta = ({ path: pagePath, title, description, schemaType = 'CollectionPage' }) => {
  const pageUrl = new URL(pagePath, `${SITE_URL}/`).toString();
  const image = toAbsoluteUrl(siteConfig.seoImage || siteConfig.logo || '/logo.png', SITE_URL);
  const structuredData = {
    '@context': 'https://schema.org',
    '@type': schemaType,
    name: title,
    description,
    url: pageUrl,
    isPartOf: {
      '@type': 'WebSite',
      name: siteTitle,
      url: SITE_URL
    },
    image
  };

  return `
    <meta property="og:type" content="website">
    <meta property="og:title" content="${escapeHtmlAttribute(title)}">
    <meta property="og:description" content="${escapeHtmlAttribute(description)}">
    <meta property="og:url" content="${escapeHtmlAttribute(pageUrl)}">
    <meta property="og:image" content="${escapeHtmlAttribute(image)}">
    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:title" content="${escapeHtmlAttribute(title)}">
    <meta name="twitter:description" content="${escapeHtmlAttribute(description)}">
    <meta name="twitter:image" content="${escapeHtmlAttribute(image)}">
    <script type="application/ld+json">${escapeJsonForHtml(structuredData)}</script>`;
};

const createHomeMeta = () => {
  const image = toAbsoluteUrl(siteConfig.seoImage || siteConfig.logo || '/logo.png', SITE_URL);
  const websiteData = {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: siteTitle,
    description: siteConfig.description,
    url: SITE_URL,
    image,
    potentialAction: {
      '@type': 'SearchAction',
      target: `${SITE_URL}/?q={search_term_string}`,
      'query-input': 'required name=search_term_string'
    }
  };

  return `
    <meta property="og:type" content="website">
    <meta property="og:title" content="${escapeHtmlAttribute(siteTitle)}">
    <meta property="og:description" content="${escapeHtmlAttribute(siteConfig.description)}">
    <meta property="og:url" content="${escapeHtmlAttribute(SITE_URL)}">
    <meta property="og:image" content="${escapeHtmlAttribute(image)}">
    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:title" content="${escapeHtmlAttribute(siteTitle)}">
    <meta name="twitter:description" content="${escapeHtmlAttribute(siteConfig.description)}">
    <meta name="twitter:image" content="${escapeHtmlAttribute(image)}">
    <script type="application/ld+json">${escapeJsonForHtml(websiteData)}</script>`;
};

const getHomeHeroPost = () => posts.find((post) => post.top !== undefined) || posts.find((post) => post.featured) || posts[0];

const injectSeoMeta = (htmlTemplate, title, description, extraMeta = '') => {
  let html = htmlTemplate.replace(/<title>.*?<\/title>/, `<title>${escapeHtmlText(title)}</title>`);

  if (description) {
    const metaDescTag = `<meta name="description" content="${escapeHtmlAttribute(description)}">`;

    if (html.includes('<meta name="description"')) {
      html = html.replace(/<meta name="description" content=".*?">/, metaDescTag);
    } else {
      html = html.replace('</title>', `</title>\n    ${metaDescTag}`);
    }
  }

  if (extraMeta) {
    // Insert extra meta tags before closing </head>
    html = html.replace('</head>', `${extraMeta}\n</head>`);
  }

  return html;
};

// Helper to write route file
const writeHtml = (relativePath, title, description, extraMeta = '') => {
  const filePath = path.join(DIST_DIR, relativePath, 'index.html');
  const dir = path.dirname(filePath);

  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  const html = injectSeoMeta(template, title, description, extraMeta);

  fs.writeFileSync(filePath, html);
};

const writeStandaloneHtml = (filename, title, description, extraMeta = '') => {
  const filePath = path.join(DIST_DIR, filename);
  const html = injectSeoMeta(template, title, description, extraMeta);

  fs.writeFileSync(filePath, html);
};

logger.start('Pre-render static routes');

// 1. Process Blog Posts

posts.forEach(post => {
  // URL structure: /post/:id
  const title = `${post.title} | ${SITE_SUFFIX}`;
  const description = post.excerpt || post.title;
  const postUrl = `${SITE_URL}/post/${post.id}`;
  const coverImage = post.coverImage ? toAbsoluteUrl(post.coverImage, SITE_URL) : toAbsoluteUrl(siteConfig.seoImage || siteConfig.logo || '/logo.png', SITE_URL);
  const publishDate = post.date;
  const modifiedDate = post.updatedAt || post.date;

  const ogMeta = `
    <meta property="og:type" content="article">
    <meta property="og:title" content="${escapeHtmlAttribute(title)}">
    <meta property="og:description" content="${escapeHtmlAttribute(description)}">
    <meta property="og:url" content="${escapeHtmlAttribute(postUrl)}">
    <meta property="og:image" content="${escapeHtmlAttribute(coverImage)}">
    <meta property="article:published_time" content="${escapeHtmlAttribute(publishDate)}">
    <meta property="article:modified_time" content="${escapeHtmlAttribute(modifiedDate)}">
    <meta property="article:section" content="${escapeHtmlAttribute(post.category || '')}">
    ${(post.tags || []).map(tag => `<meta property="article:tag" content="${escapeHtmlAttribute(tag)}">`).join('\n    ')}
    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:title" content="${escapeHtmlAttribute(title)}">
    <meta name="twitter:description" content="${escapeHtmlAttribute(description)}">
    <meta name="twitter:image" content="${escapeHtmlAttribute(coverImage)}">`;

  const postAuthorName = post.authors?.[0]?.name || authorName;
  const structuredData = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: post.title,
    description: description,
    image: coverImage,
    datePublished: publishDate,
    dateModified: modifiedDate,
    author: { '@type': 'Person', name: postAuthorName },
    mainEntityOfPage: postUrl,
    publisher: { '@type': 'Organization', name: siteTitle, url: SITE_URL, logo: { '@type': 'ImageObject', url: `${SITE_URL}/logo.png` } }
  };

  const breadcrumbData = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: '首页', item: SITE_URL },
      { '@type': 'ListItem', position: 2, name: post.category || '', item: `${SITE_URL}/?category=${encodeURIComponent(post.category || '')}` },
      { '@type': 'ListItem', position: 3, name: post.title, item: postUrl }
    ]
  };

  const jsonLd = `\n    <script type="application/ld+json">${escapeJsonForHtml([structuredData, breadcrumbData])}</script>`;

  const imagePreload = createImagePreload(coverImage, '(max-width: 767px) 100vw, (max-width: 1279px) 80vw, 1152px');
  const extraMeta = `${imagePreload}${ogMeta}${jsonLd}`;

  writeHtml(`post/${post.id}`, title, description, extraMeta);
});

// 2. Process Static Pages
const staticPages = [
  { path: 'archive', title: `文章归档 - ${SITE_SUFFIX}`, description: `按年份归档 ${siteTitle} 全部历史文章，快速查看发布时间与更新轨迹。`, schemaType: 'CollectionPage' },
  { path: 'tags', title: `标签云 - ${SITE_SUFFIX}`, description: `按标签浏览 ${siteTitle} 文章，通过标签快速筛选感兴趣的技术主题。`, schemaType: 'CollectionPage' },
  { path: 'stats', title: `站点统计 - ${SITE_SUFFIX}`, description: `${siteTitle} 站点统计概览：文章数、总字数、分类标签等核心数据。`, schemaType: 'WebPage' },
  { path: 'about', title: `关于我 - ${SITE_SUFFIX}`, description: `关于跑路的duck：前端开发者，热爱探索 Web 技术与极致性能体验。`, schemaType: 'ProfilePage' },
  { path: 'friends', title: `友情链接 - ${SITE_SUFFIX}`, description: `${siteTitle} 友情链接汇集优秀技术博客，欢迎通过 GitHub PR 申请交换友链。`, schemaType: 'CollectionPage' },
  { path: 'cover', title: `封面生成器 - ${SITE_SUFFIX}`, description: `在线生成精美博客封面图片，支持自定义文字、图标与多种导出比例。`, schemaType: 'WebApplication' },
  { path: 'sponsor', title: `赞助支持 - ${SITE_SUFFIX}`, description: `支持 ${siteTitle} 的多种方式：贡献代码、撰写文章帮助博客持续成长。`, schemaType: 'WebPage' }
];

staticPages.forEach(page => {
  writeHtml(page.path, page.title, page.description, createStaticPageMeta(page));
});

const homeHeroPost = getHomeHeroPost();
const homeExtraMeta = `${homeHeroPost?.coverImage ? createImagePreload(toAbsoluteUrl(homeHeroPost.coverImage, SITE_URL), '(max-width: 767px) 100vw, 60vw') : ''}${createHomeMeta()}`;
const homeHtml = injectSeoMeta(template, siteTitle, siteConfig.description, homeExtraMeta);
fs.writeFileSync(indexHtmlPath, homeHtml);

writeStandaloneHtml('404.html', `页面不存在 - ${SITE_SUFFIX}`, '你访问的页面不存在，可能已经移动、重命名或链接已失效。');

logger.step('Generated post pages', `count=${posts.length}`);
logger.step('Generated static pages', `count=${staticPages.length + 1}`);
logger.summary({
  pages: posts.length + staticPages.length + 1,
  posts: posts.length,
  static: staticPages.length,
  standalone: 1,
  siteUrl: SITE_URL
});
