import React from 'react';
import { mergeClassName } from '@/utils/classNames';

type ContentStatusVariant = 'empty' | 'error';

interface ContentStatusProps {
  title: string;
  description?: string;
  variant?: ContentStatusVariant;
  actionLabel?: string;
  onAction?: () => void;
  className?: string;
}

export const ContentStatus: React.FC<ContentStatusProps> = ({
  title,
  description,
  variant = 'empty',
  actionLabel,
  onAction,
  className,
}) => (
  <div
    role={variant === 'error' ? 'alert' : 'status'}
    className={mergeClassName(
      'border-y px-3 py-10 text-center sm:px-6',
      variant === 'error'
        ? 'border-dashed border-zinc-500 dark:border-zinc-500'
        : 'border-zinc-200 dark:border-zinc-800',
      className,
    )}
  >
    <p
      className={mergeClassName(
        'font-serif text-lg font-semibold',
        variant === 'error' ? 'text-zinc-950 dark:text-zinc-100' : 'text-zinc-700 dark:text-zinc-300',
      )}
    >
      {title}
    </p>
    {description && <p className="mt-2 text-sm leading-6 text-zinc-500 dark:text-zinc-400">{description}</p>}
    {actionLabel && onAction && (
      <button type="button" onClick={onAction} className="editorial-button mt-4 rounded-control active:scale-[.98]">
        {actionLabel}
      </button>
    )}
  </div>
);

interface LoadingStatusProps {
  label: string;
  className?: string;
}

export const LoadingStatus: React.FC<LoadingStatusProps> = ({ label, className }) => (
  <div role="status" aria-live="polite" className={className}>
    <span className="sr-only">{label}</span>
  </div>
);
