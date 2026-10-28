import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { api } from '../services/api';
import { DispatchWithDetails, DispatchStatus, NeedWithDetails } from '../types';
import { ContextualAIPill } from '../components/ai/ContextualAIPill';
import {
  Truck,
  Search,
  Filter,
  Download,
  CheckCircle2,
  Clock,
  AlertCircle,
  Plus,
  ArrowRight,
  Package,
  Calendar,
  X,
} from 'lucide-react';

export const Dispatches: React.FC = () => {
  const { selectedDistrict, refreshData, addToast, userRole, openAllocationModal } = useApp();

  const [dispatches, setDispatches] = useState<DispatchWithDetails[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [search, setSearch] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  // New Dispatch Quick Launcher
  const [isSelectNeedOpen, setIsSelectNeedOpen] = useState<boolean>(false);
  const [availableNeeds, setAvailableNeeds] = useState<NeedWithDetails[]>([]);
  const [isLoadingNeeds, setIsLoadingNeeds] = useState<boolean>(false);

  const fetchDispatches = async () => {
    setIsLoading(true);
    try {
      const data = await api.getDispatches({
        district: selectedDistrict,
        status: statusFilter,
        search: search.trim() || undefined,
      });
      setDispatches(data);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchDispatches();
  }, [selectedDistrict, statusFilter, search]);

  const handleStatusChange = async (dispatch: DispatchWithDetails, newStatus: DispatchStatus) => {
    if (newStatus === 'Cancelled') {
      if (!window.confirm(`Cancel dispatch #${dispatch.id}? Undelivered stock (${dispatch.quantity} ${dispatch.item?.unit || 'units'}) will be restored to warehouse inventory.`)) {
        return;
      }
    }

    setUpdatingId(dispatch.id);
    try {
      await api.updateDispatchStatus(dispatch.id, newStatus);
      addToast({
        type: 'success',
        title: 'Dispatch Updated',
        message: `Dispatch #${dispatch.id} status changed to ${newStatus}.`,
      });
      await fetchDispatches();
      await refreshData();
    } catch (err: any) {
      addToast({
        type: 'error',
        title: 'Status Transition Failed',
        message: err.message || 'Could not update dispatch.',
      });
    } finally {
      setUpdatingId(null);
    }
  };

  const handleOpenNewDispatch = async () => {
    setIsLoadingNeeds(true);
    setIsSelectNeedOpen(true);
    try {
      const needs = await api.getNeeds({ district: selectedDistrict });
      // Filter needs that have unallocated gap and item has available stock
      const allocatable = needs.filter((n) => n.unallocated > 0 && (n.item?.stock || 0) > 0);
      setAvailableNeeds(allocatable);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoadingNeeds(false);
    }
  };

  const handleExportCSV = () => {
    if (dispatches.length === 0) return;
    const headers = ['ID', 'Camp', 'District', 'Item', 'Quantity', 'Unit', 'Status', 'Dispatched By', 'Created At', 'Notes'];
    const rows = dispatches.map((d) => [
      d.id,
      `"${d.camp?.name || ''}"`,
      `"${d.camp?.district || ''}"`,
      `"${d.item?.name || ''}"`,
      d.quantity,
      `"${d.item?.unit || ''}"`,
      d.status,
      `"${d.dispatched_by || ''}"`,
      d.created_at,
      `"${(d.notes || '').replace(/"/g, '""')}"`,
    ]);
    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `reliefhub-dispatches-${selectedDistrict}-${Date.now()}.csv`);
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
            <Truck className="w-3.5 h-3.5" />
            <span>Supply Chain & Transport</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-serif font-bold text-ink mt-1">
            Dispatch Queue & Convoys
          </h1>
          <p className="text-xs text-ink-muted mt-0.5">
            Strict reservation lifecycle: Pending and In Transit count as Committed. Stock is deducted once at reservation and restored on cancellation.
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <ContextualAIPill
            prompt="Review all pending dispatches that are currently committed at the depot but not yet In Transit."
            label="Review Pending Dispatches"
            agentType="dispatch_monitoring"
          />
          <ContextualAIPill
            prompt="Show committed supplies that have not been delivered across all Sindh routes."
            label="Pipeline Integrity"
            agentType="dispatch_monitoring"
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
              onClick={handleOpenNewDispatch}
              className="flex items-center gap-1.5 px-4 py-2 bg-copper hover:bg-copper-hover text-white rounded-md text-xs font-semibold shadow-sm transition"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Create Dispatch Request</span>
            </button>
          )}
        </div>
      </div>

      {/* Filter and Search */}
      <div className="bg-surface p-4 rounded-lg border border-border shadow-card flex flex-wrap items-center justify-between gap-3">
        {/* Search Input */}
        <div className="relative flex-1 min-w-[200px]">
          <Search className="w-4 h-4 text-ink-muted absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Search dispatch by camp, item, or ID..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 bg-canvas/40 border border-border rounded text-xs text-ink focus:border-copper focus:ring-1 focus:ring-copper"
          />
        </div>

        {/* Filters */}
        <div className="flex items-center gap-2 text-xs">
          <Filter className="w-3.5 h-3.5 text-ink-muted" />
          <span className="text-ink-muted font-medium">Status:</span>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-canvas/50 border border-border rounded px-2.5 py-1 text-xs font-semibold text-ink cursor-pointer focus:outline-none"
          >
            <option value="all">All Dispatches</option>
            <option value="Pending">Pending (Reserved)</option>
            <option value="In Transit">In Transit</option>
            <option value="Delivered">Delivered (Fulfilled)</option>
            <option value="Cancelled">Cancelled (Restored)</option>
          </select>

          {(search || statusFilter !== 'all') && (
            <button
              onClick={() => {
                setSearch('');
                setStatusFilter('all');
              }}
              className="text-[11px] text-copper hover:underline font-semibold ml-2"
            >
              Reset filters
            </button>
          )}
        </div>
      </div>

      {/* Dispatches Table */}
      <div className="bg-surface rounded-lg border border-border shadow-card overflow-hidden">
        {isLoading ? (
          <div className="p-12 text-center text-xs text-ink-muted">
            <span className="w-6 h-6 border-2 border-copper/30 border-t-copper rounded-full animate-spin inline-block mb-2"></span>
            <p>Loading active dispatches...</p>
          </div>
        ) : dispatches.length === 0 ? (
          <div className="p-12 text-center">
            <Truck className="w-8 h-8 text-ink-faint mx-auto mb-2" />
            <h3 className="text-sm font-bold text-ink">No dispatches found</h3>
            <p className="text-xs text-ink-muted mt-1">Try selecting a different status or clear search.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-border bg-canvas/40 text-[11px] font-semibold text-ink-muted uppercase tracking-wider">
                  <th className="py-3 px-4">Dispatch ID</th>
                  <th className="py-3 px-4">Destination Camp</th>
                  <th className="py-3 px-4">Item & Quantity</th>
                  <th className="py-3 px-4">Convoy / Handler</th>
                  <th className="py-3 px-4 text-center">Lifecycle Status</th>
                  <th className="py-3 px-4 text-right">Lifecycle Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {dispatches.map((disp) => {
                  const isUpdating = updatingId === disp.id;

                  return (
                    <tr key={disp.id} className="hover:bg-canvas/50 transition">
                      {/* ID & Date */}
                      <td className="py-3.5 px-4 font-mono font-medium text-ink">
                        <span>{disp.id}</span>
                        <span className="block text-[10px] text-ink-muted font-sans mt-0.5">
                          {new Date(disp.created_at).toLocaleString(undefined, {
                            month: 'short',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                      </td>

                      {/* Destination Camp */}
                      <td className="py-3.5 px-4">
                        <span className="font-bold text-ink block">{disp.camp?.name}</span>
                        <span className="text-[11px] text-ink-muted">{disp.camp?.district} District</span>
                      </td>

                      {/* Item & Quantity */}
                      <td className="py-3.5 px-4 font-medium">
                        <div className="flex items-center gap-1.5">
                          <Package className="w-3.5 h-3.5 text-copper shrink-0" />
                          <span className="font-semibold text-ink">{disp.item?.name}</span>
                        </div>
                        <span className="text-xs text-ink font-bold tabular-nums ml-5 block mt-0.5">
                          {disp.quantity.toLocaleString()} {disp.item?.unit || 'units'}
                        </span>
                      </td>

                      {/* Handler / Notes */}
                      <td className="py-3.5 px-4 text-ink-muted">
                        <span className="font-medium text-ink block">{disp.dispatched_by || 'Operations Desk'}</span>
                        {disp.notes && <span className="text-[11px] italic truncate max-w-xs block">{disp.notes}</span>}
                      </td>

                      {/* Status */}
                      <td className="py-3.5 px-4 text-center">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                            disp.status === 'Delivered'
                              ? 'bg-teal-light text-teal border-teal-border/60'
                              : disp.status === 'In Transit'
                              ? 'bg-saffron-light text-saffron-hover border-saffron-border/60'
                              : disp.status === 'Cancelled'
                              ? 'bg-critical-light text-critical border-critical-border/60'
                              : 'bg-canvas text-ink-muted border-border'
                          }`}
                        >
                          {disp.status === 'Delivered' && <CheckCircle2 className="w-3 h-3" />}
                          {disp.status === 'In Transit' && <Truck className="w-3 h-3" />}
                          {disp.status === 'Pending' && <Clock className="w-3 h-3" />}
                          {disp.status === 'Cancelled' && <AlertCircle className="w-3 h-3" />}
                          {disp.status}
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 text-right">
                        {isUpdating ? (
                          <span className="text-xs text-ink-muted italic">Updating...</span>
                        ) : (
                          <div className="flex items-center justify-end gap-2">
                            {disp.status === 'Pending' && (
                              <button
                                onClick={() => handleStatusChange(disp, 'In Transit')}
                                className="px-2.5 py-1 text-[11px] font-semibold text-saffron-hover bg-saffron-light border border-saffron-border rounded hover:bg-saffron hover:text-ink transition"
                              >
                                Mark In Transit
                              </button>
                            )}

                            {(disp.status === 'Pending' || disp.status === 'In Transit') && (
                              <button
                                onClick={() => handleStatusChange(disp, 'Delivered')}
                                className="px-2.5 py-1 text-[11px] font-semibold text-teal bg-teal-light border border-teal-border rounded hover:bg-teal hover:text-white transition"
                              >
                                Mark Delivered
                              </button>
                            )}

                            {(disp.status === 'Pending' || disp.status === 'In Transit') &&
                              userRole === 'Operations Coordinator' && (
                                <button
                                  onClick={() => handleStatusChange(disp, 'Cancelled')}
                                  className="px-2 py-1 text-[11px] font-semibold text-critical hover:bg-critical-light rounded transition"
                                >
                                  Cancel
                                </button>
                              )}

                            {(disp.status === 'Delivered' || disp.status === 'Cancelled') && (
                              <span className="text-[11px] text-ink-faint italic">Terminal status</span>
                            )}
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Select Need for New Dispatch Modal */}
      {isSelectNeedOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink/50 backdrop-blur-sm animate-fade-in"
          role="dialog"
          aria-modal="true"
        >
          <div className="bg-surface w-full max-w-xl rounded-lg border border-border shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
            <div className="px-6 py-4 border-b border-border bg-canvas/40 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-serif font-bold text-ink">Select Camp Need to Dispatch</h2>
                <p className="text-xs text-ink-muted">
                  Choose a verified field need with unallocated gap and available depot stock.
                </p>
              </div>
              <button
                onClick={() => setIsSelectNeedOpen(false)}
                className="p-1 rounded text-ink-muted hover:text-ink"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-2.5">
              {isLoadingNeeds ? (
                <div className="p-8 text-center text-xs text-ink-muted">
                  <span className="w-5 h-5 border-2 border-copper/30 border-t-copper rounded-full animate-spin inline-block mb-2"></span>
                  <p>Searching open camp gaps...</p>
                </div>
              ) : availableNeeds.length === 0 ? (
                <p className="text-xs text-ink-muted text-center py-6">
                  No allocatable needs found with available warehouse stock in this district.
                </p>
              ) : (
                availableNeeds.map((need) => (
                  <div
                    key={need.id}
                    onClick={() => {
                      setIsSelectNeedOpen(false);
                      openAllocationModal(need);
                    }}
                    className="p-3 bg-canvas/30 rounded border border-border hover:border-copper hover:bg-canvas/60 transition cursor-pointer flex items-center justify-between"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-ink text-xs">{need.camp?.name}</span>
                        <span className="text-[10px] text-ink-muted">({need.camp?.district})</span>
                        <span className="text-[10px] font-semibold text-copper bg-copper-light px-1.5 py-0.2 rounded border border-copper-border">
                          {need.priority}
                        </span>
                      </div>
                      <span className="text-xs text-ink-light mt-0.5 block">
                        {need.item?.name} — Unallocated Gap: <strong className="text-critical">{need.unallocated}</strong> {need.item?.unit}
                      </span>
                    </div>

                    <div className="text-right flex items-center gap-3">
                      <div className="text-right">
                        <span className="text-[10px] text-ink-muted block">Depot Stock:</span>
                        <span className="text-xs font-bold text-teal">{need.item?.stock} {need.item?.unit}</span>
                      </div>
                      <button className="px-3 py-1.5 bg-copper text-white text-[11px] font-semibold rounded shadow-sm hover:bg-copper-hover transition">
                        Allocate →
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
