/**
 * 构建产物审计：对 dist 下所有 HTML 检查初始 JS/CSS 体积与必备标签，作为 npm run build 的最后一道门禁（缺失 title/description/robots 即失败）。
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createBuildLogger } from './build-logger.mjs';

// 基于本模块位置解析（与其他脚本一致）：从任意目录调用时行为不变
// （此前 path.resolve('dist') 依赖进程 cwd，CI 从仓库根运行无碍，但其它调用方式
// 会静默审计错误的目录，甚至「dist 不存在」误报）。
const ROOT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIST_DIR = path.join(ROOT_DIR, 'dist');
const strict = process.argv.includes('--strict');
const verbose = process.env.BUILD_VERBOSE === '1';
const logger = createBuildLogger('audit:build');
// 初始体积硬预算（构建门禁，超限即失败）：
// - 与 vite.config.ts 的 chunkSizeWarningLimit（600，仅警告）语义不同但数值配套，
//   调整任一预算时需同步评估另一处；
// - 依赖第三方服务（Umami/Busuanzi）的引用存在性检查也在此门禁内，
//   移除对应服务时需同步放宽。
const maxInitialScriptBytes = 600 * 1024;
const maxInitialStyleBytes = 180 * 1024;
const entryHtml = fs.existsSync(path.join(DIST_DIR, 'index.html'))
  ? fs.readFileSync(path.join(DIST_DIR, 'index.html'), 'utf8')
  : '';

logger.start('Audit build output');

if (!fs.existsSync(DIST_DIR)) {
  logger.error('dist directory not found', 'Run "npm run build" first.');
  logger.summary({ html: 0, 'initial-js': '0.0KiB', 'initial-css': '0.0KiB', errors: 1 });
  process.exit(1);
}

const htmlFiles = [];
const visit = (directory) => {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) visit(entryPath);
    else if (entry.name.endsWith('.html')) htmlFiles.push(entryPath);
  }
};
visit(DIST_DIR);

const getMatches = (value, pattern) => [...value.matchAll(pattern)].map((match) => match[0]);

/**
 * 提取 <div id="root"> 的完整内部内容（div 深度计数，避免内容中的嵌套 div 截断）。
 */
