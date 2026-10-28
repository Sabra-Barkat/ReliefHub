import React from 'react';

interface ResponseGapStripProps {
  requiredQuantity: number;
  deliveredQuantity: number;
  committedQuantity: number;
  unallocatedQuantity: number;
  unit: string;
  size?: 'sm' | 'md' | 'lg';
  showLabels?: boolean;
  className?: string;
}

export const ResponseGapStrip: React.FC<ResponseGapStripProps> = ({
  requiredQuantity,
  deliveredQuantity,
  committedQuantity,
  unallocatedQuantity,
  unit,
  size = 'md',
  showLabels = true,
  className = '',
}) => {
  const req = Math.max(1, requiredQuantity);
  const del = Math.max(0, deliveredQuantity);
  const com = Math.max(0, committedQuantity);
  const unalloc = Math.max(0, unallocatedQuantity);

  const delPct = Math.min(100, Math.round((del / req) * 100));
  const comPct = Math.min(100 - delPct, Math.round((com / req) * 100));
  const unallocPct = Math.max(0, 100 - delPct - comPct);

  const barHeight = size === 'sm' ? 'h-2' : size === 'lg' ? 'h-3.5' : 'h-2.5';

  return (
    <div className={`w-full flex flex-col space-y-2 ${className}`}>
      {/* Strip bar */}
      <div
        className={`w-full ${barHeight} rounded-full overflow-hidden bg-canvas/80 flex border border-border/70`}
        role="progressbar"
        aria-label={`Fulfilment progress: ${delPct}% delivered, ${comPct}% committed, ${unallocPct}% unallocated`}
        aria-valuenow={delPct}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        {/* Delivered segment - Teal */}
        {delPct > 0 && (
          <div
            style={{ width: `${delPct}%` }}
            className="bg-teal transition-all duration-300 relative group"
            title={`Delivered: ${del.toLocaleString()} ${unit} (${delPct}%)`}
          />
        )}
        {/* Committed segment - Saffron */}
        {comPct > 0 && (
          <div
            style={{ width: `${comPct}%` }}
            className="bg-saffron transition-all duration-300 relative group"
            title={`Committed: ${com.toLocaleString()} ${unit} (${comPct}%)`}
          />
        )}
        {/* Unallocated segment - Neutral / subtle */}
        {unallocPct > 0 && (
          <div
            style={{ width: `${unallocPct}%` }}
            className="bg-border-subtle transition-all duration-300 relative group"
            title={`Unallocated: ${unalloc.toLocaleString()} ${unit} (${unallocPct}%)`}
          />
        )}
      </div>

      {/* Metric breakdown cards / indicators */}
      {showLabels && (
        <div className="grid grid-cols-3 gap-2 text-xs">
          {/* Delivered */}
          <div className="bg-surface/90 border border-teal-border/40 rounded-sm p-1.5 flex flex-col">
            <span className="text-[11px] font-medium text-teal flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-teal inline-block"></span>
              Delivered
            </span>
            <div className="flex items-baseline gap-1 mt-0.5">
              <span className="text-base font-bold text-ink tabular-nums">
                {del.toLocaleString()}
              </span>
              <span className="text-[10px] text-ink-muted">({delPct}%)</span>
            </div>
            <span className="text-[9px] text-ink-faint truncate">of {req.toLocaleString()} {unit}</span>
          </div>

          {/* Committed */}
          <div className="bg-surface/90 border border-saffron-border/40 rounded-sm p-1.5 flex flex-col">
            <span className="text-[11px] font-medium text-saffron-hover flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-saffron inline-block"></span>
              Committed
            </span>
            <div className="flex items-baseline gap-1 mt-0.5">
              <span className="text-base font-bold text-ink tabular-nums">
                {com.toLocaleString()}
              </span>
              <span className="text-[10px] text-ink-muted">({comPct}%)</span>
            </div>
            <span className="text-[9px] text-ink-faint truncate">in transit / pending</span>
          </div>

          {/* Unallocated */}
          <div className="bg-surface/90 border border-border/80 rounded-sm p-1.5 flex flex-col">
            <span className={`text-[11px] font-medium flex items-center gap-1 ${unallocPct > 50 ? 'text-critical' : 'text-ink-muted'}`}>
              <span className={`w-2 h-2 rounded-full inline-block ${unallocPct > 50 ? 'bg-critical' : 'bg-ink-faint'}`}></span>
              Unallocated
            </span>
            <div className="flex items-baseline gap-1 mt-0.5">
              <span className="text-base font-bold text-ink tabular-nums">
                {unalloc.toLocaleString()}
              </span>
              <span className="text-[10px] text-ink-muted">({unallocPct}%)</span>
            </div>
            <span className="text-[9px] text-ink-faint truncate">gap remaining</span>
          </div>
        </div>
      )}
    </div>
  );
};
