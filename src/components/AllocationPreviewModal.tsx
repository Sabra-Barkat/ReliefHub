import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { api } from '../services/api';
import { NeedWithDetails, CampNeed } from '../types';
import { AlertTriangle, CheckCircle, Package, ArrowRight, X, Info } from 'lucide-react';

export const AllocationPreviewModal: React.FC = () => {
  const { allocationModal, closeAllocationModal, refreshData, addToast, userRole } = useApp();
  const { isOpen, need } = allocationModal;

  const [quantity, setQuantity] = useState<number>(0);
  const [notes, setNotes] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [competingNeeds, setCompetingNeeds] = useState<NeedWithDetails[]>([]);
  const [isLoadingContext, setIsLoadingContext] = useState<boolean>(false);

  useEffect(() => {
    if (isOpen && need) {
      // Calculate suggested max allocation: min(available_stock, remaining_unallocated)
      const maxAlloc = Math.min(need.item?.stock || 0, need.unallocated || 0);
      setQuantity(allocationModal.initialQty ?? (maxAlloc > 0 ? maxAlloc : 1));
      setNotes('');
      setErrorMessage(null);

      // Fetch other camps requesting this same item as context
      setIsLoadingContext(true);
      api
        .getNeeds({ critical_only: false })
        .then((allNeeds) => {
          const competing = allNeeds.filter(
            (n) => n.inventory_item_id === need.inventory_item_id && n.camp_id !== need.camp_id && n.unallocated > 0
          );
          setCompetingNeeds(competing);
        })
        .catch(console.error)
        .finally(() => setIsLoadingContext(false));
    }
  }, [isOpen, need, allocationModal.initialQty]);

  if (!isOpen || !need) return null;

  const item = need.item;
  const currentStock = item?.stock || 0;
  const reorderLevel = item?.reorder_level || 0;
  const unit = item?.unit || 'units';

  // Validation
  const proposedQty = Number(quantity);
  const maxPossible = Math.min(currentStock, need.unallocated);
  const isInvalidQty = isNaN(proposedQty) || proposedQty <= 0;
  const exceedsStock = proposedQty > currentStock;
  const exceedsNeed = proposedQty > need.unallocated;
  const isValid = !isInvalidQty && !exceedsStock && !exceedsNeed;

  // Before & After calculations
  const afterStock = Math.max(0, currentStock - (isValid ? proposedQty : 0));
  const afterCommitted = need.reserved_quantity + (isValid ? proposedQty : 0);
  const afterUnallocated = Math.max(0, need.unallocated - (isValid ? proposedQty : 0));
  const willCrossReorder = isValid && afterStock <= reorderLevel && currentStock > reorderLevel;
  const isAlreadyBelowReorder = currentStock <= reorderLevel;

  const handleConfirmReservation = async () => {
    if (!isValid) return;

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const result = await api.createDispatch({
        camp_id: need.camp_id,
        need_id: need.id,
        quantity: proposedQty,
        notes: notes.trim() || undefined,
        dispatched_by: `${userRole} (Console Allocation)`,
      });

      addToast({
        type: 'success',
        title: 'Stock Reservation Confirmed',
        message: `Reserved ${proposedQty.toLocaleString()} ${unit} of "${item?.name}" for ${need.camp?.name}. Dispatch queued as Pending.`,
      });

      await refreshData();
      closeAllocationModal();
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to confirm stock reservation.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink/50 backdrop-blur-sm animate-fade-in"
      role="dialog"
      aria-modal="true"
      aria-labelledby="allocation-modal-title"
      onKeyDown={(e) => {
        if (e.key === 'Escape' && !isSubmitting) closeAllocationModal();
      }}
    >
      <div className="bg-surface w-full max-w-xl rounded-lg border border-border shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-border bg-canvas/40 flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-bold tracking-wider uppercase text-copper px-2 py-0.5 rounded bg-copper-light border border-copper-border">
                Allocation Preview
              </span>
              <span className="text-xs text-ink-muted">· Stock Reservation Engine</span>
            </div>
            <h2 id="allocation-modal-title" className="text-xl font-serif font-bold text-ink mt-1">
              {need.camp?.name}
            </h2>
            <p className="text-xs text-ink-muted">
              {need.camp?.district} District · {need.camp?.current_families.toLocaleString()} families sheltered
            </p>
          </div>
          <button
            onClick={closeAllocationModal}
            className="p-1.5 rounded text-ink-muted hover:text-ink hover:bg-canvas transition"
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-6">
          {/* Target Need & Quantity Input */}
          <div className="bg-canvas/50 p-4 rounded-md border border-border flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <span className="text-xs text-ink-muted block font-medium">Target Resource</span>
              <span className="text-base font-semibold text-ink flex items-center gap-2 mt-0.5">
                <Package className="w-4 h-4 text-copper" />
                {item?.name}
              </span>
              <span className="text-xs text-ink-muted">
                Category: {item?.category} · Need Priority: {need.priority}
              </span>
            </div>

            <div className="flex flex-col sm:items-end">
              <label htmlFor="proposed-qty" className="text-xs font-semibold text-ink mb-1">
                Proposed Reservation ({unit})
              </label>
              <div className="flex items-center gap-2">
                <input
                  id="proposed-qty"
                  type="number"
                  min={1}
                  max={maxPossible}
                  value={quantity}
                  onChange={(e) => setQuantity(Number(e.target.value))}
                  className="w-28 px-3 py-1.5 bg-surface border border-border rounded text-sm text-ink font-semibold text-right tabular-nums focus:border-copper focus:ring-1 focus:ring-copper"
                />
                <button
                  type="button"
                  onClick={() => setQuantity(maxPossible)}
                  className="text-[11px] font-medium text-copper hover:text-copper-hover bg-copper-light px-2 py-1.5 rounded border border-copper-border"
                >
                  Max ({maxPossible})
                </button>
              </div>
            </div>
          </div>

          {/* Validation Error Banner */}
          {exceedsStock && (
            <div className="p-3 rounded bg-critical-light border border-critical-border text-critical text-xs flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>
                Quantity exceeds current warehouse stock ({currentStock.toLocaleString()} {unit}). Reduce proposed reservation.
              </span>
            </div>
          )}

          {exceedsNeed && (
            <div className="p-3 rounded bg-critical-light border border-critical-border text-critical text-xs flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>
                Quantity exceeds remaining unallocated need ({need.unallocated.toLocaleString()} {unit}).
              </span>
            </div>
          )}

          {/* Core Before & After Matrix */}
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-ink-muted mb-2">
              Allocation Impact Matrix
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              {/* Warehouse Stock */}
              <div className="bg-surface p-3 rounded border border-border flex flex-col">
                <span className="text-[11px] text-ink-muted font-medium">Warehouse Stock</span>
                <div className="flex items-center gap-1.5 mt-1 font-semibold text-sm tabular-nums">
                  <span className="text-ink">{currentStock.toLocaleString()}</span>
                  <ArrowRight className="w-3.5 h-3.5 text-ink-muted shrink-0" />
                  <span className={`${afterStock <= reorderLevel ? 'text-critical' : 'text-teal'}`}>
                    {afterStock.toLocaleString()}
                  </span>
                </div>
                <span className="text-[10px] text-ink-faint mt-1">Available in depot</span>
              </div>

              {/* Committed to this need */}
              <div className="bg-surface p-3 rounded border border-border flex flex-col">
                <span className="text-[11px] text-ink-muted font-medium">Committed Need</span>
                <div className="flex items-center gap-1.5 mt-1 font-semibold text-sm tabular-nums">
                  <span className="text-ink">{need.reserved_quantity.toLocaleString()}</span>
                  <ArrowRight className="w-3.5 h-3.5 text-ink-muted shrink-0" />
                  <span className="text-saffron-hover">{afterCommitted.toLocaleString()}</span>
                </div>
                <span className="text-[10px] text-ink-faint mt-1">In transit / reserved</span>
              </div>

              {/* Unallocated Need */}
              <div className="bg-surface p-3 rounded border border-border flex flex-col">
                <span className="text-[11px] text-ink-muted font-medium">Unallocated Need</span>
                <div className="flex items-center gap-1.5 mt-1 font-semibold text-sm tabular-nums">
                  <span className="text-ink">{need.unallocated.toLocaleString()}</span>
                  <ArrowRight className="w-3.5 h-3.5 text-ink-muted shrink-0" />
                  <span className="text-copper">{afterUnallocated.toLocaleString()}</span>
                </div>
                <span className="text-[10px] text-ink-faint mt-1">Unmet camp demand</span>
              </div>

              {/* Delivered Fulfilment */}
              <div className="bg-surface p-3 rounded border border-border flex flex-col">
                <span className="text-[11px] text-ink-muted font-medium">Delivered Status</span>
                <div className="mt-1 font-semibold text-sm text-teal tabular-nums">
                  {need.fulfilled_quantity.toLocaleString()} {unit}
                </div>
                <span className="text-[10px] text-ink-muted mt-1 font-medium bg-canvas px-1.5 py-0.5 rounded w-fit">
                  Unchanged
                </span>
              </div>
            </div>
          </div>

          {/* Advisory Reorder Level Warning */}
          {(willCrossReorder || isAlreadyBelowReorder) && (
            <div className="p-3 rounded-md bg-saffron-light border border-saffron-border text-ink text-xs flex items-start gap-2.5">
              <Info className="w-4 h-4 text-saffron shrink-0 mt-0.5" />
              <div>
                <span className="font-semibold text-ink">Advisory Stock Notice:</span>
                <p className="text-ink-light mt-0.5">
                  This reservation leaves {afterStock.toLocaleString()} {unit} in warehouse stock, which is at or below the reorder threshold ({reorderLevel.toLocaleString()} {unit}).
                  This does not block allocation, but a restocking request should be initiated.
                </p>
              </div>
            </div>
          )}

          {/* Contextual Information: Competing Demands from other camps */}
          <div className="bg-canvas/30 p-3.5 rounded border border-border">
            <span className="text-xs font-semibold text-ink flex items-center justify-between">
              <span>Other Camps Requesting {item?.name}</span>
              <span className="text-[11px] text-ink-muted font-normal">
                {competingNeeds.length} other camp{competingNeeds.length === 1 ? '' : 's'}
              </span>
            </span>

            {isLoadingContext ? (
              <span className="text-xs text-ink-muted mt-2 block">Loading contextual camp demands...</span>
            ) : competingNeeds.length > 0 ? (
              <div className="mt-2 space-y-1.5 max-h-28 overflow-y-auto">
                {competingNeeds.map((cn) => (
                  <div key={cn.id} className="flex items-center justify-between text-xs py-1 px-2 rounded bg-surface/80 border border-border/60">
                    <span className="font-medium text-ink">
                      {cn.camp?.name} <span className="text-ink-muted text-[10px]">({cn.camp?.district})</span>
                    </span>
                    <span className="text-ink-muted tabular-nums">
                      Gap: <strong className="text-critical">{cn.unallocated.toLocaleString()}</strong> {unit} ({cn.priority} Priority)
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <span className="text-xs text-ink-muted mt-1.5 block">
                No other camps have open unallocated gaps for this item.
              </span>
            )}
          </div>

          {/* Dispatch Notes */}
          <div>
            <label htmlFor="dispatch-notes" className="text-xs font-semibold text-ink block mb-1">
              Dispatch Instructions / Route Notes (Optional)
            </label>
            <input
              id="dispatch-notes"
              type="text"
              placeholder="e.g. Route via Bypass N-5 convoy, assign to truck #SK-81"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full px-3 py-2 bg-surface border border-border rounded text-xs text-ink focus:border-copper focus:ring-1 focus:ring-copper"
            />
          </div>

          {/* Error Message */}
          {errorMessage && (
            <div className="p-3 rounded bg-critical-light border border-critical-border text-critical text-xs font-medium">
              {errorMessage}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 border-t border-border bg-canvas/40 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={closeAllocationModal}
            disabled={isSubmitting}
            className="px-4 py-2 text-xs font-medium text-ink-light hover:text-ink border border-border rounded bg-surface hover:bg-canvas transition"
          >
            Review quantity
          </button>
          <button
            type="button"
            onClick={handleConfirmReservation}
            disabled={!isValid || isSubmitting}
            className="px-5 py-2 text-xs font-semibold text-white bg-copper hover:bg-copper-hover disabled:opacity-50 disabled:cursor-not-allowed rounded shadow-sm transition flex items-center gap-1.5"
          >
            {isSubmitting ? (
              <>
                <span className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin"></span>
                <span>Confirming reservation...</span>
              </>
            ) : (
              <>
                <CheckCircle className="w-4 h-4" />
                <span>Confirm reservation</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
