import type { ImageAssetManifest, ImageAssetVariant, ResponsiveImageProps } from '@/types';
import { assetUrl } from './siteUrl';

const generatedImageModules = import.meta.glob<ImageAssetManifest>('../../generated/image-assets.json', {
  eager: true,
  import: 'default'
});
const imageAssets = Object.values(generatedImageModules)[0] ?? { version: 1, assets: {} };

const normalizeUrl = (value: string) => value
  .split(/[?#]/, 1)[0]
  .replace(/\\/g, '/')
  .replace(/^\/+/, '')
  .toLowerCase();

const findAsset = (src?: string) => {
  if (!src || /^[a-z][a-z0-9+.-]*:/i.test(src)) return undefined;
  const normalized = normalizeUrl(src);
  const key = Object.keys(imageAssets.assets || {}).find((candidate) => {
    const normalizedCandidate = normalizeUrl(candidate);
    return normalizedCandidate === normalized
      || normalizedCandidate.endsWith(`/${normalized}`)
      || normalized.endsWith(`/${normalizedCandidate}`);
  });
  return key ? imageAssets.assets[key] : undefined;
};

const toVariant = (variant: ImageAssetVariant): ImageAssetVariant => ({
  ...variant,
  url: assetUrl(variant.url)
});

export const getResponsiveImageProps = (src?: string, sizes?: string): ResponsiveImageProps => {
  const asset = findAsset(src);
  if (!asset) return {};

  const webp = (asset.variants?.webp || []).map(toVariant);
  const fallback = (asset.variants?.fallback || []).map(toVariant);
  const fallbackSrcSet = fallback.map((variant) => `${variant.url} ${variant.width}w`).join(', ');
  const webpSrcSet = webp.map((variant) => `${variant.url} ${variant.width}w`).join(', ');

  return {
    srcSet: fallbackSrcSet || undefined,
    sources: webpSrcSet ? [{ srcSet: webpSrcSet, type: 'image/webp', sizes }] : undefined
  };
};

export const getResponsiveImageUrls = (src?: string): string[] => {
  const asset = findAsset(src);
  if (!asset) return [];

  return [...new Set([
    ...(asset.variants?.webp || []).map((variant) => assetUrl(variant.url)),
    ...(asset.variants?.fallback || []).map((variant) => assetUrl(variant.url))
  ])];
};

/**
 * 返回资源清单中宽度最大的变体 URL。用于图片预览等场景，
 * 避免直接加载可能超过 2000px 的原始图（节省移动端流量与内存）。
 * 无匹配变体时返回 undefined，调用方应回退到原 src。
 */
export const getLargestImageUrl = (src?: string): string | undefined => {
  const asset = findAsset(src);
  if (!asset) return undefined;

  const allVariants = [
    ...(asset.variants?.webp || []),
    ...(asset.variants?.fallback || [])
  ];
  const largest = allVariants.reduce<ImageAssetVariant | null>(
    (current, variant) => (!current || variant.width > current.width ? variant : current),
    null
  );
  return largest ? assetUrl(largest.url) : undefined;
};

