import React from 'react';
import { AlertOctagon, RefreshCw } from 'lucide-react';

interface Props {
  children: React.ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[ErrorBoundary]', error, info.componentStack);
  }

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div className="flex items-center justify-center h-screen bg-[#0a0a0f] text-slate-200">
        <div className="max-w-md text-center px-8 animate-fade-in">
          <div className="flex justify-center mb-6">
            <div className="p-4 rounded-2xl bg-red-500/10 border border-red-500/20">
              <AlertOctagon className="w-10 h-10 text-red-400" />
            </div>
          </div>
          <h2 className="text-2xl font-bold mb-3" style={{ fontFamily: 'Syne, sans-serif' }}>
            Something broke
          </h2>
          <p className="text-slate-400 text-sm mb-2 font-mono">
            {this.state.error?.message ?? 'An unexpected error occurred'}
          </p>
          <p className="text-slate-600 text-xs mb-8 font-mono">
            Check the console for more details
          </p>
          <button
            onClick={() => window.location.reload()}
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            Reload App
          </button>
        </div>
      </div>
    );
  }
}
