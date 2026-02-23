import fs from 'fs';
import path from 'path';
import matter from 'gray-matter';
import { fileURLToPath } from 'url';

// ================= 配置区域 =================
const SITE_URL = 'https://blog.pldduck.com'; 
const SITE_TITLE = 'D-blog';
const SITE_DESCRIPTION = '跑路的duck的技术分享和生活随笔';
// ===========================================

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const POSTS_DIR = path.join(__dirname, '../posts');
// JSON 生成到根目录下的 generated 文件夹
const OUTPUT_JSON_DIR = path.join(__dirname, '../generated');
// XML 文件输出到 public 目录
const PUBLIC_DIR = path.join(__dirname, '../public');

// 确保目录存在
if (!fs.existsSync(OUTPUT_JSON_DIR)) fs.mkdirSync(OUTPUT_JSON_DIR, { recursive: true });
if (!fs.existsSync(PUBLIC_DIR)) fs.mkdirSync(PUBLIC_DIR, { recursive: true });

// 1. 读取并处理文章
const files = fs.readdirSync(POSTS_DIR).filter(file => file.endsWith('.md'));
const posts = files.map(filename => {
  const filePath = path.join(POSTS_DIR, filename);
  const fileContent = fs.readFileSync(filePath, 'utf-8');
  const { data } = matter(fileContent);
  
  const id = data.id || filename.replace(/\.md$/, '');

  let formattedDate = data.date;
  if (data.date instanceof Date) {
     // 转换成 YYYY-MM-DD 格式
     const year = data.date.getFullYear();
     const month = String(data.date.getMonth() + 1).padStart(2, '0');
     const day = String(data.date.getDate()).padStart(2, '0');
     formattedDate = `${year}-${month}-${day}`;
  }

  return {
    ...data,
    date: formattedDate, // 使用格式化后的日期
    id,
    filePath: `/posts/${filename}`
  };
}).sort((a, b) => new Date(b.date) - new Date(a.date));

// 2. 写入 posts.json (供前端使用)
fs.writeFileSync(path.join(OUTPUT_JSON_DIR, 'posts.json'), JSON.stringify(posts, null, 2));
console.log(`✅ JSON Generated: ${posts.length} posts`);

// 3. 生成 Sitemap.xml
const generateSitemap = () => {
  const staticPages = ['', 'friends', 'about']; 
  
  const sitemapContent = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  ${staticPages.map(page => `
  <url>
    <loc>${SITE_URL}/${page}</loc>
    <changefreq>weekly</changefreq>
    <priority>${page === '' ? '1.0' : '0.8'}</priority>
  </url>`).join('')}
  ${posts.map(post => `
  <url>
    <loc>${SITE_URL}/#/post/${post.id}</loc>
    <lastmod>${new Date(post.date).toISOString().split('T')[0]}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.7</priority>
  </url>`).join('')}
</urlset>`;

  fs.writeFileSync(path.join(PUBLIC_DIR, 'sitemap.xml'), sitemapContent);
  console.log(`✅ Sitemap Generated`);
};

// 4. 生成 RSS Feed (feed.xml)
const generateRss = () => {
  const rssContent = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${SITE_TITLE}</title>
    <link>${SITE_URL}</link>
    <description>${SITE_DESCRIPTION}</description>
    <language>zh-CN</language>
    <atom:link href="${SITE_URL}/feed.xml" rel="self" type="application/rss+xml" />
    ${posts.map(post => `
    <item>
      <title><![CDATA[${post.title}]]></title>
      <link>${SITE_URL}/#/post/${post.id}</link>
      <guid isPermaLink="true">${SITE_URL}/#/post/${post.id}</guid>
      <description><![CDATA[${post.excerpt}]]></description>
      <pubDate>${new Date(post.date).toUTCString()}</pubDate>
      <category>${post.category}</category>
    </item>`).join('')}
  </channel>
</rss>`;

  fs.writeFileSync(path.join(PUBLIC_DIR, 'feed.xml'), rssContent);
  console.log(`✅ RSS Feed Generated`);
};

generateSitemap();
generateRss();