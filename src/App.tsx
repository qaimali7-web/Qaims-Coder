import React, { useState, useRef, useEffect, useCallback } from 'react';
import { GitBranch, Plus, Zap, Square, Download, Copy, Eye, X, Search, Replace, Code2, Image as ImageIcon, MessageSquare } from 'lucide-react';
import Editor from '@monaco-editor/react';
import { formatCode } from './utils/codeformatter';
import { saveVersionHistory, loadVersionHistory, saveCurrentCode, loadCurrentCode, MAX_VERSION_HISTORY } from './utils/storage';
import { validateOpenRouterApiKey, sanitizeHtml } from './utils/validation';
import { useToasts } from './hooks/usetoasts';
import { useCodeEditor } from './hooks/usecodeeditor';
import { useConvex } from './hooks/useConvex';
import { registerShortcuts, defaultEditorShortcuts } from './utils/keyboardshortcuts';
import { trapFocus, generateUniqueId } from './utils/accessibility';
import { AgentSelector, AgentType } from './components/agents/AgentSelector';
import { CodeAssistant } from './components/agents/CodeAssistant';
import { ImageGenerator } from './components/agents/ImageGenerator';
import { GeneralChat } from './components/agents/GeneralChat';
import { FileExplorer } from './components/FileExplorer';
import { LoadingProgress } from './components/LoadingProgress';
import { ProjectFile, GenerationProgress, ApiError } from './types';

interface HistoryItem {
  prompt: string;
  code: string;
  timestamp: string;
}

