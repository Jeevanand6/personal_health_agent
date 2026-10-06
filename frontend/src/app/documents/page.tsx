"use client";

import React, { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import {
  MedicalDocument,
  DocumentTypeEnum,
  getDocumentsApi,
  uploadDocumentApi,
  deleteDocumentApi,
  getDocumentPreviewUrl,
} from "@/lib/api";
import {
  FileText,
  UploadCloud,
  Trash2,
  Eye,
  Download,
  AlertCircle,
  CheckCircle2,
  Clock,
  Filter,
  Search,
  X,
  RefreshCw,
  FileCheck,
  FileSpreadsheet,
  File,
  Shield,
  ExternalLink,
} from "lucide-react";

const MAX_FILE_SIZE = 15 * 1024 * 1024; // 15MB
const ALLOWED_EXTS = [".pdf", ".jpg", ".jpeg", ".png"];

export default function DocumentsPage() {
  const { user, token, isLoading } = useAuth();
  const router = useRouter();

  // Document state
  const [documents, setDocuments] = useState<MedicalDocument[]>([]);
  const [isLoadingDocs, setIsLoadingDocs] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Upload state
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [docType, setDocType] = useState<DocumentTypeEnum>("PRESCRIPTION");
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [isDragOver, setIsDragOver] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Filter & Search
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [filterType, setFilterType] = useState<string>("ALL");

  // Preview Modal
  const [previewDoc, setPreviewDoc] = useState<MedicalDocument | null>(null);

  // Delete Confirmation
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Authentication Guard
  useEffect(() => {
    if (!isLoading && !user) {
      router.push("/login");
    }
  }, [isLoading, user, router]);

  // Load documents
  const loadDocuments = async () => {
    if (!token) return;
    setIsLoadingDocs(true);
    setError(null);
    try {
      const docs = await getDocumentsApi(token);
      setDocuments(docs);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to load documents.";
      setError(msg);
    } finally {
      setIsLoadingDocs(false);
    }
  };

  useEffect(() => {
    if (token) {
      loadDocuments();
    }
  }, [token]);

  // File validation helper
  const validateFile = (file: File): string | null => {
    const ext = "." + file.name.split(".").pop()?.toLowerCase();
    if (!ALLOWED_EXTS.includes(ext)) {
      return `Invalid format '${ext}'. Only PDF, JPG, JPEG, and PNG files are supported.`;
    }
    if (file.size > MAX_FILE_SIZE) {
      return `File size ${(file.size / (1024 * 1024)).toFixed(1)} MB exceeds maximum limit of 15 MB.`;
    }
    return null;
  };

  const handleFileSelection = (file: File) => {
    setError(null);
    setSuccessMsg(null);
    const validationError = validateFile(file);
    if (validationError) {
      setError(validationError);
      setSelectedFile(null);
      return;
    }
    setSelectedFile(file);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFileSelection(e.dataTransfer.files[0]);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile || !token) return;
    setIsUploading(true);
    setUploadProgress(0);
    setError(null);
    setSuccessMsg(null);

    try {
      const newDoc = await uploadDocumentApi(
        selectedFile,
        docType,
        token,
        (percent) => setUploadProgress(percent)
      );
      setDocuments((prev) => [newDoc, ...prev]);
      setSuccessMsg(`"${newDoc.original_filename}" uploaded successfully.`);
      setSelectedFile(null);
      setUploadProgress(0);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Upload failed.";
      setError(msg);
    } finally {
      setIsUploading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!token) return;
    setDeletingId(id);
    try {
      await deleteDocumentApi(id, token);
      setDocuments((prev) => prev.filter((d) => d.id !== id));
      if (previewDoc?.id === id) {
        setPreviewDoc(null);
      }
      setSuccessMsg("Document deleted successfully.");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to delete document.";
      setError(msg);
    } finally {
      setDeletingId(null);
    }
  };

  // Helper formatting
  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "UPLOADED":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-sky-50 text-sky-700 border border-sky-200">
            <Clock className="w-3 h-3" />
            Uploaded
          </span>
        );
      case "PROCESSING":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-amber-50 text-amber-700 border border-amber-200 animate-pulse">
            <RefreshCw className="w-3 h-3 animate-spin" />
            Processing
          </span>
        );
      case "COMPLETED":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
            <CheckCircle2 className="w-3 h-3" />
            Completed
          </span>
        );
      case "FAILED":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-rose-50 text-rose-700 border border-rose-200">
            <AlertCircle className="w-3 h-3" />
            Failed
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-slate-100 text-slate-700">
            {status}
          </span>
        );
    }
  };

  const getTypeBadge = (type: string) => {
    const cleanType = type.replace("_", " ");
    switch (type) {
      case "PRESCRIPTION":
        return (
          <span className="px-2 py-0.5 rounded-md text-[11px] font-medium bg-purple-50 text-purple-700 border border-purple-200">
            Prescription
          </span>
        );
      case "LAB_REPORT":
        return (
          <span className="px-2 py-0.5 rounded-md text-[11px] font-medium bg-teal-50 text-teal-700 border border-teal-200">
            Lab Report
          </span>
        );
      case "DIAGNOSTIC_REPORT":
        return (
          <span className="px-2 py-0.5 rounded-md text-[11px] font-medium bg-blue-50 text-blue-700 border border-blue-200">
            Diagnostic Report
          </span>
        );
      case "DISCHARGE_SUMMARY":
        return (
          <span className="px-2 py-0.5 rounded-md text-[11px] font-medium bg-amber-50 text-amber-700 border border-amber-200">
            Discharge Summary
          </span>
        );
      default:
        return (
          <span className="px-2 py-0.5 rounded-md text-[11px] font-medium bg-slate-100 text-slate-700">
            {cleanType}
          </span>
        );
    }
  };

  // Filtered documents
  const filteredDocuments = documents.filter((doc) => {
    const matchesSearch = doc.original_filename
      .toLowerCase()
      .includes(searchQuery.toLowerCase());
    const matchesType =
      filterType === "ALL" || doc.document_type === filterType;
    return matchesSearch && matchesType;
  });

  if (isLoading || !user) {
    return (
      <div className="min-h-[calc(100vh-16rem)] flex items-center justify-center">
        <RefreshCw className="w-6 h-6 animate-spin text-teal-600" />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
            Medical Documents &amp; Records
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Encrypted personal health record storage for {user.full_name}
          </p>
        </div>

        <button
          onClick={loadDocuments}
          disabled={isLoadingDocs}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 shadow-sm transition-colors"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isLoadingDocs ? "animate-spin text-teal-600" : ""}`} />
          <span>Refresh Records</span>
        </button>
      </div>

      {/* Notifications */}
      {error && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 flex items-start gap-3 text-xs text-rose-800">
          <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
          <div className="flex-1 leading-relaxed">{error}</div>
          <button onClick={() => setError(null)} className="text-rose-400 hover:text-rose-600">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {successMsg && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 flex items-start gap-3 text-xs text-emerald-800">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
          <div className="flex-1 leading-relaxed">{successMsg}</div>
          <button onClick={() => setSuccessMsg(null)} className="text-emerald-400 hover:text-emerald-600">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Section 1: Drag-and-Drop Upload Area */}
      <div className="bg-white rounded-2xl border border-slate-200/90 p-6 sm:p-8 shadow-sm space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
          <div>
            <h2 className="text-base font-bold text-slate-900">Upload New Medical Record</h2>
            <p className="text-xs text-slate-500">
              Supported formats: PDF, JPG, JPEG, PNG (Maximum size: 15MB)
            </p>
          </div>

          {/* Document Type Selector */}
          <div className="flex items-center gap-2">
            <label className="text-xs font-semibold text-slate-600">Type:</label>
            <select
              value={docType}
              onChange={(e) => setDocType(e.target.value as DocumentTypeEnum)}
              className="px-3 py-1.5 text-xs font-semibold rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-teal-600 bg-white text-slate-900"
            >
              <option value="PRESCRIPTION">Prescription</option>
              <option value="LAB_REPORT">Lab Report</option>
              <option value="DIAGNOSTIC_REPORT">Diagnostic Report</option>
              <option value="DISCHARGE_SUMMARY">Discharge Summary</option>
              <option value="OTHER">Other Clinical Document</option>
              <option value="UNKNOWN">Unclassified</option>
            </select>
          </div>
        </div>

        {/* Dropzone Container */}
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`border-2 border-dashed rounded-2xl p-8 sm:p-10 text-center cursor-pointer transition-all ${
            isDragOver
              ? "border-teal-500 bg-teal-50/50 scale-[1.005]"
              : selectedFile
              ? "border-emerald-400 bg-emerald-50/30"
              : "border-slate-300 hover:border-teal-400 bg-slate-50/50"
          }`}
        >
          <input
            type="file"
            ref={fileInputRef}
            onChange={(e) => {
              if (e.target.files && e.target.files.length > 0) {
                handleFileSelection(e.target.files[0]);
              }
            }}
            accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
            className="hidden"
          />

          <div className="space-y-3">
            <div
              className={`w-14 h-14 rounded-2xl mx-auto flex items-center justify-center ${
                selectedFile
                  ? "bg-emerald-100 text-emerald-700"
                  : "bg-teal-50 text-teal-600 border border-teal-200/80"
              }`}
            >
              <UploadCloud className="w-7 h-7" />
            </div>

            {selectedFile ? (
              <div className="space-y-1">
                <p className="text-sm font-bold text-slate-900 flex items-center justify-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span>{selectedFile.name}</span>
                </p>
                <p className="text-xs text-slate-500">
                  Ready to upload &bull; Size: {formatBytes(selectedFile.size)} &bull; Type: {docType}
                </p>
                <p className="text-[11px] text-teal-600 underline pt-1">
                  Click to select a different file
                </p>
              </div>
            ) : (
              <div className="space-y-1">
                <p className="text-sm font-semibold text-slate-800">
                  Drag and drop your medical document here, or{" "}
                  <span className="text-teal-600 underline font-bold">browse your computer</span>
                </p>
                <p className="text-xs text-slate-500">
                  Secure local volume ingestion with MIME header verification &bull; Max 15MB
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Upload Action Bar & Progress Indicator */}
        {selectedFile && (
          <div className="space-y-4 pt-2">
            {isUploading && (
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs font-semibold text-slate-700">
                  <span>Uploading securely...</span>
                  <span>{uploadProgress}%</span>
                </div>
                <div className="w-full h-2.5 rounded-full bg-slate-100 overflow-hidden">
                  <div
                    className="h-full bg-teal-600 transition-all duration-300 rounded-full"
                    style={{ width: `${uploadProgress}%` }}
                  />
                </div>
              </div>
            )}

            <div className="flex items-center justify-end gap-3">
              <button
                type="button"
                disabled={isUploading}
                onClick={() => {
                  setSelectedFile(null);
                  if (fileInputRef.current) fileInputRef.current.value = "";
                }}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isUploading}
                onClick={handleUpload}
                className="px-6 py-2.5 rounded-xl text-xs font-semibold text-white bg-teal-600 hover:bg-teal-700 shadow-sm shadow-teal-600/30 transition-all disabled:opacity-50"
              >
                {isUploading ? "Uploading File..." : "Confirm & Save Document"}
              </button>
            </div>
          </div>
        )}

        <div className="flex items-center gap-2 text-[11px] text-slate-400 pt-2 border-t border-slate-100">
          <Shield className="w-3.5 h-3.5 text-teal-600 shrink-0" />
          <span>Files are quarantined in isolated Docker storage. Raw file paths are never exposed to clients.</span>
        </div>
      </div>

      {/* Section 2: Document List & Filtering */}
      <div className="space-y-4">
        {/* Search & Filter Toolbar */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              placeholder="Search documents by name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-3.5 py-2 text-xs rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-teal-600 bg-white text-slate-900"
            />
          </div>

          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-slate-400" />
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="px-3 py-2 text-xs font-semibold rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-teal-600 bg-white text-slate-900"
            >
              <option value="ALL">All Types ({documents.length})</option>
              <option value="PRESCRIPTION">Prescriptions</option>
              <option value="LAB_REPORT">Lab Reports</option>
              <option value="DIAGNOSTIC_REPORT">Diagnostic Reports</option>
              <option value="DISCHARGE_SUMMARY">Discharge Summaries</option>
              <option value="OTHER">Other</option>
            </select>
          </div>
        </div>

        {/* Documents Grid */}
        {isLoadingDocs ? (
          <div className="bg-white rounded-2xl border border-slate-200/90 p-12 text-center">
            <RefreshCw className="w-6 h-6 animate-spin text-teal-600 mx-auto mb-2" />
            <p className="text-xs text-slate-500 font-semibold">Loading patient records...</p>
          </div>
        ) : filteredDocuments.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-200/90 p-12 text-center space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-400 mx-auto flex items-center justify-center">
              <FileText className="w-6 h-6" />
            </div>
            <div className="space-y-1">
              <h3 className="text-sm font-bold text-slate-900">
                {searchQuery || filterType !== "ALL"
                  ? "No matching documents found"
                  : "No medical documents uploaded yet"}
              </h3>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                {searchQuery || filterType !== "ALL"
                  ? "Try resetting your search filter to display all documents."
                  : "Upload your prescriptions or lab results above to populate your unified medical repository."}
              </p>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredDocuments.map((doc) => {
              const isPdf = doc.mime_type.includes("pdf");
              return (
                <div
                  key={doc.id}
                  className="bg-white rounded-2xl border border-slate-200/90 p-5 shadow-sm hover:shadow-md hover:border-teal-300 transition-all flex flex-col justify-between space-y-4"
                >
                  <div className="space-y-3">
                    {/* Header info */}
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                            isPdf
                              ? "bg-rose-50 text-rose-600 border border-rose-200"
                              : "bg-blue-50 text-blue-600 border border-blue-200"
                          }`}
                        >
                          {isPdf ? (
                            <FileText className="w-5 h-5" />
                          ) : (
                            <FileCheck className="w-5 h-5" />
                          )}
                        </div>
                        <div className="overflow-hidden">
                          <h4
                            title={doc.original_filename}
                            className="text-xs font-bold text-slate-900 truncate max-w-[180px]"
                          >
                            {doc.original_filename}
                          </h4>
                          <span className="text-[11px] text-slate-400 font-mono">
                            {formatBytes(doc.file_size)} &bull; {doc.mime_type.split("/")[1]?.toUpperCase()}
                          </span>
                        </div>
                      </div>

                      {getStatusBadge(doc.processing_status)}
                    </div>

                    {/* Metadata tags */}
                    <div className="flex flex-wrap items-center gap-2 pt-1">
                      {getTypeBadge(doc.document_type)}
                      <span className="text-[11px] text-slate-400">
                        Uploaded: {new Date(doc.upload_date).toLocaleDateString()}
                      </span>
                    </div>
                  </div>

                  {/* Actions row */}
                  <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                    <button
                      onClick={() => setPreviewDoc(doc)}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-teal-700 hover:bg-teal-50 transition-colors"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>Preview</span>
                    </button>

                    <div className="flex items-center gap-1">
                      {token && (
                        <a
                          href={getDocumentPreviewUrl(doc.id, token)}
                          target="_blank"
                          rel="noopener noreferrer"
                          download={doc.original_filename}
                          title="Download document"
                          className="p-1.5 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors"
                        >
                          <Download className="w-4 h-4" />
                        </a>
                      )}

                      <button
                        onClick={() => handleDelete(doc.id)}
                        disabled={deletingId === doc.id}
                        title="Delete document"
                        className="p-1.5 rounded-lg text-rose-500 hover:text-rose-700 hover:bg-rose-50 transition-colors disabled:opacity-50"
                      >
                        <Trash2 className={`w-4 h-4 ${deletingId === doc.id ? "animate-spin" : ""}`} />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Section 3: Secure Document Preview Modal */}
      {previewDoc && token && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 sm:p-6">
          <div className="bg-white w-full max-w-4xl h-[85vh] rounded-2xl shadow-2xl flex flex-col overflow-hidden border border-slate-200">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <div className="flex items-center gap-3 overflow-hidden">
                <FileText className="w-5 h-5 text-teal-600 shrink-0" />
                <div>
                  <h3 className="text-sm font-bold text-slate-900 truncate max-w-md">
                    {previewDoc.original_filename}
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Type: {previewDoc.document_type} &bull; Size: {formatBytes(previewDoc.file_size)}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <a
                  href={getDocumentPreviewUrl(previewDoc.id, token)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-2 rounded-xl text-slate-600 hover:bg-slate-200 transition-colors"
                  title="Open in new window"
                >
                  <ExternalLink className="w-4 h-4" />
                </a>
                <button
                  onClick={() => setPreviewDoc(null)}
                  className="p-2 rounded-xl text-slate-500 hover:text-slate-900 hover:bg-slate-200 transition-colors"
                  title="Close preview"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Modal Body */}
            <div className="flex-1 bg-slate-100 flex items-center justify-center p-2 overflow-auto">
              {previewDoc.mime_type.includes("pdf") ? (
                <iframe
                  src={getDocumentPreviewUrl(previewDoc.id, token)}
                  className="w-full h-full rounded-lg border-0 shadow-inner bg-white"
                  title="PDF Preview"
                />
              ) : (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={getDocumentPreviewUrl(previewDoc.id, token)}
                  alt={previewDoc.original_filename}
                  className="max-h-full max-w-full object-contain rounded-lg shadow-md"
                />
              )}
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-3 border-t border-slate-200 bg-white flex items-center justify-between text-xs text-slate-500">
              <span className="font-mono">UUID: {previewDoc.id}</span>
              <a
                href={getDocumentPreviewUrl(previewDoc.id, token)}
                download={previewDoc.original_filename}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-teal-600 hover:bg-teal-700 text-white font-semibold transition-colors"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Download Original</span>
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
