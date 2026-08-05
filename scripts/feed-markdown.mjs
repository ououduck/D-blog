import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import remarkRehype from 'remark-rehype';
import rehypeKatex from 'rehype-katex';
import rehypeHighlight from 'rehype-highlight';
import rehypeStringify from 'rehype-stringify';
import { withBasePath } from './base-path.mjs';

const HTTP_PROTOCOLS = new Set(['http:', 'https:']);

const isExternalUrl = (value) => /^[a-z][a-z\d+.-]*:/i.test(value);

const isSafeUrl = (value) => {
  if (!value || /[\s"'<>]/.test(value)) {
    return false;
  }

  if (value.startsWith('#')) {
    return true;
  }

  try {
    const url = new URL(value);
    return HTTP_PROTOCOLS.has(url.protocol) || url.protocol === 'mailto:';
  } catch {
    return false;
  }
};

const stripMarkdownUrlDecorators = (value) => String(value).trim().replace(/\s+["'][^"']*["']$/, '');

const toPostsImgPath = (value) => {
  const clean = String(value)
    .replace(/\\/g, '/')
    .replace(/^\/+/, '')
    .replace(/^(\.\.\/)+/g, '')
    .replace(/^\.\/+/, '');

  return `/posts-img/${clean.startsWith('posts-img/') ? clean.slice('posts-img/'.length) : clean}`;
};

const toAbsoluteSiteUrl = (value, siteUrl, basePath) => {
  const normalized = withBasePath(value, basePath);
  return new URL(normalized, `${siteUrl.replace(/\/+$/, '')}/`).toString();
};

const resolveLinkUrl = (value, { siteUrl, basePath, postUrl }) => {
  const rawUrl = stripMarkdownUrlDecorators(value);
  if (!rawUrl) {
    return undefined;
  }

  if (rawUrl.startsWith('#')) {
    return `${postUrl}${rawUrl}`;
  }

  if (isExternalUrl(rawUrl)) {
    return isSafeUrl(rawUrl) ? rawUrl : undefined;
  }

  return toAbsoluteSiteUrl(rawUrl, siteUrl, basePath);
};

const resolveImageUrl = (value, { siteUrl, basePath }) => {
  const rawUrl = stripMarkdownUrlDecorators(value);
  if (!rawUrl) {
    return undefined;
  }

  if (isExternalUrl(rawUrl)) {
    return isSafeUrl(rawUrl) ? rawUrl : undefined;
  }

  return toAbsoluteSiteUrl(
    rawUrl.startsWith('/') ? rawUrl : toPostsImgPath(rawUrl),
    siteUrl,
    basePath
  );
};

const rewriteUrls = (options) => {
  const visit = (node) => {
    if (!node || typeof node !== 'object') {
      return;
    }

    if (node.type === 'element') {
      if (node.tagName === 'a' && typeof node.properties?.href === 'string') {
        const href = resolveLinkUrl(node.properties.href, options);
        if (href) {
          node.properties.href = href;
          node.properties.target = '_blank';
          node.properties.rel = 'noopener noreferrer';
        } else {
          delete node.properties.href;
        }
      }

      if (node.tagName === 'img' && typeof node.properties?.src === 'string') {
        const src = resolveImageUrl(node.properties.src, options);
        if (src) {
          node.properties.src = src;
        } else {
          delete node.properties.src;
        }
      }
    }

    if (Array.isArray(node.children)) {
      node.children.forEach(visit);
    }
  };

  return (tree) => visit(tree);
};

const createProcessor = (options) => unified()
  .use(remarkParse)
  .use(remarkGfm)
  .use(remarkMath)
  .use(remarkRehype)
  .use(rehypeKatex)
  .use(rehypeHighlight)
  .use(rewriteUrls, options)
  .use(rehypeStringify);

export const markdownToFeedHtml = (markdown, options = {}) => {
  const siteUrl = String(options.siteUrl || '').replace(/\/+$/, '');
  if (!siteUrl) {
    throw new Error('markdownToFeedHtml requires a siteUrl');
  }

  const basePath = options.basePath || '/';
  const postUrl = options.postUrl || toAbsoluteSiteUrl('/', siteUrl, basePath);
  const processor = createProcessor({ siteUrl, basePath, postUrl });
  const tree = processor.parse(String(markdown || ''));
  const transformed = processor.runSync(tree);
  return processor.stringify(transformed);
};
