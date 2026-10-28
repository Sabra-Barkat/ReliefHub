import React from 'react';
import { useApp } from '../context/AppContext';
import { MapPin, User, RefreshCw, Activity, Sparkles, RotateCcw } from 'lucide-react';
import { UserRole } from '../types';

export const Header: React.FC = () => {
  const {
    selectedDistrict,
    setSelectedDistrict,
    userRole,
    setUserRole,
    lastRefreshed,
    isRefreshing,
    refreshData,
    apiHealth,
    setIsWalkthroughOpen,
    resetToDemoData,
  } = useApp();

  const districts = ['all', 'Sukkur', 'Khairpur', 'Ghotki', 'SBA', 'Dadu'];

  const formattedTime = lastRefreshed.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });

  return (
    <header className="bg-canvas border-b border-border/80 px-4 sm:px-6 py-3 shrink-0 flex flex-wrap items-center justify-between gap-3">
      {/* Left controls: District & Role */}
      <div className="flex flex-wrap items-center gap-2.5 sm:gap-4">
        {/* District Selector */}
        <div className="flex items-center gap-1.5 bg-surface border border-border rounded-md px-2.5 py-1 text-xs shadow-sm">
          <MapPin className="w-3.5 h-3.5 text-copper shrink-0" />
          <span className="text-ink-muted text-[11px] font-medium hidden sm:inline">District:</span>
          <select
            id="district-filter"
            value={selectedDistrict}
            onChange={(e) => setSelectedDistrict(e.target.value)}
            className="bg-transparent font-semibold text-ink focus:outline-none cursor-pointer pr-1"
            aria-label="Filter by Sindh District"
          >
            <option value="all">All Districts</option>
            {districts
              .filter((d) => d !== 'all')
              .map((d) => (
                <option key={d} value={d}>
                  {d} {d === 'SBA' ? '(Shaheed Benazirabad)' : ''}
                </option>
              ))}
          </select>
        </div>

        {/* User Role Switcher */}
        <div className="flex items-center gap-1.5 bg-surface border border-border rounded-md px-2.5 py-1 text-xs shadow-sm">
          <User className="w-3.5 h-3.5 text-teal shrink-0" />
          <span className="text-ink-muted text-[11px] font-medium hidden sm:inline">Role:</span>
          <select
            id="role-switcher"
            value={userRole}
            onChange={(e) => setUserRole(e.target.value as UserRole)}
            className="bg-transparent font-semibold text-ink focus:outline-none cursor-pointer pr-1"
            aria-label="Switch User Role"
          >
            <option value="Operations Coordinator">Operations Coordinator</option>
            <option value="Field Volunteer">Field Volunteer</option>
          </select>
        </div>

        {/* API Health Pill */}
        <div
          className={`hidden xl:flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
            apiHealth === 'healthy'
              ? 'bg-teal-light text-teal border-teal-border/60'
              : 'bg-critical-light text-critical border-critical-border'
          }`}
          title="Backend mock API status (persistent file-backed storage)"
        >
          <Activity className="w-3 h-3 animate-pulse" />
          <span>{apiHealth === 'healthy' ? 'API Online' : 'API Reconnecting'}</span>
        </div>
      </div>

      {/* Right controls: Last refreshed & actions */}
      <div className="flex items-center gap-2 sm:gap-3 text-xs">
        {/* Timestamp */}
        <div className="text-right hidden md:block">
          <span className="text-[10px] text-ink-muted block leading-none">Last refreshed</span>
          <span className="text-xs font-medium text-ink tabular-nums leading-tight">{formattedTime}</span>
        </div>

        {/* Refresh Button */}
        <button
          onClick={() => refreshData()}
          disabled={isRefreshing}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-surface hover:bg-canvas border border-border rounded-md text-xs font-semibold text-ink transition shadow-sm disabled:opacity-60"
          aria-label="Refresh operational data"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-copper' : 'text-ink-muted'}`} />
          <span>Refresh</span>
        </button>

        {/* Guided Walkthrough button for judging */}
        <button
          onClick={() => setIsWalkthroughOpen(true)}
          className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 bg-copper-light hover:bg-copper-light/80 border border-copper-border rounded-md text-xs font-bold text-copper transition"
          title="View Judge Walkthrough & Product Thesis"
        >
          <Sparkles className="w-3.5 h-3.5" />
          <span>Demo Guide</span>
        </button>

        {/* Reset Demo Data */}
        <button
          onClick={() => {
            if (window.confirm('Reset database to clean verified Sindh flood seed dataset?')) {
              resetToDemoData();
            }
          }}
          className="p-1.5 text-ink-muted hover:text-ink hover:bg-canvas rounded border border-border/60 transition"
          title="Reset Seed Dataset"
          aria-label="Reset seed data"
        >
          <RotateCcw className="w-3.5 h-3.5" />
        </button>
      </div>
    </header>
  );
};
