"use client";

import React, { useState } from "react";
import Link from "next/link";
import { FileText, Activity, LayoutDashboard, Globe, LogIn, LogOut, UserPlus } from "lucide-react";
import HealthStatusBadge from "./HealthStatusBadge";
import { useAuth } from "@/lib/auth-context";

export default function Navbar() {
  const [lang, setLang] = useState<"en" | "ta">("en");
  const { user, logout } = useAuth();

  return (
    <header className="sticky top-0 z-50 w-full border-b border-slate-200/80 bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/70">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Brand */}
        <div className="flex items-center gap-3">
          <Link href="/" className="flex items-center gap-2.5 group">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-teal-600 to-emerald-500 flex items-center justify-center text-white shadow-md shadow-teal-500/20 group-hover:scale-105 transition-transform">
              <Activity className="w-5 h-5 stroke-[2.5]" />
            </div>
            <div>
              <span className="font-bold text-lg text-slate-900 tracking-tight block leading-none">
                Health<span className="text-teal-600">Copilot</span>
              </span>
              <span className="text-[10px] text-slate-500 font-medium tracking-wide uppercase">
                AI Clinical Record Assistant
              </span>
            </div>
          </Link>
        </div>

        {/* Center Navigation */}
        <nav className="hidden md:flex items-center gap-1 text-sm font-medium text-slate-600">
          <Link
            href="/"
            className="px-3.5 py-2 rounded-lg hover:text-slate-900 hover:bg-slate-100 transition-colors"
          >
            Home
          </Link>
          <Link
            href="/dashboard"
            className="px-3.5 py-2 rounded-lg hover:text-slate-900 hover:bg-slate-100 transition-colors flex items-center gap-1.5"
          >
            <LayoutDashboard className="w-4 h-4 text-teal-600" />
            Dashboard
          </Link>
          <a
            href="http://localhost:8000/docs"
            target="_blank"
            rel="noopener noreferrer"
            className="px-3.5 py-2 rounded-lg hover:text-slate-900 hover:bg-slate-100 transition-colors flex items-center gap-1.5"
          >
            <FileText className="w-4 h-4 text-slate-400" />
            API Docs
          </a>
        </nav>

        {/* Right Controls */}
        <div className="flex items-center gap-3">
          {/* Live System Badge */}
          <HealthStatusBadge />

          {/* Language Toggle */}
          <button
            onClick={() => setLang(lang === "en" ? "ta" : "en")}
            className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50 transition-colors"
            title="Toggle Language"
          >
            <Globe className="w-3.5 h-3.5 text-teal-600" />
            <span>{lang === "en" ? "EN" : "தமிழ்"}</span>
          </button>

          {/* Dynamic Authentication Controls */}
          {user ? (
            <div className="flex items-center gap-2">
              <Link
                href="/dashboard"
                className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-teal-50 text-teal-800 border border-teal-200/80 hover:bg-teal-100 transition-colors"
              >
                <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                <span>{user.full_name.split(" ")[0]}</span>
              </Link>
              <button
                onClick={logout}
                title="Log out"
                className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold rounded-lg border border-slate-200 text-slate-600 hover:bg-rose-50 hover:text-rose-700 hover:border-rose-200 transition-colors"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Sign Out</span>
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Link
                href="/login"
                className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold rounded-lg text-slate-700 hover:text-slate-900 hover:bg-slate-100 transition-colors"
              >
                <LogIn className="w-3.5 h-3.5" />
                <span>Sign In</span>
              </Link>
              <Link
                href="/register"
                className="inline-flex items-center gap-1 justify-center rounded-lg bg-teal-600 px-3.5 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-teal-700 transition-colors"
              >
                <UserPlus className="w-3.5 h-3.5" />
                <span>Register</span>
              </Link>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
