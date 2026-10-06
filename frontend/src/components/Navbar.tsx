"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  FileText,
  Activity,
  LayoutDashboard,
  LogOut,
  LogIn,
  UserPlus,
  Clock,
  Database,
  Pill,
  FlaskConical,
  Sparkles,
  User,
  Menu,
  X,
  ChevronDown,
} from "lucide-react";
import HealthStatusBadge from "./HealthStatusBadge";
import { useAuth } from "@/lib/auth-context";
import { useLanguage } from "@/lib/language-context";

export default function Navbar() {
  const { language, setLanguage, isTamil, t } = useLanguage();
  const { user, logout } = useAuth();
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);

  const navLinks = [
    {
      href: "/dashboard",
      label: t("nav", "dashboard", "Dashboard"),
      icon: LayoutDashboard,
      activeColor: "text-teal-600 bg-teal-50/80",
    },
    {
      href: "/documents",
      label: t("nav", "documents", "Documents"),
      icon: FileText,
      activeColor: "text-teal-600 bg-teal-50/80",
    },
    {
      href: "/medications",
      label: isTamil ? "மருந்துகள்" : "Medications",
      icon: Pill,
      activeColor: "text-teal-600 bg-teal-50/80",
    },
    {
      href: "/laboratory",
      label: isTamil ? "ஆய்வகம்" : "Laboratory",
      icon: FlaskConical,
      activeColor: "text-teal-600 bg-teal-50/80",
    },
    {
      href: "/timeline",
      label: t("nav", "timeline", "Timeline"),
      icon: Clock,
      activeColor: "text-teal-600 bg-teal-50/80",
    },
    {
      href: "/summary",
      label: t("nav", "summary", "AI Summary"),
      icon: Sparkles,
      activeColor: "text-teal-600 bg-teal-50/80",
    },
    {
      href: "/health-data",
      label: "FHIR Data",
      icon: Database,
      activeColor: "text-teal-600 bg-teal-50/80",
    },
  ];

  const isActive = (href: string) => {
    if (href === "/laboratory" && pathname === "/lab") return true;
    if (href === "/health-data" && pathname === "/fhir") return true;
    return pathname === href || pathname.startsWith(`${href}/`);
  };

  return (
    <header className="sticky top-0 z-50 w-full border-b border-slate-200/80 bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/70">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Brand */}
        <div className="flex items-center gap-3">
          <Link href="/" className="flex items-center gap-2.5 group">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-teal-600 to-emerald-500 flex items-center justify-center text-white shadow-md shadow-teal-500/20 group-hover:scale-105 transition-transform">
              <Activity className="w-5 h-5 stroke-[2.5]" />
            </div>
            <div>
              <span className="font-bold text-base text-slate-900 tracking-tight block leading-none">
                {t("nav", "brand_title", "HealthCopilot")}
              </span>
              <span className="text-[10px] text-teal-700 font-medium tracking-wide uppercase">
                {t("nav", "brand_subtitle", "Healthcare AI Platform")}
              </span>
            </div>
          </Link>
        </div>

        {/* Center Desktop Navigation */}
        <nav className="hidden xl:flex items-center gap-1 text-sm font-medium text-slate-600">
          {navLinks.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 text-xs font-semibold ${
                  active
                    ? `${item.activeColor} border border-teal-200/60 font-bold`
                    : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
                }`}
              >
                <Icon className={`w-3.5 h-3.5 ${active ? "text-teal-600" : "text-slate-400"}`} />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        {/* Right Controls */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Live System Online Badge */}
          <div className="hidden sm:block">
            <HealthStatusBadge />
          </div>

          {/* Language Selector Button */}
          <div className="inline-flex rounded-xl border border-slate-200 bg-slate-100/80 p-0.5 shadow-inner">
            <button
              onClick={() => setLanguage("en")}
              className={`px-2 py-0.5 text-xs font-bold rounded-lg transition-all ${
                language === "en"
                  ? "bg-white text-teal-800 shadow-sm"
                  : "text-slate-600 hover:text-slate-900"
              }`}
              title="Switch to English"
            >
              EN
            </button>
            <button
              onClick={() => setLanguage("ta")}
              className={`px-2 py-0.5 text-xs font-bold rounded-lg transition-all ${
                language === "ta"
                  ? "bg-white text-teal-800 shadow-sm"
                  : "text-slate-600 hover:text-slate-900"
              }`}
              title="தமிழுக்கு மாற்றுக"
            >
              தமிழ்
            </button>
          </div>

          {/* Authentication & Profile Controls */}
          {user ? (
            <div className="relative">
              <button
                onClick={() => setUserDropdownOpen(!userDropdownOpen)}
                className="flex items-center gap-2 px-2.5 py-1.5 rounded-xl border border-slate-200 hover:border-teal-300 bg-white hover:bg-slate-50 transition-colors shadow-xs"
              >
                <div className="w-6 h-6 rounded-lg bg-teal-600 text-white flex items-center justify-center text-xs font-bold">
                  {user.full_name ? user.full_name.charAt(0).toUpperCase() : "U"}
                </div>
                <span className="hidden md:inline text-xs font-semibold text-slate-800 max-w-[100px] truncate">
                  {user.full_name.split(" ")[0]}
                </span>
                <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
              </button>

              {userDropdownOpen && (
                <div
                  className="absolute right-0 mt-2 w-48 rounded-xl bg-white border border-slate-200 shadow-lg py-1 z-50 animate-in fade-in slide-in-from-top-1"
                  onClick={() => setUserDropdownOpen(false)}
                >
                  <div className="px-3 py-2 border-b border-slate-100">
                    <p className="text-xs font-bold text-slate-800 truncate">{user.full_name}</p>
                    <p className="text-[11px] text-slate-500 truncate">{user.email}</p>
                  </div>
                  <Link
                    href="/profile"
                    className="flex items-center gap-2 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-teal-50 hover:text-teal-700"
                  >
                    <User className="w-3.5 h-3.5 text-teal-600" />
                    <span>{isTamil ? "சுயவிவரம்" : "Patient Profile"}</span>
                  </Link>
                  <Link
                    href="/dashboard"
                    className="flex items-center gap-2 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-teal-50 hover:text-teal-700"
                  >
                    <LayoutDashboard className="w-3.5 h-3.5 text-teal-600" />
                    <span>{t("nav", "dashboard", "Dashboard")}</span>
                  </Link>
                  <button
                    onClick={logout}
                    className="w-full text-left flex items-center gap-2 px-3 py-2 text-xs font-medium text-rose-600 hover:bg-rose-50"
                  >
                    <LogOut className="w-3.5 h-3.5 text-rose-500" />
                    <span>{t("nav", "sign_out", "Sign Out")}</span>
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Link
                href="/login"
                className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold rounded-lg text-slate-700 hover:text-slate-900 hover:bg-slate-100 transition-colors"
              >
                <LogIn className="w-3.5 h-3.5" />
                <span>{t("nav", "sign_in", "Sign In")}</span>
              </Link>
              <Link
                href="/register"
                className="inline-flex items-center gap-1 justify-center rounded-lg bg-teal-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-teal-700 transition-colors"
              >
                <UserPlus className="w-3.5 h-3.5" />
                <span>{t("nav", "register", "Register")}</span>
              </Link>
            </div>
          )}

          {/* Mobile Menu Hamburger Button */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="xl:hidden p-2 rounded-xl text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors"
            aria-label="Toggle mobile menu"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile Drawer Navigation */}
      {mobileMenuOpen && (
        <div className="xl:hidden border-t border-slate-200 bg-white px-4 pt-3 pb-5 space-y-1 shadow-lg animate-in slide-in-from-top-2">
          {navLinks.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMobileMenuOpen(false)}
                className={`flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold transition-colors ${
                  active
                    ? `${item.activeColor} font-bold border border-teal-200/60`
                    : "text-slate-700 hover:bg-slate-100"
                }`}
              >
                <Icon className={`w-4 h-4 ${active ? "text-teal-600" : "text-slate-400"}`} />
                <span>{item.label}</span>
              </Link>
            );
          })}
          {user && (
            <Link
              href="/profile"
              onClick={() => setMobileMenuOpen(false)}
              className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold text-slate-700 hover:bg-slate-100"
            >
              <User className="w-4 h-4 text-teal-600" />
              <span>{isTamil ? "சுயவிவரம்" : "Patient Profile"}</span>
            </Link>
          )}
        </div>
      )}
    </header>
  );
}
