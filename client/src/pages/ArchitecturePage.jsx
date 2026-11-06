import React from 'react';
import { Card } from '../components/common/Card';
import { Layers, Database, Shield, Server, Cpu, Globe } from 'lucide-react';

export const ArchitecturePage = () => {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
      <div>
        <h1 className="font-display text-4xl text-ink uppercase tracking-wide">System Architecture</h1>
        <p className="font-mono text-xs text-ink-muted uppercase tracking-wider mt-1">
          MailFlow Multi-Tenant Foundation Overview
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card header={<div className="font-display text-lg uppercase flex items-center gap-2"><Globe className="w-4 h-4 text-brand-red" /> Client Layer</div>}>
          <p className="text-sm text-ink-muted leading-relaxed">
            Vite-powered React application using Tailwind CSS configured with the editorial design system tokens (Anton, Inter, Martian Mono).
          </p>
        </Card>
        <Card header={<div className="font-display text-lg uppercase flex items-center gap-2"><Server className="w-4 h-4 text-brand-red" /> Express API</div>}>
          <p className="text-sm text-ink-muted leading-relaxed">
            RESTful API entry point with security middleware (Helmet, CORS), Zod validation, and centralized error handling.
          </p>
        </Card>
        <Card header={<div className="font-display text-lg uppercase flex items-center gap-2"><Database className="w-4 h-4 text-brand-red" /> Database & Atlas</div>}>
          <p className="text-sm text-ink-muted leading-relaxed">
            Mongoose ODM configured for persistent Atlas connections with non-blocking initialization and graceful degradation.
          </p>
        </Card>
      </div>
    </div>
  );
};
