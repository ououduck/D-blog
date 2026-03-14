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

  const panelContent = (
    <div className="relative overflow-hidden rounded-[28px] border border-zinc-200/80 bg-white/88 p-5 shadow-[0_22px_60px_rgba(28,25,23,0.08)] backdrop-blur-xl dark:border-zinc-800/80 dark:bg-zinc-900/72 dark:shadow-none">
      <div className="pointer-events-none absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-accent/50 to-transparent" />

      <div className="mb-5 flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-2xl border border-zinc-200/80 bg-zinc-50 text-zinc-600 dark:border-zinc-700 dark:bg-zinc-800/80 dark:text-zinc-200">
            <List size={18} />
          </span>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-zinc-400 dark:text-zinc-500">
              QUICK GUIDE
            </p>
            <h3 className="mt-1 font-serif text-[1.35rem] font-semibold text-ink dark:text-white">
              {'\u76ee\u5f55'}
            </h3>
          </div>
        </div>

        <div className="rounded-full border border-zinc-200/80 bg-white/90 px-3 py-1 font-mono text-xs text-zinc-400 shadow-sm dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-500">
          {formatIndex(toc.length)}
        </div>
      </div>

      {activeItem && (
        <div className="mb-4 rounded-2xl border border-sky-400/20 bg-sky-500/[0.08] px-3 py-2.5 text-xs text-sky-900 shadow-[0_12px_30px_rgba(14,165,233,0.12)] dark:bg-sky-400/[0.12] dark:text-sky-100">
          <span className="mr-2 inline-flex rounded-full bg-sky-500 px-2 py-0.5 font-mono text-[10px] font-semibold tracking-[0.18em] text-white shadow-[0_8px_18px_rgba(14,165,233,0.35)]">
            {formatIndex(activeIndex + 1)}
          </span>
          <span>{activeItem.text}</span>
        </div>
      )}

      <nav aria-label={'\u76ee\u5f55'} className="max-h-[calc(100vh-12rem)] overflow-y-auto pr-1 no-scrollbar">
        <ol className="space-y-1.5">
          {toc.map((item, index) => {
            const isActive = activeId === item.id;

            return (
              <li key={item.id} style={{ paddingLeft: `${(item.level - 1) * 10}px` }}>
                <button
                  onClick={() => scrollToHeading(item.id)}
                  className={`group relative w-full rounded-2xl px-4 py-3 text-left transition-all duration-300 ${
                    isActive
                      ? 'scale-[1.035] bg-sky-500/[0.10] text-sky-950 shadow-[0_18px_36px_rgba(14,165,233,0.18)] ring-1 ring-sky-400/30 dark:bg-sky-400/[0.14] dark:text-sky-50'
                      : 'text-zinc-500 hover:bg-zinc-50 hover:text-ink dark:text-zinc-400 dark:hover:bg-zinc-800/80 dark:hover:text-white'
                  }`}
                >
                  <span
                    className={`absolute left-0 top-3 h-8 w-[3px] rounded-full transition-opacity duration-300 ${
                      isActive ? 'bg-sky-500 opacity-100 shadow-[0_0_18px_rgba(14,165,233,0.55)]' : 'bg-sky-400/70 opacity-0 group-hover:opacity-100'
                    }`}
                  />
                  <span
                    className={`mb-1 block text-[10px] font-semibold uppercase tracking-[0.24em] ${
                      isActive ? 'text-sky-600 dark:text-sky-300' : 'text-zinc-400 dark:text-zinc-500'
                    }`}
                  >
                    {formatIndex(index + 1)}
                  </span>
                  <span
                    className={`block text-sm leading-6 ${
                      isActive
                        ? 'text-[15px] font-semibold text-sky-900 dark:text-sky-50'
                        : item.level > 1
                          ? 'text-[13px] text-zinc-500 dark:text-zinc-400'
                          : ''
                    }`}
                  >
                    {item.text}
                  </span>
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
