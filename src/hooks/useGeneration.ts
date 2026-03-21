import { useState, useCallback, useRef } from 'react';
import { GenerationState } from '../types';

interface UseGenerationOptions {
  onCodeUpdate: (code: string) => void;
  onComplete: (code: string) => void;
  toast: (type: 'success' | 'error' | 'info' | 'warning', message: string, duration?: number) => void;
}

interface UseGenerationReturn {
  state: GenerationState;
  isGenerating: boolean;
  generate: (prompt: string, model: string, signal?: AbortSignal, retry?: boolean) => void;
  stop: () => void;
}

export function useGeneration({ onCodeUpdate, onComplete, toast }: UseGenerationOptions): UseGenerationReturn {
  const [state, setState] = useState<GenerationState>({
    status: 'idle',
    message: '',
    autoRetryCount: 0,
  });

  const controllerRef = useRef<AbortController | null>(null);
  const isGeneratingRef = useRef(false);

  const isGenerating = isGeneratingRef.current;

  const generate = useCallback(async (
    prompt: string,
    model: string,
    signal?: AbortSignal,
    retry = false
  ) => {
    if (isGeneratingRef.current && !retry) return;

    const controller = new AbortController();
    if (signal) {
      signal.addEventListener('abort', () => controller.abort());
    }
    controllerRef.current = controller;

    isGeneratingRef.current = true;
    setState({
      status: 'generating',
      message: retry ? 'Retrying...' : 'Starting generation...',
      autoRetryCount: retry ? state.autoRetryCount + 1 : 0,
    });

    try {
      const response = await fetch('/api/generate-html', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, model }),
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error('No response body');

      const decoder = new TextDecoder();
      let code = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            if (data === '[DONE]') {
              setState({ status: 'complete', message: 'Generation complete!', autoRetryCount: 0 });
              onComplete(code);
              return;
            }

            try {
              const parsed = JSON.parse(data);
              if (parsed.code) {
                code += parsed.code;
                onCodeUpdate(code);
                setState({ status: 'generating', message: parsed.message || 'Generating...', autoRetryCount: state.autoRetryCount });
              }
              if (parsed.error) {
                throw new Error(parsed.error);
              }
            } catch (e) {
              if (e instanceof Error && e.message !== 'Unexpected end of JSON input') {
                console.error('Parse error:', e);
              }
            }
          }
        }
      }

      setState({ status: 'complete', message: 'Generation complete!', autoRetryCount: 0 });
      onComplete(code);
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        setState({ status: 'stopped', message: 'Generation stopped', autoRetryCount: 0 });
        toast('info', 'Generation stopped');
      } else {
        const errorMsg = error instanceof Error ? error.message : 'Unknown error';
        setState({ status: 'error', message: errorMsg, autoRetryCount: 0 });
        toast('error', `Generation failed: ${errorMsg}`);
      }
    } finally {
      isGeneratingRef.current = false;
      controllerRef.current = null;
    }
  }, [onCodeUpdate, onComplete, toast, state.autoRetryCount]);

  const stop = useCallback(() => {
    if (controllerRef.current) {
      controllerRef.current.abort();
    }
  }, []);

  return { state, isGenerating, generate, stop };
}
