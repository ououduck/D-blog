import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DIST_DIR = path.join(__dirname, '../dist');
const POSTS_FILE = path.join(__dirname, '../generated/posts.json');
const SITE_CONFIG_FILE = path.join(__dirname, '../config/site.config.ts');

// Extract Site Config
let siteTitle = 'D-blog';
let authorName = '跑路的duck';

if (fs.existsSync(SITE_CONFIG_FILE)) {
  const configContent = fs.readFileSync(SITE_CONFIG_FILE, 'utf-8');
  
  // Extract title
  const titleMatch = configContent.match(/title:\s*["']([^"']+)["']/);
  if (titleMatch) siteTitle = titleMatch[1];
  
  // Extract author name
  // Looking for author: { ... name: "..." }
  const authorBlockMatch = configContent.match(/author:\s*{[\s\S]*?}/);
  if (authorBlockMatch) {
    const authorBlock = authorBlockMatch[0];
    const nameMatch = authorBlock.match(/name:\s*["']([^"']+)["']/);
    if (nameMatch) authorName = nameMatch[1];
  }
}

const SITE_SUFFIX = `${siteTitle} | ${authorName}`;


// Check if dist exists
if (!fs.existsSync(DIST_DIR)) {
  console.error('❌ Error: dist directory not found. Please run "npm run build" first.');
  process.exit(1);
}

// Read template
const indexHtmlPath = path.join(DIST_DIR, 'index.html');
if (!fs.existsSync(indexHtmlPath)) {
  console.error('❌ Error: dist/index.html not found.');
  process.exit(1);
}
const template = fs.readFileSync(indexHtmlPath, 'utf-8');

// Read posts
if (!fs.existsSync(POSTS_FILE)) {
  console.error('❌ Error: generated/posts.json not found. Please run "npm run gen:data" first.');
  process.exit(1);
}
const posts = JSON.parse(fs.readFileSync(POSTS_FILE, 'utf-8'));

// Helper to write file
const writeHtml = (relativePath, title, description) => {
  const filePath = path.join(DIST_DIR, relativePath, 'index.html');
  const dir = path.dirname(filePath);
  
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  let html = template;
  
  // Replace Title
  // Using regex to match <title>...</title>
  html = html.replace(/<title>.*?<\/title>/, `<title>${title}</title>`);
  
  // Replace Description
  if (description) {
    // Escape quotes in description
    const safeDesc = description.replace(/"/g, '&quot;');
    const metaDescTag = `<meta name="description" content="${safeDesc}">`;
    
    if (html.includes('<meta name="description"')) {
      html = html.replace(/<meta name="description" content=".*?">/, metaDescTag);
    } else {
      // Insert after title if not exists
      html = html.replace('</title>', `</title>\n    ${metaDescTag}`);
    }
  }

  fs.writeFileSync(filePath, html);
  console.log(`✅ Generated: ${relativePath}/index.html`);
};

console.log('🚀 Starting Pre-rendering...');

// 1. Process Blog Posts
posts.forEach(post => {
  // URL structure: /post/:id
  const title = `${post.title} - ${SITE_SUFFIX}`;
  const description = post.excerpt || post.title;
  writeHtml(`post/${post.id}`, title, description);
});

// 2. Process Static Pages
const staticPages = [
  { path: 'archive', title: `归档 - ${SITE_SUFFIX}`, description: `按年份整理 ${siteTitle} 的全部文章归档` },
  { path: 'tags', title: `标签 - ${SITE_SUFFIX}`, description: `按标签浏览 ${siteTitle} 的文章` },
  { path: 'stats', title: `统计 - ${SITE_SUFFIX}`, description: `基于 Cloudflare Analytics API 生成的站点统计快照` },
  { path: 'about', title: `关于${siteTitle} - ${SITE_SUFFIX}`, description: `关于${siteTitle}的介绍` },
  { path: 'friends', title: `友情链接 - ${SITE_SUFFIX}`, description: `我的朋友们和推荐的网站` }
];

staticPages.forEach(page => {
  writeHtml(page.path, page.title, page.description);
});

console.log(`✨ Prerendering complete! Generated ${posts.length + staticPages.length} pages.`);
