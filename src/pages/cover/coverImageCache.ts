import { loadImage } from './coverFiles';

const imageCache = new Map<string, Promise<HTMLImageElement>>();

export function loadCachedImage(source: string): Promise<HTMLImageElement> {
  const cached = imageCache.get(source);
  if (cached) return cached;
  // 缓存 rejected promise：预览期间的重复渲染不会为同一失效资源反复发请求，
  // 会话内一直使用占位图兜底（封面生成器每次打开即为新会话）。
  const promise = loadImage(source);
  imageCache.set(source, promise);
  return promise;
}

export function preloadImage(source: string): Promise<HTMLImageElement> {
  return loadCachedImage(source);
}
