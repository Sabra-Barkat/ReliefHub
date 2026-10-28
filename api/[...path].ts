import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs';

// ---------------------------------------------------------------------------
// SEED DATA – read once at cold start (Vercel bundles static files alongside fn)
// ---------------------------------------------------------------------------
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function loadSeed(): any {
  // In Vercel deployment, seed.json is bundled. Try several relative paths.
  const candidates = [
    path.join(__dirname, 'server', 'data', 'seed.json'),
    path.join(__dirname, '..', 'server', 'data', 'seed.json'),
    path.join(process.cwd(), 'server', 'data', 'seed.json'),
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) {
      return JSON.parse(fs.readFileSync(p, 'utf-8'));
    }
  }
  // Inline minimal fallback so the function won't crash on cold start
  return { camps: [], inventory: [], needs: [], dispatches: [], donations: [], volunteers: [], audit_logs: [] };
}

// Module-level in-memory DB — persists within a single serverless instance
let db: any = loadSeed();

// ---------------------------------------------------------------------------
// HELPERS
// ---------------------------------------------------------------------------
function calculateNeedMetrics(need: any, database: any) {
  const camp = database.camps.find((c: any) => c.id === need.camp_id);
  const item = database.inventory.find((i: any) => i.id === need.inventory_item_id);

  const relevantDispatches = database.dispatches.filter(
    (d: any) => d.need_id === need.id && (d.status === 'Pending' || d.status === 'In Transit')
  );
  const reserved_quantity = relevantDispatches.reduce((acc: number, d: any) => acc + Number(d.quantity), 0);

  const fulfilled_quantity = Number(need.fulfilled_quantity || 0);
  const required_quantity = Number(need.required_quantity || 0);

  const unallocated = Math.max(0, required_quantity - fulfilled_quantity - reserved_quantity);

  const delivered_pct =
    required_quantity > 0 ? Math.min(100, Math.round((fulfilled_quantity / required_quantity) * 100)) : 0;
  const committed_pct =
    required_quantity > 0
      ? Math.min(100 - delivered_pct, Math.round((reserved_quantity / required_quantity) * 100))
      : 0;
  const unallocated_pct = Math.max(0, 100 - delivered_pct - committed_pct);

  let suggested_action = '';
  let action_type: 'allocate' | 'source' | 'followup' | 'gap' | 'fulfilled' = 'allocate';

  const stock = item ? Number(item.stock) : 0;
  const unit = item ? item.unit : 'units';

  if (delivered_pct >= 100) {
    suggested_action = 'Fulfilment complete';
    action_type = 'fulfilled';
  } else if (unallocated === 0 && reserved_quantity > 0) {
    suggested_action = `Follow up ${reserved_quantity} ${unit} in transit/pending`;
    action_type = 'followup';
  } else if (stock >= unallocated && unallocated > 0) {
    suggested_action = `Dispatch ${unallocated} ${unit} from warehouse`;
    action_type = 'allocate';
  } else if (stock > 0 && unallocated > 0) {
    suggested_action = `Reserve ${stock} ${unit} in warehouse`;
    action_type = 'gap';
  } else {
    suggested_action = `Source ${unallocated} ${unit} with suppliers`;
    action_type = 'source';
  }

  return {
    ...need,
    camp,
    item,
    reserved_quantity,
    unallocated,
    delivered_pct,
    committed_pct,
    unallocated_pct,
    suggested_action,
    action_type,
  };
}

// ---------------------------------------------------------------------------
// AI TOOLS (inlined, using module-level db instead of fs reads)
// ---------------------------------------------------------------------------
function calculateNeedDetails(need: any, database: any) {
  return calculateNeedMetrics(need, database);
}

function makeAiTools(database: any) {
  return {
    getDashboardSummary(district?: string) {
      let camps = database.camps;
      if (district && district !== 'all') {
        camps = camps.filter((c: any) => c.district.toLowerCase() === district.toLowerCase());
      }
      const campIds = new Set(camps.map((c: any) => c.id));
      const activeCamps = camps.filter((c: any) => c.status === 'Active' || c.status === 'Full');
      const familiesSheltered = activeCamps.reduce((sum: number, c: any) => sum + Number(c.current_families || 0), 0);
      const totalCapacity = activeCamps.reduce((sum: number, c: any) => sum + Number(c.capacity || 0), 0);
      const relevantNeeds = database.needs
        .filter((n: any) => campIds.has(n.camp_id))
        .map((n: any) => calculateNeedDetails(n, database));
      const avgFulfilment =
        relevantNeeds.length > 0
          ? Math.round(relevantNeeds.reduce((sum: number, n: any) => sum + n.delivered_pct, 0) / relevantNeeds.length)
          : 0;
      const lowStockItems = database.inventory.filter((i: any) => Number(i.stock) <= Number(i.reorder_level));
      const dispatches = database.dispatches.filter((d: any) => campIds.has(d.camp_id));
      const volunteers = database.volunteers.filter((v: any) => v.camp_id && campIds.has(v.camp_id));
      return {
        district: district || 'All Districts',
        active_camps: activeCamps.length,
        total_camps: camps.length,
        families_sheltered: familiesSheltered,
        total_capacity: totalCapacity,
        avg_need_fulfilment: avgFulfilment,
        low_stock_items_count: lowStockItems.length,
        volunteers_deployed_count: volunteers.length,
        dispatches_count: dispatches.length,
        pending_dispatches: dispatches.filter((d: any) => d.status === 'Pending').length,
        in_transit_dispatches: dispatches.filter((d: any) => d.status === 'In Transit').length,
        delivered_dispatches: dispatches.filter((d: any) => d.status === 'Delivered').length,
      };
    },

    searchCamps(query?: string, district?: string) {
      let list = database.camps;
      if (district && district !== 'all') {
        list = list.filter((c: any) => c.district.toLowerCase() === district.toLowerCase());
      }
      if (query) {
        const q = query.toLowerCase();
        list = list.filter(
          (c: any) => c.name.toLowerCase().includes(q) || c.district.toLowerCase().includes(q)
        );
      }
      return list;
    },

    getCampNeeds(params?: { camp_id?: string; critical_only?: boolean; district?: string }) {
      let needs = database.needs.map((n: any) => calculateNeedDetails(n, database));
      if (params?.district && params.district !== 'all') {
        needs = needs.filter(
          (n: any) => n.camp && n.camp.district.toLowerCase() === params.district!.toLowerCase()
        );
      }
      if (params?.camp_id) {
        needs = needs.filter((n: any) => n.camp_id === params.camp_id);
      }
      if (params?.critical_only) {
        needs = needs.filter((n: any) => n.priority === 'High' && n.delivered_pct < 40);
        needs.sort((a: any, b: any) => a.delivered_pct - b.delivered_pct);
      }
      return needs;
    },

    getInventory(params?: { low_stock?: boolean; category?: string; search?: string }) {
      let list = database.inventory;
      if (params?.category && params.category !== 'all') {
        list = list.filter((i: any) => i.category.toLowerCase() === params.category!.toLowerCase());
      }
      if (params?.low_stock) {
        list = list.filter((i: any) => Number(i.stock) <= Number(i.reorder_level));
      }
      if (params?.search) {
        const q = params.search.toLowerCase();
        list = list.filter((i: any) => i.name.toLowerCase().includes(q));
      }
      return list;
    },

    getDispatches(params?: { status?: string; camp_id?: string; district?: string }) {
      let list = database.dispatches.map((d: any) => {
        const camp = database.camps.find((c: any) => c.id === d.camp_id);
        const need = database.needs.find((n: any) => n.id === d.need_id);
        const item = database.inventory.find(
          (i: any) => i.id === d.inventory_item_id || (need && i.id === need.inventory_item_id)
        );
        return { ...d, camp, need, item };
      });
      if (params?.district && params.district !== 'all') {
        list = list.filter(
          (d: any) => d.camp && d.camp.district.toLowerCase() === params.district!.toLowerCase()
        );
      }
      if (params?.status && params.status !== 'all') {
        list = list.filter((d: any) => d.status.toLowerCase() === params.status!.toLowerCase());
      }
      if (params?.camp_id && params.camp_id !== 'all') {
        list = list.filter((d: any) => d.camp_id === params.camp_id);
      }
      return list;
    },

    getDonationSummary() {
      const donations = database.donations.map((d: any) => ({
        ...d,
        item: d.item_id ? database.inventory.find((i: any) => i.id === d.item_id) : null,
      }));
      const cashTotal = donations
        .filter((d: any) => d.type === 'Cash')
        .reduce((sum: number, d: any) => sum + Number(d.amount_or_quantity || 0), 0);
      const inKindDonations = donations.filter((d: any) => d.type === 'In-Kind');
      const inKindByItem: Record<string, { itemName: string; unit: string; totalQty: number; count: number }> = {};
      for (const d of inKindDonations) {
        const key = d.item_id || 'unknown';
        const itemName = d.item ? d.item.name : 'Unknown Item';
        const unit = d.item ? d.item.unit : 'units';
        if (!inKindByItem[key]) {
          inKindByItem[key] = { itemName, unit, totalQty: 0, count: 0 };
        }
        inKindByItem[key].totalQty += Number(d.amount_or_quantity || 0);
        inKindByItem[key].count += 1;
      }
      return {
        cash_total_pkr: cashTotal,
        cash_donations_count: donations.filter((d: any) => d.type === 'Cash').length,
        in_kind_shipments_count: inKindDonations.length,
        in_kind_by_item: Object.values(inKindByItem),
      };
    },

    getVolunteerAvailability(skill?: string) {
      let list = database.volunteers.map((v: any) => ({
        ...v,
        camp: v.camp_id ? database.camps.find((c: any) => c.id === v.camp_id) : null,
      }));
      if (skill && skill !== 'all') {
        list = list.filter((v: any) => v.skill.toLowerCase() === skill.toLowerCase());
      }
      const unassigned = list.filter((v: any) => !v.camp_id);
      const deployed = list.filter((v: any) => !!v.camp_id);
      const unassignedBySkill: Record<string, number> = {};
      for (const v of unassigned) {
        unassignedBySkill[v.skill] = (unassignedBySkill[v.skill] || 0) + 1;
      }
      return {
        total_volunteers: list.length,
        deployed_count: deployed.length,
        unassigned_count: unassigned.length,
        unassigned_by_skill: unassignedBySkill,
        unassigned_roster: unassigned.map((v: any) => ({ id: v.id, name: v.name, skill: v.skill, phone: v.phone })),
      };
    },

    calculateAllocationPreview(camp_id: string, need_id: string, proposedQty?: number) {
      const camp = database.camps.find((c: any) => c.id === camp_id);
      if (!camp) throw new Error('Camp not found');
      const need = database.needs.find((n: any) => n.id === need_id);
      if (!need) throw new Error('Need not found');
      const item = database.inventory.find((i: any) => i.id === need.inventory_item_id);
      if (!item) throw new Error('Item not found');
      const needDetails = calculateNeedDetails(need, database);
      const availableStock = Number(item.stock);
      const unallocatedNeed = needDetails.unallocated;
      const maxDispatch = Math.min(availableStock, unallocatedNeed);
      const qty = proposedQty !== undefined ? Math.min(proposedQty, maxDispatch) : maxDispatch;
      const stockBefore = availableStock;
      const stockAfter = Math.max(0, availableStock - qty);
      const committedBefore = needDetails.reserved_quantity;
      const committedAfter = committedBefore + qty;
      const unallocatedBefore = unallocatedNeed;
      const unallocatedAfter = Math.max(0, unallocatedNeed - qty);
      const deliveredFulfilment = needDetails.fulfilled_quantity;
      const competingNeeds = database.needs
        .filter((n: any) => n.inventory_item_id === item.id && n.camp_id !== camp_id)
        .map((n: any) => calculateNeedDetails(n, database))
        .filter((n: any) => n.unallocated > 0);
      return {
        camp,
        need: needDetails,
        item,
        proposed_quantity: qty,
        max_dispatch: maxDispatch,
        stock_before: stockBefore,
        stock_after: stockAfter,
        committed_before: committedBefore,
        committed_after: committedAfter,
        unallocated_before: unallocatedBefore,
        unallocated_after: unallocatedAfter,
        delivered_fulfilment_unchanged: deliveredFulfilment,
        reorder_warning: stockAfter <= Number(item.reorder_level),
        competing_camps_count: competingNeeds.length,
        competing_camps: competingNeeds.map((cn: any) => ({
          camp_name: cn.camp?.name,
          district: cn.camp?.district,
          unallocated: cn.unallocated,
          priority: cn.priority,
        })),
      };
    },
  };
}

