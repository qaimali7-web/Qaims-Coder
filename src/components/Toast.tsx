import React, { createContext, useContext, useState, useCallback } from 'react';
import { Toast as ToastType } from '../types';
import { X, CheckCircle, AlertCircle, Info, AlertTriangle } from 'lucide-react';

interface ToastContextType {
  toasts: ToastType[];
  toast: (type: ToastType['type'], message: string, duration?: number) => void;
  dismiss: (id: string) => void;
}

const ToastContext = createContext<ToastContextType | null>(null);

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within ToastProvider');
  }
  return context;
}

interface ToastProviderProps {
  children: React.ReactNode;
}

export function ToastProvider({ children }: ToastProviderProps) {
  const [toasts, setToasts] = useState<ToastType[]>([]);

  const toast = useCallback((type: ToastType['type'], message: string, duration = 3000) => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const newToast: ToastType = { id, type, message, duration };

    setToasts((prev) => [...prev, newToast]);

    if (duration > 0) {
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, duration);
    }
  }, []);

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ toasts, toast, dismiss }}>
      {children}
    </ToastContext.Provider>
  );
}

interface ToastContainerProps {
  toasts: ToastType[];
  onDismiss: (id: string) => void;
}

export function ToastContainer({ toasts, onDismiss }: ToastContainerProps) {
  const getIcon = (type: ToastType['type']) => {
    switch (type) {
      case 'success': return <CheckCircle className="w-4 h-4 text-emerald-400" />;
      case 'error': return <AlertCircle className="w-4 h-4 text-red-400" />;
      case 'warning': return <AlertTriangle className="w-4 h-4 text-amber-400" />;
      default: return <Info className="w-4 h-4 text-indigo-400" />;
    }
  };

  const getStyles = (type: ToastType['type']) => {
    switch (type) {
      case 'success': return 'border-emerald-500/30 bg-emerald-500/10';
      case 'error': return 'border-red-500/30 bg-red-500/10';
      case 'warning': return 'border-amber-500/30 bg-amber-500/10';
      default: return 'border-indigo-500/30 bg-indigo-500/10';
    }
  };

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-sm w-full">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`
            flex items-start gap-2.5 p-3 rounded-lg border backdrop-blur-sm
            text-sm text-slate-200 shadow-lg animate-fade-in
            ${getStyles(toast.type)}
          `}
        >
          {getIcon(toast.type)}
          <p className="flex-1 text-xs font-mono leading-relaxed">
            {toast.message}
          </p>
          <button
            onClick={() => onDismiss(toast.id)}
            className="shrink-0 text-slate-500 hover:text-white transition-colors"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      ))}
    </div>
  );
}
