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

const escapeHtmlAttribute = (value) => String(value).replace(/&/g, '&amp;').replace(/"/g, '&quot;');

const createImagePreload = (imageUrl, imagesizes) => {
  if (!imageUrl) {
    return '';
  }

  const sizesAttr = imagesizes ? ` imagesizes="${escapeHtmlAttribute(imagesizes)}"` : '';
  return `\n    <link rel="preload" as="image" href="${escapeHtmlAttribute(imageUrl)}" fetchpriority="high"${sizesAttr}>`;
};

const getHomeHeroPost = () => posts.find((post) => post.top !== undefined) || posts.find((post) => post.featured) || posts[0];

const injectSeoMeta = (htmlTemplate, title, description, extraMeta = '') => {
  let html = htmlTemplate.replace(/<title>.*?<\/title>/, `<title>${title}</title>`);

  if (description) {
    const safeDesc = description.replace(/"/g, '&quot;');
    const metaDescTag = `<meta name="description" content="${safeDesc}">`;

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
    <meta property="og:title" content="${title.replace(/"/g, '&quot;')}">
    <meta property="og:description" content="${description.replace(/"/g, '&quot;')}">
    <meta property="og:url" content="${postUrl}">
    <meta property="og:image" content="${coverImage}">
    <meta property="article:published_time" content="${publishDate}">
    <meta property="article:modified_time" content="${modifiedDate}">
    <meta property="article:section" content="${post.category || ''}">
    ${(post.tags || []).map(tag => `<meta property="article:tag" content="${tag}">`).join('\n    ')}
    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:title" content="${title.replace(/"/g, '&quot;')}">
    <meta name="twitter:description" content="${description.replace(/"/g, '&quot;')}">
    <meta name="twitter:image" content="${coverImage}">`;

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

  const jsonLd = `\n    <script type="application/ld+json">${JSON.stringify([structuredData, breadcrumbData])}</script>`;

  const imagePreload = createImagePreload(coverImage, '(max-width: 767px) 100vw, (max-width: 1279px) 80vw, 1152px');
  const extraMeta = `${imagePreload}${ogMeta}${jsonLd}`;

  writeHtml(`post/${post.id}`, title, description, extraMeta);
});

// 2. Process Static Pages
const staticPages = [
  { path: 'archive', title: `文章归档 - ${SITE_SUFFIX}`, description: `按年份归档 ${siteTitle} 全部历史文章，快速查看发布时间与更新轨迹。` },
  { path: 'tags', title: `标签云 - ${SITE_SUFFIX}`, description: `按标签浏览 ${siteTitle} 文章，通过标签快速筛选感兴趣的技术主题。` },
  { path: 'stats', title: `站点统计 - ${SITE_SUFFIX}`, description: `${siteTitle} 站点统计概览：文章数、总字数、分类标签等核心数据。` },
  { path: 'about', title: `关于我 - ${SITE_SUFFIX}`, description: `关于跑路的duck：前端开发者，热爱探索 Web 技术与极致性能体验。` },
  { path: 'friends', title: `友情链接 - ${SITE_SUFFIX}`, description: `${siteTitle} 友情链接汇集优秀技术博客，欢迎通过 GitHub PR 申请交换友链。` },
  { path: 'cover', title: `封面生成器 - ${SITE_SUFFIX}`, description: `在线生成精美博客封面图片，支持自定义文字、图标与多种导出比例。` },
  { path: 'sponsor', title: `赞助支持 - ${SITE_SUFFIX}`, description: `支持 ${siteTitle} 的多种方式：贡献代码、撰写文章帮助博客持续成长。` }
];

staticPages.forEach(page => {
  writeHtml(page.path, page.title, page.description);
});

const homeHeroPost = getHomeHeroPost();
if (homeHeroPost?.coverImage) {
  const homeCoverImage = toAbsoluteUrl(homeHeroPost.coverImage, SITE_URL);
  const homePreload = createImagePreload(homeCoverImage, '(max-width: 767px) 100vw, 60vw');
  const homeHtml = injectSeoMeta(template, siteTitle, siteConfig.description, homePreload);
  fs.writeFileSync(indexHtmlPath, homeHtml);
}

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
