import { AgentDescriptor, AgentType, AIMessage } from '../types/ai';

const API_BASE = '/api';

export const aiApi = {
  async getAgents(): Promise<{
    agents: AgentDescriptor[];
    provider: string;
    mode: string;
  }> {
    const res = await fetch(`${API_BASE}/ai/agents`);
    if (!res.ok) throw new Error(`HTTP ${res.status}: Failed to fetch agent descriptors`);
    return await res.json();
  },

  async queryAI(params: {
    query: string;
    district?: string;
    agentType?: AgentType;
    context?: {
      page?: string;
      recordId?: string;
      needId?: string;
    };
  }): Promise<Omit<AIMessage, 'sender'>> {
    const res = await fetch(`${API_BASE}/ai/query`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(params),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || `HTTP ${res.status}: AI query processing failed`);
    }

    const data = await res.json();
    return {
      id: data.id,
      timestamp: data.timestamp,
      agentType: data.agentType,
      provider: data.provider,
      text: data.text,
      conclusion: data.conclusion,
      evidence: data.evidence,
      calculation: data.calculation,
      sources: data.sources,
      actionProposal: data.actionProposal,
    };
  },

  async runAgent(
    agentId: AgentType,
    params?: { district?: string; context?: any }
  ): Promise<Omit<AIMessage, 'sender'>> {
    const res = await fetch(`${API_BASE}/ai/agent/${agentId}/run`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(params || {}),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || `Agent execution failed for ${agentId}`);
    }

    const data = await res.json();
    return {
      id: data.id,
      timestamp: data.timestamp,
      agentType: data.agentType,
      provider: data.provider,
      text: data.text,
      conclusion: data.conclusion,
      evidence: data.evidence,
      calculation: data.calculation,
      sources: data.sources,
      actionProposal: data.actionProposal,
    };
  },
};
