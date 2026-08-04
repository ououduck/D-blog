const DEFAULT_BASE_PATH = '/';

export const normalizeBasePath = (value, { relativeFallback = '/' } = {}) => {
  let raw = String(value ?? '').trim().replace(/\\/g, '/');

  // Git Bash on Windows rewrites URL-like environment values such as
  // "/repo/" into the MSYS installation path before launching npm.
  const msysGitPath = raw.match(/^[a-z]:\//i) ? raw.match(/\/git\/(.+)$/i) : null;
  if (msysGitPath?.[1]) {
    raw = `/${msysGitPath[1]}`;
  }

  if (!raw || raw === '/') {
    return DEFAULT_BASE_PATH;
  }

  // Vite supports a relative base for builds that are served from any directory.
  // Absolute SEO URLs cannot represent that directory, so use the site root.
  if (raw === '.' || raw === './') {
    return relativeFallback;
  }

  const clean = raw.replace(/^\/+|\/+$/g, '');
  return clean ? `/${clean}/` : DEFAULT_BASE_PATH;
};

export const getBasePath = (value = process.env.VITE_BASE_PATH) => normalizeBasePath(value);

const isExternalUrl = (value) => /^(?:[a-z][a-z\d+.-]*:|\/\/)/i.test(value);

export const withBasePath = (value, basePath = getBasePath()) => {
  if (value === undefined || value === null || value === '') {
    return normalizeBasePath(basePath);
  }

  if (isExternalUrl(String(value))) {
    return value;
  }

  const raw = String(value).replace(/\\/g, '/');
  if (raw.startsWith('#')) {
    return raw;
  }

  const match = raw.match(/^([^?#]*)([?#][\s\S]*)?$/);
  const pathname = match?.[1] || '';
  const suffix = match?.[2] || '';
  if (!pathname) {
    return raw;
  }

  const normalizedBase = normalizeBasePath(basePath);
  const baseWithoutTrailing = normalizedBase === '/' ? '' : normalizedBase.replace(/\/$/, '');
  const normalizedPath = pathname.startsWith('/') ? pathname : `/${pathname}`;

  if (baseWithoutTrailing && (
    normalizedPath === baseWithoutTrailing || normalizedPath.startsWith(`${baseWithoutTrailing}/`)
  )) {
    return `${normalizedPath}${suffix}`;
  }

  return `${baseWithoutTrailing}/${normalizedPath.replace(/^\/+/, '')}${suffix}`;
};

export const toSitePath = (value = '/', basePath = getBasePath()) => withBasePath(value, basePath);
