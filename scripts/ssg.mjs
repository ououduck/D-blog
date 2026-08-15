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
const POSTS_FILE = path.join(__dirname, '../generated/posts.json');
const SHUOSHUO_FILE = path.join(__dirname, '../generated/shuoshuo.json');

/**
 * 读取 generated/shuoshuo.json（已含正文 content）。
 * 缺失/损坏时返回空数组：说说为可选内容，站点无说说时列表页已有空态展示，
 * 不阻塞整站 SSG（posts.json 缺失仍 fail-closed，见前置依赖检查）。
 */
const loadShuoShuoItems = () => {
  try {
    const items = JSON.parse(fs.readFileSync(SHUOSHUO_FILE, 'utf-8'));
    return Array.isArray(items) ? items : [];
  } catch {
    return [];
  }
};

const siteConfig = loadSiteConfig({ logger });
const SITE_URL = siteConfig.url;
const BASE_PATH = getSiteBasePath();
const sitePath = (value = '/') => withBasePath(value, BASE_PATH);
const siteAbsoluteUrl = (value = '/') => new URL(sitePath(value), `${SITE_URL}/`).toString();

/**
 * Suspense 边界展平的迭代上限（防御性保险）：
 * 正常页面 $RC 调用数量与懒加载边界数量级相当（个位数到几十），
 * 该上限用于防止极端畸形输出（如缺失 </script> 导致 $RC 匹配不消耗
 * 字符串长度）造成理论上的死循环。超过上限即放弃剩余展平，
 * 保留浏览器可水合的原始序列化标记 —— 内容正确性优先于展平完整性。
 */
const MAX_FLATTEN_ITERATIONS = 10000;

/**
 * SSG 全站渲染的总预算（毫秒）：10 分钟（可通过环境变量 SSG_TOTAL_BUDGET_MS 覆盖）。
 * 防御性兜底：单页渲染超时为 30s（ssr-entry），若多页连续超时（如 SSR bundle 内
 * 存在系统性死循环/巨型文章），总时长会逼近 build.mjs 的阶段超时（20 分钟），
 * 此时 build.mjs 会 SIGKILL 整个阶段，failedPages 汇总永远打印不出来，排查线索丢失。
 * 本预算保证 SSG 阶段始终能在预算内结束并打印完整汇总（failed + skipped）。
 */
const TOTAL_BUDGET_MS = Number(process.env.SSG_TOTAL_BUDGET_MS) || 10 * 60 * 1000;

/**
 * framer-motion 等组件在 SSR 时会把 initial={{ opacity: 0 }} 写为内联样式。
 * 禁用 JS（或不执行 JS 的爬虫读取时）时强制可见，不影响启用 JS 的正常用户。
 */
const NOSCRIPT_FALLBACK =
  '\n    <noscript><style>[style*="opacity: 0"], [style*="opacity:0"]{opacity:1!important}</style></noscript>';

const escapeHtmlAttribute = (value) =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
const escapeJsonForHtml = (value) =>
  JSON.stringify(value)
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
 *
 * 边界可能互相嵌套（例如懒加载的 BackToTop 位于路由级懒加载边界内部）：
 * 外层 hidden div 里包含内层边界的完整序列化片段。若先统计全部替换区间再统一
 * 应用，区间互相重叠会导致索引错位、$RC 脚本残留与内容重复。因此这里改为
 * “最内层优先”的迭代算法：React 按文档序输出 $RC 调用（内层边界先出现），
 * 每次处理当前字符串中第一个 $RC 边界，处理完后再扫描下一个（此时只剩外层）。
 * 单个边界的三处编辑（script 最右 → hidden 居中 → fallback 最左）互不重叠，
 * 从右往左执行可保证前序索引不失效。
 *
 * 防御路径（Phase 4 加固）：迭代次数上限 MAX_FLATTEN_ITERATIONS，防止
 * 极端畸形输出导致死循环；单边界配对失败时只摘除 $RC 调用文本，避免
 * 无限扫描同一位点，其余序列化标记原样保留（浏览器仍能按未展平方式水合）。
 */
