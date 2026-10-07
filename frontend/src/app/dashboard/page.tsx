"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  ArrowRight,
  Bot,
  CheckCircle2,
  Clock3,
  FileText,
  Pill,
  RefreshCw,
  UploadCloud,
} from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import {
  getDocumentsApi,
  getHealthSummaryApi,
  getLabDashboardApi,
  getTimelineApi,
  HealthSummaryResponse,
  LabDashboardData,
  MedicalDocument,
  MedicationSummaryItem,
  TimelineEventItem,
} from "@/lib/api";
import { useLanguage } from "@/lib/language-context";

type ResourceName = "documents" | "laboratory" | "summary" | "timeline";

function formatDate(value: string, locale: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Date not available";
  return new Intl.DateTimeFormat(locale, {
    day: "2-digit",
    month: "short",
  }).format(date);
}

function Heading({ id, children }: { id: string; children: React.ReactNode }) {
  return (
    <h2 id={id} className="text-lg font-semibold tracking-tight text-slate-950">
      {children}
    </h2>
  );
}

export default function DashboardPage() {
  const { user, token, isLoading: authLoading } = useAuth();
  const { language } = useLanguage();
  const router = useRouter();
  const [documents, setDocuments] = useState<MedicalDocument[]>([]);
  const [labDashboard, setLabDashboard] = useState<LabDashboardData | null>(null);
  const [healthSummary, setHealthSummary] = useState<HealthSummaryResponse | null>(null);
  const [timeline, setTimeline] = useState<TimelineEventItem[]>([]);
  const [failedResources, setFailedResources] = useState<ResourceName[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) router.push("/login?redirect=/dashboard");
  }, [authLoading, user, router]);

  const loadDashboardData = useCallback(async () => {
    if (!token) return;
    setRefreshing(true);
    const [documentsResult, laboratoryResult, summaryResult, timelineResult] =
      await Promise.allSettled([
        getDocumentsApi(token),
        getLabDashboardApi(token),
        getHealthSummaryApi(token, language),
        getTimelineApi(token, { order: "desc" }),
      ]);

    const failures: ResourceName[] = [];
    if (documentsResult.status === "fulfilled") {
      setDocuments(documentsResult.value);
    } else {
      failures.push("documents");
    }
    if (laboratoryResult.status === "fulfilled") {
      setLabDashboard(laboratoryResult.value);
    } else {
      failures.push("laboratory");
    }
    if (summaryResult.status === "fulfilled") {
      setHealthSummary(summaryResult.value);
    } else {
      failures.push("summary");
    }
    if (timelineResult.status === "fulfilled") {
      setTimeline(timelineResult.value.events || []);
    } else {
      failures.push("timeline");
    }

    setFailedResources(failures);
    setLoading(false);
    setRefreshing(false);
  }, [token, language]);

  useEffect(() => {
    if (token) void loadDashboardData();
  }, [token, loadDashboardData]);

  const medications: MedicationSummaryItem[] = healthSummary?.summary?.medications || [];
  const allLabResults = labDashboard?.recent_interpretations || [];
  const latestLabResultCount = useMemo(() => {
    if (allLabResults.length === 0) return labDashboard?.total_tests ?? 0;
    const latestDocumentId = [...allLabResults].sort(
      (first, second) =>
        new Date(second.created_at).getTime() - new Date(first.created_at).getTime()
    )[0].document_id;
    return allLabResults.filter((result) => result.document_id === latestDocumentId).length;
  }, [allLabResults, labDashboard]);
  const attentionResults = useMemo(
    () =>
      allLabResults
        .filter((result) => result.status === "HIGH" || result.status === "LOW")
        .sort(
          (first, second) =>
            new Date(second.created_at).getTime() - new Date(first.created_at).getTime()
        ),
    [allLabResults]
  );
  const latestPrescription = useMemo(
    () =>
      documents
        .filter((document) => document.document_type === "PRESCRIPTION")
        .sort(
          (first, second) =>
            new Date(second.upload_date).getTime() - new Date(first.upload_date).getTime()
        )[0],
    [documents]
  );
  const prescriptionMedicineCount = latestPrescription
    ? medications.filter(
        (medication) => medication.source_document_id === latestPrescription.id
      ).length
    : 0;
  const reviewDocuments = documents.filter(
    (document) =>
      document.processing_status === "FAILED" ||
      document.processing_status === "LOW_CONFIDENCE"
  );
  const attentionCount = attentionResults.length + reviewDocuments.length;
  const attentionHref = attentionResults[0]
    ? `/documents/${attentionResults[0].document_id}`
    : reviewDocuments[0]
    ? `/documents/${reviewDocuments[0].id}`
    : "/laboratory";
  const recentEvents = useMemo(
    () =>
      [...timeline]
        .sort(
          (first, second) =>
            new Date(second.event_date || second.created_at).getTime() -
            new Date(first.event_date || first.created_at).getTime()
        )
        .slice(0, 3),
    [timeline]
  );
  const locale = language === "ta" ? "ta-IN" : "en";
  const noHealthData =
    documents.length === 0 &&
    medications.length === 0 &&
    latestLabResultCount === 0 &&
    timeline.length === 0;
  const dataUnavailable =
    failedResources.includes("documents") ||
    failedResources.includes("laboratory") ||
    failedResources.includes("summary") ||
    failedResources.includes("timeline");
  const uploadDate = latestPrescription
    ? new Date(latestPrescription.upload_date)
    : null;
  const recentlyUploaded =
    uploadDate !== null &&
    !Number.isNaN(uploadDate.getTime()) &&
    Date.now() - uploadDate.getTime() < 7 * 24 * 60 * 60 * 1000;

  if (authLoading || (!user && loading)) {
    return (
      <div
        className="mx-auto w-full max-w-[1400px] space-y-5 px-4 py-6 sm:px-6 lg:px-8"
        aria-busy="true"
      >
        <div className="h-12 w-72 animate-pulse rounded bg-slate-200" />
        {Array.from({ length: 4 }, (_, index) => (
          <div
            key={index}
            className="h-20 animate-pulse rounded-lg border border-slate-200 bg-white"
          />
        ))}
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="mx-auto w-full max-w-[1400px] space-y-5 px-4 py-5 sm:px-6 lg:px-8 lg:py-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-950">
            Good morning, {user.full_name?.trim().split(/\s+/)[0] || "there"} 👋
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            Here&apos;s a simple overview of your health.
          </p>
        </div>
        {refreshing && !loading && (
          <span className="inline-flex items-center gap-2 text-sm text-slate-500" role="status">
            <RefreshCw className="h-4 w-4 animate-spin" aria-hidden="true" />
            Updating
          </span>
        )}
      </header>

      <section aria-labelledby="overview-heading">
        <Heading id="overview-heading">Health Overview</Heading>
        <div className="mt-2 rounded-lg border border-slate-200 bg-white px-4 py-4 sm:px-5">
          {loading ? (
            <p className="text-sm text-slate-500" role="status">
              Loading your health record…
            </p>
          ) : noHealthData && !dataUnavailable ? (
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-medium text-slate-900">Your health record is empty.</p>
                <p className="mt-0.5 text-sm text-slate-600">
                  Upload a medical document to get started.
                </p>
              </div>
              <Link
                href="/documents"
                className="inline-flex min-h-9 w-fit items-center gap-2 rounded-md bg-teal-800 px-3 py-2 text-sm font-semibold text-white transition hover:bg-teal-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600 focus-visible:ring-offset-2"
              >
                <UploadCloud className="h-4 w-4" aria-hidden="true" />
                Upload Document
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-1 divide-y divide-slate-100 sm:grid-cols-3 sm:divide-x sm:divide-y-0">
              <div className="py-2 sm:px-4 sm:py-0 sm:first:pl-0">
                <p className="text-sm text-slate-600">Medical Records</p>
                <p className="mt-1 text-xl font-semibold text-slate-950">
                  {failedResources.includes("documents") ? "—" : documents.length}
                  <span className="ml-1.5 text-sm font-normal text-slate-600">
                    {documents.length === 1 ? "Record" : "Records"}
                  </span>
                </p>
              </div>
              <div className="py-2 sm:px-4 sm:py-0">
                <p className="text-sm text-slate-600">Medicines</p>
                <p className="mt-1 text-xl font-semibold text-slate-950">
                  {failedResources.includes("summary") ? "—" : medications.length}
                  <span className="ml-1.5 text-sm font-normal text-slate-600">
                    {medications.length === 1 ? "Medicine" : "Medicines"}
                  </span>
                </p>
              </div>
              <div className="py-2 sm:px-4 sm:py-0 sm:last:pr-0">
                <p className="text-sm text-slate-600">Recent Tests</p>
                <p className="mt-1 text-xl font-semibold text-slate-950">
                  {failedResources.includes("laboratory") ? "—" : latestLabResultCount}
                  <span className="ml-1.5 text-sm font-normal text-slate-600">
                    {latestLabResultCount === 1 ? "Test" : "Tests"}
                  </span>
                </p>
              </div>
            </div>
          )}
          {failedResources.length > 0 && (
            <p className="mt-2 text-sm text-amber-900" role="status">
              Some health information couldn&apos;t be loaded. Refresh to try again.
            </p>
          )}
        </div>
      </section>

      <section aria-labelledby="attention-heading">
        <Heading id="attention-heading">Attention</Heading>
        <div className="mt-2 flex flex-col gap-3 rounded-lg border border-slate-200 bg-white px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          {loading ? (
            <p className="text-sm text-slate-500" role="status">Checking your records…</p>
          ) : attentionCount > 0 ? (
            <div className="flex items-start gap-2.5">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-800" aria-hidden="true" />
              <div>
                <p className="text-sm font-medium text-slate-900">Needs your attention</p>
                <p className="mt-0.5 text-sm text-slate-600">
                  {attentionCount} {attentionCount === 1 ? "item" : "items"} may need your attention.
                </p>
                {attentionResults[0] && (
                  <p className="mt-1 text-sm text-slate-600">
                    The report shows {attentionResults[0].test_name} outside the provided reference range.
                  </p>
                )}
              </div>
            </div>
          ) : dataUnavailable ? (
            <p className="text-sm text-slate-600">
              Attention items are unavailable until your records finish loading.
            </p>
          ) : (
            <div className="flex items-start gap-2.5">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-800" aria-hidden="true" />
              <div>
                <p className="text-sm font-medium text-slate-900">You&apos;re all caught up.</p>
                <p className="mt-0.5 text-sm text-slate-600">
                  No items currently need your attention.
                </p>
              </div>
            </div>
          )}
          {!loading && attentionCount > 0 && (
            <Link
              href={attentionHref}
              className="inline-flex shrink-0 items-center gap-1 text-sm font-semibold text-teal-800 hover:text-teal-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600"
            >
              View details <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          )}
        </div>
      </section>

      <section
        aria-label="Latest prescription and Health Copilot"
        className="grid grid-cols-1 gap-3 md:grid-cols-2"
      >
        <div className="rounded-lg border border-slate-200 bg-white p-4 sm:p-5">
          <div className="flex items-center gap-2">
            <Pill className="h-5 w-5 text-teal-800" aria-hidden="true" />
            <h2 className="text-base font-semibold text-slate-950">Latest Prescription</h2>
          </div>
          <div className="mt-3">
            {loading ? (
              <p className="text-sm text-slate-500" role="status">Loading prescription…</p>
            ) : failedResources.includes("documents") ? (
              <p className="text-sm text-slate-600">Prescription information couldn&apos;t be loaded.</p>
            ) : latestPrescription ? (
              <>
                <p className="text-sm font-medium text-slate-900">
                  {failedResources.includes("summary")
                    ? "Medicine details unavailable"
                    : `${prescriptionMedicineCount} ${
                        prescriptionMedicineCount === 1 ? "medicine" : "medicines"
                      } detected`}
                </p>
                <p className="mt-0.5 text-sm text-slate-600">
                  {recentlyUploaded
                    ? "Recently uploaded"
                    : `Uploaded ${formatDate(latestPrescription.upload_date, locale)}`}
                </p>
                <Link
                  href={`/documents/${latestPrescription.id}`}
                  className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-teal-800 hover:text-teal-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600"
                >
                  View prescription <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </Link>
              </>
            ) : (
              <>
                <p className="text-sm font-medium text-slate-900">No prescription uploaded yet.</p>
                <Link
                  href="/documents"
                  className="mt-1 inline-flex items-center gap-1 text-sm font-semibold text-teal-800 hover:text-teal-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600"
                >
                  Upload Prescription <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </Link>
              </>
            )}
          </div>
        </div>

        <Link
          href="/copilot"
          className="group relative rounded-lg border border-teal-200 bg-teal-50/60 p-4 pr-14 transition hover:border-teal-300 hover:bg-teal-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600 sm:p-5 sm:pr-16"
        >
          <h2 className="text-base font-semibold text-slate-950">Health Copilot</h2>
          <p className="mt-3 text-sm leading-5 text-slate-700">
            Ask questions about your prescriptions, reports and health records.
          </p>
          <p className="mt-2 text-sm text-slate-600">
            Example: &ldquo;What did my doctor prescribe?&rdquo;
          </p>
          <span className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-teal-900">
            Ask Copilot <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" aria-hidden="true" />
          </span>
          <Bot
            className="absolute bottom-4 right-4 h-6 w-6 text-teal-800 sm:bottom-5 sm:right-5"
            aria-hidden="true"
          />
        </Link>
      </section>

      <section aria-labelledby="activity-heading">
        <div className="flex items-center justify-between gap-3">
          <Heading id="activity-heading">Recent activity</Heading>
          <Link
            href="/timeline"
            className="inline-flex shrink-0 items-center gap-1 text-sm font-semibold text-teal-800 hover:text-teal-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600"
          >
            View full timeline <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        </div>
        <div className="mt-2 rounded-lg border border-slate-200 bg-white px-4">
          {loading ? (
            <p className="py-4 text-sm text-slate-500" role="status">Loading activity…</p>
          ) : failedResources.includes("timeline") ? (
            <p className="py-4 text-sm text-slate-600">Recent activity couldn&apos;t be loaded.</p>
          ) : recentEvents.length > 0 ? (
            <ol>
              {recentEvents.map((event, index) => (
                <li
                  key={event.id}
                  className={`flex items-center gap-3 py-3 ${
                    index > 0 ? "border-t border-slate-100" : ""
                  }`}
                >
                  <time
                    dateTime={event.event_date || event.created_at}
                    className="w-14 shrink-0 text-xs font-medium text-slate-500"
                  >
                    {formatDate(event.event_date || event.created_at, locale)}
                  </time>
                  <span className="min-w-0 flex-1 truncate text-sm text-slate-800">
                    {event.title}
                  </span>
                  {event.source_document_id ? (
                    <Link
                      href={`/documents/${event.source_document_id}`}
                      aria-label={`Open ${event.title}`}
                      className="rounded p-1 text-slate-500 transition hover:bg-slate-100 hover:text-teal-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600"
                    >
                      <ArrowRight className="h-4 w-4" aria-hidden="true" />
                    </Link>
                  ) : (
                    <Clock3 className="h-4 w-4 shrink-0 text-slate-400" aria-hidden="true" />
                  )}
                </li>
              ))}
            </ol>
          ) : (
            <div className="flex flex-col gap-1 py-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-slate-600">
                Your health timeline will appear here as you add records.
              </p>
              <Link
                href="/documents"
                className="inline-flex items-center gap-1 text-sm font-semibold text-teal-800 hover:text-teal-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600"
              >
                Add a health record <FileText className="h-4 w-4" aria-hidden="true" />
              </Link>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
