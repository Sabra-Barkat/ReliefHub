import React from 'react';
import { useAI } from '../../context/AIContext';
import { AgentType } from '../../types/ai';
import {
  Activity,
  X,
  Target,
  Package,
  Truck,
  FileSpreadsheet,
  Play,
  CheckCircle,
  Clock,
  Sparkles,
} from 'lucide-react';

export const AgentActivityPanel: React.FC = () => {
  const {
    isActivityPanelOpen,
    setIsActivityPanelOpen,
    agentsList,
    agentStatus,
    runSpecificAgent,
    askQuestion,
  } = useAI();

  if (!isActivityPanelOpen) return null;

  const getAgentIcon = (id: AgentType) => {
    switch (id) {
      case 'needs_analysis':
        return <Target className="w-4 h-4 text-copper" />;
      case 'supply_planning':
        return <Package className="w-4 h-4 text-saffron-hover" />;
      case 'dispatch_monitoring':
        return <Truck className="w-4 h-4 text-teal" />;
      case 'operations_summary':
      default:
        return <FileSpreadsheet className="w-4 h-4 text-ink-light" />;
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink/50 backdrop-blur-sm animate-fade-in"
      role="dialog"
      aria-modal="true"
      aria-labelledby="agent-panel-title"
    >
      <div className="bg-surface w-full max-w-2xl rounded-lg border border-border shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-5 border-b border-border bg-canvas/40 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-full bg-copper-light text-copper border border-copper-border">
              <Activity className="w-4 h-4" />
            </div>
            <div>
              <h2 id="agent-panel-title" className="text-base font-serif font-bold text-ink">
                Specialized AI Agents Console
              </h2>
              <p className="text-xs text-ink-muted">
                Inspect autonomous specialized analytical sub-agents coordinating Sindh relief logistics.
              </p>
            </div>
          </div>
          <button
            onClick={() => setIsActivityPanelOpen(false)}
            className="p-1 rounded text-ink-muted hover:text-ink hover:bg-canvas transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Agent Cards List */}
        <div className="p-6 overflow-y-auto space-y-4">
          {agentsList.map((agent) => {
            const status = agentStatus[agent.id] || 'idle';

            return (
              <div
                key={agent.id}
                className="bg-canvas/40 rounded-lg border border-border p-4 hover:border-copper/50 transition space-y-3"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <div className="p-2 rounded bg-surface border border-border shrink-0">
                      {getAgentIcon(agent.id)}
                    </div>
                    <div>
                      <h3 className="font-bold text-sm text-ink">{agent.name}</h3>
                      <span className="text-[11px] font-semibold text-copper block">{agent.role}</span>
                    </div>
                  </div>

                  {/* Status Indicator */}
                  <span
                    className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                      status === 'analyzing'
                        ? 'bg-saffron-light text-saffron-hover border-saffron-border animate-pulse'
                        : status === 'completed'
                        ? 'bg-teal-light text-teal border-teal-border'
                        : 'bg-surface text-ink-muted border-border'
                    }`}
                  >
                    {status === 'analyzing' ? (
                      <span className="w-2 h-2 rounded-full bg-saffron animate-ping inline-block" />
                    ) : status === 'completed' ? (
                      <CheckCircle className="w-3 h-3 text-teal" />
                    ) : (
                      <Clock className="w-3 h-3" />
                    )}
                    <span className="capitalize">{status}</span>
                  </span>
                </div>

                <p className="text-xs text-ink-muted leading-relaxed">{agent.description}</p>

                {/* Suggested prompts chips */}
                <div className="space-y-1.5 pt-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-ink-muted block">
                    Targeted Inquiries
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {agent.suggestedPrompts.map((prompt, idx) => (
                      <button
                        key={idx}
                        onClick={() => {
                          setIsActivityPanelOpen(false);
                          askQuestion(prompt, { agentType: agent.id });
                        }}
                        className="text-[11px] font-medium bg-surface hover:bg-copper-light hover:text-copper border border-border rounded px-2.5 py-1 text-ink-light transition text-left"
                      >
                        {prompt}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Action button */}
                <div className="pt-2 border-t border-border flex justify-end">
                  <button
                    onClick={() => {
                      setIsActivityPanelOpen(false);
                      runSpecificAgent(agent.id);
                    }}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-copper hover:bg-copper-hover text-white text-xs font-semibold rounded shadow-sm transition"
                  >
                    <Play className="w-3 h-3" />
                    <span>Run Full Agent Analysis</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
