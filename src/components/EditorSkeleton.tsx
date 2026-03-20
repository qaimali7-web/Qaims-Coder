import React from 'react';

export function EditorSkeleton() {
  return (
    <div className="w-full h-full flex items-center justify-center bg-[#1a1a2e]">
      <div className="flex flex-col items-center gap-3">
        <div className="w-8 h-8 border-3 border-indigo-500 border-t-transparent rounded-full animate-spin" />
        <p className="text-sm text-slate-400 font-mono animate-pulse">Generating...</p>
      </div>
    </div>
  );
}
