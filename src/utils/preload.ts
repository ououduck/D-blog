/**
 * 路由级预加载：悬停时按需加载目标页面 chunk，受网络状态（saveData/2g）约束并去重。
 */

type ModuleLoader = () => Promise<{ default: React.ComponentType }>;

type NetworkInformation = {
  saveData?: boolean;
  effectiveType?: string;
};

const preloadedPaths = new Set<string>();

const canPreload = () => {
  if (typeof navigator === 'undefined') {
    return false;
  }

  const connection = (navigator as Navigator & { connection?: NetworkInformation }).connection;
  if (!connection) {
    return true;
  }

  return !connection.saveData && connection.effectiveType !== 'slow-2g' && connection.effectiveType !== '2g';
};

const pageLoaders: Record<string, ModuleLoader> = {
  '/archive': () => import('../pages/Archive').then((m) => ({ default: m.ArchivePage })),
  '/tags': () => import('../pages/Tags').then((m) => ({ default: m.Tags })),
  '/stats': () => import('../pages/Stats').then((m) => ({ default: m.Stats })),
  '/friends': () => import('../pages/Friends').then((m) => ({ default: m.Friends })),
  '/shuoshuo': () => import('../pages/ShuoShuo').then((m) => ({ default: m.ShuoShuo })),
  '/guestbook': () => import('../pages/Guestbook').then((m) => ({ default: m.Guestbook })),
  '/about': () => import('../pages/About').then((m) => ({ default: m.About })),
  '/sponsor': () => import('../pages/Sponsor').then((m) => ({ default: m.Sponsor })),
  '/cover': () => import('../pages/CoverGenerator').then((m) => ({ default: m.CoverGenerator })),
  '/watermark': () => import('../pages/Watermark').then((m) => ({ default: m.Watermark })),
  '/favorites': () => import('../pages/Favorites').then((m) => ({ default: m.Favorites })),
  '/search': () => import('../pages/Search').then((m) => ({ default: m.Search })),
};

export { pageLoaders };

/** 悬停时预加载目标页面模块（受网络状况与省流量偏好约束）。 */
export const preloadPage = (path: string) => {
  if (!canPreload() || preloadedPaths.has(path)) {
    return;
  }

  preloadedPaths.add(path);

  if (path.startsWith('/post/')) {
    import('../pages/Post').catch(() => {
      preloadedPaths.delete(path);
    });
    return;
  }

  const loader = pageLoaders[path];
  if (loader) {
    loader().catch(() => {
      preloadedPaths.delete(path);
    });
  }
};
