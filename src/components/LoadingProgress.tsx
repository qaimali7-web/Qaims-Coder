// src/components/LoadingProgress.tsx
import React from 'react';
import { Loader2, FileCode, CheckCircle, AlertCircle } from 'lucide-react';
import { GenerationProgress } from '../types';

interface LoadingProgressProps {
  progress: GenerationProgress | null;
  isGenerating: boolean;
  error?: string | null;
}

export const LoadingProgress: React.FC<LoadingProgressProps> = ({
  progress,
  isGenerating,
  error,
}) => {
  if (!isGenerating && !error) {
    return null;
  }

  const getStageIcon = () => {
    if (error) return <AlertCircle className="w-5 h-5 text-red-500" />;
    
    switch (progress?.stage) {
      case 'planning':
        return <Loader2 className="w-5 h-5 text-blue-500 animate-spin" />;
      case 'generating':
        return <FileCode className="w-5 h-5 text-green-500" />;
      case 'finalizing':
        return <Loader2 className="w-5 h-5 text-purple-500 animate-spin" />;
      case 'complete':
        return <CheckCircle className="w-5 h-5 text-green-500" />;
      case 'error':
        return <AlertCircle className="w-5 h-5 text-red-500" />;
      default:
        return <Loader2 className="w-5 h-5 text-gray-500 animate-spin" />;
    }
  };

  const getStageText = () => {
    if (error) return 'Error occurred';
    return progress?.message || 'Initializing...';
  };

  const getProgressPercentage = () => {
    if (error) return 0;
    return progress?.percentage ?? 0;
  };

  return (
    <div className="loading-progress bg-gray-900 border-t border-gray-800 p-4">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-3">
            {getStageIcon()}
            <span className="text-sm font-medium text-gray-200">
              {getStageText()}
            </span>
          </div>
          <span className="text-sm text-gray-400">
            {progress ? `${progress.fileIndex}/${progress.totalFiles} files` : ''}
          </span>
        </div>
        
        {/* Progress bar */}
        <div className="w-full bg-gray-800 rounded-full h-2 overflow-hidden">
          <div
            className={`h-full transition-all duration-300 ${
              error
                ? 'bg-red-500'
                : progress?.stage === 'complete'
                ? 'bg-green-500'
                : 'bg-blue-500'
            }`}
            style={{ width: `${getProgressPercentage()}%` }}
          />
        </div>
        
        {/* Current file indicator */}
        {progress?.currentFile && progress.stage === 'generating' && (
          <div className="mt-2 text-xs text-gray-500 font-mono">
            Generating: {progress.currentFile}
          </div>
        )}
        
        {error && (
          <div className="mt-2 text-xs text-red-400">
            {error}
          </div>
        )}
      </div>
    </div>
  );
};
