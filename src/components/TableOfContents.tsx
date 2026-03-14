import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { List, X } from 'lucide-react';

interface TocItem {
  id: string;
  text: string;
  level: number;
}

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
      const text = heading.replace(/^#+\s+/, '');
      const id = text
        .toLowerCase()
        .replace(/[^\w\u4e00-\u9fa5]+/g, '-')
        .replace(/^-+|-+$/g, '');

      return { id, text, level };
    });

    setToc(tocItems);
    setActiveId('');
  }, [content]);

  useEffect(() => {
    if (toc.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setActiveId(entry.target.id);
          }
        });
      },
      { rootMargin: '-80px 0px -80% 0px' }
    );

    toc.forEach(({ id }) => {
      const element = document.getElementById(id);
      if (element) observer.observe(element);
    });

    return () => observer.disconnect();
  }, [toc]);

  const scrollToHeading = (id: string) => {
    const element = document.getElementById(id);
    if (element) {
      const offset = 100;
      const elementPosition = element.getBoundingClientRect().top;
      const offsetPosition = elementPosition + window.pageYOffset - offset;

      window.scrollTo({
        top: offsetPosition,
        behavior: 'smooth'
      });
      setIsOpen(false);
    }
  };

  if (toc.length === 0) return null;

  return (
    <>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="fixed bottom-6 right-6 z-40 rounded-full border-2 border-accent bg-white p-4 text-accent shadow-2xl transition-all hover:scale-110 dark:bg-zinc-900 md:hidden"
        aria-label="目录"
      >
        {isOpen ? <X size={20} /> : <List size={20} />}
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-30 bg-black/50 backdrop-blur-sm md:hidden"
            onClick={() => setIsOpen(false)}
          />
        )}
      </AnimatePresence>

      <motion.aside
        initial={false}
        animate={{ x: isOpen ? 0 : '100%' }}
        className="fixed right-0 top-0 z-40 h-full w-80 overflow-y-auto border-l border-zinc-200 bg-white/95 p-6 pt-24 backdrop-blur dark:border-zinc-800 dark:bg-zinc-900/95 md:sticky md:top-24 md:z-10 md:h-[calc(100vh-8rem)] md:w-64 md:translate-x-0 md:border-none md:bg-transparent md:p-0 md:pt-0"
      >
        <div className="rounded-2xl border border-zinc-200 bg-white/80 p-6 backdrop-blur dark:border-zinc-800 dark:bg-zinc-900/50">
          <h3 className="mb-4 flex items-center gap-2 font-serif text-lg font-bold text-ink dark:text-white">
            <List size={18} />
            目录
          </h3>
          <nav>
            <ul className="space-y-2">
              {toc.map((item) => (
                <li key={item.id} style={{ paddingLeft: `${(item.level - 1) * 12}px` }}>
                  <button
                    onClick={() => scrollToHeading(item.id)}
                    className={`block w-full text-left text-sm transition-colors ${
                      activeId === item.id
                        ? 'font-bold text-accent'
                        : 'text-zinc-600 hover:text-accent dark:text-zinc-400 dark:hover:text-accent'
                    }`}
                  >
                    {item.text}
                  </button>
                </li>
              ))}
            </ul>
          </nav>
        </div>
      </motion.aside>
    </>
  );
};
