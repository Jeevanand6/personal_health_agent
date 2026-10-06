export interface HealthStatus {
  status: "healthy" | "unhealthy" | "offline";
  database: "connected" | "disconnected" | "unknown";
  timestamp?: string;
  error?: string;
}

const getApiBaseUrl = (): string => {
  if (typeof window !== "undefined") {
    // Client-side execution
    return process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
  }
  // Server-side execution in container
  return process.env.INTERNAL_API_URL || process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
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
