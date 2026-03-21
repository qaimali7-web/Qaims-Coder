import React, { useState, useCallback, useRef } from 'react';
import Editor from '@monaco-editor/react';
import {
  Zap, Square, Copy, Download, Eye, History,
  X, ChevronLeft, Menu, Code2, Sparkles,
} from 'lucide-react';

import { ModelSelector }  from './components/ModelSelector';
import { HistoryPanel }   from './components/HistoryPanel';
import { PreviewModal }   from './components/PreviewModal';
import { EditorSkeleton } from './components/EditorSkeleton';
import { StatusBar }      from './components/StatusBar';
import { ToastContainer, useToast } from './components/Toast';
import { useGeneration }  from './hooks/useGeneration';
import { useHistory }     from './hooks/useHistory';
import { AI_MODELS }      from './types';
import type { HistoryEntry } from './types';

// ─── Sidebar Tab Types ────────────────────────────────────────────────────────

type SidebarTab = 'generate' | 'history';

// ─── Main App ─────────────────────────────────────────────────────────────────

export default function App() {
  // ── State ──────────────────────────────────────────────────────────────────
  const [prompt, setPrompt]             = useState('');
  const [code, setCode]                 = useState('');
  const [model, setModel]               = useState(AI_MODELS[0].id);
  const [activeTab, setActiveTab]       = useState<SidebarTab>('generate');
  const [showPreview, setShowPreview]   = useState(false);
  const [sidebarOpen, setSidebarOpen]   = useState(true);   // mobile drawer
  const [editorReady, setEditorReady]   = useState(false);

  // Latest code ref so callbacks never go stale
  const codeRef = useRef(code);
  const handleCodeUpdate = useCallback((newCode: string) => {
    codeRef.current = newCode;
    setCode(newCode);
  }, []);

  // ── Toast ──────────────────────────────────────────────────────────────────
  const { toasts, toast, dismiss } = useToast();

  // ── History ────────────────────────────────────────────────────────────────
  const { history, addEntry, removeEntry, clearHistory } = useHistory();

  const handleComplete = useCallback(
    (finalCode: string) => {
      addEntry({
        prompt,
        code: finalCode,
        model,
        charCount: finalCode.length,
      });
    },
    [prompt, model, addEntry]
  );

  // ── Generation ────────────────────────────────────────────────────────────
  const { state: genState, isGenerating, generate, stop } = useGeneration({
    onCodeUpdate: handleCodeUpdate,
    onComplete: handleComplete,
    toast,
  });

  // ── Actions ───────────────────────────────────────────────────────────────

  const handleGenerate = useCallback(() => {
    generate(prompt, model, undefined, false);
  }, [generate, prompt, model]);

  const handleCopy = useCallback(async () => {
    if (!code) return;
    try {
      await navigator.clipboard.writeText(code);
      toast('success', 'Code copied to clipboard!');
    } catch {
      toast('error', 'Failed to copy — try selecting the code manually.');
    }
  }, [code, toast]);

  const handleDownload = useCallback(() => {
    if (!code) return;
    const blob = new Blob([code], { type: 'text/html' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = 'index.html';
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    toast('success', 'File downloaded as index.html');
  }, [code, toast]);

  const handleRestore = useCallback(
    (entry: HistoryEntry) => {
      setPrompt(entry.prompt);
      setCode(entry.code);
      codeRef.current = entry.code;
      setModel(entry.model);
      setActiveTab('generate');
      toast('info', 'Session restored from history.');
    },
    [toast]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      // Ctrl/Cmd + Enter to generate
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        if (!isGenerating && prompt.trim()) handleGenerate();
      }
    },
    [isGenerating, prompt, handleGenerate]
  );

  // ── Sidebar content ───────────────────────────────────────────────────────

  const sidebarContent = (
    <div className="flex flex-col h-full">

      {/* ── Logo header ─────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800/60 shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="p-1.5 rounded-lg gradient-border">
            <Code2 className="w-4 h-4 text-white" />
          </div>
          <div>
            <h1 className="text-sm font-bold text-white leading-none" style={{ fontFamily: 'Syne, sans-serif' }}>
              Qaim's Coder
            </h1>
            <p className="text-[10px] text-slate-600 font-mono mt-0.5">AI Website Builder</p>
          </div>
        </div>

        {/* Status dot */}
        <div className="flex items-center gap-2">
          <div
            className={`w-2 h-2 rounded-full ${
              isGenerating ? 'bg-amber-400 pulse-dot' : 'bg-emerald-500'
            }`}
            title={isGenerating ? 'Generating…' : 'Ready'}
          />
          {/* Mobile close button */}
          <button
            className="md:hidden p-1 text-slate-500 hover:text-white"
            onClick={() => setSidebarOpen(false)}
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* ── Tabs ────────────────────────────────────────────────────────── */}
      <div className="flex border-b border-slate-800/60 shrink-0">
        {(['generate', 'history'] as SidebarTab[]).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`
              flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-semibold
              uppercase tracking-widest transition-all border-b-2
              ${activeTab === tab
                ? 'border-indigo-500 text-indigo-400'
                : 'border-transparent text-slate-600 hover:text-slate-400'
              }
            `}
            style={{ fontFamily: 'Syne, sans-serif' }}
          >
            {tab === 'generate' ? <Sparkles className="w-3 h-3" /> : <History className="w-3 h-3" />}
            {tab}
          </button>
        ))}
      </div>

      {/* ── Tab: Generate ───────────────────────────────────────────────── */}
      {activeTab === 'generate' && (
        <div className="flex-1 flex flex-col gap-4 px-4 py-4 overflow-y-auto">

          {/* Model selector */}
          <ModelSelector value={model} onChange={setModel} disabled={isGenerating} />

          {/* Prompt textarea */}
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-widest mb-2">
              Describe Your Website
            </label>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={isGenerating}
              rows={10}
              className={`
                w-full bg-slate-900/80 border rounded-xl p-3.5 text-sm font-mono
                resize-none transition-all outline-none leading-relaxed
                placeholder:text-slate-700
                ${isGenerating
                  ? 'opacity-50 cursor-not-allowed border-slate-800'
                  : 'border-slate-700/50 hover:border-slate-600 focus:border-indigo-500'
                }
              `}
              placeholder={
                'E.g., A dark SaaS landing page with a hero section, pricing cards, and a testimonials grid. Use a purple accent color.'
              }
            />
            <p className="text-[10px] text-slate-700 font-mono mt-1.5 text-right">
              ⌘↵ to generate
            </p>
          </div>

          {/* Generate / Stop button */}
          {isGenerating ? (
            <button
              onClick={stop}
              className="
                w-full flex items-center justify-center gap-2 py-3 rounded-xl font-bold
                bg-red-500/15 border border-red-500/30 text-red-400
                hover:bg-red-500/25 transition-all
              "
              style={{ fontFamily: 'Syne, sans-serif' }}
            >
              <Square className="w-4 h-4 fill-current" />
              Stop Generation
            </button>
          ) : (
            <button
              onClick={handleGenerate}
              disabled={!prompt.trim()}
              className={`
                w-full flex items-center justify-center gap-2 py-3 rounded-xl font-bold
                transition-all duration-200
                ${prompt.trim()
                  ? 'gradient-border text-white hover:opacity-90 active:scale-[0.98] shadow-lg shadow-indigo-500/20'
                  : 'bg-slate-800/50 text-slate-600 cursor-not-allowed border border-slate-800'
                }
              `}
              style={{ fontFamily: 'Syne, sans-serif' }}
            >
              <Zap className="w-4 h-4" />
              Generate Website
            </button>
          )}

          {/* Progress message */}
          {genState.message && (
            <div className="animate-fade-in flex items-start gap-2 px-3 py-2.5 rounded-xl bg-slate-900/80 border border-slate-800/60">
              {isGenerating && (
                <div className="w-1.5 h-1.5 rounded-full bg-indigo-400 pulse-dot mt-1.5 shrink-0" />
              )}
              <p className="text-xs text-slate-400 font-mono leading-relaxed">
                {genState.message}
              </p>
            </div>
          )}

          {/* Retry info */}
          {genState.autoRetryCount > 0 && isGenerating && (
            <div className="text-[10px] text-amber-600 font-mono text-center">
              Auto-retry {genState.autoRetryCount} / 3
            </div>
          )}
        </div>
      )}

      {/* ── Tab: History ────────────────────────────────────────────────── */}
      {activeTab === 'history' && (
        <div className="flex-1 overflow-hidden">
          <HistoryPanel
            history={history}
            onRestore={handleRestore}
            onDelete={removeEntry}
            onClear={clearHistory}
          />
        </div>
      )}
    </div>
  );

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[#0a0a0f] text-slate-100 relative">

      {/* ── Mobile overlay ──────────────────────────────────────────────── */}
      {sidebarOpen && (
        <div
          className="md:hidden fixed inset-0 bg-black/60 z-30 backdrop-blur-sm"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* ── Sidebar ─────────────────────────────────────────────────────── */}
      <aside
        className={`
          fixed md:relative z-40 md:z-auto
          flex flex-col h-full
          w-80 shrink-0
          bg-[#0d0d1a] border-r border-slate-800/60
          sidebar-mobile
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
        `}
      >
        {sidebarContent}
      </aside>

      {/* ── Main panel ──────────────────────────────────────────────────── */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">

        {/* ── Editor toolbar ────────────────────────────────────────────── */}
        <div className="flex items-center justify-between h-11 px-3 bg-[#0d0d1a] border-b border-slate-800/60 shrink-0">

          {/* Left: mobile menu + filename */}
          <div className="flex items-center gap-3">
            <button
              className="md:hidden p-1.5 rounded-lg text-slate-500 hover:text-white hover:bg-slate-800 transition-colors"
              onClick={() => setSidebarOpen(true)}
              aria-label="Open sidebar"
            >
              <Menu className="w-4 h-4" />
            </button>

            {/* Collapse sidebar on desktop */}
            <button
              className="hidden md:flex p-1.5 rounded-lg text-slate-600 hover:text-slate-300 hover:bg-slate-800/60 transition-colors"
              onClick={() => setSidebarOpen((o) => !o)}
              title={sidebarOpen ? 'Collapse sidebar' : 'Expand sidebar'}
            >
              <ChevronLeft className={`w-3.5 h-3.5 transition-transform ${sidebarOpen ? '' : 'rotate-180'}`} />
            </button>

            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-[#ff5f57]" />
              <div className="w-3 h-3 rounded-full bg-[#febc2e]" />
              <div className="w-3 h-3 rounded-full bg-[#28c840]" />
            </div>

            <span className="text-xs text-slate-500 font-mono ml-1">
              {code ? 'index.html' : 'untitled.html'}
            </span>

            {/* Streaming cursor indicator */}
            {isGenerating && (
              <span className="text-xs text-indigo-400 font-mono cursor-blink" />
            )}
          </div>

          {/* Right: action buttons */}
          <div className="flex items-center gap-1.5">
            <ActionButton
              icon={<Copy className="w-3.5 h-3.5" />}
              label="Copy"
              onClick={handleCopy}
              disabled={!code || isGenerating}
            />
            <ActionButton
              icon={<Download className="w-3.5 h-3.5" />}
              label="Download"
              onClick={handleDownload}
              disabled={!code || isGenerating}
            />
            <ActionButton
              icon={<Eye className="w-3.5 h-3.5" />}
              label="Preview"
              onClick={() => setShowPreview(true)}
              disabled={!code || isGenerating}
              highlight
            />
          </div>
        </div>

        {/* ── Monaco Editor ─────────────────────────────────────────────── */}
        <div className="flex-1 overflow-hidden">
          <Editor
            height="100%"
            defaultLanguage="html"
            value={code}
            onChange={(val) => {
              const v = val ?? '';
              codeRef.current = v;
              setCode(v);
            }}
            theme="vs-dark"
            onMount={() => setEditorReady(true)}
            loading={<EditorSkeleton />}
            options={{
              minimap:                  { enabled: true },
              fontSize:                 13,
              fontFamily:               '"JetBrains Mono", monospace',
              fontLigatures:            true,
              lineNumbers:              'on',
              scrollBeyondLastLine:     false,
              automaticLayout:          true,
              tabSize:                  2,
              wordWrap:                 'on',
              folding:                  true,
              renderWhitespace:         'selection',
              bracketPairColorization:  { enabled: true },
              autoClosingBrackets:      'always',
              smoothScrolling:          true,
              cursorBlinking:           'smooth',
              cursorSmoothCaretAnimation: 'on',
              padding:                  { top: 16, bottom: 16 },
            }}
          />
        </div>

        {/* ── Status bar ────────────────────────────────────────────────── */}
        <StatusBar
          status={genState.status}
          message={genState.message}
          charCount={code.length}
          model={model}
        />
      </main>

      {/* ── Preview modal ───────────────────────────────────────────────── */}
      {showPreview && code && (
        <PreviewModal code={code} onClose={() => setShowPreview(false)} />
      )}

      {/* ── Toast notifications ─────────────────────────────────────────── */}
      <ToastContainer toasts={toasts} onDismiss={dismiss} />
    </div>
  );
}

// ─── Small reusable action button ─────────────────────────────────────────────

interface ActionButtonProps {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  highlight?: boolean;
}

function ActionButton({ icon, label, onClick, disabled, highlight }: ActionButtonProps) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`
        flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold
        transition-all duration-150 select-none
        ${disabled
          ? 'opacity-30 cursor-not-allowed text-slate-600 bg-transparent'
          : highlight
            ? 'bg-indigo-500/20 border border-indigo-500/30 text-indigo-300 hover:bg-indigo-500/30'
            : 'text-slate-400 hover:text-white hover:bg-slate-800/80 border border-transparent hover:border-slate-700/50'
        }
      `}
      style={{ fontFamily: 'Syne, sans-serif' }}
    >
      {icon}
      <span className="hidden sm:inline">{label}</span>
    </button>
  );
}
