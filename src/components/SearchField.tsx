/**
 * 搜索输入框：放大镜图标 + 清除按钮 + 可选尾部操作（endAction），带 iOS 聚焦字号防放大处理。
 */

import React, { forwardRef, useRef } from 'react';
import { Search, X } from 'lucide-react';

type SearchFieldSize = 'default' | 'large';

interface SearchFieldProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'size' | 'type' | 'onChange'> {
  size?: SearchFieldSize;
  onValueChange?: (value: string) => void;
  onClear?: () => void;
  clearLabel?: string;
  endAction?: React.ReactNode;
  containerClassName?: string;
}

const variantClasses =
  'border-zinc-300 bg-paper focus:border-zinc-900 dark:border-zinc-700 dark:bg-void dark:focus:border-zinc-100';

export const SearchField = forwardRef<HTMLInputElement, SearchFieldProps>(
  (
    {
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
    },
    ref,
  ) => {
    // 中文输入法（IME）组合期间的中间态（拼音未确认）不应触发搜索：
    // compositionstart/end 之间忽略 onChange，组合结束时补一次完整值。
    const isComposingRef = useRef(false);
    // 组合结束时刻（performance.now）：部分浏览器组合确认时 compositionend 先于
    // keydown 派发（Chrome 反之），确认拼音的 Enter 在 isComposing 已复位的情况下
    // 会漏进上层快捷键处理（如搜索弹窗的 Enter 导航），跳到上一次搜索的旧结果。
    // 组合结束瞬间（<80ms）的 Enter 视为 IME 确认的尾随事件直接吞掉。
    const compositionEndedAtRef = useRef(0);
    const hasValue = typeof value === 'string' || typeof value === 'number' ? String(value).length > 0 : false;
    const showClear = Boolean(onClear && hasValue && !disabled);
    const inputSpacing = endAction ? (showClear ? 'pr-24' : 'pr-14') : showClear ? 'pr-11' : 'pr-4';
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
          onChange={(event) => {
            if (isComposingRef.current) return;
            onValueChange?.(event.target.value);
          }}
          onCompositionStart={() => {
            isComposingRef.current = true;
          }}
          onCompositionEnd={(event) => {
            isComposingRef.current = false;
            // 记录组合结束时刻，供 onKeyDown 拦截 IME 确认 Enter 的尾随 keydown。
            compositionEndedAtRef.current = performance.now();
            // 组合结束补发一次完整值，让防抖搜索基于最终中文。
            onValueChange?.(event.currentTarget.value);
          }}
          onKeyDown={(event) => {
            // 组合结束瞬间的 Enter 是 IME 确认的尾随事件（compositionend 先于
            // keydown 派发的浏览器里 isComposing 已复位，上层会误当"确认搜索"），
            // 拦截后由防抖搜索在组合结束补发的完整值上继续；之后的 Enter 正常放行。
            if (event.key === 'Enter' && performance.now() - compositionEndedAtRef.current < 80) {
              event.preventDefault();
              return;
            }
            inputProps.onKeyDown?.(event);
          }}
          onBlur={(event) => {
            // 防御：组合进行中失焦（点击清除按钮/移开焦点）时，若浏览器未派发
            // compositionend（取消组合的派发行为因浏览器/输入法而异），组合标记
            // 会永久卡在 true 导致后续输入全部被忽略。失焦即复位，保证状态不粘滞。
            isComposingRef.current = false;
            inputProps.onBlur?.(event);
          }}
          disabled={disabled}
          className={`w-full min-w-0 appearance-none rounded-control border pl-10 text-ink outline-none transition-[background-color,border-color,color,box-shadow] duration-150 placeholder:text-zinc-400 hover:border-zinc-400 focus:border-zinc-900 focus:ring-2 focus:ring-zinc-900/15 disabled:cursor-not-allowed dark:text-white dark:placeholder:text-zinc-500 dark:hover:border-zinc-600 dark:focus:border-zinc-100 dark:focus:ring-zinc-100/15 [&::-webkit-search-cancel-button]:hidden [&::-webkit-search-decoration]:hidden [&::-webkit-search-results-button]:hidden [&::-webkit-search-results-decoration]:hidden ${variantClasses} ${sizeClass} ${inputSpacing} ${className}`}
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
  },
);

SearchField.displayName = 'SearchField';
