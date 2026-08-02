import React, { useId } from 'react';

interface DBlogLoaderProps {
  className?: string;
  label?: string;
  size?: 'page' | 'image';
}

const mergeClassName = (...values: Array<string | undefined | false>) => values.filter(Boolean).join(' ');

export const DBlogLoader: React.FC<DBlogLoaderProps> = React.memo(({
  className,
  label,
  size = 'page'
}) => {
  const gradientId = useId().replace(/:/g, '');
  const strokeId = `${gradientId}-stroke`;
  const fillId = `${gradientId}-fill`;
  const lineId = `${gradientId}-line`;
  const isImage = size === 'image';
  const widthClass = isImage ? 'w-32 sm:w-36' : 'w-44 sm:w-52';

  return (
    <div className={mergeClassName('pointer-events-none select-none text-zinc-900 dark:text-zinc-100', className)}>
      {label ? <span className="sr-only">{label}</span> : null}
      <svg
        aria-hidden="true"
        viewBox="0 0 520 180"
        className={mergeClassName('h-auto', widthClass)}
        fill="none"
      >
        <defs>
          <linearGradient id={strokeId} x1="60" y1="40" x2="460" y2="132" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="currentColor" stopOpacity="0.18">
              <animate attributeName="stop-opacity" values="0.12;0.45;0.12" dur="2.1s" repeatCount="indefinite" />
            </stop>
            <stop offset="50%" stopColor="currentColor" stopOpacity="0.95">
              <animate attributeName="stop-opacity" values="0.55;1;0.55" dur="2.1s" repeatCount="indefinite" />
            </stop>
            <stop offset="100%" stopColor="currentColor" stopOpacity="0.18">
              <animate attributeName="stop-opacity" values="0.12;0.45;0.12" dur="2.1s" repeatCount="indefinite" />
            </stop>
          </linearGradient>
          <linearGradient id={fillId} x1="130" y1="54" x2="395" y2="116" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="currentColor" stopOpacity="0.08">
              <animate attributeName="stop-opacity" values="0.06;0.14;0.06" dur="2.1s" repeatCount="indefinite" />
            </stop>
            <stop offset="100%" stopColor="currentColor" stopOpacity="0.24">
              <animate attributeName="stop-opacity" values="0.14;0.3;0.14" dur="2.1s" repeatCount="indefinite" />
            </stop>
          </linearGradient>
          <linearGradient id={lineId} x1="115" y1="0" x2="405" y2="0" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="currentColor" stopOpacity="0" />
            <stop offset="50%" stopColor="currentColor" stopOpacity="0.8">
              <animate attributeName="stop-opacity" values="0.35;0.95;0.35" dur="1.45s" repeatCount="indefinite" />
            </stop>
            <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
          </linearGradient>
        </defs>

        <text
          x="50%"
          y="50%"
          textAnchor="middle"
          dominantBaseline="middle"
          fontFamily="Playfair Display, Noto Serif SC, Songti SC, SimSun, serif"
          fontSize={isImage ? 54 : 76}
          fontWeight="700"
          letterSpacing="-0.06em"
          fill={`url(#${fillId})`}
          opacity="0.9"
        >
          D-blog
        </text>
        <text
          x="50%"
          y="50%"
          textAnchor="middle"
          dominantBaseline="middle"
          fontFamily="Playfair Display, Noto Serif SC, Songti SC, SimSun, serif"
          fontSize={isImage ? 54 : 76}
          fontWeight="700"
          letterSpacing="-0.06em"
          stroke={`url(#${strokeId})`}
          strokeWidth={isImage ? 1.8 : 2.2}
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeDasharray="680"
          strokeDashoffset="680"
        >
          D-blog
          <animate attributeName="stroke-dashoffset" values="680;0;0" dur="1.9s" repeatCount="indefinite" />
          <animate attributeName="opacity" values="0.38;1;0.65;0.38" dur="1.9s" repeatCount="indefinite" />
        </text>

        <rect x="115" y="130" width="290" height="3" rx="999" fill="currentColor" opacity="0.12" />
        <rect x="115" y="130" width="100" height="3" rx="999" fill={`url(#${lineId})`}>
          <animate attributeName="x" values="115;305;115" dur="1.45s" repeatCount="indefinite" />
          <animate attributeName="width" values="72;122;72" dur="1.45s" repeatCount="indefinite" />
        </rect>
      </svg>
    </div>
  );
});
