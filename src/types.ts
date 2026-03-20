// AI Model definitions
export interface AIModel {
  id: string;
  name: string;
  provider: string;
}

export const AI_MODELS: AIModel[] = [
  {
    id: 'stepfun/step-3.5-flash:free',
    name: 'Step-3.5 Flash',
    provider: 'StepFun',
  },
  {
    id: 'stepfun/step-3.5-max:free',
    name: 'Step-3.5 Max',
    provider: 'StepFun',
  },
  {
    id: 'openai/gpt-4o-mini',
    name: 'GPT-4o Mini',
    provider: 'OpenAI',
  },
  {
    id: 'anthropic/claude-3-haiku',
    name: 'Claude 3 Haiku',
    provider: 'Anthropic',
  },
];

// History entry type
export interface HistoryEntry {
  id: string;
  prompt: string;
  code: string;
  model: string;
  charCount: number;
  timestamp: number;
}

// Generation state
export interface GenerationState {
  status: 'idle' | 'generating' | 'stopped' | 'error' | 'complete';
  message: string;
  autoRetryCount: number;
}

// Toast types
export type ToastType = 'success' | 'error' | 'info' | 'warning';

export interface Toast {
  id: string;
  type: ToastType;
  message: string;
  duration?: number;
}
