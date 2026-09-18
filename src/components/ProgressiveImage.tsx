/**
 * 渐进式图片：占位渐变 + 模糊层 + 淡入过渡，支持 aspectRatio 防 CLS、响应式 sources 与减弱动效降级。
 */

import React, { useEffect, useRef, useState } from 'react';
import { RotateCcw } from 'lucide-react';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { mergeClassName } from '@/utils/classNames';

type ProgressiveImageRadius = 'none' | 'media' | 'icon' | 'surface' | 'overlay' | 'full';

interface ProgressiveImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  wrapperClassName?: string;
  placeholderClassName?: string;
  aspectRatio?: string;
  effect?: 'blur' | 'fade' | 'none';
  radius?: ProgressiveImageRadius;
  sources?: Array<{
    srcSet: string;
    type?: string;
    media?: string;
    sizes?: string;
  }>;
}

const radiusClasses: Record<ProgressiveImageRadius, string> = {
  none: 'rounded-none',
  media: 'rounded-media',
  icon: 'rounded-icon',
  surface: 'rounded-surface',
  overlay: 'rounded-overlay',
  full: 'rounded-full',
};

const PAPER_PLACEHOLDER = 'linear-gradient(135deg, #eee9df 0%, #e4ddd1 52%, #d8cfc1 100%)';

/** 重试请求附加缓存穿透参数：同 URL 失败结果可能被浏览器/中间层缓存，换参强制回源。 */
const appendRetryParam = (url: string, attempt: number) => `${url}${url.includes('?') ? '&' : '?'}dbr=${attempt}`;

