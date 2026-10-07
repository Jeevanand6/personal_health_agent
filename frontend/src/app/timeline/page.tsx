"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Activity,
  CalendarDays,
  ChevronDown,
  ChevronUp,
  Clock3,
  FileText,
  FlaskConical,
  Pill,
  RefreshCw,
  Search,
  Stethoscope,
  X,
} from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import {
  getTimelineApi,
  syncTimelineApi,
  TimelineEventGroup,
  TimelineEventItem,
  TimelineResponse,
} from "@/lib/api";
import { useLanguage } from "@/lib/language-context";

type Episode = {
  date: string;
  displayDate: string;
  events: TimelineEventItem[];
};

const metadata = (event: TimelineEventItem) => event.metadata_json || {};

function getLabStatus(event: TimelineEventItem): string {
  const raw = String(metadata(event).status || "Not specified").toUpperCase();
  if (raw === "NORMAL") return "Normal";
  if (raw === "HIGH" || raw === "ELEVATED") return "High";
  if (raw === "LOW") return "Low";
  return "Not specified";
}

function getFriendlyEventTitle(event: TimelineEventItem): string {
  const meta = metadata(event);
  if (event.event_type === "LAB_RESULT") {
    return String(meta.test_name || event.title.replace(/^Lab Result:\s*/i, "").split(" (")[0]);
  }
  if (event.event_type === "DIAGNOSIS") {
    return String(meta.condition || event.title.replace(/^Diagnosis:\s*/i, ""));
  }
  if (event.event_type === "MEDICATION") {
    return String(meta.medication_name || event.title.replace(/^Prescription:\s*/i, "").split(" (")[0]);
  }
  return event.source_document_title || event.title
    .replace(/^(Medical Record Uploaded|Diagnostic Report Filed|Hospital Discharge Summary):\s*/i, "");
}

function getEpisodeIcon(events: TimelineEventItem[]) {
  if (events.some((event) => event.event_type === "ENCOUNTER")) return Stethoscope;
  if (events.some((event) => event.event_type === "LAB_RESULT")) return FlaskConical;
  if (events.some((event) => event.event_type === "MEDICATION")) return Pill;
  return FileText;
}

function statusStyle(status: string): string {
  if (status === "Normal") return "bg-emerald-50 text-emerald-800";
  if (status === "High") return "bg-amber-50 text-amber-900";
  if (status === "Low") return "bg-rose-50 text-rose-800";
  return "bg-slate-100 text-slate-700";
}

