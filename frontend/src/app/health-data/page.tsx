"use client";

import React, { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Database,
  Download,
  Copy,
  Check,
  AlertTriangle,
  ShieldCheck,
  FileText,
  Activity,
  Pill,
  HeartPulse,
  Calendar,
  Building,
  User as UserIcon,
  Code,
  ExternalLink,
  RefreshCw,
  Search,
  Filter,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Eye,
  X,
  CalendarDays,
  FileDown,
  UserRound,
  ChevronDown,
} from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { useLanguage } from "@/lib/language-context";
import {
  getFhirPatientApi,
  getFhirObservationsApi,
  getFhirMedicationsApi,
  getFhirConditionsApi,
  getFhirDiagnosticReportsApi,
  getFhirDocumentReferencesApi,
  getFhirEncountersApi,
  getFhirExportBundleApi,
  FHIRPatient,
  FHIRObservation,
  FHIRMedicationRequest,
  FHIRCondition,
  FHIRDiagnosticReport,
  FHIRDocumentReference,
  FHIREncounter,
  FHIRBundle,
  getApiBaseUrl,
} from "@/lib/api";

type TabType =
  | "all"
  | "patient"
  | "observations"
  | "medications"
  | "conditions"
  | "reports"
  | "documents"
  | "encounters";

