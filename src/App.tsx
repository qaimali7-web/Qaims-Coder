import React, { useState, useRef, useEffect } from 'react';
import { Zap, Download, Copy, Eye } from 'lucide-react';
import Editor from '@monaco-editor/react';

export default function App() {
  const [prompt, setPrompt] = useState('');
  const [code, setCode] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isPreviewVisible, setIsPreviewVisible] = useState(false);
  const [generationProgress, setGenerationProgress] = useState<string>('');
  const [apiKey, setApiKey] = useState(() => {
    return localStorage.getItem('openrouter_api_key') || '';
  });
  const [selectedModel, setSelectedModel] = useState('stepfun/step-3.5-flash:free');

  // Save API key
  useEffect(() => {
    if (apiKey) {
      localStorage.setItem('openrouter_api_key', apiKey);
    }
  }, [apiKey]);

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

  const handleGenerate = async () => {
    if (!prompt.trim()) {
      alert('Please enter a description for your website');
      return;
    }

    if (!apiKey.trim() || apiKey.length < 10) {
      alert('Please enter a valid OpenRouter API key');
      return;
    }

    setIsGenerating(true);
    setGenerationProgress('Starting generation...');
    setCode('');

    try {
      const response = await fetch('/api/generate-html', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: prompt.trim(),
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
      let fullCode = '';
      let lastUpdate = Date.now();

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
                lastUpdate = Date.now();
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

      // Final check - if we have code but still generating, complete
      if (fullCode && isGenerating) {
        setIsGenerating(false);
        setGenerationProgress('Complete!');
        setTimeout(() => setGenerationProgress(''), 2000);
      }

    } catch (error: any) {
      console.error('Generation error:', error);
      setGenerationProgress(`Error: ${error.message}`);
      setIsGenerating(false);
      alert(`Error: ${error.message}`);
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
          <h1 className="font-bold text-lg">AI Website Builder</h1>
          <div className={`w-2 h-2 rounded-full ${isGenerating ? 'bg-yellow-500 animate-pulse' : 'bg-green-500'}`} />
        </div>

        <div className="p-4 flex-1 flex flex-col gap-4 overflow-y-auto">
          {/* API Key */}
          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase mb-2">
              OpenRouter API Key
            </label>
            <input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              className="w-full bg-zinc-800 border border-zinc-800 rounded p-3 text-sm focus:outline-none focus:border-indigo-500"
              placeholder="sk-or-..."
              disabled={isGenerating}
            />
          </div>

          {/* Model */}
          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase mb-2">
              Model
            </label>
            <select
              value={selectedModel}
              onChange={(e) => setSelectedModel(e.target.value)}
              className="w-full bg-zinc-800 border border-zinc-800 rounded p-3 text-sm focus:outline-none focus:border-indigo-500"
              disabled={isGenerating}
            >
              <option value="stepfun/step-3.5-flash:free">StepFun 3.5 Flash (Free)</option>
              <option value="anthropic/claude-3.5-sonnet">Claude 3.5 Sonnet</option>
              <option value="openai/gpt-4o-mini">GPT-4o Mini</option>
              <option value="openai/gpt-4o">GPT-4o</option>
              <option value="google/gemini-2.0-flash-exp:free">Gemini 2.0 Flash (Free)</option>
              <option value="meta-llama/llama-3.2-3b-instruct:free">Llama 3.2 3B (Free)</option>
            </select>
          </div>

          {/* Prompt */}
          <div className="flex-1">
            <label className="block text-xs font-semibold text-slate-400 uppercase mb-2">
              Describe Your Website
            </label>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              className="w-full h-48 bg-zinc-800 border border-zinc-800 rounded p-3 text-sm resize-none focus:outline-none focus:border-indigo-500"
              placeholder="Describe the website you want to create..."
              disabled={isGenerating}
            />
          </div>

          {/* Generate Button */}
          {!isGenerating ? (
            <button
              onClick={handleGenerate}
              className="w-full py-3 rounded-lg font-semibold bg-gradient-to-r from-indigo-500 to-purple-500 text-white hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={!prompt.trim() || !apiKey.trim()}
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
            <div className="text-sm text-slate-400 text-center">
              {generationProgress}
            </div>
          )}

          {/* Action Buttons */}
          {code && !isGenerating && (
            <div className="flex gap-2">
              <button
                onClick={handleCopy}
                className="flex-1 py-2 rounded bg-zinc-800 text-slate-300 hover:bg-zinc-700 focus:outline-none"
              >
                <Copy className="w-4 h-4 inline mr-1" />
                Copy
              </button>
              <button
                onClick={handleDownload}
                className="flex-1 py-2 rounded bg-zinc-800 text-slate-300 hover:bg-zinc-700 focus:outline-none"
              >
                <Download className="w-4 h-4 inline mr-1" />
                Download
              </button>
              <button
                onClick={() => setIsPreviewVisible(true)}
                className="flex-1 py-2 rounded bg-zinc-800 text-slate-300 hover:bg-zinc-700 focus:outline-none"
              >
                <Eye className="w-4 h-4 inline mr-1" />
                Preview
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Main Editor */}
      <div className="flex-1 flex flex-col">
        <div className="h-10 flex items-center justify-between px-4 bg-zinc-900 border-b border-zinc-800 text-sm">
          <span className="text-slate-400">
            {code ? 'index.html' : 'No code generated'}
          </span>
          {code && (
            <span className="text-slate-400 text-xs">
              {code.length} characters
            </span>
          )}
        </div>

        <div className="flex-1">
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
              className="p-1.5 rounded hover:bg-slate-200"
            >
              Close
            </button>
            <span className="font-semibold">Live Preview</span>
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
