import React, { useId } from 'react';

interface DBlogLoaderProps {
  className?: string;
  label?: string;
  size?: 'page' | 'image';
}

const mergeClassName = (...values: Array<string | undefined | false>) => values.filter(Boolean).join(' ');

export const DBlogLoader: React.FC<DBlogLoaderProps> = ({
  className,
  label,
  size = 'page'
}) => {
  const gradientId = useId().replace(/:/g, '');
  const strokeId = `${gradientId}-stroke`;
  const fillId = `${gradientId}-fill`;
  const lineId = `${gradientId}-line`;
  const isImage = size === 'image';

  return (
    <div className={mergeClassName('pointer-events-none select-none', className)}>
      {label ? <span className="sr-only">{label}</span> : null}
      <svg
        aria-hidden="true"
        viewBox="0 0 520 180"
        className={mergeClassName('h-auto', isImage ? 'w-28 sm:w-32' : 'w-56 sm:w-72')}
        fill="none"
      >
        <defs>
          <linearGradient id={strokeId} x1="60" y1="40" x2="460" y2="132" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="rgba(255,255,255,0.6)">
              <animate attributeName="stop-color" values="rgba(255,255,255,0.35); rgba(255,255,255,0.9); rgba(255,255,255,0.35)" dur="2.2s" repeatCount="indefinite" />
            </stop>
            <stop offset="45%" stopColor="#e74c3c">
              <animate attributeName="stop-color" values="#c0392b; #f97316; #c0392b" dur="2.2s" repeatCount="indefinite" />
            </stop>
            <stop offset="100%" stopColor="rgba(255,255,255,0.55)">
              <animate attributeName="stop-color" values="rgba(255,255,255,0.3); rgba(255,255,255,0.85); rgba(255,255,255,0.3)" dur="2.2s" repeatCount="indefinite" />
            </stop>
          </linearGradient>
          <linearGradient id={fillId} x1="130" y1="54" x2="395" y2="116" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="rgba(255,255,255,0.12)" />
            <stop offset="50%" stopColor="rgba(255,255,255,0.24)" />
            <stop offset="100%" stopColor="rgba(192,57,43,0.2)" />
          </linearGradient>
          <linearGradient id={lineId} x1="115" y1="0" x2="405" y2="0" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="rgba(255,255,255,0)" />
            <stop offset="50%" stopColor="#e74c3c" />
            <stop offset="100%" stopColor="rgba(255,255,255,0)" />
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
          strokeWidth={isImage ? 1.9 : 2.4}
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeDasharray="680"
          strokeDashoffset="680"
        >
          D-blog
          <animate attributeName="stroke-dashoffset" values="680;0;0" dur="1.9s" repeatCount="indefinite" />
          <animate attributeName="opacity" values="0.45;1;0.7;0.45" dur="1.9s" repeatCount="indefinite" />
        </text>

        <rect x="115" y="130" width="290" height="3" rx="999" fill="rgba(255,255,255,0.12)" />
        <rect x="115" y="130" width="100" height="3" rx="999" fill={`url(#${lineId})`}>
          <animate attributeName="x" values="115;305;115" dur="1.45s" repeatCount="indefinite" />
          <animate attributeName="width" values="72;122;72" dur="1.45s" repeatCount="indefinite" />
        </rect>
      </svg>
    </div>
  );
};