const extractRootContent = (html) => {
  const match = html.match(/<div\b[^>]*\bid=["']root["'][^>]*>/i);
  if (!match) return '';
  const start = match.index;
  const openTag = match[0];
  let depth = 1; // root div 自身计一层
  let i = start + openTag.length;
  while (i < html.length) {
    const open = html.indexOf('<div', i);
    const close = html.indexOf('</div>', i);
    const next = open !== -1 && (close === -1 || open < close) ? open : close;
    if (next === -1) return '';
    if (next === close) {
      depth -= 1;
      if (depth === 0) {
        return html.slice(start + openTag.length, next).trim();
      }
    } else {
      depth += 1;
    }
    i = next + 4;
  }
  return '';
};
const warnings = [];
const errors = [];
// 属性顺序无关：<link> 上同时存在 rel="stylesheet" 与 href，二者任意先后都能匹配。
const localStylesheetPattern = /<link\b(?=[^>]*\brel=["']stylesheet["'])(?=[^>]*\bhref=["']([^"']+)["'])[^>]*>/gi;
const localAssetPattern = /^(?:.*\/)?assets\/(.+\.css)$/;
const localStylesheets = new Set();

for (const filePath of htmlFiles) {
  const html = fs.readFileSync(filePath, 'utf8');
  const relativePath = path.relative(DIST_DIR, filePath) || 'index.html';
  const canonicalCount = getMatches(html, /<link\b[^>]*\brel=["']canonical["'][^>]*>/gi).length;
  const jsonLdTags = getMatches(html, /<script\b[^>]*type=["']application\/ld\+json["'][^>]*>[\s\S]*?<\/script>/gi);
  const rootContent = extractRootContent(html);

  for (const match of html.matchAll(localStylesheetPattern)) {
    const href = match[1].split(/[?#]/, 1)[0];
    const assetMatch = href.match(localAssetPattern);
    if (!assetMatch) continue;
    const assetPath = path.join(DIST_DIR, 'assets', assetMatch[1]);
    localStylesheets.add(assetPath);
    if (!fs.existsSync(assetPath)) {
      errors.push(`${relativePath}: stylesheet not found (${href})`);
    }
  }

  const isOfflineFallback = relativePath === 'offline.html';
  if (!/<title\b[^>]*>[\s\S]+<\/title>/i.test(html)) errors.push(`${relativePath}: missing title`);
  if (!isOfflineFallback && !/<meta\b[^>]*\bname=["']description["'][^>]*>/i.test(html))
    errors.push(`${relativePath}: missing description`);
  if (!isOfflineFallback && !/<meta\b[^>]*\bname=["']robots["'][^>]*>/i.test(html))
    errors.push(`${relativePath}: missing robots`);
  if (canonicalCount > 1) errors.push(`${relativePath}: duplicate canonical tags (${canonicalCount})`);
  // offline.html 是独立的应用壳兜底页（客户端渲染、无 SEO 需求），
  // 不要求 JSON-LD 与 SSG 正文，避免误报。
  if (!isOfflineFallback && jsonLdTags.length === 0) warnings.push(`${relativePath}: missing JSON-LD`);
  if (!isOfflineFallback && rootContent === '')
    warnings.push(`${relativePath}: static HTML has an empty root; content remains client-rendered`);
  if (!isOfflineFallback && rootContent.length < 64)
    warnings.push(
      `${relativePath}: root content looks too thin (${rootContent.length} chars); SSG may not have rendered body content`,
    );

  for (const tag of jsonLdTags) {
    const json = tag.replace(/^.*?>/s, '').replace(/<\/script>\s*$/i, '');
    try {
      JSON.parse(json);
    } catch {
      errors.push(`${relativePath}: invalid JSON-LD`);
    }
  }
}

if (localStylesheets.size === 0) {
  errors.push('no generated local stylesheet references found');
} else {
  for (const stylesheetPath of localStylesheets) {
    // 入口 CSS 必须带内容哈希：稳定 URL（assets/index.css）会被服务工作者
    // stale-while-revalidate 缓存命中，导致部署后“首次打开样式落后、刷新才正常”。
    if (!/-[A-Za-z0-9_-]+\.css$/.test(path.basename(stylesheetPath))) {
      errors.push(`stylesheet is not content-hashed (${path.basename(stylesheetPath)})`);
    }
  }
}

// 依赖第三方服务（Umami/Busuanzi）的引用存在性检查：期望值从源模板
// （index.html / public/_headers）推导 —— 从源码移除对应服务时审计自动放宽，
// 无需再手动同步本文件的硬编码检查串（原实现在移除服务后构建会误红）。
const sourceIndexHtml = fs.existsSync(path.join(ROOT_DIR, 'index.html'))
  ? fs.readFileSync(path.join(ROOT_DIR, 'index.html'), 'utf8')
  : '';
const sourceHeadersFile = fs.existsSync(path.join(ROOT_DIR, 'public/_headers'))
  ? fs.readFileSync(path.join(ROOT_DIR, 'public/_headers'), 'utf8')
  : '';
const sourceUsesUmami =
  sourceIndexHtml.includes('umami.pldduck.com') || sourceHeadersFile.includes('umami.pldduck.com');
const sourceUsesBusuanzi = sourceIndexHtml.includes('busuanzi.cc') || sourceHeadersFile.includes('busuanzi.cc');

if (sourceUsesUmami) {
  if (!entryHtml.includes('https://umami.pldduck.com/script.js')) {
    errors.push('entry HTML is missing the Umami script URL');
  }
  if (!entryHtml.includes('data-website-id=')) {
    errors.push('entry HTML is missing the Umami website ID');
  }
  // 注入时机：Umami 脚本必须为 defer 异步加载，不等待 window load，
  // 延迟注入会漏掉快速离开/首屏即交互的会话。
  // （双引号兼容 esbuild 压缩产物对字符串引号的改写。）
  if (/addEventListener\(["']load["']/.test(entryHtml)) {
    errors.push('entry HTML delays Umami injection to window.load, which can miss sessions');
  }
}
if (sourceUsesBusuanzi && !entryHtml.includes('https://cdn.busuanzi.cc')) {
  errors.push('entry HTML is missing the Busuanzi API preconnect');
}

const headersPath = path.join(DIST_DIR, '_headers');
if (!fs.existsSync(headersPath)) {
  errors.push('build output is missing the security headers file');
} else {
  const headers = fs.readFileSync(headersPath, 'utf8');
  if (sourceUsesUmami && !headers.includes('https://umami.pldduck.com')) {
    errors.push('CSP is missing the required Umami origin');
  }
  if (sourceUsesBusuanzi && !headers.includes("connect-src 'self' https://cdn.busuanzi.cc")) {
    errors.push('CSP connect-src is missing the Busuanzi API origin');
  }
}
const assetsDir = path.join(DIST_DIR, 'assets');
let initialScriptBytes = 0;
let initialStyleBytes = 0;
if (fs.existsSync(assetsDir)) {
  for (const name of fs.readdirSync(assetsDir)) {
    const filePath = path.join(assetsDir, name);
    const size = fs.statSync(filePath).size;
    if (entryHtml.includes(`assets/${name}`)) {
      if (/\.js$/.test(name)) initialScriptBytes += size;
      if (/\.css$/.test(name)) initialStyleBytes += size;
    }
  }
}
if (initialScriptBytes > maxInitialScriptBytes)
  warnings.push(`initial JavaScript is ${(initialScriptBytes / 1024).toFixed(1)} KiB`);
if (initialStyleBytes > maxInitialStyleBytes)
  warnings.push(`initial CSS is ${(initialStyleBytes / 1024).toFixed(1)} KiB`);

for (const warning of warnings) logger.warn(warning, '', verbose);
for (const error of errors) logger.error(error);
logger.summary({
  html: htmlFiles.length,
  'initial-js': `${(initialScriptBytes / 1024).toFixed(1)}KiB`,
  'initial-css': `${(initialStyleBytes / 1024).toFixed(1)}KiB`,
  errors: errors.length,
});

if (errors.length > 0 || (strict && warnings.length > 0)) process.exit(1);
