import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import { loadSiteConfig, getSiteBasePath, toAbsoluteUrl } from './site-config-loader.mjs';
import { withBasePath } from './base-path.mjs';
import { createBuildLogger } from './build-logger.mjs';
import { loadPostsWithContent } from './ssg-data-loader.mjs';

const logger = createBuildLogger('ssg');

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DIST_DIR = path.join(__dirname, '../dist');
const DIST_SSR_DIR = path.join(__dirname, '../dist-ssr');
const IMAGE_MANIFEST_FILE = path.join(__dirname, '../generated/image-assets.json');

const siteConfig = loadSiteConfig({ logger });
const SITE_URL = siteConfig.url;
const BASE_PATH = getSiteBasePath();
const sitePath = (value = '/') => withBasePath(value, BASE_PATH);
const siteAbsoluteUrl = (value = '/') => new URL(sitePath(value), `${SITE_URL}/`).toString();

const DEFAULT_ROBOTS = 'index,follow,max-image-preview:large';
const NOINDEX_ROBOTS = 'noindex,nofollow';

/**
 * framer-motion 等组件在 SSR 时会把 initial={{ opacity: 0 }} 写为内联样式。
 * 禁用 JS（或不执行 JS 的爬虫读取时）时强制可见，不影响启用 JS 的正常用户。
 */
const NOSCRIPT_FALLBACK = '\n    <noscript><style>[style*="opacity: 0"], [style*="opacity:0"]{opacity:1!important}</style></noscript>';

const escapeHtmlAttribute = (value) => String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
const escapeJsonForHtml = (value) => JSON.stringify(value)
  .replace(/</g, '\\u003c')
  .replace(/>/g, '\\u003e')
  .replace(/&/g, '\\u0026')
  .replace(/\u2028/g, '\\u2028')
  .replace(/\u2029/g, '\\u2029');

/**
 * 把渲染完成的 HTML 中的 Suspense 边界“展平”为最终静态内容。
 *
 * renderToPipeableStream（onAllReady）虽然保证所有懒加载边界内容完整，
 * 但序列化时会把真实内容放进 <div hidden id="S:x">，页面位置只留下 fallback
 * （首页/文章页是转圈占位）。浏览器要等水合后 $RC 脚本才能把内容换回原位：
 * - 首屏 LCP 被拖到水合完成之后（实测 ~4.9s）；
 * - 不执行 JS 的爬虫/智能体只能看到空转占位，读不到正文。
 *
 * 这是构建期 SSG：内容必然完整，直接就地替换：
 *   <!--$?--><template id="B:x"></template><fallback><!--/$-->  →  <!--$-->内容<!--/$-->
 *   并删除 <div hidden id="S:x">内容</div> 与 <script>$RC("B:x","S:x")</script>。
 * 展平后客户端水合时，React 会把已就绪的边界内容原位水合（lazy 模块加载完成后
 * 直接接管已渲染的 DOM，不再回退到 fallback），SSR 输出与客户端语义保持一致。
 */
