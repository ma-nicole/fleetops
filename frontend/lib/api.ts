/** Ensures requests hit `.../api/...` when env omits `/api` (common misconfiguration). */
function normalizeApiBase(raw: string): string {
  const trimmed = raw.trim().replace(/\/+$/, "");
  /** Same-origin proxy (see next.config.mjs); avoids direct cross-origin fetch in local dev. */
  if (!trimmed) return "/api-proxy";
  /** Same-origin proxy path from Next.js `rewrites` (see next.config.mjs). */
  if (trimmed.startsWith("/")) {
    /** `/api-proxy/api` double-prefixes to `/api/api/...` and returns 404 from FastAPI. */
    if (trimmed === "/api-proxy/api" || trimmed.endsWith("/api-proxy/api")) {
      return "/api-proxy";
    }
    return trimmed;
  }
  /** Misconfigured direct URL (`http://127.0.0.1:8000/api/proxy`) — use Next rewrite path instead. */
  if (/\/api\/proxy\/?$/i.test(trimmed)) return "/api-proxy";
  if (/\/api(\/|$)/.test(trimmed)) return trimmed;
  return `${trimmed}/api`;
}

export const API_BASE_URL = normalizeApiBase(
  process.env.NEXT_PUBLIC_API_URL ?? "/api-proxy",
);

if (process.env.NODE_ENV === "production") {
  const rawApi = (process.env.NEXT_PUBLIC_API_URL ?? "").trim();
  if (!rawApi) {
    throw new Error("NEXT_PUBLIC_API_URL is required in production.");
  }
  if (!(rawApi.startsWith("https://") || rawApi.startsWith("/api-proxy"))) {
    throw new Error("NEXT_PUBLIC_API_URL must be an HTTPS URL or /api-proxy in production.");
  }
}

