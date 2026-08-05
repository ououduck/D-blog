const FALLBACK_BASE_PATH = '/';

const RELATIVE_BASE_ROUTE_MARKERS = [
  '/post/',
  '/archive',
  '/tags',
  '/stats',
  '/friends',
  '/about',
  '/cover',
  '/sponsor',
  '/favorites'
] as const;

const inferRelativeBasePath = (currentPath: string): string => {
  const normalizedPath = currentPath.replace(/\\/g, '/').split(/[?#]/, 1)[0] || '/';
  const marker = RELATIVE_BASE_ROUTE_MARKERS
    .map((route) => ({ route, index: normalizedPath.indexOf(route) }))
    .filter(({ index }) => index >= 0)
    .sort((a, b) => a.index - b.index)[0];

  if (marker) {
    const prefix = normalizedPath.slice(0, marker.index).replace(/^\/+|\/+$/g, '');
    return prefix ? `/${prefix}/` : '/';
  }

  const directory = normalizedPath.endsWith('/')
    ? normalizedPath
    : normalizedPath.slice(0, normalizedPath.lastIndexOf('/') + 1) || '/';
  const cleanDirectory = `/${directory.replace(/^\/+|\/+$/g, '')}`;
  return cleanDirectory === '/' ? '/' : `${cleanDirectory}/`;
};

export const normalizeBasePath = (value?: string, currentPath?: string): string => {
  const raw = value?.trim().replace(/\\/g, '/');

  if (!raw || raw === '/') {
    return FALLBACK_BASE_PATH;
  }

  if (raw === '.' || raw === './') {
    const pathname = currentPath || (typeof window !== 'undefined' ? window.location.pathname : '/');
    return inferRelativeBasePath(pathname);
  }

  const clean = raw.replace(/^\/+|\/+$/g, '');
  return clean ? `/${clean}/` : FALLBACK_BASE_PATH;
};

export const getSiteBasePath = (currentPath?: string): string =>
  normalizeBasePath(import.meta.env.BASE_URL, currentPath);

export const getRouterBasename = (currentPath?: string): string => {
  const basePath = getSiteBasePath(currentPath);
  return basePath === '/' ? '/' : basePath.replace(/\/$/, '');
};

const isExternalUrl = (value: string) => /^(?:[a-z][a-z\d+.-]*:|\/\/)/i.test(value);

const splitSuffix = (value: string) => {
  const match = value.match(/^([^?#]*)([?#][\s\S]*)?$/);
  return { pathname: match?.[1] || '', suffix: match?.[2] || '' };
};

const trimLeadingSlash = (value: string) => value.replace(/^\/+/, '');

export const withBasePath = (value: string, basePath = getSiteBasePath()): string => {
  if (!value || isExternalUrl(value) || value.startsWith('#')) {
    return value;
  }

  const { pathname, suffix } = splitSuffix(value.replace(/\\/g, '/'));
  if (!pathname) {
    return value;
  }

  const normalizedBase = normalizeBasePath(basePath);
  const baseWithoutTrailing = normalizedBase === '/' ? '' : normalizedBase.replace(/\/$/, '');
  const normalizedPath = pathname.startsWith('/') ? pathname : `/${pathname}`;

  if (baseWithoutTrailing && (normalizedPath === baseWithoutTrailing || normalizedPath.startsWith(`${baseWithoutTrailing}/`))) {
    return `${normalizedPath}${suffix}`;
  }

  const joined = `${baseWithoutTrailing}/${trimLeadingSlash(normalizedPath)}`.replace(/\/+/g, '/');
  return `${joined || '/'}${suffix}`;
};

export const routeUrl = (route: string, basePath = getSiteBasePath()): string =>
  withBasePath(isExternalUrl(route) || route.startsWith('#') ? route : (route.startsWith('/') ? route : `/${route}`), basePath);

export const assetUrl = (asset: string, basePath = getSiteBasePath()): string =>
  withBasePath(isExternalUrl(asset) || asset.startsWith('#') ? asset : (asset.startsWith('/') ? asset : `/${asset}`), basePath);

export const absoluteSiteUrl = (value: string | undefined, siteUrl: string, basePath = getSiteBasePath()): string => {
  if (!value) {
    return new URL(withBasePath('/', basePath), `${siteUrl.replace(/\/+$/, '')}/`).toString();
  }

  if (isExternalUrl(value)) {
    try {
      const candidate = new URL(value, `${siteUrl.replace(/\/+$/, '')}/`);
      const configuredSite = new URL(siteUrl);
      if (candidate.origin !== configuredSite.origin) {
        return value;
      }
      return new URL(
        withBasePath(`${candidate.pathname}${candidate.search}${candidate.hash}`, basePath),
        `${siteUrl.replace(/\/+$/, '')}/`
      ).toString();
    } catch {
      return value;
    }
  }

  const path = value.startsWith('/') ? value : `/${value}`;
  return new URL(withBasePath(path, basePath), `${siteUrl.replace(/\/+$/, '')}/`).toString();
};
