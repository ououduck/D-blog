import React, { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowRight, Check, ExternalLink, Github, Sparkles, ChevronDown, Globe2, X } from 'lucide-react';
import { SearchField } from '@/components/SearchField';
import { siteConfig } from '@config/site.config';
import { getFriends, getInitialFriends } from '@/services/friends';
import { Seo, buildSiteSchemas } from '../components/Seo';
import { absoluteSiteUrl } from '@/utils/siteUrl';
import { Friend } from '../types';
import { ProgressiveImage } from '@/components/ProgressiveImage';
import { ContentStatus, LoadingStatus } from '@/components/ContentStatus';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { SlideModal } from '@/components/SlideModal';
import { Surface } from '@/components/ui/Surface';
import { easeOut, fadeInUp, staggerContainer } from '@/utils/motion';
import { createFriendLinkApplication, type FriendLinkApplicationValues, validateFriendLinkApplication } from './friends/friendLinkApplication';

const EMPTY_APPLICATION_VALUES: FriendLinkApplicationValues = {
  name: '',
  description: '',
  avatar: '',
  url: '',
  friendPageUrl: '',
  contact: '',
  reciprocalLinkConfirmed: false,
};

const getFriendDomain = (url: string) => {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
};

interface FriendCardProps {
  friend: Friend;
  /** 已失联样式：头像右下角红色闪烁小点 + 「已失联」角标 + 弱化边框。 */
  unavailable?: boolean;
}

/**
 * 友链卡片：正常友链与已失联友链共用同一布局，保证两板块视觉一致。
 * 已失联状态由 friend-link-check Action 在 friends/*.json 中写入
 * `"unavailable": true` 标记（详见 scripts/friend-link-check.mjs）。
 */
