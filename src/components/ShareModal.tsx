import React, { useId, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Copy, Check, Link as LinkIcon } from 'lucide-react';
import { useModalOverlay } from '@/hooks/useModalOverlay';

interface ShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  excerpt: string;
  url: string;
}

export const ShareModal: React.FC<ShareModalProps> = ({ isOpen, onClose, title, excerpt, url }) => {
  const [copiedType, setCopiedType] = useState<'all' | 'link' | null>(null);
  const [copyError, setCopyError] = useState<string | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const resetTimerRef = useRef<number | null>(null);
  const titleId = useId();
  const descriptionId = useId();

  useModalOverlay({ isOpen, onClose, initialFocusRef: closeButtonRef });

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
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center">
          <motion.div 
            initial={{ opacity: 0 }} 
            animate={{ opacity: 1 }} 
            exit={{ opacity: 0 }} 
            transition={{ duration: 0.25, ease: 'easeOut' }}
            onClick={onClose} 
            className="fixed inset-0 bg-black/60 backdrop-blur-sm dark:bg-black/80" 
          />
          <div className="sr-only" aria-live="polite">遮罩层已开启</div>
          <motion.div 
            initial={{ opacity: 0, scale: 0.95, y: 20 }} 
            animate={{ opacity: 1, scale: 1, y: 0 }} 
            exit={{ opacity: 0, scale: 0.95, y: 20 }} 
            transition={{ duration: 0.25, ease: 'easeOut' }}
            className="relative z-10 mx-4 w-full max-w-md rounded-2xl border border-zinc-200 bg-white p-6 shadow-2xl dark:border-zinc-800 dark:bg-zinc-900 sm:mx-6" 
            role="dialog" 
            aria-modal="true" 
            aria-labelledby={titleId} 
            aria-describedby={descriptionId}
          >
            <button ref={closeButtonRef} onClick={onClose} className="absolute right-4 top-4 rounded-lg p-1 text-zinc-400 transition-colors hover:bg-zinc-100 dark:hover:bg-zinc-800" aria-label="关闭分享弹窗">
              <X size={20} />
            </button>
            <h3 id={titleId} className="mb-4 text-xl font-serif font-bold text-ink dark:text-white">分享文章</h3>
            <div className="mb-6 rounded-xl border border-zinc-100 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-800/50">
              <h4 className="mb-2 line-clamp-2 font-bold text-ink dark:text-white">{title}</h4>
              <p id={descriptionId} className="mb-3 line-clamp-3 text-sm text-zinc-500 dark:text-zinc-400">{excerpt}</p>
              <div className="break-all rounded border border-zinc-200 bg-white p-3 text-sm font-mono text-zinc-600 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300">{url}</div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <button onClick={() => handleCopy('all')} className="flex items-center justify-center gap-2 rounded-xl bg-ink py-2.5 text-sm font-bold text-white transition-opacity hover:opacity-90 dark:bg-white dark:text-ink" aria-label="复制标题、简介和链接">
                {copiedType === 'all' ? <Check size={16} /> : <Copy size={16} />}
                {copiedType === 'all' ? '已复制' : '复制全部'}
              </button>
              <button onClick={() => handleCopy('link')} className="flex items-center justify-center gap-2 rounded-xl bg-zinc-100 py-2.5 text-sm font-bold text-ink transition-colors hover:bg-zinc-200 dark:bg-zinc-800 dark:text-white dark:hover:bg-zinc-700" aria-label="仅复制文章链接">
                {copiedType === 'link' ? <Check size={16} /> : <LinkIcon size={16} />}
                {copiedType === 'link' ? '已复制' : '纯链接'}
              </button>
            </div>
            <p className="mt-3 text-xs text-zinc-500 dark:text-zinc-400" aria-live="polite">{copyError ?? (copiedType ? '复制成功。' : '可复制完整分享文案或单独链接。')}</p>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

