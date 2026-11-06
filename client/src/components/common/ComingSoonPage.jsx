import React from 'react';
import { Link } from 'react-router-dom';

/**
 * Reusable empty state component for sections not yet implemented
 */
export const ComingSoonPage = ({
  icon: Icon,
  title,
  description,
  phase,
  iconColor = 'text-indigo-400',
  iconBg = 'bg-indigo-500/10',
}) => {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
      <div
        className={`w-20 h-20 rounded-2xl ${iconBg} border border-slate-700/60 flex items-center justify-center mb-6`}
      >
        {Icon && <Icon className={`w-9 h-9 ${iconColor}`} />}
      </div>

      <div className="max-w-sm">
        <h1 className="text-2xl font-extrabold text-white mb-2">{title}</h1>
        <p className="text-slate-400 text-sm leading-relaxed mb-6">{description}</p>

        {phase && (
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-slate-800 border border-slate-700 text-slate-400 text-xs font-mono uppercase tracking-wider mb-6">
            Planned for {phase}
          </div>
        )}

        <div>
          <Link
            to="/dashboard"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold transition-colors"
          >
            ← Back to Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
};

