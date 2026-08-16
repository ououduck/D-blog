/**
 * 分页组件：页码/上一页/下一页导航，支持 URL 参数同步与键盘可达性。
 */

import React, { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

type PaginationItem = number | 'ellipsis-start' | 'ellipsis-end';

const getPaginationItems = (currentPage: number, totalPages: number): PaginationItem[] => {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, index) => index + 1);
  }

  const pages = new Set([1, totalPages, currentPage - 1, currentPage, currentPage + 1]);
  const sortedPages = Array.from(pages)
    .filter((page) => page > 0 && page <= totalPages)
    .sort((a, b) => a - b);
  const items: PaginationItem[] = [];

  sortedPages.forEach((page, index) => {
    if (index > 0 && page - sortedPages[index - 1] > 1) {
      items.push(index === 1 ? 'ellipsis-start' : 'ellipsis-end');
    }
    items.push(page);
  });

  return items;
};

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

const buttonClass =
  'inline-flex h-11 min-w-11 items-center justify-center rounded-control border border-zinc-300 bg-paper px-3 text-sm font-semibold text-zinc-700 transition-[background-color,border-color,color,opacity,transform,box-shadow] duration-150 active:scale-[.98] hover:border-ink hover:bg-zinc-100 hover:text-ink hover:shadow-[0_1px_2px_rgba(24,24,27,0.08)] disabled:cursor-not-allowed disabled:opacity-30 disabled:active:scale-100 dark:border-zinc-700 dark:bg-void dark:text-zinc-300 dark:hover:border-white dark:hover:bg-zinc-900 dark:hover:text-white dark:hover:shadow-none';
const activeButtonClass =
  'border-ink bg-ink text-white shadow-[0_1px_3px_rgba(24,24,27,0.35)] hover:border-ink hover:bg-ink hover:text-white dark:border-white dark:bg-white dark:text-ink dark:shadow-none dark:hover:border-white dark:hover:bg-white dark:hover:text-ink';

export const Pagination: React.FC<PaginationProps> = ({ currentPage, totalPages, onPageChange }) => {
  const [pageInput, setPageInput] = useState(String(currentPage));

  useEffect(() => {
    setPageInput(String(currentPage));
  }, [currentPage]);

  if (totalPages <= 1) return null;

  const submitPageInput = () => {
    const pageNumber = Number(pageInput);
    if (!pageInput.trim() || !Number.isInteger(pageNumber)) {
      setPageInput(String(currentPage));
      return;
    }
    // 页码未变化时短路：聚焦输入框后直接点空白处（失焦）不再写 URL/新增历史记录。
    if (pageNumber === currentPage) {
      setPageInput(String(currentPage));
      return;
    }
    onPageChange(Math.min(Math.max(1, pageNumber), totalPages));
  };

  return (
    <nav
      className="flex flex-wrap items-center justify-center gap-2 border-t border-zinc-200 pt-5 dark:border-zinc-800"
      aria-label="分页导航"
    >
      <button
        type="button"
        onClick={() => onPageChange(currentPage - 1)}
        disabled={currentPage === 1}
        // mousedown 阻止默认行为：输入框聚焦时点击翻页按钮会先触发 onBlur
        // 提交输入框的值，再触发 click 导航 —— 双重跳转且 click 用的是旧
        // currentPage 闭包。阻止 mousedown 默认行为可避免输入框失焦（不提交
        // 未确认的页码），导航后 useEffect 会把输入框同步为当前页。
        onMouseDown={(event) => event.preventDefault()}
        className={`${buttonClass} px-3`}
        aria-label="上一页"
      >
        <ChevronLeft size={15} />
        <span className="hidden sm:inline">上一页</span>
      </button>
      <div
        className="flex min-w-0 flex-wrap items-center justify-center gap-1.5"
        aria-label={`第 ${currentPage} 页，共 ${totalPages} 页`}
      >
        {getPaginationItems(currentPage, totalPages).map((item) => {
          if (typeof item !== 'number') {
            return (
              <span
                key={item}
                className="flex h-11 min-w-4 items-center justify-center text-sm text-zinc-400"
                aria-hidden="true"
              >
                …
              </span>
            );
          }
          return (
            <button
              key={item}
              type="button"
              onClick={() => onPageChange(item)}
              onMouseDown={(event) => event.preventDefault()}
              aria-current={currentPage === item ? 'page' : undefined}
              aria-label={`第 ${item} 页`}
              className={`${buttonClass} ${currentPage === item ? activeButtonClass : ''}`}
            >
              {item}
            </button>
          );
        })}
        <input
          type="number"
          inputMode="numeric"
          min={1}
          max={totalPages}
          value={pageInput}
          onChange={(event) => setPageInput(event.target.value)}
          onBlur={submitPageInput}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              // 失焦触发 onBlur 统一提交，避免与 onKeyDown 重复调用 submitPageInput。
              event.currentTarget.blur();
            }
          }}
          aria-label={`跳转到第几页，共 ${totalPages} 页`}
          className="h-11 w-14 rounded-control border border-zinc-300 bg-paper px-2 text-center text-sm font-semibold text-ink outline-none transition-colors hover:border-zinc-400 focus:border-ink dark:border-zinc-700 dark:bg-void dark:text-white dark:hover:border-zinc-600 dark:focus:border-white"
        />
      </div>
      <button
        type="button"
        onClick={() => onPageChange(currentPage + 1)}
        disabled={currentPage === totalPages}
        onMouseDown={(event) => event.preventDefault()}
        className={`${buttonClass} px-3`}
        aria-label="下一页"
      >
        <span className="hidden sm:inline">下一页</span>
        <ChevronRight size={15} />
      </button>
      <span className="sr-only" aria-live="polite">
        已在第 {currentPage} 页，共 {totalPages} 页
      </span>
    </nav>
  );
};
