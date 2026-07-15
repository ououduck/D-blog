import React, { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ExternalLink, Copy, Check, GitPullRequest, Sparkles, ChevronDown, Globe2 } from 'lucide-react';
import { SearchField } from '@/components/SearchField';
import { siteConfig } from '@config/site.config';
import { getFriends } from '@/services/friends';
import { Seo } from '../components/Seo';
import { Friend } from '../types';
import { ProgressiveImage } from '@/components/ProgressiveImage';
import { ContentStatus, LoadingStatus } from '@/components/ContentStatus';
import { easeOut, fadeInUp, staggerContainer } from '@/utils/motion';

export const Friends = () => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isCopied, setIsCopied] = useState(false);
  const [friends, setFriends] = useState<Friend[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadAttempt, setLoadAttempt] = useState(0);

  useEffect(() => {
    setLoading(true);
    getFriends()
      .then((data) => {
        setFriends(data);
        setLoadError(null);
      })
      .catch((error) => {
        console.error('Failed to load friends:', error);
        setLoadError('友链数据加载失败，请稍后刷新重试。');
      })
      .finally(() => setLoading(false));
  }, [loadAttempt]);

  const containerVariants = staggerContainer;

  const itemVariants = fadeInUp;

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

  const getFriendDomain = (url: string) => {
    try {
      return new URL(url).hostname.replace(/^www\./, '');
    } catch {
      return url;
    }
  };

  const filteredFriends = useMemo(() => {
    const keyword = searchQuery.trim().toLocaleLowerCase();
    if (!keyword) {
      return friends;
    }

    return friends.filter((friend) => {
      const domain = getFriendDomain(friend.url).toLocaleLowerCase();
      return [friend.name, friend.description, domain].some((value) => value.toLocaleLowerCase().includes(keyword));
    });
  }, [friends, searchQuery]);

  return (
    <div className="pb-12 pt-8 md:pb-20 md:pt-12">
      <Seo title="友链" description="D-blog 友情链接汇集优秀技术博客与趣味网站，欢迎通过 GitHub PR 申请交换友链。" />

      <header className="mb-12 border-b border-zinc-200 pb-8 dark:border-zinc-800 md:pb-10">
        <p className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500 dark:text-zinc-400">Friends Directory</p>
        <h1 className="font-serif text-4xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100 md:text-5xl">友情链接</h1>
        <p className="mt-4 max-w-2xl text-zinc-600 dark:text-zinc-400">
          这里汇集了一些优秀的技术博客和有趣的网站。如果你也想交换友链，可以直接在仓库里提交 PR。
        </p>
        <p className="mt-4 flex items-center gap-2 text-sm text-zinc-500 dark:text-zinc-400">
          <Sparkles size={14} />
          以下排名不分先后，每次刷新都会随机排序
        </p>
      </header>

      {/* 申请友链 */}
      <div className="mb-12 border-y border-zinc-200 dark:border-zinc-800">
        <button
          type="button"
          onClick={() => setIsExpanded(!isExpanded)}
          className="flex w-full items-center justify-between gap-4 py-4 text-left transition-colors hover:text-zinc-700 dark:hover:text-zinc-300"
          aria-expanded={isExpanded}
          aria-controls="friend-link-panel"
        >
          <div>
            <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">申请友链</span>
            <p className="mt-1 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">按模板提交 PR，就能更快完成收录。</p>
          </div>
          <motion.div
            animate={{ rotate: isExpanded ? 180 : 0 }}
            transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
            className="flex-shrink-0"
          >
            <ChevronDown size={18} className="text-zinc-500 dark:text-zinc-400" />
          </motion.div>
        </button>

        <AnimatePresence initial={false}>
          {isExpanded && (
            <motion.div
              id="friend-link-panel"
              key="friend-link-content"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.4, ease: [0.4, 0, 0.2, 1] }}
              className="overflow-hidden"
            >
              <div className="border-t border-zinc-200 pb-5 pt-5 dark:border-zinc-800 sm:pb-6 sm:pt-6">
                <div className="space-y-6">
                  <div className="text-sm leading-relaxed text-zinc-700 dark:text-zinc-300">
                    <span className="font-semibold text-zinc-900 dark:text-zinc-100">公告：</span>
                    {siteConfig.friendsPage.announcement}
                  </div>

                  <section className="border-t border-zinc-200 pt-5 dark:border-zinc-800">
                    <h2 className="mb-3 text-sm font-semibold text-zinc-900 dark:text-zinc-100">本站信息（提交前请先添加本站友链）</h2>
                    <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center">
                      <ProgressiveImage src={siteInfo.avatar} alt={siteInfo.name} wrapperClassName="h-12 w-12 flex-shrink-0 overflow-hidden rounded-full border border-zinc-300 bg-paper dark:border-zinc-700 dark:bg-void" className="h-12 w-12 object-cover object-center" />
                      <div className="w-full flex-1 space-y-1">
                        <div className="font-semibold text-zinc-900 dark:text-zinc-100">{siteInfo.name}</div>
                        <div className="text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">{siteInfo.description}</div>
                        <div className="break-all pt-0.5 font-mono text-xs leading-relaxed text-zinc-700 dark:text-zinc-400 select-all">链接：{siteInfo.url}</div>
                        <div className="break-all font-mono text-xs leading-relaxed text-zinc-700 dark:text-zinc-400 select-all">LOGO：{siteInfo.avatar}</div>
                      </div>
                    </div>
                  </section>

                  <section className="border-t border-zinc-200 pt-5 dark:border-zinc-800">
                    <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">友链 JSON 模板</h2>
                      <button type="button" onClick={handleCopyTemplate} className="editorial-button px-3 py-1.5 text-xs sm:self-auto">
                        {isCopied ? <Check size={14} /> : <Copy size={14} />}
                        {isCopied ? '已复制' : '复制模板'}
                      </button>
                    </div>
                    <pre className="select-all whitespace-pre-wrap border border-zinc-200 bg-zinc-50 p-3 font-mono text-xs leading-relaxed text-zinc-700 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-300">
                      {templateText}
                    </pre>
                  </section>

                  <a
                    href={siteConfig.friendsPage.repoFriendsUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group flex items-center justify-between gap-4 border-t border-zinc-200 pt-5 transition-colors hover:border-zinc-400 dark:border-zinc-800 dark:hover:border-zinc-600"
                  >
                    <div>
                      <div className="font-semibold text-zinc-900 dark:text-zinc-100">GitHub PR</div>
                      <div className="break-all text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
                        在仓库 {siteConfig.friendsPage.repoFriendsDir} 目录下新增一个 JSON 文件并提交 PR
                      </div>
                    </div>
                    <GitPullRequest size={18} className="flex-shrink-0 text-zinc-500 transition-colors group-hover:text-zinc-900 dark:text-zinc-400 dark:group-hover:text-zinc-100" />
                  </a>
                </div>

                <div className="mt-5 flex justify-end border-t border-zinc-200 pt-5 dark:border-zinc-800">
                  <a
                    href={`${siteConfig.friendsPage.repoUrl}/tree/main/${siteConfig.friendsPage.repoFriendsDir}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="editorial-button-primary px-5"
                  >
                    去提交 PR
                  </a>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="mb-8 border-y border-zinc-200 py-4 dark:border-zinc-800">
        <SearchField
          value={searchQuery}
          onValueChange={setSearchQuery}
          onClear={() => setSearchQuery('')}
          clearLabel="清除友链搜索"
          placeholder="按站点名称、简介或域名搜索友链..."
          aria-label="搜索友链"
        />
        {searchQuery && (
          <p className="mt-3 text-sm text-zinc-600 dark:text-zinc-400">找到 {filteredFriends.length} 个匹配站点</p>
        )}
      </div>

      {loadError && !loading && (
        <ContentStatus
          variant="error"
          title="友链加载失败"
          description={loadError}
          actionLabel="重新加载"
          onAction={() => setLoadAttempt((attempt) => attempt + 1)}
          className="mb-8"
        />
      )}

      <motion.div variants={containerVariants} initial="hidden" animate="visible" className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3" aria-busy={loading}>
        {!loading && !loadError && filteredFriends.length > 0 &&
          filteredFriends.map((friend, index) => (
            <motion.a
              key={`${friend.url}-${index}`}
              variants={itemVariants}
              transition={{ duration: 0.16, ease: easeOut }}
              href={friend.url}
              target="_blank"
              rel="noopener noreferrer"
              className="group relative block h-full rounded-surface border border-zinc-300 bg-white p-5 transition-colors duration-150 hover:border-ink dark:border-zinc-700 dark:bg-zinc-900 dark:hover:border-white"
            >
              <div className="absolute right-0 top-0 p-4 text-zinc-400 opacity-0 transition-opacity duration-150 group-hover:opacity-100 dark:text-zinc-500">
                <ExternalLink size={16} />
              </div>
              <div className="flex items-start gap-4 pr-5">
                <div className="h-12 w-12 flex-shrink-0 overflow-hidden rounded-full border border-zinc-300 bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-900">
                  <ProgressiveImage src={friend.avatar} alt={friend.name} wrapperClassName="h-full w-full" className="h-full w-full object-cover object-center" effect="fade" />
                </div>
                <div className="min-w-0 flex-1">
                  <h2 className="mb-1 truncate font-serif text-lg font-bold text-zinc-900 transition-colors group-hover:text-zinc-700 dark:text-zinc-100 dark:group-hover:text-zinc-300">{friend.name}</h2>
                  <p className="line-clamp-2 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">{friend.description}</p>
                  <div className="mt-3 inline-flex max-w-full items-center gap-1.5 border-b border-zinc-300 py-1 text-xs font-medium text-zinc-500 dark:border-zinc-700 dark:text-zinc-400">
                    <Globe2 size={12} />
                    <span className="truncate">{getFriendDomain(friend.url)}</span>
                  </div>
                </div>
              </div>
            </motion.a>
          ))}

        {loading && <LoadingStatus label="正在加载友情链接" className="col-span-full" />}
        {loading &&
          Array.from({ length: 3 }).map((_, index) => (
            <motion.div key={`skeleton-${index}`} aria-hidden="true" variants={itemVariants} className="animate-pulse rounded-surface border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
              <div className="flex items-start gap-4">
                <div className="h-12 w-12 flex-shrink-0 rounded-full bg-zinc-100 dark:bg-zinc-800" />
                <div className="flex-1 space-y-3">
                  <div className="h-5 w-1/3 bg-zinc-100 dark:bg-zinc-800" />
                  <div className="h-4 w-full bg-zinc-100 dark:bg-zinc-800" />
                  <div className="h-4 w-2/3 bg-zinc-100 dark:bg-zinc-800" />
                </div>
              </div>
            </motion.div>
          ))}

        {!loading && !loadError && filteredFriends.length === 0 && (
          <div className="col-span-full border-y border-dashed border-zinc-300 py-10 text-center text-sm text-zinc-500 dark:border-zinc-700 dark:text-zinc-400">
            没有找到匹配的友链，试试更短的关键词。
          </div>
        )}
      </motion.div>
    </div>
  );
};
