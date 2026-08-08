import { useEffect, useState } from 'react';

/**
 * 自定义 hook 用于监听媒体查询变化
 * @param query 媒体查询字符串
 * @param defaultValue 默认值
 * @returns 是否匹配媒体查询
 */
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
