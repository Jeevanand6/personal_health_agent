"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import {
  AbnormalResultSummaryItem,
  HealthSummaryResponse,
  LabObservationSummaryItem,
  generateHealthSummaryApi,
  getHealthSummaryApi,
} from "@/lib/api";
import { useLanguage } from "@/lib/language-context";
import { ArrowRight, ChevronDown, Globe2, LoaderCircle, Pill, RefreshCw } from "lucide-react";

type AttentionGroup = {
  key: string;
  testName: string;
  status: "HIGH" | "LOW";
  count: number;
  latestValue: string;
  unit?: string | null;
  referenceRange?: string | null;
  sourceDocumentId?: string | null;
  sourceDocumentTitle?: string | null;
  history: LabObservationSummaryItem[];
  latestObservation?: LabObservationSummaryItem;
};

type RecentResultGroup = {
  key: string;
  testName: string;
  latest: LabObservationSummaryItem;
  history: LabObservationSummaryItem[];
};

type OutOfRangeRecord = {
  test_name: string;
  value: string;
  unit?: string | null;
  reference_range?: string | null;
  status: "HIGH" | "LOW";
  source_document_id: string;
  source_document_title: string;
};

function normalizeTestName(name: string | null | undefined): string {
  return (name || "").trim().toLocaleLowerCase();
}

function isOutOfRangeStatus(status?: string): status is "HIGH" | "LOW" {
  return status === "HIGH" || status === "LOW";
}

function sortNewest<T extends { test_date?: string | null }>(items: T[]): T[] {
  return [...items].sort((first, second) => {
    const firstDate = first.test_date ? new Date(first.test_date).getTime() : 0;
    const secondDate = second.test_date ? new Date(second.test_date).getTime() : 0;
    return (Number.isNaN(secondDate) ? 0 : secondDate) - (Number.isNaN(firstDate) ? 0 : firstDate);
  });
}

