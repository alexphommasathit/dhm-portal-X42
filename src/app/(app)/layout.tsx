import React from 'react';
import Sidebar from '@/components/Sidebar';
import Header from '@/components/Header';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen bg-gray-100">
      {/* Sidebar */}
      <Sidebar />

      {/* Main Content Area */}
      <div className="flex flex-col flex-grow overflow-hidden">
        {/* Header */}
        <Header />

        {/* Page Content (scrollable) */}
        <main className="flex-grow overflow-y-auto p-4">{children}</main>
      </div>
    </div>
  );
}
