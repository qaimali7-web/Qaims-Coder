import { useCallback, useRef } from 'react';

export function useApi() {
  const isGeneratingRef = useRef(false);

  const generateCode = useCallback(
    async (
      chatHistory: any[],
      systemInstruction: string,
      model: string
    ): Promise<string> => {
      const response = await fetch('/api/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          chatHistory,
          systemInstruction,
          model,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Server error: ${response.status}`);
      }

      const text = await response.text();
      return text;
    },
    []
  );

  return {
    generateCode,
    isGeneratingRef,
  };
}