const flattenSuspenseBoundaries = (html) => {
  // React 19 把恢复函数与调用写在同一 <script> 里：`<script>...;$RC("B:x","S:x")</script>`。
  const rcCallPattern = /\$RC\("([^"]+)","([^"]+)"\)/g;
  const boundaries = [];
  const scriptRanges = [];
  let match;
  while ((match = rcCallPattern.exec(html)) !== null) {
    boundaries.push({ boundaryId: match[1], hiddenId: match[2] });
    // 定位包裹 $RC 调用的完整 <script>…</script>，整体移除（同一 script 内多个调用只记录一次）。
    const scriptStart = html.lastIndexOf('<script', match.index);
    const scriptEnd = html.indexOf('</script>', match.index) + '</script>'.length;
    if (scriptStart >= 0 && scriptEnd > scriptStart) {
      const key = `${scriptStart}:${scriptEnd}`;
      if (!scriptRanges.some(([s, e]) => s === scriptStart && e === scriptEnd)) {
        scriptRanges.push([scriptStart, scriptEnd]);
      }
    }
  }
  if (boundaries.length === 0) {
    return html;
  }

  const findHiddenDivContent = (hiddenId) => {
    const idIdx = html.indexOf(`id="${hiddenId}"`);
    if (idIdx < 0) {
      return null;
    }
    const openTagStart = html.lastIndexOf('<div', idIdx);
    const contentStart = html.indexOf('>', idIdx) + 1;
    let depth = 1;
    let i = contentStart;
    let contentEnd = -1;
    while (i < html.length) {
      const open = html.indexOf('<div', i);
      const close = html.indexOf('</div>', i);
      const next = open !== -1 && (close === -1 || open < close) ? open : close;
      if (next === -1) {
        break;
      }
      if (next === close) {
        depth -= 1;
        if (depth === 0) {
          contentEnd = next;
          break;
        }
      } else {
        depth += 1;
      }
      i = next + 4;
    }
    if (contentEnd < 0) {
      return null;
    }
    return {
      content: html.slice(contentStart, contentEnd),
      start: openTagStart,
      end: contentEnd + '</div>'.length
    };
  };

  const replacements = [];
  for (const { boundaryId, hiddenId } of boundaries) {
    const hidden = findHiddenDivContent(hiddenId);
    const templateIdx = html.indexOf(`<template id="${boundaryId}">`);
    if (!hidden || templateIdx < 0) {
      continue;
    }
    const fallbackStart = html.lastIndexOf('<!--$?-->', templateIdx);
    const fallbackEndIdx = html.indexOf('<!--/$-->', templateIdx);
    if (fallbackStart < 0 || fallbackEndIdx < 0) {
      continue;
    }
    const fallbackEnd = fallbackEndIdx + '<!--/$-->'.length;
    replacements.push({
      start: fallbackStart,
      end: fallbackEnd,
      text: `<!--$-->${hidden.content}<!--/$-->`
    });
    replacements.push({ start: hidden.start, end: hidden.end, text: '' });
  }
  for (const [scriptStart, scriptEnd] of scriptRanges) {
    replacements.push({ start: scriptStart, end: scriptEnd, text: '' });
  }

  // 从后往前应用，保证先前记录的索引不因替换而偏移。
  replacements.sort((a, b) => b.start - a.start);
  let result = html;
  for (const { start, end, text } of replacements) {
    result = result.slice(0, start) + text + result.slice(end);
  }
  return result;
};

const imageManifest = fs.existsSync(IMAGE_MANIFEST_FILE)
  ? JSON.parse(fs.readFileSync(IMAGE_MANIFEST_FILE, 'utf-8'))
  : { assets: {} };

