export interface HealthStatus {
  status: "healthy" | "unhealthy" | "offline";
  database: "connected" | "disconnected" | "unknown";
  timestamp?: string;
  error?: string;
}

export interface Patient {
  id: string;
  abha_id?: string | null;
  abha_address?: string | null;
  date_of_birth?: string | null;
  gender?: string | null;
  blood_group?: string | null;
  contact_number?: string | null;
  preferred_language: string;
  created_at: string;
}

export interface User {
  id: string;
  email: string;
  full_name: string;
  role: string;
  is_active: boolean;
  created_at: string;
  patient?: Patient | null;
}

export interface AuthResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  user: User;
}

export interface RegisterPayload {
  email: string;
  password: string;
  full_name: string;
  preferred_language?: string;
  gender?: string;
  blood_group?: string;
  contact_number?: string;
}

export type DocumentTypeEnum =
  | "PRESCRIPTION"
  | "LAB_REPORT"
  | "DIAGNOSTIC_REPORT"
  | "DISCHARGE_SUMMARY"
  | "OTHER"
  | "UNKNOWN";

export type ProcessingStatusEnum =
  | "UPLOADED"
  | "PROCESSING"
  | "COMPLETED"
  | "LOW_CONFIDENCE"
  | "FAILED";

export interface DocumentExtraction {
  id: string;
  document_id: string;
  raw_text: string;
  cleaned_text: string;
  ocr_confidence: number;
  page_count: number;
  language_detected: string;
  processing_time: number;
  created_at: string;
  updated_at: string;
}

export interface OCRTriggerResult {
  document_id: string;
  processing_status: ProcessingStatusEnum;
  ocr_confidence: number;
  language_detected: string;
  page_count: number;
  message: string;
  extraction?: DocumentExtraction | null;
}

export interface MedicationItem {
  name: string | null;
  dosage: string | null;
  route: string | null;
  frequency: string | null;
  duration: string | null;
  instructions: string | null;
  confidence: number;
}

export interface ObservationItem {
  test_name: string | null;
  value: string | null;
  numeric_value: number | null;
  unit: string | null;
  reference_range: string | null;
  abnormal_flag: "LOW" | "NORMAL" | "HIGH" | "UNKNOWN";
  confidence: number;
}

export interface StructuredMedicalData {
  patient_name: string | null;
  patient_age: string | null;
  patient_gender: string | null;
  doctor_name: string | null;
  hospital_name: string | null;
  document_date: string | null;
  diagnoses: string[];
  medications: MedicationItem[];
  laboratory_tests: string[];
  observations: ObservationItem[];
  reference_ranges: string[];
  units: string[];
  abnormal_flags: string[];
  clinical_notes: string | null;
  field_confidences: Record<string, number>;
  overall_confidence: number;
}

export interface PrescriptionField {
  raw_text: string | null;
  normalized_value: string | null;
  confidence: number;
  is_uncertain: boolean;
  uncertainty_reason?: string | null;
  source_page?: number;
  is_corrected_by_user?: boolean;
  original_value?: string | null;
}

export interface PrescribedMedicationItem {
  name_as_written: PrescriptionField;
  generic_name?: PrescriptionField | null;
  strength?: PrescriptionField | null;
  dosage?: PrescriptionField | null;
  dosage_form?: PrescriptionField | null;
  route?: PrescriptionField | null;
  frequency?: PrescriptionField | null;
  duration?: PrescriptionField | null;
  instructions?: PrescriptionField | null;
  is_uncertain: boolean;
}

export interface StructuredPrescriptionData {
  doctor_name: PrescriptionField;
  clinic_name: PrescriptionField;
  patient_name: PrescriptionField;
  patient_age: PrescriptionField;
  patient_sex: PrescriptionField;
  prescription_date: PrescriptionField;
  diagnosis: PrescriptionField;
  notes: PrescriptionField;
  medications: PrescribedMedicationItem[];
  instructions_and_follow_up: PrescriptionField;
  overall_confidence: number;
  is_uncertain: boolean;
  model_metadata?: Record<string, any>;
}

export interface AIExtraction {
  id: string;
  document_id: string;
  model_name: string;
  confidence_score: number;
  processing_time: number;
  structured_data: any;
  raw_response?: string | null;
  is_verified?: boolean;
  verified_at?: string | null;
  verification_audit?: Record<string, any>;
  extraction_type?: string;
  created_at: string;
  updated_at: string;
}

export interface PrescriptionExtractionResponse {
  document_id: string;
  extraction_id?: string;
  is_verified: boolean;
  verified_at?: string | null;
  processing_status: ProcessingStatusEnum;
  structured_data: StructuredPrescriptionData;
  raw_response?: string;
  model_name: string;
  confidence_score: number;
  processing_time: number;
  verification_audit?: Record<string, any>;
  preprocessing_metadata?: Record<string, any>;
  message: string;
}

