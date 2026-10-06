"use client";

import React, { useEffect, useState } from "react";
import { fetchHealthStatus, HealthStatus } from "@/lib/api";
import { Activity, CheckCircle2, AlertCircle, RefreshCw } from "lucide-react";

export default function HealthStatusBadge() {
  const [health, setHealth] = useState<HealthStatus>({
    status: "offline",
    database: "unknown",
  });
  const [loading, setLoading] = useState(true);

  const checkHealth = async () => {
    setLoading(true);
    const result = await fetchHealthStatus();
    setHealth(result);
    setLoading(false);
  };

  useEffect(() => {
    checkHealth();
    const interval = setInterval(checkHealth, 15000);
    return () => clearInterval(interval);
  }, []);

  const isHealthy = health.status === "healthy" && health.database === "connected";

  return (
    <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium border transition-colors bg-white/80 backdrop-blur shadow-sm">
      <div className="flex items-center gap-1.5">
        <span className="relative flex h-2 w-2">
          {isHealthy ? (
            <>
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </>
          ) : (
            <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-500"></span>
          )}
        </span>
        <span className="text-slate-600 font-semibold">System:</span>
        <span className={isHealthy ? "text-emerald-700 font-medium" : "text-rose-600 font-medium"}>
          {loading ? "Checking..." : isHealthy ? "Online" : "Disconnected"}
        </span>
      </div>

      <div className="h-3 w-px bg-slate-200" />

      <div className="flex items-center gap-1 text-slate-500">
        <span>DB:</span>
        <span className={health.database === "connected" ? "text-emerald-700" : "text-rose-600"}>
          {health.database}
        </span>
      </div>

      <button
        onClick={checkHealth}
        disabled={loading}
        title="Check status now"
        className="text-slate-400 hover:text-slate-600 transition-colors p-0.5 rounded"
      >
        <RefreshCw className={`w-3 h-3 ${loading ? "animate-spin text-teal-600" : ""}`} />
      </button>
    </div>
  );
}
