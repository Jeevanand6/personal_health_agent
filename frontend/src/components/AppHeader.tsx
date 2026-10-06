"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Menu,
  CheckCircle2,
  LayoutDashboard,
  FileText,
  Pill,
  FlaskConical,
  Sparkles,
  Bot,
  Database,
  Clock,
  User,
  HeartPulse,
} from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { useLanguage } from "@/lib/language-context";

interface AppHeaderProps {
  onToggleSidebar: () => void;
}

export default function AppHeader({ onToggleSidebar }: AppHeaderProps) {
  const pathname = usePathname();
  const { user } = useAuth();
  const { language, setLanguage, isTamil } = useLanguage();

  const getPageInfo = () => {
    if (pathname.startsWith("/copilot")) {
      return {
        title: isTamil ? "ஹெல்த் கோபைலட்" : "Health Copilot",
        icon: Bot,
        isCopilot: true,
      };
    }
    if (pathname.startsWith("/documents")) {
      return {
        title: isTamil ? "மருத்துவ ஆவணங்கள்" : "Medical Documents",
        icon: FileText,
      };
    }
    if (pathname.startsWith("/medications")) {
      return {
        title: isTamil ? "மருந்துகள் பட்டியல்" : "Prescribed Medications",
        icon: Pill,
      };
    }
    if (pathname.startsWith("/laboratory") || pathname.startsWith("/lab")) {
      return {
        title: isTamil ? "ஆய்வகப் பரிசோதனைகள்" : "Laboratory Observations",
        icon: FlaskConical,
      };
    }
    if (pathname.startsWith("/summary")) {
      return {
        title: isTamil ? "மருத்துவ சுருக்கம்" : "Clinical Health Summary",
        icon: Sparkles,
      };
    }
    if (pathname.startsWith("/health-data") || pathname.startsWith("/fhir")) {
      return {
        title: isTamil ? "FHIR R4 தரவுத்தளம்" : "FHIR R4 Health Records",
        icon: Database,
      };
    }
    if (pathname.startsWith("/timeline")) {
      return {
        title: isTamil ? "மருத்துவ காலவரிசை" : "Patient Care Timeline",
        icon: Clock,
      };
    }
    if (pathname.startsWith("/profile")) {
      return {
        title: isTamil ? "சுயவிவரம் & அமைப்புகள்" : "User Profile & Settings",
        icon: User,
      };
    }
    return {
      title: isTamil ? "மருத்துவக் கட்டுப்பாட்டு பலகை" : "Clinical Dashboard",
      icon: LayoutDashboard,
    };
  };

  const pageInfo = getPageInfo();
  const Icon = pageInfo.icon;

  return (
    <header className="h-14 border-b border-slate-200/90 bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/80 px-4 sm:px-6 flex items-center justify-between shrink-0 z-30">
      {/* Left: Mobile Drawer Trigger & Page Title */}
      <div className="flex items-center gap-3">
        <button
          onClick={onToggleSidebar}
          className="lg:hidden p-2 rounded-xl text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition"
          title="Open Navigation Menu"
          aria-label="Open Navigation Menu"
        >
          <Menu className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-teal-50 border border-teal-200 flex items-center justify-center text-teal-700 shrink-0">
            <Icon className="w-4 h-4" />
          </div>
          <h1 className="text-sm sm:text-base font-bold text-slate-900 tracking-tight">
            {pageInfo.title}
          </h1>
        </div>

        {/* Subtle Copilot Grounding Badge (Requirement 7) */}
        {pageInfo.isCopilot && (
          <span className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-[11px] font-medium ml-2">
            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
            <span>{isTamil ? "ஆவணங்களில் சரிபார்க்கப்பட்டது" : "Grounded in your records"}</span>
          </span>
        )}
      </div>

      {/* Right: Language Switch & User Profile Avatar */}
      <div className="flex items-center gap-2 sm:gap-3">
        {/* Quick Language Toggle */}
        <div className="inline-flex rounded-lg border border-slate-200 bg-slate-100 p-0.5">
          <button
            onClick={() => setLanguage("en")}
            className={`px-2 py-0.5 text-xs font-bold rounded-md transition ${
              language === "en"
                ? "bg-white text-teal-800 shadow-2xs"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            EN
          </button>
          <button
            onClick={() => setLanguage("ta")}
            className={`px-2 py-0.5 text-xs font-bold rounded-md transition ${
              language === "ta"
                ? "bg-white text-teal-800 shadow-2xs"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            தமிழ்
          </button>
        </div>

        {/* User Mini Avatar Link */}
        {user && (
          <Link
            href="/profile"
            className="flex items-center gap-2 p-1 rounded-full hover:ring-2 hover:ring-teal-400/50 transition group"
            title={user.full_name || "Profile"}
          >
            <div className="w-7 h-7 rounded-full bg-gradient-to-tr from-teal-600 to-emerald-500 text-white font-bold text-xs flex items-center justify-center shadow-xs">
              {user.full_name
                ? user.full_name
                    .split(" ")
                    .map((n) => n[0])
                    .join("")
                    .slice(0, 2)
                    .toUpperCase()
                : "PT"}
            </div>
            <span className="hidden md:inline text-xs font-semibold text-slate-700 group-hover:text-slate-900">
              {user.full_name ? user.full_name.split(" ")[0] : "Patient"}
            </span>
          </Link>
        )}
      </div>
    </header>
  );
}
