import fs from 'fs';
import path from 'path';

export const IMAGE_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.gif', '.webp', '.avif', '.svg', '.bmp', '.ico']);
export const RASTER_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.webp']);

const IMAGE_MARKDOWN_PATTERN = /!\[[^\]]*\]\(\s*(<[^>]+>|(?:\\.|[^)\s])+)(?:\s+(?:"[^"]*"|'[^']*'|\([^)]*\)))?\s*\)/g;

const maskFencedCode = (markdown) => markdown.replace(
  /^ {0,3}(`{3,}|~{3,})[^\n]*\n[\s\S]*?^ {0,3}\1\s*$/gm,
  (block) => block.replace(/[^\n]/g, ' ')
);

export const stripImageUrlDecorations = (value) => {
  const unwrapped = String(value ?? '').trim().replace(/^<(.+)>$/, '$1');
  return unwrapped.split(/[?#]/, 1)[0].replace(/\\/g, '/');
};

export const extractMarkdownImageReferences = (markdown) => {
  const source = maskFencedCode(String(markdown ?? ''));
  const references = [];
  let match;

  while ((match = IMAGE_MARKDOWN_PATTERN.exec(source))) {
    const rawUrl = stripImageUrlDecorations(match[1]);
    references.push({
      rawUrl,
      index: match.index,
      line: source.slice(0, match.index).split('\n').length,
    });
  }

  IMAGE_MARKDOWN_PATTERN.lastIndex = 0;
  return references;
};

export const isExternalImageUrl = (value) => /^[a-z][a-z0-9+.-]*:/i.test(String(value ?? '').trim());

const normalizeRelativeImagePath = (value, postId) => {
  const raw = stripImageUrlDecorations(value).replace(/^\/+/, '');
  if (!raw) {
    return undefined;
  }

  const explicitPostsImg = raw.match(/^(?:(?:\.\.\/)+)?posts-img\/(.+)$/i);
  if (explicitPostsImg) {
    const relativePath = path.posix.normalize(explicitPostsImg[1]);
    return relativePath === '.' || relativePath.startsWith('../') || relativePath === '..'
      ? undefined
      : `/posts-img/${relativePath}`;
  }

  if (raw.startsWith('../') || raw.startsWith('..\\')) {
    return undefined;
  }

  const normalizedRaw = path.posix.normalize(raw.replace(/^\.\//, ''));
  return normalizedRaw === '.' || normalizedRaw.startsWith('../') || normalizedRaw === '..'
    ? undefined
    : `/posts-img/${postId}/${normalizedRaw}`;
};

export const normalizeLocalImageUrl = (value, postId, postsImgDir) => {
  if (!value || isExternalImageUrl(value)) {
    return { external: isExternalImageUrl(value) };
  }

  const url = normalizeRelativeImagePath(value, postId);
  if (!url || !url.startsWith('/posts-img/')) {
    return { error: '图片路径必须位于 posts-img/ 目录内' };
  }

  const relativePath = url.slice('/posts-img/'.length);
  const filePath = path.resolve(postsImgDir, relativePath);
  const rootPath = path.resolve(postsImgDir);
  if (filePath !== rootPath && !filePath.startsWith(`${rootPath}${path.sep}`)) {
    return { error: '图片路径越界' };
  }

  if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
    return { url, filePath, error: '图片文件不存在' };
  }

  return { url, filePath };
};

export const createSrcSet = (variants = []) => variants
  .filter((variant) => variant?.url && Number.isFinite(variant.width))
  .map((variant) => `${variant.url} ${variant.width}w`)
  .join(', ');
