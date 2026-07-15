import React, { forwardRef } from 'react';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger-neutral';
export type ButtonSize = 'sm' | 'default' | 'icon';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  fullWidth?: boolean;
}

const baseClassName = 'inline-flex shrink-0 items-center justify-center gap-2 rounded-control border text-sm font-semibold shadow-none transition-colors disabled:pointer-events-none disabled:opacity-50';

export const buttonVariantClasses: Record<ButtonVariant, string> = {
  primary: 'border-zinc-950 bg-zinc-950 text-white hover:border-zinc-800 hover:bg-zinc-800 active:bg-black dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-950 dark:hover:border-zinc-300 dark:hover:bg-zinc-300',
  secondary: 'border-zinc-300 bg-paper text-zinc-700 hover:border-zinc-500 hover:bg-zinc-100 hover:text-zinc-950 active:bg-zinc-200 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:border-zinc-500 dark:hover:bg-zinc-800 dark:hover:text-white',
  ghost: 'border-transparent bg-transparent text-zinc-600 hover:bg-zinc-200/70 hover:text-zinc-950 active:bg-zinc-300/70 dark:text-zinc-300 dark:hover:bg-zinc-800 dark:hover:text-white dark:active:bg-zinc-700',
  'danger-neutral': 'border-zinc-300 bg-transparent text-zinc-700 hover:border-zinc-500 hover:bg-zinc-100 hover:text-zinc-950 active:bg-zinc-200 dark:border-zinc-700 dark:text-zinc-300 dark:hover:border-zinc-500 dark:hover:bg-zinc-800 dark:hover:text-white',
};

export const buttonSizeClasses: Record<ButtonSize, string> = {
  sm: 'h-9 px-3 text-xs',
  default: 'min-h-11 px-4 py-2.5',
  icon: 'h-10 w-10 p-0',
};

const mergeClassName = (...values: Array<string | undefined | false>) => values.filter(Boolean).join(' ');

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(({
  variant = 'secondary',
  size = 'default',
  fullWidth = false,
  className,
  type = 'button',
  ...props
}, ref) => (
  <button
    {...props}
    ref={ref}
    type={type}
    className={mergeClassName(
      baseClassName,
      buttonVariantClasses[variant],
      buttonSizeClasses[size],
      fullWidth && 'w-full',
      className
    )}
  />
));

Button.displayName = 'Button';
