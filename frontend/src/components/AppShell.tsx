"use client";

import React, { useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import Sidebar from "./Sidebar";
import AppHeader from "./AppHeader";
import DemoModeBanner, { useDemoMode } from "./DemoModeBanner";

interface AppShellProps {
  children: React.ReactNode;
}

export default function AppShell({ children }: AppShellProps) {
  const pathname = usePathname();
  const { isDemoMode } = useDemoMode();

  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [desktopCollapsed, setDesktopCollapsed] = useState(false);

  // Close mobile drawer on route change
  useEffect(() => {
    setMobileSidebarOpen(false);
  }, [pathname]);

  // Auth pages (login, register) are standalone without sidebar
  const isAuthPage = pathname === "/login" || pathname === "/register";

  if (isAuthPage) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col">
        {isDemoMode && <DemoModeBanner />}
        <main className="flex-1 flex flex-col">{children}</main>
      </div>
    );
  }

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-slate-50 text-slate-800">
      {/* 1. Left Vertical ChatGPT-Style Sidebar */}
      <Sidebar
        isOpen={mobileSidebarOpen}
        setIsOpen={setMobileSidebarOpen}
        isCollapsed={desktopCollapsed}
        setIsCollapsed={setDesktopCollapsed}
      />

      {/* 2. Main Application Body Area */}
      <div className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden">
        {/* Demo Mode Banner (if active) */}
        {isDemoMode && <DemoModeBanner />}

        {/* Top Header with Breadcrumbs, Grounding badge, Mobile Menu Trigger */}
        <AppHeader onToggleSidebar={() => setMobileSidebarOpen(true)} />

        {/* Scrollable Content Viewport */}
        <main className="flex-1 min-h-0 overflow-y-auto flex flex-col">
          {children}
        </main>
      </div>
    </div>
  );
}
