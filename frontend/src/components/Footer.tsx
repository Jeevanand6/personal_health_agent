"use client";

import React from "react";
import { ShieldCheck, HeartPulse } from "lucide-react";
import { useLanguage } from "@/lib/language-context";

export default function Footer() {
  const { isTamil, t } = useLanguage();

  return (
    <footer className="border-t border-slate-200 bg-white text-slate-600 text-xs py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-4">
        {/* Medical disclaimer alert */}
        <div className="p-4 rounded-xl bg-amber-50 border border-amber-200/80 flex items-start gap-3 text-amber-900">
          <ShieldCheck className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div className="leading-relaxed">
            <span className="font-semibold text-amber-950">
              {isTamil ? "முக்கிய மருத்துவ மறுப்பு & பாதுகாப்பு அறிவிப்பு: " : "Clinical & Medical Safety Notice: "}
            </span>
            {isTamil
              ? "இந்த அமைப்பு தகவல் மற்றும் ஆவணப் பதிவு நோக்கங்களுக்காக மட்டுமே. இது மருத்துவ நோயறிதல், சிகிச்சை பரிந்துரைகள் அல்லது மருந்து மாற்றங்களை வழங்குவதில்லை. ஏதேனும் மருத்துவ முடிவுகளை எடுப்பதற்கு முன் எப்போதும் உங்கள் தகுதிவாய்ந்த மருத்துவரை அணுகவும்."
              : "This application is designed solely for personal healthcare record organization, transcription assistance, and educational reference. It does not provide medical diagnoses, treatment recommendations, or medication adjustments. Always consult a qualified healthcare professional regarding any medical condition or before making changes to prescribed treatments."}
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t border-slate-100">
          <div className="flex items-center gap-2 text-slate-500">
            <HeartPulse className="w-4 h-4 text-teal-600" />
            <span>
              {isTamil
                ? `AI மருத்துவ ஆவண உதவியாளர் © ${new Date().getFullYear()}`
                : `AI-Powered Personal Health Copilot © ${new Date().getFullYear()}`}
            </span>
          </div>

          <div className="flex items-center gap-6 text-slate-500">
            <span>{isTamil ? "FHIR R4 இணக்கத்தன்மை" : "FHIR R4 Interoperability Ready"}</span>
            <span>{isTamil ? "ABDM / ABHA கட்டமைப்பு" : "ABDM / ABHA Architecture"}</span>
            <span>{isTamil ? "HIPAA-இணக்கமான பாதுகாப்பு" : "HIPAA-aligned Safeguards"}</span>
          </div>
        </div>
      </div>
    </footer>
  );
}

