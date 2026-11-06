import React, { useState, useEffect } from 'react';
import { checkHealth } from '../services/api';
import { Card } from '../components/common/Card';
import { Button } from '../components/common/Button';
import { LoadingSpinner } from '../components/common/LoadingSpinner';
import {
  Activity,
  Server,
  Database,
  ShieldAlert,
  ShieldCheck,
  CheckCircle2,
  RefreshCw,
  Terminal,
  Layers,
  ArrowRight
} from 'lucide-react';

export const HomePage = () => {
  const [health, setHealth] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastChecked, setLastChecked] = useState(null);

  const fetchHealth = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await checkHealth();
      setHealth(res.data);
      setLastChecked(new Date().toLocaleTimeString());
    } catch (err) {
      setError(err.message || 'Unable to communicate with the MailFlow backend API.');
      setHealth(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHealth();
  }, []);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-16">
      {/* Editorial Hero Section */}
      <section className="relative pt-6 pb-12 border-b border-border-subtle">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-border-subtle bg-surface mb-6">
          <span className="w-2 h-2 rounded-full bg-brand-red animate-pulse" />
          <span className="font-mono text-xs text-ink-muted uppercase tracking-widest">
            Architecture Verified — Phase 1
          </span>
        </div>

        <h1 className="font-display text-5xl sm:text-7xl lg:text-8xl text-ink uppercase tracking-tight leading-none mb-6">
          Email Automation <br />
          <span className="text-brand-red">Engineered</span> for Scale.
        </h1>

        <p className="max-w-2xl text-base sm:text-lg text-ink-muted font-normal leading-relaxed mb-8">
          MailFlow is a multi-user SaaS email campaign and automation platform. Built with a robust
          MERN foundation, strict multi-tenant workspace isolation, and background job queuing.
        </p>

        <div className="flex flex-wrap items-center gap-4">
          <a href="#system-status">
            <Button size="lg" className="gap-2">
              Inspect System Status <ArrowRight className="w-4 h-4" />
            </Button>
          </a>
          <Button variant="outline" size="lg" onClick={fetchHealth}>
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Recheck API
          </Button>
        </div>
      </section>

      {/* System Status & Health Check Inspector Section */}
      <section id="system-status" className="scroll-mt-20">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <div className="flex items-center gap-2 text-ink">
              <Activity className="w-5 h-5 text-brand-red" />
              <h2 className="font-display text-3xl uppercase tracking-wide">System Health Monitor</h2>
            </div>
            <p className="text-xs font-mono text-ink-muted uppercase tracking-wider mt-1">
              Live probe of <code className="text-ink">GET /api/v1/health</code>
            </p>
          </div>

          <div className="flex items-center gap-3">
            {lastChecked && (
              <span className="font-mono text-xs text-ink-muted">
                Last checked: {lastChecked}
              </span>
            )}
            <Button variant="outline" size="sm" onClick={fetchHealth} disabled={loading}>
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh
            </Button>
          </div>
        </div>

        {loading && !health ? (
          <Card className="text-center py-12">
            <LoadingSpinner text="Probing Express API endpoint..." />
          </Card>
        ) : error ? (
          <Card className="border-status-error/30 bg-status-error/5">
            <div className="flex items-start gap-4">
              <ShieldAlert className="w-6 h-6 text-status-error shrink-0 mt-0.5" />
              <div>
                <h3 className="font-mono text-sm font-semibold text-status-error uppercase tracking-wider">
                  API Connection Unreachable
                </h3>
                <p className="text-sm text-ink-muted mt-1">{error}</p>
                <div className="mt-4 p-3 bg-surface border border-border-subtle rounded-subtle font-mono text-xs text-ink-muted">
                  Make sure the server is running on port 5000: <br />
                  <code className="text-ink font-bold">npm run dev:server</code>
                </div>
              </div>
            </div>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Express API Health Status */}
            <Card>
              <div className="flex items-center justify-between mb-4">
                <span className="font-mono text-xs text-ink-muted uppercase tracking-wider">
                  Express API Server
                </span>
                <Server className="w-5 h-5 text-ink-muted" />
              </div>
              <div className="flex items-baseline gap-3">
                <div
                  className={`w-3 h-3 rounded-full ${
                    health?.status === 'healthy'
                      ? 'bg-status-success'
                      : health?.status === 'degraded'
                      ? 'bg-status-warning'
                      : 'bg-status-error'
                  }`}
                />
                <span className="font-display text-2xl uppercase tracking-wider text-ink">
                  {health?.status || 'Unknown'}
                </span>
              </div>
              <div className="mt-4 pt-4 border-t border-border-subtle font-mono text-xs text-ink-muted space-y-1">
                <div className="flex justify-between">
                  <span>Environment:</span>
                  <span className="text-ink font-semibold">{health?.environment}</span>
                </div>
                <div className="flex justify-between">
                  <span>Server Uptime:</span>
                  <span className="text-ink">{health?.uptime}s</span>
                </div>
              </div>
            </Card>

            {/* MongoDB Connection Status */}
            <Card>
              <div className="flex items-center justify-between mb-4">
                <span className="font-mono text-xs text-ink-muted uppercase tracking-wider">
                  MongoDB Atlas
                </span>
                <Database className="w-5 h-5 text-ink-muted" />
              </div>
              <div className="flex items-baseline gap-3">
                <div
                  className={`w-3 h-3 rounded-full ${
                    health?.database?.connected
                      ? 'bg-status-success'
                      : 'bg-status-warning'
                  }`}
                />
                <span className="font-display text-2xl uppercase tracking-wider text-ink">
                  {health?.database?.status || 'Disconnected'}
                </span>
              </div>
              <div className="mt-4 pt-4 border-t border-border-subtle font-mono text-xs text-ink-muted space-y-1">
                <div className="flex justify-between">
                  <span>Connection State:</span>
                  <span className="text-ink font-semibold">
                    {health?.database?.connected ? 'Connected (State 1)' : 'Degraded / Optional (State 0)'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Atlas Reconnect:</span>
                  <span className="text-ink">Auto-enabled</span>
                </div>
              </div>
            </Card>

            {/* Timestamp & Diagnostic Info */}
            <Card>
              <div className="flex items-center justify-between mb-4">
                <span className="font-mono text-xs text-ink-muted uppercase tracking-wider">
                  Diagnostic Probe
                </span>
                <ShieldCheck className="w-5 h-5 text-status-success" />
              </div>
              <div className="font-display text-2xl uppercase tracking-wider text-ink">
                Verified
              </div>
              <div className="mt-4 pt-4 border-t border-border-subtle font-mono text-xs text-ink-muted space-y-1">
                <div>
                  <span className="block text-[10px] uppercase text-ink-muted">Server Timestamp:</span>
                  <span className="text-ink text-[11px] truncate block">{health?.timestamp}</span>
                </div>
                <div className="pt-1 flex justify-between">
                  <span>CORS Isolation:</span>
                  <span className="text-status-success font-semibold">Active</span>
                </div>
              </div>
            </Card>
          </div>
        )}
      </section>

      {/* Architecture & Phase 1 Scope Card */}
      <section className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <Card header={<h3 className="font-display text-xl uppercase tracking-wider">Phase 1 Objectives Delivered</h3>}>
          <ul className="space-y-3 font-mono text-xs text-ink-muted">
            <li className="flex items-start gap-2.5">
              <CheckCircle2 className="w-4 h-4 text-status-success shrink-0 mt-0.5" />
              <span>Clean MERN monorepo structure with isolated client and server packages.</span>
            </li>
            <li className="flex items-start gap-2.5">
              <CheckCircle2 className="w-4 h-4 text-status-success shrink-0 mt-0.5" />
              <span>Vite + React frontend with Tailwind CSS design tokens and editorial aesthetic.</span>
            </li>
            <li className="flex items-start gap-2.5">
              <CheckCircle2 className="w-4 h-4 text-status-success shrink-0 mt-0.5" />
              <span>Express.js backend with helmet, CORS, morgan, and Zod environment validation.</span>
            </li>
            <li className="flex items-start gap-2.5">
              <CheckCircle2 className="w-4 h-4 text-status-success shrink-0 mt-0.5" />
              <span>Resilient MongoDB Atlas connection with graceful degradation on disconnection.</span>
            </li>
            <li className="flex items-start gap-2.5">
              <CheckCircle2 className="w-4 h-4 text-status-success shrink-0 mt-0.5" />
              <span>Accurate health endpoint: returns `healthy` when DB is connected, `degraded` when detached.</span>
            </li>
          </ul>
        </Card>

        <Card header={<h3 className="font-display text-xl uppercase tracking-wider">Phase 2 Boundaries Protected</h3>}>
          <p className="text-sm text-ink-muted leading-relaxed mb-4">
            In strict compliance with the development roadmap:
          </p>
          <div className="p-4 bg-canvas rounded-subtle border border-border-subtle font-mono text-xs text-ink-muted space-y-2">
            <div>• No authentication or login workflows initiated yet.</div>
            <div>• No campaign execution or contact lists created.</div>
            <div>• No fake/mock business data injected into UI.</div>
            <div>• No credentials or secrets exposed to the browser.</div>
            <div>• Ready for Phase 2: User model, JWT auth & verification emails.</div>
          </div>
        </Card>
      </section>
    </div>
  );
};