// ---------------------------------------------------------------------------
// AI AGENT TYPES
// ---------------------------------------------------------------------------
type AgentType = 'needs_analysis' | 'supply_planning' | 'dispatch_monitoring' | 'operations_summary' | 'general';

const REGISTERED_AGENTS = [
  {
    id: 'needs_analysis',
    name: 'Needs Analysis Agent',
    role: 'Vulnerability & Shortage Specialist',
    description: 'Identifies underserved flood-relief camps and explains critical gaps where delivered fulfilment is below 40%.',
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
    description: 'Evaluates warehouse inventory against open camp gaps and formulates double-allocation safe reservations.',
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
    description: 'Tracks committed Pending and In Transit dispatches to ensure logistics velocity without premature delivery claims.',
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
    description: 'Synthesizes multi-sector evidence briefings spanning camps, physical stock, cash aid, and volunteer rosters.',
    suggestedPrompts: [
      'Summarize the current response gaps in a selected district.',
      'Give me an operational status briefing for Sindh province.',
      'Which volunteers are currently unassigned and ready for deployment?',
    ],
  },
];

// ---------------------------------------------------------------------------
// AI AGENT RUNNERS (inlined)
// ---------------------------------------------------------------------------
function runNeedsAnalysisAgent(params: { district?: string; camp_id?: string; specificQuery?: string }, aiTools: any) {
  const needs = aiTools.getCampNeeds({ critical_only: true, district: params.district, camp_id: params.camp_id });
  const sources: any[] = [];
  const evidenceLines: string[] = [];

  for (const n of needs.slice(0, 5)) {
    sources.push({
      type: 'need',
      id: n.id,
      title: `${n.camp?.name} · ${n.item?.name}`,
      subtitle: `${n.delivered_pct}% delivered (${n.fulfilled_quantity} of ${n.required_quantity} ${n.item?.unit})`,
      badge: `${n.priority} Priority`,
      meta: { camp_id: n.camp_id, need_id: n.id, unallocated: n.unallocated, committed: n.reserved_quantity, stock: n.item?.stock, unit: n.item?.unit },
    });
    evidenceLines.push(
      `${n.camp?.name} (${n.camp?.district}): ${n.item?.name} — ${n.delivered_pct}% delivered (${n.fulfilled_quantity}/${n.required_quantity} ${n.item?.unit}), ${n.reserved_quantity} committed, ${n.unallocated} unallocated gap.`
    );
  }

  const topGap = needs[0];
  let conclusion = '';
  let text = '';
  let actionProposal: any = undefined;

  if (needs.length === 0) {
    conclusion = 'No critical high-priority needs below 40% delivered fulfilment found.';
    text = `Currently, all high-priority relief camp needs in ${params.district && params.district !== 'all' ? params.district : 'all monitored districts'} have achieved or exceeded 40% delivered fulfilment. Continue monitoring incoming dispatches to ensure in-transit supplies arrive.`;
  } else {
    conclusion = `${needs.length} high-priority need${needs.length > 1 ? 's' : ''} currently meet the under-40% delivered-fulfilment criterion.`;
    const topItemStock = topGap?.item?.stock || 0;
    text = `Identified ${needs.length} underserved camp need(s) where physically delivered supplies remain critically below 40%. The most severe gap is at **${topGap.camp?.name}** (${topGap.camp?.district}), requiring **${topGap.required_quantity} ${topGap.item?.unit}** of ${topGap.item?.name}, with only **${topGap.delivered_pct}% delivered** (${topGap.fulfilled_quantity} ${topGap.item?.unit}), **${topGap.reserved_quantity} committed**, and **${topGap.unallocated} unallocated**.\n\n${topItemStock > 0 ? `Warehouse currently holds **${topItemStock} ${topGap.item?.unit}** of ${topGap.item?.name}. You can allocate up to **${Math.min(topItemStock, topGap.unallocated)} ${topGap.item?.unit}**.` : `Warehouse stock for ${topGap.item?.name} is currently depleted (0 ${topGap.item?.unit}). External supplier or donor sourcing is required.`} Review available warehouse stock before creating a reservation.`;
    if (topGap && topItemStock > 0) {
      actionProposal = {
        actionType: 'allocate_supplies',
        label: `Preview Allocation for ${topGap.camp?.name}`,
        targetId: topGap.camp_id,
        targetNeedId: topGap.id,
        payload: { camp_id: topGap.camp_id, need_id: topGap.id, suggestedQty: Math.min(topItemStock, topGap.unallocated) },
      };
    }
  }

  return {
    id: `resp-${Date.now()}`,
    query: params.specificQuery || 'Analyze underserved camp needs',
    agentType: 'needs_analysis' as AgentType,
    provider: 'deterministic_engine' as const,
    text, conclusion,
    evidence: evidenceLines,
    calculation: 'unallocated = max(0, required - delivered - committed). Critical gap rule: priority == High AND delivered_pct < 40.',
    sources, actionProposal,
    timestamp: new Date().toISOString(),
  };
}

