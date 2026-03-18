import { useRef, useCallback, useEffect, useState } from 'react';
import { saveCurrentCode, loadCurrentCode } from '../utils/storage';

export function useCodeEditor(initialCode: string = '') {
  const editorRef = useRef<any>(null);
  const [code, setCode] = useState<string>(() => {
    return loadCurrentCode() || initialCode;
  });

  // Auto-save code to localStorage
  useEffect(() => {
    saveCurrentCode(code);
  }, [code]);

  const handleCodeChange = useCallback((value: string | undefined) => {
    setCode(value || '');
  }, []);

  const setEditorRef = useCallback((editor: any) => {
    editorRef.current = editor;
  }, []);

  const formatCode = useCallback(() => {
    if (!editorRef.current) return;

    // Basic formatting - ensure proper indentation
    const formatted = code
      .split('\n')
      .map((line) => line.trimEnd())
      .join('\n');

    setCode(formatted);
  }, [code]);

  const find = useCallback(
    (query: string, caseSensitive: boolean = false, wholeWord: boolean = false) => {
      if (!editorRef.current) return;

      // Monaco Editor find implementation would go here
      if (editorRef.current.find) {
        editorRef.current.find({
          query,
          caseSensitive,
          wholeWord,
        });
      }
    },
    []
  );

  const replace = useCallback(
    (query: string, replaceWith: string) => {
      if (!editorRef.current) return;

      // Monaco Editor replace implementation would go here
      if (editorRef.current.replace) {
        editorRef.current.replace(replaceWith);
      }
    },
    []
  );

  const clearEditor = useCallback(() => {
    setCode('');
  }, []);

  return {
    code,
    setCode,
    editorRef,
    setEditorRef,
    handleCodeChange,
    formatCode,
    find,
    replace,
    clearEditor,
  };
}
