// src/hooks/useLogger.ts - Comprehensive logging system
import { useState, useCallback, useEffect, useRef } from 'react';

export interface LogEntry {
  timestamp: string;
  level: 'info' | 'warn' | 'error' | 'debug';
  category: string;
  message: string;
  data?: any;
}

const MAX_LOGS = 1000; // Keep last 1000 logs in memory

export const useLogger = () => {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const logsRef = useRef<LogEntry[]>([]);

  // Helper to add a log entry
  const log = useCallback((
    level: LogEntry['level'],
    category: string,
    message: string,
    data?: any
  ) => {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      category,
      message,
      data,
    };

    // Update ref (for immediate access)
    logsRef.current.push(entry);
    
    // Keep only last MAX_LOGS
    if (logsRef.current.length > MAX_LOGS) {
      logsRef.current = logsRef.current.slice(-MAX_LOGS);
    }

    // Update state (for UI)
    setLogs([...logsRef.current]);
    
    // Also log to console for debugging
    const consoleMethod = level === 'error' ? 'error' : level === 'warn' ? 'warn' : 'log';
    console[consoleMethod](`[${category}] ${message}`, data || '');
  }, []);

  // Convenience methods
  const info = useCallback((category: string, message: string, data?: any) => {
    log('info', category, message, data);
  }, [log]);

  const warn = useCallback((category: string, message: string, data?: any) => {
    log('warn', category, message, data);
  }, [log]);

  const error = useCallback((category: string, message: string, data?: any) => {
    log('error', category, message, data);
  }, [log]);

  const debug = useCallback((category: string, message: string, data?: any) => {
    log('debug', category, message, data);
  }, [log]);

  // Clear all logs
  const clearLogs = useCallback(() => {
    logsRef.current = [];
    setLogs([]);
    info('Logger', 'Logs cleared');
  }, [info]);

  // Download logs as text file
  const downloadLogs = useCallback(() => {
    const logText = logsRef.current
      .map(log => {
        const level = log.level.toUpperCase().padEnd(5);
        const time = log.timestamp;
        return `[${time}] [${level}] [${log.category}] ${log.message}${log.data ? `\n  Data: ${JSON.stringify(log.data, null, 2)}` : ''}`;
      })
      .join('\n');

    const blob = new Blob([logText], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `logs-${new Date().toISOString().replace(/[:.]/g, '-')}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    info('Logger', 'Logs downloaded', { count: logsRef.current.length });
  }, [info]);

  // Load logs from localStorage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem('app-logs');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          logsRef.current = parsed.slice(-MAX_LOGS);
          setLogs([...logsRef.current]);
          debug('Logger', 'Loaded logs from localStorage', { count: logsRef.current.length });
        }
      }
    } catch (e) {
      error('Logger', 'Failed to load logs from localStorage', e);
    }
  }, [debug, error]);

  // Save logs to localStorage on change
  useEffect(() => {
    try {
      localStorage.setItem('app-logs', JSON.stringify(logsRef.current));
    } catch (e) {
      console.error('Failed to save logs:', e);
    }
  }, [logs]);

  return {
    logs,
    info,
    warn,
    error,
    debug,
    clearLogs,
    downloadLogs,
    logCount: logsRef.current.length,
  };
};