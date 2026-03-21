import React from 'react';
import { AI_MODELS } from '../types';
import { Sparkles } from 'lucide-react';

interface ModelSelectorProps {
  value: string;
  onChange: (modelId: string) => void;
  disabled?: boolean;
}

export function ModelSelector({ value, onChange, disabled }: ModelSelectorProps) {
  return (
    <div>
      <label className="block text-xs font-semibold text-slate-500 uppercase tracking-widest mb-2">
        AI Model
      </label>
      <div className="relative">
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          className={`
            w-full appearance-none bg-slate-900/80 border rounded-xl px-3 py-2.5 text-sm font-mono
            transition-all outline-none cursor-pointer
            ${disabled
              ? 'opacity-50 cursor-not-allowed border-slate-800 text-slate-600'
              : 'border-slate-700/50 hover:border-slate-600 focus:border-indigo-500'
            }
          `}
        >
          {AI_MODELS.map((model) => (
            <option key={model.id} value={model.id}>
              {model.name} ({model.provider})
            </option>
          ))}
        </select>
        <Sparkles className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" aria-hidden="true" />
      </div>
    </div>
  );
}
