import React, { Suspense, lazy, useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route, useLocation } from 'react-router-dom';
import { HelmetProvider } from 'react-helmet-async';
import { flushSync } from 'react-dom';
import { Layout } from './components/Layout';
import { Home } from './pages/Home';
import { pageLoaders } from './utils/preload';
import { getRouterBasename } from './utils/siteUrl';
import { OfflineStatus } from './components/OfflineStatus';
import { ServiceWorkerUpdatePrompt } from './components/ServiceWorkerUpdatePrompt';
import { SsgRouteContext, readSsgRouteData } from './ssr/routeData';

const Post = lazy(() => import('./pages/Post').then((m) => ({ default: m.Post })));
const About = lazy(pageLoaders['/about']);
const ArchivePage = lazy(pageLoaders['/archive']);
const Stats = lazy(pageLoaders['/stats']);
const Friends = lazy(pageLoaders['/friends']);
const ShuoShuoPage = lazy(pageLoaders['/shuoshuo']);
const ShuoShuoDetailPage = lazy(() => import('./pages/ShuoShuoDetail').then((m) => ({ default: m.ShuoShuoDetail })));
const GuestbookPage = lazy(pageLoaders['/guestbook']);
const Tags = lazy(pageLoaders['/tags']);
const CoverGenerator = lazy(pageLoaders['/cover']);
const Watermark = lazy(pageLoaders['/watermark']);
const Sponsor = lazy(pageLoaders['/sponsor']);
const Favorites = lazy(pageLoaders['/favorites']);
const SearchPage = lazy(pageLoaders['/search']);
const NotFound = lazy(() => import('./pages/NotFound').then((m) => ({ default: m.NotFound })));
const CookieNotice = lazy(() => import('./components/CookieNotice').then((m) => ({ default: m.CookieNotice })));

const RouteFallback: React.FC = () => (
  <div className="mx-auto flex min-h-[50vh] max-w-7xl items-center justify-center">
    <div className="flex flex-col items-center gap-3">
      <div className="h-5 w-5 animate-spin rounded-full border-2 border-zinc-200 border-t-zinc-500 dark:border-zinc-700 dark:border-t-zinc-400" />
    </div>
  </div>
);

class ErrorBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean }> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: Error) {
    console.error('应用错误:', error);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-screen items-center justify-center">
          <div className="text-center">
            <h1 className="mb-4 text-2xl font-bold text-zinc-900 dark:text-zinc-100">页面加载出错</h1>
            <p className="mb-6 text-zinc-600 dark:text-zinc-400">抱歉，页面发生了意外错误，请刷新重试。</p>
            <button
              onClick={() => window.location.reload()}
              className="border border-zinc-950 bg-zinc-950 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-zinc-800 dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
            >
              刷新页面
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

const AppRoutes: React.FC = () => {
  const location = useLocation();
  const [displayLocation, setDisplayLocation] = useState(location);
  // SSR 与客户端首帧保持一致（false），水合后检测并开启 View Transitions。
  const [hasViewTransition, setHasViewTransition] = useState(false);

  useEffect(() => {
    if (typeof document !== 'undefined' && 'startViewTransition' in document) {
      setHasViewTransition(true);
    }
  }, []);

  useEffect(() => {
    if (location.pathname === displayLocation.pathname && location.search === displayLocation.search) {
      return;
    }

    if (location.pathname === displayLocation.pathname) {
      setDisplayLocation(location);
      return;
    }

    if (hasViewTransition) {
      const startViewTransition = (
        document as Document & {
          startViewTransition?: (callback: () => void) => void;
        }
      ).startViewTransition;
      // startViewTransition 在已有活动中的 transition 时（快速连续导航）
      // 按规范同步抛 InvalidStateError：捕获并回退为直接更新，避免异常
      // 冒泡到 ErrorBoundary 导致整页崩溃且导航不生效。
      try {
        startViewTransition?.(() => {
          flushSync(() => {
            setDisplayLocation(location);
          });
          window.scrollTo({ top: 0, behavior: 'auto' as ScrollBehavior });
        });
      } catch {
        setDisplayLocation(location);
        window.scrollTo({ top: 0, behavior: 'auto' as ScrollBehavior });
      }
      return;
    }

    setDisplayLocation(location);
  }, [location, displayLocation.pathname, displayLocation.search, hasViewTransition]);

  return (
    <Layout hasViewTransition={hasViewTransition}>
      <Suspense fallback={<RouteFallback />}>
        <Routes location={displayLocation} key={displayLocation.pathname}>
          <Route path="/" element={<Home />} />
          <Route path="/post/:id" element={<Post />} />
          <Route path="/archive" element={<ArchivePage />} />
          <Route path="/tags" element={<Tags />} />
          <Route path="/stats" element={<Stats />} />
          <Route path="/friends" element={<Friends />} />
          <Route path="/shuoshuo" element={<ShuoShuoPage />} />
          <Route path="/shuoshuo/:id" element={<ShuoShuoDetailPage />} />
          <Route path="/guestbook" element={<GuestbookPage />} />
          <Route path="/about" element={<About />} />
          <Route path="/cover" element={<CoverGenerator />} />
          <Route path="/watermark" element={<Watermark />} />
          <Route path="/sponsor" element={<Sponsor />} />
          <Route path="/favorites" element={<Favorites />} />
          <Route path="/search" element={<SearchPage />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </Suspense>
    </Layout>
  );
};

const AppShell: React.FC = () => {
  const [showCookieNotice, setShowCookieNotice] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setShowCookieNotice(true);
    }, 2000);
    return () => window.clearTimeout(timer);
  }, []);

  return (
    <ErrorBoundary>
      <AppRoutes />
      <OfflineStatus />
      <ServiceWorkerUpdatePrompt />
      {showCookieNotice && (
        <Suspense fallback={null}>
          <CookieNotice />
        </Suspense>
      )}
    </ErrorBoundary>
  );
};

const App: React.FC = () => {
  const ssgRouteData = readSsgRouteData();

  return (
    <HelmetProvider>
      {/* future 标志：提前启用 React Router v7 的默认行为（v7_startTransition 让路由
          更新走 startTransition 非阻塞渲染；v7_relativeSplatPath 修正 splat 路由内的
          相对路径解析），消除升级 v7 时的破坏性变更，并消掉测试中的 future flag 警告。 */}
      <Router basename={getRouterBasename()} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <SsgRouteContext.Provider value={ssgRouteData}>
          <AppShell />
        </SsgRouteContext.Provider>
      </Router>
    </HelmetProvider>
  );
};

export { AppShell };
export default App;
