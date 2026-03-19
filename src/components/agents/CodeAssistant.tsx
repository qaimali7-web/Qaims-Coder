// src/components/agents/CodeAssistant.tsx
import React, { useState, useRef, useEffect, useCallback } from 'react';
import Editor from '@monaco-editor/react';
import { Copy, Check, Send, Loader2, Code2, Play, Terminal } from 'lucide-react';
import { useConvex } from '../../hooks/useConvex';
import { useToasts } from '../../hooks/usetoasts';

interface CodeAssistantProps {
  projectId: string;
  conversationId?: string;
  onNewConversation?: () => void;
}

interface Message {
  role: 'user' | 'assistant';
  content: string;
  codeBlocks?: Array<{ language: string; code: string }>;
  timestamp: number;
}

export const CodeAssistant: React.FC<CodeAssistantProps> = ({
  projectId,
  conversationId,
  onNewConversation
}) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [selectedLanguage, setSelectedLanguage] = useState('auto');
  const [executeCode, setExecuteCode] = useState(false);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [executionResults, setExecutionResults] = useState<Array<{code: string, output: string, error?: string}>>([]);
   
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const { storeGeneration } = useConvex();
  const { showToast } = useToasts();

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMessage: Message = {
      role: 'user',
      content: input.trim(),
      timestamp: Date.now(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      const response = await fetch('/api/chat/code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [...messages, userMessage].map(m => ({
            role: m.role,
            content: m.content
          })),
          model: 'anthropic/claude-3.5-sonnet',
          language: selectedLanguage === 'auto' ? undefined : selectedLanguage,
          executeCode,
          projectId,
        }),
      });

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }

      const data = await response.json();

      const assistantMessage: Message = {
        role: 'assistant',
        content: data.message,
        codeBlocks: data.codeBlocks,
        timestamp: Date.now(),
      };

      setMessages(prev => [...prev, assistantMessage]);

      // Store generation in Convex if code was generated
      if (data.codeBlocks && data.codeBlocks.length > 0) {
        for (const block of data.codeBlocks) {
          await storeGeneration(projectId, input.trim(), block.code, data.model);
        }
      }

    } catch (error) {
      console.error('Code assistant error:', error);
      const errorMessage: Message = {
        role: 'assistant',
        content: `Error: ${error instanceof Error ? error.message : 'Failed to get response'}`,
        timestamp: Date.now(),
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopyCode = async (code: string, index: number) => {
    try {
      await navigator.clipboard.writeText(code);
      setCopiedIndex(index);
      setTimeout(() => setCopiedIndex(null), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const executeCodeInSandbox = useCallback((code: string, language: string) => {
    return new Promise<{output: string, error?: string}>((resolve) => {
      // For HTML/JavaScript, use iframe sandbox
      if (language === 'html' || language === 'javascript' || language === 'auto') {
        const iframe = document.createElement('iframe');
        iframe.style.width = '100%';
        iframe.style.height = '400px';
        iframe.style.border = '1px solid #333';
        iframe.sandbox = 'allow-scripts allow-same-origin allow-forms';
        
        const result = { output: '', error: '' };
        
        // Capture console output
        const script = `
          <script>
            const originalLog = console.log;
            const originalError = console.error;
            const originalWarn = console.warn;
            
            window.onerror = function(msg, url, line) {
              window.parent.postMessage({type: 'error', message: msg + ' (line ' + line + ')'}, '*');
            };
            
            console.log = function(...args) {
              originalLog.apply(console, args);
              window.parent.postMessage({type: 'log', message: args.join(' ')}, '*');
            };
            
            console.error = function(...args) {
              originalError.apply(console, args);
              window.parent.postMessage({type: 'error', message: args.join(' ')}, '*');
            };
            
            console.warn = function(...args) {
              originalWarn.apply(console, args);
              window.parent.postMessage({type: 'warn', message: args.join(' ')}, '*');
            };
            
            try {
              document.body.innerHTML = \`<div style="padding: 20px; font-family: sans-serif;">\${document.body.innerHTML || 'Ready'}</div>\`;
            } catch (e) {
              window.parent.postMessage({type: 'error', message: e.message}, '*');
            }
          <\/script>
        `;
        
        const htmlContent = `
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Code Execution</title>
            <style>
              body {
                margin: 0;
                padding: 0;
                background: #1e1e1e;
                color: #fff;
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
              }
              .output {
                background: #0d1117;
                border-top: 1px solid #333;
                padding: 10px;
                margin-top: 10px;
                font-family: 'Monaco', 'Menlo', monospace;
                font-size: 12px;
                max-height: 200px;
                overflow-y: auto;
              }
              .log { color: #58a6ff; }
              .error { color: #f85149; }
              .warn { color: #d29922; }
            </style>
          </head>
          <body>
            <div id="app"></div>
            <div class="output" id="output"></div>
            ${script}
            <script>
              // Listen for messages from the parent
              window.addEventListener('message', (event) => {
                if (event.data.type === 'execute') {
                  const output = document.getElementById('output');
                  output.innerHTML = '';
                  
                  try {
                    // Execute the code
                    const result = eval(event.data.code);
                    if (result !== undefined) {
                      console.log('Result:', result);
                    }
                  } catch (e) {
                    console.error(e.message);
                  }
                }
              });
              
              // Notify parent that iframe is ready
              window.parent.postMessage({type: 'ready'}, '*');
            <\/script>
          </body>
          </html>
        `;
        
        // Set up message listener
        const handleMessage = (e: MessageEvent) => {
          if (e.data.type === 'log') {
            result.output += e.data.message + '\n';
          } else if (e.data.type === 'error') {
            result.error = e.data.message;
          } else if (e.data.type === 'ready') {
            // Execute code when iframe is ready
            iframe.contentWindow?.postMessage({type: 'execute', code}, '*');
          }
        };
        
        window.addEventListener('message', handleMessage);
        
        // Write the HTML to the iframe
        const doc = iframe.contentDocument || iframe.contentWindow?.document;
        if (doc) {
          doc.open();
          doc.write(htmlContent);
          doc.close();
        }
        
        // Clean up after 5 seconds
        setTimeout(() => {
          window.removeEventListener('message', handleMessage);
          if (iframe.parentNode) {
            iframe.parentNode.removeChild(iframe);
          }
          resolve(result);
        }, 5000);
      } else {
        // For other languages, return a message
        resolve({
          output: `Execution for ${language} is not yet supported. Only HTML/JavaScript can be executed in the browser sandbox.`,
          error: ''
        });
      }
    });
  }, []);

  const handleExecuteCode = useCallback(async (code: string, language: string) => {
    try {
      const result = await executeCodeInSandbox(code, language);
      setExecutionResults(prev => [...prev, { code, ...result }]);
      return result;
    } catch (err) {
      setExecutionResults(prev => [...prev, {
        code,
        output: '',
        error: err instanceof Error ? err.message : 'Execution failed'
      }]);
      return { output: '', error: err instanceof Error ? err.message : 'Execution failed' };
    }
  }, [executeCodeInSandbox]);

  const LANGUAGES = [
    { value: 'auto', label: 'Auto' },
    { value: 'python', label: 'Python' },
    { value: 'javascript', label: 'JavaScript' },
    { value: 'typescript', label: 'TypeScript' },
    { value: 'java', label: 'Java' },
    { value: 'cpp', label: 'C++' },
    { value: 'go', label: 'Go' },
    { value: 'rust', label: 'Rust' },
    { value: 'html', label: 'HTML' },
    { value: 'css', label: 'CSS' },
    { value: 'sql', label: 'SQL' },
  ];

  return (
    <div className="flex flex-col h-full bg-zinc-950">
      {/* Header */}
      <div className="h-[50px] flex items-center justify-between px-5 bg-zinc-900 border-b border-zinc-800">
        <div className="flex items-center gap-2">
          <Code2 className="w-5 h-5 text-indigo-500" aria-hidden="true" />
          <span className="font-semibold text-sm text-slate-50">Code Assistant</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={onNewConversation}
            className="px-3 py-1.5 text-xs font-medium bg-zinc-800 hover:bg-zinc-700 rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            New Chat
          </button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 && (
          <div className="text-center text-slate-500 mt-10">
            <Code2 className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <h3 className="text-lg font-semibold mb-2">Code Assistant</h3>
            <p className="text-sm max-w-md mx-auto">
              Ask me to write, debug, or explain code in any programming language.
              I can help with Python, JavaScript, TypeScript, Java, C++, Go, Rust, and more.
            </p>
          </div>
        )}

        {messages.map((message, idx) => (
          <div
            key={idx}
            className={`flex flex-col ${message.role === 'user' ? 'items-end' : 'items-start'}`}
          >
            <div
              className={`max-w-[80%] rounded-lg p-4 ${
                message.role === 'user'
                  ? 'bg-indigo-500 text-white'
                  : 'bg-zinc-800 text-slate-50'
              }`}
            >
              <p className="whitespace-pre-wrap text-sm">{message.content}</p>
            </div>

            {/* Code blocks */}
            {message.codeBlocks && message.codeBlocks.length > 0 && (
              <div className="mt-2 w-full space-y-2">
                {message.codeBlocks.map((block, blockIdx) => (
                  <div key={blockIdx} className="relative group">
                    <div className="absolute top-2 right-2 z-10 flex gap-1">
                      <button
                        onClick={() => handleCopyCode(block.code, blockIdx)}
                        className="p-1.5 bg-zinc-700 hover:bg-zinc-600 rounded-md transition-colors"
                        title="Copy code"
                      >
                        {copiedIndex === blockIdx ? (
                          <Check className="w-4 h-4 text-green-400" />
                        ) : (
                          <Copy className="w-4 h-4 text-slate-300" />
                        )}
                      </button>
                    </div>
                    <div className="rounded-lg overflow-hidden border border-zinc-700">
                      <div className="bg-zinc-800 px-3 py-1.5 text-xs font-mono text-slate-400">
                        {block.language}
                      </div>
                      <Editor
                        height="200px"
                        defaultLanguage={block.language}
                        value={block.code}
                        theme="vs-dark"
                        options={{
                          readOnly: true,
                          minimap: { enabled: false },
                          fontSize: 12,
                          lineNumbers: 'on',
                          scrollBeyondLastLine: false,
                          automaticLayout: true,
                          wordWrap: 'on',
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="text-xs text-slate-500 mt-1 px-2">
              {new Date(message.timestamp).toLocaleTimeString()}
            </div>
          </div>
        ))}

        {isLoading && (
          <div className="flex items-center gap-2 text-slate-400">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span className="text-sm">Thinking...</span>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Execution Results */}
      {executionResults.length > 0 && (
        <div className="border-t border-zinc-800 bg-zinc-900 p-4 space-y-3">
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-400 uppercase">
            <Terminal className="w-4 h-4" />
            Execution Output
          </div>
          {executionResults.map((result, idx) => (
            <div key={idx} className="bg-zinc-800 rounded-lg p-3 border border-zinc-700">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-slate-400">Execution {idx + 1}</span>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(result.code);
                    showToast('Code copied');
                  }}
                  className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors"
                >
                  Copy code
                </button>
              </div>
              <div className="bg-black rounded p-2 font-mono text-xs max-h-32 overflow-y-auto">
                <pre className="text-slate-300 whitespace-pre-wrap">{result.code}</pre>
              </div>
              {result.output && (
                <div className="mt-2 bg-green-900/20 border border-green-800 rounded p-2">
                  <div className="text-xs text-green-400 font-mono whitespace-pre-wrap">{result.output}</div>
                </div>
              )}
              {result.error && (
                <div className="mt-2 bg-red-900/20 border border-red-800 rounded p-2">
                  <div className="text-xs text-red-400 font-mono whitespace-pre-wrap">{result.error}</div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Input Form */}
      <form onSubmit={handleSubmit} className="p-4 border-t border-zinc-800 bg-zinc-900">
        <div className="flex flex-col gap-3">
          <div className="flex gap-2">
            <select
              value={selectedLanguage}
              onChange={(e) => setSelectedLanguage(e.target.value)}
              className="bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500"
              aria-label="Select language"
            >
              {LANGUAGES.map(lang => (
                <option key={lang.value} value={lang.value}>{lang.label}</option>
              ))}
            </select>
            <label className="flex items-center gap-2 px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm cursor-pointer hover:bg-zinc-700">
              <input
                type="checkbox"
                checked={executeCode}
                onChange={(e) => setExecuteCode(e.target.checked)}
                className="rounded"
              />
              <span>Execute code</span>
            </label>
          </div>
          <div className="flex gap-2">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask a coding question or request code..."
              className="flex-1 bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-indigo-500"
              disabled={isLoading}
            />
            <button
              type="submit"
              disabled={isLoading || !input.trim()}
              className="px-4 py-2.5 bg-indigo-500 hover:bg-indigo-600 disabled:bg-zinc-700 disabled:cursor-not-allowed rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500"
              aria-label="Send message"
            >
              {isLoading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <Send className="w-5 h-5" />
              )}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
};
