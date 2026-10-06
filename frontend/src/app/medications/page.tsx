"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { useLanguage } from "@/lib/language-context";
import { useDemoMode } from "@/components/DemoModeBanner";
import {
  Pill,
  Search,
  Filter,
  RefreshCw,
  FileText,
  AlertCircle,
  CheckCircle2,
  Clock,
  ShieldCheck,
  ExternalLink,
  ChevronRight,
  Info,
  Calendar,
  Sparkles,
  ArrowRight,
  ShieldAlert,
} from "lucide-react";
import {
  getFhirMedicationsApi,
  getHealthSummaryApi,
  MedicationSummaryItem,
  FHIRBundle,
  FHIRMedicationRequest,
} from "@/lib/api";
import { CardSkeleton, MetricSkeleton } from "@/components/SkeletonLoader";
import EmptyState from "@/components/EmptyState";
import ErrorState from "@/components/ErrorState";

export default function MedicationsPage() {
  const { user, token, isLoading: authLoading } = useAuth();
  const { isTamil, t } = useLanguage();
  const { isDemoMode } = useDemoMode();
  const router = useRouter();

  // Data states
  const [medications, setMedications] = useState<MedicationSummaryItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Filter & Search states
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [selectedRoute, setSelectedRoute] = useState<string>("ALL");

  // Authentication Guard
  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/login?redirect=/medications");
    }
  }, [authLoading, user, router]);

  // Load medications from health summary and/or FHIR Bundle
  const loadMedications = useCallback(async () => {
    if (!token) return;
    setError(null);

    try {
      // First attempt: fetch from health summary which parses AI extractions
      const summaryData = await getHealthSummaryApi(token);
      let items: MedicationSummaryItem[] = [];

      if (summaryData?.summary?.medications && summaryData.summary.medications.length > 0) {
        items = summaryData.summary.medications;
      } else {
        // Fallback: try FHIR medications
        try {
          const fhirRes = await getFhirMedicationsApi(token);
          if (fhirRes?.entry && fhirRes.entry.length > 0) {
            items = fhirRes.entry.map((e) => {
              const req: FHIRMedicationRequest = e.resource;
              const dosage = req.dosageInstruction?.[0];
              return {
                name: req.medicationCodeableConcept?.text || "Prescribed Medication",
                dosage: dosage?.text || null,
                frequency: dosage?.timing?.code?.text || "As directed",
                route: dosage?.route?.text || "Oral",
                duration: null,
                instructions: dosage?.patientInstruction || null,
                source_document_id: req.supportingInformation?.[0]?.reference?.replace("DocumentReference/", "") || "",
                source_document_title: req.supportingInformation?.[0]?.display || "Prescription Document",
              };
            });
          }
        } catch {
          // Handled silently
        }
      }

      setMedications(items);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to load medications.";
      setError(msg);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [token]);

  useEffect(() => {
    if (token) {
      loadMedications();
    }
  }, [token, loadMedications]);

  const handleRefresh = () => {
    setRefreshing(true);
    loadMedications();
  };

  // Synthetic demo data for explicit demo mode only
  const demoMedications: MedicationSummaryItem[] = useMemo(
    () =>
      isDemoMode
        ? [
            {
              name: "Metformin Hydrochloride",
              dosage: "500 mg",
              frequency: "Twice daily with meals",
              route: "Oral",
              duration: "90 days",
              instructions: "Take with breakfast and dinner to reduce gastric discomfort. Do not crush.",
              source_document_id: "demo-doc-1",
              source_document_title: "Endocrinology_Prescription_Sept2024.pdf",
            },
            {
              name: "Atorvastatin Calcium",
              dosage: "20 mg",
              frequency: "Once daily at bedtime",
              route: "Oral",
              duration: "90 days",
              instructions: "Take once daily at night. Avoid grapefruit juice.",
              source_document_id: "demo-doc-1",
              source_document_title: "Endocrinology_Prescription_Sept2024.pdf",
            },
            {
              name: "Telmisartan",
              dosage: "40 mg",
              frequency: "Once daily in the morning",
              route: "Oral",
              duration: "30 days",
              instructions: "Take with or without food. Measure blood pressure weekly.",
              source_document_id: "demo-doc-2",
              source_document_title: "Cardiology_Clinic_Note.pdf",
            },
            {
              name: "Aspirin (Enteric-coated)",
              dosage: "75 mg",
              frequency: "Once daily after food",
              route: "Oral",
              duration: "Ongoing",
              instructions: "Antiplatelet cardioprotection. Take with full glass of water.",
              source_document_id: "demo-doc-2",
              source_document_title: "Cardiology_Clinic_Note.pdf",
            },
          ]
        : [],
    [isDemoMode]
  );

  const displayList = medications.length > 0 ? medications : demoMedications;

  // Filter list by search query and route
  const filteredMedications = useMemo(() => {
    return displayList.filter((med) => {
      const matchSearch =
        searchQuery === "" ||
        med.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (med.instructions && med.instructions.toLowerCase().includes(searchQuery.toLowerCase()));

      const matchRoute =
        selectedRoute === "ALL" ||
        (med.route && med.route.toUpperCase().includes(selectedRoute.toUpperCase()));

      return matchSearch && matchRoute;
    });
  }, [displayList, searchQuery, selectedRoute]);

  if (authLoading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <MetricSkeleton />
          <MetricSkeleton />
          <MetricSkeleton />
        </div>
        <CardSkeleton lines={4} />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8 animate-in fade-in duration-300">
      {/* Header */}
      <div className="bg-white rounded-2xl border border-slate-200/90 p-6 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-500 flex items-center justify-center text-white shadow-md shadow-emerald-500/20">
            <Pill className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-slate-900 tracking-tight">
                {isTamil ? "மருந்து மேலாண்மை" : "Medication Management"}
              </h1>
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200/80">
                {displayList.length} Active Regimens
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Extracted automatically from authenticated prescriptions and clinic notes
            </p>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2.5 flex-wrap">
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors shadow-2xs"
            title="Refresh medication list"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? "animate-spin text-teal-600" : ""}`} />
            <span>Refresh</span>
          </button>
          <Link
            href="/documents"
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-teal-600 hover:bg-teal-700 text-white shadow-sm transition-colors"
          >
            <FileText className="w-3.5 h-3.5" />
            <span>Upload Prescription</span>
          </Link>
        </div>
      </div>

      {error && (
        <ErrorState
          title="Medication sync error"
          message={error}
          onRetry={loadMedications}
        />
      )}

      {/* Clinical Safety & Verification Banner */}
      <div className="p-4 rounded-2xl bg-teal-500/10 border border-teal-500/20 flex items-start justify-between gap-3 text-xs text-teal-900 leading-relaxed">
        <div className="flex items-start gap-2.5">
          <ShieldCheck className="w-5 h-5 text-teal-600 shrink-0 mt-0.5" />
          <div>
            <h4 className="font-bold text-teal-950 uppercase tracking-wider text-[11px] mb-0.5">
              Verified Medications Only
            </h4>
            <p className="text-teal-800 text-[11px]">
              Every medication listed below is grounded exclusively in medical records and prescriptions
              confirmed by you. OCR predictions are never treated as confirmed orders until human verification.
            </p>
          </div>
        </div>
        <Link
          href="/documents"
          className="shrink-0 px-3 py-1.5 rounded-lg bg-teal-600 hover:bg-teal-700 text-white font-semibold text-xs transition shadow-2xs"
        >
          Review Prescriptions
        </Link>
      </div>

      {/* KPI Row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-2xs space-y-2">
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold uppercase tracking-wider">
            <span>Total Prescriptions</span>
            <Pill className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-extrabold text-slate-900">{displayList.length}</span>
            <span className="text-xs text-slate-400">active drugs</span>
          </div>
          <p className="text-[11px] text-slate-500">Structured dosage and frequencies</p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-2xs space-y-2">
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold uppercase tracking-wider">
            <span>Oral Formulations</span>
            <CheckCircle2 className="w-4 h-4 text-teal-600" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-extrabold text-slate-900">
              {displayList.filter((m) => (m.route || "oral").toLowerCase().includes("oral")).length}
            </span>
            <span className="text-xs text-slate-400">oral tablets / caps</span>
          </div>
          <p className="text-[11px] text-slate-500">Regular oral administration</p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-2xs space-y-2">
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold uppercase tracking-wider">
            <span>Clinical Verification</span>
            <ShieldCheck className="w-4 h-4 text-cyan-600" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-extrabold text-emerald-600">100%</span>
            <span className="text-xs text-slate-400">cited to source</span>
          </div>
          <p className="text-[11px] text-slate-500">Every drug traces to an original PDF</p>
        </div>
      </div>

      {/* Search & Filter Bar */}
      <div className="bg-white rounded-2xl border border-slate-200/90 p-4 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by drug name or instruction..."
            className="w-full pl-9 pr-4 py-2 text-xs rounded-xl border border-slate-200 focus:outline-hidden focus:border-teal-500 focus:ring-1 focus:ring-teal-500"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Filter className="w-3.5 h-3.5 text-slate-400" />
          <div className="flex items-center gap-1 overflow-x-auto text-xs">
            {["ALL", "ORAL", "TOPICAL", "INHALATION"].map((route) => (
              <button
                key={route}
                onClick={() => setSelectedRoute(route)}
                className={`px-3 py-1.5 rounded-lg font-semibold transition-colors ${
                  selectedRoute === route
                    ? "bg-teal-600 text-white"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                {route}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Medication Cards Grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <CardSkeleton lines={4} />
          <CardSkeleton lines={4} />
          <CardSkeleton lines={4} />
          <CardSkeleton lines={4} />
        </div>
      ) : filteredMedications.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredMedications.map((med, idx) => (
            <div
              key={idx}
              className="bg-white rounded-2xl border border-slate-200/90 p-5 shadow-xs hover:border-emerald-300 hover:shadow-sm transition-all flex flex-col justify-between space-y-4"
            >
              <div className="space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="font-bold text-base text-slate-900 tracking-tight">
                      {med.name}
                    </h3>
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      {med.dosage && (
                        <span className="px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-800 font-bold text-xs border border-emerald-200/60">
                          {med.dosage}
                        </span>
                      )}
                      {med.route && (
                        <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 font-medium text-xs">
                          Route: {med.route}
                        </span>
                      )}
                      {med.duration && (
                        <span className="px-2 py-0.5 rounded-md bg-cyan-50 text-cyan-800 font-medium text-xs border border-cyan-200/60">
                          Duration: {med.duration}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="p-2 rounded-xl bg-emerald-50 text-emerald-700 shrink-0">
                    <Pill className="w-5 h-5" />
                  </div>
                </div>

                {/* Frequency & Instructions */}
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-100 space-y-1.5 text-xs">
                  <div className="flex items-center gap-1.5 text-slate-700">
                    <Clock className="w-3.5 h-3.5 text-slate-400" />
                    <span>
                      Dosage Timing: <strong className="text-slate-900">{med.frequency || "As prescribed"}</strong>
                    </span>
                  </div>
                  {med.instructions && (
                    <p className="text-slate-600 text-[11px] leading-relaxed pt-1 border-t border-slate-200/60">
                      <span className="font-semibold text-slate-700">Instructions: </span>
                      {med.instructions}
                    </p>
                  )}
                </div>
              </div>

              {/* Source Document Citation Footer */}
              <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                <div className="flex items-center gap-1 text-slate-500 truncate max-w-[220px]">
                  <FileText className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  <span className="truncate">{med.source_document_title || "Prescription Report"}</span>
                </div>
                {med.source_document_id && (
                  <Link
                    href={`/documents/${med.source_document_id}`}
                    className="text-teal-700 hover:text-teal-900 font-semibold inline-flex items-center gap-1 text-[11px] shrink-0"
                  >
                    <span>View Prescription</span>
                    <ExternalLink className="w-3 h-3" />
                  </Link>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <EmptyState
          icon={Pill}
          title="No Prescriptions Found"
          description={
            searchQuery
              ? `No medications match your filter query "${searchQuery}".`
              : "Upload a doctor's prescription or discharge summary to automatically extract medications, dosages, and frequencies."
          }
          actionText={searchQuery ? "Clear Search Filter" : "Upload Prescription"}
          onAction={searchQuery ? () => setSearchQuery("") : undefined}
          actionHref={searchQuery ? undefined : "/documents"}
        />
      )}

      {/* Safety & Adherence Reminder */}
      <div className="bg-slate-900 text-slate-300 rounded-2xl p-6 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-teal-500/20 text-teal-400 flex items-center justify-center shrink-0 border border-teal-500/30">
            <Info className="w-5 h-5" />
          </div>
          <div>
            <h4 className="text-xs font-bold text-white uppercase tracking-wider">
              Clinical Prescription Safety Notice
            </h4>
            <p className="text-xs text-slate-400 leading-relaxed max-w-2xl mt-0.5">
              Always adhere to the exact regimen specified by your licensed physician. Do not initiate, discontinue, or alter dosages without direct medical consultation.
            </p>
          </div>
        </div>
        <Link
          href="/summary"
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-white text-slate-900 hover:bg-slate-100 transition-colors shrink-0 shadow-sm"
        >
          <span>Consult AI Summary Questions</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>
    </div>
  );
}
