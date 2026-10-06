"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import {
  FileText,
  Calendar,
  Pill,
  Activity,
  Shield,
  CheckCircle2,
  RefreshCw,
  LogOut,
  User as UserIcon,
  Sparkles,
} from "lucide-react";
import { fetchHealthStatus, HealthStatus } from "@/lib/api";

export default function DashboardPage() {
  const { user, isLoading, logout } = useAuth();
  const router = useRouter();

  const [activeTab, setActiveTab] = useState<"overview" | "documents" | "timeline">("overview");
  const [healthStatus, setHealthStatus] = useState<HealthStatus | null>(null);
  const [testingHealth, setTestingHealth] = useState<boolean>(false);

  // Authentication Protection: Redirect unauthenticated users to /login
  useEffect(() => {
    if (!isLoading && !user) {
      router.push("/login");
    }
  }, [isLoading, user, router]);

  const runHealthTest = async () => {
    setTestingHealth(true);
    const res = await fetchHealthStatus();
    setHealthStatus(res);
    setTestingHealth(false);
  };

  useEffect(() => {
    runHealthTest();
  }, []);

  // Display clean loading state while verifying session
  if (isLoading) {
    return (
      <div className="min-h-[calc(100vh-16rem)] flex flex-col items-center justify-center space-y-4">
        <div className="w-12 h-12 rounded-2xl bg-teal-50 border border-teal-200/80 flex items-center justify-center text-teal-600 animate-spin">
          <RefreshCw className="w-6 h-6" />
        </div>
        <p className="text-sm font-semibold text-slate-600 animate-pulse">
          Verifying secure clinical session...
        </p>
      </div>
    );
  }

  // Guard against unauthenticated render prior to redirect
  if (!user) {
    return null;
  }

  const patient = user.patient;
  const initials = user.full_name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase() || "PT";

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Patient Profile Header with Authenticated Data & Mock ABHA ID */}
      <div className="bg-white rounded-2xl border border-slate-200/90 p-6 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-teal-600 to-emerald-500 flex items-center justify-center text-white font-bold text-xl shadow-md shadow-teal-500/20">
            {initials}
          </div>
          <div className="space-y-1">
            <div className="flex items-center gap-2.5">
              <h1 className="text-xl font-bold text-slate-900">{user.full_name}</h1>
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                Active Session
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500">
              <span className="flex items-center gap-1 font-mono">
                <span className="text-slate-400 font-sans">Mock ABHA:</span>{" "}
                <strong className="text-slate-800">{patient?.abha_id || "Unassigned"}</strong>
              </span>
              <span>&bull;</span>
              <span>
                <span className="text-slate-400">ABHA Address:</span>{" "}
                <strong className="text-slate-700 font-medium">
                  {patient?.abha_address || "None"}
                </strong>
              </span>
              <span>&bull;</span>
              <span>
                <span className="text-slate-400">Blood Group:</span>{" "}
                <strong className="text-slate-700 font-medium">
                  {patient?.blood_group || "Not recorded"}
                </strong>
              </span>
              <span>&bull;</span>
              <span>
                <span className="text-slate-400">Language:</span>{" "}
                <strong className="text-slate-700 font-medium">
                  {patient?.preferred_language === "ta" ? "தமிழ்" : "English"}
                </strong>
              </span>
            </div>
          </div>
        </div>

        {/* Action Controls: Diagnostic Ping & Logout */}
        <div className="flex items-center gap-2.5 self-stretch md:self-auto justify-end border-t md:border-t-0 pt-4 md:pt-0 border-slate-100">
          <button
            onClick={runHealthTest}
            disabled={testingHealth}
            title="Ping Health Endpoint"
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${testingHealth ? "animate-spin text-teal-600" : ""}`} />
            <span>Ping Backend</span>
          </button>

          <button
            onClick={logout}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100 transition-colors"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Sign Out</span>
          </button>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
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
          <p className="text-[11px] text-slate-500">Ready for Phase 3 document intake</p>
        </div>

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
          <p className="text-[11px] text-slate-500">Awaiting lab document OCR</p>
        </div>

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
          <p className="text-[11px] text-slate-500">Prescription extraction ready</p>
        </div>

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
          <p className="text-[11px] text-slate-500">
            PostgreSQL: <strong className="text-slate-700">{healthStatus?.database || "Checking..."}</strong>
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
            <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200/90 p-8 shadow-sm space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-base font-bold text-slate-900">Upload Medical Document</h3>
                  <p className="text-xs text-slate-500">
                    PDF, JPG, JPEG, or PNG clinical records up to 15MB
                  </p>
                </div>
                <span className="text-[11px] font-mono bg-teal-50 text-teal-700 border border-teal-200 px-2 py-0.5 rounded">
                  Authenticated Intake
                </span>
              </div>

              <div className="border-2 border-dashed border-slate-200 rounded-2xl p-10 text-center hover:border-teal-400 transition-colors bg-slate-50/50 space-y-4">
                <div className="w-14 h-14 rounded-2xl bg-teal-50 border border-teal-200/80 text-teal-600 mx-auto flex items-center justify-center">
                  <svg
                    className="w-7 h-7"
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

            {/* Session & Backend Diagnostics */}
            <div className="bg-white rounded-2xl border border-slate-200/90 p-6 shadow-sm space-y-5">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-teal-600" />
                <span>Verified Patient Credentials</span>
              </h3>

              <div className="space-y-3 text-xs">
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between">
                  <span className="text-slate-600">User Email:</span>
                  <span className="font-mono font-semibold text-slate-800">{user.email}</span>
                </div>
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between">
                  <span className="text-slate-600">Role:</span>
                  <span className="font-mono font-semibold uppercase text-teal-700">
                    {user.role}
                  </span>
                </div>
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between">
                  <span className="text-slate-600">Security Cipher:</span>
                  <span className="font-mono font-semibold text-slate-700">Argon2id + JWT</span>
                </div>
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between">
                  <span className="text-slate-600">FastAPI API Status:</span>
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
              </div>

              <div className="pt-2 text-[11px] text-slate-400">
                Logged in at: {new Date(user.created_at).toLocaleDateString()}
              </div>
            </div>
          </div>
        )}

        {activeTab === "documents" && (
          <div className="bg-white rounded-2xl border border-slate-200/90 p-12 text-center shadow-sm space-y-4">
            <div className="w-12 h-12 rounded-xl bg-slate-100 text-slate-400 mx-auto flex items-center justify-center">
              <FileText className="w-6 h-6" />
            </div>
            <div className="space-y-1">
              <h4 className="text-base font-semibold text-slate-900">No medical documents yet</h4>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                Documents uploaded by {user.full_name} will be indexed and extracted here.
              </p>
            </div>
          </div>
        )}

        {activeTab === "timeline" && (
          <div className="bg-white rounded-2xl border border-slate-200/90 p-12 text-center shadow-sm space-y-4">
            <div className="w-12 h-12 rounded-xl bg-slate-100 text-slate-400 mx-auto flex items-center justify-center">
              <Calendar className="w-6 h-6" />
            </div>
            <div className="space-y-1">
              <h4 className="text-base font-semibold text-slate-900">Health timeline will appear here</h4>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                Prescriptions and lab results will build a longitudinal journey for your profile.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
