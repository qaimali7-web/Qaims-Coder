import React, { useState, useRef, useEffect } from 'react';
import { GitBranch, Plus, Zap, Square, Download, Copy, Eye, X } from 'lucide-react';
import Prism from 'prismjs';
import 'prismjs/themes/prism-tomorrow.css';
import { Analytics } from '@vercel/analytics/react';

interface HistoryItem {
  prompt: string;
  code: string;
  timestamp: string;
}

export default function App() {
  const [prompt, setPrompt] = useState('');
  const [currentCode, setCurrentCode] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [chatHistory, setChatHistory] = useState<any[]>([]);
  const [versionHistory, setVersionHistory] = useState<HistoryItem[]>([]);
  const [activeVersionIndex, setActiveVersionIndex] = useState<number>(0);
  const [isPreviewVisible, setIsPreviewVisible] = useState(false);
  const [toasts, setToasts] = useState<string[]>([]);
  const [selectedModel, setSelectedModel] = useState('stepfun/step-3.5-flash:free');

  const codeInputRef = useRef<HTMLTextAreaElement>(null);
  const preRef = useRef<HTMLPreElement>(null);
  const lineNumbersRef = useRef<HTMLDivElement>(null);
  const isGeneratingRef = useRef(false);

  const showToast = (msg: string) => {
    setToasts((prev) => [...prev, msg]);
    setTimeout(() => {
      setToasts((prev) => prev.slice(1));
    }, 3000);
  };

  const handleScroll = (e: React.UIEvent<HTMLTextAreaElement>) => {
    const target = e.target as HTMLTextAreaElement;
    if (preRef.current) {
      preRef.current.scrollTop = target.scrollTop;
      preRef.current.scrollLeft = target.scrollLeft;
    }
    if (lineNumbersRef.current) {
      lineNumbersRef.current.scrollTop = target.scrollTop;
    }
  };

  const handleGenerate = async () => {
    if (!prompt.trim()) {
      showToast("Please enter a prompt");
      return;
    }

    const userMessage = currentCode
      ? `Current Code:\n${currentCode}\n\nTask: ${prompt}. Provide the FULL updated code.`
      : prompt;

    const newChatHistory = [...chatHistory, { role: "user", parts: [{ text: userMessage }] }];
    setChatHistory(newChatHistory);

    isGeneratingRef.current = true;
    setIsGenerating(true);

    try {
      const response = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chatHistory: newChatHistory,
          systemInstruction: "You are an expert web coder. Return ONLY the raw HTML code for a single-file website. No markdown. No explanations. Ensure Blogger compatibility (self-closing meta/link tags, CDATA for scripts/styles).",
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
        let finalCode = fullText.replace(/^```html\n?/, "").replace(/^```\n?/, "").replace(/\n?```$/, "");
        setCurrentCode(finalCode);

        setVersionHistory([{ prompt, code: finalCode, timestamp: new Date().toLocaleTimeString() }, ...versionHistory]);
        setActiveVersionIndex(0);
        setChatHistory([...newChatHistory, { role: "model", parts: [{ text: finalCode }] }]);
        setPrompt("");
      }
    } catch (e) {
      const errorMsg = e instanceof Error ? e.message : "Unknown error";
      showToast(`Error: ${errorMsg}`);
      console.error("API Error:", e);
    } finally {
      isGeneratingRef.current = false;
      setIsGenerating(false);
    }
  };

  const handleStop = () => {
    isGeneratingRef.current = false;
    setIsGenerating(false);
  };

  const handleNewProject = () => {
    setCurrentCode("");
    setChatHistory([]);
    setVersionHistory([]);
    setPrompt("");
    setActiveVersionIndex(0);
    showToast("Project Reset");
  };

  const loadVersion = (index: number) => {
    const item = versionHistory[index];
    if (!item) return;
    setCurrentCode(item.code);
    setActiveVersionIndex(index);
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(currentCode);
    showToast("Code copied");
  };

  const handleDownload = () => {
    const blob = new Blob([currentCode], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'index.html';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-zinc-950 text-slate-50 font-sans">
      {/* Sidebar */}
      <aside className="w-80 min-w-[320px] flex flex-col bg-zinc-900 border-r border-zinc-800 z-10">
        <div className="p-4 px-5 border-b border-zinc-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <GitBranch className="w-5 h-5 text-indigo-500" />
            <span className="font-bold text-base tracking-tight">Qaim's Coder</span>
          </div>
          <div className={`w-2 h-2 rounded-full ${isGenerating ? 'bg-yellow-500' : 'bg-green-500'}`}></div>
        </div>
        
        <div className="p-4 overflow-y-auto flex-1 flex flex-col gap-4">
          <button 
            onClick={handleNewProject}
            className="w-full flex items-center justify-center gap-2 p-2.5 rounded-lg border border-dashed border-zinc-800 bg-white/5 text-sm hover:bg-white/10 hover:border-indigo-500 transition-all"
          >
            <Plus className="w-4 h-4" /> New Project
          </button>
          
          <div className="flex flex-col gap-2">
            <label className="text-xs font-semibold text-slate-400 uppercase">AI Model</label>
            <select
              value={selectedModel}
              onChange={(e) => setSelectedModel(e.target.value)}
              className="w-full bg-zinc-800 border border-zinc-800 rounded-lg p-3 text-sm focus:outline-none focus:border-indigo-500 transition-colors"
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
            <label className="text-xs font-semibold text-slate-400 uppercase">Describe or Edit</label>
            <textarea 
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              className="w-full min-h-[120px] bg-zinc-800 border border-zinc-800 rounded-lg p-3 text-sm resize-none focus:outline-none focus:border-indigo-500 transition-colors"
              placeholder="What should I build or change?"
            />
            {!isGenerating ? (
              <button 
                onClick={handleGenerate}
                className="w-full flex items-center justify-center gap-2 p-3 rounded-lg font-semibold bg-gradient-to-br from-indigo-500 to-purple-500 text-white"
              >
                <Zap className="w-4 h-4" /> Build Site
              </button>
            ) : (
              <button 
                onClick={handleStop}
                className="w-full flex items-center justify-center gap-2 p-3 rounded-lg font-semibold bg-red-500 text-white"
              >
                <Square className="w-4 h-4 fill-current" /> Stop
              </button>
            )}
          </div>
          
          <div className="mt-auto pt-4 border-t border-zinc-800">
            <div className="text-xs font-semibold text-slate-400 uppercase mb-2.5">Session History</div>
            <div className="flex flex-col gap-2 max-h-[200px] overflow-y-auto">
              {versionHistory.map((item, idx) => (
                <div 
                  key={idx}
                  onClick={() => loadVersion(idx)}
                  className={`p-2.5 rounded-md text-xs cursor-pointer whitespace-nowrap overflow-hidden text-ellipsis border ${activeVersionIndex === idx ? 'border-indigo-500 text-slate-50 bg-indigo-500/10' : 'border-transparent text-slate-400 bg-white/5 hover:bg-white/10 hover:text-slate-50'}`}
                >
                  <strong>{item.timestamp}</strong>: {item.prompt.substring(0, 30)}...
                </div>
              ))}
            </div>
          </div>
        </div>
      </aside>

      {/* Main Editor Panel */}
      <main className="flex-1 flex flex-col bg-zinc-950 relative">
        <div className="h-[50px] flex items-center justify-between px-5 bg-zinc-900 border-b border-zinc-800 text-sm text-slate-400">
          <span>{currentCode ? 'Project Active' : 'New Project'}</span>
          <div className="flex gap-2">
            <button onClick={handleDownload} className="p-1.5 rounded-md hover:bg-zinc-800 hover:text-slate-50 transition-colors" title="Download Code">
              <Download className="w-4 h-4" />
            </button>
            <button onClick={handleCopy} className="p-1.5 rounded-md hover:bg-zinc-800 hover:text-slate-50 transition-colors" title="Copy Code">
              <Copy className="w-4 h-4" />
            </button>
            <button onClick={() => setIsPreviewVisible(true)} className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md hover:bg-zinc-800 hover:text-slate-50 transition-colors">
              <Eye className="w-4 h-4" /> Preview
            </button>
          </div>
        </div>
        
        <div className="flex-1 flex overflow-hidden relative">
          {/* Line Numbers */}
          <div 
            ref={lineNumbersRef}
            className="w-[45px] py-4 bg-zinc-900 border-r border-zinc-800 text-right font-mono text-[13px] leading-[1.6] text-zinc-500 overflow-hidden select-none"
          >
            {Array.from({ length: (currentCode.match(/\n/g) || []).length + 1 }).map((_, i) => (
              <span key={i} className="block pr-3">{i + 1}</span>
            ))}
          </div>
          
          {/* Code Area */}
          <div className="flex-1 relative bg-zinc-950">
            <textarea
              ref={codeInputRef}
              value={currentCode}
              onChange={(e) => setCurrentCode(e.target.value)}
              onScroll={handleScroll}
              spellCheck={false}
              className="absolute inset-0 w-full h-full p-4 font-mono text-[13px] leading-[1.6] whitespace-pre text-transparent bg-transparent caret-indigo-500 resize-none outline-none z-10"
              style={{ tabSize: 4 }}
            />
            <pre 
              ref={preRef}
              className="absolute inset-0 w-full h-full p-4 font-mono text-[13px] leading-[1.6] whitespace-pre pointer-events-none z-0 m-0 bg-transparent overflow-hidden"
              aria-hidden="true"
            >
              <code 
                className="language-html"
                dangerouslySetInnerHTML={{ __html: Prism.languages.html ? Prism.highlight(currentCode, Prism.languages.html, 'html') : currentCode }}
              />
            </pre>
          </div>
        </div>

        {/* Preview Overlay */}
        {isPreviewVisible && (
          <div className="absolute inset-0 bg-white z-50 flex flex-col">
            <div className="h-[50px] bg-slate-100 border-b border-slate-200 flex items-center justify-between px-5 text-slate-600">
              <button onClick={() => setIsPreviewVisible(false)} className="p-1.5 rounded-md hover:bg-slate-200 transition-colors">
                <X className="w-4 h-4" />
              </button>
              <span className="font-semibold text-sm">Live Preview</span>
              <div className="w-7"></div> {/* Spacer for centering */}
            </div>
            <iframe 
              srcDoc={currentCode} 
              className="w-full h-full border-none bg-white"
              title="Preview"
              sandbox="allow-scripts allow-same-origin"
            />
          </div>
        )}
      </main>

      {/* Toasts */}
      <div className="fixed bottom-5 right-5 z-[9999] flex flex-col gap-2.5">
        {toasts.map((toast, i) => (
          <div key={i} className="bg-zinc-900 text-slate-50 px-5 py-3 rounded-lg border-l-4 border-indigo-500 shadow-lg">
            {toast}
          </div>
        ))}
      </div>
      <Analytics />
    </div>
  );
}
