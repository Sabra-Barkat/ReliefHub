import React, { useState, useRef, useEffect } from 'react';
import { useAI } from '../../context/AIContext';
import { useApp } from '../../context/AppContext';
import { MessageItem } from './MessageItem';
import { AgentType } from '../../types/ai';
import {
  X,
  Send,
  Sparkles,
  Bot,
  RotateCcw,
  Trash2,
  Activity,
  Layers,
  ArrowRight,
  ShieldCheck,
  Maximize2,
  Minimize2,
} from 'lucide-react';

const SUGGESTED_QUESTIONS = [
  'Which high-priority needs are below 40% delivered fulfilment?',
  'What could we allocate with the available warehouse stock?',
  'Which camps have the largest unallocated water needs?',
  'Which supplies are currently low in stock?',
  'Show committed supplies that have not been delivered.',
  'Which camps need follow-up on pending dispatches?',
  'Summarize the current response gaps in a selected district.',
  'Which volunteers are currently unassigned?',
];

export const AssistantDrawer: React.FC = () => {
  const {
    isAssistantOpen,
    setIsAssistantOpen,
    messages,
    isProcessing,
    askQuestion,
    clearConversation,
    retryLastQuery,
    lastFailedQuery,
    setIsActivityPanelOpen,
    providerInfo,
  } = useAI();

  const { selectedDistrict } = useApp();

  const [input, setInput] = useState<string>('');
  const [selectedAgent, setSelectedAgent] = useState<AgentType | 'general'>('general');
  const [isExpanded, setIsExpanded] = useState<boolean>(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isAssistantOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      inputRef.current?.focus();
    }
  }, [isAssistantOpen, messages, isProcessing]);

  if (!isAssistantOpen) return null;

  const handleSend = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!input.trim() || isProcessing) return;

    const query = input.trim();
    setInput('');
    askQuestion(query, {
      agentType: selectedAgent === 'general' ? undefined : selectedAgent,
    });
  };

  const handleChipClick = (question: string) => {
    askQuestion(question, {
      agentType: selectedAgent === 'general' ? undefined : selectedAgent,
    });
  };

  return (
    <>
      {/* Semi-transparent backdrop on small screens */}
      <div
        className="fixed inset-0 z-40 bg-ink/30 backdrop-blur-xs lg:hidden"
        onClick={() => setIsAssistantOpen(false)}
      />

      <aside
        className={`fixed top-0 right-0 z-50 h-full bg-surface border-l border-border shadow-2xl flex flex-col transition-all duration-300 ease-in-out ${
          isExpanded ? 'w-full lg:w-[720px]' : 'w-full sm:w-[500px] lg:w-[520px]'
        }`}
        aria-label="ReliefHub Intelligence Assistant Panel"
      >
        {/* Assistant Header */}
        <div className="p-4 sm:p-5 border-b border-border bg-canvas/40 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-copper flex items-center justify-center text-white shrink-0 shadow-sm">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-serif font-bold text-ink">
                  ReliefHub Intelligence
                </h2>
                <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-surface border border-border text-teal uppercase tracking-wider">
                  AI Ops
                </span>
              </div>
              <p className="text-[11px] text-ink-muted">
                {selectedDistrict === 'all' ? 'All Districts' : `${selectedDistrict} District`} · 4 Specialized Agents
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            {/* View Activity Panel Button */}
            <button
              onClick={() => setIsActivityPanelOpen(true)}
              className="p-1.5 rounded text-ink-muted hover:text-copper hover:bg-canvas transition"
              title="View Specialized Agents Console"
              aria-label="View Specialized Agents Console"
            >
              <Activity className="w-4 h-4" />
            </button>

            {/* Expand / Minimize Width (Desktop) */}
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="hidden lg:block p-1.5 rounded text-ink-muted hover:text-ink hover:bg-canvas transition"
              title={isExpanded ? 'Restore width' : 'Expand panel'}
            >
              {isExpanded ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </button>

            {/* Clear conversation */}
            <button
              onClick={clearConversation}
              className="p-1.5 rounded text-ink-muted hover:text-critical hover:bg-canvas transition"
              title="Clear conversation history"
              aria-label="Clear conversation history"
            >
              <Trash2 className="w-4 h-4" />
            </button>

            {/* Close Drawer */}
            <button
              onClick={() => setIsAssistantOpen(false)}
              className="p-1.5 rounded text-ink-muted hover:text-ink hover:bg-canvas transition"
              aria-label="Close assistant"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Specialized Agent Quick-Filter Bar */}
        <div className="px-4 py-2 border-b border-border bg-canvas/20 flex items-center gap-1.5 overflow-x-auto text-[11px]">
          <span className="text-ink-muted font-medium shrink-0 text-[10px] uppercase tracking-wider mr-1">
            Agent:
          </span>
          {[
            { id: 'general', label: 'Auto Orchestrator' },
            { id: 'needs_analysis', label: 'Needs Analysis' },
            { id: 'supply_planning', label: 'Supply Planning' },
            { id: 'dispatch_monitoring', label: 'Dispatches' },
            { id: 'operations_summary', label: 'Ops Summary' },
          ].map((ag) => (
            <button
              key={ag.id}
              onClick={() => setSelectedAgent(ag.id as any)}
              className={`px-2.5 py-1 rounded-full whitespace-nowrap font-semibold transition ${
                selectedAgent === ag.id
                  ? 'bg-copper text-white shadow-xs'
                  : 'bg-surface text-ink-muted hover:text-ink border border-border/80'
              }`}
            >
              {ag.label}
            </button>
          ))}
        </div>

        {/* Conversation Stream */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
          {messages.map((msg) => (
            <MessageItem key={msg.id} message={msg} />
          ))}

          {/* Processing Typing Indicator */}
          {isProcessing && (
            <div className="flex items-center gap-3 p-3 bg-canvas/40 rounded-lg border border-border animate-pulse text-xs text-ink-muted">
              <div className="w-5 h-5 border-2 border-copper/40 border-t-copper rounded-full animate-spin shrink-0" />
              <span>Analyzing live database records & validating non-negotiable rules...</span>
            </div>
          )}

          {/* Retry Prompt for Failed Request */}
          {lastFailedQuery && !isProcessing && (
            <div className="p-3 rounded bg-critical-light border border-critical-border flex items-center justify-between text-xs text-critical">
              <span>Query failed to resolve.</span>
              <button
                onClick={retryLastQuery}
                className="flex items-center gap-1 font-bold underline hover:text-critical-hover"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Retry</span>
              </button>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Suggested Question Chips */}
        <div className="p-3 border-t border-border bg-canvas/30 space-y-1.5">
          <span className="text-[10px] font-bold uppercase tracking-wider text-ink-muted block px-1">
            Suggested Inquiries
          </span>
          <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-none">
            {SUGGESTED_QUESTIONS.map((question, idx) => (
              <button
                key={idx}
                onClick={() => handleChipClick(question)}
                disabled={isProcessing}
                className="px-2.5 py-1 rounded bg-surface hover:bg-copper-light hover:text-copper border border-border/80 text-[11px] text-ink-light whitespace-nowrap transition shrink-0 disabled:opacity-50"
              >
                {question}
              </button>
            ))}
          </div>
        </div>

        {/* Message Input Composer */}
        <form onSubmit={handleSend} className="p-3 sm:p-4 border-t border-border bg-surface">
          <div className="flex items-center gap-2">
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask ReliefHub Intelligence about camps, gaps, stock, or convoys..."
              disabled={isProcessing}
              className="flex-1 px-3.5 py-2.5 bg-canvas/50 border border-border rounded-md text-xs text-ink focus:border-copper focus:ring-1 focus:ring-copper focus:bg-surface transition disabled:opacity-50 min-h-[44px]"
              aria-label="Type message to ReliefHub Intelligence"
            />
            <button
              type="submit"
              disabled={!input.trim() || isProcessing}
              className="px-4 py-2.5 bg-copper hover:bg-copper-hover disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-semibold rounded-md shadow-sm transition flex items-center justify-center min-h-[44px] min-w-[44px]"
              aria-label="Send query"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>

          <div className="flex items-center justify-between text-[10px] text-ink-muted mt-2 px-1">
            <span className="flex items-center gap-1">
              <ShieldCheck className="w-3 h-3 text-teal" />
              <span>Strict Non-Negotiable Rule Engine: Never fabricates stock or dispatches.</span>
            </span>
            <span className="font-mono">Press Enter ↵</span>
          </div>
        </form>
      </aside>
    </>
  );
};
