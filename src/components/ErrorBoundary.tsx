import { Component, ErrorInfo, ReactNode } from 'react';

interface Props { children: ReactNode; }
interface State { error: Error | null; }

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[ErrorBoundary]', error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-background p-6">
          <div className="max-w-lg w-full bg-surface rounded-2xl shadow-sm border border-danger-500/20 p-8 text-center">
            <div className="text-5xl mb-4">⚠️</div>
            <h1 className="text-xl font-bold text-text-primary mb-2">Something went wrong</h1>
            <p className="text-sm text-text-muted mb-6">
              An unexpected error occurred while loading this view. You can return to the dashboard or try again.
            </p>
            <div className="flex items-center justify-center gap-3">
              <button
                className="px-4 py-2 border border-border text-text-primary rounded-lg text-sm font-medium hover:bg-black/[0.04] dark:hover:bg-white/[0.06] transition-colors"
                onClick={() => {
                  this.setState({ error: null });
                }}
              >
                Try Again
              </button>
              <button
                className="btn-primary"
                onClick={() => {
                  this.setState({ error: null });
                  window.location.href = '/dashboard';
                }}
              >
                Back to Dashboard
              </button>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
