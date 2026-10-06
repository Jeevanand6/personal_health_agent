"use client";

import React, { createContext, useContext, useState, useEffect } from "react";
import { ShieldCheck, Sparkles, Database } from "lucide-react";

interface DemoModeContextType {
  isDemoMode: boolean;
  setDemoMode: (val: boolean) => void;
}

const DemoModeContext = createContext<DemoModeContextType>({
  isDemoMode: false,
  setDemoMode: () => {},
});

export function DemoModeProvider({ children }: { children: React.ReactNode }) {
  const [isDemoMode, setIsDemoMode] = useState<boolean>(false);

  useEffect(() => {
    const saved = localStorage.getItem("health_copilot_demo_mode");
    if (saved === "true") {
      setIsDemoMode(true);
    }
  }, []);

  const handleSetDemoMode = (val: boolean) => {
    setIsDemoMode(val);
    localStorage.setItem("health_copilot_demo_mode", val ? "true" : "false");
  };

  return (
    <DemoModeContext.Provider value={{ isDemoMode, setDemoMode: handleSetDemoMode }}>
      {children}
    </DemoModeContext.Provider>
  );
}

export function useDemoMode() {
  return useContext(DemoModeContext);
}

export default function DemoModeBanner() {
  const { isDemoMode, setDemoMode } = useDemoMode();

  return (
    <div className="w-full bg-slate-900 text-slate-300 text-xs py-1 px-4 border-b border-slate-800">
      <div className="max-w-7xl mx-auto flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          {isDemoMode ? (
            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 font-semibold text-[11px]">
              <Sparkles className="w-3 h-3 text-amber-400" />
              Explicit Demo Mode Active (Synthetic Demonstrations)
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-semibold text-[11px]">
              <Database className="w-3 h-3 text-emerald-400" />
              Live Production Mode: Grounded Strictly in Verified Database Records
            </span>
          )}
          <span className="hidden md:inline text-slate-400 text-[11px]">
            {isDemoMode
              ? "Showing synthetic clinical data for demonstration purposes only."
              : "Zero hallucinations. No synthetic records without verified source citations."}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <label className="flex items-center gap-2 cursor-pointer text-[11px] text-slate-300 select-none">
            <span>Demo Mode</span>
            <input
              type="checkbox"
              checked={isDemoMode}
              onChange={(e) => setDemoMode(e.target.checked)}
              className="w-3.5 h-3.5 accent-teal-500 rounded cursor-pointer"
            />
          </label>
        </div>
      </div>
    </div>
  );
}
