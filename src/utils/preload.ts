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
  '/': () => import('../pages/Home').then((m) => ({ default: m.Home })),
  '/archive': () => import('../pages/Archive').then((m) => ({ default: m.ArchivePage })),
  '/tags': () => import('../pages/Tags').then((m) => ({ default: m.Tags })),
  '/stats': () => import('../pages/Stats').then((m) => ({ default: m.Stats })),
  '/friends': () => import('../pages/Friends').then((m) => ({ default: m.Friends })),
  '/about': () => import('../pages/About').then((m) => ({ default: m.About })),
  '/sponsor': () => import('../pages/Sponsor').then((m) => ({ default: m.Sponsor })),
  '/cover': () => import('../pages/CoverGenerator').then((m) => ({ default: m.CoverGenerator })),
};

export { pageLoaders };

/** Preload a page module on hover */
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
