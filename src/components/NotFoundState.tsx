import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Compass } from 'lucide-react';

interface NotFoundStateProps {
  title: string;
  description: string;
  backTo?: string;
  backLabel?: string;
  debugLabel?: string;
}

export const NotFoundState: React.FC<NotFoundStateProps> = React.memo(({
  title,
  description,
  backTo = '/',
  backLabel = '返回首页',
  debugLabel
}) => {
  return (
      <div className="mx-auto flex min-h-[70vh] max-w-3xl items-center px-4 py-10">
        <div className="w-full border-y border-zinc-200 py-10 dark:border-zinc-800 md:py-14">
          <div className="mb-6 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.2em] text-zinc-500 dark:text-zinc-400">
            <Compass size={14} />
            Page Missing
          </div>

          <div>
            <div className="mb-5 font-serif text-7xl font-black leading-none text-zinc-200 dark:text-zinc-800 md:text-8xl">
              404
            </div>

            <h1 className="mb-4 font-serif text-3xl font-bold text-ink dark:text-white md:text-4xl">
              {title}
            </h1>

            <p className="max-w-xl text-sm leading-7 text-zinc-700 dark:text-zinc-300 md:text-base">
              {description}
            </p>

            {debugLabel && (
              <div className="mt-6 inline-flex max-w-full items-center border-l-2 border-zinc-300 bg-zinc-50 px-4 py-3 font-mono text-xs text-zinc-600 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300">
                {debugLabel}
              </div>
            )}

            <div className="mt-8">
              <Link
                to={backTo}
                className="inline-flex items-center border border-ink bg-ink px-6 py-3 text-sm font-bold tracking-[0.12em] text-white transition-colors hover:bg-zinc-800 dark:border-white dark:bg-white dark:text-ink dark:hover:bg-zinc-200"
              >
                <ArrowLeft size={16} className="mr-2" />
                {backLabel}
              </Link>
            </div>
          </div>
        </div>
      </div>
  );
});
