import React from "react";

export function CardSkeleton({ lines = 3 }: { lines?: number }) {
  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm animate-pulse">
      <div className="flex items-center justify-between mb-4">
        <div className="h-4 w-32 bg-slate-200 rounded"></div>
        <div className="h-6 w-16 bg-slate-100 rounded-full"></div>
      </div>
      <div className="space-y-2.5">
        {Array.from({ length: lines }).map((_, i) => (
          <div
            key={i}
            className="h-3 bg-slate-100 rounded"
            style={{ width: `${85 - i * 15}%` }}
          ></div>
        ))}
      </div>
    </div>
  );
}

export function MetricSkeleton() {
  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm animate-pulse flex items-center justify-between">
      <div className="space-y-2">
        <div className="h-3.5 w-24 bg-slate-200 rounded"></div>
        <div className="h-7 w-16 bg-slate-300 rounded"></div>
        <div className="h-3 w-28 bg-slate-100 rounded"></div>
      </div>
      <div className="w-12 h-12 rounded-xl bg-slate-100"></div>
    </div>
  );
}

export function TableRowSkeleton({ cols = 4 }: { cols?: number }) {
  return (
    <tr className="border-b border-slate-100 animate-pulse">
      {Array.from({ length: cols }).map((_, i) => (
        <td key={i} className="py-3.5 px-4">
          <div className="h-3.5 bg-slate-200/80 rounded w-3/4"></div>
        </td>
      ))}
    </tr>
  );
}

export function TimelineItemSkeleton() {
  return (
    <div className="flex gap-4 p-4 rounded-xl border border-slate-100 bg-white animate-pulse">
      <div className="w-10 h-10 rounded-full bg-slate-200 shrink-0"></div>
      <div className="flex-1 space-y-2">
        <div className="h-4 w-48 bg-slate-200 rounded"></div>
        <div className="h-3 w-64 bg-slate-100 rounded"></div>
        <div className="h-2.5 w-24 bg-slate-100 rounded"></div>
      </div>
    </div>
  );
}