export default function App() {
  const [currentAgent, setCurrentAgent] = useState<AgentType>('website');
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
  const [currentProjectId, setCurrentProjectId] = useState<string>(() => {
    const saved = localStorage.getItem('currentProjectId');
    return saved || `project-${Date.now()}`;
  });
  
  // Multi-file project state
  const [projectFiles, setProjectFiles] = useState<ProjectFile[]>([]);
  const [activeFile, setActiveFile] = useState<string | null>(null);
  const [generationProgress, setGenerationProgress] = useState<GenerationProgress | null>(null);
  const [generationError, setGenerationError] = useState<ApiError | null>(null);

  const { toasts, showToast } = useToasts();
  const { storeProjectFiles, createProjectManifest } = useConvex();
  const editorRef = useRef<any>(null);
  const findReplaceRef = useRef<HTMLDivElement>(null);
  const isGeneratingRef = useRef(false);

  useEffect(() => {
    saveCurrentCode(currentCode);
  }, [currentCode]);

  useEffect(() => {
    if (versionHistory.length > 0) {
      saveVersionHistory(versionHistory);
    }
  }, [versionHistory]);

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

  useEffect(() => {
    if (isFindReplaceVisible && findReplaceRef.current) {
      const cleanup = trapFocus(findReplaceRef.current);
      return cleanup;
    }
  }, [isFindReplaceVisible]);

  const handleScroll = useCallback((e: React.UIEvent<HTMLTextAreaElement>) => {
  }, []);

  const handleEditorMount = useCallback((editor: any) => {
    editorRef.current = editor;
  }, []);

  // Helper to determine language from file path
  const getLanguageFromPath = (path: string): string => {
    if (path.endsWith('.html')) return 'html';
    if (path.endsWith('.css')) return 'css';
    if (path.endsWith('.js')) return 'javascript';
    if (path.endsWith('.ts')) return 'typescript';
    if (path.endsWith('.json')) return 'json';
    return 'text';
  };

  // Handle file selection from explorer
  const handleFileSelect = (path: string) => {
    const file = projectFiles.find(f => f.path === path);
    if (file) {
      setActiveFile(path);
      setCurrentCode(file.content);
    }
  };

  // Website Builder - Generate code using new Project Architect flow
  const handleGenerateWebsite = async () => {
    if (!prompt.trim()) {
      showToast('Please enter a prompt');
      return;
    }

    isGeneratingRef.current = true;
    setIsGenerating(true);
    setGenerationError(null);
    setProjectFiles([]);
    setActiveFile(null);

    try {
      const response = await fetch('/api/build-site', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: prompt.trim(),
          projectId: currentProjectId,
          model: selectedModel,
        }),
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || `Server error: ${response.status}`);
      }

      if (!response.body) {
        throw new Error('No response body');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));
              
              switch (data.type) {
                case 'progress':
                  setGenerationProgress(data.progress);
                  break;
                  
                case 'file_complete':
                  setProjectFiles(prev => [...prev, {
                    path: data.filePath,
                    content: data.content,
                    language: getLanguageFromPath(data.filePath),
                    isMain: data.filePath === 'index.html',
                    order: projectFiles.length,
                  }]);
                  if (!activeFile) {
                    setActiveFile(data.filePath);
                    setCurrentCode(data.content);
                  }
                  break;
                  
                case 'complete':
                  setGenerationProgress({
                    ...data.progress,
                    stage: 'complete',
                    percentage: 100,
                  });
                  
                  // Store in Convex (frontend handles storage)
                  try {
                    if (storeProjectFiles && createProjectManifest) {
                      // Create project manifest first
                      await createProjectManifest(currentProjectId, prompt, selectedModel);
                      
                      // Store all project files
                      await storeProjectFiles(currentProjectId, data.files, '');
                    }
                  } catch (err) {
                    console.warn('Failed to store files in Convex:', err);
                    // Don't fail the generation if storage fails
                  }
                  
                  const mainFile = data.files.find((f: any) => f.isMain);
                  if (mainFile) {
                    setVersionHistory(prev => {
                      const newItem: HistoryItem = {
                        prompt,
                        code: mainFile.content,
                        timestamp: new Date().toLocaleTimeString(),
                      };
                      return [newItem, ...prev].slice(0, MAX_VERSION_HISTORY);
                    });
                  }
                  
                  setPrompt('');
                  showToast('Project generated successfully');
                  isGeneratingRef.current = false;
                  setIsGenerating(false);
                  break;
                  
                case 'error':
                  setGenerationError(data.error);
                  showToast(`Error: ${data.error.message}`);
                  isGeneratingRef.current = false;
                  setIsGenerating(false);
                  break;
              }
            } catch (e) {
              console.error('Failed to parse SSE data:', e);
            }
          }
        }
      }
    } catch (e) {
      const errorMsg = e instanceof Error ? e.message : 'Unknown error';
      setGenerationError({
        type: 'unknown',
        message: errorMsg,
      });
      showToast(`Error: ${errorMsg}`);
      console.error('API Error:', e);
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
    setProjectFiles([]);
    setActiveFile(null);
    setGenerationProgress(null);
    setGenerationError(null);
    const newProjectId = `project-${Date.now()}`;
    setCurrentProjectId(newProjectId);
    localStorage.setItem('currentProjectId', newProjectId);
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
      const model = editorRef.current.getModel();
      const matches = model.findMatches(findQuery, true, false, false, null, true);
      if (matches.length > 0) {
        editorRef.current.setSelection(matches[0].range);
        editorRef.current.revealRangeInCenter(matches[0].range);
      }
    }
  }, [findQuery]);

  const handleReplace = useCallback(() => {
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
  }, [findQuery, replaceQuery, showToast]);

  const handleAgentChange = (agent: AgentType) => {
    setCurrentAgent(agent);
    setPrompt('');
    setCurrentCode('');
    setChatHistory([]);
    setVersionHistory([]);
    setActiveVersionIndex(0);
    setCurrentProjectId(null);
    setProjectFiles([]);
    setActiveFile(null);
    setGenerationProgress(null);
    setGenerationError(null);
    showToast(`Switched to ${agent === 'website' ? 'Website Builder' : agent === 'code' ? 'Code Assistant' : agent === 'image' ? 'Image Generator' : 'General Chat'}`);
  };

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-zinc-950 text-slate-50 font-sans">
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
          <AgentSelector
            currentAgent={currentAgent}
            onAgentChange={handleAgentChange}
          />

          {currentAgent === 'website' && (
            <>
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
                    onClick={handleGenerateWebsite}
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
            </>
          )}

          {currentAgent === 'code' && (
            <div className="flex-1 flex flex-col">
              <CodeAssistant
                projectId={currentProjectId}
                onNewConversation={handleNewProject}
              />
            </div>
          )}

          {currentAgent === 'image' && (
            <div className="flex-1 flex flex-col">
              <ImageGenerator
                projectId={currentProjectId}
                onNewProject={handleNewProject}
              />
            </div>
          )}

          {currentAgent === 'chat' && (
            <div className="flex-1 flex flex-col">
              <GeneralChat
                projectId={currentProjectId}
                onNewProject={handleNewProject}
              />
            </div>
          )}
        </div>
      </aside>

      {currentAgent === 'website' && (
        <main className="flex-1 flex flex-col bg-zinc-950 relative" role="main">
          <LoadingProgress
            progress={generationProgress}
            isGenerating={isGenerating}
            error={generationError?.message || null}
          />

          <div className="h-[50px] flex items-center justify-between px-5 bg-zinc-900 border-b border-zinc-800 text-sm text-slate-400">
            <span id="status" aria-live="polite">
              {projectFiles.length > 0 
                ? `${projectFiles.length} file${projectFiles.length !== 1 ? 's' : ''} • ${activeFile || 'No file selected'}`
                : currentCode ? 'Project Active' : 'New Project'
              }
            </span>
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
            {projectFiles.length > 0 && (
              <FileExplorer
                files={projectFiles}
                activeFile={activeFile}
                onFileSelect={handleFileSelect}
              />
            )}
            
            <div className="flex-1 relative">
              <Editor
                height="100%"
                defaultLanguage={activeFile ? getLanguageFromPath(activeFile) : 'html'}
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
      )}
    </div>
  );
}
