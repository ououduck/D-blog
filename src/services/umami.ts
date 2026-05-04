import { UmamiSnapshot } from '../types';

const CACHE_DURATION = 5 * 60 * 1000; // 5分钟缓存
let umamiCache: { data: UmamiSnapshot; timestamp: number } | null = null;

const fetchLiveUmamiData = async (): Promise<UmamiSnapshot> => {
  // 尝试从API获取实时数据
  try {
    const response = await fetch('/api/umami-stats');
    if (response.ok) {
      const data = await response.json();
      return data;
    }
  } catch (error) {
    console.warn('Failed to fetch live Umami data:', error);
  }

  // 降级到构建时生成的静态数据
  try {
    const data = await import('../../generated/umami.json');
    return data.default as UmamiSnapshot;
  } catch (error) {
    console.warn('Failed to load static Umami data:', error);
    return {
      enabled: false,
      fetchedAt: null,
      websiteId: '',
      timeWindows: []
    };
  }
};

export const getUmamiSnapshot = async (forceRefresh = false): Promise<UmamiSnapshot> => {
  const now = Date.now();
  
  // 检查缓存是否有效
  if (!forceRefresh && umamiCache && (now - umamiCache.timestamp) < CACHE_DURATION) {
    return umamiCache.data;
  }

  // 获取新数据
  const data = await fetchLiveUmamiData();
  umamiCache = { data, timestamp: now };
  
  return data;
};