export const ProgressiveImage: React.FC<ProgressiveImageProps> = React.memo(
  ({
    wrapperClassName,
    placeholderClassName,
    className,
    onLoad,
    onError,
    decoding = 'async',
    loading: loadingProp,
    src,
    alt,
    aspectRatio,
    effect = 'blur',
    radius = 'none',
    width,
    height,
    sizes,
    srcSet,
    sources,
    ...props
  }) => {
    const imgRef = useRef<HTMLImageElement | null>(null);
    const [isLoaded, setIsLoaded] = useState(false);
    const [hasError, setHasError] = useState(false);
    // 用户点击「重试」的次数：仅用户主动触发重载，绝不自动循环请求；
    // >0 时给 src 附加 dbr 参数绕过失败缓存并去掉 sources（srcSet 候选无法改参）。
    const [retryAttempt, setRetryAttempt] = useState(0);

    // 优化：当 src 变化时重置状态并同步图片状态
    useEffect(() => {
      setIsLoaded(false);
      setHasError(false);
      setRetryAttempt(0);

      const image = imgRef.current;
      if (!image || !src) {
        return;
      }

      // 检查图片是否已经加载完成（来自缓存）
      if (image.complete) {
        if (image.naturalWidth > 0) {
          setIsLoaded(true);
        } else {
          setHasError(true);
        }
      }
    }, [src]);

    const wrapperStyle: React.CSSProperties = { minHeight: '1px' };
    if (aspectRatio) {
      wrapperStyle.aspectRatio = aspectRatio;
    } else if (width && height) {
      wrapperStyle.aspectRatio = `${width} / ${height}`;
    }

    const resolvedLoading = loadingProp || (props.fetchPriority === 'high' ? 'eager' : 'lazy');
    const prefersReducedMotion = useReducedMotion();
    // src 缺失时既不触发 onLoad 也不触发 onError：直接走错误分支显示 alt 提示，
    // 避免渲染一个不可见的空 <picture>（无占位层、无错误态、无 alt 文本）。
    const hasUsableSrc = Boolean(src);
    const showBlurPlaceholder = effect === 'blur' && hasUsableSrc;
    const showPlaceholder = effect !== 'none' && hasUsableSrc;
    // eager 图片（LCP 候选）首帧必须可见：SSR HTML 里若带 opacity-0，
    // 爬虫/智能体读取到不可见内容，且浏览器要等水合后才淡入，直接拖慢 LCP。
    const eagerLcpPaint = resolvedLoading === 'eager';
    const imageTransitionClass =
      prefersReducedMotion || effect === 'none' || eagerLcpPaint
        ? 'opacity-100'
        : effect === 'fade'
          ? isLoaded
            ? 'opacity-100'
            : 'opacity-0'
          : 'opacity-100';
    const transitionDurationClass = prefersReducedMotion ? 'duration-0' : 'duration-300';
    const placeholderStyle: React.CSSProperties = { backgroundImage: PAPER_PLACEHOLDER };
    const activeSrc = retryAttempt > 0 && src ? appendRetryParam(src, retryAttempt) : src;
    const activeSources = retryAttempt > 0 ? undefined : sources;

    const handleRetry = (event: React.MouseEvent<HTMLButtonElement>) => {
      // 阻断冒泡：错误占位可能嵌在可点击容器（如封面预览按钮）内，
      // 重试不得同时触发外层的预览/跳转。
      event.stopPropagation();
      event.preventDefault();
      setIsLoaded(false);
      setHasError(false);
      setRetryAttempt((value) => value + 1);
    };

    return (
      <div
        className={mergeClassName('relative overflow-hidden', radiusClasses[radius], wrapperClassName)}
        style={wrapperStyle}
      >
        {showPlaceholder && (
          <div
            aria-hidden="true"
            className={mergeClassName(
              `pointer-events-none absolute inset-0 bg-cover transition-opacity ${transitionDurationClass} dark:brightness-[0.42] dark:saturate-[0.55]`,
              isLoaded || hasError ? 'opacity-0' : 'opacity-100',
              placeholderClassName,
            )}
            style={placeholderStyle}
          />
        )}
        {showBlurPlaceholder && !hasError && (
          <div
            aria-hidden="true"
            className={mergeClassName(
              `pointer-events-none absolute inset-0 scale-110 bg-cover bg-center opacity-40 blur-xl transition-opacity ${prefersReducedMotion ? 'duration-0' : 'duration-500'} dark:opacity-25`,
              isLoaded ? 'opacity-0 dark:opacity-0' : undefined,
            )}
            style={placeholderStyle}
          />
        )}
        {showPlaceholder && (
          <div
            aria-hidden="true"
            className={mergeClassName(
              `pointer-events-none absolute inset-0 flex items-center justify-center bg-zinc-100/55 transition-opacity ${transitionDurationClass} dark:bg-zinc-900/55`,
              isLoaded || hasError ? 'opacity-0' : 'opacity-100',
            )}
          />
        )}
        {hasError || !hasUsableSrc ? (
          <div className="relative flex min-h-[6rem] h-full w-full flex-col items-center justify-center gap-2 rounded-[inherit] border border-dashed border-zinc-200 bg-zinc-100/90 px-4 py-6 text-center text-xs font-medium text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900/80 dark:text-zinc-400">
            <span className="line-clamp-2">图片暂时无法加载{alt ? `：${alt}` : ''}</span>
            {hasError && hasUsableSrc && (
              <button
                type="button"
                onClick={handleRetry}
                className="inline-flex min-h-9 items-center justify-center rounded-control border border-zinc-300 bg-paper px-3 py-1.5 text-xs font-semibold text-zinc-700 transition-colors hover:border-zinc-500 hover:bg-zinc-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:border-zinc-500 dark:hover:bg-zinc-800 dark:focus-visible:outline-zinc-100"
              >
                <RotateCcw size={13} aria-hidden="true" />
                点击重试
              </button>
            )}
          </div>
        ) : (
          <picture className="contents">
            {activeSources?.map((source) => (
              <source
                key={`${source.type || 'image'}-${source.media || 'all'}-${source.srcSet}`}
                srcSet={source.srcSet}
                type={source.type}
                media={source.media}
                sizes={source.sizes || sizes}
              />
            ))}
            <img
              {...props}
              ref={imgRef}
              src={activeSrc}
              alt={alt}
              decoding={decoding}
              loading={resolvedLoading}
              width={width}
              height={height}
              sizes={sizes}
              srcSet={srcSet}
              className={mergeClassName(
                'relative transition-opacity duration-500 ease-out',
                imageTransitionClass,
                className,
              )}
              onLoad={(event) => {
                setIsLoaded(true);
                setHasError(false);
                onLoad?.(event);
              }}
              onError={(event) => {
                setHasError(true);
                onError?.(event);
              }}
            />
          </picture>
        )}
      </div>
    );
  },
);
