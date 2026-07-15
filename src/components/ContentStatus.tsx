import React from 'react';

type ContentStatusVariant = 'empty' | 'error';

interface ContentStatusProps {
  title: string;
  description?: string;
  variant?: ContentStatusVariant;
  actionLabel?: string;
  onAction?: () => void;
  className?: string;
}

const mergeClassName = (...values: Array<string | undefined | false>) => values.filter(Boolean).join(' ');

export const ContentStatus: React.FC<ContentStatusProps> = ({
  title,
  description,
  variant = 'empty',
  actionLabel,
  onAction,
  className
}) => (
  <div
    role={variant === 'error' ? 'alert' : 'status'}
    className={mergeClassName(
      'border-y py-10 text-center',
      variant === 'error'
        ? 'border-dashed border-red-300 dark:border-red-900/60'
        : 'border-zinc-200 dark:border-zinc-800',
      className
    )}
  >
    <p className={mergeClassName(
      'font-serif text-lg font-semibold',
      variant === 'error'
        ? 'text-red-800 dark:text-red-200'
        : 'text-zinc-700 dark:text-zinc-300'
    )}>
      {title}
    </p>
    {description && (
      <p className="mt-2 text-sm leading-6 text-zinc-500 dark:text-zinc-400">{description}</p>
    )}
    {actionLabel && onAction && (
      <button type="button" onClick={onAction} className="editorial-button mt-4">
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
