import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Compass } from 'lucide-react';
import { Seo } from './Seo';

interface NotFoundStateProps {
  title: string;
  description: string;
  seoTitle?: string;
  backTo?: string;
  backLabel?: string;
  debugLabel?: string;
}

export const NotFoundState: React.FC<NotFoundStateProps> = ({
  title,
  description,
  seoTitle = '404 Not Found',
  backTo = '/',
  backLabel = '返回首页',
  debugLabel
}) => {
  return (
    <>
      <Seo title={seoTitle} description={description} />
      <div className="mx-auto flex min-h-[70vh] max-w-3xl items-center justify-center px-4 py-10">
        <div className="relative w-full overflow-hidden rounded-[2rem] border border-zinc-200/80 bg-white/75 p-8 shadow-[0_24px_80px_-36px_rgba(24,24,27,0.28)] backdrop-blur-xl dark:border-zinc-800 dark:bg-zinc-950/70 md:p-12">
          <div className="pointer-events-none absolute inset-0">
            <div className="absolute left-[-8%] top-[-12%] h-40 w-40 rounded-full bg-accent/12 blur-3xl dark:bg-accent/18" />
            <div className="absolute bottom-[-18%] right-[-6%] h-48 w-48 rounded-full bg-zinc-200/70 blur-3xl dark:bg-zinc-800/60" />
          </div>

          <div className="relative">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-accent/20 bg-accent/10 px-4 py-2 text-[11px] font-bold uppercase tracking-[0.28em] text-accent">
              <Compass size={14} />
              Page Missing
            </div>

            <div className="mb-5 font-serif text-7xl font-bold leading-none text-zinc-200 dark:text-zinc-800 md:text-8xl">
              404
            </div>

            <h1 className="mb-4 font-serif text-3xl font-bold text-ink dark:text-white md:text-4xl">
              {title}
            </h1>

            <p className="max-w-xl text-sm leading-7 text-zinc-600 dark:text-zinc-400 md:text-base">
              {description}
            </p>

            {debugLabel && (
              <div className="mt-6 inline-flex max-w-full items-center rounded-2xl border border-zinc-200/80 bg-zinc-50/85 px-4 py-3 font-mono text-xs text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900/80 dark:text-zinc-400">
                {debugLabel}
              </div>
            )}

            <div className="mt-8">
              <Link
                to={backTo}
                className="inline-flex items-center rounded-full bg-ink px-6 py-3 text-sm font-bold tracking-[0.2em] text-white transition-transform hover:scale-[1.02] dark:bg-white dark:text-ink"
              >
                <ArrowLeft size={16} className="mr-2" />
                {backLabel}
              </Link>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};
