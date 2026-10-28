export type CampStatus = 'Active' | 'Full' | 'Closed';

export interface Camp {
  id: string;
  name: string;
  district: string;
  capacity: number;
  current_families: number;
  status: CampStatus;
  notes?: string;
}

export type InventoryCategory =
  | 'Food & Nutrition'
  | 'Water & Sanitation'
  | 'Shelter & NFIs'
  | 'Medical Supplies'
  | 'Hygiene Kits'
  | 'Other';

export interface InventoryItem {
  id: string;
  name: string;
  category: InventoryCategory;
  unit: string;
  stock: number; // Available warehouse stock, excluding reserved
  reorder_level: number;
}

export type NeedPriority = 'High' | 'Medium' | 'Low';

export interface CampNeed {
  id: string;
  camp_id: string;
  inventory_item_id: string;
  required_quantity: number;
  priority: NeedPriority;
  fulfilled_quantity: number; // Supplies physically delivered
}

// Calculated view of need with relationships resolved
export interface NeedWithDetails extends CampNeed {
  camp: Camp;
  item: InventoryItem;
  reserved_quantity: number; // Pending + In Transit dispatches
  unallocated: number; // max(0, required_quantity - fulfilled_quantity - reserved_quantity)
  delivered_pct: number;
  committed_pct: number;
  unallocated_pct: number;
  suggested_action: string;
  action_type: 'allocate' | 'source' | 'followup' | 'gap' | 'fulfilled';
}

export type DispatchStatus = 'Pending' | 'In Transit' | 'Delivered' | 'Cancelled';

export interface Dispatch {
  id: string;
  camp_id: string;
  need_id: string;
  inventory_item_id?: string;
  quantity: number;
  status: DispatchStatus;
  created_at: string;
  updated_at?: string;
  dispatched_by?: string;
  notes?: string;
}

export interface DispatchWithDetails extends Dispatch {
  camp?: Camp;
  need?: CampNeed;
  item?: InventoryItem;
}

export type DonationType = 'Cash' | 'In-Kind';

export interface Donation {
  id: string;
  type: DonationType;
  amount_or_quantity: number;
  item_id: string | null; // For In-Kind donations
  category: string;
  donor_name?: string;
  date: string;
  notes?: string;
}

export interface DonationWithDetails extends Donation {
  item?: InventoryItem;
}

export type VolunteerSkill = 'Medical' | 'Logistics' | 'Cooking' | 'Driving' | 'Counselling';

export interface Volunteer {
  id: string;
  name: string;
  skill: VolunteerSkill;
  camp_id: string | null; // At most one camp assignment; null if unassigned
  phone?: string;
  joined_date?: string;
}

export interface VolunteerWithDetails extends Volunteer {
  camp?: Camp;
}

export interface AuditLog {
  id: string;
  timestamp: string;
  action: string;
  entity_type: 'camp' | 'inventory' | 'dispatch' | 'donation' | 'volunteer' | 'need';
  entity_id: string;
  description: string;
  actor: string;
}

export interface SystemStats {
  active_camps: number;
  total_camps: number;
  families_sheltered: number;
  total_capacity: number;
  avg_need_fulfilment: number; // Average of individual need fulfilment percentages
  low_stock_items: number;
  low_stock_categories: number;
  volunteers_deployed: number;
  total_volunteers: number;
  districts_active: number;
  dispatch_summary: {
    total: number;
    delivered: number;
    in_transit: number;
    pending: number;
    cancelled: number;
  };
  category_fulfilment: {
    category: InventoryCategory;
    delivered_pct: number;
    committed_pct: number;
    unallocated_pct: number;
    required_total: number;
    fulfilled_total: number;
    reserved_total: number;
  }[];
}

export type UserRole = 'Operations Coordinator' | 'Field Volunteer';
