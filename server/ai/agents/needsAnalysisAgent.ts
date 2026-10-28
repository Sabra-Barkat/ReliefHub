import { aiTools } from '../tools.js';
import { AIResponsePayload, SourceReference, ActionProposal } from '../types.js';

export async function runNeedsAnalysisAgent(params: {
  district?: string;
  camp_id?: string;
  specificQuery?: string;
}): Promise<AIResponsePayload> {
  const needs = aiTools.getCampNeeds({
    critical_only: true,
    district: params.district,
    camp_id: params.camp_id,
  });

  const sources: SourceReference[] = [];
  const evidenceLines: string[] = [];

  for (const n of needs.slice(0, 5)) {
    sources.push({
      type: 'need',
      id: n.id,
      title: `${n.camp?.name} · ${n.item?.name}`,
      subtitle: `${n.delivered_pct}% delivered (${n.fulfilled_quantity} of ${n.required_quantity} ${n.item?.unit})`,
      badge: `${n.priority} Priority`,
      meta: {
        camp_id: n.camp_id,
        need_id: n.id,
        unallocated: n.unallocated,
        committed: n.reserved_quantity,
        stock: n.item?.stock,
        unit: n.item?.unit,
      },
    });

    evidenceLines.push(
      `${n.camp?.name} (${n.camp?.district}): ${n.item?.name} — ${n.delivered_pct}% delivered (${n.fulfilled_quantity}/${n.required_quantity} ${n.item?.unit}), ${n.reserved_quantity} committed, ${n.unallocated} unallocated gap.`
    );
  }

  const topGap = needs[0];
  let conclusion = '';
  let text = '';
  let actionProposal: ActionProposal | undefined = undefined;

  if (needs.length === 0) {
    conclusion = 'No critical high-priority needs below 40% delivered fulfilment found.';
    text = `Currently, all high-priority relief camp needs in ${
      params.district && params.district !== 'all' ? params.district : 'all monitored districts'
    } have achieved or exceeded 40% delivered fulfilment. Continue monitoring incoming dispatches to ensure in-transit supplies arrive.`;
  } else {
    conclusion = `${needs.length} high-priority need${
      needs.length > 1 ? 's' : ''
    } currently meet the under-40% delivered-fulfilment criterion.`;

    const topItemStock = topGap?.item?.stock || 0;
    const canAllocate = topItemStock >= topGap?.unallocated;

    text = `Identified ${needs.length} underserved camp need(s) where physically delivered supplies remain critically below 40%. The most severe gap is at **${topGap.camp?.name}** (${topGap.camp?.district}), requiring **${topGap.required_quantity} ${topGap.item?.unit}** of ${topGap.item?.name}, with only **${topGap.delivered_pct}% delivered** (${topGap.fulfilled_quantity} ${topGap.item?.unit}), **${topGap.reserved_quantity} committed**, and **${topGap.unallocated} unallocated**.

${
  topItemStock > 0
    ? `Warehouse currently holds **${topItemStock} ${topGap.item?.unit}** of ${topGap.item?.name}. You can allocate up to **${Math.min(
        topItemStock,
        topGap.unallocated
      )} ${topGap.item?.unit}**.`
    : `Warehouse stock for ${topGap.item?.name} is currently depleted (0 ${topGap.item?.unit}). External supplier or donor sourcing is required.`
} Review available warehouse stock before creating a reservation.`;

    if (topGap && topItemStock > 0) {
      actionProposal = {
        actionType: 'allocate_supplies',
        label: `Preview Allocation for ${topGap.camp?.name}`,
        targetId: topGap.camp_id,
        targetNeedId: topGap.id,
        payload: {
          camp_id: topGap.camp_id,
          need_id: topGap.id,
          suggestedQty: Math.min(topItemStock, topGap.unallocated),
        },
      };
    }
  }

  return {
    id: `resp-${Date.now()}`,
    query: params.specificQuery || 'Analyze underserved camp needs',
    agentType: 'needs_analysis',
    provider: 'deterministic_engine',
    text,
    conclusion,
    evidence: evidenceLines,
    calculation: 'unallocated = max(0, required - delivered - committed). Critical gap rule: priority == High AND delivered_pct < 40.',
    sources,
    actionProposal,
    timestamp: new Date().toISOString(),
  };
}
