import React, { useState, useRef, useEffect, useCallback } from 'react';
import { GitBranch, Plus, Zap, Square, Download, Copy, Eye, X, Search, Replace, Code2, Image as ImageIcon, MessageSquare } from 'lucide-react';
import Editor from '@monaco-editor/react';
import { formatCode } from './utils/codeformatter';
import { saveVersionHistory, loadVersionHistory, saveCurrentCode, loadCurrentCode, MAX_VERSION_HISTORY } from './utils/storage';
import { validateOpenRouterApiKey, sanitizeHtml } from './utils/validation';
import { useToasts } from './hooks/usetoasts';
import { useCodeEditor } from './hooks/usecodeeditor';
import { useConvex } from './hooks/useConvex';
import { useLogger } from './hooks/useLogger';
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
  
  // Track streaming file content
  const streamingFileContent = useRef<Map<string, string>>(new Map());

  const { toasts, showToast } = useToasts();
  const { storeProjectFiles, createProjectManifest } = useConvex();
  const { logs, downloadLogs, info, warn, error: logError, debug } = useLogger();
  const editorRef = useRef<any>(null);
  const findReplaceRef = useRef<HTMLDivElement>(null);
  const isGeneratingRef = useRef(false);

  // Log app lifecycle events
  useEffect(() => {
    info('App', 'Component mounted');
    debug('App', 'Initial state', {
      currentAgent,
      currentProjectId,
      versionHistoryLength: versionHistory.length,
    });

    return () => {
      info('App', 'Component unmounting');
    };
  }, []);

  useEffect(() => {
    saveCurrentCode(currentCode);
    debug('App', 'Current code updated', { length: currentCode.length });
  }, [currentCode]);

  useEffect(() => {
    if (versionHistory.length > 0) {
      saveVersionHistory(versionHistory);
      debug('App', 'Version history updated', { count: versionHistory.length });
    }
  }, [versionHistory]);

  useEffect(() => {
    debug('App', 'Registering keyboard shortcuts');
    const cleanup = registerShortcuts([
      ...defaultEditorShortcuts,
      {
        key: 'Escape',
        description: 'Close find/replace',
        action: () => {
          if (isFindReplaceVisible) {
            debug('App', 'Escape pressed - closing find/replace');
            setIsFindReplaceVisible(false);
          }
        },
      },
    ]);

    const handleDownload = () => {
      debug('App', 'Keyboard shortcut: download-code');
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
      debug('App', 'Keyboard shortcut: open-find-replace');
      setIsFindReplaceVisible(true);
    };

    const handleStopGeneration = () => {
      if (isGenerating) {
        debug('App', 'Keyboard shortcut: stop-generation');
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
      debug('App', 'Keyboard shortcuts cleaned up');
    };
  }, [currentCode, isGenerating, isFindReplaceVisible, showToast, debug]);

  useEffect(() => {
    if (isFindReplaceVisible && findReplaceRef.current) {
      debug('App', 'Find/replace opened, trapping focus');
      const cleanup = trapFocus(findReplaceRef.current);
      return () => {
        debug('App', 'Find/replace focus trap cleanup');
      };
    }
  }, [isFindReplaceVisible, debug]);

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
    debug('App', 'File selected', { path });
    
    // Check if this file is currently being streamed
    const streamingContent = streamingFileContent.current.get(path);
    if (streamingContent) {
      debug('App', 'Selecting streaming file', { path, contentLength: streamingContent.length });
      setActiveFile(path);
      setCurrentCode(streamingContent);
    } else {
      const file = projectFiles.find(f => f.path === path);
      if (file) {
        debug('App', 'Selecting completed file', { path, contentLength: file.content.length });
        setActiveFile(path);
        setCurrentCode(file.content);
      } else {
        warn('App', 'Selected file not found', { path });
      }
    }
  };

  // Website Builder - Generate code using new Project Architect flow
  const handleGenerateWebsite = async () => {
    if (!prompt.trim()) {
      showToast('Please enter a prompt');
      warn('App', 'Generate attempted with empty prompt');
      return;
    }

    info('App', 'Starting website generation', {
      prompt: prompt.substring(0, 100),
      projectId: currentProjectId,
      model: selectedModel
    });
    
    isGeneratingRef.current = true;
    setIsGenerating(true);
    setGenerationError(null);
    setProjectFiles([]);
    setActiveFile(null);
    streamingFileContent.current.clear();

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
                  debug('App', 'Generation progress', data.progress);
                  setGenerationProgress(data.progress);
                  break;
                  
                case 'file_chunk':
                  // Accumulate streaming content for this file
                  const currentChunk = streamingFileContent.current.get(data.filePath) || '';
                  const newContent = currentChunk + data.chunk;
                  streamingFileContent.current.set(data.filePath, newContent);
                  
                  debug('App', 'File chunk received', {
                    filePath: data.filePath,
                    chunkLength: data.chunk.length,
                    totalLength: newContent.length,
                  });
                  
                  // Update current code if this is the active file
                  if (data.filePath === activeFile) {
                    setCurrentCode(newContent);
                  }
                  break;
                  
                case 'file_complete':
                  const completeContent = data.content;
                  debug('App', 'File complete', {
                    filePath: data.filePath,
                    contentLength: completeContent.length,
                  });
                  
                  setProjectFiles(prev => [...prev, {
                    path: data.filePath,
                    content: completeContent,
                    language: getLanguageFromPath(data.filePath),
                    isMain: data.filePath === 'index.html',
                    order: projectFiles.length,
                  }]);
                  
                  // Clear streaming cache for this file
                  streamingFileContent.current.delete(data.filePath);
                  
                  if (!activeFile) {
                    setActiveFile(data.filePath);
                    setCurrentCode(completeContent);
                  }
                  break;
                  
                case 'complete':
                  info('App', 'Generation complete', {
                    fileCount: data.files.length,
                    manifest: data.manifest
                  });
                  
                  setGenerationProgress({
                    ...data.progress,
                    stage: 'complete',
                    percentage: 100,
                  });
                  
                  // Store in Convex (frontend handles storage)
                  try {
                    if (storeProjectFiles && createProjectManifest) {
                      debug('App', 'Storing files in Convex');
                      // Create project manifest first
                      await createProjectManifest(currentProjectId, prompt, selectedModel);
                      
                      // Store all project files
                      await storeProjectFiles(currentProjectId, data.files, '');
                      info('App', 'Files stored in Convex successfully');
                    }
                  } catch (err: any) {
                    logError('App', 'Failed to store files in Convex', err);
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
                    debug('App', 'Version history updated', { historyCount: versionHistory.length + 1 });
                  }
                  
                  setPrompt('');
                  showToast('Project generated successfully');
                  isGeneratingRef.current = false;
                  setIsGenerating(false);
                  break;
                  
                case 'error':
                  logError('App', 'Generation error', data.error);
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
    info('App', 'New project created', {
      oldProjectId: currentProjectId,
      newProjectId: `project-${Date.now()}`
    });
    
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
  }, [showToast, info, currentProjectId]);

  const loadVersion = useCallback((index: number) => {
    const item = versionHistory[index];
    if (!item) {
      warn('App', 'Attempted to load non-existent version', { index });
      return;
    }
    debug('App', 'Loading version', { index, timestamp: item.timestamp, codeLength: item.code.length });
    setCurrentCode(item.code);
    setActiveVersionIndex(index);
  }, [versionHistory, warn, debug]);

  const handleCopy = useCallback(() => {
    debug('App', 'Copy code clicked', { codeLength: currentCode.length });
    navigator.clipboard.writeText(currentCode);
    showToast('Code copied');
  }, [currentCode, showToast, debug]);

  const handleDownload = useCallback(() => {
    debug('App', 'Download code clicked', { codeLength: currentCode.length });
    const blob = new Blob([currentCode], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'index.html';
    a.click();
    URL.revokeObjectURL(url);
    showToast('Code downloaded');
  }, [currentCode, showToast, debug]);

  const handleFormatCode = useCallback(async () => {
    debug('App', 'Format code clicked', { codeLength: currentCode.length });
    try {
      const formatted = await formatCode(currentCode);
      setCurrentCode(formatted);
      showToast('Code formatted');
      info('App', 'Code formatted successfully', { originalLength: currentCode.length, formattedLength: formatted.length });
    } catch (error: any) {
      logError('App', 'Formatting failed', error);
      showToast('Formatting failed');
    }
  }, [currentCode, showToast, info, logError, debug]);

  const handleFind = useCallback(() => {
    debug('App', 'Find clicked', { query: findQuery });
    if (editorRef.current && findQuery) {
      const model = editorRef.current.getModel();
      const matches = model.findMatches(findQuery, true, false, false, null, true);
      if (matches.length > 0) {
        editorRef.current.setSelection(matches[0].range);
        editorRef.current.revealRangeInCenter(matches[0].range);
        debug('App', 'Find results', { matches: matches.length });
      } else {
        debug('App', 'No matches found');
     }
    }
  }, [findQuery, debug]);

  const handleReplace = useCallback(() => {
    debug('App', 'Replace clicked', { find: findQuery, replace: replaceQuery });
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
        info('App', 'Replace executed', { matches: matches.length });
      } else {
        debug('App', 'No matches to replace');
      }
    }
  }, [findQuery, replaceQuery, showToast, info, debug]);

  const handleAgentChange = (agent: AgentType) => {
    info('App', 'Agent changed', { from: currentAgent, to: agent });
    
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
    
    const agentNames = {
      website: 'Website Builder',
      code: 'Code Assistant',
      image: 'Image Generator',
      chat: 'General Chat'
    };
    showToast(`Switched to ${agentNames[agent]}`);
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

          {/* Download Logs Button */}
          <button
            onClick={downloadLogs}
            className="w-full flex items-center justify-center gap-2 p-2.5 rounded-lg border border-dashed border-zinc-800 bg-white/5 text-sm hover:bg-white/10 hover:border-indigo-500 transition-all focus:outline-none focus:ring-2 focus:ring-indigo-500"
            aria-label="Download logs"
            title={`Download ${logs.length} log entries`}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            Download Logs ({logs.length})
          </button>

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
                  onChange={(e) => {
                    debug('App', 'Model changed', { from: selectedModel, to: e.target.value });
                    setSelectedModel(e.target.value);
                  }}
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
                  onChange={(e) => {
                    debug('App', 'Prompt changed', {
                      oldLength: prompt.length,
                      newLength: e.target.value.length
                    });
                    setPrompt(e.target.value);
                  }}
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
                onClick={() => {
                  debug('App', 'Preview opened');
                  setIsPreviewVisible(true);
                }}
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
                onChange={(value) => {
                  debug('App', 'Editor content changed', {
                    activeFile,
                    newLength: value?.length || 0,
                    changeType: value && currentCode ? (value.length > currentCode.length ? 'added' : 'removed') : 'initial'
                  });
                  setCurrentCode(value || '');
                }}
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
                  onClick={() => {
                    debug('App', 'Preview closed');
                    setIsPreviewVisible(false);
                  }}
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
                      onChange={(e) => {
                        debug('App', 'Find query changed', { old: findQuery, new: e.target.value });
                        setFindQuery(e.target.value);
                      }}
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
                      onChange={(e) => {
                        debug('App', 'Replace query changed', { old: replaceQuery, new: e.target.value });
                        setReplaceQuery(e.target.value);
                      }}
                      className="w-full bg-zinc-800 border border-zinc-800 rounded-lg p-3 text-sm focus:outline-none focus:border-indigo-500"
                      placeholder="Replacement text..."
                    />
                  </div>
                </div>

                <div className="flex gap-3 mt-6">
                  <button
                    onClick={() => {
                      debug('App', 'Find Next clicked', { query: findQuery });
                      if (editorRef.current && findQuery) {
                        const model = editorRef.current.getModel();
                        const matches = model.findMatches(findQuery, true, false, false, null, true);
                        if (matches.length > 0) {
                          editorRef.current.setSelection(matches[0].range);
                          editorRef.current.revealRangeInCenter(matches[0].range);
                          debug('App', 'Find result', { matches: matches.length });
                        } else {
                          debug('App', 'No matches found');
                        }
                      }
                    }}
                    className="flex-1 flex items-center justify-center gap-2 p-2.5 rounded-lg bg-indigo-500 text-white hover:bg-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <Search className="w-4 h-4" aria-hidden="true" /> Find Next
                  </button>
                  <button
                    onClick={() => {
                      debug('App', 'Replace clicked', { find: findQuery, replace: replaceQuery });
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
                          info('App', 'Replace executed', { matches: matches.length });
                        } else {
                          debug('App', 'No matches to replace');
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
                    debug('App', 'Find/Replace cancelled');
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
