"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { useLanguage } from "@/lib/language-context";
import { useDemoMode } from "@/components/DemoModeBanner";
import {
  FileText,
  Calendar,
  Pill,
  Activity,
  Shield,
  CheckCircle2,
  AlertTriangle,
  AlertOctagon,
  RefreshCw,
  Sparkles,
  ArrowRight,
  UploadCloud,
  Eye,
  FlaskConical,
  Clock,
  TrendingUp,
  FileCheck2,
  ChevronRight,
  Stethoscope,
  ExternalLink,
  ShieldCheck,
  HeartPulse,
} from "lucide-react";
import {
  getDocumentsApi,
  getLabDashboardApi,
  getHealthSummaryApi,
  getTimelineApi,
  MedicalDocument,
  LabDashboardData,
  HealthSummaryResponse,
  TimelineResponse,
  ObservationInterpretation,
  MedicationSummaryItem,
  AbnormalResultSummaryItem,
  TimelineEventItem,
} from "@/lib/api";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";
import StatusIndicator from "@/components/StatusIndicator";
import {
  CardSkeleton,
  MetricSkeleton,
  TimelineItemSkeleton,
} from "@/components/SkeletonLoader";
import EmptyState from "@/components/EmptyState";
import ErrorState from "@/components/ErrorState";

