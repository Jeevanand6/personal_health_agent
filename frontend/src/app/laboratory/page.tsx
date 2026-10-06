"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { useLanguage } from "@/lib/language-context";
import { useDemoMode } from "@/components/DemoModeBanner";
import {
  ObservationInterpretation,
  LabTrendSeries,
  LabDashboardData,
  getLabDashboardApi,
} from "@/lib/api";
import {
  FlaskConical,
  Activity,
  AlertTriangle,
  AlertCircle,
  CheckCircle2,
  Clock,
  ArrowUpRight,
  ArrowDownRight,
  HelpCircle,
  ShieldAlert,
  Search,
  Filter,
  RefreshCw,
  FileText,
  ChevronRight,
  TrendingUp,
  BarChart3,
  Calendar,
  Layers,
  Sparkles,
  ExternalLink,
} from "lucide-react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ReferenceLine,
  BarChart,
  Bar,
  Cell,
  PieChart,
  Pie,
} from "recharts";
import StatusIndicator from "@/components/StatusIndicator";
import { CardSkeleton, MetricSkeleton, TableRowSkeleton } from "@/components/SkeletonLoader";
import EmptyState from "@/components/EmptyState";
import ErrorState from "@/components/ErrorState";

export default function LaboratoryPage() {
  const { user, token, isLoading: authLoading } = useAuth();
  const { language, isTamil, t } = useLanguage();
  const { isDemoMode } = useDemoMode();
  const router = useRouter();

  const [dashboardData, setDashboardData] = useState<LabDashboardData | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [selectedFilter, setSelectedFilter] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [selectedTrendTest, setSelectedTrendTest] = useState<string>("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Authentication Guard
  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/login?redirect=/laboratory");
    }
  }, [authLoading, user, router]);

  const loadDashboard = useCallback(async () => {
    if (!token) return;
    setErrorMessage(null);
    try {
      const data = await getLabDashboardApi(token);
      setDashboardData(data);
      if (data.trends.length > 0 && !selectedTrendTest) {
        setSelectedTrendTest(data.trends[0].test_name);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to load laboratory analytics.";
      setErrorMessage(msg);
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  }, [token, selectedTrendTest]);

  useEffect(() => {
    if (token) {
      loadDashboard();
    }
  }, [token, loadDashboard]);

  const handleRefresh = () => {
    setRefreshing(true);
    loadDashboard();
  };

  // Synthetic demo fallback if explicit demo mode is on and zero data
  const demoDashboardData: LabDashboardData = useMemo(() => ({
    total_tests: 8,
    normal_count: 5,
    review_recommended_count: 2,
    urgent_review_count: 1,
    unknown_count: 0,
    recent_interpretations: [
      {
        id: "demo-lab-1",
        observation_id: "obs-1",
        document_id: "doc-1",
        user_id: user?.id || "demo",
        test_name: "Fasting Blood Glucose",
        value: "142",
        numeric_value: 142,
        unit: "mg/dL",
        reference_range: "70 - 99 mg/dL",
        status: "HIGH",
        severity: "REVIEW_RECOMMENDED",
        explanation: "Fasting blood sugar is elevated above normal adult limits, consistent with impaired fasting glucose or diabetes.",
        confidence: 0.96,
        source: "AI Clinical Model",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      {
        id: "demo-lab-2",
        observation_id: "obs-2",
        document_id: "doc-1",
        user_id: user?.id || "demo",
        test_name: "HbA1c",
        value: "7.2",
        numeric_value: 7.2,
        unit: "%",
        reference_range: "4.0 - 5.6 %",
        status: "HIGH",
        severity: "URGENT_REVIEW",
        explanation: "Glycated hemoglobin reflects elevated average glycemic levels over preceding 90 days. Clinical review advised.",
        confidence: 0.98,
        source: "AI Clinical Model",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      {
        id: "demo-lab-3",
        observation_id: "obs-3",
        document_id: "doc-1",
        user_id: user?.id || "demo",
        test_name: "Serum Creatinine",
        value: "0.9",
        numeric_value: 0.9,
        unit: "mg/dL",
        reference_range: "0.7 - 1.3 mg/dL",
        status: "NORMAL",
        severity: "NORMAL",
        explanation: "Renal filtration marker is well within normal range, indicating preserved kidney clearance.",
        confidence: 0.95,
        source: "AI Clinical Model",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      {
        id: "demo-lab-4",
        observation_id: "obs-4",
        document_id: "doc-1",
        user_id: user?.id || "demo",
        test_name: "Hemoglobin",
        value: "14.2",
        numeric_value: 14.2,
        unit: "g/dL",
        reference_range: "13.0 - 17.0 g/dL",
        status: "NORMAL",
        severity: "NORMAL",
        explanation: "Red blood cell oxygenation capacity is optimal with no evidence of anemia.",
        confidence: 0.97,
        source: "AI Clinical Model",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ],
    trends: [
      {
        test_name: "Fasting Blood Glucose",
        unit: "mg/dL",
        latest_value: 142,
        latest_status: "HIGH",
        latest_severity: "REVIEW_RECOMMENDED",
        reference_range: "70 - 99 mg/dL",
        points: [
          {
            date: "Jan 2024",
            timestamp: "2024-01-15",
            value: 110,
            unit: "mg/dL",
            status: "HIGH",
            severity: "REVIEW_RECOMMENDED",
            reference_min: 70,
            reference_max: 99,
            document_id: "demo-doc-1",
          },
          {
            date: "May 2024",
            timestamp: "2024-05-10",
            value: 128,
            unit: "mg/dL",
            status: "HIGH",
            severity: "REVIEW_RECOMMENDED",
            reference_min: 70,
            reference_max: 99,
            document_id: "demo-doc-2",
          },
          {
            date: "Sep 2024",
            timestamp: "2024-09-18",
            value: 142,
            unit: "mg/dL",
            status: "HIGH",
            severity: "REVIEW_RECOMMENDED",
            reference_min: 70,
            reference_max: 99,
            document_id: "demo-doc-3",
          },
        ],
      },
    ],
  }), [user?.id]);

  const effectiveData = useMemo(() => {
    if (dashboardData && dashboardData.recent_interpretations.length > 0) {
      return dashboardData;
    }
    if (isDemoMode) {
      return demoDashboardData;
    }
    return dashboardData;
  }, [dashboardData, isDemoMode, demoDashboardData]);

  const activeTrend = useMemo(() => {
    if (!effectiveData?.trends || effectiveData.trends.length === 0) return null;
    if (!selectedTrendTest) return effectiveData.trends[0];
    return effectiveData.trends.find((t) => t.test_name === selectedTrendTest) || effectiveData.trends[0];
  }, [effectiveData, selectedTrendTest]);

  // Filtered interpretations
  const filteredInterpretations = useMemo(() => {
    const list = effectiveData?.recent_interpretations || [];
    return list.filter((item) => {
      const matchesSearch =
        item.test_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.explanation.toLowerCase().includes(searchQuery.toLowerCase());

      if (!matchesSearch) return false;

      if (selectedFilter === "NORMAL") return item.status === "NORMAL";
      if (selectedFilter === "HIGH") return item.status === "HIGH";
      if (selectedFilter === "LOW") return item.status === "LOW";
      if (selectedFilter === "ATTENTION")
        return item.severity === "REVIEW_RECOMMENDED" || item.severity === "URGENT_REVIEW";

      return true;
    });
  }, [effectiveData, searchQuery, selectedFilter]);

  if (authLoading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          <MetricSkeleton />
          <MetricSkeleton />
          <MetricSkeleton />
          <MetricSkeleton />
        </div>
        <CardSkeleton lines={6} />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8 animate-in fade-in duration-300">
      {/* Header */}
      <div className="bg-white rounded-2xl border border-slate-200/90 p-6 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-indigo-600 to-teal-500 flex items-center justify-center text-white shadow-md shadow-indigo-500/20">
            <FlaskConical className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-slate-900 tracking-tight">
                {isTamil ? "ஆய்வக பகுப்பாய்வு மையம்" : "Laboratory Intelligence"}
              </h1>
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200/80">
                Quantitative & Qualitative Labs
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Deterministic range matching, out-of-bounds alerting, and longitudinal trend lines
            </p>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2.5 flex-wrap">
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors shadow-2xs"
            title="Refresh laboratory data"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? "animate-spin text-indigo-600" : ""}`} />
            <span>Refresh</span>
          </button>
          <Link
            href="/documents"
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm transition-colors"
          >
            <FileText className="w-3.5 h-3.5" />
            <span>Upload Lab Report</span>
          </Link>
        </div>
      </div>

      {errorMessage && (
        <ErrorState
          title="Laboratory data load error"
          message={errorMessage}
          onRetry={loadDashboard}
        />
      )}

      {/* KPI Cards Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-2xs space-y-2">
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold uppercase tracking-wider">
            <span>Total Biomarkers</span>
            <Activity className="w-4 h-4 text-slate-400" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-extrabold text-slate-900">
              {effectiveData?.total_tests || 0}
            </span>
            <span className="text-xs text-slate-400">observations</span>
          </div>
          <p className="text-[11px] text-slate-500">Across all uploaded reports</p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-2xs space-y-2">
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold uppercase tracking-wider">
            <span>Within Normal Range</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-extrabold text-emerald-600">
              {effectiveData?.normal_count || 0}
            </span>
            <span className="text-xs text-slate-400">markers normal</span>
          </div>
          <p className="text-[11px] text-slate-500">Satisfies standard reference bounds</p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-2xs space-y-2">
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold uppercase tracking-wider">
            <span>Review Recommended</span>
            <AlertTriangle className="w-4 h-4 text-amber-500" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-extrabold text-amber-600">
              {effectiveData?.review_recommended_count || 0}
            </span>
            <span className="text-xs text-slate-400">elevated / low</span>
          </div>
          <p className="text-[11px] text-slate-500">Mild to moderate out-of-range deviations</p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-2xs space-y-2">
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold uppercase tracking-wider">
            <span>Urgent Review</span>
            <AlertCircle className="w-4 h-4 text-rose-600" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-extrabold text-rose-600">
              {effectiveData?.urgent_review_count || 0}
            </span>
            <span className="text-xs text-slate-400">critical</span>
          </div>
          <p className="text-[11px] text-slate-500">Substantial deviation requiring attention</p>
        </div>
      </div>

      {/* Interactive Trend Chart Section */}
      {effectiveData?.trends && effectiveData.trends.length > 0 && activeTrend && (
        <div className="bg-white rounded-2xl border border-slate-200/90 p-6 shadow-sm space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-teal-50 text-teal-700 flex items-center justify-center">
                <TrendingUp className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-sm text-slate-900">
                  Longitudinal Trend: {activeTrend.test_name}
                </h3>
                <p className="text-xs text-slate-500">
                  Reference: {activeTrend.reference_range || "N/A"} &bull; Latest:{" "}
                  <strong className="text-slate-800">{activeTrend.latest_value} {activeTrend.unit || ""}</strong>
                </p>
              </div>
            </div>

            {effectiveData.trends.length > 1 && (
              <select
                value={selectedTrendTest}
                onChange={(e) => setSelectedTrendTest(e.target.value)}
                className="text-xs rounded-xl border border-slate-200 py-1.5 px-3 bg-slate-50 font-semibold focus:outline-hidden"
              >
                {effectiveData.trends.map((t) => (
                  <option key={t.test_name} value={t.test_name}>
                    {t.test_name}
                  </option>
                ))}
              </select>
            )}
          </div>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={activeTrend.points}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="date" stroke="#94a3b8" fontSize={11} />
                <YAxis stroke="#94a3b8" fontSize={11} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#ffffff",
                    borderColor: "#e2e8f0",
                    borderRadius: "0.75rem",
                    fontSize: "12px",
                  }}
                />
                {activeTrend.points[0]?.reference_max && (
                  <ReferenceLine
                    y={activeTrend.points[0].reference_max}
                    label={{ value: "Max Ref", fill: "#f59e0b", fontSize: 10 }}
                    stroke="#f59e0b"
                    strokeDasharray="4 4"
                  />
                )}
                {activeTrend.points[0]?.reference_min && (
                  <ReferenceLine
                    y={activeTrend.points[0].reference_min}
                    label={{ value: "Min Ref", fill: "#f59e0b", fontSize: 10 }}
                    stroke="#f59e0b"
                    strokeDasharray="4 4"
                  />
                )}
                <Line
                  type="monotone"
                  dataKey="value"
                  stroke="#4f46e5"
                  strokeWidth={2.5}
                  dot={{ fill: "#4f46e5", r: 4 }}
                  activeDot={{ r: 6 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Filter and Search Controls */}
      <div className="bg-white rounded-2xl border border-slate-200/90 p-4 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search laboratory test or diagnosis..."
            className="w-full pl-9 pr-4 py-2 text-xs rounded-xl border border-slate-200 focus:outline-hidden focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Filter className="w-3.5 h-3.5 text-slate-400" />
          <div className="flex items-center gap-1 overflow-x-auto text-xs">
            {["ALL", "ATTENTION", "NORMAL", "HIGH", "LOW"].map((flt) => (
              <button
                key={flt}
                onClick={() => setSelectedFilter(flt)}
                className={`px-3 py-1.5 rounded-lg font-semibold transition-colors ${
                  selectedFilter === flt
                    ? "bg-indigo-600 text-white"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                {flt}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Results Table */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm overflow-hidden">
        <div className="p-5 border-b border-slate-100 flex items-center justify-between">
          <h3 className="font-bold text-sm text-slate-900">
            Laboratory Observations & Interpretations ({filteredInterpretations.length})
          </h3>
          <span className="text-xs text-slate-500">
            Deterministic Reference Bounds Analysis
          </span>
        </div>

        {isLoading ? (
          <div className="p-6">
            <CardSkeleton lines={5} />
          </div>
        ) : filteredInterpretations.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider text-[10px] border-b border-slate-100">
                <tr>
                  <th className="py-3 px-4 font-semibold">Test Name</th>
                  <th className="py-3 px-4 font-semibold">Measured Value</th>
                  <th className="py-3 px-4 font-semibold">Reference Range</th>
                  <th className="py-3 px-4 font-semibold">Clinical Status</th>
                  <th className="py-3 px-4 font-semibold">Severity</th>
                  <th className="py-3 px-4 font-semibold">Clinical Explanation</th>
                  <th className="py-3 px-4 font-semibold text-right">Source</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredInterpretations.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3.5 px-4 font-bold text-slate-900">{item.test_name}</td>
                    <td className="py-3.5 px-4 font-mono font-bold text-slate-800">
                      {item.value} {item.unit || ""}
                    </td>
                    <td className="py-3.5 px-4 text-slate-500 font-medium">
                      {item.reference_range || "--"}
                    </td>
                    <td className="py-3.5 px-4">
                      <StatusIndicator status={item.status} size="sm" />
                    </td>
                    <td className="py-3.5 px-4">
                      <StatusIndicator status={item.severity} size="sm" />
                    </td>
                    <td className="py-3.5 px-4 text-slate-600 max-w-sm leading-relaxed">
                      {item.explanation}
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      {item.document_id && (
                        <Link
                          href={`/documents/${item.document_id}`}
                          className="inline-flex items-center gap-1 text-teal-600 hover:text-teal-800 font-semibold"
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
          <div className="p-8">
            <EmptyState
              icon={FlaskConical}
              title="No Laboratory Results Found"
              description={
                searchQuery
                  ? `No tests match your filter "${searchQuery}".`
                  : "Upload diagnostic or pathology reports to automatically analyze blood work, metabolic panels, and urine tests."
              }
              actionText={searchQuery ? "Clear Search" : "Upload Lab Report"}
              onAction={searchQuery ? () => setSearchQuery("") : undefined}
              actionHref={searchQuery ? undefined : "/documents"}
            />
          </div>
        )}
      </div>
    </div>
  );
}
