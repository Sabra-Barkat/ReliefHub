import React, { ReactNode } from 'react';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { MobileNavigation } from './MobileNavigation';
import { RightDrawer } from './RightDrawer';
import { AllocationPreviewModal } from './AllocationPreviewModal';
import { WalkthroughModal } from './WalkthroughModal';
import { ToastContainer } from './ToastContainer';
import { AssistantLauncher } from './ai/AssistantLauncher';
import { AssistantDrawer } from './ai/AssistantDrawer';
import { AgentActivityPanel } from './ai/AgentActivityPanel';

interface LayoutProps {
  children: ReactNode;
}

export const Layout: React.FC<LayoutProps> = ({ children }) => {
  return (
    <div className="flex h-screen w-screen overflow-hidden bg-canvas text-ink font-sans">
      {/* Desktop Sidebar */}
      <Sidebar />

      {/* Main App Container */}
      <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
        {/* Mobile top bar */}
        <MobileNavigation />

        {/* Operational Header */}
        <Header />

        {/* Main Page Scrollable Area */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 pb-20 md:pb-8 focus:outline-none">
          <div className="max-w-7xl mx-auto space-y-6">
            {children}
          </div>
        </main>
      </div>

      {/* Slide-over Inspection Drawer */}
      <RightDrawer />

      {/* Allocation Preview Modal */}
      <AllocationPreviewModal />

      {/* Guided Walkthrough Modal */}
      <WalkthroughModal />

      {/* AI Intelligence Drawer */}
      <AssistantDrawer />

      {/* Floating AI Launcher */}
      <AssistantLauncher />

      {/* Specialized Agents Activity Panel */}
      <AgentActivityPanel />

      {/* Toast Notification Stack */}
      <ToastContainer />
    </div>
  );
};
