import React from 'react';
import { HistoryEntry } from '../types';
import { Trash2, RotateCcw, Clock } from 'lucide-react';

interface HistoryPanelProps {
  history: HistoryEntry[];
  onRestore: (entry: HistoryEntry) => void;
  onDelete: (id: string) => void;
  onClear: () => void;
}

export function HistoryPanel({ history, onRestore, onDelete, onClear }: HistoryPanelProps) {
  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getModelName = (modelId: string) => {
    const parts = modelId.split('/');
    return parts[parts.length - 1] || modelId;
  };

  if (history.length === 0) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-slate-500 p-4">
        <Clock className="w-12 h-12 mb-3 opacity-30" />
        <p className="text-sm font-mono">No history yet</p>
        <p className="text-xs mt-1">Generate some websites to see them here</p>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800/60 shrink-0">
        <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
          History ({history.length})
        </span>
        <button
          onClick={onClear}
          className="text-xs text-red-400 hover:text-red-300 font-mono transition-colors"
        >
          Clear All
        </button>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto">
        {history.slice().reverse().map((entry) => (
          <div
            key={entry.id}
            className="group border-b border-slate-800/30 hover:bg-slate-900/50 transition-colors"
          >
            <div className="p-3">
              {/* Prompt preview */}
              <p className="text-sm text-slate-300 line-clamp-2 mb-2">
                {entry.prompt}
              </p>

              {/* Meta info */}
              <div className="flex items-center justify-between text-[10px] text-slate-500 font-mono">
                <div className="flex items-center gap-2">
                  <span>{getModelName(entry.model)}</span>
                  <span>•</span>
                  <span>{entry.charCount} chars</span>
                </div>
                <span>{formatDate(entry.timestamp)}</span>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2 mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  onClick={() => onRestore(entry)}
                  className="flex items-center gap-1 text-xs text-indigo-400 hover:text-indigo-300 font-mono"
                >
                  <RotateCcw className="w-3 h-3" />
                  Restore
                </button>
                <button
                  onClick={() => onDelete(entry.id)}
                  className="flex items-center gap-1 text-xs text-red-400 hover:text-red-300 font-mono"
                >
                  <Trash2 className="w-3 h-3" />
                  Delete
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
