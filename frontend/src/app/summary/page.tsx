"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import {
  HealthSummaryResponse,
  getHealthSummaryApi,
  generateHealthSummaryApi,
} from "@/lib/api";
import {
  Sparkles,
  ShieldAlert,
  Calendar,
  Pill,
  Activity,
  FileText,
  AlertTriangle,
  CheckCircle2,
  HelpCircle,
  RefreshCw,
  Printer,
  ChevronRight,
  Stethoscope,
  Globe,
  Clock,
  ArrowRight,
  CheckSquare,
  Square,
  Building2,
  User,
  Info,
} from "lucide-react";

import { useLanguage } from "@/lib/language-context";

export default function HealthSummaryPage() {
  const router = useRouter();
  const { user, token, isLoading: authLoading } = useAuth();
  const { language, setLanguage } = useLanguage();

  const [summaryData, setSummaryData] = useState<HealthSummaryResponse | null>(null);
  const [selectedLanguage, setSelectedLanguage] = useState<"en" | "ta">(language);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [checkedQuestions, setCheckedQuestions] = useState<Record<string, boolean>>({});
  const [activeTab, setActiveTab] = useState<"overview" | "abnormal" | "meds" | "labs" | "records" | "questions">("overview");

  // Authentication check
  useEffect(() => {
    if (!authLoading && !token) {
      router.push("/login?redirect=/summary");
    }
  }, [authLoading, token, router]);

  // Sync with global language
  useEffect(() => {
    setSelectedLanguage(language);
    if (token) {
      fetchSummary(language, false);
    }
  }, [language, token]);

  // Load summary
  const fetchSummary = async (lang: "en" | "ta", force: boolean = false) => {
    if (!token) return;
    try {
      if (force) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      setError(null);

      let response: HealthSummaryResponse;
      if (force) {
        response = await generateHealthSummaryApi(token, {
          language: lang,
          force_refresh: true,
        });
      } else {
        response = await getHealthSummaryApi(token, lang);
      }

      setSummaryData(response);
      setSelectedLanguage((response.language as "en" | "ta") || lang);
    } catch (err: any) {
      console.error("Failed to load health summary:", err);
      setError(err.message || "Failed to retrieve Personal Health Summary.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleLanguageToggle = (lang: "en" | "ta") => {
    setSelectedLanguage(lang);
    setLanguage(lang);
    fetchSummary(lang, true);
  };

  const toggleQuestionChecked = (qId: string) => {
    setCheckedQuestions((prev) => ({
      ...prev,
      [qId]: !prev[qId],
    }));
  };

  if (authLoading || (loading && !summaryData)) {
    return (
      <div className="min-h-[80vh] flex flex-col items-center justify-center p-6 text-center">
        <div className="w-14 h-14 rounded-2xl bg-teal-50 border border-teal-200 flex items-center justify-center mb-4 text-teal-600 animate-pulse">
          <Sparkles className="w-7 h-7 animate-spin" />
        </div>
        <h2 className="text-xl font-bold text-slate-800 mb-1">
          Synthesizing Personal Health Summary
        </h2>
        <p className="text-sm text-slate-500 max-w-md">
          Grounding verified database records, laboratory observations, medications, and clinical safety constraints...
        </p>
      </div>
    );
  }

  const summary = summaryData?.summary;
  const snapshot = summary?.health_snapshot;
  const isTamil = selectedLanguage === "ta";

  return (
    <div className="min-h-screen bg-slate-50/60 pb-20 pt-6">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">

        {/* TOP MEDICAL DISCLAIMER BANNER */}
        <div className="bg-amber-50/90 border-2 border-amber-300/80 rounded-2xl p-4 sm:p-5 shadow-sm">
          <div className="flex items-start gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-amber-500 text-white flex items-center justify-center flex-shrink-0 shadow-sm shadow-amber-500/20">
              <ShieldAlert className="w-5 h-5 stroke-[2.2]" />
            </div>
            <div className="flex-1">
              <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
                <span className="text-xs font-bold uppercase tracking-wider text-amber-900 bg-amber-200/70 px-2.5 py-0.5 rounded-full">
                  {isTamil ? "முக்கிய மருத்துவ மறுப்பு" : "Mandatory Clinical Disclaimer"}
                </span>
                <span className="text-xs text-amber-800 font-medium">
                  {isTamil ? "நம்பகமான தரவுத்தள ஆதாரங்கள் மட்டுமே" : "Grounded Exclusively on Verified Medical Database Records"}
                </span>
              </div>
              <p className="text-sm sm:text-base font-semibold text-amber-950 leading-relaxed">
                "{summary?.disclaimer || "This summary is for informational purposes and does not replace professional medical advice."}"
              </p>
              <p className="text-xs text-amber-800 mt-1">
                {isTamil
                  ? "இந்த அமைப்பு நோய் கண்டறிவதில்லை, மருந்துகளை பரிந்துரைப்பதில்லை அல்லது மாற்றுவதில்லை. அனைத்து மருத்துவ முடிவுகளுக்கும் உங்கள் மருத்துவரை அணுகவும்."
                  : "This system does not diagnose, prescribe, change medication, or predict outcomes. Always discuss laboratory values and medications with a qualified physician."}
              </p>
            </div>
          </div>
        </div>

        {/* HERO TITLE & CONTROLS */}
        <div className="bg-white border border-slate-200/80 rounded-2xl p-6 sm:p-8 shadow-sm">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
            <div className="space-y-2">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-teal-50 border border-teal-200 text-teal-800 text-xs font-semibold">
                <Sparkles className="w-3.5 h-3.5 text-teal-600" />
                <span>{isTamil ? "AI தனிப்பட்ட சுகாதார சுருக்கம்" : "AI-Powered Personal Health Summary"}</span>
                <span className="text-teal-400">•</span>
                <span className="text-teal-700 font-mono">v1.0 Traceable Engine</span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
                {snapshot?.headline || (isTamil ? "தனிப்பட்ட சுகாதார கண்ணோட்டம்" : "Personal Health Overview")}
              </h1>
              <p className="text-sm sm:text-base text-slate-600 max-w-3xl leading-relaxed">
                {snapshot?.overview_text || "Synthesized from your verified medical database records."}
              </p>
            </div>

            {/* Actions: Language & Refresh & Print */}
            <div className="flex flex-wrap items-center gap-2.5">
              {/* Language Switcher */}
              <div className="inline-flex rounded-xl border border-slate-200 bg-slate-100 p-1 shadow-inner">
                <button
                  onClick={() => handleLanguageToggle("en")}
                  disabled={refreshing}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                    selectedLanguage === "en"
                      ? "bg-white text-teal-800 shadow-sm"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  <Globe className="w-3.5 h-3.5" />
                  <span>English</span>
                </button>
                <button
                  onClick={() => handleLanguageToggle("ta")}
                  disabled={refreshing}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                    selectedLanguage === "ta"
                      ? "bg-white text-teal-800 shadow-sm"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  <Globe className="w-3.5 h-3.5" />
                  <span>தமிழ்</span>
                </button>
              </div>

              {/* Refresh / Regenerate */}
              <button
                onClick={() => fetchSummary(selectedLanguage, true)}
                disabled={refreshing}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 transition-colors shadow-sm disabled:opacity-50"
                title="Regenerate summary from database"
              >
                <RefreshCw className={`w-3.5 h-3.5 text-teal-600 ${refreshing ? "animate-spin" : ""}`} />
                <span>{refreshing ? (isTamil ? "புதுப்பிக்கிறது..." : "Updating...") : (isTamil ? "புதுப்பி" : "Regenerate")}</span>
              </button>

              {/* Print / Export */}
              <button
                onClick={() => window.print()}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold text-white bg-slate-800 hover:bg-slate-900 transition-colors shadow-sm"
                title="Print or save as PDF"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>{isTamil ? "அச்சிடுக" : "Print Summary"}</span>
              </button>
            </div>
          </div>

          {/* KPI METRIC CARDS */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5 mt-6 pt-6 border-t border-slate-100">
            <div className="bg-slate-50/80 rounded-xl p-3.5 border border-slate-200/60">
              <div className="flex items-center justify-between text-slate-500 mb-1">
                <span className="text-xs font-medium">{isTamil ? "ஆவணங்கள்" : "Records Analyzed"}</span>
                <FileText className="w-4 h-4 text-teal-600" />
              </div>
              <div className="text-2xl font-bold text-slate-900">
                {snapshot?.total_records_analyzed || 0}
              </div>
              <span className="text-[11px] text-teal-700 font-medium">{isTamil ? "சரிபார்க்கப்பட்டது" : "Verified Clinical Files"}</span>
            </div>

            <div className="bg-slate-50/80 rounded-xl p-3.5 border border-slate-200/60">
              <div className="flex items-center justify-between text-slate-500 mb-1">
                <span className="text-xs font-medium">{isTamil ? "செயலில் உள்ள மருந்துகள்" : "Medications"}</span>
                <Pill className="w-4 h-4 text-indigo-600" />
              </div>
              <div className="text-2xl font-bold text-slate-900">
                {snapshot?.active_medications_count || 0}
              </div>
              <span className="text-[11px] text-indigo-700 font-medium">{isTamil ? "மருந்தக பதிவுகள்" : "Active Prescriptions"}</span>
            </div>

            <div className="bg-slate-50/80 rounded-xl p-3.5 border border-slate-200/60">
              <div className="flex items-center justify-between text-slate-500 mb-1">
                <span className="text-xs font-medium">{isTamil ? "ஆய்வக சோதனைகள்" : "Lab Observations"}</span>
                <Activity className="w-4 h-4 text-teal-600" />
              </div>
              <div className="text-2xl font-bold text-slate-900">
                {snapshot?.lab_tests_count || 0}
              </div>
              <span className="text-[11px] text-teal-700 font-medium">{isTamil ? "சோதனை முடிவுகள்" : "Longitudinal Tests"}</span>
            </div>

            <div className="bg-amber-50/70 rounded-xl p-3.5 border border-amber-200/70">
              <div className="flex items-center justify-between text-amber-700 mb-1">
                <span className="text-xs font-medium">{isTamil ? "கவனிக்கப்பட வேண்டியவை" : "Outside Ref Range"}</span>
                <AlertTriangle className="w-4 h-4 text-amber-600" />
              </div>
              <div className="text-2xl font-bold text-amber-900">
                {snapshot?.abnormal_findings_count || 0}
              </div>
              <span className="text-[11px] text-amber-800 font-medium">{isTamil ? "மருத்துவரிடம் விவாதிக்கவும்" : "Physician Review Advised"}</span>
            </div>
          </div>
        </div>

        {/* NAVIGATION TABS */}
        <div className="flex items-center gap-1 overflow-x-auto pb-1 border-b border-slate-200">
          <button
            onClick={() => setActiveTab("overview")}
            className={`px-4 py-2.5 text-xs font-bold rounded-lg whitespace-nowrap transition-colors flex items-center gap-2 ${
              activeTab === "overview"
                ? "bg-teal-600 text-white shadow-sm"
                : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
            }`}
          >
            <Activity className="w-4 h-4" />
            <span>{isTamil ? "முழு சுருக்கம்" : "Complete Overview"}</span>
          </button>
          <button
            onClick={() => setActiveTab("abnormal")}
            className={`px-4 py-2.5 text-xs font-bold rounded-lg whitespace-nowrap transition-colors flex items-center gap-2 ${
              activeTab === "abnormal"
                ? "bg-teal-600 text-white shadow-sm"
                : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
            }`}
          >
            <AlertTriangle className="w-4 h-4" />
            <span>{isTamil ? "குறிப்பு வரம்பு முடிவுகள்" : "Abnormal Results"}</span>
            {summary?.abnormal_results?.length ? (
              <span className="ml-1 px-1.5 py-0.5 rounded-full text-[10px] bg-amber-400 text-slate-900 font-bold">
                {summary.abnormal_results.length}
              </span>
            ) : null}
          </button>
          <button
            onClick={() => setActiveTab("meds")}
            className={`px-4 py-2.5 text-xs font-bold rounded-lg whitespace-nowrap transition-colors flex items-center gap-2 ${
              activeTab === "meds"
                ? "bg-teal-600 text-white shadow-sm"
                : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
            }`}
          >
            <Pill className="w-4 h-4" />
            <span>{isTamil ? "மருந்துகள்" : "Medications"}</span>
            <span className="ml-1 px-1.5 py-0.5 rounded-full text-[10px] bg-slate-200 text-slate-800 font-semibold">
              {summary?.medications?.length || 0}
            </span>
          </button>
          <button
            onClick={() => setActiveTab("labs")}
            className={`px-4 py-2.5 text-xs font-bold rounded-lg whitespace-nowrap transition-colors flex items-center gap-2 ${
              activeTab === "labs"
                ? "bg-teal-600 text-white shadow-sm"
                : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
            }`}
          >
            <Activity className="w-4 h-4" />
            <span>{isTamil ? "ஆய்வக சோதனைகள்" : "Lab Observations"}</span>
            <span className="ml-1 px-1.5 py-0.5 rounded-full text-[10px] bg-slate-200 text-slate-800 font-semibold">
              {summary?.laboratory_observations?.length || 0}
            </span>
          </button>
          <button
            onClick={() => setActiveTab("records")}
            className={`px-4 py-2.5 text-xs font-bold rounded-lg whitespace-nowrap transition-colors flex items-center gap-2 ${
              activeTab === "records"
                ? "bg-teal-600 text-white shadow-sm"
                : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
            }`}
          >
            <FileText className="w-4 h-4" />
            <span>{isTamil ? "மருத்துவ ஆவணங்கள்" : "Records & Dates"}</span>
          </button>
          <button
            onClick={() => setActiveTab("questions")}
            className={`px-4 py-2.5 text-xs font-bold rounded-lg whitespace-nowrap transition-colors flex items-center gap-2 ${
              activeTab === "questions"
                ? "bg-teal-600 text-white shadow-sm"
                : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
            }`}
          >
            <HelpCircle className="w-4 h-4" />
            <span>{isTamil ? "மருத்துவரிடம் கேட்க வேண்டிய கேள்விகள்" : "Doctor Discussion Points"}</span>
            <span className="ml-1 px-1.5 py-0.5 rounded-full text-[10px] bg-teal-100 text-teal-800 font-bold">
              {summary?.doctor_questions?.length || 0}
            </span>
          </button>
        </div>

        {/* TAB 1: OVERVIEW & ALL 8 SECTIONS */}
        {(activeTab === "overview" || activeTab === "abnormal") && (
          <section className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-amber-100 text-amber-800 flex items-center justify-center font-bold">
                  !
                </div>
                <div>
                  <h2 className="text-lg font-bold text-slate-900">
                    {isTamil ? "5. குறிப்பு வரம்புக்கு வெளியே உள்ள சோதனைகள்" : "Abnormal Results Requiring Attention"}
                  </h2>
                  <p className="text-xs text-slate-500">
                    {isTamil
                      ? "அறிக்கையில் குறிப்பிடப்பட்ட குறிப்பு வரம்புகளுடன் ஒப்பிடப்பட்ட ஆய்வக முடிவுகள்."
                      : "Strict non-diagnostic plain language explanations traceable to source records."}
                  </p>
                </div>
              </div>
            </div>

            {summary?.abnormal_results && summary.abnormal_results.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {summary.abnormal_results.map((item, idx) => (
                  <div
                    key={`ab-${idx}`}
                    className="bg-white border-2 border-amber-200/90 rounded-2xl p-5 shadow-sm space-y-3 relative overflow-hidden"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-base text-slate-900">{item.test_name}</span>
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase ${
                              item.status === "HIGH"
                                ? "bg-rose-100 text-rose-800 border border-rose-200"
                                : "bg-sky-100 text-sky-800 border border-sky-200"
                            }`}
                          >
                            {item.status}
                          </span>
                        </div>
                        <div className="text-xs text-slate-500 mt-0.5">
                          {isTamil ? "குறிப்பு வரம்பு: " : "Reference Range: "}
                          <span className="font-semibold text-slate-700">{item.reference_range}</span>
                        </div>
                      </div>

                      <div className="text-right">
                        <div className="text-xl font-black text-slate-900">
                          {item.value} <span className="text-xs font-semibold text-slate-500">{item.unit}</span>
                        </div>
                        <span className="text-[10px] font-bold uppercase text-amber-700 bg-amber-100 px-2 py-0.5 rounded-md">
                          {item.severity}
                        </span>
                      </div>
                    </div>

                    {/* Grounded Phrasing Statement */}
                    <div className="bg-amber-50/70 border border-amber-200/70 rounded-xl p-3">
                      <p className="text-xs font-medium text-amber-950 leading-relaxed">
                        {item.statement}
                      </p>
                      <p className="text-xs font-semibold text-teal-800 mt-1.5 flex items-center gap-1.5">
                        <CheckCircle2 className="w-3.5 h-3.5 text-teal-600 flex-shrink-0" />
                        <span>{item.action_guidance}</span>
                      </p>
                    </div>

                    {/* Source Document Traceability Badge */}
                    <div className="flex items-center justify-between pt-1 border-t border-slate-100 text-[11px] text-slate-500">
                      <div className="flex items-center gap-1">
                        <FileText className="w-3.5 h-3.5 text-slate-400" />
                        <span>{isTamil ? "ஆதாரம்: " : "Source Doc: "}</span>
                        <Link
                          href="/documents"
                          className="font-medium text-teal-700 hover:underline truncate max-w-[200px]"
                          title={item.source_document_title}
                        >
                          {item.source_document_title}
                        </Link>
                      </div>
                      <span className="font-mono text-[10px] text-slate-400">
                        ID: {item.source_document_id.slice(0, 8)}...
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center text-slate-500">
                <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto mb-2" />
                <p className="font-semibold text-slate-800">
                  {isTamil ? "அனைத்து சோதனைகளும் குறிப்பு வரம்பிற்குள் உள்ளன" : "No Abnormal Results Detected"}
                </p>
                <p className="text-xs text-slate-500">
                  {isTamil
                    ? "ஆவணப்படுத்தப்பட்ட அனைத்து ஆய்வக முடிவுகளும் குறிப்பு வரம்பில் உள்ளன."
                    : "All verified laboratory observations fall within the documented reference ranges."}
                </p>
              </div>
            )}
          </section>
        )}

        {/* SECTION: MEDICATIONS */}
        {(activeTab === "overview" || activeTab === "meds") && (
          <section className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold">
                  <Pill className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-slate-900">
                    {isTamil ? "3. செயலில் உள்ள மருந்துகள்" : "Medications (Active & Documented)"}
                  </h2>
                  <p className="text-xs text-slate-500">
                    {isTamil
                      ? "மருத்துவ ஆவணங்கள் மற்றும் மருந்துச்சீட்டுகளிலிருந்து பிரித்தெடுக்கப்பட்ட விவரங்கள்."
                      : "Prescribed medications extracted directly from verified clinical prescriptions."}
                  </p>
                </div>
              </div>
            </div>

            {summary?.medications && summary.medications.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {summary.medications.map((med, idx) => (
                  <div
                    key={`med-${idx}`}
                    className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-sm space-y-3 hover:border-indigo-300 transition-colors"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2.5">
                        <div className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-700 flex items-center justify-center">
                          <Pill className="w-4 h-4" />
                        </div>
                        <div>
                          <h3 className="font-bold text-slate-900 text-sm sm:text-base leading-tight">
                            {med.name}
                          </h3>
                          {med.dosage && (
                            <span className="text-xs font-semibold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-md mt-1 inline-block">
                              {med.dosage}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="space-y-1.5 text-xs text-slate-600 bg-slate-50 rounded-xl p-3">
                      {med.frequency && (
                        <div>
                          <span className="text-slate-400 font-medium">{isTamil ? "அதிர்வெண்: " : "Frequency: "}</span>
                          <span className="font-semibold text-slate-800">{med.frequency}</span>
                        </div>
                      )}
                      {med.instructions && (
                        <div>
                          <span className="text-slate-400 font-medium">{isTamil ? "வழிமுறைகள்: " : "Instructions: "}</span>
                          <span className="font-semibold text-slate-800">{med.instructions}</span>
                        </div>
                      )}
                      {med.route && (
                        <div>
                          <span className="text-slate-400 font-medium">{isTamil ? "வழி: " : "Route: "}</span>
                          <span className="font-semibold text-slate-800">{med.route}</span>
                        </div>
                      )}
                    </div>

                    <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1">
                      <span className="truncate max-w-[180px]" title={med.source_document_title}>
                        {med.source_document_title}
                      </span>
                      <span className="font-mono text-[10px]">
                        ID: {med.source_document_id.slice(0, 6)}...
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="bg-white rounded-2xl border border-slate-200 p-6 text-center text-slate-500">
                <p className="text-xs">{isTamil ? "மருந்து பதிவுகள் எதுவும் இல்லை." : "No active medication records documented."}</p>
              </div>
            )}
          </section>
        )}

        {/* SECTION: RECENT DIAGNOSES / CONDITIONS */}
        {(activeTab === "overview" || activeTab === "records") && (
          <section className="space-y-4">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-rose-100 text-rose-700 flex items-center justify-center font-bold">
                <Activity className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-slate-900">
                  {isTamil ? "6. சமீபத்திய நோயறிதல்கள் / நிலைமைகள்" : "Recent Diagnoses & Recorded Conditions"}
                </h2>
                <p className="text-xs text-slate-500">
                  {isTamil ? "மருத்துவ ஆவணங்களில் குறிப்பிடப்பட்டுள்ள நிலைமைகள்." : "Documented clinical conditions from attending physicians."}
                </p>
              </div>
            </div>

            {summary?.recent_diagnoses && summary.recent_diagnoses.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                {summary.recent_diagnoses.map((diag, idx) => (
                  <div
                    key={`diag-${idx}`}
                    className="bg-white border border-slate-200/90 rounded-2xl p-4 shadow-sm flex items-start justify-between gap-3"
                  >
                    <div>
                      <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1">
                        {isTamil ? "பதிவு செய்யப்பட்ட நிலை" : "Documented Condition"}
                      </span>
                      <h4 className="font-bold text-base text-slate-900">{diag.condition_name}</h4>
                      <div className="text-xs text-slate-500 mt-1 flex flex-wrap items-center gap-3">
                        {diag.recorded_date && (
                          <span className="flex items-center gap-1">
                            <Calendar className="w-3 h-3 text-slate-400" />
                            {diag.recorded_date}
                          </span>
                        )}
                        {diag.doctor_name && (
                          <span className="flex items-center gap-1">
                            <User className="w-3 h-3 text-slate-400" />
                            {diag.doctor_name}
                          </span>
                        )}
                      </div>
                    </div>
                    <span className="px-2.5 py-1 rounded-lg text-xs font-bold bg-slate-100 text-slate-700">
                      ID: {diag.source_document_id.slice(0, 6)}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="bg-white rounded-2xl border border-slate-200 p-6 text-center text-slate-500">
                <p className="text-xs">{isTamil ? "பதிவு செய்யப்பட்ட நிலைமைகள் எதுவும் இல்லை." : "No explicit clinical diagnoses documented."}</p>
              </div>
            )}
          </section>
        )}

        {/* SECTION: LABORATORY OBSERVATIONS */}
        {(activeTab === "overview" || activeTab === "labs") && (
          <section className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-teal-100 text-teal-800 flex items-center justify-center font-bold">
                  <Activity className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-slate-900">
                    {isTamil ? "4. ஆய்வக சோதனைகள்" : "Laboratory Observations"}
                  </h2>
                  <p className="text-xs text-slate-500">
                    {isTamil ? "அனைத்து சரிபார்க்கப்பட்ட ஆய்வக சோதனைகளின் பட்டியல்." : "Complete longitudinal observation history from clinical reports."}
                  </p>
                </div>
              </div>
              <Link
                href="/lab"
                className="text-xs font-bold text-teal-700 hover:text-teal-800 flex items-center gap-1"
              >
                <span>{isTamil ? "விரிவான வரைபடங்களைப் பார்க்க" : "View Trends in Lab Dashboard"}</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-600 font-bold uppercase tracking-wider text-[11px]">
                      <th className="py-3.5 px-4">{isTamil ? "சோதனை பெயர்" : "Investigation"}</th>
                      <th className="py-3.5 px-4">{isTamil ? "மதிப்பு" : "Observed Value"}</th>
                      <th className="py-3.5 px-4">{isTamil ? "குறிப்பு வரம்பு" : "Reference Range"}</th>
                      <th className="py-3.5 px-4">{isTamil ? "நிலை" : "Status"}</th>
                      <th className="py-3.5 px-4">{isTamil ? "தேதி" : "Date"}</th>
                      <th className="py-3.5 px-4 text-right">{isTamil ? "ஆதாரம்" : "Source"}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium">
                    {summary?.laboratory_observations?.map((obs, idx) => (
                      <tr key={`obs-${idx}`} className="hover:bg-slate-50/60 transition-colors">
                        <td className="py-3 px-4 font-bold text-slate-900">
                          {obs.test_name}
                        </td>
                        <td className="py-3 px-4 font-bold text-slate-800">
                          {obs.value} <span className="font-normal text-slate-500">{obs.unit}</span>
                        </td>
                        <td className="py-3 px-4 text-slate-600">
                          {obs.reference_range}
                        </td>
                        <td className="py-3 px-4">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase ${
                              obs.status === "NORMAL"
                                ? "bg-emerald-100 text-emerald-800"
                                : obs.status === "HIGH"
                                ? "bg-rose-100 text-rose-800"
                                : obs.status === "LOW"
                                ? "bg-sky-100 text-sky-800"
                                : "bg-slate-100 text-slate-700"
                            }`}
                          >
                            {obs.status}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-slate-500">
                          {obs.test_date || "-"}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <span className="font-mono text-[10px] text-slate-400">
                            {obs.source_document_id.slice(0, 6)}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </section>
        )}

        {/* SECTION: RECENT MEDICAL RECORDS & IMPORTANT DATES */}
        {(activeTab === "overview" || activeTab === "records") && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* 2. RECENT MEDICAL RECORDS */}
            <div className="space-y-4">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-teal-100 text-teal-800 flex items-center justify-center font-bold">
                  <FileText className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    {isTamil ? "2. சமீபத்திய மருத்துவ ஆவணங்கள்" : "Recent Medical Records"}
                  </h3>
                  <p className="text-xs text-slate-500">
                    {isTamil ? "பகுப்பாய்வு செய்யப்பட்ட மருத்துவக் கோப்புகள்." : "Verified clinical reports on file."}
                  </p>
                </div>
              </div>

              <div className="space-y-3">
                {summary?.recent_medical_records?.map((rec, idx) => (
                  <div
                    key={`rec-${idx}`}
                    className="bg-white border border-slate-200/90 rounded-2xl p-4 shadow-sm space-y-2 hover:border-teal-300 transition-colors"
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <h4 className="font-bold text-slate-900 text-sm">{rec.filename}</h4>
                        <div className="text-xs text-slate-500 flex flex-wrap items-center gap-2 mt-0.5">
                          <span className="font-semibold text-teal-700 uppercase text-[10px] bg-teal-50 px-2 py-0.5 rounded">
                            {rec.document_type}
                          </span>
                          {rec.document_date && <span>{rec.document_date}</span>}
                          {rec.hospital_name && <span>• {rec.hospital_name}</span>}
                        </div>
                      </div>
                      <Link
                        href="/documents"
                        className="text-xs font-semibold text-teal-700 hover:text-teal-800 flex items-center gap-1"
                      >
                        {isTamil ? "பார்வை" : "View"}
                        <ChevronRight className="w-3.5 h-3.5" />
                      </Link>
                    </div>

                    {rec.key_findings && rec.key_findings.length > 0 && (
                      <div className="text-xs text-slate-600 bg-slate-50 rounded-xl p-2.5 space-y-1">
                        <span className="text-[10px] font-bold text-slate-400 uppercase block">
                          {isTamil ? "முக்கிய கண்டுபிடிப்புகள்:" : "Key Extracted Findings:"}
                        </span>
                        {rec.key_findings.map((f, fIdx) => (
                          <div key={`kf-${fIdx}`} className="flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-teal-500"></span>
                            <span>{f}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* 7. IMPORTANT DATES */}
            <div className="space-y-4">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold">
                  <Calendar className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    {isTamil ? "7. முக்கியமான தேதிகள் & காலவரிசை" : "Important Dates & Timeline"}
                  </h3>
                  <p className="text-xs text-slate-500">
                    {isTamil ? "மருத்துவ நிகழ்வுகள் மற்றும் சோதனை தேதிகள்." : "Clinical milestones and diagnostic timeline."}
                  </p>
                </div>
              </div>

              <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-sm space-y-4">
                {summary?.important_dates && summary.important_dates.length > 0 ? (
                  <div className="relative pl-6 space-y-4 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200">
                    {summary.important_dates.map((dateItem, idx) => (
                      <div key={`date-${idx}`} className="relative group">
                        <div className="absolute -left-[23px] top-1 w-3 h-3 rounded-full bg-teal-500 ring-4 ring-white group-hover:scale-125 transition-transform"></div>
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-slate-900 font-mono">
                            {dateItem.date}
                          </span>
                          <span className="text-[10px] uppercase font-bold text-teal-800 bg-teal-50 px-2 py-0.5 rounded-full">
                            {dateItem.category}
                          </span>
                        </div>
                        <p className="text-xs text-slate-600 mt-0.5">{dateItem.event}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-slate-500 text-center py-4">
                    {isTamil ? "தேதி பதிவுகள் எதுவும் இல்லை." : "No explicit clinical dates recorded."}
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* SECTION 8: QUESTIONS FOR YOUR DOCTOR */}
        {(activeTab === "overview" || activeTab === "questions") && (
          <section className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-teal-600 text-white flex items-center justify-center font-bold shadow-md shadow-teal-600/20">
                  <Stethoscope className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-slate-900">
                    {isTamil
                      ? "8. உங்கள் மருத்துவரிடம் கேட்க பரிந்துரைக்கப்படும் கேள்விகள்"
                      : "Questions You May Consider Asking Your Doctor"}
                  </h2>
                  <p className="text-xs text-slate-500">
                    {isTamil
                      ? "உங்கள் ஆய்வக முடிவுகள் மற்றும் மருந்துகளின் அடிப்படையில் தயாரிக்கப்பட்ட ஊடாடும் சரிபார்ப்புப் பட்டியல்."
                      : "Tailored discussion prompts grounded in your abnormal lab values and active prescriptions."}
                  </p>
                </div>
              </div>
              <div className="text-xs font-semibold text-slate-500">
                {Object.values(checkedQuestions).filter(Boolean).length} / {summary?.doctor_questions?.length || 0} {isTamil ? "தேர்ந்தெடுக்கப்பட்டது" : "checked"}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {summary?.doctor_questions?.map((item) => {
                const isChecked = !!checkedQuestions[item.id];
                return (
                  <div
                    key={item.id}
                    onClick={() => toggleQuestionChecked(item.id)}
                    className={`cursor-pointer rounded-2xl p-5 border-2 transition-all flex items-start gap-3.5 select-none ${
                      isChecked
                        ? "bg-teal-50/80 border-teal-500 shadow-sm"
                        : "bg-white border-slate-200/90 hover:border-teal-300 shadow-sm"
                    }`}
                  >
                    <div className="pt-0.5 text-teal-600 flex-shrink-0">
                      {isChecked ? (
                        <CheckSquare className="w-5 h-5 text-teal-600 fill-teal-100" />
                      ) : (
                        <Square className="w-5 h-5 text-slate-300 hover:text-slate-400" />
                      )}
                    </div>

                    <div className="flex-1 space-y-1.5">
                      <div className="flex items-center justify-between gap-2">
                        <span
                          className={`text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full ${
                            item.category === "LABORATORY"
                              ? "bg-amber-100 text-amber-800"
                              : item.category === "MEDICATION"
                              ? "bg-indigo-100 text-indigo-800"
                              : "bg-slate-100 text-slate-700"
                          }`}
                        >
                          {item.category}
                        </span>
                        {item.related_test_or_topic && (
                          <span className="text-[11px] font-bold text-slate-500">
                            {item.related_test_or_topic}
                          </span>
                        )}
                      </div>

                      <p
                        className={`text-sm font-semibold leading-relaxed ${
                          isChecked ? "text-teal-950 line-through opacity-80" : "text-slate-900"
                        }`}
                      >
                        "{item.question}"
                      </p>

                      <p className="text-xs text-slate-500 italic">
                        {item.context}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* BOTTOM METADATA AUDIT FOOTER */}
        <div className="bg-slate-100 border border-slate-200 rounded-xl p-4 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-500">
          <div className="flex items-center gap-2">
            <Info className="w-4 h-4 text-teal-600" />
            <span>
              {isTamil ? "மாடல்: " : "Generation Model: "}
              <strong className="text-slate-800">{summaryData?.model}</strong>
            </span>
            <span>•</span>
            <span>
              {isTamil ? "நம்பகத்தன்மை: " : "Grounded Confidence: "}
              <strong className="text-slate-800">{((summaryData?.confidence || 0.95) * 100).toFixed(0)}%</strong>
            </span>
          </div>

          <div className="flex items-center gap-2">
            <Clock className="w-3.5 h-3.5" />
            <span>
              {isTamil ? "உருவாக்கப்பட்ட நேரம்: " : "Last Synthesized: "}
              {summaryData?.generated_at ? new Date(summaryData.generated_at).toLocaleString() : "-"}
            </span>
          </div>
        </div>

      </div>
    </div>
  );
}
