/**
 * Type definitions for the application
 */

// ============ Multi-File Project Support ============
export interface ProjectFile {
  path: string;           // e.g., "index.html", "styles/main.css"
  content: string;
  language: string;       // 'html', 'css', 'javascript', 'typescript', etc.
  isMain: boolean;       // true for the entry point file
  order?: number;        // optional order for sorting
}

export interface ProjectManifest {
  files: ProjectFile[];
  structure: 'single-page' | 'multi-page' | 'app';
  description: string;
  totalFiles: number;
}

export interface GenerationProgress {
  currentFile: string;
  fileIndex: number;
  totalFiles: number;
  stage: 'planning' | 'generating' | 'finalizing' | 'complete' | 'error';
  message: string;
  percentage: number;
}

// ============ Enhanced Error Types ============
export interface ApiError {
  type: 'context_length' | 'network' | 'rate_limit' | 'server' | 'validation' | 'unknown';
  message: string;
  details?: any;
  statusCode?: number;
}

export interface ErrorBoundaryState {
  hasError: boolean;
  errorType: 'context_length' | 'network' | 'rate_limit' | 'server' | 'validation' | 'unknown' | null;
  errorMessage: string;
  errorDetails?: any;
  isRecoverable: boolean;
  suggestedAction: string;
}

// ============ Streaming Response Support ============
export interface StreamChunk {
  type: 'file_start' | 'file_content' | 'file_complete' | 'progress' | 'error' | 'complete';
  filePath?: string;
  content?: string;
  progress?: GenerationProgress;
  error?: ApiError;
}

// ============ Legacy Types (preserved for backward compatibility) ============
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
