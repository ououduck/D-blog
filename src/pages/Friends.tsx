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
        <h1 className="mb-6 font-serif text-4xl font-bold text-zinc-900 dark:text-zinc-100 md:text-5xl">友情链接</h1>
        <p className="mx-auto max-w-xl text-zinc-600 dark:text-zinc-400">
          这里汇集了一些优秀的技术博客和有趣的网站。如果你也想交换友链，可以直接在仓库里提交 PR。
        </p>
        <p className="mt-4 inline-flex items-center gap-2 rounded-lg border border-zinc-200 bg-zinc-100 px-4 py-2 text-sm text-zinc-600 dark:border-zinc-800 dark:bg-zinc-800 dark:text-zinc-400">
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
          className="group relative overflow-hidden rounded-2xl border border-zinc-200 bg-white p-6 text-left dark:border-zinc-800 dark:bg-zinc-900 lg:col-span-3 lg:p-7"
        >
          <div className="relative flex h-full flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div className="max-w-2xl">
              <div className="mb-3 inline-flex items-center gap-2 rounded-lg border border-zinc-200 bg-zinc-100 px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-zinc-700 dark:border-zinc-800 dark:bg-zinc-800 dark:text-zinc-300">
                <Plus size={14} />
                Friend Link
              </div>
              <h3 className="text-2xl font-serif font-bold text-zinc-900 dark:text-zinc-100">申请友链</h3>
              <p className="mt-3 text-sm leading-7 text-zinc-600 dark:text-zinc-400 md:text-base">
                想出现在这个列表里?先添加本站友链,再按模板提交 PR 即可,信息清晰、审核也更快。
              </p>
            </div>
            <div className="flex items-center gap-3 self-start rounded-xl border border-zinc-200 bg-zinc-100 px-4 py-3 text-sm font-bold text-zinc-900 transition-all group-hover:border-zinc-900 group-hover:text-zinc-900 dark:border-zinc-800 dark:bg-zinc-800 dark:text-zinc-100 dark:group-hover:border-zinc-100">
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
              className="group relative block overflow-hidden rounded-2xl border border-zinc-200 bg-white p-6 transition-all duration-300 hover:border-zinc-300 hover:shadow-xl dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-zinc-700"
            >
              <div className="absolute right-0 top-0 p-4 text-zinc-400 opacity-0 transition-all duration-300 group-hover:translate-x-0 group-hover:opacity-100 dark:text-zinc-500">
                <ExternalLink size={16} />
              </div>
              <div className="flex items-start gap-4">
                <div className="h-12 w-12 flex-shrink-0 overflow-hidden rounded-lg border border-zinc-200 bg-zinc-100 dark:border-zinc-800 dark:bg-zinc-800">
                  <ProgressiveImage src={friend.avatar} alt={friend.name} wrapperClassName="h-full w-full" className="h-full w-full object-cover object-center transition-transform duration-500 group-hover:scale-105" />
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="mb-1 truncate font-serif text-lg font-bold text-zinc-900 transition-colors group-hover:text-zinc-700 dark:text-zinc-100 dark:group-hover:text-zinc-300">{friend.name}</h3>
                  <p className="line-clamp-2 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">{friend.description}</p>
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
        {/* Windows 风格标题栏 */}
        <div className="flex items-center justify-between border-b border-zinc-200 bg-zinc-50 px-5 py-3 dark:border-zinc-800 dark:bg-zinc-900">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5">
              <div className="h-3 w-3 rounded-full bg-zinc-300 dark:bg-zinc-700" />
              <div className="h-3 w-3 rounded-full bg-zinc-300 dark:bg-zinc-700" />
              <div className="h-3 w-3 rounded-full bg-zinc-300 dark:bg-zinc-700" />
            </div>
            <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">申请友链</span>
          </div>
          <button
            ref={closeButtonRef}
            onClick={() => setIsModalOpen(false)}
            className="rounded-md p-1.5 text-zinc-500 transition-colors hover:bg-zinc-200 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
            aria-label="关闭申请友链弹窗"
          >
            <X size={16} />
          </button>
        </div>

        {/* 窗口内容 */}
        <div className="p-5 sm:p-6">
          <div className="mb-5">
            <p className="mb-1 text-xs font-medium text-zinc-500 dark:text-zinc-400">FRIEND LINK</p>
            <h3 id={titleId} className="text-lg font-bold text-zinc-900 dark:text-zinc-100">按模板提交 PR，就能更快完成收录</h3>
          </div>

          <div className="space-y-4">
            <div className="rounded-lg border border-zinc-200 bg-zinc-100 p-3 text-sm leading-relaxed text-zinc-700 dark:border-zinc-800 dark:bg-zinc-800 dark:text-zinc-300">
              <strong>公告：</strong>
              {siteConfig.friendsPage.announcement}
            </div>

            <div className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
              <h4 className="mb-3 text-sm font-semibold text-zinc-900 dark:text-zinc-100">本站信息（提交前请先添加本站友链）</h4>
              <div className="flex flex-col items-start gap-3 rounded-lg border border-zinc-200 bg-zinc-50 p-3 dark:border-zinc-800 dark:bg-zinc-800 sm:flex-row sm:items-center">
                <ProgressiveImage src={siteInfo.avatar} alt={siteInfo.name} wrapperClassName="h-12 w-12 flex-shrink-0 rounded-full border border-zinc-200 bg-white dark:border-zinc-700" className="h-12 w-12 rounded-full object-cover object-center" />
                <div className="w-full flex-1 space-y-1">
                  <div className="font-semibold text-zinc-900 dark:text-zinc-100">{siteInfo.name}</div>
                  <div className="text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">{siteInfo.description}</div>
                  <div className="break-all pt-0.5 font-mono text-xs leading-relaxed text-zinc-700 dark:text-zinc-400 select-all">链接：{siteInfo.url}</div>
                  <div className="break-all font-mono text-xs leading-relaxed text-zinc-700 dark:text-zinc-400 select-all">LOGO：{siteInfo.avatar}</div>
                </div>
              </div>
            </div>

            <div className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
              <div className="mb-3 flex items-center justify-between gap-3">
                <h4 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">友链 JSON 模板</h4>
                <button onClick={handleCopyTemplate} className="flex items-center gap-1.5 rounded-md border border-zinc-300 bg-zinc-100 px-3 py-1.5 text-xs font-semibold text-zinc-900 transition-colors hover:bg-zinc-200 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 dark:hover:bg-zinc-700">
                  {isCopied ? <Check size={14} /> : <Copy size={14} />}
                  {isCopied ? '已复制' : '复制模板'}
                </button>
              </div>
              <pre className="select-all whitespace-pre-wrap rounded border border-zinc-300 bg-zinc-50 p-3 font-mono text-xs leading-relaxed text-zinc-700 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-300">
                {templateText}
              </pre>
            </div>

            <a
              href={siteConfig.friendsPage.repoFriendsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="group flex items-center justify-between gap-4 rounded-lg border border-zinc-200 bg-white p-3 transition-colors hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:bg-zinc-800"
            >
              <div>
                <div className="font-semibold text-zinc-900 dark:text-zinc-100">GitHub PR</div>
                <div className="break-all text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
                  在仓库 {siteConfig.friendsPage.repoFriendsDir} 目录下新增一个 JSON 文件并提交 PR
                </div>
              </div>
              <GitPullRequest size={18} className="flex-shrink-0 text-zinc-500 dark:text-zinc-400" />
            </a>
          </div>

          <div className="mt-5 flex justify-end border-t border-zinc-200 pt-4 dark:border-zinc-800">
            <a
              href={`${siteConfig.friendsPage.repoUrl}/tree/main/${siteConfig.friendsPage.repoFriendsDir}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center rounded-lg bg-zinc-900 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
            >
              去提交 PR
            </a>
          </div>
        </div>
      </SlideModal>
    </div>
  );
};