export default function DashboardPage() {
  const { user, token, isLoading: authLoading } = useAuth();
  const { language, isTamil, t } = useLanguage();
  const { isDemoMode } = useDemoMode();
  const router = useRouter();

  // Primary data states
  const [documents, setDocuments] = useState<MedicalDocument[]>([]);
  const [labDashboard, setLabDashboard] = useState<LabDashboardData | null>(null);
  const [healthSummary, setHealthSummary] = useState<HealthSummaryResponse | null>(null);
  const [timeline, setTimeline] = useState<TimelineResponse | null>(null);

  // Status states
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Authentication check
  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/login");
    }
  }, [authLoading, user, router]);

  // Load all dashboard components concurrently
  const loadDashboardData = useCallback(async () => {
    if (!token) return;
    setError(null);

    try {
      const [docsRes, labRes, summaryRes, timelineRes] = await Promise.allSettled([
        getDocumentsApi(token),
        getLabDashboardApi(token),
        getHealthSummaryApi(token, language),
        getTimelineApi(token),
      ]);

      if (docsRes.status === "fulfilled") {
        setDocuments(docsRes.value);
      }
      if (labRes.status === "fulfilled") {
        setLabDashboard(labRes.value);
      }
      if (summaryRes.status === "fulfilled") {
        setHealthSummary(summaryRes.value);
      }
      if (timelineRes.status === "fulfilled") {
        setTimeline(timelineRes.value);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to load dashboard data.";
      setError(msg);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [token, language]);

  useEffect(() => {
    if (token) {
      loadDashboardData();
    }
  }, [token, loadDashboardData]);

  const handleRefresh = () => {
    setRefreshing(true);
    loadDashboardData();
  };

  // Synthetic fallback data for explicit demo mode only
  const demoAttentionItems: AbnormalResultSummaryItem[] = isDemoMode
    ? [
        {
          test_name: "Fasting Blood Glucose",
          value: "138",
          unit: "mg/dL",
          reference_range: "70-99 mg/dL",
          status: "HIGH",
          severity: "REVIEW_RECOMMENDED",
          statement: "Fasting blood sugar is elevated above standard diabetic diagnostic threshold.",
          action_guidance: "Review with endocrinologist or primary care physician for HbA1c correlation.",
          source_document_id: "demo-doc-1",
          source_document_title: "Metabolic_Panel_Sept2024.pdf",
        },
        {
          test_name: "LDL Cholesterol",
          value: "162",
          unit: "mg/dL",
          reference_range: "< 100 mg/dL",
          status: "HIGH",
          severity: "REVIEW_RECOMMENDED",
          statement: "LDL cholesterol is elevated, conferring moderate cardiovascular risk.",
          action_guidance: "Discuss statin continuation and dietary low-saturated-fat regimen.",
          source_document_id: "demo-doc-1",
          source_document_title: "Lipid_Profile_Report.pdf",
        },
      ]
    : [];

  const demoMedications: MedicationSummaryItem[] = isDemoMode
    ? [
        {
          name: "Metformin Hydrochloride",
          dosage: "500 mg",
          frequency: "Twice daily with meals",
          route: "Oral",
          duration: "90 days",
          instructions: "Take with breakfast and dinner to reduce GI upset",
          source_document_id: "demo-doc-2",
          source_document_title: "Endocrinology_Prescription.pdf",
        },
        {
          name: "Atorvastatin Calcium",
          dosage: "20 mg",
          frequency: "Once daily at bedtime",
          route: "Oral",
          duration: "90 days",
          instructions: "Take at night",
          source_document_id: "demo-doc-2",
          source_document_title: "Endocrinology_Prescription.pdf",
        },
        {
          name: "Telmisartan",
          dosage: "40 mg",
          frequency: "Once daily in morning",
          route: "Oral",
          duration: "30 days",
          instructions: "Monitor blood pressure weekly",
          source_document_id: "demo-doc-3",
          source_document_title: "Cardiology_Clinic_Note.pdf",
        },
      ]
    : [];

  const demoTimeline: TimelineEventItem[] = isDemoMode
    ? [
        {
          id: "demo-ev-1",
          user_id: user?.id || "demo",
          event_type: "LAB_RESULT",
          event_date: "2024-09-18",
          title: "Comprehensive Metabolic Panel & Lipid Profile",
          description: "Glucose: 138 mg/dL (High), LDL: 162 mg/dL (High)",
          source_document_id: "demo-doc-1",
          source_document_title: "Metabolic_Panel_Sept2024.pdf",
          metadata_json: {},
          created_at: new Date().toISOString(),
        },
        {
          id: "demo-ev-2",
          user_id: user?.id || "demo",
          event_type: "MEDICATION",
          event_date: "2024-09-10",
          title: "Prescription Refill Issued",
          description: "Metformin 500mg BID, Atorvastatin 20mg QHS",
          source_document_id: "demo-doc-2",
          source_document_title: "Endocrinology_Prescription.pdf",
          metadata_json: {},
          created_at: new Date().toISOString(),
        },
        {
          id: "demo-ev-3",
          user_id: user?.id || "demo",
          event_type: "DOCUMENT",
          event_date: "2024-08-25",
          title: "Discharge Summary Filed",
          description: "Routine checkup and vitals assessment",
          source_document_id: "demo-doc-3",
          source_document_title: "Cardiology_Clinic_Note.pdf",
          metadata_json: {},
          created_at: new Date().toISOString(),
        },
      ]
    : [];

  // Determine active dataset (strictly real database records, or demo fallback if demo mode is enabled)
  const abnormalResults: AbnormalResultSummaryItem[] =
    healthSummary?.summary?.abnormal_results && healthSummary.summary.abnormal_results.length > 0
      ? healthSummary.summary.abnormal_results
      : demoAttentionItems;

  const activeMedications: MedicationSummaryItem[] =
    healthSummary?.summary?.medications && healthSummary.summary.medications.length > 0
      ? healthSummary.summary.medications
      : demoMedications;

  const recentTimelineEvents: TimelineEventItem[] =
    timeline?.events && timeline.events.length > 0
      ? timeline.events.slice(0, 4)
      : demoTimeline;

  const recentLabResults: ObservationInterpretation[] =
    labDashboard?.recent_interpretations && labDashboard.recent_interpretations.length > 0
      ? labDashboard.recent_interpretations.slice(0, 5)
      : [];

  const trendSeries = labDashboard?.trends && labDashboard.trends.length > 0 ? labDashboard.trends[0] : null;

  if (authLoading || (!user && loading)) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <MetricSkeleton />
          <MetricSkeleton />
          <MetricSkeleton />
          <MetricSkeleton />
        </div>
        <CardSkeleton lines={4} />
      </div>
    );
  }

  if (!user) return null;

  const patient = user.patient;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8 animate-in fade-in duration-300">
      {/* ---------------------------------------------------- */}
      {/* 1. PATIENT HEADER & QUICK ACTIONS                    */}
      {/* ---------------------------------------------------- */}
      <div className="bg-white rounded-2xl border border-slate-200/90 p-6 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-teal-600 to-emerald-500 flex items-center justify-center text-white font-bold text-xl shadow-md shadow-teal-500/20">
            {user.full_name
              ? user.full_name
                  .split(" ")
                  .map((n) => n[0])
                  .join("")
                  .slice(0, 2)
                  .toUpperCase()
              : "PT"}
          </div>
          <div className="space-y-1">
            <div className="flex items-center gap-2.5 flex-wrap">
              <h1 className="text-xl font-bold text-slate-900 tracking-tight">{user.full_name}</h1>
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200/80 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                <span>Active Clinical Session</span>
              </span>
              {patient?.abha_id && (
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-teal-50 text-teal-700 border border-teal-200/80 font-mono">
                  Mock ABHA: {patient.abha_id}
                </span>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500">
              <span>
                Blood Group: <strong className="text-slate-800">{patient?.blood_group || "Recorded in Profile"}</strong>
              </span>
              <span>&bull;</span>
              <span>
                Language: <strong className="text-slate-800">{language === "ta" ? "தமிழ்" : "English"}</strong>
              </span>
              <span>&bull;</span>
              <span>
                Records Verified: <strong className="text-slate-800">{documents.length}</strong>
              </span>
            </div>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2.5 self-stretch md:self-auto justify-end border-t md:border-t-0 pt-4 md:pt-0 border-slate-100 flex-wrap">
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors shadow-2xs"
            title="Refresh dashboard data"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? "animate-spin text-teal-600" : ""}`} />
            <span>Refresh</span>
          </button>
          <Link
            href="/documents"
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-teal-600 hover:bg-teal-700 text-white shadow-sm transition-colors"
          >
            <UploadCloud className="w-3.5 h-3.5" />
            <span>Upload Document</span>
          </Link>
        </div>
      </div>

      {/* Global Error Banner if data failed to load */}
      {error && (
        <ErrorState
          title="Data synchronization alert"
          message={error}
          onRetry={loadDashboardData}
        />
      )}

      {/* ---------------------------------------------------- */}
      {/* 2. ATTENTION-NEEDED SECTION                          */}
      {/* ---------------------------------------------------- */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-full bg-amber-500"></div>
            <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
              Attention-Needed Section
            </h2>
          </div>
          <span className="text-xs text-slate-500">
            {abnormalResults.length} clinical alert{abnormalResults.length === 1 ? "" : "s"} identified
          </span>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <CardSkeleton lines={2} />
            <CardSkeleton lines={2} />
          </div>
        ) : abnormalResults.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {abnormalResults.map((item, idx) => (
              <div
                key={idx}
                className="bg-white rounded-2xl border border-amber-200/90 p-5 shadow-xs relative overflow-hidden flex flex-col justify-between space-y-3 hover:border-amber-300 transition-colors"
              >
                <div className="absolute top-0 left-0 right-0 h-1 bg-amber-500"></div>
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm text-slate-900">{item.test_name}</span>
                      <StatusIndicator status={item.status} severity={item.severity} size="sm" />
                    </div>
                    <p className="text-xs text-slate-600 font-medium">
                      Observed: <strong className="text-amber-800">{item.value} {item.unit || ""}</strong>
                      {item.reference_range && (
                        <span className="text-slate-500 ml-1.5">(Ref: {item.reference_range})</span>
                      )}
                    </p>
                  </div>
                  <div className="p-2 rounded-xl bg-amber-50 text-amber-700 shrink-0">
                    <AlertTriangle className="w-4 h-4" />
                  </div>
                </div>

                <p className="text-xs text-slate-600 leading-relaxed bg-amber-50/60 p-2.5 rounded-xl border border-amber-100">
                  {item.statement}
                </p>

                {item.action_guidance && (
                  <p className="text-[11px] text-amber-900 font-medium">
                    Guidance: {item.action_guidance}
                  </p>
                )}

                {item.source_document_id && (
                  <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px]">
                    <span className="text-slate-400 truncate max-w-[200px]">
                      Source: {item.source_document_title || "Verified Document"}
                    </span>
                    <Link
                      href={`/documents/${item.source_document_id}`}
                      className="text-teal-700 font-semibold hover:underline inline-flex items-center gap-1 shrink-0"
                    >
                      <span>Inspect report</span>
                      <ArrowRight className="w-3 h-3" />
                    </Link>
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="bg-emerald-50/60 rounded-2xl border border-emerald-200/80 p-5 flex items-center gap-3.5 shadow-2xs">
            <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs font-bold text-emerald-900">
                All clinical markers currently within expected reference bounds
              </p>
              <p className="text-[11px] text-emerald-700">
                No out-of-range observations or critical physician attention items detected across your active health records.
              </p>
            </div>
          </div>
        )}
      </section>

      {/* ---------------------------------------------------- */}
      {/* 3. HEALTH OVERVIEW KPI CARDS                         */}
      {/* ---------------------------------------------------- */}
      <section className="space-y-3">
        <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
          Health Overview
        </h2>

        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <MetricSkeleton />
            <MetricSkeleton />
            <MetricSkeleton />
            <MetricSkeleton />
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Card 1: Documents */}
            <Link
              href="/documents"
              className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-2xs hover:border-teal-400 hover:shadow-sm transition-all space-y-3 group"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Medical Documents
                </span>
                <div className="p-2 rounded-xl bg-teal-50 text-teal-600 group-hover:scale-105 transition-transform">
                  <FileText className="w-4 h-4" />
                </div>
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-extrabold text-slate-900">{documents.length}</span>
                <span className="text-xs text-slate-500">records</span>
              </div>
              <p className="text-[11px] text-teal-600 font-semibold flex items-center gap-1 group-hover:translate-x-0.5 transition-transform">
                <span>View document vault</span>
                <ArrowRight className="w-3 h-3" />
              </p>
            </Link>

            {/* Card 2: Active Medications */}
            <Link
              href="/medications"
              className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-2xs hover:border-emerald-400 hover:shadow-sm transition-all space-y-3 group"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Active Medications
                </span>
                <div className="p-2 rounded-xl bg-emerald-50 text-emerald-600 group-hover:scale-105 transition-transform">
                  <Pill className="w-4 h-4" />
                </div>
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-extrabold text-slate-900">{activeMedications.length}</span>
                <span className="text-xs text-slate-500">prescriptions</span>
              </div>
              <p className="text-[11px] text-emerald-600 font-semibold flex items-center gap-1 group-hover:translate-x-0.5 transition-transform">
                <span>Manage prescriptions</span>
                <ArrowRight className="w-3 h-3" />
              </p>
            </Link>

            {/* Card 3: Lab Tests */}
            <Link
              href="/laboratory"
              className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-2xs hover:border-indigo-400 hover:shadow-sm transition-all space-y-3 group"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Lab Observations
                </span>
                <div className="p-2 rounded-xl bg-indigo-50 text-indigo-600 group-hover:scale-105 transition-transform">
                  <FlaskConical className="w-4 h-4" />
                </div>
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-extrabold text-slate-900">
                  {labDashboard?.total_tests || recentLabResults.length}
                </span>
                <span className="text-xs text-slate-500">biomarkers</span>
              </div>
              <p className="text-[11px] text-indigo-600 font-semibold flex items-center gap-1 group-hover:translate-x-0.5 transition-transform">
                <span>View lab dashboard</span>
                <ArrowRight className="w-3 h-3" />
              </p>
            </Link>

            {/* Card 4: Timeline Milestones */}
            <Link
              href="/timeline"
              className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-2xs hover:border-cyan-400 hover:shadow-sm transition-all space-y-3 group"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Timeline Events
                </span>
                <div className="p-2 rounded-xl bg-cyan-50 text-cyan-600 group-hover:scale-105 transition-transform">
                  <Clock className="w-4 h-4" />
                </div>
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-extrabold text-slate-900">
                  {timeline?.events?.length || recentTimelineEvents.length}
                </span>
                <span className="text-xs text-slate-500">milestones</span>
              </div>
              <p className="text-[11px] text-cyan-600 font-semibold flex items-center gap-1 group-hover:translate-x-0.5 transition-transform">
                <span>Explore health journey</span>
                <ArrowRight className="w-3 h-3" />
              </p>
            </Link>
          </div>
        )}
      </section>

      {/* ---------------------------------------------------- */}
      {/* 4. AI HEALTH SUMMARY & TIMELINE PREVIEW              */}
      {/* ---------------------------------------------------- */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: AI Health Summary (2 Cols) */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200/90 p-6 shadow-sm space-y-5">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-teal-50 border border-teal-200/80 text-teal-700 flex items-center justify-center shadow-2xs">
                <Sparkles className="w-4 h-4" />
              </div>
              <div>
                <h3 className="font-bold text-sm text-slate-900">AI Health Summary</h3>
                <p className="text-xs text-slate-500">Grounded clinical overview with verified citations</p>
              </div>
            </div>
            <Link
              href="/summary"
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-semibold bg-teal-50 text-teal-800 border border-teal-200/80 hover:bg-teal-100 transition-colors"
            >
              <span>View Full Summary</span>
              <ArrowRight className="w-3 h-3" />
            </Link>
          </div>

          {loading ? (
            <CardSkeleton lines={3} />
          ) : healthSummary?.summary?.health_snapshot ? (
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-100 space-y-2">
                <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wide">
                  {healthSummary.summary.health_snapshot.headline}
                </h4>
                <p className="text-xs text-slate-600 leading-relaxed">
                  {healthSummary.summary.health_snapshot.overview_text}
                </p>
              </div>

              {/* Source citations note */}
              <div className="flex items-center justify-between text-[11px] text-slate-500 px-1">
                <span className="flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-teal-600" />
                  <span>Synthesized from {healthSummary.source_documents?.length || documents.length} verified clinical files</span>
                </span>
                <span className="font-medium text-slate-600">Model: {healthSummary.model}</span>
              </div>
            </div>
          ) : (
            <EmptyState
              icon={Sparkles}
              title="No AI Health Summary Generated Yet"
              description="Upload medical documents such as discharge summaries, lab tests, or prescriptions to generate a comprehensive AI health summary."
              actionText="Generate Health Summary"
              actionHref="/summary"
            />
          )}
        </div>

        {/* Right Column: Timeline Preview (1 Col) */}
        <div className="bg-white rounded-2xl border border-slate-200/90 p-6 shadow-sm space-y-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-teal-600" />
              <h3 className="font-bold text-sm text-slate-900">Timeline Preview</h3>
            </div>
            <Link
              href="/timeline"
              className="text-xs font-semibold text-teal-600 hover:text-teal-700 flex items-center gap-1"
            >
              <span>All</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          {loading ? (
            <div className="space-y-3">
              <TimelineItemSkeleton />
              <TimelineItemSkeleton />
            </div>
          ) : recentTimelineEvents.length > 0 ? (
            <div className="space-y-4 relative before:absolute before:left-3.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200">
              {recentTimelineEvents.map((evt, idx) => (
                <div key={idx} className="relative pl-8 space-y-1">
                  <div className="absolute left-2 top-1 w-3 h-3 rounded-full bg-teal-600 ring-4 ring-white"></div>
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="font-semibold text-slate-800">{evt.event_date}</span>
                    <span className="px-1.5 py-0.2 rounded bg-slate-100 text-slate-600 font-mono text-[10px]">
                      {evt.event_type}
                    </span>
                  </div>
                  <p className="text-xs font-medium text-slate-900 leading-snug">{evt.title}</p>
                  <p className="text-[11px] text-slate-500 line-clamp-1">{evt.description}</p>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState
              icon={Clock}
              title="No Timeline Events"
              description="Chronological events appear automatically as you upload medical records."
              actionText="Sync Timeline"
              actionHref="/timeline"
            />
          )}
        </div>
      </div>

      {/* ---------------------------------------------------- */}
      {/* 5. RECENT LABORATORY RESULTS & TREND CHART          */}
      {/* ---------------------------------------------------- */}
      <section className="bg-white rounded-2xl border border-slate-200/90 p-6 shadow-sm space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-indigo-50 border border-indigo-200/80 text-indigo-700 flex items-center justify-center">
              <FlaskConical className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-slate-900">Recent Laboratory Results</h3>
              <p className="text-xs text-slate-500">Extracted and interpreted against standard reference ranges</p>
            </div>
          </div>
          <Link
            href="/laboratory"
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-semibold bg-indigo-50 text-indigo-800 border border-indigo-200/80 hover:bg-indigo-100 transition-colors"
          >
            <span>Complete Lab Analytics</span>
            <ArrowRight className="w-3 h-3" />
          </Link>
        </div>

        {/* Mini Recharts Trend Chart if points exist */}
        {trendSeries && trendSeries.points && trendSeries.points.length > 1 && (
          <div className="p-4 rounded-xl bg-slate-50/80 border border-slate-100 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-800">
                Biomarker Trend: {trendSeries.test_name} ({trendSeries.unit || ""})
              </span>
              <span className="text-[11px] text-slate-500">
                Latest: {trendSeries.latest_value} ({trendSeries.latest_status})
              </span>
            </div>
            <div className="h-44 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={trendSeries.points}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="date" stroke="#94a3b8" fontSize={11} />
                  <YAxis stroke="#94a3b8" fontSize={11} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#ffffff",
                      borderColor: "#cbd5e1",
                      borderRadius: "0.5rem",
                      fontSize: "12px",
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="value"
                    stroke="#0d9488"
                    strokeWidth={2.5}
                    dot={{ fill: "#0d9488", r: 4 }}
                    activeDot={{ r: 6 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* Lab Results Table */}
        {loading ? (
          <CardSkeleton lines={3} />
        ) : recentLabResults.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider text-[10px] border-y border-slate-100">
                <tr>
                  <th className="py-2.5 px-3 font-semibold">Test Name</th>
                  <th className="py-2.5 px-3 font-semibold">Result</th>
                  <th className="py-2.5 px-3 font-semibold">Reference Range</th>
                  <th className="py-2.5 px-3 font-semibold">Status</th>
                  <th className="py-2.5 px-3 font-semibold">Clinical Interpretation</th>
                  <th className="py-2.5 px-3 font-semibold text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {recentLabResults.map((obs) => (
                  <tr key={obs.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3 px-3 font-semibold text-slate-800">{obs.test_name}</td>
                    <td className="py-3 px-3 font-mono font-medium text-slate-900">
                      {obs.value} {obs.unit || ""}
                    </td>
                    <td className="py-3 px-3 text-slate-500">{obs.reference_range || "--"}</td>
                    <td className="py-3 px-3">
                      <StatusIndicator status={obs.status} severity={obs.severity} size="sm" />
                    </td>
                    <td className="py-3 px-3 text-slate-600 max-w-xs truncate">{obs.explanation}</td>
                    <td className="py-3 px-3 text-right">
                      {obs.document_id && (
                        <Link
                          href={`/documents/${obs.document_id}`}
                          className="text-teal-600 hover:text-teal-800 font-semibold inline-flex items-center gap-1"
                        >
                          <span>Doc</span>
                          <ExternalLink className="w-3 h-3" />
                        </Link>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState
            icon={FlaskConical}
            title="No Laboratory Results Found"
            description="Diagnostic and pathology reports will automatically populate this section with numeric values, reference ranges, and AI clinical explanations."
            actionText="Upload Lab Report"
            actionHref="/documents"
          />
        )}
      </section>

      {/* ---------------------------------------------------- */}
      {/* 6. MEDICATION SUMMARY & RECENT DOCUMENTS             */}
      {/* ---------------------------------------------------- */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Medication Summary */}
        <section className="bg-white rounded-2xl border border-slate-200/90 p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Pill className="w-4 h-4 text-emerald-600" />
              <h3 className="font-bold text-sm text-slate-900">Medication Summary</h3>
            </div>
            <Link
              href="/medications"
              className="text-xs font-semibold text-teal-600 hover:text-teal-700 flex items-center gap-1"
            >
              <span>View All</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          {loading ? (
            <CardSkeleton lines={3} />
          ) : activeMedications.length > 0 ? (
            <div className="space-y-3">
              {activeMedications.map((med, idx) => (
                <div
                  key={idx}
                  className="p-3.5 rounded-xl border border-slate-100 bg-slate-50/60 hover:bg-slate-50 transition-colors flex items-start justify-between gap-3"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-xs text-slate-900">{med.name}</span>
                      {med.dosage && (
                        <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 font-medium text-[10px] border border-emerald-200/60">
                          {med.dosage}
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-600">
                      Frequency: <strong className="text-slate-800">{med.frequency || "As prescribed"}</strong>
                      {med.route && ` • Route: ${med.route}`}
                    </p>
                    {med.instructions && (
                      <p className="text-[10px] text-slate-500 italic">{med.instructions}</p>
                    )}
                  </div>
                  {med.source_document_id && (
                    <Link
                      href={`/documents/${med.source_document_id}`}
                      className="text-teal-600 hover:text-teal-800 shrink-0 p-1 rounded hover:bg-white"
                      title="View source prescription"
                    >
                      <Eye className="w-4 h-4" />
                    </Link>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <EmptyState
              icon={Pill}
              title="No Active Prescriptions"
              description="Prescriptions and medications will be recognized automatically when you upload doctor slips."
              actionText="Upload Prescription"
              actionHref="/documents"
            />
          )}
        </section>

        {/* Recent Documents */}
        <section className="bg-white rounded-2xl border border-slate-200/90 p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-teal-600" />
              <h3 className="font-bold text-sm text-slate-900">Recent Documents</h3>
            </div>
            <Link
              href="/documents"
              className="text-xs font-semibold text-teal-600 hover:text-teal-700 flex items-center gap-1"
            >
              <span>View Vault</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          {loading ? (
            <CardSkeleton lines={3} />
          ) : documents.length > 0 ? (
            <div className="space-y-3">
              {documents.slice(0, 4).map((doc) => (
                <div
                  key={doc.id}
                  className="p-3.5 rounded-xl border border-slate-100 bg-slate-50/60 hover:bg-slate-50 transition-colors flex items-center justify-between gap-3"
                >
                  <div className="space-y-1 min-w-0">
                    <p className="font-semibold text-xs text-slate-900 truncate">
                      {doc.original_filename}
                    </p>
                    <div className="flex items-center gap-2 text-[10px] text-slate-500">
                      <span className="uppercase font-medium text-slate-600">{doc.document_type}</span>
                      <span>&bull;</span>
                      <span>{new Date(doc.upload_date).toLocaleDateString()}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <StatusIndicator status={doc.processing_status} size="sm" />
                    <Link
                      href={`/documents/${doc.id}`}
                      className="p-1.5 rounded-lg border border-slate-200 hover:bg-teal-50 hover:text-teal-700 text-slate-600 transition-colors"
                      title="Inspect document"
                    >
                      <ChevronRight className="w-3.5 h-3.5" />
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState
              icon={UploadCloud}
              title="Document Vault Empty"
              description="Upload your medical PDFs or images (prescriptions, lab tests, discharge summaries) to begin."
              actionText="Upload First Document"
              actionHref="/documents"
            />
          )}
        </section>
      </div>
    </div>
  );
}
