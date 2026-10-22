import type { NextRequest } from "next/server";

const HOP_BY_HOP = new Set([
  "connection",
  "content-length",
  "host",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "te",
  "trailers",
  "transfer-encoding",
  "upgrade",
]);

export function backendOrigin(): string {
  return (process.env.BACKEND_ORIGIN || "http://127.0.0.1:8000").replace(/\/+$/, "");
}

export async function proxyToBackend(req: NextRequest, backendPath: string): Promise<Response> {
  const incoming = new URL(req.url);
  const target = `${backendOrigin()}${backendPath.startsWith("/") ? backendPath : `/${backendPath}`}${incoming.search}`;
  const headers = new Headers();
  req.headers.forEach((value, key) => {
    if (!HOP_BY_HOP.has(key.toLowerCase())) {
      headers.set(key, value);
    }
  });

  const init: RequestInit = {
    method: req.method,
    headers,
    redirect: "manual",
  };
  if (req.method !== "GET" && req.method !== "HEAD") {
    init.body = await req.arrayBuffer();
  }

  const upstream = await fetch(target, init);
  const outHeaders = new Headers();
  upstream.headers.forEach((value, key) => {
    if (!HOP_BY_HOP.has(key.toLowerCase())) {
      outHeaders.set(key, value);
    }
  });
  return new Response(upstream.body, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers: outHeaders,
  });
}
