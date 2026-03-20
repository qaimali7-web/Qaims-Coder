import React from 'react';
import { Wifi, WifiOff } from 'lucide-react';

interface StatusBarProps {
  status: 'idle' | 'generating' | 'stopped' | 'error' | 'complete';
  message: string;
  charCount: number;
  model: string;
}

export function StatusBar({ status, message, charCount, model }: StatusBarProps) {
  const getStatusColor = () => {
    switch (status) {
      case 'generating': return 'text-amber-400';
      case 'error': return 'text-red-400';
      case 'complete': return 'text-emerald-400';
      default: return 'text-slate-500';
    }
  };

  const getModelName = (modelId: string) => {
    const parts = modelId.split('/');
    return parts[parts.length - 1] || modelId;
  };

  return (
    <div className="flex items-center justify-between px-3 py-1.5 bg-[#0a0a0f] border-t border-slate-800/60 text-[10px] font-mono shrink-0">
      <div className="flex items-center gap-3">
        <span className={getStatusColor()}>
          {status.toUpperCase()}
        </span>
        {message && (
          <span className="text-slate-500 truncate max-w-md">{message}</span>
        )}
      </div>
      <div className="flex items-center gap-3 text-slate-600">
        <span>{charCount} chars</span>
        <span className="flex items-center gap-1">
          {status === 'generating' ? (
            <Wifi className="w-3 h-3 text-amber-400" />
          ) : (
            <WifiOff className="w-3 h-3" />
          )}
          {getModelName(model)}
        </span>
      </div>
    </div>
  );
}
