import fs from 'fs';
import path from 'path';
import { maskFencedCodeBlocks } from '../src/utils/headings-core.mjs';

const URI_SCHEME_PATTERN = /^[a-z][a-z0-9+.-]*:/i;
const EXTERNAL_PROTOCOLS = new Set(['http:', 'https:', 'mailto:']);
const DEFAULT_STATIC_ROUTES = new Set([
  '/',
  '/archive',
  '/tags',
  '/stats',
  '/friends',
  '/shuoshuo',
  '/guestbook',
  '/about',
  '/cover',
  '/watermark',
  '/sponsor',
  '/search',
  '/favorites',
]);

const maskFencedCode = maskFencedCodeBlocks;

const isEscaped = (value, index) => {
  let slashCount = 0;
  for (let cursor = index - 1; cursor >= 0 && value[cursor] === '\\'; cursor -= 1) {
    slashCount += 1;
  }
  return slashCount % 2 === 1;
};

const findClosingBracket = (value, start, open, close) => {
  let depth = 0;
  for (let index = start; index < value.length; index += 1) {
    if (value[index] === '\\') {
      index += 1;
      continue;
    }
    if (value[index] === open) depth += 1;
    if (value[index] === close) {
      depth -= 1;
      if (depth === 0) return index;
    }
  }
  return -1;
};

const parseDestination = (rawInner) => {
  const inner = rawInner.trim();
  if (!inner) return { target: '', rawTarget: '' };

  if (inner.startsWith('<')) {
    const end = inner.indexOf('>');
    if (end < 0) return { target: inner, rawTarget: inner };
    const target = inner.slice(1, end);
    return { target, rawTarget: inner };
  }

  let depth = 0;
  for (let index = 0; index < inner.length; index += 1) {
    if (inner[index] === '\\') {
      index += 1;
      continue;
    }
    if (inner[index] === '(') depth += 1;
    else if (inner[index] === ')' && depth > 0) depth -= 1;
    else if (/\s/.test(inner[index]) && depth === 0) {
      const target = inner.slice(0, index);
      return { target, rawTarget: inner };
    }
  }
  return { target: inner, rawTarget: inner };
};

const parseMarkdownTokens = (markdown) => {
  const masked = maskFencedCode(markdown);
  const images = [];
  const links = [];

  for (let index = 0; index < masked.length; index += 1) {
    const isImage = masked[index] === '!' && masked[index + 1] === '[' && !isEscaped(masked, index);
    const isLink = masked[index] === '[' && masked[index - 1] !== '!' && !isEscaped(masked, index);
    if (!isImage && !isLink) continue;

    const labelStart = isImage ? index + 1 : index;
    const labelEnd = findClosingBracket(masked, labelStart, '[', ']');
    if (labelEnd < 0) continue;
    let destinationStart = labelEnd + 1;
    while (/\s/.test(masked[destinationStart] || '')) destinationStart += 1;
    if (masked[destinationStart] !== '(') continue;
    const destinationEnd = findClosingBracket(masked, destinationStart, '(', ')');
    if (destinationEnd < 0) continue;

    const originalInner = markdown.slice(destinationStart + 1, destinationEnd);
    const originalParsed = parseDestination(originalInner);
    const token = {
      alt: isImage ? markdown.slice(labelStart + 1, labelEnd) : undefined,
      target: originalParsed.target,
      rawTarget: originalParsed.rawTarget,
      line: markdown.slice(0, index).split('\n').length,
      start: index,
      end: destinationEnd + 1,
    };

    if (isImage) {
      images.push(token);
    } else {
      links.push(token);
    }
  }

  return { images, links };
};

export const parseMarkdownImages = (markdown) => parseMarkdownTokens(markdown).images;

