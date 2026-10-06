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
