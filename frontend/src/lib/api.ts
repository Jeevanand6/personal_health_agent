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
  | "FAILED";

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
