"use client";

import React, { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import {
  deleteDocumentApi,
  DocumentTypeEnum,
  getDocumentPreviewUrl,
  getDocumentsApi,
  MedicalDocument,
  uploadDocumentApi,
} from "@/lib/api";
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  Clock3,
  Download,
  Eye,
  FileText,
  FlaskConical,
  LoaderCircle,
  Search,
  Trash2,
  UploadCloud,
  X,
} from "lucide-react";

const MAX_FILE_SIZE = 15 * 1024 * 1024;
const ALLOWED_EXTS = [".pdf", ".jpg", ".jpeg", ".png"];

const documentTypeLabels: Record<DocumentTypeEnum, string> = {
  PRESCRIPTION: "Prescription",
  LAB_REPORT: "Lab Report",
  DIAGNOSTIC_REPORT: "Medical Report",
  DISCHARGE_SUMMARY: "Discharge Summary",
  OTHER: "Other",
  UNKNOWN: "Other",
};

function statusForDocument(status: string) {
  switch (status.toUpperCase()) {
    case "COMPLETED":
    case "EXTRACTED":
    case "INTERPRETED":
      return {
        label: "Processed",
        className: "bg-emerald-50 text-emerald-800",
        icon: CheckCircle2,
      };
    case "PROCESSING":
      return {
        label: "Processing",
        className: "bg-sky-50 text-sky-800",
        icon: Clock3,
      };
    case "UPLOADED":
      return {
        label: "Uploaded",
        className: "bg-slate-100 text-slate-700",
        icon: Clock3,
      };
    case "LOW_CONFIDENCE":
      return {
        label: "Needs review",
        className: "bg-amber-50 text-amber-900",
        icon: AlertCircle,
      };
    case "FAILED":
      return {
        label: "Processing failed",
        className: "bg-rose-50 text-rose-800",
        icon: AlertCircle,
      };
    default:
      return {
        label: "Uploaded",
        className: "bg-slate-100 text-slate-700",
        icon: Clock3,
      };
  }
}

function formatUploadDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Date not available";
  return new Intl.DateTimeFormat("en", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

export default function DocumentsPage() {
  const { user, token, isLoading } = useAuth();
  const router = useRouter();
  const [documents, setDocuments] = useState<MedicalDocument[]>([]);
  const [isLoadingDocs, setIsLoadingDocs] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [documentType, setDocumentType] = useState<DocumentTypeEnum>("UNKNOWN");
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterType, setFilterType] = useState("ALL");
  const [previewDocument, setPreviewDocument] = useState<MedicalDocument | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isLoading && !user) router.push("/login");
  }, [isLoading, user, router]);

  const loadDocuments = async () => {
    if (!token) return;
    setIsLoadingDocs(true);
    setLoadFailed(false);
    try {
      setDocuments(await getDocumentsApi(token));
    } catch {
      setLoadFailed(true);
    } finally {
      setIsLoadingDocs(false);
    }
  };

  useEffect(() => {
    if (token) void loadDocuments();
  }, [token]);

  const selectFile = (file: File) => {
    setErrorMessage(null);
    setSuccessMessage(null);
    const extension = `.${file.name.split(".").pop()?.toLowerCase()}`;
    if (!ALLOWED_EXTS.includes(extension)) {
      setErrorMessage("Choose a PDF, JPG or PNG file.");
      setSelectedFile(null);
      return;
    }
    if (file.size > MAX_FILE_SIZE) {
      setErrorMessage("This file is larger than 15 MB. Choose a smaller file.");
      setSelectedFile(null);
      return;
    }
    setSelectedFile(file);
  };

  const handleUpload = async () => {
    if (!selectedFile || !token) return;
    setIsUploading(true);
    setUploadProgress(0);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const document = await uploadDocumentApi(
        selectedFile,
        documentType,
        token,
        setUploadProgress
      );
      setDocuments((current) => [document, ...current]);
      setSuccessMessage("Your document has been uploaded.");
      setSelectedFile(null);
      setUploadProgress(0);
      if (fileInputRef.current) fileInputRef.current.value = "";
    } catch {
      setErrorMessage("We couldn't process this document. Please try again or upload a clearer image.");
    } finally {
      setIsUploading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!token) return;
    setDeletingId(id);
    try {
      await deleteDocumentApi(id, token);
      setDocuments((current) => current.filter((document) => document.id !== id));
      if (previewDocument?.id === id) setPreviewDocument(null);
      setSuccessMessage("Document removed.");
    } catch {
      setErrorMessage("We couldn't remove this document. Please try again.");
    } finally {
      setDeletingId(null);
    }
  };

  const filteredDocuments = documents.filter((document) => {
    const matchesSearch = document.original_filename
      .toLowerCase()
      .includes(searchQuery.trim().toLowerCase());
    const matchesType = filterType === "ALL" || document.document_type === filterType;
    return matchesSearch && matchesType;
  });

  if (isLoading || !user) {
    return (
      <div className="flex min-h-64 items-center justify-center" aria-busy="true">
        <LoaderCircle className="h-6 w-6 animate-spin text-teal-800" />
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6 px-4 py-6 sm:px-6 lg:py-8">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-950">
          My Medical Records
        </h1>
        <p className="mt-1 text-sm text-slate-600">
          Upload and manage your health documents in one place.
        </p>
      </header>

      {errorMessage && (
        <div
          role="alert"
          className="flex items-start gap-3 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-900"
        >
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <div className="flex-1">
            <p>{errorMessage}</p>
            {selectedFile && !isUploading && (
              <button
                type="button"
                onClick={() => void handleUpload()}
                className="mt-2 inline-flex items-center gap-1 font-semibold underline underline-offset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-800"
              >
                Try again <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </button>
            )}
          </div>
          <button
            type="button"
            onClick={() => setErrorMessage(null)}
            aria-label="Dismiss error"
            className="rounded p-1 text-rose-700 hover:bg-rose-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-800"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      )}

      {loadFailed && (
        <div
          role="alert"
          className="flex items-center justify-between gap-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950"
        >
          <span>We couldn&apos;t load your documents. Please try again.</span>
          <button
            type="button"
            onClick={() => void loadDocuments()}
            className="shrink-0 font-semibold underline underline-offset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-800"
          >
            Try again
          </button>
        </div>
      )}

      {successMessage && (
        <div
          role="status"
          className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900"
        >
          <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden="true" />
          {successMessage}
        </div>
      )}

      <section
        aria-labelledby="upload-heading"
        className="rounded-lg border border-slate-200 bg-white p-4 sm:p-5"
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 id="upload-heading" className="text-base font-semibold text-slate-950">
              Add a medical record
            </h2>
            <p className="mt-0.5 text-sm text-slate-600">
              Upload a prescription, lab report, scan or medical document.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <label htmlFor="document-type" className="text-sm text-slate-600">
              Document type
            </label>
            <select
              id="document-type"
              value={documentType}
              onChange={(event) => setDocumentType(event.target.value as DocumentTypeEnum)}
              disabled={isUploading}
              className="min-h-9 max-w-48 rounded-md border border-slate-300 bg-white px-2.5 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-700"
            >
              <option value="UNKNOWN">Select document type</option>
              <option value="PRESCRIPTION">Prescription</option>
              <option value="LAB_REPORT">Lab Report</option>
              <option value="DIAGNOSTIC_REPORT">Medical Report</option>
              <option value="DISCHARGE_SUMMARY">Discharge Summary</option>
              <option value="OTHER">Other</option>
            </select>
          </div>
        </div>

        <div
          role="button"
          tabIndex={isUploading ? -1 : 0}
          aria-label="Choose or drop a medical document"
          aria-disabled={isUploading}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              if (!isUploading) fileInputRef.current?.click();
            }
          }}
          onDragOver={(event) => {
            event.preventDefault();
            if (!isUploading) setIsDragOver(true);
          }}
          onDragLeave={(event) => {
            event.preventDefault();
            setIsDragOver(false);
          }}
          onDrop={(event) => {
            event.preventDefault();
            setIsDragOver(false);
            if (!isUploading && event.dataTransfer.files.length > 0) {
              selectFile(event.dataTransfer.files[0]);
            }
          }}
          onClick={() => {
            if (!isUploading) fileInputRef.current?.click();
          }}
          className={`mt-4 flex min-h-28 cursor-pointer flex-col items-center justify-center rounded-md border border-dashed px-4 py-5 text-center transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-700 ${
            isDragOver
              ? "border-teal-700 bg-teal-50"
              : selectedFile
              ? "border-emerald-400 bg-emerald-50/50"
              : "border-slate-300 bg-slate-50/60 hover:border-teal-500 hover:bg-teal-50/40"
          } ${isUploading ? "cursor-wait opacity-70" : ""}`}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
            disabled={isUploading}
            className="hidden"
            onClick={(event) => event.stopPropagation()}
            onChange={(event) => {
              if (event.target.files?.[0]) selectFile(event.target.files[0]);
            }}
          />
          <UploadCloud className="h-6 w-6 text-teal-800" aria-hidden="true" />
          {selectedFile ? (
            <>
              <p className="mt-2 max-w-full truncate text-sm font-medium text-slate-900">
                {selectedFile.name}
              </p>
              <p className="mt-1 text-xs text-slate-500">
                {isUploading
                  ? "Processing your document..."
                  : `Ready to upload · ${(selectedFile.size / (1024 * 1024)).toFixed(1)} MB`}
              </p>
            </>
          ) : (
            <>
              <p className="mt-2 text-sm font-medium text-slate-900">
                Drag &amp; drop your file here
              </p>
              <p className="mt-0.5 text-sm text-slate-600">
                or <span className="font-semibold text-teal-800 underline underline-offset-2">Browse files</span>
              </p>
              <p className="mt-2 text-xs text-slate-500">PDF, JPG, PNG · Maximum file size: 15 MB</p>
            </>
          )}
        </div>

        {isUploading && (
          <div className="mt-3" role="status" aria-live="polite">
            <div className="flex justify-between text-xs text-slate-600">
              <span>Processing your document...</span>
              <span>{uploadProgress}%</span>
            </div>
            <div
              className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-slate-100"
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={uploadProgress}
            >
              <div
                className="h-full rounded-full bg-teal-700 transition-[width]"
                style={{ width: `${uploadProgress}%` }}
              />
            </div>
          </div>
        )}

        {selectedFile && !isUploading && (
          <div className="mt-3 flex flex-wrap items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => {
                setSelectedFile(null);
                if (fileInputRef.current) fileInputRef.current.value = "";
              }}
              className="min-h-9 rounded-md px-3 text-sm font-medium text-slate-700 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-700"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => void handleUpload()}
              className="inline-flex min-h-9 items-center gap-2 rounded-md bg-teal-800 px-4 text-sm font-semibold text-white transition hover:bg-teal-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-700 focus-visible:ring-offset-2"
            >
              <UploadCloud className="h-4 w-4" aria-hidden="true" />
              Upload Document
            </button>
          </div>
        )}
      </section>

      <section aria-labelledby="documents-heading">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="documents-heading" className="text-lg font-semibold text-slate-950">
            My Documents
          </h2>
          {documents.length > 0 && (
            <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
              <label className="relative min-w-0 flex-1 sm:w-64">
                <span className="sr-only">Search documents</span>
                <Search
                  className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
                  aria-hidden="true"
                />
                <input
                  type="search"
                  placeholder="Search documents"
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  className="min-h-9 w-full rounded-md border border-slate-300 bg-white pl-9 pr-3 text-sm text-slate-900 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-teal-700"
                />
              </label>
              <label>
                <span className="sr-only">Filter by document type</span>
                <select
                  value={filterType}
                  onChange={(event) => setFilterType(event.target.value)}
                  className="min-h-9 w-full rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-700 sm:w-auto"
                >
                  <option value="ALL">All types</option>
                  <option value="PRESCRIPTION">Prescriptions</option>
                  <option value="LAB_REPORT">Lab Reports</option>
                  <option value="DIAGNOSTIC_REPORT">Medical Reports</option>
                  <option value="DISCHARGE_SUMMARY">Discharge Summaries</option>
                </select>
              </label>
            </div>
          )}
        </div>

        {isLoadingDocs ? (
          <div className="mt-3 flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-5 text-sm text-slate-600">
            <LoaderCircle className="h-4 w-4 animate-spin text-teal-800" aria-hidden="true" />
            Loading your documents…
          </div>
        ) : documents.length === 0 && !loadFailed ? (
          <div className="mt-3 flex flex-col items-center rounded-lg border border-slate-200 bg-white px-4 py-7 text-center">
            <FileText className="h-7 w-7 text-slate-500" aria-hidden="true" />
            <p className="mt-2 text-sm font-medium text-slate-900">No medical records yet</p>
            <p className="mt-1 text-sm text-slate-600">
              Upload a prescription, lab report or medical document to get started.
            </p>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="mt-3 inline-flex min-h-9 items-center gap-2 rounded-md bg-teal-800 px-3 text-sm font-semibold text-white transition hover:bg-teal-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-700 focus-visible:ring-offset-2"
            >
              <UploadCloud className="h-4 w-4" aria-hidden="true" />
              Upload Document
            </button>
          </div>
        ) : documents.length > 0 && filteredDocuments.length === 0 ? (
          <p className="mt-3 rounded-lg border border-slate-200 bg-white px-4 py-5 text-sm text-slate-600">
            No documents match your search. Try a different name or type.
          </p>
        ) : (
          <div className="mt-3 divide-y divide-slate-100 overflow-hidden rounded-lg border border-slate-200 bg-white">
            {filteredDocuments.map((document) => {
              const status = statusForDocument(document.processing_status);
              const StatusIcon = status.icon;
              const TypeIcon =
                document.document_type === "LAB_REPORT" ? FlaskConical : FileText;
              return (
                <div
                  key={document.id}
                  className="flex min-w-0 items-center gap-3 px-3 py-3 transition hover:bg-slate-50 sm:px-4"
                >
                  <span className="shrink-0 rounded-md bg-slate-100 p-2 text-slate-700">
                    <TypeIcon className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <Link
                    href={`/documents/${document.id}`}
                    className="min-w-0 flex-1 rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-700"
                  >
                    <span className="block truncate text-sm font-medium text-slate-950">
                      {document.original_filename}
                    </span>
                    <span className="mt-0.5 block text-xs text-slate-600">
                      {documentTypeLabels[document.document_type]} · {formatUploadDate(document.upload_date)}
                    </span>
                  </Link>
                  <span className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-1 text-[11px] font-medium sm:px-2.5 sm:text-xs ${status.className}`}>
                    <StatusIcon className="h-3.5 w-3.5" aria-hidden="true" />
                    {status.label}
                  </span>
                  <button
                    type="button"
                    onClick={() => setPreviewDocument(document)}
                    aria-label={`Preview ${document.original_filename}`}
                    className="shrink-0 rounded-md p-2 text-slate-500 transition hover:bg-slate-100 hover:text-teal-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-700"
                  >
                    <Eye className="h-4 w-4" aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleDelete(document.id)}
                    disabled={deletingId === document.id}
                    aria-label={`Delete ${document.original_filename}`}
                    className="shrink-0 rounded-md p-2 text-slate-500 transition hover:bg-rose-50 hover:text-rose-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-700 disabled:opacity-50"
                  >
                    {deletingId === document.id ? (
                      <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" />
                    ) : (
                      <Trash2 className="h-4 w-4" aria-hidden="true" />
                    )}
                  </button>
                  <Link
                    href={`/documents/${document.id}`}
                    aria-label={`View details for ${document.original_filename}`}
                    className="shrink-0 rounded-md p-2 text-teal-800 transition hover:bg-teal-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-700"
                  >
                    <ArrowRight className="h-4 w-4" aria-hidden="true" />
                  </Link>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {previewDocument && token && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-3 sm:p-6"
          role="dialog"
          aria-modal="true"
          aria-labelledby="document-preview-title"
        >
          <div className="flex h-[88vh] w-full max-w-4xl flex-col overflow-hidden rounded-lg bg-white">
            <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-4 py-3">
              <div className="flex min-w-0 items-center gap-3">
                <FileText className="h-5 w-5 shrink-0 text-teal-800" aria-hidden="true" />
                <div className="min-w-0">
                  <h2 id="document-preview-title" className="truncate text-sm font-semibold text-slate-950">
                    {previewDocument.original_filename}
                  </h2>
                  <p className="mt-0.5 text-xs text-slate-600">
                    {documentTypeLabels[previewDocument.document_type]} · {formatUploadDate(previewDocument.upload_date)}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setPreviewDocument(null)}
                aria-label="Close preview"
                className="rounded-md p-2 text-slate-600 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-700"
              >
                <X className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>
            <div className="flex-1 overflow-auto bg-slate-100 p-2">
              {previewDocument.mime_type.includes("pdf") ? (
                <iframe
                  src={getDocumentPreviewUrl(previewDocument.id, token)}
                  title={`Preview of ${previewDocument.original_filename}`}
                  className="h-full w-full rounded border-0 bg-white"
                />
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={getDocumentPreviewUrl(previewDocument.id, token)}
                  alt={previewDocument.original_filename}
                  className="mx-auto max-h-full max-w-full object-contain"
                />
              )}
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-200 px-4 py-3">
              <Link
                href={`/documents/${previewDocument.id}`}
                className="inline-flex min-h-9 items-center gap-1.5 rounded-md bg-teal-800 px-3 text-sm font-semibold text-white transition hover:bg-teal-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-700 focus-visible:ring-offset-2"
              >
                View details <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
              <a
                href={getDocumentPreviewUrl(previewDocument.id, token)}
                download={previewDocument.original_filename}
                className="inline-flex min-h-9 items-center gap-1.5 rounded-md border border-slate-300 px-3 text-sm font-medium text-slate-700 transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-700"
              >
                <Download className="h-4 w-4" aria-hidden="true" />
                Download
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
