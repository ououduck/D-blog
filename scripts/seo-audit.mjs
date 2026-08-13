/**
 * SEO 审计脚本：对 dist 下所有生成的 HTML 页面执行大厂级 SEO 清单检查。
 * 用法：node scripts/seo-audit.mjs [distDir]
 * 检查项覆盖：文档元数据、OG/Twitter、结构化数据、链接、标题层级、图片 alt 等。
 */
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadSiteConfig } from './site-config-loader.mjs';

const distDir = process.argv[2] ?? join(fileURLToPath(new URL('.', import.meta.url)), '..', 'dist');
const SITE_URL = loadSiteConfig().url;

const walkHtml = (dir, base = dir) => {
  const results = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...walkHtml(full, base));
    } else if (entry.name.endsWith('.html')) {
      results.push(full);
    }
  }
  return results;
};

const files = walkHtml(distDir);
let errorCount = 0;
let warnCount = 0;
const issues = [];

const fail = (file, type, message) => {
  errorCount += 1;
  issues.push(`❌ ${type} ${file}: ${message}`);
};
const warn = (file, type, message) => {
  warnCount += 1;
  issues.push(`⚠️ ${type} ${file}: ${message}`);
};

for (const file of files) {
  let html = readFileSync(file, 'utf-8');
  // 剥离 HTML 注释，避免模板注释里的示例标签造成误报。
  html = html.replace(/<!--[\s\S]*?-->/g, '');
  const relativePath = relative(distDir, file).replace(/\\/g, '/');
  // 特例页：404 与 PWA 离线兜底页按“不可索引页面”对待，不参与正文级检查。
  const is404 = relativePath === '404.html';
  const isOffline = relativePath === 'offline.html';
  const isSpecial = is404 || isOffline;

  // ---- 不可索引页面：必须显式 noindex ----
  if (isSpecial) {
    const robots = html.match(/<meta\b[^>]*name=["']robots["'][^>]*>/i)?.[0] ?? '';
    if (!/noindex/i.test(robots)) fail(relativePath, 'robots', '特殊页（404/离线）必须显式 noindex');
    continue;
  }

  // ---- 文档级 ----
  const langMatch = html.match(/<html[^>]*\blang\s*=\s*["']([^"']+)["']/);
  if (!langMatch) fail(relativePath, 'html-lang', '缺少 <html lang>');
  else if (langMatch[1] !== 'zh-CN') warn(relativePath, 'html-lang', `lang="${langMatch[1]}"，预期 zh-CN`);

  const viewport = /<meta\b[^>]*name=["']viewport["']/.test(html);
  if (!viewport) fail(relativePath, 'viewport', '缺少 viewport meta');

  // ---- Title ----
  const titles = html.match(/<title[^>]*>([\s\S]*?)<\/title>/g) ?? [];
  if (titles.length === 0) fail(relativePath, 'title', '缺少 <title>');
  else if (titles.length > 1) fail(relativePath, 'title', `存在 ${titles.length} 个 <title>`);
  else {
    const text = titles[0].replace(/<[^>]+>/g, '').trim();
    if (!text) fail(relativePath, 'title', '<title> 为空');
    else if (text.length < 10 || text.length > 70) warn(relativePath, 'title', `title 长度 ${text.length}（建议 10-70）：${text}`);
  }

  // ---- Meta description ----
  // 文章页的摘录由作者撰写，Google 官方说明短摘录可接受（不足时按页面正文
  // 生成摘要），仅对 <20 字的贫瘠描述告警；其余页面按最佳实践 50-160 建议。
  const isPostPage = relativePath.startsWith('post/');
  const descs = html.match(/<meta\b[^>]*name=["']description["'][^>]*>/gi) ?? [];
  if (descs.length === 0) fail(relativePath, 'description', '缺少 meta description');
  else if (descs.length > 1) fail(relativePath, 'description', `存在 ${descs.length} 个 description`);
  else {
    const content = descs[0].match(/content=["']([\s\S]*?)["']/i)?.[1] ?? '';
    if (!content) fail(relativePath, 'description', 'description 为空');
    else if (isPostPage) {
      if (content.length < 20) warn(relativePath, 'description', `文章页 description 过短（${content.length} 字）`);
      else if (content.length > 160) warn(relativePath, 'description', `description 长度 ${content.length}（建议 ≤160）`);
    } else if (content.length < 50 || content.length > 160) {
      warn(relativePath, 'description', `description 长度 ${content.length}（建议 50-160）`);
    }
  }

  // ---- Robots ----
  const robots = html.match(/<meta\b[^>]*name=["']robots["'][^>]*>/i)?.[0];
  if (!robots) fail(relativePath, 'robots', '缺少 robots meta');
  else if (!/index,follow/.test(robots) && !/noindex/.test(robots)) warn(relativePath, 'robots', 'robots 指令不明确');

  // ---- Canonical ----
  const canonicals = html.match(/<link\b[^>]*rel=["']canonical["'][^>]*>/gi) ?? [];
  if (canonicals.length === 0) fail(relativePath, 'canonical', '缺少 canonical');
  else if (canonicals.length > 1) fail(relativePath, 'canonical', `存在 ${canonicals.length} 个 canonical`);
  else {
    const href = canonicals[0].match(/href=["']([^"']+)["']/i)?.[1];
    if (!href) fail(relativePath, 'canonical', 'canonical href 为空');
    else if (!href.startsWith(SITE_URL)) fail(relativePath, 'canonical', `canonical 非绝对站点 URL：${href}`);
  }

  // ---- RSS 自发现 ----
  const rss = /<link\b[^>]*rel=["']alternate["'][^>]*type=["']application\/rss\+xml["'][^>]*>/i.test(html);
  if (!rss) warn(relativePath, 'rss', '缺少 RSS 自发现 link');

  // ---- hreflang ----
  const hreflang = /<link\b[^>]*rel=["']alternate["'][^>]*hreflang=["']zh-CN["'][^>]*>/i.test(html);
  if (!hreflang) warn(relativePath, 'hreflang', '缺少 hreflang="zh-CN" 自引用（大厂站标配，谷歌据此理解语言目标）');

  // ---- Open Graph ----
  const ogProps = {};
  for (const [prop, name] of [
    ['og:title', 'title'], ['og:description', 'description'], ['og:type', 'type'],
    ['og:url', 'url'], ['og:image', 'image'], ['og:image:width', 'image:width'],
    ['og:image:height', 'image:height'], ['og:site_name', 'site_name'], ['og:locale', 'locale']
  ]) {
    const m = html.match(new RegExp(`<meta\\b[^>]*property=["']${prop}["'][^>]*>`, 'i'));
    ogProps[name] = m?.[0]?.match(/content=["']([\s\S]*?)["']/i)?.[1];
  }
  if (!ogProps.title) fail(relativePath, 'og', '缺少 og:title');
  if (!ogProps.description) fail(relativePath, 'og', '缺少 og:description');
  if (!ogProps.image) fail(relativePath, 'og', '缺少 og:image');
  else if (!/^https:\/\//.test(ogProps.image)) fail(relativePath, 'og', `og:image 非绝对 https URL：${ogProps.image}`);
  if (!ogProps.url) fail(relativePath, 'og', '缺少 og:url');
  else if (!ogProps.url.startsWith(SITE_URL)) fail(relativePath, 'og', `og:url 非站点 URL：${ogProps.url}`);
  if (ogProps.type !== 'website' && ogProps.type !== 'article') warn(relativePath, 'og', `og:type 异常：${ogProps.type}`);
  if (!ogProps['image:width'] || !ogProps['image:height']) warn(relativePath, 'og', 'og:image 缺少尺寸声明');

  // ---- Twitter card ----
  const twCard = /<meta\b[^>]*name=["']twitter:card["'][^>]*content=["']summary_large_image["']/i.test(html);
  if (!twCard) warn(relativePath, 'twitter', '缺少 twitter:card');

  // ---- JSON-LD ----
  const ldBlocks = html.match(/<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi) ?? [];
  if (ldBlocks.length === 0) fail(relativePath, 'jsonld', '缺少 JSON-LD 结构化数据');
  else {
    for (const block of ldBlocks) {
      try {
        const raw = block.replace(/^<script[^>]*>/i, '').replace(/<\/script>$/i, '');
        const parsed = JSON.parse(raw);
        const list = Array.isArray(parsed) ? parsed : [parsed];
        for (const item of list) {
          const type = item?.['@type'];
          if (type === 'BlogPosting') {
            if (!item.datePublished) warn(relativePath, 'jsonld', 'BlogPosting 缺少 datePublished');
            if (!item.author) fail(relativePath, 'jsonld', 'BlogPosting 缺少 author');
            if (!item.headline) fail(relativePath, 'jsonld', 'BlogPosting 缺少 headline');
            if (!item.image) warn(relativePath, 'jsonld', 'BlogPosting 缺少 image');
          }
          if (type === 'BreadcrumbList') {
            const items = item.itemListElement ?? [];
            if (items.length < 2) fail(relativePath, 'jsonld', 'BreadcrumbList 少于 2 项');
            items.forEach((it, i) => {
              if (it.position !== i + 1) fail(relativePath, 'jsonld', `BreadcrumbList position 跳号：预期 ${i + 1} 实际 ${it.position}`);
              if (!it.item) fail(relativePath, 'jsonld', `BreadcrumbList 第 ${i + 1} 项缺少 item`);
            });
          }
          if (type === 'WebSite') {
            if (!item.name) fail(relativePath, 'jsonld', 'WebSite 缺少 name');
            if (!item.url) fail(relativePath, 'jsonld', 'WebSite 缺少 url');
          }
          if (type === 'SearchAction' || type === 'ItemList' || type === 'CollectionPage') {
            // noop
          }
        }
      } catch (err) {
        fail(relativePath, 'jsonld', `JSON-LD 解析失败：${err.message.slice(0, 80)}`);
      }
    }
  }

  // ---- Heading 结构 ----
  const headings = [...html.matchAll(/<h([1-6])\b[^>]*>([\s\S]*?)<\/h\1>/gi)];
  const h1s = headings.filter((h) => h[1] === '1');
  if (h1s.length === 0) fail(relativePath, 'heading', '缺少 <h1>');
  else if (h1s.length > 1) fail(relativePath, 'heading', `存在 ${h1s.length} 个 <h1>`);
  else {
    const h1Text = h1s[0][2].replace(/<[^>]+>/g, '').trim();
    if (!h1Text) warn(relativePath, 'heading', '<h1> 文本为空');
  }
  let prevLevel = 1;
  for (const h of headings) {
    const level = Number(h[1]);
    if (level > prevLevel + 1) warn(relativePath, 'heading', `标题层级跳级：h${prevLevel} → h${level}`);
    prevLevel = level;
  }

  // ---- 图片 alt ----
  const imgs = [...html.matchAll(/<img\b[^>]*>/gi)];
  const missingAlt = imgs.filter((m) => !/\balt=["']/.test(m[0]) && !/aria-hidden/.test(m[0]));
  if (missingAlt.length > 0) warn(relativePath, 'img-alt', `${missingAlt.length}/${imgs.length} 张图片缺少 alt`);

  // ---- 内部链接 ----
  const links = [...html.matchAll(/<a\b[^>]*href=["']([^"']+)["']/gi)].map((m) => m[1]);
  const internalLinks = links.filter((href) => href.startsWith('/') || href.startsWith(SITE_URL));
  if (internalLinks.length === 0) warn(relativePath, 'links', '页面没有站内链接（内链对爬虫发现与权重传递重要）');
}

// ---- 汇总 ----
console.log(`\n=== SEO 审计报告 ===`);
console.log(`检查页面数：${files.length}`);
console.log(`错误：${errorCount}，警告：${warnCount}`);
console.log('');
for (const issue of issues) console.log(issue);
console.log('');
process.exitCode = errorCount > 0 ? 1 : 0;