export interface AIExtractTriggerResult {
  document_id: string;
  status: string;
  message: string;
  extraction?: AIExtraction | null;
}

export interface MedicalDocument {
  id: string;
  original_filename: string;
  mime_type: string;
  file_size: number;
  document_type: DocumentTypeEnum;
  processing_status: ProcessingStatusEnum;
  upload_date: string;
  created_at: string;
  file_url: string;
}

export interface DocumentListResponse {
  documents: MedicalDocument[];
  total: number;
}

export const getApiBaseUrl = (): string => {
  if (typeof window !== "undefined") {
    return process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
  }
  return (
    process.env.INTERNAL_API_URL ||
    process.env.NEXT_PUBLIC_API_URL ||
    "http://localhost:8000"
  );
};

export async function fetchHealthStatus(): Promise<HealthStatus> {
  const baseUrl = getApiBaseUrl();
  try {
    const res = await fetch(`${baseUrl}/api/health`, {
      method: "GET",
      cache: "no-store",
      headers: {
        "Content-Type": "application/json",
      },
    });

    if (!res.ok) {
      return {
        status: "unhealthy",
        database: "disconnected",
        error: `HTTP error ${res.status}: ${res.statusText}`,
      };
    }

    const data = await res.json();
    return {
      status: data.status === "healthy" ? "healthy" : "unhealthy",
      database: data.database === "connected" ? "connected" : "disconnected",
      timestamp: new Date().toISOString(),
    };
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : "Network error";
    return {
      status: "offline",
      database: "unknown",
      error: errorMessage,
    };
  }
}

export async function registerApi(payload: RegisterPayload): Promise<AuthResponse> {
  const baseUrl = getApiBaseUrl();
  const res = await fetch(`${baseUrl}/api/auth/register`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.detail || "Registration failed. Please check your details.");
  }
  return data;
}

