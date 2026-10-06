"use client";

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
import { useLanguage } from "@/lib/language-context";

export default function HomePage() {
  const { isTamil, t } = useLanguage();

  return (
    <div className="space-y-16 py-12 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
      {/* Hero Section */}
      <section className="text-center space-y-6 pt-6 sm:pt-12">
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-teal-50 border border-teal-200/80 text-teal-800 text-xs font-semibold">
          <HeartPulse className="w-4 h-4 text-teal-600 animate-pulse" />
          <span>
            {isTamil
              ? "முழுமையான தமிழ் & ஆங்கில ஆதரவு • நம்பகமான மருத்துவ தளம்"
              : "Bilingual English & Tamil Support • Traceable Clinical Architecture"}
          </span>
        </div>

        <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold text-slate-900 tracking-tight max-w-4xl mx-auto leading-[1.15]">
          {isTamil ? "உங்கள் அறிவார்ந்த, நம்பகமான " : "Your Intelligent, Grounded "}
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-teal-600 to-emerald-600">
            {isTamil ? "தனிப்பட்ட மருத்துவ உதவியாளர்" : "Personal Health Copilot"}
          </span>
        </h1>

        <p className="text-lg sm:text-xl text-slate-600 max-w-2xl mx-auto leading-relaxed">
          {isTamil
            ? "மருந்துச் சீட்டுகள், ஆய்வக அறிக்கைகள் மற்றும் சிகிச்சைச் சுருக்கங்களைப் பதிவேற்றவும். சிக்கலான மருத்துவ ஆவணங்களை எளிய மொழி விளக்கங்கள், காலவரிசை மற்றும் பாதுகாப்பான பதிவுகளாக மாற்றவும்."
            : "Upload medical prescriptions, diagnostic summaries, and lab reports. Transform complex clinical documents into plain-language explanations, timeline tracking, and FHIR-ready records."}
        </p>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
          <Link
            href="/dashboard"
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-semibold text-sm shadow-lg shadow-teal-600/25 transition-all hover:-translate-y-0.5"
          >
            <span>{isTamil ? "கட்டுப்பாட்டுப் பலகையைத் திற" : "Launch Dashboard"}</span>
            <ArrowRight className="w-4 h-4" />
          </Link>

          <Link
            href="/register"
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl bg-teal-50 border border-teal-200 text-teal-800 font-semibold text-sm hover:bg-teal-100 transition-colors shadow-sm"
          >
            <span>{isTamil ? "புதிய சுயவிவரத்தை உருவாக்கு" : "Create Patient Profile"}</span>
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
            <h2 className="text-lg font-bold text-slate-900">
              {isTamil ? "தள உள்கட்டமைப்பு நிலை" : "Platform Infrastructure Status"}
            </h2>
            <p className="text-xs text-slate-500">
              {isTamil ? "நேரடி பல அடுக்கு சூழல் கட்டமைப்பு" : "Live multi-tier environment topology"}
            </p>
          </div>
          <span className="px-2.5 py-1 rounded-md bg-emerald-100 text-emerald-800 text-xs font-semibold">
            {isTamil ? "செயலில் உள்ளது" : "Phase 9 Active"}
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
                {isTamil
                  ? "App Router, TypeScript, Tailwind CSS, முழு தமிழ் & ஆங்கில மொழிபெயர்ப்பு இடைமுகம்."
                  : "App Router, TypeScript, Tailwind CSS, Recharts analytics, and bilingual shell."}
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
                {isTamil
                  ? "Pydantic சரிபார்ப்பு, பாதுகாப்பான AI சுகாதார சுருக்கம் மற்றும் தமிழ் மொழி ஆதரவு."
                  : "Pydantic validation, health probes, CORS middleware, and multilingual summary service."}
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
                {isTamil
                  ? "SQLAlchemy 2.0 ORM, Alembic இடம்பெயர்வுகள், மொழி விருப்பத் தேர்வு சேமிப்பு."
                  : "SQLAlchemy 2.0 ORM, Alembic migrations, UUID indexing, and persistent language storage."}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Core Workflow Pillars: UPLOAD -> UNDERSTAND -> ORGANIZE -> EXPLAIN -> TRACK */}
      <section className="space-y-6">
        <div className="text-center space-y-2">
          <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">
            {isTamil ? "மருத்துவப் பணிப்பாய்வு எவ்வாறு செயல்படுகிறது" : "How The Healthcare Journey Works"}
          </h2>
          <p className="text-sm text-slate-500">
            {isTamil
              ? "மருத்துவ பாதுகாப்பு, உண்மைத் தரவுகள் மற்றும் நோயாளி கல்வி அடிப்படையில் வடிவமைக்கப்பட்டது."
              : "Engineered around clinical safety, data grounding, and patient education."}
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          <div className="p-5 rounded-xl bg-white border border-slate-200 space-y-2 shadow-sm hover:border-teal-400 transition-colors">
            <div className="w-8 h-8 rounded-lg bg-teal-50 text-teal-700 flex items-center justify-center font-bold text-xs">
              01
            </div>
            <h4 className="font-semibold text-slate-900 text-sm">
              {isTamil ? "பதிவேற்று" : "Upload"}
            </h4>
            <p className="text-xs text-slate-500 leading-relaxed">
              {isTamil
                ? "PDF, JPG, PNG மருத்துவ அறிக்கைகள் மற்றும் மருந்துச்சீட்டுகளை 15MB வரை ஏற்கிறது."
                : "Accepts PDF, JPG, PNG medical reports and prescriptions up to 15MB."}
            </p>
          </div>

          <div className="p-5 rounded-xl bg-white border border-slate-200 space-y-2 shadow-sm hover:border-teal-400 transition-colors">
            <div className="w-8 h-8 rounded-lg bg-teal-50 text-teal-700 flex items-center justify-center font-bold text-xs">
              02
            </div>
            <h4 className="font-semibold text-slate-900 text-sm">
              {isTamil ? "புரிந்துணர்" : "Understand"}
            </h4>
            <p className="text-xs text-slate-500 leading-relaxed">
              {isTamil
                ? "PaddleOCR உரை பிரித்தெடுத்தல் மற்றும் துல்லிய மதிப்பீடு."
                : "PaddleOCR text extraction and confidence evaluation for high-fidelity digitization."}
            </p>
          </div>

          <div className="p-5 rounded-xl bg-white border border-slate-200 space-y-2 shadow-sm hover:border-teal-400 transition-colors">
            <div className="w-8 h-8 rounded-lg bg-teal-50 text-teal-700 flex items-center justify-center font-bold text-xs">
              03
            </div>
            <h4 className="font-semibold text-slate-900 text-sm">
              {isTamil ? "ஒழுங்கமை" : "Organize"}
            </h4>
            <p className="text-xs text-slate-500 leading-relaxed">
              {isTamil
                ? "FHIR-இணக்கமான ஆய்வக சோதனைகள், மருந்துகள் மற்றும் நோயறிதல்களாக தரப்படுத்தப்படுகிறது."
                : "Standardized into FHIR-compliant Observations, MedicationRequests, and Diagnoses."}
            </p>
          </div>

          <div className="p-5 rounded-xl bg-white border border-slate-200 space-y-2 shadow-sm hover:border-teal-400 transition-colors">
            <div className="w-8 h-8 rounded-lg bg-teal-50 text-teal-700 flex items-center justify-center font-bold text-xs">
              04
            </div>
            <h4 className="font-semibold text-slate-900 text-sm">
              {isTamil ? "விளக்கு" : "Explain"}
            </h4>
            <p className="text-xs text-slate-500 leading-relaxed">
              {isTamil
                ? "இயல்பான வரம்புகளின் அடிப்படையில் ஆய்வக முடிவுகளுக்கான எளிய மொழி விளக்கங்கள்."
                : "Deterministic abnormal lab flagging + 3-part grounded AI educational explanations."}
            </p>
          </div>

          <div className="p-5 rounded-xl bg-white border border-slate-200 space-y-2 shadow-sm hover:border-teal-400 transition-colors">
            <div className="w-8 h-8 rounded-lg bg-teal-50 text-teal-700 flex items-center justify-center font-bold text-xs">
              05
            </div>
            <h4 className="font-semibold text-slate-900 text-sm">
              {isTamil ? "கண்காணி" : "Track"}
            </h4>
            <p className="text-xs text-slate-500 leading-relaxed">
              {isTamil
                ? "ஒருங்கிணைந்த காலவரிசை மற்றும் காலப்போக்கில் சோதனை மாற்றங்களின் வரைபடங்கள்."
                : "Interactive longitudinal timeline and biomarker trend analysis over time."}
            </p>
          </div>
        </div>
      </section>

      {/* Core Safety Guidelines Notice */}
      <section className="rounded-2xl bg-gradient-to-br from-slate-900 to-slate-800 text-white p-8 space-y-4">
        <div className="flex items-center gap-2 text-teal-400 text-sm font-semibold">
          <ShieldCheck className="w-5 h-5" />
          <span>
            {isTamil ? "கட்டமைக்கப்பட்ட கண்டிப்பான AI மருத்துவ பாதுகாப்பு விதிகள்" : "Strict AI Safety Principles Built-In"}
          </span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-2 text-xs text-slate-300">
          <div>
            <strong className="text-white block text-sm mb-1">
              {isTamil ? "மருத்துவப் புனைவு இல்லை" : "Zero Medical Invention"}
            </strong>
            {isTamil
              ? "ஆவணத்தில் இல்லாத விவரங்கள் வெளிப்படையாக விடுபட்டதாகவே பதிவு செய்யப்படுகிறது. கற்பனையான மதிப்புகள் உருவாக்கப்படாது."
              : "Missing details explicitly return 'Not available in the uploaded document.' No fabricated lab values or synthetic diagnoses."}
          </div>
          <div>
            <strong className="text-white block text-sm mb-1">
              {isTamil ? "துல்லியமான வரம்பு மதிப்பீடு" : "Deterministic Lab Flags"}
            </strong>
            {isTamil
              ? "மாறுபட்ட ஆய்வக முடிவுகள் மருத்துவ குறிப்பு வரம்புகளின் எண் கணித விதிகளால் மட்டுமே கண்டறியப்படுகின்றன."
              : "Abnormal values are detected using verified numerical reference range algorithms rather than unconstrained LLM hallucinations."}
          </div>
          <div>
            <strong className="text-white block text-sm mb-1">
              {isTamil ? "எண் மதிப்புகள் மாறாத தன்மை" : "Preserved Medical Invariance"}
            </strong>
            {isTamil
              ? "மொழிபெயர்ப்பின் போது சோதனைப் பெயர்கள், மருந்துகள், எண் அளவுகள் மற்றும் அலகுகள் எப்போதும் மாற்றமின்றி பாதுகாக்கப்படும்."
              : "Numerical values, units (mg/dL, g/dL), medication names, and test names are strictly invariant across languages."}
          </div>
        </div>
      </section>
    </div>
  );
}

