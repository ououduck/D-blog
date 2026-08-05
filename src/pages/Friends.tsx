import React, { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ExternalLink, Copy, Check, Download, Mail, Sparkles, ChevronDown, Globe2, X } from 'lucide-react';
import { SearchField } from '@/components/SearchField';
import { siteConfig } from '@config/site.config';
import { getFriends } from '@/services/friends';
import { Seo } from '../components/Seo';
import { Friend } from '../types';
import { ProgressiveImage } from '@/components/ProgressiveImage';
import { ContentStatus, LoadingStatus } from '@/components/ContentStatus';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { SlideModal } from '@/components/SlideModal';
import { Surface } from '@/components/ui/Surface';
import { easeOut, fadeInUp, staggerContainer } from '@/utils/motion';
import {
  copyText,
  createFriendLinkApplication,
  createFriendLinkMailto,
  downloadTextFile,
  FRIEND_LINK_EMAIL_SUBJECT,
  type FriendLinkApplicationValues,
  validateFriendLinkApplication
} from './friends/friendLinkApplication';

const EMPTY_APPLICATION_VALUES: FriendLinkApplicationValues = {
  name: '',
  description: '',
  avatar: '',
  url: ''
};

export const Friends = () => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [friends, setFriends] = useState<Friend[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [applicationValues, setApplicationValues] = useState<FriendLinkApplicationValues>(EMPTY_APPLICATION_VALUES);
  const [applicationFilename, setApplicationFilename] = useState('');
  const [applicationErrors, setApplicationErrors] = useState<ReturnType<typeof validateFriendLinkApplication>>({});
  const [applicationResult, setApplicationResult] = useState<ReturnType<typeof createFriendLinkApplication> | null>(null);
  const [isResultCopied, setIsResultCopied] = useState(false);
  const [resultCopyError, setResultCopyError] = useState<string | null>(null);
  const [applicationDownloadError, setApplicationDownloadError] = useState<string | null>(null);
  const shouldReduceMotion = useReducedMotion();

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    getFriends()
      .then((data) => {
        if (cancelled) return;
        setFriends(data);
        setLoadError(null);
      })
      .catch((error) => {
        if (cancelled) return;
        console.error('Failed to load friends:', error);
        setLoadError('友链数据加载失败，请稍后刷新重试。');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [loadAttempt]);

  const containerVariants = shouldReduceMotion ? undefined : staggerContainer;
  const itemVariants = shouldReduceMotion ? undefined : fadeInUp;

  const siteInfo = {
    name: siteConfig.title,
    description: siteConfig.description,
    url: siteConfig.url,
    avatar: siteConfig.logo
  };

  const handleApplicationFieldChange = (field: keyof FriendLinkApplicationValues, value: string) => {
    setApplicationValues((current) => ({ ...current, [field]: value }));
    setApplicationErrors((current) => ({ ...current, [field]: undefined }));
  };

  const handleCompleteApplication = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const errors = validateFriendLinkApplication(applicationValues, applicationFilename);
    setApplicationErrors(errors);
    if (Object.keys(errors).length > 0) {
      return;
    }

    const result = createFriendLinkApplication(applicationValues, applicationFilename);
    const downloaded = downloadTextFile(result.json, result.filename);
    setApplicationResult(result);
    setApplicationDownloadError(downloaded ? null : '浏览器未能自动下载文件。请在下方复制 JSON，并使用“重新下载”或手动保存为 .json 文件。');
    setIsResultCopied(false);
    setResultCopyError(null);

    try {
      await copyText(result.json);
      setIsResultCopied(true);
    } catch (error) {
      console.error('Failed to copy friend link application:', error);
      setResultCopyError('自动复制失败，请在弹窗中点击“复制 JSON”。');
    }
  };

  const handleDownloadResult = () => {
    if (!applicationResult) return;
    const downloaded = downloadTextFile(applicationResult.json, applicationResult.filename);
    setApplicationDownloadError(downloaded ? null : '浏览器未能自动下载文件，请手动保存下方 JSON。');
  };

  const handleCopyResult = async () => {
    if (!applicationResult) return;
    try {
      await copyText(applicationResult.json);
      setIsResultCopied(true);
      setResultCopyError(null);
    } catch (error) {
      console.error('Failed to copy friend link application:', error);
      setResultCopyError('复制失败，请检查浏览器权限后重试。');
    }
  };

  const getFriendDomain = (url: string) => {
    try {
      return new URL(url).hostname.replace(/^www\./, '');
    } catch {
      return url;
    }
  };

  const resultMailto = applicationResult
    ? createFriendLinkMailto(applicationResult.json, siteConfig.friendsPage.applicationEmail)
    : '';
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
      <Seo title="友链" description="D-blog 友情链接汇集优秀技术博客与趣味网站，欢迎在线填写申请信息。" />

      <header className="mb-12 border-b border-zinc-200 pb-8 dark:border-zinc-800 md:pb-10">
        <p className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500 dark:text-zinc-400">Friends Directory</p>
        <h1 className="font-serif text-4xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100 md:text-5xl">友情链接</h1>
        <p className="mt-4 max-w-2xl text-zinc-600 dark:text-zinc-400">
          这里汇集了一些优秀的技术博客和有趣的网站。如果你也想交换友链，可以在线填写申请信息。
        </p>
        <p className="mt-4 flex items-center gap-2 text-sm text-zinc-500 dark:text-zinc-400">
          <Sparkles size={14} />
          以下排名不分先后，每次刷新都会随机排序
        </p>
      </header>

      <div className="mb-12 border-y border-zinc-200 dark:border-zinc-800">
        <button
          type="button"
          onClick={() => setIsExpanded(!isExpanded)}
          className="flex w-full items-center justify-between gap-4 py-4 text-left transition-colors hover:text-zinc-700 dark:hover:text-zinc-300"
          aria-expanded={isExpanded}
          aria-controls="friend-link-panel"
        >
          <div className="min-w-0 flex-1">
            <span className="text-base font-semibold text-zinc-950 dark:text-white">申请友链</span>
            <p className="mt-1 text-sm leading-relaxed text-zinc-700 dark:text-zinc-300">填写信息 → 下载并复制 JSON → 添加附件发送邮件</p>
            <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs font-semibold">
              <span className="inline-flex items-center gap-1.5 rounded-control border border-zinc-300 bg-paper px-2.5 py-1.5 text-zinc-700 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300">
                收件邮箱：{siteConfig.friendsPage.applicationEmail}
              </span>
              <span className="text-zinc-600 dark:text-zinc-400">主题：{FRIEND_LINK_EMAIL_SUBJECT}</span>
            </div>
          </div>
          <motion.div
            animate={{ rotate: isExpanded ? 180 : 0 }}
            transition={shouldReduceMotion ? { duration: 0 } : { duration: 0.22, ease: [0.4, 0, 0.2, 1] }}
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
              initial={shouldReduceMotion ? false : { height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={shouldReduceMotion ? undefined : { height: 0, opacity: 0 }}
              transition={shouldReduceMotion ? { duration: 0 } : { duration: 0.28, ease: [0.4, 0, 0.2, 1] }}
              className="overflow-hidden"
            >
              <div className="border-t border-zinc-200 pb-5 pt-5 dark:border-zinc-800 sm:pb-6 sm:pt-6">
                <div className="space-y-6">
                  <Surface variant="panel" className="p-4 sm:p-5" aria-labelledby="friend-link-application-guide">
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <h2 id="friend-link-application-guide" className="text-base font-bold text-zinc-950 dark:text-zinc-100">申请说明</h2>
                        <p className="mt-1 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">请按以下步骤完成申请，邮件发送前请确认 JSON 文件已作为附件添加。</p>
                      </div>
                      <div className="flex-shrink-0 rounded-control border border-zinc-400 bg-paper px-3 py-2 text-left dark:border-zinc-600 dark:bg-zinc-950">
                        <div className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">收件邮箱</div>
                        <div className="mt-0.5 break-all font-mono text-sm font-bold text-zinc-950 dark:text-zinc-100">{siteConfig.friendsPage.applicationEmail}</div>
                      </div>
                    </div>
                    <ol className="mt-5 grid gap-4 text-sm leading-relaxed text-zinc-800 dark:text-zinc-200 sm:grid-cols-2">
                      <li className="flex gap-3"><span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-zinc-900 text-xs font-bold text-white dark:bg-zinc-100 dark:text-zinc-950">1</span><span>填写站点名称、简介、头像地址、站点地址，以及纯英文文件名。</span></li>
                      <li className="flex gap-3"><span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-zinc-900 text-xs font-bold text-white dark:bg-zinc-100 dark:text-zinc-950">2</span><span>点击“完成并生成 JSON”，浏览器会下载文件并自动复制完整 JSON。</span></li>
                      <li className="flex gap-3"><span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-zinc-900 text-xs font-bold text-white dark:bg-zinc-100 dark:text-zinc-950">3</span><span>在结果弹窗点击“前往发送”，邮件主题必须是 <strong>D-blog友链申请</strong>，正文为完整 JSON。</span></li>
                      <li className="flex gap-3"><span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-zinc-900 text-xs font-bold text-white dark:bg-zinc-100 dark:text-zinc-950">4</span><span>在邮件客户端中手动添加刚下载的 <strong>.json</strong> 文件作为附件后发送。</span></li>
                    </ol>
                    <p className="mt-5 border-t border-zinc-200 pt-3 text-xs leading-relaxed text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">提交前请先添加本站友链。我们会不定期清理无法访问、头像异常或内容不合适的站点。</p>
                  </Surface>

                  <Surface variant="card" className="p-4 sm:p-5" aria-labelledby="friend-link-site-info">
                    <h2 id="friend-link-site-info" className="mb-3 text-sm font-semibold text-zinc-900 dark:text-zinc-100">本站信息（提交前请先添加本站友链）</h2>
                    <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center">
                      <ProgressiveImage src={siteInfo.avatar} alt={siteInfo.name} wrapperClassName="h-14 w-14 flex-shrink-0 overflow-hidden rounded-full border border-zinc-300 bg-paper dark:border-zinc-700 dark:bg-void" className="h-14 w-14 object-cover object-center" />
                      <div className="w-full flex-1 space-y-1">
                        <div className="font-semibold text-zinc-900 dark:text-zinc-100">{siteInfo.name}</div>
                        <div className="text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">{siteInfo.description}</div>
                        <div className="break-all pt-0.5 font-mono text-xs leading-relaxed text-zinc-700 dark:text-zinc-400 select-all">链接：{siteInfo.url}</div>
                        <div className="break-all font-mono text-xs leading-relaxed text-zinc-700 dark:text-zinc-400 select-all">LOGO：{siteInfo.avatar}</div>
                      </div>
                    </div>
                  </Surface>

                  <form noValidate onSubmit={handleCompleteApplication} className="border-t border-zinc-200 pt-5 dark:border-zinc-800">
                    <div className="mb-4">
                      <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">在线填写申请</h2>
                      <p className="mt-1 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">填写完成后将下载 JSON 文件、自动复制内容，并显示发送邮件入口。收件邮箱为 <strong className="text-zinc-900 dark:text-zinc-100">{siteConfig.friendsPage.applicationEmail}</strong>，邮件主题必须为 <strong className="text-zinc-900 dark:text-zinc-100">{FRIEND_LINK_EMAIL_SUBJECT}</strong>。</p>
                    </div>
                    <div className="grid gap-4 sm:grid-cols-2">
                      {([
                        ['name', '站点名称', '例如：我的博客'],
                        ['description', '站点简介', '例如：记录技术与生活'],
                        ['avatar', '头像地址', 'https://example.com/avatar.png'],
                        ['url', '站点地址', 'https://example.com']
                      ] as const).map(([field, label, placeholder]) => (
                        <label key={field} className={field === 'description' ? 'sm:col-span-2' : ''}>
                          <span className="mb-1.5 block text-xs font-semibold text-zinc-700 dark:text-zinc-300">{label}</span>
                          <input
                            type={field === 'url' || field === 'avatar' ? 'url' : 'text'}
                            value={applicationValues[field]}
                            onChange={(event) => handleApplicationFieldChange(field, event.target.value)}
                            placeholder={placeholder}
                            className="editorial-input"
                            aria-invalid={Boolean(applicationErrors[field])}
                            aria-describedby={applicationErrors[field] ? `${field}-error` : undefined}
                          />
                          {applicationErrors[field] && <span id={`${field}-error`} className="mt-1 block text-xs text-red-600 dark:text-red-400">{applicationErrors[field]}</span>}
                        </label>
                      ))}
                      <label className="sm:col-span-2">
                        <span className="mb-1.5 block text-xs font-semibold text-zinc-700 dark:text-zinc-300">文件名（纯英文）</span>
                        <input
                          type="text"
                          value={applicationFilename}
                          onChange={(event) => {
                            setApplicationFilename(event.target.value);
                            setApplicationErrors((current) => ({ ...current, filename: undefined }));
                          }}
                          placeholder="例如：my-blog"
                          className="w-full rounded-control border border-zinc-300 bg-white px-3 py-2.5 text-sm text-zinc-900 outline-none transition-colors placeholder:text-zinc-400 focus:border-zinc-700 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100 dark:focus:border-zinc-300"
                          aria-invalid={Boolean(applicationErrors.filename)}
                          aria-describedby={applicationErrors.filename ? 'friend-filename-error' : undefined}
                        />
                        {applicationErrors.filename && <span id="friend-filename-error" className="mt-1 block text-xs text-red-600 dark:text-red-400">{applicationErrors.filename}</span>}
                      </label>
                    </div>
                    <div className="mt-5 flex justify-end">
                      <button type="submit" className="editorial-button-primary inline-flex items-center gap-2 px-5">
                        <Download size={16} />
                        完成并生成 JSON
                      </button>
                    </div>
                  </form>
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
              transition={shouldReduceMotion ? { duration: 0 } : { duration: 0.14, ease: easeOut }}
              href={friend.url}
              target="_blank"
              rel="noopener noreferrer"
              className="group relative block h-full rounded-surface border border-zinc-300 bg-paper p-5 transition-colors duration-150 hover:border-ink dark:border-zinc-700 dark:bg-zinc-900 dark:hover:border-white"
            >
              <div className="absolute right-0 top-0 p-4 text-zinc-400 opacity-0 transition-opacity duration-150 group-hover:opacity-100 dark:text-zinc-500">
                <ExternalLink size={16} />
              </div>
              <div className="flex items-start gap-4 pr-5">
                <div className="h-14 w-14 flex-shrink-0 overflow-hidden rounded-full border border-zinc-300 bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-900">
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
            <motion.div key={`skeleton-${index}`} aria-hidden="true" variants={itemVariants} className={`${shouldReduceMotion ? '' : 'animate-pulse '}rounded-surface border border-zinc-200 bg-paper p-5 dark:border-zinc-800 dark:bg-zinc-900`}>
              <div className="flex items-start gap-4">
                <div className="h-14 w-14 flex-shrink-0 rounded-full bg-zinc-100 dark:bg-zinc-800" />
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

      <SlideModal
        isOpen={Boolean(applicationResult)}
        onClose={() => {
          setApplicationResult(null);
          setApplicationDownloadError(null);
        }}
        ariaLabelledby="friend-link-result-title"
        ariaDescribedby="friend-link-result-description"
        className="max-w-2xl"
      >
        {applicationResult && (
          <div>
            <div className="flex items-start justify-between gap-4 border-b border-zinc-200 px-5 py-4 dark:border-zinc-800">
              <div>
                <h2 id="friend-link-result-title" className="font-serif text-xl font-bold text-zinc-900 dark:text-zinc-100">JSON 已生成</h2>
                <p id="friend-link-result-description" className="mt-1 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">{applicationDownloadError ? 'JSON 已生成，但自动下载未完成。请复制下方内容或重试下载。' : '文件已下载到本地，发送邮件时请将该文件作为附件添加。'}</p>
              </div>
              <button type="button" onClick={() => { setApplicationResult(null); setApplicationDownloadError(null); }} className="inline-flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-icon text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-900 dark:hover:bg-zinc-800 dark:hover:text-zinc-100" aria-label="关闭 JSON 结果弹窗">
                <X size={18} />
              </button>
            </div>
            <div className="space-y-4 overflow-y-auto px-5 py-5">
              <div className="flex items-center gap-2 text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                <Download size={16} />
                {applicationResult.filename}
              </div>
              <pre className="max-h-72 select-all overflow-auto whitespace-pre-wrap border border-zinc-200 bg-zinc-50 p-3 font-mono text-xs leading-relaxed text-zinc-700 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-300">{applicationResult.json}</pre>
              {applicationDownloadError && <p className="text-xs text-red-600 dark:text-red-400">{applicationDownloadError}</p>}
              {resultCopyError && <p className="text-xs text-red-600 dark:text-red-400">{resultCopyError}</p>}
              {!resultCopyError && isResultCopied && <p className="text-xs text-emerald-600 dark:text-emerald-400">JSON 已自动复制到剪贴板。</p>}
              <p className="text-xs leading-relaxed text-zinc-600 dark:text-zinc-400">收件地址：{siteConfig.friendsPage.applicationEmail}；邮件主题：{FRIEND_LINK_EMAIL_SUBJECT}。点击发送后，请在邮件客户端中确认正文，并手动添加刚刚下载的 JSON 附件。</p>
              <div className="flex flex-wrap justify-end gap-2 border-t border-zinc-200 pt-4 dark:border-zinc-800">
                <button type="button" onClick={handleCopyResult} className="editorial-button inline-flex items-center gap-2 px-4">
                  {isResultCopied ? <Check size={15} /> : <Copy size={15} />}
                  {isResultCopied ? '已复制' : '复制 JSON'}
                </button>
                {applicationDownloadError && (
                  <button type="button" onClick={handleDownloadResult} className="editorial-button inline-flex items-center gap-2 px-4">
                    <Download size={15} />
                    重新下载
                  </button>
                )}
                <a href={resultMailto} className="editorial-button-primary inline-flex items-center gap-2 px-4">
                  <Mail size={15} />
                  前往发送
                </a>
              </div>
            </div>
          </div>
        )}
      </SlideModal>
    </div>
  );
};
