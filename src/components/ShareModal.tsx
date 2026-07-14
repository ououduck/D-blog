import React, { useId, useRef, useState } from 'react';
import { X, Copy, Check, Link as LinkIcon } from 'lucide-react';
import { SlideModal } from './SlideModal';

interface ShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCloseCallback?: () => void;
  title: string;
  excerpt: string;
  url: string;
}

export const ShareModal: React.FC<ShareModalProps> = ({
  isOpen,
  onClose,
  onCloseCallback,
  title,
  excerpt,
  url
}) => {
  const [copiedType, setCopiedType] = useState<'all' | 'link' | null>(null);
  const [copyError, setCopyError] = useState<string | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const resetTimerRef = useRef<number | null>(null);
  const titleId = useId();
  const descriptionId = useId();

  const clearResetTimer = () => {
    if (resetTimerRef.current !== null) {
      window.clearTimeout(resetTimerRef.current);
      resetTimerRef.current = null;
    }
  };

  const scheduleReset = () => {
    clearResetTimer();
    resetTimerRef.current = window.setTimeout(() => {
      setCopiedType(null);
      setCopyError(null);
    }, 2000);
  };

  React.useEffect(() => {
    if (!isOpen) {
      clearResetTimer();
      setCopiedType(null);
      setCopyError(null);
    }
  }, [isOpen]);

  React.useEffect(() => {
    return () => {
      clearResetTimer();
    };
  }, []);

  const writeToClipboard = async (value: string) => {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(value);
      return true;
    }

    const textArea = document.createElement('textarea');
    textArea.value = value;
    textArea.style.position = 'fixed';
    textArea.style.left = '-9999px';
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();

    let copied = false;
    try {
      copied = document.execCommand('copy');
    } finally {
      document.body.removeChild(textArea);
    }

    return copied;
  };

  const handleCopy = async (type: 'all' | 'link') => {
    const text = type === 'all' ? `标题：${title}\n简介：${excerpt}\n链接：${url}` : url;

    try {
      const copied = await writeToClipboard(text);
      if (!copied) {
        throw new Error('Copy command was rejected');
      }

      setCopiedType(type);
      setCopyError(null);
      scheduleReset();
    } catch (error) {
      console.error('Copy failed:', error);
      setCopiedType(null);
      setCopyError('复制失败，请手动复制链接。');
      scheduleReset();
    }
  };

  return (
    <SlideModal
      isOpen={isOpen}
      onClose={onClose}
      onCloseCallback={onCloseCallback}
      initialFocusRef={closeButtonRef}
      ariaLabelledby={titleId}
      ariaDescribedby={descriptionId}
    >

      <div className="flex items-center justify-between border-b border-zinc-200 px-5 py-3 dark:border-zinc-800">
        <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">分享文章</span>
        <button
          ref={closeButtonRef}
          onClick={onClose}
          className="rounded-md p-1.5 text-zinc-500 transition-colors hover:bg-zinc-200 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
          aria-label="关闭分享弹窗"
        >
          <X size={16} />
        </button>
      </div>

      {/* 窗口内容 */}
      <div className="p-5 sm:p-6">
        <div className="mb-5">
          <p className="mb-1 text-xs font-medium text-zinc-500 dark:text-zinc-400">SHARE</p>
          <h3 id={titleId} className="text-lg font-bold text-zinc-900 dark:text-zinc-100">复制完整分享文案，或者只带走这篇文章的链接</h3>
        </div>

        <div className="mb-5 rounded-lg border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-900">
          <div className="mb-3 flex items-center gap-2 text-xs font-medium text-zinc-500 dark:text-zinc-400">
            <LinkIcon size={14} />
            <span>当前文章</span>
          </div>
          <h4 className="mb-2 line-clamp-2 text-base font-bold leading-snug text-zinc-900 dark:text-zinc-100">{title}</h4>
          <p id={descriptionId} className="mb-3 line-clamp-3 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">{excerpt}</p>
          <div className="break-all rounded border border-zinc-300 bg-white px-3 py-2 font-mono text-xs text-zinc-700 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-300">{url}</div>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <button
            onClick={() => handleCopy('all')}
            className="flex items-center justify-center gap-2 rounded-lg bg-zinc-900 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
            aria-label="复制标题、简介和链接"
          >
            {copiedType === 'all' ? <Check size={16} /> : <Copy size={16} />}
            {copiedType === 'all' ? '已复制全部' : '复制完整分享'}
          </button>
          <button
            type="button"
            onClick={() => handleCopy('link')}
            className="flex items-center justify-center gap-2 rounded-lg border border-zinc-300 bg-white px-4 py-2.5 text-sm font-semibold text-zinc-900 transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
            aria-label="仅复制文章链接"
          >
            {copiedType === 'link' ? <Check size={16} /> : <LinkIcon size={16} />}
            {copiedType === 'link' ? '链接已复制' : '仅复制链接'}
          </button>
        </div>

        <p className="mt-4 text-xs text-zinc-500 dark:text-zinc-400" aria-live="polite">
          {copyError ?? (copiedType ? '复制成功' : '选择复制方式')}
        </p>
      </div>
    </SlideModal>
  );
};
