import 'dotenv/config';
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
const FRIENDS_DIR = path.join(__dirname, '../friends');
const OUTPUT_JSON_DIR = path.join(__dirname, '../generated');
const PUBLIC_DIR = path.join(__dirname, '../public');
const CLARITY_FILE = path.join(OUTPUT_JSON_DIR, 'clarity.json');

if (!fs.existsSync(OUTPUT_JSON_DIR)) fs.mkdirSync(OUTPUT_JSON_DIR, { recursive: true });
if (!fs.existsSync(PUBLIC_DIR)) fs.mkdirSync(PUBLIC_DIR, { recursive: true });

const clarityDays = (() => {
  const raw = Number.parseInt(process.env.CLARITY_EXPORT_DAYS || '1', 10);
  if ([1, 2, 3].includes(raw)) {
    return raw;
  }
  return 1;
})();

const clarityDimensions = [
  process.env.CLARITY_DIMENSION_1?.trim(),
  process.env.CLARITY_DIMENSION_2?.trim(),
  process.env.CLARITY_DIMENSION_3?.trim()
].filter(Boolean);

const writeClaritySnapshot = (snapshot) => {
  fs.writeFileSync(CLARITY_FILE, JSON.stringify(snapshot, null, 2));
};

const files = fs.readdirSync(POSTS_DIR).filter(file => file.endsWith('.md'));
const posts = files.map(filename => {
  const filePath = path.join(POSTS_DIR, filename);
  const fileContent = fs.readFileSync(filePath, 'utf-8');
  const { data } = matter(fileContent);

  const id = data.id || filename.replace(/\.md$/, '');

  let formattedDate = data.date;
  if (data.date instanceof Date) {
    const year = data.date.getFullYear();
    const month = String(data.date.getMonth() + 1).padStart(2, '0');
    const day = String(data.date.getDate()).padStart(2, '0');
    formattedDate = `${year}-${month}-${day}`;
  }

  return {
    ...data,
    date: formattedDate,
    id,
    filePath: `/posts/${filename}`
  };
}).sort((a, b) => new Date(b.date) - new Date(a.date));

fs.writeFileSync(path.join(OUTPUT_JSON_DIR, 'posts.json'), JSON.stringify(posts, null, 2));
console.log(`✅ JSON Generated: ${posts.length} posts`);

const requiredFriendFields = ['name', 'description', 'avatar', 'url'];
const friendFiles = fs.existsSync(FRIENDS_DIR)
  ? fs.readdirSync(FRIENDS_DIR).filter(file => file.endsWith('.json'))
  : [];

const friends = friendFiles.flatMap(filename => {
  const filePath = path.join(FRIENDS_DIR, filename);

  try {
    const rawContent = fs.readFileSync(filePath, 'utf-8');
    const data = JSON.parse(rawContent);
    const missingFields = requiredFriendFields.filter(field => typeof data[field] !== 'string' || data[field].trim() === '');

    if (missingFields.length > 0) {
      console.warn(`⚠️ Skip invalid friend file ${filename}: missing ${missingFields.join(', ')}`);
      return [];
    }

    return [{
      name: data.name.trim(),
      description: data.description.trim(),
      avatar: data.avatar.trim(),
      url: data.url.trim()
    }];
  } catch (error) {
    console.warn(`⚠️ Skip invalid friend file ${filename}: ${error.message}`);
    return [];
  }
});

fs.writeFileSync(path.join(OUTPUT_JSON_DIR, 'friends.json'), JSON.stringify(friends, null, 2));
console.log(`✅ JSON Generated: ${friends.length} friends`);

const generateClaritySnapshot = async () => {
  const snapshot = {
    enabled: false,
    fetchedAt: null,
    request: {
      numOfDays: clarityDays,
      dimensions: clarityDimensions
    },
    metrics: [],
    error: null
  };

  const token = process.env.CLARITY_API_TOKEN?.trim();
  if (!token) {
    writeClaritySnapshot(snapshot);
    console.log('ℹ️ Clarity Export skipped: missing CLARITY_API_TOKEN');
    return;
  }

  const params = new URLSearchParams({
    numOfDays: String(clarityDays)
  });

  clarityDimensions.forEach((dimension, index) => {
    params.set(`dimension${index + 1}`, dimension);
  });

  try {
    const response = await fetch(`https://www.clarity.ms/export-data/api/v1/project-live-insights?${params.toString()}`, {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });

    snapshot.enabled = true;
    snapshot.fetchedAt = new Date().toISOString();

    if (!response.ok) {
      snapshot.error = `Clarity Export API request failed with status ${response.status}`;
      writeClaritySnapshot(snapshot);
      console.warn(`⚠️ ${snapshot.error}`);
      return;
    }

    const payload = await response.json();
    snapshot.metrics = Array.isArray(payload) ? payload : [];

    if (!Array.isArray(payload)) {
      snapshot.error = 'Clarity Export API returned an unexpected payload.';
    }

    writeClaritySnapshot(snapshot);
    console.log(`✅ Clarity Snapshot Generated: ${snapshot.metrics.length} metrics`);
  } catch (error) {
    snapshot.enabled = true;
    snapshot.fetchedAt = new Date().toISOString();
    snapshot.error = error instanceof Error ? error.message : 'Unknown Clarity Export API error.';
    writeClaritySnapshot(snapshot);
    console.warn(`⚠️ Clarity Export failed: ${snapshot.error}`);
  }
};

const generateSitemap = () => {
  const staticPages = ['', 'archive', 'stats', 'friends', 'about'];

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
    <loc>${SITE_URL}/post/${post.id}</loc>
    <lastmod>${new Date(post.date).toISOString().split('T')[0]}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.7</priority>
  </url>`).join('')}
</urlset>`;

  fs.writeFileSync(path.join(PUBLIC_DIR, 'sitemap.xml'), sitemapContent);
  console.log('✅ Sitemap Generated');
};

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
      <link>${SITE_URL}/post/${post.id}</link>
      <guid isPermaLink="true">${SITE_URL}/post/${post.id}</guid>
      <description><![CDATA[${post.excerpt}]]></description>
      <pubDate>${new Date(post.date).toUTCString()}</pubDate>
      <category>${post.category}</category>
    </item>`).join('')}
  </channel>
</rss>`;

  fs.writeFileSync(path.join(PUBLIC_DIR, 'feed.xml'), rssContent);
  console.log('✅ RSS Feed Generated');
};

await generateClaritySnapshot();
generateSitemap();
generateRss();
