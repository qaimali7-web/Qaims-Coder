import React, { useState, useRef, useEffect, useCallback } from 'react';
import { GitBranch, Plus, Zap, Square, Download, Copy, Eye, X, Search, Replace } from 'lucide-react';
import Editor from '@monaco-editor/react';
import { formatCode } from './utils/codeformatter';
import { saveVersionHistory, loadVersionHistory, saveCurrentCode, loadCurrentCode, MAX_VERSION_HISTORY } from './utils/storage';
import { validateOpenRouterApiKey, sanitizeHtml } from './utils/validation';
import { useToasts } from './hooks/usetoasts';
import { useCodeEditor } from './hooks/usecodeeditor';
import { registerShortcuts, defaultEditorShortcuts } from './utils/keyboardshortcuts';
import { trapFocus, generateUniqueId } from './utils/accessibility';

interface HistoryItem {
  prompt: string;
  code: string;
  timestamp: string;
}

export default function App() {
  const [prompt, setPrompt] = useState('');
  const [currentCode, setCurrentCode] = useState(() => loadCurrentCode() || '');
  const [isGenerating, setIsGenerating] = useState(false);
  const [chatHistory, setChatHistory] = useState<any[]>([]);
  const [versionHistory, setVersionHistory] = useState<HistoryItem[]>(() => loadVersionHistory());
  const [activeVersionIndex, setActiveVersionIndex] = useState<number>(0);
  const [isPreviewVisible, setIsPreviewVisible] = useState(false);
  const [isFindReplaceVisible, setIsFindReplaceVisible] = useState(false);
  const [findQuery, setFindQuery] = useState('');
  const [replaceQuery, setReplaceQuery] = useState('');
  const [selectedModel, setSelectedModel] = useState('stepfun/step-3.5-flash:free');
  const [isLoading, setIsLoading] = useState(false);

  const { toasts, showToast } = useToasts();
  const editorRef = useRef<any>(null);
  const findReplaceRef = useRef<HTMLDivElement>(null);
  const isGeneratingRef = useRef(false);

  // Save code to localStorage whenever it changes
  useEffect(() => {
    saveCurrentCode(currentCode);
  }, [currentCode]);

  // Save version history whenever it changes (with limit)
  useEffect(() => {
    if (versionHistory.length > 0) {
      saveVersionHistory(versionHistory);
    }
  }, [versionHistory]);

  // Register keyboard shortcuts
  useEffect(() => {
    const cleanup = registerShortcuts([
      ...defaultEditorShortcuts,
      {
        key: 'Escape',
        description: 'Close find/replace',
        action: () => {
          if (isFindReplaceVisible) {
            setIsFindReplaceVisible(false);
          }
        },
      },
    ]);

    // Custom event listeners for shortcuts
    const handleDownload = () => {
      const blob = new Blob([currentCode], { type: 'text/html' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'index.html';
      a.click();
      URL.revokeObjectURL(url);
      showToast('Code downloaded');
    };

    const handleOpenFindReplace = () => {
      setIsFindReplaceVisible(true);
    };

    const handleStopGeneration = () => {
      if (isGenerating) {
        isGeneratingRef.current = false;
        setIsGenerating(false);
        showToast('Generation stopped');
      }
    };

    document.addEventListener('download-code', handleDownload);
    document.addEventListener('open-find-replace', handleOpenFindReplace);
    document.addEventListener('stop-generation', handleStopGeneration);

    return () => {
      cleanup();
      document.removeEventListener('download-code', handleDownload);
      document.removeEventListener('open-find-replace', handleOpenFindReplace);
      document.removeEventListener('stop-generation', handleStopGeneration);
    };
  }, [currentCode, isGenerating, isFindReplaceVisible, showToast]);

  // Trap focus in find/replace modal
  useEffect(() => {
    if (isFindReplaceVisible && findReplaceRef.current) {
      const cleanup = trapFocus(findReplaceRef.current);
      return cleanup;
    }
  }, [isFindReplaceVisible]);

  const handleScroll = useCallback((e: React.UIEvent<HTMLTextAreaElement>) => {
    // Monaco handles its own scrolling
  }, []);

  const handleGenerate = async () => {
    if (!prompt.trim()) {
      showToast('Please enter a prompt');
      return;
    }

    const userMessage = currentCode
      ? `Current Code:\n${currentCode}\n\nTask: ${prompt}. Provide the FULL updated code.`
      : prompt;

    const newChatHistory = [...chatHistory, { role: 'user', parts: [{ text: userMessage }] }];
    setChatHistory(newChatHistory);

    isGeneratingRef.current = true;
    setIsGenerating(true);

    try {
      const response = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chatHistory: newChatHistory,
          systemInstruction: 'You are an expert web coder. Return ONLY the raw HTML code for a single-file website. No markdown. No explanations. Ensure Blogger compatibility (self-closing meta/link tags, CDATA for scripts/styles).',
          model: selectedModel,
        }),
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || `Server error: ${response.status}`);
      }

      const fullText = await response.text();

      if (isGeneratingRef.current) {
        // Clean up markdown
        let finalCode = fullText.replace(/^```html\n?/, '').replace(/^```\n?/, '').replace(/\n?```$/, '');
        
        // Sanitize HTML for security
        finalCode = sanitizeHtml(finalCode);
        
        setCurrentCode(finalCode);

        setVersionHistory(prev => {
          const newItem: HistoryItem = {
            prompt,
            code: finalCode,
            timestamp: new Date().toLocaleTimeString(),
          };
          // Keep only the latest MAX_VERSION_HISTORY items
          return [newItem, ...prev].slice(0, MAX_VERSION_HISTORY);
        });
        setActiveVersionIndex(0);
        setChatHistory([...newChatHistory, { role: 'model', parts: [{ text: finalCode }] }]);
        setPrompt('');
        showToast('Code generated successfully');
      }
    } catch (e) {
      const errorMsg = e instanceof Error ? e.message : 'Unknown error';
      showToast(`Error: ${errorMsg}`);
      console.error('API Error:', e);
    } finally {
      isGeneratingRef.current = false;
      setIsGenerating(false);
    }
  };

  const handleStop = useCallback(() => {
    isGeneratingRef.current = false;
    setIsGenerating(false);
  }, []);

  const handleNewProject = useCallback(() => {
    setCurrentCode('');
    setChatHistory([]);
    setVersionHistory([]);
    setPrompt('');
    setActiveVersionIndex(0);
    showToast('Project Reset');
  }, [showToast]);

  const loadVersion = useCallback((index: number) => {
    const item = versionHistory[index];
    if (!item) return;
    setCurrentCode(item.code);
    setActiveVersionIndex(index);
  }, [versionHistory]);

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(currentCode);
    showToast('Code copied');
  }, [currentCode, showToast]);

  const handleDownload = useCallback(() => {
    const blob = new Blob([currentCode], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'index.html';
    a.click();
    URL.revokeObjectURL(url);
    showToast('Code downloaded');
  }, [currentCode, showToast]);

  const handleFormatCode = useCallback(async () => {
    try {
      const formatted = await formatCode(currentCode);
      setCurrentCode(formatted);
      showToast('Code formatted');
    } catch (error) {
      showToast('Formatting failed');
    }
  }, [currentCode, showToast]);

  const handleFind = useCallback(() => {
    if (editorRef.current && findQuery) {
      // Monaco editor find action
      editorRef.current.getAction('actions.find').run();
    }
  }, [findQuery]);

  const handleReplace = useCallback(() => {
    if (editorRef.current && findQuery && replaceQuery) {
      // Monaco editor replace action
      editorRef.current.getAction('editor.action.startFindReplaceAction').run();
    }
  }, [findQuery, replaceQuery]);

  const handleEditorMount = useCallback((editor: any) => {
    editorRef.current = editor;
  }, []);

  // Accessibility: announce changes to screen readers
  useEffect(() => {
    if (currentCode) {
      // Could add more sophisticated announcements
    }
  }, [currentCode]);

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-zinc-950 text-slate-50 font-sans">
      {/* Sidebar */}
      <aside className="w-80 min-w-[320px] flex flex-col bg-zinc-900 border-r border-zinc-800 z-10" role="complementary" aria-label="Controls sidebar">
        <div className="p-4 px-5 border-b border-zinc-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <GitBranch className="w-5 h-5 text-indigo-500" aria-hidden="true" />
            <span className="font-bold text-base tracking-tight">Qaim's Coder</span>
          </div>
          <div 
            className={`w-2 h-2 rounded-full ${isGenerating ? 'bg-yellow-500' : 'bg-green-500'}`}
            aria-label={isGenerating ? 'Generating code' : 'Ready'}
          ></div>
        </div>
        
        <div className="p-4 overflow-y-auto flex-1 flex flex-col gap-4">
          <button 
            onClick={handleNewProject}
            className="w-full flex items-center justify-center gap-2 p-2.5 rounded-lg border border-dashed border-zinc-800 bg-white/5 text-sm hover:bg-white/10 hover:border-indigo-500 transition-all focus:outline-none focus:ring-2 focus:ring-indigo-500"
            aria-label="Start a new project"
          >
            <Plus className="w-4 h-4" aria-hidden="true" /> New Project
          </button>
          
          <div className="flex flex-col gap-2">
            <label className="text-xs font-semibold text-slate-400 uppercase" htmlFor="model-select">AI Model</label>
            <select
              id="model-select"
              value={selectedModel}
              onChange={(e) => setSelectedModel(e.target.value)}
              className="w-full bg-zinc-800 border border-zinc-800 rounded-lg p-3 text-sm focus:outline-none focus:border-indigo-500 transition-colors"
              aria-label="Select AI model"
            >
              <option value="stepfun/step-3.5-flash:free">StepFun 3.5 Flash (Free)</option>
              <option value="anthropic/claude-3.5-sonnet">Claude 3.5 Sonnet</option>
              <option value="openai/gpt-4o-mini">GPT-4o Mini</option>
              <option value="openai/gpt-4o">GPT-4o</option>
              <option value="google/gemini-2.0-flash-exp:free">Gemini 2.0 Flash (Free)</option>
              <option value="meta-llama/llama-3.2-3b-instruct:free">Llama 3.2 3B (Free)</option>
            </select>
          </div>
          
          <div className="flex flex-col gap-2">
            <label className="text-xs font-semibold text-slate-400 uppercase" htmlFor="prompt-input">Describe or Edit</label>
            <textarea 
              id="prompt-input"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              className="w-full min-h-[120px] bg-zinc-800 border border-zinc-800 rounded-lg p-3 text-sm resize-none focus:outline-none focus:border-indigo-500 transition-colors"
              placeholder="What should I build or change?"
              aria-describedby="prompt-help"
            />
            <div id="prompt-help" className="sr-only">Enter a description of what you want to build or changes you want to make</div>
            {!isGenerating ? (
              <button 
                onClick={handleGenerate}
                className="w-full flex items-center justify-center gap-2 p-3 rounded-lg font-semibold bg-gradient-to-br from-indigo-500 to-purple-500 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:ring-offset-zinc-900"
                aria-label="Generate code"
              >
                <Zap className="w-4 h-4" aria-hidden="true" /> Build Site
              </button>
            ) : (
              <button 
                onClick={handleStop}
                className="w-full flex items-center justify-center gap-2 p-3 rounded-lg font-semibold bg-red-500 text-white focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 focus:ring-offset-zinc-900"
                aria-label="Stop generation"
              >
                <Square className="w-4 h-4 fill-current" aria-hidden="true" /> Stop
              </button>
            )}
          </div>
          
          <div className="mt-auto pt-4 border-t border-zinc-800">
            <div className="text-xs font-semibold text-slate-400 uppercase mb-2.5">Session History</div>
            <div 
              className="flex flex-col gap-2 max-h-[200px] overflow-y-auto"
              role="list"
              aria-label="Version history"
            >
              {versionHistory.map((item, idx) => (
                <div 
                  key={idx}
                  onClick={() => loadVersion(idx)}
                  className={`p-2.5 rounded-md text-xs cursor-pointer whitespace-nowrap overflow-hidden text-ellipsis border ${activeVersionIndex === idx ? 'border-indigo-500 text-slate-50 bg-indigo-500/10' : 'border-transparent text-slate-400 bg-white/5 hover:bg-white/10 hover:text-slate-50'} focus:outline-none focus:ring-2 focus:ring-indigo-500`}
                  role="listitem"
                  tabIndex={0}
                  aria-label={`Version from ${item.timestamp}: ${item.prompt.substring(0, 30)}...`}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      loadVersion(idx);
                    }
                  }}
                >
                  <strong>{item.timestamp}</strong>: {item.prompt.substring(0, 30)}...
                </div>
              ))}
            </div>
          </div>
        </div>
      </aside>

      {/* Main Editor Panel */}
      <main className="flex-1 flex flex-col bg-zinc-950 relative" role="main">
        <div className="h-[50px] flex items-center justify-between px-5 bg-zinc-900 border-b border-zinc-800 text-sm text-slate-400">
          <span id="status" aria-live="polite">{currentCode ? 'Project Active' : 'New Project'}</span>
          <div className="flex gap-2">
            <button 
              onClick={handleFormatCode}
              className="p-1.5 rounded-md hover:bg-zinc-800 hover:text-slate-50 transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500"
              title="Format code"
              aria-label="Format code"
            >
              <span className="text-xs">Format</span>
            </button>
            <button 
              onClick={() => setIsFindReplaceVisible(true)}
              className="p-1.5 rounded-md hover:bg-zinc-800 hover:text-slate-50 transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500"
              title="Find and replace"
              aria-label="Open find and replace"
            >
              <Search className="w-4 h-4" aria-hidden="true" />
            </button>
            <button 
              onClick={handleDownload}
              className="p-1.5 rounded-md hover:bg-zinc-800 hover:text-slate-50 transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500"
              title="Download Code"
              aria-label="Download code as file"
            >
              <Download className="w-4 h-4" aria-hidden="true" />
            </button>
            <button 
              onClick={handleCopy}
              className="p-1.5 rounded-md hover:bg-zinc-800 hover:text-slate-50 transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500"
              title="Copy Code"
              aria-label="Copy code to clipboard"
            >
              <Copy className="w-4 h-4" aria-hidden="true" />
            </button>
            <button 
              onClick={() => setIsPreviewVisible(true)}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md hover:bg-zinc-800 hover:text-slate-50 transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500"
              aria-label="Preview code"
            >
              <Eye className="w-4 h-4" aria-hidden="true" /> Preview
            </button>
          </div>
        </div>
        
        <div className="flex-1 flex overflow-hidden relative">
          {/* Editor */}
          <div className="flex-1 relative">
            <Editor
              height="100%"
              defaultLanguage="html"
              value={currentCode}
              onChange={(value) => setCurrentCode(value || '')}
              theme="vs-dark"
              onMount={handleEditorMount}
              options={{
                minimap: { enabled: true },
                fontSize: 14,
                lineNumbers: 'on',
                scrollBeyondLastLine: false,
                automaticLayout: true,
                tabSize: 2,
                wordWrap: 'on',
                folding: true,
                renderWhitespace: 'selection',
                bracketPairColorization: { enabled: true },
                autoClosingTags: true,
                autoClosingBrackets: 'always',
                suggestOnTriggerCharacters: true,
                quickSuggestions: true,
              }}
              aria-label="Code editor"
            />
          </div>
        </div>

        {/* Preview Overlay */}
        {isPreviewVisible && (
          <div className="absolute inset-0 bg-white z-50 flex flex-col" role="dialog" aria-label="Preview" aria-modal="true">
            <div className="h-[50px] bg-slate-100 border-b border-slate-200 flex items-center justify-between px-5 text-slate-600">
              <button 
                onClick={() => setIsPreviewVisible(false)}
                className="p-1.5 rounded-md hover:bg-slate-200 transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500"
                aria-label="Close preview"
              >
                <X className="w-4 h-4" aria-hidden="true" />
              </button>
              <span className="font-semibold text-sm">Live Preview</span>
              <div className="w-7"></div>
            </div>
            <iframe 
              srcDoc={currentCode} 
              className="w-full h-full border-none bg-white"
              title="Preview"
              sandbox="allow-scripts allow-same-origin"
              aria-label="Website preview"
            />
          </div>
        )}

        {/* Find/Replace Modal */}
        {isFindReplaceVisible && (
          <div 
            className="absolute inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
            role="dialog"
            aria-label="Find and replace"
            aria-modal="true"
            ref={findReplaceRef}
          >
            <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-6 w-full max-w-md">
              <h2 className="text-lg font-semibold mb-4">Find & Replace</h2>
              
              <div className="space-y-4">
                <div>
                  <label htmlFor="find-input" className="block text-sm font-medium text-slate-400 mb-2">
                    Find
                  </label>
                  <input
                    id="find-input"
                    type="text"
                    value={findQuery}
                    onChange={(e) => setFindQuery(e.target.value)}
                    className="w-full bg-zinc-800 border border-zinc-800 rounded-lg p-3 text-sm focus:outline-none focus:border-indigo-500"
                    placeholder="Text to find..."
                    autoFocus
                  />
                </div>
                
                <div>
                  <label htmlFor="replace-input" className="block text-sm font-medium text-slate-400 mb-2">
                    Replace with
                  </label>
                  <input
                    id="replace-input"
                    type="text"
                    value={replaceQuery}
                    onChange={(e) => setReplaceQuery(e.target.value)}
                    className="w-full bg-zinc-800 border border-zinc-800 rounded-lg p-3 text-sm focus:outline-none focus:border-indigo-500"
                    placeholder="Replacement text..."
                  />
                </div>
              </div>

              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => {
                    if (editorRef.current && findQuery) {
                      // Monaco find
                      const model = editorRef.current.getModel();
                      const matches = model.findMatches(findQuery, true, false, false, null, true);
                      if (matches.length > 0) {
                        editorRef.current.setSelection(matches[0].range);
                        editorRef.current.revealRangeInCenter(matches[0].range);
                      }
                    }
                  }}
                  className="flex-1 flex items-center justify-center gap-2 p-2.5 rounded-lg bg-indigo-500 text-white hover:bg-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <Search className="w-4 h-4" aria-hidden="true" /> Find Next
                </button>
                <button
                  onClick={() => {
                    if (editorRef.current && findQuery && replaceQuery) {
                      const model = editorRef.current.getModel();
                      const matches = model.findMatches(findQuery, true, false, false, null, true);
                      if (matches.length > 0) {
                        editorRef.current.executeEdits('replace', [
                          {
                            range: matches[0].range,
                            text: replaceQuery,
                          },
                        ]);
                        showToast('Replaced');
                      }
                    }
                  }}
                  className="flex-1 flex items-center justify-center gap-2 p-2.5 rounded-lg bg-purple-500 text-white hover:bg-purple-600 focus:outline-none focus:ring-2 focus:ring-purple-500"
                >
                  <Replace className="w-4 h-4" aria-hidden="true" /> Replace
                </button>
              </div>

              <button
                onClick={() => {
                  setIsFindReplaceVisible(false);
                  setFindQuery('');
                  setReplaceQuery('');
                }}
                className="w-full mt-3 p-2.5 rounded-lg border border-zinc-800 text-slate-400 hover:bg-zinc-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </main>

      {/* Toasts */}
      <div 
        className="fixed bottom-5 right-5 z-[9999] flex flex-col gap-2.5"
        role="status"
        aria-live="polite"
        aria-atomic="true"
      >
        {toasts.map((toast) => (
          <div key={toast.id} className="bg-zinc-900 text-slate-50 px-5 py-3 rounded-lg border-l-4 border-indigo-500 shadow-lg">
            {toast.message}
          </div>
        ))}
      </div>
    </div>
  );
}
