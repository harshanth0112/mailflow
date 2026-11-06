import React, { Component } from 'react';
import { AlertCircle, RefreshCw } from 'lucide-react';

export class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }
      return (
        <div className="min-h-screen bg-canvas flex items-center justify-center p-6">
          <div className="max-w-md w-full bg-surface border border-border-subtle p-8 rounded-card shadow-warm text-center">
            <div className="w-12 h-12 bg-status-error/10 text-status-error rounded-full flex items-center justify-center mx-auto mb-4">
              <AlertCircle className="w-6 h-6" />
            </div>
            <h2 className="font-display text-2xl text-ink tracking-wide mb-2 uppercase">Application Error</h2>
            <p className="text-sm text-ink-muted mb-6 leading-relaxed">
              An unexpected error occurred in this view. The system has logged the details safely.
            </p>
            {this.state.error && (
              <pre className="text-xs font-mono bg-canvas text-ink-muted p-3 rounded mb-6 text-left overflow-x-auto border border-border-subtle max-h-36">
                {this.state.error.message || String(this.state.error)}
              </pre>
            )}
            <button
              onClick={this.handleReset}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-ink text-surface text-xs font-mono uppercase tracking-wider rounded-subtle hover:bg-brand-red transition-colors"
            >
              <RefreshCw className="w-3.5 h-3.5" /> Reload Application
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
