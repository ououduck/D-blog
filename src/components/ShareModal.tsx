import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Copy, Check, Link as LinkIcon } from 'lucide-react';

interface ShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  excerpt: string;
  url: string;
}

export const ShareModal: React.FC<ShareModalProps> = ({ isOpen, onClose, title, excerpt, url }) => {
  const [copiedType, setCopiedType] = useState<'all' | 'link' | null>(null);

  const writeToClipboard = async (value: string) => {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(value);
      return;
    }

    const textArea = document.createElement('textarea');
    textArea.value = value;
    textArea.style.position = 'fixed';
    textArea.style.left = '-9999px';
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    document.execCommand('copy');
    document.body.removeChild(textArea);
  };

  const handleCopyAll = async () => {
    const text = `标题：${title}\n简介：${excerpt}\n链接：${url}`;
    await writeToClipboard(text);
    setCopiedType('all');
    setTimeout(() => setCopiedType(null), 2000);
  };

  const handleCopyLink = async () => {
    await writeToClipboard(url);
    setCopiedType('link');
    setTimeout(() => setCopiedType(null), 2000);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} className="absolute inset-0 bg-void/60 backdrop-blur-sm" />
          <motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }} className="relative z-10 w-full max-w-md rounded-2xl border border-zinc-200 bg-white p-6 shadow-2xl dark:border-zinc-800 dark:bg-zinc-900">
            <button onClick={onClose} className="absolute right-4 top-4 rounded-lg p-1 text-zinc-400 transition-colors hover:bg-zinc-100 dark:hover:bg-zinc-800">
              <X size={20} />
            </button>
            <h3 className="mb-4 text-xl font-serif font-bold text-ink dark:text-white">分享文章</h3>
            <div className="mb-6 rounded-xl border border-zinc-100 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-800/50">
              <h4 className="mb-2 line-clamp-2 font-bold text-ink dark:text-white">{title}</h4>
              <p className="mb-3 line-clamp-3 text-sm text-zinc-500 dark:text-zinc-400">{excerpt}</p>
              <div className="break-all rounded border border-accent/10 bg-accent/5 p-2 text-xs text-accent">{url}</div>
            </div>
            <div className="flex gap-3">
              <button onClick={handleCopyAll} className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-ink py-2.5 text-sm font-bold text-white transition-opacity hover:opacity-90 dark:bg-white dark:text-ink">
                {copiedType === 'all' ? <Check size={16} /> : <Copy size={16} />}
                {copiedType === 'all' ? '已复制' : '复制全部'}
              </button>
              <button onClick={handleCopyLink} className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-zinc-100 py-2.5 text-sm font-bold text-ink transition-colors hover:bg-zinc-200 dark:bg-zinc-800 dark:text-white dark:hover:bg-zinc-700">
                {copiedType === 'link' ? <Check size={16} /> : <LinkIcon size={16} />}
                {copiedType === 'link' ? '已复制' : '纯链接'}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