function formatDate(value: string, language: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString(language === "ta" ? "ta-IN" : "en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function groupEventsByDate(groups: TimelineEventGroup[]): Episode[] {
  return groups.map((group) => ({
    date: group.date_group,
    displayDate: group.display_date,
    events: group.events,
  }));
}

function SummaryStat({ label, value, icon: Icon }: { label: string; value: string | number; icon: React.ElementType }) {
  return (
    <div className="min-w-0 rounded-xl border border-slate-200 bg-white p-4">
      <div className="flex items-center gap-2 text-sm text-slate-600">
        <Icon aria-hidden="true" className="h-4 w-4 shrink-0 text-teal-700" />
        <span>{label}</span>
      </div>
      <p className="mt-2 truncate text-xl font-semibold text-slate-950">{value}</p>
    </div>
  );
}

function EventDetailDrawer({
  event,
  onClose,
  language,
}: {
  event: TimelineEventItem | null;
  onClose: () => void;
  language: string;
}) {
  if (!event) return null;

  const meta = metadata(event);
  const details: Array<[string, unknown]> = [
    ["Value", [meta.value, meta.unit].filter(Boolean).join(" ")],
    ["Reference range", meta.reference_range],
    ["Dosage", meta.dosage],
    ["Frequency", meta.frequency],
    ["Instructions", meta.instructions],
    ["Clinician", meta.doctor_name],
    ["Facility", meta.hospital_name],
    ["Severity", meta.severity],
  ];

  return (
    <div className="fixed inset-0 z-50 flex justify-end" role="presentation">
      <button
        type="button"
        aria-label="Close record details"
        className="absolute inset-0 cursor-default bg-slate-950/30"
        onClick={onClose}
      />
      <aside
        role="dialog"
        aria-modal="true"
        aria-labelledby="record-detail-title"
        className="relative flex h-full w-full max-w-xl flex-col overflow-y-auto bg-white shadow-xl"
      >
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 p-5 sm:p-6">
          <div>
            <p className="text-sm text-slate-500">{formatDate(event.event_date, language)}</p>
            <h2 id="record-detail-title" className="mt-1 text-xl font-semibold text-slate-950">
              {getFriendlyEventTitle(event)}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close details"
            className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-600"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-5 p-5 sm:p-6">
          <section>
            <h3 className="text-sm font-semibold text-slate-900">Record details</h3>
            <dl className="mt-3 divide-y divide-slate-100 rounded-xl border border-slate-200">
              {details.filter(([, value]) => value !== undefined && value !== null && String(value).trim()).map(([label, value]) => (
                <div key={label} className="grid grid-cols-[minmax(7rem,0.7fr)_1fr] gap-3 px-3 py-2.5 text-sm">
                  <dt className="text-slate-500">{label}</dt>
                  <dd className="break-words font-medium text-slate-900">{String(value)}</dd>
                </div>
              ))}
              {event.event_type === "LAB_RESULT" && (
                <div className="grid grid-cols-[minmax(7rem,0.7fr)_1fr] gap-3 px-3 py-2.5 text-sm">
                  <dt className="text-slate-500">Status</dt>
                  <dd className="font-medium text-slate-900">{getLabStatus(event)}</dd>
                </div>
              )}
            </dl>
          </section>

          {event.description && (
            <section>
              <h3 className="text-sm font-semibold text-slate-900">Additional context</h3>
              <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-700">{event.description}</p>
            </section>
          )}

          <section className="rounded-xl bg-slate-50 p-4">
            <h3 className="text-sm font-semibold text-slate-900">Source record</h3>
            <p className="mt-1 break-words text-sm text-slate-600">{event.source_document_title || "Source document"}</p>
            <Link
              href={`/documents/${encodeURIComponent(event.source_document_id)}`}
              prefetch={false}
              className="mt-3 inline-flex text-sm font-semibold text-teal-800 underline-offset-4 hover:underline"
            >
              Open document
            </Link>
            <details className="mt-4 border-t border-slate-200 pt-3">
              <summary className="cursor-pointer text-xs font-medium text-slate-600">Record reference</summary>
              <p className="mt-2 break-all font-mono text-xs text-slate-600">{event.source_document_id}</p>
              <p className="mt-1 break-all font-mono text-xs text-slate-500">Event: {event.id}</p>
            </details>
          </section>
        </div>
      </aside>
    </div>
  );
}

export default function TimelinePage() {
  const router = useRouter();
  const { token, isLoading: authLoading } = useAuth();
  const { language, isTamil, t } = useLanguage();
  const [timelineData, setTimelineData] = useState<TimelineResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [sortOrder, setSortOrder] = useState<"desc" | "asc">("desc");
  const [expandedDates, setExpandedDates] = useState<Record<string, boolean>>({});
  const [showNormal, setShowNormal] = useState<Record<string, boolean>>({});
  const [selectedEvent, setSelectedEvent] = useState<TimelineEventItem | null>(null);

  useEffect(() => {
    if (!authLoading && !token) router.push("/login?redirect=/timeline");
  }, [authLoading, token, router]);

  const fetchTimeline = async (isSync = false) => {
    if (!token) return;
    try {
      if (isSync) setSyncing(true);
      else setLoading(true);
      setError(null);
      if (isSync) await syncTimelineApi(token);
      const response = await getTimelineApi(token, {
        category: selectedCategory,
        search: searchQuery || undefined,
        start_date: startDate || undefined,
        end_date: endDate || undefined,
        order: sortOrder,
      });
      setTimelineData(response);
    } catch (err: unknown) {
      console.error("Failed to load timeline:", err);
      setError(err instanceof Error ? err.message : "Failed to load healthcare timeline.");
    } finally {
      setLoading(false);
      setSyncing(false);
    }
  };

  useEffect(() => {
    if (token) void fetchTimeline();
  }, [token, selectedCategory, sortOrder]);

  const episodes = useMemo(
    () => groupEventsByDate(timelineData?.grouped_events || []),
    [timelineData?.grouped_events],
  );
  const events = timelineData?.events || [];
  const visitCount = new Set(
    events.filter((event) => event.event_type === "ENCOUNTER").map((event) => event.source_document_id),
  ).size;
  const conditionCount = new Set(
    events.filter((event) => event.event_type === "DIAGNOSIS").map(getFriendlyEventTitle),
  ).size;
  const prescriptionCount = new Set(
    events.filter((event) => event.event_type === "MEDICATION").map(getFriendlyEventTitle),
  ).size;
  const latestTest = events
    .filter((event) => event.event_type === "LAB_RESULT")
    .sort((a, b) => new Date(b.event_date).getTime() - new Date(a.event_date).getTime())[0];
  const latestTestDate = latestTest ? formatDate(latestTest.event_date, language) : "—";

  const categories = [
    { key: "all", label: t("timeline", "cat_all", "All records") },
    { key: "documents", label: t("timeline", "cat_documents", "Documents") },
    { key: "medications", label: t("timeline", "cat_medications", "Medications") },
    { key: "laboratory", label: t("timeline", "cat_laboratory", "Laboratory") },
    { key: "diagnoses", label: t("timeline", "cat_diagnoses", "Conditions") },
    { key: "visits", label: t("timeline", "cat_visits", "Visits") },
  ];

  const toggleAll = () => {
    const shouldExpand = episodes.some((episode) => expandedDates[episode.date] === false);
    const next: Record<string, boolean> = {};
    episodes.forEach((episode) => { next[episode.date] = shouldExpand; });
    setExpandedDates(next);
  };

  const clearFilters = () => {
    setSelectedCategory("all");
    setSearchQuery("");
    setStartDate("");
    setEndDate("");
    setSortOrder("desc");
  };

  if (authLoading || (loading && !timelineData)) {
    return (
      <div className="flex min-h-[70vh] items-center justify-center p-6 text-center">
        <div>
          <Clock3 className="mx-auto h-8 w-8 animate-pulse text-teal-700" />
          <p className="mt-3 text-sm text-slate-600">Loading your care timeline…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50/70 pb-16 pt-6">
      <div className="mx-auto max-w-6xl space-y-6 px-4 sm:px-6 lg:px-8">
        <header className="space-y-5">
          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
            <div>
              <p className="text-sm font-medium text-teal-800">{isTamil ? "உங்கள் சுகாதார வரலாறு" : "Your health history"}</p>
              <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-950 sm:text-3xl">
                {isTamil ? "பராமரிப்பு காலவரிசை" : "Care timeline"}
              </h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
                {isTamil ? "உங்கள் பதிவுகள் தேதி வாரியாக ஒன்றாகக் காட்டப்படுகின்றன." : "Visits, test results, medicines and records, brought together by date."}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => void fetchTimeline(true)}
                disabled={syncing}
                className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-teal-700 disabled:opacity-60"
              >
                <RefreshCw className={`h-4 w-4 ${syncing ? "animate-spin" : ""}`} />
                {syncing ? "Updating…" : "Refresh records"}
              </button>
              <button
                type="button"
                onClick={toggleAll}
                className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-teal-700"
              >
                {episodes.length > 0 && episodes.every((episode) => expandedDates[episode.date] !== false) ? "Collapse all" : "Expand all"}
              </button>
            </div>
          </div>

          <section aria-label="Health timeline overview" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <SummaryStat label={isTamil ? "மருத்துவ வருகைகள்" : "Clinical visits"} value={visitCount} icon={Stethoscope} />
            <SummaryStat label={isTamil ? "பதிவுசெய்த நிலைகள்" : "Conditions on record"} value={conditionCount} icon={Activity} />
            <SummaryStat label={isTamil ? "பதிவுசெய்த மருந்துகள்" : "Prescriptions on record"} value={prescriptionCount} icon={Pill} />
            <SummaryStat label={isTamil ? "சமீபத்திய பரிசோதனை" : "Latest test date"} value={latestTestDate} icon={CalendarDays} />
          </section>
        </header>

        {error && (
          <div role="alert" className="flex items-start justify-between gap-4 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-900">
            <p>{error}</p>
            <button type="button" className="shrink-0 font-semibold underline" onClick={() => void fetchTimeline()}>
              Retry
            </button>
          </div>
        )}

        <section aria-label="Timeline filters" className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5">
          <div className="flex gap-2 overflow-x-auto pb-1">
            {categories.map((category) => (
              <button
                key={category.key}
                type="button"
                onClick={() => setSelectedCategory(category.key)}
                aria-pressed={selectedCategory === category.key}
                className={`whitespace-nowrap rounded-full px-3.5 py-2 text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-teal-700 ${
                  selectedCategory === category.key ? "bg-teal-800 text-white" : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                }`}
              >
                {category.label}
              </button>
            ))}
          </div>
          <form
            onSubmit={(event) => { event.preventDefault(); void fetchTimeline(); }}
            className="mt-4 grid gap-3 border-t border-slate-100 pt-4 sm:grid-cols-2 lg:grid-cols-[minmax(14rem,1fr)_auto_auto_auto]"
          >
            <label className="relative">
              <span className="sr-only">Search health records</span>
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Search tests, medicines or records"
                className="w-full rounded-lg border border-slate-300 py-2 pl-9 pr-3 text-sm text-slate-900 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-teal-700"
              />
            </label>
            <label>
              <span className="sr-only">Start date</span>
              <input aria-label="Start date" type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-teal-700" />
            </label>
            <label>
              <span className="sr-only">End date</span>
              <input aria-label="End date" type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-teal-700" />
            </label>
            <div className="flex gap-2">
              <button type="submit" className="flex-1 rounded-lg bg-teal-800 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-900 focus:outline-none focus:ring-2 focus:ring-teal-700 focus:ring-offset-2">
                Apply
              </button>
              {(searchQuery || startDate || endDate || selectedCategory !== "all") && (
                <button type="button" onClick={clearFilters} aria-label="Clear filters" className="rounded-lg border border-slate-300 px-3 text-slate-600 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-teal-700">
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
          </form>
        </section>

        {episodes.length === 0 ? (
          <div className="rounded-xl border border-slate-200 bg-white px-5 py-10 text-center">
            <CalendarDays className="mx-auto h-8 w-8 text-slate-400" />
            <h2 className="mt-3 text-base font-semibold text-slate-900">No records found</h2>
            <p className="mt-1 text-sm text-slate-600">Try changing your search or date filters.</p>
            <button type="button" onClick={clearFilters} className="mt-3 text-sm font-semibold text-teal-800 underline underline-offset-4">Clear filters</button>
          </div>
        ) : (
          <ol className="relative space-y-4 before:absolute before:bottom-5 before:left-[1.125rem] before:top-5 before:w-px before:bg-slate-300 sm:before:left-[1.375rem]">
            {episodes.map((episode) => {
              const isExpanded = expandedDates[episode.date] !== false;
              const labEvents = episode.events.filter((event) => event.event_type === "LAB_RESULT");
              const normalCount = labEvents.filter((event) => getLabStatus(event) === "Normal").length;
              const visibleLabs = showNormal[episode.date]
                ? labEvents
                : labEvents.filter((event) => getLabStatus(event) !== "Normal");
              const diagnoses = episode.events.filter((event) => event.event_type === "DIAGNOSIS");
              const medications = episode.events.filter((event) => event.event_type === "MEDICATION");
              const encounters = episode.events.filter((event) => event.event_type === "ENCOUNTER");
              const documents = Array.from(new Map(
                episode.events
                  .filter((event) => ["DOCUMENT", "DIAGNOSTIC_REPORT", "DISCHARGE", "ENCOUNTER", "LAB_RESULT", "MEDICATION", "DIAGNOSIS"].includes(event.event_type))
                  .map((event) => [event.source_document_id, event]),
              ).values());
              const provider = [...episode.events].map((event) => metadata(event).doctor_name).find(Boolean);
              const facility = [...episode.events].map((event) => metadata(event).hospital_name).find(Boolean);
              const EpisodeIcon = getEpisodeIcon(episode.events);
              const visitType = encounters.length
                ? "Visit"
                : labEvents.length
                  ? "Test results"
                  : medications.length
                    ? "Prescription"
                    : diagnoses.length
                      ? "Condition recorded"
                      : "Health record";

              return (
                <li key={episode.date} className="relative pl-11 sm:pl-14">
                  <span className="absolute left-0 top-4 z-10 flex h-9 w-9 items-center justify-center rounded-full border-4 border-slate-50 bg-teal-800 text-white sm:h-11 sm:w-11">
                    <EpisodeIcon aria-hidden="true" className="h-4 w-4 sm:h-5 sm:w-5" />
                  </span>
                  <article className="overflow-hidden rounded-xl border border-slate-200 bg-white">
                    <button
                      type="button"
                      onClick={() => setExpandedDates((current) => ({ ...current, [episode.date]: !isExpanded }))}
                      aria-expanded={isExpanded}
                      className="flex w-full items-start justify-between gap-3 p-4 text-left hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-teal-700 sm:p-5"
                    >
                      <span className="min-w-0">
                        <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                          <span className="text-base font-semibold text-slate-950">{episode.displayDate || formatDate(episode.date, language)}</span>
                          <span className="rounded-full bg-teal-50 px-2.5 py-1 text-xs font-medium text-teal-900">{visitType}</span>
                        </span>
                        {(provider || facility) && (
                          <span className="mt-1.5 block truncate text-sm text-slate-600">
                            {[provider, facility].filter(Boolean).join(" • ")}
                          </span>
                        )}
                        <span className="mt-1 block text-xs text-slate-500">
                          {episode.events.length} {episode.events.length === 1 ? "record" : "records"} grouped for this date
                        </span>
                      </span>
                      {isExpanded ? <ChevronUp aria-hidden="true" className="mt-1 h-5 w-5 shrink-0 text-slate-500" /> : <ChevronDown aria-hidden="true" className="mt-1 h-5 w-5 shrink-0 text-slate-500" />}
                    </button>

                    {isExpanded && (
                      <div className="space-y-5 border-t border-slate-100 px-4 py-4 sm:px-5">
                        {labEvents.length > 0 && (
                          <section>
                            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                              <h3 className="text-sm font-semibold text-slate-900">Test results</h3>
                              {normalCount > 0 && (
                                <button
                                  type="button"
                                  onClick={() => setShowNormal((current) => ({ ...current, [episode.date]: !current[episode.date] }))}
                                  className="text-xs font-medium text-teal-800 underline-offset-4 hover:underline focus:outline-none focus:ring-2 focus:ring-teal-700"
                                >
                                  {showNormal[episode.date]
                                    ? "Hide normal results"
                                    : `Show all ${labEvents.length} results (${normalCount} normal hidden)`}
                                </button>
                              )}
                            </div>
                            <div className="overflow-x-auto rounded-lg border border-slate-200">
                              <table className="w-full min-w-[34rem] text-left text-sm">
                                <thead className="bg-slate-50 text-xs font-semibold text-slate-600">
                                  <tr>
                                    <th className="px-3 py-2.5">Test</th>
                                    <th className="px-3 py-2.5">Result</th>
                                    <th className="px-3 py-2.5">Reference range</th>
                                    <th className="px-3 py-2.5">Status</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                  {visibleLabs.map((event) => {
                                    const meta = metadata(event);
                                    const status = getLabStatus(event);
                                    return (
                                      <tr key={event.id} className="cursor-pointer hover:bg-teal-50/40" onClick={() => setSelectedEvent(event)}>
                                        <td className="px-3 py-3 font-medium text-slate-900">
                                          <button type="button" className="text-left focus:outline-none focus:underline" onClick={(e) => { e.stopPropagation(); setSelectedEvent(event); }}>
                                            {getFriendlyEventTitle(event)}
                                          </button>
                                        </td>
                                        <td className="px-3 py-3 text-slate-800">{[meta.value, meta.unit].filter(Boolean).join(" ") || "—"}</td>
                                        <td className="px-3 py-3 text-slate-600">{meta.reference_range || "—"}</td>
                                        <td className="px-3 py-3"><span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${statusStyle(status)}`}>{status}</span></td>
                                      </tr>
                                    );
                                  })}
                                  {visibleLabs.length === 0 && (
                                    <tr><td colSpan={4} className="px-3 py-3 text-sm text-slate-600">No flagged results are recorded for this date.</td></tr>
                                  )}
                                </tbody>
                              </table>
                            </div>
                          </section>
                        )}

                        {(diagnoses.length > 0 || medications.length > 0) && (
                          <section>
                            <h3 className="mb-2 text-sm font-semibold text-slate-900">Conditions and prescriptions</h3>
                            <div className="flex flex-wrap gap-2">
                              {diagnoses.map((event) => (
                                <button key={event.id} type="button" onClick={() => setSelectedEvent(event)} className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-700 hover:border-teal-600 hover:bg-teal-50 focus:outline-none focus:ring-2 focus:ring-teal-700">
                                  Condition recorded: {getFriendlyEventTitle(event)}
                                </button>
                              ))}
                              {medications.map((event) => {
                                const meta = metadata(event);
                                const name = [getFriendlyEventTitle(event), meta.dosage].filter(Boolean).join(" ");
                                const frequency = meta.frequency ? ` · ${meta.frequency}` : "";
                                return (
                                  <button key={event.id} type="button" onClick={() => setSelectedEvent(event)} className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-700 hover:border-teal-600 hover:bg-teal-50 focus:outline-none focus:ring-2 focus:ring-teal-700">
                                    Prescription: {name}{frequency}
                                  </button>
                                );
                              })}
                            </div>
                          </section>
                        )}

                        {documents.length > 0 && (
                          <section className="border-t border-slate-100 pt-4">
                            <h3 className="mb-2 text-sm font-semibold text-slate-900">Attached records</h3>
                            <div className="flex flex-wrap gap-2">
                              {documents.map((event) => (
                                <Link
                                  key={event.source_document_id}
                                  href={`/documents/${encodeURIComponent(event.source_document_id)}`}
                                  prefetch={false}
                                  className="inline-flex max-w-full items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-teal-900 hover:bg-teal-50 focus:outline-none focus:ring-2 focus:ring-teal-700"
                                >
                                  <FileText aria-hidden="true" className="h-4 w-4 shrink-0" />
                                  <span className="truncate">{event.source_document_title || "Open health record"}</span>
                                </Link>
                              ))}
                            </div>
                          </section>
                        )}

                        {!labEvents.length && !diagnoses.length && !medications.length && !documents.length && (
                          <p className="text-sm text-slate-600">This date has a health record.</p>
                        )}
                      </div>
                    )}
                  </article>
                </li>
              );
            })}
          </ol>
        )}

        <p className="pb-2 text-center text-xs leading-5 text-slate-500">
          {isTamil ? "இந்தத் தகவல் உங்கள் பதிவுகளிலிருந்து எடுக்கப்பட்டது; இது மருத்துவ ஆலோசனை அல்ல." : "This timeline summarizes information in your records and is not a diagnosis or a substitute for medical advice."}
        </p>
      </div>
      <EventDetailDrawer event={selectedEvent} onClose={() => setSelectedEvent(null)} language={language} />
    </div>
  );
}
