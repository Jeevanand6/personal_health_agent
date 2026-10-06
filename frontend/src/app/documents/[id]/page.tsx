"use client";

import React, { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import {
  MedicalDocument,
  DocumentExtraction,
  AIExtraction,
  getDocumentApi,
  getDocumentExtractionApi,
  getDocumentAIExtractionApi,
  runDocumentOcrApi,
  triggerAIExtractionApi,
  interpretDocumentApi,
  getDocumentInterpretationsApi,
  ObservationInterpretation,
  getDocumentPreviewUrl,
  ProcessingStatusEnum,
} from "@/lib/api";
import {
  ArrowLeft,
  FileText,
  Play,
  RotateCw,
  Copy,
  Check,
  Download,
  AlertTriangle,
  AlertCircle,
  CheckCircle2,
  Clock,
  Globe,
  Layers,
  Sparkles,
  ExternalLink,
  Search,
  FileCode,
  Eye,
  ShieldCheck,
  FileCheck2,
  User as UserIcon,
  Stethoscope,
  Building2,
  Activity,
  Pill,
  FlaskConical,
  ClipboardList,
  Calendar,
  ChevronDown,
  ChevronUp,
  Info,
  ShieldAlert,
} from "lucide-react";
import { useLanguage } from "@/lib/language-context";

export default function DocumentDetailsPage() {
  const { id } = useParams();
  const documentId = Array.isArray(id) ? id[0] : id;
  const { user, token, isLoading: authLoading } = useAuth();
  const { isTamil, t } = useLanguage();
  const router = useRouter();

  // State
  const [document, setDocument] = useState<MedicalDocument | null>(null);
  const [extraction, setExtraction] = useState<DocumentExtraction | null>(null);
  const [aiExtraction, setAiExtraction] = useState<AIExtraction | null>(null);
  const [interpretations, setInterpretations] = useState<ObservationInterpretation[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isProcessingOcr, setIsProcessingOcr] = useState<boolean>(false);
  const [isExtractingAI, setIsExtractingAI] = useState<boolean>(false);
  const [isInterpreting, setIsInterpreting] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<"interpretations" | "structured" | "cleaned" | "raw">(
    "interpretations"
  );
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [copied, setCopied] = useState<boolean>(false);
  const [showRawJson, setShowRawJson] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Authentication check
  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/login");
    }
  }, [authLoading, user, router]);

  // Load document, OCR, and AI extraction
  const loadDocumentData = async () => {
    if (!token || !documentId) return;
    setIsLoading(true);
    setErrorMessage(null);

    try {
      const doc = await getDocumentApi(documentId, token);
      setDocument(doc);

      // Attempt to load OCR extraction
      try {
        const ext = await getDocumentExtractionApi(documentId, token);
        setExtraction(ext);
      } catch {
        setExtraction(null);
      }

      // Attempt to load AI structured extraction
      try {
        const aiExt = await getDocumentAIExtractionApi(documentId, token);
        setAiExtraction(aiExt);
      } catch {
        setAiExtraction(null);
      }

      // Attempt to load Lab Interpretations
      try {
        const interpRes = await getDocumentInterpretationsApi(documentId, token);
        setInterpretations(interpRes.interpretations);
        if (interpRes.interpretations.length > 0) {
          setActiveTab("interpretations");
        } else {
          setActiveTab("structured");
        }
      } catch {
        setInterpretations([]);
        setActiveTab("structured");
      }
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : "Failed to load document details.";
      setErrorMessage(msg);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRunInterpretation = async () => {
    if (!token || !documentId) return;
    setIsInterpreting(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const res = await interpretDocumentApi(documentId, token);
      setInterpretations(res.interpretations);
      setActiveTab("interpretations");
      setSuccessMessage(
        `Safe laboratory interpretation completed for ${res.total_interpreted} observations!`
      );

      // Reload structured AI extraction if needed
      try {
        const aiExt = await getDocumentAIExtractionApi(documentId, token);
        setAiExtraction(aiExt);
      } catch {}
    } catch (err: unknown) {
      const msg =
        err instanceof Error
          ? err.message
          : "Failed to interpret laboratory observations.";
      setErrorMessage(msg);
    } finally {
      setIsInterpreting(false);
    }
  };

  useEffect(() => {
    if (token && documentId) {
      loadDocumentData();
    }
  }, [token, documentId]);

  // Trigger OCR
  const handleRunOcr = async () => {
    if (!token || !documentId) return;
    setIsProcessingOcr(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const result = await runDocumentOcrApi(documentId, token);

      if (document) {
        setDocument({
          ...document,
          processing_status: result.processing_status,
        });
      }

      if (result.extraction) {
        setExtraction(result.extraction);
      } else {
        try {
          const ext = await getDocumentExtractionApi(documentId, token);
          setExtraction(ext);
        } catch {
          // ignore
        }
      }

      if (result.processing_status === "COMPLETED") {
        setSuccessMessage("PaddleOCR text extraction completed with high confidence!");
      } else if (result.processing_status === "LOW_CONFIDENCE") {
        setSuccessMessage(
          "OCR completed with LOW CONFIDENCE. Please review the extracted text carefully."
        );
      } else {
        setErrorMessage(
          result.message || "OCR extraction could not detect readable medical text."
        );
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "OCR pipeline execution failed.";
      setErrorMessage(msg);
    } finally {
      setIsProcessingOcr(false);
    }
  };

  // Trigger AI Structured Extraction
  const handleRunAIExtract = async () => {
    if (!token || !documentId) return;
    setIsExtractingAI(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const result = await triggerAIExtractionApi(documentId, token);

      if (result.extraction) {
        setAiExtraction(result.extraction);
        setActiveTab("structured");
        setSuccessMessage(
          `AI clinical extraction completed via ${result.extraction.model_name} with ${Math.round(
            result.extraction.confidence_score * 100
          )}% confidence!`
        );
      } else {
        setErrorMessage(result.message || "AI extraction did not return structured data.");
      }

      // Also reload doc status and OCR if newly created
      try {
        const ext = await getDocumentExtractionApi(documentId, token);
        setExtraction(ext);
      } catch {
        // ignore
      }
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : "AI structured extraction failed.";
      setErrorMessage(msg);
    } finally {
      setIsExtractingAI(false);
    }
  };

  // Copy to clipboard
  const handleCopyText = () => {
    let textToCopy = "";
    if (activeTab === "structured" && aiExtraction) {
      textToCopy = JSON.stringify(aiExtraction.structured_data, null, 2);
    } else if (activeTab === "cleaned") {
      textToCopy = extraction?.cleaned_text || "";
    } else {
      textToCopy = extraction?.raw_text || "";
    }

    if (!textToCopy) return;

    navigator.clipboard.writeText(textToCopy);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  // Download export file
  const handleDownloadExport = () => {
    if (!document) return;
    let content = "";
    let fileName = "";

    if (activeTab === "structured" && aiExtraction) {
      content = JSON.stringify(aiExtraction.structured_data, null, 2);
      fileName = `${document.original_filename}_structured_ai.json`;
    } else {
      content =
        activeTab === "cleaned"
          ? extraction?.cleaned_text || ""
          : extraction?.raw_text || "";
      fileName = `${document.original_filename}_ocr_${activeTab}.txt`;
    }

    if (!content) return;

    const blob = new Blob([content], {
      type: activeTab === "structured" ? "application/json" : "text/plain;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const link = window.document.createElement("a");
    link.href = url;
    link.download = fileName;
    link.click();
    URL.revokeObjectURL(url);
  };

  const getStatusBadge = (status: ProcessingStatusEnum | undefined) => {
    switch (status) {
      case "COMPLETED":
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
            {t("status", "COMPLETED", "COMPLETED")}
          </span>
        );
      case "LOW_CONFIDENCE":
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-500/15 text-amber-400 border border-amber-500/30">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
            {t("status", "LOW_CONFIDENCE", "LOW CONFIDENCE")}
          </span>
        );
      case "PROCESSING":
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-blue-500/15 text-blue-400 border border-blue-500/30 animate-pulse">
            <RotateCw className="w-3.5 h-3.5 animate-spin text-blue-400" />
            {t("status", "PROCESSING", "PROCESSING")}
          </span>
        );
      case "FAILED":
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-rose-500/15 text-rose-400 border border-rose-500/30">
            <AlertCircle className="w-3.5 h-3.5 text-rose-400" />
            {t("status", "FAILED", "FAILED")}
          </span>
        );
      case "UPLOADED":
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-slate-500/15 text-slate-300 border border-slate-500/30">
            <Clock className="w-3.5 h-3.5 text-slate-400" />
            {isTamil ? "OCR தயார்" : "READY FOR OCR"}
          </span>
        );
    }
  };

  const formatLanguage = (lang: string | undefined) => {
    if (!lang) return "English (en)";
    if (lang === "ta") return "Tamil (தமிழ்)";
    if (lang === "en") return "English (en)";
    if (lang.includes("ta") && lang.includes("en"))
      return "Multilingual (Tamil / English)";
    return lang.toUpperCase();
  };

  const getConfidenceColor = (conf: number | undefined) => {
    if (conf === undefined) return "text-slate-400";
    if (conf >= 0.75) return "text-emerald-400";
    if (conf >= 0.4) return "text-amber-400";
    return "text-rose-400";
  };

  const getConfidenceBarColor = (conf: number | undefined) => {
    if (conf === undefined) return "bg-slate-600";
    if (conf >= 0.75) return "bg-emerald-500";
    if (conf >= 0.4) return "bg-amber-500";
    return "bg-rose-500";
  };

  const getAbnormalBadge = (flag: string) => {
    switch (flag.toUpperCase()) {
      case "HIGH":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-rose-500/20 text-rose-300 border border-rose-500/40">
            ▲ {isTamil ? "அதிகம்" : "HIGH"}
          </span>
        );
      case "LOW":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-blue-500/20 text-blue-300 border border-blue-500/40">
            ▼ {isTamil ? "குறைவு" : "LOW"}
          </span>
        );
      case "NORMAL":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
            ✓ {isTamil ? "இயல்பு" : "NORMAL"}
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-slate-800 text-slate-400">
            {isTamil ? "தெரியவில்லை" : "UNKNOWN"}
          </span>
        );
    }
  };

  if (isLoading || authLoading) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <RotateCw className="w-8 h-8 text-teal-400 animate-spin" />
          <p className="text-sm text-slate-400">
            Loading document details & extraction pipelines...
          </p>
        </div>
      </div>
    );
  }

  if (!document) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 p-8 flex flex-col items-center justify-center">
        <AlertCircle className="w-12 h-12 text-rose-400 mb-3" />
        <h2 className="text-xl font-bold mb-2">Document Not Found</h2>
        <p className="text-slate-400 mb-6 text-sm">
          {errorMessage || "The requested medical document could not be retrieved."}
        </p>
        <Link
          href="/documents"
          className="inline-flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-sm border border-slate-700"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Documents
        </Link>
      </div>
    );
  }

  const structuredData = aiExtraction?.structured_data;

  const displayedOcrText =
    activeTab === "cleaned"
      ? extraction?.cleaned_text || ""
      : extraction?.raw_text || "";

  const filteredOcrText = searchQuery.trim()
    ? displayedOcrText
        .split("\n")
        .filter((line) =>
          line.toLowerCase().includes(searchQuery.toLowerCase().trim())
        )
        .join("\n")
    : displayedOcrText;

  const ocrConfidencePercent = extraction
    ? Math.round(extraction.ocr_confidence * 100)
    : 0;

  const aiConfidencePercent = aiExtraction
    ? Math.round(aiExtraction.confidence_score * 100)
    : 0;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 pb-20">
      {/* Top Navigation */}
      <header className="border-b border-slate-800 bg-slate-900/60 backdrop-blur sticky top-0 z-20 px-6 py-4">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link
              href="/documents"
              className="p-2 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-300 border border-slate-700 transition"
              title={isTamil ? "ஆவணங்களுக்கு திரும்பு" : "Back to Documents"}
            >
              <ArrowLeft className="w-4 h-4" />
            </Link>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-bold text-slate-100 truncate max-w-md">
                  {document.original_filename}
                </h1>
                {getStatusBadge(document.processing_status)}
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                {isTamil ? "வகை: " : "Type: "}
                <span className="text-teal-400 font-medium">
                  {document.document_type.replace(/_/g, " ")}
                </span>{" "}
                • {isTamil ? "அளவு: " : "Size: "}{(document.file_size / (1024 * 1024)).toFixed(2)} MB • {isTamil ? "பதிவேற்றம்: " : "Uploaded: "}
                {new Date(document.upload_date).toLocaleDateString()}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {token && (
              <a
                href={getDocumentPreviewUrl(document.id, token)}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-medium border border-slate-700 transition"
              >
                <Eye className="w-3.5 h-3.5 text-slate-400" />
                {isTamil ? "அசல் கோப்பு" : "Original File"}
              </a>
            )}

            {/* Run OCR */}
            <button
              onClick={handleRunOcr}
              disabled={isProcessingOcr || isExtractingAI}
              className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold text-slate-200 border border-slate-700 transition ${
                isProcessingOcr
                  ? "bg-slate-800 cursor-not-allowed"
                  : "bg-slate-800 hover:bg-slate-700"
              }`}
            >
              {isProcessingOcr ? (
                <>
                  <RotateCw className="w-3.5 h-3.5 animate-spin" />
                  {isTamil ? "OCR இயங்குகிறது..." : "Running OCR..."}
                </>
              ) : (
                <>
                  <RotateCw className="w-3.5 h-3.5" />
                  {extraction
                    ? (isTamil ? "மீண்டும் OCR இயக்கு" : "Re-run OCR")
                    : (isTamil ? "OCR இயக்கு" : "Run OCR")}
                </>
              )}
            </button>

            {/* Run AI Extraction */}
            <button
              onClick={handleRunAIExtract}
              disabled={isProcessingOcr || isExtractingAI}
              className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold text-white shadow-lg transition ${
                isExtractingAI
                  ? "bg-teal-600/60 cursor-not-allowed"
                  : "bg-teal-600 hover:bg-teal-500 shadow-teal-900/40 active:scale-[0.98]"
              }`}
            >
              {isExtractingAI ? (
                <>
                  <RotateCw className="w-3.5 h-3.5 animate-spin" />
                  {isTamil ? "AI பிரித்தெடுக்கிறது..." : "Extracting Medical AI..."}
                </>
              ) : (
                <>
                  <Sparkles className="w-3.5 h-3.5 fill-current" />
                  {aiExtraction
                    ? (isTamil ? "மீண்டும் பிரித்தெடு" : "Re-extract AI Data")
                    : (isTamil ? "AI மூலம் பிரித்தெடு" : "Extract Structured AI")}
                </>
              )}
            </button>

            {/* Run Lab Interpretation */}
            <button
              onClick={handleRunInterpretation}
              disabled={isProcessingOcr || isExtractingAI || isInterpreting}
              className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold text-white shadow-lg transition ${
                isInterpreting
                  ? "bg-indigo-600/60 cursor-not-allowed"
                  : "bg-indigo-600 hover:bg-indigo-500 shadow-indigo-900/40 active:scale-[0.98]"
              }`}
            >
              {isInterpreting ? (
                <>
                  <RotateCw className="w-3.5 h-3.5 animate-spin" />
                  {isTamil ? "விளக்கம் பெறுகிறது..." : "Interpreting Labs..."}
                </>
              ) : (
                <>
                  <FlaskConical className="w-3.5 h-3.5" />
                  {interpretations.length > 0
                    ? (isTamil ? "மீண்டும் விளக்கம் பெறு" : "Re-interpret Labs")
                    : (isTamil ? "ஆய்வக விளக்கம் பெறு" : "Interpret Lab Results")}
                </>
              )}
            </button>

            {/* Ask Copilot About This Document (Phase 13) */}
            <Link
              href={`/copilot?document_id=${document.id}`}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold text-white bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-500 hover:to-emerald-500 shadow-md shadow-teal-500/20 transition-all transform hover:-translate-y-0.5 active:scale-[0.98]"
              id="ask-copilot-doc-btn"
            >
              <Sparkles className="w-3.5 h-3.5 fill-current" />
              <span>{isTamil ? "கோபைலட்டிடம் கேளுங்கள்" : "Ask Copilot About This Document"}</span>
            </Link>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="max-w-7xl mx-auto px-6 pt-6">
        {/* Critical Medical Disclaimer Banner */}
        <div className="mb-6 p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-start gap-3 text-amber-200 text-xs leading-relaxed shadow-sm">
          <ShieldAlert className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
          <div>
            <h4 className="font-bold text-amber-300 uppercase tracking-wider text-[11px] mb-0.5">
              {isTamil ? "மருத்துவ மறுப்பு & பாதுகாப்பு அறிவிப்பு" : "Medical Disclaimer & Clinical Notice"}
            </h4>
            <p>
              {isTamil
                ? "இந்த அமைப்பில் பிரித்தெடுக்கப்பட்ட தகவல்கள் ஆவண அமைப்பு மற்றும் நோயாளி கல்வி நோக்கங்களுக்காக மட்டுமே. இது தொழில்முறை மருத்துவ நோயறிதல் அல்லது சிகிச்சை வழிமுறைகளை மாற்றாது. ஆவணத்தில் இல்லாத தகவல்கள் சேர்க்கப்படாது. உங்கள் மருத்துவரிடம் எப்போதும் உறுதிப்படுத்தவும்."
                : "This structured information has been automatically extracted using AI and OCR engines solely for document organization and personal health records. It does NOT constitute medical certainty, diagnostic validation, or clinical treatment instructions. Information absent from the original document is strictly recorded as null. Always verify medications, dosages, and lab values with a qualified physician."}
            </p>
          </div>
        </div>

        {/* Alerts */}
        {errorMessage && (
          <div className="mb-6 p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 flex items-start gap-3 text-rose-300 text-sm">
            <AlertCircle className="w-5 h-5 shrink-0 text-rose-400 mt-0.5" />
            <div>
              <p className="font-semibold text-rose-200">Notice</p>
              <p className="mt-0.5">{errorMessage}</p>
            </div>
          </div>
        )}

        {successMessage && (
          <div className="mb-6 p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-start gap-3 text-emerald-300 text-sm">
            <CheckCircle2 className="w-5 h-5 shrink-0 text-emerald-400 mt-0.5" />
            <div>
              <p className="font-semibold text-emerald-200">Completed</p>
              <p className="mt-0.5">{successMessage}</p>
            </div>
          </div>
        )}

        {/* Top Metrics Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          {/* Card 1: AI Model */}
          <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">
                AI Extraction Model
              </span>
              <Sparkles className="w-4 h-4 text-teal-400" />
            </div>
            <div className="mt-3">
              <span className="text-base font-bold text-slate-100 truncate block">
                {aiExtraction ? aiExtraction.model_name : "Not Run Yet"}
              </span>
              <p className="text-[11px] text-slate-400 mt-1">
                {aiExtraction
                  ? `${aiExtraction.processing_time}s inference time`
                  : "Click 'Extract Structured AI' to run"}
              </p>
            </div>
            <p className="text-[11px] text-slate-500 mt-2">
              Validation: <span className="text-slate-400">Strict Pydantic JSON</span>
            </p>
          </div>

          {/* Card 2: AI Overall Confidence */}
          <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">
                AI Extraction Confidence
              </span>
              <ShieldCheck className="w-4 h-4 text-teal-400" />
            </div>
            <div className="mt-3">
              <div className="flex items-baseline gap-2">
                <span
                  className={`text-2xl font-black ${getConfidenceColor(
                    aiExtraction?.confidence_score
                  )}`}
                >
                  {aiExtraction ? `${aiConfidencePercent}%` : "—"}
                </span>
                <span className="text-xs text-slate-500">
                  {aiExtraction
                    ? aiExtraction.confidence_score >= 0.75
                      ? "High Fidelity"
                      : "Review Advised"
                    : "Unextracted"}
                </span>
              </div>
              <div className="w-full h-1.5 bg-slate-800 rounded-full mt-2 overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${getConfidenceBarColor(
                    aiExtraction?.confidence_score
                  )}`}
                  style={{ width: `${aiConfidencePercent}%` }}
                />
              </div>
            </div>
            <p className="text-[11px] text-slate-500 mt-2">
              Low Confidence: <span className="text-amber-400">Highlighted &lt; 70%</span>
            </p>
          </div>

          {/* Card 3: OCR Engine Stats */}
          <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">
                OCR Pipeline Status
              </span>
              <FileCheck2 className="w-4 h-4 text-teal-400" />
            </div>
            <div className="mt-3 flex items-center justify-between">
              {getStatusBadge(document.processing_status)}
              <span
                className={`text-sm font-bold ${getConfidenceColor(
                  extraction?.ocr_confidence
                )}`}
              >
                {extraction ? `${ocrConfidencePercent}% OCR` : ""}
              </span>
            </div>
            <p className="text-[11px] text-slate-500 mt-2">
              Language:{" "}
              <span className="text-slate-400">
                {extraction ? formatLanguage(extraction.language_detected) : "Unknown"}
              </span>
            </p>
          </div>

          {/* Card 4: Document Specs */}
          <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">
                Document Specs
              </span>
              <Layers className="w-4 h-4 text-teal-400" />
            </div>
            <div className="mt-3">
              <span className="text-lg font-bold text-slate-200">
                {extraction ? `${extraction.page_count} Pages` : "1 Page"}
              </span>
              <span className="text-xs text-slate-500 ml-2">
                ({(document.file_size / (1024 * 1024)).toFixed(2)} MB)
              </span>
            </div>
            <p className="text-[11px] text-slate-500 mt-2 truncate">
              MIME: <span className="text-slate-400">{document.mime_type}</span>
            </p>
          </div>
        </div>

        {/* View Switcher Tabs Panel */}
        <div className="rounded-2xl bg-slate-900 border border-slate-800 overflow-hidden shadow-xl mb-6">
          <div className="p-4 bg-slate-800/60 border-b border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            {/* View Tabs */}
            <div className="flex items-center p-1 bg-slate-950 rounded-xl border border-slate-800">
              <button
                onClick={() => setActiveTab("interpretations")}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                  activeTab === "interpretations"
                    ? "bg-indigo-600 text-white shadow"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                <FlaskConical className="w-3.5 h-3.5" />
                {isTamil ? "ஆய்வக விளக்கங்கள்" : "Lab Interpretations"}
                {interpretations.length > 0 && (
                  <span className="ml-1 px-1.5 py-0.2 rounded-full bg-indigo-500/30 text-[10px]">
                    {interpretations.length}
                  </span>
                )}
              </button>

              <button
                onClick={() => setActiveTab("structured")}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                  activeTab === "structured"
                    ? "bg-teal-600 text-white shadow"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                <Sparkles className="w-3.5 h-3.5" />
                {isTamil ? "கட்டமைக்கப்பட்ட மருத்துவ தரவு" : "Structured Clinical Data"}
              </button>

              <button
                onClick={() => setActiveTab("cleaned")}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                  activeTab === "cleaned"
                    ? "bg-teal-600 text-white shadow"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                <FileText className="w-3.5 h-3.5" />
                {isTamil ? "சுத்திகரிக்கப்பட்ட OCR உரை" : "Cleaned OCR Text"}
              </button>

              <button
                onClick={() => setActiveTab("raw")}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                  activeTab === "raw"
                    ? "bg-teal-600 text-white shadow"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                <FileCode className="w-3.5 h-3.5" />
                {isTamil ? "அசல் OCR உரை" : "Raw OCR Text"}
              </button>
            </div>

            {/* Action Tools */}
            <div className="flex items-center gap-2">
              {activeTab !== "structured" && extraction && (
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder={isTamil ? "OCR உரையில் தேடு..." : "Search in OCR..."}
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-8 pr-3 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-xs text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-teal-500 w-36 sm:w-44"
                  />
                </div>
              )}

              <button
                onClick={handleCopyText}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-200 border border-slate-700 transition"
                title={isTamil ? "உரையை நகலெடு" : "Copy current tab content"}
              >
                {copied ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                    {isTamil ? "நகலெடுக்கப்பட்டது!" : "Copied!"}
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5 text-slate-400" />
                    {isTamil ? "நகலெடு" : "Copy"}
                  </>
                )}
              </button>

              <button
                onClick={handleDownloadExport}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-200 border border-slate-700 transition"
                title={isTamil ? "கோப்பை பதிவிறக்கு" : "Export data file"}
              >
                <Download className="w-3.5 h-3.5 text-slate-400" />
                {isTamil ? "பதிவிறக்கு " : "Export "}{activeTab === "structured" ? "JSON" : "TXT"}
              </button>
            </div>
          </div>

          {/* TAB 0: LABORATORY INTERPRETATIONS */}
          {activeTab === "interpretations" && (
            <div className="p-6">
              {interpretations.length === 0 ? (
                <div className="py-16 flex flex-col items-center justify-center text-center">
                  <div className="w-16 h-16 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center mb-4">
                    <FlaskConical className="w-8 h-8 text-indigo-400" />
                  </div>
                  <h3 className="text-base font-bold text-slate-200 mb-1">
                    Laboratory Result Interpretation
                  </h3>
                  <p className="text-xs text-slate-400 max-w-md mb-6 leading-relaxed">
                    Evaluate test observations against reported or curated reference ranges.
                    Generates safe, non-diagnostic plain-language patient explanations.
                  </p>
                  <button
                    onClick={handleRunInterpretation}
                    disabled={isInterpreting}
                    className="inline-flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold shadow-lg shadow-indigo-900/40 transition active:scale-[0.98]"
                  >
                    {isInterpreting ? (
                      <>
                        <RotateCw className="w-4 h-4 animate-spin" />
                        Interpreting Clinical Observations...
                      </>
                    ) : (
                      <>
                        <FlaskConical className="w-4 h-4" />
                        Interpret Laboratory Results Now
                      </>
                    )}
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-800">
                    <div>
                      <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                        <FlaskConical className="w-4 h-4 text-indigo-400" />
                        {interpretations.length} Laboratory Observations Analyzed
                      </h3>
                      <p className="text-xs text-slate-400 mt-0.5">
                        Interpreted strictly against reference ranges with objective, non-diagnostic explanations.
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <Link
                        href="/lab"
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-teal-500/10 hover:bg-teal-500/20 text-teal-300 border border-teal-500/30 text-xs font-semibold transition"
                      >
                        <span>Open Lab Dashboard &amp; Charts</span>
                        <ExternalLink className="w-3.5 h-3.5" />
                      </Link>

                      <button
                        onClick={handleRunInterpretation}
                        disabled={isInterpreting}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-semibold transition"
                      >
                        <RotateCw className={`w-3.5 h-3.5 ${isInterpreting ? "animate-spin" : ""}`} />
                        Re-run Engine
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-4 pt-2">
                    {interpretations.map((interp) => (
                      <div
                        key={interp.id}
                        className="p-5 rounded-2xl bg-slate-950 border border-slate-800 space-y-3"
                      >
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2.5 border-b border-slate-800/80">
                          <div className="flex items-center gap-3">
                            <span className="text-sm font-bold text-slate-100">
                              {interp.test_name}
                            </span>
                            <span
                              className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                                interp.status === "NORMAL"
                                  ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                                  : interp.status === "HIGH"
                                  ? "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                                  : interp.status === "LOW"
                                  ? "bg-cyan-500/10 text-cyan-400 border border-cyan-500/20"
                                  : "bg-slate-500/10 text-slate-400 border border-slate-500/20"
                              }`}
                            >
                              {interp.status}
                            </span>
                            <span
                              className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold ${
                                interp.severity === "URGENT_REVIEW"
                                  ? "bg-rose-500/20 text-rose-300 border border-rose-500/30"
                                  : interp.severity === "REVIEW_RECOMMENDED"
                                  ? "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                                  : interp.severity === "NORMAL"
                                  ? "bg-emerald-500/20 text-emerald-300"
                                  : "bg-slate-500/20 text-slate-400"
                              }`}
                            >
                              {interp.severity.replace("_", " ")}
                            </span>
                          </div>

                          <span className="text-[11px] text-slate-400">
                            Confidence:{" "}
                            <strong className="text-emerald-400 font-mono">
                              {Math.round(interp.confidence * 100)}%
                            </strong>
                          </span>
                        </div>

                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
                          <div>
                            <span className="text-[11px] text-slate-400 block">Reported Value</span>
                            <span className="text-sm font-mono font-bold text-teal-300">
                              {interp.value} {interp.unit || ""}
                            </span>
                          </div>

                          <div>
                            <span className="text-[11px] text-slate-400 block">Reference Interval</span>
                            <span className="text-xs font-mono font-medium text-slate-200">
                              {interp.reference_range || "Not Specified"}
                            </span>
                          </div>

                          <div>
                            <span className="text-[11px] text-slate-400 block">Interval Source</span>
                            <span className="text-xs font-medium text-slate-300 truncate block" title={interp.source}>
                              {interp.source.startsWith("DOCUMENT")
                                ? "Document Reference Range"
                                : "Curated Clinical KB"}
                            </span>
                          </div>
                        </div>

                        <div className="p-3.5 rounded-xl bg-slate-900/90 border border-slate-800/90 text-xs text-slate-300 leading-relaxed">
                          <span className="font-semibold text-slate-200 block mb-1">
                            Objective Clinical Explanation:
                          </span>
                          <p>{interp.explanation}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 1: STRUCTURED CLINICAL DATA */}
          {activeTab === "structured" && (
            <div className="p-6">
              {!aiExtraction ? (
                <div className="py-16 flex flex-col items-center justify-center text-center">
                  <div className="w-16 h-16 rounded-2xl bg-teal-500/10 border border-teal-500/20 flex items-center justify-center mb-4">
                    <Sparkles className="w-8 h-8 text-teal-400" />
                  </div>
                  <h3 className="text-base font-bold text-slate-200 mb-1">
                    AI Clinical Extraction Ready
                  </h3>
                  <p className="text-xs text-slate-400 max-w-md mb-6 leading-relaxed">
                    Parse medication regimens, diagnostic observations, reference ranges,
                    and patient/doctor entities into strictly validated JSON.
                  </p>
                  <button
                    onClick={handleRunAIExtract}
                    disabled={isExtractingAI}
                    className="inline-flex items-center gap-2 px-5 py-2.5 bg-teal-600 hover:bg-teal-500 text-white rounded-xl text-xs font-bold shadow-lg shadow-teal-900/40 transition active:scale-[0.98]"
                  >
                    {isExtractingAI ? (
                      <>
                        <RotateCw className="w-4 h-4 animate-spin" />
                        Extracting...
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-4 h-4 fill-current" />
                        Extract Structured Medical Data Now
                      </>
                    )}
                  </button>
                </div>
              ) : (
                <div className="space-y-6">
                  {/* Row 1: Patient, Doctor, Hospital Cards */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {/* SECTION 1: PATIENT */}
                    <div className="p-5 rounded-2xl bg-slate-950 border border-slate-800">
                      <div className="flex items-center justify-between pb-3 border-b border-slate-800/80 mb-3">
                        <div className="flex items-center gap-2">
                          <UserIcon className="w-4 h-4 text-teal-400" />
                          <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider">
                            Patient
                          </h3>
                        </div>
                        {structuredData?.field_confidences?.patient_name !== undefined && (
                          <span
                            className={`text-[10px] font-semibold px-2 py-0.5 rounded ${
                              structuredData.field_confidences.patient_name < 0.7
                                ? "bg-amber-500/20 text-amber-300 border border-amber-500/40"
                                : "bg-emerald-500/20 text-emerald-300"
                            }`}
                          >
                            {Math.round(
                              structuredData.field_confidences.patient_name * 100
                            )}
                            % conf
                          </span>
                        )}
                      </div>

                      <div className="space-y-2">
                        <div>
                          <span className="text-[11px] text-slate-400 block">Name</span>
                          <span className="text-sm font-semibold text-slate-100">
                            {structuredData?.patient_name || (
                              <span className="text-slate-500 italic">null (absent)</span>
                            )}
                          </span>
                        </div>

                        <div className="grid grid-cols-2 gap-2 pt-1">
                          <div>
                            <span className="text-[11px] text-slate-400 block">Age</span>
                            <span className="text-xs font-medium text-slate-200">
                              {structuredData?.patient_age || (
                                <span className="text-slate-500 italic">null</span>
                              )}
                            </span>
                          </div>
                          <div>
                            <span className="text-[11px] text-slate-400 block">Gender</span>
                            <span className="text-xs font-medium text-slate-200">
                              {structuredData?.patient_gender || (
                                <span className="text-slate-500 italic">null</span>
                              )}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* SECTION 2: DOCTOR */}
                    <div className="p-5 rounded-2xl bg-slate-950 border border-slate-800">
                      <div className="flex items-center justify-between pb-3 border-b border-slate-800/80 mb-3">
                        <div className="flex items-center gap-2">
                          <Stethoscope className="w-4 h-4 text-teal-400" />
                          <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider">
                            Doctor
                          </h3>
                        </div>
                        {structuredData?.field_confidences?.doctor_name !== undefined && (
                          <span
                            className={`text-[10px] font-semibold px-2 py-0.5 rounded ${
                              structuredData.field_confidences.doctor_name < 0.7
                                ? "bg-amber-500/20 text-amber-300 border border-amber-500/40"
                                : "bg-emerald-500/20 text-emerald-300"
                            }`}
                          >
                            {Math.round(
                              structuredData.field_confidences.doctor_name * 100
                            )}
                            % conf
                          </span>
                        )}
                      </div>

                      <div className="space-y-2">
                        <div>
                          <span className="text-[11px] text-slate-400 block">
                            Treating Physician
                          </span>
                          <span className="text-sm font-semibold text-slate-100">
                            {structuredData?.doctor_name || (
                              <span className="text-slate-500 italic">null (absent)</span>
                            )}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* SECTION 3: HOSPITAL */}
                    <div className="p-5 rounded-2xl bg-slate-950 border border-slate-800">
                      <div className="flex items-center justify-between pb-3 border-b border-slate-800/80 mb-3">
                        <div className="flex items-center gap-2">
                          <Building2 className="w-4 h-4 text-teal-400" />
                          <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider">
                            Hospital & Date
                          </h3>
                        </div>
                        {structuredData?.field_confidences?.hospital_name !==
                          undefined && (
                          <span
                            className={`text-[10px] font-semibold px-2 py-0.5 rounded ${
                              structuredData.field_confidences.hospital_name < 0.7
                                ? "bg-amber-500/20 text-amber-300 border border-amber-500/40"
                                : "bg-emerald-500/20 text-emerald-300"
                            }`}
                          >
                            {Math.round(
                              structuredData.field_confidences.hospital_name * 100
                            )}
                            % conf
                          </span>
                        )}
                      </div>

                      <div className="space-y-2">
                        <div>
                          <span className="text-[11px] text-slate-400 block">Facility</span>
                          <span className="text-sm font-semibold text-slate-100">
                            {structuredData?.hospital_name || (
                              <span className="text-slate-500 italic">null (absent)</span>
                            )}
                          </span>
                        </div>

                        <div className="pt-1">
                          <span className="text-[11px] text-slate-400 block">Date</span>
                          <span className="text-xs font-medium text-slate-200 flex items-center gap-1 mt-0.5">
                            <Calendar className="w-3.5 h-3.5 text-slate-500" />
                            {structuredData?.document_date || (
                              <span className="text-slate-500 italic">null</span>
                            )}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* SECTION 4: DIAGNOSIS */}
                  <div className="p-5 rounded-2xl bg-slate-950 border border-slate-800">
                    <div className="flex items-center gap-2 mb-3">
                      <Activity className="w-4 h-4 text-teal-400" />
                      <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider">
                        Diagnoses & Impressions
                      </h3>
                    </div>

                    {structuredData?.diagnoses && structuredData.diagnoses.length > 0 ? (
                      <div className="flex flex-wrap gap-2">
                        {structuredData.diagnoses.map((diag, idx) => (
                          <div
                            key={idx}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-teal-500/10 border border-teal-500/30 text-teal-300 text-xs font-semibold"
                          >
                            <span className="w-1.5 h-1.5 rounded-full bg-teal-400" />
                            {diag}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-slate-500 italic">
                        null (No diagnosis explicitly recorded in this document)
                      </p>
                    )}
                  </div>

                  {/* SECTION 5: MEDICATIONS */}
                  <div className="p-5 rounded-2xl bg-slate-950 border border-slate-800">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-2">
                        <Pill className="w-4 h-4 text-teal-400" />
                        <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider">
                          Medications & Prescriptions
                        </h3>
                      </div>
                      <span className="text-xs text-slate-400">
                        {structuredData?.medications?.length || 0} Prescribed
                      </span>
                    </div>

                    {structuredData?.medications &&
                    structuredData.medications.length > 0 ? (
                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs">
                          <thead>
                            <tr className="border-b border-slate-800 text-slate-400 text-[11px] uppercase tracking-wider">
                              <th className="pb-2.5 font-semibold">Medicine</th>
                              <th className="pb-2.5 font-semibold">Dosage</th>
                              <th className="pb-2.5 font-semibold">Route</th>
                              <th className="pb-2.5 font-semibold">Frequency</th>
                              <th className="pb-2.5 font-semibold">Duration</th>
                              <th className="pb-2.5 font-semibold">Instructions</th>
                              <th className="pb-2.5 font-semibold text-right">Confidence</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-800/60">
                            {structuredData.medications.map((med, idx) => {
                              const isLowConf = med.confidence < 0.7;
                              return (
                                <tr
                                  key={idx}
                                  className={`hover:bg-slate-900/50 transition ${
                                    isLowConf ? "bg-amber-500/5" : ""
                                  }`}
                                >
                                  <td className="py-3 font-bold text-slate-100 flex items-center gap-2">
                                    <span className="w-2 h-2 rounded-full bg-teal-400" />
                                    {med.name || "null"}
                                  </td>
                                  <td className="py-3 font-mono text-teal-300">
                                    {med.dosage || "null"}
                                  </td>
                                  <td className="py-3 text-slate-300">
                                    {med.route || "null"}
                                  </td>
                                  <td className="py-3 text-slate-300">
                                    {med.frequency || "null"}
                                  </td>
                                  <td className="py-3 text-slate-300">
                                    {med.duration || "null"}
                                  </td>
                                  <td className="py-3 text-slate-400 text-[11px]">
                                    {med.instructions || "null"}
                                  </td>
                                  <td className="py-3 text-right">
                                    <span
                                      className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold ${
                                        isLowConf
                                          ? "bg-amber-500/20 text-amber-300 border border-amber-500/40"
                                          : "bg-emerald-500/20 text-emerald-300"
                                      }`}
                                    >
                                      {Math.round(med.confidence * 100)}%
                                    </span>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <p className="text-xs text-slate-500 italic">
                        null (No medications prescribed in this document)
                      </p>
                    )}
                  </div>

                  {/* SECTION 6: LABORATORY RESULTS & OBSERVATIONS */}
                  <div className="p-5 rounded-2xl bg-slate-950 border border-slate-800">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-2">
                        <FlaskConical className="w-4 h-4 text-teal-400" />
                        <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider">
                          Laboratory Results & Observations
                        </h3>
                      </div>
                      <span className="text-xs text-slate-400">
                        {structuredData?.observations?.length || 0} Recorded
                      </span>
                    </div>

                    {structuredData?.observations &&
                    structuredData.observations.length > 0 ? (
                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs">
                          <thead>
                            <tr className="border-b border-slate-800 text-slate-400 text-[11px] uppercase tracking-wider">
                              <th className="pb-2.5 font-semibold">Investigation / Test</th>
                              <th className="pb-2.5 font-semibold">Value</th>
                              <th className="pb-2.5 font-semibold">Unit</th>
                              <th className="pb-2.5 font-semibold">Reference Range</th>
                              <th className="pb-2.5 font-semibold">Abnormal Flag</th>
                              <th className="pb-2.5 font-semibold text-right">Confidence</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-800/60">
                            {structuredData.observations.map((obs, idx) => {
                              const isLowConf = obs.confidence < 0.7;
                              return (
                                <tr
                                  key={idx}
                                  className={`hover:bg-slate-900/50 transition ${
                                    isLowConf ? "bg-amber-500/5" : ""
                                  }`}
                                >
                                  <td className="py-3 font-bold text-slate-100">
                                    {obs.test_name || "null"}
                                  </td>
                                  <td className="py-3 font-mono font-bold text-teal-300">
                                    {obs.value || "null"}
                                  </td>
                                  <td className="py-3 text-slate-400">
                                    {obs.unit || "null"}
                                  </td>
                                  <td className="py-3 font-mono text-[11px] text-slate-400">
                                    {obs.reference_range || "null"}
                                  </td>
                                  <td className="py-3">
                                    {getAbnormalBadge(obs.abnormal_flag)}
                                  </td>
                                  <td className="py-3 text-right">
                                    <span
                                      className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold ${
                                        isLowConf
                                          ? "bg-amber-500/20 text-amber-300 border border-amber-500/40"
                                          : "bg-emerald-500/20 text-emerald-300"
                                      }`}
                                    >
                                      {Math.round(obs.confidence * 100)}%
                                    </span>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <p className="text-xs text-slate-500 italic">
                        null (No laboratory tests recorded in this document)
                      </p>
                    )}
                  </div>

                  {/* SECTION 7: CLINICAL NOTES */}
                  <div className="p-5 rounded-2xl bg-slate-950 border border-slate-800">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <ClipboardList className="w-4 h-4 text-teal-400" />
                        <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider">
                          Clinical Notes & Physician Remarks
                        </h3>
                      </div>
                      {structuredData?.field_confidences?.clinical_notes !==
                        undefined && (
                        <span
                          className={`text-[10px] font-semibold px-2 py-0.5 rounded ${
                            structuredData.field_confidences.clinical_notes < 0.7
                              ? "bg-amber-500/20 text-amber-300 border border-amber-500/40"
                              : "bg-emerald-500/20 text-emerald-300"
                          }`}
                        >
                          {Math.round(
                            structuredData.field_confidences.clinical_notes * 100
                          )}
                          % conf
                        </span>
                      )}
                    </div>

                    <div className="p-4 rounded-xl bg-slate-900 border border-slate-800/80 text-xs text-slate-300 leading-relaxed">
                      {structuredData?.clinical_notes || (
                        <span className="text-slate-500 italic">
                          null (No additional clinical remarks recorded in document)
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Collapsible Raw Model JSON Output Inspector */}
                  <div className="rounded-xl border border-slate-800 bg-slate-950 overflow-hidden">
                    <button
                      onClick={() => setShowRawJson(!showRawJson)}
                      className="w-full px-4 py-3 flex items-center justify-between text-xs font-semibold text-slate-400 hover:text-slate-200 hover:bg-slate-900/50 transition"
                    >
                      <span className="flex items-center gap-2">
                        <FileCode className="w-4 h-4 text-teal-400" />
                        Inspect Model Raw Response JSON
                      </span>
                      {showRawJson ? (
                        <ChevronUp className="w-4 h-4" />
                      ) : (
                        <ChevronDown className="w-4 h-4" />
                      )}
                    </button>

                    {showRawJson && (
                      <div className="p-4 border-t border-slate-800 bg-slate-950">
                        <pre className="font-mono text-xs text-teal-300 leading-relaxed overflow-x-auto p-4 rounded-lg bg-slate-900 border border-slate-800 max-h-96">
                          {aiExtraction.raw_response ||
                            JSON.stringify(aiExtraction.structured_data, null, 2)}
                        </pre>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: CLEANED OCR TEXT */}
          {activeTab === "cleaned" && (
            <div className="p-6">
              {!extraction ? (
                <div className="py-12 text-center text-slate-400 text-xs">
                  Run OCR on the top bar to extract text.
                </div>
              ) : (
                <pre className="font-mono text-xs sm:text-sm text-slate-200 leading-relaxed whitespace-pre-wrap break-words bg-slate-950 p-6 rounded-xl border border-slate-800 max-h-[600px] overflow-y-auto">
                  {filteredOcrText || "No text available."}
                </pre>
              )}
            </div>
          )}

          {/* TAB 3: RAW OCR TEXT */}
          {activeTab === "raw" && (
            <div className="p-6">
              {!extraction ? (
                <div className="py-12 text-center text-slate-400 text-xs">
                  Run OCR on the top bar to extract text.
                </div>
              ) : (
                <pre className="font-mono text-xs text-slate-300 leading-relaxed whitespace-pre-wrap break-words bg-slate-950 p-6 rounded-xl border border-slate-800 max-h-[600px] overflow-y-auto">
                  {extraction.raw_text || "No raw text available."}
                </pre>
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
