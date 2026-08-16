/**
 * 封面素材图片的模块级内存缓存：按 URL 缓存加载中的 Promise，预览期间
 * 重复渲染不会为同一资源反复发请求。
 *
 * 淘汰策略：
 * - 大小上限（LRU）：用户上传的 data URL 背景图可能达数 MB，会话内无限
 *   累积会持续占用内存；超出上限时淘汰最久未用的条目（Map 头部）。
 * - 失败冷却：加载失败（临时网络故障、超时）不永久缓存 —— 冷却期内复用
 *   失败结果避免预览重复渲染刷请求，冷却期后移除，下次加载重新尝试
 *   （原实现把 rejected promise 永久缓存，一次故障后整个会话无法自愈，
 *   永远回退占位 Logo）。
 */
import { loadImage } from './coverFiles';

const CACHE_MAX_ENTRIES = 64;
const REJECTION_COOLDOWN_MS = 10_000;

const imageCache = new Map<string, Promise<HTMLImageElement>>();

const touchEntry = (source: string) => {
  const entry = imageCache.get(source);
  if (entry) {
    // Map 重新插入把条目移到末尾，保持 LRU 顺序。
    imageCache.delete(source);
    imageCache.set(source, entry);
  }
};

export function loadCachedImage(source: string): Promise<HTMLImageElement> {
  const cached = imageCache.get(source);
  if (cached) {
    touchEntry(source);
    return cached;
  }

  const promise = loadImage(source);
  imageCache.set(source, promise);

  // 失败不永久缓存：冷却期后移除条目，临时故障可自愈。
  promise.catch(() => {
    window.setTimeout(() => {
      if (imageCache.get(source) === promise) {
        imageCache.delete(source);
      }
    }, REJECTION_COOLDOWN_MS);
  });

  // 超出大小上限时淘汰最久未用条目。
  if (imageCache.size > CACHE_MAX_ENTRIES) {
    const oldestKey = imageCache.keys().next().value;
    if (oldestKey !== undefined) {
      imageCache.delete(oldestKey);
    }
  }

  return promise;
}

export function preloadImage(source: string): Promise<HTMLImageElement> {
  return loadCachedImage(source);
}
