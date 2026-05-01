/** Ensures requests hit `.../api/...` when env omits `/api` (common misconfiguration). */
function normalizeApiBase(raw: string): string {
  const trimmed = raw.trim().replace(/\/+$/, "");
  if (!trimmed) return "http://127.0.0.1:8000/api";
  /** Same-origin proxy path from Next.js `rewrites` (see next.config.mjs). */
  if (trimmed.startsWith("/")) return trimmed;
  if (/\/api(\/|$)/.test(trimmed)) return trimmed;
  return `${trimmed}/api`;
}

export const API_BASE_URL = normalizeApiBase(
  process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000/api",
);

/** Absolute URL for fetch (handles `/api-proxy` during SSR vs browser). */
export function apiFullUrl(path: string): string {
  const p = path.startsWith("/") ? path : `/${path}`;
  const base = API_BASE_URL;
  if (base.startsWith("/")) {
    const origin =
      typeof window !== "undefined"
        ? window.location.origin
        : `http://127.0.0.1:${process.env.PORT ?? "3000"}`;
    return `${origin}${base}${p}`;
  }
  return `${base.replace(/\/+$/, "")}${p}`;
}

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
  const response = await fetch(apiFullUrl(path), {
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

export type LoginResponse = {
  access_token: string;
  token_type?: string;
  role?: string | null;
};

export async function apiLogin(email: string, password: string): Promise<LoginResponse> {
  const response = await fetch(apiFullUrl("/auth/login"), {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ username: email, password }),
    cache: "no-store",
  });
  return handle<LoginResponse>(response);
}

/** Decode JWT payload segment (base64url); pads for browsers where `atob` requires it. */
function decodeJwtPayloadJson(segment: string): Record<string, unknown> | null {
  try {
    let base64 = segment.replace(/-/g, "+").replace(/_/g, "/");
    const pad = base64.length % 4;
    if (pad) base64 += "=".repeat(4 - pad);
    const json = atob(base64);
    return JSON.parse(json) as Record<string, unknown>;
  } catch {
    return null;
  }
}

export function decodeJwtRole(token: string): string | null {
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const payload = decodeJwtPayloadJson(parts[1]);
  const role = payload?.role;
  return typeof role === "string" ? role : null;
}

/** JWT `sub` — backend uses user email as subject for local auth. */
export function decodeJwtSubject(token: string): string | null {
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const payload = decodeJwtPayloadJson(parts[1]);
  const sub = payload?.sub;
  return typeof sub === "string" ? sub : null;
}
