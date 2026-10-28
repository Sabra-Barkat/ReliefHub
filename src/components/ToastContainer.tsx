import React from 'react';
import { useApp } from '../context/AppContext';
import { CheckCircle, AlertTriangle, Info, X } from 'lucide-react';

export const ToastContainer: React.FC = () => {
  const { toasts, removeToast } = useApp();

  if (toasts.length === 0) return null;

  return (
    <div
      className="fixed bottom-16 md:bottom-6 right-4 sm:right-6 z-50 flex flex-col space-y-2.5 max-w-sm w-full pointer-events-none"
      aria-live="polite"
    >
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`pointer-events-auto p-3.5 rounded-lg border shadow-lg flex items-start gap-3 transition-all duration-300 animate-slide-in ${
            toast.type === 'success'
              ? 'bg-surface text-ink border-teal-border/70 shadow-teal/5'
              : toast.type === 'error'
              ? 'bg-surface text-ink border-critical-border/70 shadow-critical/5'
              : 'bg-surface text-ink border-border shadow-md'
          }`}
        >
          <div className="shrink-0 mt-0.5">
            {toast.type === 'success' && <CheckCircle className="w-4 h-4 text-teal" />}
            {toast.type === 'error' && <AlertTriangle className="w-4 h-4 text-critical" />}
            {toast.type === 'info' && <Info className="w-4 h-4 text-copper" />}
          </div>
          <div className="flex-1 min-w-0">
            <h5 className="text-xs font-bold text-ink">{toast.title}</h5>
            <p className="text-[11px] text-ink-light mt-0.5 leading-snug">{toast.message}</p>
          </div>
          <button
            onClick={() => removeToast(toast.id)}
            className="text-ink-muted hover:text-ink shrink-0 p-0.5 rounded"
            aria-label="Dismiss notification"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      ))}
    </div>
  );
};
