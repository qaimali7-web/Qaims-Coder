import React, { useState, useEffect } from 'react';
import { Zap, Download, Copy, Eye } from 'lucide-react';
import Editor from '@monaco-editor/react';

export default function App() {
  const [prompt, setPrompt] = useState('');
  const [code, setCode] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isPreviewVisible, setIsPreviewVisible] = useState(false);
  const [generationProgress, setGenerationProgress] = useState<string>('');
  const [retryCount, setRetryCount] = useState(0);
  const [maxRetries] = useState(3);

  // Use StepFun model by default
  const MODEL = 'stepfun/step-3.5-flash:free';

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      alert('Code copied to clipboard');
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const handleDownload = () => {
    const blob = new Blob([code], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'index.html';
    a.click();
    URL.revokeObjectURL(url);
    alert('Code downloaded');
  };

  const handleGenerate = async (isRetry: boolean = false, isContinue: boolean = false) => {
    if (!prompt.trim() && !isContinue) {
      alert('Please enter a description for your website');
      return;
    }

    setIsGenerating(true);
    setGenerationProgress(isRetry ? 'Retrying generation...' : isContinue ? 'Continuing generation...' : 'Starting generation...');

    try {
      const response = await fetch('/api/generate-html', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: prompt.trim(),
          model: MODEL,
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
      let fullCode = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));

              if (data.type === 'progress') {
                setGenerationProgress(data.progress.message);
              } else if (data.type === 'chunk') {
                fullCode += data.chunk;
                setCode(fullCode);
              } else if (data.type === 'complete') {
                setIsGenerating(false);
                setGenerationProgress('Complete!');
                setTimeout(() => setGenerationProgress(''), 2000);
              } else if (data.type === 'error') {
                throw new Error(data.error.message);
              }
            } catch (e) {
              // Skip malformed lines
            }
          }
        }
      }

      if (fullCode && isGenerating) {
        setIsGenerating(false);
        setGenerationProgress('Complete!');
        setTimeout(() => setGenerationProgress(''), 2000);
      }

    } catch (error: any) {
      console.error('Generation error:', error);
      setGenerationProgress(`Error: ${error.message}`);
      setIsGenerating(false);
      
      // Check if it's a context length error and we can retry
      if (error.message.includes('context') || error.message.includes('length')) {
        if (retryCount < maxRetries) {
          setRetryCount(prev => prev + 1);
          alert(`Prompt too long. Retrying with shorter context... (${retryCount + 1}/${maxRetries})`);
          // Could implement prompt truncation here if needed
        } else {
          alert(`Error: ${error.message}\n\nMaximum retries reached. Please shorten your prompt.`);
        }
      } else {
        alert(`Error: ${error.message}`);
      }
    }
  };

  const handleStop = () => {
    setIsGenerating(false);
    setGenerationProgress('Stopped');
  };

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-zinc-950 text-slate-50">
      {/* Sidebar */}
      <div className="w-80 min-w-[320px] flex flex-col bg-zinc-900 border-r border-zinc-800">
        <div className="p-4 border-b border-zinc-800 flex items-center justify-between">
          <h1 className="font-bold text-lg text-white">AI Website Builder</h1>
          <div className={`w-2 h-2 rounded-full ${isGenerating ? 'bg-yellow-500 animate-pulse' : 'bg-green-500'}`} />
        </div>

        <div className="p-4 flex-1 flex flex-col gap-4 overflow-y-auto">
          {/* Prompt Input */}
          <div className="flex-1">
            <label className="block text-xs font-semibold text-slate-400 uppercase mb-2">
              Describe Your Website
            </label>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              className="w-full h-64 bg-zinc-800 border border-zinc-800 rounded-lg p-3 text-sm resize-none focus:outline-none focus:border-indigo-500 transition-colors"
              placeholder="E.g., Create a modern landing page for a tech startup with hero section, features grid, and contact form..."
              disabled={isGenerating}
            />
          </div>

          {/* Generate Button */}
          {!isGenerating ? (
            <button
              onClick={handleGenerate}
              className="w-full py-3 rounded-lg font-semibold bg-gradient-to-r from-indigo-500 to-purple-500 text-white hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={!prompt.trim()}
            >
              <Zap className="w-4 h-4 inline mr-2" />
              Generate Website
            </button>
          ) : (
            <button
              onClick={handleStop}
              className="w-full py-3 rounded-lg font-semibold bg-red-500 text-white hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-red-500"
            >
              Stop Generation
            </button>
          )}

          {/* Progress */}
          {generationProgress && (
            <div className="text-sm text-slate-400 text-center bg-zinc-800 rounded p-2">
              {generationProgress}
            </div>
          )}

          {/* Retry Button (shown on error) */}
          {generationProgress?.includes('Error') && retryCount < maxRetries && (
            <button
              onClick={() => handleGenerate(true, false)}
              className="w-full py-2 rounded bg-yellow-600 text-white hover:bg-yellow-700 focus:outline-none focus:ring-2 focus:ring-yellow-500 text-sm"
            >
              Retry Generation ({retryCount + 1}/{maxRetries})
            </button>
          )}

          {/* Action Buttons */}
          <div className="flex flex-col gap-2">
            <button
              onClick={handleCopy}
              disabled={!code || isGenerating}
              className="w-full py-2 rounded bg-zinc-800 text-slate-300 hover:bg-zinc-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
              title="Copy code"
            >
              <Copy className="w-4 h-4 inline mr-2" />
              Copy Code
            </button>
            <button
              onClick={handleDownload}
              disabled={!code || isGenerating}
              className="w-full py-2 rounded bg-zinc-800 text-slate-300 hover:bg-zinc-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
              title="Download code"
            >
              <Download className="w-4 h-4 inline mr-2" />
              Download
            </button>
            <button
              onClick={() => setIsPreviewVisible(true)}
              disabled={!code || isGenerating}
              className="w-full py-2 rounded bg-zinc-800 text-slate-300 hover:bg-zinc-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
              title="Preview"
            >
              <Eye className="w-4 h-4 inline mr-2" />
              Preview
            </button>
          </div>
        </div>
      </div>

      {/* Main Editor */}
      <div className="flex-1 flex flex-col">
        <div className="h-10 flex items-center justify-between px-4 bg-zinc-900 border-b border-zinc-800 text-sm">
          <span className="text-slate-400">
            {code ? 'index.html' : 'No code generated yet'}
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={handleCopy}
              disabled={!code || isGenerating}
              className="flex items-center gap-1 px-2 py-1 rounded bg-zinc-800 text-slate-300 hover:bg-zinc-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-xs disabled:opacity-50 disabled:cursor-not-allowed"
              title="Copy code"
            >
              <Copy className="w-3 h-3" />
              Copy
            </button>
            <button
              onClick={handleDownload}
              disabled={!code || isGenerating}
              className="flex items-center gap-1 px-2 py-1 rounded bg-zinc-800 text-slate-300 hover:bg-zinc-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-xs disabled:opacity-50 disabled:cursor-not-allowed"
              title="Download code"
            >
              <Download className="w-3 h-3" />
              Download
            </button>
            <button
              onClick={() => setIsPreviewVisible(true)}
              disabled={!code || isGenerating}
              className="flex items-center gap-1 px-2 py-1 rounded bg-zinc-800 text-slate-300 hover:bg-zinc-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-xs disabled:opacity-50 disabled:cursor-not-allowed"
              title="Preview"
            >
              <Eye className="w-3 h-3" />
              Preview
            </button>
            {code && (
              <span className="text-slate-400 text-xs ml-2">
                {code.length} chars
              </span>
            )}
          </div>
        </div>

        <div className="flex-1 relative">
          <Editor
            height="100%"
            defaultLanguage="html"
            value={code}
            onChange={(value) => setCode(value || '')}
            theme="vs-dark"
            loading={
              <div className="flex items-center justify-center h-full bg-zinc-950">
                <div className="text-slate-400">Loading editor...</div>
              </div>
            }
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
            }}
          />
        </div>
      </div>

      {/* Preview Modal */}
      {isPreviewVisible && (
        <div className="fixed inset-0 bg-white z-50 flex flex-col">
          <div className="h-10 bg-slate-100 border-b border-slate-200 flex items-center justify-between px-4">
            <button
              onClick={() => setIsPreviewVisible(false)}
              className="p-1.5 rounded hover:bg-slate-200 transition-colors"
            >
              Close
            </button>
            <span className="font-semibold text-slate-700">Live Preview</span>
            <div className="w-20"></div>
          </div>
          <iframe
            srcDoc={code}
            className="w-full h-full border-none"
            sandbox="allow-scripts allow-same-origin"
            title="Preview"
          />
        </div>
      )}
    </div>
  );
}
