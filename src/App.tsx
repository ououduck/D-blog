import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, useLocation } from 'react-router-dom';
import { HelmetProvider } from 'react-helmet-async';
import { Layout } from './components/Layout';
import { preloadPostSearch, preloadPosts } from './services/posts';
import { Home } from './pages/Home';
import { Post } from './pages/Post';
import { About } from './pages/About';
import { ArchivePage } from './pages/Archive';
import { Stats } from './pages/Stats';
import { Friends } from './pages/Friends';
import { Tags } from './pages/Tags';
import { NotFound } from './pages/NotFound';

const AppRoutes: React.FC = () => {
  const location = useLocation();
  const routeKey = `${location.pathname}${location.search}${location.hash}`;

  return (
    <Layout>
      <Routes location={location} key={routeKey}>
        <Route path="/" element={<Home />} />
        <Route path="/post/:id" element={<Post />} />
        <Route path="/archive" element={<ArchivePage />} />
        <Route path="/tags" element={<Tags />} />
        <Route path="/stats" element={<Stats />} />
        <Route path="/friends" element={<Friends />} />
        <Route path="/about" element={<About />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </Layout>
  );
};

const App: React.FC = () => {
  useEffect(() => {
    const warmUp = () => {
      void preloadPosts();
      void preloadPostSearch();
    };

    if (typeof window === 'undefined') {
      return;
    }

    if ('requestIdleCallback' in window) {
      const idleId = window.requestIdleCallback(warmUp, { timeout: 1500 });
      return () => {
        window.cancelIdleCallback(idleId);
      };
    }

    const fallbackTimer = window.setTimeout(warmUp, 1200);
    return () => {
      window.clearTimeout(fallbackTimer);
    };
  }, []);

  return (
    <HelmetProvider>
      <Router>
        <AppRoutes />
      </Router>
    </HelmetProvider>
  );
};

export default App;
