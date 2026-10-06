"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { useLanguage } from "@/lib/language-context";
import {
  User,
  Shield,
  ShieldCheck,
  CreditCard,
  Globe,
  Clock,
  Activity,
  FileText,
  Lock,
  Mail,
  Phone,
  Calendar,
  CheckCircle2,
  RefreshCw,
  QrCode,
  AlertCircle,
  ExternalLink,
} from "lucide-react";
import {
  AuditLogItem,
  fetchAuditLogsApi,
  updateUserLanguageApi,
} from "@/lib/api";
import StatusIndicator from "@/components/StatusIndicator";
import { CardSkeleton, TableRowSkeleton } from "@/components/SkeletonLoader";
import EmptyState from "@/components/EmptyState";
import ErrorState from "@/components/ErrorState";

export default function ProfilePage() {
  const { user, token, isLoading: authLoading, refreshUser } = useAuth();
  const { language, setLanguage, isTamil, t } = useLanguage();
  const router = useRouter();

  // State
  const [auditLogs, setAuditLogs] = useState<AuditLogItem[]>([]);
  const [loadingLogs, setLoadingLogs] = useState<boolean>(true);
  const [updatingLang, setUpdatingLang] = useState<boolean>(false);
  const [langMessage, setLangMessage] = useState<string | null>(null);

  // Authentication Guard
  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/login?redirect=/profile");
    }
  }, [authLoading, user, router]);

  // Load live security audit trail
  const loadAuditLogs = useCallback(async () => {
    if (!token) return;
    setLoadingLogs(true);
    try {
      const logs = await fetchAuditLogsApi(token);
      setAuditLogs(logs);
    } catch {
      setAuditLogs([]);
    } finally {
      setLoadingLogs(false);
    }
  }, [token]);

  useEffect(() => {
    if (token) {
      loadAuditLogs();
    }
  }, [token, loadAuditLogs]);

  const handleLanguageChange = async (newLang: "en" | "ta") => {
    if (!token || newLang === language) return;
    setUpdatingLang(true);
    setLangMessage(null);
    try {
      await updateUserLanguageApi(newLang, token);
      setLanguage(newLang);
      if (refreshUser) {
        await refreshUser();
      }
      setLangMessage(
        newLang === "ta"
          ? "மொழி விருப்பம் வெற்றிகரமாக புதுப்பிக்கப்பட்டது!"
          : "Language preference updated successfully!"
      );
    } catch {
      setLangMessage(isTamil ? "மொழியை மாற்றுவதில் பிழை." : "Failed to update language.");
    } finally {
      setUpdatingLang(false);
    }
  };

  if (authLoading || !user) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        <CardSkeleton lines={4} />
        <CardSkeleton lines={6} />
      </div>
    );
  }

  const patient = user.patient;
  const initials = user.full_name
    ? user.full_name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .slice(0, 2)
        .toUpperCase()
    : "PT";

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8 animate-in fade-in duration-300">
      {/* Header */}
      <div className="bg-white rounded-2xl border border-slate-200/90 p-6 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-teal-600 to-emerald-500 flex items-center justify-center text-white font-bold text-xl shadow-md shadow-teal-500/20">
            {initials}
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">{user.full_name}</h1>
            <p className="text-xs text-slate-500 flex items-center gap-2 mt-0.5">
              <span>{user.email}</span>
              <span>&bull;</span>
              <span className="uppercase font-semibold text-teal-700">{user.role}</span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200/80 flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
            <span>HIPAA-Compliant Encrypted Vault</span>
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Mock ABHA Digital Health Card & Demographics (1 Col) */}
        <div className="space-y-6">
          {/* Mock ABHA Card */}
          <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-teal-950 text-white rounded-3xl p-6 shadow-xl relative overflow-hidden border border-slate-700 space-y-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-6 h-6 text-teal-400" />
                <span className="font-extrabold text-sm tracking-wider uppercase text-teal-300">
                  Ayushman Bharat (ABHA)
                </span>
              </div>
              <span className="px-2 py-0.5 rounded bg-teal-400/20 text-teal-300 text-[10px] font-bold border border-teal-400/30 uppercase">
                Mock ABHA Sandbox
              </span>
            </div>

            <div className="space-y-1">
              <span className="text-[10px] text-slate-400 tracking-wider uppercase">ABHA Number</span>
              <p className="font-mono text-lg font-bold tracking-widest text-white">
                {patient?.abha_id || "91-4829-1049-2810"}
              </p>
            </div>

            <div className="space-y-1">
              <span className="text-[10px] text-slate-400 tracking-wider uppercase">ABHA Address</span>
              <p className="font-mono text-xs font-semibold text-teal-200">
                {patient?.abha_address || `${user.email.split("@")[0]}@sbx`}
              </p>
            </div>

            <div className="pt-3 border-t border-slate-700/80 flex items-center justify-between text-[11px] text-slate-400">
              <div>
                <span>Patient: </span>
                <strong className="text-white">{user.full_name}</strong>
              </div>
              <div className="p-1.5 rounded-lg bg-white/10 text-white">
                <QrCode className="w-5 h-5" />
              </div>
            </div>

            <p className="text-[10px] text-slate-500 leading-tight">
              Educational & demonstration representation conforming to ABDM FHIR R4 schema.
            </p>
          </div>

          {/* Demographics Card */}
          <div className="bg-white rounded-2xl border border-slate-200/90 p-6 shadow-sm space-y-4">
            <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
              <User className="w-4 h-4 text-teal-600" />
              <span>Demographic Profile</span>
            </h3>

            <div className="space-y-3 text-xs">
              <div className="flex items-center justify-between py-2 border-b border-slate-100">
                <span className="text-slate-500">Full Name</span>
                <strong className="text-slate-900">{user.full_name}</strong>
              </div>
              <div className="flex items-center justify-between py-2 border-b border-slate-100">
                <span className="text-slate-500">Email Address</span>
                <strong className="text-slate-900">{user.email}</strong>
              </div>
              <div className="flex items-center justify-between py-2 border-b border-slate-100">
                <span className="text-slate-500">Blood Group</span>
                <strong className="text-slate-900">{patient?.blood_group || "Not recorded"}</strong>
              </div>
              <div className="flex items-center justify-between py-2 border-b border-slate-100">
                <span className="text-slate-500">Gender</span>
                <strong className="text-slate-900">{patient?.gender || "Not recorded"}</strong>
              </div>
              <div className="flex items-center justify-between py-2 border-b border-slate-100">
                <span className="text-slate-500">Contact Number</span>
                <strong className="text-slate-900">{patient?.contact_number || "Not recorded"}</strong>
              </div>
              <div className="flex items-center justify-between py-2">
                <span className="text-slate-500">Account Created</span>
                <strong className="text-slate-900">
                  {new Date(user.created_at).toLocaleDateString()}
                </strong>
              </div>
            </div>
          </div>

          {/* Language Preference Card */}
          <div className="bg-white rounded-2xl border border-slate-200/90 p-6 shadow-sm space-y-4">
            <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
              <Globe className="w-4 h-4 text-teal-600" />
              <span>Language Preference</span>
            </h3>

            <p className="text-xs text-slate-500 leading-relaxed">
              Select your preferred language for AI medical record explanations and bilingual summaries.
            </p>

            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => handleLanguageChange("en")}
                disabled={updatingLang}
                className={`p-3 rounded-xl border text-xs font-bold transition-all text-center ${
                  language === "en"
                    ? "border-teal-600 bg-teal-50 text-teal-900 shadow-2xs"
                    : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                }`}
              >
                English (Default)
              </button>
              <button
                onClick={() => handleLanguageChange("ta")}
                disabled={updatingLang}
                className={`p-3 rounded-xl border text-xs font-bold transition-all text-center ${
                  language === "ta"
                    ? "border-teal-600 bg-teal-50 text-teal-900 shadow-2xs"
                    : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                }`}
              >
                தமிழ் (Tamil)
              </button>
            </div>

            {langMessage && (
              <p className="text-xs font-semibold text-emerald-700 flex items-center gap-1.5 animate-in fade-in">
                <CheckCircle2 className="w-4 h-4" />
                <span>{langMessage}</span>
              </p>
            )}
          </div>
        </div>

        {/* Right Column: Live Security & Activity Audit Trail (2 Cols) */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white rounded-2xl border border-slate-200/90 p-6 shadow-sm space-y-5">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-teal-50 text-teal-700 flex items-center justify-center">
                  <Shield className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-slate-900">
                    Live Security & Audit Trail
                  </h3>
                  <p className="text-xs text-slate-500">
                    Immutable activity log recording authentication, document access, and AI exports
                  </p>
                </div>
              </div>
              <button
                onClick={loadAuditLogs}
                disabled={loadingLogs}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors"
                title="Refresh audit logs"
              >
                <RefreshCw className={`w-3 h-3 ${loadingLogs ? "animate-spin text-teal-600" : ""}`} />
                <span>Refresh Logs</span>
              </button>
            </div>

            {loadingLogs ? (
              <div className="space-y-2">
                <CardSkeleton lines={4} />
              </div>
            ) : auditLogs.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider text-[10px] border-y border-slate-100">
                    <tr>
                      <th className="py-2.5 px-3 font-semibold">Event</th>
                      <th className="py-2.5 px-3 font-semibold">Status</th>
                      <th className="py-2.5 px-3 font-semibold">Timestamp</th>
                      <th className="py-2.5 px-3 font-semibold">IP Address</th>
                      <th className="py-2.5 px-3 font-semibold text-right">Details</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {auditLogs.map((log) => (
                      <tr key={log.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-3 px-3">
                          <span className="font-mono font-bold text-slate-800 text-[11px]">
                            {log.event_type}
                          </span>
                        </td>
                        <td className="py-3 px-3">
                          <StatusIndicator status={log.status} size="sm" />
                        </td>
                        <td className="py-3 px-3 text-slate-600 font-mono text-[11px]">
                          {new Date(log.created_at).toLocaleString()}
                        </td>
                        <td className="py-3 px-3 font-mono text-[11px] text-slate-500">
                          {log.ip_address || "Internal Client"}
                        </td>
                        <td className="py-3 px-3 text-right text-slate-500 text-[11px] truncate max-w-[150px]">
                          {log.resource_id ? `ID: ${log.resource_id.slice(0, 8)}...` : "--"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <EmptyState
                icon={Shield}
                title="No Audit Logs Recorded Yet"
                description="User logins, document uploads, and clinical AI interactions are logged here automatically."
              />
            )}
          </div>

          {/* Security Architecture Guarantees */}
          <div className="bg-slate-50 rounded-2xl border border-slate-200/80 p-6 space-y-4">
            <h4 className="font-bold text-xs uppercase tracking-wider text-slate-700 flex items-center gap-2">
              <Lock className="w-4 h-4 text-teal-600" />
              <span>Platform Security Guarantees</span>
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs text-slate-600">
              <div className="p-3 bg-white rounded-xl border border-slate-200/60 space-y-1">
                <span className="font-bold text-slate-900 block">Argon2id Key Derivation</span>
                <p className="text-[11px] text-slate-500 leading-relaxed">
                  OWASP-recommended memory-hard hashing algorithm guarding password databases against GPU attacks.
                </p>
              </div>
              <div className="p-3 bg-white rounded-xl border border-slate-200/60 space-y-1">
                <span className="font-bold text-slate-900 block">Strict Multi-Tenant Isolation</span>
                <p className="text-[11px] text-slate-500 leading-relaxed">
                  Every document access checks user ownership at the database boundary, returning 404 on unverified queries.
                </p>
              </div>
              <div className="p-3 bg-white rounded-xl border border-slate-200/60 space-y-1">
                <span className="font-bold text-slate-900 block">Sensitive Data Scrubbing</span>
                <p className="text-[11px] text-slate-500 leading-relaxed">
                  Bearer tokens, passwords, and medical text are automatically scrubbed prior to console or file persistence.
                </p>
              </div>
              <div className="p-3 bg-white rounded-xl border border-slate-200/60 space-y-1">
                <span className="font-bold text-slate-900 block">ABDM FHIR R4 Schema Ready</span>
                <p className="text-[11px] text-slate-500 leading-relaxed">
                  Built to seamlessly connect to India National Health Stack upon official gateway credentialing.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
