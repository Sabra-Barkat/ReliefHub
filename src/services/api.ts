import {
  Camp,
  InventoryItem,
  CampNeed,
  NeedWithDetails,
  Dispatch,
  DispatchWithDetails,
  Donation,
  DonationWithDetails,
  Volunteer,
  VolunteerWithDetails,
  AuditLog,
  SystemStats,
  DispatchStatus,
  UserRole,
} from '../types';

const API_BASE = '/api';

// Current active role stored for audit logging
let currentRole: UserRole = 'Operations Coordinator';

export function setApiRole(role: UserRole) {
  currentRole = role;
}

export function getApiRole(): UserRole {
  return currentRole;
}

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const headers = {
    'Content-Type': 'application/json',
    'x-user-role': currentRole,
    ...options.headers,
  };

  try {
    const response = await fetch(`${API_BASE}${endpoint}`, {
      ...options,
      headers,
    });

    if (!response.ok) {
      let errorMessage = `HTTP ${response.status}: ${response.statusText}`;
      try {
        const errorData = await response.json();
        if (errorData.error) {
          errorMessage = errorData.error;
        }
      } catch {
        // Fall back to status text
      }
      throw new Error(errorMessage);
    }

    return await response.json();
  } catch (error: any) {
    console.error(`API Error on ${endpoint}:`, error);
    throw error;
  }
}

