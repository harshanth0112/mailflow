import React from 'react';
import { Link } from 'react-router-dom';
import { Button } from '../components/common/Button';
import { HelpCircle } from 'lucide-react';

export const NotFoundPage = () => {
  return (
    <div className="min-h-[70vh] flex items-center justify-center p-6 text-center">
      <div className="max-w-md">
        <HelpCircle className="w-12 h-12 text-brand-red mx-auto mb-4" />
        <h1 className="font-display text-4xl text-ink uppercase tracking-wide mb-2">404 — Page Not Found</h1>
        <p className="text-sm text-ink-muted mb-6 leading-relaxed">
          The requested route is not available. Check the URL or return to the overview page.
        </p>
        <Link to="/">
          <Button>Return to Overview</Button>
        </Link>
      </div>
    </div>
  );
};
