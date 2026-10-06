"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  FileText,
  Pill,
  FlaskConical,
  Sparkles,
  Bot,
  Database,
  Clock,
  Plus,
  MessageSquare,
  Trash2,
  Settings,
  LogOut,
  ChevronLeft,
  ChevronRight,
  User,
  HeartPulse,
  Languages,
  X,
} from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { useLanguage } from "@/lib/language-context";
import {
  fetchChatSessionsApi,
  deleteChatSessionApi,
  ChatSessionSummary,
} from "@/lib/api";

interface SidebarProps {
  isOpen: boolean; // For mobile drawer
  setIsOpen: (open: boolean) => void;
  isCollapsed: boolean; // For desktop collapsed state
  setIsCollapsed: (collapsed: boolean) => void;
}

export default function Sidebar({
  isOpen,
  setIsOpen,
  isCollapsed,
  setIsCollapsed,
}: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, token, logout } = useAuth();
  const { language, setLanguage, isTamil, t } = useLanguage();

  const [sessions, setSessions] = useState<ChatSessionSummary[]>([]);
  const [loadingSessions, setLoadingSessions] = useState(false);

  // Load recent Copilot sessions
  const loadSessions = useCallback(async () => {
    if (!token) return;
    try {
      setLoadingSessions(true);
      const list = await fetchChatSessionsApi(token);
      setSessions(list);
    } catch {
      // Non-critical background failure
    } finally {
      setLoadingSessions(false);
    }
  }, [token]);

  useEffect(() => {
    loadSessions();

    // Listen for custom event when new messages or sessions are added in Copilot
    const handleSessionUpdate = () => {
      loadSessions();
    };
    window.addEventListener("health_copilot_session_updated", handleSessionUpdate);
    return () => {
      window.removeEventListener("health_copilot_session_updated", handleSessionUpdate);
    };
  }, [loadSessions]);

  const handleDeleteSession = async (
    sessionId: string,
    e: React.MouseEvent
  ) => {
    e.preventDefault();
    e.stopPropagation();
    if (!token) return;
    try {
      await deleteChatSessionApi(sessionId, token);
      setSessions((prev) => prev.filter((s) => s.id !== sessionId));
      // Notify Copilot page if open
      window.dispatchEvent(
        new CustomEvent("health_copilot_session_deleted", {
          detail: { sessionId },
        })
      );
    } catch {
      // Silently catch
    }
  };

  const handleNewChat = () => {
    // Dispatch new chat event for Copilot page if already there
    window.dispatchEvent(new CustomEvent("health_copilot_new_chat"));
    router.push("/copilot");
    if (isOpen) setIsOpen(false);
  };

  const navLinks = [
    {
      href: "/dashboard",
      label: t("nav", "dashboard", "Dashboard"),
      icon: LayoutDashboard,
    },
    {
      href: "/documents",
      label: t("nav", "documents", "Documents"),
      icon: FileText,
    },
    {
      href: "/medications",
      label: isTamil ? "மருந்துகள்" : "Medications",
      icon: Pill,
    },
    {
      href: "/laboratory",
      label: isTamil ? "ஆய்வகம்" : "Laboratory",
      icon: FlaskConical,
      aliases: ["/lab"],
    },
    {
      href: "/summary",
      label: isTamil ? "மருத்துவ சுருக்கம்" : "Health Summary",
      icon: Sparkles,
    },
    {
      href: "/copilot",
      label: isTamil ? "ஹெல்த் கோபைலட்" : "Copilot",
      icon: Bot,
    },
    {
      href: "/health-data",
      label: "FHIR Data",
      icon: Database,
      aliases: ["/fhir"],
    },
    {
      href: "/timeline",
      label: t("nav", "timeline", "Timeline"),
      icon: Clock,
    },
  ];

  const isLinkActive = (href: string, aliases?: string[]) => {
    if (pathname === href) return true;
    if (aliases && aliases.some((a) => pathname === a || pathname.startsWith(`${a}/`))) {
      return true;
    }
    return pathname.startsWith(`${href}/`);
  };

  return (
    <>
      {/* Mobile Backdrop Overlay */}
      {isOpen && (
        <div
          onClick={() => setIsOpen(false)}
          className="fixed inset-0 z-40 bg-slate-900/60 backdrop-blur-xs lg:hidden transition-opacity"
          aria-hidden="true"
        />
      )}

      {/* Main Sidebar Element */}
      <aside
        className={`fixed lg:static top-0 bottom-0 left-0 z-50 flex flex-col bg-slate-900 border-r border-slate-800 text-slate-300 transition-all duration-300 ease-in-out shadow-2xl lg:shadow-none ${
          isCollapsed ? "lg:w-[72px]" : "lg:w-[260px]"
        } ${
          isOpen ? "translate-x-0 w-[280px]" : "-translate-x-full lg:translate-x-0"
        }`}
      >
        {/* 1. Header / Brand Title */}
        <div className="h-16 flex items-center justify-between px-4 border-b border-slate-800/80 shrink-0">
          <Link
            href="/dashboard"
            onClick={() => isOpen && setIsOpen(false)}
            className="flex items-center gap-3 overflow-hidden group"
          >
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-teal-500 to-emerald-400 flex items-center justify-center text-white shrink-0 shadow-md shadow-teal-500/20 group-hover:scale-105 transition-transform">
              <HeartPulse className="w-5 h-5 stroke-[2.4]" />
            </div>
            {(!isCollapsed || isOpen) && (
              <div className="leading-tight truncate">
                <span className="font-bold text-sm tracking-tight text-white block">
                  HealthCopilot
                </span>
                <span className="text-[10px] uppercase font-bold tracking-wider text-teal-400">
                  AI Clinical Record
                </span>
              </div>
            )}
          </Link>

          {/* Mobile Close Button */}
          <button
            onClick={() => setIsOpen(false)}
            className="lg:hidden text-slate-400 hover:text-white p-1 rounded-lg"
          >
            <X className="w-5 h-5" />
          </button>

          {/* Desktop Collapse / Expand Toggle */}
          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="hidden lg:flex items-center justify-center w-7 h-7 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
            title={isCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}
          >
            {isCollapsed ? (
              <ChevronRight className="w-4 h-4" />
            ) : (
              <ChevronLeft className="w-4 h-4" />
            )}
          </button>
        </div>

        {/* 2. Primary Action: + New Chat (ChatGPT Style) */}
        <div className="p-3 shrink-0">
          <button
            onClick={handleNewChat}
            className={`w-full flex items-center justify-center gap-2.5 py-2.5 px-3 rounded-xl bg-teal-600 hover:bg-teal-500 text-white font-medium text-xs shadow-md shadow-teal-900/30 transition-all active:scale-[0.98] ${
              isCollapsed && !isOpen ? "px-0" : ""
            }`}
            title="Start New Chat"
          >
            <Plus className="w-4 h-4 shrink-0 stroke-[2.5]" />
            {(!isCollapsed || isOpen) && (
              <span className="font-semibold tracking-wide truncate">
                {isTamil ? "+ புதிய வினா" : "+ New Chat"}
              </span>
            )}
          </button>
        </div>

        {/* 3. Navigation Links List */}
        <div className="flex-1 overflow-y-auto px-3 space-y-1 scrollbar-thin scrollbar-thumb-slate-800">
          <div className="space-y-0.5">
            {navLinks.map((item) => {
              const Icon = item.icon;
              const active = isLinkActive(item.href, item.aliases);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => isOpen && setIsOpen(false)}
                  className={`flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-medium transition-all group ${
                    active
                      ? "bg-slate-800 text-teal-300 font-semibold shadow-xs"
                      : "text-slate-400 hover:text-slate-100 hover:bg-slate-800/60"
                  } ${isCollapsed && !isOpen ? "justify-center px-0" : ""}`}
                  title={item.label}
                >
                  <Icon
                    className={`w-4 h-4 shrink-0 transition-transform group-hover:scale-110 ${
                      active ? "text-teal-400" : "text-slate-400 group-hover:text-slate-200"
                    }`}
                  />
                  {(!isCollapsed || isOpen) && (
                    <span className="truncate">{item.label}</span>
                  )}
                </Link>
              );
            })}
          </div>

          {/* 4. Recent Chats Section (ChatGPT Style) */}
          {(!isCollapsed || isOpen) && (
            <div className="pt-4 mt-3 border-t border-slate-800/80">
              <div className="flex items-center justify-between px-2 mb-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-300">
                  {isTamil ? "சமீபத்திய உரையாடல்கள்" : "Recent Chats"}
                </span>
                {sessions.length > 0 && (
                  <span className="text-[10px] text-slate-300 bg-slate-800 px-1.5 py-0.5 rounded-full font-mono">
                    {sessions.length}
                  </span>
                )}
              </div>

              <div className="space-y-0.5 max-h-56 overflow-y-auto pr-0.5">
                {sessions.length === 0 ? (
                  <div className="px-2 py-3 text-center text-[11px] text-slate-300 italic">
                    {loadingSessions
                      ? "Loading history..."
                      : isTamil
                      ? "உரையாடல்கள் எதுவும் இல்லை"
                      : "No recent consultations"}
                  </div>
                ) : (
                  sessions.slice(0, 10).map((session) => (
                    <div
                      key={session.id}
                      onClick={() => {
                        router.push(`/copilot?session_id=${session.id}`);
                        if (isOpen) setIsOpen(false);
                      }}
                      className="group flex items-center justify-between gap-2 px-2.5 py-2 rounded-lg text-xs text-slate-300 hover:text-white hover:bg-slate-800/70 transition cursor-pointer"
                      title={session.title}
                    >
                      <div className="flex items-center gap-2 truncate min-w-0">
                        <MessageSquare className="w-3.5 h-3.5 text-slate-300 shrink-0 group-hover:text-teal-400" />
                        <span className="truncate">{session.title}</span>
                      </div>
                      <button
                        onClick={(e) => handleDeleteSession(session.id, e)}
                        className="opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-rose-400 transition rounded shrink-0"
                        title="Delete chat"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {/* 5. Footer: Language, Profile, Settings & Logout */}
        <div className="p-3 border-t border-slate-800/80 shrink-0 space-y-2 bg-slate-900/90">
          {/* Language Switcher */}
          {(!isCollapsed || isOpen) && (
            <div className="flex items-center justify-between px-2 py-1 bg-slate-800/70 rounded-lg text-xs">
              <span className="text-slate-300 flex items-center gap-1.5 text-[11px]">
                <Languages className="w-3.5 h-3.5 text-teal-400" />
                Language:
              </span>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setLanguage("en")}
                  className={`px-2 py-0.5 rounded text-[11px] font-bold transition ${
                    language === "en"
                      ? "bg-teal-600 text-white shadow-xs"
                      : "text-slate-400 hover:text-white"
                  }`}
                >
                  EN
                </button>
                <button
                  onClick={() => setLanguage("ta")}
                  className={`px-2 py-0.5 rounded text-[11px] font-bold transition ${
                    language === "ta"
                      ? "bg-teal-600 text-white shadow-xs"
                      : "text-slate-400 hover:text-white"
                  }`}
                >
                  தமிழ்
                </button>
              </div>
            </div>
          )}

          {/* User Profile Info & Action Links */}
          <div className="flex items-center justify-between gap-2 p-1.5 rounded-xl hover:bg-slate-800/60 transition">
            <Link
              href="/profile"
              onClick={() => isOpen && setIsOpen(false)}
              className="flex items-center gap-2.5 min-w-0 flex-1 truncate"
              title="User Profile & Settings"
            >
              <div className="w-8 h-8 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-teal-400 font-bold text-xs shrink-0">
                {user?.full_name
                  ? user.full_name
                      .split(" ")
                      .map((n) => n[0])
                      .join("")
                      .slice(0, 2)
                      .toUpperCase()
                  : "PT"}
              </div>
              {(!isCollapsed || isOpen) && (
                <div className="min-w-0 truncate text-left">
                  <div className="text-xs font-semibold text-white truncate">
                    {user?.full_name || "Patient Record"}
                  </div>
                  <div className="text-[10px] text-slate-300 truncate">
                    {user?.email || "demo@example.com"}
                  </div>
                </div>
              )}
            </Link>

            {/* Logout Button */}
            {(!isCollapsed || isOpen) && (
              <button
                onClick={() => logout()}
                className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-slate-800 transition shrink-0"
                title="Log Out"
              >
                <LogOut className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </aside>
    </>
  );
}