export async function loginApi(email: string, password: string): Promise<AuthResponse> {
  const baseUrl = getApiBaseUrl();
  const res = await fetch(`${baseUrl}/api/auth/login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ email, password }),
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.detail || "Invalid email or password.");
  }
  return data;
}

export async function getMeApi(token: string): Promise<User> {
  const baseUrl = getApiBaseUrl();
  const res = await fetch(`${baseUrl}/api/auth/me`, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.detail || "Session invalid or expired.");
  }
  return data;
}

export async function updateLanguageApi(
  language: "en" | "ta",
  token: string
): Promise<User> {
  const baseUrl = getApiBaseUrl();
  const res = await fetch(`${baseUrl}/api/auth/me/language`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ preferred_language: language }),
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.detail || "Failed to update preferred language.");
  }
  return data;
}

// ==========================================
// DOCUMENT MANAGEMENT APIs
// ==========================================

export async function uploadDocumentApi(
  file: File,
  documentType: DocumentTypeEnum,
  token: string,
  onProgress?: (percent: number) => void
): Promise<MedicalDocument> {
  const baseUrl = getApiBaseUrl();

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    const formData = new FormData();
    formData.append("file", file);
    formData.append("document_type", documentType);

    xhr.open("POST", `${baseUrl}/api/documents/upload`);
    xhr.setRequestHeader("Authorization", `Bearer ${token}`);

    if (xhr.upload && onProgress) {
      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) {
          const percentComplete = Math.round((event.loaded / event.total) * 100);
          onProgress(percentComplete);
        }
      };
    }

    xhr.onload = () => {
      try {
        const response = JSON.parse(xhr.responseText);
        if (xhr.status >= 200 && xhr.status < 300) {
          resolve(response);
        } else {
          reject(new Error(response.detail || "Document upload failed."));
        }
      } catch (e) {
        reject(new Error("Unexpected response from server."));
      }
    };

    xhr.onerror = () => {
      reject(new Error("Network error during document upload."));
    };

    xhr.send(formData);
  });
}

export async function getDocumentsApi(token: string): Promise<MedicalDocument[]> {
  const baseUrl = getApiBaseUrl();
  const res = await fetch(`${baseUrl}/api/documents`, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.detail || "Failed to retrieve documents.");
  }
  return data.documents || [];
}

export async function getDocumentApi(
  id: string,
  token: string
): Promise<MedicalDocument> {
  const baseUrl = getApiBaseUrl();
  const res = await fetch(`${baseUrl}/api/documents/${id}`, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.detail || "Document not found.");
  }
  return data;
}

export async function deleteDocumentApi(id: string, token: string): Promise<void> {
  const baseUrl = getApiBaseUrl();
  const res = await fetch(`${baseUrl}/api/documents/${id}`, {
    method: "DELETE",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
  });

  if (!res.ok) {
    const data = await res.json();
    throw new Error(data.detail || "Failed to delete document.");
  }
}

export function getDocumentPreviewUrl(id: string, token: string): string {
  const baseUrl = getApiBaseUrl();
  return `${baseUrl}/api/documents/${id}/file?token=${encodeURIComponent(token)}`;
}

export async function runDocumentOcrApi(
  id: string,
  token: string
): Promise<OCRTriggerResult> {
  const baseUrl = getApiBaseUrl();
  try {
    const res = await fetch(`${baseUrl}/api/documents/${id}/ocr`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const errDetail =
        typeof data.detail === "string"
          ? data.detail
          : typeof data.message === "string"
          ? data.message
          : JSON.stringify(data.detail || data) || `OCR failed (HTTP ${res.status})`;
      throw new Error(errDetail);
    }
    return data;
  } catch (err: any) {
    if (
      err.message &&
      (err.message.includes("Failed to fetch") ||
        err.message.includes("NetworkError") ||
        err.message.includes("Network error") ||
        err.message.includes("Load failed"))
    ) {
      throw new Error(
        `Unable to reach backend OCR service at ${baseUrl}/api/documents/${id}/ocr. Please verify the backend container is running.`
      );
    }
    throw err;
  }
}

export async function getDocumentExtractionApi(
  id: string,
  token: string
): Promise<DocumentExtraction> {
  const baseUrl = getApiBaseUrl();
  const res = await fetch(`${baseUrl}/api/documents/${id}/extraction`, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.detail || "Failed to retrieve OCR extraction.");
  }
  return data;
}

export async function triggerAIExtractionApi(
  id: string,
  token: string
): Promise<AIExtractTriggerResult> {
  const baseUrl = getApiBaseUrl();
  try {
    const res = await fetch(`${baseUrl}/api/documents/${id}/extract`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const errDetail =
        typeof data.detail === "string"
          ? data.detail
          : typeof data.message === "string"
          ? data.message
          : JSON.stringify(data.detail || data) || `AI extraction failed (HTTP ${res.status})`;
      throw new Error(errDetail);
    }
    return data;
  } catch (err: any) {
    if (
      err.message &&
      (err.message.includes("Failed to fetch") ||
        err.message.includes("NetworkError") ||
        err.message.includes("Network error") ||
        err.message.includes("Load failed"))
    ) {
      throw new Error(
        `Unable to reach backend AI extraction service at ${baseUrl}/api/documents/${id}/extract. Please check if the backend is running.`
      );
    }
    throw err;
  }
}

export async function getDocumentAIExtractionApi(
  id: string,
  token: string
): Promise<AIExtraction> {
  const baseUrl = getApiBaseUrl();
  const res = await fetch(`${baseUrl}/api/documents/${id}/ai-extraction`, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.detail || "Failed to retrieve AI structured extraction.");
  }
  return data;
}

export async function checkPrescriptionHealthApi(): Promise<{
  status: "ok" | "degraded";
  service: string;
  model: string;
  error?: string;
  hardware?: Record<string, any>;
}> {
  const baseUrl = getApiBaseUrl();
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);
    const res = await fetch(`${baseUrl}/api/prescription/health`, {
      method: "GET",
      cache: "no-store",
      headers: { "Content-Type": "application/json" },
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    const data = await res.json();
    return data;
  } catch (err: any) {
    return {
      status: "degraded",
      service: "prescription-extraction",
      model: "unavailable",
      error:
        err.name === "AbortError"
          ? "Prescription health check timed out."
          : "Unable to connect to the prescription AI service. Please verify the backend is running.",
    };
  }
}

export async function extractPrescriptionDirectApi(
  file: File,
  token?: string
): Promise<{
  success: boolean;
  extraction: StructuredPrescriptionData;
  processing: {
    preprocessed: boolean;
    model: string;
    backend?: string;
    processing_time_seconds?: number;
  };
  document_id?: string;
  extraction_id?: string;
  is_verified?: boolean;
}> {
  const baseUrl = getApiBaseUrl();
  const formData = new FormData();
  formData.append("file", file);

  const headers: Record<string, string> = {};
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 120000); // 120-second timeout

  try {
    const res = await fetch(`${baseUrl}/api/prescription/extract`, {
      method: "POST",
      headers,
      body: formData,
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const errDetail =
        typeof data.detail === "string"
          ? data.detail
          : typeof data.message === "string"
          ? data.message
          : JSON.stringify(data.detail || data) || `Prescription extraction failed (HTTP ${res.status})`;
      throw new Error(errDetail);
    }
    return data;
  } catch (err: any) {
    clearTimeout(timeoutId);
    if (err.name === "AbortError") {
      throw new Error(
        "Prescription AI inference timed out after 120 seconds. Vision inference requires additional processing time or GPU acceleration."
      );
    }
    if (
      err.message &&
      (err.message.includes("Failed to fetch") ||
        err.message.includes("NetworkError") ||
        err.message.includes("Network error"))
    ) {
      throw new Error(
        `Unable to connect to the prescription AI service at ${baseUrl}. Please check backend logs or CORS settings.`
      );
    }
    throw err;
  }
}

export async function extractPrescriptionApi(
  id: string,
  token: string,
  page: number = 0
): Promise<PrescriptionExtractionResponse> {
  const baseUrl = getApiBaseUrl();
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 120000); // 120-second timeout

  try {
    const res = await fetch(
      `${baseUrl}/api/documents/${id}/extract-prescription?page=${page}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        signal: controller.signal,
      }
    );
    clearTimeout(timeoutId);

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const errDetail =
        typeof data.detail === "string"
          ? data.detail
          : typeof data.message === "string"
          ? data.message
          : JSON.stringify(data.detail || data) || `Handwritten prescription extraction failed (HTTP ${res.status})`;
      throw new Error(errDetail);
    }
    return data;
  } catch (err: any) {
    clearTimeout(timeoutId);
    if (err.name === "AbortError") {
      throw new Error(
        "Prescription AI inference timed out after 120 seconds. Vision model inference requires additional processing time or GPU acceleration."
      );
    }
    if (
      err.message &&
      (err.message.includes("Failed to fetch") ||
        err.message.includes("NetworkError") ||
        err.message.includes("Network error"))
    ) {
      throw new Error(
        `Unable to connect to the prescription AI service at ${baseUrl}. Please check if the backend is running.`
      );
    }
    throw err;
  }
}

