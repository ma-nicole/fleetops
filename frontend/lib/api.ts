export const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api";

function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem("token") || window.localStorage.getItem("authToken");
}

function buildHeaders(init?: RequestInit, isJson = true): HeadersInit {
  const token = getToken();
  const headers: Record<string, string> = {};
  if (isJson) headers["Content-Type"] = "application/json";
  if (token) headers["Authorization"] = `Bearer ${token}`;
  return { ...headers, ...((init?.headers as Record<string, string>) || {}) };
}

export class ApiError extends Error {
  status: number;
  body: string;
  constructor(message: string, status: number, body: string) {
    super(message);
    this.status = status;
    this.body = body;
  }
}

async function handle<T>(response: Response): Promise<T> {
  if (response.status === 401 || response.status === 423) {
    if (typeof window !== "undefined") {
      window.localStorage.removeItem("token");
      window.localStorage.removeItem("authToken");
    }
  }
  if (!response.ok) {
    const text = await response.text();
    throw new ApiError(text || `Request failed (${response.status})`, response.status, text);
  }
  if (response.status === 204) return undefined as unknown as T;
  return (await response.json()) as T;
}

export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: buildHeaders(init),
    cache: "no-store",
  });
  return handle<T>(response);
}

export async function apiGet<T>(path: string): Promise<T> {
  return apiFetch<T>(path, { method: "GET" });
}

export async function apiPost<T>(path: string, body?: unknown): Promise<T> {
  return apiFetch<T>(path, {
    method: "POST",
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
}

export async function apiPatch<T>(path: string, body?: unknown): Promise<T> {
  return apiFetch<T>(path, {
    method: "PATCH",
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
}

export async function apiDelete<T>(path: string): Promise<T> {
  return apiFetch<T>(path, { method: "DELETE" });
}

export async function apiLogin(email: string, password: string): Promise<{ access_token: string }> {
  const response = await fetch(`${API_BASE_URL}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ username: email, password }),
    cache: "no-store",
  });
  return handle<{ access_token: string }>(response);
}

export function decodeJwtRole(token: string): string | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const payload = JSON.parse(atob(parts[1].replace(/-/g, "+").replace(/_/g, "/")));
    return (payload?.role as string) || null;
  } catch {
    return null;
  }
}
