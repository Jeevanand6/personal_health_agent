import React from "react";
import Link from "next/link";
import {
  UploadCloud,
  FileCheck2,
  LineChart,
  Brain,
  ShieldCheck,
  Languages,
  ArrowRight,
  Database,
  Cpu,
  HeartPulse,
} from "lucide-react";

export default function HomePage() {
  return (
    <div className="space-y-16 py-12 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
      {/* Hero Section */}
      <section className="text-center space-y-6 pt-6 sm:pt-12">
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-teal-50 border border-teal-200/80 text-teal-800 text-xs font-semibold">
          <HeartPulse className="w-4 h-4 text-teal-600 animate-pulse" />
          <span>Production Prototype &bull; Phase 1 Infrastructure Active</span>
        </div>

        <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold text-slate-900 tracking-tight max-w-4xl mx-auto leading-[1.15]">
          Your Intelligent, Grounded{" "}
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-teal-600 to-emerald-600">
            Personal Health Copilot
          </span>
        </h1>

        <p className="text-lg sm:text-xl text-slate-600 max-w-2xl mx-auto leading-relaxed">
          Upload medical prescriptions, diagnostic summaries, and lab reports. Transform complex clinical documents into plain-language explanations, timeline tracking, and FHIR-ready records.
        </p>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
          <Link
            href="/dashboard"
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-semibold text-sm shadow-lg shadow-teal-600/25 transition-all hover:-translate-y-0.5"
          >
            <span>Launch Dashboard</span>
            <ArrowRight className="w-4 h-4" />
          </Link>

          <Link
            href="/register"
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl bg-teal-50 border border-teal-200 text-teal-800 font-semibold text-sm hover:bg-teal-100 transition-colors shadow-sm"
          >
            <span>Create Patient Profile</span>
          </Link>

          <a
            href="http://localhost:8000/docs"
            target="_blank"
            rel="noopener noreferrer"
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl bg-white border border-slate-300 text-slate-700 font-semibold text-sm hover:bg-slate-50 transition-colors shadow-sm"
          >
            <span>FastAPI Docs</span>
            <span className="text-xs text-slate-400 font-mono">:8000/docs</span>
          </a>
        </div>
      </section>

      {/* System Architecture Connectivity Grid */}
      <section className="p-6 sm:p-8 rounded-2xl bg-white border border-slate-200/90 shadow-sm space-y-6">
        <div className="flex items-center justify-between border-b border-slate-100 pb-4">
          <div>
            <h2 className="text-lg font-bold text-slate-900">Platform Infrastructure Status</h2>
            <p className="text-xs text-slate-500">Live multi-tier environment topology</p>
          </div>
          <span className="px-2.5 py-1 rounded-md bg-emerald-100 text-emerald-800 text-xs font-semibold">
            Phase 1 Healthy
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Node 1: Next.js */}
          <div className="p-5 rounded-xl bg-slate-50 border border-slate-200/80 space-y-3">
            <div className="flex items-center justify-between">
              <span className="p-2 rounded-lg bg-teal-100 text-teal-700">
                <Cpu className="w-5 h-5" />
              </span>
              <span className="text-[11px] font-mono font-semibold px-2 py-0.5 rounded bg-emerald-100 text-emerald-700">
                PORT 3000
              </span>
            </div>
            <div>
              <h3 className="font-semibold text-slate-900 text-sm">Next.js 14 Frontend</h3>
              <p className="text-xs text-slate-500 mt-0.5">
                App Router, TypeScript, Tailwind CSS, Recharts analytics, and responsive shell.
              </p>
            </div>
          </div>

          {/* Node 2: FastAPI */}
          <div className="p-5 rounded-xl bg-slate-50 border border-slate-200/80 space-y-3">
            <div className="flex items-center justify-between">
              <span className="p-2 rounded-lg bg-teal-100 text-teal-700">
                <Brain className="w-5 h-5" />
              </span>
              <span className="text-[11px] font-mono font-semibold px-2 py-0.5 rounded bg-emerald-100 text-emerald-700">
                PORT 8000
              </span>
            </div>
            <div>
              <h3 className="font-semibold text-slate-900 text-sm">FastAPI REST Core</h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Pydantic validation, health probes, CORS middleware, and modular API routers.
              </p>
            </div>
          </div>

          {/* Node 3: PostgreSQL */}
          <div className="p-5 rounded-xl bg-slate-50 border border-slate-200/80 space-y-3">
            <div className="flex items-center justify-between">
              <span className="p-2 rounded-lg bg-teal-100 text-teal-700">
                <Database className="w-5 h-5" />
              </span>
              <span className="text-[11px] font-mono font-semibold px-2 py-0.5 rounded bg-emerald-100 text-emerald-700">
                PORT 5432
              </span>
            </div>
            <div>
              <h3 className="font-semibold text-slate-900 text-sm">PostgreSQL 16 DB</h3>
              <p className="text-xs text-slate-500 mt-0.5">
                SQLAlchemy 2.0 ORM, Alembic migrations, UUID indexing, and FHIR resource schemas.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Core Workflow Pillars: UPLOAD -> UNDERSTAND -> ORGANIZE -> EXPLAIN -> TRACK */}
      <section className="space-y-6">
        <div className="text-center space-y-2">
          <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">
            How The Healthcare Journey Works
          </h2>
          <p className="text-sm text-slate-500">
            Engineered around clinical safety, data grounding, and patient education.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          <div className="p-5 rounded-xl bg-white border border-slate-200 space-y-2 shadow-sm hover:border-teal-400 transition-colors">
            <div className="w-8 h-8 rounded-lg bg-teal-50 text-teal-700 flex items-center justify-center font-bold text-xs">
              01
            </div>
            <h4 className="font-semibold text-slate-900 text-sm">Upload</h4>
            <p className="text-xs text-slate-500 leading-relaxed">
              Accepts PDF, JPG, PNG medical reports and prescriptions up to 15MB.
            </p>
          </div>

          <div className="p-5 rounded-xl bg-white border border-slate-200 space-y-2 shadow-sm hover:border-teal-400 transition-colors">
            <div className="w-8 h-8 rounded-lg bg-teal-50 text-teal-700 flex items-center justify-center font-bold text-xs">
              02
            </div>
            <h4 className="font-semibold text-slate-900 text-sm">Understand</h4>
            <p className="text-xs text-slate-500 leading-relaxed">
              PaddleOCR text extraction and confidence evaluation for high-fidelity digitization.
            </p>
          </div>

          <div className="p-5 rounded-xl bg-white border border-slate-200 space-y-2 shadow-sm hover:border-teal-400 transition-colors">
            <div className="w-8 h-8 rounded-lg bg-teal-50 text-teal-700 flex items-center justify-center font-bold text-xs">
              03
            </div>
            <h4 className="font-semibold text-slate-900 text-sm">Organize</h4>
            <p className="text-xs text-slate-500 leading-relaxed">
              Standardized into FHIR-compliant Observations, MedicationRequests, and Diagnoses.
            </p>
          </div>

          <div className="p-5 rounded-xl bg-white border border-slate-200 space-y-2 shadow-sm hover:border-teal-400 transition-colors">
            <div className="w-8 h-8 rounded-lg bg-teal-50 text-teal-700 flex items-center justify-center font-bold text-xs">
              04
            </div>
            <h4 className="font-semibold text-slate-900 text-sm">Explain</h4>
            <p className="text-xs text-slate-500 leading-relaxed">
              Deterministic abnormal lab flagging + 3-part grounded AI educational explanations.
            </p>
          </div>

          <div className="p-5 rounded-xl bg-white border border-slate-200 space-y-2 shadow-sm hover:border-teal-400 transition-colors">
            <div className="w-8 h-8 rounded-lg bg-teal-50 text-teal-700 flex items-center justify-center font-bold text-xs">
              05
            </div>
            <h4 className="font-semibold text-slate-900 text-sm">Track</h4>
            <p className="text-xs text-slate-500 leading-relaxed">
              Interactive longitudinal timeline and biomarker trend analysis over time.
            </p>
          </div>
        </div>
      </section>

      {/* Core Safety Guidelines Notice */}
      <section className="rounded-2xl bg-gradient-to-br from-slate-900 to-slate-800 text-white p-8 space-y-4">
        <div className="flex items-center gap-2 text-teal-400 text-sm font-semibold">
          <ShieldCheck className="w-5 h-5" />
          <span>Strict AI Safety Principles Built-In</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-2 text-xs text-slate-300">
          <div>
            <strong className="text-white block text-sm mb-1">Zero Medical Invention</strong>
            Missing details explicitly return <em>&quot;Not available in the uploaded document.&quot;</em> No fabricated lab values or synthetic diagnoses.
          </div>
          <div>
            <strong className="text-white block text-sm mb-1">Deterministic Lab Flags</strong>
            Abnormal values are detected using verified numerical reference range algorithms rather than unconstrained LLM hallucinations.
          </div>
          <div>
            <strong className="text-white block text-sm mb-1">Mandatory 3-Part Output</strong>
            All summaries strictly separate <strong>Extracted Facts</strong> from <strong>AI Interpretation</strong> and include permanent <strong>Medical Disclaimers</strong>.
          </div>
        </div>
      </section>
    </div>
  );
}