function runSupplyPlanningAgent(params: { district?: string; item_id?: string; camp_id?: string; specificQuery?: string }, aiTools: any) {
  const lowStockItems = aiTools.getInventory({ low_stock: true });
  const allNeeds = aiTools.getCampNeeds({ district: params.district });
  const unallocatedNeeds = allNeeds.filter((n: any) => n.unallocated > 0);
  const sources: any[] = [];
  const evidenceLines: string[] = [];
  const matchedPlanning: any[] = [];

  for (const need of unallocatedNeeds) {
    const item = need.item;
    if (!item) continue;
    if (params.item_id && item.id !== params.item_id) continue;
    if (params.camp_id && need.camp_id !== params.camp_id) continue;
    const stock = Number(item.stock);
    const maxDispatch = Math.min(stock, need.unallocated);
    const competingCount = unallocatedNeeds.filter((n: any) => n.inventory_item_id === item.id && n.camp_id !== need.camp_id).length;
    matchedPlanning.push({ item, need, availableStock: stock, maxDispatch, canFullyCover: stock >= need.unallocated, competingCount });
  }

  matchedPlanning.sort((a, b) => {
    if (a.need.priority === 'High' && b.need.priority !== 'High') return -1;
    if (b.need.priority === 'High' && a.need.priority !== 'High') return 1;
    return b.maxDispatch - a.maxDispatch;
  });

  for (const plan of matchedPlanning.slice(0, 5)) {
    sources.push({
      type: 'item', id: plan.item.id,
      title: `${plan.item.name} (${plan.item.category})`,
      subtitle: `Depot: ${plan.availableStock} ${plan.item.unit} | Target: ${plan.need.camp?.name} (Gap: ${plan.need.unallocated} ${plan.item.unit})`,
      badge: plan.canFullyCover ? 'Can Cover Full Gap' : 'Partial Stock Coverage',
      meta: { item_id: plan.item.id, camp_id: plan.need.camp_id, need_id: plan.need.id, availableStock: plan.availableStock, unallocated: plan.need.unallocated, maxDispatch: plan.maxDispatch },
    });
    evidenceLines.push(`${plan.need.camp?.name} needs ${plan.need.unallocated} ${plan.item.unit} of ${plan.item.name}. Warehouse stock available: ${plan.availableStock} ${plan.item.unit}. Max allocatable: ${plan.maxDispatch} ${plan.item.unit}.`);
  }

  const topMatch = matchedPlanning[0];
  let conclusion = '';
  let text = '';
  let actionProposal: any = undefined;

  if (!topMatch) {
    conclusion = 'No unallocated camp needs matched with available warehouse stock.';
    text = `Currently, all open needs either have zero depot stock or have already been committed in pending convoys. ${lowStockItems.length} inventory item(s) are at or below reorder thresholds and require donation influx or procurement.`;
  } else {
    conclusion = `Calculated valid supply allocations for ${matchedPlanning.length} outstanding camp gap(s).`;
    const preview = aiTools.calculateAllocationPreview(topMatch.need.camp_id, topMatch.need.id, topMatch.maxDispatch);
    text = `Analysis of warehouse depot stock against field demand indicates a primary feasible reservation for **${topMatch.need.camp?.name}** (${topMatch.need.camp?.district}):\n\n- **Target Item:** ${topMatch.item.name} (${topMatch.item.unit})\n- **Current Unallocated Gap:** ${topMatch.need.unallocated} ${topMatch.item.unit} (${topMatch.need.priority} priority)\n- **Depot Stock:** ${preview.stock_before} ${topMatch.item.unit} available\n- **Maximum Permitted Dispatch:** **${preview.proposed_quantity} ${topMatch.item.unit}**\n- **Impact on Depot Stock:** ${preview.stock_before} → **${preview.stock_after}** ${topMatch.item.unit} ${preview.reorder_warning ? '(Advisory: drops to or below reorder threshold)' : ''}\n- **Impact on Committed Need:** ${preview.committed_before} → **${preview.committed_after}** ${topMatch.item.unit}\n- **Impact on Unallocated Need:** ${preview.unallocated_before} → **${preview.unallocated_after}** ${topMatch.item.unit}\n- **Physical Fulfilment:** Remains unchanged at ${preview.delivered_fulfilment_unchanged} ${topMatch.item.unit} until arrival verification.\n\n${topMatch.competingCount > 0 ? `*Context:* ${topMatch.competingCount} other camp(s) also request ${topMatch.item.name}. Coordinators should review before confirming.` : `No other camps are competing for this specific resource.`}`;
    actionProposal = {
      actionType: 'allocate_supplies',
      label: `Open Allocation Preview (${preview.proposed_quantity} ${topMatch.item.unit})`,
      targetId: topMatch.need.camp_id,
      targetNeedId: topMatch.need.id,
      payload: { camp_id: topMatch.need.camp_id, need_id: topMatch.need.id, suggestedQty: preview.proposed_quantity },
    };
  }

  return {
    id: `resp-${Date.now()}`,
    query: params.specificQuery || 'Plan warehouse supply allocations',
    agentType: 'supply_planning' as AgentType,
    provider: 'deterministic_engine' as const,
    text, conclusion,
    evidence: evidenceLines,
    calculation: 'maximum_dispatch = min(available_stock, remaining_unallocated_need). Double-allocation prohibited.',
    sources, actionProposal,
    timestamp: new Date().toISOString(),
  };
}

function runDispatchMonitoringAgent(params: { district?: string; camp_id?: string; dispatch_id?: string; specificQuery?: string }, aiTools: any) {
  const dispatches = aiTools.getDispatches({ district: params.district, camp_id: params.camp_id });
  const pendingList = dispatches.filter((d: any) => d.status === 'Pending');
  const inTransitList = dispatches.filter((d: any) => d.status === 'In Transit');
  const deliveredList = dispatches.filter((d: any) => d.status === 'Delivered');
  const cancelledList = dispatches.filter((d: any) => d.status === 'Cancelled');
  const sources: any[] = [];
  const evidenceLines: string[] = [];
  const activeConvoys = [...pendingList, ...inTransitList];

  for (const d of activeConvoys.slice(0, 5)) {
    sources.push({
      type: 'dispatch', id: d.id,
      title: `${d.id} · ${d.camp?.name} (${d.quantity} ${d.item?.unit || 'units'})`,
      subtitle: `${d.item?.name} — Status: ${d.status} | By: ${d.dispatched_by || 'Operations Desk'}`,
      badge: d.status,
      meta: { dispatch_id: d.id, camp_id: d.camp_id, need_id: d.need_id, quantity: d.quantity, status: d.status, created_at: d.created_at },
    });
    evidenceLines.push(`Dispatch #${d.id} to ${d.camp?.name} (${d.camp?.district}): ${d.quantity} ${d.item?.unit || 'units'} of ${d.item?.name} currently in "${d.status}" status.`);
  }

  const conclusion = `Monitoring ${activeConvoys.length} active committed convoy(s): ${pendingList.length} Pending reservation, ${inTransitList.length} In Transit.`;
  let text = `Supply pipeline status for ${params.district && params.district !== 'all' ? params.district : 'all operational sectors'}:\n\n- **Committed in Convoys:** **${activeConvoys.length} active dispatches** (${pendingList.length} Pending at depot loading bay, ${inTransitList.length} In Transit on highway corridors).\n- **Physical Deliveries Confirmed:** ${deliveredList.length} dispatches have successfully arrived and verified at recipient camps.\n- **Cancelled/Restored Convoys:** ${cancelledList.length} dispatches cancelled with warehouse stock restored.\n\n### Critical Integrity Verification:\nAll ${activeConvoys.length} active dispatches represent **committed supplies only**. They are held in reserve and prevented from being re-allocated, but they will **not** count toward camp delivery fulfilment until camp representatives confirm receipt.`;

  if (pendingList.length > 0) {
    const nextPending = pendingList[0];
    text += `\n\n**Action Recommendation:** Dispatch #${nextPending.id} for **${nextPending.camp?.name}** (${nextPending.quantity} ${nextPending.item?.unit || 'units'} of ${nextPending.item?.name}) is currently **Pending**. When loading is verified, mark status as *In Transit* to update convoy tracking.`;
  }

  const topDispatch = activeConvoys[0];
  const actionProposal: any = topDispatch
    ? { actionType: 'inspect_dispatch', label: `Inspect Dispatch #${topDispatch.id}`, targetId: topDispatch.id, payload: { dispatch_id: topDispatch.id, camp_id: topDispatch.camp_id } }
    : undefined;

  return {
    id: `resp-${Date.now()}`,
    query: params.specificQuery || 'Investigate committed and undelivered dispatches',
    agentType: 'dispatch_monitoring' as AgentType,
    provider: 'deterministic_engine' as const,
    text, conclusion,
    evidence: evidenceLines,
    calculation: 'committed = sum(quantity of Pending + In Transit dispatches). Delivered count updated only upon receipt.',
    sources, actionProposal,
    timestamp: new Date().toISOString(),
  };
}

