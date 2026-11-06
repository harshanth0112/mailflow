import React from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export const Card = ({ children, className = '', header, footer, ...props }) => {
  return (
    <div
      className={twMerge(
        clsx(
          'bg-surface border border-border-subtle rounded-card shadow-warm transition-shadow hover:shadow-elevated',
          className
        )
      )}
      {...props}
    >
      {header && <div className="px-6 py-4 border-b border-border-subtle">{header}</div>}
      <div className="p-6">{children}</div>
      {footer && <div className="px-6 py-4 border-t border-border-subtle bg-canvas/40">{footer}</div>}
    </div>
  );
};
