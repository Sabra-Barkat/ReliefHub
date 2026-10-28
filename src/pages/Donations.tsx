import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { api } from '../services/api';
import { DonationWithDetails, DonationType, InventoryItem } from '../types';
import { ContextualAIPill } from '../components/ai/ContextualAIPill';
import {
  HeartHandshake,
  Search,
  Plus,
  Filter,
  Download,
  Coins,
  Package,
  Calendar,
  X,
  CheckCircle,
} from 'lucide-react';

export const Donations: React.FC = () => {
  const { refreshData, addToast, userRole } = useApp();

  const [donations, setDonations] = useState<DonationWithDetails[]>([]);
  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [search, setSearch] = useState<string>('');
  const [typeFilter, setTypeFilter] = useState<string>('all');

  // Form Modal
  const [isFormOpen, setIsFormOpen] = useState<boolean>(false);
  const [formData, setFormData] = useState({
    type: 'In-Kind' as DonationType,
    amount_or_quantity: 100,
    item_id: '',
    category: 'Water & Sanitation',
    donor_name: '',
    notes: '',
  });
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  const fetchDonations = async () => {
    setIsLoading(true);
    try {
      const [donationsData, itemsData] = await Promise.all([
        api.getDonations({
          type: typeFilter,
          search: search.trim() || undefined,
        }),
        api.getInventory(),
      ]);
      setDonations(donationsData);
      setInventoryItems(itemsData);
      if (itemsData.length > 0 && !formData.item_id) {
        setFormData((prev) => ({ ...prev, item_id: itemsData[0].id, category: itemsData[0].category }));
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchDonations();
  }, [typeFilter, search]);

  // Distinct totals maintaining unit separation
  const cashTotal = donations
    .filter((d) => d.type === 'Cash')
    .reduce((sum, d) => sum + Number(d.amount_or_quantity), 0);

  const inKindCount = donations.filter((d) => d.type === 'In-Kind').length;

  const handleOpenCreate = () => {
    setFormData({
      type: 'In-Kind',
      amount_or_quantity: 100,
      item_id: inventoryItems[0]?.id || '',
      category: inventoryItems[0]?.category || 'Water & Sanitation',
      donor_name: '',
      notes: '',
    });
    setFormError(null);
    setIsFormOpen(true);
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const val = Number(formData.amount_or_quantity);
    if (isNaN(val) || val <= 0) {
      setFormError('Amount or quantity must be a positive number.');
      return;
    }

    if (formData.type === 'In-Kind' && !formData.item_id) {
      setFormError('Please select a target inventory item for in-kind receipt.');
      return;
    }

    setIsSubmitting(true);
    try {
      await api.createDonation(formData);
      addToast({
        type: 'success',
        title: 'Donation Recorded',
        message:
          formData.type === 'In-Kind'
            ? `In-Kind donation received. Warehouse stock increased by ${val.toLocaleString()}.`
            : `Cash contribution of PKR ${val.toLocaleString()} registered.`,
      });
      setIsFormOpen(false);
      await fetchDonations();
      await refreshData();
    } catch (err: any) {
      setFormError(err.message || 'Failed to record donation.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleExportCSV = () => {
    if (donations.length === 0) return;
    const headers = ['ID', 'Type', 'Amount / Qty', 'Unit / Currency', 'Category', 'Donor Name', 'Date', 'Notes'];
    const rows = donations.map((d) => [
      d.id,
      d.type,
      d.amount_or_quantity,
      d.type === 'Cash' ? 'PKR' : d.item?.unit || 'units',
      `"${d.category}"`,
      `"${d.donor_name || 'Anonymous'}"`,
      d.date,
      `"${(d.notes || '').replace(/"/g, '""')}"`,
    ]);
    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `reliefhub-donations-${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-copper">
            <HeartHandshake className="w-3.5 h-3.5" />
            <span>Aid Influx & Contributions</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-serif font-bold text-ink mt-1">
            Donation Management
          </h1>
          <p className="text-xs text-ink-muted mt-0.5">
            Strict physical unit distinction. In-Kind donations automatically replenish warehouse inventory stock.
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <ContextualAIPill
            prompt="Summarize cash contributions and category breakdowns while maintaining strict separation of physical units."
            label="Cash Aid Summary"
            agentType="operations_summary"
          />
          <ContextualAIPill
            prompt="Show all in-kind consignments and how they directly replenished warehouse inventory stock."
            label="In-Kind Stock Impact"
            agentType="supply_planning"
          />
          <button
            onClick={handleExportCSV}
            className="flex items-center gap-1.5 px-3 py-2 bg-surface hover:bg-canvas border border-border rounded-md text-xs font-semibold text-ink transition shadow-sm"
          >
            <Download className="w-3.5 h-3.5 text-ink-muted" />
            <span>Export CSV</span>
          </button>

          {userRole === 'Operations Coordinator' && (
            <button
              onClick={handleOpenCreate}
              className="flex items-center gap-1.5 px-4 py-2 bg-copper hover:bg-copper-hover text-white rounded-md text-xs font-semibold shadow-sm transition"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Record Contribution</span>
            </button>
          )}
        </div>
      </div>

      {/* Summary Band: Distinct Cash vs In-Kind Totals */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* Cash Funds */}
        <div className="bg-surface p-4 rounded-lg border border-border shadow-card flex items-center justify-between">
          <div>
            <span className="text-xs font-medium text-ink-muted block">Total Cash Received</span>
            <span className="text-xl sm:text-2xl font-serif font-bold text-ink tabular-nums mt-1 block">
              PKR {cashTotal.toLocaleString()}
            </span>
            <span className="text-[10px] text-ink-muted">Allocated for fuel, bowsers & emergency supplies</span>
          </div>
          <div className="p-3 rounded-full bg-saffron-light text-saffron-hover border border-saffron-border">
            <Coins className="w-6 h-6" />
          </div>
        </div>

        {/* Physical In-Kind Shipments */}
        <div className="bg-surface p-4 rounded-lg border border-border shadow-card flex items-center justify-between">
          <div>
            <span className="text-xs font-medium text-ink-muted block">In-Kind Aid Shipments</span>
            <span className="text-xl sm:text-2xl font-serif font-bold text-teal tabular-nums mt-1 block">
              {inKindCount} Consignments
            </span>
            <span className="text-[10px] text-ink-muted">Tents, water, medicines & rations</span>
          </div>
          <div className="p-3 rounded-full bg-teal-light text-teal border border-teal-border">
            <Package className="w-6 h-6" />
          </div>
        </div>

        {/* Accountability Metric */}
        <div className="bg-surface p-4 rounded-lg border border-border shadow-card flex items-center justify-between sm:col-span-2 lg:col-span-1">
          <div>
            <span className="text-xs font-medium text-ink-muted block">Direct Warehouse Inflow</span>
            <span className="text-xl sm:text-2xl font-serif font-bold text-copper tabular-nums mt-1 block">
              100% Verified
            </span>
            <span className="text-[10px] text-ink-muted">Depot inventory updated immediately upon receipt</span>
          </div>
          <div className="p-3 rounded-full bg-copper-light text-copper border border-copper-border">
            <CheckCircle className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* Filter and Search */}
      <div className="bg-surface p-4 rounded-lg border border-border shadow-card flex flex-wrap items-center justify-between gap-3">
        {/* Search */}
        <div className="relative flex-1 min-w-[200px]">
          <Search className="w-4 h-4 text-ink-muted absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Search by donor name, category, or notes..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 bg-canvas/40 border border-border rounded text-xs text-ink focus:border-copper focus:ring-1 focus:ring-copper"
          />
        </div>

        {/* Type Filter */}
        <div className="flex items-center gap-2 text-xs">
          <Filter className="w-3.5 h-3.5 text-ink-muted" />
          <span className="text-ink-muted font-medium">Type:</span>
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="bg-canvas/50 border border-border rounded px-2.5 py-1 text-xs font-semibold text-ink cursor-pointer focus:outline-none"
          >
            <option value="all">All Contributions</option>
            <option value="Cash">Cash (PKR)</option>
            <option value="In-Kind">In-Kind (Physical Supplies)</option>
          </select>

          {(search || typeFilter !== 'all') && (
            <button
              onClick={() => {
                setSearch('');
                setTypeFilter('all');
              }}
              className="text-[11px] text-copper hover:underline font-semibold ml-2"
            >
              Reset filters
            </button>
          )}
        </div>
      </div>

      {/* Donations Table */}
      <div className="bg-surface rounded-lg border border-border shadow-card overflow-hidden">
        {isLoading ? (
          <div className="p-12 text-center text-xs text-ink-muted">
            <span className="w-6 h-6 border-2 border-copper/30 border-t-copper rounded-full animate-spin inline-block mb-2"></span>
            <p>Loading donations log...</p>
          </div>
        ) : donations.length === 0 ? (
          <div className="p-12 text-center">
            <HeartHandshake className="w-8 h-8 text-ink-faint mx-auto mb-2" />
            <h3 className="text-sm font-bold text-ink">No donation records found</h3>
            <p className="text-xs text-ink-muted mt-1">Try modifying your filter or record a new contribution.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-border bg-canvas/40 text-[11px] font-semibold text-ink-muted uppercase tracking-wider">
                  <th className="py-3 px-4">Donor / Contributor</th>
                  <th className="py-3 px-4">Category</th>
                  <th className="py-3 px-4">Type</th>
                  <th className="py-3 px-4 text-right">Value / Quantity</th>
                  <th className="py-3 px-4">Receipt Date</th>
                  <th className="py-3 px-4">Field Notes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {donations.map((d) => (
                  <tr key={d.id} className="hover:bg-canvas/50 transition">
                    {/* Donor */}
                    <td className="py-3.5 px-4 font-bold text-ink">
                      <span>{d.donor_name || 'Anonymous Supporter'}</span>
                      <span className="block text-[10px] text-ink-muted font-mono">{d.id}</span>
                    </td>

                    {/* Category */}
                    <td className="py-3.5 px-4 font-medium text-ink">
                      <span className="px-2 py-0.5 rounded bg-canvas border border-border text-[11px]">
                        {d.category}
                      </span>
                    </td>

                    {/* Type */}
                    <td className="py-3.5 px-4">
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                          d.type === 'Cash'
                            ? 'bg-saffron-light text-saffron-hover border-saffron-border/60'
                            : 'bg-teal-light text-teal border-teal-border/60'
                        }`}
                      >
                        {d.type === 'Cash' ? <Coins className="w-3 h-3" /> : <Package className="w-3 h-3" />}
                        {d.type}
                      </span>
                    </td>

                    {/* Value */}
                    <td className="py-3.5 px-4 text-right font-bold tabular-nums">
                      {d.type === 'Cash' ? (
                        <span className="text-saffron-hover text-sm">
                          PKR {d.amount_or_quantity.toLocaleString()}
                        </span>
                      ) : (
                        <span className="text-teal text-sm">
                          {d.amount_or_quantity.toLocaleString()} {d.item?.unit || 'units'}
                          <span className="block text-[10px] text-ink-muted font-normal">
                            of {d.item?.name}
                          </span>
                        </span>
                      )}
                    </td>

                    {/* Date */}
                    <td className="py-3.5 px-4 text-ink-muted">
                      {new Date(d.date).toLocaleDateString(undefined, {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      })}
                    </td>

                    {/* Notes */}
                    <td className="py-3.5 px-4 text-ink-muted max-w-xs truncate text-[11px] italic">
                      {d.notes || '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Record Contribution Modal */}
      {isFormOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink/50 backdrop-blur-sm animate-fade-in"
          role="dialog"
          aria-modal="true"
        >
          <div className="bg-surface w-full max-w-md rounded-lg border border-border shadow-2xl overflow-hidden flex flex-col">
            <div className="px-6 py-4 border-b border-border bg-canvas/40 flex items-center justify-between">
              <h2 className="text-lg font-serif font-bold text-ink">Record Influx Contribution</h2>
              <button
                onClick={() => setIsFormOpen(false)}
                className="p-1 rounded text-ink-muted hover:text-ink"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleFormSubmit} className="p-6 space-y-4 text-xs">
              {formError && (
                <div className="p-3 bg-critical-light border border-critical-border text-critical rounded font-medium">
                  {formError}
                </div>
              )}

              <div>
                <label className="block font-semibold text-ink mb-1">Donor / Coalition Organization</label>
                <input
                  type="text"
                  value={formData.donor_name}
                  onChange={(e) => setFormData({ ...formData, donor_name: e.target.value })}
                  placeholder="e.g. Crescent Relief Agency, Rotary International..."
                  className="w-full px-3 py-2 bg-canvas/30 border border-border rounded text-ink focus:border-copper"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-ink mb-1">Contribution Type</label>
                  <select
                    value={formData.type}
                    onChange={(e) =>
                      setFormData({ ...formData, type: e.target.value as DonationType })
                    }
                    className="w-full px-3 py-2 bg-canvas/30 border border-border rounded text-ink focus:border-copper"
                  >
                    <option value="In-Kind">In-Kind (Physical Supplies)</option>
                    <option value="Cash">Cash (PKR)</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-ink mb-1">Category</label>
                  <input
                    type="text"
                    required
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    placeholder="e.g. Water & Sanitation"
                    className="w-full px-3 py-2 bg-canvas/30 border border-border rounded text-ink focus:border-copper"
                  />
                </div>
              </div>

              {formData.type === 'In-Kind' ? (
                <div>
                  <label className="block font-semibold text-ink mb-1">Warehouse Item to Replenish</label>
                  <select
                    value={formData.item_id}
                    onChange={(e) => {
                      const sel = inventoryItems.find((i) => i.id === e.target.value);
                      setFormData({
                        ...formData,
                        item_id: e.target.value,
                        category: sel ? sel.category : formData.category,
                      });
                    }}
                    className="w-full px-3 py-2 bg-canvas/30 border border-border rounded text-ink focus:border-copper"
                  >
                    {inventoryItems.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.name} ({item.unit}) — Current Stock: {item.stock}
                      </option>
                    ))}
                  </select>
                  <span className="text-[10px] text-teal font-medium mt-1 block">
                    ✓ Recording this donation will immediately increase warehouse inventory.
                  </span>
                </div>
              ) : null}

              <div>
                <label className="block font-semibold text-ink mb-1">
                  {formData.type === 'Cash' ? 'Cash Amount (PKR)' : 'Physical Quantity'}
                </label>
                <input
                  type="number"
                  min={1}
                  required
                  value={formData.amount_or_quantity}
                  onChange={(e) =>
                    setFormData({ ...formData, amount_or_quantity: Number(e.target.value) })
                  }
                  className="w-full px-3 py-2 bg-canvas/30 border border-border rounded text-ink text-right font-semibold tabular-nums focus:border-copper"
                />
              </div>

              <div>
                <label className="block font-semibold text-ink mb-1">Donation Notes / Specification</label>
                <textarea
                  rows={2}
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="e.g. Heavy waterproof canvas tents with ground sheets..."
                  className="w-full px-3 py-2 bg-canvas/30 border border-border rounded text-ink focus:border-copper"
                />
              </div>

              <div className="pt-3 border-t border-border flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setIsFormOpen(false)}
                  className="px-4 py-2 border border-border rounded text-ink-muted hover:text-ink"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 bg-copper hover:bg-copper-hover text-white font-semibold rounded shadow-sm disabled:opacity-50"
                >
                  {isSubmitting ? 'Recording...' : 'Confirm & Record Inflow'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
