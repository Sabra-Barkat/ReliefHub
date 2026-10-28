import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { api } from '../services/api';
import { ResponseGapStrip } from './ResponseGapStrip';
import { NeedWithDetails, DispatchWithDetails, Volunteer } from '../types';
import {
  X,
  Droplets,
  Package,
  Truck,
  Users,
  CheckCircle2,
  Clock,
  AlertCircle,
  FileText,
  Calendar,
  Layers,
} from 'lucide-react';

export const RightDrawer: React.FC = () => {
  const { isDrawerOpen, setIsDrawerOpen, selectedNeed, openAllocationModal, refreshData, addToast, userRole } =
    useApp();
  const [activeTab, setActiveTab] = useState<'needs' | 'supplies' | 'dispatches' | 'volunteers'>('needs');
  const [campDispatches, setCampDispatches] = useState<DispatchWithDetails[]>([]);
  const [campVolunteers, setCampVolunteers] = useState<Volunteer[]>([]);
  const [allCampNeeds, setAllCampNeeds] = useState<NeedWithDetails[]>([]);
  const [isLoadingDetails, setIsLoadingDetails] = useState<boolean>(false);

  useEffect(() => {
    if (isDrawerOpen && selectedNeed?.camp_id) {
      setIsLoadingDetails(true);
      Promise.all([
        api.getDispatches({ camp_id: selectedNeed.camp_id }),
        api.getVolunteers({ camp_id: selectedNeed.camp_id }),
        api.getNeeds({ camp_id: selectedNeed.camp_id }),
      ])
        .then(([dispatches, volunteers, needs]) => {
          setCampDispatches(dispatches);
          setCampVolunteers(volunteers);
          setAllCampNeeds(needs);
        })
        .catch(console.error)
        .finally(() => setIsLoadingDetails(false));
    }
  }, [isDrawerOpen, selectedNeed?.camp_id]);

  if (!isDrawerOpen || !selectedNeed) return null;

  const camp = selectedNeed.camp;
  const item = selectedNeed.item;

  const handleStatusChange = async (dispatchId: string, newStatus: any) => {
    try {
      await api.updateDispatchStatus(dispatchId, newStatus);
      addToast({
        type: 'success',
        title: 'Dispatch Updated',
        message: `Dispatch status updated to ${newStatus}.`,
      });
      await refreshData();
      // reload dispatches
      const updated = await api.getDispatches({ camp_id: selectedNeed.camp_id });
      setCampDispatches(updated);
    } catch (err: any) {
      addToast({
        type: 'error',
        title: 'Update Failed',
        message: err.message || 'Could not update dispatch status.',
      });
    }
  };

  return (
    <>
      {/* Backdrop for mobile */}
      <div
        className="fixed inset-0 z-40 bg-ink/30 backdrop-blur-sm lg:hidden"
        onClick={() => setIsDrawerOpen(false)}
      />

      <aside
        className="fixed top-0 right-0 z-40 h-full w-full max-w-md bg-surface border-l border-border shadow-2xl flex flex-col transition-transform duration-300 ease-in-out"
        aria-label="Camp and Need Inspector Drawer"
      >
        {/* Drawer Header */}
        <div className="p-5 border-b border-border bg-canvas/30 flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-serif font-bold text-ink tracking-tight">
                {camp?.name || 'Camp Inspection'}
              </h2>
              {selectedNeed.priority === 'High' && (
                <span className="text-[10px] font-semibold text-critical bg-critical-light border border-critical-border px-2 py-0.5 rounded-full">
                  High priority
                </span>
              )}
            </div>
            <p className="text-xs text-ink-muted mt-1 font-sans">
              {camp?.district} District · {camp?.current_families.toLocaleString()} families
            </p>
          </div>
          <button
            onClick={() => setIsDrawerOpen(false)}
            className="p-1 rounded text-ink-muted hover:text-ink hover:bg-canvas transition"
            aria-label="Close inspection drawer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-border bg-surface px-4 text-xs font-medium">
          {(['needs', 'supplies', 'dispatches', 'volunteers'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`py-2.5 px-3 capitalize border-b-2 font-medium transition ${
                activeTab === tab
                  ? 'border-copper text-copper font-semibold'
                  : 'border-transparent text-ink-muted hover:text-ink'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* Drawer Content Area */}
        <div className="flex-1 overflow-y-auto p-5 space-y-6">
          {activeTab === 'needs' && (
            <>
              {/* Signature Response Gap Strip */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-ink uppercase tracking-wider">
                    Response gap strip
                  </span>
                  <span className="text-xs text-ink-muted">
                    Required: {selectedNeed.required_quantity.toLocaleString()} {item?.unit}
                  </span>
                </div>
                <ResponseGapStrip
                  requiredQuantity={selectedNeed.required_quantity}
                  deliveredQuantity={selectedNeed.fulfilled_quantity}
                  committedQuantity={selectedNeed.reserved_quantity}
                  unallocatedQuantity={selectedNeed.unallocated}
                  unit={item?.unit || 'units'}
                  size="lg"
                />
              </div>

              {/* Need Details Card */}
              <div className="border border-border rounded-md p-4 bg-canvas/30 space-y-3">
                <span className="text-[11px] font-bold text-ink-muted uppercase tracking-wider block">
                  Need details
                </span>
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded bg-teal-light text-teal border border-teal-border shrink-0">
                    <Droplets className="w-5 h-5" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <h4 className="text-sm font-bold text-ink">{item?.name}</h4>
                      <span className="text-xs font-semibold text-ink-light tabular-nums">
                        {selectedNeed.required_quantity.toLocaleString()} {item?.unit}
                      </span>
                    </div>
                    <span className="inline-block mt-1 text-[10px] font-semibold text-copper bg-copper-light border border-copper-border px-2 py-0.5 rounded">
                      {selectedNeed.priority} priority
                    </span>
                    <p className="text-xs text-ink-muted mt-2 leading-relaxed">
                      Essential humanitarian relief supply for drinking water, hygiene, or shelter dignity.
                    </p>
                  </div>
                </div>

                <div className="pt-2 border-t border-border flex items-center justify-between text-xs">
                  <span className="text-ink-muted">Depot Available:</span>
                  <span className="font-semibold text-ink">
                    {item?.stock.toLocaleString()} {item?.unit}
                  </span>
                </div>
              </div>

              {/* Recent Activity Timeline */}
              <div className="space-y-3">
                <h4 className="text-xs font-bold text-ink uppercase tracking-wider">Recent activity</h4>
                {campDispatches.length === 0 ? (
                  <p className="text-xs text-ink-muted italic">No dispatch activity recorded yet for this camp.</p>
                ) : (
                  <div className="space-y-2.5">
                    {campDispatches.slice(0, 4).map((d) => (
                      <div
                        key={d.id}
                        className="flex items-start gap-3 text-xs bg-canvas/40 p-2.5 rounded border border-border"
                      >
                        <div className="mt-0.5 p-1 rounded bg-surface border border-border shrink-0">
                          {d.status === 'Delivered' ? (
                            <CheckCircle2 className="w-3.5 h-3.5 text-teal" />
                          ) : d.status === 'In Transit' ? (
                            <Truck className="w-3.5 h-3.5 text-saffron-hover" />
                          ) : d.status === 'Cancelled' ? (
                            <AlertCircle className="w-3.5 h-3.5 text-critical" />
                          ) : (
                            <Clock className="w-3.5 h-3.5 text-ink-muted" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between">
                            <span className="font-semibold text-ink">
                              {d.quantity.toLocaleString()} units {d.status.toLowerCase()}
                            </span>
                            <span className="text-[10px] text-ink-muted">
                              {new Date(d.created_at).toLocaleDateString(undefined, {
                                month: 'short',
                                day: 'numeric',
                              })}
                            </span>
                          </div>
                          <p className="text-[11px] text-ink-muted truncate">
                            by {d.dispatched_by || 'Operations Desk'}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}

          {activeTab === 'supplies' && (
            <div className="space-y-4">
              <h4 className="text-xs font-bold text-ink uppercase tracking-wider">
                All Camp Needs ({allCampNeeds.length})
              </h4>
              <div className="space-y-3">
                {allCampNeeds.map((n) => (
                  <div key={n.id} className="p-3 bg-canvas/40 rounded border border-border space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-xs text-ink">{n.item?.name}</span>
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-surface border border-border text-ink-light">
                        {n.priority}
                      </span>
                    </div>
                    <ResponseGapStrip
                      requiredQuantity={n.required_quantity}
                      deliveredQuantity={n.fulfilled_quantity}
                      committedQuantity={n.reserved_quantity}
                      unallocatedQuantity={n.unallocated}
                      unit={n.item?.unit || 'units'}
                      size="sm"
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'dispatches' && (
            <div className="space-y-3">
              <h4 className="text-xs font-bold text-ink uppercase tracking-wider">
                Active Dispatches ({campDispatches.length})
              </h4>
              {campDispatches.map((d) => (
                <div key={d.id} className="p-3 bg-canvas/40 rounded border border-border text-xs space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-ink">
                      {d.quantity.toLocaleString()} {d.item?.unit || 'units'} of {d.item?.name}
                    </span>
                    <span
                      className={`text-[10px] font-semibold px-2 py-0.5 rounded ${
                        d.status === 'Delivered'
                          ? 'bg-teal-light text-teal border border-teal-border'
                          : d.status === 'In Transit'
                          ? 'bg-saffron-light text-saffron-hover border border-saffron-border'
                          : d.status === 'Cancelled'
                          ? 'bg-critical-light text-critical border border-critical-border'
                          : 'bg-surface text-ink-muted border border-border'
                      }`}
                    >
                      {d.status}
                    </span>
                  </div>

                  {d.notes && <p className="text-[11px] text-ink-light italic">{d.notes}</p>}

                  {/* Actions for this dispatch */}
                  <div className="pt-2 border-t border-border flex items-center justify-end gap-2">
                    {d.status === 'Pending' && (
                      <button
                        onClick={() => handleStatusChange(d.id, 'In Transit')}
                        className="text-[10px] font-semibold text-saffron-hover hover:underline"
                      >
                        Mark In Transit →
                      </button>
                    )}
                    {(d.status === 'Pending' || d.status === 'In Transit') && (
                      <button
                        onClick={() => handleStatusChange(d.id, 'Delivered')}
                        className="text-[10px] font-semibold text-teal hover:underline"
                      >
                        Confirm Delivered ✓
                      </button>
                    )}
                    {(d.status === 'Pending' || d.status === 'In Transit') && (
                      <button
                        onClick={() => handleStatusChange(d.id, 'Cancelled')}
                        className="text-[10px] font-semibold text-critical hover:underline"
                      >
                        Cancel
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {activeTab === 'volunteers' && (
            <div className="space-y-3">
              <h4 className="text-xs font-bold text-ink uppercase tracking-wider">
                Assigned Volunteers ({campVolunteers.length})
              </h4>
              {campVolunteers.length === 0 ? (
                <p className="text-xs text-ink-muted italic">No volunteers currently deployed to this camp.</p>
              ) : (
                <div className="space-y-2">
                  {campVolunteers.map((v) => (
                    <div
                      key={v.id}
                      className="p-2.5 bg-canvas/40 rounded border border-border flex items-center justify-between text-xs"
                    >
                      <div>
                        <span className="font-semibold text-ink block">{v.name}</span>
                        <span className="text-[11px] text-ink-muted">{v.skill} Team</span>
                      </div>
                      {v.phone && <span className="text-[10px] text-ink-muted">{v.phone}</span>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Drawer Action Footer */}
        <div className="p-5 border-t border-border bg-canvas/30 space-y-2.5">
          <button
            onClick={() => {
              openAllocationModal(selectedNeed);
            }}
            className="w-full py-2.5 px-4 bg-copper hover:bg-copper-hover text-white text-xs font-semibold rounded shadow-sm transition flex items-center justify-center gap-2"
          >
            <Truck className="w-4 h-4" />
            <span>Create dispatch request</span>
          </button>

          <button
            onClick={() => {
              openAllocationModal(selectedNeed);
            }}
            className="w-full py-2.5 px-4 bg-surface hover:bg-canvas border border-border text-ink text-xs font-semibold rounded transition flex items-center justify-center gap-2"
          >
            <Package className="w-4 h-4 text-copper" />
            <span>Reserve stock</span>
          </button>
        </div>
      </aside>
    </>
  );
};
