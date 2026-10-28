import { aiTools } from '../tools.js';
import { AIResponsePayload, SourceReference, ActionProposal } from '../types.js';

export async function runDispatchMonitoringAgent(params: {
  district?: string;
  camp_id?: string;
  dispatch_id?: string;
  specificQuery?: string;
}): Promise<AIResponsePayload> {
  const dispatches = aiTools.getDispatches({
    district: params.district,
    camp_id: params.camp_id,
  });

  const pendingList = dispatches.filter((d: any) => d.status === 'Pending');
  const inTransitList = dispatches.filter((d: any) => d.status === 'In Transit');
  const deliveredList = dispatches.filter((d: any) => d.status === 'Delivered');
  const cancelledList = dispatches.filter((d: any) => d.status === 'Cancelled');

  const sources: SourceReference[] = [];
  const evidenceLines: string[] = [];

  const activeConvoys = [...pendingList, ...inTransitList];

  for (const d of activeConvoys.slice(0, 5)) {
    sources.push({
      type: 'dispatch',
      id: d.id,
      title: `${d.id} · ${d.camp?.name} (${d.quantity} ${d.item?.unit || 'units'})`,
      subtitle: `${d.item?.name} — Status: ${d.status} | By: ${d.dispatched_by || 'Operations Desk'}`,
      badge: d.status,
      meta: {
        dispatch_id: d.id,
        camp_id: d.camp_id,
        need_id: d.need_id,
        quantity: d.quantity,
        status: d.status,
        created_at: d.created_at,
      },
    });

    evidenceLines.push(
      `Dispatch #${d.id} to ${d.camp?.name} (${d.camp?.district}): ${d.quantity} ${d.item?.unit || 'units'} of ${d.item?.name} currently in "${d.status}" status.`
    );
  }

  const conclusion = `Monitoring ${activeConvoys.length} active committed convoy(s): ${pendingList.length} Pending reservation, ${inTransitList.length} In Transit.`;

  let text = `Supply pipeline status for ${
    params.district && params.district !== 'all' ? params.district : 'all operational sectors'
  }:

- **Committed in Convoys:** **${activeConvoys.length} active dispatches** (${pendingList.length} Pending at depot loading bay, ${inTransitList.length} In Transit on highway corridors).
- **Physical Deliveries Confirmed:** ${deliveredList.length} dispatches have successfully arrived and verified at recipient camps.
- **Cancelled/Restored Convoys:** ${cancelledList.length} dispatches cancelled with warehouse stock restored.

### Critical Integrity Verification:
All ${activeConvoys.length} active dispatches represent **committed supplies only**. They are held in reserve and prevented from being re-allocated, but they will **not** count toward camp delivery fulfilment until camp representatives confirm receipt.`;

  if (pendingList.length > 0) {
    const nextPending = pendingList[0];
    text += `\n\n**Action Recommendation:** Dispatch #${nextPending.id} for **${nextPending.camp?.name}** (${nextPending.quantity} ${nextPending.item?.unit || 'units'} of ${nextPending.item?.name}) is currently **Pending**. When loading is verified, mark status as *In Transit* to update convoy tracking.`;
  }

  const topDispatch = activeConvoys[0];
  const actionProposal: ActionProposal | undefined = topDispatch
    ? {
        actionType: 'inspect_dispatch',
        label: `Inspect Dispatch #${topDispatch.id}`,
        targetId: topDispatch.id,
        payload: {
          dispatch_id: topDispatch.id,
          camp_id: topDispatch.camp_id,
        },
      }
    : undefined;

  return {
    id: `resp-${Date.now()}`,
    query: params.specificQuery || 'Investigate committed and undelivered dispatches',
    agentType: 'dispatch_monitoring',
    provider: 'deterministic_engine',
    text,
    conclusion,
    evidence: evidenceLines,
    calculation: 'committed = sum(quantity of Pending + In Transit dispatches). Delivered count updated only upon receipt.',
    sources,
    actionProposal,
    timestamp: new Date().toISOString(),
  };
}
