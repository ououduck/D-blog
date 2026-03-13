import { CloudflareSnapshot } from '../types';

let cloudflareCache: CloudflareSnapshot | null = null;

export const getCloudflareSnapshot = async (): Promise<CloudflareSnapshot> => {
  if (cloudflareCache) {
    return cloudflareCache;
  }

  const data = await import('../../generated/cloudflare.json');
  cloudflareCache = data.default as CloudflareSnapshot;
  return cloudflareCache;
};
