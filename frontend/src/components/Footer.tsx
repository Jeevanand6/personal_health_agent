import React from "react";
import { ShieldCheck, HeartPulse } from "lucide-react";

export default function Footer() {
  return (
    <footer className="border-t border-slate-200 bg-white text-slate-600 text-xs py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-4">
        {/* Medical disclaimer alert */}
        <div className="p-4 rounded-xl bg-amber-50 border border-amber-200/80 flex items-start gap-3 text-amber-900">
          <ShieldCheck className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div className="leading-relaxed">
            <span className="font-semibold text-amber-950">Clinical & Medical Safety Notice: </span>
            This application is designed solely for personal healthcare record organization, transcription assistance, and educational reference. It does not provide medical diagnoses, treatment recommendations, or medication adjustments. Always consult a qualified healthcare professional regarding any medical condition or before making changes to prescribed treatments.
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t border-slate-100">
          <div className="flex items-center gap-2 text-slate-500">
            <HeartPulse className="w-4 h-4 text-teal-600" />
            <span>AI-Powered Personal Health Copilot &copy; {new Date().getFullYear()}</span>
          </div>

          <div className="flex items-center gap-6 text-slate-500">
            <span>FHIR R4 Interoperability Ready</span>
            <span>ABDM / ABHA Architecture</span>
            <span>HIPAA-aligned Safeguards</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
