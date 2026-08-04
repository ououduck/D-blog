import { loadImage } from './coverFiles';

const imageCache = new Map<string, Promise<HTMLImageElement>>();

export function loadCachedImage(source: string): Promise<HTMLImageElement> {
  const cached = imageCache.get(source);
  if (cached) return cached;
  // Keep the rejected promise too: repeated preview renders should not start
  // another request for the same broken resource until the caller clears it.
  const promise = loadImage(source);
  imageCache.set(source, promise);
  return promise;
}

export function preloadImage(source: string): Promise<HTMLImageElement> {
  return loadCachedImage(source);
}

export function clearImageCache(source?: string): void {
  if (source) imageCache.delete(source);
  else imageCache.clear();
}
