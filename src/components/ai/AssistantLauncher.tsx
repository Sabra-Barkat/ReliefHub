import React from 'react';
import { useAI } from '../../context/AIContext';
import { Sparkles, Bot } from 'lucide-react';

export const AssistantLauncher: React.FC = () => {
  const { isAssistantOpen, setIsAssistantOpen, isProcessing } = useAI();

  if (isAssistantOpen) return null;

  return (
    <div className="fixed bottom-20 md:bottom-6 right-4 sm:right-6 z-40">
      <button
        onClick={() => setIsAssistantOpen(true)}
        className="flex items-center gap-2.5 px-4 py-3 bg-ink hover:bg-ink-light text-surface rounded-full shadow-2xl border border-border/40 transition-all duration-200 transform hover:-translate-y-0.5 group focus:outline-none focus:ring-2 focus:ring-copper"
        aria-label="Open ReliefHub Intelligence Assistant"
        title="Open ReliefHub Intelligence"
      >
        <div className="relative">
          <div className="w-8 h-8 rounded-full bg-copper flex items-center justify-center text-white shrink-0 shadow-sm">
            <Sparkles className="w-4 h-4" />
          </div>
          {isProcessing && (
            <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-saffron animate-ping" />
          )}
        </div>

        <div className="text-left hidden sm:block">
          <span className="text-xs font-serif font-bold text-surface block leading-tight">
            ReliefHub Intelligence
          </span>
          <span className="text-[10px] text-ink-faint block leading-tight">
            {isProcessing ? 'Analyzing field data...' : '4 Specialized Agents Active'}
          </span>
        </div>
      </button>
    </div>
  );
};
