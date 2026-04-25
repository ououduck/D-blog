import { useEffect, useState } from 'react';

/**
 * 自定义 hook 用于监听媒体查询变化
 * @param query 媒体查询字符串
 * @param defaultValue 默认值
 * @returns 是否匹配媒体查询
 */
export const useMediaQuery = (query: string, defaultValue = false): boolean => {
  const [matches, setMatches] = useState(() => {
    if (typeof window === 'undefined') {
      return defaultValue;
    }
    return window.matchMedia(query).matches;
  });

  useEffect(() => {
    if (typeof window === 'undefined') {
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