const FriendCard = ({ friend, unavailable = false }: FriendCardProps) => {
  const shouldReduceMotion = useReducedMotion();
  return (
    <motion.a
      variants={shouldReduceMotion ? undefined : fadeInUp}
      transition={shouldReduceMotion ? { duration: 0 } : { duration: 0.14, ease: easeOut }}
      href={friend.url}
      target="_blank"
      rel="noopener noreferrer"
      className={`group relative block h-full rounded-surface border bg-paper p-5 transition-colors duration-150 hover:border-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-900 dark:bg-zinc-900 dark:focus-visible:outline-zinc-100 ${
        unavailable
          ? 'border-red-300/70 opacity-80 dark:border-red-900/60 dark:hover:border-red-500'
          : 'border-zinc-300 hover:border-ink dark:border-zinc-700 dark:hover:border-white dark:focus-visible:border-white'
      }`}
    >
      {unavailable && (
        <span className="absolute left-0 top-0 z-10 rounded-br-lg border-b border-r border-red-300/70 bg-red-50 px-2 py-1 text-[11px] font-semibold text-red-600 dark:border-red-900/60 dark:bg-red-950/60 dark:text-red-400">
          已失联
        </span>
      )}
      <div className="absolute right-0 top-0 p-4 text-zinc-400 opacity-0 transition-opacity duration-150 group-hover:opacity-100 group-focus-within:opacity-100 group-focus-visible:opacity-100 dark:text-zinc-500">
        <ExternalLink size={16} />
      </div>
      <div className="flex items-start gap-4 pr-5">
        <div className="relative h-14 w-14 flex-shrink-0">
          <div className="h-14 w-14 overflow-hidden rounded-full border border-zinc-300 bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-900">
            <ProgressiveImage src={friend.avatar} alt={friend.name} wrapperClassName="h-full w-full" className="h-full w-full object-cover object-center" effect="fade" />
          </div>
          {unavailable && (
            <span aria-hidden="true" className="friend-dead-dot absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-paper bg-red-500 dark:border-zinc-900" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <h2 className={`mb-1 truncate font-serif text-lg font-bold transition-colors group-hover:text-zinc-700 dark:group-hover:text-zinc-300 ${
            unavailable ? 'text-zinc-700 dark:text-zinc-300' : 'text-zinc-900 dark:text-zinc-100'
          }`}>
            {friend.name}
          </h2>
          <p className="line-clamp-2 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">{friend.description}</p>
          <div className={`mt-3 inline-flex max-w-full items-center gap-1.5 border-b py-1 text-xs font-medium ${
            unavailable
              ? 'border-red-300/60 text-red-500/90 dark:border-red-900/50 dark:text-red-400/90'
              : 'border-zinc-300 text-zinc-500 dark:border-zinc-700 dark:text-zinc-400'
          }`}>
            <Globe2 size={12} />
            <span className="truncate">{getFriendDomain(friend.url)}</span>
          </div>
        </div>
      </div>
    </motion.a>
  );
};

// 构建期 SSG：friends.json 已通过 eager glob 内联，SSR 阶段即可同步渲染友链列表，
// 客户端水合首帧与 SSR 输出一致；异步重取仅用于“重新加载”。
const initialFriends = getInitialFriends();

export const Friends = () => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isDeadExpanded, setIsDeadExpanded] = useState(false);
  const [currentApplicationStep, setCurrentApplicationStep] = useState(1);
  const [friends, setFriends] = useState<Friend[]>(initialFriends);
  const [searchQuery, setSearchQuery] = useState('');
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(initialFriends.length === 0);
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [applicationValues, setApplicationValues] = useState<FriendLinkApplicationValues>(EMPTY_APPLICATION_VALUES);
  const [applicationFilename, setApplicationFilename] = useState('');
  const [applicationErrors, setApplicationErrors] = useState<ReturnType<typeof validateFriendLinkApplication>>({});
  const [applicationResult, setApplicationResult] = useState<ReturnType<typeof createFriendLinkApplication> | null>(null);
  // 草稿弹窗的显隐与草稿结果分离：弹窗关闭后 applicationResult 仍保留，
  // 表单区的「我已提交」按钮不随之消失（否则用户提交 Issue 返回后无路可走）。
  const [isApplicationResultOpen, setIsApplicationResultOpen] = useState(false);
  const shouldReduceMotion = useReducedMotion();

  useEffect(() => {
    let cancelled = false;
    // 首次加载数据已由 eager glob 同步提供；仅“重新加载”（loadAttempt > 0）
    // 或初始数据缺失时才有必要走异步重取。
    if (loadAttempt === 0 && initialFriends.length > 0) {
      setLoading(false);
      return () => {
        cancelled = true;
      };
    }
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

    return () => {
      cancelled = true;
    };
  }, [loadAttempt]);

  const containerVariants = shouldReduceMotion ? undefined : staggerContainer;
  const itemVariants = shouldReduceMotion ? undefined : fadeInUp;

  const siteInfo = {
    name: siteConfig.title,
    description: siteConfig.description,
    url: siteConfig.url,
    avatar: siteConfig.logo,
  };

  const handleApplicationFieldChange = (field: keyof FriendLinkApplicationValues, value: string) => {
    setApplicationValues((current) => ({ ...current, [field]: value }));
    setApplicationErrors((current) => ({ ...current, [field]: undefined }));
  };

  const handleCompleteApplication = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    const errors = validateFriendLinkApplication(applicationValues, applicationFilename);
    setApplicationErrors(errors);
    if (Object.keys(errors).length > 0) {
      const firstErrorField = (
        ['name', 'description', 'avatar', 'url', 'friendPageUrl', 'contact', 'filename', 'reciprocalLinkConfirmed'] as const
      ).find((field) => errors[field]);
      requestAnimationFrame(() => {
        form.querySelector<HTMLElement>(`[data-application-field="${firstErrorField}"]`)?.focus();
      });
      return;
    }

    const result = createFriendLinkApplication(applicationValues, applicationFilename, siteConfig.friendsPage.repoUrl);
    setApplicationResult(result);
    setIsApplicationResultOpen(true);
  };

  const advanceApplicationStep = (step: number) => {
    setCurrentApplicationStep((current) => Math.max(current, step));
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

  // 已失联友链（friend.unavailable === true，由检查 Action 维护）与正常友链分开渲染：
  // 正常友链留在主列表，失联友链全部归入下方「已失联的博客」折叠板块。
  const activeFriends = useMemo(
    () => filteredFriends.filter((friend) => friend.unavailable !== true),
    [filteredFriends]
  );
  const unavailableFriends = useMemo(
    () => filteredFriends.filter((friend) => friend.unavailable === true),
    [filteredFriends]
  );

  // 友链页结构化数据：站点级 schema + CollectionPage + ItemList（枚举全部有效友链，
  // 帮助爬虫理解友链集合）+ BreadcrumbList。SSG 静态页已标记 schemaFromSeo，不重复注入。
  const friendsPageDescription = 'D-blog 友情链接汇集优秀技术博客与趣味网站，欢迎通过 GitHub PR 申请交换友链，一起分享交流与成长。';
  const friendsStructuredData = [
    ...buildSiteSchemas(friendsPageDescription),
    {
      '@context': 'https://schema.org',
      '@type': 'CollectionPage',
      name: `友链 - ${siteConfig.title}`,
      description: friendsPageDescription,
      url: absoluteSiteUrl('/friends', siteConfig.url),
      inLanguage: 'zh-CN',
      isPartOf: {
        '@type': 'WebSite',
        name: siteConfig.title,
        url: absoluteSiteUrl('/', siteConfig.url)
      }
    },
    {
      '@context': 'https://schema.org',
      '@type': 'ItemList',
      name: '友情链接',
      url: absoluteSiteUrl('/friends', siteConfig.url),
      itemListElement: friends
        .filter((friend) => friend.unavailable !== true)
        .map((friend, index) => ({
          '@type': 'ListItem',
          position: index + 1,
          name: friend.name,
          url: friend.url
        }))
    },
    {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: '首页', item: absoluteSiteUrl('/', siteConfig.url) },
        { '@type': 'ListItem', position: 2, name: '友链', item: absoluteSiteUrl('/friends', siteConfig.url) }
      ]
    }
  ];

  return (
    <div className="pb-12 pt-8 md:pb-20 md:pt-12">
      <Seo
        title="友链"
        description={friendsPageDescription}
        structuredData={friendsStructuredData}
      />

      <header className="mb-12 border-b border-zinc-200 pb-8 dark:border-zinc-800 md:pb-10">
        <p className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500 dark:text-zinc-400">Friends Directory</p>
        <h1 className="font-serif text-4xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100 md:text-5xl">友情链接</h1>
        <p className="mt-4 max-w-2xl text-zinc-600 dark:text-zinc-400">这里汇集了一些优秀的技术博客和有趣的网站。如果你也想交换友链，可以在线填写申请信息。</p>
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
            <p className="mt-1 text-sm leading-relaxed text-zinc-700 dark:text-zinc-300">添加本站友链 → 登录 GitHub → 填写信息并提交 Issue</p>
          </div>
          <motion.div animate={{ rotate: isExpanded ? 180 : 0 }} transition={shouldReduceMotion ? { duration: 0 } : { duration: 0.22, ease: easeOut }} className="flex-shrink-0">
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
              transition={shouldReduceMotion ? { duration: 0 } : { duration: 0.28, ease: easeOut }}
              className="overflow-hidden"
            >
              <div className="border-t border-zinc-200 pb-5 pt-5 dark:border-zinc-800 sm:pb-6 sm:pt-6">
                <div className="space-y-6">
                  <Surface variant="panel" className="p-4 sm:p-5" aria-labelledby="friend-link-application-guide">
                    <div>
                      <h2 id="friend-link-application-guide" className="text-base font-bold text-zinc-950 dark:text-zinc-100">
                        申请说明
                      </h2>
                      <p className="mt-1 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">请按以下步骤完成申请，GitHub Issue 会记录申请并由 Action 自动检查反链。</p>
                    </div>
                    <ol className="mt-5 space-y-3 text-sm">
                      {[
                        ['添加本站友链', '先在自己的公开友链页加入 D-blog，并确认页面无需登录即可访问。'],
                        ['登录 GitHub', '在 GitHub 官方页面完成登录，本站不会读取或保存账号信息。'],
                        ['填写信息并提交 Issue', '填写站点资料，生成草稿并在 GitHub 中正式提交。'],
                        ['等待 bot 审核', '提交后由 Action 检查反链并自动处理申请。'],
                      ].map(([title, description], index) => {
                        const step = index + 1;
                        const completed = currentApplicationStep > step;
                        const active = currentApplicationStep === step;
                        return (
                          <li key={title} className="relative flex gap-3">
                            {step < 4 && <span aria-hidden="true" className="absolute left-3 top-7 h-7 border-l border-zinc-300 dark:border-zinc-700" />}
                            <span className={`relative z-10 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full text-xs font-bold ${completed || active ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-950' : 'bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400'}`}>
                              {completed ? <Check size={14} /> : step}
                            </span>
                            <div className="min-w-0 flex-1">
                              <div className={`font-semibold ${active ? 'text-zinc-950 dark:text-white' : 'text-zinc-600 dark:text-zinc-400'}`} aria-current={active ? 'step' : undefined}>{title}</div>
                              <p className="mt-1 text-zinc-600 dark:text-zinc-400">{description}</p>
                            </div>
                          </li>
                        );
                      })}
                    </ol>
                  </Surface>

                  <AnimatePresence mode="wait" initial={false}>
                    {currentApplicationStep === 1 && (
                      <motion.div key="friend-link-step-1" initial={shouldReduceMotion ? false : { opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={shouldReduceMotion ? undefined : { opacity: 0, y: -8 }}>
                        <Surface variant="card" className="p-4 sm:p-5" aria-labelledby="friend-link-site-info">
                          <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
                            <div>
                              <p className="text-xs font-semibold text-zinc-500 dark:text-zinc-400">第一步</p>
                              <h2 id="friend-link-site-info" className="mt-1 text-base font-semibold text-zinc-900 dark:text-zinc-100">添加本站友链</h2>
                            </div>
                            <button type="button" onClick={() => advanceApplicationStep(2)} className="editorial-button-primary">
                              我已完成
                              <ArrowRight size={16} />
                            </button>
                          </div>
                    <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center">
                      <ProgressiveImage
                        src={siteInfo.avatar}
                        alt={siteInfo.name}
                        wrapperClassName="h-14 w-14 flex-shrink-0 overflow-hidden rounded-full border border-zinc-300 bg-paper dark:border-zinc-700 dark:bg-void"
                        className="h-14 w-14 object-cover object-center"
                      />
                      <div className="w-full flex-1 space-y-1">
                        <div className="font-semibold text-zinc-900 dark:text-zinc-100">{siteInfo.name}</div>
                        <div className="text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">{siteInfo.description}</div>
                        <div className="break-all pt-0.5 font-mono text-xs leading-relaxed text-zinc-700 dark:text-zinc-400 select-all">链接：{siteInfo.url}</div>
                        <div className="break-all font-mono text-xs leading-relaxed text-zinc-700 dark:text-zinc-400 select-all">LOGO：{siteInfo.avatar}</div>
                      </div>
                    </div>
                        </Surface>
                      </motion.div>
                    )}
                    {currentApplicationStep === 2 && (
                      <motion.div key="friend-link-step-2" initial={shouldReduceMotion ? false : { opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={shouldReduceMotion ? undefined : { opacity: 0, y: -8 }}>
                        <Surface variant="card" className="p-4 sm:p-5">
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div>
                              <p className="text-xs font-semibold text-zinc-500 dark:text-zinc-400">第二步</p>
                              <h2 className="mt-1 text-base font-semibold text-zinc-900 dark:text-zinc-100">登录 GitHub</h2>
                              <p className="mt-2 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">请在 GitHub 官方页面完成登录。本站不会读取或保存你的 GitHub 账号信息。</p>
                            </div>
                            <div className="flex flex-wrap gap-2">
                              <a href="https://github.com/login" target="_blank" rel="noopener noreferrer" className="editorial-button inline-flex items-center gap-2">
                                <Github size={16} />
                                登录 GitHub
                              </a>
                              <button type="button" onClick={() => advanceApplicationStep(3)} className="editorial-button-primary">
                                我已登录
                                <ArrowRight size={16} />
                              </button>
                            </div>
                          </div>
                        </Surface>
                      </motion.div>
                    )}
                    {currentApplicationStep === 3 && (
                      <motion.div key="friend-link-step-3" initial={shouldReduceMotion ? false : { opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={shouldReduceMotion ? undefined : { opacity: 0, y: -8 }}>
                  <form noValidate onSubmit={handleCompleteApplication} className="border-t border-zinc-200 pt-5 dark:border-zinc-800">
                    <div className="mb-4">
                      <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">在线填写申请</h2>
                      <p className="mt-1 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
                        填写完成后会生成预填好的 GitHub Issue。请确认友链页已公开可访问，Action 会在提交后约 10 至 15 分钟检查反链。
                      </p>
                    </div>
                    <div className="grid gap-4 sm:grid-cols-2">
                      {(
                        [
                          ['name', '站点名称', '例如：我的博客'],
                          ['description', '站点简介', '例如：记录技术与生活'],
                          ['avatar', '头像地址', 'https://example.com/avatar.png'],
                          ['url', '站点地址', 'https://example.com'],
                          ['friendPageUrl', '友链页链接', 'https://example.com/friends'],
                          ['contact', '称呼或联系方式', '例如：@your-name'],
                        ] as const
                      ).map(([field, label, placeholder]) => (
                        <label key={field} className={field === 'description' ? 'sm:col-span-2' : ''}>
                          <span className="mb-1.5 block text-xs font-semibold text-zinc-700 dark:text-zinc-300">{label}</span>
                          <input
                            type={['url', 'avatar', 'friendPageUrl'].includes(field) ? 'url' : 'text'}
                            name={field}
                            value={applicationValues[field]}
                            onChange={(event) => handleApplicationFieldChange(field, event.target.value)}
                            placeholder={placeholder}
                            className="editorial-input"
                            required
                            autoComplete={field === 'name' ? 'organization' : field === 'url' ? 'url' : 'off'}
                            data-application-field={field}
                            aria-invalid={Boolean(applicationErrors[field])}
                            aria-describedby={applicationErrors[field] ? `${field}-error` : undefined}
                          />
                          {applicationErrors[field] && (
                            <span id={`${field}-error`} className="mt-1 block text-xs text-red-600 dark:text-red-400">
                              {applicationErrors[field]}
                            </span>
                          )}
                        </label>
                      ))}
                      <label className="sm:col-span-2">
                        <span className="mb-1.5 block text-xs font-semibold text-zinc-700 dark:text-zinc-300">文件名（纯英文）</span>
                        <input
                          type="text"
                          name="filename"
                          value={applicationFilename}
                          onChange={(event) => {
                            setApplicationFilename(event.target.value);
                            setApplicationErrors((current) => ({
                              ...current,
                              filename: undefined,
                            }));
                          }}
                          placeholder="例如：my-blog"
                          className="editorial-input"
                          required
                          autoComplete="off"
                          data-application-field="filename"
                          aria-invalid={Boolean(applicationErrors.filename)}
                          aria-describedby={applicationErrors.filename ? 'friend-filename-error' : undefined}
                        />
                        {applicationErrors.filename && (
                          <span id="friend-filename-error" className="mt-1 block text-xs text-red-600 dark:text-red-400">
                            {applicationErrors.filename}
                          </span>
                        )}
                      </label>
                      <label className="sm:col-span-2 flex min-h-11 cursor-pointer items-center gap-3 border-t border-zinc-200 py-2 text-sm leading-relaxed dark:border-zinc-800">
                        <input
                          type="checkbox"
                          name="reciprocalLinkConfirmed"
                          checked={applicationValues.reciprocalLinkConfirmed}
                          onChange={(event) => {
                            setApplicationValues((current) => ({
                              ...current,
                              reciprocalLinkConfirmed: event.target.checked,
                            }));
                            setApplicationErrors((current) => ({
                              ...current,
                              reciprocalLinkConfirmed: undefined,
                            }));
                          }}
                          className="h-4 w-4 flex-shrink-0 accent-zinc-900 dark:accent-zinc-100"
                          required
                          data-application-field="reciprocalLinkConfirmed"
                          aria-invalid={Boolean(applicationErrors.reciprocalLinkConfirmed)}
                          aria-describedby={applicationErrors.reciprocalLinkConfirmed ? 'reciprocal-link-error' : undefined}
                        />
                        <span className="text-zinc-700 dark:text-zinc-300">我已经先在自己的博客友链页加入 D-blog，并确认这个友链页可以直接访问。</span>
                      </label>
                      {applicationErrors.reciprocalLinkConfirmed && <span id="reciprocal-link-error" className="sm:col-span-2 -mt-2 text-xs text-red-600 dark:text-red-400">{applicationErrors.reciprocalLinkConfirmed}</span>}
                    </div>
                    <div className="mt-5 flex flex-col gap-2 border-t border-zinc-200 pt-4 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:border-0 sm:pt-0 dark:border-zinc-800">
                      <a href="https://github.com/login" target="_blank" rel="noopener noreferrer" className="editorial-button inline-flex items-center gap-2 px-4">
                        <Github size={16} />
                        登录 GitHub
                      </a>
                      <button type="submit" className="editorial-button-primary inline-flex w-full items-center gap-2 px-5 sm:w-auto">
                        <Github size={16} />
                        生成 GitHub Issue 草稿
                      </button>
                    </div>
                    {applicationResult && (
                      <div className="mt-4 flex flex-wrap items-center justify-end gap-3 border-t border-zinc-200 pt-4 dark:border-zinc-800">
                        <span className="text-xs text-zinc-500 dark:text-zinc-400">提交 Issue 后返回这里</span>
                        <button type="button" onClick={() => advanceApplicationStep(4)} className="editorial-button-primary inline-flex items-center gap-2">
                          我已提交
                          <ArrowRight size={16} />
                        </button>
                      </div>
                    )}
                  </form>
                      </motion.div>
                    )}
                    {currentApplicationStep === 4 && (
                      <motion.div key="friend-link-step-4" initial={shouldReduceMotion ? false : { opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
                        <Surface variant="panel" className="p-4 sm:p-5">
                          <div className="flex items-start gap-3">
                            <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-950"><Check size={16} /></span>
                            <div>
                              <p className="text-xs font-semibold text-zinc-500 dark:text-zinc-400">第四步</p>
                              <h2 className="mt-1 text-base font-semibold text-zinc-900 dark:text-zinc-100">等待 bot 审核</h2>
                              <p className="mt-2 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">Issue 提交后，Action 会先评论确认，并在提交满 10 分钟后检查友链页。通常会在约 10 至 15 分钟内完成审核，检测通过后自动添加友链。</p>
                            </div>
                          </div>
                        </Surface>
                      </motion.div>
                    )}
                  </AnimatePresence>
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
        {searchQuery && <p className="mt-3 text-sm text-zinc-600 dark:text-zinc-400">找到 {filteredFriends.length} 个匹配站点</p>}
      </div>

      {loadError && !loading && (
        <ContentStatus variant="error" title="友链加载失败" description={loadError} actionLabel="重新加载" onAction={() => setLoadAttempt((attempt) => attempt + 1)} className="mb-8" />
      )}

      <motion.div variants={containerVariants} initial="hidden" animate="visible" className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3" aria-busy={loading}>
        {!loading &&
          !loadError &&
          activeFriends.length > 0 &&
          activeFriends.map((friend, index) => (
            <FriendCard key={`${friend.url}-${index}`} friend={friend} />
          ))}

        {loading && <LoadingStatus label="正在加载友情链接" className="col-span-full" />}
        {loading &&
          Array.from({ length: 3 }).map((_, index) => (
            <motion.div
              key={`skeleton-${index}`}
              aria-hidden="true"
              variants={itemVariants}
              className="editorial-shimmer rounded-surface border border-zinc-200 bg-paper p-5 dark:border-zinc-800 dark:bg-zinc-900"
            >
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

        {!loading && !loadError && filteredFriends.length > 0 && activeFriends.length === 0 && (
          <div className="col-span-full border-y border-dashed border-red-300 py-10 text-center text-sm text-zinc-500 dark:border-red-900/50 dark:text-zinc-400">
            匹配的友链均位于下方「已失联的博客」板块中。
          </div>
        )}

        {!loading && !loadError && filteredFriends.length === 0 && (
          <div className="col-span-full border-y border-dashed border-zinc-300 py-10 text-center text-sm text-zinc-500 dark:border-zinc-700 dark:text-zinc-400">
            没有找到匹配的友链，试试更短的关键词。
          </div>
        )}
      </motion.div>

      {/* 已失联的博客：由友链可用状态检查 Action（scripts/friend-link-check.mjs）维护，
          每次运行后失联/恢复状态会随 friends/*.json 更新并在此处体现。 */}
      <div className="mb-3 border-y border-zinc-200 dark:border-zinc-800">
        <button
          type="button"
          onClick={() => setIsDeadExpanded(!isDeadExpanded)}
          className="flex w-full items-center justify-between gap-4 py-4 text-left transition-colors hover:text-zinc-700 dark:hover:text-zinc-300"
          aria-expanded={isDeadExpanded}
          aria-controls="dead-friend-link-panel"
        >
          <div className="min-w-0 flex-1">
            <span className="flex items-center gap-2 text-base font-semibold text-zinc-950 dark:text-white">
              已失联的博客
              <span
                className={`inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-xs font-bold ${
                  unavailableFriends.length > 0
                    ? 'bg-red-100 text-red-600 dark:bg-red-950/70 dark:text-red-400'
                    : 'bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400'
                }`}
              >
                {unavailableFriends.length}
              </span>
            </span>
            <p className="mt-1 text-sm leading-relaxed text-zinc-700 dark:text-zinc-300">
              以下友链暂时无法正常访问，恢复上线后将自动回到上方列表
            </p>
          </div>
          <motion.div
            animate={{ rotate: isDeadExpanded ? 180 : 0 }}
            transition={shouldReduceMotion ? { duration: 0 } : { duration: 0.22, ease: easeOut }}
            className="flex-shrink-0"
          >
            <ChevronDown size={18} className="text-zinc-500 dark:text-zinc-400" />
          </motion.div>
        </button>

        <AnimatePresence initial={false}>
          {isDeadExpanded && (
            <motion.div
              id="dead-friend-link-panel"
              key="dead-friend-link-content"
              initial={shouldReduceMotion ? false : { height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={shouldReduceMotion ? undefined : { height: 0, opacity: 0 }}
              transition={shouldReduceMotion ? { duration: 0 } : { duration: 0.28, ease: easeOut }}
              className="overflow-hidden"
            >
              <div className="border-t border-zinc-200 pb-5 pt-5 dark:border-zinc-800 sm:pb-6 sm:pt-6">
                {unavailableFriends.length > 0 ? (
                  <motion.div
                    variants={containerVariants}
                    initial="hidden"
                    animate="visible"
                    className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3"
                  >
                    {unavailableFriends.map((friend, index) => (
                      <FriendCard key={`${friend.url}-${index}`} friend={friend} unavailable />
                    ))}
                  </motion.div>
                ) : (
                  <p className="text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
                    目前没有失联的友链，所有友链均可正常访问 🎉
                  </p>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <p className="mb-12 text-sm text-zinc-500 dark:text-zinc-400">
        如果有任何疑问，请联系邮箱{' '}
        <a
          href={siteConfig.social.email}
          className="font-medium text-zinc-700 underline decoration-zinc-300 underline-offset-2 transition-colors hover:text-zinc-950 hover:decoration-zinc-500 dark:text-zinc-300 dark:decoration-zinc-700 dark:hover:text-white dark:hover:decoration-zinc-400"
        >
          {siteConfig.social.rawEmail}
        </a>
      </p>

      <SlideModal
        isOpen={isApplicationResultOpen}
        onClose={() => setIsApplicationResultOpen(false)}
        ariaLabelledby="friend-link-result-title"
        ariaDescribedby="friend-link-result-description"
        className="max-w-2xl"
      >
        {applicationResult && (
          <div>
            <div className="flex items-start justify-between gap-4 border-b border-zinc-200 px-5 py-4 dark:border-zinc-800">
              <div>
                <h2 id="friend-link-result-title" className="font-serif text-xl font-bold text-zinc-900 dark:text-zinc-100">
                  Issue 草稿已准备
                </h2>
                <p id="friend-link-result-description" className="mt-1 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
                  请先确认 GitHub 已登录，再打开草稿并在 GitHub 页面点击提交。
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsApplicationResultOpen(false)}
                className="inline-flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-icon text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-900 dark:hover:text-zinc-100 dark:focus-visible:outline-zinc-100"
                aria-label="关闭 Issue 草稿弹窗"
              >
                <X size={18} />
              </button>
            </div>
            <div className="space-y-4 overflow-y-auto px-5 py-5">
              <div className="border border-zinc-200 bg-zinc-50 p-3 text-sm leading-relaxed text-zinc-700 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-300">
                <div className="font-semibold text-zinc-900 dark:text-zinc-100">{applicationResult.filename}</div>
                <div className="mt-1">
                  GitHub Issue 标题会以 <code>[Friend Link]</code> 开头。提交后 bot 会先评论确认，并在约 10 至 15 分钟后检查你填写的友链页。
                </div>
              </div>
              <p className="text-xs leading-relaxed text-zinc-600 dark:text-zinc-400">
                检测通过后，D-blog 会自动添加友链；如果页面无法访问或找不到 D-blog 链接，Issue 会说明原因并关闭。GitHub 的评论通知可能通过站内通知或邮件送达。
              </p>
              <div className="flex flex-wrap justify-end gap-2 border-t border-zinc-200 pt-4 dark:border-zinc-800">
                <a href="https://github.com/login" target="_blank" rel="noopener noreferrer" className="editorial-button inline-flex items-center gap-2 px-4">
                  <Github size={15} />
                  登录 GitHub
                </a>
                <a href={applicationResult.issueUrl} target="_blank" rel="noopener noreferrer" className="editorial-button-primary inline-flex items-center gap-2 px-4">
                  <Github size={15} />
                  前往 GitHub 提交 Issue
                </a>
              </div>
            </div>
          </div>
        )}
      </SlideModal>
    </div>
  );
};

