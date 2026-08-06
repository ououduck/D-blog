import React, { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

type PaginationItem = number | 'ellipsis-start' | 'ellipsis-end';

export const getPaginationItems = (currentPage: number, totalPages: number): PaginationItem[] => {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, index) => index + 1);
  }

  const pages = new Set([1, totalPages, currentPage - 1, currentPage, currentPage + 1]);
  const sortedPages = Array.from(pages).filter((page) => page > 0 && page <= totalPages).sort((a, b) => a - b);
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

const buttonClass = 'inline-flex h-9 min-w-9 items-center justify-center rounded-full border border-zinc-300 bg-paper px-3 text-sm font-semibold text-zinc-700 transition-colors active:scale-[.98] hover:border-ink hover:text-ink disabled:cursor-not-allowed disabled:opacity-30 dark:border-zinc-700 dark:bg-void dark:text-zinc-300 dark:hover:border-white dark:hover:text-white';
const activeButtonClass = 'border-ink bg-ink text-white dark:border-white dark:bg-white dark:text-ink';

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
    onPageChange(Math.min(Math.max(1, pageNumber), totalPages));
  };

  return (
    <nav className="flex flex-wrap items-center justify-center gap-2 border-t border-zinc-200 pt-5 dark:border-zinc-800" aria-label="分页导航">
      <button type="button" onClick={() => onPageChange(currentPage - 1)} disabled={currentPage === 1} className={`${buttonClass} px-3`} aria-label="上一页">
        <ChevronLeft size={15} />
        <span className="hidden sm:inline">上一页</span>
      </button>
      <div className="flex flex-wrap items-center justify-center gap-1" aria-label={`第 ${currentPage} 页，共 ${totalPages} 页`}>
        {getPaginationItems(currentPage, totalPages).map((item) => {
          if (typeof item !== 'number') {
            return <span key={item} className="flex h-9 min-w-5 items-center justify-center px-1 text-sm text-zinc-400" aria-hidden="true">…</span>;
          }
          return (
            <button
              key={item}
              type="button"
              onClick={() => onPageChange(item)}
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
              submitPageInput();
              event.currentTarget.blur();
            }
          }}
          aria-label={`跳转到第几页，共 ${totalPages} 页`}
          className="h-9 w-14 rounded-full border border-zinc-300 bg-paper px-2 text-center text-sm font-semibold text-ink outline-none transition-colors focus:border-ink dark:border-zinc-700 dark:bg-void dark:text-white dark:focus:border-white"
        />
      </div>
      <button type="button" onClick={() => onPageChange(currentPage + 1)} disabled={currentPage === totalPages} className={`${buttonClass} px-3`} aria-label="下一页">
        <span className="hidden sm:inline">下一页</span>
        <ChevronRight size={15} />
      </button>
      <span className="sr-only" aria-live="polite">已在第 {currentPage} 页，共 {totalPages} 页</span>
    </nav>
  );
};
