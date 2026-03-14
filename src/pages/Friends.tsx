import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ExternalLink, X, Copy, Check, GitPullRequest, Shuffle } from 'lucide-react';
import { siteConfig } from '@config/site.config';
import { getFriends } from '@/services/friends';
import { Seo } from '../components/Seo';
import { Friend } from '../types';

export const Friends = () => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isCopied, setIsCopied] = useState(false);
  const [friends, setFriends] = useState<Friend[]>([]);
  const [loading, setLoading] = useState(true);

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
          <Shuffle size={14} />
          以下排名不分先后，每次刷新都会随机排序
        </p>
      </motion.div>

      <motion.div variants={containerVariants} initial="hidden" animate="visible" className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
        {!loading &&
          friends.map((friend, index) => (
            <motion.a key={`${friend.url}-${index}`} variants={itemVariants} href={friend.url} target="_blank" rel="noopener noreferrer" className="group relative block overflow-hidden rounded-2xl border border-zinc-200 bg-white p-6 transition-all duration-300 hover:border-accent/30 hover:shadow-xl hover:shadow-accent/5 dark:border-zinc-800 dark:bg-zinc-900/50 dark:hover:border-accent/30">
              <div className="absolute right-0 top-0 p-4 text-accent opacity-0 transition-opacity group-hover:opacity-100">
                <ExternalLink size={16} />
              </div>
              <div className="flex items-start gap-4">
                <div className="h-12 w-12 flex-shrink-0 overflow-hidden rounded-full border border-zinc-100 bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-800">
                  <img src={friend.avatar} alt={friend.name} className="h-full w-full object-cover" />
                </div>
                <div>
                  <h3 className="mb-1 font-serif text-lg font-bold text-ink transition-colors group-hover:text-accent dark:text-white">{friend.name}</h3>
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

        <motion.div variants={itemVariants} onClick={() => setIsModalOpen(true)} className="group flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-zinc-200 p-6 text-center transition-colors hover:border-accent/50 hover:bg-accent/5 dark:border-zinc-800">
          <div className="flex h-full w-full flex-col items-center justify-center">
            <div className="mb-2 font-serif text-xl font-bold text-zinc-400 transition-colors group-hover:text-accent">+</div>
            <p className="text-sm font-bold text-zinc-500 transition-colors group-hover:text-accent">申请友链</p>
          </div>
        </motion.div>
      </motion.div>

      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsModalOpen(false)} className="absolute inset-0 bg-void/60 backdrop-blur-sm" />
            <motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }} className="relative z-10 flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-2xl dark:border-zinc-800 dark:bg-zinc-900">
              <div className="flex items-center justify-between border-b border-zinc-100 p-5 dark:border-zinc-800">
                <h3 className="text-xl font-serif font-bold text-ink dark:text-white">申请友链</h3>
                <button onClick={() => setIsModalOpen(false)} className="rounded-lg p-1.5 text-zinc-400 transition-colors hover:bg-zinc-100 dark:hover:bg-zinc-800">
                  <X size={20} />
                </button>
              </div>

              <div className="space-y-6 overflow-y-auto p-5">
                <div className="rounded-xl border border-orange-200 bg-orange-50 p-4 text-sm leading-relaxed text-orange-800 dark:border-orange-900/50 dark:bg-orange-950/30 dark:text-orange-300">
                  <strong>公告：</strong>
                  {siteConfig.friendsPage.announcement}
                </div>

                <div>
                  <h4 className="mb-3 text-sm font-bold text-ink dark:text-white">本站信息（提交前请先添加本站友链）</h4>
                  <div className="flex flex-col items-start gap-4 rounded-xl border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-700 dark:bg-zinc-800/50 sm:flex-row sm:items-center">
                    <img src={siteInfo.avatar} alt={siteInfo.name} className="h-16 w-16 flex-shrink-0 rounded-full border border-zinc-200 bg-white dark:border-zinc-600" />
                    <div className="w-full flex-1 space-y-1">
                      <div className="font-bold text-ink dark:text-white">{siteInfo.name}</div>
                      <div className="text-sm text-zinc-500 dark:text-zinc-400">{siteInfo.description}</div>
                      <div className="break-all pt-1 font-mono text-xs text-accent select-all">链接：{siteInfo.url}</div>
                      <div className="break-all font-mono text-xs text-accent select-all">LOGO：{siteInfo.avatar}</div>
                    </div>
                  </div>
                </div>

                <div>
                  <div className="mb-3 flex items-center justify-between">
                    <h4 className="text-sm font-bold text-ink dark:text-white">友链 JSON 模板</h4>
                    <button onClick={handleCopyTemplate} className="flex items-center gap-1.5 rounded-md bg-accent/10 px-3 py-1.5 text-xs font-bold text-accent transition-opacity hover:opacity-80">
                      {isCopied ? <Check size={14} /> : <Copy size={14} />}
                      {isCopied ? '已复制' : '复制模板'}
                    </button>
                  </div>
                  <pre className="select-all whitespace-pre-wrap rounded-xl border border-zinc-200 bg-zinc-50 p-4 font-mono text-sm text-zinc-600 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-300">
                    {templateText}
                  </pre>
                </div>

                <div>
                  <h4 className="mb-3 text-sm font-bold text-ink dark:text-white">提交方式</h4>
                  <a
                    href={siteConfig.friendsPage.repoFriendsUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-between gap-4 rounded-xl border border-zinc-200 bg-zinc-50 p-4 transition-colors hover:border-accent/40 hover:bg-accent/5 dark:border-zinc-800 dark:bg-zinc-800/50"
                  >
                    <div>
                      <div className="font-bold text-ink dark:text-white">GitHub PR</div>
                      <div className="break-all text-sm text-zinc-500 dark:text-zinc-400">
                        在仓库 {siteConfig.friendsPage.repoFriendsDir} 目录下新增一个 JSON 文件并提交 PR
                      </div>
                    </div>
                    <GitPullRequest size={18} className="flex-shrink-0 text-accent" />
                  </a>
                </div>
              </div>

              <div className="flex justify-end border-t border-zinc-100 bg-zinc-50/50 p-5 dark:border-zinc-800 dark:bg-zinc-900/50">
                <a
                  href={siteConfig.friendsPage.repoFriendsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center rounded-xl bg-ink px-6 py-2.5 text-sm font-bold text-white shadow-md transition-opacity hover:opacity-90 dark:bg-white dark:text-ink"
                >
                  去提交 PR
                </a>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