const stripMarkdownUrlDecorators = (value) => {
  const firstDecorator = String(value).search(/[?#]/);
  return firstDecorator < 0 ? String(value) : String(value).slice(0, firstDecorator);
};

const hasUnsafeUrlCharacters = (value) => /[\s"'<>]/.test(value);

export const validateExternalUrl = (value, { allowMailto = true } = {}) => {
  const raw = String(value ?? '');
  if (!raw || hasUnsafeUrlCharacters(raw)) return 'URL contains whitespace or forbidden characters';
  if (raw.startsWith('//')) return 'protocol-relative URLs are not allowed';
  if (/^https?:\/{3,}/i.test(raw)) return 'HTTP(S) URL must include a host';
  if (/^https?:/i.test(raw) && !/^https?:\/\//i.test(raw)) return 'HTTP(S) URL must use // before the host';
  let url;
  try {
    url = new URL(raw);
  } catch {
    return 'URL is malformed';
  }
  if (!EXTERNAL_PROTOCOLS.has(url.protocol) || (url.protocol === 'mailto:' && !allowMailto)) {
    return `URL protocol must be one of ${allowMailto ? 'http:, https:, mailto:' : 'http:, https:'}`;
  }
  if ((url.protocol === 'http:' || url.protocol === 'https:') && !url.hostname) {
    return 'HTTP(S) URL must include a host';
  }
  if (url.protocol === 'mailto:' && !url.pathname.includes('@')) {
    return 'mailto URL must include a recipient';
  }
  return undefined;
};

export const resolveLocalImageTarget = (value, { imageRoot }) => {
  const raw = String(value ?? '');
  const target = stripMarkdownUrlDecorators(raw).replace(/\\/g, '/').trim();
  if (!target || URI_SCHEME_PATTERN.test(target)) return undefined;

  let relative;
  if (target.startsWith('/posts-img/')) {
    relative = target.slice('/posts-img/'.length);
  } else if (target.startsWith('posts-img/')) {
    relative = target.slice('posts-img/'.length);
  } else {
    const withoutParentPrefix = target.replace(/^(?:\.\.\/)+/, '');
    if (withoutParentPrefix.startsWith('posts-img/')) {
      relative = withoutParentPrefix.slice('posts-img/'.length);
    } else {
      return undefined;
    }
  }

  if (!relative || relative.startsWith('../') || relative === '..' || relative.includes('/../')) return undefined;
  const root = path.resolve(imageRoot);
  const filePath = path.resolve(root, ...relative.split('/'));
  if (filePath !== root && !filePath.startsWith(`${root}${path.sep}`)) return undefined;

  let isFile = false;
  try {
    isFile = fs.statSync(filePath).isFile();
  } catch {
    isFile = false;
  }
  return { filePath, url: `/posts-img/${relative.replace(/\\/g, '/')}`, exists: isFile };
};

const decodeAnchor = (value) => {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
};

const routePathForTarget = (target, postId) => {
  const base = `https://content-validator.invalid/post/${encodeURIComponent(postId)}`;
  try {
    const url = new URL(target, base);
    const pathname = url.pathname.length > 1 ? url.pathname.replace(/\/+$/, '') : '/';
    return { pathname, anchor: decodeAnchor(url.hash.slice(1)) };
  } catch {
    return undefined;
  }
};

const lineError = (file, line, reason) => `Content validation failed in ${file}: line ${line} ${reason}`;

const validateId = (id) => {
  if (typeof id !== 'string' || !id.trim()) return 'id must be a non-empty string';
  if (
    id !== id.trim() ||
    /\s|[\\/?#%"'<>]/.test(id) ||
    id === '.' ||
    id === '..' ||
    id.includes('/./') ||
    id.includes('/../')
  ) {
    return `id "${id}" contains characters that are unsafe in a post URL`;
  }
  return undefined;
};

export const findDuplicatePostIds = (posts) => {
  const seen = new Set();
  return posts.flatMap((post) => {
    const id = post?.id;
    if (typeof id !== 'string' || !id || !seen.has(id)) {
      if (typeof id === 'string' && id) seen.add(id);
      return [];
    }
    return [{ id, filename: post.filename || post.filePath || 'post.md' }];
  });
};

const validateTags = (tags) => {
  const errors = [];
  if (!Array.isArray(tags)) return ['tags must be an array'];
  const normalized = [];
  tags.forEach((tag, index) => {
    if (typeof tag !== 'string' || !tag.trim()) {
      errors.push(`tags[${index}] must be a non-empty string`);
      return;
    }
    const value = tag.trim();
    if (normalized.includes(value)) errors.push(`tags contains duplicate label "${value}"`);
    normalized.push(value);
  });
  return errors;
};

export const validatePostContent = (post, context = {}) => {
  const {
    filename = post.filename || post.filePath || 'post.md',
    imageRoot = path.resolve('posts-img'),
    publishedPosts = new Map(),
    staticRoutes = DEFAULT_STATIC_ROUTES,

    lineOffset = 0,
    skipFrontMatter = false,
  } = context;
  const errors = [];
  const data = post.data || post;
  const id = post.id ?? data.id;
  const content = post.content || '';
  const addFieldError = (reason) => errors.push(`Content validation failed in ${filename}: ${reason}`);

  if (!skipFrontMatter) {
    const idError = validateId(id);
    if (idError) addFieldError(idError);
    if (typeof data.excerpt !== 'string' || !data.excerpt.trim()) addFieldError('excerpt must be a non-empty string');
    if (data.tags === undefined) {
      addFieldError('tags must be an array');
    } else {
      errors.push(...validateTags(data.tags).map((reason) => `Content validation failed in ${filename}: ${reason}`));
    }
  }

  const cover = data.coverImage;
  if (cover !== undefined) {
    if (typeof cover !== 'string' || !cover.trim()) {
      addFieldError('coverImage must be a non-empty local path or HTTP(S) URL');
    }
    const coverTarget = typeof cover === 'string' ? cover.trim() : '';
    if (coverTarget) {
      if (URI_SCHEME_PATTERN.test(coverTarget)) {
        const reason = validateExternalUrl(coverTarget, { allowMailto: false });
        if (reason) addFieldError(`coverImage "${coverTarget}": ${reason}`);
      } else {
        const resolved = resolveLocalImageTarget(coverTarget, { imageRoot });
        if (!resolved?.exists) {
          addFieldError(`coverImage "${coverTarget}" does not resolve to a file inside posts-img`);
        }
      }
    }
  }

  const { images, links } = parseMarkdownTokens(content);
  images.forEach((image) => {
    if (typeof image.alt !== 'string' || !image.alt.trim()) {
      errors.push(
        lineError(
          filename,
          image.line + lineOffset,
          `image alt text must be non-empty (target: ${image.rawTarget || image.target || '<empty>'})`,
        ),
      );
    }
    const target = image.target;
    if (target.startsWith('//')) {
      errors.push(
        lineError(
          filename,
          image.line + lineOffset,
          `image target "${image.rawTarget}": protocol-relative URLs are not allowed`,
        ),
      );
    } else if (URI_SCHEME_PATTERN.test(target)) {
      const reason = validateExternalUrl(target, { allowMailto: false });
      if (reason)
        errors.push(lineError(filename, image.line + lineOffset, `image target "${image.rawTarget}": ${reason}`));
    } else {
      const resolved = resolveLocalImageTarget(target, { imageRoot });
      if (!resolved?.exists) {
        errors.push(
          lineError(
            filename,
            image.line + lineOffset,
            `local image "${image.rawTarget}" does not resolve to a file inside posts-img`,
          ),
        );
      }
    }
  });

  links.forEach((link) => {
    const target = link.target;
    if (!target) {
      errors.push(lineError(filename, link.line + lineOffset, 'link target is empty'));
      return;
    }
    if (target.startsWith('//')) {
      errors.push(
        lineError(
          filename,
          link.line + lineOffset,
          `link target "${link.rawTarget}": protocol-relative URLs are not allowed`,
        ),
      );
      return;
    }
    if (URI_SCHEME_PATTERN.test(target)) {
      const reason = validateExternalUrl(target);
      if (reason)
        errors.push(lineError(filename, link.line + lineOffset, `link target "${link.rawTarget}": ${reason}`));
      return;
    }

    const route = routePathForTarget(target, id);
    if (!route) {
      errors.push(lineError(filename, link.line + lineOffset, `link target "${link.rawTarget}" is malformed`));
      return;
    }
    const pathname = route.pathname || '/';
    if (pathname.startsWith('/posts-img/')) {
      const resolved = resolveLocalImageTarget(pathname, { imageRoot });
      if (!resolved?.exists)
        errors.push(
          lineError(
            filename,
            link.line + lineOffset,
            `local link "${link.rawTarget}" does not resolve to a file inside posts-img`,
          ),
        );
      return;
    }

    let targetPost;
    if (pathname.startsWith('/post/')) {
      let targetId;
      try {
        targetId = decodeURIComponent(pathname.slice('/post/'.length));
      } catch {
        errors.push(
          lineError(
            filename,
            link.line + lineOffset,
            `link "${link.rawTarget}" contains an invalid encoded article ID`,
          ),
        );
        return;
      }
      targetPost = publishedPosts.get?.(targetId);
      if (!targetPost) {
        errors.push(
          lineError(filename, link.line + lineOffset, `link "${link.rawTarget}" targets a missing or draft article`),
        );
        return;
      }
    } else if (!staticRoutes.has(pathname) && !/^\/shuoshuo\/[^/]+$/.test(pathname)) {
      errors.push(
        lineError(filename, link.line + lineOffset, `link "${link.rawTarget}" targets an unknown site route`),
      );
      return;
    }

    if (route.anchor && targetPost) {
      const headings = targetPost.headingIds || [];
      if (!headings.includes(route.anchor)) {
        errors.push(
          lineError(
            filename,
            link.line + lineOffset,
            `link "${link.rawTarget}" targets a missing heading anchor "#${route.anchor}"`,
          ),
        );
      }
    }
  });

  return errors;
};

export { DEFAULT_STATIC_ROUTES };
