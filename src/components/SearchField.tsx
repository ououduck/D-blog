import React, { forwardRef } from 'react';
import { Search, X } from 'lucide-react';

type SearchFieldSize = 'default' | 'large';

export interface SearchFieldProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'size' | 'type' | 'onChange'> {
  size?: SearchFieldSize;
  onValueChange?: (value: string) => void;
  onClear?: () => void;
  clearLabel?: string;
  endAction?: React.ReactNode;
  containerClassName?: string;
}

export const SearchField = forwardRef<HTMLInputElement, SearchFieldProps>(({
  size = 'default',
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
  const sizeClass = size === 'large' ? 'h-14 text-base sm:text-lg' : 'h-11 text-sm';

  return (
    <div className={`group relative ${containerClassName}`}>
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
        className={`w-full appearance-none rounded-none border border-zinc-300 bg-paper pl-10 text-ink outline-none transition-colors placeholder:text-zinc-400 focus:border-zinc-900 disabled:cursor-not-allowed disabled:opacity-60 dark:border-zinc-700 dark:bg-void dark:text-white dark:placeholder:text-zinc-500 dark:focus:border-zinc-100 [&::-webkit-search-cancel-button]:hidden [&::-webkit-search-decoration]:hidden [&::-webkit-search-results-button]:hidden [&::-webkit-search-results-decoration]:hidden ${sizeClass} ${inputSpacing} ${className}`}
      />
      {(showClear || endAction) && (
        <div className="absolute inset-y-0 right-0 flex items-center">
          {showClear && (
            <button
              type="button"
              onClick={onClear}
              className="inline-flex h-11 w-10 items-center justify-center text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-zinc-900 dark:text-zinc-500 dark:hover:bg-zinc-800 dark:hover:text-zinc-100 dark:focus-visible:outline-zinc-100"
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
