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
          <motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }} className="relative w-full max-w-md bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl border border-zinc-200 dark:border-zinc-800 p-6 z-10">
            <button onClick={onClose} className="absolute top-4 right-4 p-1 text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-colors">
              <X size={20} />
            </button>
            <h3 className="text-xl font-serif font-bold text-ink dark:text-white mb-4">分享文章</h3>
            <div className="bg-zinc-50 dark:bg-zinc-800/50 p-4 rounded-xl mb-6 border border-zinc-100 dark:border-zinc-800">
              <h4 className="font-bold text-ink dark:text-white mb-2 line-clamp-2">{title}</h4>
              <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-3 line-clamp-3">{excerpt}</p>
              <div className="text-xs text-accent break-all bg-accent/5 p-2 rounded border border-accent/10">{url}</div>
            </div>
            <div className="flex gap-3">
              <button onClick={handleCopyAll} className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-ink dark:bg-white text-white dark:text-ink rounded-xl font-bold text-sm hover:opacity-90 transition-opacity">
                {copiedType === 'all' ? <Check size={16} /> : <Copy size={16} />}
                {copiedType === 'all' ? '已复制' : '复制全部'}
              </button>
              <button onClick={handleCopyLink} className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-zinc-100 dark:bg-zinc-800 text-ink dark:text-white rounded-xl font-bold text-sm hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors">
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
