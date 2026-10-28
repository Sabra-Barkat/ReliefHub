import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  Home,
  Tent,
  Warehouse,
  Truck,
  HeartHandshake,
  Users,
  Compass,
} from 'lucide-react';

const NAV_ITEMS = [
  { name: 'Overview', path: '/', icon: Home },
  { name: 'Camps', path: '/camps', icon: Tent },
  { name: 'Warehouse', path: '/warehouse', icon: Warehouse },
  { name: 'Dispatches', path: '/dispatches', icon: Truck },
  { name: 'Donations', path: '/donations', icon: HeartHandshake },
  { name: 'Volunteers', path: '/volunteers', icon: Users },
];

export const Sidebar: React.FC = () => {
  return (
    <aside
      className="hidden md:flex flex-col w-64 bg-ink text-[#FFFCF5] shrink-0 min-h-screen border-r border-[#3D3547] select-none"
      aria-label="Primary Navigation"
    >
      {/* Brand Header */}
      <div className="p-6 pb-8 border-b border-[#3D3547]/80">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-surface/10 border border-surface/20 flex items-center justify-center text-copper-light shrink-0">
            {/* Elegant fluid drop logo */}
            <svg
              className="w-6 h-6 text-[#FFFCF5]"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z" />
            </svg>
          </div>
          <div>
            <h1 className="text-xl font-serif font-bold tracking-tight text-[#FFFCF5]">
              ReliefHub
            </h1>
            <p className="text-[11px] font-sans text-ink-faint tracking-wide uppercase">
              ReliefGrid Operations Console
            </p>
          </div>
        </div>
      </div>

      {/* Nav List */}
      <nav className="flex-1 px-4 py-6 space-y-1.5" aria-label="Main menu">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3.5 py-2.5 rounded-md text-sm font-medium transition duration-150 ${
                  isActive
                    ? 'bg-copper text-white shadow-sm'
                    : 'text-[#DCD4C7] hover:text-white hover:bg-surface/10'
                }`
              }
            >
              <Icon className="w-4 h-4 shrink-0" />
              <span>{item.name}</span>
            </NavLink>
          );
        })}
      </nav>

      {/* Footer Branding with Reed Sketch */}
      <div className="p-5 border-t border-[#3D3547]/80 space-y-3">
        {/* Subtle SVG Reed/Estuary Line Art */}
        <div className="opacity-40">
          <svg className="w-24 h-12 text-[#DCD4C7]" viewBox="0 0 100 50" fill="none" stroke="currentColor" strokeWidth="1.2">
            <path d="M10 48 Q20 20 25 8 Q30 25 35 48" />
            <path d="M25 48 Q40 12 45 4 Q50 22 55 48" />
            <path d="M48 48 Q60 25 65 14 Q70 30 75 48" />
            <path d="M68 48 Q82 30 90 20" />
            <line x1="5" y1="48" x2="95" y2="48" strokeWidth="1.5" />
          </svg>
        </div>

        <div>
          <span className="text-xs font-serif font-semibold text-[#FFFCF5] block tracking-wide">
            Sindh Flood Response
          </span>
          <span className="text-[10px] text-ink-faint tracking-wider uppercase block mt-0.5">
            People · Supplies · Dignity
          </span>
        </div>
      </div>
    </aside>
  );
};
