import { CloudflareSnapshot } from '../types';

const CACHE_DURATION = 5 * 60 * 1000; // 5分钟缓存
let cloudflareCache: { data: CloudflareSnapshot; timestamp: number } | null = null;

const fetchLiveCloudflareData = async (): Promise<CloudflareSnapshot> => {
  // 尝试从Cloudflare Workers或API获取实时数据
  try {
    const response = await fetch('/api/cloudflare-stats');
    if (response.ok) {
      const data = await response.json();
      return data;
    }
  } catch (error) {
    console.warn('Failed to fetch live Cloudflare data:', error);
  }

  // 降级到构建时生成的静态数据
  const data = await import('../../generated/cloudflare.json');
  return data.default as CloudflareSnapshot;
};

export const getCloudflareSnapshot = async (forceRefresh = false): Promise<CloudflareSnapshot> => {
  const now = Date.now();
  
  // 检查缓存是否有效
  if (!forceRefresh && cloudflareCache && (now - cloudflareCache.timestamp) < CACHE_DURATION) {
    return cloudflareCache.data;
  }

  // 获取新数据
  const data = await fetchLiveCloudflareData();
  cloudflareCache = { data, timestamp: now };
  
  return data;
};