export async function verifyPrescriptionApi(
  id: string,
  token: string,
  payload: {
    approved_data: StructuredPrescriptionData;
    corrections: Array<{
      field_path: string;
      original_value: string | null;
      corrected_value: string | null;
      reason?: string | null;
    }>;
    notes?: string;
  }
): Promise<PrescriptionExtractionResponse> {
  const baseUrl = getApiBaseUrl();
  const res = await fetch(`${baseUrl}/api/documents/${id}/verify-prescription`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.detail || "Prescription verification failed.");
  }
  return data;
}

export function getPrescriptionPagePreviewUrl(
  id: string,
  token: string,
  page: number = 0,
  enhanced: boolean = true
): string {
  const baseUrl = getApiBaseUrl();
  return `${baseUrl}/api/documents/${id}/prescription-page-preview?page=${page}&enhanced=${enhanced}&token=${encodeURIComponent(token)}`;
}


export interface ObservationInterpretation {
  id: string;
  observation_id: string;
  document_id: string;
  user_id: string;
  test_name: string;
  value: string;
  numeric_value?: number | null;
  unit?: string | null;
  reference_range?: string | null;
  status: "LOW" | "NORMAL" | "HIGH" | "UNKNOWN";
  severity: "NORMAL" | "INFORMATIONAL" | "REVIEW_RECOMMENDED" | "URGENT_REVIEW";
  explanation: string;
  confidence: number;
  source: string;
  created_at: string;
  updated_at: string;
}

export interface ObservationInterpretationListResponse {
  document_id?: string | null;
  total: number;
  summary: {
    LOW: number;
    NORMAL: number;
    HIGH: number;
    UNKNOWN: number;
    URGENT_REVIEW: number;
    REVIEW_RECOMMENDED: number;
  };
  interpretations: ObservationInterpretation[];
}

export interface InterpretTriggerResult {
  document_id: string;
  status: string;
  message: string;
  total_interpreted: number;
  interpretations: ObservationInterpretation[];
}

export interface LabTrendPoint {
  date: string;
  timestamp: string;
  value: number;
  unit?: string | null;
  status: string;
  severity: string;
  reference_min?: number | null;
  reference_max?: number | null;
  document_id: string;
  original_filename?: string | null;
}

export interface LabTrendSeries {
  test_name: string;
  unit?: string | null;
  latest_value?: number | null;
  latest_status: string;
  latest_severity: string;
  reference_range?: string | null;
  points: LabTrendPoint[];
}

export interface LabDashboardData {
  total_tests: number;
  normal_count: number;
  review_recommended_count: number;
  urgent_review_count: number;
  unknown_count: number;
  recent_interpretations: ObservationInterpretation[];
  trends: LabTrendSeries[];
}

export async function interpretDocumentApi(
  id: string,
  token: string
): Promise<InterpretTriggerResult> {
  const baseUrl = getApiBaseUrl();
  const res = await fetch(`${baseUrl}/api/documents/${id}/interpret`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.detail || "Failed to interpret laboratory observations.");
  }
  return data;
}

