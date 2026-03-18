/**
 * Type definitions for the application
 */

export interface HistoryItem {
  prompt: string;
  code: string;
  timestamp: string;
}

export interface ChatMessage {
  role: 'user' | 'model';
  parts: Array<{
    text: string;
  }>;
}

export interface Toast {
  id: string;
  message: string;
}

export interface EditorConfig {
  theme: 'vs-dark' | 'light' | 'hc-black';
  language: string;
  fontSize: number;
  tabSize: number;
  wordWrap: 'on' | 'off';
  minimap: boolean;
  lineNumbers: 'on' | 'off' | 'relative';
}

export interface KeyboardShortcut {
  key: string;
  ctrl?: boolean;
  shift?: boolean;
  alt?: boolean;
  meta?: boolean;
  action: () => void;
  description: string;
}

export interface ApiConfig {
  baseUrl: string;
  timeout: number;
  retries: number;
}

export interface AppSettings {
  editor: EditorConfig;
  autoSave: boolean;
  autoSaveInterval: number;
  showLineNumbers: boolean;
  showMinimap: boolean;
  fontSize: number;
}
