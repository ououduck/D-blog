const DEFAULT_BASE_PATH = '/';

const normalizeBasePath = (value, { relativeFallback = '/' } = {}) => {
  let raw = String(value ?? '')
    .trim()
    .replace(/\\/g, '/');

  // Windows 上的 Git Bash 会把 URL 形态的环境变量值（如 "/repo/"）
  // 改写成 MSYS 安装路径后再传给 npm，需要识别并还原。
  const msysGitPath = raw.match(/^[a-z]:\//i) ? raw.match(/\/git\/(.+)$/i) : null;
  if (msysGitPath?.[1]) {
    raw = `/${msysGitPath[1]}`;
  }

  if (!raw || raw === '/') {
    return DEFAULT_BASE_PATH;
  }

  // Vite 支持相对 base（产物可部署到任意目录）；但绝对 SEO URL 无法表示该目录，
  // 因此相对部署时回退到站点根路径。
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

  if (
    baseWithoutTrailing &&
    (normalizedPath === baseWithoutTrailing || normalizedPath.startsWith(`${baseWithoutTrailing}/`))
  ) {
    return `${normalizedPath}${suffix}`;
  }

  return `${baseWithoutTrailing}/${normalizedPath.replace(/^\/+/, '')}${suffix}`;
};
