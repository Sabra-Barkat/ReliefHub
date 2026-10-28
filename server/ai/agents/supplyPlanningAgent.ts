import { aiTools } from '../tools.js';
import { AIResponsePayload, SourceReference, ActionProposal } from '../types.js';

export async function runSupplyPlanningAgent(params: {
  district?: string;
  item_id?: string;
  camp_id?: string;
  specificQuery?: string;
}): Promise<AIResponsePayload> {
  const lowStockItems = aiTools.getInventory({ low_stock: true });
  const allNeeds = aiTools.getCampNeeds({ district: params.district });

  const unallocatedNeeds = allNeeds.filter((n) => n.unallocated > 0);
  const sources: SourceReference[] = [];
  const evidenceLines: string[] = [];

  // Match items with gaps
  const matchedPlanning: {
    item: any;
    need: any;
    availableStock: number;
    maxDispatch: number;
    canFullyCover: boolean;
    competingCount: number;
  }[] = [];

  for (const need of unallocatedNeeds) {
    const item = need.item;
    if (!item) continue;
    if (params.item_id && item.id !== params.item_id) continue;
    if (params.camp_id && need.camp_id !== params.camp_id) continue;

    const stock = Number(item.stock);
    const maxDispatch = Math.min(stock, need.unallocated);

    const competingCount = unallocatedNeeds.filter(
      (n) => n.inventory_item_id === item.id && n.camp_id !== need.camp_id
    ).length;

    matchedPlanning.push({
      item,
      need,
      availableStock: stock,
      maxDispatch,
      canFullyCover: stock >= need.unallocated,
      competingCount,
    });
  }

  // Sort by priority and stock availability
  matchedPlanning.sort((a, b) => {
    if (a.need.priority === 'High' && b.need.priority !== 'High') return -1;
    if (b.need.priority === 'High' && a.need.priority !== 'High') return 1;
    return b.maxDispatch - a.maxDispatch;
  });

  for (const plan of matchedPlanning.slice(0, 5)) {
    sources.push({
      type: 'item',
      id: plan.item.id,
      title: `${plan.item.name} (${plan.item.category})`,
      subtitle: `Depot: ${plan.availableStock} ${plan.item.unit} | Target: ${plan.need.camp?.name} (Gap: ${plan.need.unallocated} ${plan.item.unit})`,
      badge: plan.canFullyCover ? 'Can Cover Full Gap' : 'Partial Stock Coverage',
      meta: {
        item_id: plan.item.id,
        camp_id: plan.need.camp_id,
        need_id: plan.need.id,
        availableStock: plan.availableStock,
        unallocated: plan.need.unallocated,
        maxDispatch: plan.maxDispatch,
      },
    });

    evidenceLines.push(
      `${plan.need.camp?.name} needs ${plan.need.unallocated} ${plan.item.unit} of ${plan.item.name}. Warehouse stock available: ${plan.availableStock} ${plan.item.unit}. Max allocatable: ${plan.maxDispatch} ${plan.item.unit}.`
    );
  }

  const topMatch = matchedPlanning[0];
  let conclusion = '';
  let text = '';
  let actionProposal: ActionProposal | undefined = undefined;

  if (!topMatch) {
    conclusion = 'No unallocated camp needs matched with available warehouse stock.';
    text = `Currently, all open needs either have zero depot stock or have already been committed in pending convoys. ${lowStockItems.length} inventory item(s) are at or below reorder thresholds and require donation influx or procurement.`;
  } else {
    conclusion = `Calculated valid supply allocations for ${matchedPlanning.length} outstanding camp gap(s).`;
    const preview = aiTools.calculateAllocationPreview(topMatch.need.camp_id, topMatch.need.id, topMatch.maxDispatch);

    text = `Analysis of warehouse depot stock against field demand indicates a primary feasible reservation for **${topMatch.need.camp?.name}** (${topMatch.need.camp?.district}):

- **Target Item:** ${topMatch.item.name} (${topMatch.item.unit})
- **Current Unallocated Gap:** ${topMatch.need.unallocated} ${topMatch.item.unit} (${topMatch.need.priority} priority)
- **Depot Stock:** ${preview.stock_before} ${topMatch.item.unit} available
- **Maximum Permitted Dispatch:** **${preview.proposed_quantity} ${topMatch.item.unit}**
- **Impact on Depot Stock:** ${preview.stock_before} $\\to$ **${preview.stock_after}** ${topMatch.item.unit} ${
      preview.reorder_warning ? '(Advisory: drops to or below reorder threshold)' : ''
    }
- **Impact on Committed Need:** ${preview.committed_before} $\\to$ **${preview.committed_after}** ${topMatch.item.unit}
- **Impact on Unallocated Need:** ${preview.unallocated_before} $\\to$ **${preview.unallocated_after}** ${topMatch.item.unit}
- **Physical Fulfilment:** Remains unchanged at ${preview.delivered_fulfilment_unchanged} ${topMatch.item.unit} until arrival verification.

${
  topMatch.competingCount > 0
    ? `*Context:* ${topMatch.competingCount} other camp(s) also request ${topMatch.item.name}. Coordinators should review before confirming.`
    : `No other camps are competing for this specific resource.`
}`;

    actionProposal = {
      actionType: 'allocate_supplies',
      label: `Open Allocation Preview (${preview.proposed_quantity} ${topMatch.item.unit})`,
      targetId: topMatch.need.camp_id,
      targetNeedId: topMatch.need.id,
      payload: {
        camp_id: topMatch.need.camp_id,
        need_id: topMatch.need.id,
        suggestedQty: preview.proposed_quantity,
      },
    };
  }

  return {
    id: `resp-${Date.now()}`,
    query: params.specificQuery || 'Plan warehouse supply allocations',
    agentType: 'supply_planning',
    provider: 'deterministic_engine',
    text,
    conclusion,
    evidence: evidenceLines,
    calculation: 'maximum_dispatch = min(available_stock, remaining_unallocated_need). Double-allocation prohibited.',
    sources,
    actionProposal,
    timestamp: new Date().toISOString(),
  };
}
