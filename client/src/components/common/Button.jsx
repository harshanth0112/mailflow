import React from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export const Button = ({
  children,
  variant = 'primary',
  size = 'md',
  className = '',
  disabled = false,
  ...props
}) => {
  const base =
    'inline-flex items-center justify-center font-mono uppercase tracking-wider transition-all duration-150 disabled:opacity-50 disabled:pointer-events-none rounded-subtle';

  const variants = {
    primary: 'bg-brand-red text-white hover:bg-[#d63b2f] shadow-sm',
    secondary: 'bg-ink text-surface hover:bg-brand-dark',
    outline: 'border border-border-subtle bg-surface text-ink hover:border-ink hover:bg-canvas',
    ghost: 'text-ink-muted hover:text-ink hover:bg-black/5',
  };

  const sizes = {
    sm: 'text-[11px] px-3 py-1.5 gap-1.5',
    md: 'text-xs px-4 py-2 gap-2',
    lg: 'text-sm px-6 py-3 gap-2.5',
  };

  return (
    <button
      className={twMerge(clsx(base, variants[variant], sizes[size], className))}
      disabled={disabled}
      {...props}
    >
      {children}
    </button>
  );
};
