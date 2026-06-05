import React, { useEffect, useRef, useState } from 'react';

interface ProgressiveImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  wrapperClassName?: string;
  placeholderClassName?: string;
  aspectRatio?: string;
}

const mergeClassName = (...values: Array<string | undefined | false>) => values.filter(Boolean).join(' ');

export const ProgressiveImage: React.FC<ProgressiveImageProps> = React.memo(({
  wrapperClassName,
  placeholderClassName,
  className,
  onLoad,
  onError,
  decoding = 'async',
  src,
  alt,
  aspectRatio,
  width,
  height,
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

  return (
    <div className={mergeClassName('relative overflow-hidden', wrapperClassName)} style={wrapperStyle}>
      <div
        aria-hidden="true"
        className={mergeClassName(
          'pointer-events-none absolute inset-0 bg-zinc-200/80 transition-opacity duration-500 dark:bg-zinc-800/80',
          isLoaded || hasError ? 'opacity-0' : 'opacity-100',
          placeholderClassName
        )}
      />
      <div
        aria-hidden="true"
        className={mergeClassName(
          'pointer-events-none absolute inset-0 flex items-center justify-center bg-zinc-100/70 transition-opacity duration-500 dark:bg-zinc-900/60',
          isLoaded || hasError ? 'opacity-0' : 'opacity-100'
        )}
      >
        <div className="h-5 w-5 animate-spin rounded-full border-2 border-zinc-300 border-t-zinc-500 dark:border-zinc-700 dark:border-t-zinc-400" />
      </div>
      {hasError ? (
        <div className="relative flex min-h-[6rem] items-center justify-center rounded-inherit bg-zinc-100/90 px-4 py-6 text-center text-sm text-zinc-500 dark:bg-zinc-900/80 dark:text-zinc-400">
          图片加载失败{alt ? `：${alt}` : ''}
        </div>
      ) : (
        <img
          {...props}
          ref={imgRef}
          src={src}
          alt={alt}
          decoding={decoding}
          width={props.width}
          height={props.height}
          className={mergeClassName(
            'relative transition-all duration-700 ease-out',
            isLoaded ? 'scale-100 blur-0 opacity-100' : 'scale-[1.03] blur-xl opacity-0',
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

