import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import matter from 'gray-matter';
import { fileURLToPath } from 'url';

const SITE_URL = 'https://blog.pldduck.com';
const SITE_TITLE = 'D-blog';
const SITE_DESCRIPTION = '跑路的duck的技术分享和生活随笔';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const POSTS_DIR = path.join(__dirname, '../posts');
const FRIENDS_DIR = path.join(__dirname, '../friends');
const OUTPUT_JSON_DIR = path.join(__dirname, '../generated');
const PUBLIC_DIR = path.join(__dirname, '../public');
const CLOUDFLARE_FILE = path.join(OUTPUT_JSON_DIR, 'cloudflare.json');
const UMAMI_FILE = path.join(OUTPUT_JSON_DIR, 'umami.json');

if (!fs.existsSync(OUTPUT_JSON_DIR)) {
  fs.mkdirSync(OUTPUT_JSON_DIR, { recursive: true });
}

if (!fs.existsSync(PUBLIC_DIR)) {
  fs.mkdirSync(PUBLIC_DIR, { recursive: true });
}

const markdownToSearchText = (markdown) =>
  markdown
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`[^`]*`/g, ' ')
    .replace(/!\[[^\]]*]\([^)]+\)/g, ' ')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '$1')
    .replace(/<[^>]+>/g, ' ')
    .replace(/[#>*_~|-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const countWords = (markdown) => {
  const plainText = markdownToSearchText(markdown);
  const hanCharacters = (plainText.match(/[\u4e00-\u9fff]/g) || []).length;
  const latinWords = (plainText.replace(/[\u4e00-\u9fff]/g, ' ').match(/[A-Za-z0-9_]+/g) || []).length;
  return hanCharacters + latinWords;
};

const countImages = (markdown) => (markdown.match(/!\[[^\]]*\]\([^)]+\)/g) || []).length;

const normalizeTags = (value) => {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((tag) => String(tag).trim())
    .filter(Boolean);
};

const generateSiteStats = (postsWithSearch) => {
  const totalPosts = postsWithSearch.length;
  const totalWords = postsWithSearch.reduce((sum, post) => sum + (post.wordCount || 0), 0);
  const totalCategories = new Set(postsWithSearch.map((post) => post.category)).size;
  const totalTags = new Set(postsWithSearch.flatMap((post) => post.tags || [])).size;
  const totalImages = postsWithSearch.reduce((sum, post) => sum + (post.imageCount || 0), 0);

  fs.writeFileSync(
    path.join(OUTPUT_JSON_DIR, 'site-stats.json'),
    JSON.stringify(
      {
        totalPosts,
        totalWords,
        totalCategories,
        totalTags,
        totalImages
      },
      null,
      2
    )
  );

  console.log('JSON generated: site stats');
};

const calculateReadTime = (markdown) => {
  const plainText = markdownToSearchText(markdown);
  const hanCharacters = (plainText.match(/[\u4e00-\u9fff]/g) || []).length;
  const latinWords = (plainText.replace(/[\u4e00-\u9fff]/g, ' ').match(/[A-Za-z0-9_]+/g) || []).length;
  const readingUnits = hanCharacters + latinWords;
  const minutes = Math.max(1, Math.ceil(readingUnits / 300));

  return `${minutes}分钟阅读`;
};

const normalizeAuthor = (value) => {
  if (typeof value === 'string') {
    const name = value.trim();
    return name ? { name } : null;
  }

  if (!value || typeof value !== 'object') {
    return null;
  }

  if (typeof value.name !== 'string' || value.name.trim() === '') {
    return null;
  }

  return {
    name: value.name.trim(),
    avatar: typeof value.avatar === 'string' && value.avatar.trim() ? value.avatar.trim() : undefined,
    role: typeof value.role === 'string' && value.role.trim() ? value.role.trim() : undefined,
    bio: typeof value.bio === 'string' && value.bio.trim() ? value.bio.trim() : undefined,
    url: typeof value.url === 'string' && value.url.trim() ? value.url.trim() : undefined
  };
};

const normalizeAuthors = (author, authors) => {
  const rawAuthors = [
    ...(Array.isArray(authors) ? authors : authors ? [authors] : []),
    ...(author ? [author] : [])
  ];

  const normalizedAuthors = rawAuthors
    .map((entry) => normalizeAuthor(entry))
    .filter(Boolean);

  return normalizedAuthors.length > 0
    ? normalizedAuthors.filter((entry, index, collection) => collection.findIndex((candidate) => candidate.name === entry.name) === index)
    : undefined;
};

const formatFrontmatterDate = (value) => {
  if (!value) {
    return undefined;
  }

  if (value instanceof Date) {
    const year = value.getFullYear();
    const month = String(value.getMonth() + 1).padStart(2, '0');
    const day = String(value.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  return String(value);
};

const POST_CATEGORIES = ['教程', '技术', '随笔', '分享', '其他'];

const normalizeCategory = (value) => {
  if (typeof value !== 'string') {
    return '其他';
  }

  const category = value.trim();
  if (!category) {
    return '其他';
  }

  return POST_CATEGORIES.includes(category) ? category : '其他';
};

const writeCloudflareSnapshot = (snapshot) => {
  fs.writeFileSync(CLOUDFLARE_FILE, JSON.stringify(snapshot, null, 2));
};

const writeUmamiSnapshot = (snapshot) => {
  fs.writeFileSync(UMAMI_FILE, JSON.stringify(snapshot, null, 2));
};

const files = fs.readdirSync(POSTS_DIR).filter((file) => file.endsWith('.md'));
const postsWithSearch = files
  .map((filename) => {
    const filePath = path.join(POSTS_DIR, filename);
    const fileContent = fs.readFileSync(filePath, 'utf-8');
    const { data, content } = matter(fileContent);
    const { draft, readTime, author, authors, updatedAt, ...restData } = data;

    const id = data.id || filename.replace(/\.md$/, '');

    const formattedDate = formatFrontmatterDate(data.date);
    const formattedUpdatedAt = formatFrontmatterDate(updatedAt);
    const normalizedAuthors = normalizeAuthors(author, authors);
    const category = normalizeCategory(data.category);
    const tags = normalizeTags(data.tags);
    const wordCount = countWords(content);
    const imageCount = countImages(content);

    if (!formattedDate) {
      throw new Error(`Post "${filename}" is missing a valid date field.`);
    }

    if (draft === true) {
      return null;
    }

    return {
      ...restData,
      category,
      tags,
      date: formattedDate,
      updatedAt: formattedUpdatedAt,
      authors: normalizedAuthors,
      id,
      filePath: `/posts/${filename}`,
      readTime: calculateReadTime(content),
      wordCount,
      imageCount,
      searchText: markdownToSearchText(content)
    };
  })
  .filter(Boolean)
  .sort((a, b) => new Date(b.date) - new Date(a.date));

const posts = postsWithSearch.map(({ searchText, ...post }) => post);

generateSiteStats(postsWithSearch);

fs.writeFileSync(path.join(OUTPUT_JSON_DIR, 'posts.json'), JSON.stringify(posts, null, 2));
fs.writeFileSync(path.join(OUTPUT_JSON_DIR, 'posts-search.json'), JSON.stringify(postsWithSearch, null, 2));
console.log(`JSON generated: ${posts.length} posts`);

const requiredFriendFields = ['name', 'description', 'avatar', 'url'];
const friendFiles = fs.existsSync(FRIENDS_DIR)
  ? fs.readdirSync(FRIENDS_DIR).filter((file) => file.endsWith('.json'))
  : [];

const friends = friendFiles.flatMap((filename) => {
  const filePath = path.join(FRIENDS_DIR, filename);

  try {
    const rawContent = fs.readFileSync(filePath, 'utf-8');
    const data = JSON.parse(rawContent);
    const missingFields = requiredFriendFields.filter(
      (field) => typeof data[field] !== 'string' || data[field].trim() === ''
    );

    if (missingFields.length > 0) {
      console.warn(`Skip invalid friend file ${filename}: missing ${missingFields.join(', ')}`);
      return [];
    }

    return [
      {
        name: data.name.trim(),
        description: data.description.trim(),
        avatar: data.avatar.trim(),
        url: data.url.trim()
      }
    ];
  } catch (error) {
    console.warn(`Skip invalid friend file ${filename}: ${error.message}`);
    return [];
  }
});

fs.writeFileSync(path.join(OUTPUT_JSON_DIR, 'friends.json'), JSON.stringify(friends, null, 2));
console.log(`JSON generated: ${friends.length} friends`);

const generateCloudflareSnapshot = async () => {
  const token = process.env.CLOUDFLARE_API_TOKEN?.trim();
  const zoneId = process.env.CLOUDFLARE_ZONE_ID?.trim();

  if (!token || !zoneId) {
    const emptySnapshot = {
      enabled: false,
      fetchedAt: null,
      domain: 'pldduck.com',
      timeWindows: []
    };
    writeCloudflareSnapshot(emptySnapshot);
    console.log('Cloudflare Analytics skipped: missing CLOUDFLARE_API_TOKEN or CLOUDFLARE_ZONE_ID');
    return;
  }

  const snapshot = {
    enabled: true,
    fetchedAt: new Date().toISOString(),
    domain: 'pldduck.com',
    timeWindows: []
  };

  const timeWindows = [1, 7, 30];

  for (const days of timeWindows) {
    const now = new Date();
    const since = new Date(now);
    since.setDate(since.getDate() - days);

    const until = new Date(now);
    until.setDate(until.getDate() + 1);

    const sinceStr = since.toISOString().split('T')[0];
    const untilStr = until.toISOString().split('T')[0];

    try {
      const totalsQuery = `
        query {
          viewer {
            zones(filter: { zoneTag: "${zoneId}" }) {
              httpRequests1dGroups(
                limit: ${days + 1}
                filter: { date_geq: "${sinceStr}", date_lt: "${untilStr}" }
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

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 15000);

      try {
        const totalsResponse = await fetch('https://api.cloudflare.com/client/v4/graphql', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ query: totalsQuery }),
          signal: controller.signal
        });
        clearTimeout(timeout);

        if (!totalsResponse.ok) {
          throw new Error(`API request failed with status ${totalsResponse.status}`);
        }

        const totalsData = await totalsResponse.json();
        const groups = totalsData?.data?.viewer?.zones?.[0]?.httpRequests1dGroups || [];

        const totals = groups.reduce(
          (acc, group) => ({
            requests: acc.requests + (group.sum?.requests || 0),
            pageViews: acc.pageViews + (group.sum?.pageViews || 0),
            bandwidth: acc.bandwidth + (group.sum?.bytes || 0),
            uniques: acc.uniques + (group.uniq?.uniques || 0)
          }),
          { requests: 0, pageViews: 0, bandwidth: 0, uniques: 0 }
        );

        snapshot.timeWindows.push({
          days,
          data: totals,
          error: null
        });

        console.log(`Cloudflare data fetched for ${days} days: ${totals.pageViews} page views`);
      } catch (error) {
        console.warn(`Cloudflare Analytics failed for ${days} days: ${error.message}`);
        snapshot.timeWindows.push({
          days,
          data: { requests: 0, pageViews: 0, bandwidth: 0, uniques: 0 },
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    } catch (error) {
      console.warn(`Cloudflare Analytics failed for ${days} days: ${error.message}`);
      snapshot.timeWindows.push({
        days,
        data: { requests: 0, pageViews: 0, bandwidth: 0, uniques: 0 },
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  writeCloudflareSnapshot(snapshot);
  console.log(`Cloudflare snapshot generated with ${snapshot.timeWindows.length} time windows`);
};

const generateSitemap = () => {
  const staticPages = ['', 'archive', 'tags', 'stats', 'friends', 'about'];

  const sitemapContent = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  ${staticPages
    .map(
      (page) => `
  <url>
    <loc>${SITE_URL}/${page}</loc>
    <changefreq>weekly</changefreq>
    <priority>${page === '' ? '1.0' : '0.8'}</priority>
  </url>`
    )
    .join('')}
  ${posts
    .map(
      (post) => `
  <url>
    <loc>${SITE_URL}/post/${post.id}</loc>
    <lastmod>${new Date(post.updatedAt || post.date).toISOString().split('T')[0]}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.7</priority>
  </url>`
    )
    .join('')}
</urlset>`;

  fs.writeFileSync(path.join(PUBLIC_DIR, 'sitemap.xml'), sitemapContent);
  console.log('Sitemap generated');
};

const generateRss = () => {
  const latestUpdate = posts[0] ? new Date(posts.reduce((latest, post) => {
    const current = new Date(post.updatedAt || post.date);
    return current > latest ? current : latest;
  }, new Date(posts[0].updatedAt || posts[0].date))) : new Date();

  const rssContent = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${SITE_TITLE}</title>
    <link>${SITE_URL}</link>
    <description>${SITE_DESCRIPTION}</description>
    <language>zh-CN</language>
    <lastBuildDate>${latestUpdate.toUTCString()}</lastBuildDate>
    <atom:link href="${SITE_URL}/feed.xml" rel="self" type="application/rss+xml" />
    ${posts
      .map(
        (post) => `
    <item>
      <title><![CDATA[${post.title}]]></title>
      <link>${SITE_URL}/post/${post.id}</link>
      <guid isPermaLink="true">${SITE_URL}/post/${post.id}</guid>
      <description><![CDATA[${post.excerpt}]]></description>
      <pubDate>${new Date(post.date).toUTCString()}</pubDate>
      <category>${post.category}</category>
    </item>`
      )
      .join('')}
  </channel>
</rss>`;

  fs.writeFileSync(path.join(PUBLIC_DIR, 'feed.xml'), rssContent);
  console.log('RSS feed generated');
};

const generateUmamiSnapshot = async () => {
  const apiUrl = process.env.UMAMI_API_URL?.trim() || 'api.umami.is';
  const apiKey = process.env.UMAMI_API_KEY?.trim();
  const websiteId = process.env.UMAMI_WEBSITE_ID?.trim();

  if (!apiKey || !websiteId) {
    const emptySnapshot = {
      enabled: false,
      fetchedAt: null,
      websiteId: '',
      timeWindows: []
    };
    writeUmamiSnapshot(emptySnapshot);
    console.log('Umami Analytics skipped: missing UMAMI_API_KEY or UMAMI_WEBSITE_ID');
    return;
  }

  const snapshot = {
    enabled: true,
    fetchedAt: new Date().toISOString(),
    websiteId: websiteId,
    timeWindows: []
  };

  const timeWindows = [1, 7, 30];

  for (const days of timeWindows) {
    const now = new Date();
    const startAt = new Date(now);
    startAt.setDate(startAt.getDate() - days);

    const startAtMs = startAt.getTime();
    const endAtMs = now.getTime();

    try {
      const url = `https://${apiUrl}/api/websites/${websiteId}/stats?startAt=${startAtMs}&endAt=${endAtMs}`;

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 15000);

      try {
        const response = await fetch(url, {
          method: 'GET',
          headers: {
            'x-umami-api-key': apiKey,
            'Content-Type': 'application/json'
          },
          signal: controller.signal
        });
        clearTimeout(timeout);

        if (!response.ok) {
          throw new Error(`API request failed with status ${response.status}`);
        }

        const data = await response.json();

        snapshot.timeWindows.push({
          days,
          data: {
            pageviews: data.pageviews?.value || 0,
            visitors: data.visitors?.value || 0,
            visits: data.visits?.value || 0
          },
          error: null
        });

        console.log(`Umami data fetched for ${days} days: ${data.pageviews?.value || 0} page views`);
      } catch (error) {
        console.warn(`Umami Analytics failed for ${days} days: ${error.message}`);
        snapshot.timeWindows.push({
          days,
          data: { pageviews: 0, visitors: 0, visits: 0 },
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    } catch (error) {
      console.warn(`Umami Analytics failed for ${days} days: ${error.message}`);
      snapshot.timeWindows.push({
        days,
        data: { pageviews: 0, visitors: 0, visits: 0 },
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  writeUmamiSnapshot(snapshot);
  console.log(`Umami snapshot generated with ${snapshot.timeWindows.length} time windows`);
};

await generateCloudflareSnapshot();
await generateUmamiSnapshot();
generateSitemap();
generateRss();
