// src/components/agents/GeneralChat.tsx
import React, { useState, useCallback, useEffect, useRef } from 'react';
import { MessageSquare, Send, Loader2, User, Bot, FileText, Download } from 'lucide-react';
import { useConvex } from '../../hooks/useConvex';
import { useToasts } from '../../hooks/usetoasts';

interface GeneralChatProps {
  projectId: string;
  onNewProject?: () => void;
}

interface Message {
  _id?: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  metadata?: string;
  createdAt?: number;
}

export const GeneralChat: React.FC<GeneralChatProps> = ({
  projectId,
  onNewProject
}) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { createConversation, addMessage, getMessagesByConversation, getConversationsByProject } = useConvex();
  const { showToast } = useToasts();

  // Load or create conversation on mount
  useEffect(() => {
    const initConversation = async () => {
      try {
        // Try to get existing conversations for this project
        const conversations = await getConversationsByProject(projectId);
        if (conversations.length > 0) {
          // Use the most recent conversation
          const latestConversation = conversations.sort((a, b) => b.updatedAt - a.updatedAt)[0];
          setConversationId(latestConversation._id);
          // Load messages
          const loadedMessages = await getMessagesByConversation(latestConversation._id);
          setMessages(loadedMessages);
        } else {
          // Create new conversation
          const newConvId = await createConversation(
            projectId,
            `Chat ${new Date().toLocaleDateString()}`,
            'chat'
          );
          if (newConvId) {
            setConversationId(newConvId);
            // Add system message
            await addMessage(
              newConvId,
              'system',
              'You are a helpful AI assistant. Engage in natural conversations, answer questions, help with brainstorming, planning, and general tasks. Be friendly, informative, and concise.'
            );
            setMessages([{
              role: 'system',
              content: 'You are a helpful AI assistant. Engage in natural conversations, answer questions, help with brainstorming, planning, and general tasks. Be friendly, informative, and concise.'
            }]);
          }
        }
      } catch (err) {
        console.error('Failed to initialize conversation:', err);
        setError('Failed to load conversation');
      }
    };

    if (projectId) {
      initConversation();
    }
  }, [projectId, createConversation, addMessage, getConversationsByProject, getMessagesByConversation]);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading || !conversationId) return;

    const userMessage: Message = {
      role: 'user',
      content: input.trim(),
      createdAt: Date.now(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);
    setError(null);

    try {
      // Call the general chat API
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [...messages, userMessage].map(m => ({
            role: m.role,
            content: m.content
          })),
          model: 'openai/gpt-4o-mini',
          conversationId,
        }),
      });

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }

      const data = await response.json();

      const assistantMessage: Message = {
        role: 'assistant',
        content: data.message,
        createdAt: Date.now(),
      };

      setMessages(prev => [...prev, assistantMessage]);

      // Save assistant message to Convex
      await addMessage(conversationId, 'assistant', data.message);

    } catch (err) {
      console.error('Chat error:', err);
      const errorMessage: Message = {
        role: 'assistant',
        content: `Error: ${err instanceof Error ? err.message : 'Failed to get response'}`,
        createdAt: Date.now(),
      };
      setMessages(prev => [...prev, errorMessage]);
      setError('Failed to send message');
    } finally {
      setIsLoading(false);
    }
  };

  const handleExportChat = () => {
    const chatText = messages
      .filter(m => m.role !== 'system')
      .map(m => `${m.role === 'user' ? 'You' : 'Assistant'}: ${m.content}`)
      .join('\n\n');

    const blob = new Blob([chatText], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `chat-${new Date().toISOString().split('T')[0]}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('Chat exported');
  };

  return (
    <div className="flex flex-col h-full bg-zinc-950">
      {/* Header */}
      <div className="h-[50px] flex items-center justify-between px-5 bg-zinc-900 border-b border-zinc-800">
        <div className="flex items-center gap-2">
          <MessageSquare className="w-5 h-5 text-indigo-500" aria-hidden="true" />
          <span className="font-semibold text-sm text-slate-50">General Chat</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleExportChat}
            className="px-3 py-1.5 text-xs font-medium bg-zinc-800 hover:bg-zinc-700 rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 flex items-center gap-1"
            title="Export conversation"
          >
            <Download className="w-3 h-3" />
            Export
          </button>
          <button
            onClick={onNewProject}
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
            <MessageSquare className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <h3 className="text-lg font-semibold mb-2">General Chat</h3>
            <p className="text-sm max-w-md mx-auto">
              Start a conversation with AI. Ask questions, brainstorm ideas, get help with planning, or just chat.
            </p>
          </div>
        )}

        {messages.map((message, idx) => (
          <div
            key={idx}
            className={`flex flex-col ${message.role === 'user' ? 'items-end' : 'items-start'}`}
          >
            <div className="flex items-center gap-2 mb-1">
              {message.role === 'user' ? (
                <User className="w-4 h-4 text-indigo-400" />
              ) : message.role === 'assistant' ? (
                <Bot className="w-4 h-4 text-green-400" />
              ) : null}
              <span className="text-xs text-slate-500">
                {message.role === 'user' ? 'You' : message.role === 'assistant' ? 'Assistant' : 'System'}
              </span>
            </div>
            <div
              className={`max-w-[80%] rounded-lg p-4 ${
                message.role === 'user'
                  ? 'bg-indigo-500 text-white'
                  : message.role === 'system'
                  ? 'bg-zinc-800 text-slate-400 italic'
                  : 'bg-zinc-800 text-slate-50'
              }`}
            >
              <p className="whitespace-pre-wrap text-sm">{message.content}</p>
            </div>
            {message.createdAt && (
              <div className="text-xs text-slate-500 mt-1 px-2">
                {new Date(message.createdAt).toLocaleTimeString()}
              </div>
            )}
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

      {/* Input Form */}
      <form onSubmit={handleSubmit} className="p-4 border-t border-zinc-800 bg-zinc-900">
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Type your message..."
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
        {error && (
          <div className="mt-2 p-2 bg-red-500/10 border border-red-500/50 rounded text-xs text-red-400">
            {error}
          </div>
        )}
      </form>
    </div>
  );
};