const getImageAsset = (imageUrl) => {
  if (!imageUrl) return undefined;

  let pathname = imageUrl;
  try {
    pathname = new URL(imageUrl, `${SITE_URL}/`).pathname;
  } catch {
    return undefined;
  }

  const normalized = pathname.split(/[?#]/, 1)[0].replace(/^\/+/, '').toLowerCase();
  const key = Object.keys(imageManifest.assets || {}).find((candidate) => {
    const normalizedCandidate = candidate.replace(/^\/+/, '').toLowerCase();
    return normalizedCandidate === normalized || normalizedCandidate.endsWith(`/${normalized}`) || normalized.endsWith(`/${normalizedCandidate}`);
  });
  return key ? imageManifest.assets[key] : undefined;
};

const createImagePreload = (imageUrl, imagesizes) => {
  if (!imageUrl) return '';
  const asset = getImageAsset(imageUrl);
  const sizesAttr = imagesizes ? ` imagesizes="${escapeHtmlAttribute(imagesizes)}"` : '';
  const webpVariants = asset?.variants?.webp || [];
  const fallbackVariants = asset?.variants?.fallback || [];
  const toSrcSet = (variants) => variants.map((variant) => `${sitePath(variant.url)} ${variant.width}w`).join(', ');
  if (webpVariants.length > 0) {
    return `\n    <link rel="preload" as="image" href="${escapeHtmlAttribute(sitePath(webpVariants[webpVariants.length - 1].url))}" type="image/webp" fetchpriority="high" imagesrcset="${escapeHtmlAttribute(toSrcSet(webpVariants))}"${sizesAttr}>`;
  }
  if (fallbackVariants.length > 0) {
    return `\n    <link rel="preload" as="image" href="${escapeHtmlAttribute(sitePath(fallbackVariants[fallbackVariants.length - 1].url))}" fetchpriority="high" imagesrcset="${escapeHtmlAttribute(toSrcSet(fallbackVariants))}"${sizesAttr}>`;
  }
  return `\n    <link rel="preload" as="image" href="${escapeHtmlAttribute(imageUrl)}" fetchpriority="high"${sizesAttr}>`;
};

/**
 * 客户端 Seo 组件不会输出的附加结构化数据（静态页面集合/应用类型），
 * 与 react-helmet-async 输出的 WebSite schema 互补，仅在静态 HTML 中存在。
 */
const createStaticPageSchema = ({ path: pagePath, title, description, schemaType }) => {
  const pageUrl = siteAbsoluteUrl(`/${pagePath}`);
  const structuredData = {
    '@context': 'https://schema.org',
    '@type': schemaType,
    name: title,
    description,
    image: siteAbsoluteUrl(siteConfig.seoImage),
    url: pageUrl,
    isPartOf: {
      '@type': 'WebSite',
      name: siteConfig.title,
      url: siteAbsoluteUrl('/')
    },
    inLanguage: 'zh-CN'
  };
  return `\n    <script type="application/ld+json">${escapeJsonForHtml(structuredData)}</script>`;
};

/**
 * 把 SSR 渲染出的 body HTML 填入模板的 <div id="root">。
 * 用 div 深度计数匹配 root 的闭合标签，避免内容中的嵌套 div 导致截断。
 */
const injectRootContent = (template, ssrHtml) => {
  const rootPattern = /<div\b[^>]*\bid=["']root["'][^>]*>/i;
  const match = rootPattern.exec(template);
  if (!match) return template;

  const start = match.index;
  const openTag = match[0];
  let depth = 1; // root div 自身计一层
  let i = start + openTag.length;
  let closeTag = '';
  let closeIndex = -1;
  while (i < template.length) {
    const open = template.indexOf('<div', i);
    const close = template.indexOf('</div>', i);
    const next = open !== -1 && (close === -1 || open < close) ? open : close;
    if (next === -1) break;
    if (next === close) {
      depth -= 1;
      if (depth === 0) {
        closeIndex = next;
        closeTag = template.slice(next, template.indexOf('>', next) + 1);
        break;
      }
    } else {
      depth += 1;
    }
    i = next + 4;
  }
  if (closeIndex < 0) return template;

  // 注意：注入内容前后不加空白字符。root 的第一个子节点若为空白文本节点，
  // 会与客户端渲染的 <div> 不匹配导致 React hydration 报 #424。
  return `${template.slice(0, start)}${openTag}${ssrHtml}${closeTag}${template.slice(closeIndex + closeTag.length)}`;
};

/**
 * 给 SSR 渲染出的 head 标签加 data-rh="true"，客户端水合前（src/index.tsx）
 * 会移除这些标签，再由 react-helmet-async 重新渲染，避免重复。
 */
const addDataRh = (headHtml) => {
  let result = headHtml;
  // <title>...</title>
  result = result.replace(/<title>/g, '<title data-rh="true">');
  // <meta ... />（自闭合，属性插到 /> 前）
  result = result.replace(/<meta\b([^>]*?)\/>/g, '<meta$1 data-rh="true"/>');
  // <link ... />（自闭合）
  result = result.replace(/<link\b([^>]*?)\/>/g, '<link$1 data-rh="true"/>');
  // <script ...>...</script>（JSON-LD 等）
  result = result.replace(/<script\b([^>]*?)>/g, '<script$1 data-rh="true">');
  return result;
};

/**
 * 合并 helmet 收集的 head 标签，并移除模板中的默认 title/description/keywords
 * （SSR 渲染的每页标签才是正确的）。
 */
const mergeHead = (template, helmetHead, extraHead = '') => {
  let html = template;
  html = html.replace(/<title>[\s\S]*?<\/title>/i, '');
  html = html.replace(/<meta\b(?=[^>]*\bname\s*=\s*["']description["'])[^>]*\/?\s*>/i, '');
  html = html.replace(/<meta\b(?=[^>]*\bname\s*=\s*["']keywords["'])[^>]*\/?\s*>/i, '');
  const additions = [addDataRh(helmetHead), extraHead].filter(Boolean).join('\n    ');
  if (additions) {
    html = html.replace('</head>', `${additions}\n  </head>`);
  }
  return html;
};

export const runSsg = async ({ distDir = process.env.SSG_DIST_DIR || DIST_DIR, ssrDir = process.env.SSG_SSR_DIR || DIST_SSR_DIR } = {}) => {
  if (!fs.existsSync(distDir)) {
    logger.error('dist directory not found', 'Run "vite build" before SSG.');
    return false;
  }
  if (!fs.existsSync(path.join(ssrDir, 'entry-server.js'))) {
    logger.error('SSR bundle not found', 'Run "vite build --ssr" before SSG.');
    return false;
  }

  const writeHtmlFile = (relativePath, html) => {
    const filePath = path.join(distDir, relativePath, 'index.html');
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(filePath, html);
  };

  const writeStandaloneHtml = (filename, html) => {
    fs.writeFileSync(path.join(distDir, filename), html);
  };

  const indexHtmlPath = path.join(distDir, 'index.html');
  if (!fs.existsSync(indexHtmlPath)) {
    logger.error('dist/index.html not found');
    return false;
  }

  // 优先使用构建流程保存的干净模板快照。快照位置优先取 distDir 同目录（适配
  // SSG_DIST_DIR 指向独立调试产物目录的场景），其次取 ssrDir（生产构建流程的备份）。
  // 两者都缺失时回退到 distDir/index.html，但若它已被注入过（含 data-rh 标记），
  // 说明是重复运行且无干净模板，直接报错提示先跑完整构建。
  const templateSnapshot = [
    path.join(distDir, 'index.template.html'),
    path.join(ssrDir, 'index.template.html'),
  ].find((candidate) => fs.existsSync(candidate));
  let template;
  if (templateSnapshot) {
    template = fs.readFileSync(templateSnapshot, 'utf-8');
  } else {
    const fallback = fs.readFileSync(indexHtmlPath, 'utf-8');
    if (fallback.includes('data-rh="true"')) {
      logger.error('dist/index.html has already been SSG-injected and no clean template snapshot exists', 'Run "npm run build" to regenerate a clean template before running SSG.');
      return false;
    }
    template = fallback;
  }

  // 预热 SSR bundle 中的懒加载 chunk（路由页面均为 React.lazy）。
  // 不预热时 Suspense 边界在首次渲染时未 resolve，文章正文/列表不会进入静态 HTML。
  const ssrAssetsDir = path.join(ssrDir, 'assets');
  let warmedChunks = 0;
  if (fs.existsSync(ssrAssetsDir)) {
    for (const file of fs.readdirSync(ssrAssetsDir)) {
      if (!file.endsWith('.js')) continue;
      try {
        await import(pathToFileURL(path.join(ssrAssetsDir, file)).href);
        warmedChunks += 1;
      } catch {
        // 个别 chunk 依赖浏览器 API，预热失败不阻塞后续渲染。
      }
    }
  }
  if (warmedChunks > 0) {
    logger.step('Warmed SSR lazy chunks', `count=${warmedChunks}`);
  }

  const { renderApp } = await import(pathToFileURL(path.join(ssrDir, 'entry-server.js')).href);
  const posts = loadPostsWithContent();

  logger.start('Static site generation');

  const renderPage = async (url) => {
    const { html, head, routeData } = await renderApp(url, { posts });
    return { html, head, routeData };
  };

  /**
   * 把构建期计算的路由数据（文章正文等）序列化为 JSON 注入页面，
   * 客户端水合前（src/index.tsx）读取并构造 SsgRouteContext，
   * 使文章页在客户端首帧渲染与 SSR 输出一致，避免 hydration mismatch。
   */
  const createRouteDataScript = (routeData) => {
    if (!routeData) return '';
    return `\n    <script id="ssg-route-data" type="application/json">${escapeJsonForHtml(routeData)}</script>`;
  };

  const staticPages = [
    { path: 'archive', title: `归档 - ${siteConfig.title}`, description: '按年份归档 D-blog 全部历史文章，快速查看发布时间、分类与更新轨迹。', schemaType: 'CollectionPage' },
    { path: 'tags', title: `标签 - ${siteConfig.title}`, description: '按标签浏览 D-blog 文章，通过标签快速筛选感兴趣的技术主题与内容。', schemaType: 'CollectionPage' },
    { path: 'stats', title: `统计 - ${siteConfig.title}`, description: 'D-blog 站点统计概览：文章数、总字数、分类标签、图片数量等核心数据一目了然。', schemaType: 'WebPage' },
    { path: 'about', title: `关于 - ${siteConfig.title}`, description: '关于跑路的duck：前端开发者，热爱探索 Web 技术，致力于构建极致性能与优秀交互的用户界面。', schemaType: 'ProfilePage' },
    { path: 'friends', title: `友链 - ${siteConfig.title}`, description: 'D-blog 友情链接汇集优秀技术博客与趣味网站，欢迎通过 GitHub PR 申请交换友链。', schemaType: 'CollectionPage' },
    { path: 'cover', title: `封面生成 - ${siteConfig.title}`, description: '在线生成精美博客文章封面图片，支持自定义文字、图标、渐变背景与多种导出比例。', schemaType: 'WebApplication' },
    { path: 'watermark', title: `水印工具 - ${siteConfig.title}`, description: '在浏览器中为图片添加文字水印，支持实时预览与本地导出。', schemaType: 'WebApplication' },
    { path: 'sponsor', title: `赞助 - ${siteConfig.title}`, description: '支持 D-blog 的多种方式：贡献代码、撰写文章或通过赞助商链接帮助博客持续成长。', schemaType: 'WebPage' }
  ];

  const writePage = async (url, relativePath, extraHead = '', options = {}) => {
    const { html, head, routeData } = await renderPage(url);
    let pageHtml = injectRootContent(template, html);
    // 展平 Suspense 边界：真实内容就地内联，爬虫/智能体可读，浏览器无需等水合。
    pageHtml = flattenSuspenseBoundaries(pageHtml);
    pageHtml = mergeHead(pageHtml, head, `${extraHead}${NOSCRIPT_FALLBACK}`);
    // 注入路由数据（文章页正文等），供客户端水合使用。
    const routeDataScript = createRouteDataScript(routeData);
    if (routeDataScript) {
      pageHtml = pageHtml.replace(/<div\b[^>]*\bid=["']root["'][^>]*>/i, (match) => `${routeDataScript}\n    ${match}`);
    }
    if (options.canonical === null) {
      pageHtml = pageHtml.replace(/<link\b(?=[^>]*\brel\s*=\s*["']canonical["'])[^>]*\/?\s*>/i, '');
    }
    writeHtmlFile(relativePath, pageHtml);
  };

  // 1. 文章页：SSR 同步渲染完整正文（爬虫可直接读取）。
  for (const post of posts) {
    const extraHead = post.coverImage
      ? createImagePreload(toAbsoluteUrl(post.coverImage, SITE_URL, BASE_PATH), '(max-width: 767px) 100vw, (max-width: 1279px) 80vw, 1152px')
      : '';
    await writePage(`/post/${post.id}`, `post/${post.id}`, extraHead);
  }
  logger.step('Generated post pages', `count=${posts.length}`);

  // 2. 静态页面：SSR 渲染 + 附加结构化数据。
  for (const page of staticPages) {
    const schema = createStaticPageSchema(page);
    await writePage(`/${page.path}`, page.path, schema);
  }
  logger.step('Generated static pages', `count=${staticPages.length}`);

  // 3. 首页。
  const homeHeroPost = (() => {
    const pinnedPosts = posts
      .filter((post) => post.featured === true && post['featured-top'] !== undefined)
      .sort((a, b) => a['featured-top'] - b['featured-top']);
    return pinnedPosts[0] || posts.find((post) => post.featured === true) || null;
  })();
  const homeExtraHead = homeHeroPost?.coverImage
    ? createImagePreload(toAbsoluteUrl(homeHeroPost.coverImage, SITE_URL, BASE_PATH), '(max-width: 767px) 100vw, 60vw')
    : '';
  const { html: homeHtml, head: homeHead, routeData: homeRouteData } = await renderPage('/');
  const homeRouteDataScript = createRouteDataScript(homeRouteData);
  let homePage = injectRootContent(template, homeHtml);
  homePage = flattenSuspenseBoundaries(homePage);
  if (homeRouteDataScript) {
    homePage = homePage.replace(/<div\b[^>]*\bid=["']root["'][^>]*>/i, (match) => `${homeRouteDataScript}\n    ${match}`);
  }
  writeStandaloneHtml('index.html', mergeHead(homePage, homeHead, `${homeExtraHead}${NOSCRIPT_FALLBACK}`));
  logger.step('Generated home page');

  // 4. 我的收藏（本地数据页，页面自身 Seo 已带 noindex）。
  await writePage('/favorites', 'favorites');

  // 5. 404 页（根级独立 HTML，Cloudflare Pages 以 404.html 作为 404 响应）。
  // 渲染路径 /__missing__ 是占位路由，不能出现在 canonical 中，mergeHead 之后显式剥离。
  const { html: notFoundHtml, head: notFoundHead } = await renderPage('/__missing__');
  const notFoundPage = injectRootContent(template, notFoundHtml);
  const flattenedNotFoundPage = flattenSuspenseBoundaries(notFoundPage);
  const mergedNotFoundPage = mergeHead(flattenedNotFoundPage, notFoundHead, NOSCRIPT_FALLBACK);
  writeStandaloneHtml('404.html', mergedNotFoundPage.replace(/<link\b(?=[^>]*\brel\s*=\s*["']canonical["'])[^>]*\/?\s*>/i, ''));
  logger.step('Generated 404 page');

  logger.summary({
    pages: posts.length + staticPages.length + 3,
    posts: posts.length,
    static: staticPages.length,
    siteUrl: SITE_URL
  });

  return true;
};

if (process.argv[1] && path.resolve(process.argv[1]) === __filename) {
  runSsg().then((ok) => {
    if (!ok) process.exitCode = 1;
  });
}