/** Absolute URL for fetch (handles `/api-proxy` during SSR vs browser). */
export function apiFullUrl(path: string): string {
  const p = path.startsWith("/") ? path : `/${path}`;
  const origin =
    typeof window !== "undefined"
      ? window.location.origin
      : `http://127.0.0.1:${process.env.PORT ?? "3000"}`;
  /** Backend-served files (see next.config rewrites for `/uploads/*`). */
  if (p.startsWith("/uploads/")) {
    return `${origin}${p}`;
  }
  const base = API_BASE_URL;
  if (base.startsWith("/")) {
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

/** Parse FastAPI `{ "detail": "..." }` (or validation error list) from response text. */
export function parseApiDetail(text: string): string | null {
  const trimmed = text.trim();
  if (!trimmed) return null;
  try {
    const data = JSON.parse(trimmed) as { detail?: unknown };
    const detail = data.detail;
    if (typeof detail === "string" && detail.trim()) {
      return detail.trim();
    }
    if (Array.isArray(detail)) {
      const parts = detail
        .map((item) => {
          if (!item || typeof item !== "object") return null;
          const msg = (item as { msg?: unknown }).msg;
          return typeof msg === "string" && msg.trim() ? msg.trim() : null;
        })
        .filter(Boolean);
      if (parts.length) return parts.join(" ");
    }
  } catch {
    /* non-JSON body */
  }
  return null;
}

const SESSION_EXPIRED = "Your session expired. Please sign in again.";

const MAP_VERIFY_WARNING =
  "Map location could not be verified. You may continue using manual route details.";

/** User-facing text; prefers backend `detail`, keeps raw `body` on ApiError for debugging. */
function messageFromErrorResponse(status: number, text: string, hadAuth = false): string {
  const detail = parseApiDetail(text);
  if (detail) {
    if (/could not place pickup and dropoff on the map/i.test(detail)) {
      return MAP_VERIFY_WARNING;
    }
    return detail;
  }
  if (status === 401) {
    return hadAuth ? SESSION_EXPIRED : "Authentication required. Please sign in.";
  }
  if (status === 403) {
    return "You are not authorized to access this record.";
  }
  if (status === 404) {
    return "Unable to load data.";
  }
  if (status === 400) {
    const trimmed = text.trim();
    return trimmed || "The server rejected this request.";
  }
  if (status >= 500) {
    return "Something went wrong. Please try again.";
  }
  return "Unable to load data.";
}

type HandleOptions = {
  /** Drop stored JWT when an authenticated request is rejected (401/423). */
  clearAuthOnFailure?: boolean;
  /** Request included Authorization — refines 401 copy (session expired vs not signed in). */
  hadAuth?: boolean;
};

async function handle<T>(response: Response, options: HandleOptions = {}): Promise<T> {
  const clearAuth = options.clearAuthOnFailure ?? false;
  const hadAuth = options.hadAuth ?? false;
  if (clearAuth && (response.status === 401 || response.status === 423)) {
    if (typeof window !== "undefined") {
      window.localStorage.removeItem("token");
      window.localStorage.removeItem("authToken");
    }
  }
  if (!response.ok) {
    const text = await response.text();
    const message = messageFromErrorResponse(response.status, text, hadAuth);
    throw new ApiError(message, response.status, text);
  }
  if (response.status === 204) return undefined as unknown as T;
  return (await response.json()) as T;
}

/** Default fetch timeout (ms). Analytics uses {@link ANALYTICS_API_TIMEOUT_MS}. */
export const DEFAULT_API_TIMEOUT_MS = 30_000;

/** Role analytics dashboards can exceed 30s on remote DB + predictive blocks. */
export const ANALYTICS_API_TIMEOUT_MS = 120_000;

export type ApiFetchOptions = RequestInit & {
  timeoutMs?: number;
};

export async function apiFetch<T>(path: string, init?: ApiFetchOptions): Promise<T> {
  const { timeoutMs = DEFAULT_API_TIMEOUT_MS, ...requestInit } = init ?? {};
  const headers = buildHeaders(requestInit);
  const hadAuth = Boolean(
    (headers as Record<string, string>).Authorization ||
      (requestInit?.headers as Record<string, string> | undefined)?.Authorization,
  );
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(apiFullUrl(path), {
      ...requestInit,
      headers,
      cache: "no-store",
      signal: controller.signal,
    });
    return await handle<T>(response, { clearAuthOnFailure: hadAuth, hadAuth });
  } catch (err) {
    if (err instanceof ApiError) throw err;
    if (err instanceof DOMException && err.name === "AbortError") {
      throw new ApiError("Request timed out. Please try again.", 408, "");
    }
    throw err;
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function apiGet<T>(path: string, timeoutMs?: number): Promise<T> {
  return apiFetch<T>(path, { method: "GET", timeoutMs });
}

export async function apiPost<T>(path: string, body?: unknown, timeoutMs?: number): Promise<T> {
  return apiFetch<T>(path, {
    method: "POST",
    body: body !== undefined ? JSON.stringify(body) : undefined,
    timeoutMs,
  });
}

export async function apiPostMultipart<T>(path: string, formData: FormData): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {};
  if (token) headers["Authorization"] = `Bearer ${token}`;
  const response = await fetch(apiFullUrl(path), {
    method: "POST",
    headers,
    body: formData,
    cache: "no-store",
  });
  return handle<T>(response, { clearAuthOnFailure: Boolean(token), hadAuth: Boolean(token) });
}

export async function apiPatch<T>(path: string, body?: unknown): Promise<T> {
  return apiFetch<T>(path, {
    method: "PATCH",
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
}

export async function apiPut<T>(path: string, body?: unknown): Promise<T> {
  return apiFetch<T>(path, {
    method: "PUT",
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

export type ForgotPasswordResponse = {
  message: string;
};

export async function apiLogin(email: string, password: string): Promise<LoginResponse> {
  const response = await fetch(apiFullUrl("/auth/login"), {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ username: email, password }),
    cache: "no-store",
  });
  /** Never clear an existing token on failed credential check. */
  return handle<LoginResponse>(response, { clearAuthOnFailure: false });
}

export async function apiForgotPassword(email: string): Promise<ForgotPasswordResponse> {
  return apiPost<ForgotPasswordResponse>("/auth/forgot-password", { email });
}

export type ResetPasswordResponse = {
  message: string;
};

export async function apiResetPassword(token: string, newPassword: string): Promise<ResetPasswordResponse> {
  return apiPost<ResetPasswordResponse>("/auth/reset-password", {
    token,
    new_password: newPassword,
  });
}

export type ChangePasswordResponse = {
  message: string;
};

export async function apiChangePassword(currentPassword: string, newPassword: string): Promise<ChangePasswordResponse> {
  return apiPost<ChangePasswordResponse>("/auth/change-password", {
    current_password: currentPassword,
    new_password: newPassword,
  });
}

export type MeUser = {
  id: number;
  email: string;
  full_name: string;
  company_name: string | null;
  phone: string | null;
  role: string;
};

export async function apiGetMe(): Promise<MeUser> {
  return apiGet<MeUser>("/auth/me");
}

export async function apiUpdateCustomerProfile(payload: {
  full_name: string;
  company_name?: string | null;
  phone?: string | null;
}): Promise<MeUser> {
  return apiPatch<MeUser>("/auth/profile", payload);
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
  if (typeof role !== "string") return null;
  const t = role.trim().toLowerCase();
  return t ? t : null;
}

/** JWT `sub` — backend uses user email as subject for local auth. */
export function decodeJwtSubject(token: string): string | null {
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const payload = decodeJwtPayloadJson(parts[1]);
  const sub = payload?.sub;
  return typeof sub === "string" ? sub : null;
}
