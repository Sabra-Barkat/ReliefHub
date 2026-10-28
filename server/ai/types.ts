export type AgentType =
  | 'needs_analysis'
  | 'supply_planning'
  | 'dispatch_monitoring'
  | 'operations_summary'
  | 'general';

export type AgentStatus = 'idle' | 'analyzing' | 'completed' | 'error';

export interface SourceReference {
  type: 'camp' | 'need' | 'item' | 'dispatch' | 'donation' | 'volunteer';
  id: string;
  title: string;
  subtitle?: string;
  badge?: string;
  meta?: Record<string, any>;
}

export interface ActionProposal {
  actionType:
    | 'allocate_supplies'
    | 'review_quantity'
    | 'inspect_dispatch'
    | 'inspect_camp'
    | 'source_item';
  label: string;
  targetId: string;
  targetNeedId?: string;
  payload: Record<string, any>;
}

export interface AIResponsePayload {
  id: string;
  query: string;
  agentType: AgentType;
  provider: 'deterministic_engine' | 'gemini_api' | 'openai_api';
  text: string;
  conclusion?: string;
  evidence?: string[];
  calculation?: string;
  sources?: SourceReference[];
  actionProposal?: ActionProposal;
  timestamp: string;
}

export interface AgentDescriptor {
  id: AgentType;
  name: string;
  role: string;
  description: string;
  suggestedPrompts: string[];
}
