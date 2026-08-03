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
const DEFAULT_ROBOTS = 'index,follow,max-image-preview:large';
const NOINDEX_ROBOTS = 'noindex,nofollow';

const stripNonCriticalPreloads = (html) => html
  .replace(/\n?\s*<link rel="modulepreload"[^>]+href="\.\/assets\/(?:syntax|katex|markdown|dompurify|mermaid)[^"]+"[^>]*>/g, '')
  .replace(/\n?\s*<link rel="stylesheet"[^>]+href="\.\/assets\/(?:syntax|katex)[^"]+"[^>]*>/g, '');

const escapeHtmlText = (value) => String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const escapeHtmlAttribute = (value) => escapeHtmlText(value).replace(/"/g, '&quot;').replace(/'/g, '&#39;');
const escapeJsonForHtml = (value) => JSON.stringify(value)
  .replace(/</g, '\\u003c')
  .replace(/>/g, '\\u003e')
  .replace(/&/g, '\\u0026')
  .replace(/\u2028/g, '\\u2028')
  .replace(/\u2029/g, '\\u2029');

const upsertHeadTag = (html, tagPattern, replacement) => {
  if (tagPattern.test(html)) {
    return html.replace(tagPattern, replacement);
  }

  return html.replace('</head>', `${replacement}\n</head>`);
};

const addHelmetAttribute = (tag) => {
  if (/\bdata-rh\s*=/.test(tag)) {
    return tag;
  }

  return tag.replace(/(\s*\/?>(?:\s*)?)$/, ' data-rh="true"$1');
};

export const markRuntimeManagedHeadTags = (html) => html
  .replace(/<meta\b(?=[^>]*(?:\bname\s*=\s*["'](?:description|robots|keywords|twitter:[^"']+)["']|\bproperty\s*=\s*["'](?:og|article):[^"']+["']))[^>]*\/?\s*>/gi, addHelmetAttribute)
  .replace(/<link\b(?=[^>]*\brel\s*=\s*["'](?:canonical|alternate)["'])[^>]*\/?\s*>/gi, addHelmetAttribute)
  .replace(/<script\b(?=[^>]*\btype\s*=\s*["']application\/ld\+json["'])[^>]*>/gi, addHelmetAttribute);

const descriptionMetaPattern = /<meta\b(?=[^>]*\bname\s*=\s*["']description["'])[^>]*\/?\s*>/i;
const canonicalLinkPattern = /<link\b(?=[^>]*\brel\s*=\s*["']canonical["'])[^>]*\/?\s*>/i;
const robotsMetaPattern = /<meta\b(?=[^>]*\bname\s*=\s*["']robots["'])[^>]*\/?\s*>/i;

export const injectSeoMeta = (
  htmlTemplate,
  title,
  description,
  extraMeta = '',
  { canonicalUrl, robots = DEFAULT_ROBOTS } = {}
) => {
  let html = htmlTemplate.replace(/<title>[\s\S]*?<\/title>/i, `<title>${escapeHtmlText(title)}</title>`);

  if (description) {
    const metaDescTag = `<meta name="description" content="${escapeHtmlAttribute(description)}">`;
    html = upsertHeadTag(html, descriptionMetaPattern, metaDescTag);
  }

  if (canonicalUrl) {
    const canonicalTag = `<link rel="canonical" href="${escapeHtmlAttribute(canonicalUrl)}">`;
    html = upsertHeadTag(html, canonicalLinkPattern, canonicalTag);
  }

  if (robots) {
    const robotsTag = `<meta name="robots" content="${escapeHtmlAttribute(robots)}">`;
    html = upsertHeadTag(html, robotsMetaPattern, robotsTag);
  }

  if (extraMeta) {
    html = html.replace('</head>', `${extraMeta}\n</head>`);
  }

  return markRuntimeManagedHeadTags(html);
};

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
  const homeUrl = `${SITE_URL}/`;
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
    <meta property="og:url" content="${escapeHtmlAttribute(homeUrl)}">
    <meta property="og:image" content="${escapeHtmlAttribute(image)}">
    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:title" content="${escapeHtmlAttribute(siteTitle)}">
    <meta name="twitter:description" content="${escapeHtmlAttribute(siteConfig.description)}">
    <meta name="twitter:image" content="${escapeHtmlAttribute(image)}">
    <script type="application/ld+json">${escapeJsonForHtml(websiteData)}</script>`;
};

const getHomeHeroPost = (posts) => posts.find((post) => post.top !== undefined) || posts.find((post) => post.featured) || null;

const writeHtml = (distDir, htmlTemplate, relativePath, title, description, extraMeta = '', options = {}) => {
  const filePath = path.join(distDir, relativePath, 'index.html');
  const dir = path.dirname(filePath);

  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  fs.writeFileSync(filePath, injectSeoMeta(htmlTemplate, title, description, extraMeta, options));
};

const writeStandaloneHtml = (distDir, htmlTemplate, filename, title, description, extraMeta = '', options = {}) => {
  const filePath = path.join(distDir, filename);
  fs.writeFileSync(filePath, injectSeoMeta(htmlTemplate, title, description, extraMeta, options));
};

export const runPrerender = ({ distDir = DIST_DIR, postsFile = POSTS_FILE } = {}) => {
  // Check if dist exists
  if (!fs.existsSync(distDir)) {
    logger.error('dist directory not found', 'Run "vite build" before prerender.');
    return false;
  }

  const indexHtmlPath = path.join(distDir, 'index.html');
  if (!fs.existsSync(indexHtmlPath)) {
    logger.error('dist/index.html not found');
    return false;
  }

  if (!fs.existsSync(postsFile)) {
    logger.error('generated/posts.json not found', 'Run "npm run gen:data" before prerender.');
    return false;
  }

  const template = stripNonCriticalPreloads(fs.readFileSync(indexHtmlPath, 'utf-8'));
  const posts = JSON.parse(fs.readFileSync(postsFile, 'utf-8'));

  logger.start('Pre-render static routes');

  // 1. Process Blog Posts
  posts.forEach((post) => {
    // URL structure: /post/:id
    const title = `${post.title} - ${SITE_SUFFIX}`;
    const description = post.excerpt || post.title;
    const postUrl = `${SITE_URL}/post/${post.id}`;
    const coverImage = post.coverImage
      ? toAbsoluteUrl(post.coverImage, SITE_URL)
      : toAbsoluteUrl(siteConfig.seoImage || siteConfig.logo || '/logo.png', SITE_URL);
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
    ${(post.tags || []).map((tag) => `<meta property="article:tag" content="${escapeHtmlAttribute(tag)}">`).join('\n    ')}
    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:title" content="${escapeHtmlAttribute(title)}">
    <meta name="twitter:description" content="${escapeHtmlAttribute(description)}">
    <meta name="twitter:image" content="${escapeHtmlAttribute(coverImage)}">`;

    const postAuthorName = post.authors?.[0]?.name || authorName;
    const structuredData = {
      '@context': 'https://schema.org',
      '@type': 'Article',
      headline: post.title,
      description,
      image: coverImage,
      datePublished: publishDate,
      dateModified: modifiedDate,
      author: { '@type': 'Person', name: postAuthorName },
      mainEntityOfPage: postUrl,
      publisher: {
        '@type': 'Organization',
        name: siteTitle,
        url: SITE_URL,
        logo: { '@type': 'ImageObject', url: `${SITE_URL}/logo.png` }
      }
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

    writeHtml(distDir, template, `post/${post.id}`, title, description, extraMeta, { canonicalUrl: postUrl });
  });

  // 2. Process Static Pages
  const staticPages = [
    { path: 'archive', title: `归档 - ${SITE_SUFFIX}`, description: '按年份归档 D-blog 全部历史文章，快速查看发布时间、分类与更新轨迹。', schemaType: 'CollectionPage' },
    { path: 'tags', title: `标签 - ${SITE_SUFFIX}`, description: '按标签浏览 D-blog 文章，通过标签快速筛选感兴趣的技术主题与内容。', schemaType: 'CollectionPage' },
    { path: 'stats', title: `统计 - ${SITE_SUFFIX}`, description: 'D-blog 站点统计概览：文章数、总字数、分类标签、图片数量等核心数据一目了然。', schemaType: 'WebPage' },
    { path: 'about', title: `关于 - ${SITE_SUFFIX}`, description: '关于跑路的duck：前端开发者，热爱探索 Web 技术，致力于构建极致性能与优秀交互的用户界面。', schemaType: 'ProfilePage' },
    { path: 'friends', title: `友链 - ${SITE_SUFFIX}`, description: 'D-blog 友情链接汇集优秀技术博客与趣味网站，欢迎通过 GitHub PR 申请交换友链。', schemaType: 'CollectionPage' },
    { path: 'cover', title: `封面生成 - ${SITE_SUFFIX}`, description: '在线生成精美博客文章封面图片，支持自定义文字、图标、渐变背景与多种导出比例。', schemaType: 'WebApplication' },
    { path: 'sponsor', title: `赞助 - ${SITE_SUFFIX}`, description: '支持 D-blog 的多种方式：贡献代码、撰写文章或通过赞助商链接帮助博客持续成长。', schemaType: 'WebPage' }
  ];

  staticPages.forEach((page) => {
    const pageUrl = new URL(page.path, `${SITE_URL}/`).toString();
    writeHtml(distDir, template, page.path, page.title, page.description, createStaticPageMeta(page), { canonicalUrl: pageUrl });
  });

  const homeHeroPost = getHomeHeroPost(posts);
  const homeExtraMeta = `${homeHeroPost?.coverImage ? createImagePreload(toAbsoluteUrl(homeHeroPost.coverImage, SITE_URL), '(max-width: 767px) 100vw, 60vw') : ''}${createHomeMeta()}`;
  writeStandaloneHtml(distDir, template, 'index.html', siteTitle, siteConfig.description, homeExtraMeta, { canonicalUrl: `${SITE_URL}/` });

  writeStandaloneHtml(
    distDir,
    template,
    '404.html',
    `页面不存在 - ${SITE_SUFFIX}`,
    '你访问的页面不存在，可能已经移动或删除。',
    '',
    { canonicalUrl: `${SITE_URL}/404.html`, robots: NOINDEX_ROBOTS }
  );

  logger.step('Generated post pages', `count=${posts.length}`);
  logger.step('Generated static pages', `count=${staticPages.length + 1}`);
  logger.summary({
    pages: posts.length + staticPages.length + 1,
    posts: posts.length,
    static: staticPages.length,
    standalone: 1,
    siteUrl: SITE_URL
  });

  return true;
};

if (process.argv[1] && path.resolve(process.argv[1]) === __filename) {
  if (!runPrerender()) {
    process.exitCode = 1;
  }
}
