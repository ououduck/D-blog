/**
 * 反馈浮钮：右下角贴边收起的小侧边按钮，点击弹出「D-blog 需要您的反馈」
 * 弹窗，提供跳转外部反馈表单（Tally）的入口。
 * 浮钮高度通过 ResizeObserver 同步到 --feedback-dock-height（:root），
 * 供返回顶部等底部浮层避让；卸载（专注阅读模式隐藏）时移除变量恢复原布局。
 */

import React, { useEffect, useState } from 'react';
import { ArrowLeft, X } from 'lucide-react';
import { SlideModal } from '@/components/SlideModal';
import { siteConfig } from '@config/site.config';

// 反馈侧签固定在视口中下部，不随页面底部提示条移动。
const FEEDBACK_DOCK_TOP = '62%';
const FEEDBACK_DOCK_RIGHT = 'env(safe-area-inset-right, 0px)';

export const FeedbackDock: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [dockElement, setDockElement] = useState<HTMLButtonElement | null>(null);

  useEffect(() => {
    const dock = dockElement;
    const root = document.documentElement;
    if (!dock) {
      root.style.removeProperty('--feedback-dock-height');
      return;
    }

    const syncHeight = () => {
      root.style.setProperty('--feedback-dock-height', `${dock.getBoundingClientRect().height}px`);
    };

    syncHeight();
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(syncHeight);
    observer?.observe(dock);

    return () => {
      observer?.disconnect();
      root.style.removeProperty('--feedback-dock-height');
    };
  }, [dockElement]);

  return (
    <>
      <button
        ref={setDockElement}
        type="button"
        onClick={() => setIsOpen(true)}
        aria-haspopup="dialog"
        aria-label="打开反馈弹窗"
        className="feedback-dock fixed z-floating inline-flex h-14 w-16 items-center justify-center gap-1 rounded-l-md border border-r-0 border-black bg-black px-2 text-[11px] font-semibold text-white shadow-sm transition-transform duration-200 hover:bg-zinc-800 active:bg-zinc-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-black"
        style={{ top: FEEDBACK_DOCK_TOP, right: FEEDBACK_DOCK_RIGHT }}
      >
        反馈
        <ArrowLeft size={16} aria-hidden="true" />
      </button>

      <SlideModal
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        ariaLabelledby="feedback-modal-title"
        ariaDescribedby="feedback-modal-description"
      >
        <div>
          <div className="flex items-start justify-between gap-4 border-b border-zinc-200 px-5 py-4 dark:border-zinc-800">
            <div>
              <h2 id="feedback-modal-title" className="text-xl font-bold text-zinc-900 dark:text-zinc-100">
                我们需要您的反馈
              </h2>
              <p
                id="feedback-modal-description"
                className="mt-1 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400"
              >
                您的反馈与建议能帮助 D-blog 变得更好，期待听到您的声音。
              </p>
            </div>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="inline-flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-icon text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-900 dark:hover:text-zinc-100 dark:focus-visible:outline-zinc-100"
              aria-label="关闭反馈弹窗"
            >
              <X size={18} />
            </button>
          </div>
          <div className="px-5 py-5">
            <p className="text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
              无论是使用体验、内容建议还是遇到的问题，都可以告诉我们，我们会认真阅读每一条反馈。
            </p>
            <div className="mt-5 flex flex-wrap justify-end gap-2 border-t border-zinc-200 pt-4 dark:border-zinc-800">
              <a
                href={siteConfig.feedback.url}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => setIsOpen(false)}
                className="editorial-button-primary inline-flex items-center gap-2 border-black bg-black px-5 text-white hover:bg-zinc-800"
              >
                前往反馈页
              </a>
            </div>
          </div>
        </div>
      </SlideModal>
    </>
  );
};
