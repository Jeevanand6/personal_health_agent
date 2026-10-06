"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  FileText,
  Upload,
  Calendar,
  Pill,
  Activity,
  User,
  Shield,
  Clock,
  ArrowUpRight,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
} from "lucide-react";
import { fetchHealthStatus, HealthStatus } from "@/lib/api";

export default function DashboardPage() {
  const [activeTab, setActiveTab] = useState<"overview" | "documents" | "timeline" | "labs">("overview");
  const [healthStatus, setHealthStatus] = useState<HealthStatus | null>(null);
  const [testingHealth, setTestingHealth] = useState<boolean>(false);

  const runHealthTest = async () => {
    setTestingHealth(true);
    const res = await fetchHealthStatus();
    setHealthStatus(res);
    setTestingHealth(false);
  };

  useEffect(() => {
    runHealthTest();
  }, []);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Patient Profile Banner with Mock ABHA identity */}
      <div className="bg-white rounded-2xl border border-slate-200/90 p-6 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-teal-50 border border-teal-200/80 flex items-center justify-center text-teal-700 font-bold text-xl shadow-inner">
            AK
          </div>
          <div className="space-y-1">
            <div className="flex items-center gap-2.5">
              <h1 className="text-xl font-bold text-slate-900">Arun Kumar</h1>
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                Verified Patient
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500">
              <span className="flex items-center gap-1 font-mono">
                <span className="text-slate-400 font-sans">Mock ABHA:</span> 91-7294-8102-3841
              </span>
              <span>&bull;</span>
              <span>
                <strong className="text-slate-700 font-medium">ABHA Address:</strong> arun.kumar@abdm
              </span>
              <span>&bull;</span>
              <span>
                <strong className="text-slate-700 font-medium">Blood Group:</strong> B+
              </span>
              <span>&bull;</span>
              <span>
                <strong className="text-slate-700 font-medium">Language:</strong> English (English / தமிழ்)
              </span>
            </div>
          </div>
        </div>

        {/* Phase 1 Status Pill */}
        <div className="flex items-center gap-3 self-stretch md:self-auto justify-end border-t md:border-t-0 pt-4 md:pt-0 border-slate-100">
          <button
            onClick={runHealthTest}
            disabled={testingHealth}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${testingHealth ? "animate-spin text-teal-600" : ""}`} />
            <span>Ping Backend API</span>
          </button>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Metric 1 */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-sm space-y-3">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Uploaded Documents
            </span>
            <div className="p-2 rounded-xl bg-teal-50 text-teal-600">
              <FileText className="w-5 h-5" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-slate-900">0</span>
            <span className="text-xs text-slate-400">files</span>
          </div>
          <p className="text-[11px] text-slate-500 flex items-center gap-1">
            <span>Ready for Phase 2 upload intake</span>
          </p>
        </div>

        {/* Metric 2 */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-sm space-y-3">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Lab Biomarkers
            </span>
            <div className="p-2 rounded-xl bg-indigo-50 text-indigo-600">
              <Activity className="w-5 h-5" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-slate-900">0</span>
            <span className="text-xs text-slate-400">tracked</span>
          </div>
          <p className="text-[11px] text-slate-500 flex items-center gap-1">
            <span>Awaiting lab document OCR</span>
          </p>
        </div>

        {/* Metric 3 */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-sm space-y-3">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Active Prescriptions
            </span>
            <div className="p-2 rounded-xl bg-purple-50 text-purple-600">
              <Pill className="w-5 h-5" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-slate-900">0</span>
            <span className="text-xs text-slate-400">medications</span>
          </div>
          <p className="text-[11px] text-slate-500 flex items-center gap-1">
            <span>Prescription extraction ready</span>
          </p>
        </div>

        {/* Metric 4 */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-sm space-y-3">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              API & DB Status
            </span>
            <div className="p-2 rounded-xl bg-emerald-50 text-emerald-600">
              <CheckCircle2 className="w-5 h-5" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-extrabold text-emerald-600">
              {healthStatus?.status === "healthy" ? "Healthy" : "Connecting"}
            </span>
          </div>
          <p className="text-[11px] text-slate-500 flex items-center gap-1">
            <span>PostgreSQL: </span>
            <strong className="text-slate-700">
              {healthStatus?.database || "Checking..."}
            </strong>
          </p>
        </div>
      </div>

      {/* Main Workspace Tabs */}
      <div className="space-y-6">
        <div className="border-b border-slate-200 flex items-center gap-2 overflow-x-auto pb-px">
          <button
            onClick={() => setActiveTab("overview")}
            className={`px-4 py-2.5 text-sm font-semibold border-b-2 transition-colors flex items-center gap-2 whitespace-nowrap ${
              activeTab === "overview"
                ? "border-teal-600 text-teal-700 bg-teal-50/50 rounded-t-lg"
                : "border-transparent text-slate-600 hover:text-slate-900"
            }`}
          >
            <Activity className="w-4 h-4" />
            <span>Health Overview</span>
          </button>
          <button
            onClick={() => setActiveTab("documents")}
            className={`px-4 py-2.5 text-sm font-semibold border-b-2 transition-colors flex items-center gap-2 whitespace-nowrap ${
              activeTab === "documents"
                ? "border-teal-600 text-teal-700 bg-teal-50/50 rounded-t-lg"
                : "border-transparent text-slate-600 hover:text-slate-900"
            }`}
          >
            <FileText className="w-4 h-4" />
            <span>Medical Records (0)</span>
          </button>
          <button
            onClick={() => setActiveTab("timeline")}
            className={`px-4 py-2.5 text-sm font-semibold border-b-2 transition-colors flex items-center gap-2 whitespace-nowrap ${
              activeTab === "timeline"
                ? "border-teal-600 text-teal-700 bg-teal-50/50 rounded-t-lg"
                : "border-transparent text-slate-600 hover:text-slate-900"
            }`}
          >
            <Calendar className="w-4 h-4" />
            <span>Health Timeline</span>
          </button>
        </div>

        {/* Tab Content 1: Overview */}
        {activeTab === "overview" && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Upload Area Shell (Ready for Phase 2) */}
            <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200/90 p-8 shadow-sm space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-base font-bold text-slate-900">Upload Medical Document</h3>
                  <p className="text-xs text-slate-500">
                    PDF, JPG, JPEG, or PNG files up to 15MB
                  </p>
                </div>
                <span className="text-[11px] font-mono bg-teal-50 text-teal-700 border border-teal-200 px-2 py-0.5 rounded">
                  Phase 2 Intake Ready
                </span>
              </div>

              {/* Upload Dropzone Container */}
              <div className="border-2 border-dashed border-slate-200 rounded-2xl p-10 text-center hover:border-teal-400 transition-colors bg-slate-50/50 space-y-4">
                <div className="w-14 h-14 rounded-2xl bg-teal-50 border border-teal-200/80 text-teal-600 mx-auto flex items-center justify-center">
                  <UploadCloud className="w-7 h-7" />
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-semibold text-slate-800">
                    Drag and drop your medical record here, or{" "}
                    <span className="text-teal-600 underline cursor-pointer">browse files</span>
                  </p>
                  <p className="text-xs text-slate-500">
                    Supports Prescriptions, Lab Reports, Diagnostic Summaries & Discharge Cards
                  </p>
                </div>
                <div className="pt-2">
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-amber-50 text-amber-800 border border-amber-200">
                    <Shield className="w-3.5 h-3.5 text-amber-600" />
                    Encrypted storage &bull; Local Docker Volume &bull; HIPAA/ABDM safeguards
                  </span>
                </div>
              </div>
            </div>

            {/* Health AI Engine Status & Diagnostics */}
            <div className="bg-white rounded-2xl border border-slate-200/90 p-6 shadow-sm space-y-5">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-teal-600" />
                <span>Backend Diagnostic Probe</span>
              </h3>

              <div className="space-y-3 text-xs">
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between">
                  <span className="text-slate-600">FastAPI Health:</span>
                  <span className="font-mono font-semibold text-emerald-700">
                    {healthStatus?.status || "Checking..."}
                  </span>
                </div>
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between">
                  <span className="text-slate-600">PostgreSQL Session:</span>
                  <span className="font-mono font-semibold text-emerald-700">
                    {healthStatus?.database || "Checking..."}
                  </span>
                </div>
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between">
                  <span className="text-slate-600">Alembic Migration:</span>
                  <span className="font-mono font-semibold text-slate-700">
                    0001_initial_phase1_schema
                  </span>
                </div>
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between">
                  <span className="text-slate-600">FHIR Engine:</span>
                  <span className="font-mono font-semibold text-slate-700">
                    HL7 R4 Schema Ready
                  </span>
                </div>
              </div>

              <div className="pt-2 text-[11px] text-slate-400">
                Last verified: {healthStatus?.timestamp ? new Date(healthStatus.timestamp).toLocaleTimeString() : "Pending"}
              </div>
            </div>
          </div>
        )}

        {/* Tab Content 2: Empty state for Documents */}
        {activeTab === "documents" && (
          <div className="bg-white rounded-2xl border border-slate-200/90 p-12 text-center shadow-sm space-y-4">
            <div className="w-12 h-12 rounded-xl bg-slate-100 text-slate-400 mx-auto flex items-center justify-center">
              <FileText className="w-6 h-6" />
            </div>
            <div className="space-y-1">
              <h4 className="text-base font-semibold text-slate-900">No medical documents yet</h4>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                Once Phase 2 OCR is configured, uploaded documents will appear here with extracted entities, classification, and OCR confidence ratings.
              </p>
            </div>
          </div>
        )}

        {/* Tab Content 3: Empty state for Timeline */}
        {activeTab === "timeline" && (
          <div className="bg-white rounded-2xl border border-slate-200/90 p-12 text-center shadow-sm space-y-4">
            <div className="w-12 h-12 rounded-xl bg-slate-100 text-slate-400 mx-auto flex items-center justify-center">
              <Calendar className="w-6 h-6" />
            </div>
            <div className="space-y-1">
              <h4 className="text-base font-semibold text-slate-900">Health timeline will appear here</h4>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                Every uploaded prescription, test result, and clinical encounter will automatically form a chronological journey.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function UploadCloud(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      {...props}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M4 14.899A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 2.5 8.242" />
      <path d="M12 12v9" />
      <path d="m16 16-4-4-4 4" />
    </svg>
  );
}