function runOperationsSummaryAgent(params: { district?: string; specificQuery?: string }, aiTools: any) {
  const summary = aiTools.getDashboardSummary(params.district);
  const lowStock = aiTools.getInventory({ low_stock: true });
  const criticalNeeds = aiTools.getCampNeeds({ critical_only: true, district: params.district });
  const donations = aiTools.getDonationSummary();
  const volunteers = aiTools.getVolunteerAvailability();

  const sources: any[] = [
    {
      type: 'camp', id: 'active_camps',
      title: `${summary.active_camps} Active Camps Sheltering ${summary.families_sheltered.toLocaleString()} Families`,
      subtitle: `${summary.total_capacity.toLocaleString()} total capacity | ${summary.avg_need_fulfilment}% average delivered fulfilment`,
      badge: `${params.district || 'All Districts'}`,
    },
    {
      type: 'item', id: 'low_stock_summary',
      title: `${lowStock.length} Low-Stock Supply Items`,
      subtitle: lowStock.map((i: any) => `${i.name} (${i.stock} ${i.unit})`).join(', ') || 'No low stock items',
      badge: 'Depot Alert',
    },
    {
      type: 'donation', id: 'donations_summary',
      title: `PKR ${donations.cash_total_pkr.toLocaleString()} Cash | ${donations.in_kind_shipments_count} In-Kind Consignments`,
      subtitle: 'Strict unit isolation maintained between funds and physical goods',
      badge: 'Aid Received',
    },
    {
      type: 'volunteer', id: 'volunteers_summary',
      title: `${volunteers.deployed_count} Deployed | ${volunteers.unassigned_count} Available`,
      subtitle: `Cadre: ${Object.entries(volunteers.unassigned_by_skill).map(([k, v]) => `${k}: ${v}`).join(', ')}`,
      badge: 'Staffing',
    },
  ];

  const evidenceLines: string[] = [
    `Camps: ${summary.active_camps} active camps sheltering ${summary.families_sheltered.toLocaleString()} families (${summary.avg_need_fulfilment}% average delivered fulfilment).`,
    `Critical Needs: ${criticalNeeds.length} high-priority needs currently have delivered fulfilment below 40%.`,
    `Inventory Health: ${lowStock.length} items at or below reorder threshold.`,
    `Dispatches: ${summary.pending_dispatches} Pending, ${summary.in_transit_dispatches} In Transit, ${summary.delivered_dispatches} Delivered.`,
    `Donations: PKR ${donations.cash_total_pkr.toLocaleString()} cash received; ${donations.in_kind_shipments_count} physical in-kind consignments.`,
    `Workforce: ${volunteers.deployed_count} volunteers deployed, ${volunteers.unassigned_count} available in reserve pool.`,
  ];

  const conclusion = `Comprehensive Sindh Flood Relief summary for ${params.district && params.district !== 'all' ? `${params.district} District` : 'all monitored sectors'}.`;
  const text = `### Operational Status Briefing: ${params.district && params.district !== 'all' ? `${params.district} District` : 'Sindh Province Wide'}\n\n1. **Shelter & Camp Density:**\n   - **${summary.active_camps} active relief camps** currently housing **${summary.families_sheltered.toLocaleString()} displaced families** out of a maximum capacity of ${summary.total_capacity.toLocaleString()}.\n   - Average verified need fulfilment across all resource types stands at **${summary.avg_need_fulfilment}%**.\n\n2. **Supply Chain & Depots:**\n   - **Critical Vulnerability Gaps:** ${criticalNeeds.length} high-priority need(s) remain under 40% physical fulfilment.\n   - **Warehouse Thresholds:** ${lowStock.length} items require replenishment: ${lowStock.map((i: any) => `*${i.name}* (${i.stock} ${i.unit})`).join(', ') || 'all items adequate'}.\n\n3. **Active Convoys:**\n   - ${summary.pending_dispatches} dispatches are staged in **Pending** reservation; ${summary.in_transit_dispatches} are **In Transit** across provincial transport corridors.\n\n4. **Aid Contributions (Strict Separation of Units):**\n   - **Cash Assistance:** **PKR ${donations.cash_total_pkr.toLocaleString()}** (designated for bowser fuel, transport, and local emergency purchasing).\n   - **Physical Aid Shipments:** **${donations.in_kind_shipments_count} verified consignments** directly credited to warehouse stock.\n\n5. **Volunteer Deployment:**\n   - **${volunteers.deployed_count}** personnel actively stationed in camps; **${volunteers.unassigned_count}** available in pool (${Object.entries(volunteers.unassigned_by_skill).map(([s, c]) => `${s}: ${c}`).join(', ')}).\n\n### Recommended Coordinator Actions:\n- Review top critical gaps in the **Priority Action Queue**.\n- Check warehouse low-stock alerts before confirming additional large dispatches.\n- Deploy available medical/logistics volunteers to high-density active camps.`;

  return {
    id: `resp-${Date.now()}`,
    query: params.specificQuery || 'Generate comprehensive operational summary',
    agentType: 'operations_summary' as AgentType,
    provider: 'deterministic_engine' as const,
    text, conclusion,
    evidence: evidenceLines,
    calculation: 'Aggregates authoritative database state with strict separation of monetary and physical units.',
    sources,
    timestamp: new Date().toISOString(),
  };
}

async function processAIQuery(params: { query: string; district?: string; agentType?: AgentType; context?: { page?: string; recordId?: string; needId?: string } }, aiTools: any) {
  const queryLower = params.query.toLowerCase();
  let selectedAgent: AgentType = params.agentType || 'general';

  if (selectedAgent === 'general') {
    if (queryLower.includes('underserved') || queryLower.includes('vulnerab') || queryLower.includes('gap') || queryLower.includes('need') || queryLower.includes('shortage') || queryLower.includes('40%') || queryLower.includes('water')) {
      selectedAgent = 'needs_analysis';
    } else if (queryLower.includes('stock') || queryLower.includes('allocat') || queryLower.includes('warehouse') || queryLower.includes('depot') || queryLower.includes('reorder') || queryLower.includes('replenish') || queryLower.includes('inventory')) {
      selectedAgent = 'supply_planning';
    } else if (queryLower.includes('dispatch') || queryLower.includes('transit') || queryLower.includes('pending') || queryLower.includes('convoy') || queryLower.includes('delivery') || queryLower.includes('committed')) {
      selectedAgent = 'dispatch_monitoring';
    } else if (queryLower.includes('summar') || queryLower.includes('report') || queryLower.includes('overview') || queryLower.includes('donation') || queryLower.includes('volunteer') || queryLower.includes('status') || queryLower.includes('brief')) {
      selectedAgent = 'operations_summary';
    } else {
      selectedAgent = 'operations_summary';
    }
  }

  switch (selectedAgent) {
    case 'needs_analysis':
      return runNeedsAnalysisAgent({ district: params.district, camp_id: params.context?.recordId, specificQuery: params.query }, aiTools);
    case 'supply_planning':
      return runSupplyPlanningAgent({ district: params.district, camp_id: params.context?.recordId, item_id: params.context?.needId, specificQuery: params.query }, aiTools);
    case 'dispatch_monitoring':
      return runDispatchMonitoringAgent({ district: params.district, camp_id: params.context?.recordId, dispatch_id: params.context?.needId, specificQuery: params.query }, aiTools);
    case 'operations_summary':
    default:
      return runOperationsSummaryAgent({ district: params.district, specificQuery: params.query }, aiTools);
  }
}