export async function getDocumentInterpretationsApi(
  id: string,
  token: string
): Promise<ObservationInterpretationListResponse> {
  const baseUrl = getApiBaseUrl();
  const res = await fetch(`${baseUrl}/api/documents/${id}/interpretations`, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.detail || "Failed to retrieve laboratory interpretations.");
  }
  return data;
}

export async function getLabDashboardApi(
  token: string
): Promise<LabDashboardData> {
  const baseUrl = getApiBaseUrl();
  const res = await fetch(`${baseUrl}/api/lab/dashboard`, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.detail || "Failed to load laboratory dashboard data.");
  }
  return data;
}

export async function getLabInterpretationsApi(
  token: string,
  filters?: { status?: string; severity?: string; test_name?: string }
): Promise<ObservationInterpretationListResponse> {
  const baseUrl = getApiBaseUrl();
  const params = new URLSearchParams();
  if (filters?.status) params.append("status", filters.status);
  if (filters?.severity) params.append("severity", filters.severity);
  if (filters?.test_name) params.append("test_name", filters.test_name);

  const qs = params.toString() ? `?${params.toString()}` : "";
  const res = await fetch(`${baseUrl}/api/lab/interpretations${qs}`, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.detail || "Failed to retrieve laboratory results.");
  }
  return data;
}

// ----------------------------------------------------
// PHASE 7: PERSONAL HEALTH SUMMARY TYPES & API
// ----------------------------------------------------

export interface SourceDocumentReference {
  document_id: string;
  filename: string;
  document_date?: string | null;
  hospital_name?: string | null;
  doctor_name?: string | null;
}

export interface HealthSnapshotSection {
  headline: string;
  patient_context: Record<string, any>;
  overview_text: string;
  total_records_analyzed: number;
  active_medications_count: number;
  lab_tests_count: number;
  abnormal_findings_count: number;
  source_document_ids: string[];
}

export interface MedicalRecordSummaryItem {
  document_id: string;
  filename: string;
  document_type: string;
  document_date?: string | null;
  doctor_name?: string | null;
  hospital_name?: string | null;
  key_findings: string[];
}

export interface MedicationSummaryItem {
  name: string;
  dosage?: string | null;
  route?: string | null;
  frequency?: string | null;
  duration?: string | null;
  instructions?: string | null;
  source_document_id: string;
  source_document_title: string;
}

export interface LabObservationSummaryItem {
  test_name: string;
  value: string;
  unit?: string | null;
  reference_range?: string | null;
  status: "LOW" | "NORMAL" | "HIGH" | "UNKNOWN" | string;
  test_date?: string | null;
  source_document_id: string;
  source_document_title: string;
}

export interface AbnormalResultSummaryItem {
  test_name: string;
  value: string;
  unit?: string | null;
  reference_range?: string | null;
  status: "LOW" | "HIGH" | "UNKNOWN" | string;
  severity: "INFORMATIONAL" | "REVIEW_RECOMMENDED" | "URGENT_REVIEW" | string;
  statement: string;
  action_guidance: string;
  source_document_id: string;
  source_document_title: string;
}

export interface DiagnosisSummaryItem {
  condition_name: string;
  recorded_date?: string | null;
  doctor_name?: string | null;
  hospital_name?: string | null;
  source_document_id: string;
  source_document_title: string;
}

export interface ImportantDateItem {
  date: string;
  event: string;
  category: "LAB_TEST" | "PRESCRIPTION" | "CONSULTATION" | "RECORD_UPLOAD" | string;
  source_document_id?: string | null;
}

export interface DoctorQuestionItem {
  id: string;
  category: string;
  question: string;
  context: string;
  related_test_or_topic?: string | null;
  source_document_id?: string | null;
}

export interface StructuredHealthSummaryContent {
  language: string;
  disclaimer: string;
  health_snapshot: HealthSnapshotSection;
  recent_medical_records: MedicalRecordSummaryItem[];
  medications: MedicationSummaryItem[];
  laboratory_observations: LabObservationSummaryItem[];
  abnormal_results: AbnormalResultSummaryItem[];
  recent_diagnoses: DiagnosisSummaryItem[];
  important_dates: ImportantDateItem[];
  doctor_questions: DoctorQuestionItem[];
}

export interface HealthSummaryResponse {
  id: string;
  user_id: string;
  language: "en" | "ta" | string;
  summary: StructuredHealthSummaryContent;
  source_documents: SourceDocumentReference[];
  model: string;
  confidence: number;
  generated_at: string;
  created_at: string;
  updated_at: string;
}

