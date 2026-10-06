import React from "react";
import { CheckCircle2, AlertTriangle, AlertOctagon, HelpCircle, Clock } from "lucide-react";

export type ClinicalStatus =
  | "NORMAL"
  | "HIGH"
  | "LOW"
  | "URGENT_REVIEW"
  | "REVIEW_RECOMMENDED"
  | "COMPLETED"
  | "PROCESSING"
  | "UPLOADED"
  | "FAILED"
  | "UNKNOWN"
  | string;

interface StatusIndicatorProps {
  status: ClinicalStatus;
  severity?: string;
  size?: "sm" | "md";
  showIcon?: boolean;
  className?: string;
}

export default function StatusIndicator({
  status,
  severity,
  size = "md",
  showIcon = true,
  className = "",
}: StatusIndicatorProps) {
  const normStatus = (status || "").toUpperCase();
  const normSeverity = (severity || "").toUpperCase();

  let badgeColor = "bg-slate-100 text-slate-700 border-slate-200";
  let icon = <HelpCircle className="w-3.5 h-3.5" />;
  let label = normStatus;

  if (normSeverity === "URGENT_REVIEW" || normStatus === "URGENT_REVIEW") {
    badgeColor = "bg-rose-50 text-rose-700 border-rose-200/80 font-semibold";
    icon = <AlertOctagon className="w-3.5 h-3.5 text-rose-600" />;
    label = "Urgent Review";
  } else if (
    normSeverity === "REVIEW_RECOMMENDED" ||
    normStatus === "REVIEW_RECOMMENDED" ||
    normStatus === "HIGH" ||
    normStatus === "LOW"
  ) {
    badgeColor = "bg-amber-50 text-amber-800 border-amber-200/80 font-semibold";
    icon = <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />;
    label = normStatus === "HIGH" ? "Elevated" : normStatus === "LOW" ? "Low" : "Review Recommended";
  } else if (normStatus === "NORMAL" || normStatus === "COMPLETED") {
    badgeColor = "bg-emerald-50 text-emerald-800 border-emerald-200/80 font-semibold";
    icon = <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />;
    label = normStatus === "COMPLETED" ? "Processed" : "Normal";
  } else if (normStatus === "PROCESSING" || normStatus === "UPLOADED") {
    badgeColor = "bg-cyan-50 text-cyan-800 border-cyan-200/80";
    icon = <Clock className="w-3.5 h-3.5 text-cyan-600 animate-spin" />;
    label = normStatus === "PROCESSING" ? "Analyzing" : "Uploaded";
  } else if (normStatus === "FAILED") {
    badgeColor = "bg-rose-50 text-rose-700 border-rose-200";
    icon = <AlertOctagon className="w-3.5 h-3.5 text-rose-600" />;
    label = "Failed";
  }

  const sizeClasses = size === "sm" ? "px-2 py-0.5 text-[10px]" : "px-2.5 py-1 text-xs";

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border shadow-2xs ${sizeClasses} ${badgeColor} ${className}`}
    >
      {showIcon && icon}
      <span>{label}</span>
    </span>
  );
}
