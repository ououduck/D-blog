import React, { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { List, X } from 'lucide-react';

import { slugifyHeading, stripInlineMarkdown } from '@/utils/headings';

interface TocItem {
  id: string;
  text: string;
  level: number;
}

const formatIndex = (value: number) => String(value).padStart(2, '0');
const stripEmojiFromTocText = (value: string) =>
  value
    .replace(/[\p{Extended_Pictographic}\p{Emoji_Modifier}\uFE0F\u200D\u20E3]/gu, '')
    .replace(/\s{2,}/g, ' ')
    .trim();

export const TableOfContents: React.FC<{ content: string }> = ({ content }) => {
  const [toc, setToc] = useState<TocItem[]>([]);
  const [activeId, setActiveId] = useState<string>('');
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    const headings = content.match(/^#{1,3}\s+.+$/gm);

    if (!headings) {
      setToc([]);
      setActiveId('');
      setIsOpen(false);
      return;
    }

    const tocItems = headings.map((heading) => {
      const level = heading.match(/^#+/)?.[0].length || 1;
      const rawText = stripInlineMarkdown(heading.replace(/^#+\s+/, ''));
      const text = stripEmojiFromTocText(rawText) || rawText;
      const id = slugifyHeading(text);

      return { id, text, level };
    });

    setToc(tocItems);
    setActiveId('');
  }, [content]);

  useEffect(() => {
    if (toc.length === 0) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const visibleEntries = entries.filter((entry) => entry.isIntersecting);

        if (visibleEntries.length === 0) {
          return;
        }

        const closestEntry = visibleEntries.sort(
          (entryA, entryB) => Math.abs(entryA.boundingClientRect.top) - Math.abs(entryB.boundingClientRect.top)
        )[0];

        setActiveId(closestEntry.target.id);
      },
      { rootMargin: '-96px 0px -65% 0px', threshold: [0, 0.25, 0.5, 1] }
    );

    toc.forEach(({ id }) => {
      const element = document.getElementById(id);
      if (element) {
        observer.observe(element);
      }
    });

    return () => observer.disconnect();
  }, [toc]);

  const scrollToHeading = (id: string) => {
    const element = document.getElementById(id);

    if (!element) {
      return;
    }

    const offset = 100;
    const offsetPosition = element.getBoundingClientRect().top + window.pageYOffset - offset;

    window.scrollTo({
      top: offsetPosition,
      behavior: 'smooth'
    });

    setIsOpen(false);
  };

  if (toc.length === 0) {
    return null;
  }

  const activeIndex = toc.findIndex((item) => item.id === activeId);
  const activeItem = activeIndex >= 0 ? toc[activeIndex] : null;
  const progressValue = activeIndex >= 0 ? ((activeIndex + 1) / toc.length) * 100 : 0;

  const panelContent = (
    <div className="relative overflow-hidden rounded-[30px] border border-zinc-200/80 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(246,244,241,0.94))] p-5 shadow-[0_24px_64px_-36px_rgba(24,24,27,0.26)] dark:border-zinc-800/80 dark:bg-[linear-gradient(180deg,rgba(24,24,27,0.94),rgba(12,12,14,0.9))] dark:shadow-none">
      <div className="pointer-events-none absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-accent/60 to-transparent" />
      <div className="pointer-events-none absolute right-[-3.5rem] top-[-3.5rem] h-28 w-28 rounded-full bg-accent/8 blur-3xl dark:bg-accent/12" />

      <div className="mb-4 flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-[1.15rem] border border-accent/10 bg-accent/[0.06] text-accent dark:border-accent/15 dark:bg-accent/[0.08]">
            <List size={18} />
          </span>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.32em] text-zinc-400 dark:text-zinc-500">
              ON THIS PAGE
            </p>
            <h3 className="mt-1 font-serif text-[1.32rem] font-semibold text-ink dark:text-white">{'\u76ee\u5f55'}</h3>
          </div>
        </div>

        <div className="rounded-full border border-zinc-200/80 bg-white/90 px-3 py-1 font-mono text-xs text-zinc-400 shadow-sm dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-500">
          {activeIndex >= 0 ? `${formatIndex(activeIndex + 1)} / ${formatIndex(toc.length)}` : formatIndex(toc.length)}
        </div>
      </div>

      <div className="mb-5">
        <div className="mb-2 flex items-center justify-between text-[11px] font-medium tracking-[0.18em] text-zinc-400 uppercase dark:text-zinc-500">
          <span>阅读位置</span>
          <span>{activeIndex >= 0 ? `${Math.round(progressValue)}%` : '0%'}</span>
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-zinc-200/80 dark:bg-zinc-800/90">
          <motion.div
            initial={false}
            animate={{ width: `${progressValue}%` }}
            transition={{ duration: 0.28, ease: 'easeOut' }}
            className="h-full rounded-full bg-gradient-to-r from-accent-light via-accent to-accent-dark"
          />
        </div>
      </div>

      {activeItem && (
        <div className="mb-5 rounded-[1.35rem] border border-accent/12 bg-accent/[0.05] px-4 py-3 text-xs text-zinc-600 shadow-[0_16px_36px_-30px_rgba(192,57,43,0.42)] dark:border-accent/14 dark:bg-accent/[0.08] dark:text-zinc-200">
          <div className="mb-1.5 flex items-center gap-2">
            <span className="inline-flex rounded-full bg-accent px-2 py-0.5 font-mono text-[10px] font-semibold tracking-[0.18em] text-white">
              {formatIndex(activeIndex + 1)}
            </span>
            <span className="text-[10px] font-semibold uppercase tracking-[0.24em] text-accent/80">当前章节</span>
          </div>
          <p className="line-clamp-2 text-[13px] leading-6 text-ink dark:text-white">{activeItem.text}</p>
        </div>
      )}

      <nav aria-label={'\u76ee\u5f55'} className="relative max-h-[calc(100vh-12rem)] overflow-y-auto pr-1 no-scrollbar">
        <div className="pointer-events-none absolute bottom-4 left-[14px] top-1 w-px bg-gradient-to-b from-zinc-200 via-zinc-200/70 to-transparent dark:from-zinc-700 dark:via-zinc-700/70" />
        <ol className="space-y-1.5">
          {toc.map((item, index) => {
            const isActive = activeId === item.id;
            const isSubLevel = item.level > 1;

            return (
              <li key={item.id} style={{ paddingLeft: `${(item.level - 1) * 12}px` }}>
                <button
                  onClick={() => scrollToHeading(item.id)}
                  className={`group relative w-full rounded-[1.15rem] px-4 py-3 text-left transition-all duration-300 ${
                    isActive
                      ? 'translate-x-1 bg-accent/[0.08] text-ink shadow-[0_16px_36px_-30px_rgba(192,57,43,0.5)] ring-1 ring-accent/15 dark:bg-accent/[0.12] dark:text-white'
                      : 'text-zinc-500 hover:bg-white/80 hover:text-ink dark:text-zinc-400 dark:hover:bg-zinc-800/70 dark:hover:text-white'
                  }`}
                >
                  <span
                    className={`absolute left-[11px] top-1/2 h-2.5 w-2.5 -translate-y-1/2 rounded-full border transition-all duration-300 ${
                      isActive
                        ? 'border-accent bg-accent shadow-[0_0_0_5px_rgba(192,57,43,0.12)]'
                        : 'border-zinc-300 bg-white group-hover:border-accent/60 dark:border-zinc-600 dark:bg-zinc-900'
                    }`}
                  />
                  <div className="pl-6">
                    <div className="mb-1 flex items-center gap-2">
                      <span
                        className={`font-mono text-[10px] font-semibold tracking-[0.22em] ${
                          isActive ? 'text-accent' : 'text-zinc-400 dark:text-zinc-500'
                        }`}
                      >
                        {formatIndex(index + 1)}
                      </span>
                      {isSubLevel && (
                        <span className="rounded-full bg-zinc-100 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-[0.18em] text-zinc-400 dark:bg-zinc-800 dark:text-zinc-500">
                          H{item.level}
                        </span>
                      )}
                    </div>
                    <span
                      className={`block leading-6 ${
                        isActive
                          ? 'text-[14px] font-semibold text-ink dark:text-white'
                          : isSubLevel
                            ? 'text-[13px] text-zinc-500 dark:text-zinc-400'
                            : 'text-[13.5px]'
                      }`}
                    >
                      {item.text}
                    </span>
                  </div>
                </button>
              </li>
            );
          })}
        </ol>
      </nav>
    </div>
  );

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen((value) => !value)}
        className="fixed bottom-6 right-6 z-40 flex h-12 w-12 items-center justify-center rounded-full border border-accent/15 bg-white/92 text-ink shadow-[0_18px_44px_rgba(28,25,23,0.16)] backdrop-blur-xl transition-all duration-300 hover:scale-105 hover:border-accent/30 hover:text-accent dark:border-zinc-700 dark:bg-zinc-900/92 dark:text-zinc-100 lg:hidden"
        aria-label={isOpen ? '\u5173\u95ed\u76ee\u5f55' : '\u6253\u5f00\u76ee\u5f55'}
      >
        {isOpen ? <X size={18} /> : <List size={18} />}
      </button>

      <AnimatePresence>
        {isOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-30 bg-black/40 backdrop-blur-sm lg:hidden"
              onClick={() => setIsOpen(false)}
            />

            <motion.aside
              initial={{ opacity: 0, x: 24 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 24 }}
              transition={{ duration: 0.24, ease: 'easeOut' }}
              className="fixed inset-y-4 right-4 z-40 w-[min(20rem,calc(100vw-2rem))] lg:hidden"
            >
              {panelContent}
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      <aside className="hidden w-72 lg:block lg:self-start lg:sticky lg:top-24">
        {panelContent}
      </aside>
    </>
  );
};