export async function getHealthSummaryApi(
  token: string,
  language: string = "en"
): Promise<HealthSummaryResponse> {
  const baseUrl = getApiBaseUrl();
  const res = await fetch(`${baseUrl}/api/health-summary?language=${encodeURIComponent(language)}`, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.detail || "Failed to load Personal Health Summary.");
  }
  return data;
}

export async function generateHealthSummaryApi(
  token: string,
  payload: { language?: string; force_refresh?: boolean } = {}
): Promise<HealthSummaryResponse> {
  const baseUrl = getApiBaseUrl();
  const res = await fetch(`${baseUrl}/api/health-summary/generate`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      language: payload.language || "en",
      force_refresh: payload.force_refresh ?? true,
    }),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.detail || "Failed to generate Personal Health Summary.");
  }
  return data;
}

export async function getHealthSummaryHistoryApi(
  token: string
): Promise<HealthSummaryResponse[]> {
  const baseUrl = getApiBaseUrl();
  const res = await fetch(`${baseUrl}/api/health-summary/history`, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.detail || "Failed to load health summary history.");
  }
  return data;
}

// ----------------------------------------------------
// PHASE 8: UNIFIED HEALTHCARE TIMELINE TYPES & API
// ----------------------------------------------------

export type TimelineEventTypeEnum =
  | "DOCUMENT"
  | "DIAGNOSIS"
  | "MEDICATION"
  | "LAB_RESULT"
  | "DIAGNOSTIC_REPORT"
  | "DISCHARGE"
  | "ENCOUNTER";

export interface TimelineEventItem {
  id: string;
  user_id: string;
  event_type: TimelineEventTypeEnum | string;
  event_date: string;
  title: string;
  description: string;
  source_document_id: string;
  source_document_title: string;
  metadata_json: Record<string, any>;
  created_at: string;
}

export interface TimelineEventGroup {
  date_group: string;
  display_date: string;
  event_count: number;
  events: TimelineEventItem[];
}

export interface TimelineSummaryStats {
  total_events: number;
  by_type: Record<string, number>;
  earliest_date?: string | null;
  latest_date?: string | null;
}

export interface TimelineResponse {
  events: TimelineEventItem[];
  grouped_events: TimelineEventGroup[];
  stats: TimelineSummaryStats;
  available_categories: string[];
}

export async function getTimelineApi(
  token: string,
  params?: {
    category?: string;
    event_type?: string;
    start_date?: string;
    end_date?: string;
    search?: string;
    order?: "desc" | "asc" | string;
  }
): Promise<TimelineResponse> {
  const baseUrl = getApiBaseUrl();
  const searchParams = new URLSearchParams();
  if (params?.category) searchParams.append("category", params.category);
  if (params?.event_type) searchParams.append("event_type", params.event_type);
  if (params?.start_date) searchParams.append("start_date", params.start_date);
  if (params?.end_date) searchParams.append("end_date", params.end_date);
  if (params?.search) searchParams.append("search", params.search);
  if (params?.order) searchParams.append("order", params.order);

  const qs = searchParams.toString() ? `?${searchParams.toString()}` : "";
  const res = await fetch(`${baseUrl}/api/timeline${qs}`, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.detail || "Failed to load healthcare timeline.");
  }
  return data;
}

export async function syncTimelineApi(
  token: string
): Promise<{ status: string; synced_events_count: number; message: string }> {
  const baseUrl = getApiBaseUrl();
  const res = await fetch(`${baseUrl}/api/timeline/sync`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.detail || "Failed to sync healthcare timeline.");
  }
  return data;
}

// ============================================================================
// PHASE 10: ABDM-Ready Healthcare Data Architecture (FHIR R4 & Mock ABHA)
// ============================================================================

export interface MockAbhaMeta {
  mock_abha_id: string;
  mock_abha_address: string;
  badge: string;
  disclaimer: string;
  is_official_abdm: boolean;
}

export interface FHIRCoding {
  system?: string;
  code?: string;
  display?: string;
}

export interface FHIRCodeableConcept {
  coding?: FHIRCoding[];
  text?: string;
}

export interface FHIRReference {
  reference?: string;
  display?: string;
  type?: string;
}

export interface FHIRQuantity {
  value?: number;
  unit?: string;
  system?: string;
  code?: string;
}

export interface FHIRIdentifier {
  use?: string;
  system?: string;
  value: string;
  type?: FHIRCodeableConcept;
}

export interface FHIRPatientName {
  use?: string;
  text: string;
  family?: string;
  given?: string[];
}

export interface FHIRTelecom {
  system: string;
  value: string;
  use?: string;
}

