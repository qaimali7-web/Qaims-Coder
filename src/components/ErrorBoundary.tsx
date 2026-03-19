// src/components/ErrorBoundary.tsx
import React, { useState, useEffect, ReactNode, ErrorInfo } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

export const ErrorBoundary: React.FC<ErrorBoundaryProps> = ({
  children,
  fallback,
  onError,
}) => {
  const [hasError, setHasError] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [errorInfo, setErrorInfo] = useState<ErrorInfo | null>(null);

  useEffect(() => {
    // Reset error state when children change
    setHasError(false);
    setError(null);
    setErrorInfo(null);
  }, [children]);

  const handleError = (err: Error, info: ErrorInfo) => {
    setHasError(true);
    setError(err);
    setErrorInfo(info);
    
    if (onError) {
      onError(err, info);
    }
    
    console.error('Error caught by boundary:', err, info);
  };

  const handleReset = () => {
    setHasError(false);
    setError(null);
    setErrorInfo(null);
  };

  if (hasError && error) {
    if (fallback) {
      return <>{fallback}</>;
    }

    const errorType = getErrorType(error);
    const displayMessage = getErrorMessage(error);

    return (
      <div className="flex items-center justify-center min-h-screen bg-zinc-950 p-4">
        <div className="max-w-2xl w-full bg-zinc-900 border border-zinc-800 rounded-lg p-8 shadow-2xl">
          <div className="flex items-start gap-4">
            <div className="flex-shrink-0">
              <AlertTriangle className="w-12 h-12 text-red-500" />
            </div>
            
            <div className="flex-1">
              <h2 className="text-xl font-bold text-white mb-2">
                Something went wrong
              </h2>
              
              <p className="text-slate-300 mb-6">
                {displayMessage}
              </p>

              <div className="bg-zinc-800 rounded-lg p-4 mb-6">
                <h3 className="text-sm font-semibold text-slate-400 uppercase mb-2">
                  Error Details
                </h3>
                <p className="text-sm text-slate-300 font-mono break-all">
                  {error.message}
                </p>
                {errorInfo && (
                  <p className="text-xs text-slate-500 mt-2 font-mono">
                    {errorInfo.componentStack}
                  </p>
                )}
              </div>

              <div className="flex flex-wrap gap-3">
                <button
                  onClick={handleReset}
                  className="flex items-center gap-2 px-4 py-2 bg-indigo-500 hover:bg-indigo-600 text-white rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <RefreshCw className="w-4 h-4" />
                  Try Again
                </button>
                
                {errorType === 'context_length' && (
                  <div className="text-sm text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded-lg px-4 py-2">
                    Tip: Try breaking your request into smaller parts or use a more concise prompt.
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};

function getErrorType(error: Error): 'context_length' | 'network' | 'rate_limit' | 'validation' | 'unknown' {
  const message = error.message.toLowerCase();
  
  if (message.includes('context') || message.includes('length')) {
    return 'context_length';
  }
  
  if (message.includes('network') || message.includes('fetch')) {
    return 'network';
  }
  
  if (message.includes('rate limit')) {
    return 'rate_limit';
  }
  
  if (message.includes('validation')) {
    return 'validation';
  }
  
  return 'unknown';
}

function getErrorMessage(error: Error): string {
  const message = error.message;
  
  if (message.includes('context') || message.includes('length')) {
    return 'The request is too long. Please try a simpler prompt or break it into smaller parts.';
  }
  
  if (message.includes('network') || message.includes('fetch')) {
    return 'Network error. Please check your connection and try again.';
  }
  
  if (message.includes('rate limit')) {
    return 'API rate limit exceeded. Please wait a moment and try again.';
  }
  
  return error.message || 'An unexpected error occurred';
}
