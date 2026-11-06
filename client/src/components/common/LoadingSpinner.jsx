import React from 'react';

export const LoadingSpinner = ({ size = 'md', text = 'Loading...' }) => {
  const sizeClasses = {
    sm: 'w-4 h-4 border-2',
    md: 'w-8 h-8 border-2',
    lg: 'w-12 h-12 border-3',
  };

  return (
    <div className="flex flex-col items-center justify-center p-6 gap-3">
      <div
        className={`${sizeClasses[size] || sizeClasses.md} rounded-full border-subtle border-t-brand-red animate-spin`}
        role="status"
        aria-label="Loading"
      />
      {text && <span className="text-xs font-mono text-ink-muted uppercase tracking-wider">{text}</span>}
    </div>
  );
};
