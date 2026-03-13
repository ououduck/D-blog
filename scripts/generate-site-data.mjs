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
const CLOUDFLARE_FILE = path.join(OUTPUT_JSON_DIR, 'cloudflare.json');

if (!fs.existsSync(OUTPUT_JSON_DIR)) fs.mkdirSync(OUTPUT_JSON_DIR, { recursive: true });
if (!fs.existsSync(PUBLIC_DIR)) fs.mkdirSync(PUBLIC_DIR, { recursive: true });

const writeCloudflareSnapshot = (snapshot) => {
  fs.writeFileSync(CLOUDFLARE_FILE, JSON.stringify(snapshot, null, 2));
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

const generateCloudflareSnapshot = async () => {
  const token = process.env.CLOUDFLARE_API_TOKEN?.trim();
  const zoneId = process.env.CLOUDFLARE_ZONE_ID?.trim();

  if (!token || !zoneId) {
    const emptySnapshot = {
      enabled: false,
      fetchedAt: null,
      domain: 'blog.pldduck.com',
      timeWindows: []
    };
    writeCloudflareSnapshot(emptySnapshot);
    console.log('ℹ️ Cloudflare Analytics skipped: missing CLOUDFLARE_API_TOKEN or CLOUDFLARE_ZONE_ID');
    return;
  }

  const snapshot = {
    enabled: true,
    fetchedAt: new Date().toISOString(),
    domain: 'blog.pldduck.com',
    timeWindows: []
  };

  const timeWindows = [1, 7, 30];

  for (const days of timeWindows) {
    const now = new Date();
    const since = new Date(now);
    since.setDate(since.getDate() - days);
    const sinceStr = since.toISOString().split('T')[0];
    const untilStr = now.toISOString().split('T')[0];

    try {
      // Fetch analytics totals
      const totalsQuery = `
        query {
          viewer {
            zones(filter: { zoneTag: "${zoneId}" }) {
              httpRequests1dGroups(
                limit: ${days + 1}
                filter: { date_geq: "${sinceStr}", date_leq: "${untilStr}" }
              ) {
                sum {
                  requests
                  pageViews
                  bytes
                }
                uniq {
                  uniques
                }
              }
            }
          }
        }
      `;

      const totalsResponse = await fetch('https://api.cloudflare.com/client/v4/graphql', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ query: totalsQuery })
      });

      if (!totalsResponse.ok) {
        throw new Error(`API request failed with status ${totalsResponse.status}`);
      }

      const totalsData = await totalsResponse.json();
      const groups = totalsData?.data?.viewer?.zones?.[0]?.httpRequests1dGroups || [];
      
      const totals = groups.reduce((acc, group) => ({
        requests: acc.requests + (group.sum?.requests || 0),
        pageViews: acc.pageViews + (group.sum?.pageViews || 0),
        bandwidth: acc.bandwidth + (group.sum?.bytes || 0),
        uniques: acc.uniques + (group.uniq?.uniques || 0)
      }), { requests: 0, pageViews: 0, bandwidth: 0, uniques: 0 });

      // Fetch top pages
      const pagesQuery = `
        query {
          viewer {
            zones(filter: { zoneTag: "${zoneId}" }) {
              httpRequests1dGroups(
                limit: 10000
                filter: { date_geq: "${sinceStr}", date_leq: "${untilStr}" }
                orderBy: [sum_requests_DESC]
              ) {
                dimensions {
                  clientRequestPath
                }
                sum {
                  requests
                  pageViews
                }
              }
            }
          }
        }
      `;

      const pagesResponse = await fetch('https://api.cloudflare.com/client/v4/graphql', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ query: pagesQuery })
      });

      const pagesData = await pagesResponse.json();
      const pagesGroups = pagesData?.data?.viewer?.zones?.[0]?.httpRequests1dGroups || [];
      
      const pathMap = new Map();
      pagesGroups.forEach(group => {
        const path = group.dimensions?.clientRequestPath || '/';
        const existing = pathMap.get(path) || { requests: 0, pageViews: 0 };
        pathMap.set(path, {
          requests: existing.requests + (group.sum?.requests || 0),
          pageViews: existing.pageViews + (group.sum?.pageViews || 0)
        });
      });

      const topPages = Array.from(pathMap.entries())
        .map(([path, data]) => ({ path, ...data }))
        .sort((a, b) => b.pageViews - a.pageViews)
        .slice(0, 20);

      // Fetch top countries
      const countriesQuery = `
        query {
          viewer {
            zones(filter: { zoneTag: "${zoneId}" }) {
              httpRequests1dGroups(
                limit: 10000
                filter: { date_geq: "${sinceStr}", date_leq: "${untilStr}" }
                orderBy: [sum_requests_DESC]
              ) {
                dimensions {
                  clientCountryName
                }
                sum {
                  requests
                }
              }
            }
          }
        }
      `;

      const countriesResponse = await fetch('https://api.cloudflare.com/client/v4/graphql', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ query: countriesQuery })
      });

      const countriesData = await countriesResponse.json();
      const countriesGroups = countriesData?.data?.viewer?.zones?.[0]?.httpRequests1dGroups || [];
      
      const countryMap = new Map();
      countriesGroups.forEach(group => {
        const country = group.dimensions?.clientCountryName || 'Unknown';
        const existing = countryMap.get(country) || 0;
        countryMap.set(country, existing + (group.sum?.requests || 0));
      });

      const topCountries = Array.from(countryMap.entries())
        .map(([country, requests]) => ({ country, requests }))
        .sort((a, b) => b.requests - a.requests)
        .slice(0, 20);

      snapshot.timeWindows.push({
        days,
        data: totals,
        topPages,
        topCountries,
        error: null
      });

      console.log(`✅ Cloudflare data fetched for ${days} days: ${totals.pageViews} page views, ${topPages.length} pages`);
    } catch (error) {
      console.warn(`⚠️ Cloudflare Analytics failed for ${days} days: ${error.message}`);
      snapshot.timeWindows.push({
        days,
        data: { requests: 0, pageViews: 0, bandwidth: 0, uniques: 0 },
        topPages: [],
        topCountries: [],
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  writeCloudflareSnapshot(snapshot);
  console.log(`✅ Cloudflare Snapshot Generated with ${snapshot.timeWindows.length} time windows`);
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

await generateCloudflareSnapshot();
generateSitemap();
generateRss();

// Copy Cloudflare Pages configuration files to public directory
const cfConfigFiles = ['_redirects', '_headers', '_routes.json'];
cfConfigFiles.forEach(file => {
  const srcPath = path.join(__dirname, '..', file);
  const destPath = path.join(PUBLIC_DIR, file);
  if (fs.existsSync(srcPath)) {
    fs.copyFileSync(srcPath, destPath);
    console.log(`✅ Copied ${file} to public/`);
  }
});