export interface FHIRPatient {
  resourceType: "Patient";
  id: string;
  identifier: FHIRIdentifier[];
  active: boolean;
  name: FHIRPatientName[];
  telecom: FHIRTelecom[];
  gender?: string | null;
  birthDate?: string | null;
  communication?: Array<{
    language?: { coding?: FHIRCoding[]; text?: string };
    preferred?: boolean;
  }>;
  meta?: Record<string, any>;
  mock_abha_meta: MockAbhaMeta;
}

export interface FHIRObservation {
  resourceType: "Observation";
  id: string;
  status: string;
  category: FHIRCodeableConcept[];
  code: FHIRCodeableConcept;
  subject: FHIRReference;
  effectiveDateTime?: string | null;
  valueQuantity?: FHIRQuantity | null;
  valueString?: string | null;
  interpretation?: FHIRCodeableConcept[];
  referenceRange?: Array<{
    text?: string;
    type?: { coding?: FHIRCoding[] };
  }>;
  note?: Array<{ text: string }>;
  derivedFrom?: FHIRReference[];
}

export interface FHIRMedicationRequest {
  resourceType: "MedicationRequest";
  id: string;
  status: string;
  intent: string;
  medicationCodeableConcept: FHIRCodeableConcept;
  subject: FHIRReference;
  authoredOn?: string | null;
  requester?: FHIRReference | null;
  dosageInstruction?: Array<{
    text?: string;
    route?: { text?: string };
    timing?: { code?: { text?: string } };
    patientInstruction?: string;
  }>;
  supportingInformation?: FHIRReference[];
}

export interface FHIRCondition {
  resourceType: "Condition";
  id: string;
  clinicalStatus: FHIRCodeableConcept;
  verificationStatus: FHIRCodeableConcept;
  category: FHIRCodeableConcept[];
  code: FHIRCodeableConcept;
  subject: FHIRReference;
  recordedDate?: string | null;
  evidence?: Array<{
    detail?: FHIRReference[];
  }>;
}

export interface FHIRDiagnosticReport {
  resourceType: "DiagnosticReport";
  id: string;
  status: string;
  category: FHIRCodeableConcept[];
  code: FHIRCodeableConcept;
  subject: FHIRReference;
  effectiveDateTime?: string | null;
  issued?: string | null;
  performer?: FHIRReference[];
  result?: FHIRReference[];
  presentedForm?: Array<{
    contentType?: string;
    url?: string;
    title?: string;
    size?: number;
  }>;
}

export interface FHIRDocumentReference {
  resourceType: "DocumentReference";
  id: string;
  status: string;
  docStatus: string;
  type: FHIRCodeableConcept;
  subject: FHIRReference;
  date?: string | null;
  author?: FHIRReference[];
  content: Array<{
    attachment: {
      contentType?: string;
      url?: string;
      title?: string;
      size?: number;
    };
  }>;
}

export interface FHIREncounter {
  resourceType: "Encounter";
  id: string;
  status: string;
  class?: Record<string, any>;
  subject: FHIRReference;
  participant?: Array<{ individual?: { display?: string; type?: string } }>;
  period?: { start?: string; end?: string };
  serviceProvider?: FHIRReference;
  diagnosis?: Array<{ condition?: FHIRReference }>;
}

export interface FHIRBundleEntry {
  fullUrl: string;
  resource: any;
}

export interface FHIRBundle {
  resourceType: "Bundle";
  id: string;
  type: string;
  timestamp: string;
  total: number;
  meta?: Record<string, any>;
  entry: FHIRBundleEntry[];
  resources?: any[];
}

export async function getFhirPatientApi(token: string): Promise<FHIRPatient> {
  const baseUrl = getApiBaseUrl();
  const res = await fetch(`${baseUrl}/api/fhir/patient`, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.detail || "Failed to load FHIR Patient data.");
  }
  return data;
}

export async function getFhirObservationsApi(token: string): Promise<FHIRBundle> {
  const baseUrl = getApiBaseUrl();
  const res = await fetch(`${baseUrl}/api/fhir/observations`, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.detail || "Failed to load FHIR Observations.");
  }
  return data;
}

export async function getFhirMedicationsApi(token: string): Promise<FHIRBundle> {
  const baseUrl = getApiBaseUrl();
  const res = await fetch(`${baseUrl}/api/fhir/medications`, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.detail || "Failed to load FHIR Medications.");
  }
  return data;
}

export async function getFhirConditionsApi(token: string): Promise<FHIRBundle> {
  const baseUrl = getApiBaseUrl();
  const res = await fetch(`${baseUrl}/api/fhir/conditions`, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.detail || "Failed to load FHIR Conditions.");
  }
  return data;
}

export async function getFhirDiagnosticReportsApi(token: string): Promise<FHIRBundle> {
  const baseUrl = getApiBaseUrl();
  const res = await fetch(`${baseUrl}/api/fhir/diagnostic-reports`, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.detail || "Failed to load FHIR Diagnostic Reports.");
  }
  return data;
}

