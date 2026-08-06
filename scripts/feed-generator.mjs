import { withBasePath } from './base-path.mjs';
import { markdownToFeedHtml } from './feed-markdown.mjs';

const DEFAULT_LANGUAGE = 'zh-CN';

export const xmlEscape = (value) => String(value ?? '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&apos;');

export const wrapCdata = (value) => `<![CDATA[${String(value ?? '').replace(/]]>/g, ']]]]><![CDATA[>')}]]>`;

const normalizeSiteUrl = (value) => String(value || '').replace(/\/+$/, '');

const toAbsoluteUrl = (value, siteUrl, basePath) => {
  const normalizedPath = withBasePath(value, basePath);
  return new URL(normalizedPath, `${normalizeSiteUrl(siteUrl)}/`).toString();
};

const toDate = (value, label) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new Error(`${label} must be a valid date: ${value}`);
  }
  return date;
};

const getModifiedDate = (post) => toDate(post.updatedAt || post.date, `Post ${post.id} updatedAt/date`);
const getPublishedDate = (post) => toDate(post.date, `Post ${post.id} date`);

const getLatestUpdate = (posts) => {
  if (posts.length === 0) {
    return new Date();
  }

  return posts.reduce((latest, post) => {
    const current = getModifiedDate(post);
    return current > latest ? current : latest;
  }, getModifiedDate(posts[0]));
};

const renderCategory = (category) => category
  ? `<category domain="category">${xmlEscape(category)}</category>`
  : '';

const renderTags = (tags) => (Array.isArray(tags) ? tags : [])
  .filter((tag) => typeof tag === 'string' && tag.trim())
  .map((tag) => `<category domain="tag">${xmlEscape(tag.trim())}</category>`)
  .join('\n      ');

const renderAuthors = (post, fallbackAuthor) => {
  const authors = Array.isArray(post.authors) ? post.authors : [];
  const names = authors
    .map((author) => (typeof author === 'string' ? author : author?.name))
    .filter((name) => typeof name === 'string' && name.trim());
  const name = names[0]?.trim() || fallbackAuthor;
  return `<author>${xmlEscape(name)}</author>`;
};

export const buildRssFeed = (postsInput, {
  siteUrl,
  basePath = '/',
  title,
  description,
  author,
  language = DEFAULT_LANGUAGE
} = {}) => {
  const normalizedSiteUrl = normalizeSiteUrl(siteUrl);
  if (!normalizedSiteUrl) {
    throw new Error('buildRssFeed requires a siteUrl');
  }

  const posts = Array.isArray(postsInput) ? postsInput : [];
  const feedUrl = toAbsoluteUrl('/feed.xml', normalizedSiteUrl, basePath);
  const homeUrl = toAbsoluteUrl('/', normalizedSiteUrl, basePath);
  const latestUpdate = getLatestUpdate(posts);

  const items = posts.map((post) => {
    const postUrl = toAbsoluteUrl(`/post/${post.id}`, normalizedSiteUrl, basePath);
    const publishedDate = getPublishedDate(post);
    const modifiedDate = getModifiedDate(post);
    const contentHtml = markdownToFeedHtml(post.content || '', {
      siteUrl: normalizedSiteUrl,
      basePath,
      postUrl,
      postId: post.id
    });

    return `
    <item>
      <title>${wrapCdata(post.title)}</title>
      <link>${xmlEscape(postUrl)}</link>
      <guid isPermaLink="true">${xmlEscape(postUrl)}</guid>
      <description>${wrapCdata(post.excerpt)}</description>
      <content:encoded>${wrapCdata(`<article>${contentHtml}</article>`)}</content:encoded>
      <pubDate>${publishedDate.toUTCString()}</pubDate>
      <atom:updated>${modifiedDate.toISOString()}</atom:updated>
      ${renderCategory(post.category)}
      ${renderTags(post.tags)}
      ${renderAuthors(post, author || '')}
    </item>`;
  }).join('');

  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:content="http://purl.org/rss/1.0/modules/content/">
  <channel>
    <title>${xmlEscape(title)}</title>
    <link>${xmlEscape(homeUrl)}</link>
    <description>${xmlEscape(description)}</description>
    <language>${xmlEscape(language)}</language>
    <lastBuildDate>${latestUpdate.toUTCString()}</lastBuildDate>
    <atom:link href="${xmlEscape(feedUrl)}" rel="self" type="application/rss+xml" />${items}
  </channel>
</rss>`;
};
