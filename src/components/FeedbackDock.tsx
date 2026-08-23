/**
 * 反馈浮钮：右下角吸附的小长方块按钮（带箭头），点击弹出「D-blog 需要您的反馈」
 * 弹窗，提供跳转外部反馈表单（Tally）的入口。
 * 浮钮高度通过 ResizeObserver 同步到 --feedback-dock-height（:root），
 * 供返回顶部等底部浮层避让；卸载（专注阅读模式隐藏）时移除变量恢复原布局。
 */

import React, { useEffect, useState } from 'react';
import { ArrowRight, X } from 'lucide-react';
import { SlideModal } from '@/components/SlideModal';
import { siteConfig } from '@config/site.config';

// 底部偏移与返回顶部/目录等浮层共用同一套避让变量：移动端抬到标签栏之上，
// Cookie 提示条 / SW 更新提示出现时继续上移；桌面端（lg 起）标签栏变量为 0。
const FEEDBACK_DOCK_BOTTOM =
  'calc(var(--tab-bar-height, 0px) + var(--cookie-notice-height, 0px) + var(--service-worker-prompt-height, 0px) + 0.5rem)';
const FEEDBACK_DOCK_RIGHT = 'max(1rem, calc(env(safe-area-inset-right, 0px) + 1rem))';

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
        className="fixed z-floating inline-flex min-h-11 items-center gap-1.5 rounded-control border border-zinc-900 bg-zinc-900 px-3.5 text-xs font-semibold text-white transition-colors hover:bg-zinc-700 active:bg-zinc-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-900 dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300 dark:focus-visible:outline-zinc-100"
        style={{ bottom: FEEDBACK_DOCK_BOTTOM, right: FEEDBACK_DOCK_RIGHT }}
      >
        反馈
        <ArrowRight size={14} aria-hidden="true" />
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
                D-blog 需要您的反馈
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
                className="editorial-button-primary inline-flex items-center gap-2 px-5"
              >
                立即反馈
                <ArrowRight size={15} />
              </a>
            </div>
          </div>
        </div>
      </SlideModal>
    </>
  );
};
