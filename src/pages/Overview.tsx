import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { api } from '../services/api';
import { NeedWithDetails, SystemStats } from '../types';
import { ContextualAIPill } from '../components/ai/ContextualAIPill';
import {
  Tent,
  Users,
  PieChart as PieIcon,
  AlertTriangle,
  HeartHandshake,
  ArrowRight,
  HelpCircle,
  Truck,
  Sparkles,
  Info,
} from 'lucide-react';
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
} from 'recharts';

export const Overview: React.FC = () => {
  const navigate = useNavigate();
  const {
    selectedDistrict,
    stats,
    openDrawerWithNeed,
    openAllocationModal,
    isRefreshing,
  } = useApp();

  const [criticalNeeds, setCriticalNeeds] = useState<NeedWithDetails[]>([]);
  const [isLoadingQueue, setIsLoadingQueue] = useState<boolean>(true);
  const [showFormulaTooltip, setShowFormulaTooltip] = useState<boolean>(false);

  useEffect(() => {
    setIsLoadingQueue(true);
    api
      .getNeeds({ critical_only: true, district: selectedDistrict })
      .then((data) => {
        setCriticalNeeds(data);
      })
      .catch(console.error)
      .finally(() => setIsLoadingQueue(false));
  }, [selectedDistrict, isRefreshing]);

  // Donut chart colors for dispatches
  const DISPATCH_COLORS = {
    Delivered: '#276660', // Teal
    'In Transit': '#D5A441', // Saffron
    Pending: '#786E80', // Slate ink
    Cancelled: '#A73752', // Critical
  };

  const dispatchData = stats
    ? [
        { name: 'Completed', value: stats.dispatch_summary.delivered, color: DISPATCH_COLORS.Delivered },
        { name: 'In Transit', value: stats.dispatch_summary.in_transit, color: DISPATCH_COLORS['In Transit'] },
        { name: 'Pending', value: stats.dispatch_summary.pending, color: DISPATCH_COLORS.Pending },
      ].filter((d) => d.value > 0)
    : [];

  const totalDispatches = stats?.dispatch_summary.total || 0;

  return (
    <div className="space-y-6">
      {/* Editorial Header with subtle Estuary gradient banner */}
      <div className="relative overflow-hidden rounded-lg bg-gradient-to-r from-[#FAF6EF] via-[#F3EFE6] to-[#EAE2D2] border border-border/80 p-6 sm:p-8">
        <div className="relative z-10 max-w-2xl">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-copper mb-1">
            <span>Sindh Relief Grid</span>
            <span>·</span>
            <span>{selectedDistrict === 'all' ? 'All Districts' : `${selectedDistrict} District`}</span>
          </div>
          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-serif font-bold text-ink tracking-tight">
            Response overview
          </h1>
          <p className="text-sm text-ink-light mt-1.5 font-normal leading-relaxed">
            See what has arrived, what is committed, and where gaps remain.
          </p>
        </div>

        {/* Soft landscape line illustration on the background */}
        <div className="absolute right-0 bottom-0 pointer-events-none opacity-20 sm:opacity-30">
          <svg width="340" height="120" viewBox="0 0 340 120" fill="none">
            <path
              d="M0 110 Q80 80 160 95 T340 90 L340 120 L0 120 Z"
              fill="#A6533D"
              opacity="0.3"
            />
            <path
              d="M30 110 Q120 60 210 75 T340 70 L340 120 L30 120 Z"
              fill="#276660"
              opacity="0.2"
            />
            <circle cx="270" cy="40" r="24" fill="#D5A441" opacity="0.3" />
          </svg>
        </div>
      </div>

      {/* KPI Band (5 Compact Cards) */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-4">
        {/* Active camps */}
        <div className="bg-surface p-4 rounded-lg border border-border shadow-card flex flex-col justify-between">
          <div className="flex items-center justify-between text-ink-muted">
            <span className="text-xs font-medium">Active camps</span>
            <Tent className="w-4 h-4 text-copper" />
          </div>
          <div className="mt-2">
            <span className="text-2xl sm:text-3xl font-bold font-serif text-ink tabular-nums">
              {stats?.active_camps ?? '—'}
            </span>
            <p className="text-[11px] text-ink-muted mt-0.5">
              of {stats?.total_camps ?? '—'} total
            </p>
          </div>
        </div>

        {/* Families sheltered */}
        <div className="bg-surface p-4 rounded-lg border border-border shadow-card flex flex-col justify-between">
          <div className="flex items-center justify-between text-ink-muted">
            <span className="text-xs font-medium">Families sheltered</span>
            <Users className="w-4 h-4 text-teal" />
          </div>
          <div className="mt-2">
            <span className="text-2xl sm:text-3xl font-bold font-serif text-ink tabular-nums">
              {stats?.families_sheltered.toLocaleString() ?? '—'}
            </span>
            <p className="text-[11px] text-ink-muted mt-0.5">
              of {stats?.total_capacity.toLocaleString() ?? '—'} capacity
            </p>
          </div>
        </div>

        {/* Avg. need fulfilment */}
        <div className="bg-surface p-4 rounded-lg border border-border shadow-card flex flex-col justify-between relative group">
          <div className="flex items-center justify-between text-ink-muted">
            <div className="flex items-center gap-1">
              <span className="text-xs font-medium">Avg. need fulfilment</span>
              <button
                type="button"
                onClick={() => setShowFormulaTooltip(!showFormulaTooltip)}
                className="text-ink-muted hover:text-ink focus:outline-none"
                aria-label="How fulfilment is calculated"
              >
                <HelpCircle className="w-3.5 h-3.5" />
              </button>
            </div>
            <PieIcon className="w-4 h-4 text-teal" />
          </div>

          {/* Accessible Calculation Tooltip */}
          {showFormulaTooltip && (
            <div className="absolute top-10 left-2 right-2 z-20 p-2.5 bg-ink text-surface text-[10px] rounded shadow-xl border border-ink-light">
              <span className="font-bold block mb-1">Mathematical Integrity:</span>
              Calculated as the unweighted mean of individual camp need fulfilment percentages:
              <code className="block bg-ink-light/40 px-1 py-0.5 rounded mt-1 font-mono text-[9px]">
                avg = sum(fulfilled_qty / req_qty) / N
              </code>
              Committed supplies in transit do not count toward this delivered figure.
            </div>
          )}

          <div className="mt-2">
            <span className="text-2xl sm:text-3xl font-bold font-serif text-ink tabular-nums">
              {stats ? `${stats.avg_need_fulfilment}%` : '—'}
            </span>
            <p className="text-[11px] text-ink-muted mt-0.5">
              across all tracked needs
            </p>
          </div>
        </div>

        {/* Low-stock items */}
        <div
          onClick={() => navigate('/warehouse?low_stock=true')}
          className="bg-surface p-4 rounded-lg border border-border shadow-card flex flex-col justify-between cursor-pointer hover:border-critical/60 transition"
          role="button"
          tabIndex={0}
          aria-label="View low stock items in warehouse"
        >
          <div className="flex items-center justify-between text-ink-muted">
            <span className="text-xs font-medium">Low-stock items</span>
            <AlertTriangle className="w-4 h-4 text-critical" />
          </div>
          <div className="mt-2">
            <span className="text-2xl sm:text-3xl font-bold font-serif text-critical tabular-nums">
              {stats?.low_stock_items ?? '—'}
            </span>
            <p className="text-[11px] text-ink-muted mt-0.5">
              across {stats?.low_stock_categories ?? '—'} categories
            </p>
          </div>
        </div>

        {/* Volunteers deployed */}
        <div
          onClick={() => navigate('/volunteers')}
          className="bg-surface p-4 rounded-lg border border-border shadow-card flex flex-col justify-between col-span-2 lg:col-span-1 cursor-pointer hover:border-teal/60 transition"
          role="button"
          tabIndex={0}
          aria-label="View volunteers"
        >
          <div className="flex items-center justify-between text-ink-muted">
            <span className="text-xs font-medium">Volunteers deployed</span>
            <HeartHandshake className="w-4 h-4 text-teal" />
          </div>
          <div className="mt-2">
            <span className="text-2xl sm:text-3xl font-bold font-serif text-ink tabular-nums">
              {stats?.volunteers_deployed ?? '—'}
            </span>
            <p className="text-[11px] text-ink-muted mt-0.5">
              of {stats?.total_volunteers ?? '—'} registered
            </p>
          </div>
        </div>
      </div>

      {/* Signature Centerpiece: Priority Action Queue */}
      <section
        className="bg-surface rounded-lg border border-border shadow-card overflow-hidden"
        aria-labelledby="priority-queue-title"
      >
        <div className="p-4 sm:p-5 border-b border-border bg-canvas/30 flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded bg-critical-light text-critical border border-critical-border">
              <AlertTriangle className="w-4 h-4" />
            </div>
            <div>
              <h2 id="priority-queue-title" className="text-base font-serif font-bold text-ink">
                Priority action queue
              </h2>
              <p className="text-xs text-ink-muted">
                High-priority needs with delivered fulfilment below 40%, sorted by highest vulnerability.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap">
            <ContextualAIPill
              prompt="Summarize the high-priority needs currently below 40% delivered fulfilment."
              label="Explain Gaps"
              agentType="needs_analysis"
            />
            <ContextualAIPill
              prompt="What supplies can we allocate from available warehouse stock right now?"
              label="Plan Allocations"
              agentType="supply_planning"
            />
            <button
              onClick={() => navigate('/camps')}
              className="text-xs font-semibold text-copper hover:text-copper-hover flex items-center gap-1 transition"
            >
              <span>View all camps</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Table / Records View */}
        <div className="overflow-x-auto">
          {isLoadingQueue ? (
            <div className="p-8 text-center text-xs text-ink-muted">
              <span className="w-5 h-5 border-2 border-copper/30 border-t-copper rounded-full animate-spin inline-block mb-2"></span>
              <p>Analyzing field needs and stock levels...</p>
            </div>
          ) : criticalNeeds.length === 0 ? (
            <div className="p-8 text-center text-xs text-ink-muted">
              <p className="font-semibold text-ink">No critical gaps below 40% fulfilment found.</p>
              <p className="mt-1">All high-priority needs currently have acceptable delivery pipelines.</p>
            </div>
          ) : (
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-border bg-canvas/40 text-[11px] font-semibold text-ink-muted uppercase tracking-wider">
                  <th className="py-3 px-4">Camp / District</th>
                  <th className="py-3 px-4">Need / Unit</th>
                  <th className="py-3 px-3">Delivered</th>
                  <th className="py-3 px-3">Committed</th>
                  <th className="py-3 px-3">Unallocated</th>
                  <th className="py-3 px-4 text-right">Suggested Next Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {criticalNeeds.map((need) => {
                  const camp = need.camp;
                  const item = need.item;

                  return (
                    <tr
                      key={need.id}
                      onClick={() => openDrawerWithNeed(need)}
                      className="hover:bg-canvas/50 transition cursor-pointer group"
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') openDrawerWithNeed(need);
                      }}
                      role="button"
                      aria-label={`Inspect ${camp?.name} need for ${item?.name}`}
                    >
                      {/* Camp / District */}
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-critical shrink-0"></span>
                          <div>
                            <span className="font-bold text-ink group-hover:text-copper transition block">
                              {camp?.name}
                            </span>
                            <span className="text-[11px] text-ink-muted">{camp?.district}</span>
                          </div>
                          <span className="text-[10px] font-semibold text-critical bg-critical-light px-1.5 py-0.2 rounded border border-critical-border ml-1">
                            High
                          </span>
                        </div>
                      </td>

                      {/* Need / Unit */}
                      <td className="py-3 px-4">
                        <span className="font-semibold text-ink block">{item?.name}</span>
                        <span className="text-[11px] text-ink-muted">
                          {need.required_quantity.toLocaleString()} {item?.unit}
                        </span>
                      </td>

                      {/* Delivered */}
                      <td className="py-3 px-3">
                        <div className="w-24">
                          <div className="flex items-baseline gap-1">
                            <span className="font-bold text-teal tabular-nums">
                              {need.fulfilled_quantity.toLocaleString()}
                            </span>
                            <span className="text-[10px] text-ink-muted">({need.delivered_pct}%)</span>
                          </div>
                          <div className="w-full h-1.5 bg-canvas rounded-full overflow-hidden mt-1 border border-border/50">
                            <div
                              style={{ width: `${need.delivered_pct}%` }}
                              className="h-full bg-teal"
                            />
                          </div>
                        </div>
                      </td>

                      {/* Committed */}
                      <td className="py-3 px-3">
                        <div className="w-24">
                          <div className="flex items-baseline gap-1">
                            <span className="font-bold text-saffron-hover tabular-nums">
                              {need.reserved_quantity.toLocaleString()}
                            </span>
                            <span className="text-[10px] text-ink-muted">({need.committed_pct}%)</span>
                          </div>
                          <div className="w-full h-1.5 bg-canvas rounded-full overflow-hidden mt-1 border border-border/50">
                            <div
                              style={{ width: `${need.committed_pct}%` }}
                              className="h-full bg-saffron"
                            />
                          </div>
                        </div>
                      </td>

                      {/* Unallocated */}
                      <td className="py-3 px-3">
                        <div className="w-24">
                          <div className="flex items-baseline gap-1">
                            <span className="font-bold text-ink tabular-nums">
                              {need.unallocated.toLocaleString()}
                            </span>
                            <span className="text-[10px] text-ink-muted">({need.unallocated_pct}%)</span>
                          </div>
                          <div className="w-full h-1.5 bg-canvas rounded-full overflow-hidden mt-1 border border-border/50">
                            <div
                              style={{ width: `${need.unallocated_pct}%` }}
                              className="h-full bg-ink-faint"
                            />
                          </div>
                        </div>
                      </td>

                      {/* Action Pill */}
                      <td className="py-3 px-4 text-right" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={() => {
                            if (need.action_type === 'allocate' || need.action_type === 'gap') {
                              openAllocationModal(need);
                            } else {
                              openDrawerWithNeed(need);
                            }
                          }}
                          className={`text-[11px] font-semibold px-3 py-1.5 rounded-full border transition inline-flex items-center gap-1.5 shadow-sm ${
                            need.action_type === 'allocate'
                              ? 'bg-copper-light text-copper border-copper-border hover:bg-copper hover:text-white'
                              : need.action_type === 'gap'
                              ? 'bg-saffron-light text-saffron-hover border-saffron-border hover:bg-saffron hover:text-ink'
                              : 'bg-surface text-ink-muted border-border hover:border-ink'
                          }`}
                        >
                          <span>{need.suggested_action}</span>
                          <ArrowRight className="w-3 h-3" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </section>

      {/* Analysis Row: Category Fulfilment & Dispatch Summary */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Category Fulfilment (Horizontal stacked bars) */}
        <section
          className="lg:col-span-7 bg-surface rounded-lg border border-border shadow-card p-5 flex flex-col justify-between"
          aria-labelledby="category-fulfilment-title"
        >
          <div>
            <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
              <div>
                <h3 id="category-fulfilment-title" className="text-sm font-serif font-bold text-ink">
                  Required category fulfilment
                </h3>
                <p className="text-xs text-ink-muted">
                  Fulfilment percentages averaged across resource categories.
                </p>
              </div>

              {/* Legend */}
              <div className="flex items-center gap-3 text-[11px]">
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-teal inline-block"></span>
                  <span className="text-ink-muted">Delivered</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-saffron inline-block"></span>
                  <span className="text-ink-muted">Committed</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-border-dark inline-block"></span>
                  <span className="text-ink-muted">Unallocated</span>
                </div>
              </div>
            </div>

            {/* Category Stacked Progress Rows */}
            <div className="space-y-3.5 mt-2">
              {stats?.category_fulfilment.map((cat) => (
                <div key={cat.category} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-ink">{cat.category}</span>
                    <span className="text-ink font-bold tabular-nums">
                      {cat.delivered_pct}%
                    </span>
                  </div>
                  <div className="w-full h-3 rounded bg-canvas flex overflow-hidden border border-border/80">
                    {cat.delivered_pct > 0 && (
                      <div
                        style={{ width: `${cat.delivered_pct}%` }}
                        className="bg-teal transition-all duration-300"
                        title={`${cat.category} Delivered: ${cat.delivered_pct}%`}
                      />
                    )}
                    {cat.committed_pct > 0 && (
                      <div
                        style={{ width: `${cat.committed_pct}%` }}
                        className="bg-saffron transition-all duration-300"
                        title={`${cat.category} Committed: ${cat.committed_pct}%`}
                      />
                    )}
                    {cat.unallocated_pct > 0 && (
                      <div
                        style={{ width: `${cat.unallocated_pct}%` }}
                        className="bg-border-subtle transition-all duration-300"
                        title={`${cat.category} Unallocated: ${cat.unallocated_pct}%`}
                      />
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Dispatch Status Summary */}
        <section
          className="lg:col-span-5 bg-surface rounded-lg border border-border shadow-card p-5 flex flex-col justify-between"
          aria-labelledby="dispatch-summary-title"
        >
          <div>
            <h3 id="dispatch-summary-title" className="text-sm font-serif font-bold text-ink">
              Dispatch status summary
            </h3>
            <p className="text-xs text-ink-muted mb-3">
              Distribution of convoys currently active in the relief grid.
            </p>

            {/* Donut Chart & Legend */}
            <div className="flex items-center justify-between gap-4">
              {/* Donut Chart with Total in center */}
              <div className="relative w-36 h-36 shrink-0">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={dispatchData}
                      dataKey="value"
                      innerRadius={42}
                      outerRadius={58}
                      paddingAngle={3}
                      stroke="none"
                    >
                      {dispatchData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
                {/* Center text */}
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  <span className="text-xl font-bold font-serif text-ink tabular-nums">
                    {totalDispatches}
                  </span>
                  <span className="text-[10px] text-ink-muted uppercase tracking-wider">
                    Total
                  </span>
                </div>
              </div>

              {/* Status List breakdown */}
              <div className="flex-1 space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-teal"></span>
                    <span className="text-ink font-medium">Completed</span>
                  </div>
                  <div className="text-right">
                    <span className="font-bold text-ink tabular-nums">
                      {stats?.dispatch_summary.delivered || 0}
                    </span>
                    <span className="text-[10px] text-ink-muted ml-1">
                      (
                      {totalDispatches > 0
                        ? Math.round(((stats?.dispatch_summary.delivered || 0) / totalDispatches) * 100)
                        : 0}
                      %)
                    </span>
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-saffron"></span>
                    <span className="text-ink font-medium">In Transit</span>
                  </div>
                  <div className="text-right">
                    <span className="font-bold text-ink tabular-nums">
                      {stats?.dispatch_summary.in_transit || 0}
                    </span>
                    <span className="text-[10px] text-ink-muted ml-1">
                      (
                      {totalDispatches > 0
                        ? Math.round(((stats?.dispatch_summary.in_transit || 0) / totalDispatches) * 100)
                        : 0}
                      %)
                    </span>
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-[#786E80]"></span>
                    <span className="text-ink font-medium">Pending</span>
                  </div>
                  <div className="text-right">
                    <span className="font-bold text-ink tabular-nums">
                      {stats?.dispatch_summary.pending || 0}
                    </span>
                    <span className="text-[10px] text-ink-muted ml-1">
                      (
                      {totalDispatches > 0
                        ? Math.round(((stats?.dispatch_summary.pending || 0) / totalDispatches) * 100)
                        : 0}
                      %)
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Next dispatch window card matching reference screenshot */}
          <div className="mt-4 p-3 rounded-md bg-canvas/70 border border-border flex items-center gap-3 text-xs">
            <div className="p-2 rounded bg-surface border border-border shrink-0 text-copper">
              <Truck className="w-4 h-4" />
            </div>
            <div>
              <span className="text-[10px] font-bold text-ink-muted uppercase tracking-wider block">
                Next Dispatch Window
              </span>
              <span className="font-bold text-ink block mt-0.5">
                Today 4:00 PM – 8:00 PM
              </span>
              <span className="text-[11px] text-ink-muted">
                {stats?.active_camps} camps · 3 supply categories queued
              </span>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
};
