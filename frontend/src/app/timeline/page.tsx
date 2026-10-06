"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import {
  TimelineResponse,
  TimelineEventItem,
  TimelineEventGroup,
  getTimelineApi,
  syncTimelineApi,
} from "@/lib/api";
import {
  Clock,
  Calendar,
  FileText,
  Pill,
  Activity,
  HeartPulse,
  Building2,
  Stethoscope,
  Filter,
  Search,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  ShieldAlert,
  ArrowUpDown,
  Sparkles,
  SlidersHorizontal,
  X,
  FileCheck2,
} from "lucide-react";
import { useLanguage } from "@/lib/language-context";

export default function TimelinePage() {
  const router = useRouter();
  const { user, token, isLoading: authLoading } = useAuth();
  const { language, isTamil, t } = useLanguage();

  const [timelineData, setTimelineData] = useState<TimelineResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [syncing, setSyncing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Filters state
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");
  const [sortOrder, setSortOrder] = useState<"desc" | "asc">("desc");

  // Expanded items state: set of event IDs
  const [expandedIds, setExpandedIds] = useState<Record<string, boolean>>({});

  // Auth redirect
  useEffect(() => {
    if (!authLoading && !token) {
      router.push("/login?redirect=/timeline");
    }
  }, [authLoading, token, router]);

  const fetchTimeline = async (isSync: boolean = false) => {
    if (!token) return;
    try {
      if (isSync) {
        setSyncing(true);
      } else {
        setLoading(true);
      }
      setError(null);

      if (isSync) {
        await syncTimelineApi(token);
      }

      const res = await getTimelineApi(token, {
        category: selectedCategory,
        search: searchQuery || undefined,
        start_date: startDate || undefined,
        end_date: endDate || undefined,
        order: sortOrder,
      });

      setTimelineData(res);
    } catch (err: any) {
      console.error("Failed to load timeline:", err);
      setError(err.message || "Failed to load healthcare timeline.");
    } finally {
      setLoading(false);
      setSyncing(false);
    }
  };

  useEffect(() => {
    if (token) {
      fetchTimeline(false);
    }
  }, [token, selectedCategory, sortOrder]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchTimeline(false);
  };

  const handleClearFilters = () => {
    setSelectedCategory("all");
    setSearchQuery("");
    setStartDate("");
    setEndDate("");
    setSortOrder("desc");
  };

  const toggleExpand = (id: string) => {
    setExpandedIds((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  const toggleExpandAll = () => {
    if (!timelineData) return;
    const allIds = timelineData.events.map((e) => e.id);
    const anyCollapsed = allIds.some((id) => !expandedIds[id]);

    const updated: Record<string, boolean> = {};
    allIds.forEach((id) => {
      updated[id] = anyCollapsed;
    });
    setExpandedIds(updated);
  };

  // Helper icon & color styling per event type
  const getEventBadgeConfig = (eventType: string) => {
    switch (eventType) {
      case "MEDICATION":
        return {
          icon: Pill,
          bg: "bg-indigo-50 border-indigo-200 text-indigo-700",
          nodeBg: "bg-indigo-600 ring-indigo-100",
          label: isTamil ? "மருந்துகள்" : "Medication",
        };
      case "LAB_RESULT":
        return {
          icon: Activity,
          bg: "bg-teal-50 border-teal-200 text-teal-700",
          nodeBg: "bg-teal-600 ring-teal-100",
          label: isTamil ? "ஆய்வக சோதனை" : "Lab Observation",
        };
      case "DIAGNOSIS":
        return {
          icon: HeartPulse,
          bg: "bg-rose-50 border-rose-200 text-rose-700",
          nodeBg: "bg-rose-600 ring-rose-100",
          label: isTamil ? "நோயறிதல்" : "Diagnosis",
        };
      case "ENCOUNTER":
        return {
          icon: Stethoscope,
          bg: "bg-amber-50 border-amber-200 text-amber-800",
          nodeBg: "bg-amber-600 ring-amber-100",
          label: isTamil ? "மருத்துவ சந்திப்பு" : "Clinical Encounter",
        };
      case "DIAGNOSTIC_REPORT":
        return {
          icon: FileCheck2,
          bg: "bg-sky-50 border-sky-200 text-sky-700",
          nodeBg: "bg-sky-600 ring-sky-100",
          label: isTamil ? "கண்டறிதல் அறிக்கை" : "Diagnostic Report",
        };
      case "DISCHARGE":
        return {
          icon: Building2,
          bg: "bg-purple-50 border-purple-200 text-purple-700",
          nodeBg: "bg-purple-600 ring-purple-100",
          label: isTamil ? "வெளியேற்ற சுருக்கம்" : "Discharge Summary",
        };
      case "DOCUMENT":
      default:
        return {
          icon: FileText,
          bg: "bg-slate-50 border-slate-200 text-slate-700",
          nodeBg: "bg-slate-700 ring-slate-100",
          label: isTamil ? "மருத்துவ ஆவணம்" : "Medical Document",
        };
    }
  };

  const categories = [
    { key: "all", label: t("timeline", "cat_all", "All Events") },
    { key: "documents", label: t("timeline", "cat_documents", "Documents") },
    { key: "medications", label: t("timeline", "cat_medications", "Medications") },
    { key: "laboratory", label: t("timeline", "cat_laboratory", "Laboratory") },
    { key: "diagnoses", label: t("timeline", "cat_diagnoses", "Diagnoses") },
    { key: "visits", label: t("timeline", "cat_visits", "Visits & Encounters") },
  ];

  if (authLoading || (loading && !timelineData)) {
    return (
      <div className="min-h-[80vh] flex flex-col items-center justify-center p-6 text-center">
        <div className="w-14 h-14 rounded-2xl bg-teal-50 border border-teal-200 flex items-center justify-center mb-4 text-teal-600 animate-pulse">
          <Clock className="w-7 h-7 animate-spin" />
        </div>
        <h2 className="text-xl font-bold text-slate-800 mb-1">
          {t("timeline", "title", "Unified Healthcare Timeline")}
        </h2>
        <p className="text-sm text-slate-500 max-w-md">
          {t("timeline", "subtitle", "A unified chronological timeline aggregating medical documents, lab tests, prescriptions, and clinical diagnoses.")}
        </p>
      </div>
    );
  }

  const stats = timelineData?.stats;
  const groups = timelineData?.grouped_events || [];

  return (
    <div className="min-h-screen bg-slate-50/70 pb-24 pt-6">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">

        {/* HERO TITLE & STATS */}
        <div className="bg-white border border-slate-200/90 rounded-2xl p-6 sm:p-8 shadow-sm space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-teal-50 border border-teal-200 text-teal-800 text-xs font-semibold">
                <Sparkles className="w-3.5 h-3.5 text-teal-600" />
                <span>{t("timeline", "title", "Unified Healthcare Timeline")}</span>
                <span className="text-teal-400">•</span>
                <span>{t("common", "source", "Traceable Records")}</span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
                {t("timeline", "title", "Patient Chronological Journey")}
              </h1>
              <p className="text-sm text-slate-600">
                {t("timeline", "subtitle", "A unified chronological timeline aggregating medical documents, lab tests, prescriptions, and clinical diagnoses.")}
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => fetchTimeline(true)}
                disabled={syncing}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-teal-600 hover:bg-teal-700 text-white shadow-sm transition-colors disabled:opacity-50"
                title={t("timeline", "sync_records", "Sync Records")}
              >
                <RefreshCw className={`w-3.5 h-3.5 ${syncing ? "animate-spin" : ""}`} />
                <span>{syncing ? t("timeline", "syncing", "Syncing...") : t("timeline", "sync_records", "Sync Records")}</span>
              </button>

              <button
                onClick={toggleExpandAll}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 shadow-sm transition-colors"
              >
                <span>{t("timeline", "expand_collapse_all", "Expand / Collapse All")}</span>
              </button>
            </div>
          </div>

          {/* KPI STATS ROW */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-5 border-t border-slate-100">
            <div className="bg-slate-50/90 rounded-xl p-3 border border-slate-200/70">
              <span className="text-[11px] font-medium text-slate-500 block">
                {t("timeline", "total_events", "Total Events")}
              </span>
              <span className="text-2xl font-bold text-slate-900">{stats?.total_events || 0}</span>
              <span className="text-[10px] text-teal-700 font-semibold block mt-0.5">
                {isTamil ? "சரிபார்க்கப்பட்ட ஆதாரம்" : "Strictly Grounded"}
              </span>
            </div>
            <div className="bg-slate-50/90 rounded-xl p-3 border border-slate-200/70">
              <span className="text-[11px] font-medium text-slate-500 block">
                {t("timeline", "lab_observations", "Lab Observations")}
              </span>
              <span className="text-2xl font-bold text-teal-700">{stats?.by_type?.LAB_RESULT || 0}</span>
              <span className="text-[10px] text-slate-500 block mt-0.5">
                {isTamil ? "காலவரிசை மதிப்புகள்" : "Longitudinal Values"}
              </span>
            </div>
            <div className="bg-slate-50/90 rounded-xl p-3 border border-slate-200/70">
              <span className="text-[11px] font-medium text-slate-500 block">
                {t("timeline", "active_prescriptions", "Active Prescriptions")}
              </span>
              <span className="text-2xl font-bold text-indigo-700">{stats?.by_type?.MEDICATION || 0}</span>
              <span className="text-[10px] text-slate-500 block mt-0.5">
                {isTamil ? "மருந்து அளவுகள்" : "Medication Doses"}
              </span>
            </div>
            <div className="bg-slate-50/90 rounded-xl p-3 border border-slate-200/70">
              <span className="text-[11px] font-medium text-slate-500 block">
                {t("timeline", "time_span", "Time Span")}
              </span>
              <span className="text-sm font-bold text-slate-900 block truncate" title={`${stats?.earliest_date || 'N/A'} - ${stats?.latest_date || 'N/A'}`}>
                {stats?.earliest_date ? `${stats.earliest_date.slice(0, 7)} to ${stats?.latest_date?.slice(0, 7)}` : (isTamil ? "தொடர்கிறது" : "Ongoing")}
              </span>
              <span className="text-[10px] text-slate-500 block mt-0.5">
                {isTamil ? "சரிபார்க்கப்பட்ட காலம்" : "Verified Span"}
              </span>
            </div>
          </div>
        </div>

        {/* CONTROLS: CATEGORY PILLS & SEARCH / DATE FILTER BAR */}
        <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-sm space-y-4">
          {/* Category Tabs */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
            {categories.map((cat) => (
              <button
                key={cat.key}
                onClick={() => setSelectedCategory(cat.key)}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                  selectedCategory === cat.key
                    ? "bg-teal-600 text-white shadow-sm"
                    : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>

          {/* Search & Date Filter Form */}
          <form onSubmit={handleSearchSubmit} className="grid grid-cols-1 md:grid-cols-12 gap-3 pt-2">
            {/* Search Input */}
            <div className="md:col-span-5 relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={t("timeline", "search_placeholder", "Search tests, drugs, diagnoses, doctors...")}
                className="w-full pl-9 pr-4 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-teal-500 text-slate-800 placeholder-slate-400"
              />
            </div>

            {/* Date Range Start */}
            <div className="md:col-span-2.5">
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-teal-500 text-slate-700"
                title={isTamil ? "தொடக்கத் தேதி" : "Filter start date"}
              />
            </div>

            {/* Date Range End */}
            <div className="md:col-span-2.5">
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-teal-500 text-slate-700"
                title={isTamil ? "முடிவுத் தேதி" : "Filter end date"}
              />
            </div>

            {/* Actions: Filter & Reset & Order */}
            <div className="md:col-span-2 flex items-center gap-1.5">
              <button
                type="submit"
                className="flex-1 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition-colors text-center"
              >
                {t("common", "filter", "Filter")}
              </button>

              <button
                type="button"
                onClick={() => setSortOrder(sortOrder === "desc" ? "asc" : "desc")}
                title={isTamil ? (sortOrder === "desc" ? "பழையது முதலில்" : "புதியது முதலில்") : (sortOrder === "desc" ? "Oldest First" : "Newest First")}
                className="p-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-100 transition-colors"
              >
                <ArrowUpDown className="w-4 h-4" />
              </button>

              {(searchQuery || startDate || endDate || selectedCategory !== "all") && (
                <button
                  type="button"
                  onClick={handleClearFilters}
                  title={t("common", "clear_filters", "Clear all filters")}
                  className="p-2 rounded-xl border border-slate-200 text-rose-600 hover:bg-rose-50 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          </form>
        </div>

        {/* VERTICAL TIMELINE SECTION */}
        {groups.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center space-y-3">
            <Clock className="w-12 h-12 text-slate-300 mx-auto" />
            <h3 className="text-base font-bold text-slate-800">
              {t("timeline", "no_events_match", "No Timeline Events Match Filters")}
            </h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              {t("timeline", "adjust_filters", "Try adjusting your date range or selecting another event category.")}
            </p>
            <button
              onClick={handleClearFilters}
              className="text-xs font-bold text-teal-700 hover:underline inline-block mt-2"
            >
              {t("common", "clear_filters", "Reset Filters")}
            </button>
          </div>
        ) : (
          <div className="space-y-8">
            {groups.map((group, gIdx) => (
              <div key={`group-${group.date_group}-${gIdx}`} className="space-y-4">

                {/* DATE GROUP HEADER */}
                <div className="sticky top-20 z-10 flex items-center gap-3 bg-slate-50/90 backdrop-blur py-1.5">
                  <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white border border-slate-200/90 shadow-sm">
                    <Calendar className="w-4 h-4 text-teal-600" />
                    <span className="text-xs font-extrabold text-slate-900 tracking-tight">
                      {group.display_date}
                    </span>
                    <span className="text-[10px] font-bold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">
                      {group.event_count} {isTamil ? "நிகழ்வுகள்" : (group.event_count === 1 ? "event" : "events")}
                    </span>
                  </div>
                  <div className="flex-1 h-px bg-slate-200"></div>
                </div>

                {/* VERTICAL TIMELINE CONTAINER */}
                <div className="relative pl-6 sm:pl-8 space-y-4 before:absolute before:left-3 sm:before:left-4 before:top-2 before:bottom-2 before:w-0.5 before:bg-gradient-to-b before:from-teal-500 before:via-slate-300 before:to-slate-200">
                  {group.events.map((event) => {
                    const badge = getEventBadgeConfig(event.event_type);
                    const isExpanded = !!expandedIds[event.id];
                    const IconComponent = badge.icon;
                    const meta = event.metadata_json || {};

                    return (
                      <div key={event.id} className="relative group">
                        {/* Timeline Node Icon */}
                        <div
                          className={`absolute -left-[30px] sm:-left-[38px] top-4 w-7 h-7 sm:w-8 sm:h-8 rounded-full ${badge.nodeBg} text-white flex items-center justify-center ring-4 shadow-sm group-hover:scale-110 transition-transform`}
                        >
                          <IconComponent className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                        </div>

                        {/* Event Card */}
                        <div
                          className={`bg-white border rounded-2xl shadow-sm transition-all overflow-hidden ${
                            isExpanded ? "border-teal-400 ring-2 ring-teal-50" : "border-slate-200/90 hover:border-slate-300"
                          }`}
                        >
                          {/* Card Header */}
                          <div
                            onClick={() => toggleExpand(event.id)}
                            className="p-4 sm:p-5 cursor-pointer select-none flex items-start justify-between gap-3"
                          >
                            <div className="space-y-1.5 flex-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <span
                                  className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase border ${badge.bg}`}
                                >
                                  {badge.label}
                                </span>

                                <span className="text-[11px] text-slate-400 font-mono">
                                  {new Date(event.event_date).toLocaleTimeString([], {
                                    hour: "2-digit",
                                    minute: "2-digit",
                                  })}
                                </span>

                                {meta.status && (
                                  <span
                                    className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase ${
                                      meta.status === "NORMAL"
                                        ? "bg-emerald-100 text-emerald-800"
                                        : meta.status === "HIGH"
                                        ? "bg-rose-100 text-rose-800"
                                        : meta.status === "LOW"
                                        ? "bg-sky-100 text-sky-800"
                                        : "bg-slate-100 text-slate-700"
                                    }`}
                                  >
                                    {t("status", meta.status, meta.status)}
                                  </span>
                                )}
                              </div>

                              <h4 className="font-bold text-slate-900 text-sm sm:text-base leading-tight">
                                {event.title}
                              </h4>

                              <p className="text-xs text-slate-600 line-clamp-2 leading-relaxed">
                                {event.description}
                              </p>
                            </div>

                            <button
                              type="button"
                              className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
                              title={isExpanded ? t("common", "collapse_all", "Collapse") : t("common", "expand_all", "Expand")}
                            >
                              {isExpanded ? (
                                <ChevronUp className="w-5 h-5 text-teal-600" />
                              ) : (
                                <ChevronDown className="w-5 h-5 text-slate-400" />
                              )}
                            </button>
                          </div>

                          {/* EXPANDED DETAILS */}
                          {isExpanded && (
                            <div className="px-4 pb-4 sm:px-5 sm:pb-5 pt-2 border-t border-slate-100 bg-slate-50/50 space-y-3">
                              {/* Clinical Metadata */}
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-slate-600">
                                {meta.doctor_name && (
                                  <div>
                                    <span className="text-slate-400 font-medium">
                                      {t("common", "doctor", "Physician")}:{" "}
                                    </span>
                                    <strong className="text-slate-800">{meta.doctor_name}</strong>
                                  </div>
                                )}
                                {meta.hospital_name && (
                                  <div>
                                    <span className="text-slate-400 font-medium">
                                      {t("common", "facility", "Facility")}:{" "}
                                    </span>
                                    <strong className="text-slate-800">{meta.hospital_name}</strong>
                                  </div>
                                )}
                                {meta.reference_range && (
                                  <div>
                                    <span className="text-slate-400 font-medium">
                                      {t("common", "reference_range", "Reference Range")}:{" "}
                                    </span>
                                    <strong className="text-slate-800">{meta.reference_range}</strong>
                                  </div>
                                )}
                                {meta.severity && (
                                  <div>
                                    <span className="text-slate-400 font-medium">
                                      {isTamil ? "தீவிரம்: " : "Severity: "}
                                    </span>
                                    <strong className="text-slate-800">{meta.severity}</strong>
                                  </div>
                                )}
                                {meta.dosage && (
                                  <div>
                                    <span className="text-slate-400 font-medium">
                                      {t("medications", "dosage", "Dosage")}:{" "}
                                    </span>
                                    <strong className="text-slate-800">{meta.dosage}</strong>
                                  </div>
                                )}
                                {meta.frequency && (
                                  <div>
                                    <span className="text-slate-400 font-medium">
                                      {t("medications", "frequency", "Frequency")}:{" "}
                                    </span>
                                    <strong className="text-slate-800">{meta.frequency}</strong>
                                  </div>
                                )}
                              </div>

                              {/* Document Traceability Tag */}
                              <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-200/60 text-xs">
                                <div className="flex items-center gap-1.5 text-slate-500">
                                  <FileText className="w-3.5 h-3.5 text-teal-600" />
                                  <span>{t("timeline", "grounded_source", "Grounded Source")}: </span>
                                  <strong className="text-slate-800">{event.source_document_title}</strong>
                                </div>

                                <Link
                                  href="/documents"
                                  className="inline-flex items-center gap-1 text-xs font-bold text-teal-700 hover:text-teal-800 hover:underline"
                                >
                                  <span>{t("timeline", "view_doc", "View Document")}</span>
                                  <ExternalLink className="w-3 h-3" />
                                </Link>
                              </div>
                            </div>
                          )}

                          {/* Footer Traceability Pill */}
                          <div className="px-4 py-2 sm:px-5 bg-slate-50 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400">
                            <span className="truncate max-w-[250px]" title={event.source_document_title}>
                              {isTamil ? "ஆவணம்: " : "Doc: "}{event.source_document_title}
                            </span>
                            <span className="font-mono text-[10px]">
                              {isTamil ? "ஆதார எண்: " : "Source ID: "}{event.source_document_id.slice(0, 8)}...
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}

      </div>
    </div>
  );
}
