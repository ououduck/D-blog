import React, { useEffect, useState } from 'react';
import { BarChart3, Zap, HardDrive } from 'lucide-react';

interface BundleInfo {
  name: string;
  size: number;
  loaded: boolean;
}

export const PerformanceMonitor = () => {
  const [bundleInfo, setBundleInfo] = useState<BundleInfo[]>([
    { name: '主包 (main)', size: 0, loaded: true },
    { name: '首页 (Home)', size: 0, loaded: false },
    { name: '文章页 (Post)', size: 0, loaded: false },
    { name: '关于页 (About)', size: 0, loaded: false },
    { name: '友链页 (Friends)', size: 0, loaded: false },
  ]);

  useEffect(() => {
    // 监听路由变化来检测 bundle 加载
    const handleRouteChange = () => {
      // 这里可以添加更详细的性能监控逻辑
      console.log('路由变化，检查 bundle 加载状态');
    };

    window.addEventListener('popstate', handleRouteChange);
    return () => window.removeEventListener('popstate', handleRouteChange);
  }, []);

  return (
    <div className="fixed bottom-4 right-4 z-50 bg-white dark:bg-zinc-900 rounded-lg shadow-lg border border-zinc-200 dark:border-zinc-800 p-4 max-w-xs">
      <div className="flex items-center gap-2 mb-3">
        <Zap className="w-5 h-5 text-accent" />
        <h3 className="font-bold text-ink dark:text-white">性能监控</h3>
      </div>
      
      <div className="space-y-2">
        {bundleInfo.map((bundle, index) => (
          <div key={index} className="flex items-center justify-between text-sm">
            <span className={`truncate ${bundle.loaded ? 'text-green-600' : 'text-zinc-500'}`}>
              {bundle.name}
            </span>
            <div className="flex items-center gap-1">
              {bundle.loaded && <div className="w-2 h-2 bg-green-500 rounded-full"></div>}
              <span className="text-xs text-zinc-400">
                {bundle.size > 0 ? `${(bundle.size / 1024).toFixed(1)}KB` : '--'}
              </span>
            </div>
          </div>
        ))}
      </div>
      
      <div className="mt-3 pt-3 border-t border-zinc-200 dark:border-zinc-800">
        <p className="text-xs text-zinc-500">
          代码分割已启用 ✓
        </p>
      </div>
    </div>
  );
};