const flattenSuspenseBoundaries = (html) => {
  // React 19 把恢复函数与调用写在同一 <script> 里：`<script>...;$RC("B:x","S:x")</script>`。
  const rcCallPattern = /\$RC\("([^"]+)","([^"]+)"\)/;

  // 在给定字符串中定位 <div hidden id="hiddenId">…</div> 的起止与内容。
  // 用 div 深度计数匹配闭合标签，内容中的嵌套 div 不会导致提前截断。
  const findHiddenDivContent = (source, hiddenId) => {
    const idIdx = source.indexOf(`id="${hiddenId}"`);
    if (idIdx < 0) {
      return null;
    }
    const openTagStart = source.lastIndexOf('<div', idIdx);
    const contentStart = source.indexOf('>', idIdx) + 1;
    let depth = 1;
    let i = contentStart;
    let contentEnd = -1;
    while (i < source.length) {
      const open = source.indexOf('<div', i);
      const close = source.indexOf('</div>', i);
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
      content: source.slice(contentStart, contentEnd),
      start: openTagStart,
      end: contentEnd + '</div>'.length,
    };
  };

  let result = html;
  let iterations = 0;
  // 只扫描 <script>…</script> 区域内的 $RC 调用：React 的序列化恢复调用
  // 必定位于 <script> 内；全文匹配会把文章正文里的字面量 $RC("B:x","S:x")
  // （例如讲解 React 水合原理的代码示例）误当成序列化标记，经防御路径
  // 静默删除该段正文。逐区域扫描天然排除正文与属性中的字面量。
  let searchFrom = 0;
  while (searchFrom < result.length) {
    const scriptStart = result.indexOf('<script', searchFrom);
    if (scriptStart < 0) break;
    const scriptClose = result.indexOf('</script>', scriptStart);
    // 防御：script 缺少闭合标签（畸形输出）时放弃剩余扫描，保留原始标记。
    if (scriptClose < 0) break;
    const scriptEnd = scriptClose + '</script>'.length;
    const scriptContent = result.slice(scriptStart, scriptEnd);
    const match = rcCallPattern.exec(scriptContent);
    if (!match) {
      // 该 script 内没有 $RC 调用，继续扫描下一个 script 区域。
      searchFrom = scriptEnd;
      continue;
    }

    iterations += 1;
    // 防御：迭代次数超限立即停止，保留剩余原始标记（内容优先于展平）。
    if (iterations > MAX_FLATTEN_ITERATIONS) {
      logger.warn('Suspense flatten iteration limit reached; keeping remaining markers', `iterations=${iterations}`);
      break;
    }

    const boundaryId = match[1];
    const hiddenId = match[2];

    const templateIdx = result.indexOf(`<template id="${boundaryId}">`);
    const hidden = templateIdx >= 0 ? findHiddenDivContent(result, hiddenId) : null;
    const fallbackStart = templateIdx >= 0 ? result.lastIndexOf('<!--$?-->', templateIdx) : -1;
    const fallbackEndIdx = templateIdx >= 0 ? result.indexOf('<!--/$-->', templateIdx) : -1;

    if (!hidden || fallbackStart < 0 || fallbackEndIdx < 0) {
      // 防御路径：输出异常时该边界无法配对处理。只摘除调用文本避免死循环，
      // 其余序列化标记原样保留，浏览器仍能按未展平的方式水合该边界。
      const removeStart = scriptStart + match.index;
      result = result.slice(0, removeStart) + result.slice(removeStart + match[0].length);
      // 回退到当前 script 开头重扫：同一 <script> 内可能还有后续 $RC 调用
      // （React 19 可能在同一内联脚本写入多个调用），不能越过当前 script 的开标签，
      // 否则剩余调用会被跳过、其边界保持未展平。
      searchFrom = scriptStart;
      continue;
    }

    const fallbackEnd = fallbackEndIdx + '<!--/$-->'.length;
    // 三处区间互不重叠且从右往左排列，从后往前修改不影响前面区间的索引。
    result = result.slice(0, scriptStart) + result.slice(scriptEnd);
    result = result.slice(0, hidden.start) + result.slice(hidden.end);
    result = result.slice(0, fallbackStart) + `<!--$-->${hidden.content}<!--/$-->` + result.slice(fallbackEnd);
    // 三处编辑后索引整体前移，重置游标从头部重新扫描（每轮至少移除一个 script）。
    searchFrom = 0;
  }
  return result;
};

const createImagePreload = (imageUrl) => {
  if (!imageUrl) return '';
  // 文章封面 <img> 为单变体（仅 src，无 srcset），preload 的 href 与其一致；
  // 不输出 imagesizes —— 该属性脱离 imagesrcset 会被浏览器忽略，纯属噪声。
  return `\n    <link rel="preload" as="image" href="${escapeHtmlAttribute(imageUrl)}" fetchpriority="high">`;
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
      url: siteAbsoluteUrl('/'),
    },
    inLanguage: 'zh-CN',
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

/**
 * 把异常规范化为单行可读信息（避免 Actions 日志堆栈刷屏）。
 * @param {unknown} error
 * @returns {string}
 */
