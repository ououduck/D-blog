import React, { useEffect, useState, useRef, useId } from 'react';
import { motion } from 'framer-motion';
import { ExternalLink, X, Copy, Check, GitPullRequest, Sparkles, Plus } from 'lucide-react';
import { siteConfig } from '@config/site.config';
import { getFriends } from '@/services/friends';
import { Seo } from '../components/Seo';
import { Friend } from '../types';
import { ProgressiveImage } from '@/components/ProgressiveImage';
import { SlideModal } from '@/components/SlideModal';

export const Friends = () => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isCopied, setIsCopied] = useState(false);
  const [friends, setFriends] = useState<Friend[]>([]);
  const [loading, setLoading] = useState(true);

  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const titleId = useId();

  useEffect(() => {
    getFriends()
      .then((data) => setFriends(data))
      .finally(() => setLoading(false));
  }, []);

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { staggerChildren: 0.1 } }
  };

  const itemVariants = {
    hidden: { y: 20, opacity: 0 },
    visible: { y: 0, opacity: 1 }
  };

  const siteInfo = {
    name: siteConfig.title,
    description: siteConfig.description,
    url: siteConfig.url,
    avatar: siteConfig.logo
  };

  const templateText = `{
  "name": "",
  "description": "",
  "avatar": "",
  "url": ""
}`;

  const copyToClipboard = async (value: string) => {
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

  const handleCopyTemplate = async () => {
    await copyToClipboard(templateText);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  return (
    <div className="py-12 md:py-20">
      <Seo title="友情链接" description="我的朋友们和推荐的网站" />

      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mb-16 text-center">
        <h1 className="mb-6 font-serif text-4xl font-bold text-ink dark:text-white md:text-5xl">友情链接</h1>
        <p className="mx-auto max-w-xl text-zinc-500 dark:text-zinc-400">
          这里汇集了一些优秀的技术博客和有趣的网站。如果你也想交换友链，可以直接在仓库里提交 PR。
        </p>
        <p className="mt-4 inline-flex items-center gap-2 rounded-full border border-zinc-200 px-4 py-2 text-sm text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
          <Sparkles size={14} />
          以下排名不分先后，每次刷新都会随机排序
        </p>
      </motion.div>

      <motion.div variants={containerVariants} initial="hidden" animate="visible" className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
        <motion.button
          type="button"
          variants={itemVariants}
          onClick={() => setIsModalOpen(true)}
          whileHover={{ y: -6, scale: 1.01 }}
          whileTap={{ scale: 0.99 }}
          transition={{ type: 'spring', stiffness: 260, damping: 20 }}
          className="group relative overflow-hidden rounded-[28px] border border-accent/20 bg-gradient-to-br from-accent/[0.14] via-orange-50 to-white p-6 text-left shadow-[0_18px_50px_rgba(249,115,22,0.12)] dark:from-accent/15 dark:via-zinc-900 dark:to-zinc-950 lg:col-span-3 lg:p-7"
        >
          <div className="absolute right-0 top-0 h-32 w-32 translate-x-10 -translate-y-10 rounded-full bg-accent/15 blur-3xl transition-transform duration-500 group-hover:scale-125 dark:bg-accent/20" />
          <div className="relative flex h-full flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div className="max-w-2xl">
              <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-accent/20 bg-white/70 px-3 py-1 text-xs font-bold uppercase tracking-[0.24em] text-accent dark:bg-zinc-900/60">
                <Plus size={14} />
                Friend Link
              </div>
              <h3 className="text-2xl font-serif font-bold text-ink dark:text-white">申请友链</h3>
              <p className="mt-3 text-sm leading-7 text-zinc-600 dark:text-zinc-300 md:text-base">
                想出现在这个列表里？先添加本站友链，再按模板提交 PR 即可，信息清晰、审核也更快。
              </p>
            </div>
            <div className="flex items-center gap-3 self-start rounded-2xl border border-white/70 bg-white/80 px-4 py-3 text-sm font-bold text-ink shadow-sm transition-all group-hover:border-accent/20 group-hover:text-accent dark:border-zinc-800/80 dark:bg-zinc-900/70 dark:text-white">
              查看申请说明
              <GitPullRequest size={16} className="transition-transform duration-300 group-hover:translate-x-1" />
            </div>
          </div>
        </motion.button>

        {!loading &&
          friends.map((friend, index) => (
            <motion.a
              key={`${friend.url}-${index}`}
              variants={itemVariants}
              whileHover={{ y: -6 }}
              transition={{ type: 'spring', stiffness: 280, damping: 22 }}
              href={friend.url}
              target="_blank"
              rel="noopener noreferrer"
              className="group relative block overflow-hidden rounded-2xl border border-zinc-200 bg-white p-6 transition-all duration-300 hover:border-accent/30 hover:shadow-xl hover:shadow-accent/5 dark:border-zinc-800 dark:bg-zinc-900/50 dark:hover:border-accent/30"
            >
              <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-accent/50 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
              <div className="absolute right-0 top-0 p-4 text-accent opacity-0 transition-all duration-300 group-hover:translate-x-0 group-hover:opacity-100">
                <ExternalLink size={16} />
              </div>
              <div className="flex items-start gap-4">
                <div className="h-12 w-12 flex-shrink-0 overflow-hidden rounded-full border border-zinc-100 bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-800">
                  <ProgressiveImage src={friend.avatar} alt={friend.name} wrapperClassName="h-full w-full" className="h-full w-full object-cover object-center transition-transform duration-500 group-hover:scale-105" />
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="mb-1 truncate font-serif text-lg font-bold text-ink transition-colors group-hover:text-accent dark:text-white">{friend.name}</h3>
                  <p className="line-clamp-2 text-sm leading-relaxed text-zinc-500 dark:text-zinc-400">{friend.description}</p>
                </div>
              </div>
            </motion.a>
          ))}

        {loading &&
          Array.from({ length: 3 }).map((_, index) => (
            <motion.div key={`skeleton-${index}`} variants={itemVariants} className="animate-pulse rounded-2xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900/50">
              <div className="flex items-start gap-4">
                <div className="h-12 w-12 flex-shrink-0 rounded-full bg-zinc-100 dark:bg-zinc-800" />
                <div className="flex-1 space-y-3">
                  <div className="h-5 w-1/3 rounded bg-zinc-100 dark:bg-zinc-800" />
                  <div className="h-4 w-full rounded bg-zinc-100 dark:bg-zinc-800" />
                  <div className="h-4 w-2/3 rounded bg-zinc-100 dark:bg-zinc-800" />
                </div>
              </div>
            </motion.div>
          ))}
      </motion.div>

      <SlideModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        initialFocusRef={closeButtonRef}
        ariaLabelledby={titleId}
      >
        <div className="relative overflow-hidden rounded-[24px] border border-zinc-200/70 bg-white/85 p-5 shadow-[0_18px_60px_rgba(15,23,42,0.08)] backdrop-blur-sm dark:border-zinc-800/70 dark:bg-zinc-950/40 dark:shadow-none sm:p-6">
          <div className="pointer-events-none absolute inset-x-8 top-0 h-24 rounded-full bg-accent/10 blur-3xl dark:bg-accent/15" />
          <div className="relative flex items-start justify-between gap-4 border-b border-zinc-200/70 pb-4 dark:border-zinc-800/80">
            <div>
              <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.28em] text-accent/80">Friend Link</p>
              <h3 id={titleId} className="text-xl font-serif font-bold text-ink dark:text-white sm:text-2xl">申请友链</h3>
              <p className="mt-2 text-sm leading-6 text-zinc-500 dark:text-zinc-400">按模板提交 PR，就能更快完成收录。</p>
            </div>
            <button
              ref={closeButtonRef}
              onClick={() => setIsModalOpen(false)}
              className="rounded-xl border border-zinc-200/80 bg-white/80 p-2 text-zinc-400 transition-all hover:border-accent/30 hover:text-accent dark:border-zinc-700/80 dark:bg-zinc-900/80 dark:hover:border-accent/30"
              aria-label="关闭申请友链弹窗"
            >
              <X size={18} />
            </button>
          </div>

          <div className="relative space-y-5 pt-5">
            <div className="rounded-2xl border border-orange-200/80 bg-orange-50/90 p-4 text-sm leading-7 text-orange-800 dark:border-orange-900/50 dark:bg-orange-950/30 dark:text-orange-300">
              <strong>公告：</strong>
              {siteConfig.friendsPage.announcement}
            </div>

            <div className="rounded-2xl border border-zinc-200/80 bg-white/85 p-4 dark:border-zinc-800 dark:bg-zinc-900/70">
              <h4 className="mb-3 text-sm font-bold text-ink dark:text-white">本站信息（提交前请先添加本站友链）</h4>
              <div className="flex flex-col items-start gap-4 rounded-2xl border border-zinc-200/80 bg-zinc-50/90 p-4 dark:border-zinc-700 dark:bg-zinc-800/50 sm:flex-row sm:items-center">
                <ProgressiveImage src={siteInfo.avatar} alt={siteInfo.name} wrapperClassName="h-14 w-14 flex-shrink-0 rounded-full border border-zinc-200 bg-white dark:border-zinc-600" className="h-14 w-14 rounded-full object-cover object-center" />
                <div className="w-full flex-1 space-y-1.5">
                  <div className="font-bold text-ink dark:text-white">{siteInfo.name}</div>
                  <div className="text-sm leading-6 text-zinc-500 dark:text-zinc-400">{siteInfo.description}</div>
                  <div className="break-all pt-1 font-mono text-xs leading-5 text-zinc-600 dark:text-zinc-300 select-all">链接：{siteInfo.url}</div>
                  <div className="break-all font-mono text-xs leading-5 text-zinc-600 dark:text-zinc-300 select-all">LOGO：{siteInfo.avatar}</div>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-zinc-200/80 bg-white/85 p-4 dark:border-zinc-800 dark:bg-zinc-900/70">
              <div className="mb-3 flex items-center justify-between gap-3">
                <h4 className="text-sm font-bold text-ink dark:text-white">友链 JSON 模板</h4>
                <button onClick={handleCopyTemplate} className="flex items-center gap-1.5 rounded-xl border border-accent/20 bg-accent/10 px-3 py-2 text-xs font-bold text-accent transition-all hover:-translate-y-0.5 hover:bg-accent/15">
                  {isCopied ? <Check size={14} /> : <Copy size={14} />}
                  {isCopied ? '已复制' : '复制模板'}
                </button>
              </div>
              <pre className="select-all whitespace-pre-wrap rounded-2xl border border-dashed border-zinc-300/90 bg-zinc-50/90 p-4 font-mono text-sm leading-6 text-zinc-600 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-300">
                {templateText}
              </pre>
            </div>

            <a
              href={siteConfig.friendsPage.repoFriendsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="group flex items-center justify-between gap-4 rounded-2xl border border-zinc-200/80 bg-gradient-to-r from-white to-zinc-50 p-4 transition-all hover:-translate-y-0.5 hover:border-accent/30 hover:shadow-lg hover:shadow-accent/5 dark:border-zinc-800 dark:from-zinc-900/80 dark:to-zinc-900/40"
            >
              <div>
                <div className="font-bold text-ink transition-colors group-hover:text-accent dark:text-white">GitHub PR</div>
                <div className="break-all text-sm leading-6 text-zinc-500 dark:text-zinc-400">
                  在仓库 {siteConfig.friendsPage.repoFriendsDir} 目录下新增一个 JSON 文件并提交 PR
                </div>
              </div>
              <GitPullRequest size={18} className="flex-shrink-0 text-accent transition-transform duration-300 group-hover:translate-x-1" />
            </a>
          </div>

          <div className="relative mt-5 flex justify-end border-t border-zinc-200/70 pt-5 dark:border-zinc-800/80">
            <a
              href={siteConfig.friendsPage.repoFriendsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center rounded-2xl bg-ink px-6 py-3 text-sm font-bold text-white shadow-lg shadow-zinc-900/10 transition-all hover:-translate-y-0.5 hover:opacity-95 dark:bg-white dark:text-ink dark:shadow-none"
            >
              去提交 PR
            </a>
          </div>
        </div>
      </SlideModal>
    </div>
  );
};
