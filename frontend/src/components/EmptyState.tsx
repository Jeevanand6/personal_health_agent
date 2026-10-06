import React from "react";
import Link from "next/link";
import { LucideIcon, FolderOpen, ArrowRight } from "lucide-react";

interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description: string;
  actionText?: string;
  actionHref?: string;
  onAction?: () => void;
  className?: string;
}

export default function EmptyState({
  icon: Icon = FolderOpen,
  title,
  description,
  actionText,
  actionHref,
  onAction,
  className = "",
}: EmptyStateProps) {
  return (
    <div
      className={`rounded-2xl border border-dashed border-slate-300/80 bg-slate-50/50 p-8 text-center flex flex-col items-center justify-center ${className}`}
    >
      <div className="w-14 h-14 rounded-2xl bg-teal-50 border border-teal-200/60 text-teal-600 flex items-center justify-center mb-4 shadow-sm">
        <Icon className="w-7 h-7" />
      </div>
      <h3 className="text-base font-bold text-slate-800 tracking-tight mb-1">
        {title}
      </h3>
      <p className="text-sm text-slate-500 max-w-md mx-auto mb-5 leading-relaxed">
        {description}
      </p>

      {actionText && (actionHref || onAction) && (
        actionHref ? (
          <Link
            href={actionHref}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-xl bg-teal-600 text-white shadow-sm hover:bg-teal-700 transition-colors"
          >
            <span>{actionText}</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        ) : (
          <button
            onClick={onAction}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-xl bg-teal-600 text-white shadow-sm hover:bg-teal-700 transition-colors"
          >
            <span>{actionText}</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        )
      )}
    </div>
  );
}
