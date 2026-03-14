import React, { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { List, X } from 'lucide-react';

import type { MarkdownHeading } from '@/utils/headings';

const formatIndex = (value: number) => String(value).padStart(2, '0');

export const TableOfContents: React.FC<{ headings: MarkdownHeading[] }> = ({ headings }) => {
  const [activeId, setActiveId] = useState<string>('');
  const [isOpen, setIsOpen] = useState(false);
  const itemRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  useEffect(() => {
    setActiveId('');
    setIsOpen(false);
    itemRefs.current = {};
  }, [headings]);

  useEffect(() => {
    if (headings.length === 0) {
      return;
    }

    const headingElements = headings
      .map(({ id }) => document.getElementById(id))
      .filter((element): element is HTMLElement => Boolean(element));

    if (headingElements.length === 0) {
      return;
    }

    const activationOffset = 120;
    let ticking = false;

    const updateActiveId = () => {
      const viewportBottom = window.scrollY + window.innerHeight;
      const documentHeight = document.documentElement.scrollHeight;

      if (viewportBottom >= documentHeight - 24) {
        setActiveId(headingElements[headingElements.length - 1].id);
        return;
      }

      let nextActiveId = headingElements[0].id;

      for (const heading of headingElements) {
        if (heading.getBoundingClientRect().top <= activationOffset) {
          nextActiveId = heading.id;
          continue;
        }

        break;
      }

      setActiveId(nextActiveId);
    };

    const onScroll = () => {
      if (ticking) {
        return;
      }

      ticking = true;
      window.requestAnimationFrame(() => {
        updateActiveId();
        ticking = false;
      });
    };

    updateActiveId();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);

    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
    };
  }, [headings]);

  useEffect(() => {
    if (!activeId) {
      return;
    }

    itemRefs.current[activeId]?.scrollIntoView({
      block: 'nearest',
      behavior: 'smooth'
    });
  }, [activeId]);

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

    setActiveId(id);
    setIsOpen(false);
  };

  if (headings.length === 0) {
    return null;
  }

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
              ARTICLE GUIDE
            </p>
            <h3 className="mt-1 font-serif text-[1.32rem] font-semibold text-ink dark:text-white">{'\u76ee\u5f55'}</h3>
          </div>
        </div>

        <div className="rounded-full border border-zinc-200/80 bg-white/90 px-3 py-1 font-mono text-xs text-zinc-400 shadow-sm dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-500">
          {formatIndex(headings.length)}
        </div>
      </div>

      <nav aria-label={'\u76ee\u5f55'} className="max-h-[calc(100vh-10rem)] overflow-y-auto pr-1 no-scrollbar">
        <ol className="space-y-2">
          {headings.map((item, index) => {
            const isActive = activeId === item.id;
            const isSubLevel = item.level > 1;

            return (
              <li key={item.id} style={{ marginLeft: `${(item.level - 1) * 12}px` }}>
                <button
                  ref={(element) => {
                    itemRefs.current[item.id] = element;
                  }}
                  type="button"
                  onClick={() => scrollToHeading(item.id)}
                  className={`group relative flex w-full items-start gap-3 rounded-[1.1rem] border px-3.5 py-3 text-left transition-all duration-300 ${
                    isActive
                      ? 'border-accent/20 bg-accent/[0.08] text-ink shadow-[0_16px_36px_-30px_rgba(192,57,43,0.45)] dark:bg-accent/[0.12] dark:text-white'
                      : 'border-transparent bg-transparent text-zinc-500 hover:border-zinc-200/80 hover:bg-white/80 hover:text-ink dark:text-zinc-400 dark:hover:border-zinc-700 dark:hover:bg-zinc-800/70 dark:hover:text-white'
                  }`}
                >
                  <span
                    className={`mt-1 inline-flex min-w-[2.2rem] justify-center rounded-full px-2 py-1 font-mono text-[10px] font-semibold tracking-[0.18em] transition-colors ${
                      isActive
                        ? 'bg-accent text-white'
                        : 'bg-zinc-100 text-zinc-400 group-hover:bg-accent/8 group-hover:text-accent dark:bg-zinc-800 dark:text-zinc-500'
                    }`}
                  >
                    {formatIndex(index + 1)}
                  </span>

                  <span
                    className={`block flex-1 leading-6 ${
                      isActive
                        ? 'text-[14px] font-semibold text-ink dark:text-white'
                        : isSubLevel
                          ? 'text-[13px] text-zinc-500 dark:text-zinc-400'
                          : 'text-[13.5px]'
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

      <aside className="hidden w-72 lg:block">
        {panelContent}
      </aside>
    </>
  );
};
