import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DB_FILE = path.join(__dirname, '..', 'data', 'db.json');

function getDb() {
  if (!fs.existsSync(DB_FILE)) {
    throw new Error('Database file missing');
  }
  const raw = fs.readFileSync(DB_FILE, 'utf-8');
  return JSON.parse(raw);
}

// Helper to calculate need metrics identically to server/index.ts
export function calculateNeedDetails(need: any, db: any) {
  const camp = db.camps.find((c: any) => c.id === need.camp_id);
  const item = db.inventory.find((i: any) => i.id === need.inventory_item_id);

  const relevantDispatches = db.dispatches.filter(
    (d: any) => d.need_id === need.id && (d.status === 'Pending' || d.status === 'In Transit')
  );
  const reserved_quantity = relevantDispatches.reduce(
    (acc: number, d: any) => acc + Number(d.quantity || 0),
    0
  );

  const fulfilled_quantity = Number(need.fulfilled_quantity || 0);
  const required_quantity = Number(need.required_quantity || 0);

  const unallocated = Math.max(0, required_quantity - fulfilled_quantity - reserved_quantity);

  const delivered_pct =
    required_quantity > 0
      ? Math.min(100, Math.round((fulfilled_quantity / required_quantity) * 100))
      : 0;
  const committed_pct =
    required_quantity > 0
      ? Math.min(100 - delivered_pct, Math.round((reserved_quantity / required_quantity) * 100))
      : 0;
  const unallocated_pct = Math.max(0, 100 - delivered_pct - committed_pct);

  const stock = item ? Number(item.stock) : 0;
  const unit = item ? item.unit : 'units';

  let suggested_action = '';
  let action_type: 'allocate' | 'source' | 'followup' | 'gap' | 'fulfilled' = 'allocate';

  if (delivered_pct >= 100) {
    suggested_action = 'Fulfilment complete';
    action_type = 'fulfilled';
  } else if (unallocated === 0 && reserved_quantity > 0) {
    suggested_action = `Follow up on ${reserved_quantity} ${unit} in transit/pending`;
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

export const aiTools = {
  getDashboardSummary(district?: string) {
    const db = getDb();
    let camps = db.camps;
    if (district && district !== 'all') {
      camps = camps.filter((c: any) => c.district.toLowerCase() === district.toLowerCase());
    }

    const campIds = new Set(camps.map((c: any) => c.id));
    const activeCamps = camps.filter((c: any) => c.status === 'Active' || c.status === 'Full');
    const familiesSheltered = activeCamps.reduce((sum: number, c: any) => sum + Number(c.current_families || 0), 0);
    const totalCapacity = activeCamps.reduce((sum: number, c: any) => sum + Number(c.capacity || 0), 0);

    const relevantNeeds = db.needs
      .filter((n: any) => campIds.has(n.camp_id))
      .map((n: any) => calculateNeedDetails(n, db));

    const avgFulfilment =
      relevantNeeds.length > 0
        ? Math.round(relevantNeeds.reduce((sum: number, n: any) => sum + n.delivered_pct, 0) / relevantNeeds.length)
        : 0;

    const lowStockItems = db.inventory.filter((i: any) => Number(i.stock) <= Number(i.reorder_level));

    const dispatches = db.dispatches.filter((d: any) => campIds.has(d.camp_id));
    const volunteers = db.volunteers.filter((v: any) => v.camp_id && campIds.has(v.camp_id));

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
    const db = getDb();
    let list = db.camps;
    if (district && district !== 'all') {
      list = list.filter((c: any) => c.district.toLowerCase() === district.toLowerCase());
    }
    if (query) {
      const q = query.toLowerCase();
      list = list.filter((c: any) => c.name.toLowerCase().includes(q) || c.district.toLowerCase().includes(q));
    }
    return list;
  },

  getCampNeeds(params?: { camp_id?: string; critical_only?: boolean; district?: string }) {
    const db = getDb();
    let needs = db.needs.map((n: any) => calculateNeedDetails(n, db));

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
    const db = getDb();
    let list = db.inventory;
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
    const db = getDb();
    let list = db.dispatches.map((d: any) => {
      const camp = db.camps.find((c: any) => c.id === d.camp_id);
      const need = db.needs.find((n: any) => n.id === d.need_id);
      const item = db.inventory.find(
        (i: any) => i.id === d.inventory_item_id || (need && i.id === need.inventory_item_id)
      );
      return {
        ...d,
        camp,
        need,
        item,
      };
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
    const db = getDb();
    const donations = db.donations.map((d: any) => ({
      ...d,
      item: d.item_id ? db.inventory.find((i: any) => i.id === d.item_id) : null,
    }));

    const cashTotal = donations
      .filter((d: any) => d.type === 'Cash')
      .reduce((sum: number, d: any) => sum + Number(d.amount_or_quantity || 0), 0);

    const inKindDonations = donations.filter((d: any) => d.type === 'In-Kind');

    // Group in-kind donations by item
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
    const db = getDb();
    let list = db.volunteers.map((v: any) => ({
      ...v,
      camp: v.camp_id ? db.camps.find((c: any) => c.id === v.camp_id) : null,
    }));

    if (skill && skill !== 'all') {
      list = list.filter((v: any) => v.skill.toLowerCase() === skill.toLowerCase());
    }

    const unassigned = list.filter((v: any) => !v.camp_id);
    const deployed = list.filter((v: any) => !!v.camp_id);

    // Group unassigned by skill
    const unassignedBySkill: Record<string, number> = {};
    for (const v of unassigned) {
      unassignedBySkill[v.skill] = (unassignedBySkill[v.skill] || 0) + 1;
    }

    return {
      total_volunteers: list.length,
      deployed_count: deployed.length,
      unassigned_count: unassigned.length,
      unassigned_by_skill: unassignedBySkill,
      unassigned_roster: unassigned.map((v: any) => ({
        id: v.id,
        name: v.name,
        skill: v.skill,
        phone: v.phone,
      })),
    };
  },

  calculateAllocationPreview(camp_id: string, need_id: string, proposedQty?: number) {
    const db = getDb();
    const camp = db.camps.find((c: any) => c.id === camp_id);
    if (!camp) throw new Error('Camp not found');

    const need = db.needs.find((n: any) => n.id === need_id);
    if (!need) throw new Error('Need not found');

    const item = db.inventory.find((i: any) => i.id === need.inventory_item_id);
    if (!item) throw new Error('Item not found');

    const needDetails = calculateNeedDetails(need, db);
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
    const deliveredFulfilment = needDetails.fulfilled_quantity; // Unchanged!

    // Competing demands
    const competingNeeds = db.needs
      .filter(
        (n: any) =>
          n.inventory_item_id === item.id && n.camp_id !== camp_id
      )
      .map((n: any) => calculateNeedDetails(n, db))
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
