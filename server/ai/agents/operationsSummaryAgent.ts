import { aiTools } from '../tools.js';
import { AIResponsePayload, SourceReference, ActionProposal } from '../types.js';

export async function runOperationsSummaryAgent(params: {
  district?: string;
  specificQuery?: string;
}): Promise<AIResponsePayload> {
  const summary = aiTools.getDashboardSummary(params.district);
  const lowStock = aiTools.getInventory({ low_stock: true });
  const criticalNeeds = aiTools.getCampNeeds({ critical_only: true, district: params.district });
  const donations = aiTools.getDonationSummary();
  const volunteers = aiTools.getVolunteerAvailability();

  const sources: SourceReference[] = [
    {
      type: 'camp',
      id: 'active_camps',
      title: `${summary.active_camps} Active Camps Sheltering ${summary.families_sheltered.toLocaleString()} Families`,
      subtitle: `${summary.total_capacity.toLocaleString()} total capacity | ${summary.avg_need_fulfilment}% average delivered fulfilment`,
      badge: `${params.district || 'All Districts'}`,
    },
    {
      type: 'item',
      id: 'low_stock_summary',
      title: `${lowStock.length} Low-Stock Supply Items`,
      subtitle: lowStock.map((i: any) => `${i.name} (${i.stock} ${i.unit})`).join(', ') || 'No low stock items',
      badge: 'Depot Alert',
    },
    {
      type: 'donation',
      id: 'donations_summary',
      title: `PKR ${donations.cash_total_pkr.toLocaleString()} Cash | ${donations.in_kind_shipments_count} In-Kind Consignments`,
      subtitle: 'Strict unit isolation maintained between funds and physical goods',
      badge: 'Aid Received',
    },
    {
      type: 'volunteer',
      id: 'volunteers_summary',
      title: `${volunteers.deployed_count} Deployed | ${volunteers.unassigned_count} Available`,
      subtitle: `Cadre: ${Object.entries(volunteers.unassigned_by_skill)
        .map(([k, v]) => `${k}: ${v}`)
        .join(', ')}`,
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

  const conclusion = `Comprehensive Sindh Flood Relief summary for ${
    params.district && params.district !== 'all' ? `${params.district} District` : 'all monitored sectors'
  }.`;

  const text = `### Operational Status Briefing: ${
    params.district && params.district !== 'all' ? `${params.district} District` : 'Sindh Province Wide'
  }

1. **Shelter & Camp Density:**
   - **${summary.active_camps} active relief camps** currently housing **${summary.families_sheltered.toLocaleString()} displaced families** out of a maximum capacity of ${summary.total_capacity.toLocaleString()}.
   - Average verified need fulfilment across all resource types stands at **${summary.avg_need_fulfilment}%**.

2. **Supply Chain & Depots:**
   - **Critical Vulnerability Gaps:** ${criticalNeeds.length} high-priority need(s) remain under 40% physical fulfilment.
   - **Warehouse Thresholds:** ${lowStock.length} items require replenishment: ${
    lowStock.map((i: any) => `*${i.name}* (${i.stock} ${i.unit})`).join(', ') || 'all items adequate'
  }.

3. **Active Convoys:**
   - ${summary.pending_dispatches} dispatches are staged in **Pending** reservation; ${summary.in_transit_dispatches} are **In Transit** across provincial transport corridors.

4. **Aid Contributions (Strict Separation of Units):**
   - **Cash Assistance:** **PKR ${donations.cash_total_pkr.toLocaleString()}** (designated for bowser fuel, transport, and local emergency purchasing).
   - **Physical Aid Shipments:** **${donations.in_kind_shipments_count} verified consignments** directly credited to warehouse stock.

5. **Volunteer Deployment:**
   - **${volunteers.deployed_count}** personnel actively stationed in camps; **${volunteers.unassigned_count}** available in pool (${Object.entries(volunteers.unassigned_by_skill)
    .map(([s, c]) => `${s}: ${c}`)
    .join(', ')}).

### Recommended Coordinator Actions:
- Review top critical gaps in the **Priority Action Queue**.
- Check warehouse low-stock alerts before confirming additional large dispatches.
- Deploy available medical/logistics volunteers to high-density active camps.`;

  return {
    id: `resp-${Date.now()}`,
    query: params.specificQuery || 'Generate comprehensive operational summary',
    agentType: 'operations_summary',
    provider: 'deterministic_engine',
    text,
    conclusion,
    evidence: evidenceLines,
    calculation: 'Aggregates authoritative database state with strict separation of monetary and physical units.',
    sources,
    timestamp: new Date().toISOString(),
  };
}
