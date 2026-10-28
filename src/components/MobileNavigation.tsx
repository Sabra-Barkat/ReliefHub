import React from 'react';
import { NavLink } from 'react-router-dom';
import { Home, Tent, Warehouse, Truck, HeartHandshake, Users } from 'lucide-react';

const NAV_ITEMS = [
  { name: 'Overview', path: '/', icon: Home },
  { name: 'Camps', path: '/camps', icon: Tent },
  { name: 'Depot', path: '/warehouse', icon: Warehouse },
  { name: 'Dispatches', path: '/dispatches', icon: Truck },
  { name: 'Donations', path: '/donations', icon: HeartHandshake },
  { name: 'Volunteers', path: '/volunteers', icon: Users },
];

export const MobileNavigation: React.FC = () => {
  return (
    <>
      {/* Mobile Top Brand Bar */}
      <div className="md:hidden flex items-center justify-between px-4 py-3 bg-ink text-[#FFFCF5] border-b border-[#3D3547]">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-full bg-surface/10 border border-surface/20 flex items-center justify-center text-copper-light shrink-0">
            <svg
              className="w-4 h-4 text-[#FFFCF5]"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
            >
              <path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z" />
            </svg>
          </div>
          <div>
            <h1 className="text-base font-serif font-bold tracking-tight text-[#FFFCF5] leading-none">
              ReliefHub
            </h1>
            <p className="text-[10px] text-ink-faint tracking-wider uppercase leading-none mt-0.5">
              Sindh Operations
            </p>
          </div>
        </div>
      </div>

      {/* Accessible Mobile Bottom Navigation Bar */}
      <nav
        className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-surface/95 backdrop-blur-md border-t border-border flex items-center justify-around px-1 py-1 shadow-lg"
        aria-label="Mobile Navigation"
      >
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) =>
                `flex flex-col items-center justify-center min-w-[48px] min-h-[48px] px-1 py-1 rounded text-[10px] font-medium transition ${
                  isActive
                    ? 'text-copper font-bold'
                    : 'text-ink-muted hover:text-ink'
                }`
              }
            >
              <Icon className="w-5 h-5 mb-0.5" />
              <span className="truncate max-w-[54px]">{item.name}</span>
            </NavLink>
          );
        })}
      </nav>
    </>
  );
};
