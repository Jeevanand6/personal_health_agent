"use client";

import React, { useState, useEffect, useMemo } from "react";
import {
  StructuredPrescriptionData,
  PrescriptionField,
  PrescribedMedicationItem,
  PrescriptionExtractionResponse,
  verifyPrescriptionApi,
  extractPrescriptionApi,
  getPrescriptionPagePreviewUrl,
  MedicalDocument,
} from "@/lib/api";
import {
  ShieldCheck,
  ShieldAlert,
  AlertTriangle,
  CheckCircle2,
  Edit3,
  RotateCw,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Minimize2,
  Plus,
  Trash2,
  Sparkles,
  Info,
  History,
  FileText,
  User,
  Stethoscope,
  Building2,
  Calendar,
  Pill,
  Clock,
  Layers,
  ArrowRight,
  ExternalLink,
} from "lucide-react";
import Link from "next/link";

interface Props {
  document: MedicalDocument;
  initialExtraction?: any;
  token: string;
  onExtractionUpdated?: (res: PrescriptionExtractionResponse) => void;
}

export default function PrescriptionVerificationView({
  document,
  initialExtraction,
  token,
  onExtractionUpdated,
}: Props) {
  // Extraction data state
  const [data, setData] = useState<StructuredPrescriptionData | null>(null);
  const [isVerified, setIsVerified] = useState<boolean>(false);
  const [verifiedAt, setVerifiedAt] = useState<string | null>(null);
  const [verificationAudit, setVerificationAudit] = useState<any>({});
  const [modelMetadata, setModelMetadata] = useState<any>({});

  // Loading & saving states
  const [isExtracting, setIsExtracting] = useState<boolean>(false);
  const [isVerifying, setIsVerifying] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Image viewer states
  const [zoomLevel, setZoomLevel] = useState<number>(100);
  const [rotation, setRotation] = useState<number>(0);
  const [isEnhanced, setIsEnhanced] = useState<boolean>(true);
  const [currentPage, setCurrentPage] = useState<number>(0);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [isFullScreenImage, setIsFullScreenImage] = useState<boolean>(false);

  // User corrections tracker (field_path -> { original, corrected, reason })
  const [correctionsMap, setCorrectionsMap] = useState<
    Record<string, { original: string | null; corrected: string | null; reason?: string }>
  >({});
  const [reviewerNotes, setReviewerNotes] = useState<string>("");

  // Initialize data from props
  useEffect(() => {
    if (initialExtraction) {
      setIsVerified(Boolean(initialExtraction.is_verified));
      setVerifiedAt(initialExtraction.verified_at || null);
      setVerificationAudit(initialExtraction.verification_audit || {});

      const structured = initialExtraction.structured_data;
      if (structured) {
        setData(structured);
        setModelMetadata(structured.model_metadata || {});
        if (structured.model_metadata?.preprocessing?.total_pages) {
          setTotalPages(structured.model_metadata.preprocessing.total_pages);
        }
      }
    }
  }, [initialExtraction]);

  // Helper to update a top-level field
  const handleFieldChange = (
    fieldKey: keyof StructuredPrescriptionData,
    value: string
  ) => {
    if (!data) return;
    const currentField = data[fieldKey] as PrescriptionField;
    const origVal = currentField.original_value !== undefined && currentField.original_value !== null
      ? currentField.original_value
      : currentField.raw_text;

    const updatedField: PrescriptionField = {
      ...currentField,
      normalized_value: value,
      raw_text: currentField.raw_text || value,
      is_corrected_by_user: true,
      original_value: origVal,
      is_uncertain: false, // cleared upon explicit human review
    };

    setData({
      ...data,
      [fieldKey]: updatedField,
    });

    setCorrectionsMap((prev) => ({
      ...prev,
      [fieldKey as string]: {
        original: origVal,
        corrected: value,
        reason: "User manual edit",
      },
    }));
  };

  // Helper to update a medication property
  const handleMedicationChange = (
    index: number,
    fieldProp: keyof PrescribedMedicationItem,
    value: string
  ) => {
    if (!data) return;
    const updatedMeds = [...data.medications];
    const med = { ...updatedMeds[index] };
    const fieldObj = (med[fieldProp] as PrescriptionField) || {
      raw_text: "",
      normalized_value: "",
      confidence: 1.0,
      is_uncertain: false,
    };

    const origVal = fieldObj.original_value !== undefined && fieldObj.original_value !== null
      ? fieldObj.original_value
      : fieldObj.raw_text;

    const updatedField: PrescriptionField = {
      ...fieldObj,
      normalized_value: value,
      raw_text: fieldObj.raw_text || value,
      is_corrected_by_user: true,
      original_value: origVal,
      is_uncertain: false,
    };

    (med as any)[fieldProp] = updatedField;
    med.is_uncertain = false;
    updatedMeds[index] = med;

    setData({
      ...data,
      medications: updatedMeds,
    });

    setCorrectionsMap((prev) => ({
      ...prev,
      [`medications[${index}].${fieldProp as string}`]: {
        original: origVal,
        corrected: value,
        reason: "User manual edit",
      },
    }));
  };

  // Add new medication item
  const handleAddMedication = () => {
    if (!data) return;
    const newMed: PrescribedMedicationItem = {
      name_as_written: {
        raw_text: "New Medication",
        normalized_value: "New Medication",
        confidence: 1.0,
        is_uncertain: false,
        is_corrected_by_user: true,
      },
      strength: { raw_text: "", normalized_value: "", confidence: 1.0, is_uncertain: false },
      dosage: { raw_text: "", normalized_value: "", confidence: 1.0, is_uncertain: false },
      route: { raw_text: "Oral", normalized_value: "Oral", confidence: 1.0, is_uncertain: false },
      frequency: { raw_text: "", normalized_value: "", confidence: 1.0, is_uncertain: false },
      duration: { raw_text: "", normalized_value: "", confidence: 1.0, is_uncertain: false },
      instructions: { raw_text: "", normalized_value: "", confidence: 1.0, is_uncertain: false },
      is_uncertain: false,
    };
    setData({
      ...data,
      medications: [...data.medications, newMed],
    });
  };

  // Remove medication item
  const handleRemoveMedication = (index: number) => {
    if (!data) return;
    const medToRemove = data.medications[index];
    const updatedMeds = data.medications.filter((_, i) => i !== index);
    setData({
      ...data,
      medications: updatedMeds,
    });
    setCorrectionsMap((prev) => ({
      ...prev,
      [`medications[${index}]`]: {
        original: medToRemove.name_as_written?.raw_text || "Medication",
        corrected: "[REMOVED BY USER]",
        reason: "User deleted incorrect medication entry",
      },
    }));
  };

  // Trigger prescription OCR extraction
  const handleRunPrescriptionOCR = async () => {
    setIsExtracting(true);
    setErrorMessage(null);
    setSuccessMessage(null);
    try {
      const res = await extractPrescriptionApi(document.id, token, currentPage);
      setData(res.structured_data);
      setIsVerified(res.is_verified);
      setVerifiedAt(res.verified_at || null);
      setVerificationAudit(res.verification_audit || {});
      setModelMetadata(res.structured_data?.model_metadata || {});
      setSuccessMessage("Prescription extracted successfully. Please review and confirm below.");
      setCorrectionsMap({});
      if (onExtractionUpdated) onExtractionUpdated(res);
    } catch (err: any) {
      setErrorMessage(err.message || "Failed to extract prescription.");
    } finally {
      setIsExtracting(false);
    }
  };

  // Verify and confirm prescription
  const handleConfirmVerification = async () => {
    if (!data) return;
    setIsVerifying(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    const correctionsList = Object.entries(correctionsMap).map(([path, info]) => ({
      field_path: path,
      original_value: info.original,
      corrected_value: info.corrected,
      reason: info.reason || "User verified edit",
    }));

    try {
      const res = await verifyPrescriptionApi(document.id, token, {
        approved_data: data,
        corrections: correctionsList,
        notes: reviewerNotes || "Verified by patient/user against uploaded image",
      });

      setIsVerified(true);
      setVerifiedAt(res.verified_at || new Date().toISOString());
      setVerificationAudit(res.verification_audit || {});
      setSuccessMessage("Prescription verified! Active in Health Copilot, Medications, and Timeline.");
      setCorrectionsMap({});
      if (onExtractionUpdated) onExtractionUpdated(res);
    } catch (err: any) {
      setErrorMessage(err.message || "Failed to verify prescription.");
    } finally {
      setIsVerifying(false);
    }
  };

  // Count uncertain fields
  const uncertainCount = useMemo(() => {
    if (!data) return 0;
    let count = 0;
    const check = (f?: PrescriptionField | null) => {
      if (f && f.is_uncertain) count++;
    };
    check(data.doctor_name);
    check(data.clinic_name);
    check(data.patient_name);
    check(data.prescription_date);
    check(data.diagnosis);
    check(data.notes);
    data.medications?.forEach((m) => {
      if (m.is_uncertain) count++;
      check(m.name_as_written);
      check(m.dosage);
      check(m.frequency);
    });
    return count;
  }, [data]);

  const previewUrl = useMemo(() => {
    return getPrescriptionPagePreviewUrl(document.id, token, currentPage, isEnhanced);
  }, [document.id, token, currentPage, isEnhanced]);

  return (
    <div className="space-y-6">
      {/* 1. Clinical Status Banner */}
      {isVerified ? (
        <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-start justify-between gap-4 shadow-sm">
          <div className="flex items-start gap-3">
            <ShieldCheck className="w-6 h-6 text-emerald-400 shrink-0 mt-0.5" />
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-emerald-200 text-sm">
                  VERIFIED CLINICAL PRESCRIPTION
                </h3>
                <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                  Approved
                </span>
              </div>
              <p className="text-xs text-emerald-300/80 mt-1 leading-relaxed">
                This prescription has been human-reviewed and confirmed. Its medications and instructions
                are actively recognized by the <strong>Health Copilot</strong>, <strong>Medications page</strong>, and <strong>Healthcare Timeline</strong>.
              </p>
              {verifiedAt && (
                <p className="text-[11px] text-emerald-400/60 mt-1">
                  Verified on: {new Date(verifiedAt).toLocaleString()}
                  {verificationAudit?.corrections_count !== undefined && (
                    <span className="ml-2">({verificationAudit.corrections_count} audit corrections applied)</span>
                  )}
                </p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Link
              href={`/copilot?document_id=${document.id}`}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm transition"
            >
              <Sparkles className="w-3.5 h-3.5" />
              Ask Copilot
            </Link>
            <Link
              href="/medications"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition"
            >
              <Pill className="w-3.5 h-3.5" />
              Medications
            </Link>
          </div>
        </div>
      ) : (
        <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-start justify-between gap-4 shadow-sm">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-6 h-6 text-amber-400 shrink-0 mt-0.5" />
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-amber-200 text-sm">
                  UNCONFIRMED PRESCRIPTION PREDICTION — REQUIRES HUMAN REVIEW
                </h3>
                <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40">
                  Verification Pending
                </span>
              </div>
              <p className="text-xs text-amber-300/80 mt-1 leading-relaxed">
                By clinical safety policy, OCR and AI predictions are <strong>never treated as confirmed medical orders</strong>.
                Please inspect the original prescription image on the left, verify medicine names and dosages on the right,
                and click <strong>Confirm & Approve</strong> to activate.
              </p>
              {uncertainCount > 0 && (
                <div className="mt-2 inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-amber-950/60 border border-amber-500/40 text-[11px] font-medium text-amber-300">
                  <AlertTriangle className="w-3 h-3 text-amber-400" />
                  <span>{uncertainCount} field(s) flagged with ambiguous doctor handwriting</span>
                </div>
              )}
            </div>
          </div>
          <button
            onClick={handleRunPrescriptionOCR}
            disabled={isExtracting}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-bold text-white bg-amber-600 hover:bg-amber-500 shadow-md transition shrink-0 disabled:opacity-50"
          >
            {isExtracting ? (
              <>
                <RotateCw className="w-3.5 h-3.5 animate-spin" />
                Extracting...
              </>
            ) : (
              <>
                <RotateCw className="w-3.5 h-3.5" />
                {data ? "Re-run Extraction" : "Run Prescription OCR"}
              </>
            )}
          </button>
        </div>
      )}

      {/* Alerts */}
      {errorMessage && (
        <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
          <ShieldAlert className="w-4 h-4 text-rose-400 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {successMessage && (
        <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{successMessage}</span>
        </div>
      )}

      {/* 2. Side-by-Side Main Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* LEFT COLUMN: Document & Prescription Image Viewer (5 cols) */}
        <div className="lg:col-span-5 space-y-3 sticky top-4">
          <div className="rounded-2xl bg-slate-900 border border-slate-800 overflow-hidden shadow-xl">
            {/* Viewer Header */}
            <div className="p-3 bg-slate-800/80 border-b border-slate-800 flex items-center justify-between text-xs">
              <div className="flex items-center gap-2 font-semibold text-slate-200">
                <FileText className="w-4 h-4 text-teal-400" />
                <span>Original Prescription</span>
                {totalPages > 1 && (
                  <span className="text-[11px] text-slate-400">
                    (Page {currentPage + 1} of {totalPages})
                  </span>
                )}
              </div>

              {/* Viewer Controls */}
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  title="Toggle CLAHE Contrast & Deskew Enhancement"
                  onClick={() => setIsEnhanced(!isEnhanced)}
                  className={`px-2 py-1 rounded text-[11px] font-semibold transition ${
                    isEnhanced
                      ? "bg-teal-500/20 text-teal-300 border border-teal-500/40"
                      : "bg-slate-800 text-slate-400 hover:text-slate-200"
                  }`}
                >
                  {isEnhanced ? "Enhanced" : "Raw"}
                </button>

                <button
                  type="button"
                  title="Zoom Out"
                  onClick={() => setZoomLevel((z) => Math.max(50, z - 25))}
                  className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300"
                >
                  <ZoomOut className="w-3.5 h-3.5" />
                </button>
                <span className="text-[10px] text-slate-400 w-8 text-center">{zoomLevel}%</span>
                <button
                  type="button"
                  title="Zoom In"
                  onClick={() => setZoomLevel((z) => Math.min(250, z + 25))}
                  className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300"
                >
                  <ZoomIn className="w-3.5 h-3.5" />
                </button>

                <button
                  type="button"
                  title="Rotate 90° Clockwise"
                  onClick={() => setRotation((r) => (r + 90) % 360)}
                  className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300"
                >
                  <RotateCw className="w-3.5 h-3.5" />
                </button>

                <button
                  type="button"
                  title={isFullScreenImage ? "Exit Fullscreen" : "Fullscreen View"}
                  onClick={() => setIsFullScreenImage(!isFullScreenImage)}
                  className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300"
                >
                  {isFullScreenImage ? (
                    <Minimize2 className="w-3.5 h-3.5" />
                  ) : (
                    <Maximize2 className="w-3.5 h-3.5" />
                  )}
                </button>
              </div>
            </div>

            {/* Image Canvas */}
            <div
              className={`relative bg-slate-950 overflow-auto flex items-center justify-center p-3 select-none ${
                isFullScreenImage ? "fixed inset-0 z-50 p-6 bg-slate-950/95" : "max-h-[680px] min-h-[460px]"
              }`}
            >
              {isFullScreenImage && (
                <button
                  onClick={() => setIsFullScreenImage(false)}
                  className="absolute top-4 right-4 z-50 px-3 py-1.5 bg-slate-800 text-white text-xs font-bold rounded-lg border border-slate-700 hover:bg-slate-700"
                >
                  Close Fullscreen
                </button>
              )}

              <div
                style={{
                  transform: `scale(${zoomLevel / 100}) rotate(${rotation}deg)`,
                  transformOrigin: "center center",
                  transition: "transform 0.15s ease",
                }}
                className="max-w-full"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={previewUrl}
                  alt="Prescription document page"
                  className="rounded-lg shadow-2xl object-contain max-w-full border border-slate-800"
                  onError={(e) => {
                    // Fallback to direct file url if preview endpoint fails
                    const target = e.target as HTMLImageElement;
                    target.src = `/api/documents/${document.id}/file?token=${encodeURIComponent(token)}`;
                  }}
                />
              </div>
            </div>

            {/* Page Pager if Multi-page */}
            {totalPages > 1 && (
              <div className="p-2.5 bg-slate-900 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
                <button
                  disabled={currentPage <= 0}
                  onClick={() => setCurrentPage((p) => Math.max(0, p - 1))}
                  className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 disabled:opacity-40"
                >
                  Previous Page
                </button>
                <span>
                  Page {currentPage + 1} of {totalPages}
                </span>
                <button
                  disabled={currentPage >= totalPages - 1}
                  onClick={() => setCurrentPage((p) => Math.min(totalPages - 1, p + 1))}
                  className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 disabled:opacity-40"
                >
                  Next Page
                </button>
              </div>
            )}
          </div>

          {/* Model & Fine-Tuning Specs */}
          {modelMetadata && (
            <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800/80 text-[11px] text-slate-400 space-y-1">
              <div className="flex items-center justify-between text-slate-300 font-semibold">
                <span>Model Architecture</span>
                <span className="text-teal-400">{modelMetadata.backend || "Qwen2.5-VL Fine-tune"}</span>
              </div>
              <p className="truncate">Reference: <span className="text-slate-300">KushagraWadhwa/medical-prescription-ocr-india</span></p>
              {modelMetadata.preprocessing && (
                <div className="flex items-center gap-3 text-slate-500 pt-1 border-t border-slate-800/50">
                  <span>Deskew: {modelMetadata.preprocessing.deskew_angle_degrees}°</span>
                  <span>CLAHE: {modelMetadata.preprocessing.clahe_enhanced ? "Active" : "Off"}</span>
                  <span>Crop: {modelMetadata.preprocessing.auto_cropped ? "Applied" : "Full"}</span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* RIGHT COLUMN: Interactive Extraction & Human Review Form (7 cols) */}
        <div className="lg:col-span-7 space-y-5">
          {!data ? (
            <div className="p-12 rounded-2xl bg-slate-900 border border-slate-800 text-center space-y-4">
              <div className="w-12 h-12 rounded-full bg-teal-500/10 text-teal-400 mx-auto flex items-center justify-center">
                <Sparkles className="w-6 h-6" />
              </div>
              <h3 className="text-base font-bold text-slate-200">
                Prescription Extraction Not Yet Run
              </h3>
              <p className="text-xs text-slate-400 max-w-md mx-auto leading-relaxed">
                Click below to process the handwritten doctor prescription using the dedicated
                medical OCR pipeline trained on Indian doctor handwriting shorthand.
              </p>
              <button
                onClick={handleRunPrescriptionOCR}
                disabled={isExtracting}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-teal-600 hover:bg-teal-500 shadow-lg shadow-teal-900/40 transition active:scale-95 disabled:opacity-50"
              >
                {isExtracting ? (
                  <>
                    <RotateCw className="w-4 h-4 animate-spin" />
                    Extracting Doctor Handwriting...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4 fill-current" />
                    Extract Handwritten Prescription
                  </>
                )}
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Doctor & Clinic Details Card */}
              <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 space-y-3">
                <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                  <div className="flex items-center gap-2 text-xs font-bold text-slate-300 uppercase tracking-wider">
                    <Stethoscope className="w-4 h-4 text-teal-400" />
                    <span>Physician & Healthcare Center</span>
                  </div>
                  <span className="text-[10px] text-slate-500">Edit fields directly to correct</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div>
                    <label className="text-[11px] text-slate-400 block mb-1">Doctor Name</label>
                    <div className="relative">
                      <input
                        type="text"
                        value={data.doctor_name?.normalized_value || data.doctor_name?.raw_text || ""}
                        onChange={(e) => handleFieldChange("doctor_name", e.target.value)}
                        placeholder="Not specified on document"
                        className={`w-full px-3 py-2 rounded-lg bg-slate-950 text-slate-200 border text-xs focus:outline-none focus:ring-1 focus:ring-teal-500 ${
                          data.doctor_name?.is_uncertain
                            ? "border-amber-500/70 bg-amber-950/20"
                            : "border-slate-800"
                        }`}
                      />
                      {data.doctor_name?.is_uncertain && (
                        <span className="absolute right-2 top-2 text-[10px] text-amber-400 font-bold">
                          Uncertain
                        </span>
                      )}
                    </div>
                    {data.doctor_name?.is_corrected_by_user && (
                      <span className="text-[10px] text-teal-400 font-medium mt-0.5 block">
                        Edited (Original: &ldquo;{data.doctor_name.original_value || "None"}&rdquo;)
                      </span>
                    )}
                  </div>

                  <div>
                    <label className="text-[11px] text-slate-400 block mb-1">Clinic / Hospital</label>
                    <input
                      type="text"
                      value={data.clinic_name?.normalized_value || data.clinic_name?.raw_text || ""}
                      onChange={(e) => handleFieldChange("clinic_name", e.target.value)}
                      placeholder="Not specified on document"
                      className="w-full px-3 py-2 rounded-lg bg-slate-950 text-slate-200 border border-slate-800 text-xs focus:outline-none focus:ring-1 focus:ring-teal-500"
                    />
                    {data.clinic_name?.is_corrected_by_user && (
                      <span className="text-[10px] text-teal-400 font-medium mt-0.5 block">
                        Edited (Original: &ldquo;{data.clinic_name.original_value || "None"}&rdquo;)
                      </span>
                    )}
                  </div>

                  <div>
                    <label className="text-[11px] text-slate-400 block mb-1">Prescription Date</label>
                    <input
                      type="text"
                      value={data.prescription_date?.normalized_value || data.prescription_date?.raw_text || ""}
                      onChange={(e) => handleFieldChange("prescription_date", e.target.value)}
                      placeholder="YYYY-MM-DD or date as written"
                      className="w-full px-3 py-2 rounded-lg bg-slate-950 text-slate-200 border border-slate-800 text-xs focus:outline-none focus:ring-1 focus:ring-teal-500"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] text-slate-400 block mb-1">Provisional Diagnosis</label>
                    <input
                      type="text"
                      value={data.diagnosis?.normalized_value || data.diagnosis?.raw_text || ""}
                      onChange={(e) => handleFieldChange("diagnosis", e.target.value)}
                      placeholder="e.g. Type 2 Diabetes, Bronchitis"
                      className="w-full px-3 py-2 rounded-lg bg-slate-950 text-slate-200 border border-slate-800 text-xs focus:outline-none focus:ring-1 focus:ring-teal-500"
                    />
                  </div>
                </div>
              </div>

              {/* Patient Details Card */}
              <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 space-y-3">
                <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                  <div className="flex items-center gap-2 text-xs font-bold text-slate-300 uppercase tracking-wider">
                    <User className="w-4 h-4 text-teal-400" />
                    <span>Patient Details</span>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                  <div>
                    <label className="text-[11px] text-slate-400 block mb-1">Patient Name</label>
                    <input
                      type="text"
                      value={data.patient_name?.normalized_value || data.patient_name?.raw_text || ""}
                      onChange={(e) => handleFieldChange("patient_name", e.target.value)}
                      placeholder="Name as written"
                      className="w-full px-3 py-2 rounded-lg bg-slate-950 text-slate-200 border border-slate-800 text-xs focus:outline-none focus:ring-1 focus:ring-teal-500"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] text-slate-400 block mb-1">Age</label>
                    <input
                      type="text"
                      value={data.patient_age?.normalized_value || data.patient_age?.raw_text || ""}
                      onChange={(e) => handleFieldChange("patient_age", e.target.value)}
                      placeholder="e.g. 45 Yrs"
                      className="w-full px-3 py-2 rounded-lg bg-slate-950 text-slate-200 border border-slate-800 text-xs focus:outline-none focus:ring-1 focus:ring-teal-500"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] text-slate-400 block mb-1">Sex</label>
                    <input
                      type="text"
                      value={data.patient_sex?.normalized_value || data.patient_sex?.raw_text || ""}
                      onChange={(e) => handleFieldChange("patient_sex", e.target.value)}
                      placeholder="e.g. Male / Female"
                      className="w-full px-3 py-2 rounded-lg bg-slate-950 text-slate-200 border border-slate-800 text-xs focus:outline-none focus:ring-1 focus:ring-teal-500"
                    />
                  </div>
                </div>
              </div>

              {/* Prescribed Medications Card */}
              <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 space-y-4">
                <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                  <div className="flex items-center gap-2 text-xs font-bold text-slate-300 uppercase tracking-wider">
                    <Pill className="w-4 h-4 text-teal-400" />
                    <span>Prescribed Medications ({data.medications?.length || 0})</span>
                  </div>
                  <button
                    type="button"
                    onClick={handleAddMedication}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 transition"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Add Medication
                  </button>
                </div>

                {data.medications?.length === 0 ? (
                  <p className="text-xs text-slate-500 text-center py-4">
                    No medications detected. Click &ldquo;Add Medication&rdquo; to manually insert one.
                  </p>
                ) : (
                  <div className="space-y-3">
                    {data.medications.map((med, idx) => {
                      const nameVal = med.name_as_written?.normalized_value || med.name_as_written?.raw_text || "";
                      const dosageVal = med.dosage?.normalized_value || med.dosage?.raw_text || "";
                      const freqVal = med.frequency?.normalized_value || med.frequency?.raw_text || "";
                      const durVal = med.duration?.normalized_value || med.duration?.raw_text || "";
                      const routeVal = med.route?.normalized_value || med.route?.raw_text || "";
                      const instVal = med.instructions?.normalized_value || med.instructions?.raw_text || "";

                      return (
                        <div
                          key={idx}
                          className={`p-3.5 rounded-xl bg-slate-950 border transition ${
                            med.is_uncertain
                              ? "border-amber-500/60 bg-amber-950/10 shadow-sm shadow-amber-950/20"
                              : "border-slate-800"
                          }`}
                        >
                          <div className="flex items-start justify-between gap-3 mb-2.5">
                            <div className="flex items-center gap-2">
                              <span className="w-5 h-5 rounded-full bg-slate-800 text-slate-300 text-[10px] font-bold flex items-center justify-center">
                                {idx + 1}
                              </span>
                              <span className="text-xs font-bold text-slate-200">
                                {nameVal || "Prescribed Medication"}
                              </span>
                              {med.is_uncertain && (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40">
                                  <AlertTriangle className="w-3 h-3" />
                                  Uncertain Handwriting
                                </span>
                              )}
                              {med.name_as_written?.is_corrected_by_user && (
                                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-teal-500/20 text-teal-300 border border-teal-500/40">
                                  Edited
                                </span>
                              )}
                            </div>
                            <button
                              type="button"
                              onClick={() => handleRemoveMedication(idx)}
                              title="Delete medication"
                              className="p-1 rounded text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 transition"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs">
                            {/* Medicine Name */}
                            <div className="sm:col-span-2">
                              <label className="text-[10px] text-slate-400 block mb-0.5">
                                Medication Name (Verbatim)
                              </label>
                              <input
                                type="text"
                                value={nameVal}
                                onChange={(e) => handleMedicationChange(idx, "name_as_written", e.target.value)}
                                placeholder="Exact drug name as written"
                                className="w-full px-2.5 py-1.5 rounded-lg bg-slate-900 text-slate-200 border border-slate-800 text-xs focus:outline-none focus:ring-1 focus:ring-teal-500"
                              />
                            </div>

                            {/* Strength / Dosage */}
                            <div>
                              <label className="text-[10px] text-slate-400 block mb-0.5">
                                Strength / Dose
                              </label>
                              <input
                                type="text"
                                value={dosageVal}
                                onChange={(e) => handleMedicationChange(idx, "dosage", e.target.value)}
                                placeholder="e.g. 500mg, 1 tab"
                                className="w-full px-2.5 py-1.5 rounded-lg bg-slate-900 text-slate-200 border border-slate-800 text-xs focus:outline-none focus:ring-1 focus:ring-teal-500"
                              />
                            </div>

                            {/* Frequency */}
                            <div>
                              <label className="text-[10px] text-slate-400 block mb-0.5">
                                Frequency / Shorthand
                              </label>
                              <input
                                type="text"
                                value={freqVal}
                                onChange={(e) => handleMedicationChange(idx, "frequency", e.target.value)}
                                placeholder="e.g. 1-0-1, OD, TDS"
                                className="w-full px-2.5 py-1.5 rounded-lg bg-slate-900 text-slate-200 border border-slate-800 text-xs focus:outline-none focus:ring-1 focus:ring-teal-500"
                              />
                            </div>

                            {/* Duration */}
                            <div>
                              <label className="text-[10px] text-slate-400 block mb-0.5">
                                Duration
                              </label>
                              <input
                                type="text"
                                value={durVal}
                                onChange={(e) => handleMedicationChange(idx, "duration", e.target.value)}
                                placeholder="e.g. 5 days, 1 month"
                                className="w-full px-2.5 py-1.5 rounded-lg bg-slate-900 text-slate-200 border border-slate-800 text-xs focus:outline-none focus:ring-1 focus:ring-teal-500"
                              />
                            </div>

                            {/* Instructions */}
                            <div>
                              <label className="text-[10px] text-slate-400 block mb-0.5">
                                Instructions
                              </label>
                              <input
                                type="text"
                                value={instVal}
                                onChange={(e) => handleMedicationChange(idx, "instructions", e.target.value)}
                                placeholder="e.g. After food"
                                className="w-full px-2.5 py-1.5 rounded-lg bg-slate-900 text-slate-200 border border-slate-800 text-xs focus:outline-none focus:ring-1 focus:ring-teal-500"
                              />
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Instructions and Follow-Up Card */}
              <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 space-y-3">
                <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                  <div className="flex items-center gap-2 text-xs font-bold text-slate-300 uppercase tracking-wider">
                    <Calendar className="w-4 h-4 text-teal-400" />
                    <span>Instructions & Follow-Up Advice</span>
                  </div>
                </div>

                <div className="space-y-2 text-xs">
                  <div>
                    <label className="text-[11px] text-slate-400 block mb-1">
                      Doctor Remarks & Return Advice
                    </label>
                    <textarea
                      rows={2}
                      value={
                        data.instructions_and_follow_up?.normalized_value ||
                        data.instructions_and_follow_up?.raw_text ||
                        ""
                      }
                      onChange={(e) => handleFieldChange("instructions_and_follow_up", e.target.value)}
                      placeholder="e.g. Review after 1 week with fasting blood sugar report"
                      className="w-full px-3 py-2 rounded-lg bg-slate-950 text-slate-200 border border-slate-800 text-xs focus:outline-none focus:ring-1 focus:ring-teal-500"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] text-slate-400 block mb-1">
                      Reviewer Verification Notes (Audit Log)
                    </label>
                    <input
                      type="text"
                      value={reviewerNotes}
                      onChange={(e) => setReviewerNotes(e.target.value)}
                      placeholder="e.g. Verified handwriting against patient doctor visit card"
                      className="w-full px-3 py-2 rounded-lg bg-slate-950 text-slate-200 border border-slate-800 text-xs focus:outline-none focus:ring-1 focus:ring-teal-500"
                    />
                  </div>
                </div>
              </div>

              {/* Action Confirmation Footer */}
              <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3 shadow-lg">
                <div className="text-xs text-slate-400">
                  {Object.keys(correctionsMap).length > 0 ? (
                    <span className="text-teal-400 font-medium">
                      {Object.keys(correctionsMap).length} field correction(s) ready to commit to audit trail
                    </span>
                  ) : (
                    <span>Ready for confirmation</span>
                  )}
                </div>

                <div className="flex items-center gap-3 w-full sm:w-auto">
                  <button
                    type="button"
                    onClick={handleConfirmVerification}
                    disabled={isVerifying}
                    className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 shadow-lg shadow-emerald-900/40 transition active:scale-95 disabled:opacity-50"
                  >
                    {isVerifying ? (
                      <>
                        <RotateCw className="w-4 h-4 animate-spin" />
                        Saving & Verifying...
                      </>
                    ) : (
                      <>
                        <ShieldCheck className="w-4 h-4" />
                        {isVerified ? "Save Corrections & Re-verify" : "Confirm & Verify Prescription"}
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