export async function getFhirDocumentReferencesApi(token: string): Promise<FHIRBundle> {
  const baseUrl = getApiBaseUrl();
  const res = await fetch(`${baseUrl}/api/fhir/document-references`, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.detail || "Failed to load FHIR Document References.");
  }
  return data;
}

export async function getFhirEncountersApi(token: string): Promise<FHIRBundle> {
  const baseUrl = getApiBaseUrl();
  const res = await fetch(`${baseUrl}/api/fhir/encounters`, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.detail || "Failed to load FHIR Encounters.");
  }
  return data;
}

export async function getFhirExportBundleApi(token: string): Promise<FHIRBundle> {
  const baseUrl = getApiBaseUrl();
  const res = await fetch(`${baseUrl}/api/fhir/export`, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.detail || "Failed to export FHIR Bundle.");
  }
  return data;
}

export interface AuditLogItem {
  id: string;
  event_type: string;
  status: string;
  resource_id?: string | null;
  ip_address?: string | null;
  user_agent?: string | null;
  created_at: string;
  details?: Record<string, any> | null;
}

export async function fetchAuditLogsApi(token: string): Promise<AuditLogItem[]> {
  const baseUrl = getApiBaseUrl();
  try {
    const res = await fetch(`${baseUrl}/api/auth/me/audit-logs`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
    });
    if (!res.ok) {
      return [];
    }
    return await res.json();
  } catch {
    return [];
  }
}

export async function updateUserLanguageApi(language: "en" | "ta", token: string): Promise<User> {
  const baseUrl = getApiBaseUrl();
  const res = await fetch(`${baseUrl}/api/auth/me/language`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ preferred_language: language }),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.detail || "Failed to update language.");
  }
  return data;
}

// ==============================================================================
// PERSONAL HEALTH COPILOT INTERFACES & API FUNCTIONS
// ==============================================================================

export interface SourceReference {
  document_id?: string | null;
  document_name: string;
  page?: number | null;
  relevance: number;
  snippet?: string | null;
  source_type: string;
}

export interface CopilotChatRequest {
  message: string;
  document_id?: string | null;
  session_id?: string | null;
  language: "en" | "ta";
}

export interface CopilotChatResponse {
  answer: string;
  sources: SourceReference[];
  language: string;
  disclaimer: string;
  session_id: string;
  message_id: string;
  confidence: number;
  mode: "general" | "personal_health" | "mixed_health" | "current_web" | "document_specific" | string;
}

export interface ChatMessageItem {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  sources: SourceReference[];
  disclaimer?: string | null;
  created_at: string;
}

export interface ChatSessionSummary {
  id: string;
  title: string;
  document_id?: string | null;
  document_name?: string | null;
  created_at: string;
  updated_at: string;
  message_count: number;
}

export interface ChatSessionDetail {
  id: string;
  title: string;
  document_id?: string | null;
  document_name?: string | null;
  created_at: string;
  updated_at: string;
  messages: ChatMessageItem[];
}

export async function chatWithCopilotApi(
  payload: CopilotChatRequest,
  token: string
): Promise<CopilotChatResponse> {
  const baseUrl = getApiBaseUrl();
  const res = await fetch(`${baseUrl}/api/copilot/chat`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.detail || "Health Copilot was unable to process your inquiry.");
  }
  return data;
}

export async function fetchChatSessionsApi(token: string): Promise<ChatSessionSummary[]> {
  const baseUrl = getApiBaseUrl();
  const res = await fetch(`${baseUrl}/api/copilot/sessions`, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
  });

  if (!res.ok) {
    return [];
  }
  return await res.json();
}

export async function fetchChatSessionDetailApi(
  sessionId: string,
  token: string
): Promise<ChatSessionDetail> {
  const baseUrl = getApiBaseUrl();
  const res = await fetch(`${baseUrl}/api/copilot/sessions/${sessionId}`, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.detail || "Failed to retrieve conversation history.");
  }
  return data;
}

export async function deleteChatSessionApi(sessionId: string, token: string): Promise<void> {
  const baseUrl = getApiBaseUrl();
  const res = await fetch(`${baseUrl}/api/copilot/sessions/${sessionId}`, {
    method: "DELETE",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
  });

  if (!res.ok) {
    const data = await res.json();
    throw new Error(data.detail || "Failed to delete session.");
  }
}

export async function indexDocumentVectorChunksApi(
  documentId: string,
  token: string
): Promise<{ document_id: string; chunk_count: number; message: string }> {
  const baseUrl = getApiBaseUrl();
  const res = await fetch(`${baseUrl}/api/documents/${documentId}/index`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.detail || "Failed to index document chunks.");
  }
  return data;
}