export default function HealthDataPage() {
  const router = useRouter();
  const { user, token, isLoading: authLoading } = useAuth();
  const { isTamil, t } = useLanguage();

  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabType>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [copiedAbha, setCopiedAbha] = useState<boolean>(false);
  const [rawFhirView, setRawFhirView] = useState<boolean>(false);
  const [expandedTrends, setExpandedTrends] = useState<Record<string, boolean>>({});

  // Loaded FHIR Data
  const [patient, setPatient] = useState<FHIRPatient | null>(null);
  const [observations, setObservations] = useState<FHIRObservation[]>([]);
  const [medications, setMedications] = useState<FHIRMedicationRequest[]>([]);
  const [conditions, setConditions] = useState<FHIRCondition[]>([]);
  const [reports, setReports] = useState<FHIRDiagnosticReport[]>([]);
  const [documents, setDocuments] = useState<FHIRDocumentReference[]>([]);
  const [encounters, setEncounters] = useState<FHIREncounter[]>([]);
  const [exportBundle, setExportBundle] = useState<FHIRBundle | null>(null);

  // Raw JSON Inspection Modal
  const [selectedJson, setSelectedJson] = useState<{
    title: string;
    data: any;
  } | null>(null);
  const [copiedModalJson, setCopiedModalJson] = useState<boolean>(false);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/login?redirect=/health-data");
    }
  }, [user, authLoading, router]);

  const loadAllFhirData = async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const [
        patientData,
        obsBundle,
        medsBundle,
        condsBundle,
        reportsBundle,
        docsBundle,
        encountersBundle,
        fullBundle,
      ] = await Promise.all([
        getFhirPatientApi(token),
        getFhirObservationsApi(token),
        getFhirMedicationsApi(token),
        getFhirConditionsApi(token),
        getFhirDiagnosticReportsApi(token),
        getFhirDocumentReferencesApi(token),
        getFhirEncountersApi(token),
        getFhirExportBundleApi(token),
      ]);

      setPatient(patientData);
      setObservations(
        obsBundle.entry ? obsBundle.entry.map((e) => e.resource) : []
      );
      setMedications(
        medsBundle.entry ? medsBundle.entry.map((e) => e.resource) : []
      );
      setConditions(
        condsBundle.entry ? condsBundle.entry.map((e) => e.resource) : []
      );
      setReports(
        reportsBundle.entry ? reportsBundle.entry.map((e) => e.resource) : []
      );
      setDocuments(
        docsBundle.entry ? docsBundle.entry.map((e) => e.resource) : []
      );
      setEncounters(
        encountersBundle.entry
          ? encountersBundle.entry.map((e) => e.resource)
          : []
      );
      setExportBundle(fullBundle);
    } catch (err: any) {
      setError(err.message || "Failed to retrieve FHIR data.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (token) {
      loadAllFhirData();
    }
  }, [token]);

  const copyAbhaToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedAbha(true);
    setTimeout(() => setCopiedAbha(false), 2000);
  };

  const copyJsonToClipboard = (data: any) => {
    navigator.clipboard.writeText(JSON.stringify(data, null, 2));
    setCopiedModalJson(true);
    setTimeout(() => setCopiedModalJson(false), 2000);
  };

  const handleExportJson = () => {
    if (!exportBundle) return;
    const jsonStr = JSON.stringify(exportBundle, null, 2);
    const blob = new Blob([jsonStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `fhir_health_record_bundle_${user?.id || "export"}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const mockAbhaMeta = patient?.mock_abha_meta;
  const mockAbhaId = mockAbhaMeta?.mock_abha_id || "91-4521-8890-1234";
  const mockAbhaAddr = mockAbhaMeta?.mock_abha_address || "demo_user@abdm";

  const patientName =
    patient?.name?.[0]?.text || user?.full_name || (isTamil ? "நோயாளர்" : "Patient");
  const abhaIdentifier =
    patient?.identifier?.find((identifier) =>
      `${identifier.system || ""} ${identifier.type?.text || ""}`.toLowerCase().includes("abha")
    )?.value ||
    patient?.mock_abha_meta?.mock_abha_id ||
    "";
  const observationGroups = useMemo(() => {
    const grouped: Record<string, FHIRObservation[]> = {};
    observations.forEach((observation) => {
      const name = observation.code?.text?.trim();
      if (!name) return;
      const key = name.toLocaleLowerCase();
      if (!grouped[key]) grouped[key] = [];
      grouped[key].push(observation);
    });
    return Object.entries(grouped)
      .map(([key, items]) => {
        const history = [...items].sort((first, second) => {
          const firstDate = first.effectiveDateTime
            ? new Date(first.effectiveDateTime).getTime()
            : 0;
          const secondDate = second.effectiveDateTime
            ? new Date(second.effectiveDateTime).getTime()
            : 0;
          return (Number.isNaN(secondDate) ? 0 : secondDate) - (Number.isNaN(firstDate) ? 0 : firstDate);
        });
        const latest = history[0];
        const interpretation = latest?.interpretation?.[0]?.text?.toUpperCase() || "";
        const status = interpretation.includes("HIGH") || interpretation === "H"
          ? "High"
          : interpretation.includes("LOW") || interpretation === "L"
          ? "Low"
          : interpretation.includes("NORMAL") || interpretation === "N"
          ? "Normal"
          : "Not specified";
        return { key, name: latest?.code?.text || key, latest, history, status };
      })
      .sort((first, second) => {
        const firstDate = first.latest?.effectiveDateTime
          ? new Date(first.latest.effectiveDateTime).getTime()
          : 0;
        const secondDate = second.latest?.effectiveDateTime
          ? new Date(second.latest.effectiveDateTime).getTime()
          : 0;
        return (Number.isNaN(secondDate) ? 0 : secondDate) - (Number.isNaN(firstDate) ? 0 : firstDate);
      });
  }, [observations]);

  const visitsAndRecords = useMemo(() => {
    const items: Array<{
      key: string;
      date?: string | null;
      clinician?: string;
      facility?: string;
      title: string;
      downloadUrl?: string;
    }> = [];
    reports.forEach((report) => {
      const form = report.presentedForm?.find((item) => item.url);
      items.push({
        key: `report-${report.id}`,
        date: report.effectiveDateTime || report.issued,
        clinician: report.performer?.[0]?.display,
        title: report.code?.text || (isTamil ? "பரிசோதனை அறிக்கை" : "Diagnostic report"),
        downloadUrl: form?.url,
      });
    });
    documents.forEach((document) => {
      const attachment = document.content?.find((item) => item.attachment?.url)?.attachment;
      items.push({
        key: `document-${document.id}`,
        date: document.date,
        clinician: document.author?.[0]?.display,
        title:
          attachment?.title ||
          document.type?.text ||
          (isTamil ? "மருத்துவ ஆவணம்" : "Medical record"),
        downloadUrl: attachment?.url,
      });
    });
    encounters.forEach((encounter) => {
      items.push({
        key: `encounter-${encounter.id}`,
        date: encounter.period?.start,
        clinician: encounter.participant?.[0]?.individual?.display,
        facility: encounter.serviceProvider?.display,
        title: isTamil ? "சுகாதார வருகை" : "Health visit",
      });
    });
    const sortedItems = items.sort((first, second) => {
      const firstDate = first.date ? new Date(first.date).getTime() : 0;
      const secondDate = second.date ? new Date(second.date).getTime() : 0;
      return (Number.isNaN(secondDate) ? 0 : secondDate) - (Number.isNaN(firstDate) ? 0 : firstDate);
    });
    const seenDownloads = new Set<string>();
    return sortedItems.filter((item) => {
      if (!item.downloadUrl) return true;
      if (seenDownloads.has(item.downloadUrl)) return false;
      seenDownloads.add(item.downloadUrl);
      return true;
    });
  }, [documents, encounters, isTamil, reports]);

  const formatPatientDate = (value?: string | null) => {
    if (!value) return "";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return new Intl.DateTimeFormat(isTamil ? "ta-IN" : "en", {
      day: "numeric",
      month: "short",
      year: "numeric",
    }).format(date);
  };

  const formatDownloadUrl = (url?: string) => {
    if (!url) return undefined;
    return /^https?:\/\//i.test(url) ? url : `${getApiBaseUrl()}${url.startsWith("/") ? "" : "/"}${url}`;
  };

  // Filtered lists
  const filteredObs = observations.filter((o) =>
    searchQuery
      ? o.code.text?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        o.interpretation?.some((i) =>
          i.text?.toLowerCase().includes(searchQuery.toLowerCase())
        )
      : true
  );

  const filteredMeds = medications.filter((m) =>
    searchQuery
      ? m.medicationCodeableConcept.text
          ?.toLowerCase()
          .includes(searchQuery.toLowerCase()) ||
        m.requester?.display?.toLowerCase().includes(searchQuery.toLowerCase())
      : true
  );

  const filteredConds = conditions.filter((c) =>
    searchQuery
      ? c.code.text?.toLowerCase().includes(searchQuery.toLowerCase())
      : true
  );

  const filteredReports = reports.filter((r) =>
    searchQuery
      ? r.code.text?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        r.performer?.some((p) =>
          p.display?.toLowerCase().includes(searchQuery.toLowerCase())
        )
      : true
  );

  const filteredDocs = documents.filter((d) =>
    searchQuery
      ? d.type.text?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        d.content.some((c) =>
          c.attachment.title?.toLowerCase().includes(searchQuery.toLowerCase())
        )
      : true
  );

  const filteredEncounters = encounters.filter((e) =>
    searchQuery
      ? e.participant?.some((p) =>
          p.individual?.display
            ?.toLowerCase()
            .includes(searchQuery.toLowerCase())
        ) ||
        e.serviceProvider?.display
          ?.toLowerCase()
          .includes(searchQuery.toLowerCase())
      : true
  );

  if (authLoading || (!user && loading)) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <RefreshCw className="w-8 h-8 text-teal-600 animate-spin" />
          <p className="text-sm font-semibold text-slate-600">
            {t("common", "loading", "Loading health data...")}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex justify-end">
          <div
            className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white p-1"
            role="group"
            aria-label={isTamil ? "பார்வை முறை" : "Health records view mode"}
          >
            <button
              type="button"
              aria-pressed={!rawFhirView}
              onClick={() => setRawFhirView(false)}
              className={`rounded-md px-3 py-1.5 text-xs font-semibold transition ${
                !rawFhirView
                  ? "bg-teal-700 text-white"
                  : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              {isTamil ? "நோயாளர் பார்வை" : "Patient View"}
            </button>
            <button
              type="button"
              aria-pressed={rawFhirView}
              onClick={() => setRawFhirView(true)}
              className={`rounded-md px-3 py-1.5 text-xs font-semibold transition ${
                rawFhirView
                  ? "bg-slate-800 text-white"
                  : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              {isTamil ? "Raw FHIR பார்வை" : "Raw FHIR View"}
            </button>
          </div>
        </div>

        {rawFhirView ? (
          <>
        {/* Top Header Card */}
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-6 sm:p-8 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2.5 flex-wrap">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-teal-100 text-teal-800 border border-teal-200">
                <Database className="w-3.5 h-3.5" />
                {t("fhir", "compliance_badge", "FHIR R4 / ABDM Prototype")}
              </span>
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-300">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                {t("fhir", "mock_abha_badge", "DEMO / MOCK ABHA ID")}
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
              {t("fhir", "title", "Health Data / FHIR")}
            </h1>
            <p className="text-sm text-slate-600 max-w-2xl leading-relaxed">
              {t(
                "fhir",
                "subtitle",
                "ABDM-Ready Interoperable Healthcare Architecture with HL7 FHIR R4 standard models, LOINC lab mappings, and RxNorm codes."
              )}
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-3 flex-wrap">
            <button
              onClick={loadAllFhirData}
              disabled={loading}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-xl border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 transition-colors shadow-sm"
              title="Refresh FHIR Data"
            >
              <RefreshCw
                className={`w-4 h-4 ${loading ? "animate-spin text-teal-600" : ""}`}
              />
              {t("common", "refresh", "Refresh")}
            </button>

            <button
              onClick={() =>
                exportBundle &&
                setSelectedJson({
                  title: "Complete FHIR R4 Collection Bundle",
                  data: exportBundle,
                })
              }
              disabled={!exportBundle}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-xl border border-teal-200 bg-teal-50 text-teal-800 hover:bg-teal-100 transition-colors shadow-sm"
            >
              <Code className="w-4 h-4 text-teal-600" />
              {t("fhir", "view_bundle_btn", "View Raw FHIR Bundle")}
            </button>

            <button
              onClick={handleExportJson}
              disabled={!exportBundle}
              className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-bold rounded-xl bg-gradient-to-r from-teal-600 to-emerald-600 text-white shadow-md shadow-teal-600/20 hover:from-teal-700 hover:to-emerald-700 transition-all hover:scale-[1.02] active:scale-[0.98]"
            >
              <Download className="w-4 h-4" />
              {t("fhir", "export_btn", "Export FHIR JSON")}
            </button>
          </div>
        </div>

        {/* Prominent Mock ABHA ID Card */}
        <div className="relative overflow-hidden bg-gradient-to-br from-slate-900 via-slate-800 to-teal-950 rounded-2xl shadow-lg border border-slate-700 text-white p-6 sm:p-8">
          <div className="absolute top-0 right-0 w-80 h-80 bg-teal-500/10 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20"></div>

          <div className="relative z-10 space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-700/60 pb-5">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-teal-500/20 border border-teal-400/30 flex items-center justify-center text-teal-300">
                  <ShieldCheck className="w-7 h-7" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs uppercase font-extrabold tracking-wider text-teal-400">
                      Ayushman Bharat Digital Mission (ABDM) Prototype
                    </span>
                  </div>
                  <h2 className="text-lg font-bold text-slate-100">
                    {t(
                      "fhir",
                      "mock_abha_title",
                      "ABHA Identifier (Ayushman Bharat Health Account)"
                    )}
                  </h2>
                </div>
              </div>

              {/* Mock ABHA Tag Badge */}
              <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-400/10 border border-amber-400/30 text-amber-300 text-xs font-bold tracking-wide">
                <AlertTriangle className="w-4 h-4 text-amber-400" />
                <span>{t("fhir", "mock_abha_badge", "DEMO / MOCK ABHA ID")}</span>
              </div>
            </div>

            {/* ABHA Details Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-1">
              <div className="space-y-1">
                <span className="text-xs font-medium text-slate-400">
                  Formatted ABHA Number
                </span>
                <div className="flex items-center gap-3">
                  <span className="font-mono text-2xl sm:text-3xl font-extrabold tracking-wider text-teal-300">
                    {mockAbhaId}
                  </span>
                  <button
                    onClick={() => copyAbhaToClipboard(mockAbhaId)}
                    className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-600 text-slate-300 hover:text-white transition-colors"
                    title={t("fhir", "copy_abha", "Copy ABHA ID")}
                  >
                    {copiedAbha ? (
                      <Check className="w-4 h-4 text-emerald-400" />
                    ) : (
                      <Copy className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>

              <div className="space-y-1">
                <span className="text-xs font-medium text-slate-400">
                  ABHA Address (Health Handle)
                </span>
                <div className="font-mono text-lg font-bold text-slate-200">
                  {mockAbhaAddr}
                </div>
              </div>

              <div className="space-y-1">
                <span className="text-xs font-medium text-slate-400">
                  Patient & Verification Status
                </span>
                <div className="flex items-center gap-2 text-sm font-semibold text-emerald-400">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>
                    {user?.full_name} (Linked to Patient ID:{" "}
                    {patient?.id?.slice(0, 8)}...)
                  </span>
                </div>
              </div>
            </div>

            {/* Mandatory Regulatory / Safety Disclaimer */}
            <div className="rounded-xl bg-amber-500/10 border border-amber-500/30 p-4 flex items-start gap-3 text-amber-200 text-xs leading-relaxed">
              <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
              <div>
                <strong className="font-bold text-amber-300 block mb-0.5">
                  DEMO / MOCK ABHA ID DISCLAIMER:
                </strong>
                {t(
                  "fhir",
                  "mock_abha_disclaimer",
                  "This identifier is an illustrative mock generated for hackathon prototype testing. The application is NOT officially integrated with Ayushman Bharat Digital Mission (ABDM). Do not use for real clinical care."
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Grounding & Integrity Guarantee Banner */}
        <div className="rounded-2xl bg-teal-50/70 border border-teal-200/80 p-4 sm:p-5 flex items-center justify-between gap-4 text-teal-900 text-xs sm:text-sm">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-teal-600 text-white flex items-center justify-center shrink-0">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <span className="font-bold text-teal-950 block">
                {t(
                  "fhir",
                  "grounding_banner",
                  "All FHIR resources originate directly from verified database records. Zero data is fabricated."
                )}
              </span>
              <span className="text-teal-700 text-xs">
                Every Observation, MedicationRequest, and DiagnosticReport is
                traceable to its source document ID in PostgreSQL.
              </span>
            </div>
          </div>

          <div className="hidden sm:flex items-center gap-2 shrink-0">
            <span className="font-mono text-xs px-2.5 py-1 rounded bg-teal-100 text-teal-800 font-bold">
              {exportBundle?.total || 0} Total Resources
            </span>
          </div>
        </div>

        {/* Resources Metrics Ribbon */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <div
            onClick={() => setActiveTab("observations")}
            className="cursor-pointer bg-white p-4 rounded-xl border border-slate-200 shadow-sm hover:border-teal-400 transition-all text-center group"
          >
            <Activity className="w-5 h-5 text-teal-600 mx-auto mb-1 group-hover:scale-110 transition-transform" />
            <div className="text-xl font-extrabold text-slate-900">
              {observations.length}
            </div>
            <div className="text-[11px] font-semibold text-slate-500 uppercase">
              {t("fhir", "tabs_observations", "Observations")}
            </div>
          </div>

          <div
            onClick={() => setActiveTab("medications")}
            className="cursor-pointer bg-white p-4 rounded-xl border border-slate-200 shadow-sm hover:border-teal-400 transition-all text-center group"
          >
            <Pill className="w-5 h-5 text-indigo-600 mx-auto mb-1 group-hover:scale-110 transition-transform" />
            <div className="text-xl font-extrabold text-slate-900">
              {medications.length}
            </div>
            <div className="text-[11px] font-semibold text-slate-500 uppercase">
              {t("fhir", "tabs_medications", "Medications")}
            </div>
          </div>

          <div
            onClick={() => setActiveTab("conditions")}
            className="cursor-pointer bg-white p-4 rounded-xl border border-slate-200 shadow-sm hover:border-teal-400 transition-all text-center group"
          >
            <HeartPulse className="w-5 h-5 text-rose-600 mx-auto mb-1 group-hover:scale-110 transition-transform" />
            <div className="text-xl font-extrabold text-slate-900">
              {conditions.length}
            </div>
            <div className="text-[11px] font-semibold text-slate-500 uppercase">
              {t("fhir", "tabs_conditions", "Conditions")}
            </div>
          </div>

          <div
            onClick={() => setActiveTab("reports")}
            className="cursor-pointer bg-white p-4 rounded-xl border border-slate-200 shadow-sm hover:border-teal-400 transition-all text-center group"
          >
            <FileText className="w-5 h-5 text-amber-600 mx-auto mb-1 group-hover:scale-110 transition-transform" />
            <div className="text-xl font-extrabold text-slate-900">
              {reports.length}
            </div>
            <div className="text-[11px] font-semibold text-slate-500 uppercase">
              {t("fhir", "tabs_diagnostic_reports", "Diagnostic Reports")}
            </div>
          </div>

          <div
            onClick={() => setActiveTab("documents")}
            className="cursor-pointer bg-white p-4 rounded-xl border border-slate-200 shadow-sm hover:border-teal-400 transition-all text-center group"
          >
            <Database className="w-5 h-5 text-emerald-600 mx-auto mb-1 group-hover:scale-110 transition-transform" />
            <div className="text-xl font-extrabold text-slate-900">
              {documents.length}
            </div>
            <div className="text-[11px] font-semibold text-slate-500 uppercase">
              {t("fhir", "tabs_documents", "Documents")}
            </div>
          </div>

          <div
            onClick={() => setActiveTab("encounters")}
            className="cursor-pointer bg-white p-4 rounded-xl border border-slate-200 shadow-sm hover:border-teal-400 transition-all text-center group"
          >
            <Building className="w-5 h-5 text-purple-600 mx-auto mb-1 group-hover:scale-110 transition-transform" />
            <div className="text-xl font-extrabold text-slate-900">
              {encounters.length}
            </div>
            <div className="text-[11px] font-semibold text-slate-500 uppercase">
              {t("fhir", "tabs_encounters", "Encounters")}
            </div>
          </div>
        </div>

        {/* Filter Navigation & Search Bar */}
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-4 space-y-4">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            {/* Tab navigation */}
            <div className="flex items-center gap-1.5 overflow-x-auto w-full md:w-auto pb-1 md:pb-0 scrollbar-none">
              {(
                [
                  ["all", t("fhir", "tabs_all", "Overview & All")],
                  ["patient", t("fhir", "tabs_patient", "Patient")],
                  ["observations", t("fhir", "tabs_observations", "Observations")],
                  ["medications", t("fhir", "tabs_medications", "Medications")],
                  ["conditions", t("fhir", "tabs_conditions", "Conditions")],
                  ["reports", t("fhir", "tabs_diagnostic_reports", "Reports")],
                  ["documents", t("fhir", "tabs_documents", "Documents")],
                  ["encounters", t("fhir", "tabs_encounters", "Encounters")],
                ] as const
              ).map(([tabKey, tabLabel]) => (
                <button
                  key={tabKey}
                  onClick={() => setActiveTab(tabKey)}
                  className={`px-3.5 py-1.5 text-xs font-bold rounded-xl whitespace-nowrap transition-all ${
                    activeTab === tabKey
                      ? "bg-teal-600 text-white shadow-sm"
                      : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
                  }`}
                >
                  {tabLabel}
                </button>
              ))}
            </div>

            {/* Search Input */}
            <div className="relative w-full md:w-72">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={t("common", "search", "Search resources...")}
                className="w-full pl-9 pr-3.5 py-1.5 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Resources Content Display */}
        {loading ? (
          <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center space-y-3">
            <RefreshCw className="w-8 h-8 text-teal-600 animate-spin mx-auto" />
            <p className="text-sm font-semibold text-slate-600">
              {t("common", "loading", "Loading FHIR resources from database...")}
            </p>
          </div>
        ) : error ? (
          <div className="bg-rose-50 border border-rose-200 rounded-2xl p-6 text-rose-800 text-sm flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
            <div>
              <strong>Error:</strong> {error}
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            {/* 1. Patient Resource Section */}
            {(activeTab === "all" || activeTab === "patient") && patient && (
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="bg-slate-50/80 px-6 py-4 border-b border-slate-200 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <UserIcon className="w-5 h-5 text-teal-600" />
                    <h3 className="font-bold text-slate-900 text-sm">
                      FHIR R4 Patient Resource
                    </h3>
                    <span className="font-mono text-xs text-slate-500">
                      ID: {patient.id}
                    </span>
                  </div>
                  <button
                    onClick={() =>
                      setSelectedJson({
                        title: `FHIR Patient: ${patient.name[0]?.text || "Resource"}`,
                        data: patient,
                      })
                    }
                    className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-lg border border-slate-200 bg-white hover:bg-slate-100 text-slate-700 transition-colors"
                  >
                    <Code className="w-3.5 h-3.5 text-teal-600" />
                    <span>{t("fhir", "view_json", "View JSON")}</span>
                  </button>
                </div>

                <div className="p-6 grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="space-y-1">
                    <span className="text-xs font-semibold text-slate-500">
                      Full Legal Name
                    </span>
                    <div className="text-sm font-bold text-slate-900">
                      {patient.name[0]?.text}
                    </div>
                  </div>
                  <div className="space-y-1">
                    <span className="text-xs font-semibold text-slate-500">
                      Mock ABHA Identifier
                    </span>
                    <div className="text-sm font-mono font-bold text-teal-700">
                      {patient.mock_abha_meta.mock_abha_id}
                    </div>
                  </div>
                  <div className="space-y-1">
                    <span className="text-xs font-semibold text-slate-500">
                      Gender & Birth Date
                    </span>
                    <div className="text-sm text-slate-900 capitalize">
                      {patient.gender || "Not specified"} •{" "}
                      {patient.birthDate || "N/A"}
                    </div>
                  </div>
                  <div className="space-y-1">
                    <span className="text-xs font-semibold text-slate-500">
                      Telecom (Email)
                    </span>
                    <div className="text-sm text-slate-900">
                      {patient.telecom[0]?.value}
                    </div>
                  </div>
                  <div className="space-y-1">
                    <span className="text-xs font-semibold text-slate-500">
                      Preferred Communication
                    </span>
                    <div className="text-sm text-slate-900">
                      {patient.communication?.[0]?.language?.text || "English"}
                    </div>
                  </div>
                  <div className="space-y-1">
                    <span className="text-xs font-semibold text-slate-500">
                      Active Status
                    </span>
                    <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                      <CheckCircle2 className="w-3.5 h-3.5" /> Active
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* 2. Observations Section */}
            {(activeTab === "all" || activeTab === "observations") && (
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="bg-slate-50/80 px-6 py-4 border-b border-slate-200 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Activity className="w-5 h-5 text-teal-600" />
                    <h3 className="font-bold text-slate-900 text-sm">
                      {t("fhir", "tabs_observations", "Observations")} (
                      {filteredObs.length})
                    </h3>
                  </div>
                  <span className="text-xs text-slate-500">
                    Standard LOINC Clinical Coding
                  </span>
                </div>

                <div className="divide-y divide-slate-100">
                  {filteredObs.length === 0 ? (
                    <div className="p-8 text-center text-sm text-slate-500">
                      No matching observations found.
                    </div>
                  ) : (
                    filteredObs.map((obs) => {
                      const statusVal = obs.interpretation?.[0]?.text || "NORMAL";
                      const loinc = obs.code.coding?.find(
                        (c) => c.system === "http://loinc.org"
                      );
                      const isHigh = statusVal === "HIGH";
                      const isLow = statusVal === "LOW";

                      return (
                        <div
                          key={obs.id}
                          className="p-5 hover:bg-slate-50/60 transition-colors flex flex-col md:flex-row md:items-center justify-between gap-4"
                        >
                          <div className="space-y-1.5 flex-1">
                            <div className="flex items-center gap-2.5 flex-wrap">
                              <h4 className="font-bold text-slate-900 text-sm">
                                {obs.code.text}
                              </h4>
                              {loinc && (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-slate-100 text-slate-600 font-mono text-[11px] border border-slate-200">
                                  LOINC: {loinc.code}
                                </span>
                              )}
                              <span
                                className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${
                                  isHigh
                                    ? "bg-rose-100 text-rose-800 border border-rose-200"
                                    : isLow
                                    ? "bg-amber-100 text-amber-800 border border-amber-200"
                                    : "bg-emerald-100 text-emerald-800 border border-emerald-200"
                                }`}
                              >
                                {statusVal}
                              </span>
                            </div>

                            <p className="text-xs text-slate-600 leading-relaxed">
                              {obs.note?.[0]?.text}
                            </p>

                            <div className="flex items-center gap-4 text-xs text-slate-500 pt-0.5">
                              {obs.referenceRange?.[0] && (
                                <span>
                                  Ref Range:{" "}
                                  <strong className="text-slate-700">
                                    {obs.referenceRange[0].text}
                                  </strong>
                                </span>
                              )}
                              {obs.derivedFrom?.[0] && (
                                <span>
                                  Source:{" "}
                                  <span className="font-mono text-slate-600">
                                    {obs.derivedFrom[0].reference}
                                  </span>
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Value & Actions */}
                          <div className="flex items-center md:flex-col md:items-end justify-between gap-3 shrink-0">
                            <div className="text-right">
                              <div className="text-base font-extrabold text-slate-900">
                                {obs.valueQuantity
                                  ? `${obs.valueQuantity.value} ${obs.valueQuantity.unit || ""}`
                                  : obs.valueString || "N/A"}
                              </div>
                              <div className="text-[11px] text-slate-500">
                                {obs.effectiveDateTime?.slice(0, 10)}
                              </div>
                            </div>

                            <button
                              onClick={() =>
                                setSelectedJson({
                                  title: `Observation: ${obs.code.text}`,
                                  data: obs,
                                })
                              }
                              className="inline-flex items-center gap-1 px-2 py-1 text-xs font-semibold rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-700 transition-colors"
                            >
                              <Code className="w-3.5 h-3.5 text-teal-600" />
                              <span>JSON</span>
                            </button>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            )}

            {/* 3. Medications Section */}
            {(activeTab === "all" || activeTab === "medications") && (
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="bg-slate-50/80 px-6 py-4 border-b border-slate-200 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Pill className="w-5 h-5 text-indigo-600" />
                    <h3 className="font-bold text-slate-900 text-sm">
                      {t("fhir", "tabs_medications", "Medications")} (
                      {filteredMeds.length})
                    </h3>
                  </div>
                  <span className="text-xs text-slate-500">
                    FHIR R4 MedicationRequest
                  </span>
                </div>

                <div className="divide-y divide-slate-100">
                  {filteredMeds.length === 0 ? (
                    <div className="p-8 text-center text-sm text-slate-500">
                      No active prescriptions found.
                    </div>
                  ) : (
                    filteredMeds.map((med) => {
                      const rxnorm = med.medicationCodeableConcept.coding?.find(
                        (c) =>
                          c.system === "http://www.nlm.nih.gov/research/umls/rxnorm"
                      );
                      const dosage = med.dosageInstruction?.[0]?.text;

                      return (
                        <div
                          key={med.id}
                          className="p-5 hover:bg-slate-50/60 transition-colors flex flex-col md:flex-row md:items-center justify-between gap-4"
                        >
                          <div className="space-y-1.5 flex-1">
                            <div className="flex items-center gap-2.5 flex-wrap">
                              <h4 className="font-bold text-slate-900 text-sm">
                                {med.medicationCodeableConcept.text}
                              </h4>
                              {rxnorm && (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 font-mono text-[11px] border border-indigo-200">
                                  RxNorm: {rxnorm.code}
                                </span>
                              )}
                              <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 text-[11px] font-bold">
                                {med.status.toUpperCase()}
                              </span>
                            </div>

                            {dosage && (
                              <p className="text-xs text-slate-700 font-medium">
                                {dosage}
                              </p>
                            )}

                            <div className="flex items-center gap-4 text-xs text-slate-500">
                              {med.requester && (
                                <span>
                                  Prescribed by:{" "}
                                  <strong className="text-slate-700">
                                    {med.requester.display}
                                  </strong>
                                </span>
                              )}
                              {med.authoredOn && (
                                <span>Date: {med.authoredOn}</span>
                              )}
                              {med.supportingInformation?.[0] && (
                                <span>
                                  Doc:{" "}
                                  <span className="font-mono text-slate-600">
                                    {med.supportingInformation[0].display}
                                  </span>
                                </span>
                              )}
                            </div>
                          </div>

                          <div className="shrink-0">
                            <button
                              onClick={() =>
                                setSelectedJson({
                                  title: `MedicationRequest: ${med.medicationCodeableConcept.text}`,
                                  data: med,
                                })
                              }
                              className="inline-flex items-center gap-1 px-2 py-1 text-xs font-semibold rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-700 transition-colors"
                            >
                              <Code className="w-3.5 h-3.5 text-teal-600" />
                              <span>JSON</span>
                            </button>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            )}

            {/* 4. Conditions Section */}
            {(activeTab === "all" || activeTab === "conditions") && (
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="bg-slate-50/80 px-6 py-4 border-b border-slate-200 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <HeartPulse className="w-5 h-5 text-rose-600" />
                    <h3 className="font-bold text-slate-900 text-sm">
                      {t("fhir", "tabs_conditions", "Conditions")} (
                      {filteredConds.length})
                    </h3>
                  </div>
                  <span className="text-xs text-slate-500">
                    SNOMED CT Clinical Diagnostic Coding
                  </span>
                </div>

                <div className="divide-y divide-slate-100">
                  {filteredConds.length === 0 ? (
                    <div className="p-8 text-center text-sm text-slate-500">
                      No recorded medical conditions.
                    </div>
                  ) : (
                    filteredConds.map((cond) => {
                      const snomed = cond.code.coding?.find(
                        (c) => c.system === "http://snomed.info/sct"
                      );

                      return (
                        <div
                          key={cond.id}
                          className="p-5 hover:bg-slate-50/60 transition-colors flex flex-col md:flex-row md:items-center justify-between gap-4"
                        >
                          <div className="space-y-1.5 flex-1">
                            <div className="flex items-center gap-2.5 flex-wrap">
                              <h4 className="font-bold text-slate-900 text-sm">
                                {cond.code.text}
                              </h4>
                              {snomed && (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-rose-50 text-rose-700 font-mono text-[11px] border border-rose-200">
                                  SNOMED: {snomed.code}
                                </span>
                              )}
                              <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 text-[11px] font-bold">
                                {cond.clinicalStatus.text}
                              </span>
                              <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 text-[11px] font-bold">
                                {cond.verificationStatus.text}
                              </span>
                            </div>

                            <div className="flex items-center gap-4 text-xs text-slate-500">
                              {cond.recordedDate && (
                                <span>Recorded: {cond.recordedDate}</span>
                              )}
                              {cond.evidence?.[0]?.detail?.[0] && (
                                <span>
                                  Evidence:{" "}
                                  <span className="font-mono text-slate-600">
                                    {cond.evidence[0].detail[0].display}
                                  </span>
                                </span>
                              )}
                            </div>
                          </div>

                          <div className="shrink-0">
                            <button
                              onClick={() =>
                                setSelectedJson({
                                  title: `Condition: ${cond.code.text}`,
                                  data: cond,
                                })
                              }
                              className="inline-flex items-center gap-1 px-2 py-1 text-xs font-semibold rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-700 transition-colors"
                            >
                              <Code className="w-3.5 h-3.5 text-teal-600" />
                              <span>JSON</span>
                            </button>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            )}

            {/* 5. Diagnostic Reports Section */}
            {(activeTab === "all" || activeTab === "reports") && (
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="bg-slate-50/80 px-6 py-4 border-b border-slate-200 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <FileText className="w-5 h-5 text-amber-600" />
                    <h3 className="font-bold text-slate-900 text-sm">
                      {t("fhir", "tabs_diagnostic_reports", "Diagnostic Reports")} (
                      {filteredReports.length})
                    </h3>
                  </div>
                  <span className="text-xs text-slate-500">
                    Aggregated Lab Panels & Attachments
                  </span>
                </div>

                <div className="divide-y divide-slate-100">
                  {filteredReports.length === 0 ? (
                    <div className="p-8 text-center text-sm text-slate-500">
                      No diagnostic reports found.
                    </div>
                  ) : (
                    filteredReports.map((rep) => (
                      <div
                        key={rep.id}
                        className="p-5 hover:bg-slate-50/60 transition-colors flex flex-col md:flex-row md:items-center justify-between gap-4"
                      >
                        <div className="space-y-1.5 flex-1">
                          <div className="flex items-center gap-2.5 flex-wrap">
                            <h4 className="font-bold text-slate-900 text-sm">
                              {rep.code.text}
                            </h4>
                            <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-800 text-[11px] font-bold">
                              {rep.status.toUpperCase()}
                            </span>
                            <span className="text-xs text-slate-500">
                              {rep.result?.length || 0} observations attached
                            </span>
                          </div>

                          <div className="flex items-center gap-4 text-xs text-slate-500">
                            {rep.performer?.[0] && (
                              <span>
                                Performer:{" "}
                                <strong className="text-slate-700">
                                  {rep.performer[0].display}
                                </strong>
                              </span>
                            )}
                            {rep.effectiveDateTime && (
                              <span>Date: {rep.effectiveDateTime}</span>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          {rep.presentedForm?.[0]?.url && (
                            <a
                              href={`http://localhost:8000${rep.presentedForm[0].url}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 px-3 py-1 text-xs font-semibold rounded-lg bg-teal-50 text-teal-800 hover:bg-teal-100 transition-colors"
                            >
                              <Download className="w-3.5 h-3.5" />
                              <span>PDF</span>
                            </a>
                          )}
                          <button
                            onClick={() =>
                              setSelectedJson({
                                title: `DiagnosticReport: ${rep.code.text}`,
                                data: rep,
                              })
                            }
                            className="inline-flex items-center gap-1 px-2 py-1 text-xs font-semibold rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-700 transition-colors"
                          >
                            <Code className="w-3.5 h-3.5 text-teal-600" />
                            <span>JSON</span>
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            {/* 6. Document References Section */}
            {(activeTab === "all" || activeTab === "documents") && (
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="bg-slate-50/80 px-6 py-4 border-b border-slate-200 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Database className="w-5 h-5 text-emerald-600" />
                    <h3 className="font-bold text-slate-900 text-sm">
                      {t("fhir", "tabs_documents", "Document References")} (
                      {filteredDocs.length})
                    </h3>
                  </div>
                  <span className="text-xs text-slate-500">
                    FHIR R4 DocumentReference Metadata
                  </span>
                </div>

                <div className="divide-y divide-slate-100">
                  {filteredDocs.length === 0 ? (
                    <div className="p-8 text-center text-sm text-slate-500">
                      No documents stored.
                    </div>
                  ) : (
                    filteredDocs.map((doc) => {
                      const att = doc.content?.[0]?.attachment;

                      return (
                        <div
                          key={doc.id}
                          className="p-5 hover:bg-slate-50/60 transition-colors flex flex-col md:flex-row md:items-center justify-between gap-4"
                        >
                          <div className="space-y-1.5 flex-1">
                            <div className="flex items-center gap-2.5 flex-wrap">
                              <h4 className="font-bold text-slate-900 text-sm">
                                {att?.title || "Medical Document"}
                              </h4>
                              <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-800 text-[11px] font-bold border border-emerald-200">
                                {doc.type.text}
                              </span>
                            </div>

                            <div className="flex items-center gap-4 text-xs text-slate-500">
                              <span>MIME: {att?.contentType}</span>
                              {att?.size ? (
                                <span>Size: {(att.size / 1024).toFixed(1)} KB</span>
                              ) : null}
                              {doc.author?.[0] && (
                                <span>Author: {doc.author[0].display}</span>
                              )}
                              <span>
                                Uploaded: {doc.date?.slice(0, 10)}
                              </span>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            {att?.url && (
                              <a
                                href={`http://localhost:8000${att.url}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 px-3 py-1 text-xs font-semibold rounded-lg bg-teal-50 text-teal-800 hover:bg-teal-100 transition-colors"
                              >
                                <Download className="w-3.5 h-3.5" />
                                <span>Download</span>
                              </a>
                            )}
                            <button
                              onClick={() =>
                                setSelectedJson({
                                  title: `DocumentReference: ${att?.title || "Document"}`,
                                  data: doc,
                                })
                              }
                              className="inline-flex items-center gap-1 px-2 py-1 text-xs font-semibold rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-700 transition-colors"
                            >
                              <Code className="w-3.5 h-3.5 text-teal-600" />
                              <span>JSON</span>
                            </button>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            )}

            {/* 7. Encounters Section */}
            {(activeTab === "all" || activeTab === "encounters") && (
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="bg-slate-50/80 px-6 py-4 border-b border-slate-200 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Building className="w-5 h-5 text-purple-600" />
                    <h3 className="font-bold text-slate-900 text-sm">
                      {t("fhir", "tabs_encounters", "Encounters")} (
                      {filteredEncounters.length})
                    </h3>
                  </div>
                  <span className="text-xs text-slate-500">
                    Clinical Consultations & Visits
                  </span>
                </div>

                <div className="divide-y divide-slate-100">
                  {filteredEncounters.length === 0 ? (
                    <div className="p-8 text-center text-sm text-slate-500">
                      No clinical encounters recorded.
                    </div>
                  ) : (
                    filteredEncounters.map((enc) => (
                      <div
                        key={enc.id}
                        className="p-5 hover:bg-slate-50/60 transition-colors flex flex-col md:flex-row md:items-center justify-between gap-4"
                      >
                        <div className="space-y-1.5 flex-1">
                          <div className="flex items-center gap-2.5 flex-wrap">
                            <h4 className="font-bold text-slate-900 text-sm">
                              {enc.participant?.[0]?.individual?.display ||
                                "Clinical Consultation"}
                            </h4>
                            <span className="px-2 py-0.5 rounded bg-purple-100 text-purple-800 text-[11px] font-bold">
                              {enc.status.toUpperCase()}
                            </span>
                            <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 text-[11px] font-bold">
                              AMBULATORY
                            </span>
                          </div>

                          <div className="flex items-center gap-4 text-xs text-slate-500">
                            {enc.serviceProvider && (
                              <span>
                                Facility:{" "}
                                <strong className="text-slate-700">
                                  {enc.serviceProvider.display}
                                </strong>
                              </span>
                            )}
                            {enc.period?.start && (
                              <span>Date: {enc.period.start}</span>
                            )}
                          </div>
                        </div>

                        <div className="shrink-0">
                          <button
                            onClick={() =>
                              setSelectedJson({
                                title: `Encounter: ${enc.participant?.[0]?.individual?.display || "Visit"}`,
                                data: enc,
                              })
                            }
                            className="inline-flex items-center gap-1 px-2 py-1 text-xs font-semibold rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-700 transition-colors"
                          >
                            <Code className="w-3.5 h-3.5 text-teal-600" />
                            <span>JSON</span>
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Raw FHIR JSON Inspection Modal */}
        {selectedJson && (
          <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-slate-900 text-slate-100 rounded-2xl shadow-2xl border border-slate-800 w-full max-w-4xl max-h-[85vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
              {/* Modal Header */}
              <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/80">
                <div className="flex items-center gap-2.5">
                  <Code className="w-5 h-5 text-teal-400" />
                  <h3 className="font-bold text-sm text-slate-200">
                    {selectedJson.title}
                  </h3>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => copyJsonToClipboard(selectedJson.data)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 transition-colors"
                  >
                    {copiedModalJson ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                        <span>{t("fhir", "copied", "Copied!")}</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span>Copy JSON</span>
                      </>
                    )}
                  </button>
                  <button
                    onClick={() => setSelectedJson(null)}
                    className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-200 transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* JSON Body */}
              <div className="p-6 overflow-auto flex-1 font-mono text-xs text-teal-300 leading-relaxed bg-slate-950/50">
                <pre>{JSON.stringify(selectedJson.data, null, 2)}</pre>
              </div>

              {/* Modal Footer */}
              <div className="px-6 py-3 border-t border-slate-800 bg-slate-950/80 flex items-center justify-between text-xs text-slate-400">
                <span>Valid HL7 FHIR R4 JSON Schema</span>
                <button
                  onClick={() => setSelectedJson(null)}
                  className="px-4 py-1.5 rounded-lg bg-teal-600 hover:bg-teal-500 text-white font-bold text-xs transition-colors"
                >
                  {t("fhir", "close_modal", "Close")}
                </button>
              </div>
            </div>
          </div>
        )}
          </>
        ) : (
          <div className="mx-auto max-w-5xl space-y-6">
            <h1 className="text-2xl font-semibold tracking-tight text-slate-950">
              {isTamil ? "சுகாதார மேலோட்டம்" : "Health overview"}
            </h1>
            <header className="rounded-xl border border-slate-200 bg-white p-5 sm:p-7">
              <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-start gap-4">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-teal-50 text-teal-800">
                    <UserRound className="h-6 w-6" aria-hidden="true" />
                  </div>
                  <div>
                    <h2 className="text-xl font-semibold tracking-tight text-slate-950">
                      {patientName}
                    </h2>
                    <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-slate-600">
                      {patient?.gender && <span className="capitalize">{patient.gender}</span>}
                      {patient?.birthDate && (
                        <span>
                          {isTamil ? "பிறந்த தேதி" : "Date of birth"}:{" "}
                          {formatPatientDate(patient.birthDate)}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  {abhaIdentifier && (
                    <div>
                      <p className="text-xs font-medium text-slate-500">
                        {patient?.mock_abha_meta?.is_official_abdm
                          ? "ABHA Number"
                          : isTamil
                          ? "டெமோ ABHA எண்"
                          : "Demo ABHA number"}
                      </p>
                      <p className="mt-0.5 font-medium tracking-wide text-slate-900">
                        {abhaIdentifier}
                      </p>
                    </div>
                  )}
                  {abhaIdentifier && (
                    <button
                      type="button"
                      onClick={() => copyAbhaToClipboard(abhaIdentifier)}
                      className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600"
                    >
                      {copiedAbha ? (
                        <Check className="h-4 w-4 text-emerald-700" aria-hidden="true" />
                      ) : (
                        <Copy className="h-4 w-4" aria-hidden="true" />
                      )}
                      {copiedAbha
                        ? isTamil
                          ? "நகலெடுக்கப்பட்டது"
                          : "Copied"
                        : isTamil
                        ? "ABHA நகலெடு"
                        : "Copy ABHA"}
                    </button>
                  )}
                </div>
              </div>
              <div className="mt-4 inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-700">
                <ShieldCheck
                  className={`h-4 w-4 ${
                    patient?.mock_abha_meta?.is_official_abdm
                      ? "text-emerald-700"
                      : "text-amber-700"
                  }`}
                  aria-hidden="true"
                />
                {patient?.mock_abha_meta?.is_official_abdm
                  ? isTamil
                    ? "அதிகாரப்பூர்வமாக சரிபார்க்கப்பட்டது"
                    : "Officially verified"
                  : isTamil
                  ? "டெமோ அடையாளம் · அதிகாரப்பூர்வமாக சரிபார்க்கப்படவில்லை"
                  : "Demo identifier · Not officially verified"}
              </div>
            </header>

            {error && (
              <div
                className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900"
                role="alert"
              >
                <span>{error}</span>
                <button
                  type="button"
                  onClick={loadAllFhirData}
                  className="font-semibold underline underline-offset-2"
                >
                  {isTamil ? "மீண்டும் முயற்சி" : "Try again"}
                </button>
              </div>
            )}

            <section aria-labelledby="health-metrics-heading">
              <div className="mb-3 flex items-center justify-between gap-3">
                <h2
                  id="health-metrics-heading"
                  className="text-lg font-semibold text-slate-950"
                >
                  {isTamil ? "சுகாதார அளவீடுகள்" : "Health observations"}
                </h2>
                <button
                  type="button"
                  onClick={loadAllFhirData}
                  disabled={loading}
                  className="inline-flex items-center gap-2 rounded-md px-2 py-1.5 text-sm font-medium text-teal-800 hover:bg-teal-50 disabled:opacity-60"
                >
                  <RefreshCw
                    className={`h-4 w-4 ${loading ? "animate-spin" : ""}`}
                    aria-hidden="true"
                  />
                  {isTamil ? "புதுப்பி" : "Refresh"}
                </button>
              </div>
              {observationGroups.length > 0 ? (
                <div className="grid gap-3 md:grid-cols-2">
                  {observationGroups.map((metric) => {
                    const expanded = Boolean(expandedTrends[metric.key]);
                    const statusClass =
                      metric.status === "Normal"
                        ? "bg-emerald-50 text-emerald-800"
                        : metric.status === "Not specified"
                        ? "bg-slate-100 text-slate-700"
                        : "bg-amber-50 text-amber-900";
                    return (
                      <article
                        key={metric.key}
                        className="rounded-lg border border-slate-200 bg-white p-4"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <h3 className="font-semibold text-slate-950">{metric.name}</h3>
                            <p className="mt-1 text-xl font-semibold text-slate-900">
                              {metric.latest?.valueQuantity
                                ? `${metric.latest.valueQuantity.value ?? ""} ${
                                    metric.latest.valueQuantity.unit || ""
                                  }`.trim()
                                : metric.latest?.valueString || "—"}
                            </p>
                            {metric.latest?.referenceRange?.[0]?.text && (
                              <p className="mt-1 text-sm text-slate-600">
                                {isTamil ? "குறிப்பு வரம்பு" : "Reference range"}:{" "}
                                {metric.latest.referenceRange[0].text}
                              </p>
                            )}
                          </div>
                          <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${statusClass}`}>
                            {metric.status === "Normal"
                              ? isTamil
                                ? "இயல்பு"
                                : "Normal"
                              : metric.status === "High"
                              ? isTamil
                                ? "அதிகம்"
                                : "High"
                              : metric.status === "Low"
                              ? isTamil
                                ? "குறைவு"
                                : "Low"
                              : isTamil
                              ? "குறிப்பிடப்படவில்லை"
                              : "Not specified"}
                          </span>
                        </div>
                        {metric.latest?.effectiveDateTime && (
                          <p className="mt-2 text-xs text-slate-500">
                            {formatPatientDate(metric.latest.effectiveDateTime)}
                          </p>
                        )}
                        {metric.history.length > 1 && (
                          <div className="mt-3 border-t border-slate-100 pt-2">
                            <button
                              type="button"
                              aria-expanded={expanded}
                              onClick={() =>
                                setExpandedTrends((current) => ({
                                  ...current,
                                  [metric.key]: !current[metric.key],
                                }))
                              }
                              className="inline-flex items-center gap-1 text-sm font-semibold text-teal-800 hover:text-teal-950"
                            >
                              {expanded
                                ? isTamil
                                  ? "போக்கை மறை"
                                  : "Hide trend"
                                : isTamil
                                ? "போக்கைப் பார்க்க"
                                : "View trend"}
                              <ChevronDown
                                className={`h-4 w-4 transition-transform ${
                                  expanded ? "rotate-180" : ""
                                }`}
                                aria-hidden="true"
                              />
                            </button>
                            {expanded && (
                              <ol className="mt-2 space-y-2 border-l border-slate-200 pl-3">
                                {metric.history.map((item) => (
                                  <li key={item.id} className="flex justify-between gap-3 text-sm">
                                    <span className="text-slate-700">
                                      {item.valueQuantity
                                        ? `${item.valueQuantity.value ?? ""} ${
                                            item.valueQuantity.unit || ""
                                          }`.trim()
                                        : item.valueString || "—"}
                                    </span>
                                    <time className="shrink-0 text-slate-500">
                                      {formatPatientDate(item.effectiveDateTime)}
                                    </time>
                                  </li>
                                ))}
                              </ol>
                            )}
                          </div>
                        )}
                      </article>
                    );
                  })}
                </div>
              ) : (
                <p className="rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600">
                  {isTamil ? "பரிசோதனை முடிவுகள் எதுவும் இல்லை." : "No health observations are available yet."}
                </p>
              )}
            </section>

            <section aria-labelledby="medications-heading">
              <h2
                id="medications-heading"
                className="mb-3 text-lg font-semibold text-slate-950"
              >
                {isTamil ? "தற்போதைய மருந்துகள்" : "Current medications"}
              </h2>
              {medications.filter((medication) => medication.status?.toLowerCase() === "active").length > 0 ? (
                <div className="divide-y divide-slate-100 rounded-lg border border-slate-200 bg-white px-4">
                  {medications
                    .filter((medication) => medication.status?.toLowerCase() === "active")
                    .map((medication) => {
                      const instruction = medication.dosageInstruction?.[0];
                      return (
                        <article key={medication.id} className="flex gap-3 py-4">
                          <Pill className="mt-0.5 h-5 w-5 shrink-0 text-teal-800" aria-hidden="true" />
                          <div className="min-w-0 flex-1">
                            <h3 className="font-semibold text-slate-950">
                              {medication.medicationCodeableConcept?.text ||
                                (isTamil ? "மருந்து" : "Medication")}
                            </h3>
                            {instruction?.text && (
                              <p className="mt-1 text-sm text-slate-700">{instruction.text}</p>
                            )}
                            {instruction?.patientInstruction && (
                              <p className="mt-1 text-sm text-slate-600">
                                {instruction.patientInstruction}
                              </p>
                            )}
                            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
                              {medication.requester?.display && (
                                <span>
                                  {isTamil ? "மருத்துவர்" : "Prescribed by"}:{" "}
                                  {medication.requester.display}
                                </span>
                              )}
                              {medication.authoredOn && (
                                <span>
                                  {isTamil ? "தேதி" : "Prescription date"}:{" "}
                                  {formatPatientDate(medication.authoredOn)}
                                </span>
                              )}
                            </div>
                          </div>
                        </article>
                      );
                    })}
                </div>
              ) : (
                <p className="rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600">
                  {isTamil ? "செயலில் உள்ள மருந்துகள் பதிவு செய்யப்படவில்லை." : "No active medications are listed."}
                </p>
              )}
            </section>

            <section aria-labelledby="conditions-heading">
              <h2
                id="conditions-heading"
                className="mb-3 text-lg font-semibold text-slate-950"
              >
                {isTamil ? "பதிவுசெய்யப்பட்ட நிலைகள்" : "Recorded conditions"}
              </h2>
              {conditions.length > 0 ? (
                <ul className="flex flex-wrap gap-2">
                  {conditions.map((condition) => (
                    <li
                      key={condition.id}
                      className="inline-flex flex-wrap items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-2 text-sm"
                    >
                      <span className="font-medium text-slate-900">
                        {condition.code?.text || (isTamil ? "நிலை" : "Condition")}
                      </span>
                      {condition.clinicalStatus?.text && (
                        <span className="text-xs text-slate-600">
                          {condition.clinicalStatus.text}
                        </span>
                      )}
                      {condition.verificationStatus?.text && (
                        <span className="text-xs text-slate-500">
                          {condition.verificationStatus.text}
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600">
                  {isTamil ? "பதிவுசெய்யப்பட்ட நிலைகள் இல்லை." : "No conditions are listed in your records."}
                </p>
              )}
            </section>

            <section aria-labelledby="timeline-heading">
              <h2
                id="timeline-heading"
                className="mb-3 text-lg font-semibold text-slate-950"
              >
                {isTamil ? "வருகைகள் மற்றும் பதிவுகள்" : "Visits & records"}
              </h2>
              {visitsAndRecords.length > 0 ? (
                <ol className="divide-y divide-slate-100 rounded-lg border border-slate-200 bg-white px-4">
                  {visitsAndRecords.map((item) => (
                    <li
                      key={item.key}
                      className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div className="flex min-w-0 gap-3">
                        <CalendarDays className="mt-0.5 h-4 w-4 shrink-0 text-teal-800" aria-hidden="true" />
                        <div className="min-w-0">
                          <h3 className="truncate font-medium text-slate-950">{item.title}</h3>
                          <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-sm text-slate-600">
                            {item.date && <span>{formatPatientDate(item.date)}</span>}
                            {item.clinician && <span>{item.clinician}</span>}
                            {item.facility && <span>{item.facility}</span>}
                          </div>
                        </div>
                      </div>
                      {item.downloadUrl && (
                        <a
                          href={formatDownloadUrl(item.downloadUrl)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex w-fit shrink-0 items-center gap-1.5 rounded-md border border-slate-200 px-3 py-2 text-sm font-medium text-teal-800 transition hover:bg-teal-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600"
                        >
                          <FileDown className="h-4 w-4" aria-hidden="true" />
                          {isTamil ? "PDF பதிவிறக்கு" : "Download PDF"}
                        </a>
                      )}
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600">
                  {isTamil ? "வருகைகள் அல்லது பதிவுகள் இன்னும் இல்லை." : "No visits or records are available yet."}
                </p>
              )}
            </section>

            <p className="border-t border-slate-200 pt-4 text-xs text-slate-500">
              {isTamil
                ? "உங்கள் மருத்துவப் பதிவுகளிலிருந்து கிடைக்கும் தகவல்கள் இங்கே காட்டப்படுகின்றன."
                : "This overview shows information available in your health records."}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
