import { runNeedsAnalysisAgent } from './agents/needsAnalysisAgent.js';
import { runSupplyPlanningAgent } from './agents/supplyPlanningAgent.js';
import { runDispatchMonitoringAgent } from './agents/dispatchMonitoringAgent.js';
import { runOperationsSummaryAgent } from './agents/operationsSummaryAgent.js';
import { AgentDescriptor, AgentType, AIResponsePayload } from './types.js';

export const REGISTERED_AGENTS: AgentDescriptor[] = [
  {
    id: 'needs_analysis',
    name: 'Needs Analysis Agent',
    role: 'Vulnerability & Shortage Specialist',
    description:
      'Identifies underserved flood-relief camps and explains critical gaps where delivered fulfilment is below 40%.',
    suggestedPrompts: [
      'Which high-priority needs are below 40% delivered fulfilment?',
      'Which camps have the largest unallocated water needs?',
      'Explain critical response gaps in Sukkur district.',
    ],
  },
  {
    id: 'supply_planning',
    name: 'Supply Planning Agent',
    role: 'Depot Allocation & Stocking Specialist',
    description:
      'Evaluates warehouse inventory against open camp gaps and formulates double-allocation safe reservations.',
    suggestedPrompts: [
      'What can we allocate with the available warehouse stock?',
      'Which supplies are currently low in stock?',
      'Review replenishment requirements for shelter items.',
    ],
  },
  {
    id: 'dispatch_monitoring',
    name: 'Dispatch Monitoring Agent',
    role: 'Convoy & Pipeline Integrity Specialist',
    description:
      'Tracks committed Pending and In Transit dispatches to ensure logistics velocity without premature delivery claims.',
    suggestedPrompts: [
      'Show committed supplies that have not been delivered.',
      'Which camps need follow-up on pending dispatches?',
      'Review active convoys across transport corridors.',
    ],
  },
  {
    id: 'operations_summary',
    name: 'Operations Summary Agent',
    role: 'Executive Intelligence & Reporting Specialist',
    description:
      'Synthesizes multi-sector evidence briefings spanning camps, physical stock, cash aid, and volunteer rosters.',
    suggestedPrompts: [
      'Summarize the current response gaps in a selected district.',
      'Give me an operational status briefing for Sindh province.',
      'Which volunteers are currently unassigned and ready for deployment?',
    ],
  },
];

export async function processAIQuery(params: {
  query: string;
  district?: string;
  agentType?: AgentType;
  context?: {
    page?: string;
    recordId?: string;
    needId?: string;
  };
}): Promise<AIResponsePayload> {
  const queryLower = params.query.toLowerCase();
  let selectedAgent: AgentType = params.agentType || 'general';

  // Intent classification if not explicitly set
  if (selectedAgent === 'general') {
    if (
      queryLower.includes('underserved') ||
      queryLower.includes('vulnerab') ||
      queryLower.includes('gap') ||
      queryLower.includes('need') ||
      queryLower.includes('shortage') ||
      queryLower.includes('40%') ||
      queryLower.includes('water')
    ) {
      selectedAgent = 'needs_analysis';
    } else if (
      queryLower.includes('stock') ||
      queryLower.includes('allocat') ||
      queryLower.includes('warehouse') ||
      queryLower.includes('depot') ||
      queryLower.includes('reorder') ||
      queryLower.includes('replenish') ||
      queryLower.includes('inventory')
    ) {
      selectedAgent = 'supply_planning';
    } else if (
      queryLower.includes('dispatch') ||
      queryLower.includes('transit') ||
      queryLower.includes('pending') ||
      queryLower.includes('convoy') ||
      queryLower.includes('delivery') ||
      queryLower.includes('committed')
    ) {
      selectedAgent = 'dispatch_monitoring';
    } else if (
      queryLower.includes('summar') ||
      queryLower.includes('report') ||
      queryLower.includes('overview') ||
      queryLower.includes('donation') ||
      queryLower.includes('volunteer') ||
      queryLower.includes('status') ||
      queryLower.includes('brief')
    ) {
      selectedAgent = 'operations_summary';
    } else {
      selectedAgent = 'operations_summary'; // Default safe, holistic overview
    }
  }

  // Execute the specialized agent
  switch (selectedAgent) {
    case 'needs_analysis':
      return await runNeedsAnalysisAgent({
        district: params.district,
        camp_id: params.context?.recordId,
        specificQuery: params.query,
      });

    case 'supply_planning':
      return await runSupplyPlanningAgent({
        district: params.district,
        camp_id: params.context?.recordId,
        item_id: params.context?.needId,
        specificQuery: params.query,
      });

    case 'dispatch_monitoring':
      return await runDispatchMonitoringAgent({
        district: params.district,
        camp_id: params.context?.recordId,
        dispatch_id: params.context?.needId,
        specificQuery: params.query,
      });

    case 'operations_summary':
    default:
      return await runOperationsSummaryAgent({
        district: params.district,
        specificQuery: params.query,
      });
  }
}
