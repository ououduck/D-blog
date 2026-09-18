/**
 * 命令面板（Ctrl/Cmd + K）：搜索文章（复用 usePostSearch 同一评分体系）、
 * 最近文章/最近搜索、快速导航与常用操作。懒加载 chunk，不进首屏包。
 * 焦点管理（初始聚焦/焦点还原/Esc）由 SlideModal + useModalOverlay 统一处理。
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  BookOpen,
  Clock,
  Droplets,
  FileSearch,
  Github,
  Home,
  ImagePlus,
  Moon,
  Rss,
  Search,
  Tags,
  Users,
} from 'lucide-react';
import { SlideModal } from './SlideModal';
import { usePostSearch } from '@/hooks/usePostSearch';
import { getInitialPosts } from '@/services/posts';
import { getReadingHistory } from '@/services/readingHistory';
import { siteConfig } from '@config/site.config';
import { routeUrl } from '@/utils/siteUrl';
import { readRecentSearches, RECENT_SEARCH_EVENT, recordRecentSearch } from '@/utils/recentSearches';

const SEARCH_RESULT_LIMIT = 8;
const THEME_TOGGLE_EVENT = 'dblog:toggle-theme';

interface PaletteCommand {
  id: string;
  label: string;
  icon: React.ReactNode;
  hint?: string;
  run: () => void;
  href?: string;
  external?: boolean;
}

interface CommandSection {
  id: string;
  title: string;
  commands: PaletteCommand[];
}

export const CommandPalette: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);
  const [query, setQuery] = useState('');
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const [recentPostIds, setRecentPostIds] = useState<string[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const { results, isSearching, searchError, handleSearch } = usePostSearch({ scope: 'all' });

  const runCommand = useCallback(
    (command: PaletteCommand) => {
      onClose();
      command.run();
    },
    [onClose],
  );

  // 最近搜索 / 最近文章：仅在客户端挂载后读取（存储与历史都是客户端状态）。
  useEffect(() => {
    setRecentSearches(readRecentSearches());
    const syncRecentSearches = () => setRecentSearches(readRecentSearches());
    window.addEventListener(RECENT_SEARCH_EVENT, syncRecentSearches);
    return () => window.removeEventListener(RECENT_SEARCH_EVENT, syncRecentSearches);
  }, []);

  useEffect(() => {
    const history = getReadingHistory().slice(0, 3);
    setRecentPostIds(
      history.map((entry) => entry.postId).filter((postId) => getInitialPosts().some((post) => post.id === postId)),
    );
  }, []);

  const closeAndNavigate = useCallback(
    (to: string) => {
      onClose();
      navigate(to);
    },
    [navigate, onClose],
  );

  const searchResults = results.slice(0, SEARCH_RESULT_LIMIT);

  const sections = useMemo<CommandSection[]>(() => {
    const quickCommands: PaletteCommand[] = [
      { id: 'nav-home', label: '首页', icon: <Home size={15} />, run: () => closeAndNavigate('/') },
      { id: 'nav-archive', label: '归档', icon: <Clock size={15} />, run: () => closeAndNavigate('/archive') },
      { id: 'nav-tags', label: '标签', icon: <Tags size={15} />, run: () => closeAndNavigate('/tags') },
      { id: 'nav-shuoshuo', label: '说说', icon: <BookOpen size={15} />, run: () => closeAndNavigate('/shuoshuo') },
      { id: 'nav-about', label: '关于', icon: <Users size={15} />, run: () => closeAndNavigate('/about') },
    ];

    const actionCommands: PaletteCommand[] = [
      {
        id: 'action-theme',
        label: '切换深浅色模式',
        icon: <Moon size={15} />,
        run: () => window.dispatchEvent(new CustomEvent(THEME_TOGGLE_EVENT)),
      },
      {
        id: 'action-top',
        label: '回到顶部',
        icon: <ArrowRight size={15} className="-rotate-90" />,
        run: () => window.scrollTo({ top: 0, behavior: 'smooth' }),
      },
      {
        id: 'action-search-page',
        label: '打开搜索页',
        icon: <FileSearch size={15} />,
        run: () => closeAndNavigate('/search'),
      },
      {
        id: 'action-rss',
        label: 'RSS 订阅',
        icon: <Rss size={15} />,
        href: routeUrl('/feed.xml'),
        external: true,
        run: () => {},
      },
      {
        id: 'action-github',
        label: 'GitHub 仓库',
        icon: <Github size={15} />,
        href: siteConfig.social.github,
        external: true,
        run: () => {},
      },
      { id: 'action-cover', label: '封面生成器', icon: <ImagePlus size={15} />, run: () => closeAndNavigate('/cover') },
      {
        id: 'action-watermark',
        label: '水印工具',
        icon: <Droplets size={15} />,
        run: () => closeAndNavigate('/watermark'),
      },
    ];

    const allSections: CommandSection[] = [];

    if (query.trim()) {
      allSections.push({
        id: 'search',
        title: '搜索结果',
        commands: searchResults.map((post) => ({
          id: `post-${post.id}`,
          label: post.title,
          icon: <Search size={15} className="opacity-50" />,
          hint: `${post.category} · ${post.date}`,
          run: () => {
            recordRecentSearch(query);
            closeAndNavigate(`/post/${post.id}`);
          },
        })),
      });
    } else {
      const recentCommands = (
        recentPostIds.length > 0
          ? recentPostIds
          : getInitialPosts()
              .slice()
              .sort((a, b) => Date.parse(b.updatedAt || b.date) - Date.parse(a.updatedAt || a.date))
              .slice(0, 3)
              .map((post) => post.id)
      )
        .slice(0, 3)
        .map((postId) => {
          const post = getInitialPosts().find((candidate) => candidate.id === postId);
          return post
            ? {
                id: `recent-${post.id}`,
                label: post.title,
                icon: <Clock size={15} className="opacity-50" />,
                hint: post.date,
                run: () => closeAndNavigate(`/post/${post.id}`),
              }
            : null;
        })
        .filter((command): command is NonNullable<typeof command> => command !== null);
      if (recentCommands.length > 0) {
        allSections.push({
          id: 'recent',
          title: recentPostIds.length > 0 ? '最近阅读' : '最近文章',
          commands: recentCommands,
        });
      }

      if (recentSearches.length > 0) {
        allSections.push({
          id: 'recent-searches',
          title: '最近搜索',
          commands: recentSearches.map((entry) => ({
            id: `recent-search-${entry}`,
            label: entry,
            icon: <Search size={15} className="opacity-50" />,
            run: () => {
              setQuery(entry);
              handleSearch(entry);
            },
          })),
        });
      }

      allSections.push({ id: 'quick', title: '快速操作', commands: quickCommands });
    }

    allSections.push({ id: 'actions', title: '操作', commands: actionCommands });
    return allSections;
  }, [query, searchResults, recentPostIds, recentSearches, closeAndNavigate, handleSearch]);

  const flatCommands = useMemo(() => sections.flatMap((section) => section.commands), [sections]);

  // 活跃项：显式选中项存在且仍在列表中时用它，否则回退到第一项。
  // 不用 effect 重置——结果数组每次渲染都是新引用，effect 会覆盖键盘导航。
  const activeId =
    selectedId && flatCommands.some((command) => command.id === selectedId)
      ? selectedId
      : (flatCommands[0]?.id ?? null);

  // 选中项滚动进可视区（键盘导航时跟随）。
  useEffect(() => {
    if (!selectedId || !listRef.current) {
      return;
    }
    const selectedElement = listRef.current.querySelector(`[data-command-id="${CSS.escape(selectedId)}"]`);
    selectedElement?.scrollIntoView({ block: 'nearest' });
  }, [selectedId]);

  const handleInputKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    // 输入法组合期间（选字/确认候选）不处理导航与提交，避免误触发命令。
    if (event.nativeEvent.isComposing) {
      return;
    }
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      if (flatCommands.length === 0) {
        return;
      }
      const currentIndex = flatCommands.findIndex((command) => command.id === activeId);
      const nextIndex =
        event.key === 'ArrowDown'
          ? (currentIndex + 1 + flatCommands.length) % flatCommands.length
          : (currentIndex - 1 + flatCommands.length) % flatCommands.length;
      setSelectedId(flatCommands[nextIndex].id);
      return;
    }
    if (event.key === 'Enter') {
      event.preventDefault();
      const selected = flatCommands.find((command) => command.id === activeId);
      if (selected) {
        runCommand(selected);
      }
    }
  };

  const executeCommand = (command: PaletteCommand) => {
    if (command.href && command.external) {
      // 外链（RSS/GitHub）：新标签打开，不关闭面板前的导航语义。
      window.open(command.href, '_blank', 'noopener,noreferrer');
      onClose();
      return;
    }
    runCommand(command);
  };

  const hasQuery = query.trim().length > 0;

  return (
    <SlideModal isOpen onClose={onClose} initialFocusRef={inputRef} ariaLabelledby="command-palette-title">
      <div className="flex items-center justify-between border-b border-zinc-200 px-4 py-3 dark:border-zinc-800">
        <h3 id="command-palette-title" className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
          命令面板
        </h3>
        <button
          type="button"
          onClick={onClose}
          className="inline-flex h-11 w-11 items-center justify-center rounded-icon text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-900 active:scale-[0.98] dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
          aria-label="关闭命令面板"
        >
          <span aria-hidden="true" className="font-mono text-[11px]">
            Esc
          </span>
        </button>
      </div>

      <div className="border-b border-zinc-200 px-4 py-3 dark:border-zinc-800">
        {/* combobox 模式：输入框控制下方 listbox，方向键移动 aria-activedescendant。 */}
        <input
          ref={inputRef}
          type="text"
          role="combobox"
          aria-expanded="true"
          aria-controls="command-palette-listbox"
          aria-activedescendant={activeId ? `cmd-${activeId}` : undefined}
          aria-label="搜索文章或执行命令"
          aria-autocomplete="list"
          autoComplete="off"
          spellCheck={false}
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            handleSearch(event.target.value);
          }}
          onKeyDown={handleInputKeyDown}
          placeholder="搜索文章，或输入命令…"
          className="editorial-input !py-2.5"
        />
      </div>

      <div
        ref={listRef}
        id="command-palette-listbox"
        role="listbox"
        aria-label="命令列表"
        className="max-h-[min(24rem,55vh)] min-h-[6rem] overflow-y-auto overscroll-contain p-2"
      >
        {flatCommands.length === 0 ? (
          <p className="px-3 py-8 text-center text-sm text-zinc-500 dark:text-zinc-400" role="status">
            {searchError ?? (isSearching ? '搜索中…' : hasQuery ? '没有匹配的结果' : '暂无可用命令')}
          </p>
        ) : (
          sections.map((section) =>
            section.commands.length > 0 ? (
              <div key={section.id} role="presentation" className="mb-2 last:mb-0">
                <p
                  role="presentation"
                  className="px-3 pb-1 pt-2 text-[10px] font-bold uppercase tracking-[0.18em] text-zinc-400 dark:text-zinc-500"
                >
                  {section.title}
                </p>
                {section.commands.map((command) => {
                  const isSelected = command.id === activeId;
                  return (
                    <button
                      key={command.id}
                      type="button"
                      data-command-id={command.id}
                      id={`cmd-${command.id}`}
                      role="option"
                      aria-selected={isSelected}
                      onClick={() => executeCommand(command)}
                      onMouseEnter={() => setSelectedId(command.id)}
                      className={`flex w-full items-center gap-3 rounded-control px-3 py-2.5 text-left text-sm transition-colors ${
                        isSelected
                          ? 'bg-zinc-100 text-zinc-900 dark:bg-zinc-800 dark:text-zinc-100'
                          : 'text-zinc-600 dark:text-zinc-400'
                      }`}
                    >
                      <span className="shrink-0 text-zinc-400 dark:text-zinc-500" aria-hidden="true">
                        {command.icon}
                      </span>
                      <span className="min-w-0 flex-1 truncate font-medium">{command.label}</span>
                      {command.hint && (
                        <span className="shrink-0 text-xs tabular-nums text-zinc-400 dark:text-zinc-500">
                          {command.hint}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            ) : null,
          )
        )}
      </div>

      <div className="flex items-center justify-between border-t border-zinc-200 px-4 py-2 text-[11px] text-zinc-400 dark:border-zinc-800 dark:text-zinc-500">
        <span>
          <kbd className="kbd">↑</kbd> <kbd className="kbd">↓</kbd> 选择 · <kbd className="kbd">Enter</kbd> 执行 ·{' '}
          <kbd className="kbd">Esc</kbd> 关闭
        </span>
        <span>{siteConfig.title}</span>
      </div>
    </SlideModal>
  );
};
