import React from 'react';
import { AlertTriangle, RotateCcw, LayoutDashboard, ChevronDown, ChevronUp, Home } from 'lucide-react';

/**
 * Universal React Error Boundary
 * Prevents full-application white/blank screen crashes.
 * Supports:
 * - 'page' level (renders inside AppShell, keeping sidebar & header active)
 * - 'root' level (renders at application root level)
 */
export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      showDetails: false
    };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    this.setState({ errorInfo });
    // Log to console for debugging
    console.error('[ErrorBoundary caught an unhandled render error]:', error, errorInfo);

    // Attempt to report error safely without throwing
    try {
      const errorPayload = {
        message: error?.message || String(error),
        stack: error?.stack,
        componentStack: errorInfo?.componentStack,
        url: window.location.href,
        timestamp: new Date().toISOString()
      };
      // Send async beacon or safe fetch if endpoint is available
      if (typeof window !== 'undefined' && window.fetch) {
        window.fetch('/api/audit-logs/client-error', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(errorPayload)
        }).catch(() => {
          // Ignore network failure when posting client error
        });
      }
    } catch {
      // Swallowed safely
    }
  }

  componentDidUpdate(prevProps) {
    if (this.state.hasError) {
      const resetKeyChanged = this.props.resetKey !== undefined && this.props.resetKey !== prevProps.resetKey;
      const locationChanged = this.props.location !== undefined && this.props.location !== prevProps.location;
      if (resetKeyChanged || locationChanged) {
        this.handleReset();
      }
    }
  }

  handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
      showDetails: false
    });
    if (typeof this.props.onReset === 'function') {
      try {
        this.props.onReset();
      } catch (err) {
        console.warn('Error in ErrorBoundary onReset callback:', err);
      }
    }
  };

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    const { level = 'page', title } = this.props;
    const { error, errorInfo, showDetails } = this.state;

    // Check if user has administrative rights or is in development
    let isAdmin = false;
    try {
      if (typeof import.meta !== 'undefined' && import.meta.env?.DEV) {
        isAdmin = true;
      } else {
        const rawToken = localStorage.getItem('edl_token');
        if (rawToken) {
          const payload = JSON.parse(atob(rawToken.split('.')[1]));
          isAdmin = ['super_admin', 'local_admin'].includes(payload?.role);
        }
      }
    } catch {
      isAdmin = false;
    }

    // Root-level fallback when layout itself fails
    if (level === 'root') {
      return (
        <div className="min-h-screen bg-[#280818] flex items-center justify-center p-6 text-white font-sans">
          <div className="max-w-md w-full bg-[#FAF5F0] text-[#1B1B24] rounded-2xl p-8 shadow-2xl border border-white/20 text-center">
            <div className="w-14 h-14 mx-auto rounded-full bg-red-100 text-[#B4483A] flex items-center justify-center mb-4">
              <AlertTriangle className="w-7 h-7" />
            </div>
            <h1 className="text-xl font-bold mb-2">
              {title || 'Something went wrong'}
            </h1>
            <p className="text-xs text-[#4A4D5A] mb-6 leading-relaxed">
              An unexpected application error occurred. You can reload the page or return to the login portal.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
              <button
                type="button"
                onClick={() => window.location.reload()}
                className="w-full sm:w-auto px-4 py-2 bg-gradient-to-r from-[#7B1C3E] to-[#5A1230] text-white rounded-lg text-xs font-semibold hover:opacity-95 shadow transition-opacity flex items-center justify-center gap-2"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Reload Application</span>
              </button>
              <button
                type="button"
                onClick={() => { window.location.href = '/dashboard'; }}
                className="w-full sm:w-auto px-4 py-2 bg-white border border-[#DDD] hover:bg-[#F2ECE4] text-[#1B1B24] rounded-lg text-xs font-semibold transition-colors flex items-center justify-center gap-2"
              >
                <Home className="w-3.5 h-3.5" />
                <span>Dashboard</span>
              </button>
            </div>

            {isAdmin && error && (
              <div className="mt-6 pt-4 border-t border-[#DDD] text-left">
                <button
                  type="button"
                  onClick={() => this.setState({ showDetails: !showDetails })}
                  className="text-[11px] text-[#7B1C3E] hover:underline flex items-center gap-1 font-mono font-medium"
                >
                  {showDetails ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                  <span>{showDetails ? 'Hide technical details' : 'Show technical details'}</span>
                </button>
                {showDetails && (
                  <pre className="mt-2 p-3 bg-white border border-[#DDD] rounded text-[10.5px] font-mono text-red-700 max-h-48 overflow-auto whitespace-pre-wrap break-all">
                    {error.stack || error.toString()}
                    {errorInfo?.componentStack}
                  </pre>
                )}
              </div>
            )}
          </div>
        </div>
      );
    }

    // Page-level fallback inside layout (sidebar and header remain active!)
    return (
      <div
        role="alert"
        className="w-full my-6 bg-card rounded-xl border border-line p-8 text-center flex flex-col items-center justify-center shadow-sm max-w-xl mx-auto"
      >
        <div className="w-12 h-12 rounded-full bg-[rgba(180,72,58,0.1)] text-[#B4483A] flex items-center justify-center mb-3">
          <AlertTriangle className="w-6 h-6" />
        </div>
        <h2 className="text-base font-bold text-ink mb-1.5">
          {title || 'Something went wrong on this page'}
        </h2>
        <p className="text-xs text-slate mb-6 max-w-md leading-relaxed">
          An unexpected error interrupted this view. You can try refreshing the component or return to the Dashboard.
        </p>

        <div className="flex flex-wrap items-center justify-center gap-3">
          <button
            type="button"
            id="btn-error-boundary-retry"
            onClick={this.handleReset}
            className="px-4 py-2 bg-gradient-to-r from-[#7B1C3E] to-[#5A1230] text-white rounded-md text-xs font-semibold hover:opacity-95 shadow transition-all flex items-center gap-2 cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Try again</span>
          </button>
          <button
            type="button"
            id="btn-error-boundary-dashboard"
            onClick={() => { window.location.href = '/dashboard'; }}
            className="px-4 py-2 bg-card border border-line hover:bg-surface text-ink rounded-md text-xs font-semibold transition-colors flex items-center gap-2 cursor-pointer"
          >
            <LayoutDashboard className="w-3.5 h-3.5 text-signal" />
            <span>Back to Dashboard</span>
          </button>
        </div>

        {isAdmin && error && (
          <div className="mt-6 pt-4 border-t border-line w-full text-left">
            <button
              type="button"
              onClick={() => this.setState({ showDetails: !showDetails })}
              className="text-[11px] text-signal hover:underline flex items-center gap-1 font-mono font-medium"
            >
              {showDetails ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              <span>{showDetails ? 'Hide technical details' : 'Show technical details'}</span>
            </button>
            {showDetails && (
              <pre className="mt-2 p-3 bg-surface border border-line rounded text-[10.5px] font-mono text-[#B4483A] max-h-48 overflow-auto whitespace-pre-wrap break-all">
                {error.stack || error.toString()}
                {errorInfo?.componentStack}
              </pre>
            )}
          </div>
        )}
      </div>
    );
  }
}

