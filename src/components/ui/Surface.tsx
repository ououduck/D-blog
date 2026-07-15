import React, { forwardRef } from 'react';

export type SurfaceVariant = 'card' | 'panel' | 'overlay';

export interface SurfaceProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: SurfaceVariant;
}

export const surfaceVariantClasses: Record<SurfaceVariant, string> = {
  card: 'rounded-surface border border-zinc-300 bg-paper shadow-none dark:border-zinc-700 dark:bg-zinc-900',
  panel: 'rounded-surface border border-zinc-200 bg-zinc-50/70 shadow-none dark:border-zinc-800 dark:bg-zinc-900/70',
  overlay: 'rounded-overlay border border-zinc-300 bg-paper shadow-xl shadow-black/10 dark:border-zinc-700 dark:bg-zinc-900 dark:shadow-black/30',
};

const mergeClassName = (...values: Array<string | undefined | false>) => values.filter(Boolean).join(' ');

export const Surface = forwardRef<HTMLDivElement, SurfaceProps>(({
  variant = 'card',
  className,
  ...props
}, ref) => (
  <div
    {...props}
    ref={ref}
    className={mergeClassName(surfaceVariantClasses[variant], className)}
  />
));

Surface.displayName = 'Surface';
