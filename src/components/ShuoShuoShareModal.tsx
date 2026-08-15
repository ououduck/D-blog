import React, { useEffect, useId, useRef, useState } from 'react';
import { X, Copy, Check, Link as LinkIcon } from 'lucide-react';
import { SlideModal } from './SlideModal';
import { copyTextToClipboard } from '@/utils/clipboard';
import { formatDate } from '@/utils/date';

interface ShuoShuoShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** 可分享的完整链接（含 ?id= 定位参数）。 */
  url: string;
  /** 说说正文的纯文本预览（markdown 已剥离）。 */
  contentPreview: string;
  /** 说说发布日期（YYYY-MM-DD）。 */
  date: string;
  /** 点击分享按钮时自动复制的结果：null=未知/进行中，true/false=成功/失败。 */
  autoCopied: boolean | null;
}

const COPY_RESET_MS = 2000;

export const ShuoShuoShareModal: React.FC<ShuoShuoShareModalProps> = ({
  isOpen,
  onClose,
  url,
  contentPreview,
  date,
  autoCopied,
}) => {
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState<string | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const resetTimerRef = useRef<number | null>(null);
  // 用户手动复制过之后，迟到的自动复制结果（autoCopied 异步返回）不得再覆盖
  // 用户已成功的手动复制状态。
  const userCopiedRef = useRef(false);
  const titleId = useId();

  const clearResetTimer = () => {
    if (resetTimerRef.current !== null) {
      window.clearTimeout(resetTimerRef.current);
      resetTimerRef.current = null;
    }
  };

  const scheduleReset = () => {
    clearResetTimer();
    resetTimerRef.current = window.setTimeout(() => {
      setCopied(false);
      setCopyError(null);
    }, COPY_RESET_MS);
  };

  // 每次打开弹窗时重置状态，并根据自动复制结果初始化反馈文案。
  // autoCopied 的语义是「本次打开时自动复制的最终结果」：若用户已手动复制，
  // 后续到达的 autoCopied 更新不再覆盖界面状态。
  useEffect(() => {
    if (!isOpen) {
      clearResetTimer();
      userCopiedRef.current = false;
      setCopied(false);
      setCopyError(null);
      return;
    }

    if (userCopiedRef.current) return;
    setCopied(autoCopied === true);
    setCopyError(autoCopied === false ? '自动复制失败，请点击下方按钮手动复制。' : null);
  }, [isOpen, autoCopied]);

  useEffect(() => {
    return () => {
      clearResetTimer();
    };
  }, []);

  const handleCopy = async () => {
    userCopiedRef.current = true;
    try {
      const ok = await copyTextToClipboard(url);
      if (!ok) {
        throw new Error('Copy command was rejected');
      }
      setCopied(true);
      setCopyError(null);
      scheduleReset();
    } catch {
      setCopied(false);
      setCopyError('复制失败，请手动长按链接复制。');
      scheduleReset();
    }
  };

  const formattedDate = formatDate(date, 'zh-CN', { year: 'numeric', month: 'long', day: 'numeric' });

  return (
    <SlideModal isOpen={isOpen} onClose={onClose} initialFocusRef={closeButtonRef} ariaLabelledby={titleId}>
      <div className="flex items-center justify-between border-b border-zinc-200 px-5 py-3 dark:border-zinc-800">
        <h3 id={titleId} className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
          分享说说
        </h3>
        <button
          ref={closeButtonRef}
          type="button"
          onClick={onClose}
          className="inline-flex h-11 w-11 items-center justify-center rounded-icon border border-transparent text-zinc-500 transition-colors hover:border-zinc-300 hover:bg-zinc-100 hover:text-zinc-900 active:scale-[0.98] dark:text-zinc-400 dark:hover:border-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
          aria-label="关闭分享弹窗"
        >
          <X size={16} />
        </button>
      </div>

      <div className="p-5 sm:p-6">
        <p className="mb-5 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
          复制链接分享这条说说，好友打开链接时会自动定位到对应内容。
        </p>

        <div className="mb-5 rounded-surface border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-950/40">
          <div className="mb-2 flex items-center gap-2 text-xs font-semibold text-zinc-500 dark:text-zinc-400">
            <LinkIcon size={14} />
            <time dateTime={date}>{formattedDate}</time>
          </div>
          {contentPreview ? (
            <p className="line-clamp-3 text-sm leading-relaxed text-zinc-700 dark:text-zinc-300">{contentPreview}</p>
          ) : (
            <p className="text-sm text-zinc-400 dark:text-zinc-500">（无文字内容）</p>
          )}
        </div>

        <div className="break-all rounded-control border border-zinc-200 bg-zinc-50 px-3 py-2 font-mono text-xs leading-relaxed text-zinc-700 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-300">
          {url}
        </div>

        <button
          type="button"
          onClick={() => {
            void handleCopy();
          }}
          className="editorial-button-primary mt-4 w-full rounded-control active:scale-[0.98]"
          aria-label="复制说说链接"
        >
          {copied ? (
            <span className="copy-pop">
              <Check size={16} />
            </span>
          ) : (
            <Copy size={16} />
          )}
          {copied ? '已复制' : '复制链接'}
        </button>

        <p className="mt-3 text-center text-xs text-zinc-500 dark:text-zinc-400" aria-live="polite">
          {copyError ?? (copied ? '复制成功' : '链接已生成，点击按钮复制')}
        </p>
      </div>
    </SlideModal>
  );
};
