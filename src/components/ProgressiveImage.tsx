import React, { useEffect, useRef, useState } from 'react';

interface ProgressiveImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  wrapperClassName?: string;
  placeholderClassName?: string;
  aspectRatio?: string;
  effect?: 'blur' | 'fade' | 'none';
}

const mergeClassName = (...values: Array<string | undefined | false>) => values.filter(Boolean).join(' ');

const getPlaceholderColor = (seed: string, offset: number) => {
  let hash = offset;
  for (let index = 0; index < seed.length; index += 1) {
    hash = (hash * 31 + seed.charCodeAt(index)) % 360;
  }
  return `hsl(${hash} 18% ${offset === 0 ? '86%' : '74%'})`;
};

const createLowQualityPlaceholder = (seed: string) => {
  const baseColor = getPlaceholderColor(seed, 0);
  const midColor = getPlaceholderColor(seed, 83);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 20"><defs><linearGradient id="g" x1="0" x2="1" y1="0" y2="1"><stop stop-color="${baseColor}"/><stop offset="1" stop-color="${midColor}"/></linearGradient></defs><rect width="32" height="20" fill="url(#g)"/><circle cx="8" cy="6" r="9" fill="rgba(255,255,255,.24)"/><circle cx="25" cy="17" r="10" fill="rgba(0,0,0,.08)"/></svg>`;
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
};

export const ProgressiveImage: React.FC<ProgressiveImageProps> = React.memo(({
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
  width,
  height,
  sizes,
  ...props
}) => {
  const imgRef = useRef<HTMLImageElement | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);

  // 优化：当 src 变化时重置状态并同步图片状态
  useEffect(() => {
    setIsLoaded(false);
    setHasError(false);

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
  const prefersReducedMotion = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  const imageTransitionClass = prefersReducedMotion || effect === 'none'
    ? 'opacity-100'
    : isLoaded ? 'opacity-100' : 'opacity-0';
  const lowQualityPlaceholderStyle: React.CSSProperties | undefined = src
    ? { backgroundImage: createLowQualityPlaceholder(String(src)) }
    : undefined;

  return (
    <div className={mergeClassName('relative overflow-hidden', wrapperClassName)} style={wrapperStyle}>
      <div
        aria-hidden="true"
        className={mergeClassName(
          'pointer-events-none absolute inset-0 bg-zinc-200 transition-opacity duration-300 dark:bg-zinc-800',
          isLoaded || hasError ? 'opacity-0' : 'opacity-100',
          placeholderClassName
        )}
      />
      {src && !hasError && (
        <div
          aria-hidden="true"
          className={mergeClassName(
            'pointer-events-none absolute inset-0 scale-110 bg-cover bg-center opacity-40 blur-xl transition-opacity duration-500 dark:opacity-25',
            isLoaded ? 'opacity-0 dark:opacity-0' : undefined
          )}
          style={lowQualityPlaceholderStyle}
        />
      )}
      <div
        aria-hidden="true"
        className={mergeClassName(
          'pointer-events-none absolute inset-0 flex items-center justify-center bg-zinc-100/55 transition-opacity duration-300 dark:bg-zinc-900/55',
          isLoaded || hasError ? 'opacity-0' : 'opacity-100'
        )}
      >
        <div className="h-5 w-5 animate-spin rounded-full border-2 border-zinc-300/80 border-t-accent dark:border-zinc-700/80 dark:border-t-accent-light" />
      </div>
      {hasError ? (
        <div className="relative flex min-h-[6rem] items-center justify-center rounded-inherit border border-dashed border-zinc-200 bg-zinc-100/90 px-4 py-6 text-center text-xs font-medium text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900/80 dark:text-zinc-400">
          <span className="line-clamp-2">图片暂时无法加载{alt ? `：${alt}` : ''}</span>
        </div>
      ) : (
        <img
          {...props}
          ref={imgRef}
          src={src}
          alt={alt}
          decoding={decoding}
          loading={resolvedLoading}
          width={width}
          height={height}
          sizes={sizes}
          className={mergeClassName(
            'relative transition-all duration-500 ease-out',
            imageTransitionClass,
            className
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
      )}
    </div>
  );
});

