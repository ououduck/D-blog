import React, { forwardRef } from 'react';
import { Search, X } from 'lucide-react';

type SearchFieldSize = 'default' | 'large';
export type SearchFieldVariant = 'default' | 'embedded' | 'subtle';

export interface SearchFieldProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'size' | 'type' | 'onChange'> {
  size?: SearchFieldSize;
  variant?: SearchFieldVariant;
  onValueChange?: (value: string) => void;
  onClear?: () => void;
  clearLabel?: string;
  endAction?: React.ReactNode;
  containerClassName?: string;
}

const variantClasses: Record<SearchFieldVariant, string> = {
  default: 'border-zinc-300 bg-paper focus:border-zinc-900 dark:border-zinc-700 dark:bg-void dark:focus:border-zinc-100',
  embedded: 'border-transparent bg-transparent focus:border-transparent dark:border-transparent dark:bg-transparent dark:focus:border-transparent',
  subtle: 'border-zinc-200 bg-zinc-100/70 focus:border-zinc-400 focus:bg-paper dark:border-zinc-800 dark:bg-zinc-800/70 dark:focus:border-zinc-600 dark:focus:bg-zinc-900',
};

export const SearchField = forwardRef<HTMLInputElement, SearchFieldProps>(({
  size = 'default',
  variant = 'default',
  value,
  onValueChange,
  onClear,
  clearLabel = '清除搜索',
  endAction,
  className = '',
  containerClassName = '',
  disabled,
  ...inputProps
}, ref) => {
  const hasValue = typeof value === 'string' || typeof value === 'number'
    ? String(value).length > 0
    : false;
  const showClear = Boolean(onClear && hasValue && !disabled);
  const inputSpacing = endAction
    ? showClear ? 'pr-24' : 'pr-14'
    : showClear ? 'pr-11' : 'pr-4';
  // iOS Safari 会对聚焦时字号 < 16px 的输入框自动放大页面（导致布局跳动、固定
  // 导航/弹窗错位）。移动端基础字号保持 16px，桌面端（sm 起）再缩回 14px，
  // 桌面浏览器不受此限制。真正决定缩放的是 font-size 而非控件高度。
  const sizeClass = size === 'large' ? 'h-14 text-base sm:text-lg' : 'h-11 text-[16px] sm:text-sm';
  const clearButtonSizeClass = size === 'large' ? 'h-14' : 'h-11';

  return (
    <div className={`group relative min-w-0 ${disabled ? 'opacity-75' : ''} ${containerClassName}`}>
      <Search
        aria-hidden="true"
        size={16}
        className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400 transition-colors group-focus-within:text-zinc-900 dark:text-zinc-500 dark:group-focus-within:text-zinc-100"
      />
      <input
        {...inputProps}
        ref={ref}
        type="search"
        value={value}
        onChange={(event) => onValueChange?.(event.target.value)}
        disabled={disabled}
        className={`w-full min-w-0 appearance-none rounded-control border pl-10 text-ink outline-none transition-[background-color,border-color,color,box-shadow] duration-150 placeholder:text-zinc-400 hover:border-zinc-400 focus:border-zinc-900 focus:ring-2 focus:ring-zinc-900/15 disabled:cursor-not-allowed dark:text-white dark:placeholder:text-zinc-500 dark:hover:border-zinc-600 dark:focus:border-zinc-100 dark:focus:ring-zinc-100/15 [&::-webkit-search-cancel-button]:hidden [&::-webkit-search-decoration]:hidden [&::-webkit-search-results-button]:hidden [&::-webkit-search-results-decoration]:hidden ${variantClasses[variant]} ${sizeClass} ${inputSpacing} ${className}`}
      />
      {(showClear || endAction) && (
        <div className="absolute inset-y-0 right-0 flex items-center">
          {showClear && (
            <button
              type="button"
              onClick={onClear}
              className={`inline-flex ${clearButtonSizeClass} w-10 items-center justify-center text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-zinc-900 dark:text-zinc-500 dark:hover:bg-zinc-800 dark:hover:text-zinc-100 dark:focus-visible:outline-zinc-100`}
              aria-label={clearLabel}
            >
              <X size={16} />
            </button>
          )}
          {endAction}
        </div>
      )}
    </div>
  );
});

SearchField.displayName = 'SearchField';
