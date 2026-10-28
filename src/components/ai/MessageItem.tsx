import React, { useState } from 'react';
import { AIMessage, SourceReference } from '../../types/ai';
import { useApp } from '../../context/AppContext';
import { api } from '../../services/api';
import {
  Bot,
  User,
  Copy,
  Check,
  CheckCircle2,
  ExternalLink,
  ArrowRight,
  ShieldCheck,
  Package,
  Tent,
  Truck,
  HeartHandshake,
  Users,
  AlertTriangle,
} from 'lucide-react';

interface MessageItemProps {
  message: AIMessage;
}

export const MessageItem: React.FC<MessageItemProps> = ({ message }) => {
  const { openDrawerWithNeed, openAllocationModal, addToast } = useApp();
  const [copied, setCopied] = useState<boolean>(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(message.text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSourceClick = async (source: SourceReference) => {
    try {
      if (source.type === 'need' && source.meta?.camp_id && source.meta?.need_id) {
        const camp = await api.getCampById(source.meta.camp_id);
        const targetNeed = camp.needs.find((n) => n.id === source.meta?.need_id);
        if (targetNeed) {
          openDrawerWithNeed(targetNeed);
        }
      } else if (source.type === 'camp' && source.id) {
        const camp = await api.getCampById(source.id);
        if (camp.needs.length > 0) {
          openDrawerWithNeed(camp.needs[0]);
        }
      }
    } catch (err) {
      console.error('Failed to inspect source record:', err);
    }
  };

  const handleActionClick = async () => {
    if (!message.actionProposal) return;
    const { actionType, payload } = message.actionProposal;

    if (actionType === 'allocate_supplies' && payload.camp_id && payload.need_id) {
      try {
        const camp = await api.getCampById(payload.camp_id);
        const targetNeed = camp.needs.find((n) => n.id === payload.need_id);
        if (targetNeed) {
          openAllocationModal(targetNeed, payload.suggestedQty);
        }
      } catch (err) {
        console.error('Failed to trigger proposed allocation:', err);
      }
    } else if (actionType === 'inspect_dispatch' && payload.camp_id) {
      try {
        const camp = await api.getCampById(payload.camp_id);
        if (camp.needs.length > 0) {
          openDrawerWithNeed(camp.needs[0]);
        }
      } catch (err) {
        console.error('Failed to inspect dispatch:', err);
      }
    }
  };

  if (message.sender === 'user') {
    return (
      <div className="flex justify-end mb-4">
        <div className="max-w-[85%] bg-copper text-white rounded-lg px-4 py-2.5 text-xs shadow-sm">
          <p className="leading-relaxed whitespace-pre-wrap">{message.text}</p>
          <span className="text-[10px] text-white/70 block text-right mt-1">
            {new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </span>
        </div>
      </div>
    );
  }

  // Assistant message rendering
  const getAgentLabel = () => {
    switch (message.agentType) {
      case 'needs_analysis':
        return { name: 'Needs Analysis Agent', color: 'text-copper bg-copper-light border-copper-border' };
      case 'supply_planning':
        return { name: 'Supply Planning Agent', color: 'text-saffron-hover bg-saffron-light border-saffron-border' };
      case 'dispatch_monitoring':
        return { name: 'Dispatch Monitoring Agent', color: 'text-teal bg-teal-light border-teal-border' };
      case 'operations_summary':
        return { name: 'Operations Summary Agent', color: 'text-ink-light bg-canvas border-border' };
      default:
        return { name: 'ReliefHub Intelligence', color: 'text-ink-light bg-canvas border-border' };
    }
  };

  const agentLabel = getAgentLabel();

  return (
    <div className="flex gap-3 mb-6 animate-fade-in text-xs">
      {/* Bot Icon */}
      <div className="w-7 h-7 rounded-full bg-canvas border border-border flex items-center justify-center shrink-0 mt-0.5 text-copper">
        <Bot className="w-4 h-4" />
      </div>

      <div className="flex-1 min-w-0 space-y-3">
        {/* Agent Metadata Header */}
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span
              className={`text-[10px] font-bold px-2 py-0.5 rounded border uppercase tracking-wider ${agentLabel.color}`}
            >
              {agentLabel.name}
            </span>

            <span className="inline-flex items-center gap-1 text-[10px] font-medium text-ink-muted bg-surface border border-border/80 px-2 py-0.5 rounded">
              <ShieldCheck className="w-3 h-3 text-teal" />
              <span>
                {message.provider === 'deterministic_engine'
                  ? 'Audited Deterministic Rules Engine'
                  : 'LLM Augmented Model'}
              </span>
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleCopy}
              className="p-1 rounded text-ink-muted hover:text-ink hover:bg-canvas transition"
              title="Copy response to clipboard"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-teal" /> : <Copy className="w-3.5 h-3.5" />}
            </button>
            <span className="text-[10px] text-ink-muted tabular-nums">
              {new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>
        </div>

        {/* Conclusion Callout (if available) */}
        {message.conclusion && (
          <div className="p-3 bg-canvas/70 rounded-md border-l-2 border-copper border-t border-r border-b border-border">
            <span className="text-[10px] font-bold text-copper uppercase tracking-wider block mb-0.5">
              Key Insight
            </span>
            <p className="font-serif font-bold text-ink leading-snug">{message.conclusion}</p>
          </div>
        )}

        {/* Core Narrative / Text */}
        <div className="bg-surface p-4 rounded-lg border border-border shadow-card text-ink space-y-2 leading-relaxed">
          {message.text.split('\n\n').map((paragraph, idx) => (
            <p key={idx} className="whitespace-pre-wrap">
              {paragraph}
            </p>
          ))}
        </div>

        {/* Evidence Breakdown */}
        {message.evidence && message.evidence.length > 0 && (
          <div className="bg-canvas/40 p-3.5 rounded-lg border border-border space-y-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-ink-muted block">
              Authoritative Evidence Records ({message.evidence.length})
            </span>
            <ul className="space-y-1.5 text-[11px] text-ink-light">
              {message.evidence.map((line, idx) => (
                <li key={idx} className="flex items-start gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-teal shrink-0 mt-0.5" />
                  <span>{line}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Calculation Details */}
        {message.calculation && (
          <div className="px-3 py-2 bg-surface rounded border border-border/70 text-[10px] text-ink-muted flex items-start gap-2">
            <span className="font-bold text-copper shrink-0">Rule Logic:</span>
            <code className="font-mono bg-canvas px-1.5 py-0.5 rounded text-[10px] text-ink block break-all">
              {message.calculation}
            </code>
          </div>
        )}

        {/* Clickable Source References */}
        {message.sources && message.sources.length > 0 && (
          <div className="space-y-1.5">
            <span className="text-[10px] font-bold uppercase tracking-wider text-ink-muted block">
              Reference Records
            </span>
            <div className="flex flex-wrap gap-2">
              {message.sources.map((src, idx) => (
                <button
                  key={idx}
                  onClick={() => handleSourceClick(src)}
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-surface border border-border hover:border-copper text-[11px] text-ink transition shadow-sm group"
                  title="Inspect record in detail"
                >
                  {src.type === 'camp' && <Tent className="w-3 h-3 text-copper shrink-0" />}
                  {src.type === 'item' && <Package className="w-3 h-3 text-teal shrink-0" />}
                  {src.type === 'dispatch' && <Truck className="w-3 h-3 text-saffron-hover shrink-0" />}
                  {src.type === 'donation' && <HeartHandshake className="w-3 h-3 text-copper shrink-0" />}
                  {src.type === 'volunteer' && <Users className="w-3 h-3 text-teal shrink-0" />}
                  <span className="font-semibold group-hover:text-copper transition">{src.title}</span>
                  <ExternalLink className="w-3 h-3 text-ink-muted group-hover:text-copper transition" />
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Human-in-the-Loop Action Proposal Button */}
        {message.actionProposal && (
          <div className="pt-2">
            <button
              onClick={handleActionClick}
              className="w-full py-2.5 px-4 bg-copper hover:bg-copper-hover text-white text-xs font-semibold rounded-md shadow-sm transition flex items-center justify-center gap-2 group"
            >
              <span>{message.actionProposal.label}</span>
              <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition" />
            </button>
            <span className="text-[10px] text-ink-muted text-center block mt-1">
              ✓ Requires coordinator review and confirmation. No dispatches are committed autonomously.
            </span>
          </div>
        )}
      </div>
    </div>
  );
};
