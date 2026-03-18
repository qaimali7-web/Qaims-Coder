import { useState, useCallback } from 'react';
import { announceToScreenReader } from '../utils/accessibility';

export function useToasts() {
  const [toasts, setToasts] = useState<string[]>([]);

  const showToast = useCallback((msg: string) => {
    const id = Date.now().toString();
    setToasts((prev) => [...prev, id + ':' + msg]);

    // Announce to screen readers
    announceToScreenReader(msg);

    // Auto-remove after 3 seconds
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => !t.startsWith(id)));
    }, 3000);
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => !t.startsWith(id)));
  }, []);

  const clearToasts = useCallback(() => {
    setToasts([]);
  }, []);

  return {
    toasts: toasts.map((t) => {
      const [id, msg] = t.split(':');
      return { id, message: msg };
    }),
    showToast,
    removeToast,
    clearToasts,
  };
}
