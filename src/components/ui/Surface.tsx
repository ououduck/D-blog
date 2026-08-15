/**
 * 通用表面容器：card/panel/overlay 三种变体（圆角/边框/背景差异），供弹层、卡片与区块统一承载内容。
 */

import React, { forwardRef } from 'react';
import { mergeClassName } from '@/utils/classNames';

type SurfaceVariant = 'card' | 'panel' | 'overlay';

interface SurfaceProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: SurfaceVariant;
}

const surfaceVariantClasses: Record<SurfaceVariant, string> = {
  card: 'rounded-surface border border-zinc-300 bg-paper shadow-none transition-[border-color,background-color] duration-150 dark:border-zinc-700 dark:bg-zinc-900',
  panel:
    'rounded-surface border border-zinc-200 bg-zinc-50/70 shadow-none transition-[border-color,background-color] duration-150 dark:border-zinc-800 dark:bg-zinc-900/70',
  overlay:
    'rounded-overlay border border-zinc-300 bg-paper shadow-xl shadow-black/10 dark:border-zinc-700 dark:bg-zinc-900 dark:shadow-black/30',
};

export const Surface = forwardRef<HTMLDivElement, SurfaceProps>(({ variant = 'card', className, ...props }, ref) => (
  <div {...props} ref={ref} className={mergeClassName(surfaceVariantClasses[variant], className)} />
));

Surface.displayName = 'Surface';
