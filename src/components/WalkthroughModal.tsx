import React from 'react';
import { useApp } from '../context/AppContext';
import { X, CheckCircle, ShieldAlert, Layers, ArrowRight, Award, Compass, Sparkles } from 'lucide-react';

export const WalkthroughModal: React.FC = () => {
  const { isWalkthroughOpen, setIsWalkthroughOpen, resetToDemoData } = useApp();

  if (!isWalkthroughOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink/60 backdrop-blur-sm animate-fade-in"
      role="dialog"
      aria-modal="true"
      aria-labelledby="walkthrough-modal-title"
    >
      <div className="bg-surface w-full max-w-2xl rounded-lg border border-border shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="p-6 border-b border-border bg-canvas/50 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-full bg-copper-light text-copper border border-copper-border">
              <Award className="w-5 h-5" />
            </div>
            <div>
              <h2 id="walkthrough-modal-title" className="text-xl font-serif font-bold text-ink">
                ReliefHub: Evaluator & Judge Walkthrough
              </h2>
              <p className="text-xs text-ink-muted">
                Humanitarian Operations Console · Sindh Flood Response Coordination
              </p>
            </div>
          </div>
          <button
            onClick={() => setIsWalkthroughOpen(false)}
            className="p-1.5 rounded text-ink-muted hover:text-ink hover:bg-canvas transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-6 text-xs text-ink-light">
          {/* Core Thesis Card */}
          <div className="p-4 rounded-md bg-canvas border border-border space-y-2">
            <span className="text-[11px] font-bold tracking-wider uppercase text-copper block">
              Core Humanitarian Logistics Thesis
            </span>
            <blockquote className="text-sm font-serif italic text-ink font-semibold border-l-2 border-copper pl-3 my-2">
              “A camp is not helped just because a delivery has been assigned.”
            </blockquote>
            <p className="leading-relaxed">
              Standard SaaS dashboards routinely count dispatched goods as delivered fulfilment, giving relief agencies false confidence while flood-affected families wait empty-handed. ReliefHub strictly enforces mathematical separation:
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-2">
              <div className="p-2 bg-surface rounded border border-teal-border/50">
                <strong className="text-teal block text-xs">Delivered (Physical)</strong>
                <span className="text-[11px] text-ink-muted">Supplies physically received at camp. Counts toward true fulfilment.</span>
              </div>
              <div className="p-2 bg-surface rounded border border-saffron-border/50">
                <strong className="text-saffron-hover block text-xs">Committed (In Transit)</strong>
                <span className="text-[11px] text-ink-muted">Supplies reserved in Pending or In Transit dispatches. Never counted as delivered.</span>
              </div>
              <div className="p-2 bg-surface rounded border border-border">
                <strong className="text-critical block text-xs">Unallocated (True Gap)</strong>
                <span className="text-[11px] text-ink-muted">Required quantity not yet received or committed. The life-critical metric.</span>
              </div>
            </div>
          </div>

          {/* Differentiator Highlights */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-ink">
              Signature Capabilities Demonstrated
            </h3>
            <div className="space-y-2.5">
              <div className="p-3 rounded bg-surface border border-border">
                <div className="flex items-center gap-2 font-semibold text-ink text-xs">
                  <CheckCircle className="w-4 h-4 text-teal" />
                  <span>1. Response Gap Strip</span>
                </div>
                <p className="text-[11px] text-ink-muted mt-1 ml-6 leading-relaxed">
                  Three-segment proportional visualization maintaining physical unit integrity across water (L), tents, food packs, and medical kits.
                </p>
              </div>

              <div className="p-3 rounded bg-surface border border-border">
                <div className="flex items-center gap-2 font-semibold text-ink text-xs">
                  <CheckCircle className="w-4 h-4 text-teal" />
                  <span>2. Allocation Preview & Double-Allocation Prevention</span>
                </div>
                <p className="text-[11px] text-ink-muted mt-1 ml-6 leading-relaxed">
                  Before confirming dispatches, coordinators inspect exact Before & After impacts on warehouse stock, committed quantities, and remaining gaps, with competing camp demand visibility.
                </p>
              </div>

              <div className="p-3 rounded bg-surface border border-border">
                <div className="flex items-center gap-2 font-semibold text-ink text-xs">
                  <CheckCircle className="w-4 h-4 text-teal" />
                  <span>3. Priority Action Queue with Explainable Advice</span>
                </div>
                <p className="text-[11px] text-ink-muted mt-1 ml-6 leading-relaxed">
                  Algorithms rank critical needs below 40% fulfilment and generate explainable next actions: “Dispatch from warehouse”, “Reserve stock”, or “Source with suppliers”.
                </p>
              </div>

              <div className="p-3 rounded bg-surface border border-border">
                <div className="flex items-center gap-2 font-semibold text-ink text-xs">
                  <CheckCircle className="w-4 h-4 text-teal" />
                  <span>4. Persistent Mock HTTP API with Real Validation</span>
                </div>
                <p className="text-[11px] text-ink-muted mt-1 ml-6 leading-relaxed">
                  Runs on an independent Express server with JSON file persistence. Page refreshes preserve state. Stock cancellation restorations and in-kind donation increases are verified at the HTTP boundary.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-5 border-t border-border bg-canvas/50 flex items-center justify-between">
          <button
            onClick={() => {
              resetToDemoData();
              setIsWalkthroughOpen(false);
            }}
            className="text-xs font-semibold text-copper hover:underline flex items-center gap-1"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Reset to Clean Demo State</span>
          </button>
          <button
            onClick={() => setIsWalkthroughOpen(false)}
            className="px-5 py-2 text-xs font-semibold text-white bg-copper hover:bg-copper-hover rounded shadow-sm transition"
          >
            Explore Operations Console
          </button>
        </div>
      </div>
    </div>
  );
};