function formatDate(value: string | null | undefined, locale: string): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat(locale, {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
}

function formatValue(value: string | null | undefined, unit?: string | null): string {
  if (!value) return "—";
  return unit ? `${value} ${unit}` : value;
}

function conciseOverview(value: string | null | undefined, fallback: string): string {
  if (!value?.trim()) return fallback;
  const text = value.trim();
  const sentences: string[] = [];
  let start = 0;
  for (let index = 0; index < text.length - 1 && sentences.length < 3; index += 1) {
    if (".!?。！？".includes(text[index]) && /\s/.test(text[index + 1])) {
      sentences.push(text.slice(start, index + 1).trim());
      index += 1;
      while (/\s/.test(text[index + 1] || "")) index += 1;
      start = index + 1;
    }
  }
  if (start < text.length) sentences.push(text.slice(start).trim());
  const patientFriendly = sentences.filter(
    (sentence) =>
      !/\b(synthesi[sz]ed|verified|database|analyzed|analysis|confidence|model|engine|physician review|deterministic|source document)\b/i.test(
        sentence
      )
  );
  return patientFriendly.slice(0, 4).join(" ") || fallback;
}

function buildAttentionGroups(
  outOfRangeRecords: OutOfRangeRecord[],
  observations: LabObservationSummaryItem[]
): AttentionGroup[] {
  const groups = new Map<string, OutOfRangeRecord[]>();
  outOfRangeRecords.forEach((item) => {
    const key = normalizeTestName(item.test_name);
    const current = groups.get(key) || [];
    current.push(item);
    groups.set(key, current);
  });

  const entries: Array<[string, OutOfRangeRecord[]]> = [];
  groups.forEach((items, key) => entries.push([key, items]));
  return entries.map(([key, items]) => {
    const history = sortNewest(
      observations.filter((observation) => normalizeTestName(observation.test_name) === key)
    );
    const candidates = items
      .map((item) => {
        const related = history.filter(
          (observation) =>
            observation.status === item.status &&
            observation.source_document_id === item.source_document_id
        );
        return { item, observation: related[0] };
      })
      .sort((first, second) => {
        const firstDate = first.observation?.test_date
          ? new Date(first.observation.test_date).getTime()
          : 0;
        const secondDate = second.observation?.test_date
          ? new Date(second.observation.test_date).getTime()
          : 0;
        return (Number.isNaN(secondDate) ? 0 : secondDate) - (Number.isNaN(firstDate) ? 0 : firstDate);
      });
    const latest = candidates.find((candidate) => candidate.observation) || candidates[0];
    const latestObservation = latest?.observation;
    const latestItem = latest?.item;

    return {
      key,
      testName: latestItem?.test_name || key,
      status: latestItem?.status === "LOW" ? "LOW" : "HIGH",
      count: items.length,
      latestValue: latestObservation?.value ?? latestItem?.value ?? "—",
      unit: latestObservation?.unit ?? latestItem?.unit,
      referenceRange: latestObservation?.reference_range ?? latestItem?.reference_range,
      sourceDocumentId: latestObservation?.source_document_id ?? latestItem?.source_document_id,
      sourceDocumentTitle:
        latestObservation?.source_document_title ?? latestItem?.source_document_title,
      history,
      latestObservation,
    };
  });
}

function buildRecentResults(observations: LabObservationSummaryItem[]): RecentResultGroup[] {
  const groups = new Map<string, LabObservationSummaryItem[]>();
  observations.forEach((observation) => {
    if (!observation?.test_name?.trim()) return;
    const key = normalizeTestName(observation.test_name);
    const current = groups.get(key) || [];
    current.push(observation);
    groups.set(key, current);
  });

  const entries: Array<[string, LabObservationSummaryItem[]]> = [];
  groups.forEach((items, key) => entries.push([key, items]));
  return entries
    .map(([key, history]) => ({
      key,
      testName: history[0]?.test_name || key,
      history: sortNewest(history),
      latest: sortNewest(history)[0],
    }))
    .filter((group) => Boolean(group.latest))
    .sort((first, second) => {
      const firstDate = first.latest.test_date ? new Date(first.latest.test_date).getTime() : 0;
      const secondDate = second.latest.test_date ? new Date(second.latest.test_date).getTime() : 0;
      return (Number.isNaN(secondDate) ? 0 : secondDate) - (Number.isNaN(firstDate) ? 0 : firstDate);
    });
}

function StatusLabel({ status, isTamil }: { status?: string | null; isTamil: boolean }) {
  const normalized = (status || "").toUpperCase();
  const label =
    normalized === "NORMAL"
      ? isTamil
        ? "இயல்பு"
        : "Normal"
      : normalized === "HIGH"
      ? isTamil
        ? "அதிகம்"
        : "High"
      : normalized === "LOW"
      ? isTamil
        ? "குறைவு"
        : "Low"
      : isTamil
      ? "தெரியவில்லை"
      : "Not available";
  const className =
    normalized === "NORMAL"
      ? "bg-emerald-50 text-emerald-800"
      : normalized === "HIGH" || normalized === "LOW"
      ? "bg-amber-50 text-amber-900"
      : "bg-slate-100 text-slate-700";

  return (
    <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${className}`}>
      {label}
    </span>
  );
}

function ResultDetails({
  history,
  latest,
  status,
  referenceRange,
  sourceDocumentId,
  sourceDocumentTitle,
  isTamil,
  locale,
}: {
  history: LabObservationSummaryItem[];
  latest: LabObservationSummaryItem;
  status: string;
  referenceRange?: string | null;
  sourceDocumentId?: string | null;
  sourceDocumentTitle?: string | null;
  isTamil: boolean;
  locale: string;
}) {
  const latestIndex = history.indexOf(latest);
  const previousValues =
    latestIndex >= 0
      ? history.slice(latestIndex + 1, latestIndex + 6)
      : history.slice(1, 6);
  const normalized = status.toUpperCase();
  const explanation =
    normalized === "HIGH"
      ? isTamil
        ? "வழங்கப்பட்ட குறிப்பு வரம்பை விட இந்த மதிப்பு அதிகமாக உள்ளது."
        : "The provided reference range marks this result as high."
      : normalized === "LOW"
      ? isTamil
        ? "வழங்கப்பட்ட குறிப்பு வரம்பை விட இந்த மதிப்பு குறைவாக உள்ளது."
        : "The provided reference range marks this result as low."
      : normalized === "NORMAL"
      ? isTamil
        ? "இந்த முடிவு அறிக்கையில் இயல்பானதாகக் குறிக்கப்பட்டுள்ளது."
        : "The report marks this result within its reference range."
      : isTamil
      ? "இந்த முடிவுக்கு தெளிவான நிலை அறிக்கையில் இல்லை."
      : "The report does not include a clear status for this result.";

  return (
    <div className="mt-3 space-y-3 rounded-lg bg-slate-50 p-3 text-sm">
      <p className="text-slate-700">{explanation}</p>
      <div className="grid gap-2 sm:grid-cols-2">
        <p>
          <span className="text-slate-500">{isTamil ? "சமீபத்திய மதிப்பு: " : "Latest value: "}</span>
          <span className="font-medium text-slate-800">{formatValue(latest.value, latest.unit)}</span>
        </p>
        <p>
          <span className="text-slate-500">{isTamil ? "குறிப்பு வரம்பு: " : "Reference range: "}</span>
          <span className="font-medium text-slate-800">{referenceRange || "—"}</span>
        </p>
        {latest.test_date && (
          <p>
            <span className="text-slate-500">{isTamil ? "தேதி: " : "Date: "}</span>
            <span className="font-medium text-slate-800">{formatDate(latest.test_date, locale)}</span>
          </p>
        )}
      </div>
      {previousValues.length > 0 && (
        <div>
          <p className="mb-1 text-xs font-semibold text-slate-600">
            {isTamil ? "முந்தைய முடிவுகள்" : "Previous results"}
          </p>
          <ul className="flex flex-wrap gap-x-4 gap-y-1">
            {previousValues.map((item, index) => (
              <li key={`${item.source_document_id}-${item.test_date || index}`} className="text-slate-700">
                {formatValue(item.value, item.unit)}
                {item.test_date && (
                  <span className="ml-1 text-slate-500">· {formatDate(item.test_date, locale)}</span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
      {sourceDocumentId && (
        <Link
          href={`/documents/${sourceDocumentId}`}
          className="inline-flex items-center gap-1 font-medium text-teal-800 hover:text-teal-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600"
        >
          {isTamil ? "மூல ஆவணத்தைப் பார்க்க" : `Source: ${sourceDocumentTitle || "View document"}`}
          <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
        </Link>
      )}
    </div>
  );
}

export default function HealthSummaryPage() {
  const router = useRouter();
  const { token, isLoading: authLoading } = useAuth();
  const { language, setLanguage } = useLanguage();
  const [summaryData, setSummaryData] = useState<HealthSummaryResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showAllResults, setShowAllResults] = useState(false);
  const [expandedAttention, setExpandedAttention] = useState<string | null>(null);
  const [expandedResult, setExpandedResult] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && !token) router.push("/login?redirect=/summary");
  }, [authLoading, token, router]);

  const fetchSummary = useCallback(
    async (lang: "en" | "ta", force = false) => {
      if (!token) return;
      try {
        if (force) setRefreshing(true);
        else setLoading(true);
        setError(null);
        const response = force
          ? await generateHealthSummaryApi(token, { language: lang, force_refresh: true })
          : await getHealthSummaryApi(token, lang);
        setSummaryData(response);
      } catch (loadError: unknown) {
        console.error("Failed to load health summary:", loadError);
        setError(
          language === "ta"
            ? "உங்கள் சுகாதார சுருக்கத்தை ஏற்ற முடியவில்லை. மீண்டும் முயற்சிக்கவும்."
            : "We couldn't load your health summary. Please try again."
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [token, language]
  );

  useEffect(() => {
    if (token) void fetchSummary(language);
  }, [token, language, fetchSummary]);

  const summary = summaryData?.summary;
  const snapshot = summary?.health_snapshot;
  const observations = summary?.laboratory_observations || [];
  const abnormalResults = summary?.abnormal_results || [];
  const medications = summary?.medications || [];
  const conditions = summary?.recent_diagnoses || [];
  const attentionRecords = useMemo(() => {
    const summaryRecords = abnormalResults
      .filter(
        (item): item is AbnormalResultSummaryItem & { status: "HIGH" | "LOW" } =>
          Boolean(item?.test_name?.trim()) && isOutOfRangeStatus(item.status)
      )
      .map((item) => ({
        test_name: item.test_name,
        value: item.value,
        unit: item.unit,
        reference_range: item.reference_range,
        status: item.status,
        source_document_id: item.source_document_id,
        source_document_title: item.source_document_title,
      }));
    if (summaryRecords.length > 0) return summaryRecords;
    return observations
      .filter(
        (item): item is LabObservationSummaryItem & { status: "HIGH" | "LOW" } =>
          Boolean(item?.test_name?.trim()) && isOutOfRangeStatus(item.status)
      )
      .map((item) => ({
        test_name: item.test_name,
        value: item.value,
        unit: item.unit,
        reference_range: item.reference_range,
        status: item.status,
        source_document_id: item.source_document_id,
        source_document_title: item.source_document_title,
      }));
  }, [abnormalResults, observations]);
  const attentionGroups = useMemo(
    () => buildAttentionGroups(attentionRecords, observations),
    [attentionRecords, observations]
  );
  const recentResults = useMemo(() => buildRecentResults(observations), [observations]);
  const attentionCount = attentionRecords.length;
  const normalCount = observations.filter((item) => item.status === "NORMAL").length;
  const unknownCount = observations.filter(
    (item) => item.status !== "NORMAL" && item.status !== "HIGH" && item.status !== "LOW"
  ).length;
  const hasAnyRecords =
    (snapshot?.total_records_analyzed || 0) > 0 ||
    medications.length > 0 ||
    observations.length > 0 ||
    conditions.length > 0;
  const overallStatus =
    attentionCount > 0
      ? language === "ta"
        ? "கவனம் தேவை"
        : "Needs Attention"
        : normalCount > 0 && unknownCount > 0
      ? language === "ta"
        ? "பெரும்பாலும் இயல்பு"
        : "Mostly Normal"
        : normalCount > 0
        ? language === "ta"
          ? "முக்கிய கவலைகள் இல்லை"
          : "No Major Concerns"
        : language === "ta"
      ? "முடிவுகள் இன்னும் இல்லை"
      : "No results yet";
  const overviewFallback =
    attentionCount > 0
      ? language === "ta"
        ? `${attentionCount} முடிவுகள் வழங்கப்பட்ட குறிப்பு வரம்பிற்கு வெளியே உள்ளதாக உங்கள் பதிவுகள் காட்டுகின்றன. இதில் ${attentionGroups.slice(0, 3).map((group) => group.testName).join(", ")} அடங்கும். ஒவ்வொரு முடிவின் மதிப்பு, வரலாறு மற்றும் மூல அறிக்கையை கீழே பார்க்கலாம்.`
        : `Your records include ${attentionCount} lab result${attentionCount === 1 ? "" : "s"} marked outside the provided reference range. These include ${attentionGroups.slice(0, 3).map((group) => group.testName).join(", ")}${attentionGroups.length > 3 ? " and other results" : ""}. Open a result below to review its value, history, and source report.`
      : normalCount > 0
      ? language === "ta"
        ? `${normalCount} முடிவுகள் வழங்கப்பட்ட குறிப்பு வரம்பிற்குள் உள்ளதாக உங்கள் பதிவுகள் காட்டுகின்றன. ஒவ்வொரு முடிவின் மதிப்பு மற்றும் மூல அறிக்கையை கீழே பார்க்கலாம்.`
        : `Your records include ${normalCount} lab result${normalCount === 1 ? "" : "s"} marked within their provided reference ranges. Open a result below to review its value and source report.`
      : hasAnyRecords
      ? language === "ta"
        ? `உங்கள் சுருக்கத்தில் ${snapshot?.total_records_analyzed || 0} மருத்துவப் பதிவுகள் மற்றும் ${medications.length} மருந்துகள் உள்ளன. மதிப்பாய்வு செய்ய ஆய்வக முடிவுகள் இன்னும் இல்லை.`
        : `Your summary includes ${snapshot?.total_records_analyzed || 0} medical record${snapshot?.total_records_analyzed === 1 ? "" : "s"} and ${medications.length} medication${medications.length === 1 ? "" : "s"}. No lab results are available to review yet.`
      : language === "ta"
      ? "இந்த சுருக்கத்தில் இன்னும் மருத்துவப் பதிவுகள் இல்லை. தொடங்க ஒரு மருத்துவ ஆவணத்தைப் பதிவேற்றவும்."
      : "There are no medical records in this summary yet. Upload a medical document to get started.";
  const locale = language === "ta" ? "ta-IN" : "en";
  const visibleResults = showAllResults ? recentResults : recentResults.slice(0, 7);

  if (authLoading || (loading && !summaryData)) {
    return (
      <div className="flex min-h-64 items-center justify-center px-4" aria-busy="true">
        <div className="flex items-center gap-3 text-sm text-slate-600" role="status">
          <LoaderCircle className="h-5 w-5 animate-spin text-teal-700" aria-hidden="true" />
          {language === "ta" ? "உங்கள் சுருக்கம் ஏற்றப்படுகிறது…" : "Loading your health summary…"}
        </div>
      </div>
    );
  }

  return (
    <main className="mx-auto w-full max-w-5xl space-y-6 px-4 py-6 sm:px-6 lg:py-8">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-950">
            {language === "ta" ? "உங்கள் சுகாதார சுருக்கம்" : "Your Health Summary"}
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <div className="inline-flex items-center rounded-md border border-slate-200 bg-white p-1" aria-label="Summary language">
            <Globe2 className="mx-1 h-4 w-4 text-slate-500" aria-hidden="true" />
            <button
              type="button"
              onClick={() => setLanguage("en")}
              aria-pressed={language === "en"}
              className={`rounded px-2 py-1 text-xs font-medium ${
                language === "en" ? "bg-teal-700 text-white" : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              EN
            </button>
            <button
              type="button"
              onClick={() => setLanguage("ta")}
              aria-pressed={language === "ta"}
              className={`rounded px-2 py-1 text-xs font-medium ${
                language === "ta" ? "bg-teal-700 text-white" : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              தமிழ்
            </button>
          </div>
          <button
            type="button"
            onClick={() => void fetchSummary(language, true)}
            disabled={refreshing}
            className="inline-flex items-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600 disabled:opacity-60"
          >
            <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} aria-hidden="true" />
            {language === "ta" ? "புதுப்பி" : "Refresh"}
          </button>
        </div>
      </header>

      {error && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900" role="alert">
          <p>{error}</p>
          <button
            type="button"
            onClick={() => void fetchSummary(language)}
            className="font-semibold underline underline-offset-2"
          >
            {language === "ta" ? "மீண்டும் முயற்சி" : "Try again"}
          </button>
        </div>
      )}

      {!summaryData ? (
        <section className="rounded-lg border border-slate-200 bg-white p-5">
          <p className="text-sm text-slate-700">
            {language === "ta"
              ? "உங்கள் பதிவுகளை இப்போது காட்ட முடியவில்லை."
              : "Your records aren't available right now."}
          </p>
        </section>
      ) : (
        <>
          <section className="rounded-lg border border-slate-200 bg-white p-5 sm:p-6">
            <h2 className="text-sm font-semibold text-slate-600">
              {language === "ta" ? "உங்கள் பதிவுகள் என்ன சொல்கின்றன?" : "What should I know?"}
            </h2>
            <p className="mt-2 max-w-3xl text-base leading-7 text-slate-800">
              {conciseOverview(
                snapshot?.overview_text,
                overviewFallback
              )}
            </p>
          </section>

          <section aria-label={language === "ta" ? "சுகாதார நிலை" : "Health status"} className="rounded-lg border border-slate-200 bg-white p-4 sm:p-5">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                  {language === "ta" ? "ஒட்டுமொத்த நிலை" : "Overall status"}
                </p>
                <p className="mt-1 flex items-center gap-2 text-lg font-semibold text-slate-950">
                  <span
                    className={`h-2.5 w-2.5 rounded-full ${
                      attentionCount > 0 ? "bg-amber-500" : normalCount > 0 ? "bg-emerald-500" : "bg-slate-400"
                    }`}
                    aria-hidden="true"
                  />
                  {overallStatus}
                </p>
              </div>
              <div className="grid grid-cols-2 gap-6 sm:min-w-72">
                <div>
                  <p className="text-xs text-slate-500">
                    {language === "ta" ? "கவனம் தேவை" : "Need attention"}
                  </p>
                  <p className="mt-1 text-xl font-semibold text-slate-950">{attentionCount}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">
                    {language === "ta" ? "இயல்பான முடிவுகள்" : "Normal results"}
                  </p>
                  <p className="mt-1 text-xl font-semibold text-slate-950">{normalCount}</p>
                </div>
              </div>
            </div>
          </section>

          <section aria-labelledby="attention-heading" className="space-y-3">
            <h2 id="attention-heading" className="text-lg font-semibold text-slate-950">
              {language === "ta" ? "உங்கள் கவனத்திற்கு" : "Needs your attention"}
            </h2>
            {attentionGroups.length > 0 ? (
              <div className="space-y-2">
                {attentionGroups.map((group) => {
                  const expanded = expandedAttention === group.key;
                  const latest = group.latestObservation || {
                    test_name: group.testName,
                    value: group.latestValue,
                    unit: group.unit,
                    reference_range: group.referenceRange,
                    status: group.status,
                    test_date: null,
                    source_document_id: group.sourceDocumentId || "",
                    source_document_title: group.sourceDocumentTitle || "",
                  };
                  const allHigh = group.history.length > 0
                    ? group.history.filter((item) => item.status === "HIGH").length === group.count
                    : group.status === "HIGH";
                  const allLow = group.history.length > 0
                    ? group.history.filter((item) => item.status === "LOW").length === group.count
                    : group.status === "LOW";
                  const rangeText = allHigh
                    ? language === "ta" ? "வழங்கப்பட்ட குறிப்பு வரம்பை விட அதிகம்" : "above the provided reference range"
                    : allLow
                    ? language === "ta" ? "வழங்கப்பட்ட குறிப்பு வரம்பை விட குறைவு" : "below the provided reference range"
                    : language === "ta" ? "குறிப்பு வரம்பிற்கு வெளியே" : "outside the provided reference range";

                  return (
                    <article key={group.key} className="rounded-lg border border-slate-200 bg-white p-4">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                          <h3 className="font-semibold text-slate-950">{group.testName}</h3>
                          <p className="mt-0.5 text-sm text-slate-600">
                            {group.count} {language === "ta" ? "சமீபத்திய முடிவுகள்" : `recent result${group.count === 1 ? "" : "s"}`} {rangeText}
                          </p>
                          <p className="mt-1 text-sm text-slate-800">
                            {language === "ta" ? "சமீபத்தியது: " : "Latest: "}
                            <span className="font-semibold">{formatValue(group.latestValue, group.unit)}</span>
                          </p>
                        </div>
                        <button
                          type="button"
                          aria-expanded={expanded}
                          onClick={() => setExpandedAttention(expanded ? null : group.key)}
                          className="inline-flex min-h-9 items-center gap-1 self-start rounded-md px-2 text-sm font-semibold text-teal-800 hover:bg-teal-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600 sm:self-center"
                        >
                          {expanded
                            ? language === "ta" ? "மூடு" : "Hide details"
                            : language === "ta" ? "விவரங்கள்" : "View details"}
                          <ChevronDown className={`h-4 w-4 transition-transform ${expanded ? "rotate-180" : ""}`} aria-hidden="true" />
                        </button>
                      </div>
                      {expanded && (
                        <ResultDetails
                          history={group.history}
                          latest={latest}
                          status={group.status}
                          referenceRange={group.referenceRange}
                          sourceDocumentId={group.sourceDocumentId}
                          sourceDocumentTitle={group.sourceDocumentTitle}
                          isTamil={language === "ta"}
                          locale={locale}
                        />
                      )}
                    </article>
                  );
                })}
              </div>
            ) : (
              <p className="rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600">
                {observations.length > 0
                  ? language === "ta"
                    ? "பதிவுசெய்யப்பட்ட முடிவுகளில் கவனம் தேவைப்படுவது எதுவும் இல்லை."
                    : "No recorded results currently need attention."
                  : language === "ta"
                  ? "இன்னும் ஆய்வக முடிவுகள் இல்லை."
                  : "No lab results to review yet."}
              </p>
            )}
          </section>

          <section aria-labelledby="medications-heading" className="space-y-3">
            <h2 id="medications-heading" className="text-lg font-semibold text-slate-950">
              {language === "ta" ? "மருந்துகள்" : "Medications"}
            </h2>
            {medications.length > 0 ? (
              <div className="divide-y divide-slate-100 rounded-lg border border-slate-200 bg-white px-4">
                {medications.map((medication, index) => (
                  <article key={`${medication.name}-${index}`} className="flex gap-3 py-3">
                    <Pill className="mt-0.5 h-4 w-4 shrink-0 text-teal-800" aria-hidden="true" />
                    <div className="min-w-0">
                      <h3 className="font-medium text-slate-950">
                        {medication.name}
                        {medication.dosage && <span className="ml-1.5 text-slate-700"> {medication.dosage}</span>}
                      </h3>
                      {medication.frequency && (
                        <p className="mt-0.5 text-sm text-slate-600">{medication.frequency}</p>
                      )}
                      {medication.instructions && (
                        <p className="mt-0.5 text-sm text-slate-600">{medication.instructions}</p>
                      )}
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <p className="rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600">
                {language === "ta" ? "மருந்துகள் பதிவு செய்யப்படவில்லை." : "No medications are listed in your records."}
              </p>
            )}
          </section>

          <section aria-labelledby="conditions-heading" className="space-y-3">
            <h2 id="conditions-heading" className="text-lg font-semibold text-slate-950">
              {language === "ta" ? "சமீபத்திய சுகாதார நிலைகள்" : "Recent health conditions"}
            </h2>
            {conditions.length > 0 ? (
              <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200 bg-white px-4">
                {conditions.map((condition, index) => (
                  <li key={`${condition.condition_name}-${condition.recorded_date || index}`} className="flex flex-wrap items-center justify-between gap-2 py-3">
                    <span className="font-medium text-slate-900">{condition.condition_name}</span>
                    {condition.recorded_date && (
                      <time dateTime={condition.recorded_date} className="text-sm text-slate-500">
                        {formatDate(condition.recorded_date, locale)}
                      </time>
                    )}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600">
                {language === "ta" ? "பதிவுசெய்யப்பட்ட சுகாதார நிலைகள் இல்லை." : "No health conditions are listed in your records."}
              </p>
            )}
          </section>

          <section aria-labelledby="results-heading" className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 id="results-heading" className="text-lg font-semibold text-slate-950">
                {language === "ta" ? "சமீபத்திய பரிசோதனை முடிவுகள்" : "Recent test results"}
              </h2>
              {recentResults.length > 7 && (
                <button
                  type="button"
                  onClick={() => setShowAllResults((current) => !current)}
                  className="text-sm font-semibold text-teal-800 hover:text-teal-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600"
                >
                  {showAllResults
                    ? language === "ta" ? "குறைவாகக் காட்டு" : "Show fewer"
                    : language === "ta" ? "அனைத்து முடிவுகளையும் காட்டு" : "View all results"}
                </button>
              )}
            </div>
            {recentResults.length > 0 ? (
              <>
                <div className="hidden overflow-hidden rounded-lg border border-slate-200 bg-white sm:block">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-slate-50 text-xs font-medium text-slate-600">
                      <tr>
                        <th className="px-4 py-3">{language === "ta" ? "பரிசோதனை" : "Test"}</th>
                        <th className="px-4 py-3">{language === "ta" ? "சமீபத்திய முடிவு" : "Latest result"}</th>
                        <th className="px-4 py-3">{language === "ta" ? "நிலை" : "Status"}</th>
                        <th className="px-4 py-3">{language === "ta" ? "தேதி" : "Date"}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {visibleResults.map((group) => {
                        const expanded = expandedResult === group.key;
                        return (
                          <React.Fragment key={group.key}>
                            <tr>
                              <td className="px-4 py-3">
                                <button
                                  type="button"
                                  aria-expanded={expanded}
                                  onClick={() => setExpandedResult(expanded ? null : group.key)}
                                  className="text-left font-medium text-slate-900 hover:text-teal-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600"
                                >
                                  {group.testName}
                                </button>
                              </td>
                              <td className="px-4 py-3 text-slate-800">{formatValue(group.latest.value, group.latest.unit)}</td>
                              <td className="px-4 py-3"><StatusLabel status={group.latest.status} isTamil={language === "ta"} /></td>
                              <td className="px-4 py-3 text-slate-600">{formatDate(group.latest.test_date, locale) || "—"}</td>
                            </tr>
                            {expanded && (
                              <tr>
                                <td colSpan={4} className="px-4 pb-3">
                                  <ResultDetails
                                    history={group.history}
                                    latest={group.latest}
                                    status={group.latest.status}
                                    referenceRange={group.latest.reference_range}
                                    sourceDocumentId={group.latest.source_document_id}
                                    sourceDocumentTitle={group.latest.source_document_title}
                                    isTamil={language === "ta"}
                                    locale={locale}
                                  />
                                </td>
                              </tr>
                            )}
                          </React.Fragment>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <div className="space-y-2 sm:hidden">
                  {visibleResults.map((group) => {
                    const expanded = expandedResult === group.key;
                    return (
                      <article key={group.key} className="rounded-lg border border-slate-200 bg-white p-3">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <h3 className="font-medium text-slate-950">{group.testName}</h3>
                            <p className="mt-1 text-sm text-slate-700">{formatValue(group.latest.value, group.latest.unit)}</p>
                            {group.latest.test_date && (
                              <p className="mt-1 text-xs text-slate-500">{formatDate(group.latest.test_date, locale)}</p>
                            )}
                          </div>
                          <StatusLabel status={group.latest.status} isTamil={language === "ta"} />
                        </div>
                        <button
                          type="button"
                          aria-expanded={expanded}
                          onClick={() => setExpandedResult(expanded ? null : group.key)}
                          className="mt-2 text-sm font-semibold text-teal-800"
                        >
                          {expanded
                            ? language === "ta" ? "மூடு" : "Hide details"
                            : language === "ta" ? "விவரங்கள்" : "View details"}
                        </button>
                        {expanded && (
                          <ResultDetails
                            history={group.history}
                            latest={group.latest}
                            status={group.latest.status}
                            referenceRange={group.latest.reference_range}
                            sourceDocumentId={group.latest.source_document_id}
                            sourceDocumentTitle={group.latest.source_document_title}
                            isTamil={language === "ta"}
                            locale={locale}
                          />
                        )}
                      </article>
                    );
                  })}
                </div>
              </>
            ) : (
              <p className="rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600">
                {language === "ta" ? "ஆய்வக முடிவுகள் இன்னும் இல்லை." : "No recent test results are available."}
              </p>
            )}
          </section>
        </>
      )}

      <p className="border-t border-slate-200 pt-4 text-xs leading-5 text-slate-500">
        {language === "ta"
          ? "இந்தத் தகவல் உங்கள் பதிவுகளைப் புரிந்துகொள்ள உதவுகிறது; இது நோயறிதல் அல்ல அல்லது மருத்துவ ஆலோசனைக்கு மாற்றாகாது."
          : "This information is for understanding your records and is not a diagnosis or a substitute for medical advice."}
      </p>
    </main>
  );
}
