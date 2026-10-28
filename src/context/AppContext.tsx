import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { UserRole, NeedWithDetails, SystemStats } from '../types';
import { api, setApiRole } from '../services/api';

export interface ToastMessage {
  id: string;
  type: 'success' | 'error' | 'info';
  title: string;
  message: string;
}

interface AppContextType {
  selectedDistrict: string;
  setSelectedDistrict: (district: string) => void;
  userRole: UserRole;
  setUserRole: (role: UserRole) => void;
  lastRefreshed: Date;
  isRefreshing: boolean;
  refreshData: () => Promise<void>;
  apiHealth: 'healthy' | 'error' | 'loading';
  stats: SystemStats | null;

  // Right Inspection Drawer state
  selectedNeed: NeedWithDetails | null;
  setSelectedNeed: (need: NeedWithDetails | null) => void;
  isDrawerOpen: boolean;
  setIsDrawerOpen: (open: boolean) => void;
  openDrawerWithNeed: (need: NeedWithDetails) => void;

  // Allocation Preview / Dispatch Modal state
  allocationModal: {
    isOpen: boolean;
    need: NeedWithDetails | null;
    initialQty?: number;
  };
  openAllocationModal: (need: NeedWithDetails, initialQty?: number) => void;
  closeAllocationModal: () => void;

  // Toast notifications
  toasts: ToastMessage[];
  addToast: (toast: Omit<ToastMessage, 'id'>) => void;
  removeToast: (id: string) => void;

  // Demo walkthrough state
  isWalkthroughOpen: boolean;
  setIsWalkthroughOpen: (open: boolean) => void;
  resetToDemoData: () => Promise<void>;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [selectedDistrict, setSelectedDistrict] = useState<string>('all');
  const [userRole, setUserRoleState] = useState<UserRole>('Operations Coordinator');
  const [lastRefreshed, setLastRefreshed] = useState<Date>(new Date());
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [apiHealth, setApiHealth] = useState<'healthy' | 'error' | 'loading'>('healthy');
  const [stats, setStats] = useState<SystemStats | null>(null);

  // Drawer
  const [selectedNeed, setSelectedNeed] = useState<NeedWithDetails | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState<boolean>(false);

  // Allocation Modal
  const [allocationModal, setAllocationModal] = useState<{
    isOpen: boolean;
    need: NeedWithDetails | null;
    initialQty?: number;
  }>({
    isOpen: false,
    need: null,
  });

  // Toasts
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  // Demo mode
  const [isWalkthroughOpen, setIsWalkthroughOpen] = useState<boolean>(false);

  const addToast = useCallback((toast: Omit<ToastMessage, 'id'>) => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    setToasts((prev) => [...prev, { ...toast, id }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4500);
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const setUserRole = useCallback((role: UserRole) => {
    setUserRoleState(role);
    setApiRole(role);
  }, []);

  const refreshData = useCallback(async () => {
    setIsRefreshing(true);
    try {
      const [statsData] = await Promise.all([
        api.getStats(selectedDistrict),
        api.getHealth(),
      ]);
      setStats(statsData);
      setApiHealth('healthy');
      setLastRefreshed(new Date());
    } catch (err) {
      console.error('Refresh error:', err);
      setApiHealth('error');
      addToast({
        type: 'error',
        title: 'Connection Issue',
        message: 'Could not communicate with the ReliefHub mock API server.',
      });
    } finally {
      setIsRefreshing(false);
    }
  }, [selectedDistrict, addToast]);

  const openDrawerWithNeed = useCallback((need: NeedWithDetails) => {
    setSelectedNeed(need);
    setIsDrawerOpen(true);
  }, []);

  const openAllocationModal = useCallback((need: NeedWithDetails, initialQty?: number) => {
    setAllocationModal({
      isOpen: true,
      need,
      initialQty,
    });
  }, []);

  const closeAllocationModal = useCallback(() => {
    setAllocationModal({
      isOpen: false,
      need: null,
    });
  }, []);

  const resetToDemoData = useCallback(async () => {
    try {
      await api.resetData();
      await refreshData();
      addToast({
        type: 'success',
        title: 'Demo Data Restored',
        message: 'Database reset to verified fictional Sindh flood response dataset.',
      });
    } catch (err: any) {
      addToast({
        type: 'error',
        title: 'Reset Failed',
        message: err.message || 'Could not reset dataset.',
      });
    }
  }, [refreshData, addToast]);

  useEffect(() => {
    refreshData();
  }, [refreshData]);

  return (
    <AppContext.Provider
      value={{
        selectedDistrict,
        setSelectedDistrict,
        userRole,
        setUserRole,
        lastRefreshed,
        isRefreshing,
        refreshData,
        apiHealth,
        stats,
        selectedNeed,
        setSelectedNeed,
        isDrawerOpen,
        setIsDrawerOpen,
        openDrawerWithNeed,
        allocationModal,
        openAllocationModal,
        closeAllocationModal,
        toasts,
        addToast,
        removeToast,
        isWalkthroughOpen,
        setIsWalkthroughOpen,
        resetToDemoData,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) throw new Error('useApp must be used within an AppProvider');
  return context;
};