export const api = {
  // Health & System
  async getHealth() {
    return request<{ status: string; mode: string; persistent: boolean; timestamp: string }>('/health');
  },

  async resetData() {
    return request<{ message: string }>('/reset', { method: 'POST' });
  },

  // Stats
  async getStats(district?: string) {
    const param = district && district !== 'all' ? `?district=${encodeURIComponent(district)}` : '';
    return request<SystemStats>(`/stats${param}`);
  },

  // Camps
  async getCamps(params?: { district?: string; status?: string; search?: string }) {
    const searchParams = new URLSearchParams();
    if (params?.district && params.district !== 'all') searchParams.set('district', params.district);
    if (params?.status && params.status !== 'all') searchParams.set('status', params.status);
    if (params?.search) searchParams.set('search', params.search);

    const query = searchParams.toString() ? `?${searchParams.toString()}` : '';
    return request<Camp[]>(`/camps${query}`);
  },

  async getCampById(id: string) {
    return request<Camp & { needs: NeedWithDetails[]; dispatches: DispatchWithDetails[]; volunteers: Volunteer[] }>(
      `/camps/${id}`
    );
  },

  async createCamp(camp: Partial<Camp>) {
    return request<Camp>('/camps', {
      method: 'POST',
      body: JSON.stringify(camp),
    });
  },

  async updateCamp(id: string, camp: Partial<Camp>) {
    return request<Camp>(`/camps/${id}`, {
      method: 'PUT',
      body: JSON.stringify(camp),
    });
  },

  async deleteCamp(id: string) {
    return request<{ message: string; id: string }>(`/camps/${id}`, {
      method: 'DELETE',
    });
  },

  // Inventory
  async getInventory(params?: { category?: string; low_stock?: boolean; search?: string }) {
    const searchParams = new URLSearchParams();
    if (params?.category && params.category !== 'all') searchParams.set('category', params.category);
    if (params?.low_stock) searchParams.set('low_stock', 'true');
    if (params?.search) searchParams.set('search', params.search);

    const query = searchParams.toString() ? `?${searchParams.toString()}` : '';
    return request<InventoryItem[]>(`/inventory${query}`);
  },

  async createInventoryItem(item: Partial<InventoryItem>) {
    return request<InventoryItem>('/inventory', {
      method: 'POST',
      body: JSON.stringify(item),
    });
  },

  async updateInventoryItem(id: string, item: Partial<InventoryItem>) {
    return request<InventoryItem>(`/inventory/${id}`, {
      method: 'PUT',
      body: JSON.stringify(item),
    });
  },

  async deleteInventoryItem(id: string) {
    return request<{ message: string }>(`/inventory/${id}`, {
      method: 'DELETE',
    });
  },

  // Needs
  async getNeeds(params?: { camp_id?: string; priority?: string; critical_only?: boolean; district?: string }) {
    const searchParams = new URLSearchParams();
    if (params?.camp_id) searchParams.set('camp_id', params.camp_id);
    if (params?.priority && params.priority !== 'all') searchParams.set('priority', params.priority);
    if (params?.critical_only) searchParams.set('critical_only', 'true');
    if (params?.district && params.district !== 'all') searchParams.set('district', params.district);

    const query = searchParams.toString() ? `?${searchParams.toString()}` : '';
    return request<NeedWithDetails[]>(`/needs${query}`);
  },

  async createNeed(need: Partial<CampNeed>) {
    return request<NeedWithDetails>('/needs', {
      method: 'POST',
      body: JSON.stringify(need),
    });
  },

  // Dispatches
  async getDispatches(params?: { status?: string; camp_id?: string; search?: string; district?: string }) {
    const searchParams = new URLSearchParams();
    if (params?.status && params.status !== 'all') searchParams.set('status', params.status);
    if (params?.camp_id && params.camp_id !== 'all') searchParams.set('camp_id', params.camp_id);
    if (params?.district && params.district !== 'all') searchParams.set('district', params.district);
    if (params?.search) searchParams.set('search', params.search);

    const query = searchParams.toString() ? `?${searchParams.toString()}` : '';
    return request<DispatchWithDetails[]>(`/dispatches${query}`);
  },

  async createDispatch(data: {
    camp_id: string;
    need_id: string;
    quantity: number;
    notes?: string;
    dispatched_by?: string;
  }) {
    return request<{ dispatch: Dispatch; updated_stock: number; message: string }>('/dispatches', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async updateDispatchStatus(id: string, status: DispatchStatus, notes?: string) {
    return request<{ dispatch: Dispatch; message: string }>(`/dispatches/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status, notes }),
    });
  },

  // Donations
  async getDonations(params?: { type?: string; search?: string }) {
    const searchParams = new URLSearchParams();
    if (params?.type && params.type !== 'all') searchParams.set('type', params.type);
    if (params?.search) searchParams.set('search', params.search);

    const query = searchParams.toString() ? `?${searchParams.toString()}` : '';
    return request<DonationWithDetails[]>(`/donations${query}`);
  },

  async createDonation(donation: {
    type: 'Cash' | 'In-Kind';
    amount_or_quantity: number;
    item_id?: string | null;
    category: string;
    donor_name?: string;
    notes?: string;
  }) {
    return request<{ donation: DonationWithDetails; message: string }>('/donations', {
      method: 'POST',
      body: JSON.stringify(donation),
    });
  },

  // Volunteers
  async getVolunteers(params?: { skill?: string; camp_id?: string; status?: string; search?: string }) {
    const searchParams = new URLSearchParams();
    if (params?.skill && params.skill !== 'all') searchParams.set('skill', params.skill);
    if (params?.camp_id && params.camp_id !== 'all') searchParams.set('camp_id', params.camp_id);
    if (params?.status) searchParams.set('status', params.status);
    if (params?.search) searchParams.set('search', params.search);

    const query = searchParams.toString() ? `?${searchParams.toString()}` : '';
    return request<VolunteerWithDetails[]>(`/volunteers${query}`);
  },

  async createVolunteer(volunteer: Partial<Volunteer>) {
    return request<Volunteer>('/volunteers', {
      method: 'POST',
      body: JSON.stringify(volunteer),
    });
  },

  async assignVolunteer(id: string, camp_id: string | null) {
    return request<{ volunteer: Volunteer; camp: Camp | null; message: string }>(`/volunteers/${id}/assign`, {
      method: 'PATCH',
      body: JSON.stringify({ camp_id }),
    });
  },

  async deleteVolunteer(id: string) {
    return request<{ message: string }>(`/volunteers/${id}`, {
      method: 'DELETE',
    });
  },

  // Audit Logs
  async getAuditLogs(limit = 30) {
    return request<AuditLog[]>(`/audit-logs?limit=${limit}`);
  },
};
