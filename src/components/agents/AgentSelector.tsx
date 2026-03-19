// src/components/agents/AgentSelector.tsx
import React from 'react';
import { GitBranch, Code, Image, MessageSquare } from 'lucide-react';

export type AgentType = 'website' | 'code' | 'image' | 'chat';

interface Agent {
  id: AgentType;
  name: string;
  description: string;
  icon: string;
}

interface AgentSelectorProps {
  currentAgent: AgentType;
  onAgentChange: (agent: AgentType) => void;
  className?: string;
}

const AGENTS: Agent[] = [
  {
    id: 'website',
    name: 'Website Builder',
    description: 'Build complete websites',
    icon: '🌐',
  },
  {
    id: 'code',
    name: 'Code Assistant',
    description: 'Write & debug code',
    icon: '💻',
  },
  {
    id: 'image',
    name: 'Image Generator',
    description: 'Create images from text',
    icon: '🎨',
  },
  {
    id: 'chat',
    name: 'General Chat',
    description: 'Conversational AI',
    icon: '💬',
  },
];

export const AgentSelector: React.FC<AgentSelectorProps> = ({
  currentAgent,
  onAgentChange,
  className = ''
}) => {
  return (
    <div className={`flex flex-col gap-2 ${className}`} role="tablist" aria-label="Agent selection">
      <div className="text-xs font-semibold text-slate-400 uppercase mb-1">
        AI Agent
      </div>
      <div className="flex flex-wrap gap-2">
        {AGENTS.map((agent) => {
          const isActive = currentAgent === agent.id;
          return (
            <button
              key={agent.id}
              onClick={() => onAgentChange(agent.id)}
              className={`
                flex items-center gap-2 px-3 py-2 rounded-lg text-sm
                transition-all duration-200
                ${isActive
                  ? 'bg-indigo-500 text-white shadow-lg shadow-indigo-500/30'
                  : 'bg-zinc-800 text-slate-400 hover:bg-zinc-700 hover:text-slate-50'
                }
                focus:outline-none focus:ring-2 focus:ring-indigo-500
              `}
              role="tab"
              aria-selected={isActive}
              aria-controls={`agent-panel-${agent.id}`}
              title={agent.description}
            >
              <span className="text-lg" aria-hidden="true">{agent.icon}</span>
              <span className="font-medium">{agent.name}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
};

// Helper function to get agent icon
export const getAgentIcon = (agentId: AgentType): string => {
  const agent = AGENTS.find(a => a.id === agentId);
  return agent?.icon || '🤖';
};

// Helper function to get agent name
export const getAgentName = (agentId: AgentType): string => {
  const agent = AGENTS.find(a => a.id === agentId);
  return agent?.name || 'Unknown Agent';
};
