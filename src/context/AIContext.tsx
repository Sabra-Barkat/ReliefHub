import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { AgentDescriptor, AgentType, AIMessage, SourceReference, ActionProposal } from '../types/ai';
import { aiApi } from '../services/aiApi';
import { useApp } from './AppContext';

interface AIContextType {
  isAssistantOpen: boolean;
  setIsAssistantOpen: (open: boolean) => void;
  isActivityPanelOpen: boolean;
  setIsActivityPanelOpen: (open: boolean) => void;
  messages: AIMessage[];
  isProcessing: boolean;
  activeAgentFilter: AgentType | 'all';
  setActiveAgentFilter: (filter: AgentType | 'all') => void;
  agentsList: AgentDescriptor[];
  providerInfo: { provider: string; mode: string };
  askQuestion: (
    query: string,
    options?: { agentType?: AgentType; context?: { page?: string; recordId?: string; needId?: string } }
  ) => Promise<void>;
  runSpecificAgent: (agentId: AgentType, context?: any) => Promise<void>;
  openAssistantWithQuery: (
    query: string,
    agentType?: AgentType,
    context?: { page?: string; recordId?: string; needId?: string }
  ) => void;
  clearConversation: () => void;
  retryLastQuery: () => void;
  lastFailedQuery: string | null;
  agentStatus: Record<AgentType, 'idle' | 'analyzing' | 'completed' | 'error'>;
}

const AIContext = createContext<AIContextType | undefined>(undefined);

const INITIAL_WELCOME_MESSAGE: AIMessage = {
  id: 'msg-welcome',
  sender: 'assistant',
  timestamp: new Date().toISOString(),
  provider: 'deterministic_engine',
  agentType: 'operations_summary',
  text: `Welcome to **ReliefHub Intelligence**. I coordinate with four specialized logistics agents to provide explainable operational guidance for flood-relief camps across Sindh.

Every metric strictly honors verified data: **Delivered** physical fulfilment, **Committed** in-transit convoys, and **Unallocated** true gaps. Click a suggested question below or enter any field query to begin.`,
  conclusion: 'ReliefHub Intelligence is ready for field operations.',
};

export const AIProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { selectedDistrict } = useApp();

  const [isAssistantOpen, setIsAssistantOpen] = useState<boolean>(false);
  const [isActivityPanelOpen, setIsActivityPanelOpen] = useState<boolean>(false);
  const [messages, setMessages] = useState<AIMessage[]>([INITIAL_WELCOME_MESSAGE]);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [activeAgentFilter, setActiveAgentFilter] = useState<AgentType | 'all'>('all');
  const [agentsList, setAgentsList] = useState<AgentDescriptor[]>([]);
  const [providerInfo, setProviderInfo] = useState<{ provider: string; mode: string }>({
    provider: 'deterministic_engine',
    mode: 'deterministic_rules_engine',
  });
  const [lastFailedQuery, setLastFailedQuery] = useState<string | null>(null);

  const [agentStatus, setAgentStatus] = useState<
    Record<AgentType, 'idle' | 'analyzing' | 'completed' | 'error'>
  >({
    needs_analysis: 'idle',
    supply_planning: 'idle',
    dispatch_monitoring: 'idle',
    operations_summary: 'idle',
    general: 'idle',
  });

  // Load agents metadata
  useEffect(() => {
    aiApi
      .getAgents()
      .then((data) => {
        setAgentsList(data.agents);
        setProviderInfo({ provider: data.provider, mode: data.mode });
      })
      .catch((err) => {
        console.error('Failed to load AI agents list:', err);
      });
  }, []);

  const askQuestion = useCallback(
    async (
      query: string,
      options?: {
        agentType?: AgentType;
        context?: { page?: string; recordId?: string; needId?: string };
      }
    ) => {
      if (!query.trim() || isProcessing) return;

      const userMsgId = `user-${Date.now()}`;
      const userMessage: AIMessage = {
        id: userMsgId,
        sender: 'user',
        timestamp: new Date().toISOString(),
        text: query.trim(),
      };

      setMessages((prev) => [...prev, userMessage]);
      setIsProcessing(true);
      setLastFailedQuery(null);

      const targetAgent = options?.agentType || 'general';
      if (targetAgent !== 'general') {
        setAgentStatus((prev) => ({ ...prev, [targetAgent]: 'analyzing' }));
      }

      try {
        const response = await aiApi.queryAI({
          query: query.trim(),
          district: selectedDistrict,
          agentType: options?.agentType,
          context: options?.context,
        });

        const assistantMessage: AIMessage = {
          ...response,
          sender: 'assistant',
        };

        setMessages((prev) => [...prev, assistantMessage]);

        if (response.agentType) {
          setAgentStatus((prev) => ({ ...prev, [response.agentType!]: 'completed' }));
        }
      } catch (err: any) {
        console.error('Error querying AI:', err);
        setLastFailedQuery(query.trim());
        const errorMsg: AIMessage = {
          id: `err-${Date.now()}`,
          sender: 'assistant',
          timestamp: new Date().toISOString(),
          isError: true,
          text: `Unable to complete analysis: ${err.message || 'Connection to ReliefHub AI service interrupted.'}`,
          conclusion: 'Query failed to resolve.',
        };
        setMessages((prev) => [...prev, errorMsg]);
        if (targetAgent !== 'general') {
          setAgentStatus((prev) => ({ ...prev, [targetAgent]: 'error' }));
        }
      } finally {
        setIsProcessing(false);
      }
    },
    [isProcessing, selectedDistrict]
  );

  const runSpecificAgent = useCallback(
    async (agentId: AgentType, context?: any) => {
      const agentDesc = agentsList.find((a) => a.id === agentId);
      const queryPrompt = `Run ${agentDesc?.name || agentId} analysis`;
      setIsAssistantOpen(true);
      await askQuestion(queryPrompt, { agentType: agentId, context });
    },
    [agentsList, askQuestion]
  );

  const openAssistantWithQuery = useCallback(
    (
      query: string,
      agentType?: AgentType,
      context?: { page?: string; recordId?: string; needId?: string }
    ) => {
      setIsAssistantOpen(true);
      askQuestion(query, { agentType, context });
    },
    [askQuestion]
  );

  const clearConversation = useCallback(() => {
    setMessages([INITIAL_WELCOME_MESSAGE]);
    setLastFailedQuery(null);
  }, []);

  const retryLastQuery = useCallback(() => {
    if (lastFailedQuery) {
      askQuestion(lastFailedQuery);
    }
  }, [lastFailedQuery, askQuestion]);

  return (
    <AIContext.Provider
      value={{
        isAssistantOpen,
        setIsAssistantOpen,
        isActivityPanelOpen,
        setIsActivityPanelOpen,
        messages,
        isProcessing,
        activeAgentFilter,
        setActiveAgentFilter,
        agentsList,
        providerInfo,
        askQuestion,
        runSpecificAgent,
        openAssistantWithQuery,
        clearConversation,
        retryLastQuery,
        lastFailedQuery,
        agentStatus,
      }}
    >
      {children}
    </AIContext.Provider>
  );
};

export const useAI = () => {
  const context = useContext(AIContext);
  if (!context) throw new Error('useAI must be used within an AIProvider');
  return context;
};