const formatError = (error) => {
  if (error instanceof Error) {
    const firstStackLine = (error.stack || '').split('\n')[1]?.trim() || '';
    return `${error.name}: ${error.message}${firstStackLine ? ` (${firstStackLine})` : ''}`;
  }
  return String(error);
};

export const runSsg = async ({
  distDir = process.env.SSG_DIST_DIR || DIST_DIR,
  ssrDir = process.env.SSG_SSR_DIR || DIST_SSR_DIR,
} = {}) => {
  if (!fs.existsSync(distDir)) {
    logger.error('dist directory not found', 'Run "vite build" before SSG.');
    return false;
  }
  if (!fs.existsSync(path.join(ssrDir, 'entry-server.js'))) {
    logger.error('SSR bundle not found', 'Run "vite build --ssr" before SSG.');
    return false;
  }
  // 前置依赖检查：文章数据缺失时给出明确指引（原实现直接 JSON.parse 崩溃）。
  if (!fs.existsSync(POSTS_FILE)) {
    logger.error('generated/posts.json not found', 'Run "npm run gen:data" before SSG.');
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
  const templateSnapshot = [path.join(distDir, 'index.template.html'), path.join(ssrDir, 'index.template.html')].find(
    (candidate) => fs.existsSync(candidate),
  );
  let template;
  if (templateSnapshot) {
    template = fs.readFileSync(templateSnapshot, 'utf-8');
  } else {
    const fallback = fs.readFileSync(indexHtmlPath, 'utf-8');
    if (fallback.includes('data-rh="true"')) {
      logger.error(
        'dist/index.html has already been SSG-injected and no clean template snapshot exists',
        'Run "npm run build" to regenerate a clean template before running SSG.',
      );
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
  const shuoshuoItems = loadShuoShuoItems();

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
    {
      path: 'archive',
      title: `归档 - ${siteConfig.title}`,
      description:
        'D-blog 全站文章时间线，按年份与月份归档全部技术分享、工具测评与折腾记录，快速回顾历史内容与更新轨迹，一键定位任意时期的文章。',
      schemaType: 'CollectionPage',
      schemaFromSeo: true,
    },
    {
      path: 'tags',
      title: `标签 - ${siteConfig.title}`,
      description:
        'D-blog 标签导航页，按主题标签筛选全部文章，快速定位前端开发、后端运维、AI 工具与效率软件等感兴趣内容。',
      schemaType: 'CollectionPage',
      schemaFromSeo: true,
    },
    {
      path: 'stats',
      title: `统计 - ${siteConfig.title}`,
      description: 'D-blog 站点数据统计面板，展示文章总数、累计字数、分类与标签分布、图片与代码规模等核心内容数据。',
      schemaType: 'WebPage',
    },
    {
      path: 'about',
      title: `关于 - ${siteConfig.title}`,
      description: '关于跑路的duck：前端开发者，热爱探索 Web 技术，致力于构建极致性能与优秀交互的静态页面体验。',
      schemaType: 'ProfilePage',
      schemaFromSeo: true,
    },
    {
      path: 'friends',
      title: `友链 - ${siteConfig.title}`,
      description: 'D-blog 友情链接汇集优秀技术博客与趣味网站，欢迎通过 GitHub PR 申请交换友链，一起分享交流与成长。',
      schemaType: 'CollectionPage',
      schemaFromSeo: true,
    },
    {
      path: 'shuoshuo',
      title: `说说 - ${siteConfig.title}`,
      description:
        'D-blog 说说：类似朋友圈的短动态分享，用一句话、一张图记录当下的想法与生活片段，Markdown 书写，随性更新。',
      schemaType: 'CollectionPage',
      schemaFromSeo: true,
    },
    {
      path: 'guestbook',
      title: `留言板 - ${siteConfig.title}`,
      description: '在 D-blog 留言板留下你的足迹：闲聊、建议、问题反馈都可以，登录 GitHub 账号即可留言。',
      schemaType: 'WebPage',
      schemaFromSeo: true,
    },
    {
      path: 'cover',
      title: `封面生成 - ${siteConfig.title}`,
      description:
        '在线免费生成精美博客文章封面图片，支持自定义文字、图标与渐变背景，适配多种社交分享比例，开箱即用无需登录。',
      schemaType: 'WebApplication',
    },
    {
      path: 'watermark',
      title: `水印工具 - ${siteConfig.title}`,
      description:
        '在浏览器中免费为图片添加文字水印，支持自定义文字样式、实时预览与本地导出，无需上传文件，保护图片版权。',
      schemaType: 'WebApplication',
    },
    {
      path: 'sponsor',
      title: `赞助 - ${siteConfig.title}`,
      description:
        '支持 D-blog 的多种方式：贡献代码、投稿原创文章或通过赞助链接，帮助博客持续输出高质量内容，感谢每一位支持者。',
      schemaType: 'WebPage',
    },
    {
      path: 'search',
      title: `搜索 - ${siteConfig.title}`,
      description: '在 D-blog 全站搜索文章：按标题、分类、标签、摘要与正文内容检索，快速定位感兴趣的技术分享。',
      schemaType: 'WebPage',
      schemaFromSeo: true,
    },
  ];

  /**
   * 渲染并落盘单个页面。渲染失败时抛出异常，由调用方（页面循环）捕获隔离：
   * 单页失败不中断整站生成，全部完成后汇总失败并返回 false（构建失败，
   * 但已生成的页面保留，便于在部署前排查失败原因）。
   */
  const writePage = async (url, relativePath, extraHead = '') => {
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
    writeHtmlFile(relativePath, pageHtml);
  };

  const failedPages = [];
  const skippedPages = [];
  const ssgStartedAt = Date.now();

  // 总预算检查：超过预算后剩余的页面不再渲染（记入 skipped），
  // 保证阶段在预算内结束、汇总始终可打印。
  const budgetExceeded = () => Date.now() - ssgStartedAt > TOTAL_BUDGET_MS;

  // 1. 文章页：SSR 同步渲染完整正文（爬虫可直接读取）。
  // 封面 preload 为单变体（href 与 <img src> 主资源一致）。Post.tsx 封面
  // <img> 的 sizes 属性未搭配 srcset，浏览器会忽略之，preload 无需输出
  // imagesizes（脱离 imagesrcset 会被忽略，见 createImagePreload）。
  for (const post of posts) {
    if (budgetExceeded()) {
      skippedPages.push(`/post/${post.id}`);
      continue;
    }
    const extraHead = post.coverImage ? createImagePreload(toAbsoluteUrl(post.coverImage, SITE_URL, BASE_PATH)) : '';
    try {
      await writePage(`/post/${post.id}`, `post/${post.id}`, extraHead);
    } catch (error) {
      failedPages.push({ url: `/post/${post.id}`, error: formatError(error) });
    }
  }
  logger.step(
    'Generated post pages',
    `count=${posts.length} failed=${failedPages.length} skipped=${skippedPages.length}`,
  );

  // 1.5 说说详情页：每条说说一个独立可索引页面 /shuoshuo/<id>（SSG 静态 HTML）。
  // 与文章页一致，正文随首帧 HTML 输出，爬虫/智能体无需执行 JS 即可读取。
  // 首图 preload 同文章封面：单变体 href 与 <img src> 一致，无 srcset 故不输出 imagesizes。
  for (const item of shuoshuoItems) {
    if (budgetExceeded()) {
      skippedPages.push(`/shuoshuo/${item.id}`);
      continue;
    }
    const firstImage = Array.isArray(item.images) ? item.images[0] : undefined;
    const extraHead = firstImage ? createImagePreload(toAbsoluteUrl(firstImage, SITE_URL, BASE_PATH)) : '';
    try {
      await writePage(`/shuoshuo/${item.id}`, `shuoshuo/${item.id}`, extraHead);
    } catch (error) {
      failedPages.push({ url: `/shuoshuo/${item.id}`, error: formatError(error) });
    }
  }
  logger.step(
    'Generated shuoshuo pages',
    `count=${shuoshuoItems.length} failed=${failedPages.filter((entry) => entry.url.startsWith('/shuoshuo/')).length} skipped=${skippedPages.filter((entry) => entry.startsWith('/shuoshuo/')).length}`,
  );

  // 2. 静态页面：SSR 渲染 + 附加结构化数据。
  for (const page of staticPages) {
    if (budgetExceeded()) {
      skippedPages.push(`/${page.path}`);
      continue;
    }
    // 页面级 schema 已由页面组件 Seo 的 structuredData 输出（about/shuoshuo/guestbook，
    // 以及 tags/archive/friends 等页），SSG 不再重复注入，避免同一 @type 出现两份 JSON-LD。
    const schema = page.schemaFromSeo ? '' : createStaticPageSchema(page);
    try {
      await writePage(`/${page.path}`, page.path, schema);
    } catch (error) {
      failedPages.push({ url: `/${page.path}`, error: formatError(error) });
    }
  }
  const staticSkipped = staticPages.filter((page) => skippedPages.includes(`/${page.path}`)).length;
  logger.step(
    'Generated static pages',
    `count=${staticPages.length} failed=${failedPages.filter((item) => staticPages.some((page) => item.url === `/${page.path}`)).length} skipped=${staticSkipped}`,
  );

  // 3. 首页。
  const homeHeroPost = (() => {
    const pinnedPosts = posts
      .filter((post) => post.featured === true && post['featured-top'] !== undefined)
      .sort((a, b) => a['featured-top'] - b['featured-top']);
    return pinnedPosts[0] || posts.find((post) => post.featured === true) || null;
  })();
  const homeExtraHead = homeHeroPost?.coverImage
    ? createImagePreload(toAbsoluteUrl(homeHeroPost.coverImage, SITE_URL, BASE_PATH))
    : '';
  if (budgetExceeded()) {
    skippedPages.push('/');
  } else {
    try {
      const { html: homeHtml, head: homeHead, routeData: homeRouteData } = await renderPage('/');
      const homeRouteDataScript = createRouteDataScript(homeRouteData);
      let homePage = injectRootContent(template, homeHtml);
      homePage = flattenSuspenseBoundaries(homePage);
      if (homeRouteDataScript) {
        homePage = homePage.replace(
          /<div\b[^>]*\bid=["']root["'][^>]*>/i,
          (match) => `${homeRouteDataScript}\n    ${match}`,
        );
      }
      writeStandaloneHtml('index.html', mergeHead(homePage, homeHead, `${homeExtraHead}${NOSCRIPT_FALLBACK}`));
      logger.step('Generated home page');
    } catch (error) {
      failedPages.push({ url: '/', error: formatError(error) });
    }
  }

  // 4. 我的收藏（本地数据页，页面自身 Seo 已带 noindex）。
  if (budgetExceeded()) {
    skippedPages.push('/favorites');
  } else {
    try {
      await writePage('/favorites', 'favorites');
    } catch (error) {
      failedPages.push({ url: '/favorites', error: formatError(error) });
    }
  }

  // 5. 404 页（根级独立 HTML，Cloudflare Pages 以 404.html 作为 404 响应）。
  // 渲染路径 /__missing__ 是占位路由，不能出现在 canonical 中，mergeHead 之后显式剥离。
  if (budgetExceeded()) {
    skippedPages.push('/__missing__');
  } else {
    try {
      const { html: notFoundHtml, head: notFoundHead } = await renderPage('/__missing__');
      const notFoundPage = injectRootContent(template, notFoundHtml);
      const flattenedNotFoundPage = flattenSuspenseBoundaries(notFoundPage);
      const mergedNotFoundPage = mergeHead(flattenedNotFoundPage, notFoundHead, NOSCRIPT_FALLBACK);
      writeStandaloneHtml(
        '404.html',
        mergedNotFoundPage.replace(/<link\b(?=[^>]*\brel\s*=\s*["']canonical["'])[^>]*\/?\s*>/i, ''),
      );
      logger.step('Generated 404 page');
    } catch (error) {
      failedPages.push({ url: '/__missing__', error: formatError(error) });
    }
  }

  // 汇总：任何页面失败都视为构建失败（但已生成页面保留供排查）；
  // skipped 仅因总预算截断，单独提示。
  if (skippedPages.length > 0) {
    logger.warn('Pages skipped due to total SSG budget', {
      count: skippedPages.length,
      firstFew: skippedPages.slice(0, 10),
    });
  }
  const totalPages = posts.length + staticPages.length + shuoshuoItems.length + 3;
  if (failedPages.length > 0) {
    for (const failed of failedPages) {
      logger.error('Page generation failed', `${failed.url}: ${failed.error}`);
    }
    logger.summary({
      pages: totalPages,
      posts: posts.length,
      shuoshuo: shuoshuoItems.length,
      static: staticPages.length,
      failed: failedPages.length,
      skipped: skippedPages.length,
      siteUrl: SITE_URL,
    });
    return false;
  }

  logger.summary({
    pages: totalPages,
    posts: posts.length,
    shuoshuo: shuoshuoItems.length,
    static: staticPages.length,
    skipped: skippedPages.length,
    siteUrl: SITE_URL,
  });

  return true;
};

if (process.argv[1] && path.resolve(process.argv[1]) === __filename) {
  runSsg()
    .then((ok) => {
      if (!ok) process.exitCode = 1;
    })
    .catch((error) => {
      // 顶层兜底：runSsg 内部任何未捕获异常都结构化记录后以非零码退出，
      // 避免未处理 rejection 以裸堆栈崩溃（原实现的隐患）。
      logger.error('SSG generation failed', formatError(error));
      process.exitCode = 1;
    });
}