// ---------------------------------------------------------------------------
// URL PARSER UTILITIES
// ---------------------------------------------------------------------------
function parsePath(url: string): { pathname: string; query: Record<string, string> } {
  const [rawPath, rawQuery = ''] = url.split('?');
  const query: Record<string, string> = {};
  if (rawQuery) {
    rawQuery.split('&').forEach((pair) => {
      const [k, v] = pair.split('=');
      if (k) query[decodeURIComponent(k)] = decodeURIComponent(v || '');
    });
  }
  return { pathname: rawPath, query };
}

function matchRoute(pathname: string, pattern: string): Record<string, string> | null {
  const patternParts = pattern.split('/');
  const pathParts = pathname.split('/');
  if (patternParts.length !== pathParts.length) return null;
  const params: Record<string, string> = {};
  for (let i = 0; i < patternParts.length; i++) {
    if (patternParts[i].startsWith(':')) {
      params[patternParts[i].slice(1)] = pathParts[i];
    } else if (patternParts[i] !== pathParts[i]) {
      return null;
    }
  }
  return params;
}

// ---------------------------------------------------------------------------
// MAIN HANDLER
// ---------------------------------------------------------------------------
export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-user-role');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  const rawUrl = req.url || '/';
  const { pathname, query } = parsePath(rawUrl);
  const method = req.method || 'GET';
  const actor = (req.headers['x-user-role'] as string) || 'Relief Coordinator (Admin)';
  const body = req.body || {};

  // Snapshot the aiTools bound to current db at request time
  const aiTools = makeAiTools(db);

  // -------------------------------------------------------------------------
  // GET /api/health
  // -------------------------------------------------------------------------
  if (method === 'GET' && pathname === '/api/health') {
    return res.json({ status: 'healthy', mode: 'vercel_serverless', persistent: false, timestamp: new Date().toISOString() });
  }

  // -------------------------------------------------------------------------
  // POST /api/reset
  // -------------------------------------------------------------------------
  if (method === 'POST' && pathname === '/api/reset') {
    db = loadSeed();
    return res.json({ message: 'Database reset to verified seed dataset successfully', stats: db });
  }

  // -------------------------------------------------------------------------
  // GET /api/stats
  // -------------------------------------------------------------------------
  if (method === 'GET' && pathname === '/api/stats') {
    const districtFilter = query.district;
    let camps = db.camps;
    if (districtFilter && districtFilter !== 'all') {
      camps = camps.filter((c: any) => c.district.toLowerCase() === districtFilter.toLowerCase());
    }
    const campIds = new Set(camps.map((c: any) => c.id));
    const activeCamps = camps.filter((c: any) => c.status === 'Active' || c.status === 'Full');
    const familiesSheltered = activeCamps.reduce((sum: number, c: any) => sum + Number(c.current_families || 0), 0);
    const totalCapacity = activeCamps.reduce((sum: number, c: any) => sum + Number(c.capacity || 0), 0);
    const relevantNeeds = db.needs.filter((n: any) => campIds.has(n.camp_id)).map((n: any) => calculateNeedMetrics(n, db));
    const avgFulfilment = relevantNeeds.length > 0 ? Math.round(relevantNeeds.reduce((sum: number, n: any) => sum + n.delivered_pct, 0) / relevantNeeds.length) : 0;
    const lowStockItems = db.inventory.filter((i: any) => Number(i.stock) <= Number(i.reorder_level));
    const lowStockCategories = new Set(lowStockItems.map((i: any) => i.category)).size;
    const volunteers = db.volunteers;
    const deployedVolunteers = volunteers.filter((v: any) => v.camp_id && campIds.has(v.camp_id));
    const dispatches = db.dispatches.filter((d: any) => campIds.has(d.camp_id));
    const dispatchSummary = {
      total: dispatches.length,
      delivered: dispatches.filter((d: any) => d.status === 'Delivered').length,
      in_transit: dispatches.filter((d: any) => d.status === 'In Transit').length,
      pending: dispatches.filter((d: any) => d.status === 'Pending').length,
      cancelled: dispatches.filter((d: any) => d.status === 'Cancelled').length,
    };
    const categories = ['Food & Nutrition', 'Water & Sanitation', 'Shelter & NFIs', 'Medical Supplies', 'Hygiene Kits', 'Other'];
    const categoryFulfilment = categories.map((cat) => {
      const catNeeds = relevantNeeds.filter((n: any) => n.item && n.item.category === cat);
      if (catNeeds.length === 0) return { category: cat, delivered_pct: 0, committed_pct: 0, unallocated_pct: 0, needs_count: 0 };
      const avgDelivered = Math.round(catNeeds.reduce((acc: number, n: any) => acc + n.delivered_pct, 0) / catNeeds.length);
      const avgCommitted = Math.round(catNeeds.reduce((acc: number, n: any) => acc + n.committed_pct, 0) / catNeeds.length);
      const avgUnallocated = Math.max(0, 100 - avgDelivered - avgCommitted);
      return { category: cat, delivered_pct: avgDelivered, committed_pct: avgCommitted, unallocated_pct: avgUnallocated, needs_count: catNeeds.length };
    });
    const uniqueDistricts = new Set(db.camps.map((c: any) => c.district)).size;
    return res.json({ active_camps: activeCamps.length, total_camps: camps.length, families_sheltered: familiesSheltered, total_capacity: totalCapacity, avg_need_fulfilment: avgFulfilment, low_stock_items: lowStockItems.length, low_stock_categories: lowStockCategories, volunteers_deployed: deployedVolunteers.length, total_volunteers: volunteers.length, districts_active: uniqueDistricts, dispatch_summary: dispatchSummary, category_fulfilment: categoryFulfilment });
  }

  // -------------------------------------------------------------------------
  // CAMPS
  // -------------------------------------------------------------------------
  if (method === 'GET' && pathname === '/api/camps') {
    let list = db.camps;
    const { search, district, status } = query;
    if (district && district !== 'all') list = list.filter((c: any) => c.district.toLowerCase() === district.toLowerCase());
    if (status && status !== 'all') list = list.filter((c: any) => c.status.toLowerCase() === status.toLowerCase());
    if (search) { const q = search.toLowerCase(); list = list.filter((c: any) => c.name.toLowerCase().includes(q) || c.district.toLowerCase().includes(q)); }
    return res.json(list);
  }

  if (method === 'POST' && pathname === '/api/camps') {
    const { name, district, capacity, current_families, status, notes } = body;
    if (!name || !district) return res.status(400).json({ error: 'Camp name and district are required.' });
    const cap = Number(capacity);
    const fam = Number(current_families || 0);
    if (isNaN(cap) || cap <= 0) return res.status(400).json({ error: 'Camp capacity must be a positive integer.' });
    if (isNaN(fam) || fam < 0) return res.status(400).json({ error: 'Current families cannot be negative.' });
    if (fam > cap) return res.status(400).json({ error: 'Current families cannot exceed total camp capacity.' });
    let finalStatus = status || 'Active';
    if (fam === cap && finalStatus === 'Active') finalStatus = 'Full';
    const newCamp = { id: `camp-${Date.now()}`, name: name.trim(), district: district.trim(), capacity: cap, current_families: fam, status: finalStatus, notes: notes || '' };
    db.camps.push(newCamp);
    db.audit_logs.unshift({ id: `audit-${Date.now()}`, timestamp: new Date().toISOString(), action: 'CAMP_CREATED', entity_type: 'camp', entity_id: newCamp.id, description: `Created new camp "${newCamp.name}" in ${newCamp.district} (Capacity: ${newCamp.capacity}, Families: ${newCamp.current_families}).`, actor });
    return res.status(201).json(newCamp);
  }

  const campByIdParams = matchRoute(pathname, '/api/camps/:id');
  if (campByIdParams) {
    const id = campByIdParams.id;
    if (method === 'GET') {
      const camp = db.camps.find((c: any) => c.id === id);
      if (!camp) return res.status(404).json({ error: 'Camp not found' });
      const needs = db.needs.filter((n: any) => n.camp_id === camp.id).map((n: any) => calculateNeedMetrics(n, db));
      const dispatches = db.dispatches.filter((d: any) => d.camp_id === camp.id).map((d: any) => ({ ...d, item: db.inventory.find((i: any) => i.id === d.inventory_item_id) }));
      const volunteers = db.volunteers.filter((v: any) => v.camp_id === camp.id);
      return res.json({ ...camp, needs, dispatches, volunteers });
    }
    if (method === 'PUT') {
      const index = db.camps.findIndex((c: any) => c.id === id);
      if (index === -1) return res.status(404).json({ error: 'Camp not found' });
      const { name, district, capacity, current_families, status, notes } = body;
      const cap = Number(capacity);
      const fam = Number(current_families);
      if (isNaN(cap) || cap <= 0) return res.status(400).json({ error: 'Camp capacity must be positive.' });
      if (isNaN(fam) || fam < 0) return res.status(400).json({ error: 'Current families cannot be negative.' });
      if (fam > cap) return res.status(400).json({ error: 'Current families cannot exceed total camp capacity.' });
      let finalStatus = status;
      if (fam === cap && finalStatus === 'Active') finalStatus = 'Full';
      db.camps[index] = { ...db.camps[index], name: name?.trim() || db.camps[index].name, district: district?.trim() || db.camps[index].district, capacity: cap, current_families: fam, status: finalStatus || db.camps[index].status, notes: notes !== undefined ? notes : db.camps[index].notes };
      db.audit_logs.unshift({ id: `audit-${Date.now()}`, timestamp: new Date().toISOString(), action: 'CAMP_UPDATED', entity_type: 'camp', entity_id: id, description: `Updated camp "${db.camps[index].name}". Families: ${fam}/${cap}, Status: ${db.camps[index].status}.`, actor });
      return res.json(db.camps[index]);
    }
    if (method === 'DELETE') {
      const camp = db.camps.find((c: any) => c.id === id);
      if (!camp) return res.status(404).json({ error: 'Camp not found' });
      const activeDispatches = db.dispatches.filter((d: any) => d.camp_id === id && (d.status === 'Pending' || d.status === 'In Transit'));
      if (activeDispatches.length > 0) return res.status(400).json({ error: `Cannot delete camp with ${activeDispatches.length} active dispatches. Resolve or cancel them first.` });
      db.needs = db.needs.filter((n: any) => n.camp_id !== id);
      db.volunteers = db.volunteers.map((v: any) => (v.camp_id === id ? { ...v, camp_id: null } : v));
      db.camps = db.camps.filter((c: any) => c.id !== id);
      db.audit_logs.unshift({ id: `audit-${Date.now()}`, timestamp: new Date().toISOString(), action: 'CAMP_DELETED', entity_type: 'camp', entity_id: id, description: `Deleted camp "${camp.name}" (${camp.district}). Volunteers unassigned.`, actor });
      return res.json({ message: 'Camp deleted successfully', id });
    }
  }

  // -------------------------------------------------------------------------
  // INVENTORY
  // -------------------------------------------------------------------------
  if (method === 'GET' && pathname === '/api/inventory') {
    let list = db.inventory;
    const { category, low_stock, search } = query;
    if (category && category !== 'all') list = list.filter((i: any) => i.category.toLowerCase() === category.toLowerCase());
    if (low_stock === 'true') list = list.filter((i: any) => Number(i.stock) <= Number(i.reorder_level));
    if (search) { const q = search.toLowerCase(); list = list.filter((i: any) => i.name.toLowerCase().includes(q) || i.category.toLowerCase().includes(q)); }
    return res.json(list);
  }

  if (method === 'POST' && pathname === '/api/inventory') {
    const { name, category, unit, stock, reorder_level } = body;
    if (!name || !category || !unit) return res.status(400).json({ error: 'Name, category, and unit are required.' });
    const s = Number(stock || 0);
    const r = Number(reorder_level || 0);
    if (s < 0 || r < 0) return res.status(400).json({ error: 'Stock and reorder level cannot be negative.' });
    const newItem = { id: `item-${Date.now()}`, name: name.trim(), category, unit: unit.trim(), stock: s, reorder_level: r };
    db.inventory.push(newItem);
    db.audit_logs.unshift({ id: `audit-${Date.now()}`, timestamp: new Date().toISOString(), action: 'INVENTORY_CREATED', entity_type: 'inventory', entity_id: newItem.id, description: `Added inventory item "${newItem.name}" (${newItem.category}) with initial stock ${s} ${newItem.unit}.`, actor });
    return res.status(201).json(newItem);
  }

  const inventoryByIdParams = matchRoute(pathname, '/api/inventory/:id');
  if (inventoryByIdParams) {
    const id = inventoryByIdParams.id;
    if (method === 'PUT') {
      const index = db.inventory.findIndex((i: any) => i.id === id);
      if (index === -1) return res.status(404).json({ error: 'Inventory item not found' });
      const { name, category, unit, stock, reorder_level } = body;
      const s = Number(stock);
      const r = Number(reorder_level);
      if (isNaN(s) || s < 0) return res.status(400).json({ error: 'Stock must be non-negative.' });
      if (isNaN(r) || r < 0) return res.status(400).json({ error: 'Reorder level must be non-negative.' });
      const oldStock = db.inventory[index].stock;
      db.inventory[index] = { ...db.inventory[index], name: name?.trim() || db.inventory[index].name, category: category || db.inventory[index].category, unit: unit?.trim() || db.inventory[index].unit, stock: s, reorder_level: r };
      db.audit_logs.unshift({ id: `audit-${Date.now()}`, timestamp: new Date().toISOString(), action: 'INVENTORY_UPDATED', entity_type: 'inventory', entity_id: id, description: `Adjusted inventory "${db.inventory[index].name}". Stock: ${oldStock} -> ${s} ${db.inventory[index].unit}.`, actor });
      return res.json(db.inventory[index]);
    }
    if (method === 'DELETE') {
      const item = db.inventory.find((i: any) => i.id === id);
      if (!item) return res.status(404).json({ error: 'Inventory item not found' });
      const activeNeeds = db.needs.filter((n: any) => n.inventory_item_id === id);
      if (activeNeeds.length > 0) return res.status(400).json({ error: `Cannot delete item referenced by ${activeNeeds.length} camp needs. Remove the needs first.` });
      db.inventory = db.inventory.filter((i: any) => i.id !== id);
      return res.json({ message: 'Inventory item deleted successfully' });
    }
  }

  // -------------------------------------------------------------------------
  // NEEDS
  // -------------------------------------------------------------------------
  if (method === 'GET' && pathname === '/api/needs') {
    const { camp_id, priority, critical_only, district } = query;
    let needs = db.needs.map((n: any) => calculateNeedMetrics(n, db));
    if (district && district !== 'all') needs = needs.filter((n: any) => n.camp && n.camp.district.toLowerCase() === district.toLowerCase());
    if (camp_id) needs = needs.filter((n: any) => n.camp_id === camp_id);
    if (priority && priority !== 'all') needs = needs.filter((n: any) => n.priority.toLowerCase() === priority.toLowerCase());
    if (critical_only === 'true') { needs = needs.filter((n: any) => n.priority === 'High' && n.delivered_pct < 40); needs.sort((a: any, b: any) => a.delivered_pct - b.delivered_pct); }
    return res.json(needs);
  }

  if (method === 'POST' && pathname === '/api/needs') {
    const { camp_id, inventory_item_id, required_quantity, priority, fulfilled_quantity } = body;
    const camp = db.camps.find((c: any) => c.id === camp_id);
    if (!camp) return res.status(400).json({ error: 'Valid camp is required.' });
    const item = db.inventory.find((i: any) => i.id === inventory_item_id);
    if (!item) return res.status(400).json({ error: 'Valid inventory item is required.' });
    const reqQty = Number(required_quantity);
    const fulQty = Number(fulfilled_quantity || 0);
    if (isNaN(reqQty) || reqQty <= 0) return res.status(400).json({ error: 'Required quantity must be positive.' });
    if (isNaN(fulQty) || fulQty < 0) return res.status(400).json({ error: 'Fulfilled quantity cannot be negative.' });
    const newNeed = { id: `need-${Date.now()}`, camp_id, inventory_item_id, required_quantity: reqQty, priority: priority || 'Medium', fulfilled_quantity: fulQty };
    db.needs.push(newNeed);
    const calculated = calculateNeedMetrics(newNeed, db);
    return res.status(201).json(calculated);
  }

  // -------------------------------------------------------------------------
  // DISPATCHES
  // -------------------------------------------------------------------------
  if (method === 'GET' && pathname === '/api/dispatches') {
    let list = db.dispatches.map((d: any) => {
      const camp = db.camps.find((c: any) => c.id === d.camp_id);
      const need = db.needs.find((n: any) => n.id === d.need_id);
      const item = db.inventory.find((i: any) => i.id === d.inventory_item_id || (need && i.id === need.inventory_item_id));
      return { ...d, camp, need, item };
    });
    const { status, camp_id, search, district } = query;
    if (district && district !== 'all') list = list.filter((d: any) => d.camp && d.camp.district.toLowerCase() === district.toLowerCase());
    if (status && status !== 'all') list = list.filter((d: any) => d.status.toLowerCase() === status.toLowerCase());
    if (camp_id && camp_id !== 'all') list = list.filter((d: any) => d.camp_id === camp_id);
    if (search) { const q = search.toLowerCase(); list = list.filter((d: any) => (d.camp && d.camp.name.toLowerCase().includes(q)) || (d.item && d.item.name.toLowerCase().includes(q)) || (d.notes && d.notes.toLowerCase().includes(q)) || d.id.toLowerCase().includes(q)); }
    list.sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    return res.json(list);
  }

  if (method === 'POST' && pathname === '/api/dispatches') {
    const { camp_id, need_id, quantity, notes, dispatched_by } = body;
    const camp = db.camps.find((c: any) => c.id === camp_id);
    if (!camp) return res.status(400).json({ error: 'Camp not found.' });
    const need = db.needs.find((n: any) => n.id === need_id);
    if (!need) return res.status(400).json({ error: 'Camp need not found.' });
    const itemIndex = db.inventory.findIndex((i: any) => i.id === need.inventory_item_id);
    if (itemIndex === -1) return res.status(400).json({ error: 'Inventory item associated with need not found.' });
    const item = db.inventory[itemIndex];
    const qty = Number(quantity);
    if (isNaN(qty) || qty <= 0) return res.status(400).json({ error: 'Proposed dispatch quantity must be greater than 0.' });
    const needMetrics = calculateNeedMetrics(need, db);
    const remainingUnallocated = needMetrics.unallocated;
    const availableStock = Number(item.stock);
    if (qty > availableStock) return res.status(400).json({ error: `Proposed quantity (${qty}) exceeds available warehouse stock (${availableStock} ${item.unit}).` });
    if (qty > remainingUnallocated) return res.status(400).json({ error: `Proposed quantity (${qty}) exceeds remaining unallocated need (${remainingUnallocated} ${item.unit}).` });
    db.inventory[itemIndex].stock = availableStock - qty;
    const newDispatch = { id: `disp-${Date.now()}`, camp_id, need_id, inventory_item_id: item.id, quantity: qty, status: 'Pending', created_at: new Date().toISOString(), dispatched_by: dispatched_by || 'Operations Desk', notes: notes || '' };
    db.dispatches.unshift(newDispatch);
    db.audit_logs.unshift({ id: `audit-${Date.now()}`, timestamp: new Date().toISOString(), action: 'DISPATCH_CREATED', entity_type: 'dispatch', entity_id: newDispatch.id, description: `Reserved ${qty} ${item.unit} of "${item.name}" for ${camp.name}. Warehouse stock: ${availableStock} -> ${db.inventory[itemIndex].stock}.`, actor });
    return res.status(201).json({ dispatch: newDispatch, updated_stock: db.inventory[itemIndex].stock, message: 'Stock reserved and dispatch created successfully' });
  }

  const dispatchStatusParams = matchRoute(pathname, '/api/dispatches/:id/status');
  if (dispatchStatusParams && method === 'PATCH') {
    const { status, notes } = body;
    const validStatuses = ['Pending', 'In Transit', 'Delivered', 'Cancelled'];
    if (!validStatuses.includes(status)) return res.status(400).json({ error: 'Invalid dispatch status.' });
    const dispatchIndex = db.dispatches.findIndex((d: any) => d.id === dispatchStatusParams.id);
    if (dispatchIndex === -1) return res.status(404).json({ error: 'Dispatch not found.' });
    const currentDispatch = db.dispatches[dispatchIndex];
    const oldStatus = currentDispatch.status;
    if (oldStatus === status) return res.status(400).json({ error: `Dispatch is already marked as ${status}.` });
    if (oldStatus === 'Delivered') return res.status(400).json({ error: 'Cannot change status of an already Delivered dispatch.' });
    if (oldStatus === 'Cancelled') return res.status(400).json({ error: 'Cannot change status of a Cancelled dispatch.' });
    const itemIndex = db.inventory.findIndex((i: any) => i.id === currentDispatch.inventory_item_id);
    const needIndex = db.needs.findIndex((n: any) => n.id === currentDispatch.need_id);
    if (status === 'In Transit') {
      currentDispatch.status = 'In Transit';
      currentDispatch.updated_at = new Date().toISOString();
      if (notes) currentDispatch.notes = notes;
      db.audit_logs.unshift({ id: `audit-${Date.now()}`, timestamp: new Date().toISOString(), action: 'DISPATCH_IN_TRANSIT', entity_type: 'dispatch', entity_id: currentDispatch.id, description: `Marked dispatch ${currentDispatch.id} (${currentDispatch.quantity} units) as In Transit.`, actor });
    } else if (status === 'Delivered') {
      currentDispatch.status = 'Delivered';
      currentDispatch.updated_at = new Date().toISOString();
      if (notes) currentDispatch.notes = notes;
      if (needIndex !== -1) db.needs[needIndex].fulfilled_quantity = Number(db.needs[needIndex].fulfilled_quantity || 0) + Number(currentDispatch.quantity);
      db.audit_logs.unshift({ id: `audit-${Date.now()}`, timestamp: new Date().toISOString(), action: 'DISPATCH_DELIVERED', entity_type: 'dispatch', entity_id: currentDispatch.id, description: `Confirmed delivery of dispatch ${currentDispatch.id} (${currentDispatch.quantity} units). Need fulfilled quantity updated.`, actor: 'Field Volunteer' });
    } else if (status === 'Cancelled') {
      currentDispatch.status = 'Cancelled';
      currentDispatch.updated_at = new Date().toISOString();
      if (notes) currentDispatch.notes = notes;
      if (itemIndex !== -1) {
        const prevStock = Number(db.inventory[itemIndex].stock);
        db.inventory[itemIndex].stock = prevStock + Number(currentDispatch.quantity);
        db.audit_logs.unshift({ id: `audit-${Date.now()}`, timestamp: new Date().toISOString(), action: 'DISPATCH_CANCELLED', entity_type: 'dispatch', entity_id: currentDispatch.id, description: `Cancelled undelivered dispatch ${currentDispatch.id}. Restored ${currentDispatch.quantity} units to warehouse stock (${prevStock} -> ${db.inventory[itemIndex].stock}).`, actor });
      }
    }
    return res.json({ dispatch: currentDispatch, message: `Dispatch updated to ${status} successfully.` });
  }

  // -------------------------------------------------------------------------
  // DONATIONS
  // -------------------------------------------------------------------------
  if (method === 'GET' && pathname === '/api/donations') {
    let list = db.donations.map((d: any) => ({ ...d, item: d.item_id ? db.inventory.find((i: any) => i.id === d.item_id) : null }));
    const { type, search } = query;
    if (type && type !== 'all') list = list.filter((d: any) => d.type.toLowerCase() === type.toLowerCase());
    if (search) { const q = search.toLowerCase(); list = list.filter((d: any) => (d.donor_name && d.donor_name.toLowerCase().includes(q)) || d.category.toLowerCase().includes(q) || (d.notes && d.notes.toLowerCase().includes(q))); }
    list.sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime());
    return res.json(list);
  }

  if (method === 'POST' && pathname === '/api/donations') {
    const { type, amount_or_quantity, item_id, category, donor_name, notes } = body;
    if (!type || !category) return res.status(400).json({ error: 'Donation type and category are required.' });
    const val = Number(amount_or_quantity);
    if (isNaN(val) || val <= 0) return res.status(400).json({ error: 'Donation amount or quantity must be positive.' });
    let item: any = null;
    if (type === 'In-Kind') {
      if (!item_id) return res.status(400).json({ error: 'In-Kind donations require selecting an inventory item.' });
      const itemIndex = db.inventory.findIndex((i: any) => i.id === item_id);
      if (itemIndex === -1) return res.status(400).json({ error: 'Specified inventory item not found.' });
      item = db.inventory[itemIndex];
      const oldStock = Number(item.stock);
      db.inventory[itemIndex].stock = oldStock + val;
      db.audit_logs.unshift({ id: `audit-${Date.now()}`, timestamp: new Date().toISOString(), action: 'DONATION_IN_KIND_RECEIVED', entity_type: 'inventory', entity_id: item.id, description: `In-Kind donation of ${val} ${item.unit} of "${item.name}" from ${donor_name || 'Anonymous'}. Warehouse stock: ${oldStock} -> ${db.inventory[itemIndex].stock}.`, actor });
    } else {
      db.audit_logs.unshift({ id: `audit-${Date.now()}`, timestamp: new Date().toISOString(), action: 'DONATION_CASH_RECEIVED', entity_type: 'donation', entity_id: `don-${Date.now()}`, description: `Cash donation of PKR ${val.toLocaleString()} received for "${category}" from ${donor_name || 'Anonymous'}.`, actor });
    }
    const newDonation = { id: `don-${Date.now()}`, type, amount_or_quantity: val, item_id: type === 'In-Kind' ? item_id : null, category: category.trim(), donor_name: donor_name?.trim() || 'Anonymous Supporter', date: new Date().toISOString(), notes: notes || '' };
    db.donations.unshift(newDonation);
    return res.status(201).json({ donation: { ...newDonation, item }, message: 'Donation recorded successfully' });
  }

  // -------------------------------------------------------------------------
  // VOLUNTEERS
  // -------------------------------------------------------------------------
  if (method === 'GET' && pathname === '/api/volunteers') {
    let list = db.volunteers.map((v: any) => ({ ...v, camp: v.camp_id ? db.camps.find((c: any) => c.id === v.camp_id) : null }));
    const { skill, camp_id, status, search } = query;
    if (skill && skill !== 'all') list = list.filter((v: any) => v.skill.toLowerCase() === skill.toLowerCase());
    if (camp_id && camp_id !== 'all') list = list.filter((v: any) => v.camp_id === camp_id);
    if (status === 'assigned') list = list.filter((v: any) => v.camp_id !== null);
    else if (status === 'unassigned') list = list.filter((v: any) => v.camp_id === null);
    if (search) { const q = search.toLowerCase(); list = list.filter((v: any) => v.name.toLowerCase().includes(q) || v.skill.toLowerCase().includes(q) || (v.camp && v.camp.name.toLowerCase().includes(q))); }
    return res.json(list);
  }

  if (method === 'POST' && pathname === '/api/volunteers') {
    const { name, skill, camp_id, phone } = body;
    if (!name || !skill) return res.status(400).json({ error: 'Volunteer name and skill are required.' });
    if (camp_id) {
      const targetCamp = db.camps.find((c: any) => c.id === camp_id);
      if (!targetCamp) return res.status(400).json({ error: 'Selected camp does not exist.' });
      if (targetCamp.status === 'Closed') return res.status(400).json({ error: 'Closed camps cannot receive volunteer deployments.' });
    }
    const newVolunteer = { id: `vol-${Date.now()}`, name: name.trim(), skill, camp_id: camp_id || null, phone: phone || '', joined_date: new Date().toISOString().split('T')[0] };
    db.volunteers.push(newVolunteer);
    db.audit_logs.unshift({ id: `audit-${Date.now()}`, timestamp: new Date().toISOString(), action: 'VOLUNTEER_REGISTERED', entity_type: 'volunteer', entity_id: newVolunteer.id, description: `Registered volunteer "${newVolunteer.name}" (${newVolunteer.skill}).`, actor });
    return res.status(201).json(newVolunteer);
  }

  const volunteerAssignParams = matchRoute(pathname, '/api/volunteers/:id/assign');
  if (volunteerAssignParams && method === 'PATCH') {
    const volunteer = db.volunteers.find((v: any) => v.id === volunteerAssignParams.id);
    if (!volunteer) return res.status(404).json({ error: 'Volunteer not found.' });
    const { camp_id } = body;
    if (camp_id) {
      const targetCamp = db.camps.find((c: any) => c.id === camp_id);
      if (!targetCamp) return res.status(400).json({ error: 'Target camp not found.' });
      if (targetCamp.status === 'Closed') return res.status(400).json({ error: 'Closed camps cannot receive new volunteer assignments.' });
      volunteer.camp_id = camp_id;
      db.audit_logs.unshift({ id: `audit-${Date.now()}`, timestamp: new Date().toISOString(), action: 'VOLUNTEER_ASSIGNED', entity_type: 'volunteer', entity_id: volunteer.id, description: `Assigned volunteer ${volunteer.name} to ${targetCamp.name}.`, actor });
    } else {
      const prevCamp = db.camps.find((c: any) => c.id === volunteer.camp_id);
      volunteer.camp_id = null;
      db.audit_logs.unshift({ id: `audit-${Date.now()}`, timestamp: new Date().toISOString(), action: 'VOLUNTEER_UNASSIGNED', entity_type: 'volunteer', entity_id: volunteer.id, description: `Unassigned volunteer ${volunteer.name} from ${prevCamp?.name || 'camp'}.`, actor });
    }
    return res.json({ volunteer, camp: volunteer.camp_id ? db.camps.find((c: any) => c.id === volunteer.camp_id) : null, message: volunteer.camp_id ? 'Volunteer assigned successfully.' : 'Volunteer unassigned.' });
  }

  const volunteerDeleteParams = matchRoute(pathname, '/api/volunteers/:id');
  if (volunteerDeleteParams && method === 'DELETE') {
    const id = volunteerDeleteParams.id;
    const index = db.volunteers.findIndex((v: any) => v.id === id);
    if (index === -1) return res.status(404).json({ error: 'Volunteer not found.' });
    const name = db.volunteers[index].name;
    db.volunteers.splice(index, 1);
    db.audit_logs.unshift({ id: `audit-${Date.now()}`, timestamp: new Date().toISOString(), action: 'VOLUNTEER_REMOVED', entity_type: 'volunteer', entity_id: id, description: `Removed volunteer record for ${name}.`, actor });
    return res.json({ message: 'Volunteer removed successfully.' });
  }

  // -------------------------------------------------------------------------
  // AUDIT LOGS
  // -------------------------------------------------------------------------
  if (method === 'GET' && pathname === '/api/audit-logs') {
    const limit = Number(query.limit || 50);
    return res.json(db.audit_logs.slice(0, limit));
  }

  // -------------------------------------------------------------------------
  // AI ENDPOINTS
  // -------------------------------------------------------------------------
  if (method === 'GET' && pathname === '/api/ai/agents') {
    return res.json({
      agents: REGISTERED_AGENTS,
      provider: process.env.GEMINI_API_KEY ? 'gemini_api' : process.env.OPENAI_API_KEY ? 'openai_api' : 'deterministic_engine',
      mode: process.env.GEMINI_API_KEY || process.env.OPENAI_API_KEY ? 'llm_augmented' : 'deterministic_rules_engine',
    });
  }

  if (method === 'POST' && pathname === '/api/ai/query') {
    const { query: aiQuery, district, agentType, context } = body;
    if (!aiQuery || typeof aiQuery !== 'string') return res.status(400).json({ error: 'Query string is required.' });
    try {
      const response = await processAIQuery({ query: aiQuery, district, agentType, context }, aiTools);
      return res.json(response);
    } catch (err: any) {
      console.error('AI Processing Error:', err);
      return res.status(500).json({ error: err.message || 'AI processing encountered an unexpected issue.' });
    }
  }

  const agentRunParams = matchRoute(pathname, '/api/ai/agent/:agentId/run');
  if (agentRunParams && method === 'POST') {
    const { district, context } = body;
    try {
      const response = await processAIQuery({ query: `Run specialized agent: ${agentRunParams.agentId}`, district, agentType: agentRunParams.agentId as AgentType, context }, aiTools);
      return res.json(response);
    } catch (err: any) {
      console.error('Agent Execution Error:', err);
      return res.status(500).json({ error: err.message || 'Agent execution failed.' });
    }
  }

  // -------------------------------------------------------------------------
  // 404 fallback
  // -------------------------------------------------------------------------
  return res.status(404).json({ error: `API route not found: ${method} ${pathname}` });
}
