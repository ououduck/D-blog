import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { Archive, Calendar, FolderTree, ArrowUpRight } from 'lucide-react';
import { getPosts } from '@/services/posts';
import { PostMetadata } from '../types';
import { Seo } from '../components/Seo';

interface ArchiveGroup {
  year: string;
  total: number;
  categories: string[];
  months: string[];
  posts: PostMetadata[];
}

const formatMonth = (dateText: string) => {
  const date = new Date(dateText);
  return `${date.getMonth() + 1}\u6708`;
};

const formatDay = (dateText: string) => {
  const date = new Date(dateText);
  return `${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
};

const formatFullDate = (dateText: string) => {
  const date = new Date(dateText);
  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  }).format(date);
};

const buildArchiveGroups = (posts: PostMetadata[]) => {
  const groups = new Map<string, ArchiveGroup>();

  posts
    .slice()
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .forEach((post) => {
      const year = String(new Date(post.date).getFullYear());
      const existing = groups.get(year);

      if (!existing) {
        groups.set(year, {
          year,
          total: 1,
          categories: [post.category],
          months: [formatMonth(post.date)],
          posts: [post]
        });
        return;
      }

      existing.total += 1;
      existing.posts.push(post);

      if (!existing.categories.includes(post.category)) {
        existing.categories.push(post.category);
      }

      const month = formatMonth(post.date);
      if (!existing.months.includes(month)) {
        existing.months.push(month);
      }
    });

  return Array.from(groups.values()).sort((a, b) => Number(b.year) - Number(a.year));
};

export const ArchivePage = () => {
  const [groups, setGroups] = useState<ArchiveGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [latestDate, setLatestDate] = useState('');

  useEffect(() => {
    getPosts().then((posts) => {
      const archiveGroups = buildArchiveGroups(posts);
      setGroups(archiveGroups);
      setLatestDate(posts[0]?.date || '');
      setLoading(false);
    });
  }, []);

  const totalPosts = groups.reduce((sum, group) => sum + group.total, 0);

  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -24 }}
      className="pb-10 md:pb-20"
    >
      <Seo
        title="\u5f52\u6863"
        description="\u6309\u5e74\u4efd\u6574\u7406\u672c\u7ad9\u5168\u90e8\u6587\u7ae0\uff0c\u5feb\u901f\u67e5\u770b\u53d1\u5e03\u65f6\u95f4\u3001\u5206\u7c7b\u4e0e\u5386\u53f2\u66f4\u65b0\u8f68\u8ff9\u3002"
      />

      <section className="relative overflow-hidden rounded-[2rem] border border-zinc-200 bg-[radial-gradient(circle_at_top_left,_rgba(192,57,43,0.12),_transparent_38%),linear-gradient(135deg,_rgba(255,255,255,0.96),_rgba(244,244,245,0.9))] p-8 md:p-12 dark:border-zinc-800 dark:bg-[radial-gradient(circle_at_top_left,_rgba(192,57,43,0.2),_transparent_40%),linear-gradient(135deg,_rgba(24,24,27,0.96),_rgba(9,9,11,0.96))]">
        <div className="absolute right-6 top-6 rounded-full border border-accent/20 bg-accent/10 p-3 text-accent">
          <Archive size={22} />
        </div>
        <div className="max-w-3xl">
          <p className="mb-4 text-xs font-bold uppercase tracking-[0.35em] text-accent">Archive Index</p>
          <h1 className="mb-6 font-serif text-4xl font-bold tracking-tight text-ink dark:text-white md:text-6xl">
            {'\u6240\u6709\u6587\u7ae0\uff0c\u6309\u5e74\u4efd\u5f52\u62e2\u3002'}
          </h1>
          <p className="max-w-2xl text-sm leading-7 text-zinc-600 dark:text-zinc-300 md:text-base">
            {'\u8fd9\u91cc\u96c6\u4e2d\u5c55\u793a\u5168\u90e8\u5386\u53f2\u5185\u5bb9\uff0c\u9002\u5408\u6309\u65f6\u95f4\u7ebf\u56de\u770b\u66f4\u65b0\u8282\u594f\uff0c\u4e5f\u65b9\u4fbf\u5feb\u901f\u8df3\u8f6c\u5230\u65e7\u6587\u7ae0\u3002'}
          </p>
        </div>

        <div className="mt-10 grid gap-4 md:grid-cols-3">
          <div className="rounded-2xl border border-white/60 bg-white/70 p-5 backdrop-blur dark:border-white/10 dark:bg-white/5">
            <div className="mb-3 flex items-center gap-2 text-zinc-500 dark:text-zinc-400">
              <Archive size={16} />
              <span className="text-xs font-bold uppercase tracking-[0.25em]">{'\u6587\u7ae0\u603b\u6570'}</span>
            </div>
            <div className="text-3xl font-bold text-ink dark:text-white">{totalPosts}</div>
          </div>
          <div className="rounded-2xl border border-white/60 bg-white/70 p-5 backdrop-blur dark:border-white/10 dark:bg-white/5">
            <div className="mb-3 flex items-center gap-2 text-zinc-500 dark:text-zinc-400">
              <Calendar size={16} />
              <span className="text-xs font-bold uppercase tracking-[0.25em]">{'\u5f52\u6863\u5e74\u4efd'}</span>
            </div>
            <div className="text-3xl font-bold text-ink dark:text-white">{groups.length}</div>
          </div>
          <div className="rounded-2xl border border-white/60 bg-white/70 p-5 backdrop-blur dark:border-white/10 dark:bg-white/5">
            <div className="mb-3 flex items-center gap-2 text-zinc-500 dark:text-zinc-400">
              <FolderTree size={16} />
              <span className="text-xs font-bold uppercase tracking-[0.25em]">{'\u6700\u8fd1\u66f4\u65b0'}</span>
            </div>
            <div className="text-lg font-bold text-ink dark:text-white">{latestDate ? formatFullDate(latestDate) : '--'}</div>
          </div>
        </div>
      </section>

      <section className="mt-10 space-y-8 md:mt-14">
        {loading ? (
          Array.from({ length: 3 }).map((_, index) => (
            <div key={index} className="h-48 animate-pulse rounded-[1.75rem] bg-zinc-100 dark:bg-zinc-900" />
          ))
        ) : (
          groups.map((group, index) => (
            <motion.div
              key={group.year}
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.45, delay: index * 0.06 }}
              className="rounded-[1.75rem] border border-zinc-200 bg-white/80 p-6 shadow-xl shadow-zinc-200/20 backdrop-blur dark:border-zinc-800 dark:bg-zinc-900/50 dark:shadow-none md:p-8"
            >
              <div className="mb-8 flex flex-col gap-6 border-b border-zinc-100 pb-6 dark:border-zinc-800 md:flex-row md:items-end md:justify-between">
                <div>
                  <div className="mb-2 text-xs font-bold uppercase tracking-[0.3em] text-accent">Year {group.year}</div>
                  <h2 className="font-serif text-3xl font-bold text-ink dark:text-white md:text-4xl">{group.year}</h2>
                </div>
                <div className="flex flex-wrap gap-2">
                  <span className="rounded-full border border-accent/20 bg-accent/5 px-3 py-1 text-xs font-bold text-accent">
                    {group.total} {'\u7bc7\u6587\u7ae0'}
                  </span>
                  {group.months.map((month) => (
                    <span
                      key={`${group.year}-${month}`}
                      className="rounded-full border border-zinc-200 px-3 py-1 text-xs font-medium text-zinc-500 dark:border-zinc-700 dark:text-zinc-400"
                    >
                      {month}
                    </span>
                  ))}
                </div>
              </div>

              <div className="grid gap-6 lg:grid-cols-[220px_minmax(0,1fr)]">
                <aside className="rounded-2xl bg-zinc-50 p-5 dark:bg-zinc-950/60">
                  <p className="mb-3 text-xs font-bold uppercase tracking-[0.25em] text-zinc-400">{'\u5206\u7c7b\u5206\u5e03'}</p>
                  <div className="flex flex-wrap gap-2">
                    {group.categories.map((category) => (
                      <span
                        key={`${group.year}-${category}`}
                        className="rounded-full border border-zinc-200 bg-white px-3 py-1 text-xs font-medium text-zinc-600 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300"
                      >
                        {category}
                      </span>
                    ))}
                  </div>
                </aside>

                <div className="space-y-4">
                  {group.posts.map((post) => (
                    <Link
                      key={post.id}
                      to={`/post/${post.id}`}
                      className="group grid gap-4 rounded-2xl border border-zinc-200 px-4 py-4 transition-all duration-300 hover:-translate-y-0.5 hover:border-accent/40 hover:shadow-xl hover:shadow-accent/5 dark:border-zinc-800 dark:hover:border-accent/30 md:grid-cols-[88px_minmax(0,1fr)_auto] md:items-center md:px-5"
                    >
                      <div className="text-sm font-bold tracking-wider text-zinc-400">{formatDay(post.date)}</div>
                      <div className="min-w-0">
                        <div className="mb-2 flex flex-wrap items-center gap-2">
                          <span className="rounded-full bg-zinc-100 px-2.5 py-1 text-[11px] font-bold text-zinc-500 dark:bg-zinc-800 dark:text-zinc-300">
                            {post.category}
                          </span>
                          <span className="text-xs text-zinc-400">{post.readTime}</span>
                        </div>
                        <h3 className="truncate font-serif text-lg font-bold text-ink transition-colors group-hover:text-accent dark:text-white">
                          {post.title}
                        </h3>
                        <p className="mt-2 line-clamp-2 text-sm leading-6 text-zinc-500 dark:text-zinc-400">
                          {post.excerpt}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 text-sm font-medium text-zinc-400 transition-colors group-hover:text-accent">
                        <span>{'\u67e5\u770b'}</span>
                        <ArrowUpRight size={16} />
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            </motion.div>
          ))
        )}
      </section>
    </motion.div>
  );
};
