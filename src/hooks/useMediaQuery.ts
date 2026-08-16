/**
 * 监听媒体查询变化。
 * 初始化与 SSR 首帧返回 defaultValue，挂载后立即同步真实媒体状态并持续监听，
 * 保证客户端首帧渲染与 SSR 输出一致（水合无冲突）。
 */
import { useEffect, useState } from 'react';

export const useMediaQuery = (query: string, defaultValue = false): boolean => {
  // 初始化器不访问 window：确保 SSR 与客户端首帧渲染一致（水合无冲突）。
  // 下方 useEffect 会在挂载后立即读取真实媒体状态并纠正。
  const [matches, setMatches] = useState(defaultValue);

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return;
    }

    const mediaQuery = window.matchMedia(query);
    const handleChange = () => setMatches(mediaQuery.matches);

    // 初始化时同步一次状态
    setMatches(mediaQuery.matches);

    // 使用现代 API 或降级到旧 API
    if (typeof mediaQuery.addEventListener === 'function') {
      mediaQuery.addEventListener('change', handleChange);
      return () => mediaQuery.removeEventListener('change', handleChange);
    }

    // 降级支持旧浏览器
    mediaQuery.addListener(handleChange);
    return () => mediaQuery.removeListener(handleChange);
  }, [query]);

  return matches;
};
