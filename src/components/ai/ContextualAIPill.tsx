import React from 'react';
import { useAI } from '../../context/AIContext';
import { AgentType } from '../../types/ai';
import { Sparkles } from 'lucide-react';

interface ContextualAIPillProps {
  prompt: string;
  label?: string;
  agentType?: AgentType;
  context?: { page?: string; recordId?: string; needId?: string };
  size?: 'sm' | 'md';
  className?: string;
}

export const ContextualAIPill: React.FC<ContextualAIPillProps> = ({
  prompt,
  label,
  agentType,
  context,
  size = 'sm',
  className = '',
}) => {
  const { openAssistantWithQuery } = useAI();

  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        openAssistantWithQuery(prompt, agentType, context);
      }}
      className={`inline-flex items-center gap-1.5 rounded-full font-semibold transition-all border shadow-sm ${
        size === 'sm' ? 'px-2.5 py-1 text-[11px]' : 'px-3 py-1.5 text-xs'
      } bg-copper-light text-copper border-copper-border hover:bg-copper hover:text-white ${className}`}
      title={`Ask AI: "${prompt}"`}
    >
      <Sparkles className={size === 'sm' ? 'w-3 h-3' : 'w-3.5 h-3.5'} />
      <span>{label || prompt}</span>
    </button>
  );
};
